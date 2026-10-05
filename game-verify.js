'use strict';
(async () => {
  const api = 'https://stoneforge-backend.onrender.com/api';
  const params = new URLSearchParams(location.search);
  const status = document.getElementById('status');
  const approve = document.getElementById('approve');
  const login = document.getElementById('login');
  const signup = document.getElementById('signup');
  const request = {
    code_challenge: params.get('code_challenge'), code_challenge_method: params.get('code_challenge_method'),
    state: params.get('state'), redirect_uri: params.get('redirect_uri'),
  };
  let callback;
  try { callback = new URL(request.redirect_uri); } catch { /* reject below */ }
  if (!callback || callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1'
    || Number(callback.port) < 1024 || Number(callback.port) > 65535
    || callback.pathname !== '/stoneforge/callback/' || callback.search || callback.hash || callback.username || callback.password
    || callback.href !== request.redirect_uri || request.code_challenge_method !== 'S256'
    || !/^[A-Za-z0-9_-]{43}$/.test(request.code_challenge || '') || !/^[A-Za-z0-9_-]{43}$/.test(request.state || '')) {
    status.textContent = 'Invalid verification request. Start again from the game.'; return;
  }
  const returnPage = 'game-verify.html?' + params.toString();
  login.href = 'login-page.html?redirect=' + encodeURIComponent(returnPage);
  signup.href = 'signup-page.html?redirect=' + encodeURIComponent(returnPage);
  async function fetchJson(path, options = {}) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 30000);
    try {
      const response = await fetch(api + path, { ...options, credentials: 'include', signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || 'Verification failed.'), { status: response.status });
      return data;
    } finally { clearTimeout(timer); }
  }
  try {
    const user = await fetchJson('/me');
    status.textContent = user.owns_game ? `Continue as ${user.display_name || user.username}?`
      : 'This account does not own the full game. Purchase it on your dashboard or use another account.';
    approve.hidden = !user.owns_game; login.hidden = false;
  } catch (error) {
    status.textContent = error.status === 401 ? 'Sign in to verify your game account.' : 'Cannot verify your session. Please sign in again or retry from the game.';
    login.hidden = false; signup.hidden = false;
  }
  approve.addEventListener('click', async () => {
    approve.disabled = true; status.textContent = 'Returning to StoneForge...';
    try {
      const result = await fetchJson('/game/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      if (result.redirect_uri !== request.redirect_uri || result.state !== request.state || !/^[A-Za-z0-9_-]{43}$/.test(result.code || '')) throw new Error('Invalid response. Please retry from the game.');
      callback.searchParams.set('code', result.code); callback.searchParams.set('state', result.state);
      location.replace(callback.href);
    } catch (error) { status.textContent = error.message; approve.disabled = false; }
  });
})();
