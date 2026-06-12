import { describe, expect, it } from 'vitest';
import { ANCHOR_TEXT_LENGTH, CONTEXT_LENGTH, captureAnchors, capturePosition } from './capture';
import { contentFingerprint, fingerprintSimilarity } from './fingerprint';
import type { Block } from './types';

function syntheticBlocks(count: number): Block[] {
  return Array.from({ length: count }, (_, i) => ({
    text:
      `block ${i} ` + `lorem ipsum dolor sit amet consectetur adipiscing elit sed ${i} `.repeat(3),
  }));
}

describe('captureAnchors', () => {
  it('captures above, center and below anchors two blocks apart', () => {
    const blocks = syntheticBlocks(20);
    const anchors = captureAnchors(blocks, 10);
    expect(anchors.map((a) => a.role)).toEqual(['above', 'center', 'below']);
    expect(anchors.map((a) => a.blockIndex)).toEqual([8, 10, 12]);
  });

  it('drops missing neighbors at document edges', () => {
    const blocks = syntheticBlocks(20);
    expect(captureAnchors(blocks, 0).map((a) => a.role)).toEqual(['center', 'below']);
    expect(captureAnchors(blocks, 19).map((a) => a.role)).toEqual(['above', 'center']);
  });

  it('bounds exactText and context lengths', () => {
    const blocks = syntheticBlocks(20);
    for (const anchor of captureAnchors(blocks, 10, 40)) {
      expect(anchor.exactText.length).toBeLessThanOrEqual(ANCHOR_TEXT_LENGTH);
      expect(anchor.prefix.length).toBeLessThanOrEqual(CONTEXT_LENGTH);
      expect(anchor.suffix.length).toBeLessThanOrEqual(CONTEXT_LENGTH);
    }
  });

  it('anchor text is found in the block at intraBlockOffset', () => {
    const blocks = syntheticBlocks(20);
    const [anchor] = captureAnchors(blocks, 10, 25).filter((a) => a.role === 'center');
    expect(blocks[10]!.text.indexOf(anchor!.exactText)).toBe(anchor!.intraBlockOffset);
  });

  it('clamps the offset so a short tail still yields a full-length anchor', () => {
    const blocks = syntheticBlocks(20);
    const tail = blocks[10]!.text.length - 5;
    const [anchor] = captureAnchors(blocks, 10, tail).filter((a) => a.role === 'center');
    expect(anchor!.exactText.length).toBe(ANCHOR_TEXT_LENGTH);
  });
});

describe('capturePosition', () => {
  it('serializes under the 2 KB budget', () => {
    const record = capturePosition(syntheticBlocks(1000), 400, { urlHash: 'abc123def456' });
    expect(JSON.stringify(record).length).toBeLessThan(2048);
  });

  it('records block count and fingerprint', () => {
    const blocks = syntheticBlocks(100);
    const record = capturePosition(blocks, 40);
    expect(record.blockCount).toBe(100);
    expect(record.contentFingerprint.length).toBeGreaterThan(0);
    expect(record.contentFingerprint.length).toBeLessThanOrEqual(64);
  });
});

describe('fingerprint', () => {
  it('is identical for identical content', () => {
    const blocks = syntheticBlocks(200);
    expect(fingerprintSimilarity(contentFingerprint(blocks), blocks)).toBe(1);
  });

  it('drops to zero for fully rewritten content', () => {
    const blocks = syntheticBlocks(200);
    const rewritten = blocks.map((_, i) => ({
      text: `completely different content ${i} entirely`,
    }));
    expect(fingerprintSimilarity(contentFingerprint(blocks), rewritten)).toBe(0);
  });

  it('stays high when a few blocks change', () => {
    const blocks = syntheticBlocks(200);
    const fingerprint = contentFingerprint(blocks);
    const mutated = blocks.map((b, i) => (i % 20 === 0 ? { text: b.text + ' edited' } : b));
    expect(fingerprintSimilarity(fingerprint, mutated)).toBeGreaterThan(0.8);
  });
});
