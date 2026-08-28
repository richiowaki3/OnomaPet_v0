/**
 * OnomaPet Service Worker - Offline Cache & Fast PWA Launch
 */
const CACHE_NAME = 'onomapet-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './onomatopoeia_dictionary.js',
  './js/OnomaPetDictionary.js',
  './js/OnomaPetKinematics.js',
  './js/OnomaPetPhysics.js',
  './js/OnomaPetSynth.js',
  './js/OnomaPetEngine.js',
  './js/SeismographRenderer.js',
  './js/NodeMesh3DRenderer.js',
  './js/TenVariationsGallery.js',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
