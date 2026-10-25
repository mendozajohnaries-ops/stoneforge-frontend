/* Cookie identity is verified by the server. Browser storage is never authority. */
(function(root){
 'use strict';
 const EVENT_KEY='sf.auth-event',CHANNEL='stoneforge-auth';
 function notify(kind,window=root){
  const event={kind,nonce:Date.now()+'-'+Math.random().toString(36).slice(2)};
  try{window.localStorage.setItem(EVENT_KEY,JSON.stringify(event));}catch{}
  try{const channel=new window.BroadcastChannel(CHANNEL);channel.postMessage(event);channel.close();}catch{}
 }
 function protect({window=root,document=window.document,apiBase,role='player',rootId,loadingId='loading-screen',onReady,onSuspend=()=>{},fetch:request=window.fetch.bind(window)}){
  const content=document.getElementById(rootId),loading=document.getElementById(loadingId);
  let owner=null,initialized=false,generation=0,attempt=0,checking=null,verification=null,loggingOut=false,stopped=false,lastEvent=null;
  let work=new AbortController();
  function mask(message='Checking your account…',retry=null,secondary=null){
   content.hidden=true;content.inert=true;loading.style.display='flex';loading.hidden=false;
   const text=document.createElement('p');text.textContent=message;text.setAttribute('role','status');
   loading.replaceChildren(text);
   if(retry){const button=document.createElement('button');button.type='button';button.className='session-retry';button.textContent='Retry';button.addEventListener('click',retry);loading.append(button);}
   if(secondary){const button=document.createElement('button');button.type='button';button.className='session-secondary';button.textContent='Return to account';button.addEventListener('click',secondary);loading.append(button);}
  }
  function suspend(){
   generation++;work.abort();work=new AbortController();owner=null;initialized=false;onSuspend();
   document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  }
  function clearHints(){
   for(const key of ['sf_user','sf_reported','shop_intent','report_intent'])try{window.sessionStorage.removeItem(key);}catch{}
  }
  function signedOut(){
   attempt++;verification?.abort();checking=null;suspend();clearHints();mask('You have signed out.');
   window.location.replace('login-page.html');
  }
  async function responseJson(response){try{return await response.json();}catch{return null;}}
  async function check(){
   if(stopped||loggingOut)return false;if(checking)return checking;
   mask();const current=++attempt;verification=new AbortController();const checkController=verification;
   const timer=window.setTimeout(()=>checkController.abort(),15000),signal=checkController.signal;
   const pending=(async()=>{
    try{
     const response=await request(apiBase+'/me',{credentials:'include',cache:'no-store',signal});
     const user=await responseJson(response);
     if(stopped||current!==attempt)return false;
     if(response.status===401||response.status===403){signedOut();return false;}
     if(!response.ok||user?.success!==true||typeof user.playfab_id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(user.playfab_id))throw new Error('Session unavailable');
     if((role==='admin')!==(user.is_admin===true)){
      suspend();window.location.replace(user.is_admin===true?'admin.html':'dashboard.html');return false;
     }
     if(owner!==user.playfab_id||!initialized){
      suspend();owner=user.playfab_id;try{window.sessionStorage.setItem('sf_user',JSON.stringify(user));}catch{}
      const epoch=generation;await onReady(user);
      if(stopped||epoch!==generation||current!==attempt)return false;initialized=true;
     }
     if(stopped||current!==attempt)return false;
     loading.hidden=true;loading.style.display='none';content.hidden=false;content.inert=false;return true;
    }catch{
     if(!stopped&&current===attempt){suspend();mask('Your session could not be verified. Check your connection and retry.',()=>check());}
     return false;
    }finally{window.clearTimeout(timer);if(current===attempt)checking=null;}
   })();checking=pending;return pending;
  }
  async function logout(){
   if(loggingOut||stopped)return false;loggingOut=true;attempt++;verification?.abort();checking=null;
   mask('Signing out…');suspend();const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),15000);
   try{
    const response=await request(apiBase+'/logout',{method:'POST',credentials:'include',cache:'no-store',signal:controller.signal});
    const data=await responseJson(response);
    if(!response.ok||data?.success!==true)throw new Error('Unconfirmed logout');
    clearHints();notify('signed-out',window);signedOut();return true;
   }catch{
    mask('Sign-out could not be confirmed. Retry, or verify your account to continue.',()=>logout(),()=>check());return false;
   }finally{window.clearTimeout(timer);loggingOut=false;}
  }
  async function authenticatedRequest(url,options={}){
   if(!owner||stopped||loggingOut)throw new Error('Account unavailable');
   const epoch=generation,expected=owner;
   const signal=AbortSignal.any([work.signal,options.signal||AbortSignal.timeout(15000)]);
   const response=await request(url,{...options,signal});
   if(epoch!==generation||owner!==expected||stopped)throw new Error('Account changed');
   if(response.status===401){signedOut();throw new Error('Account access changed');}
   // A forbidden optional feature is not proof of an invalid session. Verify
   // identity separately before deciding whether to invalidate the account.
   if(response.status===403)check();
   return new Proxy(response,{get(target,key){
    if(key==='json')return async()=>{const data=await target.json();if(epoch!==generation||owner!==expected||stopped)throw new Error('Account changed');return data;};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
   }});
  }
  const onHide=()=>{attempt++;verification?.abort();checking=null;mask();suspend();};
  const onShow=()=>check();
  const onVisible=()=>{if(!document.hidden)check();};
  function receive(event){
   if(event?.nonce&&event.nonce===lastEvent)return;
   if(event?.nonce)lastEvent=event.nonce;
   if(event?.kind==='signed-out')signedOut();else if(event?.kind==='signed-in'){onHide();check();}
  }
  const onStorage=event=>{if(event.key===EVENT_KEY){try{receive(JSON.parse(event.newValue));}catch{}}};
  let channel;try{channel=new window.BroadcastChannel(CHANNEL);channel.onmessage=event=>receive(event.data);}catch{}
  window.addEventListener('pagehide',onHide);window.addEventListener('pageshow',onShow);window.addEventListener('storage',onStorage);
  document.addEventListener('visibilitychange',onVisible);mask();
  return{check,logout,request:authenticatedRequest,get owner(){return owner;},get generation(){return generation;},
   stop(){stopped=true;attempt++;verification?.abort();suspend();channel?.close();window.removeEventListener('pagehide',onHide);window.removeEventListener('pageshow',onShow);window.removeEventListener('storage',onStorage);document.removeEventListener('visibilitychange',onVisible);}};
 }
 const api={protect,notify,EVENT_KEY};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeSession=api;
})(typeof window!=='undefined'?window:globalThis);
