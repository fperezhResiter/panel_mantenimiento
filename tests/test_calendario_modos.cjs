/* Guardado real en BD aislada, recarga interactiva y publicación file://. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const temporal = fs.mkdtempSync(path.join(root,'Datos/test_tmp/calendario-modos-'));
const bd = path.join(temporal,'mantenimiento.sqlite3');
fs.copyFileSync(path.join(root,'Datos/mantenimiento.sqlite3'),bd);
const ejecutar = (codigo, args) => {
  const r = spawnSync(process.env.PANEL_PYTHON || 'python',['-B','-c',codigo,...args],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr || r.stdout);
};
(async()=>{
  const servidor = spawn(process.env.PANEL_PYTHON || 'python',['-B','-u','scripts/reportabilidad.py','--puerto','0','--bd',bd],{cwd:root,stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    const url = await new Promise((resolve,reject)=>{
      const espera = setTimeout(()=>reject(new Error('Servidor sin respuesta')),20000);
      servidor.stdout.on('data',data=>{const encontrado=data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(encontrado){clearTimeout(espera);resolve(encontrado[0]);}});
      servidor.on('exit',code=>{clearTimeout(espera);reject(new Error('Servidor terminó: '+code));});
    });
    browser = await chromium.launch({headless:true,channel:'msedge'});
    const page = await browser.newPage({acceptDownloads:true});
    await page.goto(url+'/web/pages/Panel_Calendario_Mantencion.html');
    await page.waitForFunction(()=>document.querySelector('#mt-agenda input[type="checkbox"]'));
    const primera = page.locator('#mt-agenda input[type="checkbox"]').first();
    const patente = (await primera.getAttribute('aria-label')).match(/^Incluir (.+) en la publicación/)[1];
    const selector = `#mt-agenda input[aria-label="Incluir ${patente} en la publicación del calendario y descargas"]`;
    await primera.uncheck();
    await page.waitForFunction(()=>document.querySelector('#mt-config-estado').textContent.includes('guardada en la BD'));
    await page.reload();
    await page.waitForSelector(selector);
    assert.equal(await page.locator(selector).isChecked(),false,'La exclusión se conserva al recargar');
    const calendario = new URL(page.url()).pathname;
    fs.copyFileSync(path.join(root,'Panel.html'),path.join(temporal,'Panel.html'));
    fs.cpSync(path.join(root,'web'),path.join(temporal,'web'),{recursive:true});
    ejecutar('from app.publicacion import publicar_consulta; import sys; publicar_consulta(sys.argv[1],sys.argv[2])',[bd,path.join(temporal,'web/datos/publicacion.js')]);
    await page.goto(pathToFileURL(path.join(temporal,calendario)).href);
    await page.waitForFunction(()=>document.querySelector('#mt-consultar').disabled===false);
    assert.equal(await page.locator('#mt-agenda input[type="checkbox"]').count(),0);
    assert.equal(await page.locator('#mt-agenda').getByText(patente,{exact:true}).count(),0,'La patente no aparece en la agenda publicada');
    assert(!(await page.locator('#mt-cal-grid').textContent()).includes(patente));
    const download = page.waitForEvent('download'); await page.locator('#mt-exportar-calendario').click();
    const archivo = await download; const csv = path.join(temporal,'calendario.csv'); await archivo.saveAs(csv);
    assert(!fs.readFileSync(csv,'utf8').includes(patente),'CSV publicado excluye la patente');
    // Reincorporar la patente y volver a publicar la recupera.
    await page.goto(url+'/web/pages/Panel_Calendario_Mantencion.html');
    await page.waitForSelector(selector); await page.locator(selector).check();
    await page.waitForFunction(()=>document.querySelector('#mt-config-estado').textContent.includes('guardada en la BD'));
    ejecutar('from app.publicacion import publicar_consulta; import sys; publicar_consulta(sys.argv[1],sys.argv[2])',[bd,path.join(temporal,'web/datos/publicacion.js')]);
    await page.goto(pathToFileURL(path.join(temporal,calendario)).href);
    await page.waitForFunction(()=>document.querySelector('#mt-consultar').disabled===false);
    assert.equal(await page.locator('#mt-agenda').getByText(patente,{exact:true}).count(),1);
    console.log('OK: selección guardada en BD, recarga, exclusión publicada sin casillas y reincorporación de '+patente);
  } finally {if(browser)await browser.close();servidor.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
