'use strict';
(() => {
  const consulta = location.protocol === 'file:' || location.pathname.startsWith('/principal/');
  const listo = consulta ? (async () => {
    if (!window.PublicacionMantenimientoGzip) throw new Error('No hay publicación disponible. Ejecuta Actualizar_BD.bat en Mantenimiento.');
    const bytes = Uint8Array.from(atob(window.PublicacionMantenimientoGzip), c => c.charCodeAt(0));
    const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(flujo).text());
  })() : Promise.resolve(null);
  listo.catch(() => {});
  const copia = valor => JSON.parse(JSON.stringify(valor));
  async function consultar(url, opciones) {
    if (window.PortalConfig?.listo) await window.PortalConfig.listo;
    if (!consulta) return fetch(url, opciones);
    try {
      const p = await listo, u = new URL(url, 'http://panel.local'), q = u.searchParams;
      let datos;
      if (opciones?.method && opciones.method !== 'GET') throw new Error('Consulta sin servidor: no se permite guardar cambios.');
      if (u.pathname === '/api/bd') datos = p.estado;
      else if (u.pathname === '/api/configuracion') datos = p.configuracion;
      else if (u.pathname === '/api/reporte') {
        const d = new Date(q.get('fecha') + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1 - ((d.getUTCDay()+6)%7));
        datos = p.reportes[d.toISOString().slice(0,10)];
        if (!datos) throw new Error('Esta semana no está publicada. Selecciona una semana desde 04-08-2026 hasta la última actualización.');
      } else if (['/api/seguimiento-km-hr', '/api/mantenciones'].includes(u.pathname)) {
        const inicio = q.get('inicio') || '2026-08-04', fecha = q.get('fecha');
        if (fecha < inicio) throw new Error('La última semana debe ser igual o posterior al inicio.');
        if (Math.floor((Date.parse(fecha)-Date.parse(inicio))/604800000)+1 > 104) throw new Error('Selecciona un período de hasta 104 semanas.');
        const indices = p.fechas.map((d,i) => d>=inicio && d<=fecha ? i : -1).filter(i=>i>=0);
        if (!indices.length) throw new Error('Seguimiento KM-HR: no hay columnas con fecha dentro del período seleccionado.');
        datos = copia(p.intervalos[`${indices[0]}:${indices.at(-1)}`]);
        datos.fecha = datos.limite_mantenciones = fecha;
        datos.incluye_estado_equipo = u.pathname === '/api/mantenciones';
      } else if (u.pathname === '/api/programa-mantencion') {
        const mes = q.get('mes');
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Seleccione un mes válido (AAAA-MM).');
        datos = p.programas[mes];
        if (!datos) {
          datos = copia(Object.values(p.programas)[0]);
          Object.assign(datos, {mes, regiones: [], total: 0, realizadas: 0, regularizadas: 0, no_realizadas: 0, na: 0, sin_clasificar: 0, porcentaje: null});
          datos.advertencias = ['No hay patentes programadas para este mes en la publicación.'];
        }
      } else throw new Error('Consulta no disponible en la publicación.');
      return {ok:true, status:200, json:async()=>({...copia(datos), cecos_codigos:p.cecos_codigos || {}})};
    } catch(error) { return {ok:false, status:400, json:async()=>({error:error.message})}; }
  }
  window.PortalDatos = {consulta, listo, consultar,
    fechaActual: () => consulta && window.PublicacionFecha ? new Date(window.PublicacionFecha+'T12:00:00') : new Date()};
})();
