// El navegador pide al servidor local la misma carga que Actualizar_BD.bat.
(() => {
  const contenedor = document.createElement('section');
  contenedor.id = 'bd-barra';
  const cabecera = document.querySelector('header');
  contenedor.className = cabecera ? 'publicacion-header' : 'filtros';
  contenedor.setAttribute('aria-label', 'Base de datos');
  const boton = document.createElement('button');
  boton.id = 'bd-actualizar';
  boton.className = 'boton-actualizar-bd';
  boton.setAttribute('data-pdf-omitir', '');
  boton.type = 'button';
  boton.textContent = 'Actualizar BD';
  boton.title = 'Recargar equipos y asociaciones de zona desde los Excel (equivale a Actualizar_BD.bat)';
  boton.hidden = PortalDatos.consulta;
  const estado = document.createElement('span');
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');
  contenedor.append(boton, estado);
  if (cabecera) {
    cabecera.append(contenedor);
    if (!PortalDatos.consulta) {
      const inicio = document.querySelector('header .volver-inicio') || document.querySelector('header small');
      if (inicio?.closest('.acciones-cabecera')) inicio.before(boton);
      else {
        const acciones = document.createElement('div');
        acciones.className = 'acciones-cabecera';
        if (inicio) { inicio.before(acciones); acciones.append(boton, inicio); }
        else { contenedor.before(acciones); acciones.append(boton); }
      }
    }
  } else (document.querySelector('main') || document.body).prepend(contenedor);
  const mostrarFecha = datos => {
    estado.textContent = (PortalDatos.consulta ? 'Última publicación: ' : 'Uso interactivo · BD actualizada: ') + new Date(datos.actualizado).toLocaleString('es-CL');
  };
  PortalDatos.consultar('/api/bd').then(async respuesta => {
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error);
    mostrarFecha(datos);
  }).catch(error => { estado.textContent = error.message; });
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    estado.textContent = 'Actualizando BD desde los Excel…';
    try {
      const respuesta = await PortalDatos.consultar('/api/bd/actualizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo actualizar la BD.');
      // Recarga todos los datos del reporte tras publicar la nueva base.
      location.reload();
    } catch (error) {
      estado.textContent = error.message;
      boton.disabled = false;
    }
  });
})();
