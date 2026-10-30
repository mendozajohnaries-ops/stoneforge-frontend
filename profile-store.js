/* Authenticated sandbox Forge Store. No client-side wallet credits. */
(function(root){
 'use strict';
 function mount({document,apiBase,owner,currentOwner,initialProfile,onSignOut,onWalletRefresh,fetch:request=root.fetch.bind(root)}){
  const el=id=>document.getElementById(id);
  const dialog=el('profile-completion-dialog'), form=el('profile-completion-form');
  const storeDialog=el('forge-store'),storeButton=el('open-forge-store'),storeClose=el('forge-store-close');
  let profile=null,wallet=null,catalog=null,stopped=false,profileBusy=false,checkoutBusy=false,generation=0;
  let walletLoading=false,availabilityLoading=false,reconciling=false,walletTask=null,walletFailure='';
  let storeRequested=false,selectedPack=null,selectedButton=null,backdropPressed=false,checkoutVersion=0;
  const storeListeners=[];
  function listen(node,name,handler){node.addEventListener(name,handler);storeListeners.push(()=>node.removeEventListener(name,handler));}
  const type=el('profile-user-type'),school=el('profile-school');
  const updateFields=StoneForgeProfile.bind(type,el('profile-school-group'),school,el('profile-school-label'));
  const schoolPicker=StoneForgeSchools.mount({document,input:school,type,apiBase,fetch:request,eager:false});
  const sameOwner=()=>!stopped&&currentOwner()===owner;
  const notice=(id,text,error=false)=>{el(id).textContent=text;el(id).classList.toggle('forge-error',error);};
  async function api(path,options={}){
   const response=await request(apiBase+'/'+path,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000),...options});
   const data=await response.json().catch(()=>({}));
   if(!sameOwner())throw new Error('Account changed. Please sign in again.');
   if(!response.ok)throw Object.assign(new Error(data.error||'Could not connect. Please retry.'),{status:response.status});
   return data;
  }
  function complete(){return !!profile&&!profile.requires_profile_completion&&Object.hasOwn(StoneForgeProfile.types,profile.user_type)&&
    (profile.user_type!=='student'||!!profile.school?.trim());}
  function displayProfile(data){
   if(!data||data.owner!==owner)throw new Error('Account changed. Please sign in again.');
   profile=data;
   el('user-type-value').textContent=StoneForgeProfile.types[data.user_type]||'Not set';
   el('profile-user-type-badge').textContent=StoneForgeProfile.types[data.user_type]||'Complete your profile';
   el('school-value').textContent=data.school?[data.school,data.school_campus,data.school_city].filter(Boolean).join(' · '):'Not set';
   el('school-display-row').hidden=data.user_type==='regular';
   if(!complete())openProfile();renderButtons();syncStoreWallet();showRequestedStore();
  }
  function openProfile(){
   if(storeDialog.open)closeStore();
   type.value=profile?.user_type||'';updateFields();schoolPicker.reset(profile||{});
   el('profile-cancel').hidden=!complete();
   el('profile-signout').hidden=complete();
   el('profile-required-note').hidden=complete();
   notice('profile-save-status','');
   if(!dialog.open)dialog.showModal();
   type.focus();
  }
  async function loadProfile(){
   try{displayProfile(await api('profile'));el('profile-retry').hidden=true;}
   catch(error){if(sameOwner()){el('profile-retry').hidden=false;notice('profile-state-status','Profile unavailable. Retry to complete or edit your details.',true);}}
  }
  listen(dialog,'cancel',event=>{if(!complete()||profileBusy)event.preventDefault();});
  listen(el('profile-cancel'),'click',()=>{if(complete()&&!profileBusy){dialog.close();showRequestedStore();}});
  listen(el('profile-signout'),'click',()=>{if(!profileBusy&&typeof onSignOut==='function')onSignOut();});
  listen(el('profile-edit'),'click',()=>{if(profile)openProfile();else loadProfile();});
  listen(el('profile-retry'),'click',loadProfile);
  listen(form,'submit',async event=>{
   event.preventDefault();if(profileBusy||!sameOwner())return;
   let fields;try{fields=StoneForgeProfile.validate({user_type:type.value,...schoolPicker.values()},{previous:profile});}
   catch(error){notice('profile-save-status',error.message,true);return;}
   profileBusy=true;el('profile-save').disabled=true;notice('profile-save-status','Saving profile…');
   try{
    const data=await api('profile',{method:'PUT',headers:{'Content-Type':'application/json','x-playfab-id':owner},body:JSON.stringify(fields)});
    // Do not reopen the required prompt while applying a successful save.
    displayProfile(data);if(complete()){dialog.close();showRequestedStore();}
    notice('profile-state-status','Profile saved.');loadWallet();
   }catch(error){if(sameOwner())notice('profile-save-status',error.message,true);}
   finally{profileBusy=false;if(sameOwner())el('profile-save').disabled=false;}
  });
  function renderButtons(){
   const allowed=sameOwner()&&complete()&&!walletLoading&&!availabilityLoading&&!reconciling&&wallet?.test_checkout_available===true&&wallet.requires_profile_completion!==true;
   document.querySelectorAll('[data-forge-pack]').forEach(button=>{
    button.disabled=!allowed||checkoutBusy;
    button.textContent=checkoutBusy?'Preparing…':walletLoading||availabilityLoading?'Checking…':allowed?'Select package':!complete()?'Complete profile':'Unavailable';
   });
   el('forge-confirm-continue').disabled=!allowed||!selectedPack||checkoutBusy;
   el('forge-confirm-back').disabled=checkoutBusy;
   el('forge-confirm-continue').textContent=checkoutBusy?'Preparing…':'Continue to checkout';
   el('forge-store-retry').disabled=walletLoading||availabilityLoading||reconciling||checkoutBusy;
  }
  function resetSelection(restoreFocus=false){
   const previous=selectedButton;selectedPack=null;selectedButton=null;
   el('forge-store-browse').hidden=false;el('forge-confirmation').hidden=true;
   el('forge-confirm-pack').textContent='';el('forge-confirm-price').textContent='';renderButtons();
   if(restoreFocus&&storeDialog.open)previous?.focus({preventScroll:true});
  }
  function showRequestedStore(){
   if(!storeRequested||!sameOwner()||!complete()||dialog.open||storeDialog.open)return false;
   storeDialog.showModal();document.documentElement.classList.add('forge-store-open');
   storeButton.setAttribute('aria-expanded','true');el('forge-store-body').scrollTop=0;storeClose.focus({preventScroll:true});return true;
  }
  function openStore(){
   if(!sameOwner())return false;
   storeRequested=true;
   if(profile&&!complete()){openProfile();return false;}
   return showRequestedStore();
  }
  function storeClosed(){
   storeRequested=false;backdropPressed=false;checkoutVersion++;
   document.documentElement.classList.remove('forge-store-open');storeButton.setAttribute('aria-expanded','false');resetSelection();
   if(sameOwner()&&!dialog.open)storeButton.focus({preventScroll:true});
  }
  function closeStore(){if(storeDialog.open)storeDialog.close();storeClosed();}
  function outsideStore(event){
   const box=storeDialog.getBoundingClientRect();
   return event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;
  }
  function selectPack(packId,button){
   if(!storeDialog.open||!sameOwner()||checkoutBusy||walletLoading||availabilityLoading||reconciling||!complete()||!wallet?.test_checkout_available||wallet.requires_profile_completion===true)return;
   const pack=catalog?.packs.find(item=>item.id===packId);if(!pack)return;
   selectedPack=pack;selectedButton=button;
   el('forge-confirm-pack').textContent=pack.name+' · '+pack.medals.toLocaleString()+' FM';
   el('forge-confirm-price').textContent=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(pack.price_centavos/100);
   el('forge-store-browse').hidden=true;el('forge-confirmation').hidden=false;
   notice('store-state','Review the package before continuing. No payment request has been created.');renderButtons();
   el('forge-confirmation-heading').focus({preventScroll:true});el('forge-store-body').scrollTop=0;
  }
  function syncStoreWallet(){
   el('store-wallet-balance').textContent=el('wallet-balance').textContent;
   el('store-test-row').hidden=el('wallet-test-row').hidden;el('store-test-balance').textContent=el('wallet-test-balance').textContent;
   const eligible=wallet?.test_checkout_available===true&&wallet.requires_profile_completion!==true;
   el('forge-store-mode').textContent=walletLoading||availabilityLoading?'Checking availability':eligible?'Available':'Store unavailable';
   el('forge-store-availability').textContent=walletLoading?'Loading your balance…':availabilityLoading?'Checking package availability…':
    !complete()?'Complete your profile before buying Forge Medals.':!wallet?walletFailure||'Refresh your balance to try again.':eligible?
     'Your balance is shared with StoneForge. Choose a package to continue.':
    wallet.checkout_unavailable_reason==='profile_required'?'Complete your profile before buying Forge Medals.':
    wallet.checkout_unavailable_reason==='store_disabled'?'Checkout is temporarily unavailable. Please try again later.':
     'Store availability could not be verified. Refresh to check again. Your confirmed balance is unchanged.';
  }
  function renderPacks(){
   const grid=el('forge-pack-grid');grid.replaceChildren();
   for(const pack of catalog.packs){
    const card=document.createElement('article');card.className='forge-pack';
    const title=document.createElement('h3');title.className='forge-pack__name';title.textContent=pack.name;
    const amount=document.createElement('div');amount.className='forge-pack__amount';amount.textContent=pack.medals.toLocaleString()+' FM';
    const art=document.createElement('div');art.className='forge-art'+(pack.id==='fm_handful'?'':' forge-art--padded');
    const image=document.createElement('img');image.src=pack.image.replace('Assets/store/','Assets/store/web/').replace('.png','.webp');image.alt=pack.name;image.loading='lazy';image.decoding='async';image.width=170;image.height=170;art.append(image);
    const price=document.createElement('div');price.className='forge-pack__price';price.textContent=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(pack.price_centavos/100);
    const button=document.createElement('button');button.type='button';button.className='forge-primary';button.dataset.forgePack=pack.id;
    button.addEventListener('click',()=>selectPack(pack.id,button));card.append(title,amount,art,price,button);grid.append(card);
   }
   renderButtons();
  }
  function renderPerks(){
   const section=el('forge-perk-preview'),explorer=el('forge-character-preview'),perks=catalog?.perk_upgrades;
   const fixed=catalog?.fixed_roles;
   if(section&&explorer&&fixed){
    const names={scientist:'Scientist',captain:'Captain',engineer:'Engineer',attendant:'Attendant',explorer:'Explorer'};
    const definitions=fixed.roles,seen=new Set();
    if(fixed.id!=='multiplayer-fixed-roles'||fixed.version!==1||fixed.upgrade_levels!==false||!Array.isArray(definitions)||definitions.length!==5)return;
    for(const role of definitions){
     if(!role||!Object.hasOwn(names,role.id)||seen.has(role.id)||!Number.isSafeInteger(role.price)||role.price<0||role.price>1000000||role.id==='scientist'&&role.price!==0||role.id!=='scientist'&&role.price===0)return;
     seen.add(role.id);
    }
    section.replaceChildren();const heading=document.createElement('h3');heading.textContent='Team roles';section.append(heading);
    const intro=document.createElement('p');intro.className='forge-muted';intro.textContent='Scientist is free. Unlock additional roles in the game. Roles have fixed specialties, with no upgrade levels.';section.append(intro);
    for(const role of definitions){const row=document.createElement('p');row.className='forge-muted';row.textContent=names[role.id]+': '+(role.price===0?'Free':role.price.toLocaleString()+' FM');section.append(row);}
    explorer.replaceChildren();const title=document.createElement('h3');title.textContent='Item skins';explorer.append(title);
    const note=document.createElement('p');note.className='forge-muted';note.textContent='Personalize supported items using the available in-game skins. Skins change appearance while retaining normal item stats and functionality.';explorer.append(note);return;
   }
   if(!section||!explorer||!perks)return;
   if(perks.id!=='multiplayer-perks'||![1,2].includes(perks.version)||!Array.isArray(perks.characters))return;
   const names={captain:'Captain',engineer:'Engineer',attendant:'Attendant',explorer:'Explorer'};
   section.replaceChildren();
   const heading=document.createElement('h3');heading.textContent='Character perks';section.append(heading);
   const note=document.createElement('p');note.className='forge-muted';note.textContent='Upgrade in the game. Level 1 is included. Levels 2 / 3 / 4 / 5:';section.append(note);
   for(const def of perks.characters){
    if(!names[def.id]||!Array.isArray(def.costs)||def.costs.length!==4||def.costs.some(n=>!Number.isSafeInteger(n)||n<1))continue;
    const row=document.createElement('p');row.className='forge-muted';row.textContent=names[def.id]+': '+def.costs.join(' / ')+' FM';section.append(row);
   }
   const scientist=document.createElement('p');scientist.className='forge-muted';scientist.textContent='Scientist has no paid upgrades.';section.append(scientist);
   explorer.replaceChildren();const title=document.createElement('h3');title.textContent='Explorer';explorer.append(title);
   const text=document.createElement('p');text.className='forge-muted';
   text.textContent=perks.version===2&&perks.explorer_available===true&&perks.explorer_unlock_cost===750?
    'Unlock in the game for 750 FM, including Level 1. Your four original characters stay free.':'Explorer is unavailable on this backend version.';
   explorer.append(text);
  }
  const readBalance=async()=>StoneForgeWallet.canonical(await api('wallet/current',{headers:{'x-playfab-id':owner}}),owner);
  function loadWallet(){
   if(!sameOwner())return Promise.resolve();
   if(walletTask)return walletTask;
   const attempt=++generation;
   walletLoading=true;availabilityLoading=true;walletFailure='';syncStoreWallet();renderButtons();
   const task=readWallet(attempt);walletTask=task;
   task.finally(()=>{if(walletTask===task)walletTask=null;});return task;
  }
  async function readWallet(attempt){
   const current=()=>sameOwner()&&attempt===generation;
   function show(data,availability){
    wallet={...data,...availability,test_checkout_available:availability?.test_checkout_available===true};
    el('wallet-balance').textContent=data.balance.toLocaleString();
    el('wallet-test-row').hidden=true;el('wallet-test-balance').textContent='';syncStoreWallet();renderButtons();
   }
   const funds=readBalance();
   const access=api('wallet').then(data=>StoneForgeWallet.availability(data,owner)).catch(()=>null);
   try{
    let data=await funds;if(!current())return;
    walletLoading=false;show(data,null);notice('wallet-state','Balance updated.');
    const availability=await access;if(!current())return;
    availabilityLoading=false;show(data,availability);
    let pendingRewards=false;
    if(availability?.perk_rewards_available===true){
     reconciling=true;renderButtons();
     try{const result=await api('wallet/reconcile',{method:'POST',headers:{'Content-Type':'application/json','x-playfab-id':owner},body:'{}'});
      if(result.owner!==owner||result.environment!=='test')throw new Error('Reward owner mismatch.');
     }catch{pendingRewards=true;}
     if(!current())return;
     data=await readBalance();if(!current())return;
     reconciling=false;show(data,availability);
    }
    notice('wallet-state',pendingRewards?'Balance updated. Reward sync is pending; refresh to retry.':availability?'Balance updated. Shared with your game.':'Balance updated. Store availability is unavailable; refresh to retry.');
    if(typeof onWalletRefresh==='function')onWalletRefresh();
   }catch(error){
    if(!current())return;
    wallet=null;el('wallet-balance').textContent='Unavailable';el('wallet-test-row').hidden=true;el('wallet-test-balance').textContent='';
    walletFailure=error.status===401?'Your session expired. Sign in again to load your wallet.':
     error.status===403?'Account access is restricted. Check your account status or sign in again.':
     'Wallet unavailable. Check your connection and retry. Your balance has not been reset.';
    notice('wallet-state',walletFailure,true);
   }finally{
    if(current()){walletLoading=false;availabilityLoading=false;reconciling=false;syncStoreWallet();renderButtons();}
   }
  }
  async function checkout(packId){
   if(checkoutBusy||walletLoading||availabilityLoading||reconciling||!storeDialog.open||selectedPack?.id!==packId||!complete()||!wallet?.test_checkout_available||wallet.requires_profile_completion===true||!sameOwner())return;
   const attempt=checkoutVersion;
   checkoutBusy=true;renderButtons();notice('store-state','Preparing your checkout…');
   try{
    const keyName='sf_forge_test_'+owner+'_'+packId;
    let key=root.sessionStorage.getItem(keyName);
    if(!key){key=root.crypto.randomUUID();root.sessionStorage.setItem(keyName,key);}
    const result=await api('store/checkout',{method:'POST',headers:{'Content-Type':'application/json','x-playfab-id':owner},
      body:JSON.stringify({package_id:packId,request_key:key})});
    if(attempt!==checkoutVersion||!storeDialog.open)return;
    const url=new URL(result.checkout_url);
    if(result.environment!=='test'||url.protocol!=='https:'||url.hostname!=='checkout.paymongo.com'||url.username||url.password)throw new Error('Unsafe checkout response rejected.');
    root.location.assign(url.href);
   }catch(error){if(sameOwner()&&attempt===checkoutVersion&&storeDialog.open)notice('store-state',error.message,true);}
   finally{checkoutBusy=false;renderButtons();}
  }
  listen(el('wallet-refresh'),'click',loadWallet);
  listen(el('forge-store-retry'),'click',async()=>{if(!catalog)await loadCatalog();await loadWallet();});
  listen(storeButton,'click',openStore);
  listen(storeClose,'click',closeStore);
  listen(storeDialog,'close',()=>{if(!storeDialog.open)storeClosed();});
  listen(storeDialog,'cancel',event=>{event.preventDefault();closeStore();});
  listen(storeDialog,'keydown',event=>{
   if(event.key!=='Tab'||!storeDialog.open)return;
   const buttons=Array.from(storeDialog.querySelectorAll('button, summary, a[href], input, select, textarea'))
    .filter(button=>!button.disabled&&button.getClientRects().length>0);
   if(!buttons.length)return;
   const first=buttons[0],last=buttons.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  listen(storeDialog,'pointerdown',event=>{backdropPressed=event.target===storeDialog&&outsideStore(event);});
  listen(storeDialog,'click',event=>{const dismiss=backdropPressed&&event.target===storeDialog&&outsideStore(event);backdropPressed=false;if(dismiss)closeStore();});
  listen(dialog,'close',showRequestedStore);
  listen(el('forge-confirm-back'),'click',()=>{if(checkoutBusy)return;resetSelection(true);notice('store-state','Choose a package to review before checkout.');});
  listen(el('forge-confirm-continue'),'click',()=>checkout(selectedPack?.id));
  async function loadCatalog(){
   try{
    const data=await api('store/catalog');
    if(data.version!==1||data.live_purchases_enabled!==false||!Array.isArray(data.packs)||data.packs.length!==4||
      data.packs.some(pack=>!/^fm_(handful|pouch|crate|chest)$/.test(pack.id)||!Number.isSafeInteger(pack.medals)||pack.medals<1||
       !Number.isSafeInteger(pack.price_centavos)||pack.price_centavos<1||!/^Assets\/store\/fm-[a-z]+\.png$/.test(pack.image)))
     throw new Error('Store catalog unavailable.');
    catalog=data;renderPacks();renderPerks();notice('store-state','Choose a package to review before checkout.');
   }catch{if(sameOwner())notice('store-state','Store unavailable. Please refresh the page to retry.',true);}
  }
  function initialize(){
   loadWallet();loadCatalog();
   if(initialProfile){try{displayProfile(initialProfile);}catch{loadProfile();}}else loadProfile();
  }
  const onVisible=()=>{if(!document.hidden&&sameOwner())loadWallet();};
  document.addEventListener('visibilitychange',onVisible);
  const timer=setInterval(onVisible,60000);
  initialize();
  return{open:openStore,refresh:loadWallet,stop(){stopped=true;generation++;clearInterval(timer);schoolPicker.stop();document.removeEventListener('visibilitychange',onVisible);
   storeListeners.forEach(remove=>remove());closeStore();
   if(dialog.open)dialog.close();el('wallet-balance').textContent='—';el('wallet-test-row').hidden=true;
   el('wallet-test-balance').textContent='';wallet=null;profile=null;walletLoading=false;availabilityLoading=false;reconciling=false;walletFailure='';
   type.value='';school.value='';el('profile-save').disabled=false;for(const id of ['user-type-value','profile-user-type-badge','school-value','profile-state-status','profile-save-status'])el(id).textContent='';
   syncStoreWallet();renderButtons();}};
 }
 const api={mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeStore=api;
})(typeof window!=='undefined'?window:globalThis);
