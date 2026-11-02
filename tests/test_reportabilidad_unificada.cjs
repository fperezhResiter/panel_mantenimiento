/* Una sola página alterna modos sin perder filtros, criterios ni coherencia de descargas. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const salida=path.resolve('tmp/unificacion');fs.mkdirSync(salida,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errores=[],red=[];page.on('pageerror',e=>errores.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))red.push(r.url());});
  await page.addInitScript(()=>localStorage.setItem('resiter.mantenimiento.agrupacion','region'));
  await page.goto(pathToFileURL(path.resolve('Panel.html')).href);
  assert.equal(await page.locator('a.panel-enlace[href$="Panel_Reportabilidad_Efectiva.html"]').count(),0);
  assert.equal(await page.locator('a.panel-enlace[href$="Panel_Reportabilidad.html"]').count(),1);
  await page.locator('a.panel-enlace[href$="Panel_Reportabilidad.html"]').click();
  const listo=()=>page.waitForFunction(()=>document.getElementById('consultar')?.disabled===false&&document.getElementById('resultados')?.hidden===false);
  await listo();
  await page.evaluate(()=>window.marcaPaginaUnificada='misma página');
  const filtros=()=>page.evaluate(()=>({fecha:document.getElementById('fecha').value,region:PortalFiltros.valores('region'),unidad:PortalFiltros.valores('buscar'),status:PortalFiltros.valores('status-equipo'),linea:PortalFiltros.valores('zona-linea'),zona:PortalZona.activa()}));
  async function comprobar(efectiva){
   assert.equal(await page.evaluate(()=>window.marcaPaginaUnificada),'misma página','El botón conserva el documento abierto');
   assert.equal(await page.locator('body').getAttribute('data-reportabilidad'),efectiva?'efectiva':'total');
   assert.equal(await page.locator('#reporte-modo').textContent(),efectiva?'Mostrar reportabilidad total':'Mostrar reportabilidad efectiva');
   assert.equal(await page.locator('#reporte-modo').getAttribute('aria-pressed'),String(efectiva));
   assert.equal(await page.locator('nav a[href$="Panel_Reportabilidad_Efectiva.html"]').count(),0);
   assert.equal(await page.locator('nav a[aria-current="page"]').textContent(),'Reportabilidad');
   assert.equal(await page.locator('.kpis .kpi:visible').count(),efectiva?8:4);
   assert.equal(await page.locator('figure:visible').count(),3);
   assert.equal(await page.locator('figure svg').count(),3,'No quedan gráficos del modo anterior');
   assert.equal(await page.locator('#regla-efectiva').isVisible(),efectiva);
   assert.equal(await page.locator('#reporte-semanal').isVisible(),!efectiva);
   assert.equal(await page.locator('#reporte-comparativo').isVisible(),efectiva);
   assert.equal(await page.locator('#cabecera th').nth(1).textContent(),efectiva?'Efectivas':'Reportadas');
   assert.equal(await page.locator('#exportar').isEnabled(),true);assert.equal(await page.locator('#descargar-pdf').isEnabled(),true);
   const estado=await page.evaluate(()=>{
    const filas=visibles.flatMap(r=>r.cecos),r=filas.reduce((n,c)=>n+c.reportadas,0),t=filas.reduce((n,c)=>n+c.total,0),enviadas=reporteEfectivo?filas.reduce((n,c)=>n+c.reportadas_totales,0):r;
    return {r,t,enviadas,actual:document.getElementById('reportadas').textContent,total:document.getElementById('total').textContent,porcentaje:document.getElementById('porcentaje').textContent};
   });
   assert.equal(estado.actual,estado.r.toLocaleString('es-CL'));assert.equal(estado.total,estado.t.toLocaleString('es-CL'));
   assert.equal(estado.porcentaje,estado.t?(100*estado.r/estado.t).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—');
   if(efectiva){assert.equal(await page.locator('#reportadas-totales').textContent(),estado.enviadas.toLocaleString('es-CL'));assert.equal(await page.locator('#no-efectivas').textContent(),(estado.enviadas-estado.r).toLocaleString('es-CL'));}
   return estado;
  }
  const alternar=async()=>{await page.locator('#reporte-modo').click();await listo();};
  await comprobar(false);
  await page.locator('#fecha').fill('2026-10-13');await page.locator('#formulario').evaluate(f=>f.requestSubmit());await listo();
  await page.locator('#status-equipo').selectOption('OPERATIVO',{force:true});
  await page.locator('#region').selectOption({index:1},{force:true});await page.locator('#buscar').selectOption({index:1},{force:true});
  const seleccion=await filtros(),total=await comprobar(false);
  await alternar();const efectiva=await comprobar(true);assert.deepEqual(await filtros(),seleccion);assert.equal(efectiva.enviadas,total.r);assert.equal(efectiva.t,total.t);
  await page.locator('#criterio-maximo-doble').uncheck();assert.equal(await page.evaluate(()=>mascaraCriterios()),3);
  await alternar();await comprobar(false);assert.deepEqual(await filtros(),seleccion);
  await alternar();await comprobar(true);assert.deepEqual(await filtros(),seleccion);assert.equal(await page.evaluate(()=>mascaraCriterios()),3);
  await page.locator('#criterio-maximo-doble').check();
  await page.screenshot({path:path.join(salida,'efectiva-region.png')});

  await page.locator('#modo-zona').click();await listo();
  const ruta=await page.evaluate(()=>{const valida=c=>c.total>0&&c.lineas?.some(l=>l.total>0),r=visibles.find(r=>r.cecos.some(valida)),c=r.cecos.find(valida);return {zona:r.region,unidad:c.ceco,linea:c.lineas.find(l=>l.total>0).linea};});
  await page.locator('#region').selectOption(ruta.zona,{force:true});await page.locator('#buscar').selectOption(ruta.unidad,{force:true});await page.locator('#zona-linea').selectOption(ruta.linea,{force:true});await listo();
  const seleccionZona=await filtros(),efectivaZona=await comprobar(true);
  await alternar();const totalZona=await comprobar(false);assert.deepEqual(await filtros(),seleccionZona);assert.equal(totalZona.r,efectivaZona.enviadas);assert.equal(totalZona.t,efectivaZona.t);

  for(const modoEfectivo of [false,true]){
   if(modoEfectivo)await alternar();await comprobar(modoEfectivo);
   const csvPromesa=page.waitForEvent('download');await page.locator('#exportar').click();const csv=await csvPromesa;
   const rutaCsv=path.join(salida,modoEfectivo?'efectiva.csv':'total.csv');await csv.saveAs(rutaCsv);const textoCsv=fs.readFileSync(rutaCsv,'utf8');
   assert.equal(textoCsv.includes('"Efectivas"'),modoEfectivo);assert.equal(textoCsv.includes('Criterios de reportabilidad efectiva'),modoEfectivo);
   assert.equal(csv.suggestedFilename(),`Reportabilidad_${modoEfectivo?'Efectiva_':''}${seleccionZona.fecha}.csv`);
   const pdfPromesa=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();const pdf=await pdfPromesa;
   const rutaPdf=path.join(salida,modoEfectivo?'efectiva.pdf':'total.pdf');await pdf.saveAs(rutaPdf);
   const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
   const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(rutaPdf)),useSystemFonts:true}).promise;
   const textos=[];for(let n=1;n<=doc.numPages;n++)textos.push((await(await doc.getPage(n)).getTextContent()).items.map(i=>i.str).join(' '));
   const texto=textos.join('\n');assert.equal(texto.includes('Panel de reportabilidad efectiva'),modoEfectivo);assert.equal(texto.includes('Criterios aplicados:'),modoEfectivo);assert.equal(texto.includes('Reportabilidad semanal: efectivas y no efectivas'),modoEfectivo);
   assert(!texto.includes('Mostrar reportabilidad'),'El botón de alternancia no se imprime');
   fs.writeFileSync(path.join(salida,modoEfectivo?'efectiva.txt':'total.txt'),texto);await doc.destroy();
  }

  // Las preferencias de gráficos se aplican solo al modo que corresponda.
  await page.evaluate(async()=>{const c=(await PortalDatos.listo).configuracion;window.ocultosAnteriores=[...c.ocultos];c.ocultos.push('reportabilidad.efectiva_evolucion','reportabilidad.efectiva_barras','reportabilidad.efectiva_comparativo');PortalConfig.aplicarVistas();});
  assert.equal(await page.locator('.reporte-evolucion').isVisible(),false);
  await alternar();assert.equal(await page.locator('.reporte-evolucion').isVisible(),true);await comprobar(false);
  await page.evaluate(async()=>{(await PortalDatos.listo).configuracion.ocultos=window.ocultosAnteriores;PortalConfig.aplicarVistas();});

  // Si el modo efectivo no está disponible, se puede volver a consultar el total.
  await page.evaluate(()=>{window.consultaOriginal=PortalDatos.consultar;PortalDatos.consultar=async(...args)=>args[0].startsWith('/api/reporte-efectivo?')?{ok:false,json:async()=>({error:'Prueba: datos efectivos no disponibles'})}:window.consultaOriginal(...args);});
  await page.locator('#reporte-modo').click();await page.waitForFunction(()=>!document.getElementById('consultar').disabled);
  assert.match(await page.locator('#estado').textContent(),/datos efectivos no disponibles/);assert(await page.locator('#resultados').isHidden());assert(await page.locator('#exportar').isDisabled());assert(await page.locator('#descargar-pdf').isDisabled());
  await alternar();await comprobar(false);assert.deepEqual(await filtros(),seleccionZona);await page.evaluate(()=>PortalDatos.consultar=window.consultaOriginal);
  await page.screenshot({path:path.join(salida,'total-zona.png')});
  await page.setViewportSize({width:390,height:844});await alternar();await comprobar(true);assert.deepEqual(await filtros(),seleccionZona);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(salida,'efectiva-movil.png')});
  await page.locator('#reporte-modo').focus();await page.keyboard.press('Space');await listo();await comprobar(false);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errores,[]);assert.deepEqual(red,[],'Funciona sin servidor ni Internet');
  await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad_Efectiva.html')).href);await listo();
  assert.match(page.url(),/Panel_Reportabilidad\.html\?/);assert.equal(await page.locator('body').getAttribute('data-reportabilidad'),'efectiva');
  console.log('OK página única: alternancia, filtros/fecha/status/línea/criterios, 4/8 tarjetas, 3 gráficos, configuración, CSV/PDF por modo, errores recuperables, móvil/teclado y redirección antigua.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
