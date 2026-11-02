/* Ayuda de los gráficos: un atributo por línea, con mouse y teclado. */
(() => {
  'use strict';
  let cuadro = null, activo = null;
  const formatear = detalle => String(detalle).replaceAll(' · ', '\n');
  function preparar() {
    if (cuadro) return;
    cuadro = document.createElement('div');
    cuadro.id = 'grafico-tooltip';
    cuadro.className = 'reporte-tooltip grafico-tooltip';
    cuadro.setAttribute('role', 'tooltip');
    cuadro.dataset.pdfOmitir = '';
    cuadro.hidden = true;
    document.body.append(cuadro);
  }
  function posicionar(elemento, evento) {
    const rect = elemento.getBoundingClientRect();
    const x = evento?.clientX ?? rect.left + rect.width / 2;
    const y = evento?.clientY ?? rect.bottom;
    const ancho = cuadro.offsetWidth, alto = cuadro.offsetHeight;
    cuadro.style.left = Math.max(8, Math.min(x + 14, innerWidth - ancho - 8)) + 'px';
    cuadro.style.top = Math.max(8, Math.min(y + alto + 20 > innerHeight ? y - alto - 12 : y + 14, innerHeight - alto - 8)) + 'px';
  }
  function ocultar(elemento) {
    if (elemento && activo !== elemento) return;
    activo = null;
    if (cuadro) cuadro.hidden = true;
  }
  function conectar(elemento, detalle) {
    preparar();
    const texto = formatear(detalle);
    elemento.setAttribute('aria-describedby', cuadro.id);
    const mostrar = evento => {
      activo = elemento;
      cuadro.textContent = texto;
      cuadro.hidden = false;
      posicionar(elemento, evento);
    };
    elemento.addEventListener('mouseenter', mostrar);
    elemento.addEventListener('focus', mostrar);
    elemento.addEventListener('mousemove', evento => { if (activo === elemento) posicionar(elemento, evento); });
    elemento.addEventListener('mouseleave', () => ocultar(elemento));
    elemento.addEventListener('blur', () => ocultar(elemento));
  }
  document.addEventListener('keydown', evento => { if (evento.key === 'Escape') ocultar(); });
  document.addEventListener('change', () => ocultar());
  function reubicar() {
    if (activo && document.activeElement === activo) posicionar(activo);
    else ocultar();
  }
  window.addEventListener('scroll', reubicar, true);
  window.addEventListener('resize', reubicar);
  new MutationObserver(() => { if (activo && !activo.isConnected) ocultar(); }).observe(document.body, {childList:true, subtree:true});
  window.PortalAyudaGrafico = {conectar, formatear};
})();
