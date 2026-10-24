'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const valid = new URLSearchParams({ code_challenge: 'a'.repeat(43), code_challenge_method: 'S256', state: 'b'.repeat(43), redirect_uri: 'http://127.0.0.1:40123/stoneforge/callback/' });
const account={success:true,playfab_id:'ALICE',owns_game:false,display_name:'Alice'};
async function run(query, replies) {
  const elements = new Map(['status', 'approve', 'login', 'signup'].map(key => [key, { hidden: true, addEventListener(type, callback) { this.click = callback; } }]));
  const requests = []; let destination;
  const context = { URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    document: { getElementById(id) { return elements.get(id); } },
    location: { search: '?' + query, replace(url) { destination = url; } },
    async fetch(url, options) { requests.push({ url, options }); const entry = replies.shift(); const next=typeof entry==='function'?await entry(options):entry; if(next instanceof Error)throw next; return { ok: next.status === 200, status: next.status, async json() { return next.body; } }; } };
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
test('valid free non-owner and historical owner can approve without a purchase', async () => {
 for(const owns_game of [false,true]){
  const result = await run(valid, [{ status: 200, body: {...account,owns_game} }]);
  assert.equal(result.elements.get('approve').hidden, false); assert.equal(result.elements.get('approve').disabled,false);
  assert.match(result.elements.get('status').textContent, /free to play/);assert.equal(result.requests.length,1);
 }
});
test('explicit approval sends challenge only and returns code/state', async () => {
  const result = await run(valid, [{ status: 200, body: {...account,display_name:'<img src=x>'} },{status:200,body:account},
    { status: 200, body: { code: 'c'.repeat(43), state: valid.get('state'), redirect_uri: valid.get('redirect_uri') } }]);
  assert.equal(result.requests.length, 1); assert.equal(result.elements.get('approve').hidden, false);
  await result.elements.get('approve').click();
  assert.match(result.requests[1].url,/\/me$/);
  const payload = JSON.parse(result.requests[2].options.body); assert.equal(payload.code_verifier, undefined); assert.equal(payload.state, valid.get('state'));
  assert.deepEqual(Object.keys(payload).sort(),['code_challenge','code_challenge_method','redirect_uri','state']);
  assert.equal(new URL(result.destination).searchParams.get('code'), 'c'.repeat(43));
  assert.match(result.elements.get('status').textContent, /Returning/);
});
test('server cannot substitute callback origin or state', async () => {
  const result = await run(valid, [{ status: 200, body: account },{status:200,body:account},
    { status: 200, body: { code: 'c'.repeat(43), state: valid.get('state'), redirect_uri: 'https://evil.example/' } }]);
  await result.elements.get('approve').click(); assert.equal(result.destination, undefined); assert.equal(result.elements.get('approve').disabled, false);
});
test('restricted, unavailable and malformed accounts cannot approve',async()=>{
 for(const reply of [{status:403,body:{error:'restricted'}},{status:503,body:{error:'down'}},{status:200,body:{}},
  {status:200,body:{...account,success:false}},{status:200,body:{...account,playfab_id:'<script>'}}]){
  const result=await run(valid,[reply]);assert.equal(result.elements.get('approve').hidden,true);assert.equal(result.elements.get('approve').disabled,true);
  assert.equal(result.requests.length,1);assert.equal(result.destination,undefined);
 }
});

test('account switch or expired/restricted session before approval prevents issuing a code',async()=>{
 for(const reply of [{status:200,body:{...account,playfab_id:'BOB'}},{status:401,body:{error:'expired'}},{status:403,body:{error:'restricted'}}]){
  const result=await run(valid,[{status:200,body:account},reply]);await result.elements.get('approve').click();
  assert.equal(result.requests.length,2);assert.ok(result.requests.every(call=>call.url.endsWith('/me')));
  assert.equal(result.destination,undefined);assert.equal(result.elements.get('approve').disabled,true);
 }
});

test('concurrent approval issues one code and invalid state/code responses never redirect',async()=>{
 let release;const first=await run(valid,[{status:200,body:account},()=>new Promise(done=>{release=()=>done({status:200,body:account});}),
  {status:200,body:{code:'c'.repeat(43),state:valid.get('state'),redirect_uri:valid.get('redirect_uri')}}]);
 const one=first.elements.get('approve').click(),two=first.elements.get('approve').click();assert.equal(first.requests.length,2);
 release();await Promise.all([one,two]);assert.equal(first.requests.filter(call=>call.url.endsWith('/game/authorize')).length,1);
 assert.ok(first.requests.every(call=>call.options.cache==='no-store'));
 for(const body of [null,{code:'short',state:valid.get('state'),redirect_uri:valid.get('redirect_uri')},
  {code:'c'.repeat(43),state:'x'.repeat(43),redirect_uri:valid.get('redirect_uri')}]){
  const result=await run(valid,[{status:200,body:account},{status:200,body:account},{status:200,body}]);
  await result.elements.get('approve').click();assert.equal(result.destination,undefined);assert.match(result.elements.get('status').textContent,/Invalid response/);
 }
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
