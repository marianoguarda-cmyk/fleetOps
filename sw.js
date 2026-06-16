const CACHE_NAME = 'fleetops-v2';
const SYNC_TAG = 'sync-checks';

// Archivos a cachear para funcionar offline
const CACHE_FILES = [
  '/operador.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// INSTALL: cachear archivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES).catch(err => {
        console.warn('Cache parcial:', err);
      });
    })
  );
  self.skipWaiting();
});

// ACTIVATE: limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH: servir desde cache si no hay red
self.addEventListener('fetch', event => {
  // No interceptar requests a Supabase (los maneja la app)
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('tile.openstreetmap.org')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar en cache si es exitoso
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Sin red: servir desde cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback: si piden cualquier página, devolver operador.html
          if (event.request.destination === 'document') {
            return caches.match('/operador.html');
          }
        });
      })
  );
});

// BACKGROUND SYNC: sincronizar checks pendientes cuando vuelve la conexión
self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(sincronizarChecks());
  }
});

// Notificar a la app que el sync terminó
async function sincronizarChecks() {
  // Avisar a todos los clientes abiertos que intenten sincronizar
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_CHECKS' }));
}

// Escuchar mensajes de la app
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
