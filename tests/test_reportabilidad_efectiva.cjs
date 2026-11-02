/* Vista efectiva con publicación real: filtros, gráficos, CSV, PDF y móvil. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const salida = path.resolve('tmp/efectiva');
  fs.mkdirSync(salida, {recursive:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}, acceptDownloads:true});
    const errores = [], red = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('request', r => {if (/^https?:/.test(r.url())) red.push(r.url());});
    await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad_Efectiva.html')).href);
    await page.waitForFunction(() => document.querySelector('#consultar').disabled === false && !document.querySelector('#resultados').hidden);
    const resumen = await page.evaluate(async () => {
      const publicacion = await PortalDatos.listo;
      const efectivo = publicacion.reportes_efectivos[reporte.fecha];
      const normal = publicacion.reportes[reporte.fecha];
      return {efectivas:efectivo.reportadas, reportadas:normal.reportadas, total:efectivo.total,
        normalTotal:normal.total, marca:reporte.reportabilidad_efectiva, fecha:reporte.fecha};
    });
    assert.equal(resumen.marca, true);
    assert(resumen.efectivas <= resumen.reportadas);
    assert.equal(resumen.total, resumen.normalTotal);
    assert.equal(await page.locator('nav a[aria-current="page"]').textContent(), 'Reportabilidad');
    assert.deepEqual((await page.locator('nav a').allTextContents()).slice(0,2), ['Reportabilidad','Seguimiento KM-HR']);
    assert.equal(await page.locator('#reporte-modo').textContent(), 'Mostrar reportabilidad total');
    assert.equal(await page.locator('#cabecera th').nth(1).textContent(), 'Efectivas');
    assert.equal(await page.locator('figure svg').count(), 3);
    assert(await page.locator('#reporte-semanal').isHidden(),'El modo efectivo oculta las barras semanales de la reportabilidad total');
    assert.equal(await page.locator('#regla-efectiva li').count(), 3);
    assert.match(await page.locator('#regla-efectiva').textContent(), /Ejemplo:/);
    async function comprobarApiladas() {
      const resumenActual=await page.evaluate(()=>{
        const filas=visibles.flatMap(r=>r.cecos),e=filas.reduce((s,c)=>s+c.reportadas,0),r=filas.reduce((s,c)=>s+c.reportadas_totales,0),t=filas.reduce((s,c)=>s+c.total,0);
        const numero=n=>n.toLocaleString('es-CL'),pct=n=>t?(100*n/t).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
        const esperado={reportadas:numero(e),'reportadas-totales':numero(r),'no-efectivas':numero(r-e),total:numero(t),porcentaje:pct(e),'porcentaje-reportadas':pct(r),'porcentaje-no-efectivas':pct(r-e)};
        return {esperado,actual:Object.fromEntries(Object.keys(esperado).map(id=>[id,document.getElementById(id).textContent])),tarjetas:document.querySelectorAll('#resultados .kpis .kpi').length};
      });
      assert.equal(resumenActual.tarjetas,8);
      assert.deepEqual(resumenActual.actual,resumenActual.esperado,'Tarjetas con cantidades y porcentajes agregados de la selección');
      for (const id of ['reporte-comparativo','reporte-barras']) {
      const barras = await page.locator('#'+id+' g[data-pdf-barra]').evaluateAll(grupos=>grupos.map(g=>{
        const solida=g.querySelector('[data-segmento="efectiva"]'),achurada=g.querySelector('[data-segmento="no-efectiva"]');
        const patron=achurada?document.getElementById(achurada.getAttribute('fill').slice(5,-1)):null;
        return {efectivas:Number(g.dataset.efectivas),reportadas:Number(g.dataset.reportadas),valor:g.dataset.valor,valorE:g.dataset.valorEfectivo,rango:g.dataset.rangoEfectivo,color:solida.getAttribute('fill'),colorSerie:colorSerie(g.dataset.entidad),colorAchurado:patron?.querySelector('path').getAttribute('stroke'),
          alturaE:Number(solida.getAttribute('height')),alturaN:achurada?Number(achurada.getAttribute('height')):0,
          yE:Number(solida.getAttribute('y')),yN:achurada?Number(achurada.getAttribute('y')):0,
          fill:achurada?.getAttribute('fill'),rotulo:g.nextElementSibling.dataset.porcentaje};
      }));
      assert(barras.length>0,'El comparativo contiene barras');
      for (const b of barras) {
        assert(b.reportadas>=b.efectivas);
        assert.equal(b.rotulo,b.valorE,'El porcentaje superior es el efectivo');
        const rango=b.valorE===''?'neutro':Number(b.valorE)>=90?'verde':Number(b.valorE)>=75?'amarillo':'rojo';
        assert.equal(b.rango,rango);
        assert.equal(b.color,id==='reporte-comparativo'?b.colorSerie:{rojo:'#bc3e3e',amarillo:'#b78912',verde:'#21854b',neutro:'#7b8794'}[rango],id==='reporte-comparativo'?'La barra semanal usa el color de la entidad de la evolución':'La barra seleccionada usa el color del cumplimiento efectivo');
        if(b.valor!=='' && b.reportadas>0){
          assert(Math.abs(b.alturaE/(b.alturaE+b.alturaN)-b.efectivas/b.reportadas)<1e-8,'Alturas proporcionales a efectivas y no efectivas');
          if(b.reportadas>b.efectivas){assert.match(b.fill,id==='reporte-comparativo'?/^url\(#reporte-achurado-serie-\d+\)$/:new RegExp('^url\\(#reporte-barras-achurado-'+rango+'\\)$'));assert.equal(b.colorAchurado,b.color);assert(Math.abs(b.yE-b.yN-b.alturaN)<1e-7,'El tramo achurado queda sobre el sólido');}
        }
      }
      }
      const lineas=await page.evaluate(()=>{
        const grupos=[...document.querySelectorAll('#reporte-comparativo g[data-pdf-barra]')];
        return grupos.filter(g=>g.dataset.valor!=='').map(g=>{
          const puntos=[...document.querySelectorAll('#reporte-grafico circle[data-entidad]')].filter(p=>p.dataset.entidad===g.dataset.entidad&&p.dataset.semana===g.dataset.semana);
          return {efectivo:Number(g.dataset.valorEfectivo),puntos:puntos.map(p=>({valor:Number(p.dataset.valor),segmento:p.dataset.segmento}))};
        });
      });
      assert(lineas.length>0);
      for(const grupo of lineas){
        assert.deepEqual(grupo.puntos.map(p=>p.segmento),['efectiva'],'La evolución conserva solo los puntos efectivos');
        assert(Math.abs(grupo.puntos[0].valor-grupo.efectivo)<1e-8,'El punto coincide con el cumplimiento efectivo de la barra');
      }
      assert.equal(await page.locator('#reporte-grafico [data-segmento="no-efectiva"],#reporte-grafico [data-tipo-linea="no-efectiva"]').count(),0);
      const indices=await page.locator('#reporte-comparativo g[data-pdf-barra]').evaluateAll(grupos=>grupos.map(g=>g.querySelector('text[data-indice-entidad]')?.textContent));
      assert(indices.every(i=>Number(i)>0),'Cada barra semanal se identifica por su número de entidad');
    }
    await comprobarApiladas();
    const filasTarjetas=await page.locator('#resultados .kpis .kpi').evaluateAll(tarjetas=>tarjetas.map(t=>Math.round(t.getBoundingClientRect().top)));
    assert.equal(new Set(filasTarjetas).size,2,'Ocho tarjetas en dos filas de cuatro en escritorio');
    const totalInicial = await page.locator('#reportadas').textContent();
    await page.locator('#expandir').click();
    assert.equal(await page.locator('#reportadas').textContent(), totalInicial);
    await page.locator('#expandir').click();
    const barra = page.locator('#reporte-barras rect[data-entidad]').first();
    await barra.hover();
    assert.match(await page.locator('#reporte-tooltip').textContent(), /Patentes efectivas:/);
    await barra.focus();
    assert.match(await page.locator('#reporte-tooltip').textContent(), /Patentes efectivas:/);
    await page.locator('h1').click();
    await page.screenshot({path:path.join(salida,'escritorio.png')});
    const tramo=page.locator('#reporte-comparativo rect[data-segmento="no-efectiva"]').last();
    await tramo.focus();
    assert.match(await page.locator('#reporte-tooltip').textContent(), /Tramo achurado: reportadas no efectivas/);
    const enfoque=await tramo.evaluate(e=>({propia:e.style.opacity,otra:e.parentElement.querySelector('[data-segmento="efectiva"]').style.opacity}));
    assert.deepEqual(enfoque,{propia:'1',otra:'0.15'},'El foco distingue el tramo elegido');
    await tramo.hover();
    assert.match(await page.locator('#reporte-tooltip').textContent(), /Reportadas totales:/);
    const puntoEfectivo=page.locator('#reporte-grafico circle[data-segmento="efectiva"]').last();
    await page.mouse.move(4,4);
    await puntoEfectivo.focus();
    assert(await page.locator('#reporte-tooltip').isVisible());
    assert.match(await page.locator('#reporte-tooltip').textContent(), /Línea continua: efectivas/);
    const vinculo=await puntoEfectivo.evaluate(p=>{
      const clave=e=>e.dataset.entidad===p.dataset.entidad&&e.dataset.semana===p.dataset.semana;
      return [...document.querySelectorAll('#reporte-comparativo rect[data-segmento],#reporte-barras rect[data-segmento]')].filter(clave).map(e=>({segmento:e.dataset.segmento,opacidad:e.style.opacity}));
    });
    assert(vinculo.some(v=>v.segmento==='no-efectiva'));
    for(const v of vinculo)assert.equal(v.opacidad,v.segmento==='efectiva'?'1':'0.15','El foco sincroniza la misma parte en los otros gráficos');
    await page.locator('h1').click();
    await page.locator('#reporte-comparativo').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(salida,'comparativo-region.png')});

    // Navegar por un gráfico refleja el filtro y conserva totales coherentes.
    await barra.click();
    assert(await page.evaluate(() => PortalFiltros.hay('region')));
    await page.locator('#reporte-volver').click();
    assert.equal(await page.locator('#reportadas').textContent(), totalInicial);
    await page.locator('#modo-zona').click();
    await page.waitForFunction(() => !document.querySelector('#consultar').disabled && !document.querySelector('#resultados').hidden);
    assert.equal(await page.evaluate(() => PortalZona.activa()), true);
    const estadoZona = await page.evaluate(async () => {
      const original = (await PortalDatos.listo).reportes_efectivos[reporte.fecha];
      const unidades = new Set(original.regiones.filter(r=>PortalConfig.incluida(r.region)).flatMap(r=>r.cecos.map(c=>c.ceco)));
      const esperado = new Map();
      for (const grupo of original.detalle_zona) {
        if (!PortalConfig.zonaIncluida(grupo.region)) continue;
        for (const c of grupo.cecos) {
          const [,unidad] = JSON.parse(c.ceco);
          if (!unidades.has(unidad) || !PortalConfig.cecoIncluido(unidad)) continue;
          const zona = PortalConfig.agruparZona(grupo.region);
          const suma = esperado.get(zona) || {region:zona,reportadas:0,total:0};
          suma.reportadas += c.reportadas; suma.total += c.total; esperado.set(zona,suma);
        }
      }
      return {
        actual:reporte.regiones.map(r=>({region:r.region,reportadas:r.reportadas,total:r.total})),
        esperado:[...esperado.values()],
        opciones:[...document.querySelector('#region').options].map(o=>o.value).filter(Boolean),
        graficos:[...document.querySelectorAll('#reporte-barras [data-entidad]')].map(e=>e.dataset.entidad),
        filas:[...document.querySelectorAll('#detalle tr.region button')].map(e=>e.textContent.replace(/^[▸▾]\s*/,'')),
        lineas:reporte.regiones.flatMap(r=>r.cecos.flatMap(c=>(c.lineas||[]).map(l=>l.linea)))
      };
    });
    assert(estadoZona.actual.length > 0, 'Debe haber datos zonales');
    assert(estadoZona.actual.every(r=>/^ZONA |^SIN ZONA$/.test(r.region)), 'Los datos deben reagruparse por zona, no seguir por región');
    const ordenar = grupos => [...grupos].sort((a,b)=>a.region.localeCompare(b.region));
    assert.deepEqual(ordenar(estadoZona.actual),ordenar(estadoZona.esperado), 'Cantidades de cada zona según la publicación y exclusiones');
    const nombresZona = estadoZona.actual.map(r=>r.region).sort();
    assert.deepEqual(estadoZona.opciones.sort(),nombresZona, 'El filtro ofrece zonas');
    assert.deepEqual([...new Set(estadoZona.graficos)].sort(),nombresZona, 'Los gráficos muestran zonas');
    assert.deepEqual(estadoZona.filas.sort(),nombresZona, 'La tabla muestra zonas');
    assert(estadoZona.lineas.length > 0, 'El modo zona incluye líneas de negocio');
    await comprobarApiladas();
    assert.match(await page.locator('#reporte-comparativo-titulo').textContent(), /por zona/);
    await page.locator('#reporte-comparativo').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(salida,'comparativo-zona.png')});
    const rutaLinea=await page.evaluate(()=>reporte.regiones.flatMap(r=>r.cecos.flatMap(c=>(c.lineas||[]).map(l=>({zona:r.region,unidad:c.ceco,linea:l.linea})))).find(r=>r.linea!=='SIN LÍNEA'));
    assert(rutaLinea,'Hay una línea de negocio para comprobar el desglose');
    await page.locator('#region').selectOption(rutaLinea.zona,{force:true});
    await page.locator('#buscar').selectOption(rutaLinea.unidad,{force:true});
    await comprobarApiladas();
    assert.match(await page.locator('#reporte-comparativo-titulo').textContent(), /línea de negocio/);
    await page.locator('#zona-linea').selectOption(rutaLinea.linea,{force:true});
    await page.waitForFunction(() => !document.querySelector('#consultar').disabled && !document.querySelector('#resultados').hidden);
    await comprobarApiladas();
    assert(await page.evaluate(linea=>reporte.regiones.every(r=>r.cecos.every(c=>c.lineas.every(l=>l.linea===linea))),rutaLinea.linea));
    const sumaZona = await page.evaluate(() => visibles.flatMap(r=>r.cecos).reduce((s,c)=>s+c.reportadas,0));
    assert.equal(await page.locator('#reportadas').textContent(), sumaZona.toLocaleString('es-CL'));
    await page.locator('#modo-zona').click();
    await page.waitForFunction(() => !document.querySelector('#consultar').disabled && !document.querySelector('#resultados').hidden);

    await page.locator('#region').selectOption({index:1},{force:true});
    await comprobarApiladas();
    const filtro = await page.evaluate(() => PortalFiltros.texto('region'));
    const csvPromesa = page.waitForEvent('download');
    await page.locator('#exportar').click();
    const csv = await csvPromesa;
    assert.equal(csv.suggestedFilename(), `Reportabilidad_Efectiva_${resumen.fecha}.csv`);
    const csvRuta = path.join(salida,'Reportabilidad_Efectiva.csv');
    await csv.saveAs(csvRuta);
    assert.match(fs.readFileSync(csvRuta,'utf8'), /"Efectivas"/);
    const pdfPromesa = page.waitForEvent('download', {timeout:60000});
    await page.locator('#descargar-pdf').click();
    const pdf = await pdfPromesa;
    assert.match(pdf.suggestedFilename(), /reportabilidad_efectiva/);
    const pdfRuta = path.join(salida,'Reportabilidad_Efectiva.pdf');
    await pdf.saveAs(pdfRuta);
    const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
    const lectura = await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(pdfRuta)),useSystemFonts:true}).promise;
    const textos = [];
    for (let n=1;n<=lectura.numPages;n++) {
      const pagina = await lectura.getPage(n);
      assert(Math.abs(pagina.view[2]-595.28)<1, 'A4 vertical');
      const textoPagina=(await pagina.getTextContent()).items.map(i=>i.str).join(' ');
      const titulos=['Evolución semanal de reportabilidad efectiva','Reportabilidad efectiva y no efectiva por'].filter(t=>textoPagina.includes(t)).length;
      if(titulos){const ops=await pagina.getOperatorList(),imagenes=ops.fnArray.filter(op=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject].includes(op)).length;assert(imagenes>=titulos+1,'Cada título permanece junto a su gráfico, además del logo');}
      textos.push(textoPagina);
    }
    const texto = textos.join('\n');
    assert.match(texto, /Panel de reportabilidad efectiva/);
    assert.match(texto, /Efectivas/);
    assert.match(texto, /Reportabilidad efectiva y no efectiva - S1 a S5/);
    assert.match(texto, /Evolución semanal de reportabilidad efectiva/);
    assert.match(texto, /No efectivas \/ maestro/);
    assert.match(texto, /Reportadas totales \/ maestro/);
    assert(!texto.includes('Cumplimiento semanal en barras -'),'El PDF omite el gráfico eliminado');
    assert.match(texto, /reportadas no efectivas/i);
    assert.match(texto, /Criterios aplicados: lectura actual mayor que cero/);
    assert(texto.includes(filtro), 'El PDF conserva la región seleccionada');
    fs.writeFileSync(path.join(salida,'Reportabilidad_Efectiva.txt'),texto);
    await lectura.destroy();

    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(salida,'movil.png')});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth+1), 'Sin desborde horizontal en móvil');
    await page.locator('#reporte-comparativo').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(salida,'movil-grafico.png')});
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#reporte-grafico').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(salida,'graficos.png')});
    assert.deepEqual(errores, []);
    assert.deepEqual(red, [], 'La consulta no requiere API ni Internet');
    console.log(`OK efectiva ${resumen.fecha}: ${resumen.efectivas}/${resumen.total}; normal ${resumen.reportadas}; filtros, zona, hover, CSV, PDF (${textos.length} páginas), escritorio y móvil.`);
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
