'use strict';
// Mechanical web exports only; original artwork is retained. sharp is authoring-only.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
async function run(){
 const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
 const target=path.join(root,'Assets/store/web');fs.mkdirSync(target,{recursive:true});
 let before=0,after=0;
 for(const name of ['fm-handful','fm-pouch','fm-crate','fm-chest']){
  const source=path.join(root,'Assets/store',name+'.png'),file=path.join(target,name+'.webp');
  await sharp(source).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).webp({quality:85,alphaQuality:100,effort:6}).toFile(file);
  const original=fs.statSync(source).size,output=fs.statSync(file).size;before+=original;after+=output;
  const metadata=await sharp(file).metadata();if(!metadata.hasAlpha||metadata.width>512||metadata.height>512)throw Error('Invalid transparent web export');
  console.log(JSON.stringify({name,source_bytes:original,web_bytes:output,width:metadata.width,height:metadata.height,alpha:metadata.hasAlpha}));
 }
 console.log(JSON.stringify({source_bytes:before,web_bytes:after,reduction_percent:Math.round((1-after/before)*100)}));
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
