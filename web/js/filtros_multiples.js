/* Selección compartida: vacío significa todas las opciones disponibles. */
(() => {
  'use strict';
  const controles = new Map();
  const nodo = selector => typeof selector === 'string' ? document.getElementById(selector) : selector;
  const valores = selector => Array.from(nodo(selector).selectedOptions, o => o.value).filter(Boolean);
  const coincide = (selector, valor) => { const elegidos = valores(selector); return !elegidos.length || elegidos.includes(valor); };
  function asignar(selector, elegidos = []) {
    const select = nodo(selector);
    const conjunto = new Set(Array.isArray(elegidos) ? elegidos : elegidos ? [elegidos] : []);
    Array.from(select.options).forEach(o => { o.selected = conjunto.has(o.value); });
    controles.get(select)?.actualizar();
  }
  function opciones(selector, entradas, titulo) {
    const select = nodo(selector), previos = valores(select);
    select.replaceChildren(new Option(titulo, ''), ...entradas.map(e => Array.isArray(e) ? new Option(e[1], e[0]) : new Option(e, e)));
    asignar(select, previos);
  }
  function texto(selector) {
    const select = nodo(selector);
    return Array.from(select.selectedOptions).filter(o => o.value).map(o => o.textContent.trim()).join(', ') || select.options[0]?.textContent || 'Todas';
  }
  window.PortalFiltros = {valores, coincide, asignar, opciones, texto, activar, hay: s => valores(s).length > 0, unico: s => valores(s).length === 1 ? valores(s)[0] : ''};
  const ids = ['region','buscar','status-equipo','km-region','km-ceco','mt-region-resumen','mt-ceco-resumen','mt-region-cal','mt-ceco-cal','region-programa','ceco-programa'];
  function activar(selector) {
    const select = nodo(selector);
    if (!select || select.tagName !== 'SELECT' || controles.has(select)) return;
    const id = select.id;
    const etiqueta = select.closest('label'), titulo = etiqueta.childNodes[0].textContent.trim();
    const contenedor = document.createElement('div'); contenedor.className = 'multi-filtro'; contenedor.hidden = etiqueta.hidden;
    const rotulo = document.createElement('span'); rotulo.id = id + '-rotulo'; rotulo.textContent = titulo;
    select.dataset.filtroEtiqueta = titulo; select.multiple = true; select.hidden = true;
    const detalle = document.createElement('details'); detalle.className = 'multi-desplegable';
    const resumen = document.createElement('summary'); resumen.setAttribute('aria-labelledby', rotulo.id + ' ' + id + '-resumen');
    const resumenTexto = document.createElement('span'); resumenTexto.id = id + '-resumen'; resumen.append(resumenTexto);
    const panel = document.createElement('div'); panel.className = 'multi-panel'; panel.dataset.pdfOmitir = '';
    const buscar = document.createElement('input'); buscar.type = 'search'; buscar.placeholder = 'Buscar…'; buscar.setAttribute('aria-label', 'Buscar en ' + titulo);
    const acciones = document.createElement('div'); acciones.className = 'multi-acciones';
    const todas = document.createElement('button'), limpiar = document.createElement('button');
    todas.type = limpiar.type = 'button'; todas.textContent = 'Seleccionar todas'; limpiar.textContent = 'Limpiar selección'; acciones.append(todas, limpiar);
    const lista = document.createElement('div'); lista.className = 'multi-opciones'; lista.setAttribute('role','group'); lista.setAttribute('aria-labelledby',rotulo.id);
    const nota = document.createElement('small'); nota.textContent = 'Sin selección se incluyen todas las opciones.';
    panel.append(buscar, acciones, lista, nota); detalle.append(resumen, panel);
    etiqueta.replaceWith(contenedor); contenedor.append(rotulo, select, detalle);
    let firma = '';
    function actualizar() {
      const entradas = Array.from(select.options).filter(o => o.value);
      const nueva = JSON.stringify(entradas.map(o => [o.value, o.textContent]));
      if (nueva !== firma) {
        firma = nueva; lista.replaceChildren();
        entradas.forEach(o => {
          const fila = document.createElement('label'), casilla = document.createElement('input'), nombre = document.createElement('span');
          casilla.type = 'checkbox'; casilla.value = o.value; nombre.textContent = o.textContent;
          fila.append(casilla,nombre); lista.append(fila);
          casilla.onchange = () => { asignar(select, Array.from(lista.querySelectorAll('input:checked'), c => c.value)); select.dispatchEvent(new Event('change',{bubbles:true})); };
        });
      }
      const elegidos = valores(select);
      lista.querySelectorAll('input').forEach(c => { c.checked = elegidos.includes(c.value); c.disabled = select.disabled; c.closest('label').hidden = !c.closest('label').textContent.toLocaleLowerCase('es').includes(buscar.value.toLocaleLowerCase('es')); });
      const leyenda = !elegidos.length ? select.options[0]?.textContent || 'Todas' : elegidos.length === 1 ? texto(select) : /Status/i.test(titulo) ? `${elegidos.length} status seleccionados` : `${elegidos.length} ${/Unidad/i.test(titulo) ? 'unidades' : /Línea/i.test(titulo) ? 'líneas' : /Zona/i.test(rotulo.textContent) ? 'zonas' : 'regiones'} seleccionadas`;
      if (resumenTexto.textContent !== leyenda) resumenTexto.textContent = leyenda;
      resumen.title = texto(select); resumen.setAttribute('aria-disabled',String(select.disabled));
      buscar.disabled = todas.disabled = limpiar.disabled = select.disabled;
      if (select.disabled) detalle.open = false;
    }
    controles.set(select, {actualizar});
    todas.onclick = () => { asignar(select, Array.from(select.options, o => o.value).filter(Boolean)); select.dispatchEvent(new Event('change',{bubbles:true})); };
    limpiar.onclick = () => { asignar(select); select.dispatchEvent(new Event('change',{bubbles:true})); };
    buscar.oninput = actualizar;
    buscar.onkeydown = e => { if (e.key === 'Enter') e.preventDefault(); };
    detalle.addEventListener('keydown', e => { if(e.key === 'Escape'){detalle.open=false;resumen.focus();} });
    resumen.addEventListener('click',e => { if(select.disabled)e.preventDefault(); });
    function alinear() {
      if (!detalle.open) return;
      const caja = detalle.getBoundingClientRect();
      panel.style.left = Math.min(0, Math.max(16 - caja.left, innerWidth - 16 - caja.left - panel.offsetWidth)) + 'px';
    }
    detalle.addEventListener('toggle', () => { if(detalle.open) { controles.forEach((c,s) => { if(s!==select)c.cerrar(); }); alinear(); buscar.focus(); } });
    window.addEventListener('resize', alinear);
    controles.get(select).cerrar = () => { detalle.open = false; };
    document.addEventListener('click', e => { if(!contenedor.contains(e.target)) detalle.open = false; });
    select.addEventListener('change', actualizar);
    new MutationObserver(actualizar).observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});
    actualizar();
  }
  ids.forEach(activar);
})();
