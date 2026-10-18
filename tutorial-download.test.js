'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {RELEASE,validDownload,mount}=require('./tutorial-download');
function signed(signature='c'){
 const url=new URL('https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com/stoneforge-demo/'+RELEASE.file_name);
 for(const [key,value]of Object.entries({'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Expires':'300',
  'X-Amz-SignedHeaders':'host','X-Amz-Signature':signature.repeat(64),
  'response-content-disposition':'attachment; filename="'+RELEASE.file_name+'"'}))url.searchParams.set(key,value);
 return{...RELEASE,success:true,download_url:url.href};
}
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.textContent='';this.disabled=false;}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 removeEventListener(k){delete this.listeners[k];}
 appendChild(child){child.parent=this;this.children.push(child);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 click(){if(this.disabled)return;if(this.tag==='a')this.onDownload?.(this);return this.listeners.click?.();}
}
function fixture(replies=[]){
 const button=new Element('button'),note=new Element(),body=new Element('body'),requests=[],downloads=[],timers=new Map();
 let timerId=0;
 const document={getElementById:id=>id==='tutorial-download'?button:id==='tutorial-note'?note:null,body,
  createElement:tag=>{const element=new Element(tag);element.onDownload=link=>downloads.push({href:link.href,download:link.download,rel:link.rel,referrerPolicy:link.referrerPolicy});return element;}};
 const controller=mount({document,apiBase:'https://api.example/api',
  setTimeout:callback=>{const id=++timerId;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
  fetch:async(url,options)=>{
   requests.push({url,options});const next=replies.shift();if(!next)throw new Error('Unexpected request');
   const reply=typeof next==='function'?await next(options):next;if(reply instanceof Error)throw reply;
   return{ok:reply.status>=200&&reply.status<300,status:reply.status,json:async()=>reply.body};
  }});
 return{button,note,body,controller,requests,downloads,timers};
}
test('free Tutorial initializes immediately with no account, ownership, or automatic download request',()=>{
 const f=fixture();try{
  assert.equal(f.requests.length,0);assert.equal(f.downloads.length,0);assert.equal(f.button.disabled,false);
  assert.match(f.note.textContent,/No account or purchase/);
  const source=fs.readFileSync(require.resolve('./tutorial-download'),'utf8');
  assert.doesNotMatch(source,/sessionStorage|localStorage|sf_session|check-ownership|create-checkout|dropbox/i);
 }finally{f.controller.stop();}
});
test('click requests an anonymous fresh link and navigates directly to the signed Tutorial attachment',async()=>{
 const f=fixture([{status:200,body:signed()},{status:200,body:signed('d')}]);try{
  await f.button.click();await f.button.click();
  assert.equal(f.requests.length,2);assert.equal(f.downloads.length,2);assert.notEqual(f.downloads[0].href,f.downloads[1].href);
  for(const request of f.requests){
   assert.equal(request.url,'https://api.example/api/download/tutorial');assert.equal(request.options.method,'POST');
   assert.equal(request.options.credentials,'omit');assert.equal(request.options.cache,'no-store');assert.equal(request.options.body,'{}');
   assert.equal(request.options.headers.Authorization,undefined);
  }
  assert.equal(f.downloads[0].download,RELEASE.file_name);assert.equal(f.downloads[0].referrerPolicy,'no-referrer');
  assert.equal(f.downloads[0].rel,'noreferrer');assert.equal(f.body.children.length,0);assert.equal(f.timers.size,0);
  assert.match(f.note.textContent,/Download requested/);
 }finally{f.controller.stop();}
});
test('double click while preparing sends only one request',async()=>{
 let resolve;const pending=new Promise(done=>{resolve=done;});const f=fixture([()=>pending]);
 try{
  const first=f.button.click(),second=f.button.click();assert.equal(f.requests.length,1);assert.equal(f.button.disabled,true);
  resolve({status:200,body:signed()});await Promise.all([first,second]);
  assert.equal(f.downloads.length,1);assert.equal(f.button.disabled,false);
 }finally{f.controller.stop();}
});
test('Full Game, executable, public, unsigned and malformed URLs are rejected',async()=>{
 const data=signed(),bad=[
  {...data,download_url:'javascript:alert(1)'},{...data,download_url:'https://evil.example/StoneForgeTutorialSetup.exe'},
  {...data,download_url:'https://public.r2.dev/StoneForgeTutorialSetup.exe'},
  {...data,download_url:data.download_url.replace('/stoneforge-demo/','/stoneforge-fullgame/')},
  {...data,download_url:data.download_url.replace('/stoneforge-demo/','/stoneforge-tutorial/')},
  {...data,download_url:data.download_url.replace('X-Amz-Expires=300','X-Amz-Expires=86400')},
  {...data,download_url:data.download_url.replace('X-Amz-Signature=','X-Amz-Signature=z')},
  {...data,download_url:data.download_url+'#hidden'}, {...data,file_name:'StoneForgeSetup.exe'},
  {...data,expires_in:86400},{...data,size_bytes:147061789},{...data,size_bytes:103426878},
  {...data,sha256:'a6f383ba56ca789de4616f0a3aaee52a3c95803add9a56942543782b7c1393c0'},
  {...data,version:'9.0.0'},{...data,sha256:'0'.repeat(64)},
  {...data,success:false},null
 ];
 for(const body of bad){
  assert.equal(validDownload(body),false);const f=fixture([{status:200,body}]);
  try{await f.button.click();assert.equal(f.downloads.length,0);assert.equal(f.button.disabled,false);assert.match(f.note.textContent,/retry/);}
  finally{f.controller.stop();}
 }
 assert.equal(validDownload(data),true);
});
test('storage/config/rate-limit errors remain retryable without login, checkout or old ZIP fallback',async()=>{
 for(const reply of [new Error('offline'),{status:503,body:{error:'private credentials detail'}},
  {status:429,body:{error:'Wait'}},{status:401,body:{error:'Expired unrelated cookie'}}]){
  const f=fixture([reply]);try{
   await f.button.click();assert.equal(f.downloads.length,0);assert.equal(f.button.disabled,false);
   assert.match(f.note.textContent,/retry.*No account or purchase/);assert.doesNotMatch(f.note.textContent,/private credentials/);
  }finally{f.controller.stop();}
 }
});
test('timeout aborts the request and restores the free download action',async()=>{
 const f=fixture([options=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))]);
 try{const click=f.button.click();for(const fn of f.timers.values())fn();await click;
  assert.equal(f.downloads.length,0);assert.equal(f.timers.size,0);assert.equal(f.button.disabled,false);
  assert.equal(f.button.attributes['aria-busy'],'false');assert.match(f.note.textContent,/retry/);
 }finally{f.controller.stop();}
});
test('stopped component ignores a late signed response and removes click handler',async()=>{
 let resolve;const pending=new Promise(done=>{resolve=done;});const f=fixture([()=>pending]);
 const click=f.button.click();f.controller.stop();resolve({status:200,body:signed()});await click;
 assert.equal(f.downloads.length,0);assert.equal(f.button.listeners.click,undefined);assert.equal(f.timers.size,0);
});
test('page identifies the exact Tutorial installer and preserves separate Full Game instructions/scripts',()=>{
 const html=fs.readFileSync('download.html','utf8');
 assert.match(html,/id="tutorial-download"/);assert.match(html,/id="tutorial-note"[^>]*role="status"/);
 assert.match(html,/103\.4 MB/);assert.match(html,/Tutorial v0\.1\.0/);assert.match(html,/StoneForgeTutorialSetup\.exe/);
 assert.match(html,/How to Install the Full Game/);assert.match(html,/StoneForgeSetup\.exe/);
 assert.ok(html.indexOf('src="tutorial-download.js"')<html.indexOf('src="download.js"'));
 assert.doesNotMatch(html,/TUTORIAL_R2_SECRET|dropbox|r2\.dev/);
});
