const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'web/js/abrir_portal.js'), 'utf8');
const paginas = ['Panel.html', ...fs.readdirSync(path.join(root, 'web/pages'))
  .filter(nombre => nombre.endsWith('.html')).map(nombre => 'web/pages/' + nombre)];

for (const pagina of paginas) {
  const html = fs.readFileSync(path.join(root, pagina), 'utf8');
  const enlace = html.match(/<script src="([^"]*abrir_portal\.js)"><\/script>/);
  assert(enlace, pagina + ': falta conexión al servidor');
  assert.equal(path.resolve(root, path.dirname(pagina), enlace[1]), path.join(root, 'web/js/abrir_portal.js'));
  let destino;
  vm.runInNewContext(script, {URL, location: {
    protocol: 'file:', pathname: '/C:/carpeta%20con%20espacios/' + pagina,
    search: '?fecha=2026-09-29', hash: '#detalle', replace: url => { destino = url; }
  }});
  assert.equal(destino, 'http://127.0.0.1:8765/' + path.basename(pagina) + '?fecha=2026-09-29#detalle');
}

for (const protocol of ['http:', 'https:']) {
  vm.runInNewContext(script, {URL, location: {
    protocol, pathname: '/web/pages/Panel_Reportabilidad.html',
    replace: () => assert.fail('No debe redirigir una página servida por HTTP/HTTPS')
  }});
}
console.log('OK: doble clic en las ' + paginas.length + ' páginas, parámetros conservados y navegación HTTP/HTTPS sin redirección.');
