const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {eventosMesMt} = require('../web/js/mantenciones.js');
const {equiposCalendarioMt,informeCalendarioMt} = require('../web/js/calendario_descarga.js');
const equipo = (patente,real,calculada,region='REGION BHP') => ({patente,region,ceco:'CECO A',unidad:'KM',fecha_proyectada_real:real,calculo:{fecha_proyectada:calculada,proxima:1500,estado:'Mantención Vigente'}});
const equipos = [equipo('REAL12','2026-10-05','2026-09-29'),equipo('CALC12',null,'2026-10-06'),equipo('SINU12','2026-10-07',null),equipo('OTRA12',null,'2026-10-05','REGION OTRA')];
assert.equal(eventosMesMt(equipos,'2026-09').length,0);
assert.equal(eventosMesMt(equipos,'2026-10','REGION BHP').length,3);
assert.equal(equipos[0].calculo.fecha_proyectada,'2026-09-29');
const informe=informeCalendarioMt(equiposCalendarioMt(equipos,new Set(['CALC12'])),'2026-10','REGION BHP','2026-09-01','2026-09-08');
assert(informe.includes('05-10-2026'));
assert(informe.includes('SINU12'));
assert(!informe.includes('CALC12'));
assert(!informe.includes('OTRA12'));

// Ejecuta los manejadores reales de la página y captura ambos archivos descargados.
class Elemento {
 constructor(){this.children=[];this.value='';this.dataset={};}
 append(...n){this.children.push(...n);}
 replaceChildren(...n){this.children=n;}
 add(n){this.append(n);}
 setAttribute(k,v){this[k]=v;}
 click(){}
}
const elementos=new Map();
const document={body:{dataset:{panel:'calendario'}},getElementById:id=>{if(!elementos.has(id))elementos.set(id,new Elemento());return elementos.get(id);},createElement:()=>new Elemento()};
const descargas=[];
const datos={version:2,incluye_estado_equipo:true,equipos,inicio:'2026-09-01',fecha:'2026-09-08',semanas:[{fecha:'2026-09-08'}],advertencias:[]};
const contexto=vm.createContext({document,window:{addEventListener(){}},PortalConfig:{registrar(){},incluida:()=>true},location:{protocol:'http:'},Option:function(t,v){this.text=t;this.value=v;},URLSearchParams,Blob,URL:{createObjectURL:b=>{descargas.push(b);return 'blob:prueba';},revokeObjectURL(){}},fetch:async()=>({ok:true,json:async()=>datos})});
for(const nombre of ['calendario_descarga.js','mantenciones.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js',nombre),'utf8'),contexto);
const el=id=>document.getElementById(id);
const casilla=patente=>el('mt-agenda').children.flatMap(tr=>tr.children).flatMap(td=>td.children).find(n=>n['aria-label']===`Incluir ${patente} en descargas HTML y CSV`);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 el('mt-mes').value='2026-10';el('mt-region-cal').value='REGION BHP';el('mt-region-cal').onchange();
 assert(casilla('REAL12').checked);
 casilla('REAL12').checked=false;casilla('REAL12').onchange();
 el('mt-mes-anterior').onclick();el('mt-mes-siguiente').onclick();
 assert.equal(casilla('REAL12').checked,false);
 // Ver un solo día no limita los archivos a ese día.
 el('mt-cal-grid').children.find(n=>n['aria-label']?.startsWith('06-10-2026:')).onclick();
 el('mt-exportar-informe').onclick();el('mt-exportar-calendario').onclick();
 for(const archivo of descargas){const texto=await archivo.text();assert(!texto.includes('REAL12'));assert(texto.includes('CALC12'));assert(texto.includes('SINU12'));assert(!texto.includes('OTRA12'));}
 el('mt-todo-mes').onclick();casilla('REAL12').checked=true;casilla('REAL12').onchange();
 el('mt-exportar-calendario').onclick();assert((await descargas.at(-1).text()).includes('2026-10-05'));
 for(const p of ['REAL12','CALC12','SINU12']){casilla(p).checked=false;casilla(p).onchange();}
 el('mt-exportar-informe').onclick();el('mt-exportar-calendario').onclick();
 assert((await descargas.at(-2).text()).includes('Sin mantenciones proyectadas'));
 assert.equal((await descargas.at(-1).text()).split('\r\n').length,1);
 console.log('OK: fechas prioritarias, filtros, casillas y descargas HTML/CSV.');
})().catch(error=>{console.error(error);process.exitCode=1;});
