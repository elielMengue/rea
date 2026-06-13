export interface Block {
  text: string;
  element?: Element;
}

export type AnchorRole = 'above' | 'center' | 'below';

export interface TextAnchor {
  role: AnchorRole;
  exactText: string;
  prefix: string;
  suffix: string;
  blockIndex: number;
  intraBlockOffset: number;
}

export interface PositionRecord {
  version: 1;
  urlHash: string;
  anchors: TextAnchor[];
  scrollPercent: number;
  blockCount: number;
  contentFingerprint: string[];
  capturedAt: number;
  pinned?: boolean;
  url?: string;
  title?: string;
}

export type MatchConfidence = 'exact' | 'fuzzy' | 'ordinal' | 'percent' | 'abort';

export interface RestoreResult {
  confidence: MatchConfidence;
  blockIndex?: number;
  intraBlockOffset?: number;
  scrollPercent?: number;
}
