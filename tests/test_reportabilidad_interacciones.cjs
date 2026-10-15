const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Elemento {
  constructor(tag=''){this.tag=tag;this.children=[];this.value='';this.style={};this.attrs={};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  add(item){this.append(item);}
  setAttribute(k,v){this.attrs[k]=String(v);}
}
const unidad=(ceco,reportadas,total,lineas)=>({ceco,reportadas,total,fuera_maestro:0,historico:[reportadas],historico_completo:[reportadas],lineas});
const datos={version_reporte:2,semana:1,semanas:[{numero:1,fecha:'2026-10-13'}],semanas_completas:[{numero:1,fecha:'2026-10-13'}],fecha:'2026-10-13',inicio:'2026-10-12',fin:'2026-10-16',advertencias:[],reportadas:21,total:15,fuente:'Prueba',hoja:'BD',filas_fuente:21,actualizado:'2026-10-13T12:00',regiones:[{region:'Norte',cecos:[unidad('U1',15,10,[{...unidad('U1',10,5),linea:'RESIDUOS'},{...unidad('U1',5,5),linea:'AGUAS'}])]},{region:'Sur',cecos:[unidad('U2',6,5,[{...unidad('U2',6,5),linea:'RESIDUOS'}])]}]};
const textos=e=>[e.textContent,...e.children.flatMap(textos)].filter(Boolean);
async function probar(zona){
 const elementos=new Map();const el=id=>{if(!elementos.has(id))elementos.set(id,new Elemento());return elementos.get(id);};
 const contexto=vm.createContext({document:{getElementById:el,createElement:t=>new Elemento(t),createElementNS:(_,t)=>new Elemento(t)},window:{addEventListener(){},PortalZona:{activa:()=>zona}},PortalDatos:{fechaActual:()=>new Date('2026-10-13'),consultar:async()=>({ok:true,json:async()=>datos})},PortalConfig:{incluida:()=>true,cecoIncluido:()=>true,registrar(){},nombreCeco:c=>c},Option:function(t,v){this.textContent=t;this.value=v;},console});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js/reportabilidad.js'),'utf8'),contexto);
 await new Promise(r=>setImmediate(r));
 assert.equal(el('estado').className,'');
 const filaInicial=el('detalle').children.length;
 assert.equal(filaInicial,4);
 assert.equal(el('mostrar-regiones').hidden,!zona);
 assert.equal(el('mostrar-regiones').textContent,'Expandir líneas');
 assert.equal(el('detalle').children.filter(r=>r.className==='zona-linea').length,0);
 // Con techo de 150 %, las marcas siguen separadas por 25 puntos.
 assert.deepEqual(el('reporte-barras').children[0].children.filter(e=>e.tag==='text'&&e.attrs['text-anchor']==='end').map(e=>e.textContent),['0 %','25 %','50 %','75 %','100 %','125 %','150 %']);
 const barra=()=>el('reporte-barras').children[0].children.find(e=>e.tag==='rect');
 barra().onclick();assert(el('reporte-grafico-titulo').textContent.includes('Unidad · Norte'));
 assert.equal(el('detalle').children.length,2);assert.equal(el('total').textContent,'10');assert.equal(el('region').value,'Norte');
 assert(!textos(el('detalle')).some(t=>t.includes('Sur')));
 el('reporte-leyenda').children[0].onkeydown({key:'Enter',preventDefault(){}});
 assert.equal(el('buscar').value,'U1');
 if(zona){
  assert(el('reporte-grafico-titulo').textContent.includes('línea de negocio · U1'));
  assert.equal(el('reporte-leyenda').children.length,2);
  assert(textos(el('reporte-barras')).some(t=>t.includes('AGUAS')));
 }else{barra().onclick();assert.equal(barra().attrs['aria-pressed'],'true');}
 assert.equal(el('detalle').children.length,2);
 el('reporte-volver').onclick();assert.equal(el('buscar').value,'');assert.equal(el('region').value,'Norte');
 el('reporte-volver').onclick();assert(el('reporte-volver').hidden);assert.equal(el('region').value,'');
 assert.equal(el('detalle').children.length,filaInicial);assert.equal(el('total').textContent,'15');
 // Navegar desde una serie del gráfico semanal filtra también las barras y la tabla.
 el('reporte-grafico').children[0].children.find(e=>e.tag==='circle').onclick();
 assert(el('reporte-barras-titulo').textContent.includes('Unidad · Norte'));
 assert.equal(el('region').value,'Norte');assert.equal(el('detalle').children.length,2);
 const titulo=el('reporte-grafico-titulo').textContent;
 const region=()=>el('detalle').children[0].children[0].children[0];
 region().onclick();assert.equal(region().attrs['aria-expanded'],'false');assert.equal(el('detalle').children.length,1);
 assert.equal(el('reporte-grafico-titulo').textContent,titulo);assert.equal(el('region').value,'Norte');assert.equal(el('total').textContent,'10');
 region().onclick();assert.equal(el('detalle').children.length,2);
 const botonUnidad=()=>el('detalle').children[1].children[0].children[0];
 botonUnidad().onclick();assert.equal(el('detalle').children.length,4);assert.equal(el('buscar').value,'');
 botonUnidad().onclick();assert.equal(el('detalle').children.length,2);
 if(zona){
  region().onclick();el('mostrar-regiones').onclick();assert.equal(el('detalle').children.length,4);
  assert.equal(el('mostrar-regiones').textContent,'Contraer líneas');
  el('mostrar-regiones').onclick();assert.equal(el('detalle').children.length,2);
  assert.equal(el('mostrar-regiones').textContent,'Expandir líneas');
 }else{el('mostrar-regiones').onclick();assert.equal(el('detalle').children.length,2);}
 assert.equal(el('region').value,'Norte');assert.equal(el('total').textContent,'10');
 assert.equal(el('reporte-grafico-titulo').textContent,titulo);
 el('region').value='Sur';el('region').onchange();assert(el('reporte-grafico-titulo').textContent.includes('Unidad · Sur'));
 assert.equal(el('detalle').children.length,2);assert.equal(el('total').textContent,'5');
 // Una nueva consulta vuelve a contraer las líneas.
 await el('formulario').onsubmit();assert.equal(el('detalle').children.filter(r=>r.className==='zona-linea').length,0);
 console.log('OK reportabilidad '+(zona?'zona':'región')+': eje, navegación, tabla y totales');
}
(async()=>{await probar(false);await probar(true);})().catch(e=>{console.error(e);process.exitCode=1;});
