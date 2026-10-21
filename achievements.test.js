'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { categories, validateCatalog, validateRecords, state, summary, mount } = require('./achievements');
const fs = require('node:fs');
const catalog = JSON.parse(fs.readFileSync('test-fixtures/achievement-catalog.json', 'utf8'));
const definitions = validateCatalog(catalog);
test('71 shared definitions, 64 supported, 7 reserved and correct categories', () => {
    assert.equal(definitions.length, 71); assert.equal(categories.length, 7);
    assert.deepEqual(summary(definitions, new Map()), { available:64, reserved:7, unlocked:0 });
    for (const def of definitions) assert.equal(state(def, new Map()).status, def.available ? 'locked' : 'unavailable');
});
test('counter and unlock display use actual targets; reserved cannot be remotely unlocked', () => {
    const def = definitions.find(def => def.id === 'gameplay.resourceful_survivor');
    const partial = validateRecords({ version:1, records:[{id:def.id,progress:2}] }, definitions);
    assert.deepEqual(state(def, partial), {progress:2,status:'progress'});
    const done = validateRecords({version:1,records:[{id:def.id,progress:50}]},definitions);
    assert.equal(summary(definitions,done).unlocked,1);
    assert.throws(()=>validateRecords({version:1,records:[{id:'collection.a_new_look',progress:1}]},definitions));
});
test('malformed catalog/snapshot, duplicates and unbounded progress reject safely', () => {
    assert.throws(()=>validateCatalog({...catalog,definitions:definitions.slice(1)}));
    assert.throws(()=>validateCatalog({...catalog,definitions:[definitions[0],...definitions.slice(0,-1)]}));
    for (const records of [[{id:'fake',progress:1}],[{id:definitions[0].id,progress:-1}],
        [{id:definitions[0].id,progress:2}],Array(72).fill({id:definitions[0].id,progress:1})])
        assert.throws(()=>validateRecords({version:1,records}, definitions));
});

test('perk achievement uploads cannot masquerade as trusted server snapshots',()=>{
 const id='perk.first_improvement';
 assert.throws(()=>validateRecords({version:2,records:[{id,progress:1}]},definitions));
 assert.throws(()=>validateRecords({version:1,records:[{id,progress:1,source:'server_perks'}]},definitions));
 assert.equal(validateRecords({version:2,records:[{id,progress:1,source:'server_perks'}]},definitions).get(id).progress,1);
});
class Node {
    constructor(tag='div') { this.tag=tag; this.children=[]; this.listeners={}; this.value=''; this.textContent=''; this.attributes={}; }
    append(...nodes) { this.children.push(...nodes); if(this.tag==='select'&&!this.value)this.value=nodes[0].value; }
    replaceChildren(...nodes) { this.children=[...nodes]; }
    setAttribute(key,value) { this.attributes[key]=value; }
    addEventListener(event,fn) { this.listeners[event]=fn; }
    removeEventListener(event) { delete this.listeners[event]; }
}
function fixture(snapshot={version:1,records:[]}, definitionsOverride=catalog, preview=false) {
    const nodes = Object.fromEntries(['achievements-grid','achievement-sync-status','achievement-category','achievement-refresh'].map(id=>[id,new Node(id==='achievement-category'?'select':'div')]));
    if(preview)nodes['achievement-view-all']=new Node('button');
    const document = { hidden:false, getElementById:id=>nodes[id], createElement:tag=>new Node(tag), addEventListener(){},removeEventListener(){} };
    const calls=[]; let owner='alice', fail=false;
    const browser=mount({document,apiBase:'https://api.example/api',owner:'alice',currentOwner:()=>owner,
        fetch:async(url,options)=>{ calls.push({url,options}); return {ok:!fail,json:async()=>url.endsWith('/catalog')?definitionsOverride:{owner:'alice',...snapshot}}; }});
    return { nodes,calls,browser,setOwner(value){owner=value;},fail(){fail=true;} };
}
test('browser renders all 71, filters categories, shows real progress and uses credentialed GET only', async () => {
    const f=fixture({version:1,records:[{id:'gameplay.resourceful_survivor',progress:2}]});
    try {
        await f.browser.refresh(); assert.equal(f.nodes['achievements-grid'].children.length,71);
        assert.match(f.nodes['achievement-sync-status'].textContent,/0\/64.*7 reserved/);
        f.nodes['achievement-category'].value='Collection'; f.nodes['achievement-category'].listeners.change();
        assert.equal(f.nodes['achievements-grid'].children.length,2);
        assert.ok(f.calls.every(call=>call.options.credentials==='include'&&!call.options.method&&!call.options.body));
    } finally {f.browser.stop();}
});
test('completed-only preview expands and collapses; locked details stay concealed in the full catalog', async () => {
    const f=fixture({version:1,records:[{id:definitions[0].id,progress:definitions[0].target}]},catalog,true);
    try {
        await f.browser.refresh();
        const grid=f.nodes['achievements-grid'];
        assert.equal(grid.children.length,1);
        assert.equal(grid.children[0].children[1].children[0].textContent,definitions[0].title);
        f.nodes['achievement-view-all'].listeners.click();assert.equal(grid.children.length,71);
        assert.equal(f.nodes['achievement-view-all'].textContent,'Show completed achievements');
        for(const card of grid.children.slice(1)) {
            assert.equal(card.children[0].textContent,'?');
            assert.equal(card.children[1].children[0].textContent,'???');
            assert.equal(card.children[1].children[1].textContent,'???');
        }
        f.nodes['achievement-view-all'].listeners.click();assert.equal(grid.children.length,1);
        f.nodes['achievement-category'].value='Collection';f.nodes['achievement-category'].listeners.change();
        assert.equal(grid.children.length,1);
        assert.equal(grid.children[0].textContent,'No completed achievements in this category yet.');
    } finally { f.browser.stop(); }
    assert.equal(f.nodes['achievement-view-all'].listeners.click,undefined);
});
test('completed achievements beyond the first six catalog entries are shown without inventing progress',async()=>{
 const late=definitions.filter(def=>def.available&&def.authority!=='server_perks').at(-1);
 const f=fixture({version:1,records:[{id:late.id,progress:late.target}]},catalog,true);
 try{await f.browser.refresh();const cards=f.nodes['achievements-grid'].children;
  assert.equal(cards.length,1);assert.equal(cards[0].children[1].children[0].textContent,late.title);
  assert.match(f.nodes['achievement-sync-status'].textContent,/1\/64/);
  assert.ok(f.calls.every(call=>!call.options.method&&!call.options.body));
 }finally{f.browser.stop();}
});
test('empty completed preview is explicit; at most six earned cards appear and View all retains all entries',async()=>{
 const empty=fixture({version:1,records:[]},catalog,true);
 try{await empty.browser.refresh();assert.equal(empty.nodes['achievements-grid'].children[0].textContent,'No completed achievements yet.');
  empty.nodes['achievement-view-all'].listeners.click();assert.equal(empty.nodes['achievements-grid'].children.length,71);
 }finally{empty.browser.stop();}
 const earned=definitions.filter(def=>def.available&&def.authority!=='server_perks').slice(0,8);
 const f=fixture({version:1,records:earned.map(def=>({id:def.id,progress:def.target}))},catalog,true);
 try{await f.browser.refresh();const grid=f.nodes['achievements-grid'];assert.equal(grid.children.length,6);
  assert.ok(grid.children.every(card=>card.children[0].textContent==='✓'));assert.match(f.nodes['achievement-sync-status'].textContent,/8\/64/);
  f.nodes['achievement-view-all'].listeners.click();assert.equal(grid.children.length,71);
 }finally{f.browser.stop();}
});

test('unavailable server never appears as a successful locked or reset account', async () => {
    const f=fixture();try {f.fail();await f.browser.refresh();
        assert.match(f.nodes['achievement-sync-status'].textContent,/unavailable.*not been reset/);
        assert.equal(f.nodes['achievements-grid'].children.length,0);
    } finally {f.browser.stop();}
});
test('catalog strings are text, not HTML; logout/account changes ignore stale responses', async () => {
    const injected=structuredClone(catalog); injected.definitions[0].title='<img src=x onerror=alert(1)>';
    const f=fixture({version:1,records:[{id:definitions[0].id,progress:1}]},injected);
    try {
        await f.browser.refresh();
        const title=f.nodes['achievements-grid'].children[0].children[1].children[0];
        assert.equal(title.textContent,injected.definitions[0].title); assert.equal(title.children.length,0);
        f.browser.stop(); await f.browser.refresh(); assert.equal(f.nodes['achievements-grid'].children.length,0);
    } finally {f.browser.stop();}
    const other=fixture();other.setOwner('bob');await other.browser.refresh();
    assert.equal(other.nodes['achievements-grid'].children.length,0);other.browser.stop();
    const switched=fixture({version:1,owner:'bob',records:[{id:definitions[0].id,progress:1}]});
    try { await switched.browser.refresh(); assert.equal(switched.nodes['achievements-grid'].children.length,0);
        assert.match(switched.nodes['achievement-sync-status'].textContent,/unavailable/);
    } finally { switched.browser.stop(); }
});
test('dashboard removes placeholder/get-stats and loads achievement module before dashboard', () => {
    const js=fs.readFileSync('dashboard.js','utf8'), html=fs.readFileSync('dashboard.html','utf8');
    assert.doesNotMatch(js,/ACHIEVEMENT_DEFS|renderAchievements|get-stats|Diamond Miner|First Steps/);
    assert.ok(html.indexOf('src="achievements.js"')<html.indexOf('src="dashboard.js"'));
    assert.match(js,/achievementBrowser\?\.stop\(\)/);
});
