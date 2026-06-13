import { restorePosition, type PositionRecord, type RestoreResult } from '@reader-mode/core';
import {
  collectLiveBlocks,
  scrollBlockToReadingLine,
  scrollToPercent,
  type LiveBlock,
} from './dom';
import { isProgrammaticScroll } from './scroll-guard';
import { showToast } from './toast';

const STABILIZE_WINDOW_MS = 3000;
const RETRY_DELAY_MS = 1500;

const TOAST_MESSAGES: Partial<Record<RestoreResult['confidence'], string>> = {
  ordinal: 'Restored your approximate reading position.',
  percent: 'Restored to roughly where you left off.',
};

function applyResult(result: RestoreResult, blocks: LiveBlock[]): void {
  if (result.blockIndex !== undefined && blocks[result.blockIndex]) {
    scrollBlockToReadingLine(blocks[result.blockIndex]!.element);
  } else if (result.scrollPercent !== undefined) {
    scrollToPercent(result.scrollPercent);
  }
}

/**
 * Restore the saved position and hold it through late layout shifts (lazy
 * images, web fonts, hydration). Re-applies during a 3s ResizeObserver window
 * plus one delayed retry, but yields immediately once the user scrolls.
 */
export function restoreWithStabilization(record: PositionRecord): void {
  const result = restorePosition(record, collectLiveBlocks());
  if (result.confidence === 'abort') return;

  applyResult(result, collectLiveBlocks());

  const message = TOAST_MESSAGES[result.confidence];
  if (message) showToast(message);

  let userHasScrolled = false;
  let done = false;

  const onScroll = (): void => {
    if (!isProgrammaticScroll()) userHasScrolled = true;
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  const reapply = (): void => {
    if (done || userHasScrolled) return;
    applyResult(result, collectLiveBlocks());
  };

  const observer = new ResizeObserver(reapply);
  observer.observe(document.documentElement);

  const retry = setTimeout(reapply, RETRY_DELAY_MS);

  setTimeout(() => {
    done = true;
    observer.disconnect();
    clearTimeout(retry);
    window.removeEventListener('scroll', onScroll);
  }, STABILIZE_WINDOW_MS);
}
