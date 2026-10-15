/* PDF nativo: valida texto seleccionable, filtros, vistas y descargas en file://. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {PDFDocument} = require('../web/vendor/pdf-lib.min.js');
const salida = path.resolve('tmp/pdf-pruebas');
fs.mkdirSync(salida,{recursive:true});
(async()=>{
  const pdfjs = await import(process.env.PDFJS_MODULE ? pathToFileURL(process.env.PDFJS_MODULE).href : 'pdfjs-dist/legacy/build/pdf.mjs');
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage({acceptDownloads:true});
    const errores=[];page.on('pageerror',e=>errores.push(e.message));
    const paneles=process.env.PDF_PANELES?.split(',') || ['Reportabilidad','Seguimiento_KM_HR','Resumen_Mantencion','Calendario_Mantencion','Programa_Mantencion'];
    for(const panel of paneles){
      const url=process.env.PANEL_URL ? process.env.PANEL_URL+`/Panel_${panel}.html` : pathToFileURL(path.resolve(`web/pages/Panel_${panel}.html`)).href;
      await page.goto(url);
      await page.waitForFunction(()=>window.PanelPDF && document.querySelector('#consultar,#km-consultar,#mt-consultar')?.disabled===false);
      if(panel==='Programa_Mantencion') {
        const mes=await page.evaluate(async()=>Object.values((await PortalDatos.listo).programas).find(m=>m.total>0)?.mes);
        if(mes){await page.locator('#mes').fill(mes);await page.locator('#mes').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('#consultar').disabled===false);}
      }
      assert.equal(await page.locator('#avisos:visible,#resumen-config:visible').count(),0);
      // Los filtros elegidos y las vistas ocultas se congelan al descargar.
      const selector=page.locator('form select').first();
      if(await selector.count() && await selector.locator('option').count()>1)await selector.selectOption({index:1});
      const titulo=await page.locator('h1').innerText();
      const region=await selector.locator('option:checked').textContent();
      const nombres=await page.locator('table button').evaluateAll(els=>els.filter(e=>e.getClientRects().length).map(e=>{const n=e.cloneNode(true);window.PortalConfig?.limpiarCecosPDF?.(n);return n.textContent.trim();}));
      await page.evaluate(()=>{
        const oculto=document.createElement('p');oculto.className='vista-oculta';oculto.textContent='CONTENIDO_OCULTO_PDF';document.querySelector('main').append(oculto);
        window.html2canvas=()=>{throw new Error('No debe capturar el panel como imagen');};
      });
      async function descargar(boton,nombre){
        const leyendas = ['Programa_Mantencion','Reportabilidad'].includes(panel) ? await page.locator('[data-pdf-leyenda]').evaluateAll(els=>els.filter(e=>e.getClientRects().length).map(e=>{
          const muestra=document.createElement('span');muestra.style.color=e.dataset.pdfColor||getComputedStyle(e).color;document.body.append(muestra);
          const rgb=getComputedStyle(muestra).color.match(/[\d.]+/g).slice(0,3).map(Number);muestra.remove();
          return {nombre:e.dataset.pdfLeyenda,color:'#'+rgb.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('')};
        })) : [];
        const puntosLeyenda=new Map();
        const diasProgramados=panel==='Calendario_Mantencion' ? await page.evaluate(regional=>{
          if(!regional)return document.querySelectorAll('#mt-cal-grid .programado').length;
          const html=informeCalendarioMt(mtSeleccionDescarga(),document.getElementById('mt-mes').value,document.getElementById('mt-region-cal').value,document.getElementById('mt-inicio').value,document.getElementById('mt-fecha').value);
          return new DOMParser().parseFromString(html,'text/html').querySelectorAll('.calendario .programado').length;
        },boton==='#mt-exportar-informe') : null;
        const descarga=page.waitForEvent('download',{timeout:60000});await page.locator(boton).click();
        const archivo=await descarga;assert(archivo.suggestedFilename().endsWith('.pdf'));
        const destino=path.join(salida,nombre+'.pdf');await archivo.saveAs(destino);
        const bytes=fs.readFileSync(destino);const pdf=await PDFDocument.load(bytes);assert(pdf.getPageCount()>0);
        const lectura=await pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise;
        const paginas=[];
        let fondosCalendario=0;
        for(let n=1;n<=lectura.numPages;n++){
          const pg=await lectura.getPage(n);paginas.push((await pg.getTextContent()).items.map(i=>i.str).join(' '));
          if(leyendas.length){
            const ops=await pg.getOperatorList();
            ops.fnArray.forEach((op,i)=>{
              if(op!==pdfjs.OPS.setFillRGBColor)return;
              const args=ops.argsArray[i];
              const hex=typeof args[0]==='string'?args[0]:'#'+Array.from(args).map(n=>n.toString(16).padStart(2,'0')).join('');
              puntosLeyenda.set(hex,(puntosLeyenda.get(hex)||0)+1);
            });
          }
          if(diasProgramados!==null){
            const ops=await pg.getOperatorList();
            ops.fnArray.forEach((op,i)=>{
              if(op!==pdfjs.OPS.setFillRGBColor)return;
              const args=ops.argsArray[i];
              if(args[0]==='#e4f2fc'||Array.from(args).join(',')==='228,242,252')fondosCalendario++;
            });
          }
        }
        if(diasProgramados!==null)assert.equal(fondosCalendario,diasProgramados,'Cada fecha programada conserva el azul claro del portal en el PDF');
        const texto=paginas.join('\n');fs.writeFileSync(path.join(salida,nombre+'.txt'),texto);
        for(const leyenda of leyendas){
          assert(texto.includes(leyenda.nombre),`Conserva el nombre de la leyenda ${leyenda.nombre}`);
          assert(puntosLeyenda.get(leyenda.color)>=leyendas.filter(l=>l.color===leyenda.color).length,`Punto nativo del color ${leyenda.color} para cada serie`);
        }
        assert(paginas[0].includes(titulo),'Título nativo en la primera página');
        assert(paginas[0].includes('Unidad:'),'Unidad escrita como texto');
        assert(paginas[0].includes(region),'Región seleccionada escrita como texto');
        assert(/(referencia|hasta|proyectada|lecturas)/i.test(paginas[0]),'Fecha escrita como texto');
        assert(!texto.includes('CONTENIDO_OCULTO_PDF'),'Respeta vistas ocultas');
        assert(!texto.includes('Consulta sin servidor'),'Sin mensajes del modo de acceso');
        if(panel==='Reportabilidad'){
          assert(!texto.includes('Pasa el mouse'),'El PDF omite las instrucciones interactivas');
          assert(!texto.includes('Ambos gráficos usan marcas'),'El PDF omite el párrafo de ayuda de la página');
          const semanal=paginas.find(t=>t.includes('Cumplimiento semanal por'));
          const barras=paginas.find(t=>t.includes('el color indica su rango de cumplimiento'));
          assert(semanal?.includes('y hasta siete anteriores.'),'La descripción breve acompaña al gráfico semanal');
          assert(barras?.includes('Desde 75 % y menos de 90 %'),'Las barras conservan su leyenda de colores');
          assert(paginas.some(t=>t.includes('Detalle por')&&t.includes('% semana seleccionada')),'El título del detalle acompaña a la tabla');
        }
        for(const n of nombres)assert(texto.replace(/\s+/g,'').includes(n.replace(/[▸▾\s]+/g,'')),`Conserva ${n}`);
        await lectura.destroy();
        console.log(`${nombre}: ${pdf.getPageCount()} páginas con título, filtros y tablas seleccionables`);
      }
      await descargar('#descargar-pdf',panel);
      if(panel==='Calendario_Mantencion')await descargar('#mt-exportar-informe','Calendario_region');
    }
    assert.deepEqual(errores,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
