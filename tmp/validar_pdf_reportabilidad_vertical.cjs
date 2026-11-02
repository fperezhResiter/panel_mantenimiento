const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {PDFDocument}=require('../web/vendor/pdf-lib.min.js');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({acceptDownloads:true}),errores=[];
  page.on('pageerror',e=>errores.push(e.message));
  await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad.html')).href);
  await page.waitForFunction(()=>window.PanelPDF&&!document.querySelector('#resultados').hidden&&!document.querySelector('#consultar').disabled);
  await page.evaluate(()=>{
   const serializar=XMLSerializer.prototype.serializeToString;
   XMLSerializer.prototype.serializeToString=function(nodo){
    if(nodo.dataset?.pdfGrafico==='semanal')window.bloquesPDF.push({viewBox:nodo.getAttribute('viewBox').split(/\s+/).map(Number),margen:Number(nodo.querySelector('[data-rango]').getAttribute('x')),anchos:[...nodo.querySelectorAll('rect[data-entidad]')].map(e=>Number(e.getAttribute('width'))),claves:[...nodo.querySelectorAll('rect[data-entidad]')].map(e=>JSON.stringify([e.dataset.entidad,e.dataset.semana,e.dataset.valor])),etiquetas:[...nodo.querySelectorAll('[data-porcentaje]')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,derecha:r.right,abajo:r.bottom};})});
    return serializar.call(this,nodo);
   };
  });
  const salida=path.resolve('tmp/pdfs/reportabilidad-vertical');fs.mkdirSync(salida,{recursive:true});
  async function descargar(nombre){
   const esperado=await page.evaluate(()=>{window.bloquesPDF=[];return [...document.querySelectorAll('#reporte-semanal rect[data-entidad]')].map(e=>JSON.stringify([e.dataset.entidad,e.dataset.semana,e.dataset.valor]));});
   const evento=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();
   const destino=path.join(salida,nombre+'.pdf');await (await evento).saveAs(destino);
   const bloques=await page.evaluate(()=>window.bloquesPDF),pdf=await PDFDocument.load(fs.readFileSync(destino));
   assert(pdf.getPages().every(p=>p.getHeight()>p.getWidth()));
   assert.deepEqual(bloques.flatMap(b=>b.claves).sort(),esperado.sort(),'Cada semana y entidad aparece una sola vez, con el mismo porcentaje');
   assert.equal(bloques.length,Math.ceil(Math.max(...esperado.map(c=>Number(JSON.parse(c)[1])))/5),'Todas las unidades permanecen juntas en cada bloque de cinco semanas');
   for(const b of bloques){const semanas=[...new Set(b.claves.map(c=>Number(JSON.parse(c)[1])))];assert(semanas.length<=5);assert.equal(semanas[0]%5,1);assert.equal(semanas.length,Math.min(5,Math.max(...esperado.map(c=>Number(JSON.parse(c)[1])))-semanas[0]+1));}
   assert(bloques.every(b=>b.margen<=40&&b.anchos.every(ancho=>ancho<=16)),'El margen y las barras son más estrechos');
   for(const b of bloques)for(let i=0;i<b.etiquetas.length;i++)for(let j=i+1;j<b.etiquetas.length;j++){const a=b.etiquetas[i],c=b.etiquetas[j];assert(!(a.x<c.derecha-.5&&a.derecha>c.x+.5&&a.y<c.abajo-.5&&a.abajo>c.y+.5),'Los porcentajes no se superponen');}
   console.log(JSON.stringify({nombre,paginas:pdf.getPageCount(),barras:esperado.length,bloques:bloques.length,maxBarras:Math.max(...bloques.map(b=>b.claves.length)),destino}));
   return destino;
  }
  const general=await descargar('general');
  if(!process.env.SOLO_GENERAL){
  await page.evaluate(()=>{const permitidas=new Set([...document.getElementById('region').options].map(o=>o.value)),r=reporte.regiones.filter(r=>permitidas.has(r.region)).reduce((a,b)=>a.cecos.length>b.cecos.length?a:b);PortalFiltros.asignar('region',r.region);render();});
  await descargar('unidades');
  await page.locator('#modo-zona').click();
  await page.waitForFunction(()=>PortalZona.activa()&&!document.querySelector('#resultados').hidden&&!document.querySelector('#consultar').disabled);
  await descargar('zonas');
  // El caso de 23 unidades es una prueba en memoria; la entrega usa datos reales.
  await page.evaluate(()=>{
   const muestra=reporte.regiones[0].cecos[0];
   reporte={...reporte,regiones:[{region:'ZONA PRUEBA',cecos:Array.from({length:23},(_,i)=>({...muestra,ceco:'UNIDAD PRUEBA '+(i+1)}))}]};
   actualizarRegiones();PortalFiltros.asignar('region','ZONA PRUEBA');PortalFiltros.asignar('buscar');render();
  });
  await descargar('prueba-23-unidades');
  }
  assert.deepEqual(errores,[]);
  fs.mkdirSync('output/pdf',{recursive:true});fs.copyFileSync(general,'output/pdf/Reportabilidad_vertical.pdf');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
