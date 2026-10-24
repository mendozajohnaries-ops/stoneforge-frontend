'use strict';

// Public installer preparation only. The backend owns release readiness and
// issues short-lived links; no account, ownership or payment return unlocks it.
(function () {
  const API_BASE = 'https://stoneforge-backend.onrender.com/api';
  const FILE_NAME = 'StoneForgeSetup.exe';
  const policy = window.StoneForgeDownloadMaintenance;
  const paused = !policy || policy.enabled !== false;
  const message = 'StoneForge downloads are temporarily paused while we prepare and test the unified build.';
  let busy = false;
  const container = document.getElementById('game-action');
  const note = document.getElementById('game-note');
  if (!container || !note) return;

  function action(label, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'game-download-button';
    button.textContent = label; button.disabled = disabled;
    button.setAttribute('aria-describedby', 'game-note');
    button.setAttribute('aria-busy', String(busy));
    button.addEventListener('click', download);
    container.replaceChildren(button);
  }
  function ready(text = 'Free Windows installer. No account or game purchase required to download.') {
    action('Download StoneForge'); note.textContent = text;
  }
  function maintenance() { action('Under Maintenance', true); note.textContent = message; }
  function validDownload(data) {
    if (!data || data.success !== true || data.file_name !== FILE_NAME || data.expires_in !== 300) return false;
    try {
      const url = new URL(data.download_url);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
        && /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname)
        && url.pathname.endsWith('/' + FILE_NAME)
        && url.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256'
        && url.searchParams.get('X-Amz-Expires') === '300'
        && /^[a-f0-9]{64}$/.test(url.searchParams.get('X-Amz-Signature') || '');
    } catch { return false; }
  }
  async function download() {
    if (paused) { maintenance(); return; }
    if (busy) return;
    busy = true; action('Preparing Download...', true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);
    let result = 'Unable to prepare the download. Please wait and retry. No account or purchase is required.';
    try {
      const response = await fetch(API_BASE + '/download/game', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        credentials: 'omit', cache: 'no-store', signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.code === 'UNIFIED_BUILD_NOT_READY' || data?.code === 'DOWNLOADS_MAINTENANCE')
          result = message + ' Please try again later.';
        else if (response.status === 429) result = 'Too many download requests. Please wait a minute and retry.';
        return;
      }
      if (!validDownload(data)) return;
      const link = document.createElement('a');
      link.href = data.download_url; link.download = FILE_NAME;
      link.rel = 'noreferrer'; link.referrerPolicy = 'no-referrer';
      document.body.appendChild(link); link.click(); link.remove();
      result = 'Download requested. Check your browser downloads. Click again for a fresh link if needed.';
    } catch { /* Network/provider details are not account or payment requirements. */ }
    finally { clearTimeout(timer); busy = false; ready(result); }
  }
  const notice = document.getElementById('download-maintenance-notice');
  if (notice) notice.hidden = !paused;
  const params = new URLSearchParams(window.location.search);
  if (params.has('payment')) {
    const legacy = document.getElementById('legacy-payment-note');
    if (legacy) { legacy.hidden = false; legacy.textContent = 'FullGame purchases have been retired. This old payment link does not confirm a payment or unlock a download. Existing records are preserved.'; }
    params.delete('payment');
    window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params : '') + window.location.hash);
  }
  if (paused) maintenance(); else ready();
})();
