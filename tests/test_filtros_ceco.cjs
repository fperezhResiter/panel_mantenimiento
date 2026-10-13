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
function pagina(panel,datos,archivos){
  const elementos=new Map(),descargas=[],eventos={};
  const el=id=>{if(!elementos.has(id))elementos.set(id,new Elemento());return elementos.get(id);};
  const document={body:{dataset:{panel}},getElementById:el,createElement:()=>new Elemento(),createElementNS:()=>new Elemento()};
  const contexto=vm.createContext({document,window:{addEventListener:(n,f)=>eventos[n]=f},PortalConfig:{registrar(){},incluida:r=>r!=='Excluida'},location:{protocol:'http:'},Option:function(t,v){this.text=t;this.value=v;},URLSearchParams,Blob,URL:{createObjectURL:b=>{descargas.push(b);return 'blob:prueba';},revokeObjectURL(){}},fetch:async()=>({ok:true,json:async()=>datos})});
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
  assert(pro.el('leyenda-estados').children[0].children.includes('Realizadas: 5 (50%)'));
  const textos=n=>[n.textContent,...n.children.flatMap(c=>typeof c==='object'?textos(c):[c])];
  const historico=textos(pro.el('grafico-cantidades')).filter(Boolean).join(' ');
  assert(historico.includes('CECO 1 · Programadas · 2026-09: 6'));assert(!historico.includes('CECO 10'));
  pro.el('region-programa').value='Sur';pro.el('region-programa').eventos.change();assert.equal(pro.el('ceco-programa').value,'');assert.deepEqual(opciones(pro.el('ceco-programa')),['','CECO 100']);
  pro.el('region-programa').value='';pro.el('region-programa').eventos.change();assert.equal(pro.el('kpis').children[0].children[1].textContent,'16');
  console.log('OK: filtros CeCo por región, búsqueda por patente, descargas, totales e historial.');
})().catch(error=>{console.error(error);process.exitCode=1;});
