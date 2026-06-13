import {
  CAPTURE_THROTTLE_MS,
  capturePosition,
  isEngaged,
  type EngagementState,
} from '@reader-mode/core';
import { savePosition } from '../storage';
import { collectLiveBlocks, currentScrollPercent, readingLineIndex } from './dom';
import { isProgrammaticScroll } from './scroll-guard';

/**
 * Watches a substantial page and persists the reading position once the user
 * is engaged (D20): dwell time plus a real scroll. Writes are throttled to one
 * per CAPTURE_THROTTLE_MS via a dirty flag, with a guaranteed final write when
 * the tab is hidden.
 */
export class CaptureController {
  private readonly engagement: EngagementState = {
    firstSeenAt: Date.now(),
    hasScrolled: false,
  };
  private dirty = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;

  constructor(private readonly urlHash: string) {}

  start(): void {
    window.addEventListener('scroll', this.onScroll, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.timer = setInterval(() => this.flush(), CAPTURE_THROTTLE_MS);
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  private readonly onScroll = (): void => {
    if (isProgrammaticScroll()) return;
    this.engagement.hasScrolled = true;
    this.dirty = true;
  };

  private readonly onVisibilityChange = (): void => {
    // D20: capture on hidden, not beforeunload, to survive tab close reliably.
    if (document.visibilityState === 'hidden') void this.captureNow();
  };

  private flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    void this.captureNow();
  }

  private async captureNow(): Promise<void> {
    if (this.stopped || !isEngaged(this.engagement, Date.now())) return;
    const blocks = collectLiveBlocks();
    if (blocks.length === 0) return;
    const centerIndex = readingLineIndex(blocks);
    const record = capturePosition(blocks, centerIndex, {
      scrollPercent: currentScrollPercent(),
      urlHash: this.urlHash,
    });
    await savePosition(record);
  }
}
