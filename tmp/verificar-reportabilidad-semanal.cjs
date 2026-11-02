const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
(async()=>{
 let servidor,urlBase=process.env.PANEL_URL;
 if(process.env.PRUEBA_SERVIDOR){
  servidor=spawn('python',['-B','-u','scripts/reportabilidad.py','--puerto','0'],{stdio:['ignore','pipe','pipe']});
  urlBase=await new Promise((resolve,reject)=>{const plazo=setTimeout(()=>reject(new Error('El servidor no inició')),20000);servidor.stdout.on('data',b=>{const url=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url){clearTimeout(plazo);resolve(url);}});servidor.on('error',reject);});
 }
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1480,height:1100},acceptDownloads:true});
  const errores=[];page.on('pageerror',e=>errores.push(e.message));
  await page.goto(urlBase ? urlBase+'/Panel_Reportabilidad.html' : pathToFileURL(path.resolve('web/pages/Panel_Reportabilidad.html')).href);
  await page.waitForFunction(()=>!document.querySelector('#resultados').hidden&&!document.querySelector('#consultar').disabled);
  const estado=()=>page.evaluate(()=>({semanas:reporte.semanas_completas.length,entidades:seriesGraficos().series.length,nivel:seriesGraficos().nivel,barras:document.querySelectorAll('#reporte-semanal [data-entidad]').length,ancho:document.documentElement.scrollWidth,ventana:innerWidth}));
  let vista=await estado();assert.equal(vista.barras,vista.semanas*vista.entidades);assert(vista.semanas>8);assert(vista.ancho<=vista.ventana);
  await page.waitForFunction(()=>{const e=document.querySelector('#reporte-semanal');return Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth))<=1;});
  const superiores=await page.locator('#reporte-grafico svg,#reporte-barras svg').evaluateAll(es=>es.map(e=>({viewBox:e.getAttribute('viewBox'),ancho:e.getBoundingClientRect().width,alto:e.getBoundingClientRect().height,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,scroll:e.parentElement.scrollWidth,visible:e.parentElement.clientWidth})));
  assert(superiores.every(e=>e.viewBox==='0 0 640 360'&&e.scroll<=e.visible+1));assert(Math.abs(superiores[0].alto-superiores[1].alto)<1);
  assert(superiores.every(e=>e.ancho>650&&e.ancho<740),'Cada gráfico ocupa la mitad del ancho disponible');
  assert(Math.abs(superiores[0].y-superiores[1].y)<1,'Los dos gráficos comparten la misma fila');
  assert(Math.abs(superiores[1].x-superiores[0].x-superiores[0].ancho-16)<1,'La pareja cubre la fila sin columnas vacías');
  await page.setViewportSize({width:1920,height:1080});
  const pareja=await page.locator('[data-vista="reportabilidad.evolucion"],[data-vista="reportabilidad.barras"]').evaluateAll(es=>{const rs=es.map(e=>e.getBoundingClientRect());return {x:rs[0].x,y:rs[0].y,width:rs[1].right-rs[0].left,height:Math.max(...rs.map(r=>r.bottom))-rs[0].top};});
  assert(pareja.width>1800,'La pareja usa el ancho completo también en una pantalla grande');
  await page.screenshot({path:'tmp/reportabilidad-graficos-horizontales.png',clip:pareja});
  await page.setViewportSize({width:1480,height:1100});
  await page.locator('#reporte-semanal').evaluate(e=>{e.scrollLeft=e.scrollWidth-e.clientWidth;});
  assert.equal(await page.locator('#reporte-semanal [data-porcentaje]').count(),vista.barras);
  assert.equal(await page.locator('#reporte-semanal title,#reporte-grafico title,#reporte-barras rect[data-entidad] title').count(),0,'Solo aparece el resumen flotante, sin tooltip nativo duplicado');
  const separacion=await page.locator('#reporte-semanal rect[data-entidad]').evaluateAll(es=>{const semana=es[0].dataset.semana,bs=es.filter(e=>e.dataset.semana===semana);return bs.length>1?Number(bs[1].getAttribute('x'))-Number(bs[0].getAttribute('x'))-Number(bs[0].getAttribute('width')):null;});
  if(separacion!==null)assert(separacion>0&&separacion<=4,'Las barras de cada semana quedan juntas');
  await page.locator('.reporte-semanal-figura').screenshot({path:'tmp/reportabilidad-semanal-escritorio.png'});
  const comprobarRango=async(rango)=>{
   const resultados=await page.locator('#reporte-semanal rect[data-entidad],#reporte-barras rect[data-entidad],#reporte-grafico circle[data-entidad]').evaluateAll((els,rango)=>els.every(e=>{const v=e.dataset.valor,clase=v===''?'neutro':Number(v)>=90?'verde':Number(v)>=75?'amarillo':'rojo';return e.style.opacity===(clase===rango?'1':'0.15');}),rango);
   assert(resultados,'Cada marca usa su propio porcentaje para destacar el rango '+rango);
  };
  for(const rango of ['rojo','amarillo','verde','neutro']){
   await page.locator('.reporte-rangos-leyenda [data-reporte-rango="'+rango+'"]').hover();await comprobarRango(rango);
  }
  await page.mouse.move(1,1);
  await page.locator('#reporte-semanal').scrollIntoViewIfNeeded();
  const puntoFranja=await page.evaluate(()=>{const e=document.querySelector('#reporte-semanal rect[data-entidad][data-semana="'+reporte.semana+'"]'),r=e.getBoundingClientRect(),b=document.querySelector('#reporte-semanal [data-rango="amarillo"]').getBoundingClientRect();return {x:r.left-10,y:b.top+b.height/2};});
  await page.mouse.move(puntoFranja.x,puntoFranja.y);await comprobarRango('amarillo');
  await page.locator('.reporte-semanal-figura').screenshot({path:'tmp/reportabilidad-semanal-rango.png'});
  await page.mouse.move(1,1);
  const reciente=page.locator('#reporte-semanal rect[data-entidad]').last();await reciente.hover();
  assert(await page.locator('#reporte-tooltip').isVisible());assert((await page.locator('#reporte-tooltip').innerText()).includes('Patentes reportadas:'));assert((await page.locator('#reporte-tooltip').innerText()).includes('Total patentes:'));
  await page.screenshot({path:'tmp/reportabilidad-semanal-resumen.png'});
  const barra=page.locator('#reporte-semanal rect[data-entidad]').first();
  await barra.hover();assert(!(await page.locator('#reporte-semanal-detalle').innerText()).includes('Pasa el mouse'));
  const hover=await page.locator('#reporte-semanal rect[data-entidad]').evaluateAll(els=>els.filter(e=>e.style.opacity==='1').length);assert.equal(hover,1);
  await page.mouse.move(1,1);
  await barra.press('Enter');vista=await estado();assert.equal(vista.nivel,'unidad');assert.equal(vista.barras,vista.semanas*vista.entidades);
  await page.locator('#reporte-volver').click();
  await page.locator('#modo-zona').click();
  await page.waitForFunction(()=>PortalZona.activa()&&!document.querySelector('#resultados').hidden&&!document.querySelector('#consultar').disabled);
  await page.locator('#reporte-semanal rect[data-entidad]').first().press('Enter');
  await page.locator('#reporte-semanal rect[data-entidad]').first().press('Enter');
  vista=await estado();assert.equal(vista.nivel,'linea');assert.equal(vista.barras,vista.semanas*vista.entidades);
  await page.locator('.reporte-semanal-figura').screenshot({path:'tmp/reportabilidad-semanal-lineas.png'});
  await page.locator('#reporte-volver').click();await page.locator('#reporte-volver').click();
  await page.setViewportSize({width:390,height:844});
  vista=await estado();assert(vista.ancho<=vista.ventana,'No se desplaza horizontalmente la página');
  const scroll=await page.locator('#reporte-semanal').evaluate(e=>({interior:e.scrollWidth,visible:e.clientWidth}));assert(scroll.interior>scroll.visible);
  await page.locator('#consultar').click();await page.waitForFunction(()=>!document.querySelector('#resultados').hidden&&!document.querySelector('#consultar').disabled);
  await page.waitForFunction(()=>{const e=document.querySelector('#reporte-semanal');return Math.abs(e.scrollLeft-(e.scrollWidth-e.clientWidth))<=1;});
  await page.locator('.reporte-semanal-figura').screenshot({path:'tmp/reportabilidad-semanal-movil.png'});
  await page.setViewportSize({width:1480,height:1100});
  await page.evaluate(()=>document.documentElement.setAttribute('data-tema','oscuro'));
  await page.locator('.reporte-semanal-figura').screenshot({path:'tmp/reportabilidad-semanal-oscuro.png'});
  const descarga=page.waitForEvent('download',{timeout:60000});await page.locator('#descargar-pdf').click();
  await (await descarga).saveAs('tmp/reportabilidad-semanal.pdf');
  assert.deepEqual(errores,[]);console.log(JSON.stringify({modo:urlBase?'servidor':'file',...vista,scroll,errores}));
 }finally{await browser.close();servidor?.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
