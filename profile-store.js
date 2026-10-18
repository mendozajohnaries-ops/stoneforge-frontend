/* Profile migration and preview-only Forge Store. No client-side wallet credits. */
(function(root){
 'use strict';
 function mount({document,apiBase,owner,currentOwner,initialProfile,onSignOut,fetch:request=root.fetch.bind(root)}){
  const el=id=>document.getElementById(id);
  const dialog=el('profile-completion-dialog'), form=el('profile-completion-form');
  let profile=null,wallet=null,catalog=null,stopped=false,profileBusy=false,checkoutBusy=false,generation=0;
  const type=el('profile-user-type'),school=el('profile-school');
  const updateFields=StoneForgeProfile.bind(type,el('profile-school-group'),school,el('profile-school-label'));
  const sameOwner=()=>!stopped&&currentOwner()===owner;
  const notice=(id,text,error=false)=>{el(id).textContent=text;el(id).classList.toggle('forge-error',error);};
  async function api(path,options={}){
   const response=await request(apiBase+'/'+path,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000),...options});
   const data=await response.json().catch(()=>({}));
   if(!sameOwner())throw new Error('Account changed. Please sign in again.');
   if(!response.ok)throw new Error(data.error||'Could not connect. Please retry.');
   return data;
  }
  function complete(){return !!profile&&!profile.requires_profile_completion&&Object.hasOwn(StoneForgeProfile.types,profile.user_type)&&
    (profile.user_type!=='student'||!!profile.school?.trim());}
  function displayProfile(data){
   if(!data||data.owner!==owner)throw new Error('Account changed. Please sign in again.');
   profile=data;
   el('user-type-value').textContent=StoneForgeProfile.types[data.user_type]||'Not set';
   el('profile-user-type-badge').textContent=StoneForgeProfile.types[data.user_type]||'Complete your profile';
   el('school-value').textContent=data.school||'Not set';
   el('school-display-row').hidden=data.user_type==='regular';
   if(!complete())openProfile();renderButtons();
  }
  function openProfile(){
   type.value=profile?.user_type||'';school.value=profile?.school||'';updateFields();
   el('profile-cancel').hidden=!complete();
   el('profile-signout').hidden=complete();
   el('profile-required-note').hidden=complete();
   notice('profile-save-status','');
   if(!dialog.open)dialog.showModal();
   type.focus();
  }
  async function loadProfile(){
   try{displayProfile(await api('profile'));el('profile-retry').hidden=true;}
   catch(error){el('profile-retry').hidden=false;notice('profile-state-status','Profile unavailable. Retry to complete or edit your details.',true);}
  }
  dialog.addEventListener('cancel',event=>{if(!complete()||profileBusy)event.preventDefault();});
  el('profile-cancel').addEventListener('click',()=>{if(complete()&&!profileBusy)dialog.close();});
  el('profile-signout').addEventListener('click',()=>{if(!profileBusy&&typeof onSignOut==='function')onSignOut();});
  el('profile-edit').addEventListener('click',()=>{if(profile)openProfile();else loadProfile();});
  el('profile-retry').addEventListener('click',loadProfile);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(profileBusy||!sameOwner())return;
   let fields;try{fields=StoneForgeProfile.validate({user_type:type.value,school:school.value});}
   catch(error){notice('profile-save-status',error.message,true);return;}
   profileBusy=true;el('profile-save').disabled=true;notice('profile-save-status','Saving profile…');
   try{
    const data=await api('profile',{method:'PUT',headers:{'Content-Type':'application/json','x-playfab-id':owner},body:JSON.stringify(fields)});
    // Do not reopen the required prompt while applying a successful save.
    displayProfile(data);if(complete())dialog.close();
    notice('profile-state-status','Profile saved.');loadWallet();
   }catch(error){notice('profile-save-status',error.message,true);}
   finally{profileBusy=false;el('profile-save').disabled=false;}
  });
  function renderButtons(){
   document.querySelectorAll('[data-forge-pack]').forEach(button=>{
    const allowed=complete()&&wallet?.test_checkout_available===true;
    button.disabled=!allowed||checkoutBusy;
    button.textContent=checkoutBusy?'Preparing…':allowed?'Test checkout':'Coming soon';
   });
  }
  function renderPacks(){
   const grid=el('forge-pack-grid');grid.replaceChildren();
   for(const pack of catalog.packs){
    const card=document.createElement('article');card.className='forge-pack';
    const title=document.createElement('h3');title.className='forge-pack__name';title.textContent=pack.name;
    const amount=document.createElement('div');amount.className='forge-pack__amount';amount.textContent=pack.medals.toLocaleString()+' FM';
    const art=document.createElement('div');art.className='forge-art'+(pack.id==='fm_handful'?'':' forge-art--padded');
    const image=document.createElement('img');image.src=pack.image;image.alt='Forge Medal bundle';image.loading='lazy';image.width=170;image.height=170;art.append(image);
    const price=document.createElement('div');price.className='forge-pack__price';price.textContent=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(pack.price_centavos/100);
    const button=document.createElement('button');button.type='button';button.className='forge-primary';button.dataset.forgePack=pack.id;
    button.addEventListener('click',()=>checkout(pack.id));card.append(title,amount,art,price,button);grid.append(card);
   }
   renderButtons();
  }
  async function loadWallet(){
   const attempt=++generation;
   try{
    const data=await api('wallet');
    if(attempt!==generation||data.owner!==owner||data.environment!=='live'||!Number.isSafeInteger(data.balance)||data.balance<0||
      data.test_checkout_available===true&&(!Number.isSafeInteger(data.test_balance)||data.test_balance<0))
     throw new Error('Wallet could not be verified.');
    wallet=data;
    el('wallet-balance').textContent=data.balance.toLocaleString();
    notice('wallet-state','Live purchases and achievement rewards are not active yet.');
    el('wallet-test-row').hidden=!data.test_checkout_available;
    if(data.test_checkout_available)el('wallet-test-balance').textContent=data.test_balance.toLocaleString()+' TEST FM — not spendable live currency';
    renderButtons();
   }catch(error){
    if(!sameOwner()||attempt!==generation)return;
    wallet=null;el('wallet-balance').textContent='Unavailable';el('wallet-test-row').hidden=true;el('wallet-test-balance').textContent='';
    notice('wallet-state','Wallet unavailable. Your balance has not been reset.',true);renderButtons();
   }
  }
  async function checkout(packId){
   if(checkoutBusy||!complete()||!wallet?.test_checkout_available||!sameOwner())return;
   checkoutBusy=true;renderButtons();notice('store-state','Preparing an isolated test payment. No real money will be charged.');
   try{
    const keyName='sf_forge_test_'+owner+'_'+packId;
    let key=root.sessionStorage.getItem(keyName);
    if(!key){key=root.crypto.randomUUID();root.sessionStorage.setItem(keyName,key);}
    const result=await api('store/checkout',{method:'POST',headers:{'Content-Type':'application/json','x-playfab-id':owner},
      body:JSON.stringify({package_id:packId,request_key:key})});
    const url=new URL(result.checkout_url);
    if(result.environment!=='test'||url.protocol!=='https:'||url.hostname!=='checkout.paymongo.com'||url.username||url.password)throw new Error('Unsafe checkout response rejected.');
    root.location.assign(url.href);
   }catch(error){notice('store-state',error.message,true);}
   finally{checkoutBusy=false;renderButtons();}
  }
  el('wallet-refresh').addEventListener('click',loadWallet);
  el('open-forge-store').addEventListener('click',()=>el('forge-store').scrollIntoView({behavior:'smooth',block:'start'}));
  async function initialize(){
   if(initialProfile){try{displayProfile(initialProfile);}catch{await loadProfile();}}else await loadProfile();
   try{
    catalog=await api('store/catalog');
    if(catalog.version!==1||catalog.live_purchases_enabled!==false||!Array.isArray(catalog.packs)||catalog.packs.length!==4||
      catalog.packs.some(pack=>!/^fm_(handful|pouch|crate|chest)$/.test(pack.id)||!Number.isSafeInteger(pack.medals)||pack.medals<1||
       !Number.isSafeInteger(pack.price_centavos)||pack.price_centavos<1||!/^Assets\/store\/fm-[a-z]+\.png$/.test(pack.image)))
     throw new Error('Store catalog unavailable.');
    renderPacks();
   }catch{notice('store-state','Store unavailable. Please refresh the page to retry.',true);}
   await loadWallet();
  }
  const onVisible=()=>{if(!document.hidden&&sameOwner())loadWallet();};
  document.addEventListener('visibilitychange',onVisible);
  const timer=setInterval(onVisible,60000);
  initialize();
  return{refresh:loadWallet,stop(){stopped=true;generation++;clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);
   if(dialog.open)dialog.close();el('wallet-balance').textContent='—';el('wallet-test-row').hidden=true;
   el('wallet-test-balance').textContent='';wallet=null;renderButtons();}};
 }
 const api={mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeStore=api;
})(typeof window!=='undefined'?window:globalThis);
