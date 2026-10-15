'use strict';
// Los resultados originales permanecen disponibles; cada consulta elige su vista.
(() => {
  const config = window.PortalConfig;
  if (!config || document.body.dataset.panel === 'configuraciones') return;
  const formulario = document.querySelector('form.filtros');
  if (!formulario) return;
  const crearSelector = (id, titulo, opciones) => {
    const label = document.createElement('label'), select = document.createElement('select');
    select.id = id; label.append(document.createTextNode(titulo), select);
    opciones.forEach(([texto, valor]) => select.add(new Option(texto, valor)));
    const unidad = formulario.querySelector('#buscar,#km-ceco,#mt-ceco-resumen,#mt-ceco-cal,#ceco-programa')?.closest('label');
    if (unidad) unidad.after(label);
    else formulario.append(label);
    return select;
  };
  const linea = crearSelector('zona-linea', 'Línea de negocio', [['Todas las líneas', '']]);
  let modo = 'region';
  try { modo = localStorage.getItem('resiter.mantenimiento.agrupacion') === 'zona' ? 'zona' : 'region'; } catch {}
  const botonZona = document.createElement('button');
  botonZona.id = 'modo-zona'; botonZona.type = 'button'; botonZona.textContent = 'Modo zona';
  botonZona.className = 'boton-modo-zona'; botonZona.dataset.pdfOmitir = '';
  const inicio = document.querySelector('header .volver-inicio');
  if (inicio) {
    const acciones = document.createElement('div'); acciones.className = 'acciones-cabecera';
    inicio.before(acciones); acciones.append(inicio, botonZona);
  }
  // El menú universal se monta al terminar el documento. Mantener esta unión
  // aquí evita perderla cuando se regeneran los controles compartidos.
  function agruparCabecera() {
    const controles = document.querySelector('header .controles-universales');
    const acciones = botonZona.closest('.acciones-cabecera');
    if (controles && acciones && acciones.parentElement !== controles) controles.prepend(acciones);
  }
  agruparCabecera();
  document.addEventListener('DOMContentLoaded', agruparCabecera, {once:true});
  let aviso = document.createElement('p');
  aviso.className = 'nota'; aviso.id = 'zona-aviso'; aviso.dataset.pdfOmitir = ''; formulario.after(aviso);
  const esZona = () => modo === 'zona';
  const incluirRegion = config.incluida;
  const registrar = config.registrar;
  config.incluida = r => esZona() && (r.startsWith('ZONA ') || r === 'SIN ZONA') ? config.zonaIncluida(r) : incluirRegion(r);
  config.registrar = (regiones, centros) => registrar(regiones.filter(r => !r.startsWith('ZONA ') && r !== 'SIN ZONA'), centros);
  const campos = ['reportadas', 'total', 'fuera_maestro', 'realizadas', 'regularizadas', 'no_realizadas', 'na', 'sin_clasificar'];
  function sumar(filas) {
    const resultado = {};
    campos.forEach(c => { if (filas.some(f => c in f)) resultado[c] = filas.reduce((s,f) => s+(f[c] || 0), 0); });
    ['historico', 'historico_completo'].forEach(c => {
      if (filas.some(f => Array.isArray(f[c]))) resultado[c] = Array.from({length: Math.max(...filas.map(f => f[c]?.length || 0))}, (_,i) => filas.reduce((s,f) => s+(f[c]?.[i] || 0), 0));
    });
    const base = 'reportadas' in resultado ? resultado.total : resultado.total - (resultado.na || 0);
    resultado.porcentaje = base ? 100*('reportadas' in resultado ? resultado.reportadas : (resultado.realizadas || 0)+(resultado.regularizadas || 0))/base : null;
    return resultado;
  }
  function reagrupar(detalle, originales) {
    const permitidas = new Set((originales || []).filter(r => incluirRegion(r.region)).flatMap(r => r.cecos.map(c => c.ceco)));
    return (detalle || []).filter(r => config.zonaIncluida(r.region)).map(r => {
      const unidades = new Map();
      for (const c of r.cecos) {
        const [,unidad,nombreLinea] = JSON.parse(c.ceco);
        if (!permitidas.has(unidad) || !config.cecoIncluido(unidad) || (linea.value && linea.value !== nombreLinea)) continue;
        if (!unidades.has(unidad)) unidades.set(unidad, []);
        unidades.get(unidad).push({...c, ceco:unidad, linea:nombreLinea});
      }
      const cecos = [...unidades].sort(([a],[b]) => a.localeCompare(b,'es')).map(([ceco,lineas]) => ({ceco,lineas:lineas.sort((a,b)=>a.linea.localeCompare(b.linea,'es')), ...sumar(lineas)}));
      return {...r, cecos, ...sumar(cecos)};
    }).filter(r => r.cecos.length);
  }
  function preparar(datos) {
    if (!esZona()) return datos;
    if (!datos.detalle_zona && !datos.equipos?.every(e => 'zona' in e)) throw new Error('Actualiza la publicación con Actualizar_BD.bat para habilitar el modo zona.');
    const nombres = new Set(datos.equipos ? datos.equipos.map(e => e.linea) : [datos.detalle_zona, ...(datos.historico_zona || []).map(m=>m.regiones)].flatMap(rs => (rs || []).flatMap(r=>r.cecos.map(c=>JSON.parse(c.ceco)[2]))));
    const previa = linea.value;
    linea.replaceChildren(new Option('Todas las líneas', ''));
    [...nombres].sort().forEach(l => linea.add(new Option(l,l)));
    linea.value = nombres.has(previa) ? previa : '';
    if (datos.equipos) {
      const equipos = datos.equipos.filter(e=>incluirRegion(e.region) && config.cecoIncluido(e.ceco) && config.zonaIncluida(e.zona) && (!linea.value || e.linea === linea.value)).map(e=>({...e, region_original:e.region, region:e.zona}));
      const panel = document.body.dataset.panel;
      const agrupacion = ['seguimiento','calendario'].includes(panel) ? 'Zona → Unidad. Usa Mostrar por línea para agregar el desglose de líneas de negocio.' : panel === 'resumen' ? 'Zona → Unidad. Pulsa una unidad o Expandir líneas para ver sus líneas de negocio.' : 'Zona → Unidad → Línea de negocio.';
      aviso.textContent = `${agrupacion} ${equipos.filter(e=>e.zona==='SIN ZONA').length} equipos sin zona identificable; se conservan en SIN ZONA. La unidad de medida KM/HR se mantiene separada.`;
      return {...datos,equipos};
    }
    const regiones = reagrupar(datos.detalle_zona, datos.regiones);
    aviso.textContent = 'Zona → Unidad → Línea de negocio. Los casos sin asociación única se conservan en SIN ZONA o SIN LÍNEA. Los filtros de Configuraciones se aplican antes de agrupar.';
    return {...datos, ...sumar(regiones), regiones, historico:datos.historico_zona ? datos.historico_zona.map(m=>({...m, regiones:reagrupar(m.regiones, datos.historico.find(o=>o.mes===m.mes)?.regiones)})) : datos.historico};
  }
  const consultar = PortalDatos.consultar;
  PortalDatos.consultar = async (...args) => {
    const respuesta = await consultar(...args);
    if (!respuesta.ok || !/\/api\/(reporte|seguimiento-km-hr|mantenciones|programa-mantencion)\?/.test(args[0])) return respuesta;
    const datos = await respuesta.json();
    config.registrarDatos(datos);
    try { const vista = preparar(datos); return {ok:respuesta.ok, status:respuesta.status, json:async()=>vista}; }
    catch(error) { return {ok:false,status:400,json:async()=>({error:error.message})}; }
  };
  function etiquetas() {
    linea.parentElement.hidden = !esZona(); aviso.hidden = !esZona();
    botonZona.setAttribute('aria-pressed', String(esZona()));
    const textoBoton = esZona() ? 'Modo región' : 'Modo zona';
    if (botonZona.textContent !== textoBoton) botonZona.textContent = textoBoton;
    botonZona.title = esZona() ? 'Volver a agrupar por región' : 'Agrupar por zona, unidad y línea';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const nodo = walker.currentNode;
      if (nodo.parentElement.closest('#modo-zona, #zona-aviso, script, .navegacion-paneles')) continue;
      const patrones = esZona() ? [/Regiones/g,/regiones/g,/Región/g,/región/g] : [/Zonas/g,/zonas/g,/Zona/g,/zona/g];
      const textos = esZona() ? ['Zonas','zonas','Zona','zona'] : ['Regiones','regiones','Región','región'];
      patrones.forEach((p,i)=>{ nodo.nodeValue = nodo.nodeValue.replace(p,textos[i]); });
      nodo.nodeValue = esZona()
        ? nodo.nodeValue.replace(/Zona \/ Unidad(?! \/ Línea)/g,'Zona / Unidad / Línea').replace(/por zona y Unidad/g,'por zona, Unidad y Línea')
        : nodo.nodeValue.replace(/Región \/ Unidad \/ Línea/g,'Región / Unidad').replace(/por región, Unidad y Línea/g,'por región y Unidad');
    }
  }
  function recargar(restablecer = false) {
    if (restablecer) document.querySelectorAll('#region,#buscar,#km-region,#km-ceco,#mt-region-resumen,#mt-ceco-resumen,#mt-region-cal,#mt-ceco-cal,#region-programa,#ceco-programa').forEach(s=>s.value='');
    etiquetas(); formulario.requestSubmit();
  }
  botonZona.onclick = () => {
    modo = esZona() ? 'region' : 'zona';
    try { localStorage.setItem('resiter.mantenimiento.agrupacion', modo); } catch {}
    linea.value = ''; recargar(true);
  };
  linea.onchange = () => recargar();
  let regionesConfiguradas = JSON.stringify([config.estado().regiones, config.estado().cecos, config.estado().zonas]);
  window.addEventListener('portal-config', () => {
    const nuevas = JSON.stringify([config.estado().regiones, config.estado().cecos, config.estado().zonas]);
    if (nuevas !== regionesConfiguradas) {
      regionesConfiguradas = nuevas;
      if (esZona()) formulario.requestSubmit();
    }
  });
  const observador = new MutationObserver(()=>{ observador.disconnect(); etiquetas(); observador.observe(document.body,{childList:true,subtree:true}); });
  observador.observe(document.body,{childList:true,subtree:true});
  window.PortalZona = {activa:esZona, sumar}; etiquetas();
})();
