'use strict';
// Única fuente de preferencias para todos los reportes del portal.
(() => {
  const clave = 'resiter.portal.config.v1';
  const normalizar = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
  let aviso = '';
  const leer = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { aviso = 'No se pudo leer el almacenamiento del navegador.'; return null; } };
  const lista = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  function cargar() {
    const c = leer(clave);
    if (c && typeof c === 'object') return {regiones: lista(c.regiones), cecos: lista(c.cecos), catalogo: lista(c.catalogo), centros: lista(c.centros), ocultos: lista(c.ocultos), calendario_excluidas: lista(c.calendario_excluidas), ...Object.fromEntries(['zonas','catalogo_zonas','unidades_regiones','unidades_zonas'].map(k=>[k,lista(c[k])]))};
    const r = leer('resiter.reportabilidad.config.v1') || {}, m = leer('resiter.mantenciones.config.v1') || {};
    return {regiones: [...new Set([...lista(r.regiones), ...lista(m.regiones), ...lista(leer('resiter.programa.config.v1'))].map(normalizar))], cecos: lista(r.cecos), catalogo: [], centros: [], ocultos: [], calendario_excluidas: []};
  }
  let codigosCecos = {};
  const etiquetasCecos = new Map();
  function nombreCeco(nombre) {
    const codigo = codigosCecos[normalizar(nombre)];
    if (!codigo) return nombre;
    const etiqueta = `${nombre} (${codigo})`;
    etiquetasCecos.set(etiqueta, nombre);
    return etiqueta;
  }
  function limpiarCecosPDF(raiz) {
    const textos = raiz.ownerDocument.createTreeWalker(raiz, 4);
    const etiquetas = [...etiquetasCecos].sort((a,b) => b[0].length-a[0].length);
    while (textos.nextNode()) {
      const nodo = textos.currentNode;
      for (const [etiqueta, nombre] of etiquetas) nodo.nodeValue = nodo.nodeValue.split(etiqueta).join(nombre);
    }
  }
  const camposNuevos = ['zonas', 'catalogo_zonas', 'unidades_regiones', 'unidades_zonas'];
  function completar(c) {
    for (const campo of ['regiones','cecos','catalogo','centros','ocultos','calendario_excluidas', ...camposNuevos]) c[campo] = lista(c[campo]);
    return c;
  }
  let estado = completar(cargar());
  let cola = Promise.resolve();
  const paneles = {
    reportabilidad: ['Reportabilidad', [['evolucion','Evolución semanal'],['barras','Cumplimiento por región / Unidad'],['tabla','Detalle por región y Unidad']]],
    seguimiento: ['Seguimiento KM-HR', [['lecturas','Lecturas semanales'],['ritmo','Uso diario'],['tabla','Detalle de equipos']]],
    resumen: ['Resumen de mantención', [['tabla','Resumen por región y Unidad'],['patentes','Detalle de patentes']]],
    calendario: ['Calendario de mantención', [['calendario','Calendario mensual'],['agenda','Tabla de agenda']]],
    programa: ['Programa de mantención', [['cumplimiento','Cumplimiento mensual'],['cantidades','Programadas y realizadas'],['estados','Distribución de estados'],['tabla','Detalle por región y Unidad']]]
  };
  function persistir() {
    if (window.PortalDatos?.consulta) return;
    const datos = JSON.stringify(estado);
    aviso = 'Guardando configuración en la BD…';
    cola = cola.then(async () => {
      const r = await fetch('/api/configuracion', {method:'POST', headers:{'Content-Type':'application/json'}, body:datos});
      const resultado = await r.json();
      if (!r.ok) throw new Error(resultado.error || 'No se pudo guardar la configuración.');
      try { localStorage.setItem(clave, datos); } catch { /* La BD ya conserva la configuración. */ }
      aviso = 'Configuración guardada en la BD y en la publicación sin servidor.';
    }).catch(error => { aviso = 'No se guardó en la BD: '+error.message; }).then(() => {
      for (const id of ['config-estado', 'mt-config-estado']) {
        const etiqueta = document.getElementById(id);
        if (etiqueta) etiqueta.textContent = aviso;
      }
    });
  }
  function aplicar() {
    document.querySelectorAll('[data-vista]').forEach(el => el.classList.toggle('vista-oculta', estado.ocultos.includes(el.dataset.vista)));
    document.querySelectorAll('[data-grupo-vistas]').forEach(el => el.classList.toggle('vista-oculta', [...el.querySelectorAll('[data-vista]')].every(n => n.classList.contains('vista-oculta'))));
  }
  function cambiar() { persistir(); aplicar(); window.dispatchEvent(new Event('portal-config')); }
  window.PortalConfig = {
    paneles, normalizar, nombreCeco, limpiarCecosPDF,
    textoUnidad: texto => String(texto).replace(/Los CeCo/g, 'Las unidades').replace(/Hay CeCo/g, 'Hay unidades').replace(/ese CeCo/g, 'esa unidad').replace(/\bCeCo\b/g, 'unidad').replace(/\bSIN CECO\b/g, 'SIN UNIDAD'),
    registrarCecos: datos => { codigosCecos = datos.cecos_codigos || {}; },
    incluida: region => !estado.regiones.includes(normalizar(region)),
    cecoIncluido: ceco => !estado.cecos.some(c => normalizar(c) === normalizar(ceco)),
    zonaIncluida: zona => !estado.zonas.includes(normalizar(zona)),
    calendarioIncluida: patente => !estado.calendario_excluidas.includes(patente),
    estado: () => JSON.parse(JSON.stringify(estado)),
    aviso: () => aviso,
    registrar(regiones, centros = []) {
      const nuevas = [...new Set([...estado.catalogo, ...regiones].filter(x => typeof x === 'string').map(normalizar))].sort();
      const cecos = [...new Set([...estado.centros, ...centros])].sort();
      if (JSON.stringify(nuevas) !== JSON.stringify(estado.catalogo) || JSON.stringify(cecos) !== JSON.stringify(estado.centros)) { estado.catalogo = nuevas; estado.centros = cecos; persistir(); }
    },
    registrarDatos(datos) {
      const regiones = new Set(estado.catalogo), centros = new Set(estado.centros), zonas = new Set(estado.catalogo_zonas);
      const ur = new Set(estado.unidades_regiones), uz = new Set(estado.unidades_zonas);
      const agregar = (region, unidad, zona) => {
        if (region) { regiones.add(normalizar(region)); ur.add(JSON.stringify([normalizar(region), unidad])); }
        centros.add(unidad);
        if (zona) { zonas.add(normalizar(zona)); uz.add(JSON.stringify([normalizar(zona), unidad])); }
      };
      for (const resumen of [datos, ...(datos.historico || [])])
        for (const r of resumen.regiones || []) for (const c of r.cecos || []) agregar(r.region, c.ceco);
      for (const e of datos.equipos || []) agregar(e.region, e.ceco, e.zona);
      for (const grupos of [datos.detalle_zona, ...(datos.historico_zona || []).map(m=>m.regiones)])
        for (const r of grupos || []) for (const c of r.cecos || []) {
          const [zona, unidad] = JSON.parse(c.ceco); agregar(null, unidad, zona);
        }
      const nuevo = {catalogo:[...regiones].sort(), centros:[...centros].sort(), catalogo_zonas:[...zonas].sort(), unidades_regiones:[...ur].sort(), unidades_zonas:[...uz].sort()};
      if (Object.entries(nuevo).some(([k,v])=>JSON.stringify(v)!==JSON.stringify(estado[k]))) { Object.assign(estado,nuevo); persistir(); }
    },
    seleccionar(tipo, valor, incluir) { if (window.PortalDatos?.consulta) return; const claveValor = ['regiones','zonas'].includes(tipo) ? normalizar(valor) : valor; estado[tipo] = estado[tipo].filter(x => x !== claveValor); if (!incluir) estado[tipo].push(claveValor); cambiar(); },
    regionesTodas(incluir) { if (window.PortalDatos?.consulta) return; estado.regiones = incluir ? [] : [...estado.catalogo]; cambiar(); },
    zonasTodas(incluir) { if (window.PortalDatos?.consulta) return; estado.zonas = incluir ? [] : [...estado.catalogo_zonas]; cambiar(); },
    restaurarVistas() { if (window.PortalDatos?.consulta) return; estado.ocultos = []; cambiar(); }
  };
  if (window.PortalDatos) window.PortalConfig.listo = (async () => {
    if (PortalDatos.consulta) {
      const p = await PortalDatos.listo;
      estado = p.configuracion || {regiones:[],cecos:[],catalogo:[],centros:[],ocultos:[]};
      aviso = 'Consulta sin servidor: configuración de la última publicación.';
    } else {
      const r = await fetch('/api/configuracion');
      const c = await r.json();
      if (!r.ok) throw new Error(c.error);
      if (c) estado = c;
      else { persistir(); await cola; }
    }
    estado = completar(estado);
    aplicar(); window.dispatchEvent(new Event('portal-config'));
  })().catch(error => { aviso = error.message; });
  window.addEventListener('storage', e => { if (!window.PortalDatos?.consulta && (e.key === clave || e.key === null)) { estado = cargar(); aplicar(); window.dispatchEvent(new Event('portal-config')); } });
  aplicar();
})();
