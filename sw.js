const CACHE_NAME = 'az-souk-al-shamel-v1.0.0';

// الملفات التي سيتم تخزينها في الكاش
const urlsToCache = [
  '/Call/',
  '/Call/index.html',
  '/Call/manifest.json'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker: تم التثبيت');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Service Worker: فتح الكاش وتخزين الملفات');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker: تم تخزين جميع الملفات بنجاح');
        return self.skipWaiting();
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('🔥 Service Worker: تم التفعيل');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: تم تنظيف الكاش القديم');
      return self.clients.claim();
    })
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات Firebase وطلبات POST
  if (event.request.url.includes('firebase') || event.request.method === 'POST') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // إذا وجد الملف في الكاش، استخدمه
        if (response) {
          return response;
        }

        // إذا لم يوجد في الكاش، حمله من الشبكة
        return fetch(event.request)
          .then((response) => {
            return response;
          })
          .catch((error) => {
            console.error('❌ Service Worker: فشل في تحميل الملف:', error);
            
            // إذا فشل التحميل، حاول تقديم الصفحة الرئيسية
            if (event.request.destination === 'document') {
              return caches.match('/Call/index.html');
            }
            
            return new Response('فشل في تحميل الملف. يرجى التحقق من اتصال الإنترنت.', {
              status: 408,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
      })
  );
});
