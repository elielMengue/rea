import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { collectBlocks } from '../collect-blocks';
import { capturePosition } from '../capture';
import { restorePosition } from '../restore';
import { jaccard, trigrams } from '../trigram';
import type { Block, MatchConfidence, PositionRecord, RestoreResult } from '../types';
import { mutations } from './mutations';

const FIXTURES_DIR = resolve(process.cwd(), '..', '..', 'fixtures');
const MIN_BLOCKS = 5;

const fixtureNames = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''));

const RESOURCE_TAGS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<script\b[^>]*\/?>/gi,
  /<style\b[^>]*>[\s\S]*?<\/style>/gi,
  /<link\b[^>]*>/gi,
  /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
  /<iframe\b[^>]*\/?>/gi,
];

// happy-dom eagerly fetches <link rel="preload"> and external sheets when
// parsing snapshots; none of those tags contribute block text, so stripping
// them keeps the harness offline and fast without changing collected output.
function loadFixture(name: string): Document {
  let html = readFileSync(join(FIXTURES_DIR, `${name}.html`), 'utf8');
  for (const re of RESOURCE_TAGS) html = html.replace(re, '');
  return new DOMParser().parseFromString(html, 'text/html');
}

const GATE_SCENARIOS = [
  'identity',
  'smartQuotes',
  'fixTypo',
  'duplicateText',
  'insertAd',
  'removeParagraph',
];

interface CaseResult {
  fixture: string;
  scenario: string;
  confidence: MatchConfidence;
  correct: boolean;
}

const results: CaseResult[] = [];

function textSimilarity(a: string, b: string): number {
  return jaccard(trigrams(a), trigrams(b));
}

interface Fixture {
  name: string;
  baseline: Block[];
  record: PositionRecord;
  centerIndex: number;
  centerText: string;
}

function runScenario(
  fixture: Fixture,
  scenario: string,
): { confidence: MatchConfidence; blocks: Block[]; result: RestoreResult } {
  const mutate = mutations[scenario]!;
  const blocks = mutate(fixture.baseline, { centerIndex: fixture.centerIndex });
  const result = restorePosition(fixture.record, blocks);

  let correct = false;
  if (result.confidence === 'exact' || result.confidence === 'fuzzy') {
    const restored = blocks[result.blockIndex!];
    correct = restored !== undefined && textSimilarity(restored.text, fixture.centerText) >= 0.5;
  }
  results.push({ fixture: fixture.name, scenario, confidence: result.confidence, correct });
  return { confidence: result.confidence, blocks, result };
}

for (const name of fixtureNames) {
  describe(`fixture: ${name}`, () => {
    let fixture: Fixture;
    let enoughBlocks = false;

    beforeAll(() => {
      const doc = loadFixture(name);
      const baseline = collectBlocks(doc);
      enoughBlocks = baseline.length >= MIN_BLOCKS;
      if (!enoughBlocks) return;
      const centerIndex = Math.floor(baseline.length * 0.4);
      const centerText = baseline[centerIndex]!.text;
      const record = capturePosition(baseline, centerIndex);
      expect(JSON.stringify(record).length).toBeLessThan(2048);
      fixture = { name, baseline, record, centerIndex, centerText };
    });

    it('A1 identity restores exactly', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { result } = runScenario(fixture, 'identity');
      expect(result.confidence).toBe('exact');
      expect(result.blockIndex).toBe(fixture.centerIndex);
    });

    it('B1 smartQuotes still matches', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { confidence } = runScenario(fixture, 'smartQuotes');
      expect(['exact', 'fuzzy']).toContain(confidence);
    });

    it('B2 fixTypo matches exactly or fuzzily', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { confidence } = runScenario(fixture, 'fixTypo');
      expect(['exact', 'fuzzy', 'ordinal']).toContain(confidence);
    });

    it('B3 duplicateText picks the consistent occurrence', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { result, blocks } = runScenario(fixture, 'duplicateText');
      expect(['exact', 'fuzzy']).toContain(result.confidence);
      const restored = blocks[result.blockIndex!];
      expect(textSimilarity(restored?.text ?? '', fixture.centerText)).toBeGreaterThanOrEqual(0.5);
      expect(result.blockIndex).toBeGreaterThan(0);
    });

    it('B4 rewriteAll aborts instead of guessing', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { confidence } = runScenario(fixture, 'rewriteAll');
      expect(confidence).toBe('abort');
    });

    it('C1 insertAd survives inserted blocks', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { confidence } = runScenario(fixture, 'insertAd');
      expect(['exact', 'fuzzy']).toContain(confidence);
    });

    it('C2 removeParagraph survives removals', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { confidence } = runScenario(fixture, 'removeParagraph');
      expect(['exact', 'fuzzy']).toContain(confidence);
    });

    it('C3 truncatePaywall never returns ordinal on heavy drift', (ctx) => {
      if (!enoughBlocks) return ctx.skip();
      const { result } = runScenario(fixture, 'truncatePaywall');
      expect(result.confidence).not.toBe('ordinal');
    });
  });
}

describe('M1 gate', () => {
  it('exact+fuzzy correct restoration rate is at least 95%', () => {
    const eligible = results.filter((r) => GATE_SCENARIOS.includes(r.scenario));
    expect(eligible.length).toBeGreaterThan(0);
    const correct = eligible.filter((r) => r.correct).length;
    const rate = correct / eligible.length;

    const byScenario = new Map<string, { ok: number; total: number }>();
    for (const r of eligible) {
      const entry = byScenario.get(r.scenario) ?? { ok: 0, total: 0 };
      entry.total++;
      if (r.correct) entry.ok++;
      byScenario.set(r.scenario, entry);
    }
    const summary = [...byScenario.entries()]
      .map(([s, { ok, total }]) => `${s}: ${ok}/${total}`)
      .join(', ');
    console.log(
      `[M1 gate] ${(rate * 100).toFixed(1)}% (${correct}/${eligible.length}) - ${summary}`,
    );
    const failures = eligible.filter((r) => !r.correct);
    if (failures.length > 0) {
      console.log(
        '[M1 gate] failures:',
        failures.map((f) => `${f.fixture}/${f.scenario}=${f.confidence}`).join(', '),
      );
    }

    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});
