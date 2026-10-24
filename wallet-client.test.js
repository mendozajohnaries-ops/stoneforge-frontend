'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const wallet=require('./wallet-client');
const valid={version:2,owner:'alice',currency:'FM',environment:'test',balance:175,live_purchases_enabled:false,rewards_active:false};
test('canonical wallet accepts confirmed zero/positive integer FM and ignores legacy display guesses',()=>{
 for(const balance of [0,175,Number.MAX_SAFE_INTEGER])assert.equal(wallet.canonical({...valid,balance,test_balance:99999,display_balance:99999},'alice').balance,balance);
});
test('wrong account, live environment, wrong currency/version and malformed balances fail closed',()=>{
 for(const patch of [{owner:'bob'},{environment:'live'},{currency:'PHP'},{version:1},{live_purchases_enabled:true},{rewards_active:true},
  ...[null,false,'175',-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1].map(balance=>({balance}))])assert.throws(()=>wallet.canonical({...valid,...patch},'alice'));
 for(const data of [null,{},[]])assert.throws(()=>wallet.canonical(data,'alice'));
});
test('availability validates identity and explicit flags but cannot supply a balance',()=>{
 const data={owner:'alice',access_model:'free_to_play',live_purchases_enabled:false,test_checkout_available:true,perk_rewards_available:false,requires_profile_completion:false,balance:9999};
 assert.equal(wallet.availability(data,'alice').balance,undefined);
 for(const patch of [{owner:'bob'},{access_model:'paid'},{live_purchases_enabled:true},{test_checkout_available:'true'},{perk_rewards_available:null},{requires_profile_completion:undefined}])assert.throws(()=>wallet.availability({...data,...patch},'alice'));
});
