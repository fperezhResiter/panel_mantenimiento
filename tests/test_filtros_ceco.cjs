const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Elemento {
  constructor(){this.children=[];this.value='';this.style={};this.dataset={};this.eventos={};}
  get options(){return this.children;}
  append(...n){this.children.push(...n);}
  replaceChildren(...n){this.children=n;this.value=n[0]?.value??'';}
  add(n){this.append(n);}
  setAttribute(k,v){this[k]=v;}
  addEventListener(n,f){this.eventos[n]=f;}
  reportValidity(){return true;}
  click(){}
}
function pagina(panel,datos,archivos,excluidas=[]){
  const elementos=new Map(),descargas=[],eventos={};
  const el=id=>{if(!elementos.has(id))elementos.set(id,new Elemento());return elementos.get(id);};
  const document={body:{dataset:{panel}},getElementById:el,createElement:()=>new Elemento(),createElementNS:()=>new Elemento()};
  const contexto=vm.createContext({document,window:{addEventListener:(n,f)=>eventos[n]=f},PanelPDF:{descargar:async({html})=>descargas.push(new Blob([html]))},PortalDatos:{fechaActual:()=>new Date(),consultar:async()=>({ok:true,json:async()=>datos})},PortalConfig:{registrar(){},incluida:r=>r!=='Excluida',cecoIncluido:c=>!excluidas.includes(c),calendarioIncluida:()=>true,estado:()=>({calendario_excluidas:[]}),aviso:()=>''},location:{protocol:'http:'},Option:function(t,v){this.text=t;this.value=v;},URLSearchParams,Blob,URL:{createObjectURL:b=>{descargas.push(b);return 'blob:prueba';},revokeObjectURL(){}},fetch:async()=>({ok:true,json:async()=>datos})});
  for(const archivo of archivos)vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',archivo),'utf8'),contexto);
  return {el,descargas,eventos};
}
const opciones=e=>e.children.map(o=>o.value);
const equipo=(patente,region,ceco)=>({patente,region,ceco,unidad:'KM',lecturas:[null],fecha_proyectada_real:'2026-10-05',calculo:{variaciones:[],estado:'Mantención Vigente',fecha_proyectada:'2026-10-05',proxima:1500,ritmo_diario:null}});
const equipos=[equipo('AAA111','Norte','CECO 1'),equipo('BBB222','Norte','CECO 10'),equipo('CCC333','Sur','CECO 100'),equipo('DDD444','Excluida','OCULTO')];
const datos={version:2,incluye_estado_equipo:true,equipos,inicio:'2026-09-01',fecha:'2026-10-13',semanas:[{numero:1,fecha:'2026-10-13'}],advertencias:[]};
const resumen=(ceco,total,realizadas)=>({ceco,total,realizadas,regularizadas:0,no_realizadas:total-realizadas,na:0,sin_clasificar:0,porcentaje:realizadas/total*100});
const norte={region:'Norte',...resumen('',12,7),cecos:[resumen('CECO 1',10,5),resumen('CECO 10',2,2)]};
const sur={region:'Sur',...resumen('',4,1),cecos:[resumen('CECO 100',4,1)]};
const programa={...resumen('',16,8),mes:'2026-10',regiones:[norte,sur],historico:[{mes:'2026-09',regiones:[{...norte,cecos:[resumen('CECO 1',6,3),resumen('CECO 10',2,2)]},sur]}],advertencias:[],fuente:'Prueba',hoja:'PROGRAMA'};

(async()=>{
  const km=pagina('seguimiento',datos,['seguimiento_km_hr.js']);
  const cal=pagina('calendario',datos,['calendario_descarga.js','mantenciones.js']);
  const pro=pagina('programa',programa,['programa.js']);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(opciones(km.el('km-ceco')),['','CECO 1','CECO 10','CECO 100']);
  km.el('km-region').value='Norte';km.el('km-region').onchange();
  assert.deepEqual(opciones(km.el('km-ceco')),['','CECO 1','CECO 10']);
  km.el('km-ceco').value='CECO 1';km.el('km-ceco').onchange();assert.equal(km.el('km-total').textContent,1);
  km.el('km-buscar').value='BBB';km.el('km-buscar').oninput();assert.equal(km.el('km-total').textContent,0);
  km.el('km-buscar').value='AAA';km.el('km-buscar').oninput();assert.equal(km.el('km-total').textContent,1);
  km.el('km-exportar').onclick();assert((await km.descargas.at(-1).text()).includes('AAA111'));assert(!(await km.descargas.at(-1).text()).includes('BBB222'));
  km.el('km-region').value='Sur';km.el('km-region').onchange();assert.equal(km.el('km-ceco').value,'');assert.deepEqual(opciones(km.el('km-ceco')),['','CECO 100']);

  cal.el('mt-mes').value='2026-10';cal.el('mt-region-cal').value='Norte';cal.el('mt-region-cal').onchange();
  assert.deepEqual(opciones(cal.el('mt-ceco-cal')),['','CECO 1','CECO 10']);
  cal.el('mt-ceco-cal').value='CECO 1';cal.el('mt-ceco-cal').onchange();
  assert(cal.el('mt-dia-titulo').textContent.includes('1 patentes'));
  cal.el('mt-exportar-calendario').onclick();cal.el('mt-exportar-informe').onclick();
  for(const descarga of cal.descargas){const texto=await descarga.text();assert(texto.includes('AAA111'));assert(!texto.includes('BBB222'));assert(!texto.includes('CCC333'));}
  cal.el('mt-region-cal').value='Sur';cal.el('mt-region-cal').onchange();assert.equal(cal.el('mt-ceco-cal').value,'');assert.deepEqual(opciones(cal.el('mt-ceco-cal')),['','CECO 100']);

  pro.el('region-programa').value='Norte';pro.el('region-programa').eventos.change();
  assert.deepEqual(opciones(pro.el('ceco-programa')),['','CECO 1','CECO 10']);
  pro.el('ceco-programa').value='CECO 1';pro.el('ceco-programa').eventos.change();
  assert.equal(pro.el('kpis').children[0].children[1].textContent,'10');
  assert.equal(pro.el('detalle').children.length,2);
  assert(pro.el('leyenda-estados').children[0].children.includes('Realizadas: 5'));
  assert.equal(pro.el('leyenda-estados').children[0].children.at(-1).hidden,true);
  const textos=n=>[n.textContent,...n.children.flatMap(c=>typeof c==='object'?textos(c):[c])];
  const historico=textos(pro.el('grafico-cantidades')).filter(Boolean).join(' ');
  assert(historico.includes('CECO 1 · Programadas · 2026-09: 6'));assert(!historico.includes('CECO 10'));
  pro.el('region-programa').value='Sur';pro.el('region-programa').eventos.change();assert.equal(pro.el('ceco-programa').value,'');assert.deepEqual(opciones(pro.el('ceco-programa')),['','CECO 100']);
  pro.el('region-programa').value='';pro.el('region-programa').eventos.change();assert.equal(pro.el('kpis').children[0].children[1].textContent,'16');
  // La publicación puede conservar porcentajes antiguos: recalcular todos los niveles.
  const conteos={total:10,realizadas:3,regularizadas:3,no_realizadas:2,na:2,sin_clasificar:0,porcentaje:37.5};
  const region={region:'Norte',...conteos,cecos:[{ceco:'CECO 1',...conteos}]};
  const actualizado=pagina('programa',{...conteos,mes:'2026-10',regiones:[region],historico:[{...conteos,mes:'2026-09',regiones:[region]}],advertencias:[],fuente:'Prueba',hoja:'PROGRAMA'},['programa.js']);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(actualizado.el('totales').children[0].children.at(-1).children[0].textContent,'75%');
  for(const fila of actualizado.el('detalle').children)assert.equal(fila.children.at(-1).children[0].textContent,'75%');
  assert(textos(actualizado.el('grafico-cumplimiento')).includes('Total general · 2026-09: 75%'));
  const estadosTexto=textos(actualizado.el('leyenda-estados')).filter(Boolean).join(' ');
  assert(estadosTexto.includes('Realizadas: 3'));
  assert(estadosTexto.includes('Regularizadas: 3'));
  assert(estadosTexto.includes('No realizadas: 2'));
  const porcentajeLeyenda=actualizado.el('leyenda-estados').children[0].children.at(-1);
  assert.equal(porcentajeLeyenda.textContent,' (37,5%)');assert.equal(porcentajeLeyenda.hidden,true);
  const cascada=actualizado.el('grafico-estados').children[0];
  const barras=cascada.children.filter(n=>n['aria-label']);
  assert.equal(barras.length,4);
  assert(barras.at(-1)['aria-label'].includes('Total: 8 (100%)'));
  assert(barras[2]['aria-label'].includes('Acumulado: 8 patentes (100%)'));
  assert.equal(barras[0].children[0].textContent.includes('Realizadas: 3'),true);
  assert(textos(barras[0]).includes('3'));
  assert(textos(barras[0]).includes('37,5%'));
  assert.equal(barras[0].children[1].height,75);
  assert.equal(barras.at(-1).children[1].height,200);
  assert(textos(cascada).includes('Cantidad de patentes'));
  assert(!barras.some(n=>n['aria-label'].includes('N/A')));
  barras[1].eventos.mouseenter();assert.equal(barras[0].style.opacity,'0.2');assert.equal(barras[1].style.opacity,'1');
  assert.equal(barras[0].children[3].visibility,'hidden');assert.equal(barras[1].children[3].visibility,'visible');
  barras[1].eventos.mouseleave();assert(barras.every(n=>n.style.opacity==='1'));
  assert.equal(barras[1].children[3].visibility,'hidden');
  const historialSVG=actualizado.el('grafico-cantidades').children[2].children[0];
  const lineas=historialSVG.children.filter(n=>n['aria-label']);
  lineas[0].eventos.mouseenter();assert.equal(lineas[0].style.opacity,'1');assert.equal(lineas[1].style.opacity,'1');assert.equal(lineas[0].children[0]['stroke-width'],5);
  lineas[0].eventos.mouseleave();assert(lineas.every(n=>n.style.opacity==='1'));
  actualizado.el('region-programa').value='Norte';actualizado.el('region-programa').eventos.change();
  actualizado.el('ceco-programa').value='CECO 1';actualizado.el('ceco-programa').eventos.change();
  assert.equal(actualizado.el('totales').children[0].children.at(-1).children[0].textContent,'75%');
  assert(textos(actualizado.el('grafico-cumplimiento')).includes('CECO 1 · 2026-09: 75%'));
  // Resaltado compartido por entidad desde cualquiera de los dos historiales.
  const grupos=id=>pro.el(id).children[2].children[0].children.filter(n=>n['aria-label']);
  grupos('grafico-cumplimiento')[0].eventos.click(); // Total → regiones.
  let cumplimiento=grupos('grafico-cumplimiento'), cantidades=grupos('grafico-cantidades');
  cumplimiento[0].eventos.mouseenter();
  assert.equal(cumplimiento[0].style.opacity,'1');assert.equal(cumplimiento[1].style.opacity,'0.15');
  assert.equal(cantidades[0].style.opacity,'1');assert.equal(cantidades[1].style.opacity,'1');
  assert.equal(cantidades[2].style.opacity,'0.15');assert.equal(cantidades[3].style.opacity,'0.15');
  cumplimiento[0].eventos.mouseleave();assert([...cumplimiento,...cantidades].every(n=>n.style.opacity==='1'));
  cantidades[3].eventos.mouseenter();assert.equal(cumplimiento[1].style.opacity,'1');assert.equal(cumplimiento[0].style.opacity,'0.15');
  cantidades[3].eventos.mouseleave();assert([...cumplimiento,...cantidades].every(n=>n.style.opacity==='1'));
  cumplimiento[0].eventos.click(); // Norte → CeCo.
  cumplimiento=grupos('grafico-cumplimiento');cantidades=grupos('grafico-cantidades');
  const leyenda=pro.el('grafico-cantidades').children[3].children;
  leyenda[2].eventos.focus();
  assert.equal(cumplimiento[1].style.opacity,'1');assert.equal(cumplimiento[0].style.opacity,'0.15');
  assert.equal(cantidades[2].style.opacity,'1');assert.equal(cantidades[0].style.opacity,'0.15');
  leyenda[2].eventos.blur();assert([...cumplimiento,...cantidades].every(n=>n.style.opacity==='1'));
  const kmExcluido=pagina('seguimiento',datos,['seguimiento_km_hr.js'],['CECO 1']);
  const calExcluido=pagina('calendario',datos,['calendario_descarga.js','mantenciones.js'],['CECO 1']);
  const proExcluido=pagina('programa',programa,['programa.js'],['CECO 1']);
  await new Promise(resolve=>setImmediate(resolve));
  assert(!opciones(kmExcluido.el('km-ceco')).includes('CECO 1'));
  assert.equal(kmExcluido.el('km-total').textContent,2);
  assert(!opciones(calExcluido.el('mt-ceco-cal')).includes('CECO 1'));
  assert(!opciones(proExcluido.el('ceco-programa')).includes('CECO 1'));
  assert.equal(proExcluido.el('kpis').children[0].children[1].textContent,'6');
  assert(textos(proExcluido.el('grafico-cantidades')).includes('Total general · Programadas · 2026-09: 6'));
  kmExcluido.el('km-exportar').onclick();
  assert(!(await kmExcluido.descargas.at(-1).text()).includes('AAA111'));
  console.log('OK: filtros CeCo por región, búsqueda por patente, descargas, totales e historial.');
})().catch(error=>{console.error(error);process.exitCode=1;});
