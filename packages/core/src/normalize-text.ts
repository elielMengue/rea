const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const EXOTIC_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const SINGLE_QUOTES = /[\u2018-\u201B\u2032]/g;
const DOUBLE_QUOTES = /[\u201C-\u201F\u2033]/g;
const DASHES = /[\u2012-\u2015\u2212]/g;
const WHITESPACE_RUN = /\s+/g;

/**
 * Canonical text normalization shared by anchor capture and restoration (D15).
 * Both sides MUST use this exact function: any asymmetry (smart quotes,
 * &nbsp;, em dashes rewritten by a CMS) directly costs match rate.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(EXOTIC_SPACES, ' ')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(WHITESPACE_RUN, ' ')
    .trim()
    .toLowerCase();
}
