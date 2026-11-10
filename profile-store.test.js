'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fields=require('./profile-fields');global.StoneForgeProfile=fields;
global.StoneForgeSchools=require('./school-selector');
global.StoneForgeWallet=require('./wallet-client');
global.StoneForgeStoreHandoff=require('./store-handoff-client');
global.StoneForgeSkins=require('./skin-client');
const schoolCatalog=require('./test-fixtures/school-catalog.json');
const store=require('./profile-store');

test('Store uses catalog-driven prices and removes Chroma promotion',()=>{
 const html=fs.readFileSync('dashboard.html','utf8');
 assert.match(html,/id="forge-skins-tab"/);
 assert.doesNotMatch(html,/Chroma skins|300 FM per chroma|Explorer is not available yet/);
 assert.doesNotMatch(html,/forge-perk-preview|forge-character-preview/);
});
test('frontend requires an explicit supported User Type and student school; no discount or privileges',()=>{
 for(const user_type of ['',null,'admin','instructor','toString'])assert.throws(()=>fields.validate({user_type}));
 assert.throws(()=>fields.validate({user_type:'student',school:''}));
 assert.throws(()=>fields.validate({user_type:'student',school:'Cavite School'}));
 assert.deepEqual(fields.validate({user_type:'student',school:' Cavite   School ',school_id:'sample-school'}),{user_type:'student',school:'Cavite School',school_id:'sample-school'});
 assert.deepEqual(fields.validate({user_type:'teacher',school:''}),{user_type:'teacher',school:'',school_id:null});
 assert.deepEqual(fields.validate({user_type:'regular',school:'old'}),{user_type:'regular'});
});
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.attributes={};
 const classes=new Set();this.classList={add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(name,fn){const previous=this.listeners[name];this.listeners[name]=previous?event=>{previous(event);fn(event);}:fn;}
 removeEventListener(name){delete this.listeners[name];}
 showModal(){this.open=true;}close(){this.open=false;}focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this;}scrollIntoView(){this.scrolled=true;}
 getBoundingClientRect(){return{left:0,top:0,right:100,bottom:100};}
 getClientRects(){return this.hidden?[]:[{}];}
 async fire(name,event={}){event.target??=this;event.currentTarget=this;if(!event.preventDefault)event.preventDefault=function(){this.prevented=true;};return this.listeners[name]?.(event);}
}
test('conditional school field is required only for Student, and omitted for Regular User',()=>{
 const type=new Node(),group=new Node(),school=new Node(),label=new Node();fields.bind(type,group,school,label);
 assert.equal(group.hidden,true);type.value='student';type.listeners.change();assert.equal(school.required,true);assert.equal(group.hidden,false);
 type.value='teacher';type.listeners.change();assert.equal(school.required,false);
 type.value='regular';type.listeners.change();assert.equal(school.disabled,true);assert.equal(group.hidden,true);
});
const ids=['profile-signout','profile-completion-dialog','profile-completion-form','profile-user-type','profile-school','profile-school-group','profile-school-label',
 'profile-school-options','profile-school-status','profile-school-toggle','profile-school-retry',
 'profile-cancel','profile-required-note','profile-save-status','profile-save','profile-edit','profile-retry','profile-state-status',
 'user-type-value','profile-user-type-badge','school-value','school-display-row','forge-pack-grid','wallet-balance','wallet-state',
 'wallet-test-row','wallet-test-balance','store-state','wallet-refresh','open-forge-store','forge-store','forge-store-close','forge-store-body',
 'store-wallet-balance','store-test-row','store-test-balance','forge-store-mode','forge-store-availability','forge-store-retry','forge-store-browse',
 'forge-store-categories','forge-medals-tab','forge-classes-tab','forge-classes','forge-class-state','forge-class-grid',
 'forge-class-review','forge-class-review-heading','forge-class-review-details','forge-class-cancel','forge-class-confirm',
 'forge-confirmation','forge-confirmation-heading','forge-confirm-pack','forge-confirm-price','forge-confirm-back','forge-confirm-continue','forge-skins-tab','forge-skins','forge-skin-state','forge-skin-grid','forge-class-review-art','forge-pack-review-art'];
const catalog={version:1,live_purchases_enabled:false,packs:[
 {id:'fm_handful',name:'Handful',medals:200,price_centavos:4900,image:'Assets/store/fm-handful.png'},
 {id:'fm_pouch',name:'Pouch',medals:450,price_centavos:9900,image:'Assets/store/fm-pouch.png'},
 {id:'fm_crate',name:'Crate',medals:1000,price_centavos:19900,image:'Assets/store/fm-crate.png'},
 {id:'fm_chest',name:'Chest',medals:2200,price_centavos:39900,image:'Assets/store/fm-chest.png'}],
 perk_upgrades:{id:'multiplayer-perks',version:2,explorer_available:true,explorer_unlock_cost:750,characters:[
 {id:'captain',costs:[45,95,155,230]},{id:'engineer',costs:[65,125,190,270]},
 {id:'attendant',costs:[30,70,120,180]},{id:'explorer',costs:[80,140,205,300]}]}};
async function settled(){for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));}
const productLabels=(fixture,type)=>fixture.nodes['forge-'+type+'-grid'].children.map(card=>{
 const content=card.children.at(-1);
 return content.children[0].textContent+': '+content.children.at(-1).textContent;
});
async function openCategory(fixture,category){
 await settled();fixture.controller.open();await fixture.nodes['forge-'+category+'-tab'].fire('click');await settled();
}
const sharedShop=(owner='alice')=>({version:1,owner,currency:'FM',environment:'test',live_purchases_enabled:false,purchases_enabled:false,
 wallet:{balance:1800,credits:4800,spent:3000,revision:4,generation:0},roles:['scientist','captain','engineer','attendant','explorer'].map((id,i)=>({id,price:i?750:0,owned:true})),skins:{status:'preview',owned:[],equipped:{}}});
function fixture({type='regular',eligible=false,failWallet=false,failStatus=503,wrongOwner=false,testBalance=0,checkoutReply,walletReply,canonicalReply,availabilityReply,rewardReply,failCatalog=false,profileReply,catalogReply,shopReply,initial=true,hash='',handoffReply,skinReply,classReply}={}){
 const nodes=Object.fromEntries(ids.map(id=>{const node=new Node();node.id=id;return[id,node];})),calls=[],navigation=[],storage=new Map();
 let accountOwner='alice';
 nodes['forge-confirmation'].hidden=true;
 const current={owner:'alice',user_type:type,school:type==='student'?'Cavite School':'Existing School',requires_profile_completion:!type};
 const all=()=>{const results=[];function walk(node){results.push(node);node.children.forEach(walk);}Object.values(nodes).forEach(walk);return results;};
 const document={hidden:false,documentElement:new Node('html'),getElementById:id=>nodes[id],createElement:tag=>{const node=new Node(tag);node.ownerDocument=document;return node;},querySelectorAll:()=>all().filter(node=>node.dataset.forgePack),
  addEventListener(){},removeEventListener(){}};
 Object.values(nodes).forEach(node=>{node.ownerDocument=document;});
 const summary=new Node('summary');summary.ownerDocument=document;
 nodes['forge-store'].querySelectorAll=()=>[nodes['forge-store-retry'],nodes['forge-store-close'],...(nodes['forge-confirmation'].hidden?
  [...all().filter(node=>node.dataset.forgePack),summary]:[nodes['forge-confirm-back'],nodes['forge-confirm-continue']])];
 global.sessionStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 global.location={assign:value=>navigation.push(value),hash};
 let availabilityData;
 const controller=store.mount({document,apiBase:'https://api.example/api',owner:'alice',currentOwner:()=>accountOwner,initialProfile:initial?{...current}:null,
  fetch:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/skins'))return skinReply?skinReply():{ok:false,status:404,json:async()=>({error:'Skin service not deployed'})};
   if(url.includes('/store/handoff?')){
    if(handoffReply)return handoffReply(url);
    const q=new URL(url).searchParams,pack=catalog.packs.find(p=>p.id===q.get('package_id'));
    if(pack)return{ok:true,json:async()=>({version:1,owner:'alice',environment:'test',live_purchases_enabled:false,handoff_id:null,package_id:pack.id,medals:pack.medals,price_centavos:pack.price_centavos,status:'review',credited:false,checkout_url:null,request_key:q.get('request_key')})};
    return{ok:false,status:404,json:async()=>({error:'Wrong game account'})};
   }
   if(url.endsWith('/shop/classes/purchase'))return classReply(options);
   if(url.endsWith('/shop/account'))return shopReply?shopReply():{ok:false,status:404,json:async()=>({})};
   if(url.endsWith('/schools'))return{ok:true,json:async()=>schoolCatalog};
   if(url.endsWith('/profile')&&options.method==='PUT'){const body=JSON.parse(options.body);Object.assign(current,body,{requires_profile_completion:false});return{ok:true,json:async()=>({...current})};}
   if(url.endsWith('/profile'))return profileReply?profileReply():{ok:true,json:async()=>({...current})};
   if(url.endsWith('/store/catalog')){if(catalogReply)return catalogReply();if(typeof failCatalog==='function'?failCatalog():failCatalog)throw new Error('Catalog timeout');return{ok:true,json:async()=>catalog};}
   if(url.endsWith('/store/checkout'))return checkoutReply?checkoutReply():{ok:true,json:async()=>({environment:'test',checkout_url:'https://checkout.paymongo.com/cs_fixture'})};
   if(url.endsWith('/wallet/reconcile')&&rewardReply)return rewardReply();
   const failed=typeof failWallet==='function'?failWallet():failWallet;
   if(url.endsWith('/wallet/current')){
    availabilityData=Promise.resolve(walletReply?walletReply():{owner:wrongOwner?'bob':'alice',balance:0,environment:'live',test_checkout_available:eligible,test_balance:testBalance});
    return{ok:!failed,status:failed?failStatus:200,json:async()=>{const legacy=await availabilityData;return canonicalReply?canonicalReply():
     {version:2,owner:legacy.owner,currency:'FM',environment:'test',balance:Object.hasOwn(legacy,'test_balance')?legacy.test_balance:legacy.balance,live_purchases_enabled:false,rewards_active:false};}};
   }
   if(url.endsWith('/wallet'))return availabilityReply?availabilityReply():{ok:!failed,status:failed?failStatus:200,json:async()=>({
    test_checkout_available:false,perk_rewards_available:false,requires_profile_completion:!type,live_purchases_enabled:false,access_model:'free_to_play',...await availabilityData})};
   return{ok:true,json:async()=>({owner:'alice',environment:'test',credited:[]})};
  }});
 return{nodes,calls,controller,navigation,all,document,summary,setOwner(value){accountOwner=value;}};
}

test('verified display wallet matches the game; reward reconciliation precedes the final balance read',async()=>{
 let balance=155,reconciles=0;
 const f=fixture({walletReply:()=>({owner:'alice',environment:'live',balance:0,test_wallet_available:true,test_checkout_available:false,test_balance:balance,display_environment:'test',display_balance:balance,perk_rewards_available:true}),
  rewardReply:()=>{reconciles++;balance=175;return{ok:true,json:async()=>({owner:'alice',environment:'test',credited:['perk.first_improvement']})};}});
 try{await settled();assert.equal(reconciles,1);assert.equal(f.nodes['wallet-balance'].textContent,'175');assert.equal(f.nodes['store-wallet-balance'].textContent,'175');
  const call=f.calls.find(c=>c.url.endsWith('/wallet/reconcile'));assert.equal(call.options.body,'{}');assert.equal(call.options.headers['x-playfab-id'],'alice');
  assert.ok(f.all().filter(n=>n.dataset.forgePack).every(n=>n.disabled),'perk testers without checkout permission cannot pay');
 }finally{f.controller.stop();}
});

test('fixed-role catalog shows Scientist free and paid unlocks without legacy upgrade levels or checkout changes',async()=>{
 const data={...catalog,perk_upgrades:null,fixed_roles:{id:'multiplayer-fixed-roles',version:1,upgrade_levels:false,roles:
  ['scientist','captain','engineer','attendant','explorer'].map(id=>({id,price:id==='scientist'?0:750}))}};
 const f=fixture({catalogReply:()=>({ok:true,json:async()=>data}),shopReply:()=>({ok:true,json:async()=>({version:1,owner:'alice',currency:'FM',environment:'test',live_purchases_enabled:false,purchases_enabled:false,wallet:{balance:0,credits:0,spent:0,revision:0,generation:0},roles:data.fixed_roles.roles.map(role=>({...role,owned:role.id==='scientist'})),skins:{status:'preview',owned:[],equipped:{}}})})});
 try{await openCategory(f,'classes');const cards=productLabels(f,'class');
  assert.match(cards[0],/Scientist: Included/);assert.match(cards[1],/Captain: Unavailable/);
  assert.equal(cards.length,5);assert.equal(f.nodes['forge-pack-grid'].children.length,4);
  assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
 }finally{f.controller.stop();}
});

test('owned roles and wallet use one verified account snapshot; logout removes private badges',async()=>{
 const data={...catalog,perk_upgrades:null,fixed_roles:{id:'multiplayer-fixed-roles',version:1,upgrade_levels:false,roles:sharedShop().roles}};
 const f=fixture({catalogReply:()=>({ok:true,json:async()=>data}),shopReply:()=>({ok:true,json:async()=>sharedShop()}),testBalance:0});
 try{await openCategory(f,'classes');const text=productLabels(f,'class').join('|');assert.match(text,/Captain: Owned/);assert.match(text,/Explorer: Owned/);
  assert.equal(f.nodes['wallet-balance'].textContent,'1,800');assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
  f.controller.stop();assert.doesNotMatch(productLabels(f,'class').join('|'),/: Owned/);
 }finally{f.controller.stop();}
});
test('late ownership response cannot populate a different or stopped account',async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve;});
 const f=fixture({shopReply:()=>wait});await settled();f.setOwner('bob');f.controller.stop();
 finish({ok:true,json:async()=>sharedShop()});await settled();
 assert.equal(f.nodes['wallet-balance'].textContent,'—');assert.doesNotMatch(productLabels(f,'class').join('|'),/: Owned/);
});

test('first confirmed FM renders while profile, catalog and availability are still pending',async()=>{
 let profileDone,catalogDone,accessDone;
 const profileWait=new Promise(resolve=>{profileDone=resolve;}),catalogWait=new Promise(resolve=>{catalogDone=resolve;}),accessWait=new Promise(resolve=>{accessDone=resolve;});
 const f=fixture({initial:false,testBalance:450,profileReply:()=>profileWait,catalogReply:()=>catalogWait,availabilityReply:()=>accessWait});
 try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'450');assert.equal(f.nodes['store-wallet-balance'].textContent,'450');
  assert.equal(f.nodes['forge-pack-grid'].children.length,0);assert.equal(f.calls.some(call=>call.url.endsWith('/schools')),false);
  profileDone({ok:true,json:async()=>({owner:'alice',user_type:'regular',requires_profile_completion:false})});catalogDone({ok:true,json:async()=>catalog});
  accessDone({ok:true,json:async()=>({owner:'alice',access_model:'free_to_play',live_purchases_enabled:false,test_checkout_available:true,perk_rewards_available:false,requires_profile_completion:false})});
  await settled();assert.equal(f.nodes['forge-pack-grid'].children.length,4);assert.ok(f.all().filter(node=>node.dataset.forgePack).every(node=>!node.disabled));
  assert.match(f.nodes['forge-store-availability'].textContent,/balance is shared with StoneForge/);
 }finally{f.controller.stop();}
});

test('confirmed funds appear before a slow reward reconciliation without fabricated credit',async()=>{
 let done;const pending=new Promise(resolve=>{done=resolve;});let balance=155;
 const f=fixture({walletReply:()=>({owner:'alice',balance:0,test_balance:balance,perk_rewards_available:true}),rewardReply:()=>pending});
 try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'155');assert.ok(f.all().filter(node=>node.dataset.forgePack).every(node=>node.disabled));
  balance=175;done({ok:true,json:async()=>({owner:'alice',environment:'test'})});await settled();assert.equal(f.nodes['wallet-balance'].textContent,'175');
 }finally{f.controller.stop();}
});

test('legacy catalog still serves FM packs without advertising retired upgrade levels',async()=>{
 const f=fixture();try{await openCategory(f,'classes');
  const text=f.all().map(node=>node.textContent).join(' ');
  assert.doesNotMatch(text,/45 \/ 95|65 \/ 125|paid upgrades|Chroma/);
  assert.equal(f.nodes['forge-pack-grid'].children.length,4);
  assert.equal(productLabels(f,'class').length,5);
 }finally{f.controller.stop();}
});

test('all-account sandbox response enables Buy FM without an ownership or tester check in the browser',async()=>{
 for(const type of ['regular','student','teacher']){
  const f=fixture({type,walletReply:()=>({owner:'alice',environment:'live',balance:0,test_checkout_available:true,
   test_checkout_scope:'all_authenticated',checkout_unavailable_reason:null,test_wallet_available:true,test_balance:200,
   display_environment:'test',display_balance:200,perk_rewards_available:false})});
  try{await settled();f.controller.open();
   assert.ok(f.all().filter(n=>n.dataset.forgePack).every(n=>!n.disabled&&n.textContent==='Select package'));
   assert.match(f.nodes['forge-store-availability'].textContent,/balance is shared with StoneForge/);
   assert.doesNotMatch(f.nodes['forge-store-availability'].textContent,/Sandbox|test.only/i);
   assert.equal(f.nodes['wallet-balance'].textContent,'200');
   assert.equal(f.calls.some(c=>c.url.endsWith('/wallet/reconcile')),false);
   await f.all().find(n=>n.dataset.forgePack==='fm_handful').fire('click');
   await f.nodes['forge-confirm-continue'].fire('click');assert.equal(f.navigation.length,1);
  }finally{f.controller.stop();}
 }
});
test('in-modal retry recovers a failed wallet/catalog without creating a payment',async()=>{
 let offline=true;const f=fixture({eligible:true,testBalance:450,failWallet:()=>offline,failCatalog:()=>offline});
 try{await settled();f.controller.open();
  assert.equal(f.nodes['wallet-balance'].textContent,'Unavailable');assert.match(f.nodes['forge-store-availability'].textContent,/connection and retry/);
  offline=false;await f.nodes['forge-store-retry'].fire('click');await settled();
  assert.equal(f.nodes['wallet-balance'].textContent,'450');assert.equal(f.nodes['forge-pack-grid'].children.length,4);
  assert.ok(f.all().filter(n=>n.dataset.forgePack).every(n=>!n.disabled));
  assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);assert.equal(f.navigation.length,0);
  f.setOwner('bob');const count=f.calls.length;await f.nodes['forge-store-retry'].fire('click');assert.equal(f.calls.length,count);
 }finally{f.controller.stop();}
});
test('availability distinguishes session expiry, restricted access and disabled checkout',async()=>{
 for(const [failStatus,pattern] of [[401,/session expired.*Sign in/],[403,/access is restricted/]]){
  const f=fixture({failWallet:true,failStatus});try{await settled();assert.match(f.nodes['forge-store-availability'].textContent,pattern);
   assert.equal(f.nodes['wallet-balance'].textContent,'Unavailable');assert.ok(f.all().filter(n=>n.dataset.forgePack).every(n=>n.disabled));
  }finally{f.controller.stop();}
 }
 const f=fixture({walletReply:()=>({owner:'alice',environment:'live',balance:0,test_checkout_available:false,checkout_unavailable_reason:'store_disabled'})});
 try{await settled();assert.match(f.nodes['forge-store-availability'].textContent,/temporarily unavailable/);}finally{f.controller.stop();}
});
test('in-flight refreshes coalesce and the next completed refresh reads the newer balance',async()=>{
 let reads=0,release;
 const f=fixture({walletReply:()=>{
  const data={owner:'alice',environment:'live',balance:0,test_checkout_available:true,test_balance:++reads===1?200:450};
  if(reads===2)return new Promise(resolve=>{release=()=>resolve({...data,test_balance:200});});
  return data;
 }});
 try{await settled();f.controller.open();const slow=f.controller.refresh();await settled();
  assert.equal(f.nodes['forge-store-retry'].disabled,true);assert.ok(f.all().filter(n=>n.dataset.forgePack).every(n=>n.disabled));
  assert.match(f.nodes['forge-store-availability'].textContent,/Loading your balance/);
  const joined=f.controller.refresh();assert.equal(joined,slow);assert.equal(reads,2);
  release();await Promise.all([slow,joined]);assert.equal(f.nodes['wallet-balance'].textContent,'200');
  await f.controller.refresh();assert.equal(f.nodes['wallet-balance'].textContent,'450');assert.equal(reads,3);assert.equal(f.nodes['forge-store-retry'].disabled,false);
 }finally{if(release)release();f.controller.stop();}
});
test('reward outage never fabricates money; wallet mode mismatch fails closed',async()=>{
 const f=fixture({walletReply:()=>({owner:'alice',environment:'live',balance:0,test_wallet_available:true,test_balance:155,display_environment:'test',display_balance:155,perk_rewards_available:true}),
  rewardReply:()=>({ok:false,json:async()=>({error:'unavailable'})})});
 try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'155');assert.match(f.nodes['wallet-state'].textContent,/sync is pending/);}finally{f.controller.stop();}
 const bad=fixture({canonicalReply:()=>({version:2,owner:'alice',currency:'FM',environment:'live',balance:155,live_purchases_enabled:false,rewards_active:false})});
 try{await settled();assert.equal(bad.nodes['wallet-balance'].textContent,'Unavailable');}finally{bad.controller.stop();}
});
test('canonical funds ignore historical balance fields and reads carry the expected account',async()=>{
 const f=fixture({walletReply:()=>({owner:'alice',environment:'live',balance:99999,test_balance:88888,test_checkout_available:true}),
  canonicalReply:()=>({version:2,owner:'alice',currency:'FM',environment:'test',balance:175,live_purchases_enabled:false,rewards_active:false})});
 try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'175');assert.equal(f.nodes['store-wallet-balance'].textContent,'175');
  const call=f.calls.find(call=>call.url.endsWith('/wallet/current'));assert.equal(call.options.headers['x-playfab-id'],'alice');assert.equal(call.options.credentials,'include');
 }finally{f.controller.stop();}
});

test('unavailable or malformed Store permissions retain canonical funds and prevent checkout',async()=>{
 for(const availabilityReply of [()=>({ok:false,status:503,json:async()=>({error:'down'})}),
  ()=>({ok:true,json:async()=>({owner:'bob',access_model:'free_to_play',test_checkout_available:true})}),
  ()=>({ok:true,json:async()=>({owner:'alice',access_model:'free_to_play',test_checkout_available:'true'})})]){
  const f=fixture({testBalance:200,eligible:true,availabilityReply});
  try{await settled();f.controller.open();assert.equal(f.nodes['wallet-balance'].textContent,'200');assert.match(f.nodes['wallet-state'].textContent,/Store availability is unavailable/);
   assert.ok(f.all().filter(node=>node.dataset.forgePack).every(node=>node.disabled));assert.equal(f.calls.some(call=>call.url.endsWith('/store/checkout')),false);
  }finally{f.controller.stop();}
 }
});

test('server profile requirement prevents checkout despite a stale complete local profile',async()=>{
 const f=fixture({testBalance:100,availabilityReply:()=>({ok:true,json:async()=>({owner:'alice',access_model:'free_to_play',live_purchases_enabled:false,
  test_checkout_available:true,perk_rewards_available:false,requires_profile_completion:true,checkout_unavailable_reason:'profile_required'})})});
 try{await settled();f.controller.open();assert.match(f.nodes['forge-store-availability'].textContent,/Complete your profile/);
  assert.ok(f.all().filter(node=>node.dataset.forgePack).every(node=>node.disabled));assert.equal(f.nodes['wallet-balance'].textContent,'100');
 }finally{f.controller.stop();}
});

test('account changes discard pending canonical reads and stop clears funds without logout',async()=>{
 let release;const f=fixture({canonicalReply:()=>new Promise(resolve=>{release=()=>resolve({version:2,owner:'alice',currency:'FM',environment:'test',balance:100,live_purchases_enabled:false,rewards_active:false});})});
 await settled();f.setOwner('bob');release();await settled();assert.notEqual(f.nodes['wallet-balance'].textContent,'100');
 f.nodes['profile-save'].disabled=true;f.controller.stop();assert.equal(f.nodes['profile-save'].disabled,false);
 assert.equal(f.nodes['wallet-balance'].textContent,'—');assert.equal(f.calls.some(call=>call.url.endsWith('/logout')),false);
});

test('profile removes the historical purchase gate and loads the canonical wallet contract',()=>{
 const source=fs.readFileSync('dashboard.js','utf8'),html=fs.readFileSync('dashboard.html','utf8');
 assert.doesNotMatch(source,/check-ownership|owns_game|Full Game Owner|renderOwnerBadge/);assert.doesNotMatch(html,/id="owner-badge-container"/);
 assert.ok(html.indexOf('src="wallet-client.js?')>=0&&html.indexOf('src="wallet-client.js?')<html.indexOf('src="profile-store.js?'));
 assert.match(fs.readFileSync('index.html','utf8'),/Free to Play/);assert.match(fs.readFileSync('admin.html','utf8'),/Historical Sandbox Game Orders/);
});

test('existing untyped user gets a non-dismissible completion prompt; save preserves identity header',async()=>{
 const f=fixture({type:null});try{
  await settled();assert.equal(f.nodes['profile-completion-dialog'].open,true);assert.equal(f.nodes['profile-cancel'].hidden,true);
  const event={prevented:false,preventDefault(){this.prevented=true;}};await f.nodes['profile-completion-dialog'].fire('cancel',event);assert.equal(event.prevented,true);
  f.nodes['profile-user-type'].value='student';await f.nodes['profile-completion-form'].fire('submit');await settled();
  assert.equal(f.calls.filter(call=>call.options.method==='PUT').length,1); // Existing school retained in prompt.
  assert.equal(f.nodes['profile-completion-dialog'].open,false);
  const put=f.calls.find(call=>call.options.method==='PUT');assert.equal(put.options.headers['x-playfab-id'],'alice');
  assert.deepEqual(JSON.parse(put.options.body),{user_type:'student',school:'Existing School'});
 }finally{f.controller.stop();}
});
test('Store uses four imported images, fixed prices and disabled preview actions; no browser credits',async()=>{
 const f=fixture();try{
  await settled();assert.equal(f.nodes['forge-pack-grid'].children.length,4);assert.equal(f.nodes['wallet-balance'].textContent,'0');
  const buttons=f.all().filter(node=>node.dataset.forgePack);assert.equal(buttons.length,4);assert.ok(buttons.every(button=>button.disabled));
  await buttons[0].fire('click');assert.equal(f.calls.some(call=>call.url.endsWith('/store/checkout')),false);
  const images=f.all().filter(node=>node.tag==='img');assert.equal(images.length,4);assert.ok(images.every(node=>node.src.startsWith('Assets/store/web/fm-')&&node.src.endsWith('.webp')));
 }finally{f.controller.stop();}
});
test('wallet outage or wrong server owner never displays a fabricated zero balance',async()=>{
 for(const options of [{failWallet:true},{wrongOwner:true},{eligible:true,testBalance:null},{eligible:true,testBalance:-1}]){
  const f=fixture(options);try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'Unavailable');assert.match(f.nodes['wallet-state'].textContent,/not been reset/);
   assert.equal(f.nodes['wallet-test-row'].hidden,true);assert.equal(f.nodes['wallet-test-balance'].textContent,'');}
  finally{f.controller.stop();}
 }
});
test('test checkout requires package review, guards double clicks and sends only package/request key',async()=>{
 const f=fixture({eligible:true});try{
  await settled();const button=f.all().find(node=>node.dataset.forgePack==='fm_handful');
  f.controller.open();await button.fire('click');
  assert.equal(f.nodes['forge-confirmation'].hidden,false);assert.equal(f.nodes['forge-store-browse'].hidden,true);
  assert.match(f.nodes['forge-confirm-pack'].textContent,/200 FM/);assert.match(f.nodes['forge-confirm-price'].textContent,/49\.00/);
  assert.equal(f.calls.some(call=>call.url.endsWith('/store/checkout')),false);
  await Promise.all([f.nodes['forge-confirm-continue'].fire('click'),f.nodes['forge-confirm-continue'].fire('click')]);await settled();
  const calls=f.calls.filter(call=>call.url.endsWith('/store/checkout'));assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(),['package_id','request_key']);
  assert.equal(f.navigation.length,1);assert.match(f.navigation[0],/^https:\/\/checkout.paymongo.com\//);
 }finally{f.controller.stop();}
});

test('Store is initially closed; Open Store uses native modal, locks page and restores focus on close/Escape',async()=>{
 const f=fixture();try{
  await settled();assert.equal(f.nodes['forge-store'].open,false);
  assert.equal(f.nodes['store-wallet-balance'].textContent,'0');
  await f.nodes['open-forge-store'].fire('click');
  assert.equal(f.nodes['forge-store'].open,true);assert.equal(f.document.documentElement.classList.contains('forge-store-open'),true);
  assert.equal(f.nodes['open-forge-store'].attributes['aria-expanded'],'true');assert.equal(f.document.activeElement,f.nodes['forge-store-close']);
  await f.nodes['forge-store-close'].fire('click');
  assert.equal(f.nodes['forge-store'].open,false);assert.equal(f.document.documentElement.classList.contains('forge-store-open'),false);
  assert.equal(f.document.activeElement,f.nodes['open-forge-store']);
  f.controller.open();const event={};await f.nodes['forge-store'].fire('cancel',event);
  assert.equal(event.prevented,true);assert.equal(f.nodes['forge-store'].open,false);
  f.controller.open();await f.nodes['forge-store'].fire('close');
  assert.equal(f.nodes['forge-store'].open,true);assert.equal(f.document.documentElement.classList.contains('forge-store-open'),true);
  assert.equal(f.calls.some(call=>call.url.endsWith('/store/checkout')),false);
 }finally{f.controller.stop();}
});

test('backdrop only closes after an outside press; inner content and drag-out clicks stay open',async()=>{
 const f=fixture();try{
  await settled();f.controller.open();const dialog=f.nodes['forge-store'];
  await dialog.fire('pointerdown',{clientX:50,clientY:50});await dialog.fire('click',{clientX:50,clientY:50});assert.equal(dialog.open,true);
  await dialog.fire('pointerdown',{clientX:50,clientY:50});await dialog.fire('click',{clientX:150,clientY:150});assert.equal(dialog.open,true);
  await dialog.fire('pointerdown',{clientX:150,clientY:150});await dialog.fire('click',{clientX:150,clientY:150});assert.equal(dialog.open,false);
 }finally{f.controller.stop();}
});

test('Tab and Shift+Tab wrap between visible enabled Store controls, including preview-only mode',async()=>{
 for(const eligible of [false,true]){
  const f=fixture({eligible});try{
   await settled();f.controller.open();f.nodes['forge-store-retry'].focus();const last=f.summary;
   const backwards={key:'Tab',shiftKey:true};await f.nodes['forge-store'].fire('keydown',backwards);
   assert.equal(backwards.prevented,true);assert.equal(f.document.activeElement,last);
   const forwards={key:'Tab',shiftKey:false};await f.nodes['forge-store'].fire('keydown',forwards);
   assert.equal(forwards.prevented,true);assert.equal(f.document.activeElement,f.nodes['forge-store-retry']);
  }finally{f.controller.stop();}
 }
});

test('shop intent waits for required profile completion, never stacks the Store over it',async()=>{
 const f=fixture({type:null});try{
  f.controller.open();await settled();assert.equal(f.nodes['profile-completion-dialog'].open,true);assert.equal(f.nodes['forge-store'].open,false);
  f.nodes['profile-user-type'].value='regular';await f.nodes['profile-completion-form'].fire('submit');await settled();
  assert.equal(f.nodes['profile-completion-dialog'].open,false);assert.equal(f.nodes['forge-store'].open,true);
  await f.nodes['profile-edit'].fire('click');assert.equal(f.nodes['forge-store'].open,false);assert.equal(f.nodes['profile-completion-dialog'].open,true);
 }finally{f.controller.stop();}
});

test('back/reopen cancels package selection without creating an order; test wallet stays clearly separate',async()=>{
 const f=fixture({eligible:true,testBalance:450});try{
  await settled();f.controller.open();const button=f.all().find(node=>node.dataset.forgePack==='fm_pouch');await button.fire('click');
  assert.equal(f.nodes['store-wallet-balance'].textContent,'450');assert.equal(f.nodes['wallet-balance'].textContent,'450');
  assert.equal(f.nodes['store-test-row'].hidden,true);assert.equal(f.nodes['forge-store-mode'].textContent,'Available');
  await f.nodes['forge-confirm-back'].fire('click');assert.equal(f.nodes['forge-confirmation'].hidden,true);assert.equal(f.document.activeElement,button);
  await button.fire('click');await f.nodes['forge-store-close'].fire('click');f.controller.open();
  assert.equal(f.nodes['forge-confirmation'].hidden,true);assert.equal(f.nodes['forge-confirm-continue'].disabled,true);
  assert.equal(f.calls.some(call=>call.url.endsWith('/store/checkout')),false);
 }finally{f.controller.stop();}
});

test('closing during checkout preparation ignores its late redirect; stop unlocks page and blocks reopen',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});
 const f=fixture({eligible:true,checkoutReply:()=>pending});try{
  await settled();f.controller.open();await f.all().find(node=>node.dataset.forgePack==='fm_handful').fire('click');
  const submit=f.nodes['forge-confirm-continue'].fire('click');await settled();
  assert.equal(f.nodes['forge-confirm-back'].disabled,true);await f.nodes['forge-confirm-back'].fire('click');assert.equal(f.nodes['forge-confirmation'].hidden,false);
  await f.nodes['forge-store-close'].fire('click');
  release({ok:true,json:async()=>({environment:'test',checkout_url:'https://checkout.paymongo.com/cs_fixture'})});await submit;
  assert.equal(f.navigation.length,0);assert.equal(f.calls.filter(call=>call.url.endsWith('/store/checkout')).length,1);
  f.controller.open();f.controller.stop();assert.equal(f.nodes['forge-store'].open,false);
  assert.equal(f.document.documentElement.classList.contains('forge-store-open'),false);assert.equal(f.nodes['store-wallet-balance'].textContent,'—');
  assert.equal(f.controller.open(),false);
 }finally{f.controller.stop();}
});

test('wallet error is mirrored as Unavailable and a different owner cannot open the Store',async()=>{
 const f=fixture({failWallet:true});try{
  await settled();assert.equal(f.nodes['store-wallet-balance'].textContent,'Unavailable');assert.equal(f.nodes['store-test-row'].hidden,true);
  f.setOwner('bob');assert.equal(f.controller.open(),false);assert.equal(f.nodes['forge-store'].open,false);
 }finally{f.controller.stop();}
});

test('Store markup is a labelled native dialog outside profile cards with responsive own scrolling',()=>{
 const html=fs.readFileSync('dashboard.html','utf8'),css=fs.readFileSync('profile-store.css','utf8');
 assert.match(html,/<dialog id="forge-store"[^>]*aria-labelledby="forge-store-heading"[^>]*aria-describedby="forge-store-description"/);
 assert.ok(html.indexOf('<dialog id="forge-store"')>html.indexOf('id="achievements-card"'));
 assert.match(html,/id="open-forge-store"[^>]*aria-haspopup="dialog"/);assert.match(html,/id="forge-store-close"[^>]*aria-label="Close Forge Store"/);
 assert.match(css,/\.forge-dialog__body\s*\{[^}]*overflow-y:auto/);assert.match(css,/\.forge-dialog\[open\]/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.forge-dialog\s*\{[^}]*height:100dvh/);
});

test('actual dashboard shop/payment return opens Store UI without fulfillment or scrolling, report intent takes precedence',()=>{
 const vm=require('node:vm'),source=fs.readFileSync('dashboard.js','utf8').replace(/\r\n/g,'\n');
 const block=source.slice(source.indexOf('    // Auto-open modals from game intent'),source.indexOf('\n}\n\nfunction suspendDashboard'));
 for(const query of ['?shop=true','?shop=true&payment=test','?shop=true&payment=cancelled','?shop=true&report=true']){
  const actions=[],hash='#forge-handoff=example',location=new URL('https://site.example/profile'+query+hash);
  vm.runInNewContext(block,{URL,URLSearchParams,window:{location,history:{replaceState(_state,_title,url){actions.push('history');
   assert.equal(url.pathname,'/profile');assert.equal(url.hash,hash);
   assert.equal(url.searchParams.get('payment'),location.searchParams.get('payment'));
   assert.equal(url.searchParams.has(query.includes('report=true')?'report':'shop'),false);
  }}},
   sessionStorage:{getItem:()=>null,removeItem(){}},storeBrowser:{open(){actions.push('store');}},openReportModal(){actions.push('report');}});
  assert.deepEqual(actions,['history',query.includes('report=true')?'report':'store']);
 }
});
test('signup and dashboard load modules in order, preserve sandbox disclosure and do not collect student IDs',()=>{
 const signup=fs.readFileSync('signup-page.html','utf8'),dash=fs.readFileSync('dashboard.html','utf8'),auth=fs.readFileSync('auth.js','utf8');
 assert.match(signup,/id="user-type"[^>]*required/);assert.match(signup,/<option value="" selected disabled>/);
 assert.ok(signup.indexOf('src="profile-fields.js"')<signup.indexOf('src="auth.js?'));
 assert.ok(dash.indexOf('src="profile-store.js')>=0&&dash.indexOf('src="profile-store.js')<dash.indexOf('src="dashboard.js?'));
 assert.match(auth,/apiPost\('send-otp', \{ username, email, password, \.\.\.fields \}\)/);
 assert.match(dash,/Loading your balance/);assert.match(dash,/id="forge-store-retry"/);
 assert.match(dash,/No real payment will be collected/);assert.doesNotMatch(signup,/Coyns|LRN|student-number|student_id/i);
 assert.doesNotMatch(fs.readFileSync('profile-store.js','utf8'),/balance\s*\+=|wallet\/credit|discount/i);
});

test('actual signup handler refuses missing User Type/student school before OTP request',async()=>{
 const vm=require('node:vm');
 const names=['signup-form','password','confirm-password','username','email','user-type','signup-school','signup-school-group','signup-school-label','submit-btn',
  'signup-school-options','signup-school-status','signup-school-toggle','signup-school-retry'];
 const nodes=Object.fromEntries(names.map(id=>{const node=new Node();node.id=id;return[id,node];}));
 nodes.password.value=nodes['confirm-password'].value='pass123';nodes.username.value='testuser';nodes.email.value='test@example.test';
 nodes['confirm-password'].setCustomValidity=()=>{};
 const calls=[],errors=[];
 const document={getElementById:id=>nodes[id]||null,createElement:tag=>new Node(tag),addEventListener(){}};
 const context={document,StoneForgeProfile:fields,StoneForgeSchools:{...global.StoneForgeSchools,mount:options=>global.StoneForgeSchools.mount({...options,fetch:async()=>({ok:true,json:async()=>schoolCatalog})})},API_BASE:'https://api.example/api',setLoading(){},hideError(){},showError:message=>errors.push(message),
  apiPost:async(endpoint,body)=>{calls.push({endpoint,body});return{ok:true,data:{success:true}};},setTimeout(){},saveUserAndRedirect(){}};
 vm.createContext(context);const source=fs.readFileSync('auth.js','utf8');
 vm.runInContext(source.slice(source.indexOf('const signupForm_auth =')),context);
 await nodes['signup-form'].fire('submit');assert.equal(calls.length,0);assert.match(errors.pop(),/User Type/);
 nodes['user-type'].value='student';await nodes['user-type'].fire('change');
 await nodes['signup-form'].fire('submit');assert.equal(calls.length,0);assert.match(errors.pop(),/school/);
 await settled();nodes['signup-school'].value='NCST';await nodes['signup-school'].fire('input');
 await nodes['signup-school-options'].children[0].fire('click');await nodes['signup-form'].fire('submit');
 assert.equal(calls.length,1);assert.equal(calls[0].endpoint,'send-otp');assert.equal(calls[0].body.user_type,'student');
 assert.equal(calls[0].body.school,'National College of Science and Technology');assert.equal(calls[0].body.school_id,'ncst-dasmarinas');
});
const handoffId='11111111-2222-4333-8444-555555555555';
const gameHandoff=(extra={})=>({version:1,owner:'alice',environment:'test',live_purchases_enabled:false,handoff_id:handoffId,package_id:'fm_pouch',medals:450,price_centavos:9900,status:'review',credited:false,checkout_url:null,request_key:'native_game_request_key_123',...extra});
test('game handoff preselects exact package after verified loading, no checkout until explicit Confirm',async()=>{
 const f=fixture({eligible:true,hash:'#forge-handoff='+handoffId,handoffReply:()=>({ok:true,json:async()=>gameHandoff()})});
 try{await settled();assert(f.nodes['forge-store'].open);assert.equal(f.nodes['forge-confirmation'].hidden,false);assert.match(f.nodes['forge-confirm-pack'].textContent,/450 FM/);
  assert.equal(f.calls.filter(c=>c.url.endsWith('/store/checkout')).length,0);assert.equal(f.nodes['forge-confirm-continue'].disabled,false);
  await f.nodes['forge-confirm-continue'].fire('click');const call=f.calls.find(c=>c.url.endsWith('/store/checkout'));
  assert.deepEqual(JSON.parse(call.options.body),{package_id:'fm_pouch',request_key:'native_game_request_key_123',handoff_id:handoffId});assert.equal(call.options.headers['x-playfab-id'],'alice');
  assert.deepEqual(f.navigation,['https://checkout.paymongo.com/cs_fixture']);
 }finally{f.controller.stop();}
});
test('wrong account, malformed game response and catalog mismatch never create checkout',async()=>{
 for(const response of [{ok:false,status:404,json:async()=>({error:'Different game account'})},{ok:true,json:async()=>gameHandoff({owner:'bob'})},{ok:true,json:async()=>gameHandoff({price_centavos:1})}]){
  const f=fixture({eligible:true,hash:'#forge-handoff='+handoffId,handoffReply:()=>response});try{await settled();assert.equal(f.nodes['forge-confirm-continue'].disabled,true);
   await f.nodes['forge-confirm-continue'].fire('click');assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
  }finally{f.controller.stop();}
 }
});
test('pending game payment reuses original request; completed/processing returns cannot invent FM',async()=>{
 for(const status of ['pending','completed','processing']){
  const f=fixture({eligible:true,testBalance:450,hash:'#forge-handoff='+handoffId,handoffReply:()=>({ok:true,json:async()=>gameHandoff({status,credited:status==='completed',checkout_url:status==='pending'?'https://checkout.paymongo.com/cs_old':null})})});
  try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'450');assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
   assert.equal(f.nodes['forge-confirm-continue'].disabled,status!=='pending');await f.nodes['forge-confirm-continue'].fire('click');
   if(status==='pending')assert.equal(JSON.parse(f.calls.find(c=>c.url.endsWith('/store/checkout')).options.body).request_key,'native_game_request_key_123');
   else assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
  }finally{f.controller.stop();}
 }
});
test('late handoff cannot populate stopped or switched account',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});const f=fixture({eligible:true,hash:'#forge-handoff='+handoffId,handoffReply:()=>pending});await settled();f.setOwner('bob');f.controller.stop();finish({ok:true,json:async()=>gameHandoff()});await settled();
 assert.equal(f.nodes['forge-store'].open,false);assert.equal(f.nodes['forge-confirm-pack'].textContent,'');assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
});
test('completed game checkout can explicitly return to normal browsing without another automatic payment',async()=>{
 const f=fixture({eligible:true,hash:'#forge-handoff='+handoffId,handoffReply:()=>({ok:true,json:async()=>gameHandoff({status:'completed',credited:true})})});
 try{await settled();assert.equal(f.nodes['forge-confirm-continue'].disabled,true);await f.nodes['forge-confirm-back'].fire('click');
  assert(f.all().filter(n=>n.dataset.forgePack).every(n=>!n.disabled));assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);
 }finally{f.controller.stop();}
});
test('website repeat top-up renews only completed/expired key and resumes pending key',async()=>{
 for(const status of ['completed','expired','pending','processing']){
  const old='old_website_request_123',f=fixture({eligible:true,handoffReply:url=>{const q=new URL(url).searchParams;return{ok:true,json:async()=>gameHandoff({handoff_id:null,package_id:'fm_handful',medals:200,price_centavos:4900,request_key:q.get('request_key'),status,credited:status==='completed',checkout_url:null})};}});
  try{await settled();global.sessionStorage.setItem('sf_forge_test_alice_fm_handful',old);f.controller.open();const button=f.all().find(n=>n.dataset.forgePack==='fm_handful');await button.fire('click');await f.nodes['forge-confirm-continue'].fire('click');
   const sent=f.calls.find(c=>c.url.endsWith('/store/checkout'));if(status==='processing')assert.equal(sent,undefined);else{assert(sent);assert.equal(JSON.parse(sent.options.body).request_key===old,status==='pending');}
  }finally{f.controller.stop();}
 }
});

const skinSnapshot=(owner='alice',owned=false)=>({version:1,catalog_id:'stoneforge-tool-skins',catalog_version:1,owner,currency:'FM',environment:'test',live_purchases_enabled:false,balance:1800,revision:0,wallet_generation:0,equip_revision:owned?1:0,can_purchase:false,requires_profile_completion:false,
 skins:['stone_axe','iron_axe','iron_pickaxe','wooden_shovel','stone_spear','chisel','hoe','torch','wooden_fire_starter','small_resin_bucket'].map(tool=>({id:tool+'.basic',tool_id:tool,price:300,asset_revision:1,available:false})),owned:owned?['stone_axe.basic']:[],equipped:owned?[{toolId:'stone_axe',skinId:'stone_axe.basic'}]:[]});
const skinRolesCatalog={...catalog,perk_upgrades:null,fixed_roles:{id:'multiplayer-fixed-roles',version:1,upgrade_levels:false,roles:['scientist','captain','engineer','attendant','explorer'].map(id=>({id,price:id==='scientist'?0:750}))}};
test('available unowned skins display the verified server price and owned skins keep their status',async()=>{
 const snapshot=skinSnapshot('alice',true);
 snapshot.skins.find(row=>row.tool_id==='iron_axe').available=true;
 snapshot.skins.find(row=>row.tool_id==='iron_axe').price=1500;
 const f=fixture({catalogReply:()=>({ok:true,json:async()=>skinRolesCatalog}),skinReply:()=>({ok:true,json:async()=>snapshot})});
 try{
  await openCategory(f,'skins');
  const labels=productLabels(f,'skin');
  assert(labels.includes('Iron Axe: 1,500 FM · Available in game'));
  assert(labels.includes('Stone Axe: Equipped'));
  assert(labels.includes('Torch: Preview Only'));
 }finally{f.controller.stop();}
});
test('website displays ten draft skin previews without checkout or fake ownership',async()=>{
 const f=fixture({catalogReply:()=>({ok:true,json:async()=>skinRolesCatalog}),skinReply:()=>({ok:true,json:async()=>skinSnapshot()})});try{await openCategory(f,'skins');const text=productLabels(f,'skin').join('|');assert.equal((text.match(/: Preview Only/g)||[]).length,10);assert.doesNotMatch(text,/: Owned|: Equipped/g);assert.equal(f.calls.some(c=>c.url.endsWith('/store/checkout')),false);}finally{f.controller.stop();}
});
test('skin Owned/Equipped is derived from the verified account and cleared on stop',async()=>{
 const f=fixture({catalogReply:()=>({ok:true,json:async()=>skinRolesCatalog}),skinReply:()=>({ok:true,json:async()=>skinSnapshot('alice',true)})});try{await openCategory(f,'skins');assert.match(productLabels(f,'skin').join('|'),/Stone Axe: Equipped/);f.controller.stop();assert.doesNotMatch(productLabels(f,'skin').join('|'),/: Equipped|: Owned/);}finally{f.controller.stop();}
});
test('foreign or late skin response cannot populate a different account',async()=>{
 const f=fixture({catalogReply:()=>({ok:true,json:async()=>skinRolesCatalog}),skinReply:()=>({ok:true,json:async()=>skinSnapshot('bob',true)})});try{await openCategory(f,'skins');assert.doesNotMatch(productLabels(f,'skin').join('|'),/: Equipped|: Owned/);}finally{f.controller.stop();}
 let finish;const waiting=new Promise(r=>finish=r),g=fixture({catalogReply:()=>({ok:true,json:async()=>skinRolesCatalog}),skinReply:()=>waiting});await settled();g.setOwner('bob');g.controller.stop();finish({ok:true,json:async()=>skinSnapshot('alice',true)});await settled();assert.doesNotMatch(productLabels(g,'skin').join('|'),/: Equipped|: Owned/);
});

test('Classes show included and owned items, review price, and accept a verified unlock once',async()=>{
 const state=sharedShop();state.class_purchases_available=true;state.roles.find(role=>role.id==='engineer').owned=false;
 const f=fixture({shopReply:()=>({ok:true,json:async()=>structuredClone(state)}),classReply:options=>{
  const request=JSON.parse(options.body);
  assert.equal(options.headers['x-playfab-id'],'alice');assert.equal(request.role,'engineer');assert.equal(request.wallet_generation,0);
  state.wallet.balance-=750;state.wallet.spent+=750;state.wallet.revision++;
  state.roles.find(role=>role.id==='engineer').owned=true;
  return {ok:true,json:async()=>({...state,request_key:request.request_key,receipt:{kind:'role_unlock',role:'engineer',cost:750}})};
 }});
 try{
  await settled();f.controller.open();await f.nodes['forge-classes-tab'].fire('click');await settled();
  const actions=()=>f.nodes['forge-class-grid'].children.map(card=>card.children.at(-1).children.at(-1));
  assert.deepEqual(actions().map(node=>node.textContent),['Included','Owned','Unlock · 750 FM','Owned','Owned']);
  await actions()[2].fire('click');
  assert.match(f.nodes['forge-class-review-art'].children[0].src,/engineer\.png$/);
  assert.match(f.nodes['forge-class-review-details'].textContent,/1,800 FM.*1,050 FM/);
  assert.equal(f.calls.filter(call=>call.url.endsWith('/classes/purchase')).length,0);
  await Promise.all([f.nodes['forge-class-confirm'].fire('click'),f.nodes['forge-class-confirm'].fire('click')]);await settled();
  assert.equal(f.calls.filter(call=>call.url.endsWith('/classes/purchase')).length,1);
  assert.equal(actions()[2].textContent,'Owned');assert.equal(f.nodes['wallet-balance'].textContent,'1,050');
 }finally{f.controller.stop();}
});
