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
require('./ayuda_filtros.cjs')(contexto,Elemento);
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
 const barra=()=>el('reporte-barras').children[0].children.find(e=>e.attrs['data-entidad']);
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
async function probarHistorico(){
 const semanas=Array.from({length:12},(_,i)=>({numero:i+1,fecha:new Date(Date.UTC(2026,7,4+i*7)).toISOString().slice(0,10)}));
 const historial=[0,74,75,89,90,100,125,50,80,95,105,150];
 const u=(nombre,total,valores)=>({...unidad(nombre,valores.at(-1),total),historico:valores.slice(-4),historico_completo:valores});
 const muestra={...datos,semana:12,fecha:semanas.at(-1).fecha,semanas:semanas.slice(-4),semanas_completas:semanas,regiones:[{region:'Norte',cecos:[u('U1',100,historial)]},{region:'Sur',cecos:[u('U2',100,historial.map(v=>Math.min(v,90)))]},{region:'Sin base',cecos:[u('U3',0,historial.map(()=>0))]}]};
 const elementos=new Map(),el=id=>{if(!elementos.has(id))elementos.set(id,new Elemento());return elementos.get(id);};
 el('reporte-semanal').scrollWidth=1800;el('reporte-semanal').clientWidth=600;
 const contexto=vm.createContext({document:{getElementById:el,createElement:t=>new Elemento(t),createElementNS:(_,t)=>new Elemento(t)},window:{addEventListener(){},PortalZona:{activa:()=>false}},PortalDatos:{fechaActual:()=>new Date('2026-10-20'),consultar:async()=>({ok:true,json:async()=>muestra})},PortalConfig:{incluida:()=>true,cecoIncluido:()=>true,registrar(){},nombreCeco:c=>c},Option:function(t,v){this.textContent=t;this.value=v;},console});
 require('./ayuda_filtros.cjs')(contexto,Elemento);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js/reportabilidad.js'),'utf8'),contexto);
 await new Promise(r=>setImmediate(r));
 assert.equal(el('estado').className,'');
 assert.equal(el('reporte-semanal').scrollLeft,1200,'El historial abre en las semanas más recientes');
 const marcas=id=>el(id).children[0].children.filter(e=>e.attrs['data-entidad']);
 assert.equal(marcas('reporte-semanal').length,36,'Una barra por entidad y por cada una de las doce semanas');
 assert.equal(el('reporte-grafico').children[0].children.filter(e=>e.tag==='circle').length,24,'Las líneas también incluyen más de ocho semanas');
 assert.deepEqual(el('reporte-semanal').children[0].children.filter(e=>e.attrs['data-rango']).map(e=>e.attrs['data-rango']),['rojo','amarillo','verde']);
 const marca=(entidad,semana)=>marcas('reporte-semanal').find(e=>e.attrs['data-entidad']===entidad&&e.attrs['data-semana']===String(semana));
 for(const [semana,estado] of [[2,'Rojo'],[3,'Amarillo'],[4,'Amarillo'],[5,'Verde']])assert(marca('Norte',semana).attrs['aria-label'].includes(estado));
 assert(marca('Norte',1).attrs['aria-label'].includes('0 %'));assert(Number(marca('Norte',1).attrs.height)>0,'El cero conserva una marca seleccionable');
 assert(marca('Sin base',1).attrs['aria-label'].includes('Sin base'));assert.equal(marca('Sin base',1).attrs['data-valor'],'');
 assert.equal(marca('Norte',12).attrs['data-valor'],'150','No se recortan los valores sobre 100 %');
 const etiquetas=el('reporte-semanal').children[0].children.filter(e=>Object.hasOwn(e.attrs,'data-porcentaje'));
 assert.equal(etiquetas.length,36,'Cada barra tiene su porcentaje encima');
 assert(etiquetas.some(e=>e.textContent==='150 %'));assert(etiquetas.some(e=>e.textContent==='—'));
 const totales=el('total').textContent;
 marca('Norte',3).onmouseenter();
 assert(el('reporte-tooltip').textContent.includes('Patentes reportadas: 75'));
 assert(el('reporte-tooltip').textContent.includes('Base vigente: 100'));
 assert.equal(marca('Norte',3).style.opacity,'1');assert.equal(marca('Norte',4).style.opacity,'0.15','Se atenúan otras semanas de la misma entidad');
 assert.equal(marca('Sur',3).style.opacity,'0.15');assert(el('reporte-grafico-detalle').textContent.includes('S3'));
 assert.equal(el('total').textContent,totales,'Hover no cambia totales');assert.equal(el('region').value,'');
 marca('Norte',3).onmouseleave();assert(marcas('reporte-semanal').every(e=>e.style.opacity==='1'));
 marca('Norte',12).onfocus();assert(el('reporte-barras-detalle').textContent.includes('150 %'));assert(el('reporte-semanal-detalle').textContent.includes('Verde'));
 marca('Norte',12).onblur();
 for(const [rango,admite] of [['rojo',v=>v<75],['amarillo',v=>v>=75&&v<90],['verde',v=>v>=90]]){
  const franja=el('reporte-semanal').children[0].children.find(e=>e.attrs['data-rango']===rango);
  franja.onmouseenter();
  for(const id of ['reporte-semanal','reporte-barras','reporte-grafico'])for(const e of marcas(id))assert.equal(e.style.opacity,e.attrs['data-valor']!==''&&admite(Number(e.attrs['data-valor']))?'1':'0.15','El rango destaca valores propios en los tres gráficos');
  assert(el('reporte-semanal-detalle').textContent.includes('en este rango'));
  assert.equal(el('total').textContent,totales);assert.equal(el('region').value,'');
  franja.onmouseleave();assert(marcas('reporte-semanal').every(e=>e.style.opacity==='1'));
 }
 const leyenda=new Elemento('span');contexto.leyendaPrueba=leyenda;
 vm.runInContext("conectarRango(leyendaPrueba,'neutro')",contexto);leyenda.onfocus();
 for(const e of marcas('reporte-semanal'))assert.equal(e.style.opacity,e.attrs['data-valor']===''?'1':'0.15');
 leyenda.onblur();assert(marcas('reporte-semanal').every(e=>e.style.opacity==='1'));
 el('reporte-semanal').scrollLeft=300;el('detalle').children[0].children[0].children[0].onclick();
 assert.equal(el('reporte-semanal').scrollLeft,300,'Expandir la tabla conserva la posición del historial');
 marca('Norte',1).onkeydown({key:'Enter',preventDefault(){}});assert.equal(el('region').value,'Norte');assert.equal(marcas('reporte-semanal').length,12);assert(el('reporte-semanal-titulo').textContent.includes('Unidad'));
 el('reporte-volver').onclick();assert.equal(marcas('reporte-semanal').length,36);
 console.log('OK reportabilidad: doce semanas, semáforos, cero/sin base, hover por período y teclado');
}
(async()=>{await probar(false);await probar(true);await probarHistorico();})().catch(e=>{console.error(e);process.exitCode=1;});
