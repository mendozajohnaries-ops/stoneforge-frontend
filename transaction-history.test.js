'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{mount}=require('./transaction-history');
class Node{
 constructor(){this.children=[];this.listeners={};this.value='all';this.textContent='';this.disabled=false;this.hidden=false;}
 append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}
 addEventListener(n,f){this.listeners[n]=f;}removeEventListener(n){delete this.listeners[n];}
}
const row=(id,type='reward')=>({id,type,description:'First Improvement',status:'completed',amount:type==='spend'?-45:20,created_at:'2026-10-21T03:00:00Z'});
async function settled(){for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture(response){
 const nodes=Object.fromEntries(['history-items','history-status','history-filter','history-more','history-refresh'].map(k=>[k,new Node()]));
 const document={hidden:false,getElementById:id=>nodes[id],createElement:()=>new Node(),addEventListener(){},removeEventListener(){}};
 let owner='alice';const calls=[];
 const controller=mount({document,apiBase:'https://api.example/api',owner:'alice',currentOwner:()=>owner,fetch:async(url,options)=>{
  calls.push({url,options});return{ok:true,json:async()=>typeof response==='function'?response(url):response};}});
 return{nodes,calls,controller,owner(value){owner=value;}};
}
test('history loads owner-scoped GET, signs FM, shows pending rather than credit, and preserves text safety',async()=>{
 const f=fixture({version:1,owner:'alice',environment:'test',next_cursor:null,items:[row('a'),row('b','spend'),
  {...row('c','topup'),description:'<img src=x onerror=alert(1)>',amount:0,status:'pending',medals:200,price_centavos:4900,created_at:null}]});
 try{await settled();const cards=f.nodes['history-items'].children;assert.equal(cards.length,3);
  assert.equal(cards[0].children[1].textContent,'+20 FM');assert.equal(cards[1].children[1].textContent,'−45 FM');
  assert.equal(cards[2].children[1].textContent,'Not credited');assert.match(cards[2].children[0].children[1].textContent,/Date unknown.*Pending/);
  assert.match(cards[2].children[0].children[0].textContent,/<img/);assert.equal(cards[2].children[0].children[0].innerHTML,undefined);
  assert.equal(f.calls[0].options.credentials,'include');assert.equal(f.calls[0].options.cache,'no-store');assert.equal(f.calls[0].options.method,undefined);
  assert.match(f.nodes['history-status'].textContent,/Sandbox/);
 }finally{f.controller.stop();}
});
test('pagination de-duplicates across pages; filters reset rather than mix histories',async()=>{
 let filtered=false;
 const f=fixture(url=>({version:1,owner:'alice',environment:'test',next_cursor:url.includes('cursor=')||filtered?null:'opaque',
  items:filtered?[row('only-spend','spend')]:url.includes('cursor=')?[row('a'),row('b')]:[row('a')]}));
 try{await settled();assert.equal(f.nodes['history-more'].hidden,false);await f.nodes['history-more'].listeners.click();assert.equal(f.nodes['history-items'].children.length,2);
  filtered=true;f.nodes['history-filter'].value='spend';await f.nodes['history-filter'].listeners.change();assert.equal(f.nodes['history-items'].children.length,1);
  assert.match(f.calls.at(-1).url,/type=spend/);assert.doesNotMatch(f.calls.at(-1).url,/cursor=/);
 }finally{f.controller.stop();}
});
test('wrong owner, malformed amounts/dates, duplicate IDs and reward failure never become an empty success',async()=>{
 for(const edit of [d=>d.owner='bob',d=>d.items[0].amount='20',d=>d.items[0].amount=-1,d=>d.items[0].created_at='invalid',d=>d.items.push(d.items[0])]){
  const data={version:1,owner:'alice',environment:'test',next_cursor:null,items:[row('a')]};edit(data);const f=fixture(data);
  try{await settled();assert.equal(f.nodes['history-items'].children.length,0);assert.match(f.nodes['history-status'].textContent,/unavailable/);}finally{f.controller.stop();}
 }
});
test('account switch discards late history and logout clears DOM',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve),f=fixture(async()=>{await wait;return{version:1,owner:'alice',environment:'test',next_cursor:null,items:[row('a')]};});
 f.owner('bob');release();await settled();assert.equal(f.nodes['history-items'].children.length,0);f.controller.stop();assert.equal(f.nodes['history-status'].textContent,'');
});
test('history sits below Achievements and mobile CSS stacks the row without altering reward authority',()=>{
 const html=fs.readFileSync('dashboard.html','utf8');assert.ok(html.indexOf('id="transaction-history"')>html.indexOf('id="achievements-card"'));
 assert.ok(html.indexOf('src="transaction-history.js"')<html.indexOf('src="dashboard.js"'));
 assert.match(fs.readFileSync('profile-store.css','utf8'),/@media\(max-width:480px\).*forge-transaction/);
 assert.doesNotMatch(fs.readFileSync('transaction-history.js','utf8'),/method:\s*['"]POST|innerHTML\s*=/);
});
