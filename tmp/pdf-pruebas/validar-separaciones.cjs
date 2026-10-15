const fs = require('node:fs');
const path = require('node:path');
const PDFLib = require('../../web/vendor/pdf-lib.min.js');
const elemento = (tag, texto='', clase='') => ({tagName:tag,innerText:texto,textContent:texto,style:{},dataset:{},children:[],classList:{contains:n=>clase.split(' ').includes(n)},getClientRects:()=>[{}],getBoundingClientRect:()=>({width:tag==='TD'?160:100}),querySelector:()=>null,remove(){}});
const doc = {body:elemento('BODY'),querySelectorAll:selector=>selector==='table'?[tabla]:[],createElement:tag=>elemento(tag.toUpperCase()),getElementById:()=>null};
doc.body.dataset.panel='reportabilidad';
doc.body.append=()=>{};
doc.defaultView={getComputedStyle:el=>({display:'block',visibility:'visible',color:el.style.color||'rgb(27,42,58)',backgroundColor:el.style.backgroundColor||'rgb(255,255,255)'})};
const tabla=elemento('TABLE');
tabla.rows=[];
function fila(textos,tipo='TBODY',clase='') {
 const f=elemento('TR','',clase);f.parentElement={tagName:tipo};
 f.cells=textos.map((t,i)=>{
  const c=elemento(tipo==='THEAD'?'TH':'TD',t);c.colSpan=1;
  c.getBoundingClientRect=()=>({width:i===0?300:130});
  if(i===2&&tipo!=='THEAD') {
   const sem=elemento('SPAN',t);sem.style={color:'rgb(22,101,73)',backgroundColor:'rgb(226,243,235)'};
   c.querySelector=s=>s==='.semaforo'?sem:null;
  }
  return c;
 });
 tabla.rows.push(f);
}
fila(['Zona / Unidad / Línea','Reportadas','Cumplimiento','Total patentes'], 'THEAD');
fila(['ZONA 1','40','54,8 %','73'],'TBODY','region');
fila(['UNIDAD A','11','42,3 %','26'],'TBODY','ceco');
fila(['Línea: AGUAS','2','40 %','5'],'TBODY','zona-linea');
fila(['Línea: RESIDUOS','2','40 %','5'],'TBODY','zona-linea');
fila(['Línea: SANITARIOS','5','41,7 %','12'],'TBODY','zona-linea');
fila(['UNIDAD B','29','61,7 %','47'],'TBODY','ceco');
fila(['ZONA 2','37','94,9 %','39'],'TBODY','region');
fila(['UNIDAD C','37','94,9 %','39'],'TBODY','ceco');
fila(['Total general','77','68,8 %','112'],'TFOOT');
doc.body.children=[elemento('H2','Verificación de separaciones - datos de prueba'),tabla];
const window={};
const codigo=fs.readFileSync(path.resolve('web/js/panel_pdf.js'),'utf8').replace('window.PanelPDF = {descargar};','window.PanelPDF = {descargar, crearInforme};');
new Function('window','document','PDFLib',codigo)(window,doc,PDFLib);
(async()=>{
 const pdf=await window.PanelPDF.crearInforme(doc,'Reportabilidad - revisión visual',[],null);
 fs.writeFileSync(path.resolve('tmp/pdf-pruebas/separaciones.pdf'),await pdf.save());
 console.log('PDF nativo generado:',pdf.getPageCount(),'página(s).');
})().catch(e=>{console.error(e);process.exitCode=1;});
