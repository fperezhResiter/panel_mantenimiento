process.chdir(require('path').resolve(__dirname, '..'));
// Prueba de construcción de tabla y SVG; no inicia navegadores ni servidores.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
class Elemento {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.attrs={}; this.value=''; this.textContent=''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=items; this.textContent=''; }
  setAttribute(k,v) { this.attrs[k]=v; }
  add(item) { this.children.push(item); }
  get options() { return this.children; }
}
const elementos = new Map();
const document = {getElementById(id){if(!elementos.has(id))elementos.set(id,new Elemento());return elementos.get(id);},
  createElement:tag=>new Elemento(tag),createElementNS:(_,tag)=>new Elemento(tag)};
const ctx={document,URLSearchParams,location:{protocol:'http:'},fetch:()=>new Promise(()=>{}),
  Option:function(text,value){this.textContent=text;this.value=value;}};
vm.createContext(ctx);require("./config_context.cjs")(ctx);
vm.runInContext(fs.readFileSync('web/js/seguimiento_km_hr.js','utf8'),ctx);
ctx.datos={semanas:[1,2,3,4].map(n=>({numero:n,fecha:`2026-09-${String(1+(n-1)*7).padStart(2,'0')}`})),
  equipos:[{patente:'ABCD12',ceco:'A',region:'REGION BHP',unidad:'KM',unidad_intervalo:'KM',ultima_mantencion:1000,
    fecha_mantencion:'2026-08-01',intervalo:500,
    lecturas:[1100,null,1200,1300].map((valor,i)=>valor===null?null:{semana:i+1,valor,unidad:'KM',fecha_lectura:'2026-09-22',fecha_envio:'2026-09-22',fila_excel:i+2}),
    calculo:{actual:1300,semana_actual:4,fecha_lectura:'2026-09-22',saldo:200,proxima:1500,estado:'Mantención Vigente',clase:'verde',
      motivo:'',fecha_proyectada:'2026-10-13',ritmo_diario:9.52,motivo_proyeccion:'',variaciones:[{semana:3,desde_semana:1,dias:14,incremento:100,ritmo:100/14},{semana:4,desde_semana:3,dias:7,incremento:100,ritmo:100/7}]}}]};
vm.runInContext('kmDatos=datos; renderKM();',ctx);
assert.equal(elementos.get('km-cabecera').children[0].children.length,15);
assert.equal(elementos.get('km-detalle').children[0].children.length,15);
const svg=elementos.get('km-grafico-lecturas').children[0];
assert.equal(svg.tag,'svg');
assert.equal(svg.children.filter(e=>e.tag==='circle').length,3);
assert.equal(svg.children.filter(e=>e.attrs?.class==='km-linea').length,1); // No unir el hueco semanal.
assert.equal(svg.children.filter(e=>e.attrs?.class==='km-objetivo').length,1);
const barras=elementos.get('km-grafico-ritmo').children[0];
assert.equal(barras.children.filter(e=>e.tag==='rect').length,2);
for(const grafico of [svg,barras])for(const e of grafico.children)for(const v of Object.values(e.attrs||{}))assert(!/NaN|Infinity/.test(String(v)));
const standby=JSON.parse(JSON.stringify(ctx.datos.equipos[0]));
standby.patente='AAAA10';standby.comentario_tania='Pendiente revisión de Tania';
standby.calculo.estado='STAND BY';standby.calculo.motivo='Comentario técnico que no debe aparecer';
ctx.datos.equipos.push(standby);
vm.runInContext('renderKM()',ctx);
const primera=elementos.get('km-detalle').children[0];
assert.equal(primera.children[0].children[0].textContent,'AAAA10');
assert.deepEqual(primera.children[1].children.map(e=>e.textContent),['STAND BY','Pendiente revisión de Tania']);
standby.comentario_tania='';
vm.runInContext('renderKM()',ctx);
assert.equal(elementos.get('km-detalle').children[0].children[1].children.length,1);
elementos.get('km-buscar').value='INEXISTENTE';
vm.runInContext('renderKM()',ctx);
assert.equal(elementos.get('km-total').textContent,0);
assert.equal(elementos.get('km-grafico-lecturas').children.length,0);
console.log('OK: tabla semanal, gráficos, huecos, objetivo y filtro sin resultados.');

