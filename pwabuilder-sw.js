// Service Worker بسيط لدعم PWA و Offline
const CACHE_NAME = 'az-market-cache-v1';
const urlsToCache = [
  '/',
  '/Call/index.html',
  '/Call/manifest.json',
  '/Call/pwa-icon-512x512 (1).png',
  '/Call/icon-192x192-1768170166207.png',
  // أضف أي ملفات CSS أو JS أو صفحات داخلية تريد العمل أوفلاين
];

// تثبيت Service Worker وحفظ الملفات في الكاش
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// اعتراض الطلبات وإرجاعها من الكاش عند عدم وجود إنترنت
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => caches.match('/Call/index.html'))
  );
});
