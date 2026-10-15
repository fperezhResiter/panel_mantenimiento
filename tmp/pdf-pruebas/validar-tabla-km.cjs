const fs=require('node:fs');
const PDFLib=require('../../web/vendor/pdf-lib.min.js');
const nodo=(tag,texto='',clase='')=>({tagName:tag,innerText:texto,textContent:texto,style:{},dataset:{},children:[],classList:{contains:n=>clase.split(' ').includes(n)},getClientRects:()=>[{}],querySelector:()=>null,remove(){}});
const tabla=nodo('TABLE');tabla.rows=[];
function agregar(textos,clase='',seccion='TBODY') {
 const tr=nodo('TR','',clase);tr.parentElement={tagName:seccion};
 tr.cells=textos.map((texto,i)=>{
  const td=nodo(seccion==='THEAD'||clase.includes('km-grupo')?'TH':'TD',texto);
  td.colSpan=textos.length===1?4:1;
  td.getBoundingClientRect=()=>({width:i===0?230:170});
  if(i===1&&seccion!=='THEAD') {
   const estado=nodo('SPAN',texto);estado.style={color:'rgb(22,101,73)',backgroundColor:'rgb(226,243,235)'};
   td.querySelector=s=>s==='.semaforo'?estado:null;
  }
  if(i===2&&textos[0]==='EQUIPO B')td.classList={contains:n=>n==='km-uso-alerta'};
  return td;
 });tabla.rows.push(tr);
}
agregar(['Patente / Unidad','Status mantención','Última lectura','Saldo'],'','THEAD');
agregar(['Zona 1 - 4 patentes'],'km-grupo km-grupo-region');
agregar(['Unidad A - 4 patentes'],'km-grupo km-grupo-unidad');
agregar(['Línea: RESIDUOS'],'km-grupo zona-linea');
agregar(['EQUIPO A','Mantención Vigente','1.250 KM','500 KM']);
agregar(['EQUIPO B','Mantención Vigente','3.500 KM','400 KM']);
agregar(['EQUIPO C','Mantención Vigente','2.400 KM','300 KM']);
agregar(['EQUIPO D','Mantención Vigente','1.900 KM','200 KM']);
const imagen=nodo('IMG');imagen.width=1400;imagen.height=410;
const png='data:image/png;base64,'+fs.readFileSync('tmp/pdf-pruebas/km-valores.png').toString('base64');
const doc={body:nodo('BODY'),getElementById:()=>null,querySelectorAll:s=>s==='table'?[tabla]:[],createElement:tag=>tag==='canvas'?{getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>png}:nodo(tag.toUpperCase())};
doc.body.dataset.panel='seguimiento';doc.body.append=()=>{};
doc.body.children=[nodo('P','Datos de prueba para verificar gráficos y separaciones de la tabla.'),imagen,nodo('H3','Detalle por zona, Unidad y línea'),tabla];
doc.defaultView={getComputedStyle:e=>({display:'block',visibility:'visible',color:e.style.color||'rgb(27,42,58)',backgroundColor:e.style.backgroundColor||'rgb(255,255,255)'})};
const window={};
const codigo=fs.readFileSync('web/js/panel_pdf.js','utf8').replace('window.PanelPDF = {descargar};','window.PanelPDF = {descargar, crearInforme};');
new Function('window','document','PDFLib',codigo)(window,doc,PDFLib);
(async()=>{
 const pdf=await window.PanelPDF.crearInforme(doc,'Seguimiento KM-HR - revisión visual',[],null);
 fs.writeFileSync('tmp/pdf-pruebas/km-separaciones.pdf',await pdf.save());
 console.log('PDF de comprobación generado:',pdf.getPageCount(),'páginas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
