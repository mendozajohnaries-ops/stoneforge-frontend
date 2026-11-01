/* An opaque context ID is not login authority. Server cookie identity owns the purchase. */
(function(root){
 'use strict';
 const ids=new Set(['fm_handful','fm_pouch','fm_crate','fm_chest']);
 const validId=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
 function fromHash(hash){
  if(!hash||!hash.startsWith('#forge-handoff'))return null;
  const params=new URLSearchParams(hash.slice(1));
  if([...params.keys()].length!==1||!validId(params.get('forge-handoff')))throw Error('Invalid game Store link. Open the package again from the game.');
  return params.get('forge-handoff');
 }
 function state(value,owner,id){
  if(!value||value.version!==1||value.owner!==owner||value.environment!=='test'||value.live_purchases_enabled!==false||(id===null?value.handoff_id!==null:value.handoff_id!==id||!validId(id))||
   !ids.has(value.package_id)||!Number.isSafeInteger(value.medals)||value.medals<1||value.medals>1000000||
   !Number.isSafeInteger(value.price_centavos)||value.price_centavos<1||value.price_centavos>1000000||
   !['review','pending','processing','completed','expired'].includes(value.status)||typeof value.credited!=='boolean'||value.credited!==(value.status==='completed')||
   typeof value.request_key!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(value.request_key))throw Error('Game Store request could not be verified. Refresh to retry.');
  if(value.checkout_url!==null){let url;try{url=new URL(value.checkout_url);}catch{}
   if(value.status!=='pending'||!url||url.protocol!=='https:'||url.hostname!=='checkout.paymongo.com'||url.username||url.password)throw Error('Untrusted payment link rejected.');}
  return Object.freeze({...value});
 }
 function orderState(value,owner,pack,key){const result=state(value,owner,null);if(result.package_id!==pack||result.request_key!==key)throw Error('Payment request changed. Please retry.');return result;}
 const api={validId,fromHash,state,orderState};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeStoreHandoff=api;
})(typeof window!=='undefined'?window:globalThis);
