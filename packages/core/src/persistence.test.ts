import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TTL_MS,
  PINNED_TTL_MS,
  expiredKeys,
  hasSubstantialContent,
  isEnabledForUrl,
  isEngaged,
  isExpired,
  isSensitiveHost,
  recordTtl,
} from './persistence';
import type { PositionRecord, Settings } from './index';

function record(overrides: Partial<PositionRecord> = {}): PositionRecord {
  return {
    version: 1,
    urlHash: 'abc',
    anchors: [],
    scrollPercent: 0,
    blockCount: 0,
    contentFingerprint: [],
    capturedAt: 0,
    ...overrides,
  };
}

describe('recordTtl', () => {
  it('uses the 7-day window for normal records', () => {
    expect(recordTtl(record())).toBe(DEFAULT_TTL_MS);
  });

  it('extends pinned records to 90 days', () => {
    expect(recordTtl(record({ pinned: true }))).toBe(PINNED_TTL_MS);
  });
});

describe('isExpired', () => {
  it('keeps a record inside its TTL', () => {
    expect(isExpired(record({ capturedAt: 0 }), DEFAULT_TTL_MS - 1)).toBe(false);
  });

  it('expires a record past its TTL', () => {
    expect(isExpired(record({ capturedAt: 0 }), DEFAULT_TTL_MS + 1)).toBe(true);
  });

  it('honours the longer pinned window', () => {
    const now = DEFAULT_TTL_MS + 1;
    expect(isExpired(record({ capturedAt: 0, pinned: true }), now)).toBe(false);
  });
});

describe('expiredKeys', () => {
  it('returns only the keys past their TTL', () => {
    const now = DEFAULT_TTL_MS + 1000;
    const records = {
      fresh: record({ capturedAt: now }),
      stale: record({ capturedAt: 0 }),
      pinned: record({ capturedAt: 0, pinned: true }),
    };
    expect(expiredKeys(records, now)).toEqual(['stale']);
  });
});

describe('hasSubstantialContent', () => {
  it('rejects thin pages below the content threshold', () => {
    expect(hasSubstantialContent([{ text: 'short' }])).toBe(false);
  });

  it('accepts pages with enough main content', () => {
    expect(hasSubstantialContent([{ text: 'x'.repeat(2000) }])).toBe(true);
  });
});

describe('isSensitiveHost', () => {
  it('blocks government and banking hosts and their subdomains', () => {
    expect(isSensitiveHost('www.impots.gouv.fr')).toBe(true);
    expect(isSensitiveHost('paypal.com')).toBe(true);
    expect(isSensitiveHost('checkout.stripe.com')).toBe(true);
    expect(isSensitiveHost('account.nhs.uk')).toBe(true);
  });

  it('allows ordinary content hosts', () => {
    expect(isSensitiveHost('en.wikipedia.org')).toBe(false);
    expect(isSensitiveHost('arstechnica.com')).toBe(false);
  });
});

describe('isEnabledForUrl', () => {
  it('is enabled by default on ordinary pages', () => {
    expect(isEnabledForUrl(DEFAULT_SETTINGS, 'https://en.wikipedia.org/wiki/Reading')).toBe(true);
  });

  it('is disabled when the extension is globally off', () => {
    const settings: Settings = { enabled: false, disabledDomains: [] };
    expect(isEnabledForUrl(settings, 'https://en.wikipedia.org/wiki/Reading')).toBe(false);
  });

  it('respects per-domain opt-outs including subdomains', () => {
    const settings: Settings = { enabled: true, disabledDomains: ['example.com'] };
    expect(isEnabledForUrl(settings, 'https://example.com/a')).toBe(false);
    expect(isEnabledForUrl(settings, 'https://blog.example.com/a')).toBe(false);
    expect(isEnabledForUrl(settings, 'https://example.org/a')).toBe(true);
  });

  it('never runs on sensitive hosts regardless of settings', () => {
    expect(isEnabledForUrl(DEFAULT_SETTINGS, 'https://www.impots.gouv.fr/portail/')).toBe(false);
  });
});

describe('isEngaged', () => {
  it('requires both dwell time and a real scroll', () => {
    expect(isEngaged({ firstSeenAt: 0, hasScrolled: false }, 20_000)).toBe(false);
    expect(isEngaged({ firstSeenAt: 0, hasScrolled: true }, 10_000)).toBe(false);
    expect(isEngaged({ firstSeenAt: 0, hasScrolled: true }, 20_000)).toBe(true);
  });
});
