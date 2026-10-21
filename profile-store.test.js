'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fields=require('./profile-fields');global.StoneForgeProfile=fields;
global.StoneForgeSchools=require('./school-selector');
const schoolCatalog=require('./test-fixtures/school-catalog.json');
const store=require('./profile-store');

test('Store uses catalog-driven prices and removes Chroma promotion',()=>{
 const html=fs.readFileSync('dashboard.html','utf8');
 assert.match(html,/id="forge-character-preview"/);
 assert.doesNotMatch(html,/Chroma skins|300 FM per chroma|Explorer is not available yet/);
 assert.match(fs.readFileSync('profile-store.js','utf8'),/catalog\?\.perk_upgrades/);
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
 'store-wallet-balance','store-test-row','store-test-balance','forge-store-mode','forge-store-availability','forge-store-browse',
 'forge-confirmation','forge-confirmation-heading','forge-confirm-pack','forge-confirm-price','forge-confirm-back','forge-confirm-continue','forge-perk-preview','forge-character-preview'];
const catalog={version:1,live_purchases_enabled:false,packs:[
 {id:'fm_handful',name:'Handful',medals:200,price_centavos:4900,image:'Assets/store/fm-handful.png'},
 {id:'fm_pouch',name:'Pouch',medals:450,price_centavos:9900,image:'Assets/store/fm-pouch.png'},
 {id:'fm_crate',name:'Crate',medals:1000,price_centavos:19900,image:'Assets/store/fm-crate.png'},
 {id:'fm_chest',name:'Chest',medals:2200,price_centavos:39900,image:'Assets/store/fm-chest.png'}],
 perk_upgrades:{id:'multiplayer-perks',version:2,explorer_available:true,explorer_unlock_cost:750,characters:[
 {id:'captain',costs:[45,95,155,230]},{id:'engineer',costs:[65,125,190,270]},
 {id:'attendant',costs:[30,70,120,180]},{id:'explorer',costs:[80,140,205,300]}]}};
async function settled(){for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture({type='regular',eligible=false,failWallet=false,wrongOwner=false,testBalance=0,checkoutReply,walletReply,rewardReply}={}){
 const nodes=Object.fromEntries(ids.map(id=>{const node=new Node();node.id=id;return[id,node];})),calls=[],navigation=[],storage=new Map();
 let accountOwner='alice';
 nodes['forge-confirmation'].hidden=true;
 const current={owner:'alice',user_type:type,school:type==='student'?'Cavite School':'Existing School',requires_profile_completion:!type};
 const all=()=>{const results=[];function walk(node){results.push(node);node.children.forEach(walk);}Object.values(nodes).forEach(walk);return results;};
 const document={hidden:false,documentElement:new Node('html'),getElementById:id=>nodes[id],createElement:tag=>{const node=new Node(tag);node.ownerDocument=document;return node;},querySelectorAll:()=>all().filter(node=>node.dataset.forgePack),
  addEventListener(){},removeEventListener(){}};
 Object.values(nodes).forEach(node=>{node.ownerDocument=document;});
 global.sessionStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 global.location={assign:value=>navigation.push(value)};
 const controller=store.mount({document,apiBase:'https://api.example/api',owner:'alice',currentOwner:()=>accountOwner,initialProfile:{...current},
  fetch:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/schools'))return{ok:true,json:async()=>schoolCatalog};
   if(url.endsWith('/profile')&&options.method==='PUT'){const body=JSON.parse(options.body);Object.assign(current,body,{requires_profile_completion:false});return{ok:true,json:async()=>({...current})};}
   if(url.endsWith('/profile'))return{ok:true,json:async()=>({...current})};
   if(url.endsWith('/store/catalog'))return{ok:true,json:async()=>catalog};
   if(url.endsWith('/store/checkout'))return checkoutReply?checkoutReply():{ok:true,json:async()=>({environment:'test',checkout_url:'https://checkout.paymongo.com/cs_fixture'})};
   if(url.endsWith('/wallet/reconcile')&&rewardReply)return rewardReply();
   if(url.endsWith('/wallet')&&walletReply)return{ok:true,json:async()=>walletReply()};
   return{ok:!failWallet,json:async()=>({owner:wrongOwner?'bob':'alice',balance:0,environment:'live',test_checkout_available:eligible,test_balance:testBalance})};
  }});
 return{nodes,calls,controller,navigation,all,document,setOwner(value){accountOwner=value;}};
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

test('catalog v2 renders all four perk price matrices and the real in-game Explorer unlock price',async()=>{
 const f=fixture();try{await settled();const text=f.all().map(n=>n.textContent).join(' ');
  for(const value of ['45 / 95 / 155 / 230','65 / 125 / 190 / 270','30 / 70 / 120 / 180','80 / 140 / 205 / 300','750 FM'])assert.ok(text.includes(value));
  assert.match(text,/Scientist has no paid upgrades/);assert.doesNotMatch(text,/Chroma|Coming soon|Explorer is not available/);
 }finally{f.controller.stop();}
});

test('reward outage never fabricates money; wallet mode mismatch fails closed',async()=>{
 const f=fixture({walletReply:()=>({owner:'alice',environment:'live',balance:0,test_wallet_available:true,test_balance:155,display_environment:'test',display_balance:155,perk_rewards_available:true}),
  rewardReply:()=>({ok:false,json:async()=>({error:'unavailable'})})});
 try{await settled();assert.equal(f.nodes['wallet-balance'].textContent,'155');assert.match(f.nodes['wallet-state'].textContent,/sync is pending/);}finally{f.controller.stop();}
 const bad=fixture({walletReply:()=>({owner:'alice',environment:'live',balance:0,test_wallet_available:true,test_balance:155,display_environment:'live',display_balance:0})});
 try{await settled();assert.equal(bad.nodes['wallet-balance'].textContent,'Unavailable');}finally{bad.controller.stop();}
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
  const images=f.all().filter(node=>node.tag==='img');assert.equal(images.length,4);assert.ok(images.every(node=>node.src.startsWith('Assets/store/fm-')));
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
   await settled();f.controller.open();const buttons=f.all().filter(node=>node.dataset.forgePack&&!node.disabled);
   const last=buttons.at(-1)||f.nodes['forge-store-close'];
   const backwards={key:'Tab',shiftKey:true};await f.nodes['forge-store'].fire('keydown',backwards);
   assert.equal(backwards.prevented,true);assert.equal(f.document.activeElement,last);
   const forwards={key:'Tab',shiftKey:false};await f.nodes['forge-store'].fire('keydown',forwards);
   assert.equal(forwards.prevented,true);assert.equal(f.document.activeElement,f.nodes['forge-store-close']);
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
  assert.equal(f.nodes['store-test-row'].hidden,true);assert.equal(f.nodes['forge-store-mode'].textContent,'Sandbox demo');
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
 const block=source.slice(source.indexOf('    // Auto-open modals from game intent'),source.lastIndexOf('\n}\n\ninitDashboard();'));
 for(const query of ['?shop=true','?shop=true&payment=test','?shop=true&payment=cancelled','?shop=true&report=true']){
  const actions=[];vm.runInNewContext(block,{URLSearchParams,window:{location:{search:query},history:{replaceState(){actions.push('history');}}},
   sessionStorage:{getItem:()=>null,removeItem(){}},storeBrowser:{open(){actions.push('store');}},openReportModal(){actions.push('report');}});
  assert.deepEqual(actions,['history',query.includes('report=true')?'report':'store']);
 }
});
test('signup and dashboard load modules in order, preserve preview and do not collect student IDs',()=>{
 const signup=fs.readFileSync('signup-page.html','utf8'),dash=fs.readFileSync('dashboard.html','utf8'),auth=fs.readFileSync('auth.js','utf8');
 assert.match(signup,/id="user-type"[^>]*required/);assert.match(signup,/<option value="" selected disabled>/);
 assert.ok(signup.indexOf('src="profile-fields.js"')<signup.indexOf('src="auth.js"'));
 assert.ok(dash.indexOf('src="profile-store.js"')<dash.indexOf('src="dashboard.js"'));
 assert.match(auth,/apiPost\('send-otp', \{ username, email, password, \.\.\.fields \}\)/);
 assert.match(dash,/Purchases are not open yet/);assert.doesNotMatch(signup,/Coyns|LRN|student-number|student_id/i);
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
