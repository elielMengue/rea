import { hasSubstantialContent, isEnabledForUrl, urlHash } from '@reader-mode/core';
import { loadPosition, loadSettings } from '../storage';
import { CaptureController } from './capture';
import { collectLiveBlocks } from './dom';
import { onUrlChange } from './navigation';
import { restoreWithStabilization } from './restore';

let active: CaptureController | undefined;

async function startSession(): Promise<void> {
  const previous = active;
  active = undefined;
  if (previous) await previous.stop();

  const url = location.href;
  const settings = await loadSettings();
  if (!isEnabledForUrl(settings, url)) return;
  if (!hasSubstantialContent(collectLiveBlocks())) return;

  const hash = urlHash(url);
  const saved = await loadPosition(hash);
  if (saved) restoreWithStabilization(saved);

  const controller = new CaptureController(hash);
  controller.start();
  active = controller;
}

if (!chrome.extension?.inIncognitoContext) {
  onUrlChange(() => void startSession());
  void startSession();
}
