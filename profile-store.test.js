'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const fields=require('./profile-fields');global.StoneForgeProfile=fields;
const store=require('./profile-store');
test('frontend requires an explicit supported User Type and student school; no discount or privileges',()=>{
 for(const user_type of ['',null,'admin','instructor','toString'])assert.throws(()=>fields.validate({user_type}));
 assert.throws(()=>fields.validate({user_type:'student',school:''}));
 assert.deepEqual(fields.validate({user_type:'student',school:' Cavite   School '}),{user_type:'student',school:'Cavite School'});
 assert.deepEqual(fields.validate({user_type:'teacher',school:''}),{user_type:'teacher',school:''});
 assert.deepEqual(fields.validate({user_type:'regular',school:'old'}),{user_type:'regular'});
});
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.attributes={};
 this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 removeEventListener(name){delete this.listeners[name];}
 showModal(){this.open=true;}close(){this.open=false;}focus(){}scrollIntoView(){this.scrolled=true;}
 async fire(name,event={}){if(!event.preventDefault)event.preventDefault=function(){this.prevented=true;};return this.listeners[name]?.(event);}
}
test('conditional school field is required only for Student, and omitted for Regular User',()=>{
 const type=new Node(),group=new Node(),school=new Node(),label=new Node();fields.bind(type,group,school,label);
 assert.equal(group.hidden,true);type.value='student';type.listeners.change();assert.equal(school.required,true);assert.equal(group.hidden,false);
 type.value='teacher';type.listeners.change();assert.equal(school.required,false);
 type.value='regular';type.listeners.change();assert.equal(school.disabled,true);assert.equal(group.hidden,true);
});
const ids=['profile-signout','profile-completion-dialog','profile-completion-form','profile-user-type','profile-school','profile-school-group','profile-school-label',
 'profile-cancel','profile-required-note','profile-save-status','profile-save','profile-edit','profile-retry','profile-state-status',
 'user-type-value','profile-user-type-badge','school-value','school-display-row','forge-pack-grid','wallet-balance','wallet-state',
 'wallet-test-row','wallet-test-balance','store-state','wallet-refresh','open-forge-store','forge-store'];
const catalog={version:1,live_purchases_enabled:false,packs:[
 {id:'fm_handful',name:'Handful',medals:200,price_centavos:4900,image:'Assets/store/fm-handful.png'},
 {id:'fm_pouch',name:'Pouch',medals:450,price_centavos:9900,image:'Assets/store/fm-pouch.png'},
 {id:'fm_crate',name:'Crate',medals:1000,price_centavos:19900,image:'Assets/store/fm-crate.png'},
 {id:'fm_chest',name:'Chest',medals:2200,price_centavos:39900,image:'Assets/store/fm-chest.png'}]};
async function settled(){for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture({type='regular',eligible=false,failWallet=false,wrongOwner=false,testBalance=0}={}){
 const nodes=Object.fromEntries(ids.map(id=>[id,new Node()])),calls=[],navigation=[],storage=new Map();
 const current={owner:'alice',user_type:type,school:type==='student'?'Cavite School':'Existing School',requires_profile_completion:!type};
 const all=()=>{const results=[];function walk(node){results.push(node);node.children.forEach(walk);}Object.values(nodes).forEach(walk);return results;};
 const document={hidden:false,getElementById:id=>nodes[id],createElement:tag=>new Node(tag),querySelectorAll:()=>all().filter(node=>node.dataset.forgePack),
  addEventListener(){},removeEventListener(){}};
 global.sessionStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
 global.location={assign:value=>navigation.push(value)};
 const controller=store.mount({document,apiBase:'https://api.example/api',owner:'alice',currentOwner:()=> 'alice',initialProfile:{...current},
  fetch:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/profile')&&options.method==='PUT'){const body=JSON.parse(options.body);Object.assign(current,body,{requires_profile_completion:false});return{ok:true,json:async()=>({...current})};}
   if(url.endsWith('/profile'))return{ok:true,json:async()=>({...current})};
   if(url.endsWith('/store/catalog'))return{ok:true,json:async()=>catalog};
   if(url.endsWith('/store/checkout'))return{ok:true,json:async()=>({environment:'test',checkout_url:'https://checkout.paymongo.com/cs_fixture'})};
   return{ok:!failWallet,json:async()=>({owner:wrongOwner?'bob':'alice',balance:0,environment:'live',test_checkout_available:eligible,test_balance:testBalance})};
  }});
 return{nodes,calls,controller,navigation,all};
}
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
test('test checkout guards double clicks and sends only package/request key, not prices or balances',async()=>{
 const f=fixture({eligible:true});try{
  await settled();const button=f.all().find(node=>node.dataset.forgePack==='fm_handful');
  await Promise.all([button.fire('click'),button.fire('click')]);await settled();
  const calls=f.calls.filter(call=>call.url.endsWith('/store/checkout'));assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(),['package_id','request_key']);
  assert.equal(f.navigation.length,1);assert.match(f.navigation[0],/^https:\/\/checkout.paymongo.com\//);
 }finally{f.controller.stop();}
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
 const names=['signup-form','password','confirm-password','username','email','user-type','signup-school','signup-school-group','signup-school-label','submit-btn'];
 const nodes=Object.fromEntries(names.map(id=>[id,new Node()]));
 nodes.password.value=nodes['confirm-password'].value='pass123';nodes.username.value='testuser';nodes.email.value='test@example.test';
 nodes['confirm-password'].setCustomValidity=()=>{};
 const calls=[],errors=[];
 const document={getElementById:id=>nodes[id]||null,addEventListener(){}};
 const context={document,StoneForgeProfile:fields,setLoading(){},hideError(){},showError:message=>errors.push(message),
  apiPost:async(endpoint,body)=>{calls.push({endpoint,body});return{ok:true,data:{success:true}};},setTimeout(){},saveUserAndRedirect(){}};
 vm.createContext(context);const source=fs.readFileSync('auth.js','utf8');
 vm.runInContext(source.slice(source.indexOf('const signupForm_auth =')),context);
 await nodes['signup-form'].fire('submit');assert.equal(calls.length,0);assert.match(errors.pop(),/User Type/);
 nodes['user-type'].value='student';await nodes['signup-form'].fire('submit');assert.equal(calls.length,0);assert.match(errors.pop(),/school/);
 nodes['signup-school'].value='Cavite School';await nodes['signup-form'].fire('submit');
 assert.equal(calls.length,1);assert.equal(calls[0].endpoint,'send-otp');assert.equal(calls[0].body.user_type,'student');assert.equal(calls[0].body.school,'Cavite School');
});
