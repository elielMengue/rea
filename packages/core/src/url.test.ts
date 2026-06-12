import { describe, expect, it } from 'vitest';
import { normalizeUrl, urlHash } from './url';

describe('normalizeUrl', () => {
  it('strips utm_* and known tracking parameters', () => {
    expect(
      normalizeUrl('https://example.com/article?utm_source=x&utm_medium=mail&fbclid=abc&gclid=1'),
    ).toBe('https://example.com/article');
  });

  it('keeps meaningful parameters and sorts them for a stable key', () => {
    expect(normalizeUrl('https://example.com/search?q=hello&page=2&utm_campaign=z')).toBe(
      'https://example.com/search?page=2&q=hello',
    );
  });

  it('drops the fragment', () => {
    expect(normalizeUrl('https://example.com/article#section-3')).toBe(
      'https://example.com/article',
    );
  });

  it('lowercases the host and removes the trailing slash', () => {
    expect(normalizeUrl('https://Example.COM/Article/')).toBe('https://example.com/Article');
  });

  it('preserves the root path slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('treats tracking-only differences as the same page', () => {
    const a = urlHash('https://example.com/post?utm_source=twitter');
    const b = urlHash('https://example.com/post?utm_source=newsletter&fbclid=xyz');
    expect(a).toBe(b);
  });

  it('produces different hashes for different pages', () => {
    expect(urlHash('https://example.com/post-1')).not.toBe(urlHash('https://example.com/post-2'));
  });
});
