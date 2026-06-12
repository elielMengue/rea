import { fnv1a } from './hash';
import type { Block } from './types';

const SAMPLE_SIZE = 64;

export function contentFingerprint(blocks: Block[]): string[] {
  if (blocks.length === 0) return [];
  const step = Math.max(1, blocks.length / SAMPLE_SIZE);
  const hashes: string[] = [];
  for (let i = 0; i < blocks.length && hashes.length < SAMPLE_SIZE; i = Math.round(i + step)) {
    hashes.push(fnv1a(blocks[i]!.text).toString(36));
  }
  return hashes;
}

export function fingerprintSimilarity(fingerprint: string[], blocks: Block[]): number {
  if (fingerprint.length === 0) return 0;
  const current = new Set(blocks.map((b) => fnv1a(b.text).toString(36)));
  let found = 0;
  for (const hash of fingerprint) {
    if (current.has(hash)) found++;
  }
  return found / fingerprint.length;
}
