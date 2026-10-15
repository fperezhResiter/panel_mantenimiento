/* Agrupación, filtros, totales y retorno a región en HTTP y file://. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const servidor=spawn(process.env.PANEL_PYTHON || 'python',['-B','-u','scripts/reportabilidad.py','--puerto','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    const url=await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>reject(Error('Servidor sin respuesta')),20000);
      servidor.stdout.on('data',d=>{const m=d.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(t);resolve(m[0]);}});
      servidor.on('exit',c=>{clearTimeout(t);reject(Error('Servidor terminó '+c));});
    });
    browser=await chromium.launch({headless:true,channel:'msedge'});
    const page=await browser.newPage({acceptDownloads:true});
    const errores=[]; page.on('pageerror',e=>errores.push(e.message));
    // Las preferencias del navegador se prueban sin escribir la BD del usuario.
    await page.route('**/api/configuracion',r=>r.request().method()==='POST'?r.fulfill({json:{ok:true}}):r.continue());
    await page.addInitScript(()=>localStorage.setItem('resiter.mantenimiento.agrupacion','region'));
    const lista=[['Reportabilidad','#consultar','#total'],['Seguimiento_KM_HR','#km-consultar','#km-detalle tr:not(.km-grupo)'],['Resumen_Mantencion','#mt-consultar','#mt-totales'],['Calendario_Mantencion','#mt-consultar','#mt-agenda'],['Programa_Mantencion','#consultar','#kpis']];
    for(const modo of ['interactivo','sin servidor']) for(const [panel,boton,datos] of lista){
      const ruta='web/pages/Panel_'+panel+'.html';
      await page.goto(modo==='interactivo'?url+'/'+ruta:pathToFileURL(path.join(root,ruta)).href);
      await page.waitForFunction(id=>!document.querySelector(id).disabled,boton);
      if(panel==='Programa_Mantencion') {await page.locator('#mes').fill('2026-09');await page.locator('#mes').dispatchEvent('change');await page.waitForFunction(()=>!document.querySelector('#consultar').disabled);}
      if(panel==='Calendario_Mantencion') {await page.locator('#mt-mes').fill('2026-09');await page.locator('#mt-mes').dispatchEvent('change');}
      const antes=panel==='Seguimiento_KM_HR'?await page.locator(datos).count():await page.locator(datos).textContent();
      assert(await page.locator('header .acciones-cabecera .volver-inicio + #modo-zona').isVisible());
      assert.equal(await page.locator('#modo-agrupacion').count(),0);
      assert.equal(await page.locator('#modo-zona').textContent(),'Modo zona');
      if(panel==='Calendario_Mantencion'){
        const cantidad=await page.locator('#mt-agenda tr:not(.region):visible').count();
        const region=page.locator('#mt-agenda tr.region button').first();
        await region.click();
        assert.equal(await region.getAttribute('aria-expanded'),'false');
        assert(await page.locator('#mt-agenda tr:not(.region):visible').count()<cantidad);
        await region.press('Enter');
        assert.equal(await page.locator('#mt-agenda tr:not(.region):visible').count(),cantidad);
        await page.locator('#mt-cal-alternar-grupos').click();
        assert.equal(await page.locator('#mt-agenda tr:not(.region):visible').count(),0);
        await page.locator('#mt-cal-alternar-grupos').click();
        assert.equal(await page.locator('#mt-agenda tr:not(.region):visible').count(),cantidad);
      }
      if(panel==='Resumen_Mantencion'){
        const region=page.locator('#mt-detalle tr.region button').first();
        const unidades=await page.locator('#mt-detalle tr.mt-ceco:visible').count();
        const totales=await page.locator('#mt-totales').textContent();
        assert(unidades>0);
        await region.click();
        assert.equal(await region.getAttribute('aria-expanded'),'false');
        assert(await page.locator('#mt-detalle tr.mt-ceco:visible').count()<unidades);
        assert.equal(await page.locator('#mt-totales').textContent(),totales);
        await region.press('Enter');
        assert.equal(await page.locator('#mt-detalle tr.mt-ceco:visible').count(),unidades);
        await page.locator('#mt-alternar-grupos').click();
        assert.equal(await page.locator('#mt-detalle tr.mt-ceco:visible').count(),0);
        assert.equal(await page.locator('#mt-alternar-grupos').textContent(),'Expandir todo');
        await page.locator('#mt-alternar-grupos').click();
        assert.equal(await page.locator('#mt-detalle tr.mt-ceco:visible').count(),unidades);
        assert.equal(await page.locator('#mt-alternar-lineas').isVisible(),false);
      }
      await page.locator('#modo-zona').click();
      await page.waitForFunction(id=>!document.querySelector(id).disabled,boton);
      assert.equal(await page.locator('#modo-zona').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#modo-zona').textContent(),'Modo región');
      assert(await page.locator('#zona-linea').isVisible());
      const despues=panel==='Seguimiento_KM_HR'?await page.locator(datos).count():await page.locator(datos).textContent();
      if(panel!=='Calendario_Mantencion')assert.equal(despues,antes,panel+': total conservado');
      assert(await page.locator('tbody').first().textContent().then(t=>/ZONA/.test(t)),panel+': zonas presentes');
      if(panel==='Reportabilidad'){
        assert.equal(await page.locator('tr.zona-linea').count(),0,'Reportabilidad: líneas contraídas por defecto');
        await page.locator('#mostrar-regiones').click();
      }
      if(panel==='Seguimiento_KM_HR'){
        assert.equal(await page.locator('tr.zona-linea').count(),0,'KM-HR: zona y unidad por defecto');
        assert.equal(await page.locator('#km-alternar-lineas').textContent(),'Mostrar por línea');
        await page.locator('#km-alternar-lineas').click();
        assert.equal(await page.locator('#km-alternar-lineas').textContent(),'Ocultar líneas');
        assert.equal(await page.locator('#km-detalle tr:not(.km-grupo)').count(),antes,'KM-HR: sin duplicar equipos');
      }
      if(panel==='Programa_Mantencion'){
        const totales=await page.locator('#totales').textContent();
        assert.equal(await page.locator('#detalle tr.zona-linea').count(),0,'Programa: zona y unidad por defecto');
        await page.locator('#programa-alternar-lineas').click();
        assert.equal(await page.locator('#programa-alternar-lineas').textContent(),'Ocultar líneas');
        assert(await page.locator('#detalle tr.zona-linea:visible').count()>0);
        const zona=page.locator('#detalle tr.region button').first();
        await zona.click();assert.equal(await zona.getAttribute('aria-expanded'),'false');
        await zona.press('Enter');
        const unidad=page.locator('#detalle tr.ceco button').first();
        await unidad.click();assert.equal(await unidad.getAttribute('aria-expanded'),'false');
        await unidad.click();
        await page.locator('#programa-alternar-grupos').click();
        assert.equal(await page.locator('#detalle tr.ceco:visible').count(),0);
        assert.equal(await page.locator('#detalle tr.zona-linea:visible').count(),0);
        await page.locator('#programa-alternar-grupos').click();
        assert.equal(await page.locator('#detalle tr:visible').count(),await page.locator('#detalle tr').count());
        assert.equal(await page.locator('#totales').textContent(),totales);
        await page.locator('#programa-alternar-lineas').click();
        assert.equal(await page.locator('#detalle tr.zona-linea').count(),0);
        await page.locator('#programa-alternar-lineas').click();
        const leyenda=id=>page.locator(`#grafico-${id} .leyenda button`).first();
        assert.equal(await page.locator('#grafico-cumplimiento .config-acciones button,#grafico-cantidades .config-acciones button').count(),0);
        await leyenda('cumplimiento').click(); // Total → zonas.
        await leyenda('cantidades').click(); // Zona → unidades.
        const seleccionUnidad=await leyenda('cumplimiento').textContent();
        await leyenda('cumplimiento').click(); // Unidad → líneas de negocio.
        assert.match(await page.locator('#grafico-cumplimiento strong').textContent(),/Línea de negocio/);
        assert.match(await page.locator('#grafico-cantidades strong').textContent(),/Línea de negocio/);
        assert(await page.locator('#ceco-programa').inputValue());
        assert.equal(await page.locator('#programa-volver').count(),1);
        assert(await page.locator('#programa-volver').isVisible());
        await page.screenshot({path:path.join(root,'tmp/zonas/programa-lineas.png'),fullPage:true});
        await page.locator('#programa-volver').click();
        assert.match(await page.locator('#grafico-cumplimiento strong').textContent(),/Unidad/);
        assert.equal(await page.locator('#ceco-programa').inputValue(),'');
        assert((await page.locator('#grafico-cumplimiento .leyenda').textContent()).includes(seleccionUnidad.replace('━ ','')));
        await page.locator('#programa-volver').click(); // Unidades → zonas.
        await page.locator('#programa-volver').click(); // Zonas → total.
        assert.equal(await page.locator('#programa-volver').isVisible(),false);
        assert.equal(await page.locator('.programa-porcentaje-estado[visibility="visible"]').count(),0);
        assert.equal(await page.locator('.programa-porcentaje-leyenda:visible').count(),0);
        const barra=page.locator('#grafico-estados g').first();
        await barra.locator('rect').last().hover({position:{x:5,y:5}});
        assert.equal(await barra.locator('.programa-porcentaje-estado').getAttribute('visibility'),'visible');
        await page.locator('#titulo-estados').hover();
        assert.equal(await page.locator('.programa-porcentaje-estado[visibility="visible"]').count(),0);
      }
      if(panel==='Resumen_Mantencion'){
        assert.equal(await page.locator('#mt-detalle tr.zona-linea:visible').count(),0,'Resumen: líneas contraídas por defecto');
        const totales=await page.locator('#mt-totales').textContent();
        const unidad=page.locator('#mt-detalle tr.mt-ceco button').first();
        await unidad.click();
        assert.equal(await unidad.getAttribute('aria-expanded'),'true');
        assert(await page.locator('#mt-detalle tr.zona-linea:visible').count()>0);
        const zona=page.locator('#mt-detalle tr.region button').first();
        await zona.click();
        assert.equal(await page.locator('#mt-detalle tr.zona-linea:visible').count(),0);
        await zona.click();
        assert(await page.locator('#mt-detalle tr.zona-linea:visible').count()>0,'Resumen: zona restaura desglose de unidad');
        await unidad.click();
        assert.equal(await page.locator('#mt-detalle tr.zona-linea:visible').count(),0);
        await page.locator('#mt-alternar-grupos').click();
        assert.equal(await page.locator('#mt-detalle tr:visible').count(),await page.locator('#mt-detalle tr').count());
        await page.locator('#mt-alternar-grupos').click();
        assert.equal(await page.locator('#mt-detalle tr.mt-ceco:visible').count(),0);
        assert.equal(await page.locator('#mt-detalle tr.zona-linea:visible').count(),0);
        await page.locator('#mt-alternar-grupos').click();
        await page.locator('#mt-alternar-lineas').click();
        assert.equal(await page.locator('#mt-detalle tr.zona-linea:visible').count(),0);
        assert.equal(await page.locator('#mt-alternar-lineas').textContent(),'Expandir líneas');
        await page.locator('#mt-alternar-lineas').click();
        assert.equal(await page.locator('#mt-detalle tr.zona-linea:visible').count(),await page.locator('#mt-detalle tr.zona-linea').count());
        assert.equal(await page.locator('#mt-totales').textContent(),totales,'Resumen: grupos conservan totales');
      }
      if(panel==='Calendario_Mantencion'){
        const boton=page.locator('#mt-cal-alternar-lineas');
        const patentes=()=>page.locator('#mt-agenda tr:not(.region):not(.mt-agenda-unidad):not(.zona-linea)').allTextContents();
        const originales=await patentes();
        const calendario=await page.locator('#mt-cal-grid').textContent();
        const titulo=await page.locator('#mt-dia-titulo').textContent();
        assert.equal(await page.locator('#mt-agenda tr.zona-linea').count(),0,'Calendario: zona y unidad por defecto');
        assert.equal(await boton.textContent(),'Mostrar por línea');
        await boton.click();
        assert.equal(await boton.textContent(),'Ocultar líneas');
        assert.equal(await boton.getAttribute('aria-pressed'),'true');
        assert(await page.locator('#mt-agenda tr.zona-linea').count()>0);
        assert.deepEqual((await patentes()).sort(),[...originales].sort(),'Calendario: mismos equipos al mostrar líneas');
        assert.equal(await page.locator('#mt-cal-grid').textContent(),calendario);
        assert.equal(await page.locator('#mt-dia-titulo').textContent(),titulo);
        const filasEquipo='#mt-agenda tr:not(.region):not(.mt-agenda-unidad):not(.zona-linea)';
        const cantidad=await page.locator(filasEquipo+':visible').count();
        const linea=page.locator('#mt-agenda tr.zona-linea button').first();
        await linea.click();
        assert.equal(await linea.getAttribute('aria-expanded'),'false');
        const sinLinea=await page.locator(filasEquipo+':visible').count();
        assert(sinLinea<cantidad);
        const unidad=page.locator('#mt-agenda tr.mt-agenda-unidad button').first();
        await unidad.click();
        assert.equal(await unidad.getAttribute('aria-expanded'),'false');
        assert.equal(await linea.isVisible(),false);
        await unidad.click();
        assert.equal(await linea.isVisible(),true);
        assert.equal(await linea.getAttribute('aria-expanded'),'false','Calendario: unidad conserva línea contraída');
        assert.equal(await page.locator(filasEquipo+':visible').count(),sinLinea);
        await linea.click();
        const zona=page.locator('#mt-agenda tr.region button').first();
        await zona.click();
        assert.equal(await unidad.isVisible(),false);
        assert.equal(await linea.isVisible(),false);
        await zona.click();
        assert.equal(await page.locator(filasEquipo+':visible').count(),cantidad);
        await page.locator('#mt-cal-alternar-grupos').click();
        assert.equal(await page.locator(filasEquipo+':visible').count(),0);
        assert.equal(await page.locator('#mt-cal-alternar-grupos').textContent(),'Expandir todo');
        assert.equal(await page.locator('#mt-cal-grid').textContent(),calendario);
        await page.locator('#mt-cal-alternar-grupos').click();
        assert.equal(await page.locator('#mt-agenda tr:visible').count(),await page.locator('#mt-agenda tr').count());
        assert.equal(await page.locator('#mt-dia-titulo').textContent(),titulo);
        await boton.click();
        assert.equal(await page.locator('#mt-agenda tr.zona-linea').count(),0);
        assert.equal(await boton.textContent(),'Mostrar por línea');
        assert.deepEqual(await patentes(),originales,'Calendario: restaura orden dentro de la unidad');
        const dia=page.locator('#mt-cal-grid .programado').first();
        await dia.click();
        const tituloDia=await page.locator('#mt-dia-titulo').textContent();
        const patentesDia=await patentes();
        await boton.click();
        assert.equal(await page.locator('#mt-dia-titulo').textContent(),tituloDia,'Calendario: conserva día seleccionado');
        assert.deepEqual((await patentes()).sort(),patentesDia.sort());
        await page.locator('#mt-todo-mes').click();
        assert.equal(await boton.textContent(),'Ocultar líneas','Calendario: conserva preferencia al volver al mes');
      }
      assert(await page.locator('tr.zona-linea').count()>0,panel+': desglose de líneas');
      const region=page.locator('#region,#km-region,#mt-region-resumen,#mt-region-cal,#region-programa');
      const primera=await region.locator('option').evaluateAll(os=>os.find(o=>o.value&&o.value!=='SIN ZONA')?.value);
      await region.selectOption(primera);
      const opciones=await page.locator('#zona-linea option').evaluateAll(os=>os.filter(o=>o.value).map(o=>o.value));
      const filtro=opciones.find(l=>l==='RESIDUOS')||opciones[0];
      await page.locator('#zona-linea').selectOption(filtro);
      await page.waitForFunction(id=>!document.querySelector(id).disabled,boton);
      if(panel==='Reportabilidad')await page.locator('#mostrar-regiones').click();
      const nombres=await page.locator('tr.zona-linea').allTextContents();
      assert(nombres.filter(t=>t.includes('Línea:')).every(t=>t.includes(filtro)),panel+': filtro de línea');
      assert.equal(await region.inputValue(),primera,panel+': línea conserva la zona seleccionada');
      const csvId={Reportabilidad:'#exportar',Seguimiento_KM_HR:'#km-exportar',Resumen_Mantencion:'#mt-exportar-resumen',Calendario_Mantencion:'#mt-exportar-calendario'}[panel];
      if(csvId) {
        const descarga=page.waitForEvent('download'); await page.locator(csvId).click();
        const archivo=await descarga, destino=path.join(root,'tmp/zonas',panel+'.csv');
        await archivo.saveAs(destino);
        const csv=fs.readFileSync(destino,'utf8');
        assert(csv.split('\n')[0].includes('"Zona"')&&csv.split('\n')[0].includes('"Línea de negocio"'),panel+': columnas de CSV');
      }
      if(panel==='Reportabilidad'&&modo==='sin servidor') {
        const descarga=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();
        const archivo=await descarga;await archivo.saveAs(path.join(root,'tmp/zonas/Reportabilidad.pdf'));
      }
      if(panel==='Seguimiento_KM_HR') {
        await page.locator('#km-alternar-grupos').click();await page.locator('#km-alternar-grupos').click();
        await page.locator('#km-alternar-lineas').click();
        assert.equal(await page.locator('tr.zona-linea').count(),0,'KM-HR: ocultar vuelve a zona y unidad');
      }
      if(panel==='Resumen_Mantencion'&&modo==='sin servidor') {fs.mkdirSync(path.join(root,'tmp/zonas'),{recursive:true});await page.screenshot({path:path.join(root,'tmp/zonas/resumen.png'),fullPage:true});}
      await page.locator('#modo-zona').click();
      await page.waitForFunction(id=>!document.querySelector(id).disabled,boton);
      assert.equal(await page.locator('#modo-zona').getAttribute('aria-pressed'),'false');
      assert.equal(await page.locator('#modo-zona').textContent(),'Modo zona');
      assert(!(await page.locator('#zona-linea').isVisible()));
      if(panel==='Calendario_Mantencion')assert.equal(await page.locator('#mt-cal-alternar-lineas').isVisible(),false);
      const restaurado=panel==='Seguimiento_KM_HR'?await page.locator(datos).count():await page.locator(datos).textContent();
      if(panel!=='Calendario_Mantencion')assert.equal(restaurado,antes,panel+': retorno a región');
      console.log('OK '+modo+' '+panel+': totales, zonas, líneas, filtros y retorno');
    }
    assert.deepEqual(errores,[]);
  } finally {if(browser)await browser.close();servidor.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
