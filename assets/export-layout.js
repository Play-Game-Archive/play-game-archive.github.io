(async()=>{'use strict';
const config=JSON.parse(document.getElementById('export-config').textContent),source=document.getElementById('export-source'),pages=document.getElementById('export-pages');
const notes=config.notes||[],seen=new Set();let current=null;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function createPage(){const page=document.createElement('section');page.className='print-page';page.innerHTML='<div class="page-inner"><main class="page-body"></main><aside class="page-comments"></aside></div><footer></footer>';pages.append(page);current={page,body:page.querySelector('main'),side:page.querySelector('aside')};return current;}
function textNodes(root,language='both'){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n,list=[],text='';while(n=w.nextNode()){if(n.parentElement.closest('script,style,.katex-html'))continue;if(language==='zh'&&n.parentElement.closest('.original,.heading-original')&&!n.parentElement.closest('pre'))continue;if(language==='original'&&n.parentElement.closest('.translation,.heading-chinese'))continue;list.push({n,start:text.length,end:text.length+n.length});text+=n.nodeValue;}return{list,text};}
function fold(text){let out='',map=[],pos=0;for(const ch of text){const s=ch.normalize('NFKC').toLowerCase().replace(/\s/g,'');for(let j=0;j<s.length;j++)map.push({start:pos,end:pos+ch.length});out+=s;pos+=ch.length;}return{out,map};}
function annotate(){for(const note of notes){const index=textNodes(source,note.language||'both'),f=fold(index.text);const q=fold(note.quote||'').out;if(!q)continue;let at=0,best=null,runner=null;const anchor=note.anchorId?source.querySelector('[id="'+CSS.escape(note.anchorId)+'"]'):null;const prefix=fold(note.prefix||'').out.slice(-64),suffix=fold(note.suffix||'').out.slice(0,64);while((at=f.out.indexOf(q,at))>=0){const start=f.map[at].start,end=f.map[at+q.length-1].end,before=f.out.slice(Math.max(0,at-64),at),after=f.out.slice(at+q.length,at+q.length+64);let score=0;for(let i=1;i<=prefix.length;i++)if(before.endsWith(prefix.slice(-i)))score++;for(let i=1;i<=suffix.length;i++)if(after.startsWith(suffix.slice(0,i)))score++;if(anchor&&index.list.some(p=>anchor.contains(p.n)&&p.start<=start&&p.end>start))score+=200;score-=Math.abs(start-(note.start||0))/Math.max(1000,index.text.length);const candidate={start,end,score};if(!best||score>best.score){runner=best;best=candidate;}else if(!runner||score>runner.score)runner=candidate;at+=q.length;}if(!best||(runner&&best.score-runner.score<2&&!anchor))continue;for(const p of index.list){if(p.start>=best.end||p.end<=best.start)continue;const a=Math.max(0,best.start-p.start),b=Math.min(p.n.length,best.end-p.start);if(!p.n.parentNode)continue;let target=p.n;if(b<target.length)target.splitText(b);if(a)target=target.splitText(a);const mark=document.createElement('mark');mark.dataset.note=note.id;mark.className='note-'+(note.color||'yellow');target.replaceWith(mark);mark.append(target);}}}
// Wrap annotations before splitting; each fragment carries its stable note id.
annotate();
if(config.language==='zh')source.querySelectorAll('.original,.heading-original').forEach(n=>{if(n.classList.contains('original'))for(const visual of n.querySelectorAll('img,pre'))n.before(visual.cloneNode(true));n.remove();});
if(config.language==='original'&&config.textualForeign)source.querySelectorAll('.editorial-intro').forEach(n=>n.remove());
if(config.language==='original')source.querySelectorAll('.translation,.heading-chinese').forEach(n=>n.remove());
source.querySelectorAll('details').forEach(d=>{const fragment=document.createDocumentFragment();for(const n of [...d.children])if(n.tagName!=='SUMMARY')fragment.append(...n.childNodes);d.replaceWith(fragment);});
source.querySelectorAll('.katex-html,script,style,.anchor-alias').forEach(n=>n.remove());
// Source dimensions are frozen in the export snapshot. Loading pixels cannot change pagination.
for(const image of source.querySelectorAll('img'))image.loading='eager';
await Promise.race([document.fonts.ready,pause(1000)]);
function blocks(root){const out=[];for(const n of [...root.childNodes]){if(n.nodeType===3){if(n.textContent.trim()){const p=document.createElement('p');p.append(n.cloneNode(true));out.push(p);}continue;}if(n.nodeType!==1)continue;if(['DIV','ARTICLE','SECTION'].includes(n.tagName)&&!n.classList.contains('source-code-pair'))out.push(...blocks(n));else out.push(n.cloneNode(true));}return out;}
function overflowing(){return current.body.scrollHeight>current.body.clientHeight+1;}
function fitTableWidth(table){
 const rows=[...table.querySelectorAll('tr')];if(!rows.length)return;
 const columns=Math.max(...rows.map(row=>[...row.children].reduce((n,cell)=>n+(cell.colSpan||1),0))),width=current.body.clientWidth;
 if(columns<5&&table.scrollWidth<=width+1)return;
 const original=parseFloat(getComputedStyle(table).fontSize),padding=Math.min(2,original*.15);
 // Keep enough room for two CJK characters or a short Latin fragment in every narrow column.
 const fitted=Math.min(original,Math.max(9*96/72,(width/columns-padding*2-1)/2.05));
 table.style.tableLayout='fixed';table.style.width='100%';table.style.fontSize=fitted+'px';
 for(const cell of table.querySelectorAll('th,td')){cell.style.paddingLeft=padding+'px';cell.style.paddingRight=padding+'px';cell.style.overflowWrap='anywhere';}
 if(fitted<original)table.dataset.fittedTable='true';
}
function endpoint(node,offset){const ix=textNodes(node);for(const p of ix.list)if(offset<=p.end){let end=Math.max(0,offset-p.start);const atomic=p.n.parentElement.closest('math,svg');if(atomic&&node.contains(atomic)){return{node:atomic.parentNode,offset:[...atomic.parentNode.childNodes].indexOf(atomic)+(end?1:0)};}return{node:p.n,offset:end};}return{node,offset:node.childNodes.length};}
function continueList(list, remainder, point){
 if(!list.matches('ol,ul')||remainder.firstElementChild?.tagName!=='LI')return;
 let item=point.nodeType===Node.ELEMENT_NODE?point:point.parentElement;
 while(item&&item.parentElement!==list)item=item.parentElement;
 if(item?.tagName!=='LI')return;
 const continuation=remainder.firstElementChild;
 if(continuation.textContent.trim()||continuation.querySelector('img,math,svg')){
  continuation.style.listStyleType='none';
 }else{
  continuation.remove();
  item=item.nextElementSibling;
 }
 if(!item||list.tagName!=='OL')return;
 const direction=list.reversed?-1:1;
 let ordinal=list.hasAttribute('start')?list.start:list.reversed?list.children.length:1;
 for(const sibling of list.children){
  if(sibling.hasAttribute('value'))ordinal=sibling.value;
  if(sibling===item)break;
  ordinal+=direction;
 }
 remainder.start=ordinal;
}
function cut(node,offset){const point=endpoint(node,offset),range=document.createRange();range.selectNodeContents(node);range.setEnd(point.node,point.offset);const left=node.cloneNode(false);left.append(range.cloneContents());range.selectNodeContents(node);range.setStart(point.node,point.offset);const right=node.cloneNode(false);right.append(range.cloneContents());continueList(node,right,point.node);return[left,right];}
function split(node){const length=textNodes(node).text.length;if(length<2)return null;let lo=0,hi=length-1,best=0;while(lo<=hi){const mid=Math.floor((lo+hi)/2),[left]=cut(node,mid);current.body.append(left);const fits=!overflowing();left.remove();if(fits){best=mid;lo=mid+1;}else hi=mid-1;}if(best<1)return null;const text=textNodes(node).text;let end=best;for(let i=best;i>Math.max(1,best-100);i--)if(/[\s。！？；.!?;]/.test(text[i-1])){end=i;break;}const pair=cut(node,end);if(!pair[0].textContent.trim())return null;return pair;}
function fitMath(root){for(const math of root.querySelectorAll('math')){const area=math.closest('td,th')||current.body,width=area.clientWidth-10,actual=math.getBoundingClientRect().width;if(actual>width&&width>0)math.style.fontSize=(parseFloat(getComputedStyle(math).fontSize)*width/actual)+'px';}}
// Record the logical columns covered by each merged cell before laying out pages.
function tableRowLayouts(rows){
 const active=new Map();
 return rows.map((row,index)=>{
  for(const [column,span] of active)if(span.end<=index)active.delete(column);
  const inherited=[...new Set(active.values())],own=[];
  let column=0;
  for(const cell of row.children){
   while(active.has(column))column++;
   const end=cell.rowSpan===0?rows.length:index+cell.rowSpan;
   own.push({cell,column});
   if(end>index+1){
    const span={cell,column,end};
    for(let offset=0;offset<cell.colSpan;offset++)active.set(column+offset,span);
   }
   column+=cell.colSpan;
  }
  return {index,inherited,own};
 });
}
function repeatMergedCells(row,layout){
 if(!layout.inherited.length)return row;
 const own=layout.own.map(({column},i)=>({column,cell:row.children[i]}));
 const continued=layout.inherited.map(span=>{
  const cell=span.cell.cloneNode(true);
  cell.rowSpan=span.end-layout.index;
  return {column:span.column,cell};
 });
 row.replaceChildren(...own.concat(continued).sort((a,b)=>a.column-b.column).map(position=>position.cell));
 return row;
}
function insertTable(node){
 const rows=[...node.querySelectorAll(':scope>tbody>tr,:scope>tr')];if(!rows.length)return false;
 let head=node.querySelector(':scope>thead'),piece,tbody;
 const widths=[...node.querySelectorAll('tr')][0]?.children.length||1;
 function fresh(){piece=node.cloneNode(false);piece.style.tableLayout='fixed';const grid=node.querySelector(':scope>colgroup');if(grid)piece.append(grid.cloneNode(true));if(head)piece.append(head.cloneNode(true));tbody=document.createElement('tbody');piece.append(tbody);current.body.append(piece);}
 function hasContent(cell){return cell.textContent.trim()||cell.querySelector('img,svg,math');}
 function splitRow(row){
  const left=row.cloneNode(false),right=row.cloneNode(false);for(const cell of row.children){left.append(cell.cloneNode(false));right.append(cell.cloneNode(false));}tbody.append(left);
  let progressed=false,remaining=false;
  for(let i=0;i<row.children.length;i++){
   const cell=row.children[i],slot=left.children[i];slot.append(...[...cell.childNodes].map(n=>n.cloneNode(true)));fitMath(slot);
   if(!overflowing()){progressed=progressed||!!hasContent(slot);continue;}
   slot.replaceChildren();const length=textNodes(cell).text.length;let lo=1,hi=length,best=0;
   while(lo<=hi){const mid=Math.floor((lo+hi)/2),[a]=cut(cell,mid);slot.replaceChildren(...[...a.childNodes]);fitMath(slot);if(!overflowing()){best=mid;lo=mid+1;}else hi=mid-1;}
   if(best){const [a,b]=cut(cell,best);slot.replaceChildren(...[...a.childNodes]);right.children[i].append(...[...b.childNodes]);progressed=true;remaining=remaining||!!hasContent(right.children[i]);}
   else if(cell.querySelector('img,svg')){slot.append(...[...cell.childNodes].map(n=>n.cloneNode(true)));for(const visual of slot.querySelectorAll('img,svg'))visual.style.maxHeight=Math.max(20,current.body.clientHeight-(head?.getBoundingClientRect().height||0)-50)+'px';fitMath(slot);if(overflowing()){slot.replaceChildren();right.children[i].append(...[...cell.childNodes].map(n=>n.cloneNode(true)));remaining=true;}else progressed=true;}
   else{right.children[i].append(...[...cell.childNodes].map(n=>n.cloneNode(true)));remaining=true;}
  }
  if(!progressed){left.remove();throw Error('此表格内容无法在所选纸张中排入，未截断导出');}fitMath(left);return remaining?right:null;
 }
 fresh();if(overflowing()&&head){piece.remove();rows.unshift(...head.querySelectorAll('tr'));head=null;fresh();}
 const layouts=tableRowLayouts(rows);
 for(const [index,original] of rows.entries()){
  let row=original.cloneNode(true),fragmentHasMergedCells=false;
  for(;;){
   const visibleRow=!tbody.children.length&&!fragmentHasMergedCells?repeatMergedCells(row.cloneNode(true),layouts[index]):row;
   tbody.append(visibleRow);fitMath(visibleRow);
   if(!overflowing())break;
   visibleRow.remove();
   if(tbody.children.length||current.body.children.length>1){
    if(!tbody.children.length)piece.remove();
    createPage();fresh();continue;
   }
   const rest=splitRow(visibleRow);
   if(!rest)break;
   createPage();fresh();row=rest;fragmentHasMergedCells=true;
  }
 }
 return true;
}
function insert(node){if(!current)createPage();current.body.append(node);if(node.tagName==='TABLE')fitTableWidth(node);fitMath(node);if(!overflowing())return;node.remove();if(node.tagName==='TABLE'&&insertTable(node))return;const alone=current.body.children.length===0;
 if(!alone&&/^(H[1-6]|FIGURE|IMG|TABLE)$/.test(node.tagName)){createPage();return insert(node);}
 const parts=split(node);if(parts){current.body.append(parts[0]);if(parts[1].textContent.trim()||parts[1].querySelector('img,math,svg')){createPage();return insert(parts[1]);}return;}
 if(!alone){createPage();return insert(node);}if(node.querySelector('img,svg')||node.tagName==='IMG'){node.style.maxHeight=(current.body.clientHeight-8)+'px';for(const im of node.querySelectorAll('img,svg'))im.style.maxHeight=(current.body.clientHeight-40)+'px';current.body.append(node);fitMath(node);if(!overflowing())return;node.remove();}
 throw Error('此段落无法无损分页，请调整纸张或字号');}
const title=document.createElement('h1');title.textContent=config.title;insert(title);
if(config.scope!=='notes'){for(const node of blocks(source))insert(node);}
const time=s=>{try{return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));}catch{return s||'';}};
function card(note,bodyText=note.body||'',continuation=false){const c=document.createElement('article');c.className='comment-card';c.innerHTML='<strong>Ivan:</strong><p></p><time></time>';c.querySelector('p').textContent=bodyText;c.querySelector('time').textContent=time(note.createdAt);if(continuation)c.dataset.continued='true';return c;}
function addComment(note,page,quote=false){let text=note.body||'',continuation=false;let anchorGap=0;if(!quote){const mark=[...page.body.querySelectorAll('mark[data-note]')].find(m=>m.dataset.note===note.id);const last=page.side.lastElementChild;const used=last?last.getBoundingClientRect().bottom-page.side.getBoundingClientRect().top+10:0;if(mark)anchorGap=Math.max(0,mark.getBoundingClientRect().top-page.body.getBoundingClientRect().top-used);}for(;;){const c=card(note,text,continuation);if(anchorGap)c.style.marginTop=anchorGap+'px';page.side.append(c);if(page.side.scrollHeight<=page.side.clientHeight+1)return;if(anchorGap){anchorGap=0;c.style.marginTop='0';if(page.side.scrollHeight<=page.side.clientHeight+1)return;}c.remove();const last=page.side.lastElementChild;const used=last?last.getBoundingClientRect().bottom-page.side.getBoundingClientRect().top+10:0;const available=page.side.clientHeight-used;if(available<100&&page.side.children.length){page=createPage();continuation=true;continue;}let lo=1,hi=text.length,best=0;while(lo<=hi){const mid=Math.floor((lo+hi)/2),test=card(note,text.slice(0,mid),continuation);page.side.append(test);const fits=page.side.scrollHeight<=page.side.clientHeight+1;test.remove();if(fits){best=mid;lo=mid+1;}else hi=mid-1;}if(best<1){page=createPage();continuation=true;continue;}page.side.append(card(note,text.slice(0,best),continuation));text=text.slice(best);if(!text)return;page=createPage();continuation=true;}}
if(config.scope!=='body')for(const note of notes){let found=null;if(config.scope==='both')for(const p of pages.children){const mark=[...p.querySelectorAll('mark[data-note]')].find(x=>x.dataset.note===note.id);if(mark){found={page:p,body:p.querySelector('main'),side:p.querySelector('aside')};break;}}
 if(found){addComment(note,found);seen.add(note.id);}else{createPage();const h=document.createElement('h2');h.textContent='批注';insert(h);const quote=document.createElement('blockquote');quote.textContent=note.quote||'';insert(quote);addComment(note,current,true);seen.add(note.id);}}
for(const page of pages.children){for(const area of page.querySelectorAll('main,aside'))if(area.scrollHeight>area.clientHeight+2||area.scrollWidth>area.clientWidth+2)throw Error('分页校验发现内容超出纸张，未导出裁切文件');}const total=pages.children.length;[...pages.children].forEach((page,i)=>page.querySelector('footer').textContent=(i+1)+' / '+total);
source.remove();document.documentElement.dataset.ready='true';document.documentElement.dataset.pages=String(total);document.title='READY:'+total;window.EXPORT_RESULT={pages:total,notes:[...seen],text:pages.textContent};
})().catch(error=>{document.title='EXPORT_ERROR';document.documentElement.dataset.error=String(error);const p=document.createElement('pre');p.textContent=String(error);document.body.append(p);});
