// Comprueba preferencias reales, navegación, recarga y sincronización entre pestañas.
const {chromium}=require('C:/Users/fperezh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:"msedge"});
 try{
 const context=await browser.newContext();
 const root=path.resolve(__dirname,'..');
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/')) return route.continue();
  const file=url.pathname==='/'?'web/pages/Panel.html':url.pathname.startsWith('/js/')||url.pathname.startsWith('/css/')?'web'+url.pathname:'web/pages'+url.pathname;
  const target=path.join(root,file);
  if(fs.existsSync(target))return route.fulfill({path:target});
  return route.continue();
 });
 const config=await context.newPage(),errors=[];
 config.on('pageerror',e=>errors.push(e.message));
 await config.goto('http://127.0.0.1:8765/Panel_Configuraciones.html');
 await config.waitForFunction(()=>!document.getElementById('config-recargar').disabled,{timeout:60000});
 assert.equal(await config.locator('#config-vistas input').count(),14);
 await config.getByLabel('Evolución semanal',{exact:true}).uncheck();
 const report=await context.newPage();report.on('pageerror',e=>errors.push(e.message));
 await report.goto('http://127.0.0.1:8765/Panel_Reportabilidad.html');
 assert(await report.locator('[data-vista="reportabilidad.evolucion"]').evaluate(e=>e.classList.contains('vista-oculta')));
 await config.getByLabel('Evolución semanal',{exact:true}).check();
 await report.waitForFunction(()=>!document.querySelector('[data-vista="reportabilidad.evolucion"]').classList.contains('vista-oculta'));
 await config.getByRole('button',{name:'Excluir todas',exact:true}).click();
 for(const file of ['Panel_Reportabilidad.html','Panel_Seguimiento_KM_HR.html','Panel_Resumen_Mantencion.html','Panel_Calendario_Mantencion.html','Panel_Programa_Mantencion.html']){
  await report.goto('http://127.0.0.1:8765/'+file);
  await report.waitForFunction(()=>![...document.querySelectorAll('button.pri')].some(b=>b.disabled),{timeout:60000});
  assert.equal(await report.locator('nav a[aria-current="page"]').count(),1);
  assert.equal(await report.locator('#vista-configuracion,#mt-configuracion,#programa-configuracion').count(),0);
  assert(await report.evaluate(()=>PortalConfig.estado().regiones.length>0));
 }
 await config.reload();
 await config.waitForFunction(()=>!document.getElementById('config-recargar').disabled,{timeout:60000});
 assert.equal(await config.locator('#config-regiones input:checked').count(),0);
 await config.setViewportSize({width:390,height:844});
 assert(await config.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('OK: cinco reportes sin errores JS; configuración, persistencia, sincronización entre pestañas y ancho móvil.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

