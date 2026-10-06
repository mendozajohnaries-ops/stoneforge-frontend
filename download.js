'use strict';

// The purchase/session cookie is verified by the backend. sessionStorage and
// payment=success are never evidence of ownership, and no static Full Game
// file URL or R2 credentials belong in this file.
(function () {
  var API_BASE = 'https://stoneforge-backend.onrender.com/api';
  var TRIAL_URL = 'https://www.dropbox.com/scl/fi/nuympz7slgwfepf5bwp8n/FreeTrialGame.zip?rlkey=o33635td1hlr51vt6e0h4xgt1&st=neotzbof&dl=1';
  var FILE_NAME = 'StoneForgeSetup.exe';
  var busy = false;
  var checking = false;
  var returningFromPayment = false;
  var buttonStyle = 'display:block;width:100%;padding:0.85rem 1.5rem;color:#fff;text-align:center;border-radius:10px;font-family:var(--font-ui);font-size:0.95rem;font-weight:700;letter-spacing:0.02em;border:none;box-sizing:border-box;';

  function note(text) {
    var element = document.getElementById('full-note');
    if (element) element.textContent = text;
  }
  function action(label, handler, green, disabled) {
    var container = document.getElementById('full-action');
    if (!container) return;
    var button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.disabled = !!disabled;
    button.style.cssText = buttonStyle + 'background:' + (green ? '#5f8f47' : '#c2630a')
      + ';cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (disabled ? '0.55' : '1') + ';';
    if (handler) button.addEventListener('click', handler);
    container.replaceChildren(button);
  }
  function banner(text) {
    var element = document.getElementById('banner-success');
    if (element) { element.textContent = text; element.style.display = 'block'; }
  }
  function signIn() {
    note('Sign in with the account used to purchase the full game.');
    action('Sign In to Continue', function () {
      var target = returningFromPayment ? 'download.html?payment=success' : 'download.html';
      window.location.href = 'login-page.html?redirect=' + encodeURIComponent(target);
    });
  }
  function retryOwnership(message) {
    note(message);
    action('Check Purchase Again', function () { return checkOwnership(); });
  }
  function showDownload(message) {
    note(message || 'You own the full game — Windows installer v1.4.4');
    action('⬇ Download Full Game', handleDownload, true);
  }

  async function request(path, options, timeoutMs) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, timeoutMs || 20000);
    try {
      var response = await fetch(API_BASE + path, Object.assign({}, options, {
        credentials: 'include', cache: 'no-store', signal: controller.signal,
      }));
      var data = await response.json();
      if (!response.ok) {
        var error = new Error(data.error || 'The request could not be completed.');
        error.status = response.status; throw error;
      }
      return data;
    } finally { clearTimeout(timeout); }
  }

  async function checkOwnership() {
    if (checking || busy) return;
    checking = true;
    action(returningFromPayment ? 'Confirming Purchase...' : 'Checking Account...', null, false, true);
    note('Checking your account with the server...');
    try {
      // Bounded retries only after checkout return; do not offer a duplicate
      // purchase while the signed payment webhook may still be processing.
      var attempts = returningFromPayment ? 10 : 1;
      for (var attempt = 0; attempt < attempts; attempt++) {
        var data = await request('/check-ownership');
        if (data.success !== true || typeof data.owns_game !== 'boolean')
          throw new Error('Unexpected ownership response.');
        if (data.owns_game === true) {
          if (returningFromPayment) banner('Game ownership confirmed by the server. Your installer is ready to download.');
          returningFromPayment = false;
          showDownload(); return;
        }
        if (!returningFromPayment) {
          note('₱350 one-time purchase — account ownership required');
          action('🔒 Purchase to Unlock', handlePurchase); return;
        }
        note('Waiting for the server to confirm your payment. Please do not pay again.');
        if (attempt + 1 < attempts) await new Promise(function (resolve) { setTimeout(resolve, 2000); });
      }
      banner('Payment confirmation is still pending. No download has been unlocked yet.');
      retryOwnership('Please check again shortly. Do not make another payment yet.');
    } catch (error) {
      if (error.status === 401) signIn();
      else if (error.status === 403) {
        note('Account access is restricted. Contact the StoneForge team.');
        action('Download Unavailable', null, false, true);
      } else retryOwnership('Unable to verify ownership. Check your connection and try again.');
    } finally { checking = false; }
  }

  async function handlePurchase() {
    if (busy || checking) return;
    busy = true;
    action('Opening Checkout...', null, false, true);
    try {
      var data = await request('/create-checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package_id: 'full_game' }) });
      var checkout = new URL(data.checkout_url);
      if (data.success !== true || checkout.protocol !== 'https:' || checkout.username || checkout.password)
        throw new Error('Invalid checkout response.');
      window.location.assign(checkout.href);
    } catch (error) {
      if (error.status === 401) signIn();
      else {
        note('Checkout could not be opened. Check your connection or account ownership and retry.');
        action('Check Purchase Again', function () { return checkOwnership(); });
      }
    } finally { busy = false; }
  }

  function validDownload(data) {
    if (data.success !== true || data.file_name !== FILE_NAME || data.expires_in !== 300) return false;
    try {
      var url = new URL(data.download_url);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port
        && /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname)
        && url.pathname.endsWith('/' + FILE_NAME)
        && url.searchParams.get('X-Amz-Algorithm') === 'AWS4-HMAC-SHA256'
        && url.searchParams.get('X-Amz-Expires') === '300'
        && /^[a-f0-9]{64}$/.test(url.searchParams.get('X-Amz-Signature') || '');
    } catch { return false; }
  }

  async function handleDownload() {
    if (busy || checking) return;
    busy = true;
    action('Preparing Download...', null, true, true);
    try {
      var data = await request('/download/full-game', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: '{}' }, 40000);
      if (!validDownload(data)) throw new Error('Invalid installer response.');
      // Direct navigation downloads the attachment without fetching a large
      // binary into browser memory or requiring bucket CORS/public access.
      var link = document.createElement('a');
      link.href = data.download_url; link.download = FILE_NAME;
      link.rel = 'noreferrer'; link.referrerPolicy = 'no-referrer';
      document.body.appendChild(link); link.click(); link.remove();
      showDownload('Download requested. Check your browser downloads. Click again for a fresh link if needed.');
    } catch (error) {
      if (error.status === 401) signIn();
      else if (error.status === 403) {
        busy = false;
        await checkOwnership();
      } else showDownload('Unable to prepare the download. Please wait and retry.');
    } finally { busy = false; }
  }

  async function initDownload() {
    var trial = document.querySelector('.dl-btn-link[download]');
    if (trial) trial.href = TRIAL_URL;
    var params = new URLSearchParams(window.location.search);
    returningFromPayment = params.get('payment') === 'success';
    if (returningFromPayment) banner('Returned from checkout. Confirming payment with the server...');
    if (params.get('payment') === 'cancelled') {
      var cancelled = document.getElementById('banner-cancelled');
      if (cancelled) cancelled.style.display = 'block';
    }
    if (params.has('payment')) {
      params.delete('payment');
      window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params : '') + window.location.hash);
    }
    var toggle = document.getElementById('patch-toggle');
    var body = document.getElementById('patch-body');
    if (toggle && body) toggle.addEventListener('click', function () {
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      toggle.querySelector('.patch-toggle').textContent = open ? '▶' : '▼';
    });
    await checkOwnership();
  }
  initDownload();
})();
