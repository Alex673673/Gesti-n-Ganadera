/* Registro del Service Worker y botón «Instalar aplicación».
   Archivo independiente: no toca app.js ni su lógica. Se carga después de app.js. */
(function () {
  'use strict';

  // El Service Worker solo funciona en https o localhost (no en file://)
  if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function (err) {
        console.warn('No se pudo registrar el Service Worker:', err);
      });
    });
  }

  // Botón flotante de instalación (Chrome/Edge/Android). En iOS Safari se instala con Compartir > «Añadir a pantalla de inicio».
  var evento = null;
  var boton = null;

  function ocultar() { if (boton) { boton.remove(); boton = null; } }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    evento = e;
    if (boton) return;
    boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = '📲 Instalar aplicación';
    boton.setAttribute('aria-label', 'Instalar Gestión Ganadera en este dispositivo');
    boton.className = 'fixed bottom-4 right-4 z-[10000] rounded-full bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-green-800 transition';
    boton.style.marginBottom = 'env(safe-area-inset-bottom, 0px)';
    boton.addEventListener('click', function () {
      if (!evento) return;
      evento.prompt();
      evento.userChoice.finally(function () { evento = null; ocultar(); });
    });
    document.body.appendChild(boton);
  });

  window.addEventListener('appinstalled', function () { evento = null; ocultar(); });
})();
