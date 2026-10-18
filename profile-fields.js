/* User Type is self-declared metadata, never an authorization role or proof of enrollment. */
(function(root){
 'use strict';
 const types=Object.freeze({regular:'Regular User',student:'Student',teacher:'Teacher / Instructor'});
 const normalize=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
 function validate(value,{previous}={}){
  if(!value||!Object.hasOwn(types,value.user_type))throw new Error('Choose your User Type.');
  const school=normalize(value.school),id=value.school_id;
  if(school.length>200||/[\x00-\x1f\x7f]/.test(school))throw new Error('Use an institution name of 200 characters or fewer.');
  if(value.user_type==='regular')return{user_type:value.user_type};
  if(id!==undefined&&id!==null&&(typeof id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>100))throw new Error('Choose a school from the list.');
  const unchanged=school&&school===normalize(previous?.school)&&previous?.school_selection!=='institution_text';
  if(value.user_type==='student'&&(!school||!id&&!unchanged))throw new Error('Choose a school from the Cavite STEM list. You may keep your existing saved school unchanged.');
  return{user_type:value.user_type,school,...(id?{school_id:id}:unchanged?{}:{school_id:null})};
 }
 function bind(type,group,input,label){
  const update=()=>{
   group.hidden=type.value==='regular'||!type.value;
   input.required=type.value==='student';input.disabled=group.hidden;
   label.textContent=type.value==='student'?'School name':'School / Institution (optional)';
  };
  type.addEventListener('change',update);update();return update;
 }
 const api={types,validate,bind};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeProfile=api;
})(typeof window!=='undefined'?window:globalThis);
