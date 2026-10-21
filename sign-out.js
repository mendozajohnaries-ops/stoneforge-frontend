/* Confirmation only. Session cleanup and logout remain in the caller. */
(function(root){
 'use strict';
 const states=new WeakMap();
 function confirm({document=root.document}={}){
  let state=states.get(document);
  if(!state){
   const dialog=document.createElement('dialog');dialog.className='signout-dialog';
   dialog.setAttribute('aria-labelledby','signout-heading');dialog.setAttribute('aria-describedby','signout-description');
   const heading=document.createElement('h2');heading.id='signout-heading';heading.textContent='Sign out of StoneForge?';
   const description=document.createElement('p');description.id='signout-description';description.textContent='You will need to sign in again to access your account.';
   const actions=document.createElement('div');actions.className='signout-dialog__actions';
   const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
   const accept=document.createElement('button');accept.type='button';accept.className='signout-dialog__confirm';accept.textContent='Sign Out';
   actions.append(cancel,accept);dialog.append(heading,description,actions);document.body.append(dialog);
   state={dialog,cancel,pending:null,previous:null};states.set(document,state);
   const finish=approved=>{
    if(!state.pending)return;
    const resolve=state.pending;state.pending=null;
    if(dialog.open)dialog.close();
    if(state.previous?.isConnected!==false)state.previous?.focus?.();
    resolve(approved);
   };
   cancel.addEventListener('click',()=>finish(false));accept.addEventListener('click',()=>finish(true));
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
   dialog.addEventListener('close',()=>{if(!dialog.open)finish(false);});
  }
  if(state.pending)return Promise.resolve(false);
  state.previous=document.activeElement;
  return new Promise(resolve=>{
   state.pending=resolve;
   try{state.dialog.showModal();state.cancel.focus();}
   catch{state.pending=null;resolve(false);} // Never log out if confirmation cannot be displayed.
  });
 }
 const api={confirm};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeSignOut=api;
})(typeof window!=='undefined'?window:globalThis);
