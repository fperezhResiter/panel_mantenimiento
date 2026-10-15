const fs=require('node:fs');
const assert=require('node:assert/strict');
const PDFLib=require('../../web/vendor/pdf-lib.min.js');
const {pathToFileURL}=require('node:url');
function nodo(tag,texto='',clase='') {
 return {tagName:tag,innerText:texto,textContent:texto,style:{},dataset:{},children:[],classList:{contains:n=>clase.split(' ').includes(n)},getClientRects:()=>[{}],querySelector:()=>null,remove(){},closest(){for(let n=this;n;n=n.parentElement){if(n.hidden||n.tagName==='DETAILS'&&!n.open||n.classList?.contains('vista-oculta'))return n;}return null;}};
}
function agregar(padre,...hijos){for(const hijo of hijos){hijo.parentElement=padre;padre.children.push(hijo);}}
const paleta=[['mt-rojo','rgb(255,215,215)','rgb(146,33,33)'],['mt-amarillo','rgb(255,244,190)','rgb(113,80,0)'],['mt-verde','rgb(222,244,220)','rgb(35,91,36)'],['mt-gris','rgb(231,234,238)','rgb(64,76,89)']];
const tabla=nodo('TABLE');tabla.rows=[];
function fila(tabla,textos,tipo='TBODY',clase='',colores=false) {
 const tr=nodo('TR','',clase),grupo=nodo(tipo);grupo.parentElement=tabla;tr.parentElement=grupo;
 tr.cells=textos.map((texto,i)=>{
  const estado=colores&&i>0&&i<5?paleta[i-1]:null;
  const c=nodo(tipo==='THEAD'?'TH':'TD',texto,estado?.[0]||'');c.parentElement=tr;c.colSpan=1;
  c.getBoundingClientRect=()=>({width:i===0?240:95});
  if(estado)c.style={backgroundColor:estado[1],color:estado[2]};
  if(clase==='region')c.style={backgroundColor:'rgb(185,215,236)',color:'rgb(7,55,98)'};
  if(tipo==='TFOOT')c.style={backgroundColor:'rgb(7,55,98)',color:'rgb(255,255,255)'};
  if(i===6&&tipo!=='THEAD') {
   const valor=texto==='—'?null:Number(texto.replace(' %','').replace(',','.'));
   const clase=require('../../web/js/mantenciones.js').colorPorcentajeMt(valor);
   const colores={verde:['rgb(23,99,68)','rgb(228,244,236)'],amarillo:['rgb(121,80,0)','rgb(255,241,194)'],rojo:['rgb(161,36,36)','rgb(251,233,232)'],neutro:['rgb(83,97,112)','rgb(237,240,243)']};
   const indicador=nodo('SPAN',texto,'semaforo '+clase);indicador.style={color:colores[clase][0],backgroundColor:colores[clase][1]};
   c.querySelector=s=>s==='.semaforo'?indicador:null;
  }
  return c;
 });tabla.rows.push(tr);
}
fila(tabla,['Región / Unidad','Mantención Vencida','Próxima a vencer','Mantención Vigente','No operativo','Total general','% no vencidas'],'THEAD','',true);
fila(tabla,['REGIÓN NORTE','4','6','12','8','30','81,8 %'],'TBODY','region',true);
fila(tabla,['UNIDAD A','1','2','4','1','8','85,7 %'],'TBODY','',true);
fila(tabla,['UNIDAD B','1','3','6','2','12','90 %'],'TBODY','',true);
fila(tabla,['UNIDAD C','2','1','2','0','5','60 %'],'TBODY','',true);
fila(tabla,['UNIDAD D','0','0','0','5','5','—'],'TBODY','',true);
fila(tabla,['Total general','4','6','12','8','30','81,8 %'],'TFOOT','',true);
const cerrado=nodo('DETAILS');cerrado.open=false;
const tablaOculta=nodo('TABLE');tablaOculta.rows=[];
fila(tablaOculta,Array(7).fill(''),'THEAD');
for(let i=0;i<404;i++)fila(tablaOculta,[i===0?'PATENTE PRUEBA':'','','','','','','']);
agregar(cerrado,nodo('SUMMARY','Detalle de patentes incluidas'),tablaOculta);
const doc={body:nodo('BODY'),getElementById:()=>null,querySelectorAll:s=>s==='table'?[tabla,tablaOculta]:[],createElement:tag=>nodo(tag.toUpperCase())};
doc.body.dataset.panel='resumen';doc.body.append=()=>{};
const leyenda=nodo('DIV','','leyenda');
const htmlResumen=fs.readFileSync('web/pages/Panel_Resumen_Mantencion.html','utf8');
const bloqueLeyenda=htmlResumen.match(/id="mt-leyenda-no-vencidas"[^>]*>([\s\S]*?)<\/div>/)[1];
const tonos={verde:['rgb(23,99,68)','rgb(228,244,236)'],amarillo:['rgb(121,80,0)','rgb(255,241,194)'],rojo:['rgb(161,36,36)','rgb(251,233,232)'],neutro:['rgb(83,97,112)','rgb(237,240,243)']};
const etiquetas=[];
for(const m of bloqueLeyenda.matchAll(/<span class="semaforo (\w+)">([^<]+)<\/span>/g)) {
 const span=nodo('SPAN',m[2],'semaforo '+m[1]);span.style={color:tonos[m[1]][0],backgroundColor:tonos[m[1]][1]};agregar(leyenda,span);etiquetas.push(m[2]);
}
assert.equal(etiquetas.length,4);
leyenda.querySelector=s=>s==='.semaforo'?leyenda.children[0]:null;
agregar(doc.body,nodo('H2','Resumen por región y Unidad - datos de prueba'),nodo('P','% no vencidas'),leyenda,tabla,nodo('P','No operativo se excluye del porcentaje de mantenciones no vencidas.'),cerrado);
doc.defaultView={getComputedStyle:e=>({display:'block',visibility:'visible',color:e.style.color||'rgb(27,42,58)',backgroundColor:e.style.backgroundColor||'rgb(255,255,255)'})};
const fuente=fs.readFileSync('web/js/panel_pdf.js','utf8').replace('window.PanelPDF = {descargar};','window.PanelPDF = {descargar, crearInforme};');
function motor(antes=false){const window={};let codigo=fuente;if(antes)codigo=codigo.replace("!el.closest('[hidden],.vista-oculta,details:not([open])') && ",'');new Function('window','document','PDFLib',codigo)(window,doc,PDFLib);return window.PanelPDF;}
(async()=>{
 const antes=await motor(true).crearInforme(doc,'Resumen de mantención',[],null);
 const despues=await motor().crearInforme(doc,'Resumen de mantención',[],null);
 assert(antes.getPageCount()>10);assert.equal(despues.getPageCount(),1);
 const bytes=await despues.save();fs.writeFileSync('tmp/pdf-pruebas/resumen-corregido.pdf',bytes);
 const pdfjs=await import(pathToFileURL('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs').href);
 const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
 const pg=await pdf.getPage(1);const texto=(await pg.getTextContent()).items.map(i=>i.str).join(' ');
 assert(!texto.includes('Detalle de patentes incluidas'));assert(!texto.includes('PATENTE PRUEBA'));
 for(const etiqueta of etiquetas)assert(texto.includes(etiqueta),'Leyenda en PDF: '+etiqueta);
 const ops=await pg.getOperatorList();const colores=new Set();
 ops.fnArray.forEach((op,i)=>{if(op===pdfjs.OPS.setFillRGBColor){const a=ops.argsArray[i];colores.add(typeof a[0]==='string'?a[0]:'#'+Array.from(a).map(n=>n.toString(16).padStart(2,'0')).join(''));}});
 for(const tono of ['#ffd7d7','#fff4be','#def4dc','#e7eaee'])assert(colores.has(tono),'Conserva '+tono);
 for(const tono of ['#e3f0fa','#b9d7ec'])assert(colores.has(tono),'Distingue filas con '+tono);
 for(const tono of ['#e4f4ec','#fff1c2','#fbe9e8','#edf0f3'])assert(colores.has(tono),'Semáforo del porcentaje '+tono);
 assert(ops.fnArray.some((op,i)=>op===pdfjs.OPS.setLineWidth&&ops.argsArray[i][0]===0.7),'Bordes visibles en la tabla');
 await pdf.destroy();
 cerrado.open=true;
 const abierto=await motor().crearInforme(doc,'Resumen de mantención',[],null);
 assert(abierto.getPageCount()>despues.getPageCount());
 console.log(`OK: reproducción del error ${antes.getPageCount()} páginas; corregido ${despues.getPageCount()}; detalle abierto ${abierto.getPageCount()}; cuatro colores de columnas verificados.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
