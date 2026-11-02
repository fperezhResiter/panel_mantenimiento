/* Integración real: publicación local, API, bases por semana, filtros y descargas. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');

(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/vigencia');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 let server;
 try{
  server=spawn(process.env.PANEL_PYTHON||'python',['-B','-u','scripts/reportabilidad.py','--puerto','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const url=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('No inició la API local')),20000);
   server.once('error',reject);server.stdout.on('data',b=>{const m=String(b).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
  });
  for(const modo of ['local','api']){
   const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
   const errores=[];page.on('pageerror',e=>errores.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('resiter.mantenimiento.agrupacion','region'));
   await page.goto(modo==='local'?pathToFileURL(path.join(root,'web/pages/Panel_Reportabilidad.html')).href:url+'/Panel_Reportabilidad.html');
   const listo=()=>page.waitForFunction(()=>!document.getElementById('resultados').hidden&&!document.getElementById('consultar').disabled);
   await listo();await page.locator('#fecha').fill('2026-10-20');await page.locator('#consultar').click();await listo();
   const global=await page.evaluate(()=>({version:reporte.version_reporte,base:document.getElementById('total').textContent,reportadas:document.getElementById('reportadas').textContent,incidencias:document.getElementById('vigencia-detalle').textContent,
    series:seriesGraficos().series.map(s=>{const d=datosSerieSemanal(s);return {totales:d.totales,valores:d.valores,n:d.reportadas,baseIndependiente:reporte.semanas_completas.map((_,j)=>s.cecos.reduce((n,c)=>n+c.historico_completo_base[j],0))};})}));
   assert.equal(global.version,3);assert.equal(global.base,'409');assert.equal(global.reportadas,'377');
   assert(global.incidencias.includes('SJDW90'));assert(global.incidencias.includes('TDLD68'));assert(global.incidencias.includes('TLJZ72'));assert(!global.incidencias.includes('HVYP47'));
   for(const s of global.series){assert.deepEqual(s.totales,s.baseIndependiente);s.valores.forEach((v,j)=>assert.equal(v,s.totales[j]?100*s.n[j]/s.totales[j]:null));}
   assert(global.series.some(s=>new Set(s.totales).size>1),'La base histórica debe variar');
   await page.locator('#region').selectOption('REGION COPIAPO',{force:true});await page.locator('#buscar').selectOption('CANDELARIA ASEO',{force:true});
   assert.equal(await page.locator('#reportadas').innerText(),'21');assert.equal(await page.locator('#total').innerText(),'21');assert.equal(await page.locator('#porcentaje').innerText(),'100 %');
   let descarga=page.waitForEvent('download');await page.locator('#exportar').click();let archivo=await descarga;const csv=path.join(out,modo+'.csv');await archivo.saveAs(csv);
   assert(fs.readFileSync(csv,'utf8').includes('Base vigente S'));
   await page.locator('#modo-zona').click();await listo();await page.waitForFunction(()=>PortalZona.activa());
   await page.locator('#region').selectOption('ZONA 8',{force:true});await page.locator('#buscar').selectOption('CANDELARIA ASEO',{force:true});
   assert.equal(await page.locator('#total').innerText(),'21');
   const lineas=await page.locator('#zona-linea').evaluate(e=>Array.from(e.options).map(o=>o.textContent));
   assert(lineas.includes('ASEO INDUSTRIAL'));assert(!lineas.some(l=>/Zona 8[AB]/i.test(l)));
   await page.locator('#zona-linea').selectOption('ASEO INDUSTRIAL',{force:true});
   await page.locator('#reporte-modo').click();await listo();
   assert.equal(await page.locator('#reportadas-totales').innerText(),'21');assert.equal(await page.locator('#reportadas').innerText(),'18');
   for(const id of ['criterio-mayor-cero','criterio-mayor-anterior','criterio-maximo-doble'])await page.locator('#'+id).uncheck();
   assert.equal(await page.locator('#reportadas').innerText(),'21');assert.equal(await page.locator('#no-efectivas').innerText(),'0');
   await page.locator('#status-equipo').selectOption('OPERATIVO',{force:true});
   const status=await page.evaluate(()=>({actual:visibles.reduce((n,r)=>n+r.cecos.reduce((m,c)=>m+c.total,0),0),esperado:reporte.regiones.reduce((n,r)=>n+r.cecos.filter(c=>c.ceco==='CANDELARIA ASEO').reduce((m,c)=>m+c.por_status.filter(s=>s.status==='OPERATIVO').reduce((a,s)=>a+s.total,0),0),0)}));
   assert.equal(status.actual,status.esperado);
   await page.locator('#status-equipo').selectOption([],{force:true});
   await page.screenshot({path:path.join(out,modo+'-escritorio.png'),fullPage:true});
   descarga=page.waitForEvent('download');await page.locator('#descargar-pdf').click();archivo=await descarga;await archivo.saveAs(path.join(out,modo+'.pdf'));
   await page.setViewportSize({width:390,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,modo+'-movil.png'),fullPage:true});
   assert.deepEqual(errores,[]);await page.close();
   console.log(`OK VIGENCIA ${modo}: corte, historial, región/zona/línea/status, efectividad, CSV/PDF y móvil.`);
  }
 }finally{server?.kill();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
