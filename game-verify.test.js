'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const valid = new URLSearchParams({ code_challenge: 'a'.repeat(43), code_challenge_method: 'S256', state: 'b'.repeat(43), redirect_uri: 'http://127.0.0.1:40123/stoneforge/callback/' });
async function run(query, replies) {
  const elements = new Map(['status', 'approve', 'login', 'signup'].map(key => [key, { hidden: true, addEventListener(type, callback) { this.click = callback; } }]));
  const requests = []; let destination;
  const context = { URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    document: { getElementById(id) { return elements.get(id); } },
    location: { search: '?' + query, replace(url) { destination = url; } },
    async fetch(url, options) { requests.push({ url, options }); const next = replies.shift(); return { ok: next.status === 200, status: next.status, async json() { return next.body; } }; } };
  vm.createContext(context);
  await vm.runInContext(fs.readFileSync(require.resolve('./game-verify.js'), 'utf8'), context);
  return { elements, requests, get destination() { return destination; } };
}
test('invalid callback rejected before network', async () => {
  const bad = new URLSearchParams(valid); bad.set('redirect_uri', 'https://evil.example/');
  const result = await run(bad, []); assert.equal(result.requests.length, 0); assert.match(result.elements.get('status').textContent, /Invalid/);
});
test('unauthenticated browser offers login/signup with intact handoff', async () => {
  const result = await run(valid, [{ status: 401, body: { error: 'Login needed' } }]);
  assert.equal(result.elements.get('approve').hidden, true); assert.equal(result.elements.get('signup').hidden, false);
  assert.equal(new URL(result.elements.get('login').href, 'https://site.example/').searchParams.get('redirect'), 'game-verify.html?' + valid);
});
test('unowned account cannot approve', async () => {
  const result = await run(valid, [{ status: 200, body: { owns_game: false } }]);
  assert.equal(result.elements.get('approve').hidden, true); assert.match(result.elements.get('status').textContent, /does not own/);
});
test('explicit approval sends challenge only and returns code/state', async () => {
  const result = await run(valid, [{ status: 200, body: { owns_game: true, display_name: '<img src=x>' } },
    { status: 200, body: { code: 'c'.repeat(43), state: valid.get('state'), redirect_uri: valid.get('redirect_uri') } }]);
  assert.equal(result.requests.length, 1); assert.equal(result.elements.get('approve').hidden, false);
  await result.elements.get('approve').click();
  const payload = JSON.parse(result.requests[1].options.body); assert.equal(payload.code_verifier, undefined); assert.equal(payload.state, valid.get('state'));
  assert.equal(new URL(result.destination).searchParams.get('code'), 'c'.repeat(43));
  assert.match(result.elements.get('status').textContent, /Returning/);
});
test('server cannot substitute callback origin or state', async () => {
  const result = await run(valid, [{ status: 200, body: { owns_game: true } },
    { status: 200, body: { code: 'c'.repeat(43), state: valid.get('state'), redirect_uri: 'https://evil.example/' } }]);
  await result.elements.get('approve').click(); assert.equal(result.destination, undefined); assert.equal(result.elements.get('approve').disabled, false);
});
test('login redirect allowlist rejects executable and foreign URLs', () => {
  const source = fs.readFileSync(require.resolve('./auth.js'), 'utf8');
  const start = source.indexOf('function saveUserAndRedirect(');
  // The source uses a lower-case heading; stop before unrelated style helpers.
  const onlyFunction = source.slice(start, source.indexOf('// ---- Blocked', start) > start ? source.indexOf('// ---- Blocked', start) : source.indexOf('function injectBlockedModalStyles', start));
  for (const target of ['javascript:alert(1)', '//evil.example/', 'https://evil.example/', 'game-verify.html?state=x']) {
    const storage = new Map();
    const context = { URL, URLSearchParams, sessionStorage: { setItem(k, v) { storage.set(k, v); }, getItem(k) { return storage.get(k); } },
      window: { location: { href: 'https://site.example/repo/login-page.html', search: '?redirect=' + encodeURIComponent(target) } } };
    vm.createContext(context); vm.runInContext(onlyFunction, context); context.saveUserAndRedirect({ playfab_id: 'A' }, 'a');
    assert.equal(context.window.location.href, target.startsWith('game-verify') ? 'https://site.example/repo/' + target : 'dashboard.html');
  }
});
