import { describe, expect, it } from 'vitest';
import { capturePosition } from './capture';
import { restorePosition } from './restore';
import type { Block } from './types';

const WORDS = [
  'reader',
  'anchor',
  'restore',
  'position',
  'paragraph',
  'content',
  'fingerprint',
  'normalize',
  'shingle',
  'jaccard',
  'cascade',
  'viewport',
  'mutation',
  'fixture',
  'baseline',
  'overlay',
  'extension',
  'browser',
  'document',
  'selection',
];

function syntheticBlocks(count: number): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < count; i++) {
    const words: string[] = [];
    for (let w = 0; w < 25; w++) {
      words.push(WORDS[(i * 7 + w * 13) % WORDS.length]!);
    }
    blocks.push({ text: `block ${i} ${words.join(' ')}` });
  }
  return blocks;
}

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function medianTime(runs: number, fn: () => void): number {
  fn(); // warm up JIT before measuring
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return median(samples);
}

describe('performance budgets', () => {
  it('captures a position in under 10ms over 1000 blocks', () => {
    const blocks = syntheticBlocks(1000);
    const ms = medianTime(15, () => capturePosition(blocks, 400));
    expect(ms).toBeLessThan(10);
  });

  it('restores a position in under 30ms over 500 blocks', () => {
    const blocks = syntheticBlocks(500);
    const record = capturePosition(blocks, 200);
    const ms = medianTime(15, () => restorePosition(record, blocks));
    expect(ms).toBeLessThan(30);
  });

  it('serializes a position record in under 2KB', () => {
    const blocks = syntheticBlocks(1000);
    const record = capturePosition(blocks, 400);
    expect(JSON.stringify(record).length).toBeLessThan(2048);
  });
});
