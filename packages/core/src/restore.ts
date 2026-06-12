import { fingerprintSimilarity } from './fingerprint';
import { jaccard, trigrams } from './trigram';
import type { Block, PositionRecord, RestoreResult, TextAnchor } from './types';

export const FUZZY_THRESHOLD = 0.8;
export const FUZZY_WINDOW = 30;
export const DRIFT_THRESHOLD = 0.15;
export const ABORT_FINGERPRINT_THRESHOLD = 0.3;

const SPACING_TOLERANCE = 8;
const MAX_CANDIDATES_PER_ANCHOR = 16;

interface AnchorMatch {
  anchor: TextAnchor;
  blockIndex: number;
  offset: number;
  score: number;
}

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function contextScore(anchor: TextAnchor, blockText: string, offset: number): number {
  const before = blockText.slice(Math.max(0, offset - anchor.prefix.length), offset);
  const after = blockText.slice(
    offset + anchor.exactText.length,
    offset + anchor.exactText.length + anchor.suffix.length,
  );
  const expected = anchor.prefix.length + anchor.suffix.length;
  if (expected === 0) return 1;
  return (
    (commonSuffixLength(before, anchor.prefix) + commonPrefixLength(after, anchor.suffix)) /
    expected
  );
}

export function findExact(anchor: TextAnchor, blocks: Block[]): AnchorMatch[] {
  const matches: AnchorMatch[] = [];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const text = blocks[blockIndex]!.text;
    let offset = text.indexOf(anchor.exactText);
    while (offset !== -1) {
      matches.push({ anchor, blockIndex, offset, score: contextScore(anchor, text, offset) });
      offset = text.indexOf(anchor.exactText, offset + 1);
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, MAX_CANDIDATES_PER_ANCHOR);
}

export function areConsistent(matches: AnchorMatch[]): boolean {
  const ordered = [...matches].sort((a, b) => a.anchor.blockIndex - b.anchor.blockIndex);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const curr = ordered[i]!;
    if (curr.blockIndex <= prev.blockIndex) return false;
    const capturedGap = curr.anchor.blockIndex - prev.anchor.blockIndex;
    const foundGap = curr.blockIndex - prev.blockIndex;
    if (Math.abs(foundGap - capturedGap) > SPACING_TOLERANCE) return false;
  }
  return true;
}

function centerFromMatches(record: PositionRecord, matches: AnchorMatch[]): RestoreResult | null {
  const center = matches.find((m) => m.anchor.role === 'center');
  if (center) {
    return { confidence: 'exact', blockIndex: center.blockIndex, intraBlockOffset: center.offset };
  }
  const centerAnchor = record.anchors.find((a) => a.role === 'center');
  if (!centerAnchor || matches.length === 0) return null;
  const shift =
    matches.reduce((sum, m) => sum + (m.blockIndex - m.anchor.blockIndex), 0) / matches.length;
  return {
    confidence: 'exact',
    blockIndex: centerAnchor.blockIndex + Math.round(shift),
    intraBlockOffset: centerAnchor.intraBlockOffset,
  };
}

function exactStage(record: PositionRecord, blocks: Block[]): RestoreResult | null {
  const candidatesPerAnchor = record.anchors.map((anchor) => findExact(anchor, blocks));
  const required = Math.min(2, record.anchors.length);
  if (candidatesPerAnchor.filter((c) => c.length > 0).length < required) return null;

  const best: { matches: AnchorMatch[] | null; score: number } = { matches: null, score: 0 };
  const pick = (index: number, chosen: AnchorMatch[]) => {
    if (index === candidatesPerAnchor.length) {
      if (chosen.length < required || !areConsistent(chosen)) return;
      const score = chosen.reduce((sum, m) => sum + m.score, 0) + chosen.length;
      if (score > best.score) {
        best.matches = [...chosen];
        best.score = score;
      }
      return;
    }
    for (const candidate of candidatesPerAnchor[index]!) {
      chosen.push(candidate);
      pick(index + 1, chosen);
      chosen.pop();
    }
    pick(index + 1, chosen);
  };
  pick(0, []);

  return best.matches ? centerFromMatches(record, best.matches) : null;
}

export function findFuzzy(anchor: TextAnchor, blocks: Block[]): AnchorMatch | null {
  const anchorTris = trigrams(anchor.exactText);
  const windowLength = anchor.exactText.length;
  const probe = anchor.exactText.slice(0, 12);
  const from = Math.max(0, anchor.blockIndex - FUZZY_WINDOW);
  const to = Math.min(blocks.length - 1, anchor.blockIndex + FUZZY_WINDOW);

  let best: AnchorMatch | null = null;
  for (let blockIndex = from; blockIndex <= to; blockIndex++) {
    const text = blocks[blockIndex]!.text;
    const lastStart = Math.max(0, text.length - windowLength);

    const starts = new Set<number>();
    const step = Math.max(10, Math.floor(windowLength / 4));
    for (let s = 0; s < lastStart; s += step) starts.add(s);
    starts.add(lastStart);
    starts.add(Math.min(anchor.intraBlockOffset, lastStart));
    const probeAt = probe ? text.indexOf(probe) : -1;
    if (probeAt !== -1) starts.add(Math.min(probeAt, lastStart));

    for (const start of starts) {
      const score = jaccard(anchorTris, trigrams(text.slice(start, start + windowLength)));
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
        best = { anchor, blockIndex, offset: start, score };
      }
    }
  }
  return best;
}

function fuzzyStage(record: PositionRecord, blocks: Block[]): RestoreResult | null {
  const centerAnchor = record.anchors.find((a) => a.role === 'center');
  if (centerAnchor) {
    const match = findFuzzy(centerAnchor, blocks);
    if (match) {
      return { confidence: 'fuzzy', blockIndex: match.blockIndex, intraBlockOffset: match.offset };
    }
  }
  for (const anchor of record.anchors) {
    if (anchor.role === 'center' || !centerAnchor) continue;
    const match = findFuzzy(anchor, blocks);
    if (match) {
      const inferred = centerAnchor.blockIndex + (match.blockIndex - anchor.blockIndex);
      if (inferred >= 0 && inferred < blocks.length) {
        return {
          confidence: 'fuzzy',
          blockIndex: inferred,
          intraBlockOffset: centerAnchor.intraBlockOffset,
        };
      }
    }
  }
  return null;
}

export function restorePosition(record: PositionRecord, blocks: Block[]): RestoreResult {
  if (blocks.length === 0) return { confidence: 'abort' };

  const exact = exactStage(record, blocks);
  if (exact) return exact;

  const fuzzy = fuzzyStage(record, blocks);
  if (fuzzy) return fuzzy;

  const similarity = fingerprintSimilarity(record.contentFingerprint, blocks);
  if (similarity < ABORT_FINGERPRINT_THRESHOLD) return { confidence: 'abort' };

  const drift = Math.abs(blocks.length - record.blockCount) / Math.max(1, record.blockCount);
  const centerAnchor = record.anchors.find((a) => a.role === 'center');
  if (drift < DRIFT_THRESHOLD && centerAnchor) {
    return {
      confidence: 'ordinal',
      blockIndex: Math.min(centerAnchor.blockIndex, blocks.length - 1),
      intraBlockOffset: centerAnchor.intraBlockOffset,
    };
  }

  return { confidence: 'percent', scrollPercent: record.scrollPercent };
}
