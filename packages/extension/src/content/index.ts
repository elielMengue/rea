import { hasSubstantialContent, isEnabledForUrl, urlHash } from '@reader-mode/core';
import { loadSettings } from '../storage';
import { CaptureController } from './capture';
import { collectLiveBlocks } from './dom';

async function init(): Promise<void> {
  if (chrome.extension?.inIncognitoContext) return;

  const url = location.href;
  const settings = await loadSettings();
  if (!isEnabledForUrl(settings, url)) return;

  if (!hasSubstantialContent(collectLiveBlocks())) return;

  const controller = new CaptureController(urlHash(url));
  controller.start();
}

void init();
