const CACHE_NAME = 'az-souk-al-shamel-v1.0.0';

self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker: تم التثبيت');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🔥 Service Worker: تم التفعيل');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // تمرير جميع الطلبات مباشرة للشبكة
  event.respondWith(fetch(event.request));
});
