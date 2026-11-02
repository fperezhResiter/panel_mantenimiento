/* Status del maestro: ambas vistas, región/zona, selección múltiple y exportaciones. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const salida = path.resolve('tmp/status');
  fs.mkdirSync(salida,{recursive:true});
  try {
    for (const efectiva of [false,true]) {
      const page = await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
      const errores = [], red = [];
      page.on('pageerror', e=>errores.push(e.message));
      page.on('request', r=>{if(/^https?:/.test(r.url()))red.push(r.url());});
      await page.goto(pathToFileURL(path.resolve(`web/pages/Panel_Reportabilidad${efectiva?'_Efectiva':''}.html`)).href);
      const listo = () => page.waitForFunction(()=>!document.getElementById('consultar').disabled&&!document.getElementById('resultados').hidden);
      await listo();
      const catalogo = await page.locator('#status-equipo option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));
      assert(catalogo.includes('OPERATIVO')&&catalogo.includes('EN MANTENCION')&&catalogo.includes('SIN STATUS'));
      assert.equal(await page.locator('#status-equipo').isDisabled(),false);
      const totalInicial = await page.locator('#total').textContent();
      const control = page.locator('.multi-filtro').filter({has:page.locator('#status-equipo')});
      await control.locator('summary').click();
      await control.locator('input[type=checkbox][value="OPERATIVO"]').check();

      async function comprobar(estados) {
        const comparacion = await page.evaluate(estados=>{
          const campos=['reportadas','total','fuera_maestro',...(reporteEfectivo?['reportadas_totales']:[])];
          const arrays=['historico','historico_completo',...(reporteEfectivo?['historico_reportadas','historico_completo_reportadas']:[])];
          const entrada=seleccionados(reporte.regiones).filter(r=>PortalFiltros.coincide('region',r.region)).flatMap(r=>r.cecos.filter(c=>PortalFiltros.coincide('buscar',c.ceco)));
          const fuente=reporte.regiones.filter(r=>PortalConfig.incluida(r.region)&&PortalFiltros.coincide('region',r.region)).flatMap(r=>r.cecos.filter(c=>PortalConfig.cecoIncluido(c.ceco)&&PortalFiltros.coincide('buscar',c.ceco))).flatMap(c=>PortalZona.activa()&&PortalFiltros.hay('zona-linea')?c.lineas.filter(l=>PortalFiltros.coincide('zona-linea',l.linea)):[c]);
          const esperado={};
          for(const campo of campos)esperado[campo]=fuente.flatMap(c=>c.por_status).filter(s=>!estados.length||estados.includes(s.status)).reduce((n,s)=>n+s[campo],0);
          const actual=Object.fromEntries(campos.map(campo=>[campo,visibles.flatMap(r=>r.cecos).reduce((n,c)=>n+c[campo],0)]));
          const historias=entrada.every(c=>arrays.every(campo=>c[campo].every((n,i)=>n===c.por_status.filter(s=>!estados.length||estados.includes(s.status)).reduce((n,s)=>n+s[campo][i],0))));
          const lineas=entrada.every(c=>!c.lineas||campos.every(campo=>c[campo]===c.lineas.reduce((n,l)=>n+l[campo],0)));
          const tarjetas={total:document.getElementById('total').textContent,reportadas:document.getElementById('reportadas').textContent,porcentaje:document.getElementById('porcentaje').textContent};
          if(reporteEfectivo){tarjetas.noEfectivas=document.getElementById('no-efectivas').textContent;tarjetas.enviadas=document.getElementById('reportadas-totales').textContent;}
          return {esperado,actual,historias,lineas,tarjetas,marcas:document.querySelectorAll('#reporte-grafico circle[data-entidad]').length};
        },estados);
        assert.deepEqual(comparacion.actual,comparacion.esperado,'El numerador y la base pertenecen a los mismos status');
        assert(comparacion.historias,'Todas las semanas usan la selección de status');
        assert(comparacion.lineas,'Las líneas conservan la suma del status de la unidad');
        assert.equal(comparacion.tarjetas.total,comparacion.esperado.total.toLocaleString('es-CL'));
        assert.equal(comparacion.tarjetas.reportadas,comparacion.esperado.reportadas.toLocaleString('es-CL'));
        const pct=comparacion.esperado.total?(100*comparacion.esperado.reportadas/comparacion.esperado.total).toLocaleString('es-CL',{maximumFractionDigits:1})+' %':'—';
        assert.equal(comparacion.tarjetas.porcentaje,pct);
        if(efectiva){
          assert.equal(comparacion.tarjetas.noEfectivas,(comparacion.esperado.reportadas_totales-comparacion.esperado.reportadas).toLocaleString('es-CL'));
          assert.equal(comparacion.tarjetas.enviadas,comparacion.esperado.reportadas_totales.toLocaleString('es-CL'));
        }
        assert(comparacion.marcas>0);
        return comparacion;
      }
      await comprobar(['OPERATIVO']);
      assert.notEqual(await page.locator('#total').textContent(),totalInicial);
      await control.locator('input[type=checkbox][value="EN MANTENCION"]').check();
      assert.equal(await page.locator('#status-equipo-resumen').textContent(),'2 status seleccionados');
      await comprobar(['OPERATIVO','EN MANTENCION']);
      await page.locator('h1').click();
      await page.locator('#modo-zona').click();await listo();
      assert.deepEqual(await page.evaluate(()=>PortalFiltros.valores('status-equipo')),['EN MANTENCION','OPERATIVO']);
      await comprobar(['OPERATIVO','EN MANTENCION']);
      const orden = await page.locator('form.filtros').evaluate(form=>[...form.querySelectorAll('select')].map(s=>s.id));
      assert.equal(orden[orden.indexOf('buscar')+1],'zona-linea');
      const region=await page.locator('#region option').nth(1).getAttribute('value');
      await page.locator('#region').selectOption(region,{force:true});
      await comprobar(['OPERATIVO','EN MANTENCION']);
      await page.locator('#buscar').selectOption({index:1},{force:true});
      await comprobar(['OPERATIVO','EN MANTENCION']);
      await page.locator('#zona-linea').selectOption({index:1},{force:true});await listo();
      await comprobar(['OPERATIVO','EN MANTENCION']);
      await page.locator('#modo-zona').click();await listo();
      await comprobar(['OPERATIVO','EN MANTENCION']);
      await page.locator('#formulario').evaluate(f=>f.requestSubmit());await listo();
      await comprobar(['OPERATIVO','EN MANTENCION']);
      await page.screenshot({path:path.join(salida,efectiva?'efectiva.png':'reportabilidad.png')});

      const promesaCsv=page.waitForEvent('download');await page.locator('#exportar').click();
      const csv=await promesaCsv,rutaCsv=path.join(salida,efectiva?'efectiva.csv':'reportabilidad.csv');
      await csv.saveAs(rutaCsv);
      const textoCsv=fs.readFileSync(rutaCsv,'utf8');
      assert.match(textoCsv,/Status del equipo \(filtro\)/);
      assert.match(textoCsv,/EN MANTENCION, OPERATIVO/);

      // Un filtro de región mantiene el PDF compacto y permite comprobar las cantidades.
      await page.locator('#region').selectOption({index:1},{force:true});
      await comprobar(['OPERATIVO','EN MANTENCION']);
      const promesaPdf=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();
      const pdf=await promesaPdf,rutaPdf=path.join(salida,efectiva?'efectiva.pdf':'reportabilidad.pdf');
      await pdf.saveAs(rutaPdf);
      const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
      const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(rutaPdf)),useSystemFonts:true}).promise;
      const textos=[];
      for(let n=1;n<=doc.numPages;n++)textos.push((await (await doc.getPage(n)).getTextContent()).items.map(i=>i.str).join(' '));
      assert.match(textos.join('\n'),/Status del equipo: EN MANTENCION, OPERATIVO/);
      await doc.destroy();

      await page.evaluate(()=>{PortalFiltros.asignar('region');PortalFiltros.asignar('status-equipo',['SIN STATUS']);document.getElementById('status-equipo').dispatchEvent(new Event('change',{bubbles:true}));});
      await comprobar(['SIN STATUS']);
      await page.evaluate(()=>{PortalFiltros.asignar('status-equipo');document.getElementById('status-equipo').dispatchEvent(new Event('change',{bubbles:true}));});
      await comprobar([]);
      assert.equal(await page.locator('#total').textContent(),totalInicial);
      await page.setViewportSize({width:390,height:844});
      await control.locator('summary').click();
      await page.screenshot({path:path.join(salida,efectiva?'efectiva-movil.png':'reportabilidad-movil.png')});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Sin desborde horizontal en móvil');
      assert.deepEqual(errores,[]);assert.deepEqual(red,[]);
      console.log(`OK status del maestro: ${efectiva?'efectiva':'reportabilidad'}, múltiples, región/zona/unidad/línea, historial, CSV, PDF, móvil y sin conexión.`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
