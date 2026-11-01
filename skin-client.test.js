'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),skins=require('./skin-client');
const tools=['stone_axe','iron_axe','iron_pickaxe','wooden_shovel','stone_spear','chisel','hoe','torch','wooden_fire_starter','small_resin_bucket'];
const good=()=>({version:1,catalog_id:'stoneforge-tool-skins',catalog_version:1,owner:'alice',currency:'FM',environment:'test',live_purchases_enabled:false,balance:1000,revision:1,wallet_generation:0,equip_revision:1,can_purchase:false,requires_profile_completion:false,
 skins:tools.map(tool=>({id:tool+'.basic',tool_id:tool,price:300,asset_revision:1,available:false})),owned:['stone_axe.basic'],equipped:[{toolId:'stone_axe',skinId:'stone_axe.basic'}]});
test('strict skin snapshot accepts account ownership without selling unfinished assets',()=>{const value=skins.state(good(),'alice');assert.deepEqual(value.owned,['stone_axe.basic']);assert(value.skins.every(d=>!d.available));assert.equal(value.can_purchase,false);});
test('foreign, corrupt, unowned, duplicate and stale skin snapshots fail closed',()=>{
 for(const change of [v=>v.owner='bob',v=>v.currency='PHP',v=>v.environment='live',v=>v.live_purchases_enabled=true,v=>v.skins[0].price=-1,v=>v.skins[1]=v.skins[0],v=>v.owned=['unknown'],v=>v.equipped=[{toolId:'iron_axe',skinId:'iron_axe.basic'}],v=>v.equipped.push(v.equipped[0]),v=>v.equip_revision=-1]){const value=good();change(value);assert.throws(()=>skins.state(value,'alice'));}
 const previous=skins.state(good(),'alice'),stale=good();stale.equip_revision=0;assert.throws(()=>skins.state(stale,'alice',previous));const revoked=good();revoked.owned=[];revoked.equipped=[];assert.throws(()=>skins.state(revoked,'alice',previous));
});
