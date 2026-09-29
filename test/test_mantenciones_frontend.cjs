process.chdir(require('path').resolve(__dirname, '..'));
const assert=require('assert'),fs=require('fs'),vm=require('vm');
class Elemento{constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.value='';this.textContent='';}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;this.textContent='';}setAttribute(k,v){this.attrs[k]=v;}add(v){this.children.push(v);}focus(){}click(){}get options(){return this.children;}}
const eq=(p,r,c,s,f,operacion='OPERATIVO')=>({patente:p,region:r,ceco:c,unidad:'KM',estado_equipo:operacion,fecha_estado_equipo:'2026-09-22',calculo:{estado:s,fecha_proyectada:f,proxima:10000,motivo:'',fecha_lectura:'2026-09-22',ritmo_diario:20}});
const datos={version:2,incluye_estado_equipo:true,inicio:'2026-09-01',fecha:'2026-09-22',semanas:[{fecha:'2026-09-22'}],advertencias:[],equipos:[eq('A','R1','C1','Mantención Vencida','2026-09-01'),eq('B','R1','C1','Mantención Vigente','2026-09-30'),eq('C','R2','C2','Próxima a vencer','2026-10-01'),eq('D','R2','C2','REVISAR',null)]};
async function probar(panel,archivo){
 const elementos=new Map([...fs.readFileSync(archivo,'utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Elemento()]));
 let blobDescargado=null;
 const doc={body:{dataset:{panel}},getElementById:id=>elementos.get(id)||null,createElement:t=>new Elemento(t),createTextNode:t=>t};
 const ctx={document:doc,location:{protocol:'http:'},localStorage:{getItem:()=>null,setItem(){}},URLSearchParams,Blob,
  URL:{createObjectURL:b=>{blobDescargado=b;return 'blob:prueba';},revokeObjectURL(){}},
  Option:function(t,v){this.textContent=t;this.value=v;},fetch:async()=>({ok:true,status:200,json:async()=>datos})};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/js/calendario_descarga.js','utf8'),ctx);vm.runInContext(fs.readFileSync('web/js/mantenciones.js','utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 assert(elementos.get('mt-mensaje').textContent.startsWith('Consulta completada.'),elementos.get('mt-mensaje').textContent);
 if(panel==='resumen'){
  assert(!elementos.has('mt-calendario'));assert.equal(elementos.get('mt-detalle').children.length,4);
  elementos.get('mt-exportar-resumen').onclick();assert((await blobDescargado.text()).includes('Subtotal región'));
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
 const region=elementos.get('mt-regiones-config').children[0].children[0];region.checked=false;region.onchange();
 if(panel==='resumen')assert.equal(elementos.get('mt-detalle').children.length,2);
 else assert.equal(elementos.get('mt-cal-grid').children.filter(e=>e.className?.includes('programado')).length,0);
 elementos.get('mt-excluir').onclick();
}
(async()=>{await probar('resumen','web/pages/Panel_Resumen_Mantencion.html');await probar('calendario','web/pages/Panel_Calendario_Mantencion.html');console.log('OK: páginas independientes, filtros y descargas completas por región.');})().catch(e=>{console.error(e);process.exitCode=1;});
