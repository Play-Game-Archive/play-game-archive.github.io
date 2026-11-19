(()=>{'use strict';
const ROOT=new URL(document.querySelector('meta[name=site-root]')?.content||'./',location.href),ROWS=window.LIBRARY_DATA||[],BY=new Map(ROWS.map(r=>[r.id,r]));
const body=document.querySelector('#reading-body'),entryId=document.querySelector('[data-entry].reading-shell')?.dataset.entry||null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timestamp=s=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(s));
function fold(value){let text='',map=[],offset=0;const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].map(x=>[x.segment,x.index]):Array.from(value).map(ch=>{const v=[ch,offset];offset+=ch.length;return v;});for(const [part,start]of segments){const f=part.normalize('NFKC').toLowerCase().replace(/\s/g,'');text+=f;for(let i=0;i<f.length;i++)map.push({start,end:start+part.length});}return{text,map};}
function locate(note,text,anchorRange=null){
 const a=fold(text),q=fold(note.quote||'').text;if(!q)return{mode:'unresolved'};const matches=[];let at=0;const pre=fold(note.prefix||'').text.slice(-64),post=fold(note.suffix||'').text.slice(0,64);
 while((at=a.text.indexOf(q,at))>=0){const start=a.map[at].start,end=a.map[at+q.length-1].end;let score=0;const before=a.text.slice(Math.max(0,at-64),at),after=a.text.slice(at+q.length,at+q.length+64);for(let n=1;n<=pre.length;n++)if(before.endsWith(pre.slice(-n)))score++;for(let n=1;n<=post.length;n++)if(after.startsWith(post.slice(0,n)))score++;if(anchorRange&&start>=anchorRange.start&&end<=anchorRange.end)score+=200;score-=Math.abs(start-(note.start||0))/Math.max(1000,text.length);matches.push({start,end,score,mode:text.slice(start,end)===note.quote?'exact':'normalized'});at+=Math.max(1,q.length);}
 if(matches.length){matches.sort((x,y)=>y.score-x.score);if(matches.length>1&&matches[0].score-matches[1].score<2&&!anchorRange)return{mode:'unresolved'};return matches[0];}
 if(anchorRange)return{...anchorRange,mode:'paragraph'};
 return{mode:'unresolved'};
}
const account=window.LibraryAccount;
let noteStore=null;
function makeStore(userId=''){
 const suffix=userId?':account:'+userId:'',backupKey='markdang-note-backup'+suffix,memory=new Map();
 try{for(const n of JSON.parse(localStorage.getItem(backupKey)||'[]'))memory.set(n.id,n);}catch{}
 const dbPromise=new Promise(resolve=>{try{const r=indexedDB.open('markdang-library-notes'+suffix,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('notes')){const store=db.createObjectStore('notes',{keyPath:'id'});store.createIndex('entryId','entryId');}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);r.onblocked=()=>resolve(null);}catch{resolve(null);}});
 return {memory,dbPromise,backupKey};
}
if(!account)noteStore=makeStore();
async function dbRead(store=noteStore){
 if(!store)return [];
 const {memory,dbPromise}=store,db=await dbPromise;
 if(db)try{
  const rows=await new Promise((resolve,reject)=>{const r=db.transaction('notes').objectStore('notes').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  for(const n of rows){const own=memory.get(n.id);if(!own||(!own.dirty&&(n.version||0)>=(own.version||0)))memory.set(n.id,n);}
 }catch{}
 return [...memory.values()];
}
async function dbPut(note,store=noteStore){
 if(!store)return false;
 const {memory,dbPromise,backupKey}=store;memory.set(note.id,note);
 const db=await dbPromise;let durable=false;
 if(db)try{await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put(note);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});durable=true;}catch{}
 try{localStorage.setItem(backupKey,JSON.stringify([...memory.values()]));durable=true;}catch{}
 return durable;
}
const requireAccount=()=>!account||account.require('登录后即可保存和查看自己的笔记。');
let notes=[],placements=new Map(),selection=null,editing=null,relink=null,scope=entryId?'page':'all',syncText='';
const panel=document.createElement('aside');panel.className='notes-panel';panel.hidden=true;panel.setAttribute('aria-label','本地笔记');panel.innerHTML='<div class="notes-panel-head"><h2>笔记</h2><button data-note-close aria-label="关闭笔记">×</button></div><div class="notes-panel-actions"><button data-note-scope="page">本页</button><button data-note-scope="all">全部</button><button data-note-scope="trash">废纸篓</button><button data-note-backup>备份</button><button data-note-import>导入</button><input data-note-file type="file" accept="application/json,.json" hidden></div><div class="notes-editor" hidden><blockquote></blockquote><textarea aria-label="批注内容" placeholder="写下批注…"></textarea><div class="note-color-choices"><button data-note-color="yellow" aria-label="黄色高亮"></button><button data-note-color="blue" aria-label="蓝色高亮"></button><button data-note-color="rose" aria-label="粉色高亮"></button></div><div class="note-editor-actions"><button data-note-save>保存</button><button data-note-cancel>取消</button></div></div><div class="notes-list"></div><output class="notes-sync" aria-live="polite"></output>';document.body.append(panel);
const editor=panel.querySelector('.notes-editor'),input=editor.querySelector('textarea'),list=panel.querySelector('.notes-list'),status=panel.querySelector('output');let color='yellow';
const toolbar=document.createElement('div');toolbar.className='selection-notes-tools';toolbar.hidden=true;toolbar.innerHTML='<button data-note-highlight>高亮</button><button data-note-create>批注</button><button data-note-link hidden>关联到此处</button>';document.body.append(toolbar);toolbar.addEventListener('pointerdown',e=>e.preventDefault());
function openPanel(){if(!requireAccount())return;panel.hidden=false;document.body.classList.add('notes-open');renderList();}function closePanel(){panel.hidden=true;document.body.classList.remove('notes-open');}
function renderList(){const shown=notes.filter(n=>scope==='trash'?n.deleted:!n.deleted&&(scope==='all'||n.entryId===entryId));list.innerHTML=shown.length?shown.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(n=>{const p=placements.get(n.id);return `<article class="note-card" data-note-card="${esc(n.id)}"><button class="note-entry-link" data-note-jump="${esc(n.id)}">${esc(BY.get(n.entryId)?.chinese||BY.get(n.entryId)?.original||n.entryTitle||'原条目笔记')}</button><blockquote>${esc(n.quote)}</blockquote><strong>Ivan:</strong><p>${esc(n.body||'').replace(/\n/g,'<br>')}</p><time>${esc(timestamp(n.createdAt))}</time>${n.entryId===entryId&&p?.mode==='unresolved'?'<span class="note-position-state">原文位置待重新关联 · 笔记已保留</span>':n.entryId===entryId&&p?.mode==='paragraph'?'<span class="note-position-state">已定位到原段落 · 摘录文字有变化</span>':''}<div class="note-actions">${n.deleted?`<button data-note-restore="${esc(n.id)}">还原</button>`:`<button data-note-edit="${esc(n.id)}">编辑</button><button data-note-relink="${esc(n.id)}">重新关联</button><button data-note-delete="${esc(n.id)}">移到废纸篓</button>`}${n.conflict?`<button data-note-copy="${esc(n.id)}">另存副本</button>`:''}</div></article>`;}).join(''):'<p class="notes-empty">暂无笔记</p>';status.textContent=syncText;panel.querySelectorAll('[data-note-scope]').forEach(b=>{b.hidden=b.dataset.noteScope==='page'&&!entryId;b.setAttribute('aria-pressed',String(scope===b.dataset.noteScope));});}
async function refresh(store=noteStore){
 const items=await dbRead(store);if(store!==noteStore)return;
 notes=items;applyNotes();renderList();
}
async function noteRequest(value){
 if(account)return account.request('api/notes',value);
 const response=await fetch(new URL('api/notes',ROOT),value===undefined?undefined:{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)
 });
 if(!response.ok)throw Object.assign(new Error('本机笔记服务暂时不可用。'),{status:response.status});
 return response.json();
}
async function sync(note,store=noteStore){
 if(!store||store!==noteStore)return false;
 try{
  const value=await noteRequest({note,expectedVersion:note.version||null,delete:!!note.deleted});
  await dbPut({...value,dirty:false},store);
  if(store===noteStore){syncText=account?'已保存到当前账户':'已保存在本机';await refresh(store);}
  return true;
 }catch(error){
  if(error.status===409){
   await dbPut({...note,conflict:true},store);
   if(store===noteStore){syncText='此笔记有另一版本，当前草稿已保留，可另存副本。';await refresh(store);}
  }else if(store===noteStore){
   syncText=account?'同步暂时中断，重新连接后重试。':'本机同步暂时中断。';
   renderList();
  }
  return false;
 }
}
async function save(value){
 if(!requireAccount())return false;
 const store=noteStore,note={...value,author:'Ivan',updatedAt:new Date().toISOString(),dirty:true};
 const local=await dbPut(note,store);await refresh(store);
 const server=await sync(note,store);
 if(!local&&!server&&store===noteStore){
  openPanel();status.textContent='保存未成功，编辑内容仍保留在此页。';return false;
 }
 return true;
}
async function pull(store=noteStore){
 if(!store||store!==noteStore)return;
 try{
  const remote=await noteRequest(),local=await dbRead(store),by=new Map(local.map(n=>[n.id,n]));
  if(store!==noteStore)return;
  for(const n of remote){const own=by.get(n.id);if(!own?.dirty&&(!own||(n.version||0)>(own.version||0)))await dbPut({...n,dirty:false},store);}
  for(const draft of local.filter(n=>n.dirty&&!n.conflict))await sync(draft,store);
  await refresh(store);
 }catch{}
}
function textIndex(language='both'){const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),parts=[];let node,text='';while(node=walker.nextNode()){const parent=node.parentElement;if(parent.closest('script,style,button,.katex-html'))continue;if(language==='zh'&&parent.closest('.original,.heading-original')&&!parent.closest('pre'))continue;if(language==='original'&&parent.closest('.translation,.heading-chinese'))continue;parts.push({node,start:text.length,end:text.length+node.nodeValue.length});text+=node.nodeValue;}return{text,parts};}
function applyNotes(){if(!body)return;body.querySelectorAll('mark[data-user-note]').forEach(m=>m.replaceWith(...m.childNodes));body.normalize();const index=textIndex(),full=new Map(index.parts.map(p=>[p.node,p])),indexes=new Map([['both',index]]);placements.clear();const ranges=[];for(const note of notes.filter(n=>!n.deleted&&n.entryId===entryId)){const language=note.language||'both';if(!indexes.has(language))indexes.set(language,textIndex(language));const own=indexes.get(language),anchor=note.anchorId?document.getElementById(note.anchorId):null;const parts=anchor&&body.contains(anchor)?own.parts.filter(p=>anchor.contains(p.node)):[];const span=parts.length?{start:parts[0].start,end:parts.at(-1).end}:null;const found=locate(note,own.text,span);placements.set(note.id,found);if(found.mode==='exact'||found.mode==='normalized')for(const part of own.parts){if(part.start>=found.end||part.end<=found.start)continue;const whole=full.get(part.node);ranges.push({start:whole.start+Math.max(0,found.start-part.start),end:whole.start+Math.min(part.end-part.start,found.end-part.start),note});}}
 for(let i=index.parts.length-1;i>=0;i--){const p=index.parts[i],hits=ranges.filter(r=>r.start<p.end&&r.end>p.start).sort((a,b)=>a.start-b.start);if(!hits.length)continue;const points=new Set([0,p.end-p.start]);for(const h of hits){points.add(Math.max(0,h.start-p.start));points.add(Math.min(p.end-p.start,h.end-p.start));}const cuts=[...points].sort((a,b)=>a-b),fragment=document.createDocumentFragment();for(let j=0;j<cuts.length-1;j++){const a=cuts[j],b=cuts[j+1],value=p.node.nodeValue.slice(a,b),cover=hits.filter(h=>h.start<p.start+b&&h.end>p.start+a);if(cover.length){const mark=document.createElement('mark');mark.dataset.userNote=cover.map(x=>x.note.id).join(',');mark.className='user-note-highlight note-'+(cover[0].note.color||'yellow');mark.textContent=value;fragment.append(mark);}else fragment.append(document.createTextNode(value));}p.node.replaceWith(fragment);}
}
function capture(){if(!body)return;const sel=getSelection();if(!sel||sel.isCollapsed||!sel.rangeCount)return;const range=sel.getRangeAt(0);if(!body.contains(range.commonAncestorContainer))return;const language=document.documentElement.dataset.language||'both',index=textIndex(language),selected=[];for(const part of index.parts){if(!range.intersectsNode(part.node))continue;const a=part.node===range.startContainer?range.startOffset:0,b=part.node===range.endContainer?range.endOffset:part.node.nodeValue.length;if(b>a)selected.push({part,a,b});}if(!selected.length)return;const start=selected[0].part.start+selected[0].a,end=selected.at(-1).part.start+selected.at(-1).b,quote=index.text.slice(start,end);if(!quote.trim())return;let anchor=range.startContainer.parentElement.closest('[id]');if(!anchor||!body.contains(anchor))anchor=body;selection={quote,start,end,prefix:index.text.slice(Math.max(0,start-80),start),suffix:index.text.slice(end,end+80),anchorId:anchor.id,language,sourceHash:BY.get(entryId)?.contentHash||'',entryId,entryTitle:BY.get(entryId)?.title||document.title};const b=range.getBoundingClientRect(),width=250;toolbar.style.left=Math.max(10,Math.min(innerWidth-width-10,b.left))+'px';toolbar.style.top=Math.max(10,b.top-45)+'px';toolbar.hidden=false;toolbar.querySelector('[data-note-link]').hidden=!relink;}
function newNote(){const now=new Date().toISOString();return{...selection,id:crypto.randomUUID(),author:'Ivan',body:'',color,createdAt:now,updatedAt:now,version:0,deleted:false};}
function edit(note){if(!requireAccount())return;editing=note;openPanel();editor.hidden=false;editor.querySelector('blockquote').textContent=note.quote;input.value=note.body||'';color=note.color||'yellow';input.focus();}
toolbar.querySelector('[data-note-highlight]').addEventListener('click',async()=>{if(selection){const ok=await save(newNote());if(ok){toolbar.hidden=true;getSelection()?.removeAllRanges();}}});
toolbar.querySelector('[data-note-create]').addEventListener('click',()=>{if(selection){edit(newNote());toolbar.hidden=true;}});
toolbar.querySelector('[data-note-link]').addEventListener('click',()=>{const old=notes.find(n=>n.id===relink);if(old&&selection){save({...old,...selection,userRelink:true});relink=null;toolbar.hidden=true;}});
panel.querySelector('[data-note-save]').addEventListener('click',async()=>{if(editing){const ok=await save({...editing,body:input.value,color});if(ok){editing=null;editor.hidden=true;}}});panel.querySelector('[data-note-cancel]').addEventListener('click',()=>{editing=null;editor.hidden=true;});
panel.querySelector('[data-note-close]').addEventListener('click',closePanel);panel.querySelectorAll('[data-note-color]').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.noteColor;panel.querySelectorAll('[data-note-color]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));panel.querySelectorAll('[data-note-scope]').forEach(b=>b.addEventListener('click',()=>{scope=b.dataset.noteScope;renderList();}));
panel.querySelector('[data-note-backup]').addEventListener('click',async()=>{if(!requireAccount())return;const blob=new Blob([JSON.stringify({format:'markdang-notes-v1',exportedAt:new Date().toISOString(),notes:await dbRead()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='玩／游戏资料馆-笔记备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
const importFile=panel.querySelector('[data-note-file]');
panel.querySelector('[data-note-import]').addEventListener('click',()=>{if(requireAccount())importFile.click();});
importFile.addEventListener('change',async()=>{
 const file=importFile.files?.[0];importFile.value='';
 if(!file||!requireAccount())return;
 const store=noteStore;
 try{
  if(file.size>16_000_000)throw new Error('这份备份文件过大。');
  const value=JSON.parse(await file.text());
  if(value.format!=='markdang-notes-v1'||!Array.isArray(value.notes))throw new Error('请选择资料馆的笔记备份。');
  if(store!==noteStore)return;
  const ids=new Set((await dbRead(store)).map(n=>n.id));let added=0;
  for(const n of value.notes){
   if(store!==noteStore)return;
   if(!n||typeof n.quote!=='string'||!n.quote.trim()||!/^\w[\w-]{0,99}$/.test(n.id||'')||!/^[0-9a-f]{14}$/.test(n.entryId||'')||ids.has(n.id))continue;
   if(typeof n.body!=='string'||n.body.length>40000||n.quote.length>24000)continue;
   const created=typeof n.createdAt==='string'&&Number.isFinite(Date.parse(n.createdAt))?new Date(n.createdAt).toISOString():new Date().toISOString();
   if(await save({...n,createdAt:created,version:0,conflict:false})){ids.add(n.id);added++;}
  }
  if(store===noteStore){syncText='已导入 '+added+' 条笔记，现有版本已保留。';renderList();}
 }catch(error){if(store===noteStore)status.textContent=error.message;}
});
panel.addEventListener('click',e=>{const b=e.target.closest('[data-note-edit],[data-note-delete],[data-note-jump],[data-note-relink],[data-note-copy],[data-note-restore]');if(!b)return;const id=b.dataset.noteEdit||b.dataset.noteDelete||b.dataset.noteJump||b.dataset.noteRelink||b.dataset.noteCopy||b.dataset.noteRestore,n=notes.find(n=>n.id===id);if(!n)return;if(b.dataset.noteCopy){save({...n,id:crypto.randomUUID(),version:0,conflict:false});}else if(b.dataset.noteEdit)edit(n);else if(b.dataset.noteDelete)save({...n,deleted:true});else if(b.dataset.noteRestore)save({...n,deleted:false});else if(b.dataset.noteRelink){if(!entryId){status.textContent='打开要关联的条目后，在全部笔记中选择“重新关联”。';return;}relink=n.id;status.textContent='请在正文中选择新位置，再点“关联到此处”。';}else jump(n);});
function jump(n){if(n.entryId!==entryId){const row=BY.get(n.entryId);if(row)location.href=new URL(row.url+'?note='+encodeURIComponent(n.id),ROOT).href;return;}const mark=body?.querySelector('[data-user-note*="'+n.id+'"]'),anchor=mark||document.getElementById(n.anchorId);if(anchor){for(let p=anchor.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;anchor.scrollIntoView({behavior:'smooth',block:'center'});anchor.classList.remove('jump-flash');void anchor.offsetWidth;anchor.classList.add('jump-flash');}openPanel();}
document.addEventListener('click',e=>{if(e.target.closest('[data-open-notes]'))openPanel();const mark=e.target.closest('mark[data-user-note]');if(mark){const n=notes.find(n=>n.id===mark.dataset.userNote.split(',')[0]);if(n)jump(n);}});
document.addEventListener('pointerup',()=>{setTimeout(capture,30);});document.addEventListener('keyup',capture);document.addEventListener('selectionchange',()=>{if(getSelection()?.isCollapsed)toolbar.hidden=true;});addEventListener('scroll',()=>{toolbar.hidden=true;},{passive:true});addEventListener('online',()=>pull());document.addEventListener('visibilitychange',()=>{if(account?.current&&!document.hidden)pull();});
window.LibraryNotes={locate,fold,all:async()=>{await ready;await accountLoad;return(await dbRead()).filter(n=>!n.deleted);},open:openPanel,placements:()=>placements};
function switchAccount(user){
 noteStore=user?makeStore(user.id):null;notes=[];editing=null;selection=null;relink=null;syncText='';
 input.value='';editor.hidden=true;toolbar.hidden=true;closePanel();applyNotes();renderList();
 if(user){const store=noteStore;return refresh(store).then(()=>pull(store));}
 return Promise.resolve();
}
let accountLoad=Promise.resolve();
if(account){
 account.onChange(user=>{accountLoad=switchAccount(user);});
 if(account.current)accountLoad=switchAccount(account.current);
}
const ready=(account?account.ready.then(()=>accountLoad):refresh().then(()=>pull())).then(()=>{
 const target=new URLSearchParams(location.search).get('note');
 if(target){const n=notes.find(n=>n.id===target);if(n)setTimeout(()=>jump(n),250);}
}).catch(()=>{status.textContent='浏览器笔记存储暂时不可用。';});
})();
