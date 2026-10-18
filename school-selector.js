/* Accessible school combobox. Public directory requests never send account information. */
(function(root){
 'use strict';
 function normalize(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
 function validateCatalog(data){
  if(!data||data.version!==1||data.complete!==false||!Array.isArray(data.schools)||!data.schools.length||data.schools.length>1000)
   throw new Error('School directory unavailable.');
  const ids=new Set();
  for(const item of data.schools){
   if(!item||typeof item.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)||ids.has(item.id)||
     typeof item.name!=='string'||!item.name.trim()||item.name.length>200||typeof item.city!=='string'||!item.city.trim()||
     typeof item.campus!=='string'||!['Public','Private'].includes(item.sector)||!Array.isArray(item.aliases)||item.aliases.some(alias=>typeof alias!=='string')||
     typeof item.program!=='string'||!/STEM/i.test(item.program))throw new Error('School directory unavailable.');
   ids.add(item.id);
  }
  return data.schools;
 }
 function search(schools,query){
  const words=normalize(query).split(' ').filter(Boolean);
  return schools.filter(school=>{const text=normalize([school.name,school.campus,school.city,school.sector,...school.aliases].join(' '));return words.every(word=>text.includes(word));})
   .sort((a,b)=>a.name.localeCompare(b.name)||a.city.localeCompare(b.city)||a.id.localeCompare(b.id));
 }
 function mount({document,input,type,apiBase,fetch:request=root.fetch.bind(root)}){
  const get=suffix=>document.getElementById(input.id+suffix);
  const list=get('-options'),status=get('-status'),toggle=get('-toggle'),retry=get('-retry');
  if(!list||!status||!toggle||!retry)throw new Error('School picker is missing its controls.');
  let schools=[],selected=null,original=null,results=[],active=-1,stopped=false,controller,generation=0,loaded=false,loading=false,blurTimer;
  const listeners=[];
  const listen=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
  const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function currentSelection(){return selected&&input.value===selected.name?selected:null;}
  function describe(){
   if(loading){status.textContent='Loading Cavite school choices…';return;}
   if(!loaded){status.textContent='School directory unavailable. Retry to choose a school. Existing saved schools can still be kept unchanged.';return;}
   const choice=currentSelection();
   if(choice){
    const record=schools.find(school=>school.id===choice.id);
    status.textContent=record?[record.campus,record.city,record.sector,record.program].filter(Boolean).join(' · '):'Your saved school is preserved. Choose a campus only if you want to replace it.';return;
   }
   if(original?.school&&input.value===original.school&&
      (type.value!=='student'||original.school_selection!=='institution_text')){
    status.textContent=original.school_selection==='institution_text'?'Your optional institution is saved as typed text, not a directory selection.':
     'Your saved school is preserved. Choose a campus only if you want to replace it.';return;
   }
   status.textContent=type.value==='teacher'?'Optional: choose a listed campus or enter your institution. Typed institutions are not verified directory selections.':'Search by school, acronym or city, then choose a campus. Documented STEM offerings only; coverage is still being reviewed.';
  }
  function highlight(index){
   active=index;
   [...list.children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===active)));
   if(active>=0){input.setAttribute('aria-activedescendant',input.id+'-option-'+active);list.children[active]?.scrollIntoView?.({block:'nearest'});}
   else input.removeAttribute('aria-activedescendant');
  }
  function select(school){clearTimeout(blurTimer);selected=school;input.value=school.name;input.focus();close();describe();}
  function render(){
   list.replaceChildren();active=-1;input.removeAttribute('aria-activedescendant');
   if(!loaded||input.disabled){results=[];close();describe();return;}
   results=search(schools,currentSelection()?'':input.value);
   for(const [index,school]of results.entries()){
    const option=text('li','');option.id=input.id+'-option-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
    option.append(text('span',school.name,'school-option-name'),text('span',[school.campus,school.city,school.sector].filter(Boolean).join(' · '),'school-option-meta'));
    option.addEventListener('mousedown',event=>event.preventDefault());
    option.addEventListener('click',()=>select(school));list.append(option);
   }
   list.hidden=results.length===0;input.setAttribute('aria-expanded',String(results.length>0));
   status.textContent=results.length?results.length+' matching school'+(results.length===1?'':'s')+'. Arrow keys to browse; Enter to select.':'No matching campus in the documented list yet. Try its official name or city; do not select a different school.';
  }
  async function load(){
   const attempt=++generation;controller?.abort();const pending=new AbortController();controller=pending;loading=true;retry.hidden=true;describe();
   const timeout=setTimeout(()=>pending.abort(),15000);
   try{
    const response=await request(apiBase+'/schools',{credentials:'omit',signal:pending.signal});
    if(!response.ok)throw new Error('Directory unavailable.');const data=await response.json();
    if(stopped||attempt!==generation)return;
    schools=validateCatalog(data);loaded=true;retry.hidden=true;
   }catch(error){if(stopped||attempt!==generation)return;schools=[];loaded=false;results=[];close();retry.hidden=false;}
   finally{clearTimeout(timeout);if(!stopped&&attempt===generation){loading=false;
    if(loaded&&document.activeElement===input&&!input.disabled)render();else describe();}}
  }
  listen(input,'input',()=>{selected=null;render();});
  listen(input,'focus',()=>{clearTimeout(blurTimer);if(loaded)render();else describe();});
  listen(input,'keydown',event=>{
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();if(list.hidden)render();
    if(results.length)highlight(active<0?(event.key==='ArrowDown'?0:results.length-1):(active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);
   }else if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();select(results[active]);}
   else if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close();describe();}
   else if(event.key==='Tab')close();
  });
  listen(input,'blur',()=>{blurTimer=setTimeout(()=>{close();describe();},150);});
  listen(toggle,'click',()=>{if(input.disabled)return;input.focus();if(loaded)render();else load();});
  listen(type,'change',()=>{toggle.disabled=input.disabled;close();describe();});
  listen(retry,'click',load);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  toggle.disabled=input.disabled;load();
  return{values(){const school=currentSelection();return{school:input.value,school_id:school?.id||null};},
   reset(profile={}){original={school:profile.school||'',school_id:profile.school_id||null,school_selection:profile.school_selection};input.value=original.school;
    selected=original.school_id?{id:original.school_id,name:original.school}:null;close();describe();},
   refresh:load,stop(){stopped=true;generation++;controller?.abort();clearTimeout(blurTimer);listeners.forEach(remove=>remove());close();schools=[];}};
 }
 const api={normalize,validateCatalog,search,mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeSchools=api;
})(typeof window!=='undefined'?window:globalThis);
