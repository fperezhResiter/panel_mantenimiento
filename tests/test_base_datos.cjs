const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function escenario(exito) {
  const elementos = [], llamadas = [];
  let recargas = 0;
  const main = {prepend: elemento => elementos.push(elemento)};
  const document = {
    querySelector: () => main,
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
    document, fetch, Date, location: {reload: () => recargas++}
  });
  await new Promise(resolve => setImmediate(resolve));
  const [boton, estado] = elementos[0].children;
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
  console.log('OK: botón Actualizar BD, recarga y error recuperable.');
})().catch(error => { console.error(error); process.exitCode = 1; });
