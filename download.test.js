'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const signed=(signature='c')=>({success:true,expires_in:300,file_name:'StoneForgeSetup.exe',
 download_url:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/game/StoneForgeSetup.exe?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300&X-Amz-Signature='+signature.repeat(64)});
async function fixture(replies=[],search='',policy={enabled:false}){
 const requests=[],downloads=[],history=[],timers=new Map();let timerId=0;
 class Element{
  constructor(tag='div'){this.tag=tag;this.events={};this.children=[];this.attributes={};this.hidden=true;}
  addEventListener(name,fn){this.events[name]=fn;}setAttribute(k,v){this.attributes[k]=v;}
  replaceChildren(...nodes){this.children=nodes;}appendChild(node){this.children.push(node);node.parent=this;}
  remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
  click(){if(this.disabled)return;if(this.tag==='a')downloads.push(this.href);return this.events.click?.();}
 }
 const nodes=Object.fromEntries(['game-action','game-note','download-maintenance-notice','legacy-payment-note'].map(id=>[id,new Element()]));
 const body=new Element('body'),location={search,pathname:'/download.html',hash:''};
 const context={URL,URLSearchParams,AbortController,
  document:{getElementById:id=>nodes[id],createElement:tag=>new Element(tag),body},
  window:{location,StoneForgeDownloadMaintenance:policy,history:{replaceState(a,b,url){history.push(url);}}},
  sessionStorage:{getItem(){throw new Error('Download must not inspect cached accounts');}},
  setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
  async fetch(url,options){requests.push({url,options});const entry=replies.shift();if(!entry)throw new Error('Unexpected request');
   const reply=typeof entry==='function'?await entry(options):entry;if(reply instanceof Error)throw reply;
   return{ok:reply.status===200,status:reply.status,json:async()=>reply.body};}
 };
 vm.runInNewContext(fs.readFileSync('download.js','utf8'),context);
 return{nodes,body,requests,downloads,history,timers,get button(){return nodes['game-action'].children[0];},get note(){return nodes['game-note'].textContent;}};
}
test('free installer initializes without identity, ownership, checkout or automatic download requests',async()=>{
 const f=await fixture();assert.equal(f.requests.length,0);assert.equal(f.button.textContent,'Download StoneForge');
 assert.equal(f.button.disabled,false);assert.match(f.note,/No account or game purchase/);assert.equal(f.nodes['download-maintenance-notice'].hidden,true);
});
test('explicit click requests anonymous empty POST and a fresh private attachment link each time',async()=>{
 const f=await fixture([{status:200,body:signed()},{status:200,body:signed('d')}]);
 await f.button.click();await f.button.click();assert.equal(f.downloads.length,2);assert.notEqual(...f.downloads);
 for(const call of f.requests){assert.equal(call.url,'https://stoneforge-backend.onrender.com/api/download/game');
  assert.equal(call.options.method,'POST');assert.equal(call.options.credentials,'omit');assert.equal(call.options.body,'{}');
  assert.equal(call.options.headers['x-playfab-id'],undefined);assert.equal(call.options.cache,'no-store');}
 assert.equal(f.body.children.length,0);assert.equal(f.timers.size,0);assert.match(f.note,/Download requested/);
});
test('default-on, missing and misspelled maintenance policy prevents requests even with forged release hints',async()=>{
 for(const policy of [require('./download-maintenance'),null,{}, {enabled:'false'}]){
  const f=await fixture([{status:200,body:signed()}],'?maintenance=false&release=true&payment=success',policy);
  assert.equal(f.button.disabled,true);assert.equal(f.button.textContent,'Under Maintenance');assert.match(f.note,/unified build/);
  await f.button.click();f.button.disabled=false;await f.button.click();assert.equal(f.button.disabled,true);
  assert.equal(f.requests.length,0);assert.equal(f.downloads.length,0);assert.equal(f.timers.size,0);
 }
});
test('legacy payment success/cancelled links never poll, create orders or certify a purchase',async()=>{
 for(const state of ['success','cancelled','anything']){
  const f=await fixture([],'?payment='+state+'&keep=1');assert.equal(f.requests.length,0);assert.equal(f.downloads.length,0);
  assert.equal(f.nodes['legacy-payment-note'].hidden,false);assert.match(f.nodes['legacy-payment-note'].textContent,/does not confirm a payment/);
  assert.deepEqual(f.history,['/download.html?keep=1']);assert.equal(f.button.textContent,'Download StoneForge');
 }
});
test('server release guard and maintenance responses remain retryable without requesting an old installer',async()=>{
 for(const code of ['UNIFIED_BUILD_NOT_READY','DOWNLOADS_MAINTENANCE']){
  const f=await fixture([{status:503,body:{code}}]);await f.button.click();assert.equal(f.downloads.length,0);
  assert.match(f.note,/unified build/);assert.equal(f.button.disabled,false);assert.equal(f.requests.length,1);
 }
});
test('foreign, public, executable, wrong file and malformed signed URLs never navigate',async()=>{
 const data=signed(),bad=[null,{}, {...data,file_name:'StoneForgeTutorialSetup.exe'},{...data,expires_in:999},
  {...data,download_url:'javascript:alert(1)'},{...data,download_url:'https://public.r2.dev/StoneForgeSetup.exe'},
  {...data,download_url:'https://evil.example/StoneForgeSetup.exe'},
  {...data,download_url:data.download_url.replace('/StoneForgeSetup.exe','/payload.exe')},
  {...data,download_url:data.download_url.replace('X-Amz-Expires=300','X-Amz-Expires=3600')},
  {...data,download_url:data.download_url+'#fragment'}, {...data,download_url:data.download_url.replace('https://','https://user:pass@')}];
 for(const body of bad){const f=await fixture([{status:200,body}]);await f.button.click();assert.equal(f.downloads.length,0);assert.match(f.note,/retry/);assert.equal(f.button.disabled,false);}
});
test('network, old-backend, rate and session failures do not invent a purchase/sign-in requirement',async()=>{
 for(const reply of [new Error('offline'),...[401,403,404,410,429,503].map(status=>({status,body:{error:'private provider detail'}}))]){
  const f=await fixture([reply]);await f.button.click();assert.equal(f.downloads.length,0);assert.equal(f.button.disabled,false);
  assert.match(f.note,/retry/);assert.doesNotMatch(f.note,/private provider detail|Sign In|Purchase to Unlock/);assert.equal(f.requests.length,1);
 }
});
test('double click has a single request and timeout restores the retryable action',async()=>{
 let release;const f=await fixture([()=>new Promise(done=>{release=()=>done({status:200,body:signed()});})]);
 const button=f.button,one=button.click(),two=button.click();assert.equal(f.requests.length,1);assert.equal(f.button.disabled,true);
 release();await Promise.all([one,two]);assert.equal(f.downloads.length,1);
 const slow=await fixture([options=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout'))))]);
 const click=slow.button.click();for(const timer of slow.timers.values())timer();await click;
 assert.equal(slow.downloads.length,0);assert.equal(slow.timers.size,0);assert.equal(slow.button.disabled,false);assert.equal(slow.button.attributes['aria-busy'],'false');
});
test('download page presents one guarded installer and preserves account/FM guidance without invented release metadata',()=>{
 const html=fs.readFileSync('download.html','utf8');assert.equal((html.match(/id="game-action"/g)||[]).length,1);
 assert.match(html,/<button[^>]*class="game-download-button"[^>]*disabled>/);
 assert.match(html,/StoneForgeSetup\.exe/);assert.match(html,/Tutorial, Story Mode, and Multiplayer/);assert.match(html,/No real money is charged/);
 assert.doesNotMatch(html,/tutorial-download\.js|id="full-action"|id="tutorial-download"|₱350|Purchase to Unlock|147 MB|103\.4 MB|next week/);
 assert.ok(html.indexOf('src="download-maintenance.js?')<html.indexOf('src="download.js?'));
 assert.match(html,/id="patch-toggle"[^>]*aria-expanded="false"/);
 assert.doesNotMatch(fs.readFileSync('download.js','utf8'),/check-ownership|create-checkout|download\/full-game|sessionStorage|localStorage/);
});
