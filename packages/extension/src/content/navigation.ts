/**
 * Fire a callback whenever the SPA changes URL without a full reload. Patches
 * history.pushState/replaceState and listens for popstate, de-duplicating
 * against the last seen href so identical re-navigations are ignored.
 */
export function onUrlChange(callback: (url: string) => void): void {
  let lastHref = location.href;

  const check = (): void => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    callback(lastHref);
  };

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = function (...args) {
    originalPush(...args);
    queueMicrotask(check);
  };
  history.replaceState = function (...args) {
    originalReplace(...args);
    queueMicrotask(check);
  };

  window.addEventListener('popstate', check);
}
