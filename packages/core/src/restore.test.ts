import { describe, expect, it } from 'vitest';
import { capturePosition } from './capture';
import { findExact, findFuzzy, restorePosition } from './restore';
import type { Block } from './types';

const WORDS = [
  'river',
  'mountain',
  'harbor',
  'meadow',
  'lantern',
  'orchard',
  'granite',
  'thunder',
  'velvet',
  'compass',
  'ember',
  'willow',
  'falcon',
  'marble',
  'cinder',
  'prairie',
  'anchor',
  'tundra',
  'saffron',
  'glacier',
  'bramble',
  'cobalt',
  'heron',
  'juniper',
];

function uniqueBlocks(count: number): Block[] {
  return Array.from({ length: count }, (_, i) => {
    const a = WORDS[i % WORDS.length];
    const b = WORDS[(i * 5 + 1) % WORDS.length];
    const c = WORDS[(i * 11 + 2) % WORDS.length];
    const templates = [
      `the ${a} stood beside the ${b} while ${c} drifted over paragraph ${i} of this corpus`,
      `chapter ${i} describes how a ${a} can outlast any ${b} when the ${c} finally settles`,
      `notes on ${a}, ${b} and ${c}: entry number ${i} in the field journal of the expedition`,
      `${a} versus ${b}: a meditation numbered ${i} concerning the slow erosion of the ${c}`,
      `when the ${a} met the ${b} at milestone ${i}, the ${c} was already waiting there`,
    ];
    return { text: templates[i % templates.length]! };
  });
}

describe('restorePosition cascade', () => {
  it('returns exact on identical content', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20, { intraBlockOffset: 10 });
    const result = restorePosition(record, blocks);
    expect(result.confidence).toBe('exact');
    expect(result.blockIndex).toBe(20);
    expect(result.intraBlockOffset).toBe(10);
  });

  it('returns exact with shifted indices after insertions', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const inserted: Block[] = [
      ...blocks.slice(0, 5),
      { text: 'sponsored content advertisement block inserted by the page after capture' },
      ...blocks.slice(5),
    ];
    const result = restorePosition(record, inserted);
    expect(result.confidence).toBe('exact');
    expect(result.blockIndex).toBe(21);
  });

  it('survives removal of the center block via remaining anchors', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const removed = blocks.filter((_, i) => i !== 20);
    const result = restorePosition(record, removed);
    expect(result.confidence).toBe('exact');
    expect(result.blockIndex).toBe(20);
  });

  it('falls back to fuzzy when the anchor text has typos', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const dropChar = (text: string) =>
      text.replace(/\b(\w{6,})\b/, (m) => m.slice(0, 3) + m.slice(4));
    const typoed = blocks.map((b, i) => (Math.abs(i - 20) <= 2 ? { text: dropChar(b.text) } : b));
    const result = restorePosition(record, typoed);
    expect(['exact', 'fuzzy']).toContain(result.confidence);
    expect(result.blockIndex).toBe(20);
  });

  it('aborts on fully rewritten content instead of guessing', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const rewritten = uniqueBlocks(50).map((_, i) => ({
      text: `entirely new unrelated essay paragraph ${i} sharing nothing with the original text`,
    }));
    expect(restorePosition(record, rewritten).confidence).toBe('abort');
  });

  it('aborts on empty documents', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    expect(restorePosition(record, []).confidence).toBe('abort');
  });

  it('uses ordinal when anchors are gone but structure is stable', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const paraphrased = blocks.map((b, i) =>
      Math.abs(i - 20) <= 4
        ? { text: `completely reworded section ${i} with new phrasing here` }
        : b,
    );
    const result = restorePosition(record, paraphrased);
    expect(result.confidence).toBe('ordinal');
    expect(result.blockIndex).toBe(20);
  });

  it('uses percent when structure drifted too far but content is related', () => {
    const blocks = uniqueBlocks(100);
    const record = capturePosition(blocks, 80);
    const truncated = blocks
      .slice(0, 40)
      .map((b, i) => (Math.abs(i - 38) <= 45 && i >= 36 ? { text: `noise ${i}` } : b));
    const result = restorePosition(record, truncated);
    expect(['percent', 'abort']).toContain(result.confidence);
    expect(result.confidence).not.toBe('ordinal');
  });
});

describe('findExact disambiguation', () => {
  it('ranks the occurrence with matching context first', () => {
    const blocks: Block[] = [
      { text: 'alpha context before the repeated fragment of text appears here first' },
      { text: 'totally different lead-in to the repeated fragment of text appears here' },
    ];
    const anchor = {
      role: 'center' as const,
      exactText: 'repeated fragment of text appears here',
      prefix: 'different lead-in to the ',
      suffix: '',
      blockIndex: 1,
      intraBlockOffset: 25,
    };
    const matches = findExact(anchor, blocks);
    expect(matches.length).toBe(2);
    expect(matches[0]!.blockIndex).toBe(1);
  });

  it('picks the duplicate consistent with surrounding anchors', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const withDuplicate: Block[] = [blocks[20]!, ...blocks];
    const result = restorePosition(record, withDuplicate);
    expect(result.confidence).toBe('exact');
    expect(result.blockIndex).toBe(21);
  });
});

describe('findFuzzy', () => {
  it('matches despite scattered character edits', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const center = record.anchors.find((a) => a.role === 'center')!;
    const edited = blocks.map((b, i) =>
      i === 20 ? { text: b.text.replace('the', 'teh').replace('of', 'for') } : b,
    );
    const match = findFuzzy(center, edited);
    expect(match).not.toBeNull();
    expect(match!.blockIndex).toBe(20);
  });

  it('returns null when nothing similar exists in the window', () => {
    const blocks = uniqueBlocks(50);
    const record = capturePosition(blocks, 20);
    const center = record.anchors.find((a) => a.role === 'center')!;
    const foreign = uniqueBlocks(50).map((_, i) => ({
      text: `unrelated musical chairs essay segment ${i} entirely elsewhere in topic space`,
    }));
    expect(findFuzzy(center, foreign)).toBeNull();
  });
});
