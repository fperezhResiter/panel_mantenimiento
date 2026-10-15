const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.addInitScript(() => localStorage.setItem('resiter.mantenimiento.agrupacion','region'));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../web/pages/Panel_Seguimiento_KM_HR.html')).href);
    await page.locator('#km-resultados').waitFor({state:'visible'});
    assert.equal(await page.locator('#km-alternar-lineas').isVisible(),false);
    const punto = page.locator('#km-grafico-lecturas .km-marca:has(.km-punto)').last();
    const semana = await punto.getAttribute('data-semana');
    const barra = page.locator(`#km-grafico-ritmo .km-marca[data-semana="${semana}"]`);
    const verificar = async () => {
      assert.match(await punto.getAttribute('class'),/km-marca-activa/);
      assert.match(await barra.getAttribute('class'),/km-marca-activa/);
      assert.equal(await page.locator('.km-valor-activo[visibility="visible"]').count(),2);
      assert.equal(await page.locator('.km-guia-activa[visibility="visible"]').count(),2);
      for (const etiqueta of await page.locator('.km-valor-activo[visibility="visible"]').allTextContents()) {
        assert(etiqueta.startsWith(`S${semana}: `));
      }
    };
    await punto.locator('.km-area').hover();
    await verificar();
    await page.screenshot({path:path.resolve(__dirname,'../tmp/km-hover.png'),fullPage:true});
    await page.locator('#km-titulo-lecturas').hover();
    assert.equal(await page.locator('.km-marca-activa').count(),0);
    const rect = barra.locator('.km-barra');
    if (await rect.count()) {
      await barra.locator('.km-area').hover();
      await verificar();
    }
    await punto.focus();
    await verificar();
    await page.locator('#km-patente').focus();
    assert.equal(await page.locator('.km-marca-activa').count(),0);
    const total = await page.locator('#km-total').textContent();
    await page.locator('#modo-zona').click();
    await page.waitForFunction(() => !document.querySelector('#km-consultar').disabled);
    assert.equal(await page.locator('#km-total').textContent(),total);
    assert.equal(await page.locator('tr.zona-linea').count(),0);
    await page.locator('#km-alternar-lineas').click();
    assert.equal(await page.locator('#km-alternar-lineas').textContent(),'Ocultar líneas');
    assert(await page.locator('tr.zona-linea').count()>0);
    assert.equal(await page.locator('#km-detalle tr:not(.km-grupo)').count(),Number(total));
    const grupo = page.locator('tr.zona-linea').first();
    await grupo.locator('button').click();
    assert.equal(await grupo.locator('button').getAttribute('aria-expanded'),'false');
    await page.locator('#km-alternar-grupos').click();
    assert.equal(await page.locator('#km-detalle tr:not(.km-grupo):visible').count(),0);
    await page.locator('#km-alternar-grupos').click();
    assert.equal(await page.locator('#km-detalle tr:not(.km-grupo):visible').count(),Number(total));
    await page.locator('#km-alternar-lineas').click();
    assert.equal(await page.locator('tr.zona-linea').count(),0);
    assert.equal(await page.locator('#km-alternar-lineas').textContent(),'Mostrar por línea');
    assert.equal(await page.locator('#km-detalle tr:not(.km-grupo):visible').count(),Number(total));
    assert.deepEqual(errores,[]);
    console.log('OK KM-HR: hover y foco sincronizados, valores, líneas opcionales y grupos sin duplicados.');
  } finally {
    await browser.close();
  }
})().catch(e => {console.error(e);process.exitCode=1;});
