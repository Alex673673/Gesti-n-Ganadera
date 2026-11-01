/* Service Worker de Gestión Ganadera.
   - Archivos propios: «stale-while-revalidate» (carga instantánea y se actualizan en segundo plano).
   - CDN (Tailwind, Leaflet, Leaflet.draw): se precachean y se sirven desde caché.
   - Teselas del mapa: caché con límite, para que el mapa visitado siga viéndose sin conexión.
   Los datos de la app viven en localStorage, así que este SW nunca toca la lógica ni los datos.
   Para publicar una versión nueva, sube el número de VERSION. */
const VERSION = 'v18';
const CACHE_APP = `gg-app-${VERSION}`;
const CACHE_CDN = `gg-cdn-${VERSION}`;
const CACHE_TILES = 'gg-tiles';          // sin versión: no hace falta vaciarlo al actualizar
const MAX_TILES = 300;

const ARCHIVOS_APP = [
  './',
  './index.html',
  './config.js',
  './nube.js',
  './app.js',
  './pwa.js',
  './manifest.json',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-48.png'
];

const L = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
const LD = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4';
const ARCHIVOS_CDN = [
  'https://cdn.tailwindcss.com',
  `${L}/leaflet.min.css`,
  `${L}/leaflet.min.js`,
  `${L}/images/layers.png`,
  `${L}/images/layers-2x.png`,
  `${L}/images/marker-icon.png`,
  `${L}/images/marker-icon-2x.png`,
  `${L}/images/marker-shadow.png`,
  `${LD}/leaflet.draw.css`,
  `${LD}/leaflet.draw.js`,
  `${LD}/images/spritesheet.png`,
  `${LD}/images/spritesheet-2x.png`,
  `${LD}/images/spritesheet.svg`
];

const esTesela = (url) =>
  /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) || url.hostname === 'server.arcgisonline.com';

// Guarda una URL; las de otro origen se piden en no-cors (las etiquetas <script>/<link> también lo hacen)
async function guardar(cacheNombre, url) {
  const cache = await caches.open(cacheNombre);
  const mismo = new URL(url, self.location.href).origin === self.location.origin;
  const resp = await fetch(url, mismo ? { cache: 'reload' } : { mode: 'no-cors' });
  if (resp.ok || resp.type === 'opaque') await cache.put(url, resp);
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    // Los archivos propios son obligatorios; los del CDN se intentan uno a uno (si alguno falla no se aborta)
    await Promise.all(ARCHIVOS_APP.map((u) => guardar(CACHE_APP, u)));
    await Promise.allSettled(ARCHIVOS_CDN.map((u) => guardar(CACHE_CDN, u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const vigentes = [CACHE_APP, CACHE_CDN, CACHE_TILES];
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('gg-') && !vigentes.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function recortarTesela(cache) {
  const claves = await cache.keys();
  if (claves.length > MAX_TILES) {
    await Promise.all(claves.slice(0, claves.length - MAX_TILES).map((k) => cache.delete(k)));
  }
}

async function teselas(req) {
  const cache = await caches.open(CACHE_TILES);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  try {
    // Se repite en modo CORS cuando el servidor lo permite: así la respuesta no es «opaca»
    // (las opacas consumen mucha cuota de almacenamiento). Si falla, se usa la petición original.
    let resp;
    try { resp = await fetch(req.url, { mode: 'cors' }); if (!resp.ok) throw new Error(); }
    catch { resp = await fetch(req); }
    if (resp.ok || resp.type === 'opaque') {
      cache.put(req.url, resp.clone()).then(() => recortarTesela(cache)).catch(() => {});
    }
    return resp;
  } catch {
    return new Response('', { status: 504, statusText: 'Sin conexión' });
  }
}

// Archivos propios de la app: primero la red (siempre la última versión de index.html y app.js juntos)
// y, si no hay conexión, la copia guardada. Así nunca se mezcla un index.html nuevo con un app.js antiguo.
async function networkFirst(req, cacheNombre, claveCache) {
  const cache = await caches.open(cacheNombre);
  try {
    const resp = await fetch(req, { cache: 'no-cache' });
    if (resp && resp.ok) { cache.put(claveCache || req, resp.clone()); return resp; }
    throw new Error('respuesta no válida');
  } catch {
    const guardada = (await cache.match(claveCache || req, { ignoreSearch: true })) || (claveCache ? await cache.match('./') : null);
    return guardada || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(req, cacheNombre) {
  const cache = await caches.open(cacheNombre);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  try {
    const resp = await fetch(req);
    if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone());
    return resp;
  } catch {
    return new Response('', { status: 504, statusText: 'Sin conexión' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación (SPA): index.html de la red; sin conexión, el guardado
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, CACHE_APP, './index.html'));
    return;
  }

  // Resto de archivos propios (app.js, iconos…): red primero, caché sin conexión
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req, CACHE_APP)); return; }
  if (esTesela(url)) { e.respondWith(teselas(req)); return; }
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(cacheFirst(req, CACHE_CDN));
  }
  // Cualquier otra petición (p. ej. Supabase en el futuro) pasa directa a la red
});
