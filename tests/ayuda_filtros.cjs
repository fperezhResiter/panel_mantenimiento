// Adaptar el DOM mínimo de las pruebas anteriores a selectedOptions del navegador.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
module.exports = function prepararFiltros(contexto, Elemento) {
  Object.defineProperties(Elemento.prototype, {
    options: {configurable:true,get(){return this.children;}},
    selectedOptions: {configurable:true,get(){return this.children.filter(o=>o.selected);}},
    value: {configurable:true,get(){return this.children?.some(o=>typeof o.value==='string') ? this.children.find(o=>o.selected)?.value || '' : this._value || '';},set(v){this._value=v;this.children?.forEach(o=>{if(typeof o.value==='string')o.selected=o.value===v;});}}
  });
  const Option = contexto.Option;
  contexto.Option = function(t,v){const o=new Option(t,v);o.textContent=t;return o;};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js/filtros_multiples.js'),'utf8'),contexto);
  contexto.PortalFiltros = contexto.window.PortalFiltros;
};
