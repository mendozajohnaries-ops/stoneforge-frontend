/* Free Tutorial download is independent of account/Full Game ownership checks. */
(function(root){
 'use strict';
 const RELEASE=Object.freeze({file_name:'StoneForgeTutorialSetup.exe',version:'0.1.0',size_bytes:103426838,
  sha256:'ab8e479d4f1a0c8c21b8cb40009cefea53d4616edf8fb8996acfde92e12b19dd',expires_in:300});
 function validDownload(data){
  if(!data||data.success!==true||data.file_name!==RELEASE.file_name||data.version!==RELEASE.version||
    data.size_bytes!==RELEASE.size_bytes||data.sha256!==RELEASE.sha256||data.expires_in!==RELEASE.expires_in)return false;
  try{
   const url=new URL(data.download_url);
   return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash&&
    /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname)&&
    url.pathname==='/stoneforge-demo/'+RELEASE.file_name&&
    url.searchParams.get('X-Amz-Algorithm')==='AWS4-HMAC-SHA256'&&
    url.searchParams.get('X-Amz-Expires')==='300'&&
    url.searchParams.get('X-Amz-SignedHeaders')==='host'&&
    url.searchParams.get('response-content-disposition')==='attachment; filename="'+RELEASE.file_name+'"'&&
    /^[a-f0-9]{64}$/.test(url.searchParams.get('X-Amz-Signature')||'');
  }catch{return false;}
 }
 function mount({document,apiBase,fetch:request=root.fetch.bind(root),setTimeout:schedule=setTimeout,clearTimeout:cancel=clearTimeout,
  maintenance=root.StoneForgeDownloadMaintenance}){
  const button=document.getElementById('tutorial-download'),note=document.getElementById('tutorial-note');
  if(!button||!note)return null;
  let busy=false,stopped=false,controller;
  // Missing policy fails closed, including a partially cached/script-error page.
  const paused=maintenance?.enabled!==false;
  function showMaintenance(){button.disabled=true;button.textContent='Under Maintenance';button.setAttribute('aria-busy','false');
   note.textContent='StoneForge downloads are temporarily paused while we prepare and test the unified build.';}
  function ready(){if(paused){showMaintenance();return;}button.disabled=false;button.textContent='⬇ Download Free Trial';button.setAttribute('aria-busy','false');}
  async function download(){
   if(paused){showMaintenance();return;}
   if(busy||stopped)return;
   busy=true;button.disabled=true;button.textContent='Preparing Tutorial…';button.setAttribute('aria-busy','true');
   note.textContent='Preparing a fresh installer link. No account or purchase required.';
   controller=new AbortController();const pending=controller;
   const deadline=schedule(()=>pending.abort(),20000);
   try{
    const response=await request(apiBase+'/download/tutorial',{method:'POST',credentials:'omit',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:'{}',signal:pending.signal});
    const data=await response.json();
    if(stopped)return;
    if(!response.ok||!validDownload(data))throw new Error('Tutorial unavailable.');
    // Navigate directly to the signed attachment: no large JS blob, public bucket or browser R2 CORS required.
    const link=document.createElement('a');link.href=data.download_url;link.download=RELEASE.file_name;
    link.rel='noreferrer';link.referrerPolicy='no-referrer';
    document.body.appendChild(link);link.click();link.remove();
    note.textContent='Download requested. Check your browser downloads; click again for a fresh link if needed.';
   }catch(error){
    if(!stopped)note.textContent='Tutorial download unavailable. Please wait and retry. No account or purchase is required.';
   }finally{cancel(deadline);busy=false;if(!stopped)ready();}
  }
  if(!paused)button.addEventListener('click',download);ready();if(!paused)note.textContent='Free Tutorial · No account or purchase required';
  return{download,stop(){stopped=true;controller?.abort();button.removeEventListener('click',download);}};
 }
 const api={RELEASE,validDownload,mount};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else{root.StoneForgeTutorialDownload=api;mount({document:root.document,apiBase:'https://stoneforge-backend.onrender.com/api'});}
})(typeof window!=='undefined'?window:globalThis);
