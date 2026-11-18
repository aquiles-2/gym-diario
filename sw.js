// Service Worker: solo cachea ARCHIVOS de la app. Nunca toca IndexedDB.
const VERSION = '0.7.1';
const CACHE = 'gym-app-' + VERSION;
const FILES = ['./','index.html','manifest.json','css/app.css','js/app.js','js/db/db.js','js/ui/entrenar.js','js/ui/historial.js','js/logic/workouts.js','js/logic/stats.js','js/ui/progreso.js','js/ui/chart.js','js/ui/rutinas.js','js/ui/timer.js','js/ui/extras.js','js/logic/goals.js','js/logic/routines.js',
  'icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))));
// La versión nueva espera a que pulses "Actualizar" (no interrumpe un entrenamiento).
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gym-app-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() =>
    e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
