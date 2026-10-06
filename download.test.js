'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const owner = { status: 200, body: { success: true, owns_game: true } };
const nonOwner = { status: 200, body: { success: true, owns_game: false } };
const signed = (signature = 'c') => ({ success: true, expires_in: 300, file_name: 'StoneForgeSetup.exe',
  download_url: 'https://' + 'a'.repeat(32) + '.r2.cloudflarestorage.com/stoneforge-fullgame/StoneForgeSetup.exe'
    + '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&X-Amz-Signature=' + signature.repeat(64) });

async function fixture(replies, search = '', storage = '{"playfab_id":"FORGED","owns_game":true}') {
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.style = { display: 'none' }; this.events = {}; this.children = []; }
    addEventListener(type, callback) { this.events[type] = callback; }
    replaceChildren(...children) { this.children = children; }
    appendChild(child) { this.children.push(child); child.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    querySelector() { return this.marker ||= new Element('span'); }
    click() { if (this.disabled) return; if (this.tag === 'a') downloads.push(this.href); return this.events.click?.(); }
  }
  const elements = new Map(['full-action', 'full-note', 'banner-success', 'banner-cancelled', 'patch-toggle', 'patch-body']
    .map(id => [id, new Element()]));
  const trial = new Element('a'), body = new Element('body'), requests = [], downloads = [], history = [];
  const deadlines = new Map(); let timerId = 0, polls = 0, storageReads = 0;
  const location = { search, pathname: '/download.html', hash: '', href: 'https://site.example/download.html' + search,
    assign(value) { this.assigned = value; } };
  const context = { URL, URLSearchParams, AbortController, Promise, Error, Object,
    document: { getElementById(id) { return elements.get(id); }, body,
      createElement(tag) { return new Element(tag); }, querySelector() { return trial; } },
    window: { location, history: { replaceState(a, b, url) { history.push(url); } } },
    sessionStorage: { getItem() { storageReads++; return storage; } },
    setTimeout(callback, ms) { const id = ++timerId;
      if (ms === 2000) { polls++; queueMicrotask(callback); } else deadlines.set(id, callback);
      return id;
    }, clearTimeout(id) { deadlines.delete(id); },
    async fetch(url, options) {
      requests.push({ url, options }); const reply = replies.shift();
      if (!reply) throw new Error('Unexpected request');
      const result = typeof reply === 'function' ? await reply(options) : reply;
      if (result instanceof Error) throw result;
      return { status: result.status, ok: result.status >= 200 && result.status < 300, async json() { return result.body; } };
    } };
  vm.createContext(context); vm.runInContext(fs.readFileSync(require.resolve('./download.js'), 'utf8'), context);
  async function settle() { for (let i = 0; i < 35; i++) await new Promise(resolve => setImmediate(resolve)); }
  await settle();
  return { elements, trial, body, requests, downloads, location, history, deadlines, settle,
    get button() { return elements.get('full-action').children[0]; },
    get note() { return elements.get('full-note').textContent; },
    get polls() { return polls; }, get storageReads() { return storageReads; } };
}

test('initial ownership check uses cookie, not forged sessionStorage or player ID', async () => {
  const f = await fixture([nonOwner]);
  assert.match(f.button.textContent, /Purchase to Unlock/); assert.equal(f.storageReads, 0);
  assert.equal(f.requests[0].url, 'https://stoneforge-backend.onrender.com/api/check-ownership');
  assert.equal(f.requests[0].options.credentials, 'include'); assert.equal(f.requests[0].options.cache, 'no-store');
  assert.equal(f.downloads.length, 0); assert.equal(f.deadlines.size, 0);
});

test('authenticated owner works without a browser cached user', async () => {
  const f = await fixture([owner], '', null);
  assert.match(f.button.textContent, /Download Full Game/); assert.equal(f.storageReads, 0);
});

test('401 offers sign-in; restricted account cannot buy or download', async () => {
  for (const status of [401, 403]) {
    const f = await fixture([{ status, body: { error: 'Denied' } }]);
    assert.equal(f.downloads.length, 0);
    if (status === 401) {
      await f.button.click(); assert.equal(f.location.href, 'login-page.html?redirect=download.html');
    } else { assert.equal(f.button.disabled, true); assert.match(f.note, /restricted/); }
  }
});

test('ownership outage and malformed boolean fail closed with retry, not buy/download', async () => {
  for (const reply of [new Error('offline'), { status: 503, body: { error: 'Unavailable' } },
    { status: 200, body: { success: true, owns_game: 'true' } }, { status: 200, body: { owns_game: true } }]) {
    const f = await fixture([reply]); assert.match(f.button.textContent, /Check Purchase Again/);
    assert.equal(f.downloads.length, 0);
  }
});

test('owner click reauthenticates and requests a fresh private link for every download', async () => {
  const f = await fixture([owner, { status: 200, body: signed() }, { status: 200, body: signed('d') }]);
  await f.button.click(); await f.button.click();
  assert.equal(f.downloads.length, 2); assert.notEqual(f.downloads[0], f.downloads[1]);
  for (const request of f.requests.slice(1)) {
    assert.ok(request.url.endsWith('/download/full-game')); assert.equal(request.options.method, 'POST');
    assert.equal(request.options.credentials, 'include'); assert.equal(request.options.body, '{}');
    assert.equal(request.options.headers['x-playfab-id'], undefined);
  }
  assert.equal(f.body.children.length, 0); assert.equal(f.deadlines.size, 0);
  assert.match(f.note, /Download requested/);
});

test('expired cookie at download requires sign-in rather than using old owner UI', async () => {
  const f = await fixture([owner, { status: 401, body: { error: 'Expired' } }]);
  await f.button.click(); assert.match(f.button.textContent, /Sign In/); assert.equal(f.downloads.length, 0);
});

test('ownership revoked at click removes stale download access', async () => {
  const f = await fixture([owner, { status: 403, body: { error: 'Purchase required' } }, nonOwner]);
  await f.button.click(); assert.match(f.button.textContent, /Purchase to Unlock/); assert.equal(f.downloads.length, 0);
});

test('download error or rate limit keeps retry possible without navigating', async () => {
  for (const reply of [new Error('offline'), { status: 503, body: { error: 'Storage unavailable' } },
    { status: 429, body: { error: 'Wait' } }]) {
    const f = await fixture([owner, reply]); await f.button.click();
    assert.match(f.button.textContent, /Download Full Game/); assert.equal(f.button.disabled, false);
    assert.equal(f.downloads.length, 0); assert.match(f.note, /retry/);
  }
});

test('foreign/executable/public/malformed signed links are never used', async () => {
  const bad = [ { ...signed(), download_url: 'javascript:alert(1)' },
    { ...signed(), download_url: 'https://evil.example/StoneForgeSetup.exe' },
    { ...signed(), download_url: 'https://public.r2.dev/StoneForgeSetup.exe' },
    { ...signed(), download_url: signed().download_url.replace('StoneForgeSetup.exe', 'session.bin') },
    { ...signed(), download_url: signed().download_url.replace('X-Amz-Expires=300', 'X-Amz-Expires=86400') },
    { ...signed(), file_name: 'session.bin' }, { ...signed(), expires_in: 86400 }, { ...signed(), success: false } ];
  for (const data of bad) {
    const f = await fixture([owner, { status: 200, body: data }]); await f.button.click();
    assert.equal(f.downloads.length, 0); assert.match(f.note, /retry/);
  }
});

test('payment=success cannot unlock download; delayed webhook is polled before confirming', async () => {
  const f = await fixture([nonOwner, nonOwner, owner], '?payment=success&keep=1');
  assert.equal(f.requests.length, 3); assert.equal(f.polls, 2); assert.equal(f.downloads.length, 0);
  assert.match(f.button.textContent, /Download Full Game/);
  assert.match(f.elements.get('banner-success').textContent, /confirmed by the server/);
  assert.equal(f.history[0], '/download.html?keep=1');
});

test('payment polling stops after ten checks and does not invite duplicate payment', async () => {
  const f = await fixture(Array(10).fill(nonOwner), '?payment=success');
  assert.equal(f.requests.length, 10); assert.equal(f.polls, 9);
  assert.match(f.button.textContent, /Check Purchase Again/); assert.match(f.note, /Do not make another payment/);
  assert.match(f.elements.get('banner-success').textContent, /pending/); assert.equal(f.downloads.length, 0);
});

test('sign-in preserves pending-payment context without granting ownership', async () => {
  const f = await fixture([{ status: 401, body: { error: 'Login needed' } }], '?payment=success');
  await f.button.click();
  assert.equal(new URL(f.location.href, 'https://site.example/').searchParams.get('redirect'), 'download.html?payment=success');
  assert.equal(f.downloads.length, 0);
  assert.doesNotMatch(f.elements.get('banner-success').textContent, /You now own|Payment successful/);
});

test('cancelled checkout grants nothing and does not trigger payment polling', async () => {
  const f = await fixture([nonOwner], '?payment=cancelled');
  assert.equal(f.elements.get('banner-cancelled').style.display, 'block'); assert.equal(f.polls, 0);
  assert.match(f.button.textContent, /Purchase to Unlock/); assert.equal(f.downloads.length, 0);
});

test('purchase posts only package ID with cookie and follows HTTPS checkout', async () => {
  const f = await fixture([nonOwner, { status: 200, body: { success: true, checkout_url: 'https://checkout.paymongo.com/example' } }]);
  await f.button.click(); assert.equal(f.location.assigned, 'https://checkout.paymongo.com/example');
  const request = f.requests[1]; assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { package_id: 'full_game' });
  assert.equal(request.options.credentials, 'include'); assert.equal(request.options.headers['x-playfab-id'], undefined);
});

test('failed or executable checkout does not navigate or invite immediate duplicate checkout', async () => {
  for (const reply of [{ status: 400, body: { error: 'Already owned' } },
    { status: 200, body: { success: true, checkout_url: 'javascript:alert(1)' } }]) {
    const f = await fixture([nonOwner, reply]); await f.button.click();
    assert.equal(f.location.assigned, undefined); assert.match(f.button.textContent, /Check Purchase Again/);
  }
});

test('double-click during download results in only one request', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const f = await fixture([owner, () => pending]);
  const button = f.button;
  const first = button.click(); const second = button.click();
  assert.equal(f.requests.length, 2); assert.equal(f.button.disabled, true);
  resolve({ status: 200, body: signed() }); await Promise.all([first, second]);
  assert.equal(f.downloads.length, 1);
});

test('request timeout aborts and restores a retryable download state', async () => {
  const f = await fixture([owner, options => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  })]);
  const click = f.button.click(); for (const callback of f.deadlines.values()) callback();
  await click; assert.equal(f.downloads.length, 0); assert.equal(f.button.disabled, false);
  assert.equal(f.deadlines.size, 0); assert.match(f.note, /retry/);
});

test('Trial URL and patch toggle still work; Full Game has installer rather than portable instructions', async () => {
  const f = await fixture([nonOwner]);
  assert.equal(f.trial.href, 'https://www.dropbox.com/scl/fi/nuympz7slgwfepf5bwp8n/FreeTrialGame.zip?rlkey=o33635td1hlr51vt6e0h4xgt1&st=neotzbof&dl=1');
  await f.elements.get('patch-toggle').click(); assert.equal(f.elements.get('patch-body').style.display, 'block');
  const html = fs.readFileSync(require.resolve('./download.html'), 'utf8');
  assert.match(html, /<script src="download.js"><\/script>/); assert.match(html, /StoneForgeSetup.exe/);
  assert.ok(!html.includes('drive.google.com')); assert.ok(!html.includes('No installation required'));
  assert.ok(!html.includes('Save system not yet implemented'));
});
