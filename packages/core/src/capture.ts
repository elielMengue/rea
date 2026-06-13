import { contentFingerprint } from './fingerprint';
import type { AnchorRole, Block, PositionRecord, TextAnchor } from './types';

export const ANCHOR_TEXT_LENGTH = 70;
export const CONTEXT_LENGTH = 30;
export const ANCHOR_SPACING = 2;

function makeAnchor(
  blocks: Block[],
  role: AnchorRole,
  blockIndex: number,
  intraBlockOffset: number,
): TextAnchor | null {
  const block = blocks[blockIndex];
  if (!block) return null;
  const text = block.text;
  const start = Math.max(0, Math.min(intraBlockOffset, text.length - ANCHOR_TEXT_LENGTH));
  const exactText = text.slice(start, start + ANCHOR_TEXT_LENGTH);
  return {
    role,
    exactText,
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(start + exactText.length, start + exactText.length + CONTEXT_LENGTH),
    blockIndex,
    intraBlockOffset: start,
  };
}

export function captureAnchors(
  blocks: Block[],
  centerIndex: number,
  intraBlockOffset = 0,
): TextAnchor[] {
  return [
    makeAnchor(blocks, 'above', centerIndex - ANCHOR_SPACING, 0),
    makeAnchor(blocks, 'center', centerIndex, intraBlockOffset),
    makeAnchor(blocks, 'below', centerIndex + ANCHOR_SPACING, 0),
  ].filter((anchor): anchor is TextAnchor => anchor !== null);
}

export function capturePosition(
  blocks: Block[],
  centerIndex: number,
  options: {
    intraBlockOffset?: number;
    scrollPercent?: number;
    urlHash?: string;
    url?: string;
    title?: string;
  } = {},
): PositionRecord {
  return {
    version: 1,
    urlHash: options.urlHash ?? '',
    anchors: captureAnchors(blocks, centerIndex, options.intraBlockOffset ?? 0),
    scrollPercent: options.scrollPercent ?? (blocks.length ? centerIndex / blocks.length : 0),
    blockCount: blocks.length,
    contentFingerprint: contentFingerprint(blocks),
    capturedAt: Date.now(),
    ...(options.url !== undefined && { url: options.url }),
    ...(options.title !== undefined && { title: options.title }),
  };
}
