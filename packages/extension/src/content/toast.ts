const HOST_ID = 'reader-mode-toast-host';

/**
 * Show a brief, low-key message in a shadow root so page styles never bleed in
 * and our styles never leak out. Used to disclose low-confidence restorations.
 */
export function showToast(message: string, durationMs = 4000): void {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 90vw;
        padding: 10px 16px;
        font: 13px/1.4 system-ui, sans-serif;
        color: #fff;
        background: rgba(20, 20, 20, 0.92);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 2147483647;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .toast.visible { opacity: 1; }
    </style>
    <div class="toast" role="status">${message}</div>
  `;
  document.documentElement.appendChild(host);

  const toast = shadow.querySelector('.toast')!;
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => host.remove(), 250);
  }, durationMs);
}
