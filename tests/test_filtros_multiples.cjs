/* Prueba de los cinco paneles con publicación real y sin escrituras en la BD. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const paneles = [
  ['Reportabilidad','region','buscar','#consultar','#total'],
  ['Seguimiento_KM_HR','km-region','km-ceco','#km-consultar','#km-total'],
  ['Resumen_Mantencion','mt-region-resumen','mt-ceco-resumen','#mt-consultar','#mt-patentes tr'],
  ['Calendario_Mantencion','mt-region-cal','mt-ceco-cal','#mt-consultar','#mt-dia-titulo'],
  ['Programa_Mantencion','region-programa','ceco-programa','#consultar','#kpis .kpi b']
];
(async()=>{
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    for (const transporte of ['file','http']) {
      for (const [panel,region,unidad,consulta,indicador] of paneles) {
        const page = await browser.newPage({viewport:{width:1440,height:1000}});
        const errores = []; page.on('pageerror',e=>errores.push(e.message));
        // HTTP usa la publicación, igual que el acceso desde Panel Universal.
        await page.route('http://panel.test/**',async route=>{
          const pathname = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/principal\//,'');
          const archivo = path.resolve(root,pathname);
          if (!archivo.startsWith(root+path.sep) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) return route.fulfill({status:404,body:''});
          return route.fulfill({path:archivo});
        });
        const local = path.join(root,'web/pages/Panel_'+panel+'.html');
        await page.goto(transporte==='file'?pathToFileURL(local).href:'http://panel.test/principal/web/pages/Panel_'+panel+'.html');
        await page.waitForFunction(id=>window.PortalFiltros && document.getElementById(id).options.length>2, region);
        await page.waitForFunction(id=>!document.querySelector(id).disabled,consulta);
        if(panel==='Programa_Mantencion') {
          const mes=await page.evaluate(async()=>Object.entries((await PortalDatos.listo).programas).find(([,p])=>p.total>0)?.[0]);
          await page.locator('#mes').fill(mes); await page.locator('#mes').dispatchEvent('change');
          await page.waitForFunction(()=>!document.querySelector('#consultar').disabled);
        }
        const elegir = async(id,values)=>page.evaluate(({id,values})=>{PortalFiltros.asignar(id,values);document.getElementById(id).dispatchEvent(new Event('change',{bubbles:true}));},{id,values});
        const total = async()=>page.evaluate(({panel,indicador})=>{
          if(panel==='Resumen_Mantencion') return document.querySelectorAll(indicador).length;
          const text=document.querySelector(indicador).textContent;
          return panel==='Calendario_Mantencion'?Number(text.match(/(\d+) patentes/)?.[1]||0):Number(text.replace(/\D/g,''));
        },{panel,indicador});
        for(const modo of ['region','zona']) {
          if(modo==='zona') {await page.locator('#modo-zona').click();await page.waitForFunction(id=>!document.querySelector(id).disabled,consulta);}
          const unidades=await page.locator('#'+unidad+' option').evaluateAll(ops=>ops.map(o=>o.value).filter(Boolean).slice(0,2));
          assert.equal(unidades.length,2,panel+': necesita dos unidades');
          await elegir(unidad,[unidades[0]]); const a=await total();
          await elegir(unidad,[unidades[1]]); const b=await total();
          await elegir(unidad,unidades); assert.equal(await total(),a+b,`${panel}/${modo}/${transporte}: suma de ambas unidades`);
          assert.match(await page.locator('#'+unidad+'-resumen').textContent(),/2 unidades/);
          const elegidas=await page.evaluate(id=>PortalFiltros.valores(id),unidad);assert.deepEqual(elegidas,unidades);
          // La consulta mantiene ambas unidades.
          await page.locator(consulta).click();await page.waitForFunction(id=>!document.querySelector(id).disabled,consulta);
          assert.deepEqual(await page.evaluate(id=>PortalFiltros.valores(id),unidad),unidades);
          await elegir(unidad,[]);
          const regiones=await page.locator('#'+region+' option').evaluateAll(ops=>ops.map(o=>o.value).filter(Boolean).slice(0,2));
          await elegir(region,[regiones[0]]);const r1=await total();
          await elegir(region,[regiones[1]]);const r2=await total();
          await elegir(region,regiones);assert.equal(await total(),r1+r2,`${panel}/${modo}: suma de regiones`);
          await elegir(region,[]);
          // Interacción real: casillas, búsqueda, selección total y limpieza.
          const widget=page.locator('#'+unidad).locator('..');
          await widget.locator('summary').click();
          await widget.locator('input[type=checkbox]').nth(0).check();
          await widget.locator('input[type=checkbox]').nth(1).check();
          assert.equal((await page.evaluate(id=>PortalFiltros.valores(id),unidad)).length,2);
          await widget.locator('input[type=search]').fill(unidades[0]);
          assert(await widget.locator('.multi-opciones label:visible').count()>0);
          await widget.getByRole('button',{name:'Seleccionar todas',exact:true}).click();
          const opciones=await page.locator('#'+unidad+' option').count();
          assert.equal((await page.evaluate(id=>PortalFiltros.valores(id),unidad)).length,opciones-1);
          await widget.getByRole('button',{name:'Limpiar selección',exact:true}).click();
          assert.deepEqual(await page.evaluate(id=>PortalFiltros.valores(id),unidad),[]);
          await widget.locator('input[type=search]').press('Escape');
          assert.equal(await widget.locator('details').getAttribute('open'),null);
        }
        await page.setViewportSize({width:390,height:844});
        await page.locator('#'+unidad).locator('..').locator('summary').click();
        assert(await page.locator('#'+unidad).locator('..').locator('.multi-panel').isVisible());
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),panel+': ancho móvil');
        if(transporte==='file'&&panel==='Resumen_Mantencion') await page.screenshot({path:path.join(root,'tmp/filtros-multiples-movil.png')});
        assert.deepEqual(errores,[],`${panel}: consola`);
        console.log(`${transporte}/${panel}: selección, sumas, consulta, zona y móvil OK`);
        await page.close();
      }
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
