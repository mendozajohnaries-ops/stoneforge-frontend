'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const picker=require('./school-selector'),fields=require('./profile-fields');
const catalog=require('./test-fixtures/school-catalog.json');
class Node{
 constructor(tag='div'){this.tag=tag;this.id='';this.children=[];this.listeners=new Map();this.attributes={};this.value='';this.textContent='';this.disabled=false;this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this.attributes[key]=value;}
 removeAttribute(key){delete this.attributes[key];}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 fire(name,values={}){const event={prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};
  for(const fn of this.listeners.get(name)||[])fn(event);return event;}
 focus(){if(this.document)this.document.activeElement=this;this.fire('focus');}
 scrollIntoView(){}
}
async function settle(){for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));}
function fixture({response=catalog,fail=false,pending=false,eager=true}={}){
 const input=new Node('input');input.id='school';const type=new Node('select');type.value='student';
 const group=new Node(),label=new Node();
 const nodes=Object.fromEntries(['options','status','toggle','retry'].map(suffix=>{const node=new Node();node.id='school-'+suffix;return[node.id,node];}));
 const document={activeElement:null,getElementById:id=>nodes[id],createElement:tag=>new Node(tag)};input.document=document;
 fields.bind(type,group,input,label);let failNow=fail,resolvePending;const calls=[];
 const controller=picker.mount({document,input,type,apiBase:'https://api.example/api',eager,fetch:async(url,options)=>{
  calls.push({url,options});if(pending)await new Promise(resolve=>{resolvePending=resolve;});
  return{ok:!failNow,json:async()=>response};
 }});
 return{input,type,group,label,nodes,calls,document,controller,recover(){failNow=false;},resolve(){resolvePending?.();}};
}
test('lazy profile picker defers directory traffic until focus and avoids duplicate focus requests',async()=>{
 const f=fixture({eager:false,pending:true});try{
  await settle();assert.equal(f.calls.length,0);f.input.focus();f.input.focus();f.nodes['school-toggle'].fire('click');assert.equal(f.calls.length,1);f.resolve();await settle();
  assert.equal(f.calls[0].options.credentials,'omit');
 }finally{f.controller.stop();}
});

test('catalog rejects malformed/duplicate/unsupported records instead of inventing choices',()=>{
 assert.equal(picker.validateCatalog(catalog).length,3);
 for(const value of [null,{}, {...catalog,version:2},{...catalog,schools:[]},
  {...catalog,schools:[catalog.schools[0],catalog.schools[0]]},
  {...catalog,schools:[{...catalog.schools[0],sector:'Unknown'}]}])assert.throws(()=>picker.validateCatalog(value));
});
test('search matches acronyms, accents, city and campus without merging same-name campuses',()=>{
 assert.equal(picker.search(catalog.schools,'ncst')[0].id,'ncst-dasmarinas');
 assert.equal(picker.search(catalog.schools,'dasmarinas')[0].city,'Dasmariñas');
 assert.deepEqual(picker.search(catalog.schools,'sample').map(s=>s.id),['sample-west','sample-east']);
 assert.equal(picker.search(catalog.schools,'sample imus private')[0].id,'sample-east');
 assert.equal(picker.search(catalog.schools,'not in list').length,0);
});
test('arrow keys and Enter select an explicit campus; canonical ID is retained',async()=>{
 const f=fixture();try{await settle();f.input.value='sample';f.input.fire('input');
  assert.equal(f.nodes['school-options'].children.length,2);assert.equal(f.input.attributes['aria-expanded'],'true');
  assert.equal(f.input.fire('keydown',{key:'ArrowDown'}).prevented,true);
  assert.equal(f.input.attributes['aria-activedescendant'],'school-option-0');
  f.input.fire('keydown',{key:'ArrowDown'});f.input.fire('keydown',{key:'Enter'});
  assert.deepEqual(f.controller.values(),{school:'Sample Academy',school_id:'sample-east'});
  assert.equal(f.nodes['school-options'].hidden,true);assert.match(f.nodes['school-status'].textContent,/East.*Imus/);
 }finally{f.controller.stop();}
});
test('mouse choice uses text-only rendering and editing its label clears the school ID',async()=>{
 const injected=structuredClone(catalog);injected.schools[0].name='<img src=x onerror=alert(1)>';
 const f=fixture({response:injected});try{await settle();f.input.value='NCST';f.input.fire('input');
  const option=f.nodes['school-options'].children[0];
  assert.equal(option.children[0].textContent,injected.schools[0].name);assert.equal(option.children[0].children.length,0);
  option.fire('click');assert.equal(f.controller.values().school_id,'ncst-dasmarinas');
  f.input.value+=' changed';f.input.fire('input');assert.equal(f.controller.values().school_id,null);
  assert.throws(()=>fields.validate({user_type:'student',...f.controller.values()}));
 }finally{f.controller.stop();}
});
test('legacy school stays unchanged without a guessed campus; arbitrary replacement is rejected',async()=>{
 const f=fixture();try{await settle();f.controller.reset({school:'NCST',school_id:null,school_selection:'saved_text'});
  assert.match(f.nodes['school-status'].textContent,/saved school is preserved/);
  assert.deepEqual(fields.validate({user_type:'student',...f.controller.values()},{previous:{school:'NCST',school_selection:'saved_text'}}),
   {user_type:'student',school:'NCST'});
  f.input.value='Another arbitrary school';f.input.fire('input');
  assert.throws(()=>fields.validate({user_type:'student',...f.controller.values()},{previous:{school:'NCST'}}));
 }finally{f.controller.stop();}
});
test('Teacher text remains optional and Regular hides school without changing saved identity',async()=>{
 const f=fixture();try{await settle();f.type.value='teacher';f.type.fire('change');assert.equal(f.input.required,false);
  f.input.value='Independent Institution';f.input.fire('input');
  assert.deepEqual(fields.validate({user_type:'teacher',...f.controller.values()}),
   {user_type:'teacher',school:'Independent Institution',school_id:null});
  assert.throws(()=>fields.validate({user_type:'student',school:'Independent Institution'},{previous:{school:'Independent Institution',school_selection:'institution_text'}}));
  f.type.value='regular';f.type.fire('change');assert.equal(f.group.hidden,true);assert.equal(f.input.disabled,true);assert.equal(f.nodes['school-toggle'].disabled,true);
  assert.deepEqual(fields.validate({user_type:'regular',...f.controller.values()}),{user_type:'regular'});
 }finally{f.controller.stop();}
});
test('directory failure exposes retry, preserves old text, and never supplies fake fallback choices',async()=>{
 const f=fixture({fail:true});try{f.controller.reset({school:'Existing School'});await settle();
  assert.equal(f.nodes['school-retry'].hidden,false);assert.match(f.nodes['school-status'].textContent,/unavailable/);
  assert.equal(f.controller.values().school,'Existing School');assert.equal(f.nodes['school-options'].children.length,0);
  assert.equal(f.calls[0].options.credentials,'omit');assert.equal(f.calls[0].url,'https://api.example/api/schools');
  f.recover();await f.controller.refresh();assert.equal(f.nodes['school-retry'].hidden,true);
  f.input.value='NCST';f.input.fire('input');assert.equal(f.nodes['school-options'].children.length,1);
 }finally{f.controller.stop();}
});
test('typing while directory loads renders matching results after the response arrives',async()=>{
 const f=fixture({pending:true});try{
  f.input.focus();f.input.value='NCST';f.input.fire('input');f.resolve();await settle();
  assert.equal(f.nodes['school-options'].children.length,1);assert.equal(f.input.attributes['aria-expanded'],'true');
 }finally{f.controller.stop();}
});
test('stop removes handlers and ignores an in-flight directory response',async()=>{
 const f=fixture({pending:true});f.controller.stop();const text=f.nodes['school-status'].textContent;f.resolve();await settle();
 assert.equal(f.nodes['school-status'].textContent,text);assert.equal(f.nodes['school-options'].children.length,0);
 assert.equal(f.input.listeners.get('keydown').size,0);
});
test('Escape closes only the picker before the enclosing modal; Tab does not select a campus',async()=>{
 const f=fixture();try{await settle();f.input.value='sample';f.input.fire('input');
  const escape=f.input.fire('keydown',{key:'Escape'});assert.equal(escape.prevented,true);assert.equal(escape.stopped,true);
  assert.equal(f.input.attributes['aria-expanded'],'false');assert.equal(f.controller.values().school_id,null);
  f.input.fire('input');f.input.fire('keydown',{key:'Tab'});assert.equal(f.nodes['school-options'].hidden,true);
 }finally{f.controller.stop();}
});
test('signup and profile load the shared school module before consumers and include labeled listbox controls',()=>{
 for(const [file,id,consumer]of [['signup-page.html','signup-school','auth.js'],['dashboard.html','profile-school','profile-store.js']]){
  const html=fs.readFileSync(file,'utf8');assert.ok(html.indexOf('src="school-selector.js"')<html.indexOf('src="'+consumer+'"'));
  assert.match(html,new RegExp('id="'+id+'-options"[^>]*role="listbox"'));
  assert.match(html,new RegExp('id="'+id+'-status"[^>]*role="status"'));
  assert.match(html,/href="school-selector.css"/);
 }
});
