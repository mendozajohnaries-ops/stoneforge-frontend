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
  let shopSnapshot=null,shopTask=null,shopFresh=false,ownershipState='Checking…';
  let skinSnapshot=null,skinTask=null,skinFresh=false;
  let category='medals',classReview=null,classBusy=false;
  const toolNames={stone_axe:'Stone Axe',iron_axe:'Iron Axe',iron_pickaxe:'Iron Pickaxe',wooden_shovel:'Wooden Shovel',
   stone_spear:'Stone Spear',chisel:'Chisel',hoe:'Hoe',torch:'Torch',wooden_fire_starter:'Wooden Fire Starter',small_resin_bucket:'Small Resin Bucket'};
  const classInfo={
   scientist:['Scientist','Access detailed guides for recipes, materials, and crafting procedures.'],
   captain:['Captain','Rescue downed teammates faster.'],
   engineer:['Engineer','Use 15% less tool durability when chopping and mining.'],
   attendant:['Attendant','Carry more supplies with eight extra storage slots.'],
   explorer:['Explorer','Mark nearby resources needed for your selected recipe.']
  };
  let handoffId=null,handoff=null,handoffError='',handoffTask=null,handoffSelected=false;
  try{handoffId=root.StoneForgeStoreHandoff?.fromHash(root.location?.hash);}catch(error){handoffError=error.message;}
  if(handoffId||handoffError)storeRequested=true;
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
  function handoffAllowed(){return !handoffId&&!handoffError||!!handoff&&!handoffError&&['review','pending'].includes(handoff.status);}
  function renderButtons(){
   const allowed=sameOwner()&&complete()&&!walletLoading&&!availabilityLoading&&!reconciling&&wallet?.test_checkout_available===true&&wallet.requires_profile_completion!==true;
   document.querySelectorAll('[data-forge-pack]').forEach(button=>{
    button.disabled=!allowed||checkoutBusy||!handoffAllowed()||!!handoff&&button.dataset.forgePack!==handoff.package_id;
    button.textContent=checkoutBusy?'Preparing…':walletLoading||availabilityLoading?'Checking…':allowed?'Select package':!complete()?'Complete profile':'Unavailable';
   });
   el('forge-confirm-continue').disabled=!allowed||!selectedPack||checkoutBusy||!handoffAllowed();
   el('forge-confirm-back').disabled=checkoutBusy;
   el('forge-confirm-continue').textContent=checkoutBusy?'Preparing…':handoff?.status==='completed'?'Payment confirmed':handoff?.status==='pending'?'Resume checkout':handoff?.status==='processing'?'Checking payment':'Continue to checkout';
   el('forge-store-retry').disabled=walletLoading||availabilityLoading||reconciling||checkoutBusy;
  }
  function showCategory(next){
   if(next!=='medals'&&(!storeDialog.open||handoffId||handoffError||selectedPack||checkoutBusy))return;
   category=next;classReview=null;
   el('forge-store-browse').hidden=next!=='medals';
   el('forge-store-availability').hidden=next!=='medals';
   el('store-state').hidden=next!=='medals';
   el('forge-classes').hidden=next!=='classes';
   el('forge-skins').hidden=next!=='skins';
   for(const name of ['medals','classes','skins'])el('forge-'+name+'-tab').setAttribute('aria-pressed',String(name===next));
   el('forge-class-grid').replaceChildren();el('forge-skin-grid').replaceChildren();
   el('forge-class-review-art').replaceChildren();
   el('forge-class-review-details').textContent='';el('forge-class-review-heading').textContent='';
   notice('forge-class-state','');notice('forge-skin-state','');
   el('forge-store-body').scrollTop=0;
   if(next==='classes'){renderClasses();void readShop();}
   if(next==='skins'){renderSkins();void readSkins();}
  }
  function productImage(src){
   const image=document.createElement('img');image.src=src;image.alt='';image.decoding='async';image.loading='lazy';
   image.width=160;image.height=160;return image;
  }
  function productCard(id,name,description){
   const card=document.createElement('article');card.className='forge-product';
   const art=document.createElement('div');art.className='forge-product-art';art.append(productImage('Assets/store/catalog/'+id+'.png'));
   const content=document.createElement('div');content.className='forge-product-copy';
   const title=document.createElement('h4');title.textContent=name;
   const details=document.createElement('p');details.className='forge-muted';details.textContent=description;
   content.append(title,details);card.append(art,content);return{card,content};
  }
  function renderSkins(){
   if(category!=='skins')return;
   const grid=el('forge-skin-grid');grid.replaceChildren();
   notice('forge-skin-state',skinFresh?'':skinTask?'Checking skin ownership…':'Ownership unavailable. Refresh to retry.');
   for(const [id,name] of Object.entries(toolNames)){
    const skin=skinFresh?skinSnapshot.skins.find(entry=>entry.tool_id===id):null;
    const {card,content}=productCard(id,name,'Tool appearance');
    const status=document.createElement('span');status.className='forge-product-badge';
    status.textContent=skinSnapshot&&skin&&skinSnapshot.equipped.some(slot=>slot.skinId===skin.id)?'Equipped':
     skin&&skinSnapshot.owned.includes(skin.id)?'Owned':skin?.available?'Available in game':'Preview Only';
    content.append(status);grid.append(card);
   }
  }
  const fm=value=>value.toLocaleString()+' FM';
  function canUnlock(role){
   return sameOwner()&&complete()&&shopFresh&&shopSnapshot?.classPurchasesAvailable&&role&&!role.owned;
  }
  function renderClasses(){
   if(category!=='classes')return;
   const grid=el('forge-class-grid'),review=el('forge-class-review');
   grid.hidden=!!classReview;review.hidden=!classReview;
   if(classReview){
    const {id,price,balance,generation}=classReview;
    const role=shopSnapshot?.roles.find(item=>item.id===id);
    const art=el('forge-class-review-art');
    if(!art.children.length)art.append(productImage('Assets/store/catalog/'+id+'.png'));
    el('forge-class-review-heading').textContent='Unlock '+classInfo[id][0]+'?';
    el('forge-class-review-details').textContent='Price: '+fm(price)+' · Your balance: '+fm(balance)+' · After purchase: '+fm(balance-price);
    el('forge-class-confirm').disabled=classBusy||!canUnlock(role)||role.price!==price||
     shopSnapshot.wallet.generation!==generation||shopSnapshot.wallet.balance<price;
    el('forge-class-confirm').textContent=classBusy?'Unlocking…':'Confirm unlock';
    return;
   }
   el('forge-class-review-art').replaceChildren();grid.replaceChildren();
   for(const [id,[name,description]] of Object.entries(classInfo)){
    const role=shopFresh?shopSnapshot.roles.find(item=>item.id===id):null;
    const {card,content}=productCard(id,name,description);
    const isStatus=!canUnlock(role)||shopSnapshot.wallet.balance<role.price;
    const action=document.createElement(isStatus?'span':'button');
    if(isStatus)action.className='forge-product-badge';
    else{action.type='button';action.className='forge-primary';}
    if(!isStatus)action.disabled=classBusy;
    action.textContent=id==='scientist'?'Included':!role?ownershipState:role.owned?'Owned':
     !canUnlock(role)?'Unavailable':shopSnapshot.wallet.balance<role.price?'Needs '+fm(role.price):'Unlock · '+fm(role.price);
    if(!isStatus)action.addEventListener('click',()=>{
     if(classBusy||!canUnlock(role)||shopSnapshot.wallet.balance<role.price)return;
     classReview={id,price:role.price,balance:shopSnapshot.wallet.balance,generation:shopSnapshot.wallet.generation};
     notice('forge-class-state','');renderClasses();el('forge-class-review-heading').focus({preventScroll:true});
    });
    content.append(action);grid.append(card);
   }
  }
  function applyShop(data){
   shopSnapshot=data;shopFresh=true;ownershipState='';renderClasses();
   if(wallet){wallet={...wallet,balance:data.wallet.balance};el('wallet-balance').textContent=data.wallet.balance.toLocaleString();syncStoreWallet();}
  }
  async function unlockClass(){
   if(!storeDialog.open||category!=='classes'||classBusy||!classReview||el('forge-class-confirm').disabled)return;
   const selection=classReview;
   const {id,price,generation}=selection;
   classBusy=true;renderClasses();notice('forge-class-state','Unlocking class…');
   try{
    const keyName='sf_class_'+owner+'_'+generation+'_'+id;
    let key=root.sessionStorage.getItem(keyName);
    if(!key){key=root.crypto.randomUUID();root.sessionStorage.setItem(keyName,key);}
    const result=await api('shop/classes/purchase',{method:'POST',headers:{'Content-Type':'application/json','x-playfab-id':owner},
     body:JSON.stringify({role:id,request_key:key,catalog_version:1,wallet_generation:generation})});
    const data=StoneForgeWallet.shopState(result,owner,shopSnapshot);
    if(result.request_key!==key||result.receipt?.kind!=='role_unlock'||result.receipt.role!==id||
     result.receipt.cost!==price||data.wallet.generation!==generation||!data.roles.some(role=>role.id===id&&role.owned))
     throw new Error('Purchase could not be verified. Refresh to check ownership.');
    applyShop(data);
    if(category==='classes'){classReview=null;notice('forge-class-state',classInfo[id][0]+' unlocked. Refresh the game shop to see it.');}
   }catch(error){
    if(sameOwner()&&category==='classes'){classReview=null;notice('forge-class-state',error.message,true);}
   }finally{
    classBusy=false;
    if(sameOwner()){renderClasses();void readShop();}
   }
  }
  function resetSelection(restoreFocus=false){
   const previous=selectedButton;selectedPack=null;selectedButton=null;
   el('forge-store-browse').hidden=false;el('forge-confirmation').hidden=true;
   el('forge-pack-review-art').replaceChildren();el('forge-confirm-pack').textContent='';el('forge-confirm-price').textContent='';renderButtons();
   if(restoreFocus&&storeDialog.open)previous?.focus({preventScroll:true});
  }
  function showRequestedStore(){
   if(!storeRequested||!sameOwner()||!complete()||dialog.open||storeDialog.open)return false;
   el('forge-store-categories').hidden=!!(handoffId||handoffError);
   storeDialog.showModal();document.documentElement.classList.add('forge-store-open');
   storeButton.setAttribute('aria-expanded','true');el('forge-store-body').scrollTop=0;storeClose.focus({preventScroll:true});void readShop();tryHandoffSelection();return true;
  }
  function openStore(){
   if(!sameOwner())return false;
   storeRequested=true;
   if(profile&&!complete()){openProfile();return false;}
   return showRequestedStore();
  }
  function storeClosed(){
   storeRequested=false;backdropPressed=false;checkoutVersion++;
   showCategory('medals');
   document.documentElement.classList.remove('forge-store-open');storeButton.setAttribute('aria-expanded','false');resetSelection();
   if(sameOwner()&&!dialog.open)storeButton.focus({preventScroll:true});
  }
  function closeStore(){if(storeDialog.open)storeDialog.close();storeClosed();}
  function outsideStore(event){
   const box=storeDialog.getBoundingClientRect();
   return event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom;
  }
  function packImage(pack){
   return pack.image.replace('Assets/store/','Assets/store/web/').replace('.png','.webp');
  }
  function selectPack(packId,button){
   if(!handoffAllowed()||handoff&&packId!==handoff.package_id)return;
   if(!storeDialog.open||!sameOwner()||checkoutBusy||walletLoading||availabilityLoading||reconciling||!complete()||!wallet?.test_checkout_available||wallet.requires_profile_completion===true)return;
   const pack=catalog?.packs.find(item=>item.id===packId);if(!pack)return;
   selectedPack=pack;selectedButton=button;
   el('forge-pack-review-art').replaceChildren(productImage(packImage(pack)));
   el('forge-confirm-pack').textContent=pack.name+' · '+pack.medals.toLocaleString()+' FM';
   el('forge-confirm-price').textContent=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(pack.price_centavos/100);
   el('forge-store-browse').hidden=true;el('forge-confirmation').hidden=false;
   notice('store-state','Review the package before continuing. No payment request has been created.');renderButtons();
   el('forge-confirmation-heading').focus({preventScroll:true});el('forge-store-body').scrollTop=0;
  }
  function tryHandoffSelection(){
   if(!sameOwner())return;
   if(!storeDialog.open||!handoffId&&!handoffError)return;
   if(handoffError){notice('store-state',handoffError,true);renderButtons();return;}
   if(!handoff){notice('store-state','Checking the Store request from your game…');return;}
   const pack=catalog?.packs.find(item=>item.id===handoff.package_id);
   if(!pack)return;
   if(pack.medals!==handoff.medals||pack.price_centavos!==handoff.price_centavos){handoffError='Package details changed. Review the package again in the game.';notice('store-state',handoffError,true);renderButtons();return;}
   if(!walletLoading&&!availabilityLoading&&!reconciling&&wallet?.test_checkout_available&&complete()&&!handoffSelected){
    if(['review','pending'].includes(handoff.status))selectPack(pack.id,Array.from(document.querySelectorAll('[data-forge-pack]')).find(b=>b.dataset.forgePack===pack.id)||null);
    else{selectedPack=pack;el('forge-pack-review-art').replaceChildren(productImage(packImage(pack)));el('forge-confirm-pack').textContent=pack.name+' · '+pack.medals.toLocaleString()+' FM';el('forge-confirm-price').textContent=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(pack.price_centavos/100);el('forge-store-browse').hidden=true;el('forge-confirmation').hidden=false;}
    handoffSelected=true;
   }
   notice('store-state',handoff.status==='completed'?'Payment confirmed by the server. Return to StoneForge and press Refresh to update your balance.':
    handoff.status==='processing'?'Your checkout is still being verified. Refresh to check again; do not create another payment.':
    handoff.status==='expired'?'This payment request has expired. Open the package again from the game.':
    handoff.status==='pending'?'Continue the existing checkout for the package selected in your game.':
    'Package selected in your game. Review the details, then continue to checkout.');renderButtons();
  }
  function readHandoff(){
   if(!handoffId||!sameOwner())return Promise.resolve(null);if(handoffTask)return handoffTask;
   handoffError='';handoffSelected=false;
   const pending=(async()=>{
    try{handoff=root.StoneForgeStoreHandoff.state(await api('store/handoff?handoff_id='+encodeURIComponent(handoffId),{headers:{'x-playfab-id':owner}}),owner,handoffId);if(!sameOwner())return null;}
    catch(error){if(sameOwner()){handoff=null;handoffError=error.status===404?'This purchase belongs to a different or expired game session. Sign in with the same account as your game, then reopen the package.':error.message;}}
    tryHandoffSelection();return handoff;
   })();handoffTask=pending;pending.finally(()=>{if(handoffTask===pending)handoffTask=null;});return pending;
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
    const image=document.createElement('img');image.src=packImage(pack);image.alt=pack.name;image.loading='lazy';image.decoding='async';image.width=170;image.height=170;art.append(image);
    const price=document.createElement('div');price.className='forge-pack__price';price.textContent=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(pack.price_centavos/100);
    const button=document.createElement('button');button.type='button';button.className='forge-primary';button.dataset.forgePack=pack.id;
    button.addEventListener('click',()=>selectPack(pack.id,button));card.append(title,amount,art,price,button);grid.append(card);
   }
   renderButtons();
  }
  function readShop(){
   if(!sameOwner()||typeof StoneForgeWallet.shopState!=='function')return Promise.resolve(null);
   if(shopTask)return shopTask;
   shopFresh=false;ownershipState='Checking…';renderClasses();
   const pending=(async()=>{
    try{const data=StoneForgeWallet.shopState(await api('shop/account',{headers:{'x-playfab-id':owner}}),owner,shopSnapshot);
     if(!sameOwner())return null;applyShop(data);
     return data;
    }catch{if(sameOwner()){ownershipState='Ownership unavailable · Refresh';renderClasses();}return null;}
   })();shopTask=pending;pending.finally(()=>{if(shopTask===pending)shopTask=null;});return pending;
  }
  function readSkins(){
   if(!sameOwner()||typeof root.StoneForgeSkins?.state!=='function')return Promise.resolve(null);if(skinTask)return skinTask;
   skinFresh=false;
   const pending=(async()=>{try{const data=root.StoneForgeSkins.state(await api('skins',{headers:{'x-playfab-id':owner}}),owner,skinSnapshot);if(!sameOwner())return null;skinSnapshot=data;skinFresh=true;renderSkins();return data;}
    catch{if(sameOwner()){skinFresh=false;}return null;}})();skinTask=pending;renderSkins();pending.finally(()=>{if(skinTask===pending){skinTask=null;if(sameOwner())renderSkins();}});return pending;
  }
  const readBalance=async()=>StoneForgeWallet.canonical(await api('wallet/current',{headers:{'x-playfab-id':owner}}),owner);
  function loadWallet(){
   if(!sameOwner())return Promise.resolve();
   if(walletTask)return walletTask;
   void readHandoff();
   const attempt=++generation;
   void readShop();void readSkins();
   walletLoading=true;availabilityLoading=true;walletFailure='';syncStoreWallet();renderButtons();
   const task=readWallet(attempt);walletTask=task;
   task.finally(()=>{if(walletTask===task)walletTask=null;});return task;
  }
  async function readWallet(attempt){
   const current=()=>sameOwner()&&attempt===generation;
   function show(data,availability){
    if(shopFresh&&shopSnapshot)data={...data,balance:shopSnapshot.wallet.balance};
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
    if(current()){walletLoading=false;availabilityLoading=false;reconciling=false;syncStoreWallet();renderButtons();tryHandoffSelection();}
   }
  }
  async function checkout(packId){
   if(!handoffAllowed()||handoff&&packId!==handoff.package_id||checkoutBusy||walletLoading||availabilityLoading||reconciling||!storeDialog.open||selectedPack?.id!==packId||!complete()||!wallet?.test_checkout_available||wallet.requires_profile_completion===true||!sameOwner())return;
   const attempt=checkoutVersion;
   checkoutBusy=true;renderButtons();notice('store-state','Preparing your checkout…');
   try{
    const keyName='sf_forge_test_'+owner+'_'+packId;
    let key=handoff?.request_key||root.sessionStorage.getItem(keyName);
    if(key&&!handoff){
     const previous=root.StoneForgeStoreHandoff.orderState(await api('store/handoff?package_id='+encodeURIComponent(packId)+'&request_key='+encodeURIComponent(key),{headers:{'x-playfab-id':owner}}),owner,packId,key);
     if(attempt!==checkoutVersion||!storeDialog.open)return;
     if(previous.status==='processing')throw Error('Your previous checkout is still being verified. Refresh before trying again.');
     if(['completed','expired'].includes(previous.status)){key=root.crypto.randomUUID();root.sessionStorage.setItem(keyName,key);}
    }
    if(!key){key=root.crypto.randomUUID();root.sessionStorage.setItem(keyName,key);}
    const result=await api('store/checkout',{method:'POST',headers:{'Content-Type':'application/json','x-playfab-id':owner},
      body:JSON.stringify({package_id:packId,request_key:key,...(handoff?{handoff_id:handoffId}:{})})});
    if(attempt!==checkoutVersion||!storeDialog.open)return;
    const url=new URL(result.checkout_url);
    if(result.environment!=='test'||url.protocol!=='https:'||url.hostname!=='checkout.paymongo.com'||url.username||url.password)throw new Error('Unsafe checkout response rejected.');
    root.location.assign(url.href);
   }catch(error){if(sameOwner()&&attempt===checkoutVersion&&storeDialog.open)notice('store-state',error.message,true);}
   finally{checkoutBusy=false;renderButtons();}
  }
  for(const name of ['medals','classes','skins'])listen(el('forge-'+name+'-tab'),'click',()=>{if(category!==name)showCategory(name);});
  listen(el('forge-class-cancel'),'click',()=>{classReview=null;renderClasses();el('forge-classes-tab').focus();});
  listen(el('forge-class-confirm'),'click',unlockClass);
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
  listen(el('forge-confirm-back'),'click',()=>{
   if(checkoutBusy)return;
   if(handoff&&['completed','expired'].includes(handoff.status)){
    handoffId=null;handoff=null;handoffError='';handoffSelected=false;
    try{const url=new URL(root.location.href);url.hash='';url.searchParams.delete('payment');root.history.replaceState(null,'',url.href);}catch{}
   }
   el('forge-store-categories').hidden=!!(handoffId||handoffError);
   resetSelection(true);notice('store-state','Choose a package to review before checkout.');
  });
  listen(el('forge-confirm-continue'),'click',()=>checkout(selectedPack?.id));
  async function loadCatalog(){
   try{
    const data=await api('store/catalog');
    if(data.version!==1||data.live_purchases_enabled!==false||!Array.isArray(data.packs)||data.packs.length!==4||
      data.packs.some(pack=>!/^fm_(handful|pouch|crate|chest)$/.test(pack.id)||!Number.isSafeInteger(pack.medals)||pack.medals<1||
       !Number.isSafeInteger(pack.price_centavos)||pack.price_centavos<1||!/^Assets\/store\/fm-[a-z]+\.png$/.test(pack.image)))
     throw new Error('Store catalog unavailable.');
    catalog=data;renderPacks();notice('store-state','Choose a package to review before checkout.');tryHandoffSelection();
   }catch{if(sameOwner())notice('store-state','Store unavailable. Please refresh the page to retry.',true);}
  }
  function initialize(){
   loadWallet();loadCatalog();
   if(initialProfile){try{displayProfile(initialProfile);}catch{loadProfile();}}else loadProfile();
   if(handoffId||handoffError)openStore();
  }
  const onVisible=()=>{if(!document.hidden&&sameOwner())loadWallet();};
  document.addEventListener('visibilitychange',onVisible);
  root.addEventListener?.('focus',onVisible);
  const timer=setInterval(onVisible,60000);
  initialize();
  return{open:openStore,refresh:loadWallet,stop(){stopped=true;generation++;clearInterval(timer);schoolPicker.stop();document.removeEventListener('visibilitychange',onVisible);root.removeEventListener?.('focus',onVisible);
   storeListeners.forEach(remove=>remove());closeStore();
   if(dialog.open)dialog.close();el('wallet-balance').textContent='—';el('wallet-test-row').hidden=true;
   el('wallet-test-balance').textContent='';wallet=null;profile=null;skinSnapshot=null;skinFresh=false;handoff=null;handoffError='';shopSnapshot=null;shopFresh=false;ownershipState='Sign in to view ownership';walletLoading=false;availabilityLoading=false;reconciling=false;walletFailure='';
   type.value='';school.value='';el('profile-save').disabled=false;for(const id of ['user-type-value','profile-user-type-badge','school-value','profile-state-status','profile-save-status'])el(id).textContent='';
   syncStoreWallet();renderButtons();}};
 }
 const api={mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeStore=api;
})(typeof window!=='undefined'?window:globalThis);
