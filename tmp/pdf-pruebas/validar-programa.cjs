const fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const PDFLib=require('../../web/vendor/pdf-lib.min.js');
function nodo(tag,texto='',clase='') {return {tagName:tag,innerText:texto,textContent:texto,style:{},dataset:{},children:[],classList:{contains:n=>clase.split(' ').includes(n)},getClientRects:()=>[{}],remove(){},closest(){for(let p=this;p;p=p.parentElement)if(p.hidden||p.tagName==='DETAILS'&&!p.open)return p;return null;},querySelectorAll(s){return this.children.flatMap(e=>[...(s==='[data-pdf-leyenda]'&&e.dataset.pdfLeyenda?[e]:[]),...e.querySelectorAll(s)]);},querySelector(s){return this.querySelectorAll(s)[0]||null;}};}
function agregar(p,...hijos){for(const h of hijos){h.parentElement=p;p.children.push(h);}}
const html=fs.readFileSync('web/pages/Panel_Programa_Mantencion.html','utf8');
function descripcion(clave){return html.match(new RegExp('data-vista="programa\\.'+clave+'"[^>]*data-pdf-descripcion="([^"]+)"'))[1];}
function leyenda(etiquetas,id='') {
 const l=nodo('DIV','','leyenda');l.id=id;
 etiquetas.forEach((t,i)=>{const e=nodo('SPAN',t);e.dataset.pdfLeyenda=t;e.style.color=['rgb(14,129,197)','rgb(46,158,107)','rgb(196,60,57)'][i%3];agregar(l,e);});return l;
}
const cumplimiento=nodo('FIGURE');cumplimiento.dataset.pdfDescripcion=descripcion('cumplimiento');
agregar(cumplimiento,nodo('FIGCAPTION','Cumplimiento por mes'),leyenda(['Zona 1','Zona 2','Zona 3','Zona 4','Zona 5','Zona 6','Zona 7']));
const cantidades=nodo('FIGURE');cantidades.dataset.pdfDescripcion=descripcion('cantidades');
agregar(cantidades,nodo('FIGCAPTION','Programadas y realizadas por mes'),leyenda(['Norte - Programadas','Norte - Realizadas','Sur - Programadas','Sur - Realizadas']));
const cascada=nodo('DETAILS');cascada.open=true;cascada.dataset.pdfDescripcion=descripcion('estados');
const estados=leyenda(['Realizadas: 21','Regularizadas: 1','No realizadas: 8'],'leyenda-estados');
agregar(estados,nodo('P','Distribución sobre 30 patentes. N/A se excluye.'));
agregar(cascada,nodo('SUMMARY','Estados del mes - Cascada'),estados);
const tabla=nodo('TABLE');tabla.rows=[];
function fila(textos,seccion='TBODY',clase='',hidden=false){
 const tr=nodo('TR','',clase);tr.hidden=hidden;tr.parentElement={tagName:seccion,parentElement:tabla};
 tr.cells=textos.map((t,i)=>{const c=nodo(seccion==='THEAD'?'TH':'TD',t);c.colSpan=1;c.parentElement=tr;c.getBoundingClientRect=()=>({width:i===0?240:100});
  if(i===6&&seccion!=='THEAD'){const s=nodo('SPAN',t);const v=parseFloat(t.replace(',','.'));s.style={color:v>=90?'rgb(23,99,68)':v>=70?'rgb(121,80,0)':'rgb(161,36,36)',backgroundColor:v>=90?'rgb(228,244,236)':v>=70?'rgb(255,241,194)':'rgb(251,233,232)'};c.querySelector=q=>q==='.semaforo'?s:null;}return c;});tabla.rows.push(tr);
}
fila(['Región / Unidad','Programadas','Realizadas','Regularizadas','No realizadas','N/A','% cumplimiento'],'THEAD');
fila(['NORTE','30','21','1','8','0','73,3 %'],'TBODY','region');
fila(['Unidad A','10','9','0','1','0','90 %'],'TBODY','ceco');
fila(['FILA OCULTA','10','9','0','1','0','90 %'],'TBODY','ceco',true);
fila(['Unidad B','20','12','1','7','0','65 %'],'TBODY','ceco');
fila(['TOTAL GENERAL','30','21','1','8','0','73,3 %'],'TFOOT');
const doc={body:nodo('BODY'),getElementById:()=>null,querySelectorAll:s=>s==='table'?[tabla]:[],createElement:t=>nodo(t.toUpperCase())};doc.body.dataset.panel='programa';doc.body.append=()=>{};
doc.defaultView={getComputedStyle:e=>({display:'block',visibility:'visible',color:e.style.color||'rgb(27,42,58)',backgroundColor:e.style.backgroundColor||'rgb(255,255,255)'})};
agregar(doc.body,nodo('P','Datos de prueba para revisar leyendas, explicaciones y filas.'),cumplimiento,cantidades,cascada,nodo('H3','Detalle por región y Unidad'),tabla);
const window={};const fuente=fs.readFileSync('web/js/panel_pdf.js','utf8').replace('window.PanelPDF = {descargar};','window.PanelPDF = {descargar, crearInforme};');new Function('window','document','PDFLib',fuente)(window,doc,PDFLib);
(async()=>{
 const pdf=await window.PanelPDF.crearInforme(doc,'Programa de mantención - revisión visual',[],null);const bytes=await pdf.save();fs.writeFileSync('tmp/pdf-pruebas/programa-filas-leyendas.pdf',bytes);
 const pdfjs=await import(pathToFileURL('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs').href);
 const lectura=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;let texto='';const textos=[],tonos=new Set();
 for(let i=1;i<=lectura.numPages;i++){const p=await lectura.getPage(i);const items=(await p.getTextContent()).items;textos.push(...items);texto+=items.map(e=>e.str).join(' ');const ops=await p.getOperatorList();ops.fnArray.forEach((op,j)=>{if(op===pdfjs.OPS.setFillRGBColor){const a=ops.argsArray[j];tonos.add(typeof a[0]==='string'?a[0]:'#'+Array.from(a).map(n=>n.toString(16).padStart(2,'0')).join(''));}});}
 const primeras=['Zona 1','Zona 2','Zona 3'].map(t=>textos.find(i=>i.str===t));assert(primeras.every(Boolean));assert.equal(new Set(primeras.map(i=>i.transform[4])).size,3);assert(primeras.every(i=>Math.abs(i.transform[5]-primeras[0].transform[5])<1));
 const estadosPdf=['Realizadas: 21','Regularizadas: 1','No realizadas: 8'].map(t=>textos.find(i=>i.str===t));assert.equal(new Set(estadosPdf.map(i=>i.transform[4])).size,3);
 for(const t of ['Evolución mensual del cumplimiento','La línea continua','La cascada acumula','Distribución sobre 30 patentes'])assert(texto.includes(t));
 for(const c of ['#b9d7ec','#e3f0fa'])assert(tonos.has(c));assert(!texto.includes('FILA OCULTA'));
 await lectura.destroy();console.log('OK: leyendas de historial y cascada en tres columnas; explicaciones, colores de filas, semáforos y filas ocultas verificados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
