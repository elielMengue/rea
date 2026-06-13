import { hasSubstantialContent, isEnabledForUrl, urlHash } from '@reader-mode/core';
import { loadPosition, loadSettings } from '../storage';
import { CaptureController } from './capture';
import { collectLiveBlocks } from './dom';
import { restoreWithStabilization } from './restore';

async function init(): Promise<void> {
  if (chrome.extension?.inIncognitoContext) return;

  const url = location.href;
  const settings = await loadSettings();
  if (!isEnabledForUrl(settings, url)) return;

  if (!hasSubstantialContent(collectLiveBlocks())) return;

  const hash = urlHash(url);

  const saved = await loadPosition(hash);
  if (saved) restoreWithStabilization(saved);

  const controller = new CaptureController(hash);
  controller.start();
}

void init();
