(function(root){
 'use strict';
 const tools=['stone_axe','iron_axe','iron_pickaxe','wooden_shovel','stone_spear','chisel','hoe','torch','wooden_fire_starter','small_resin_bucket'];
 function state(value,owner,previous=null){
  const fail=()=>{throw Error('Skin ownership unavailable. Refresh to retry.');};
  if(!value||value.version!==1||value.catalog_id!=='stoneforge-tool-skins'||value.catalog_version!==1||value.owner!==owner||value.currency!=='FM'||value.environment!=='test'||value.live_purchases_enabled!==false||
   !Number.isSafeInteger(value.balance)||value.balance<0||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>1000000||!Number.isSafeInteger(value.wallet_generation)||value.wallet_generation<0||value.wallet_generation>value.revision||
   !Number.isSafeInteger(value.equip_revision)||value.equip_revision<0||value.equip_revision>1000000||typeof value.can_purchase!=='boolean'||typeof value.requires_profile_completion!=='boolean'||value.can_purchase&&value.requires_profile_completion||
   !Array.isArray(value.skins)||value.skins.length!==10||!Array.isArray(value.owned)||value.owned.length>10||!Array.isArray(value.equipped)||value.equipped.length>10)fail();
  const seen=new Set(),owned=new Set(),slots=new Set();
  for(const row of value.skins){if(!row||!tools.includes(row.tool_id)||row.id!==row.tool_id+'.basic'||seen.has(row.id)||row.asset_revision!==1||!Number.isSafeInteger(row.price)||row.price<1||row.price>1000000||typeof row.available!=='boolean')fail();seen.add(row.id);}
  for(const id of value.owned){if(!seen.has(id)||owned.has(id))fail();owned.add(id);}
  if(value.can_purchase&&!value.skins.some(row=>row.available))fail();
  for(const row of value.equipped){if(!row||!tools.includes(row.toolId)||row.skinId!==row.toolId+'.basic'||!owned.has(row.skinId)||slots.has(row.toolId))fail();slots.add(row.toolId);}
  if(previous&&(previous.owner!==owner||value.wallet_generation<previous.wallet_generation||value.wallet_generation===previous.wallet_generation&&value.revision<previous.revision||value.equip_revision<previous.equip_revision||previous.owned.some(id=>!owned.has(id))))fail();
  if(previous&&value.equip_revision===previous.equip_revision&&(value.equipped.length!==previous.equipped.length||previous.equipped.some(slot=>!value.equipped.some(row=>row.toolId===slot.toolId&&row.skinId===slot.skinId))))fail();
  return Object.freeze({...value,skins:value.skins.map(row=>Object.freeze({...row})),owned:[...owned],equipped:value.equipped.map(row=>Object.freeze({...row}))});
 }
 const api={state};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StoneForgeSkins=api;
})(typeof window!=='undefined'?window:globalThis);
