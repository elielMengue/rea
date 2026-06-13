import type { Block, PositionRecord } from './types';
import { hostOf } from './url';

export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PINNED_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** D6: only persist on pages with substantial main content. */
export const MIN_CONTENT_CHARS = 2000;

/** D20: engagement before a position is worth recording. */
export const ENGAGEMENT_MIN_MS = 15_000;

/** D20: throttle storage writes to at most one per this interval. */
export const CAPTURE_THROTTLE_MS = 2000;

export function recordTtl(record: Pick<PositionRecord, 'pinned'>): number {
  return record.pinned ? PINNED_TTL_MS : DEFAULT_TTL_MS;
}

export function isExpired(
  record: Pick<PositionRecord, 'capturedAt' | 'pinned'>,
  now: number,
): boolean {
  return now - record.capturedAt > recordTtl(record);
}

/** Keys whose records have outlived their TTL — the GC delete set. */
export function expiredKeys(records: Record<string, PositionRecord>, now: number): string[] {
  return Object.keys(records).filter((key) => isExpired(records[key]!, now));
}

export function totalContentLength(blocks: Block[]): number {
  let total = 0;
  for (const block of blocks) total += block.text.length;
  return total;
}

export function hasSubstantialContent(blocks: Block[]): boolean {
  return totalContentLength(blocks) >= MIN_CONTENT_CHARS;
}

/**
 * Domains where persistence (and cleanup) must never run: banking, government,
 * and health portals where injected behaviour or stored content is unacceptable.
 * Matched on the registrable suffix so subdomains are covered.
 */
const SENSITIVE_SUFFIXES = [
  '.bank',
  '.gov',
  '.gouv.fr',
  '.gov.uk',
  '.nhs.uk',
  'paypal.com',
  'stripe.com',
  'ameli.fr',
  'impots.gouv.fr',
];

export function isSensitiveHost(host: string): boolean {
  const h = host.toLowerCase();
  return SENSITIVE_SUFFIXES.some((suffix) =>
    suffix.startsWith('.')
      ? h.endsWith(suffix) || h === suffix.slice(1)
      : h === suffix || h.endsWith(`.${suffix}`),
  );
}

export interface Settings {
  enabled: boolean;
  disabledDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  disabledDomains: [],
};

/** Whether persistence should run for a URL given user settings and exclusions. */
export function isEnabledForUrl(settings: Settings, url: string): boolean {
  if (!settings.enabled) return false;
  const host = hostOf(url);
  if (isSensitiveHost(host)) return false;
  return !settings.disabledDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export interface EngagementState {
  firstSeenAt: number;
  hasScrolled: boolean;
}

/** D20: a real read — visible long enough and the user actually scrolled. */
export function isEngaged(state: EngagementState, now: number): boolean {
  return state.hasScrolled && now - state.firstSeenAt >= ENGAGEMENT_MIN_MS;
}
