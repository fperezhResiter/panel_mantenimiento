/* Etiquetas reales, filtros y copia PDF en ambos modos, sin modificar la BD. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
(async () => {
  const servidor = spawn(process.env.PANEL_PYTHON || 'python',['-B','-u','scripts/reportabilidad.py','--puerto','0'], {cwd:root,stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    const url = await new Promise((resolve,reject) => {
      const timeout = setTimeout(()=>reject(new Error('Servidor sin respuesta')),20000);
      servidor.stdout.on('data',d=>{const m=d.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timeout);resolve(m[0]);}});
      servidor.on('exit',c=>{clearTimeout(timeout);reject(new Error('Servidor terminó: '+c));});
    });
    browser = await chromium.launch({headless:true,channel:'msedge'});
    const page = await browser.newPage({acceptDownloads:true});
    const errores=[]; page.on('pageerror',e=>errores.push(e.message));
    for (const modo of ['interactivo','sin servidor']) {
      for (const panel of ['Reportabilidad','Seguimiento_KM_HR','Resumen_Mantencion','Calendario_Mantencion','Programa_Mantencion']) {
        const ruta=`web/pages/Panel_${panel}.html`;
        await page.goto(modo==='interactivo' ? url+'/'+ruta : pathToFileURL(path.join(root,ruta)).href);
        await page.waitForFunction(()=>document.querySelector('table tbody tr') && !document.querySelector('#consultar,#km-consultar,#mt-consultar')?.disabled);
        const resultado = await page.evaluate(() => {
          const selector=document.querySelector('#buscar,#km-ceco,#mt-ceco-resumen,#mt-ceco-cal,#ceco-programa');
          const op=[...selector.options].find(o=>o.textContent!==o.value && o.value && / \(.+\)$/.test(o.textContent));
          const tabla=document.querySelector('table tbody').textContent;
          const nombres=[...selector.options].filter(o=>o.value).map(o=>[o.value,o.textContent]);
          const codificados=nombres.filter(([v,t])=>v!==t);
          const copia=document.documentElement.cloneNode(true);
          PortalConfig.limpiarCecosPDF(copia);
          const limpio=copia.querySelector('table tbody').textContent;
          return {op:op&&{valor:op.value,texto:op.textContent},codificados,tabla,limpio,grafico:[...document.querySelectorAll('svg')].map(g=>g.textContent).join(' ')};
        });
        assert(resultado.op,`${modo} ${panel}: códigos en desplegable`);
        const presentes=resultado.codificados.filter(([v,t])=>resultado.tabla.includes(t));
        assert(presentes.length,`${modo} ${panel}: códigos en tabla`);
        for (const [nombre,etiqueta] of presentes) {
          assert(!resultado.limpio.includes(etiqueta),`${panel}: PDF sin código`);
          assert(resultado.limpio.includes(nombre),`${panel}: PDF conserva nombre`);
          assert(!resultado.grafico.includes(etiqueta),`${panel}: gráfico sin código`);
        }
        const selector=page.locator('#buscar,#km-ceco,#mt-ceco-resumen,#mt-ceco-cal,#ceco-programa');
        await selector.selectOption(resultado.op.valor);
        assert.equal(await selector.inputValue(),resultado.op.valor,'El filtro conserva su clave sin código');
        if (panel === 'Reportabilidad') {
          await page.evaluate(() => {
            const original=window.PDFLib.PDFDocument.create;
            window.textosPDF=[];
            window.PDFLib.PDFDocument.create=async (...args) => {
              const pdf=await original(...args), agregar=pdf.addPage.bind(pdf);
              pdf.addPage=(...opciones)=>{
                const pagina=agregar(...opciones), escribir=pagina.drawText.bind(pagina);
                pagina.drawText=(texto,estilo)=>{window.textosPDF.push(texto);return escribir(texto,estilo);};
                return pagina;
              };
              return pdf;
            };
          });
          const descarga=page.waitForEvent('download',{timeout:60000});
          await page.locator('#descargar-pdf').click();
          assert((await descarga).suggestedFilename().endsWith('.pdf'));
          const textos=await page.evaluate(()=>window.textosPDF);
          assert(textos.length);
          for (const texto of textos) assert(!texto.includes(resultado.op.texto),'El PDF generado no incluye códigos');
        }
        console.log(`OK ${modo} ${panel}: desplegable, tabla, filtro, gráficos y copia PDF`);
      }
    }
    assert.deepEqual(errores,[]);
  } finally {if(browser)await browser.close();servidor.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
