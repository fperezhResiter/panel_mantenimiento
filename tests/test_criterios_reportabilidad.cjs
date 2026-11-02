/* Las ocho combinaciones se aplican a la misma selección de datos y a las descargas. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const salida=path.resolve('tmp/criterios');fs.mkdirSync(salida,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errores=[],red=[];page.on('pageerror',e=>errores.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))red.push(r.url());});
  await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad_Efectiva.html')).href);
  const listo=()=>page.waitForFunction(()=>!document.getElementById('consultar').disabled&&!document.getElementById('resultados').hidden);
  await listo();
  const ids=['criterio-mayor-cero','criterio-mayor-anterior','criterio-maximo-doble'];
  for(const id of ids){assert(await page.locator('#'+id).isChecked());assert(await page.locator('#'+id).isEnabled());}
  async function elegir(mascara){for(let i=0;i<ids.length;i++)await page.locator('#'+ids[i]).setChecked(Boolean(mascara&(1<<i)));}
  async function comprobar(mascara){
   const estado=await page.evaluate(mascara=>{
    const estados=PortalFiltros.valores('status-equipo');
    const fuente=reporte.regiones.filter(r=>PortalConfig.incluida(r.region)&&PortalFiltros.coincide('region',r.region)).flatMap(r=>r.cecos.filter(c=>PortalConfig.cecoIncluido(c.ceco)&&PortalFiltros.coincide('buscar',c.ceco))).flatMap(c=>PortalZona.activa()&&PortalFiltros.hay('zona-linea')?c.lineas.filter(l=>PortalFiltros.coincide('zona-linea',l.linea)):[c]);
    const esperado=fuente.reduce((a,c)=>{
     const grupos=estados.length?c.por_status.filter(s=>estados.includes(s.status)): [c];
     const gruposCriterio=estados.length?c.por_criterios[mascara].por_status.filter(s=>estados.includes(s.status)):[c.por_criterios[mascara]];
     a.efectivas+=gruposCriterio.reduce((n,s)=>n+s.reportadas,0);a.total+=grupos.reduce((n,s)=>n+s.total,0);a.reportadas+=grupos.reduce((n,s)=>n+s.reportadas_totales,0);
     return a;
    },{efectivas:0,total:0,reportadas:0});
    const actuales=visibles.flatMap(r=>r.cecos);
    const actual={efectivas:actuales.reduce((n,c)=>n+c.reportadas,0),total:actuales.reduce((n,c)=>n+c.total,0),reportadas:actuales.reduce((n,c)=>n+c.reportadas_totales,0)};
    const campos=['reportadas','fuera_maestro','historico','historico_completo'];
    const historiaCorrecta=actuales.every(c=>campos.every(campo=>{
     const grupos=estados.length?c.por_criterios[mascara].por_status.filter(s=>estados.includes(s.status)):[c.por_criterios[mascara]];
     const esperado=Array.isArray(c[campo])?c[campo].map((_,i)=>grupos.reduce((n,s)=>n+s[campo][i],0)):grupos.reduce((n,s)=>n+s[campo],0);
     return JSON.stringify(c[campo])===JSON.stringify(esperado);
    }));
    const porSerie=new Map(seriesGraficos().series.map(s=>[s.nombre,s.cecos]));
    const graficosCorrectos=[...document.querySelectorAll('#reporte-comparativo g[data-pdf-barra]')].every(g=>{
     const i=reporte.semanas_completas.findIndex(s=>s.numero===Number(g.dataset.semana)),cs=porSerie.get(g.dataset.entidad);
     const e=cs.reduce((n,c)=>n+c.historico_completo[i],0),r=cs.reduce((n,c)=>n+c.historico_completo_reportadas[i],0),t=cs.reduce((n,c)=>n+c.total,0);
     const punto=[...document.querySelectorAll('#reporte-grafico circle[data-entidad]')].find(p=>p.dataset.entidad===g.dataset.entidad&&p.dataset.semana===g.dataset.semana);
     const color=g.querySelector('[data-segmento="efectiva"]').getAttribute('fill');
     const achurado=g.querySelector('[data-segmento="no-efectiva"]');
     const colorAchurado=achurado?document.getElementById(achurado.getAttribute('fill').slice(5,-1)).querySelector('path').getAttribute('stroke'):color;
     return color===colorSerie(g.dataset.entidad)&&colorAchurado===color&&Number(g.dataset.efectivas)===e&&Number(g.dataset.reportadas)===r&&(!t||punto&&punto.getAttribute('fill')===color&&Math.abs(Number(punto.dataset.valor)-100*e/t)<1e-8);
    });
    const lineasCorrectas=actuales.every(c=>!c.lineas||c.reportadas===c.lineas.reduce((n,l)=>n+l.reportadas,0));
    return {esperado,actual,historiaCorrecta,graficosCorrectos,lineasCorrectas,tarjetas:{e:document.getElementById('reportadas').textContent,r:document.getElementById('reportadas-totales').textContent,n:document.getElementById('no-efectivas').textContent,t:document.getElementById('total').textContent,p:document.getElementById('porcentaje').textContent},mascara:mascaraCriterios(),resumen:document.getElementById('criterios-efectiva-resumen').textContent,pie:document.querySelector('#pie tr').children[1].textContent};
   },mascara);
   assert.deepEqual(estado.actual,estado.esperado,'Conteos de la combinación elegida y el status seleccionado');
   assert(estado.historiaCorrecta,'Todos los históricos respetan los criterios');assert(estado.graficosCorrectos,'Barras y puntos muestran las cantidades de la combinación');assert(estado.lineasCorrectas);
   assert.equal(estado.mascara,mascara);
   const f=n=>n.toLocaleString('es-CL');
   assert.equal(estado.tarjetas.e,f(estado.esperado.efectivas));assert.equal(estado.tarjetas.r,f(estado.esperado.reportadas));assert.equal(estado.tarjetas.n,f(estado.esperado.reportadas-estado.esperado.efectivas));assert.equal(estado.tarjetas.t,f(estado.esperado.total));assert.equal(estado.pie,f(estado.esperado.efectivas));
   assert.equal(estado.tarjetas.p,estado.esperado.total?(100*estado.esperado.efectivas/estado.esperado.total).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—');
   if(mascara===0){assert.equal(estado.esperado.efectivas,estado.esperado.reportadas);assert.equal(estado.tarjetas.n,'0');assert.match(estado.resumen,/Ninguno: todas las patentes reportadas/);}
   return estado;
  }
  const inicial=await comprobar(7);
  assert.match(await page.locator('label[for="criterio-mayor-anterior"],label:has(#criterio-mayor-anterior)').textContent(),/mayor o igual que la lectura anterior/);
  assert.match(await page.locator('#ejemplo-efectiva').textContent(),/una actual de 1\.000 es efectiva/);
  assert.match(await page.locator('#criterios-efectiva-resumen').textContent(),/mayor o igual que la lectura anterior/);
  for(let mascara=0;mascara<8;mascara++){await elegir(mascara);const v=await comprobar(mascara);assert.equal(v.actual.total,inicial.actual.total);assert.equal(v.actual.reportadas,inicial.actual.reportadas);assert(v.actual.efectivas>=inicial.actual.efectivas);}
  await elegir(5);
  await page.evaluate(()=>{PortalFiltros.asignar('status-equipo',['OPERATIVO','EN MANTENCION']);document.getElementById('status-equipo').dispatchEvent(new Event('change',{bubbles:true}));});
  await comprobar(5);
  await page.locator('#modo-zona').click();await listo();await comprobar(5);
  for(let mascara=0;mascara<8;mascara++){await elegir(mascara);await comprobar(mascara);}
  await elegir(5);
  await page.locator('#region').selectOption({index:1},{force:true});await comprobar(5);
  await page.locator('#buscar').selectOption({index:1},{force:true});await comprobar(5);
  const linea=await page.evaluate(()=>visibles[0].cecos[0].lineas[0].linea);
  await page.locator('#zona-linea').selectOption(linea,{force:true});await listo();await comprobar(5);
  await page.locator('#formulario').evaluate(f=>f.requestSubmit());await listo();await comprobar(5);
  await page.locator('#modo-zona').click();await listo();await comprobar(5);
  await page.locator('#regla-efectiva').screenshot({path:path.join(salida,'criterios-escritorio.png')});
  await page.locator('#region').selectOption({index:1},{force:true});await comprobar(5);
  await elegir(7);await comprobar(7);
  const texto=await page.evaluate(()=>textoCriterios());
  const csvPromesa=page.waitForEvent('download');await page.locator('#exportar').click();
  const csv=await csvPromesa,rutaCsv=path.join(salida,'criterios.csv');await csv.saveAs(rutaCsv);
  const textoCsv=fs.readFileSync(rutaCsv,'utf8');assert.match(textoCsv,/Criterios de reportabilidad efectiva/);assert(textoCsv.includes(texto));assert(textoCsv.includes('mayor o igual que la lectura anterior'));
  const pdfPromesa=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();
  const pdf=await pdfPromesa,rutaPdf=path.join(salida,'criterios.pdf');await pdf.saveAs(rutaPdf);
  const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(rutaPdf)),useSystemFonts:true}).promise;
  const textos=[];for(let n=1;n<=doc.numPages;n++)textos.push((await (await doc.getPage(n)).getTextContent()).items.map(i=>i.str).join(' '));
  const textoPdf=textos.join('\n').replace(/\s+/g,' ');assert(textoPdf.includes('Criterios aplicados: '+texto));assert.match(textoPdf,/una actual de 1\.000 es efectiva/);assert.match(textoPdf,/Status del equipo: EN MANTENCION, OPERATIVO/);fs.writeFileSync(path.join(salida,'criterios.txt'),textos.join('\n'));await doc.destroy();
  await page.setViewportSize({width:390,height:844});await page.locator('#regla-efectiva').screenshot({path:path.join(salida,'criterios-movil.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#criterio-maximo-doble').focus();await page.keyboard.press('Space');await comprobar(3);
  await page.locator('#criterio-maximo-doble').check();await comprobar(7);
  // Una publicación anterior mantiene el cálculo original e informa cómo habilitar controles.
  await page.evaluate(()=>{delete reporte.version_criterios_efectiva;actualizarCriterios();render();});
  for(const id of ids){assert(await page.locator('#'+id).isChecked());assert(await page.locator('#'+id).isDisabled());}
  assert.match(await page.locator('#criterios-efectiva-ayuda').textContent(),/Actualiza la publicación/);
  assert.deepEqual(errores,[]);assert.deepEqual(red,[]);
  await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad.html')).href);await listo();assert(await page.locator('#criterios-efectiva').isHidden());
  assert.deepEqual(errores,[]);
  console.log('OK criterios: 8 combinaciones, KM/HR, status, región/zona/unidad/línea, históricos, tarjetas, gráficos, tabla, CSV/PDF, móvil, teclado y publicación anterior.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
