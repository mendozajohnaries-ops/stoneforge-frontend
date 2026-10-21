'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {confirm}=require('./sign-out');
class Node{
 constructor(tag,document){this.tag=tag;this.document=document;this.children=[];this.listeners={};this.attributes={};this.open=false;this.isConnected=true;}
 append(...children){this.children.push(...children);}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 focus(){this.document.activeElement=this;}
 showModal(){this.open=true;}
 close(){this.open=false;this.listeners.close?.();}
 fire(name){const event={preventDefault(){this.prevented=true;}};this.listeners[name]?.(event);return event;}
}
function fixture(){const document={createElement:tag=>new Node(tag,document)};document.body=new Node('body',document);
 const previous=new Node('button',document);previous.focus();return{document,previous,get dialog(){return document.body.children[0];}};}
test('confirmation focuses Cancel, retains the underlying page and resolves false on Cancel/Escape/close',async()=>{
 for(const action of ['cancel','escape','close']){
  const f=fixture(),pending=confirm({document:f.document}),dialog=f.dialog,buttons=dialog.children[2].children;
  assert.equal(dialog.open,true);assert.equal(f.document.activeElement,buttons[0]);assert.equal(dialog.attributes['aria-labelledby'],'signout-heading');
  if(action==='cancel')buttons[0].fire('click');else if(action==='escape')assert.equal(dialog.fire('cancel').prevented,true);else dialog.close();
  assert.equal(await pending,false);assert.equal(dialog.open,false);assert.equal(f.document.activeElement,f.previous);
 }
});
test('explicit Sign Out resolves true; repeated requests cannot create stacked confirmations',async()=>{
 const f=fixture(),pending=confirm({document:f.document});assert.equal(await confirm({document:f.document}),false);
 assert.equal(f.document.body.children.length,1);f.dialog.children[2].children[1].fire('click');assert.equal(await pending,true);
 const next=confirm({document:f.document});assert.equal(f.document.body.children.length,1);f.dialog.children[2].children[0].fire('click');assert.equal(await next,false);
});
test('unsupported dialog fails closed without approving logout',async()=>{
 const f=fixture();const create=f.document.createElement;f.document.createElement=tag=>{const node=create(tag);if(tag==='dialog')node.showModal=()=>{throw new Error('unsupported');};return node;};
 assert.equal(await confirm({document:f.document}),false);
});
function actualHandler(file,approval){
 const source=fs.readFileSync(file,'utf8'),handler=source.match(/async function signOut\(\) \{[\s\S]*?\n\}/)?.[0];assert.ok(handler);
 const calls={confirm:0,stops:0,posts:0,removes:0},window={location:{href:'unchanged'}};
 const context={window,API_BASE:'https://api.example/api',StoneForgeSignOut:{confirm:()=>{calls.confirm++;return approval();}},
  fetch:async(url,options)=>{assert.equal(url,'https://api.example/api/logout');assert.equal(options.credentials,'include');assert.equal(options.method,'POST');calls.posts++;},
  sessionStorage:{removeItem:key=>{assert.equal(key,'sf_user');calls.removes++;}},
  achievementBrowser:{stop(){calls.stops++;}},storeBrowser:{stop(){calls.stops++;}},transactionBrowser:{stop(){calls.stops++;}}};
 vm.runInNewContext('let signingOut=false;let cachedUser={playfab_id:"alice"};\n'+handler+'\nglobalThis.run=signOut;globalThis.owner=()=>cachedUser;',context);
 return{context,calls,window};
}
test('actual Profile/Admin handlers perform no logout or cleanup until confirmed and suppress double clicks',async()=>{
 for(const file of ['dashboard.js','admin.js']){
  const cancel=actualHandler(file,async()=>false);await cancel.context.run();assert.equal(cancel.calls.posts,0);assert.equal(cancel.calls.removes,0);
  assert.equal(cancel.calls.stops,0);assert.ok(cancel.context.owner());assert.equal(cancel.window.location.href,'unchanged');
  let release;const pending=new Promise(resolve=>{release=resolve;}),f=actualHandler(file,()=>pending);
  const first=f.context.run();await f.context.run();assert.equal(f.calls.confirm,1);assert.equal(f.calls.posts,0);assert.equal(f.calls.stops,0);
  release(true);await first;assert.equal(f.calls.posts,1);assert.equal(f.calls.removes,1);assert.equal(f.window.location.href,'login-page.html');
  assert.equal(f.calls.stops,file==='dashboard.js'?3:0);
 }
});
test('both pages load the confirmation module before their logout handlers; required-profile sign-out shares the same guard',()=>{
 for(const [file,script] of [['dashboard.html','dashboard.js'],['admin.html','admin.js']]){
  const html=fs.readFileSync(file,'utf8');assert.match(html,/href="sign-out.css"/);assert.ok(html.indexOf('src="sign-out.js"')<html.indexOf(`src="${script}"`));
  assert.match(fs.readFileSync(script,'utf8'),/addEventListener\('click', signOut\)/);
 }
 assert.match(fs.readFileSync('dashboard.js','utf8'),/onSignOut: signOut/);
});
test('dialog explicitly restores centering overridden by the global margin reset and stays inside small viewports',()=>{
 const css=fs.readFileSync('sign-out.css','utf8'),rule=css.match(/\.signout-dialog\s*\{([^}]+)\}/)?.[1];assert.ok(rule);
 for(const pattern of [/position:fixed/,/inset:0/,/margin:auto/,/height:fit-content/,/max-height:calc\(100dvh - 2rem\)/,/overflow:auto/,/width:min\(420px,calc\(100% - 2rem\)\)/])assert.match(rule,pattern);
 assert.match(fs.readFileSync('base.css','utf8'),/\*[^}]+margin: 0/);
});
