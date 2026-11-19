(()=>{'use strict';
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROWS=window.LIBRARY_DATA||[];
const TYPES={articles:'文章',books:'书目',works:'作品',archives:'档案卡片',concepts:'索引标签',courses:'参考资料'};
const COLORS={articles:'#668697',books:'#8c779a',works:'#8b9274',archives:'#ad897e',concepts:'#6b9892',courses:'#b3a176'};
const site=new URL(document.querySelector('meta[name=site-root]')?.content||'./',location.href);
const DEFAULTS=Object.freeze({arrows:false,textOpacity:1,fontSize:16,nodeSize:1,lineWidth:.55,center:.52,repulsion:10,attraction:1,linkLength:280});
const LIMITS={textOpacity:[.15,1],fontSize:[12,24],nodeSize:[.4,2.2],lineWidth:[.2,2],center:[0,1],repulsion:[0,30],attraction:[0,2],linkLength:[100,600]};
function normalizeSettings(value={}){const out={...DEFAULTS,arrows:typeof value.arrows==='boolean'?value.arrows:DEFAULTS.arrows};for(const [key,[min,max]] of Object.entries(LIMITS)){const number=Number(value[key]);out[key]=value[key]!==undefined&&Number.isFinite(number)?Math.min(max,Math.max(min,number)):DEFAULTS[key];}return out;}
function selectGraph(rows,rootId=null,maxDepth=3){
 const by=new Map(rows.map(r=>[r.id,r])),depth=new Map(),queue=[];maxDepth=Math.max(0,Math.min(3,Math.trunc(maxDepth)||0));
 if(rootId&&by.has(rootId)){depth.set(rootId,0);queue.push(rootId);for(let p=0;p<queue.length;p++){const id=queue[p],d=depth.get(id);if(d>=maxDepth)continue;for(const to of by.get(id).outgoing||by.get(id).relations||[])if(by.has(to)&&!depth.has(to)){depth.set(to,d+1);queue.push(to);}}}
 else for(const r of rows)depth.set(r.id,0);
 const links=[],seen=new Set(),degree=new Map(rows.map(r=>[r.id,0]));
 for(const r of rows)for(const to of new Set(r.outgoing||r.relations||[])){if(to===r.id||!by.has(to))continue;degree.set(r.id,degree.get(r.id)+1);degree.set(to,degree.get(to)+1);if(depth.has(r.id)&&depth.has(to)){const k=r.id+'>'+to;if(!seen.has(k)){seen.add(k);links.push({source:r.id,target:to});}}}
 return{nodes:[...depth].map(([id,d])=>({...by.get(id),depth:d,degree:degree.get(id)||0})),links,rootId};
}
function hash(id){let value=0;for(const ch of id)value=(value*31+ch.charCodeAt(0))>>>0;return value;}
function nodeRadius(degree,root=false){return Math.min(15,6+Math.sqrt(Math.max(0,degree))*.8)+(root?3:0);}
function pixelCircle(ctx,x,y,r){const q=r/4;ctx.moveTo(x-r/2,y-r);for(const [a,b]of [[2,-4],[2,-3],[3,-3],[3,-2],[4,-2],[4,2],[3,2],[3,3],[2,3],[2,4],[-2,4],[-2,3],[-3,3],[-3,2],[-4,2],[-4,-2],[-3,-2],[-3,-3],[-2,-3],[-2,-4]])ctx.lineTo(x+a*q,y+b*q);ctx.closePath();}
function stepForces(nodes,links,settings,rootId=null,dragged=null){
 // Keep repulsion effective beyond a small local cutoff. Quadratic controls
 // give the whole slider a useful range while retaining a calm default.
 const charge=80*Math.pow(settings.repulsion/10,2),spring=.008*Math.pow(settings.attraction,2),center=.012*Math.pow(settings.center,2);
 if(charge)for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
  if(d2<.0001){const angle=hash(a.id+'>'+b.id)/4294967296*Math.PI*2;dx=Math.cos(angle)*.5;dy=Math.sin(angle)*.5;d2=.25;}
  const f=charge/(d2+1600);a.vx-=dx*f;a.vy-=dy*f;b.vx+=dx*f;b.vy+=dy*f;
 }
 if(spring)for(const l of links){const dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,d=Math.hypot(dx,dy)||1,f=(d-settings.linkLength)*spring;l.a.vx+=dx/d*f;l.a.vy+=dy/d*f;l.b.vx-=dx/d*f;l.b.vy-=dy/d*f;}
 for(const p of nodes){
  if(p.id===rootId){p.x=p.y=p.vx=p.vy=0;continue;}
  if(p===dragged){p.vx=p.vy=0;continue;}
  p.vx=(p.vx-p.x*center)*.82;p.vy=(p.vy-p.y*center)*.82;
  const speed=Math.hypot(p.vx,p.vy);if(speed>24){p.vx*=24/speed;p.vy*=24/speed;}
  p.x+=p.vx;p.y+=p.vy;
 }
}
function mount(host){
 const rootId=host.dataset.graphRoot||null,local=!!rootId,cache=new Map();let depth=0,graph,nodes=[],links=[],indices=new Map(),neighbors=new Map();
 let settings;try{settings=normalizeSettings(JSON.parse(localStorage.getItem('markdang-graph-appearance-v2')||'{}'));}catch{settings=normalizeSettings();}
 const slider=(key,label,min,max,step)=>`<label class="graph-setting"><span>${label}<output data-value="${key}"></output></span><input type="range" data-graph-setting="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}"></label>`;
 host.innerHTML=`<div class="graph-stage"><canvas tabindex="0" aria-label="关系图谱，可拖移、缩放、点击节点进入条目"></canvas><div class="graph-toolbar">${local?'<button class="graph-depth" data-graph-action="depth">零级关系 →</button>':''}<div class="graph-controls"><div class="graph-tools"><button data-graph-action="in" aria-label="放大">＋</button><button data-graph-action="out" aria-label="缩小">−</button><button data-graph-action="fit" aria-label="适合窗口">↺</button></div><details class="graph-settings"><summary>调节</summary><div class="graph-settings-panel"><details open><summary>外观</summary><label class="graph-setting graph-arrow-setting"><span>箭头</span><input type="checkbox" data-graph-setting="arrows"></label>${slider('textOpacity','文本透明度',.15,1,.05)}${slider('fontSize','文字大小',12,24,1)}${slider('nodeSize','节点大小',.4,2.2,.05)}${slider('lineWidth','连线粗细',.2,2,.05)}</details><details open><summary>力度</summary>${slider('center','图谱向心力',0,1,.01)}${slider('repulsion','节点间的排斥力',0,30,.5)}${slider('attraction','相连节点间的吸引力',0,2,.05)}${slider('linkLength','连线长度',100,600,10)}</details><button class="graph-reset" data-graph-action="reset">恢复默认</button></div></details><button class="graph-label-toggle" data-graph-action="labels" aria-pressed="false">显示名称属性</button></div></div><output class="graph-status" aria-live="polite"></output><div class="graph-tooltip" hidden></div></div>`;
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),status=host.querySelector('.graph-status'),tip=host.querySelector('.graph-tooltip');if(!ctx)return;
 let width=0,height=0,dpr=1,zoom=1,cx=0,cy=0,hover=null,drag=null,moved=false,last=0,visible=true,ticks=0,pointers=new Map(),pinch=null,keyboardIndex=-1,camera=null,labelBoxes=[],labelsVisible=false,growthUntil=0,simulationTime=0;
 const adjacent=new Set();
 function updateStatus(){status.textContent=(local?['零级','一级','二级','三级'][depth]+' · ':'')+nodes.length+'个节点 · '+links.length+'条连接';const button=host.querySelector('[data-graph-action="depth"]');if(button){button.textContent=['零级关系 →','一级关系 →','二级关系 →','三级关系 ↺'][depth];button.title=depth===3?'复位，只显示本条目':'展开'+['一级','二级','三级'][depth]+'关系';button.setAttribute('aria-label',button.title);button.dataset.depth=String(depth);}}
 function rebuild(nextDepth){
  depth=nextDepth;graph=selectGraph(ROWS,rootId,depth);const oldIds=new Set(nodes.map(n=>n.id));indices=new Map(graph.nodes.map((r,i)=>[r.id,i]));
  nodes=graph.nodes.map((r,i)=>{let n=cache.get(r.id);if(!n){const parent=graph.links.find(l=>l.target===r.id&&cache.has(l.source))?.source,p=cache.get(parent);const a=hash(r.id)/4294967296*Math.PI*2,rad=local?(r.depth===0?0:p?28:settings.linkLength*r.depth):Math.sqrt(i)*155;n={...r,x:p?p.x+Math.cos(a)*rad:Math.cos(local?a:i*2.399963)*rad,y:p?p.y+Math.sin(a)*rad:Math.sin(local?a:i*2.399963)*rad,vx:0,vy:0,image:null,loading:false,born:last,birthX:p?.x||0,birthY:p?.y||0};cache.set(r.id,n);}Object.assign(n,r);n.r=nodeRadius(r.degree,r.id===rootId);n.screenTime=-1;if(!oldIds.has(r.id))n.born=last;return n;});
  links=graph.links.map(l=>({a:cache.get(l.source),b:cache.get(l.target)}));neighbors=new Map(nodes.map(n=>[n.id,new Set()]));for(const l of links){neighbors.get(l.a.id).add(l.b.id);neighbors.get(l.b.id).add(l.a.id);}ticks=0;setHover(null);labelBoxes=[];updateStatus();
 }
 function extent(){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const n of nodes){minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y);}if(!nodes.length)return{zoom:1,cx:0,cy:0};if(local){const x=Math.max(Math.abs(minX),Math.abs(maxX)),y=Math.max(Math.abs(minY),Math.abs(maxY));minX=-x;maxX=x;minY=-y;maxY=y;}const paddingX=Math.min(150,width*.2),paddingY=105;return{zoom:Math.max(.025,Math.min(1.15,(width-paddingX*2)/Math.max(260,maxX-minX),(height-paddingY*2)/Math.max(180,maxY-minY))),cx:-(minX+maxX)/2,cy:-(minY+maxY)/2};}
 function fit(smooth=false){const target=extent();if(smooth&&!REDUCED)camera={start:last,duration:650,from:{zoom,cx,cy},to:target};else{({zoom,cx,cy}=target);camera=null;}invalidateScreen();}
 function resize(){width=host.clientWidth||800;height=Math.max(300,host.clientHeight||620);dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';fit();}
 function screen(n,time){if(n.screenTime===time)return n.screenPoint;const drift=REDUCED?0:1.1;n.screenTime=time;return n.screenPoint={x:width/2+(n.x+cx)*zoom+Math.sin(time*.0003+indices.get(n.id))*drift,y:height/2+(n.y+cy)*zoom+Math.cos(time*.00024+indices.get(n.id))*drift};}
 function radius(n){return Math.max(3.5,n.r*Math.pow(zoom,.3))*settings.nodeSize*(hover===n?1.18:1);}
 function invalidateScreen(){for(const n of nodes)n.screenTime=-1;}
 function point(ev){const b=canvas.getBoundingClientRect();return{x:ev.clientX-b.left,y:ev.clientY-b.top};}
 function hit(p){for(let i=nodes.length-1;i>=0;i--){const n=nodes[i],s=screen(n,last);if(Math.hypot(s.x-p.x,s.y-p.y)<Math.max(9,radius(n)))return n;}for(let i=labelBoxes.length-1;i>=0;i--){const box=labelBoxes[i];if(p.x>=box.x&&p.x<=box.x+box.w&&p.y>=box.y&&p.y<=box.y+box.h)return box.node;}return null;}
 function title(n){return[n.original||n.title,n.chinese&&n.chinese!==(n.original||n.title)?n.chinese:''].filter(Boolean).join(' ');}
 function setHover(n){hover=n;adjacent.clear();if(n){adjacent.add(n.id);for(const id of neighbors.get(n.id)||[])adjacent.add(id);tip.hidden=labelsVisible;tip.textContent=title(n)+' ['+TYPES[n.category]+']';}else tip.hidden=true;canvas.style.cursor=n?'pointer':'grab';}
 function loadImage(n){if(n.loading||!n.cover)return;n.loading=true;const img=new Image();img.onload=()=>{n.image=img;};img.src=new URL(n.graphImage||n.cover,site).href;}
 function simulation(){if(ticks>600)return;stepForces(nodes,links,settings,rootId,drag?.node);ticks++;}
 function linesFor(n){const key=settings.fontSize;n.labels||={};if(n.labels[key])return n.labels[key];const lines=[],limit=220;let line='';for(const ch of title(n)){if(ctx.measureText(line+ch).width>limit&&line){lines.push(line);line='';}line+=ch;}if(line)lines.push(line);return n.labels[key]=lines;}
 function draw(time){requestAnimationFrame(draw);if(!visible||document.hidden||host.hidden)return;const delta=Math.min(40,time-last||16.67);last=time;simulationTime+=delta;while(simulationTime>=16.667){simulation();simulationTime-=16.667;}if(time<growthUntil&&!camera){const target=extent();if(target.zoom<zoom){zoom+=(target.zoom-zoom)*.055;cx+=(target.cx-cx)*.035;cy+=(target.cy-cy)*.035;}}if(camera){const t=Math.min(1,(time-camera.start)/camera.duration),e=1-Math.pow(1-t,3);zoom=camera.from.zoom+(camera.to.zoom-camera.from.zoom)*e;cx=camera.from.cx+(camera.to.cx-camera.from.cx)*e;cy=camera.from.cy+(camera.to.cy-camera.from.cy)*e;if(t===1)camera=null;}invalidateScreen();
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.lineWidth=settings.lineWidth;ctx.strokeStyle='#66758888';ctx.beginPath();const arrows=[];
  for(const l of links){const a=screen(l.a,time),b=screen(l.b,time);if(Math.max(a.x,b.x)<0||Math.min(a.x,b.x)>width||Math.max(a.y,b.y)<0||Math.min(a.y,b.y)>height)continue;if(hover&&(l.a===hover||l.b===hover))continue;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);if(settings.arrows)arrows.push([a,b,radius(l.b)]);}ctx.stroke();
  if(hover){ctx.strokeStyle='#66518b';ctx.lineWidth=Math.max(.9,settings.lineWidth*1.6);ctx.beginPath();for(const l of links)if(l.a===hover||l.b===hover){const a=screen(l.a,time),b=screen(l.b,time);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);if(settings.arrows)arrows.push([a,b,radius(l.b)]);}ctx.stroke();}
  if(settings.arrows){ctx.strokeStyle='#667588aa';ctx.lineWidth=settings.lineWidth;ctx.beginPath();for(const [a,b,r]of arrows){const d=Math.hypot(b.x-a.x,b.y-a.y);if(d<r+12)continue;const ux=(b.x-a.x)/d,uy=(b.y-a.y)/d,x=b.x-ux*(r+3),y=b.y-uy*(r+3);ctx.moveTo(x-ux*5-uy*2.5,y-uy*5+ux*2.5);ctx.lineTo(x,y);ctx.lineTo(x-ux*5+uy*2.5,y-uy*5-ux*2.5);}ctx.stroke();}
  const onScreen=[];for(const n of nodes){const s=screen(n,time),r=radius(n);if(s.x+r<0||s.x-r>width||s.y+r<0||s.y-r>height)continue;onScreen.push(n);ctx.globalAlpha=(hover&&!adjacent.has(n.id)?.3:1)*(REDUCED?1:Math.min(1,(time-n.born)/420));ctx.save();ctx.beginPath();pixelCircle(ctx,s.x,s.y,r);ctx.clip();ctx.fillStyle=n.surface==='dark'?'#27303f':COLORS[n.category];ctx.fillRect(s.x-r,s.y-r,r*2,r*2);if(r>=4){loadImage(n);if(n.image){const im=n.image,scale=Math.max(2*r/im.naturalWidth,2*r/im.naturalHeight),w=im.naturalWidth*scale,h=im.naturalHeight*scale;ctx.drawImage(im,s.x-w/2,s.y-h/2,w,h);}}ctx.restore();ctx.beginPath();pixelCircle(ctx,s.x,s.y,r);ctx.strokeStyle=hover===n?'#8d83bc':n.id===rootId?'#67738e':'#ffffffeb';ctx.lineWidth=hover===n?2:n.id===rootId?1.5:.7;ctx.stroke();}
  ctx.globalAlpha=1;ctx.font=settings.fontSize+'px "Fusion Pixel Graph",monospace';ctx.textAlign='center';ctx.textBaseline='top';labelBoxes=[];
  const priority=n=>(n===hover?1e9:n.id===rootId?1e8:adjacent.has(n.id)?1e6:0)+n.degree;
  const ranked=labelsVisible?onScreen.sort((a,b)=>priority(a)-priority(b)):[];
  for(const n of ranked){const s=screen(n,time),r=radius(n),lines=linesFor(n),lineHeight=settings.fontSize+4,textWidth=Math.max(...lines.map(t=>ctx.measureText(t).width),90),box={x:s.x-textWidth/2-5,y:s.y+r+7,w:textWidth+10,h:(lines.length+1)*lineHeight+3,node:n};
   labelBoxes.push(box);ctx.globalAlpha=settings.textOpacity*(hover&&!adjacent.has(n.id)?.38:1);ctx.fillStyle=hover===n?'#5b3d82':'#303a4b';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#fafbfded';lines.forEach((text,i)=>{ctx.strokeText(text,s.x,box.y+i*lineHeight);ctx.fillText(text,s.x,box.y+i*lineHeight);});ctx.fillStyle='#667084';const type='['+TYPES[n.category]+']';ctx.strokeText(type,s.x,box.y+lines.length*lineHeight);ctx.fillText(type,s.x,box.y+lines.length*lineHeight);
  }ctx.globalAlpha=1;
 }
 function zoomAt(f,p={x:width/2,y:height/2}){camera=null;const old=zoom;zoom=Math.max(.025,Math.min(6,zoom*f));cx+=(p.x-width/2)*(1/zoom-1/old);cy+=(p.y-height/2)*(1/zoom-1/old);invalidateScreen();}
 function setDepth(value){if(!local)return;rebuild(Math.max(0,Math.min(3,Math.trunc(value))));if(depth===0)fit(true);else growthUntil=last+7200;}
 function refreshControls(){host.querySelectorAll('[data-graph-setting]').forEach(input=>{const key=input.dataset.graphSetting;if(input.type==='checkbox')input.checked=settings[key];else{input.value=String(settings[key]);host.querySelector('[data-value="'+key+'"]').textContent=Number.isInteger(settings[key])?settings[key]:settings[key].toFixed(2);}});}
 function setSettings(value){settings=normalizeSettings({...settings,...value});try{localStorage.setItem('markdang-graph-appearance-v2',JSON.stringify(settings));}catch{}for(const n of nodes)n.labels=null;ticks=0;if(['center','repulsion','attraction','linkLength'].some(key=>key in value)){growthUntil=0;camera=null;}refreshControls();}
 function setLabelsVisible(value){labelsVisible=!!value;labelBoxes=[];const button=host.querySelector('[data-graph-action="labels"]');button.textContent=labelsVisible?'隐藏名称属性':'显示名称属性';button.setAttribute('aria-pressed',String(labelsVisible));tip.hidden=labelsVisible||!hover;}
 canvas.addEventListener('wheel',ev=>{ev.preventDefault();zoomAt(Math.exp(-ev.deltaY*.001),point(ev));},{passive:false});
 canvas.addEventListener('pointerdown',ev=>{camera=null;canvas.setPointerCapture(ev.pointerId);const p=point(ev);pointers.set(ev.pointerId,p);moved=false;if(pointers.size===2){const a=[...pointers.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),zoom};drag=null;}else drag={start:p,last:p,node:hit(p),time:performance.now()};});
 canvas.addEventListener('pointermove',ev=>{const p=point(ev);if(pointers.has(ev.pointerId))pointers.set(ev.pointerId,p);if(pinch&&pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);zoom=Math.max(.025,Math.min(6,pinch.zoom*d/Math.max(1,pinch.distance)));moved=true;invalidateScreen();return;}if(drag){const dx=p.x-drag.last.x,dy=p.y-drag.last.y;if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>5)moved=true;if(drag.node){if(drag.node.id!==rootId){drag.node.x+=dx/zoom;drag.node.y+=dy/zoom;drag.node.vx=drag.node.vy=0;ticks=0;}}else{cx+=dx/zoom;cy+=dy/zoom;}drag.last=p;invalidateScreen();}else{setHover(hit(p));tip.style.left=Math.max(4,Math.min(width-250,p.x+16))+'px';tip.style.top=Math.max(4,Math.min(height-85,p.y+16))+'px';}});
 canvas.addEventListener('pointerup',ev=>{const chosen=drag?.node,click=!moved&&drag&&performance.now()-drag.time<500;pointers.delete(ev.pointerId);pinch=null;drag=null;if(click&&chosen)location.href=new URL(chosen.url,site).href;});
 canvas.addEventListener('pointercancel',ev=>{pointers.delete(ev.pointerId);pinch=drag=null;});canvas.addEventListener('pointerleave',()=>{if(!drag)setHover(null);});
 canvas.addEventListener('keydown',ev=>{if(ev.key==='+'||ev.key==='=')zoomAt(1.2);else if(ev.key==='-')zoomAt(1/1.2);else if(ev.key==='0')fit(true);else if(ev.key==='ArrowRight'||ev.key==='ArrowLeft'){ev.preventDefault();keyboardIndex=(keyboardIndex+(ev.key==='ArrowRight'?1:-1)+nodes.length)%nodes.length;const n=nodes[keyboardIndex];if(n){setHover(n);cx=-n.x;cy=-n.y;zoom=Math.max(.8,zoom);status.textContent=tip.textContent;}}else if(ev.key==='Enter'&&hover)location.href=new URL(hover.url,site).href;});
 host.querySelectorAll('[data-graph-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.graphAction;if(action==='depth')setDepth((depth+1)%4);else if(action==='fit')fit(true);else if(action==='reset')setSettings(DEFAULTS);else if(action==='labels')setLabelsVisible(!labelsVisible);else zoomAt(action==='in'?1.3:1/1.3);}));
 host.querySelectorAll('[data-graph-setting]').forEach(input=>input.addEventListener('input',()=>setSettings({[input.dataset.graphSetting]:input.type==='checkbox'?input.checked:Number(input.value)})));
 if(document.fonts?.ready)document.fonts.ready.then(()=>{for(const n of cache.values())n.labels=null;});
 rebuild(0);refreshControls();resize();if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(host);else addEventListener('resize',resize);if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(host);requestAnimationFrame(draw);
 return{get graph(){return graph;},get nodes(){return nodes;},get depth(){return depth;},get settings(){return{...settings};},get labelsVisible(){return labelsVisible;},setDepth,setSettings,fit,get labelBoxes(){return labelBoxes;}};
}
window.ArchiveGraph=window.LibraryGraph={selectGraph,mount,normalizeSettings,nodeRadius,DEFAULTS};document.querySelectorAll('[data-library-graph]').forEach(mount);
})();
