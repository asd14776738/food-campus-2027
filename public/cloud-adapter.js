'use strict';
// Rules are generated from server.py so local and hosted versions share scope.
window.loadFoodCloud=async(current)=>{
 const config=window.FOOD_CLOUD;
 try{
  const response=await fetch(config.url+'?check='+Math.floor(Date.now()/60000),{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`源数据请求失败（${response.status}）`);
  const raw=await response.json();
  if(!raw||!Array.isArray(raw.data)||!raw.data.length)throw new Error('源数据格式异常');
  const rows=new Map(),decode=value=>{const box=document.createElement('textarea');box.innerHTML=String(value||'');return box.value;};
  for(const item of raw.data){
   if(!item||typeof item.company!=='string')throw new Error('源数据企业字段异常');
   let industry=config.groups.find(([,pattern])=>new RegExp(pattern,'i').test(item.company))?.[0];
   if(!industry&&item.cat==='餐饮茶饮')industry='餐饮茶饮';
   if(!industry&&/食品|农牧/.test(item.cat||''))industry='食品制造';
   if(!industry&&/食品|乳制品|烘焙|肉制品|调味品|饮料|生鲜|饲料/.test(item.note||'')&&['快消','零售','农业'].includes(item.cat))industry='食品制造';
   if(!industry)continue;
   const row=Object.fromEntries(['company','cat','date','roles','note','portal','source'].map(key=>[key,decode(item[key])]));
   row.industry=industry;
   row.id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.company.trim())))).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,16);
   rows.set(row.id,row);
  }
  if(!rows.size)throw new Error('筛选结果为空，保留现有数据');
  const snapshot={source:config.source,rev:raw.rev||'',sourceUpdated:raw.updated||'',syncedAt:new Date().toISOString(),rows:[...rows.values()].sort((a,b)=>b.date.localeCompare(a.date))};
  return{data:snapshot,sync:{ok:true,checkedAt:snapshot.syncedAt,count:snapshot.rows.length}};
 }catch(error){
  let fallback=current?.rows?.length?current:null;
  if(!fallback){
   const response=await fetch('./data.json',{cache:'no-store'});
   if(!response.ok)throw new Error('源数据和网站快照均暂时不可用，请稍后重试');
   fallback=await response.json();
   if(!Array.isArray(fallback.rows)||!fallback.rows.length)throw new Error('网站快照格式异常');
  }
  return{data:fallback,sync:{ok:false,error:'实时检查失败，使用最近快照：'+error.message}};
 }
};
