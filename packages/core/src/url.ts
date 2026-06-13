import { hashKey } from './hash';

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'twclid',
  'yclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'vero_id',
  'oly_anon_id',
  'oly_enc_id',
  'wickedid',
  's_cid',
  'mkt_tok',
  'ref_src',
  'ref_url',
  'cmpid',
  'soc_src',
  'soc_trk',
]);

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAMS.has(name.toLowerCase()) || name.toLowerCase().startsWith('utm_');
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';

  const kept = [...url.searchParams.entries()].filter(([name]) => !isTrackingParam(name));
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = '';
  for (const [name, value] of kept) url.searchParams.append(name, value);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

export function urlHash(input: string): string {
  return hashKey(normalizeUrl(input));
}

export function hostOf(input: string): string {
  return new URL(input).hostname.toLowerCase();
}
