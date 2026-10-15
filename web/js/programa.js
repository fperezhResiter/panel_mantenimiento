'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const campos = ['total', 'realizadas', 'regularizadas', 'no_realizadas', 'na'];
  const numero = new Intl.NumberFormat('es-CL', {maximumFractionDigits: 1});
  const hoy = PortalDatos.fechaActual();
  const colores = ['#2E9E6B', '#D98A1E', '#C43C39'];
  function cumplimiento(datos) {
    const aplicables = datos.total - datos.na;
    return aplicables ? (datos.realizadas + datos.regularizadas) / aplicables * 100 : null;
  }
  function svgNodo(tipo, atributos = {}, texto) {
    const nodo = document.createElementNS('http://www.w3.org/2000/svg', tipo);
    Object.entries(atributos).forEach(([k, v]) => nodo.setAttribute(k, v));
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }
  function lienzo(id, ancho, alto, titulo) {
    const svg = svgNodo('svg', {viewBox: `0 0 ${ancho} ${alto}`, role: 'img', 'aria-label': titulo});
    svg.append(svgNodo('title', {}, titulo));
    $(id).replaceChildren(svg);
    return svg;
  }
  let seleccion = {nivel: 'total'};
  let datosActuales = null;
  let seriesHistorial = [];
  let mostrarLineas = false, modoTabla = null, nodosTabla = [];
  const gruposContraidos = new Set();
  function destacarHistorial(nombre) {
    seriesHistorial.forEach(({grupo, linea, boton, serie}) => {
      const elegida = serie.nombre === nombre;
      const opacidad = nombre === null || elegida ? '1' : '0.15';
      grupo.style.opacity = opacidad;
      boton.style.opacity = opacidad;
      linea.setAttribute('stroke-width', elegida ? 5 : 3);
    });
  }
  function nombresRegiones(datos) {
    return [...new Set([...datos.regiones.map(r => r.region), ...(datos.historico || []).flatMap(m => (m.regiones || []).map(r => r.region))])].sort();
  }
  function aplicarConfiguracion(datos) {
    function filtrar(resumen) {
      const regiones = (resumen.regiones || []).filter(r => PortalConfig.incluida(r.region)).map(r => ({
        ...r, cecos: r.cecos.filter(c => PortalConfig.cecoIncluido(c.ceco)).map(c => ({...c, porcentaje: cumplimiento(c)}))
      })).filter(r => r.cecos.length).map(r => {
        const totales = {};
        for (const campo of [...campos, 'sin_clasificar']) totales[campo] = r.cecos.reduce((s,c) => s + (c[campo] || 0), 0);
        return {...r, ...totales, porcentaje: cumplimiento(totales)};
      });
      const totales = {};
      for (const campo of [...campos, 'sin_clasificar']) totales[campo] = regiones.reduce((s,r) => s + (r[campo] || 0), 0);
      return {...resumen, ...totales, regiones, porcentaje: cumplimiento(totales)};
    }
    return {...filtrar(datos), historico: (datos.historico || []).map(filtrar)};
  }
  function configurar(){if(datosActuales)PortalConfig.registrar(nombresRegiones(datosActuales));}
  window.addEventListener('portal-config',()=>{if(datosActuales){prepararRegiones(aplicarConfiguracion(datosActuales));renderizar(datosActuales);}});
  const nombreMes = mes => new Intl.DateTimeFormat('es-CL', {month: 'long', timeZone: 'UTC'}).format(new Date(mes + '-01T00:00:00Z'));
  function cambiarSeleccion(nueva) {
    seleccion = nueva;
    $('region-programa').value = seleccion.region || '';
    $('ceco-programa').value = seleccion.ceco || '';
    if (datosActuales) renderizar(datosActuales);
  }
  function prepararCecos(datos) {
    const selector = $('ceco-programa'), previo = selector.value;
    const nombres = [...new Set([datos, ...(datos.historico || [])].flatMap(m => (m.regiones || [])
      .filter(r => !seleccion.region || r.region === seleccion.region).flatMap(r => r.cecos.map(c => c.ceco))))]
      .sort((a,b) => a.localeCompare(b, 'es', {numeric: true}));
    selector.replaceChildren(new Option('Todas las unidades', ''));
    nombres.forEach(c => selector.add(new Option(PortalConfig.nombreCeco?.(c) ?? c, c)));
    selector.value = nombres.includes(previo) ? previo : '';
  }
  function filtrarCeco(datos) {
    const ceco = $('ceco-programa').value;
    if (!ceco) return datos;
    function sumar(elementos) {
      const totales = {};
      for (const campo of [...campos, 'sin_clasificar']) totales[campo] = elementos.reduce((s,e) => s + (e[campo] || 0), 0);
      return {...totales, porcentaje: cumplimiento(totales)};
    }
    function filtrar(resumen) {
      const regiones = (resumen.regiones || []).map(r => {
        const cecos = r.cecos.filter(c => c.ceco === ceco);
        return {...r, ...sumar(cecos), cecos};
      }).filter(r => r.cecos.length);
      return {...resumen, ...sumar(regiones), regiones};
    }
    return {...filtrar(datos), historico: (datos.historico || []).map(filtrar)};
  }
  function datosRegion(datos) {
    if (!seleccion.region) return datos;
    const region = datos.regiones.find(r => r.region === seleccion.region);
    return {...datos, ...(region || {total: 0, realizadas: 0, regularizadas: 0, no_realizadas: 0, na: 0, sin_clasificar: 0, porcentaje: null}), regiones: region ? [region] : []};
  }
  function prepararRegiones(datos) {
    const nombres = nombresRegiones(datos);
    $('region-programa').replaceChildren();
    for (const nombre of ['', ...nombres]) {
      const opcion = document.createElement('option'); opcion.value = nombre;
      opcion.textContent = nombre || 'Todas las regiones'; $('region-programa').append(opcion);
    }
    if (seleccion.region && !nombres.includes(seleccion.region)) seleccion = {nivel: 'total'};
    $('region-programa').value = seleccion.region || '';
  }
  function historial(datos, porcentaje) {
    const clave = porcentaje ? 'cumplimiento' : 'cantidades';
    const id = 'grafico-' + clave;
    const estado = seleccion;
    const registros = datos.historico || [];
    $(id).replaceChildren();
    if (!registros.length) { $(id).textContent = 'Sin datos históricos disponibles.'; return; }
    const detalleDisponible = registros.every(r => Array.isArray(r.regiones));
    const regiones = [...new Set(registros.flatMap(r => (r.regiones || []).map(g => g.region)))].sort();
    const porLinea = estado.nivel === 'lineas';
    const entidades = porLinea ? [...new Set(registros.flatMap(r => (r.regiones || []).filter(g => g.region === estado.region).flatMap(g => g.cecos.filter(c => c.ceco === estado.ceco).flatMap(c => (c.lineas || []).map(l => l.linea)))))].sort() : estado.nivel === 'total' ? ['Total general'] : estado.nivel === 'regiones' ? regiones :
      [...new Set(registros.flatMap(r => (r.regiones || []).filter(g => g.region === estado.region).flatMap(g => g.cecos.map(c => c.ceco))))].sort();
    const controles = document.createElement('div');
    controles.className = 'config-acciones';
    const ruta = document.createElement('strong');
    ruta.textContent = porLinea ? 'Línea de negocio · ' + (PortalConfig.nombreCeco?.(estado.ceco) ?? estado.ceco) + ' · ' + estado.region : estado.nivel === 'total' ? 'Total general' : estado.nivel === 'regiones' ? 'Todas las regiones' : 'Unidad · ' + estado.region;
    controles.append(ruta);
    const ayuda = document.createElement('p'); ayuda.className = 'nota'; ayuda.dataset.pdfOmitir = '';
    ayuda.textContent = !detalleDisponible ? 'Reinicia el servidor para habilitar el desglose por región y Unidad.' : estado.nivel === 'total' ? 'Pulsa una línea, un punto o su leyenda para ver todas las regiones.' : estado.nivel === 'regiones' ? 'Pulsa una región para ver todas sus unidades.' : estado.nivel === 'cecos' && window.PortalZona?.activa() ? 'Pulsa una unidad para ver sus líneas de negocio.' : porLinea ? 'Detalle de las líneas de negocio de la unidad.' : 'Detalle de todas las unidades de la región.';
    ayuda.textContent += ' Línea continua: programadas; discontinua: realizadas.';
    ayuda.textContent += ' Pasa el mouse por una línea, punto o leyenda para destacar la misma serie en ambos gráficos.';
    const series = [];
    entidades.forEach((nombre, indice) => {
      const baseColor = estado.nivel === 'total' ? '#166887' : 'hsl(' + ((indice * 137.508) % 360) + ',65%,36%)';
      const color = window.PanelTema?.colorGrafico(baseColor) || baseColor;
      (porcentaje ? ['porcentaje'] : ['total', 'realizadas']).forEach(campo => {
        const valores = registros.map(r => {
          let dato = r;
          if (estado.nivel !== 'total') {
            dato = (r.regiones || []).find(g => g.region === (estado.nivel === 'regiones' ? nombre : estado.region));
            if (estado.nivel === 'cecos' || porLinea) dato = dato?.cecos.find(c => c.ceco === (porLinea ? estado.ceco : nombre));
            if (porLinea) dato = dato?.lineas?.find(l => l.linea === nombre);
          }
          return dato ? (campo === 'porcentaje' ? cumplimiento(dato) : dato[campo]) : (porcentaje ? null : 0);
        });
        series.push({nombre, campo, valores, color: estado.nivel === 'total' && campo === 'realizadas' ? (window.PanelTema?.colorGrafico('#2E9E6B') || '#2E9E6B') : color});
      });
    });
    const ancho = Math.max(560, registros.length * 110 + 110), alto = 310;
    const svg = svgNodo('svg', {viewBox: '0 0 ' + ancho + ' ' + alto, role: 'group', 'aria-label': (porcentaje ? 'Cumplimiento' : 'Programadas y realizadas') + ' · ' + ruta.textContent});
    svg.style.minWidth = ancho + 'px';
    const scroll = document.createElement('div'); scroll.style.overflowX = 'auto'; scroll.append(svg);
    const maximo = porcentaje ? 100 : Math.max(1, ...series.flatMap(s => s.valores));
    const y = v => 245 - v / maximo * 200;
    const x = i => 85 + i * (ancho - 150) / Math.max(1, registros.length - 1);
    for (let i = 0; i <= 5; i++) {
      const valor = maximo * i / 5;
      svg.append(svgNodo('line', {x1: 55, x2: ancho - 20, y1: y(valor), y2: y(valor), stroke: '#DDE4EC'}));
      svg.append(svgNodo('text', {x: 48, y: y(valor) + 4, 'text-anchor': 'end', fill: '#5B6B7C'}, numero.format(valor) + (porcentaje ? '%' : '')));
    }
    registros.forEach((r,i) => {
      const etiqueta = svgNodo('text', {x: x(i), y: 275, 'text-anchor': 'middle', fill: '#1B2A3A'});
      etiqueta.append(svgNodo('tspan', {x: x(i)}, nombreMes(r.mes)), svgNodo('tspan', {x: x(i), dy: 17, fill: '#5B6B7C'}, r.mes.slice(0,4)));
      svg.append(etiqueta);
    });
    const leyenda = document.createElement('div'); leyenda.className = 'leyenda';
    series.forEach(s => {
      const etiqueta = s.nombre + (porcentaje ? '' : s.campo === 'total' ? ' · Programadas' : ' · Realizadas');
      const avanzar = () => {
        if (!detalleDisponible || porLinea) return;
        if (estado.nivel === 'cecos') {
          if (window.PortalZona?.activa()) cambiarSeleccion({nivel:'lineas', region:estado.region, ceco:s.nombre});
          return;
        }
        cambiarSeleccion(estado.nivel === 'total' ? {nivel: 'regiones'} : {nivel: 'cecos', region: s.nombre});
      };
      const grupo = svgNodo('g', {'aria-label': etiqueta});
      grupo.setAttribute('tabindex', '0');
      if (detalleDisponible && !porLinea && (estado.nivel !== 'cecos' || window.PortalZona?.activa())) {
        grupo.setAttribute('role', 'button'); grupo.setAttribute('tabindex', '0'); grupo.style.cursor = 'pointer';
        grupo.addEventListener('click', avanzar);
        grupo.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avanzar(); } });
      }
      let d = '', anterior = false;
      s.valores.forEach((v,i) => { if (v === null) { anterior = false; return; } d += (anterior ? ' L' : ' M') + x(i) + ' ' + y(v); anterior = true; });
      const linea = svgNodo('path', {d, fill: 'none', stroke: s.color, 'stroke-width': 3, 'stroke-dasharray': s.campo === 'realizadas' ? '7 4' : 'none'});
      grupo.append(linea);
      grupo.append(svgNodo('path', {d, fill: 'none', stroke: 'transparent', 'stroke-width': 16}));
      s.valores.forEach((v,i) => {
        if (v === null) return;
        const punto = svgNodo('circle', {cx: x(i), cy: y(v), r: 5, fill: s.color, stroke: '#fff', 'stroke-width': 1});
        punto.append(svgNodo('title', {}, etiqueta + ' · ' + registros[i].mes + ': ' + numero.format(v) + (porcentaje ? '%' : '')));
        grupo.append(punto);
        if (series.length <= 2) grupo.append(svgNodo('text', {x: x(i), y: y(v) + (s.campo === 'realizadas' ? 20 : -12), 'text-anchor': 'middle', fill: s.color}, numero.format(v) + (porcentaje ? '%' : '')));
      });
      svg.append(grupo);
      const b = document.createElement('button'); b.type = 'button'; b.style.color = s.color;
      b.dataset.pdfLeyenda = etiqueta;
      b.textContent = (s.campo === 'realizadas' ? '┄ ' : '━ ') + etiqueta;
      b.addEventListener('click', avanzar); leyenda.append(b);
      seriesHistorial.push({grupo, linea, boton: b, serie: s});
      [grupo, b].forEach(nodo => {
        nodo.addEventListener('mouseenter', () => destacarHistorial(s.nombre));
        nodo.addEventListener('mouseleave', () => destacarHistorial(null));
        nodo.addEventListener('focus', () => destacarHistorial(s.nombre));
        nodo.addEventListener('blur', () => destacarHistorial(null));
      });
    });
    $(id).append(controles, ayuda, scroll, leyenda);
  }
  function graficos(datos) {
    seriesHistorial = [];
    historial(datos, true);
    historial(datos, false);
    $('programa-volver').hidden = seleccion.nivel === 'total';
    datos = datosRegion(datos);
    $('titulo-estados').textContent = `Estados · ${nombreMes(datos.mes)} ${datos.mes.slice(0,4)} · ${seleccion.region || 'Todas las regiones'}${$('ceco-programa').value ? ' · ' + $('ceco-programa').value : ''}`;
    const estados = [['Realizadas', datos.realizadas], ['Regularizadas', datos.regularizadas], ['No realizadas', datos.no_realizadas]];
    const total = estados.reduce((s, e) => s + e[1], 0);
    $('leyenda-estados').replaceChildren();
    estados.forEach(([nombre, cantidad], i) => {
      const p = document.createElement('p');
      const marca = document.createElement('span');
      marca.textContent = '● ';
      marca.style.color = window.PanelTema?.colorGrafico(colores[i]) || colores[i];
      p.append(marca, `${nombre}: ${numero.format(cantidad)}`);
      const porcentaje = document.createElement('span');
      porcentaje.className = 'programa-porcentaje-leyenda';
      porcentaje.textContent = ` (${total ? numero.format(cantidad / total * 100) : '0'}%)`;
      porcentaje.hidden = true;
      p.append(porcentaje);
      p.setAttribute('tabindex', '0');
      p.addEventListener('mouseenter', () => { porcentaje.hidden = false; });
      p.addEventListener('mouseleave', () => { porcentaje.hidden = true; });
      p.addEventListener('focus', () => { porcentaje.hidden = false; });
      p.addEventListener('blur', () => { porcentaje.hidden = true; });
      p.dataset.pdfLeyenda = `${nombre}: ${numero.format(cantidad)}`;
      p.dataset.pdfColor = colores[i];
      $('leyenda-estados').append(p);
    });
    const nota = document.createElement('p');
    nota.className = 'nota';
    nota.textContent = `Distribución sobre ${total} patentes realizadas, regularizadas o no realizadas. N/A se excluye.${datos.sin_clasificar ? ` ${datos.sin_clasificar} patentes sin estado válido quedan fuera de la cascada.` : ''}`;
    $('leyenda-estados').append(nota);
    if (!total) { $('grafico-estados').textContent = 'Sin estados disponibles para este mes.'; return; }
    const svg = lienzo('grafico-estados', 600, 320, `Cascada de estados de ${datos.mes} · Cantidad de patentes`);
    const y = cantidad => 260 - cantidad / total * 200;
    svg.append(svgNodo('text', {x: 50, y: 22, fill: '#5B6B7C'}, 'Cantidad de patentes'));
    const marcas = [...new Set(Array.from({length: 5}, (_, i) => Math.round(total * i / 4)))];
    for (const cantidad of marcas) {
      svg.append(svgNodo('line', {x1: 50, x2: 585, y1: y(cantidad), y2: y(cantidad), stroke: '#DDE4EC'}));
      svg.append(svgNodo('text', {x: 43, y: y(cantidad) + 4, 'text-anchor': 'end', fill: '#5B6B7C'}, numero.format(cantidad)));
    }
    let acumulado = 0;
    const barras = [];
    [...estados, ['Total', total]].forEach(([nombre, cantidad], i) => {
      const esTotal = i === estados.length;
      const porcentaje = cantidad / total * 100;
      if (!esTotal) acumulado += cantidad;
      const x = 70 + i * 130;
      const color = esTotal ? '#D5DAE1' : colores[i];
      const altura = cantidad / total * 200;
      const etiqueta = `${nombre}: ${numero.format(cantidad)} (${numero.format(porcentaje)}%) · Acumulado: ${numero.format(acumulado)} patentes (${numero.format(acumulado / total * 100)}%)`;
      const grupo = svgNodo('g', {tabindex: 0, 'aria-label': etiqueta});
      grupo.append(svgNodo('title', {}, etiqueta));
      grupo.append(svgNodo('rect', {x, y: y(acumulado), width: 90, height: altura, fill: color}));
      grupo.append(svgNodo('rect', {x, y: y(acumulado) - 20, width: 90, height: Math.max(42, altura + 30), fill: 'transparent'}));
      const valorPorcentaje = svgNodo('text', {x: x + 45, y: y(acumulado) - 12, 'text-anchor': 'middle', fill: '#1B2A3A', 'font-weight': 'bold', class:'programa-porcentaje-estado', visibility:'hidden', 'pointer-events':'none'}, `${numero.format(porcentaje)}%`);
      grupo.append(valorPorcentaje);
      grupo.append(svgNodo('text', {x: x + 45, y: y(acumulado) + (altura >= 22 ? Math.min(20, altura / 2 + 4) : altura + 14), 'text-anchor': 'middle', fill: altura >= 22 && !esTotal ? '#fff' : '#1B2A3A', 'font-weight': 'bold'}, numero.format(cantidad)));
      grupo.append(svgNodo('text', {x: x + 45, y: 292, 'text-anchor': 'middle', fill: '#1B2A3A'}, nombre));
      if (i < estados.length) svg.append(svgNodo('line', {x1: x + 90, x2: x + 130, y1: y(acumulado), y2: y(acumulado), stroke: '#7C8998', 'stroke-dasharray': '4 3'}));
      svg.append(grupo);
      barras.push(grupo);
      const enfocar = () => { barras.forEach(b => { b.style.opacity = b === grupo ? '1' : '0.2'; }); valorPorcentaje.setAttribute('visibility','visible'); };
      const restaurar = () => { barras.forEach(b => { b.style.opacity = '1'; }); valorPorcentaje.setAttribute('visibility','hidden'); };
      grupo.addEventListener('mouseenter', enfocar);
      grupo.addEventListener('mouseleave', restaurar);
      grupo.addEventListener('focus', enfocar);
      grupo.addEventListener('blur', restaurar);
    });
  }
  $('mes').value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  function semaforo(p) {
    const span = document.createElement('span');
    span.className = `semaforo ${p === null ? 'neutro' : p >= 90 ? 'verde' : p >= 70 ? 'amarillo' : 'rojo'}`;
    span.textContent = p === null ? '—' : `${numero.format(p)}%`;
    span.title = p === null ? 'Sin patentes aplicables' : p >= 90 ? 'Verde' : p >= 70 ? 'Amarillo' : 'Rojo';
    return span;
  }
  function fila(nombre, datos, clase) {
    const tr = document.createElement('tr');
    tr.className = clase;
    for (const valor of [nombre, ...campos.map(c => numero.format(datos[c]))]) {
      const td = document.createElement('td');
      td.textContent = valor;
      tr.append(td);
    }
    const td = document.createElement('td');
    td.append(semaforo(datos.porcentaje));
    tr.append(td);
    return tr;
  }
  function estadoTabla() {
    for (const nodo of nodosTabla) {
      const contraido = gruposContraidos.has(nodo.clave);
      nodo.fila.hidden = Boolean(nodo.padre && (nodo.padre.fila.hidden || gruposContraidos.has(nodo.padre.clave)));
      nodo.boton.textContent = `${contraido ? '▸' : '▾'} ${nodo.nombre}`;
      nodo.boton.setAttribute('aria-expanded', String(!contraido));
      nodo.boton.title = contraido ? 'Expandir grupo' : 'Contraer grupo';
      nodo.hijos.forEach(f => { f.hidden = nodo.fila.hidden || contraido; });
    }
    const expandidos = nodosTabla.every(n => !gruposContraidos.has(n.clave));
    $('programa-alternar-grupos').textContent = expandidos ? 'Contraer todo' : 'Expandir todo';
    $('programa-alternar-grupos').disabled = !nodosTabla.length;
    $('programa-alternar-grupos').setAttribute('aria-expanded', String(expandidos));
  }
  function grupoTabla(nombre, datos, clase, clave, padre=null) {
    const tr = fila(nombre, datos, clase), celda = tr.children[0];
    celda.textContent = '';
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'programa-grupo-boton';
    boton.setAttribute('aria-controls', 'detalle'); celda.append(boton);
    const nodo = {nombre, fila:tr, boton, clave, padre, hijos:[]};
    nodosTabla.push(nodo); $('detalle').append(tr);
    boton.onclick = () => {
      if (gruposContraidos.has(clave)) gruposContraidos.delete(clave);
      else gruposContraidos.add(clave);
      estadoTabla();
    };
    return nodo;
  }
  function renderizar(fuente) {
    const zona = Boolean(window.PortalZona?.activa());
    if (modoTabla !== zona) { mostrarLineas = false; gruposContraidos.clear(); modoTabla = zona; }
    if (!zona && seleccion.nivel === 'lineas') seleccion = {nivel:'cecos',region:seleccion.region};
    fuente = aplicarConfiguracion(fuente);
    prepararCecos(fuente);
    if (seleccion.nivel === 'lineas' && $('ceco-programa').value !== seleccion.ceco) seleccion = {nivel:'cecos',region:seleccion.region};
    fuente = filtrarCeco(fuente);
    const visibles = nombresRegiones(fuente).length;
    $('programa-alcance').textContent = visibles ? `${visibles} regiones incluidas. Los gráficos y totales consideran solo las regiones configuradas.` : 'No hay regiones incluidas. Abre Configuraciones para seleccionar las regiones que quieres mostrar.';
    const datos = datosRegion(fuente);
      $('detalle').replaceChildren();
      nodosTabla = [];
      $('programa-alternar-lineas').hidden = !zona;
      $('programa-alternar-lineas').textContent = mostrarLineas ? 'Ocultar líneas' : 'Mostrar por línea';
      $('programa-alternar-lineas').setAttribute('aria-pressed', String(mostrarLineas));
      $('programa-alternar-lineas').disabled = !datos.regiones.length;
      $('totales').replaceChildren(fila(seleccion.region ? 'TOTAL REGIÓN' : 'TOTAL GENERAL', datos, 'total'));
      for (const region of datos.regiones) {
        const padre = grupoTabla(region.region, region, 'region', JSON.stringify([zona,region.region]));
        for (const ceco of region.cecos) {
          const nombre = PortalConfig.nombreCeco?.(ceco.ceco) ?? ceco.ceco;
          if (zona && mostrarLineas && ceco.lineas?.length) {
            const unidad = grupoTabla(nombre, ceco, 'ceco', JSON.stringify([zona,region.region,ceco.ceco]), padre);
            for (const l of ceco.lineas) {
              const tr = fila('Línea: '+(l.linea || 'SIN LÍNEA'), {...l,porcentaje:cumplimiento(l)}, 'zona-linea');
              $('detalle').append(tr); unidad.hijos.push(tr);
            }
          } else {
            const tr = fila(nombre, ceco, 'ceco'); $('detalle').append(tr); padre.hijos.push(tr);
          }
        }
      }
      estadoTabla();
      $('kpis').replaceChildren();
      for (const [titulo, valor, color] of [['Programadas', datos.total, 'azul'], ['Realizadas', datos.realizadas, 'verde'], ['Regularizadas', datos.regularizadas, 'amarillo'], ['No realizadas', datos.no_realizadas, 'rojo'], ['N/A', datos.na, 'neutro']]) {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'kpi';
        tarjeta.dataset.kpiColor = color;
        const etiqueta = document.createElement('span');
        etiqueta.textContent = titulo;
        const cantidad = document.createElement('b');
        cantidad.textContent = numero.format(valor);
        tarjeta.append(etiqueta, cantidad);
        $('kpis').append(tarjeta);
      }
      graficos(fuente);
      $('periodo').textContent = `${nombreMes(datos.mes)} ${datos.mes.slice(0,4)} · ${seleccion.region || 'Todas las regiones'}${$('ceco-programa').value ? ' · ' + $('ceco-programa').value : ''}`;
  }
  async function consultar(event) {
    event?.preventDefault();
    if (!$('programa-form').reportValidity()) return;
    $('consultar').disabled = true;
    $('mes').disabled = true;
    $('region-programa').disabled = true;
    $('ceco-programa').disabled = true;
    $('resultados').hidden = true;
    $('avisos').hidden = true;
    $('estado').className = '';
    $('estado').textContent = 'Leyendo hoja PROGRAMA…';
    try {
      const respuesta = await PortalDatos.consultar(`/api/programa-mantencion?mes=${encodeURIComponent($('mes').value)}`);
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo consultar el programa.');
      datosActuales = datos;PortalConfig.registrarCecos?.(datos);
      prepararRegiones(aplicarConfiguracion(datos));
      configurar();
      renderizar(datos);
      $('avisos').textContent = datos.advertencias.map(a => PortalConfig.textoUnidad?.(a) ?? a).join(' ');
      $('avisos').hidden = !datos.advertencias.length;
      $('fuente').textContent = `Fuente: ${datos.fuente} · ${datos.hoja}`;
      $('estado').textContent = datos.total ? 'Programa actualizado.' : 'No hay patentes programadas para el mes seleccionado.';
      $('resultados').hidden = false;
    } catch (error) {
      $('estado').className = 'error';
      $('estado').textContent = error.message;
    } finally {
      $('consultar').disabled = false;
      $('mes').disabled = false;
      $('region-programa').disabled = false;
      $('ceco-programa').disabled = false;
    }
  }
  $('programa-form').addEventListener('submit', consultar);
  $('programa-volver').onclick = () => {
    if (seleccion.nivel === 'lineas') cambiarSeleccion({nivel:'cecos',region:seleccion.region});
    else if (seleccion.nivel === 'cecos') cambiarSeleccion({nivel:'regiones'});
    else cambiarSeleccion({nivel:'total'});
  };
  $('programa-alternar-lineas').onclick = () => {
    if (!window.PortalZona?.activa() || !datosActuales) return;
    mostrarLineas = !mostrarLineas;
    renderizar(datosActuales);
  };
  $('programa-alternar-grupos').onclick = () => {
    if (nodosTabla.some(n => gruposContraidos.has(n.clave))) gruposContraidos.clear();
    else nodosTabla.forEach(n => gruposContraidos.add(n.clave));
    estadoTabla();
  };
  $('mes').addEventListener('change', consultar);
  $('region-programa').addEventListener('change', () => cambiarSeleccion($('region-programa').value ? {nivel: 'cecos', region: $('region-programa').value} : {nivel: 'total'}));
  $('ceco-programa').addEventListener('change', () => {
    if (!datosActuales) return;
    const ceco = $('ceco-programa').value;
    if (window.PortalZona?.activa() && ceco) {
      const region = seleccion.region || aplicarConfiguracion(datosActuales).regiones.find(r => r.cecos.some(c => c.ceco === ceco))?.region;
      cambiarSeleccion({nivel:'lineas',region,ceco});
    } else {
      if (seleccion.nivel === 'lineas') seleccion = {nivel:'cecos',region:seleccion.region};
      renderizar(datosActuales);
    }
  });
  consultar();
})();
