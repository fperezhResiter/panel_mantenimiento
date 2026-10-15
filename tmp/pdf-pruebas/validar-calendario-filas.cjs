const fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const PDFLib=require('../../web/vendor/pdf-lib.min.js');
function nodo(tag,texto='',clase='') {return {tagName:tag,innerText:texto,textContent:texto,style:{},dataset:{},children:[],classList:{contains:n=>clase.split(' ').includes(n)},getClientRects:()=>[{}],querySelector:()=>null,remove(){},closest(){for(let p=this;p;p=p.parentElement)if(p.hidden)return p;return null;}};}
const tablas=[];
function tabla(clase,cabecera) {const t=nodo('TABLE','',clase);t.rows=[];tablas.push(t);fila(t,cabecera,'THEAD');return t;}
function fila(t,textos,tipo='TBODY',clase='',oculta=false) {
 const tr=nodo('TR','',clase);tr.hidden=oculta;tr.parentElement={tagName:tipo,parentElement:t};
 tr.cells=textos.map((texto,i)=>{const c=nodo(tipo==='THEAD'?'TH':'TD',texto,clase==='programado'&&i===0?'programado':'');c.colSpan=textos.length===1?t.rows[0].cells.length:1;c.getBoundingClientRect=()=>({width:i===0?190:120});c.parentElement=tr;
 if(texto==='Mantención Vigente'){const s=nodo('SPAN',texto,'semaforo verde');s.style={color:'rgb(23,99,68)',backgroundColor:'rgb(228,244,236)'};c.querySelector=q=>q==='.semaforo'?s:null;}return c;});t.rows.push(tr);
}
const calendario=tabla('calendario',['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']);
fila(calendario,['1 - 3 mantenciones','2','3','4','5','6','7'],'TBODY','programado');
const agenda=tabla('',['Patente','Unidad','Medida','Fecha proyectada','Próxima mantención','Estado']);
fila(agenda,['Zona 1'],'TBODY','region');fila(agenda,['Unidad A'],'TBODY','mt-agenda-unidad');fila(agenda,['Línea: RESIDUOS'],'TBODY','zona-linea');
fila(agenda,['EQUIPO A','UNIDAD A','KM','05-10-2026','1.500','Mantención Vigente']);
fila(agenda,['NO EXPORTAR','UNIDAD A','KM','05-10-2026','1.500','Mantención Vigente'],'TBODY','',true);
fila(agenda,['EQUIPO B','UNIDAD A','HR','06-10-2026','2.000','Mantención Vigente']);
fila(agenda,['EQUIPO C','UNIDAD A','KM','07-10-2026','2.500','Mantención Vigente']);
const regional=tabla('detalle',['Fecha','Patente','Región','Unidad','Medida','Próxima mantención','Estado']);
fila(regional,['05-10-2026','EQUIPO A','NORTE','UNIDAD A','KM','1.500','Mantención Vigente']);
fila(regional,['06-10-2026','EQUIPO B','NORTE','UNIDAD A','HR','2.000','Mantención Vigente']);
const doc={body:nodo('BODY'),getElementById:()=>null,querySelectorAll:s=>s==='table'?tablas:[],createElement:t=>nodo(t.toUpperCase())};
doc.body.dataset.panel='calendario';doc.body.append=()=>{};
doc.body.children=[nodo('P','Datos de prueba: calendario, agenda agrupada y descarga por región.'),calendario,nodo('H3','Agenda agrupada'),agenda,nodo('H3','Tabla de la descarga por región'),regional];
doc.defaultView={getComputedStyle:e=>({display:'block',visibility:'visible',color:e.style.color||'rgb(27,42,58)',backgroundColor:e.style.backgroundColor||'rgb(255,255,255)'})};
const window={};const fuente=fs.readFileSync('web/js/panel_pdf.js','utf8').replace('window.PanelPDF = {descargar};','window.PanelPDF = {descargar, crearInforme};');new Function('window','document','PDFLib',fuente)(window,doc,PDFLib);
(async()=>{
 const pdf=await window.PanelPDF.crearInforme(doc,'Calendario - verificación de filas',[],null);const bytes=await pdf.save();fs.writeFileSync('tmp/pdf-pruebas/calendario-filas.pdf',bytes);
 const pdfjs=await import(pathToFileURL('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs').href);
 const lectura=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;const tonos=new Map();let texto='';let bordes=0;
 for(let i=1;i<=lectura.numPages;i++){const p=await lectura.getPage(i);texto+=(await p.getTextContent()).items.map(e=>e.str).join(' ');const ops=await p.getOperatorList();ops.fnArray.forEach((op,j)=>{const a=ops.argsArray[j];if(op===pdfjs.OPS.setFillRGBColor){const h=typeof a[0]==='string'?a[0]:'#'+Array.from(a).map(n=>n.toString(16).padStart(2,'0')).join('');tonos.set(h,(tonos.get(h)||0)+1);}if(op===pdfjs.OPS.setLineWidth&&a[0]===0.7)bordes++;});}
 for(const h of ['#b9d7ec','#d5e7f5','#e3edf6','#e3f0fa'])assert(tonos.has(h),'Fondo '+h);assert.equal(tonos.get('#e4f2fc'),1);assert(bordes>0);assert(!texto.includes('NO EXPORTAR'));
 await lectura.destroy();console.log('OK: agenda y tabla regional con filas alternadas y grupos; calendario azul conservado; filas ocultas excluidas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
