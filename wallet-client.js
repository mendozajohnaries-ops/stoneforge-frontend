/* Shared browser contract for the backend-selected sandbox wallet. */
(function(root){
 'use strict';
 function canonical(data,owner){
  if(!data||data.version!==2||data.owner!==owner||data.currency!=='FM'||data.environment!=='test'||
    !Number.isSafeInteger(data.balance)||data.balance<0||data.live_purchases_enabled!==false||data.rewards_active!==false)
   throw new Error('Wallet could not be verified.');
  return{version:2,owner,currency:'FM',environment:'test',balance:data.balance};
 }
 function availability(data,owner){
  if(!data||data.owner!==owner||data.access_model!=='free_to_play'||
    typeof data.test_checkout_available!=='boolean'||typeof data.perk_rewards_available!=='boolean'||
    typeof data.requires_profile_completion!=='boolean'||data.live_purchases_enabled!==false)
   throw new Error('Store availability could not be verified.');
  return{test_checkout_available:data.test_checkout_available,perk_rewards_available:data.perk_rewards_available,
   requires_profile_completion:data.requires_profile_completion,checkout_unavailable_reason:data.checkout_unavailable_reason,
   test_checkout_scope:data.test_checkout_scope};
 }
 function shopState(data,owner,previous=null){
  const fail=()=>{throw new Error('Shop ownership could not be verified.');};
  const number=n=>Number.isSafeInteger(n)&&n>=0;
  if(!data||data.version!==1||data.owner!==owner||data.currency!=='FM'||data.environment!=='test'||
   data.live_purchases_enabled!==false||data.purchases_enabled!==false)fail();
  const wallet=data.wallet;
  if(!wallet||!['balance','credits','spent','revision','generation'].every(key=>number(wallet[key]))||
   wallet.credits-wallet.spent!==wallet.balance||wallet.generation>wallet.revision)fail();
  const ids=['scientist','captain','engineer','attendant','explorer'],seen=new Set();
  if(!Array.isArray(data.roles)||data.roles.length!==5)fail();
  const roles=data.roles.map(role=>{
   if(!role||!ids.includes(role.id)||seen.has(role.id)||typeof role.owned!=='boolean'||!number(role.price)||
    role.price>1000000||(role.id==='scientist'?(role.price!==0||!role.owned):role.price<1))fail();
   seen.add(role.id);return Object.freeze({id:role.id,price:role.price,owned:role.owned});
  });
  if(!data.skins||data.skins.status!=='preview'||!Array.isArray(data.skins.owned)||data.skins.owned.length||
   !data.skins.equipped||Object.keys(data.skins.equipped).length)fail();
  if(previous?.owner===owner&&(wallet.generation<previous.wallet.generation||wallet.generation===previous.wallet.generation&&
   (wallet.revision<previous.wallet.revision||wallet.credits<previous.wallet.credits)))fail();
  if(Object.hasOwn(data,'class_purchases_available')&&typeof data.class_purchases_available!=='boolean')fail();
  return Object.freeze({owner,wallet:Object.freeze({...wallet}),roles:Object.freeze(roles),classPurchasesAvailable:data.class_purchases_available===true});
 }
 const api={canonical,availability,shopState};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeWallet=api;
})(typeof window!=='undefined'?window:globalThis);
