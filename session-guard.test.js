'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {protect,notify,EVENT_KEY}=require('./session-guard');
const alice={success:true,playfab_id:'ALICE',display_name:'Alice',is_admin:false};
const reply=(data=alice,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
async function settled(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture({role='player',responses=[],ready}={}){
 class Events{constructor(){this.handlers=new Map();}addEventListener(n,fn){if(!this.handlers.has(n))this.handlers.set(n,new Set());this.handlers.get(n).add(fn);}removeEventListener(n,fn){this.handlers.get(n)?.delete(fn);}emit(n,event={}){for(const fn of this.handlers.get(n)||[])fn(event);}}
 class Node extends Events{constructor(){super();this.hidden=false;this.inert=false;this.style={};this.children=[];}setAttribute(){}replaceChildren(...nodes){this.children=nodes;}append(node){this.children.push(node);}}
 const nodes={content:new Node(),loading:new Node()},storage=new Map(),persistent=new Map(),calls=[],destinations=[],timers=new Map();let serial=0,suspends=0,readyCalls=0;
 const window=new Events(),document=new Events();document.hidden=false;document.getElementById=id=>id==='root'?nodes.content:nodes.loading;
 document.createElement=()=>new Node();document.querySelectorAll=()=>[];
 Object.assign(window,{document,location:{replace:url=>destinations.push(url)},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  localStorage:{setItem:(k,v)=>persistent.set(k,v)},setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 const guard=protect({window,document,apiBase:'https://api.example/api',role,rootId:'root',onReady:async user=>{readyCalls++;await ready?.(user);},onSuspend:()=>{suspends++;},
  fetch:async(url,options)=>{calls.push({url,options});const response=responses.shift();if(response===undefined)throw new Error('Unexpected request');return typeof response==='function'?response(options):response;}});
 return{guard,window,document,nodes,storage,persistent,calls,destinations,timers,responses,get readyCalls(){return readyCalls;},get suspends(){return suspends;}};
}
test('private content starts hidden; verified server identity reveals it once with cookie/no-store reads',async()=>{
 const f=fixture({responses:[reply()]});try{
  assert.equal(f.nodes.content.hidden,true);f.storage.set('sf_user','{"playfab_id":"FORGED","is_admin":true}');
  assert.equal(await f.guard.check(),true);assert.equal(f.guard.owner,'ALICE');assert.equal(f.readyCalls,1);assert.equal(f.nodes.content.hidden,false);
  assert.equal(f.calls[0].options.credentials,'include');assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.timers.size,0);
 }finally{f.guard.stop();}
});
test('expired, restricted and forged identity replies never reveal cached content',async()=>{
 for(const response of [reply({},401),reply({},403),reply({}),reply({...alice,playfab_id:'<bad>'}),reply({...alice,success:false})]){
  const f=fixture({responses:[response]});try{await f.guard.check();assert.equal(f.readyCalls,0);assert.equal(f.nodes.content.hidden,true);
   if([401,403].includes(response.status))assert.deepEqual(f.destinations,['login-page.html']);else assert.equal(f.destinations.length,0);
  }finally{f.guard.stop();}
 }
});
test('network failure retains a masked retryable page instead of redirecting as a successful logout',async()=>{
 const f=fixture({responses:[()=>{throw Error('offline');},reply()]});try{
  await f.guard.check();assert.equal(f.nodes.content.hidden,true);assert.equal(f.destinations.length,0);assert.match(f.nodes.loading.children[0].textContent,/could not be verified/);
  await f.guard.check();assert.equal(f.nodes.content.hidden,false);assert.equal(f.readyCalls,1);
 }finally{f.guard.stop();}
});
test('pagehide masks and clears private data before history snapshots; pageshow must reverify',async()=>{
 const f=fixture({responses:[reply(),reply({},401)]});try{
  await f.guard.check();const count=f.suspends;f.window.emit('pagehide',{persisted:true});assert.equal(f.nodes.content.hidden,true);assert.equal(f.guard.owner,null);assert.ok(f.suspends>count);
  f.window.emit('pageshow',{persisted:true});await settled();assert.equal(f.nodes.content.hidden,true);assert.deepEqual(f.destinations,['login-page.html']);assert.equal(f.readyCalls,1);
 }finally{f.guard.stop();}
});
test('restored valid page remounts once; mere tab visibility revalidation does not reload data/history',async()=>{
 const f=fixture({responses:[reply(),reply(),reply()]});try{
  await f.guard.check();f.document.emit('visibilitychange');await settled();assert.equal(f.readyCalls,1);
  f.window.emit('pagehide',{persisted:true});f.window.emit('pageshow',{persisted:true});await settled();assert.equal(f.readyCalls,2);assert.equal(f.nodes.content.hidden,false);
 }finally{f.guard.stop();}
});
test('account switching clears former state before mounting the new account; roles come from server',async()=>{
 const seen=[],f=fixture({responses:[reply(),reply({...alice,playfab_id:'BOB'})],ready:user=>seen.push(user.playfab_id)});
 try{await f.guard.check();await f.guard.check();assert.deepEqual(seen,['ALICE','BOB']);assert.equal(f.guard.owner,'BOB');}finally{f.guard.stop();}
 for(const [role,user,target]of [['admin',alice,'dashboard.html'],['player',{...alice,is_admin:true},'admin.html']]){
  const f=fixture({role,responses:[reply(user)]});try{await f.guard.check();assert.equal(f.readyCalls,0);assert.equal(f.nodes.content.hidden,true);assert.deepEqual(f.destinations,[target]);}finally{f.guard.stop();}
 }
});
test('successful logout verifies response, clears hints, notifies other tabs and uses replace navigation',async()=>{
 const f=fixture({responses:[reply(),reply({success:true})]});try{
  await f.guard.check();f.storage.set('sf_reported','private');assert.equal(await f.guard.logout(),true);
  assert.equal(f.nodes.content.hidden,true);assert.equal(f.guard.owner,null);assert.equal(f.storage.size,0);assert.deepEqual(f.destinations,['login-page.html']);
  assert.equal(JSON.parse(f.persistent.get(EVENT_KEY)).kind,'signed-out');assert.equal(f.calls[1].options.method,'POST');assert.equal(f.calls[1].options.credentials,'include');
 }finally{f.guard.stop();}
});
test('failed/malformed logout keeps private content masked, offers retry and never claims sign-out',async()=>{
 for(const response of [reply({success:false}),reply({},503),()=>{throw Error('offline');}]){
  const f=fixture({responses:[reply(),response,reply({success:true})]});try{
   await f.guard.check();assert.equal(await f.guard.logout(),false);assert.equal(f.destinations.length,0);assert.equal(f.nodes.content.hidden,true);
   assert.match(f.nodes.loading.children[0].textContent,/could not be confirmed/);assert.equal(f.persistent.size,0);
   assert.equal(await f.guard.logout(),true);assert.deepEqual(f.destinations,['login-page.html']);
  }finally{f.guard.stop();}
 }
});
test('concurrent checks/logout coalesce and stale API/JSON responses cannot reach a newer identity',async()=>{
 let release;const f=fixture({responses:[()=>new Promise(done=>{release=()=>done(reply());})]});try{
  const one=f.guard.check(),two=f.guard.check();assert.equal(f.calls.length,1);release();await Promise.all([one,two]);assert.equal(f.readyCalls,1);
  let pending;f.responses.push(()=>new Promise(done=>{pending=()=>done(reply({private:'old'}));}));
  const request=f.guard.request('https://api.example/api/private');f.window.emit('pagehide');pending();await assert.rejects(request,/Account changed/);
 }finally{f.guard.stop();}
 const g=fixture({responses:[reply(),reply({value:'old'})]});try{
  await g.guard.check();const response=await g.guard.request('https://api.example/api/private');g.window.emit('pagehide');await assert.rejects(response.json(),/Account changed/);
 }finally{g.guard.stop();}
});
test('optional 403 triggers session check rather than blind logout; a real 401 invalidates immediately',async()=>{
 const f=fixture({responses:[reply(),reply({error:'Store paused'},403),reply(),reply({},401)]});try{
  await f.guard.check();const response=await f.guard.request('https://api.example/api/store/checkout');assert.equal(response.status,403);await settled();
  assert.equal(f.guard.owner,'ALICE');assert.equal(f.destinations.length,0);assert.equal(f.readyCalls,1);
  await assert.rejects(f.guard.request('https://api.example/api/private'));assert.deepEqual(f.destinations,['login-page.html']);
 }finally{f.guard.stop();}
});
test('cross-tab sign-out masks immediately; sign-in revalidates the cookie, never trusts broadcast identity',async()=>{
 const f=fixture({responses:[reply(),reply({...alice,playfab_id:'BOB'})]});try{
  await f.guard.check();f.window.emit('storage',{key:EVENT_KEY,newValue:JSON.stringify({kind:'signed-in',playfab_id:'FORGED'})});await settled();assert.equal(f.guard.owner,'BOB');
  f.window.emit('storage',{key:EVENT_KEY,newValue:JSON.stringify({kind:'signed-out'})});assert.equal(f.nodes.content.hidden,true);assert.equal(f.guard.owner,null);assert.deepEqual(f.destinations,['login-page.html']);
 }finally{f.guard.stop();}
});
test('timeout aborts authentication and stop removes navigation handlers',async()=>{
 const f=fixture({responses:[options=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))))]});
 const check=f.guard.check();for(const timer of f.timers.values())timer();await check;assert.equal(f.nodes.content.hidden,true);assert.equal(f.timers.size,0);
 f.guard.stop();assert.equal(f.window.handlers.get('pageshow').size,0);assert.equal(f.document.handlers.get('visibilitychange').size,0);
});
test('both protected pages mask their root in HTML and load the shared guard before page handlers',()=>{
 assert.match(fs.readFileSync('base.css','utf8'),/\[hidden\]\s*\{\s*display:none !important/);
 for(const [file,id,script]of [['dashboard.html','dashboard','dashboard.js'],['admin.html','admin-content','admin.js']]){
  const html=fs.readFileSync(file,'utf8');assert.match(html,new RegExp('id="'+id+'"[^>]*hidden'));assert.ok(html.indexOf('src="session-guard.js?')<html.indexOf('src="'+script+'"'));
  assert.match(fs.readFileSync(script,'utf8'),/sessionAccess\.logout\(\)/);assert.doesNotMatch(fs.readFileSync(script,'utf8'),/logout[^\n]*\.catch\(\(\) => \{\}\)/);
 }
});
