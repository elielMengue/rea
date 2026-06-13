import { hostOf, type PositionRecord, type Settings } from '@reader-mode/core';
import { useCallback, useEffect, useState } from 'react';
import {
  clearAllPositions,
  deletePosition,
  listPositions,
  loadSettings,
  saveSettings,
  setPinned,
} from '../storage';

export interface PopupState {
  settings: Settings | undefined;
  positions: PositionRecord[];
  currentHost: string | undefined;
  toggleEnabled: () => void;
  toggleCurrentDomain: () => void;
  togglePinned: (record: PositionRecord) => void;
  remove: (record: PositionRecord) => void;
  clearAll: () => void;
}

async function activeTabHost(): Promise<string | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('http')) return undefined;
  return hostOf(tab.url);
}

export function usePopup(): PopupState {
  const [settings, setSettings] = useState<Settings>();
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [currentHost, setCurrentHost] = useState<string>();

  const refresh = useCallback(async () => {
    const [nextSettings, nextPositions, host] = await Promise.all([
      loadSettings(),
      listPositions(),
      activeTabHost(),
    ]);
    setSettings(nextSettings);
    setPositions(nextPositions);
    setCurrentHost(host);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persist = useCallback(async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const toggleEnabled = useCallback(() => {
    if (settings) void persist({ ...settings, enabled: !settings.enabled });
  }, [settings, persist]);

  const toggleCurrentDomain = useCallback(() => {
    if (!settings || !currentHost) return;
    const disabled = settings.disabledDomains.includes(currentHost);
    void persist({
      ...settings,
      disabledDomains: disabled
        ? settings.disabledDomains.filter((d) => d !== currentHost)
        : [...settings.disabledDomains, currentHost],
    });
  }, [settings, currentHost, persist]);

  const togglePinned = useCallback(
    (record: PositionRecord) => {
      void setPinned(record.urlHash, !record.pinned).then(refresh);
    },
    [refresh],
  );

  const remove = useCallback(
    (record: PositionRecord) => {
      void deletePosition(record.urlHash).then(refresh);
    },
    [refresh],
  );

  const clearAll = useCallback(() => {
    void clearAllPositions().then(refresh);
  }, [refresh]);

  return {
    settings,
    positions,
    currentHost,
    toggleEnabled,
    toggleCurrentDomain,
    togglePinned,
    remove,
    clearAll,
  };
}
