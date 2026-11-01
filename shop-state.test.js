'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),wallet=require('./wallet-client');
const state=(owner='alice',all=true)=>({version:1,owner,currency:'FM',environment:'test',live_purchases_enabled:false,purchases_enabled:false,
 wallet:{balance:1800,credits:4800,spent:3000,revision:4,generation:0},roles:['scientist','captain','engineer','attendant','explorer'].map((id,i)=>({id,price:i?750:0,owned:!i||all})),skins:{status:'preview',owned:[],equipped:{}}});
test('website verifies account-bound shared ownership and balance',()=>{
 const value=wallet.shopState(state(),'alice');assert.equal(value.wallet.balance,1800);assert(value.roles.every(role=>role.owned));assert(Object.isFrozen(value));
 assert.throws(()=>wallet.shopState(state('bob'),'alice'));assert.throws(()=>wallet.shopState({...state(),purchases_enabled:true},'alice'));
});
test('website rejects malformed ownership and stale snapshots without fabricating state',()=>{
 const first=wallet.shopState(state(),'alice');const duplicate=state();duplicate.roles[1]=duplicate.roles[0];assert.throws(()=>wallet.shopState(duplicate,'alice'));
 const stale=state();stale.wallet={balance:1050,credits:1800,spent:750,revision:1,generation:0};assert.throws(()=>wallet.shopState(stale,'alice',first));
 const mismatch=state();mismatch.wallet.balance=0;assert.throws(()=>wallet.shopState(mismatch,'alice'));
 const skin=state();skin.skins.owned=['fake-skin'];assert.throws(()=>wallet.shopState(skin,'alice'));
});
