const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function escenario(exito) {
  const elementos = [], llamadas = [];
  let recargas = 0;
  const botones = [];
  const header = {append: elemento => elementos.push(elemento)};
  const inicio = {closest:()=>({}),before:boton=>{botones.push(boton);elementos[0].children=elementos[0].children.filter(n=>n!==boton);}};
  const document = {
    querySelector: selector => selector === 'header' ? header : selector === 'header .volver-inicio' ? inicio : null,
    createElement: () => ({
      children: [], eventos: {}, setAttribute() {},
      append(...hijos) { this.children.push(...hijos); },
      addEventListener(nombre, accion) { this.eventos[nombre] = accion; }
    })
  };
  const fetch = async (url, opciones) => {
    llamadas.push({url, opciones});
    return {ok: !opciones || exito, json: async () => opciones && !exito
      ? {error: 'Excel no disponible. Se conserva la base anterior.'}
      : {actualizado: '2026-10-13T11:00:00-03:00'}};
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../web/js/base_datos.js'), 'utf8'), {
    document, fetch, PortalDatos: {consulta:false, consultar:fetch}, Date, location: {reload: () => recargas++}
  });
  await new Promise(resolve => setImmediate(resolve));
  const boton = botones[0], estado = elementos[0].children[0];
  assert.equal(elementos[0].className,'publicacion-header');
  assert.equal(boton.id,'bd-actualizar');
  assert.match(estado.textContent, /BD actualizada/);
  await boton.eventos.click();
  assert.equal(llamadas[1].url, '/api/bd/actualizar');
  assert.equal(llamadas[1].opciones.method, 'POST');
  if (exito) assert.equal(recargas, 1);
  else {
    assert.equal(recargas, 0);
    assert.equal(boton.disabled, false);
    assert.match(estado.textContent, /Se conserva la base anterior/);
  }
}
(async () => {
  await escenario(true);
  await escenario(false);
  const hijos=[];
  const header={append:el=>hijos.push(el)};
  const document={querySelector:selector=>selector==='header'?header:null,createElement:()=>({children:[],setAttribute(){},append(...n){this.children.push(...n);},addEventListener(){}})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/js/base_datos.js'),'utf8'),{
    document,PortalDatos:{consulta:true,consultar:async()=>({ok:true,json:async()=>({actualizado:'2026-10-13T11:00:00-03:00'})})},Date
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(hijos[0].id,'bd-barra');assert.equal(hijos[0].className,'publicacion-header');
  assert.equal(hijos[0].children[0].hidden,true);
  assert.match(hijos[0].children[1].textContent,/Última publicación:/);
  assert(!hijos[0].children[1].textContent.includes('Consulta sin servidor'));
  console.log('OK: botón Actualizar BD, recarga y error recuperable.');
})().catch(error => { console.error(error); process.exitCode = 1; });
