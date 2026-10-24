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
 const api={canonical,availability};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeWallet=api;
})(typeof window!=='undefined'?window:globalThis);
