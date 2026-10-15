/* Consulta real con file://: sin API, filtros y descargas disponibles. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({acceptDownloads:true});
    const errores = [], red = [];
    page.on('pageerror', e=>errores.push(e.message));
    page.on('request', r=>{if(/^https?:/.test(r.url())) red.push(r.url());});
    await page.goto(pathToFileURL(path.resolve('Panel.html')).href);
    await page.waitForFunction(()=>document.querySelector('[aria-label="Base de datos"]').textContent.includes('Última publicación:'));
    assert.equal(await page.locator('header #bd-barra').count(),1);
    assert(!(await page.locator('#bd-barra').innerText()).includes('Consulta sin servidor'));
    assert.equal(await page.locator('[aria-label="Base de datos"] button').isVisible(), false);
    assert.equal(await page.locator('a[href$="Panel_Configuraciones.html"]').isVisible(), false);
    for (const panel of ['Reportabilidad','Seguimiento_KM_HR','Resumen_Mantencion','Calendario_Mantencion','Programa_Mantencion']) {
      await page.goto(pathToFileURL(path.resolve(`web/pages/Panel_${panel}.html`)).href);
      await page.waitForFunction(()=>document.querySelector('#consultar,#km-consultar,#mt-consultar')?.disabled === false, {timeout:30000});
      await page.waitForTimeout(500);
      const estados = await page.locator('#estado,#km-mensaje,#mt-mensaje').allTextContents();
      assert(!estados.some(s=>/no hay publicación|no se pudo|inicia reportabilidad|abre el portal/i.test(s)), estados.join(' '));
      assert(await page.locator('table tbody tr').count() > 0, panel+' debe tener datos');
      assert.equal(await page.locator('a[href$="Panel_Configuraciones.html"]').isVisible(), false);
      if (panel === 'Calendario_Mantencion') assert.equal(await page.locator('#mt-agenda input[type="checkbox"]').count(),0);
      for (const id of ['region','km-region','mt-region-resumen','mt-region-cal','region-programa', 'buscar','km-ceco','mt-ceco-resumen','mt-ceco-cal','ceco-programa']) {
        const filtro = page.locator('select#'+id);
        if (await filtro.count() && await filtro.locator('option').count() > 1) await filtro.selectOption({index:1});
      }
      const csv = page.locator('#exportar,#km-exportar,#mt-exportar-resumen,#mt-exportar-calendario').first();
      if (await csv.count()) {
        assert(await csv.isEnabled(), panel+' CSV disponible');
        const descarga = page.waitForEvent('download'); await csv.click();
        assert((await descarga).suggestedFilename().endsWith('.csv'));
      }
      console.log('OK datos y descargas disponibles: '+panel);
      const d = page.waitForEvent('download', {timeout:45000}); await page.locator('#descargar-pdf').click();
      try { assert((await d).suggestedFilename().endsWith('.pdf')); }
      catch(error) {throw new Error(panel+': '+await page.locator('#pdf-estado').textContent()+'; '+error.message);}
      if (panel === 'Calendario_Mantencion') {
        const regional = page.waitForEvent('download', {timeout:45000});
        await page.locator('#mt-exportar-informe').click();
        assert((await regional).suggestedFilename().endsWith('.pdf'));
      }
      console.log('OK file:// '+panel+': datos, filtros y PDF');
    }
    await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Configuraciones.html')).href);
    await page.waitForURL(pathToFileURL(path.resolve('Panel.html')).href);
    assert.equal(await page.locator('#config-vistas').count(),0);
    const r = await page.evaluate(async()=>{const r=await PortalDatos.consultar('/api/configuracion',{method:'POST'});return r.ok;});
    assert.equal(r,false);
    assert.deepEqual(red,[],'La consulta no debe llamar al servidor ni a Internet');
    assert.deepEqual(errores,[]);
    const universal = path.resolve('../../Panel Universal.html');
    if (fs.existsSync(universal)) {
      await page.goto(pathToFileURL(universal).href);
      const enlace = page.locator('#paneles article').filter({has:page.locator('h3', {hasText:'Panel Mantenimiento'})});
      assert.equal(await enlace.count(),1);
      assert.equal(await enlace.locator('a').getAttribute('href'),'Panel Mantenimiento/panel_mantenimiento/Panel.html');
      assert.equal(await enlace.locator('.estado').textContent(),'HTML disponible');
      console.log('OK Panel Universal: un acceso a Mantenimiento sin servidor');
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
