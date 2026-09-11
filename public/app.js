'use strict';
const $=id=>document.getElementById(id);
const KEY='food-campus-2027-progress-v1';
const states=['未投递','已投递','笔试','AI面试','面试','Offer','流程结束'];
const rolePatterns={'研发与品控':/研发|创研|品控|质量|质检|食品安全/,'生产与工艺':/生产|工艺|制造|设备/,'供应链与采购':/供应链|采购|物流|仓储/,'市场与销售':/市场|销售|营销|电商|品牌/,'管培生':/管培|培训生|储备|管理培训/};
let data={rows:[]},sync={},progress={},industry='全部',view='all',visible=[];
const kindLabel=r=>({portal:'招聘入口 · 当届待确认',announcement:'2027校招公告',internship:'2027实习线索',upstream:'原项目收录 · 状态待核实'}[r.kind]||'原项目收录 · 状态待核实');
const sectors=r=>r.industries||[r.industry];
const fromSupplement=r=>r.kind!=='upstream'||!!r.catalogSource;
const viewName=()=>({all:'招聘机会',companies:'企业库',websites:'招聘网站',mine:'我的投递'}[view]);
try{progress=JSON.parse(localStorage.getItem(KEY)||'{}');if(!progress||Array.isArray(progress)||typeof progress!=='object')progress={};}catch{progress={};}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE');
const saved=id=>progress[id]||{status:'未投递',favorite:false,history:[],note:''};
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(progress));return true;}catch{notify('浏览器存储失败，请立即导出备份，避免进度丢失。');return false;}}
function link(text){const m=String(text||'').match(/https?:\/\/[^\s｜<>"）]+/);if(!m)return '';try{const u=new URL(m[0]);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}}
function openDialog(title,body){$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('dialog').showModal();}
function render(){
  const words=$('search').value.toLowerCase().trim().split(/\s+/).filter(Boolean),pattern=rolePatterns[$('role').value];
  const isWeb=view==='websites',scope=data.rows.filter(r=>view!=='all'||r.kind!=='portal');
  const options=['全部',...new Set(isWeb?(data.websites||[]).map(w=>w.category):scope.flatMap(sectors))];
  if(!options.includes(industry))industry='全部';
  $('industries').innerHTML=options.map(x=>`<button class="${x===industry?'active':''}" aria-pressed="${x===industry}" data-category="${esc(x)}">${esc(x)}</button>`).join('');
  visible=scope.filter(r=>(industry==='全部'||sectors(r).includes(industry))&&(!$('supplemental').checked||fromSupplement(r))&&(!pattern||pattern.test(r.roles))&&(!$('favorites').checked||saved(r.id).favorite)&&(view!=='mine'||saved(r.id).status!=='未投递')&&words.every(w=>`${r.company} ${(r.aliases||[]).join(' ')} ${r.roles} ${r.note} ${sectors(r).join(' ')}`.toLowerCase().includes(w)));
  $('total').textContent=data.rows.length;$('research').textContent=data.rows.filter(r=>r.kind!=='portal'&&rolePatterns['研发与品控'].test(r.roles)).length;
  $('applied').textContent=Object.values(progress).filter(p=>p.status&&p.status!=='未投递').length;
  $('results').textContent=`${viewName()} · 显示 ${visible.length} / ${scope.length} 家企业`;
  $('scope-note').textContent=isWeb?'按渠道查找更多机会。招聘网站导航不等于已自动抓取所有职位；企业与公告仍在持续补充。':view==='companies'?'企业库含已有招聘公告和长期招聘入口。跨业务企业支持多个分类；“当届待确认”不代表2027届岗位已开放。':'收录2027校招公告、实习线索及原项目信息。未公布截止日期的岗位，请进入招聘入口确认当前能否投递。';
  $('company-table').hidden=isWeb;$('website-list').hidden=!isWeb;$('role').disabled=isWeb;$('favorites').closest('label').hidden=isWeb;$('csv').hidden=isWeb;
  $('supplemental').closest('label').hidden=isWeb;
  if(!isWeb)$('scope-note').textContent=`本站跨网站检索补充 ${scope.filter(fromSupplement).length} 家 · `+$('scope-note').textContent;
  if(isWeb){const sites=(data.websites||[]).filter(w=>(industry==='全部'||industry===w.category)&&words.every(word=>`${w.name} ${w.category} ${w.note}`.toLowerCase().includes(word)));
    $('website-list').innerHTML=sites.map(w=>`<article><small>${esc(w.category)}</small><h2><a href="${esc(link(w.url))}" target="_blank" rel="noopener noreferrer">${esc(w.name)} ↗</a></h2><p>${esc(w.note)}</p></article>`).join('');
    $('results').textContent=`招聘网站 · ${sites.length} / ${(data.websites||[]).length} 个渠道`;$('empty').hidden=sites.length>0;
  }
  if(!isWeb)$('empty').hidden=visible.length>0;
  $('rows').innerHTML=visible.map(r=>{const p=saved(r.id),url=link(r.portal);return `<tr data-id="${r.id}"><td><button class="company" data-action="detail">${esc(r.company)}</button><small>${esc(r.industry)}</small></td><td><div class="role-text">${esc(r.roles||'岗位待公布')}</div><button class="details" data-action="detail">查看招聘详情</button></td><td>${esc(r.date||'未公布')}<small>来源记录的开启时间</small></td><td>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">查看招聘 ↗</a>`:`<button class="details" data-action="detail">${r.portal?'查看投递方式':'入口待公布'}</button>`}<small>${r.source?'附信息来源':'上游收录 · 未独立核验'}</small></td><td><select aria-label="${esc(r.company)}投递进度" data-action="status">${states.map(s=>`<option${p.status===s?' selected':''}>${s}</option>`).join('')}</select><small>${esc(p.history?.at(-1)?.date||'')}</small></td><td><button class="star ${p.favorite?'on':''}" data-action="favorite" aria-label="${p.favorite?'取消收藏':'收藏'}${esc(r.company)}" aria-pressed="${!!p.favorite}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.55 4.44 1.08 6.27L12 17.35l-5.63 2.96 1.08-6.27L2.9 9.6l6.3-.9Z"/></svg></button></td></tr>`;}).join('');
  for(const tr of $('rows').children){const r=data.rows.find(x=>x.id===tr.dataset.id);tr.querySelector('td small').textContent=sectors(r).join(' · ');tr.children[1].querySelector('.role-text').textContent=r.roles||(r.kind==='portal'?'查看企业招聘入口，筛选食品相关岗位':'岗位待公布');const badge=document.createElement('small');badge.className='kind '+(r.kind==='portal'?'pending':'');badge.textContent=kindLabel(r);tr.children[1].append(badge);tr.children[2].innerHTML=esc(r.date||'未标明')+'<small>'+(r.kind==='upstream'?'原项目记录日期':r.checkedAt?'核对于 '+esc(r.checkedAt):'')+'</small>';tr.children[3].querySelector('small').textContent=r.sourceType||'原项目收录';}
  $('sync').textContent=`数据版本 ${data.rev||'—'} · 补充目录 ${data.catalogUpdated||'—'} · 最近同步 ${data.syncedAt?new Date(data.syncedAt).toLocaleString('zh-CN'):'尚未同步'}${sync.ok===false?' · 同步失败：'+sync.error+'（保留上次数据）':''}`;
  $('sync').classList.toggle('error',sync.ok===false);
}
function detail(id){const r=data.rows.find(x=>x.id===id),p=saved(id);if(!r)return;const source=link(r.source),portal=link(r.portal);
  openDialog(r.company,`<p><strong>${esc(r.industry)} · 2027届校招收录</strong></p><p>岗位方向：${esc(r.roles||'未公布')}</p><p>开启时间：${esc(r.date||'未公布')}</p><p>${esc(r.note||'上游未提供详细说明。')}</p><p>投递方式：${esc(r.portal||'未公布，请查询企业官方招聘渠道。')}</p>${portal?`<p><a target="_blank" rel="noopener noreferrer" href="${esc(portal)}">打开招聘入口 ↗</a></p>`:''}<p>信息来源：${source?`<a target="_blank" rel="noopener noreferrer" href="${esc(source)}">查看原始信息 ↗</a>`:`<a target="_blank" rel="noopener noreferrer" href="${esc(data.source)}">2027qiuzhao 项目收录</a>（未附原始公告）`}</p><p class="disclaimer">本页未独立确认当前开放状态；岗位、专业、地点、截止日期请以官方公告为准。综合集团需确认具体食品业务岗位。</p><h3>我的记录</h3><p>${(p.history||[]).map(h=>`${esc(h.date)} · ${esc(h.status)}`).join('<br>')||'尚无投递记录'}</p><label for="note">个人备注</label><textarea id="note" rows="4" maxlength="5000" placeholder="记录岗位、面试安排或注意事项">${esc(p.note||'')}</textarea><button id="save-note">保存备注</button>`);
  const paragraphs=$('dialog-body').querySelectorAll(':scope > p');
  paragraphs[0].textContent=sectors(r).join(' · ')+' · '+kindLabel(r);
  paragraphs[2].textContent='公告日期：'+(r.date||'未标明')+(r.checkedAt?'；内容核对日期：'+r.checkedAt:'');
  const disclaimer=$('dialog-body').querySelector('.disclaimer');
  if(r.deadline){const deadline=document.createElement('p');deadline.textContent='公告明确的网申截止日期：'+r.deadline;disclaimer.before(deadline);}
  disclaimer.textContent=r.kind==='portal'?'此条仅为招聘入口，尚未确认2027届当前开放岗位；请筛选届别、专业与工作经验。':r.kind==='upstream'?'原项目收录，本站尚未逐条核实当前开放状态；请以企业职位页为准。':'已核对公告中的届别与食品相关方向；未标明截止日期不代表长期有效，当前名额和专业要求以企业职位页为准。';
  if(r.catalogSource){const supplement=document.createElement('p');supplement.textContent='补充信息（'+r.catalogCheckedAt+'）：'+r.catalogNote;const a=document.createElement('a');a.href=link(r.catalogSource);a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 查看补充来源 ↗';supplement.append(a);disclaimer.before(supplement);}
  $('save-note').onclick=()=>{progress[id]={...saved(id),note:$('note').value,company:r.company};persist();notify('备注已保存');};
}
async function load(){if(window.FOOD_CLOUD){const result=await window.loadFoodCloud(data);data=result.data;sync=result.sync;render();return;}const response=await fetch('/api/data');if(!response.ok)throw new Error('读取本地数据失败');const result=await response.json();if(!Array.isArray(result.data.rows))throw new Error('尚无招聘数据，请点击立即更新');data=result.data;sync=result.sync;render();}
function download(filename,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('industries').onclick=e=>{if(e.target.tagName!=='BUTTON')return;industry=e.target.dataset.category;render();};
for(const id of ['search','role','favorites','supplemental'])$(id).addEventListener(id==='search'?'input':'change',render);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;industry='全部';$('search').value='';$('role').value='';$('favorites').checked=false;$('supplemental').checked=false;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));render();});
$('rows').onclick=e=>{const button=e.target.closest('button[data-action]');if(!button)return;const id=button.closest('tr').dataset.id;if(button.dataset.action==='detail')detail(id);if(button.dataset.action==='favorite'){progress[id]={...saved(id),favorite:!saved(id).favorite,company:data.rows.find(r=>r.id===id).company};persist();render();}};
$('rows').onchange=e=>{if(e.target.dataset.action!=='status')return;const id=e.target.closest('tr').dataset.id,p=saved(id);progress[id]={...p,status:e.target.value,company:data.rows.find(r=>r.id===id).company,history:[...(p.history||[]),{status:e.target.value,date:today()}]};persist();render();};
$('close').onclick=()=>$('dialog').close();
$('update').onclick=async()=>{const b=$('update');b.disabled=true;b.textContent='正在同步…';try{if(window.FOOD_CLOUD){await load();if(!sync.ok)throw new Error(sync.error);notify('实时检查完成，收录 '+data.rows.length+' 家企业');return;}const r=await fetch('/api/update',{method:'POST',headers:{'X-Food-Campus':'1'}}),result=await r.json();await load();if(!r.ok||!result.ok)throw new Error(result.error||'同步失败');notify(`同步完成，收录 ${result.count} 家企业`);}catch(e){notify(e.message);}finally{b.disabled=false;b.textContent='立即更新';}};
$('backup').onclick=()=>download(`食品校招备份-${today()}.json`,JSON.stringify({app:'food-campus-2027',version:1,exportedAt:new Date().toISOString(),progress},null,2),'application/json;charset=utf-8');
$('restore').onclick=()=>$('restore-file').click();
$('restore-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5_000_000)throw new Error('备份文件超过 5 MB');const b=JSON.parse(await file.text());if(b.app!=='food-campus-2027'||b.version!==1||!b.progress||Array.isArray(b.progress)||typeof b.progress!=='object')throw new Error('不是有效的网站备份');const clean={};for(const [id,p] of Object.entries(b.progress)){if(!/^[a-f0-9]{16}$/.test(id)||!p||!states.includes(p.status)||typeof p.favorite!=='boolean'||!Array.isArray(p.history)||p.history.some(h=>!h||!states.includes(h.status)||!/^\d{4}-\d{2}-\d{2}$/.test(h.date)))throw new Error('备份中存在无效记录');clean[id]={status:p.status,favorite:p.favorite,history:p.history,note:String(p.note||'').slice(0,5000),company:String(p.company||'')};}progress={...progress,...clean};persist();render();notify(`已恢复 ${Object.keys(clean).length} 条记录`);}catch(error){notify('恢复失败：'+error.message);}finally{e.target.value='';}};
$('csv').onclick=()=>{const cell=s=>{s=String(s??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const lines=[['公司','行业','岗位','开启时间','招聘入口','来源','投递状态','最近记录','备注'],...visible.map(r=>{const p=saved(r.id);return[r.company,r.industry,r.roles,r.date,r.portal,r.source,p.status,p.history?.at(-1)?.date||'',p.note||''];})];download(`食品校招-${today()}.csv`,'\ufeff'+lines.map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
window.addEventListener('storage',e=>{if(e.key===KEY){try{progress=JSON.parse(e.newValue||'{}');render();}catch{}}});
load().catch(e=>{$('results').textContent=e.message;$('results').classList.add('error');});
setInterval(()=>load().catch(()=>{}),60000);
$('about').onclick=()=>openDialog('数据来源、分类与更新',`<p>数据来自原2027qiuzhao项目，以及企业招聘官网、高校就业网和招聘平台的补充检索。招聘机会展示公告与实习线索；企业库还包括当届开放状态待确认的招聘入口。招聘网站页用于继续查找，尚未自动抓取这些网站的全部职位。</p><p>按实际业务细分，乳制品、非乳饮料、酒类分别筛选。百事公司属于非乳饮料与休闲食品；多业务集团可有多个标签。食品综合表示跨业务或尚无法进一步细分。</p><p>${window.FOOD_CLOUD?'网页每分钟检查原项目和已部署的补充目录。GitHub Actions每5分钟计划更新快照，调度可能延迟。电脑关机不影响网站访问和云端源同步。':'本地服务每日同步，启动时补检；浏览器每分钟读取本地数据。电脑需开机联网。'} 补充检索按每日任务进行，新增企业需核对原公告后加入，不能保证覆盖全网或秒级更新。</p><p>核对日期是人工检索时间，最近同步是获取数据时间，两者都不代表岗位仍开放。原文未写截止日期时不猜测；旧届校招不当作2027公告。官网入口、实习和正式校招各自标明。</p><p>进度、收藏与备注仅保存在当前浏览器，不会上传GitHub。线上和本地记录独立，可导出备份并在另一网址恢复。</p>`);
