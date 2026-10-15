const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const pub = fs.readFileSync(path.join(root,'web/datos/publicacion.js'),'utf8');
const original = JSON.parse(zlib.gunzipSync(Buffer.from(pub.match(/Gzip = "([^"]+)"/)[1], 'base64')));
const vacia = {regiones:[],cecos:[],catalogo:[],centros:[],ocultos:[],zonas:[],catalogo_zonas:[],unidades_regiones:[],unidades_zonas:[]};
(async()=>{
  const server = spawn(process.env.PANEL_PYTHON || 'python',['-B','-u','scripts/reportabilidad.py','--puerto','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    const url = await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>reject(Error('Servidor sin respuesta')),20000);
      server.stdout.on('data',d=>{const m=d.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});
      server.on('exit',c=>{clearTimeout(t);reject(Error('Servidor terminó '+c));});
    });
    browser = await chromium.launch({headless:true,channel:'msedge'});
    let guardada = structuredClone(vacia);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errores=[]; page.on('pageerror',e=>errores.push(e.message));
    await context.route('**/api/configuracion',async r=>{
      if(r.request().method()==='POST') guardada=r.request().postDataJSON();
      await r.fulfill({json:guardada});
    });
    await page.goto(url+'/web/pages/Panel_Configuraciones.html');
    await page.waitForFunction(()=>!document.querySelector('#config-recargar').disabled);
    assert(await page.locator('#config-regiones fieldset').count()>0);
    const unidad = page.locator('#config-regiones input[data-tipo="cecos"]').first();
    const nombreUnidad=await unidad.getAttribute('data-valor');
    await unidad.uncheck();
    const padre = page.locator('#config-regiones fieldset').filter({has:page.locator(`input[data-tipo="cecos"][data-valor="${nombreUnidad}"]`)}).first();
    const region = padre.locator('legend input');
    const nombreRegion = await region.getAttribute('data-valor');
    await region.uncheck();
    assert(await padre.locator('input[data-tipo="cecos"]').first().isDisabled());
    await region.check();
    assert.equal(await padre.locator(`input[data-valor="${nombreUnidad}"]`).isChecked(),false);
    await page.locator('#modo-zona').click();
    assert.equal(await page.locator('#modo-zona').getAttribute('aria-pressed'),'true');
    const zona=page.locator('#config-regiones legend input').first();
    const nombreZona=await zona.getAttribute('data-valor');
    await zona.uncheck();
    await page.waitForFunction(()=>document.querySelector('#config-estado').textContent.includes('guardada'));
    assert(guardada.cecos.includes(nombreUnidad)); assert(guardada.zonas.includes(nombreZona));
    console.log('OK configuración: jerarquía, exclusión de unidad, memoria de hijos y modo zona');
    await context.close();
    // Las mismas exclusiones se cargan de la API y de la publicación comprimida.
    const config={...vacia,regiones:[nombreRegion],cecos:[nombreUnidad],zonas:[nombreZona]};
    const packed=zlib.gzipSync(Buffer.from(JSON.stringify({...original,configuracion:config}))).toString('base64');
    for(const modo of ['interactivo','sin servidor']) {
      const ctx=await browser.newContext();
      await ctx.route('**/api/configuracion',r=>r.fulfill({json:config}));
      if(modo==='sin servidor') await ctx.addInitScript(p=>Object.defineProperty(window,'PublicacionMantenimientoGzip',{get:()=>p,set:()=>{}}),packed);
      const p=await ctx.newPage(); p.on('pageerror',e=>errores.push(e.message));
      await p.addInitScript(()=>localStorage.setItem('resiter.mantenimiento.agrupacion','region'));
      for(const panel of ['Reportabilidad','Seguimiento_KM_HR','Resumen_Mantencion','Calendario_Mantencion','Programa_Mantencion']) {
        const ruta='web/pages/Panel_'+panel+'.html';
        await p.goto(modo==='interactivo'?url+'/'+ruta:pathToFileURL(path.join(root,ruta)).href);
        await p.waitForFunction(()=>!document.querySelector('#consultar,#km-consultar,#mt-consultar').disabled && document.querySelector('tbody tr'));
        const comprobar=async(zonal)=>{
          const opciones=await p.locator('#region option,#km-region option,#mt-region-resumen option,#mt-region-cal option,#region-programa option').evaluateAll(os=>os.map(o=>o.value));
          assert(!opciones.includes(zonal?nombreZona:nombreRegion),`${modo} ${panel}: grupo excluido`);
          const unidades=await p.locator('#buscar option,#km-ceco option,#mt-ceco-resumen option,#mt-ceco-cal option,#ceco-programa option').evaluateAll(os=>os.map(o=>o.value));
          assert(!unidades.includes(nombreUnidad),`${modo} ${panel}: unidad excluida`);
          assert(unidades.some(Boolean),`${modo} ${panel}: conserva unidades incluidas`);
        };
        await comprobar(false);
        await p.locator('#modo-zona').click();
        await p.waitForFunction(()=>!document.querySelector('#consultar,#km-consultar,#mt-consultar').disabled);
        await comprobar(true);
        console.log('OK '+modo+' '+panel+': exclusiones por región, unidad y zona');
      }
      await ctx.close();
    }
    assert.deepEqual(errores,[]);
  } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
