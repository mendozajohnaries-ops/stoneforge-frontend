/* User Type is self-declared profile information, never an authorization role. */
(function(root){
 'use strict';
 const types=Object.freeze({regular:'Regular User',student:'Student',teacher:'Teacher / Instructor'});
 function validate(value){
  if(!value||!Object.hasOwn(types,value.user_type))throw new Error('Choose your User Type.');
  const school=typeof value.school==='string'?value.school.trim().replace(/\s+/g,' '):'';
  if(school.length>120||/[\x00-\x1f\x7f]/.test(school))throw new Error('Use a school name of 120 characters or fewer.');
  if(value.user_type==='student'&&!school)throw new Error('Enter your school name.');
  return {user_type:value.user_type,...(value.user_type==='regular'?{}:{school})};
 }
 function bind(type,group,input,label){
  const update=()=>{
   group.hidden=type.value==='regular'||!type.value;
   input.required=type.value==='student';
   input.disabled=group.hidden;
   label.textContent=type.value==='student'?'School name':'School / Institution (optional)';
  };
  type.addEventListener('change',update);update();return update;
 }
 const api={types,validate,bind};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeProfile=api;
})(typeof window!=='undefined'?window:globalThis);
