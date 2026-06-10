chrome.runtime.onInstalled.addListener((details) => {
  console.log('[reader-mode] installed', details.reason);
});
