'use strict';
(async () => {
  const api = 'https://stoneforge-backend.onrender.com/api';
  const params = new URLSearchParams(location.search);
  const status = document.getElementById('status');
  const approve = document.getElementById('approve');
  const login = document.getElementById('login');
  const signup = document.getElementById('signup');
  let verifiedOwner = null, approving = false;
  approve.hidden = true; approve.disabled = true;
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
      const response = await fetch(api + path, { ...options, credentials: 'include', cache: 'no-store', signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || 'Verification failed.'), { status: response.status });
      return data;
    } finally { clearTimeout(timer); }
  }
  try {
    const user = await fetchJson('/me');
    if(user.success!==true||typeof user.playfab_id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(user.playfab_id))throw new Error('Invalid account response.');
    verifiedOwner = user.playfab_id;
    status.textContent = `Continue as ${user.display_name || user.username || 'Player'}? StoneForge is free to play.`;
    approve.hidden = false; approve.disabled = false; login.hidden = false;
  } catch (error) {
    status.textContent = error.status === 401 ? 'Sign in to verify your game account.' : error.status === 403 ? 'Account access is restricted. Check your account status.' : 'Cannot verify your session. Please sign in again or retry from the game.';
    login.hidden = false; signup.hidden = false;
  }
  approve.addEventListener('click', async () => {
    if(!verifiedOwner||approving)return;
    approving = true; approve.disabled = true; status.textContent = 'Verifying your account...';
    try {
      const current = await fetchJson('/me');
      if(current.success!==true||current.playfab_id!==verifiedOwner){verifiedOwner=null;throw new Error('Account changed. Start again from the game.');}
      const result = await fetchJson('/game/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      if (!result || result.redirect_uri !== request.redirect_uri || result.state !== request.state || !/^[A-Za-z0-9_-]{43}$/.test(result.code || '')) throw new Error('Invalid response. Please retry from the game.');
      status.textContent = 'Returning to StoneForge...';
      callback.searchParams.set('code', result.code); callback.searchParams.set('state', result.state);
      location.replace(callback.href);
    } catch (error) {
      if(error.status===401||error.status===403)verifiedOwner=null;
      status.textContent = error.status===401?'Your session expired. Sign in and start again from the game.':error.message;
      approving=false;approve.disabled=!verifiedOwner;
    }
  });
})();
