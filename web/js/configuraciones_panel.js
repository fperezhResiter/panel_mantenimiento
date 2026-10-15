'use strict';
(() => {
  if (PortalDatos.consulta) return;
  let modo = 'region';
  try { modo = localStorage.getItem('resiter.mantenimiento.agrupacion') === 'zona' ? 'zona' : 'region'; } catch {}
  const $ = id => document.getElementById(id), config = PortalConfig;
  function casilla(contenedor, texto, tipo, valor, incluida) {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.checked = incluida; input.disabled = PortalDatos.consulta; input.dataset.tipo = tipo; input.dataset.valor = valor;
    input.addEventListener('change', () => { config.seleccionar(tipo, valor, input.checked); $('config-estado').textContent = config.aviso(); });
    label.append(input, document.createTextNode(texto)); contenedor.append(label); return input;
  }
  function render() {
    const estado = config.estado();
    $('config-regiones').replaceChildren();
    const esZona = modo === 'zona';
    $('modo-zona').textContent = esZona ? 'Modo región' : 'Modo zona';
    $('modo-zona').setAttribute('aria-pressed', String(esZona));
    $('config-titulo').textContent = esZona ? 'Zonas y unidades compartidas' : 'Regiones y unidades compartidas';
    const grupos = [...new Set(esZona ? [...estado.catalogo_zonas, ...estado.zonas] : [...estado.catalogo, ...estado.regiones])].sort();
    const relaciones = (esZona ? estado.unidades_zonas : estado.unidades_regiones).map(v=>JSON.parse(v));
    for (const nombre of grupos) {
      const grupo = document.createElement('fieldset'), leyenda = document.createElement('legend');
      grupo.className = 'config-grupo';
      const incluida = esZona ? config.zonaIncluida(nombre) : config.incluida(nombre);
      casilla(leyenda, nombre, esZona ? 'zonas' : 'regiones', nombre, incluida);
      const unidades = document.createElement('div'); unidades.className = 'config-unidades';
      const nombres = [...new Set(relaciones.filter(([g])=>g===nombre).map(([,u])=>u))].sort();
      for (const unidad of nombres) casilla(unidades, config.nombreCeco(unidad), 'cecos', unidad, config.cecoIncluido(unidad));
      unidades.querySelectorAll('input').forEach(input=>input.disabled = !incluida);
      grupo.append(leyenda, unidades); $('config-regiones').append(grupo);
    }
    if (!grupos.length) $('config-regiones').textContent = 'Actualiza los datos desde la BD para cargar esta agrupación.';
    $('config-todas').disabled = $('config-ninguna').disabled = !grupos.length;
    $('config-restaurar').disabled = PortalDatos.consulta;
    $('config-vistas').replaceChildren();
    for (const [id, [titulo, vistas]] of Object.entries(config.paneles)) {
      const grupo = document.createElement('fieldset'), leyenda = document.createElement('legend');
      grupo.className = 'config-grupo'; leyenda.textContent = titulo; grupo.append(leyenda);
      for (const [vista, texto] of vistas) casilla(grupo, texto, 'ocultos', id + '.' + vista, !estado.ocultos.includes(id + '.' + vista));
      $('config-vistas').append(grupo);
    }
    $('config-estado').textContent = config.aviso();
  }
  async function cargar() {
    $('config-recargar').disabled = true; $('config-carga').textContent = 'Cargando regiones de los reportes…';
    const hoy = PortalDatos.fechaActual(), fecha = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
    const urls = ['/api/reporte?fecha='+fecha, '/api/seguimiento-km-hr?inicio=2026-08-04&fecha='+fecha, '/api/programa-mantencion?mes='+fecha.slice(0,7)];
    const resultados = await Promise.allSettled(urls.map(async url => {
      const respuesta = await PortalDatos.consultar(url, {cache:'no-store'}), datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo consultar la BD.');
      config.registrarCecos(datos); config.registrarDatos(datos);
      config.registrar([...(datos.regiones || []).map(r=>r.region), ...(datos.equipos || []).map(e=>e.region), ...(datos.historico || []).flatMap(m=>(m.regiones || []).map(r=>r.region))], url.includes('/api/reporte?') ? (datos.regiones || []).flatMap(r=>r.cecos.map(c=>c.ceco)) : []);
    }));
    const errores = resultados.filter(r=>r.status==='rejected');
    $('config-carga').textContent = errores.length ? `Se cargaron ${3-errores.length} de 3 fuentes. Se mantienen las regiones conocidas. ${errores.map(e=>e.reason.message).join(' ')}` : 'Regiones actualizadas desde los tres orígenes de datos.';
    $('config-recargar').disabled = false; render();
  }
  $('config-todas').onclick = () => modo === 'zona' ? config.zonasTodas(true) : config.regionesTodas(true);
  $('config-ninguna').onclick = () => modo === 'zona' ? config.zonasTodas(false) : config.regionesTodas(false);
  $('modo-zona').onclick = () => { modo = modo === 'zona' ? 'region' : 'zona'; try { localStorage.setItem('resiter.mantenimiento.agrupacion', modo); } catch {} render(); };
  $('config-restaurar').onclick = () => config.restaurarVistas();
  $('config-recargar').onclick = cargar;
  window.addEventListener('portal-config', render);
  render(); cargar();
})();
