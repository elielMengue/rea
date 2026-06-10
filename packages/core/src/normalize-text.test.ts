import { describe, expect, it } from 'vitest';
import { normalizeText } from './normalize-text';

describe('normalizeText', () => {
  it('lowercases and trims', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  it('collapses whitespace runs including newlines and tabs', () => {
    expect(normalizeText('a \t b\n\nc')).toBe('a b c');
  });

  it('converts non-breaking and exotic spaces to regular spaces', () => {
    expect(normalizeText('a b c d　e')).toBe('a b c d e');
  });

  it('strips zero-width characters', () => {
    expect(normalizeText('a​b‍c﻿d')).toBe('abcd');
  });

  it('straightens curly single quotes and apostrophes', () => {
    expect(normalizeText('l’été ‘quoted’')).toBe("l'été 'quoted'");
  });

  it('straightens curly double quotes', () => {
    expect(normalizeText('“hello” „low”')).toBe('"hello" "low"');
  });

  it('unifies em/en dashes and minus sign to hyphen', () => {
    expect(normalizeText('a–b—c−d')).toBe('a-b-c-d');
  });

  it('applies NFKC compatibility normalization (ligatures, fullwidth)', () => {
    expect(normalizeText('ﬁle')).toBe('file');
    expect(normalizeText('Ｈｅｌｌｏ')).toBe('hello');
  });

  it('keeps accented characters intact', () => {
    expect(normalizeText('Déjà vu — naïve')).toBe('déjà vu - naïve');
  });

  it('is idempotent', () => {
    const messy = '  “L’été” —\tDÉJÀ​ vu  ';
    const once = normalizeText(messy);
    expect(normalizeText(once)).toBe(once);
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeText('  \t\n ')).toBe('');
  });
});
