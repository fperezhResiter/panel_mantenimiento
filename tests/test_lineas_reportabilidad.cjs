/* Unión de líneas, filtros combinados, cascada, limpieza y descargas con publicación real. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const root=path.resolve(__dirname,'..'),salida=path.join(root,'tmp/lineas-reportabilidad');fs.mkdirSync(salida,{recursive:true});
 try{
  for(const transporte of ['file','http']){
   const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errores=[];
   page.on('pageerror',e=>errores.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('resiter.mantenimiento.agrupacion','zona'));
   await page.route('http://panel.test/**',route=>{
    const archivo=path.resolve(root,decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/principal\//,''));
    return archivo.startsWith(root+path.sep)&&fs.existsSync(archivo)&&fs.statSync(archivo).isFile()?route.fulfill({path:archivo}):route.fulfill({status:404,body:''});
   });
   await page.goto(transporte==='file'?pathToFileURL(path.join(root,'web/pages/Panel_Reportabilidad.html')).href:'http://panel.test/principal/web/pages/Panel_Reportabilidad.html');
   const listo=()=>page.waitForFunction(()=>document.getElementById('consultar')?.disabled===false&&!document.getElementById('resultados')?.hidden);
   await listo();
   const elegir=async(id,valores)=>page.locator('#'+id).selectOption(valores,{force:true});
   const seleccion=()=>page.evaluate(()=>Object.fromEntries(['region','buscar','zona-linea','status-equipo'].map(id=>[id,PortalFiltros.valores(id)])));
   const datos=()=>page.evaluate(()=>({r:visibles.flatMap(r=>r.cecos).reduce((n,c)=>n+c.reportadas,0),t:visibles.flatMap(r=>r.cecos).reduce((n,c)=>n+c.total,0)}));
   const comparar=async()=>{
    const resultado=await page.evaluate(async()=>{
     const publicacion=await PortalDatos.listo,base=(reporteEfectivo?publicacion.reportes_efectivos:publicacion.reportes)[reporte.fecha];
     const lineas=PortalFiltros.valores('zona-linea'),status=PortalFiltros.valores('status-equipo'),zonas=PortalFiltros.valores('region'),unidades=PortalFiltros.valores('buscar');
     const incluidos=new Set(base.regiones.filter(r=>PortalConfig.incluida(r.region)).flatMap(r=>r.cecos.map(c=>c.ceco)));
     const filas=base.detalle_zona.filter(r=>PortalConfig.zonaIncluida(r.region)&&(!zonas.length||zonas.includes(PortalConfig.agruparZona(r.region)))).flatMap(r=>r.cecos).filter(c=>{
      const [,unidad,linea]=JSON.parse(c.ceco);
      return incluidos.has(unidad)&&PortalConfig.cecoIncluido(unidad)&&(!unidades.length||unidades.includes(unidad))&&(!lineas.length||lineas.includes(linea));
     }).flatMap(c=>{
      if(!status.length)return [reporteEfectivo?{...c,...c.por_criterios[mascaraCriterios()]}:c];
      return c.por_status.filter(s=>status.includes(s.status)).map(s=>reporteEfectivo?{...s,...c.por_criterios[mascaraCriterios()].por_status.find(v=>v.status===s.status)}:s);
     });
     const esperado={r:0,t:0,enviadas:0,historico:Array(reporte.semanas_completas.length).fill(0),historicoEnviadas:Array(reporte.semanas_completas.length).fill(0)};
     filas.forEach(c=>{esperado.r+=c.reportadas;esperado.t+=c.total;esperado.enviadas+=reporteEfectivo?c.reportadas_totales:c.reportadas;c.historico_completo.forEach((n,i)=>esperado.historico[i]+=n);if(reporteEfectivo)c.historico_completo_reportadas.forEach((n,i)=>esperado.historicoEnviadas[i]+=n);});
     const actuales=visibles.flatMap(r=>r.cecos),actual={r:actuales.reduce((n,c)=>n+c.reportadas,0),t:actuales.reduce((n,c)=>n+c.total,0),enviadas:actuales.reduce((n,c)=>n+(reporteEfectivo?c.reportadas_totales:c.reportadas),0),historico:reporte.semanas_completas.map((_,i)=>actuales.reduce((n,c)=>n+c.historico_completo[i],0)),historicoEnviadas:reporte.semanas_completas.map((_,i)=>reporteEfectivo?actuales.reduce((n,c)=>n+c.historico_completo_reportadas[i],0):0)};
     return {esperado,actual,cardR:document.getElementById('reportadas').textContent,cardT:document.getElementById('total').textContent,pct:document.getElementById('porcentaje').textContent};
    });
    assert.deepEqual(resultado.actual,resultado.esperado,'Suma independiente de la publicación: semana, maestro e historia');
    assert.equal(resultado.cardR,resultado.esperado.r.toLocaleString('es-CL'));assert.equal(resultado.cardT,resultado.esperado.t.toLocaleString('es-CL'));
    assert.equal(resultado.pct,resultado.esperado.t?(100*resultado.esperado.r/resultado.esperado.t).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—');
   };
   const limpiar=async()=>{await page.locator('#limpiar-filtros').click();await listo();assert(Object.values(await seleccion()).every(v=>!v.length));};
   const baseTotal=await datos();
   const lineas=await page.locator('#zona-linea option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean).slice(0,2));assert.equal(lineas.length,2);
   // Casillas reales: combinar líneas suma ambas sin reemplazar la primera.
   const widget=page.locator('#zona-linea').locator('..');await widget.locator('summary').click();
   await widget.locator('input[type=checkbox]').nth(0).check();const a=await datos();
   await widget.getByRole('button',{name:'Limpiar selección',exact:true}).click();await widget.locator('input[type=checkbox]').nth(1).check();const b=await datos();
   await widget.locator('input[type=checkbox]').nth(0).check();const ambas=await datos();
   assert.deepEqual(ambas,{r:a.r+b.r,t:a.t+b.t});assert.match(await page.locator('#zona-linea-resumen').textContent(),/2 líneas seleccionadas/);await comparar();
   await widget.locator('input[type=search]').press('Escape');
   for(const efectiva of [false,true]){
    if(efectiva){await page.locator('#reporte-modo').click();await listo();assert.deepEqual((await seleccion())['zona-linea'],lineas);await comparar();await page.locator('#criterio-maximo-doble').uncheck();await comparar();}
    await elegir('status-equipo','OPERATIVO');await comparar();
    if(transporte==='file'){
     const descarga=page.waitForEvent('download');await page.locator('#exportar').click();const csv=await descarga;const archivo=path.join(salida,efectiva?'efectiva.csv':'total.csv');await csv.saveAs(archivo);
     const registros=fs.readFileSync(archivo,'utf8').split(/\r?\n/).slice(1).filter(Boolean).map(r=>r.split(';')[3].replace(/^"|"$/g,''));assert(registros.length);assert(registros.every(l=>lineas.includes(l)));
     if(efectiva){
      const descargaPDF=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();const pdf=await descargaPDF;const destino=path.join(salida,'efectiva.pdf');await pdf.saveAs(destino);
      const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(destino)),useSystemFonts:true}).promise;
      const texto=(await(await doc.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');assert(texto.includes('Línea de negocio: '+lineas.join(', ')));assert(!texto.includes('Limpiar filtros'));await doc.destroy();
     }
    }
    await elegir('status-equipo',[]);
   }
   const fecha=await page.locator('#fecha').inputValue();await limpiar();await comparar();assert.equal(await page.locator('#fecha').inputValue(),fecha);assert.equal(await page.evaluate(()=>mascaraCriterios()),3);assert.equal(await page.locator('body').getAttribute('data-reportabilidad'),'efectiva');
   // Cascada: las opciones pertenecen a la zona y unidad elegidas.
   const ruta=await page.evaluate(()=>{const r=reporte.regiones.find(r=>r.cecos.some(c=>c.lineas?.length>1)),c=r.cecos.find(c=>c.lineas?.length>1);return {zona:r.region,unidad:c.ceco,lineas:c.lineas.map(l=>l.linea).sort((a,b)=>a.localeCompare(b,'es'))};});
   await elegir('region',ruta.zona);await elegir('buscar',ruta.unidad);
   assert.deepEqual(await page.locator('#zona-linea option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean)),ruta.lineas);
   await elegir('zona-linea',ruta.lineas.slice(0,2));await comparar();
   await page.locator('#consultar').click();await listo();assert.deepEqual((await seleccion())['zona-linea'],ruta.lineas.slice(0,2));await comparar();
   if(transporte==='file')await page.screenshot({path:path.join(salida,'escritorio.png')});
   await page.setViewportSize({width:390,height:844});await widget.locator('summary').click();assert(await widget.locator('.multi-panel').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(transporte==='file')await page.screenshot({path:path.join(salida,'movil.png')});await widget.locator('input[type=search]').press('Escape');
   await limpiar();await page.locator('#reporte-modo').click();await listo();assert.deepEqual(await datos(),baseTotal);await comparar();
   await page.locator('#modo-zona').click();await listo();assert(await widget.isHidden());
   await elegir('region',{index:1});await elegir('status-equipo','OPERATIVO');await limpiar();assert.equal(await page.evaluate(()=>PortalZona.activa()),false);
   assert.deepEqual(errores,[]);console.log(transporte+': líneas múltiples, sumas, historia, criterios, status, cascada, limpiar y móvil OK');await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
