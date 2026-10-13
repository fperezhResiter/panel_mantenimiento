/* Integración: servidor local activo; PANEL_URL y PLAYWRIGHT_MODULE opcionales. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {PDFDocument} = require('../web/vendor/pdf-lib.min.js');
const salida = path.resolve('tmp/pdf-pruebas');
fs.mkdirSync(salida, {recursive:true});
(async () => {
    const browser = await chromium.launch({headless:true, channel:'msedge'});
    try {
        const page = await browser.newPage({viewport:{width:1440,height:1000}, acceptDownloads:true});
        const errores = [];
        page.on('pageerror', error => errores.push(error.message));
        const paneles = process.env.PDF_PANELES ? process.env.PDF_PANELES.split(',') : ['Reportabilidad','Seguimiento_KM_HR','Resumen_Mantencion','Calendario_Mantencion','Programa_Mantencion','Configuraciones'];
        for (const panel of paneles) {
            await page.goto((process.env.PANEL_URL || 'http://127.0.0.1:8765') + `/Panel_${panel}.html`);
            await page.waitForFunction(() => window.PanelPDF && window.html2canvas);
            // Espera el fin de la consulta inicial, sin modificar la base.
            await page.waitForTimeout(1200);
            const selector = page.locator('form select').first();
            if (await selector.count() && await selector.locator('option').count() > 1) {
                const preferida = await selector.locator('option').evaluateAll(els => els.find(el => /BHP/i.test(el.textContent))?.value);
                await selector.selectOption(preferida || {index:1});
            }
            // Inspecciona la copia congelada que se usa para crear el PDF.
            await page.evaluate(() => {
                const oculto = document.createElement('p');
                oculto.className = 'vista-oculta';
                oculto.textContent = 'CONTENIDO_OCULTO_PDF';
                document.querySelector('main').append(oculto);
                const original = window.html2canvas;
                window.capturasPDF = [];
                window.html2canvas = async (body, opciones) => {
                    if (opciones.height === 1) return original(body, opciones);
                    window.capturasPDF.push({
                        filtros: Array.from(body.querySelectorAll('form input,form select')).map(el => [el.id,el.value]),
                        botones: body.querySelectorAll('button:not(.mt-cal-dia)').length,
                        graficos: body.querySelectorAll('img[src^="data:image/svg"]').length,
                        y: opciones.y, alto: opciones.height,
                        texto: body.innerText,
                        filas: Array.from(body.querySelectorAll('tr')).map(el => ({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom})),
                    });
                    const canvas = await original(body, opciones);
                    if (window.capturasPDF.length === 1) window.pngPDF = canvas.toDataURL('image/png');
                    return canvas;
                };
            });
            const filtros = await page.locator('form input,form select').evaluateAll(els => els.map(el => [el.id,el.value]));
            const nombres = await page.locator('table button').evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => el.textContent.trim()).filter(Boolean));
            const descarga = page.waitForEvent('download', {timeout:120000});
            await page.locator('#descargar-pdf').click();
            const archivo = await descarga;
            assert(archivo.suggestedFilename().endsWith('.pdf'));
            const destino = path.join(salida, `${panel}.pdf`);
            await archivo.saveAs(destino);
            const bytes = fs.readFileSync(destino);
            assert.equal(bytes.subarray(0,5).toString(), '%PDF-');
            const pdf = await PDFDocument.load(bytes);
            assert(pdf.getPageCount() > 0);
            const capturas = await page.evaluate(() => window.capturasPDF);
            assert.deepEqual(capturas[0].filtros, filtros, 'Conserva los valores seleccionados');
            assert.equal(capturas[0].botones, 0);
            assert(!capturas[0].texto.includes('CONTENIDO_OCULTO_PDF'), 'Respeta las vistas ocultas');
            for (const nombre of nombres) assert(capturas[0].texto.includes(nombre), `Conserva el nombre ${nombre} de la tabla`);
            for (let i=1;i<capturas.length;i++) assert.equal(capturas[i].y,capturas[i-1].y+capturas[i-1].alto,'No pierde contenido entre páginas');
            const png = await page.evaluate(() => window.pngPDF);
            fs.writeFileSync(path.join(salida, `${panel}.png`), Buffer.from(png.split(',')[1], 'base64'));
            console.log(`${panel}: ${pdf.getPageCount()} páginas, ${capturas[0].graficos} gráficos, filtros conservados`);
            if (panel === 'Calendario_Mantencion') {
                const boton = page.locator('#mt-exportar-informe');
                assert(await boton.isEnabled());
                await page.evaluate(() => window.capturasPDF = []);
                const download = page.waitForEvent('download',{timeout:120000});
                await boton.click();
                const region = await download;
                assert(region.suggestedFilename().endsWith('.pdf'));
                await region.saveAs(path.join(salida,'Calendario_region.pdf'));
                assert((await PDFDocument.load(fs.readFileSync(path.join(salida,'Calendario_region.pdf')))).getPageCount()>0);
                const regional = await page.evaluate(() => window.capturasPDF);
                const finCalendario = regional[0].filas.slice(0,6).at(-1).bottom;
                assert(regional[0].alto >= finCalendario, 'Calendario mensual completo en la primera página');
                const png = await page.evaluate(() => window.pngPDF);
                fs.writeFileSync(path.join(salida,'Calendario_region.png'),Buffer.from(png.split(',')[1],'base64'));
            }
        }
        assert.deepEqual(errores, []);
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
