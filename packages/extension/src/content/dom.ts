import { collectBlocks, type Block } from '@reader-mode/core';
import { markProgrammaticScroll } from './scroll-guard';

/** D13: anchor and restore against the block crossing 40% of the viewport. */
export const READING_LINE = 0.4;

export interface LiveBlock extends Block {
  element: Element;
}

export function collectLiveBlocks(): LiveBlock[] {
  return collectBlocks(document).filter((b): b is LiveBlock => b.element !== undefined);
}

/** Index of the block sitting on the reading line, or 0 when none is in view. */
export function readingLineIndex(blocks: LiveBlock[]): number {
  const lineY = window.innerHeight * READING_LINE;
  for (let i = 0; i < blocks.length; i++) {
    const rect = blocks[i]!.element.getBoundingClientRect();
    if (rect.bottom >= lineY) return i;
  }
  return blocks.length ? blocks.length - 1 : 0;
}

/** Scroll instantly so the block's top rests on the reading line. */
export function scrollBlockToReadingLine(element: Element): void {
  const rect = element.getBoundingClientRect();
  const top = window.scrollY + rect.top - window.innerHeight * READING_LINE;
  markProgrammaticScroll();
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' as ScrollBehavior });
}

export function currentScrollPercent(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  return scrollable > 0 ? window.scrollY / scrollable : 0;
}

export function scrollToPercent(percent: number): void {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  markProgrammaticScroll();
  window.scrollTo({
    top: Math.max(0, scrollable * percent),
    behavior: 'instant' as ScrollBehavior,
  });
}
