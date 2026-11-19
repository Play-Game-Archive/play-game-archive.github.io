(() => {
  'use strict';
  const root = new URL(document.querySelector('meta[name="site-root"]').content, location.href);
  const base = file => new URL('assets/' + file, root).href;
  const sizes = { A4: [210,297], A5: [148,210], Letter: [215.9,279.4] };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when = date => new Date(date).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
  let wordLibrary;
  function margins(options, notes) {
    const [x,y] = sizes[options.paper];
    const [width,height] = options.orientation === 'landscape' ? [y,x] : [x,y];
    const margin = Math.min(width,height) < 160 ? 14 : 18;
    const sidebar = !notes.length ? 0 : options.scope === 'notes' ? (width - 2*margin)*.6 : Math.max(38,Math.min(58,width*.25));
    return { width,height,margin,sidebar };
  }
  function style(s, box, preview = false) {
    const { width,height,margin,sidebar } = box;
    return `@page{size:${width}mm ${height}mm;margin:0}
    :root{--sheet-width:${width}mm;--sheet-height:${height}mm;--sheet-margin:${margin}mm;--page-area:${height-2*margin-5}mm;
      --body-width:${width-2*margin-sidebar-(sidebar?7:0)}mm;--note-width:${sidebar}mm;--gap:${sidebar?7:0}mm;
      --note-display:${sidebar?'block':'none'};--columns:minmax(0,1fr)${sidebar?' var(--note-width)':''};--print-font:${s.fontSize}pt;
      --note-font:${Math.max(9,s.fontSize*.8)}pt}
    ${preview?'html{overflow:hidden}.print-page{zoom:var(--preview-zoom,1)}':''}`;
  }
  function paper(job, content, preview = false) {
    return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>${esc(job.title)}</title>
    <link href="${base('export-print.css')}" rel="stylesheet"><style>${style(job.options,job.box,preview)}</style></head>
    <body>${content}</body></html>`;
  }
  function offscreen() {
    const frame = document.createElement('iframe');
    frame.className='archive-export-staging';
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex=-1;
    document.body.append(frame);
    return frame;
  }
  function loadFrame(frame, content) {
    return new Promise((resolve,reject) => {
      frame.addEventListener('load',() => resolve(frame.contentDocument),{once:true});
      frame.addEventListener('error',() => reject(new Error('无法载入导出预览。')),{once:true});
      frame.srcdoc = content;
    });
  }
  async function prepare(row, options, annotations) {
    const notes = options.scope === 'body' ? [] : annotations.filter(n => n.entryId === row.id);
    let html = '';
    if (row.url && options.scope !== 'notes') {
      const url = new URL(row.url,root);
      const response = await fetch(url,{credentials:'omit'});
      if(!response.ok)throw new Error('无法读取所选条目。');
      const documentCopy = new DOMParser().parseFromString(await response.text(),'text/html');
      const source = documentCopy.querySelector('#reading-body');
      source.querySelectorAll('script,style,iframe,object,.book-note-index').forEach(n=>n.remove());
      source.querySelectorAll('img').forEach(img=>{
        const asset=new URL(img.getAttribute('src'),url);
        if(asset.origin!==root.origin)img.remove();
        else img.src=asset.href;
      });
      source.querySelectorAll('a[href]').forEach(a=>{
        const link=new URL(a.getAttribute('href'),url);
        if(link.protocol==='https:'||link.protocol==='http:')a.href=link.href;
        else a.removeAttribute('href');
      });
      html=source.outerHTML;
    }
    const job={id:row.id,title:row.name||row.title,format:options.format,options,notes,box:margins(options,notes)};
    const config={...options,title:job.title,notes,textualForeign:['books','articles'].includes(row.category)&&row.language!=='zh'&&row.reading!=='bibliographic'};
    const frame=offscreen();
    frame.setAttribute('sandbox','allow-same-origin allow-scripts');
    try{
      const json=JSON.stringify(config).replace(/</g,'\\u003c');
      const content=`<div id="export-source">${html}</div><div id="export-pages"></div>
        <script id="export-config" type="application/json">${json}</script><script src="${base('export-layout.js')}"></script>`;
      const doc=await loadFrame(frame,paper(job,content));
      for(let i=0;!doc.documentElement.dataset.ready&&!doc.documentElement.dataset.error&&i<250;i++)await new Promise(r=>setTimeout(r,100));
      if(!doc.documentElement.dataset.ready)throw Error(doc.documentElement.dataset.error||'排版超时，请减少同时导出的条目。');
      job.sheets=[...doc.querySelectorAll('.print-page')].map(x=>x.outerHTML);
      job.pages=job.sheets.length;
      job.state='ready';
      return job;
    }finally{frame.remove();}
  }
  async function preview(job, page, frame) {
    const doc=await loadFrame(frame,paper(job,job.sheets[page-1],true));
    const widths=job.box.width*96/25.4, scale=Math.min(1,(frame.clientWidth-3)/widths);
    doc.documentElement.style.setProperty('--preview-zoom',Math.max(.1,scale));
    frame.style.height=Math.ceil(job.box.height*96/25.4*Math.max(.1,scale))+'px';
  }
  async function imageData(src) {
    const url=new URL(src,root);
    if(url.origin!==root.origin)throw Error('图像不在公开资料馆内。');
    const response=await fetch(url,{credentials:'omit'});
    if(!response.ok)throw Error('有原图尚未加载。');
    return response.blob();
  }
  const dataUrl = blob => new Promise((ok,fail) => {const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=fail;reader.readAsDataURL(blob);});
  const docBody = job => new DOMParser().parseFromString(job.sheets.join(''),'text/html');
  async function markdown(job) {
    const body=docBody(job);
    for(const img of body.querySelectorAll('img'))img.src=await dataUrl(await imageData(img.src));
    function md(node){
      if(node.nodeType===Node.TEXT_NODE)return node.textContent;
      const tag=node.localName;
      if(tag==='img')return '!['+(node.alt||'')+']('+node.src+')';
      if(tag==='math'||tag==='table')return '\n\n'+node.outerHTML+'\n\n';
      const text=[...node.childNodes].map(md).join('');
      if(/^h[1-6]$/.test(tag))return '\n\n'+'#'.repeat(Number(tag[1]))+' '+text.trim()+'\n\n';
      if(tag==='em'||tag==='i'||tag==='blockquote')return tag==='blockquote'?'\n\n> *'+text.trim().replace(/\n/g,'\n> ')+'*\n\n':'*'+text+'*';
      if(tag==='strong'||tag==='b')return '**'+text+'**';
      if(tag==='a'&&node.href)return '['+text+']('+node.href+')';
      if(tag==='p'||tag==='pre')return '\n\n'+text.trim()+'\n\n';
      if(tag==='mark')return '<mark>'+text+'</mark>';
      if(tag==='li')return '\n- '+text.trim();
      if(tag==='br')return '  \n';
      return text;
    }
    const main=[...body.querySelectorAll('.page-body')].map(md).join('').trim();
    const appendix=job.notes.length?'\n\n## 批注\n'+job.notes.map(n=>
      '\n> '+String(n.quote).replace(/\n/g,'\n> ')+'\n\n**Ivan:**\n\n'+n.body+'\n\n'+when(n.createdAt)+'\n').join(''):'';
    return new Blob([main+appendix+'\n'],{type:'text/markdown;charset=utf-8'});
  }
  function getWord() {
    return wordLibrary ||= new Promise((ok,fail)=>{
      const script=document.createElement('script');
      script.src=base('docx.js');
      script.onload=()=>window.docx?ok(window.docx):fail(new Error('Word 组件初始化失败。'));
      script.onerror=()=>fail(new Error('Word 组件未能加载。'));
      document.head.append(script);
    });
  }
  async function word(job) {
    const D=await getWord(),doc=docBody(job);
    const comments=job.notes.map((n,id)=>({id,author:'Ivan',initials:'I',date:new Date(n.createdAt),
      children:[new D.Paragraph(n.body||''),new D.Paragraph(when(n.createdAt))]}));
    const byId=new Map(job.notes.map((n,i)=>[n.id,i])),seen=new Set();
    const font=job.options.fontSize*2;
    async function inline(node, style={}) {
      if(node.nodeType===Node.TEXT_NODE)return node.nodeValue?[new D.TextRun({text:node.nodeValue,size:font,...style})]:[];
      const tag=node.localName;
      if(tag==='br')return [new D.TextRun({break:1})];
      if(tag==='img'){
        let blob=await imageData(node.src);
        let type=blob.type==='image/jpeg'?'jpg':'png';
        if(!['image/png','image/jpeg'].includes(blob.type)){
          const bitmap=await createImageBitmap(blob);
          const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
          canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
          blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        }
        const bitmap=await createImageBitmap(blob);
        const scale=Math.min(1,((job.box.width-2*job.box.margin)*96/25.4)/bitmap.width,420/bitmap.height);
        const transformation={width:Math.round(bitmap.width*scale),height:Math.round(bitmap.height*scale)};
        bitmap.close();
        return [new D.ImageRun({data:await blob.arrayBuffer(),type,transformation})];
      }
      if(tag==='math')return [new D.Math({children:[new D.MathRun(node.textContent)]})];
      const styles={...style};
      if(tag==='i'||tag==='em')styles.italics=true;
      if(tag==='b'||tag==='strong')styles.bold=true;
      if(tag==='sub')styles.subScript=true;
      if(tag==='sup')styles.superScript=true;
      if(tag==='mark')styles.highlight='yellow';
      const kids=[];
      for(const child of node.childNodes)kids.push(...await inline(child,styles));
      if(tag==='mark'&&byId.has(node.dataset.note)&&!seen.has(node.dataset.note)){
        const id=byId.get(node.dataset.note);
        seen.add(node.dataset.note);
        return [new D.CommentRangeStart(id),...kids,new D.CommentRangeEnd(id),new D.CommentReference(id)];
      }
      return kids;
    }
    async function blocks(element,quote=false){
      const result=[];
      for(const child of element.children){
        const tag=child.localName;
        if(tag==='table'){
          const rows=[];
          for(const tr of child.rows){
            const cells=[];
            for(const tc of tr.cells)cells.push(new D.TableCell({columnSpan:tc.colSpan,rowSpan:tc.rowSpan,
              children:[new D.Paragraph({children:await inline(tc,{bold:tc.localName==='th',italics:quote})})]}));
            rows.push(new D.TableRow({children:cells,tableHeader:tr.parentElement.localName==='thead'}));
          }
          if(rows.length)result.push(new D.Table({rows,width:{size:100,type:'pct'}}));
        }else if(['div','article','section','blockquote','ul','ol'].includes(tag)){
          result.push(...await blocks(child,quote||tag==='blockquote'));
        }else if(tag==='img'){
          result.push(new D.Paragraph({children:await inline(child)}));
        }else{
          result.push(new D.Paragraph({children:await inline(child,{italics:quote}),
            heading:/^h[1-6]$/.test(tag)?D.HeadingLevel['HEADING_'+tag[1]]:undefined}));
        }
      }
      return result;
    }
    const nodes=[];
    for(const part of doc.querySelectorAll('.page-body'))nodes.push(...await blocks(part));
    for(const note of job.notes)if(!seen.has(note.id)){
      const id=byId.get(note.id);
      nodes.push(new D.Paragraph({children:[new D.CommentRangeStart(id),new D.TextRun(note.quote),new D.CommentRangeEnd(id),new D.CommentReference(id)]}));
    }
    const mm=n=>Math.round(n*1440/25.4);
    const docx=new D.Document({comments:comments.length?{children:comments}:undefined,
      sections:[{properties:{page:{size:{width:mm(job.box.width),height:mm(job.box.height)},margin:{top:mm(job.box.margin),bottom:mm(job.box.margin),left:mm(job.box.margin),right:mm(job.box.margin)}}},children:nodes}]});
    return D.Packer.toBlob(docx);
  }
  async function print(job) {
    const frame=offscreen();
    try{
      await loadFrame(frame,paper(job,job.sheets.join('')));
      await frame.contentDocument.fonts.ready;
      frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }catch(error){frame.remove();throw error;}
  }
  window.LibraryBrowserExport={prepare,preview,print,blob:job=>job.format==='docx'?word(job):markdown(job)};
})();
