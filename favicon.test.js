'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const png=path=>{const data=fs.readFileSync(path);assert.equal(data.subarray(1,4).toString(),'PNG');return{width:data.readUInt32BE(16),height:data.readUInt32BE(20),alpha:data[25]===6};};
test('supplied logo and exported PNG icons have correct dimensions and alpha channels',()=>{
 for(const [path,size] of [['Assets/brand/stoneforge-logo.png',500],['favicon-16x16.png',16],['favicon-32x32.png',32],['apple-touch-icon.png',180]])
  assert.deepEqual(png(path),{width:size,height:size,alpha:true});
});
test('ICO contains bounded 16/32/48px PNG frames',()=>{
 const data=fs.readFileSync('favicon.ico');assert.equal(data.readUInt16LE(0),0);assert.equal(data.readUInt16LE(2),1);assert.equal(data.readUInt16LE(4),3);
 [16,32,48].forEach((size,i)=>{const at=6+i*16,length=data.readUInt32LE(at+8),offset=data.readUInt32LE(at+12);
  assert.equal(data[at],size);assert.equal(data[at+1],size);assert.ok(offset+length<=data.length);assert.equal(data.subarray(offset+1,offset+4).toString(),'PNG');});
});
test('every website page declares the new local favicons and touch icon',()=>{
 const files=fs.readdirSync('.').filter(path=>path.endsWith('.html'));assert.equal(files.length,8);
 for(const path of files){const html=fs.readFileSync(path,'utf8');for(const asset of ['favicon.ico','favicon-16x16.png','favicon-32x32.png','apple-touch-icon.png'])assert.ok(html.includes(`href="${asset}?v=20261022"`),`${path}: ${asset}`);}
});
