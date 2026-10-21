'use strict';
// Mechanical exports from the supplied logo. Requires sharp for authoring only.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.join(__dirname,'..'),source=path.join(root,'Assets','brand','stoneforge-logo.png');
(async()=>{
 const frames=[];
 for(const size of [16,32,48]){
  const data=await sharp(source).resize(size,size,{fit:'contain',background:'#00000000'}).png().toBuffer();
  frames.push({size,data});
  if(size!==48)fs.writeFileSync(path.join(root,`favicon-${size}x${size}.png`),data);
 }
 const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
 let offset=header.length;
 frames.forEach(({size,data},i)=>{const at=6+i*16;header[at]=header[at+1]=size;header.writeUInt16LE(1,at+4);
  header.writeUInt16LE(32,at+6);header.writeUInt32LE(data.length,at+8);header.writeUInt32LE(offset,at+12);offset+=data.length;});
 fs.writeFileSync(path.join(root,'favicon.ico'),Buffer.concat([header,...frames.map(f=>f.data)]));
 await sharp(source).resize(180,180,{fit:'contain',background:'#00000000'}).png().toFile(path.join(root,'apple-touch-icon.png'));
 console.log('Exported transparent 16/32 PNG, 16/32/48 ICO and 180px touch icon from the supplied logo.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
