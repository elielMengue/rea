import {
  DEFAULT_SETTINGS,
  expiredKeys,
  type PositionRecord,
  type Settings,
} from '@reader-mode/core';

const POSITION_PREFIX = 'pos:';
const SETTINGS_KEY = 'settings';

const positionKey = (urlHash: string): string => `${POSITION_PREFIX}${urlHash}`;

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function loadPosition(urlHash: string): Promise<PositionRecord | undefined> {
  const key = positionKey(urlHash);
  const stored = await chrome.storage.local.get(key);
  return stored[key] as PositionRecord | undefined;
}

export async function savePosition(record: PositionRecord): Promise<void> {
  await chrome.storage.local.set({ [positionKey(record.urlHash)]: record });
}

export async function deletePosition(urlHash: string): Promise<void> {
  await chrome.storage.local.remove(positionKey(urlHash));
}

async function allPositionEntries(): Promise<Record<string, PositionRecord>> {
  const all = await chrome.storage.local.get(null);
  const entries: Record<string, PositionRecord> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(POSITION_PREFIX)) entries[key] = value as PositionRecord;
  }
  return entries;
}

/** All stored position records, newest first — backs the popup reading list. */
export async function listPositions(): Promise<PositionRecord[]> {
  const entries = await allPositionEntries();
  return Object.values(entries).sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function clearAllPositions(): Promise<void> {
  const keys = Object.keys(await allPositionEntries());
  if (keys.length) await chrome.storage.local.remove(keys);
}

/** Toggle a record's pinned flag, extending or shrinking its TTL in place. */
export async function setPinned(urlHash: string, pinned: boolean): Promise<void> {
  const record = await loadPosition(urlHash);
  if (!record) return;
  await savePosition({ ...record, pinned });
}

/** Delete every position record past its TTL. Returns how many were removed. */
export async function collectGarbage(now: number = Date.now()): Promise<number> {
  const entries = await allPositionEntries();
  const keys = expiredKeys(entries, now);
  if (keys.length) await chrome.storage.local.remove(keys);
  return keys.length;
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[SETTINGS_KEY]) {
      callback({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<Settings>) });
    }
  });
}
