// service-worker.js
const CACHE_NAME = 'az-market-v2.0';
const STATIC_CACHE_NAME = 'az-market-static-v2.0';
const DYNAMIC_CACHE_NAME = 'az-market-dynamic-v2.0';

// الملفات التي سيتم تخزينها عند التثبيت
const STATIC_FILES_TO_CACHE = [
  '/Call/1_1.html',
  '/Call/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js',
  'https://github.com/e772299420-hue/Call/raw/main/icon-192x192-1768170166207.png',
  'https://github.com/e772299420-hue/Call/raw/main/pwa-icon-512x512%20(1).png'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] التثبيت');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] تخزين الملفات الثابتة في الكاش');
        return cache.addAll(STATIC_FILES_TO_CACHE);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] خطأ في التثبيت:', error);
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] التفعيل');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // حذف الكاش القديم
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME && cacheName !== CACHE_NAME) {
            console.log('[Service Worker] حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// اعتراض طلبات الشبكة
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // تجاهل طلبات Firebase وطلبات أخرى غير مهمة
  if (
    requestUrl.origin.includes('firebase') ||
    requestUrl.origin.includes('googleapis') ||
    event.request.method !== 'GET'
  ) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // إذا كانت الصفحة الرئيسية مطلوبة
        if (event.request.mode === 'navigate' && requestUrl.pathname.includes('1_1.html')) {
          // محاولة إرجاع من الكاش أولاً
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // إذا لم توجد في الكاش، حاول جلبها من الشبكة
          return fetch(event.request)
            .then((networkResponse) => {
              // تخزين في الكاش الديناميكي
              return caches.open(DYNAMIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                  return networkResponse;
                });
            })
            .catch(() => {
              // إذا فشل الاتصال، حاول إرجاع نسخة عامة من الصفحة
              return caches.match('/Call/1_1.html')
                .then((fallbackResponse) => {
                  if (fallbackResponse) {
                    return fallbackResponse;
                  }
                  
                  // إذا لم توجد الصفحة في الكاش، أعد صفحة HTML بسيطة
                  return new Response(
                    `
                    <!DOCTYPE html>
                    <html lang="ar" dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>AZ السوق الشامل</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            h1 { color: #3498db; }
                            .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>AZ السوق الشامل</h1>
                            <p>أنت غير متصل بالإنترنت حالياً</p>
                            <p>يتم عرض البيانات المخزنة مسبقاً</p>
                            <button class="btn" onclick="location.reload()">إعادة تحميل</button>
                            <p style="margin-top: 20px; color: #666; font-size: 14px;">
                                تطبيق AZ السوق الشامل - للتسوق الإلكتروني المتكامل
                            </p>
                        </div>
                    </body>
                    </html>
                    `,
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                  );
                });
            });
        }
        
        // للملفات الأخرى
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then((response) => {
            // لا تخزن ملفات كبيرة أو غير قابلة للتخزين
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch((error) => {
            console.log('[Service Worker] فشل في جلب:', event.request.url, error);
            
            // لملفات CSS وJS، حاول إرجاع نسخة من الكاش الثابت
            if (event.request.url.includes('.css') || event.request.url.includes('.js')) {
              return caches.match(event.request.url)
                .then((staticResponse) => {
                  if (staticResponse) {
                    return staticResponse;
                  }
                });
            }
            
            return new Response('فشل الاتصال بالإنترنت', {
              status: 408,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
      })
  );
});

// معالجة رسائل Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// معالجة تحديثات الصفحة
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    // يمكنك إضافة منطق تحديث الكاش هنا
    console.log('[Service Worker] تحديث الكاش...');
  } catch (error) {
    console.error('[Service Worker] خطأ في تحديث الكاش:', error);
  }
}
