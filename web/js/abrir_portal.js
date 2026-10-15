// Configuraciones pertenece únicamente al modo interactivo abierto por el BAT.
(() => {
  if (location.protocol !== 'file:' && !location.pathname.startsWith('/principal/')) return;
  document.documentElement.classList.add('modo-consulta');
  if (location.pathname.endsWith('/Panel_Configuraciones.html')) {
    location.replace(new URL('../../Panel.html', location.href).href);
  }
})();
