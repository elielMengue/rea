export { normalizeText } from './normalize-text';
export { collectBlocks, BLOCK_SELECTOR, MIN_BLOCK_LENGTH } from './collect-blocks';
export { fnv1a, hashKey } from './hash';
export { contentFingerprint, fingerprintSimilarity } from './fingerprint';
export {
  captureAnchors,
  capturePosition,
  ANCHOR_TEXT_LENGTH,
  CONTEXT_LENGTH,
  ANCHOR_SPACING,
} from './capture';
export {
  restorePosition,
  findExact,
  findFuzzy,
  areConsistent,
  FUZZY_THRESHOLD,
  FUZZY_WINDOW,
  DRIFT_THRESHOLD,
  ABORT_FINGERPRINT_THRESHOLD,
} from './restore';
export { trigrams, jaccard } from './trigram';
export { normalizeUrl, urlHash, hostOf } from './url';
export {
  DEFAULT_TTL_MS,
  PINNED_TTL_MS,
  MIN_CONTENT_CHARS,
  ENGAGEMENT_MIN_MS,
  CAPTURE_THROTTLE_MS,
  DEFAULT_SETTINGS,
  recordTtl,
  isExpired,
  expiredKeys,
  totalContentLength,
  hasSubstantialContent,
  isSensitiveHost,
  isEnabledForUrl,
  isEngaged,
} from './persistence';
export type { Settings, EngagementState } from './persistence';
export type {
  AnchorRole,
  Block,
  TextAnchor,
  PositionRecord,
  MatchConfidence,
  RestoreResult,
} from './types';
