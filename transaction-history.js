/* Authenticated read-only transaction browser. Never grants or reconciles funds. */
(function(root){
 'use strict';
 function mount({document,apiBase,owner,currentOwner,fetch:request=root.fetch.bind(root)}){
  const el=id=>document.getElementById(id),items=el('history-items'),status=el('history-status'),filter=el('history-filter'),more=el('history-more'),refresh=el('history-refresh');
  if(!items||!status||!filter||!more||!refresh)return null;
  let stopped=false,generation=0,cursor=null,seen=new Set(),busy=false,mode=null;
  const same=()=>!stopped&&currentOwner()===owner;
  const node=(tag,text,css)=>{const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n;};
  function clear(){items.replaceChildren();seen.clear();cursor=null;more.hidden=true;}
  function validate(data){
   if(!data||data.version!==1||data.owner!==owner||!['test','live'].includes(data.environment)||!Array.isArray(data.items)||data.items.length>20||
    data.next_cursor!==null&&(typeof data.next_cursor!=='string'||data.next_cursor.length>600))throw new Error('History could not be verified.');
   const ids=new Set();for(const row of data.items){
    if(!row||typeof row.id!=='string'||row.id.length>100||ids.has(row.id)||!['topup','spend','reward'].includes(row.type)||
     typeof row.description!=='string'||row.description.length>200||!Number.isSafeInteger(row.amount)||
     !['completed','pending','processing','expired'].includes(row.status)||row.created_at!==null&&(typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at)))||
     row.type==='spend'&&(row.amount>=0||row.status!=='completed')||row.type==='reward'&&(row.amount<=0||row.status!=='completed')||
     row.type==='topup'&&(row.amount<0||!Number.isSafeInteger(row.price_centavos)||row.price_centavos<1||!Number.isSafeInteger(row.medals)||row.medals<1)||
     row.type==='topup'&&row.status==='completed'&&row.amount!==row.medals||
     row.status!=='completed'&&row.amount!==0)throw new Error('History could not be verified.');
    ids.add(row.id);
   }return data;
  }
  function render(rows){for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);
   const card=node('article','','forge-transaction'),details=node('div',''),title=node('h3',row.description);
   const when=row.created_at?new Date(row.created_at).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}):'Date unknown';
   details.append(title,node('p',when+' · '+({completed:'Completed',pending:'Pending confirmation',processing:'Processing',expired:'Expired'})[row.status]));
   if(row.type==='topup')details.append(node('p',row.medals.toLocaleString()+' FM · '+new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(row.price_centavos/100)));
   const text=row.status==='completed'?(row.amount>0?'+':'−')+Math.abs(row.amount).toLocaleString()+' FM':'Not credited';
   const amount=node('div',text,'forge-transaction__amount'+(row.amount<0?' forge-transaction__amount--debit':''));
   card.append(details,amount);items.append(card);
  }}
  async function load(append=false){
   if(!same()){clear();status.textContent='';return;}
   if(append&&(!cursor||busy))return;
   const attempt=++generation,after=append?cursor:null;busy=true;refresh.disabled=true;more.disabled=true;
   if(!append)clear();status.textContent='Loading your transactions…';
   try{
    const query=new URLSearchParams({limit:'20',type:filter.value||'all'});if(after)query.set('cursor',after);
    const response=await request(apiBase+'/wallet/history?'+query,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000)});
    const data=validate(await response.json());if(!same()){clear();status.textContent='';return;}if(attempt!==generation)return;
    if(after&&data.next_cursor===after)throw new Error('Repeated cursor rejected.');
    if(!response.ok||append&&mode!==data.environment)throw new Error('History unavailable.');
    mode=data.environment;render(data.items);cursor=data.next_cursor;more.hidden=!cursor;
    status.textContent=(seen.size?'Latest transactions first.':'No transactions yet.')+' Use Refresh to update.';
   }catch{if(!same()){clear();status.textContent='';}else if(attempt===generation){if(!append)clear();status.textContent='Transaction history unavailable. Your balance and records have not been reset. Retry to refresh.';}}
   finally{if(attempt===generation){busy=false;refresh.disabled=false;more.disabled=false;}}
  }
  const reload=()=>load(false),next=()=>load(true);
  refresh.addEventListener('click',reload);filter.addEventListener('change',reload);more.addEventListener('click',next);
  reload();return{stop(){stopped=true;generation++;clear();status.textContent='';refresh.removeEventListener('click',reload);filter.removeEventListener('change',reload);more.removeEventListener('click',next);}};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={mount};else root.StoneForgeTransactions={mount};
})(typeof window!=='undefined'?window:globalThis);
