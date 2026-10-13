// El navegador pide al servidor local la misma carga que Actualizar_BD.bat.
(() => {
  const contenedor = document.createElement('section');
  contenedor.className = 'filtros';
  contenedor.setAttribute('aria-label', 'Base de datos');
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = 'Actualizar BD';
  boton.title = 'Recargar la base desde los Excel (equivale a Actualizar_BD.bat)';
  const estado = document.createElement('span');
  estado.setAttribute('role', 'status');
  estado.setAttribute('aria-live', 'polite');
  contenedor.append(boton, estado);
  (document.querySelector('main') || document.body).prepend(contenedor);
  const mostrarFecha = datos => {
    estado.textContent = 'BD actualizada: ' + new Date(datos.actualizado).toLocaleString('es-CL');
  };
  fetch('/api/bd').then(async respuesta => {
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error);
    mostrarFecha(datos);
  }).catch(error => { estado.textContent = error.message; });
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    estado.textContent = 'Actualizando BD desde los Excel…';
    try {
      const respuesta = await fetch('/api/bd/actualizar', {
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
