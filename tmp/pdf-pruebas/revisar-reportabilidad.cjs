const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

(async()=>{
  const pdfjs = await import(pathToFileURL(path.join(process.env.NODE_PATH,'pdfjs-dist/legacy/build/pdf.mjs')).href);
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const errores=[];
  try {
    const page=await browser.newPage({acceptDownloads:true});
    page.on('pageerror',e=>errores.push(e.message));
    await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad.html')).href);
    await page.waitForFunction(()=>window.PanelPDF && !document.querySelector('#consultar').disabled && !document.querySelector('#resultados').hidden);
    const salida=path.resolve('output/pdf/Reportabilidad.pdf');
    fs.mkdirSync(path.dirname(salida),{recursive:true});
    for (const modo of ['region','zona','oscuro']) {
      if(modo==='zona') {
        await page.locator('#modo-zona').click();
        await page.waitForFunction(()=>PortalZona.activa() && !document.querySelector('#consultar').disabled && !document.querySelector('#resultados').hidden);
        await page.locator('#region').selectOption({index:1});
        await page.locator('#region').dispatchEvent('change');
        await page.locator('#mostrar-regiones').click();
      }
      if(modo==='oscuro') {
        await page.goto(pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad.html')).href+'?tema=oscuro');
        await page.waitForFunction(()=>window.PanelPDF && !document.querySelector('#consultar').disabled && !document.querySelector('#resultados').hidden);
      }
      const antes=await page.evaluate(()=>({
        cifras:[...document.querySelectorAll('.kpi b')].map(e=>e.innerText),
        filas:document.querySelector('#detalle').rows.length,
        colores:[...document.querySelectorAll('#detalle .semaforo')].map(e=>({texto:e.textContent,color:getComputedStyle(e).color})),
        leyendas:[...document.querySelectorAll('#reporte-leyenda [data-pdf-leyenda]')].map(e=>e.dataset.pdfLeyenda)
      }));
      const descarga=page.waitForEvent('download',{timeout:60000});
      await page.locator('#descargar-pdf').click();
      const destino=modo==='region'?salida:path.resolve(`tmp/pdf-pruebas/Reportabilidad_${modo}.pdf`);
      await (await descarga).saveAs(destino);
      const pdf=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(destino)),useSystemFonts:true}).promise;
      const paginas=[];
      for(let n=1;n<=pdf.numPages;n++) {
        const pg=await pdf.getPage(n);
        paginas.push((await pg.getTextContent()).items.map(i=>i.str).join(' '));
      }
      const texto=paginas.join('\n');
      assert(!texto.includes('Pasa el mouse'));
      assert(paginas.some(t=>t.includes('Detalle por')&&t.includes('% semana seleccionada')));
      for(const leyenda of antes.leyendas) assert(texto.includes(leyenda));
      const despues=await page.evaluate(()=>({cifras:[...document.querySelectorAll('.kpi b')].map(e=>e.innerText),filas:document.querySelector('#detalle').rows.length}));
      assert.deepEqual(despues,{cifras:antes.cifras,filas:antes.filas});
      console.log(JSON.stringify({modo,destino,paginas:pdf.numPages,filas:antes.filas,colores:[...new Set(antes.colores.map(c=>c.color))]}));
      await pdf.destroy();
    }
    assert.deepEqual(errores,[]);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
