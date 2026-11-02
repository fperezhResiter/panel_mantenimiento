/* Agrupación compartida con datos controlados, sin navegador ni escrituras. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Elemento {
  constructor() { this.children = []; this.dataset = {}; this.value = ''; }
  append(...nodos) { for (const nodo of nodos) { nodo.parentElement = this; this.children.push(nodo); } }
  add(nodo) { this.append(nodo); }
  replaceChildren(...nodos) { this.children = []; this.append(...nodos); }
  after() {}
  closest() { return null; }
  querySelector() { return null; }
  setAttribute() {}
}
const formulario = new Elemento();
const document = {
  body: {dataset:{panel:'reportabilidad'}},
  querySelector: selector => selector === 'form.filtros' ? formulario : null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => new Elemento(),
  createTextNode: texto => ({nodeValue:texto}),
  createTreeWalker: () => ({nextNode:()=>false}),
  addEventListener() {}
};
const configuracion = {
  zonas:['ZONA 4A'], catalogo_zonas:['ZONA 4A','ZONA 4B','ZONA 8A','ZONA 8B'],
  unidades_zonas:['["ZONA 4A","UNIDAD"]','["ZONA 4B","UNIDAD"]']
};
let fuente;
const contexto = vm.createContext({
  document, Event, NodeFilter:{SHOW_TEXT:4},
  MutationObserver:class { observe() {} disconnect() {} },
  Option:function(texto,valor) { this.textContent=texto; this.value=valor; },
  localStorage:{getItem:k=>k==='resiter.mantenimiento.agrupacion'?'zona':null,setItem(){}},
  addEventListener() {}, dispatchEvent() {},
  fetch:async()=>({ok:true,json:async()=>structuredClone(configuracion)}),
  PortalDatos:{consulta:false,consultar:async()=>({ok:true,status:200,json:async()=>structuredClone(fuente)})}
});
contexto.window = contexto;
const cargar = nombre => vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',nombre),'utf8'),contexto);
const consultar = async (ruta='/api/reporte') => JSON.parse(JSON.stringify(await (await contexto.PortalDatos.consultar(ruta+'?fecha=2026-09-29')).json()));

(async()=>{
  cargar('configuracion.js');
  await contexto.PortalConfig.listo;
  const config = contexto.PortalConfig;
  assert.deepEqual(JSON.parse(JSON.stringify(config.estado().catalogo_zonas)),['ZONA 4','ZONA 8']);
  assert.equal(config.estado().unidades_zonas.length,1,'relaciones de la misma unidad consolidadas');
  assert.equal(config.zonaIncluida('ZONA 4A'),false,'conserva exclusión anterior');
  assert.equal(config.zonaIncluida('ZONA 4B'),true);
  config.seleccionar('zonas','ZONA 4',true);
  cargar('zonas.js');
  const fila = (zona,reportadas,total) => ({region:zona,cecos:[{ceco:JSON.stringify([zona,'UNIDAD','RESIDUOS']),reportadas,reportadas_totales:reportadas+1,total,historico:[reportadas,0],historico_completo:[0,reportadas,0],historico_reportadas:[reportadas+1,0],historico_completo_reportadas:[0,reportadas+1,0]}]});
  fuente = {regiones:[{region:'REGION PRUEBA',cecos:[{ceco:'UNIDAD'}]}],detalle_zona:[fila('ZONA 4A',1,2),fila('ZONA 4B',6,8),fila('ZONA 8A',2,4),fila('ZONA 8B',1,6)]};
  let vista = await consultar();
  assert.deepEqual(vista.regiones.map(r=>r.region),['ZONA 4','ZONA 8']);
  assert.equal(vista.total,20);
  assert.equal(vista.reportadas,10);
  assert.equal(vista.regiones[0].porcentaje,70,'porcentaje desde cantidades agregadas');
  assert.equal(vista.regiones[0].cecos.length,1,'una sola unidad aunque exista en ambas subzonas');
  const linea = vista.regiones[0].cecos[0].lineas;
  assert.equal(linea.length,1,'una sola fila por línea');
  assert.deepEqual(linea[0].historico,[7,0]);
  assert.deepEqual(linea[0].historico_completo,[0,7,0]);
  assert.equal(vista.reportadas_totales,14,'Suma de reportabilidad total entre zonas');
  assert.deepEqual(linea[0].historico_completo_reportadas,[0,9,0]);
  assert.deepEqual(await consultar('/api/reporte-efectivo'),vista,'Reportabilidad efectiva usa la misma agrupación zonal');
  config.seleccionar('zonas','ZONA 4',false);
  vista = await consultar();
  assert.deepEqual(vista.regiones.map(r=>r.region),['ZONA 8'],'excluir zona agrupada excluye ambas partes');
  config.seleccionar('zonas','ZONA 4',true);
  fuente = {equipos:['ZONA 4A','ZONA 4B','ZONA 8A','ZONA 8B','ZONA 5','SIN ZONA'].map((zona,i)=>({zona,region:'REGION PRUEBA',ceco:'UNIDAD',linea:'RESIDUOS',patente:'PRUEBA'+i}))};
  vista = await consultar();
  assert.equal(vista.equipos.length,6);
  assert.deepEqual(vista.equipos.map(e=>e.region),['ZONA 4','ZONA 4','ZONA 8','ZONA 8','ZONA 5','SIN ZONA']);
  assert(vista.equipos.every(e=>e.region_original==='REGION PRUEBA'));
  assert.equal(fuente.equipos[0].zona,'ZONA 4A','conserva el origen');
  console.log('OK zonas 4/8: totales, porcentajes, unidades, líneas, históricos, equipos y exclusiones');
})().catch(error=>{console.error(error);process.exitCode=1;});
