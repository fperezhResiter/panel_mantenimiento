process.chdir(require('path').resolve(__dirname, '..'));
const assert=require('assert'),fs=require('fs'),vm=require('vm');
class Elemento{constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.value='';this.textContent='';}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;this.textContent='';}setAttribute(k,v){this.attrs[k]=v;}add(v){this.children.push(v);}focus(){}click(){}get options(){return this.children;}}
const eq=(p,r,c,s,f,operacion='OPERATIVO')=>({patente:p,region:r,ceco:c,unidad:'KM',estado_equipo:operacion,fecha_estado_equipo:'2026-09-22',calculo:{estado:s,fecha_proyectada:f,proxima:10000,motivo:'',fecha_lectura:'2026-09-22',ritmo_diario:20}});
const datos={version:2,incluye_estado_equipo:true,inicio:'2026-09-01',fecha:'2026-09-22',semanas:[{fecha:'2026-09-22'}],advertencias:[],equipos:[eq('A','R1','C1','Mantención Vencida','2026-09-01'),eq('B','R1','C1','Mantención Vigente','2026-09-30'),eq('C','R2','C2','Próxima a vencer','2026-10-01'),eq('D','R2','C2','REVISAR',null)]};
async function probar(panel,archivo){
 const elementos=new Map([...fs.readFileSync(archivo,'utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Elemento()]));
 let blobDescargado=null;const consultas=[];
 const doc={body:{dataset:{panel}},getElementById:id=>elementos.get(id)||null,createElement:t=>new Elemento(t),createTextNode:t=>t};
 const ctx={document:doc,location:{protocol:'http:'},localStorage:{getItem:()=>JSON.stringify({standby:['OPERATIVO']}),setItem(){}},URLSearchParams,Blob,
  URL:{createObjectURL:b=>{blobDescargado=b;return 'blob:prueba';},revokeObjectURL(){}},
  Option:function(t,v){this.textContent=t;this.value=v;},fetch:async url=>{consultas.push(url);return {ok:true,status:200,json:async()=>datos};}};
 vm.createContext(ctx);require("./config_context.cjs")(ctx);vm.runInContext(fs.readFileSync('web/js/calendario_descarga.js','utf8'),ctx);vm.runInContext(fs.readFileSync('web/js/mantenciones.js','utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 assert(elementos.get('mt-mensaje').textContent.startsWith('Consulta completada.'),elementos.get('mt-mensaje').textContent);
 if(panel==='resumen'){
  assert(!elementos.has('mt-standby-config'));assert.equal(elementos.get('mt-kpis').children.length,4);assert.equal(elementos.get('mt-kpis').children[3].children[0].textContent,'1');assert(!elementos.has('mt-calendario'));assert.equal(elementos.get('mt-detalle').children.length,4);
  elementos.get('mt-exportar-resumen').onclick();assert((await blobDescargado.text()).includes('Subtotal región'));
  const hoy=new Date(),mesActual=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  assert.equal(elementos.get('mt-mes-resumen').value,mesActual);
  const regionFiltro=elementos.get('mt-region-resumen'),cecoFiltro=elementos.get('mt-ceco-resumen');
  regionFiltro.value='R1';regionFiltro.onchange();
  assert.equal(elementos.get('mt-patentes').children.length,2);
  assert.deepEqual(cecoFiltro.children.map(o=>o.value),['','C1']);
  elementos.get('mt-exportar-resumen').onclick();const filtrado=await blobDescargado.text();assert(filtrado.includes('R1'));assert(!filtrado.includes('R2'));
  regionFiltro.value='';regionFiltro.onchange();cecoFiltro.value='C2';cecoFiltro.onchange();
  assert.equal(elementos.get('mt-patentes').children.length,2);
  assert(elementos.get('mt-patentes').children.every(f=>f.children[2].textContent==='C2'));
  regionFiltro.value='R1';regionFiltro.onchange();assert.equal(cecoFiltro.value,'');
  regionFiltro.value='';regionFiltro.onchange();
  for(const [mes,inicio,fecha] of [['2026-08','2026-08-04','2026-08-31'],['2026-09','2026-09-01','2026-09-30'],['2026-10','2026-10-01','2026-10-31']]){
   elementos.get('mt-mes-resumen').value=mes;await elementos.get('mt-mes-resumen').onchange();
   const q=new URLSearchParams(consultas.at(-1).split('?')[1]);assert.equal(q.get('inicio'),inicio);assert.equal(q.get('fecha'),fecha);
  }
  elementos.get('mt-mes-resumen').value='';await elementos.get('mt-mes-resumen').onchange();
  assert(elementos.get('mt-exportar-resumen').disabled);assert.equal(elementos.get('mt-patentes').children.length,0);
  elementos.get('mt-mes-resumen').value='2026-09';await elementos.get('mt-mes-resumen').onchange();
 }else{
  assert(!elementos.has('mt-resumen'));
  elementos.get('mt-mes').value='2026-09';elementos.get('mt-mes').onchange();
  assert(elementos.get('mt-exportar-informe').disabled);
  elementos.get('mt-region-cal').value='R1';elementos.get('mt-region-cal').onchange();
  assert.equal(elementos.get('mt-exportar-informe').disabled,false);
  const dias=elementos.get('mt-cal-grid').children.filter(e=>e.tag==='button');assert.equal(dias.length,30);
  const destacados=dias.filter(e=>e.className.includes('programado'));assert.equal(destacados.length,2);
  destacados[0].onclick();assert(elementos.get('mt-dia-titulo').textContent.includes('1 patentes'));
  elementos.get('mt-exportar-informe').onclick();const html=await blobDescargado.text();assert(html.includes('<td>B</td>'));assert(!html.includes('<td>C</td>'));assert(html.includes('calendario')); // Exporta todo el mes, no solo el día.
  elementos.get('mt-exportar-calendario').onclick();assert((await blobDescargado.text()).includes('2026-09-30'));
 }
 ctx.PortalConfig.seleccionar('regiones','R1',false);
 if(panel==='resumen')assert.equal(elementos.get('mt-detalle').children.length,2);
 else assert.equal(elementos.get('mt-cal-grid').children.filter(e=>e.className?.includes('programado')).length,0);
 ctx.PortalConfig.regionesTodas(false);
}
(async()=>{await probar('resumen','web/pages/Panel_Resumen_Mantencion.html');await probar('calendario','web/pages/Panel_Calendario_Mantencion.html');console.log('OK: páginas independientes, filtros y descargas completas por región.');})().catch(e=>{console.error(e);process.exitCode=1;});

async function probarReportabilidad(){
 const elementos=new Map([...fs.readFileSync('web/pages/Panel_Reportabilidad.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Elemento()]));
 const elemento=t=>{const e=new Elemento(t);e.style={};return e;};
 const ceco=(ceco,total,historico)=>({ceco,total,historico,historico_completo:[0,0,0,0,...historico],reportadas:historico.at(-1),fuera_maestro:0});
 const datos={version_reporte:2,semana:8,fecha:'2026-09-22',inicio:'2026-09-21',fin:'2026-09-25',reportadas:2,total:5,filas_fuente:10,advertencias:[],fuente:'Excel',hoja:'Sheet1',actualizado:'2026-09-22T10:00',
  semanas:[1,8,15,22].map((dia,i)=>({numero:i+5,fecha:`2026-09-${String(dia).padStart(2,'0')}`})),
  regiones:[{region:'REGION A',cecos:[ceco('A1',2,[0,1,2,1]),ceco('A2',1,[1,1,0,1])]},{region:'REGION B',cecos:[ceco('B1',2,[2,0,0,0]),ceco('SIN BASE',0,[1,1,1,0])]}]};
 datos.semanas_completas=[4,11,18,25].map((dia,i)=>({numero:i+1,fecha:`2026-08-${String(dia).padStart(2,'0')}`})).concat(datos.semanas);
 let blob,consulta;
 class FechaLunes extends Date{constructor(...args){super(...(args.length?args:[2026,8,28,12]));}}
 const ctx={Date:FechaLunes,document:{getElementById:id=>elementos.get(id),createElement:elemento,createElementNS:(_,t)=>elemento(t),createTextNode:t=>t},localStorage:{getItem:()=>null,setItem(){}},location:{protocol:'http:'},Option:function(t,v){this.textContent=t;this.value=v;},Blob,
  URL:{createObjectURL:b=>{blob=b;return 'blob:reporte';},revokeObjectURL(){}},fetch:async url=>{consulta=url;return {ok:true,json:async()=>datos};}};
 vm.createContext(ctx);require("./config_context.cjs")(ctx);vm.runInContext(fs.readFileSync('web/js/reportabilidad.js','utf8'),ctx);await new Promise(resolve=>setImmediate(resolve));
 assert(consulta.endsWith('2026-09-29'),'El lunes abre el martes de la semana actual');
 assert.equal(elementos.get('estado').textContent,'Consulta completada.');
 assert.equal(elementos.get('cabecera').children[0].children.length,8);
 assert.equal(elementos.get('reporte-leyenda').children.length,2);
 assert.equal(elementos.get('reporte-grafico').children[0].children.filter(e=>e.tag==='circle').length,16);
 assert.equal(elementos.get('reporte-barras').children[0].children.filter(e=>e.tag==='rect').length,2);
 assert(elementos.get('reporte-barras-titulo').textContent.includes('por región'));
 assert(elementos.get('reporte-barras').children[0].children.some(e=>e.textContent==='66,7 %'));
 assert.equal(elementos.get('reporte-grafico').children[0].style.width,undefined);
 assert.equal(elementos.get('detalle').children[0].children.at(-1).textContent,'58,3 %');
 const barrasIniciales=elementos.get('reporte-barras').children[0].children.filter(e=>e.tag==='rect');
 barrasIniciales[0].onmouseenter();
 assert.equal(barrasIniciales[1].style.opacity,'0.15');
 assert.equal(elementos.get('reporte-leyenda').children[1].style.opacity,'0.15');
 barrasIniciales[0].onmouseleave();assert.equal(barrasIniciales[1].style.opacity,'1');
 const linea=elementos.get('reporte-grafico').children[0].children.find(e=>e.tag==='line'&&e.onclick);
 linea.onclick();assert.equal(barrasIniciales[1].style.opacity,'0.15');
 linea.onclick();assert.equal(barrasIniciales[1].style.opacity,'1');
 elementos.get('detalle').children[0].children[0].children[0].onclick();
 assert.equal(elementos.get('region').value,'REGION A');
 elementos.get('detalle').children[1].children[0].children[0].onclick();
 assert.equal(elementos.get('region').value,'REGION A');
 assert.equal(elementos.get('reporte-leyenda').children[0].style.opacity,'1');
 assert.equal(elementos.get('reporte-leyenda').children[1].style.opacity,'0.15');
 const barrasCeco=elementos.get('reporte-barras').children[0].children.filter(e=>e.tag==='rect');
 assert.equal(barrasCeco[1].style.opacity,'0.15');
 barrasCeco[1].onmouseenter();assert.equal(barrasCeco[0].style.opacity,'0.15');
 barrasCeco[1].onmouseleave();assert.equal(barrasCeco[0].style.opacity,'1');assert.equal(barrasCeco[1].style.opacity,'0.15');
 elementos.get('buscar').value='A1';elementos.get('buscar').oninput();
 elementos.get('expandir').onclick();elementos.get('mostrar-regiones').onclick();
 assert.equal(elementos.get('region').value,'');assert.equal(elementos.get('buscar').value,'');
 assert.equal(elementos.get('detalle').children.length,6);
 assert.equal(elementos.get('reporte-leyenda').children.length,2);
 assert(elementos.get('reporte-leyenda').children.every(e=>e.style.opacity==='1'));
 assert(elementos.get('reporte-barras-titulo').textContent.includes('por región'));
 assert.equal(elementos.get('expandir').textContent,'Contraer regiones');
 assert.equal(vm.runInContext('promedioCumplimiento([0,100,null,50])',ctx),50);
 elementos.get('region').value='REGION A';elementos.get('region').onchange();
 assert(elementos.get('reporte-grafico-titulo').textContent.includes('por CeCo'));
 assert.deepEqual(elementos.get('reporte-leyenda').children.map(e=>e.textContent),['━ A1','━ A2']);
 assert.equal(elementos.get('reporte-barras').children[0].children.filter(e=>e.tag==='rect').length,2);
 elementos.get('buscar').value='A1';elementos.get('buscar').oninput();
 assert.equal(elementos.get('reporte-leyenda').children.length,1);
 assert.equal(elementos.get('reporte-barras').children[0].children.filter(e=>e.tag==='rect').length,1);
 assert.equal(elementos.get('pie').children[0].children.at(-1).textContent,'50 %');
 elementos.get('exportar').onclick();const csv=await blob.text();assert(csv.includes('Promedio 4 semanas'));assert(csv.includes('S5 2026-09-01'));assert(!csv.includes('A2'));
 elementos.get('buscar').value='INEXISTENTE';elementos.get('buscar').oninput();assert(elementos.get('reporte-grafico').textContent.includes('No hay datos'));assert.equal(elementos.get('pie').children[0].children.at(-1).textContent,'—');
 elementos.get('buscar').value='';elementos.get('region').value='';elementos.get('region').onchange();
 vm.runInContext("reporte.semanas_completas.push({numero:9,fecha:'2026-09-29'},{numero:10,fecha:'2026-10-06'});reporte.regiones.forEach(r=>r.cecos.forEach(c=>c.historico_completo.push(0,c.total*1.5)));render();",ctx);
 const grafico=elementos.get('reporte-grafico').children[0];
 assert.equal(grafico.children.filter(e=>e.tag==='circle').length,16);
 assert(grafico.children.some(e=>e.textContent==='S3'));assert(grafico.children.some(e=>e.textContent==='S10'));assert(!grafico.children.some(e=>e.textContent==='S1'));
 for(const valor of ['0 %','50 %','100 %','150 %'])assert(grafico.children.some(e=>e.textContent===valor));
 assert(grafico.children.some(e=>e.textContent==='75 %'));
 assert(grafico.children.some(e=>e.textContent==='25 %'));
 ctx.PortalConfig.regionesTodas(false);assert.equal(elementos.get('reporte-leyenda').children.length,0);
 console.log('OK: Reportabilidad, martes actual, histórico, promedio, gráfico región/CeCo, filtros y CSV.');
}
probarReportabilidad().catch(e=>{console.error(e);process.exitCode=1;});

