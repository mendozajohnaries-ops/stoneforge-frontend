'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),client=require('./store-handoff-client');
const id='11111111-2222-4333-8444-555555555555';
const state=()=>({version:1,owner:'alice',environment:'test',live_purchases_enabled:false,handoff_id:id,package_id:'fm_handful',medals:200,price_centavos:4900,status:'review',credited:false,checkout_url:null,request_key:'native_request_12345'});
test('Store fragment accepts only one opaque context ID',()=>{
 assert.equal(client.fromHash('#forge-handoff='+id),id);assert.equal(client.fromHash('#other'),null);
 for(const bad of ['#forge-handoff=bad','#forge-handoff='+id+'&forge-handoff='+id,'#forge-handoff='+id+'&owner=alice'])assert.throws(()=>client.fromHash(bad));
});
test('handoff envelope rejects foreign identity/mode, invalid price, credit flag, links and keys',()=>{
 assert.equal(client.state(state(),'alice',id).medals,200);
 for(const extra of [{owner:'bob'},{environment:'live'},{live_purchases_enabled:true},{medals:0},{price_centavos:-1},{credited:true},{package_id:'invented'},{request_key:'x'},{status:'pending',checkout_url:'https://evil.example'},{status:'review',checkout_url:'https://checkout.paymongo.com/x'}])assert.throws(()=>client.state({...state(),...extra},'alice',id));
 assert.throws(()=>client.orderState({...state(),handoff_id:null},'alice','fm_pouch','native_request_12345'));assert.throws(()=>client.orderState({...state(),handoff_id:null},'alice','fm_handful','other_request_12345'));
});
