// إصدار Service Worker
const CACHE_NAME = 'az-souk-al-shamel-v1.2.0';

// الملفات التي سيتم تخزينها في الكاش
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://github.com/e772299420-hue/Call/blob/main/BackgroundEraser_%D9%A2%D9%A0%D9%A2%D9%A5%D9%A0%D9%A9%D9%A0%D9%A5_%D9%A0%D9%A0%D9%A3%D9%A5%D9%A0%D9%A1%D9%A0%D9%A0%D9%A7.png?raw=true'
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
      .catch((error) => {
        console.error('❌ Service Worker: فشل في تخزين الملفات:', error);
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
          console.log('📦 Service Worker: تم تقديم الملف من الكاش:', event.request.url);
          return response;
        }

        // إذا لم يوجد في الكاش، حمله من الشبكة
        console.log('🌐 Service Worker: جاري تحميل الملف من الشبكة:', event.request.url);
        
        return fetch(event.request)
          .then((response) => {
            // تحقق من أن الاستجابة صالحة
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // استنسخ الاستجابة
            const responseToCache = response.clone();

            // افتح الكاش وأضف الملف الجديد
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('✅ Service Worker: تم تخزين الملف الجديد في الكاش:', event.request.url);
              });

            return response;
          })
          .catch((error) => {
            console.error('❌ Service Worker: فشل في تحميل الملف:', error);
            
            // إذا فشل التحميل، حاول تقديم صفحة بديلة
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
            
            return new Response('فشل في تحميل الملف. يرجى التحقق من اتصال الإنترنت.', {
              status: 408,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
      })
  );
});

// معالجة رسائل الخلفية
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// معالجة تحديث المحتوى
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Service Worker: مزامنة الخلفية');
    event.waitUntil(doBackgroundSync());
  }
});

// دالة مزامنة الخلفية
function doBackgroundSync() {
  return new Promise((resolve) => {
    console.log('🔄 Service Worker: جاري مزامنة البيانات...');
    // هنا يمكنك إضافة منطق مزامنة البيانات
    setTimeout(() => {
      console.log('✅ Service Worker: اكتملت المزامنة');
      resolve();
    }, 1000);
  });
}

// معالجة الإشعارات
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'إشعار جديد من AZ السوق الشامل',
    icon: 'https://github.com/e772299420-hue/Call/blob/main/BackgroundEraser_%D9%A2%D9%A0%D9%A2%D9%A5%D9%A0%D9%A9%D9%A0%D9%A5_%D9%A0%D9%A0%D9%A3%D9%A5%D9%A0%D9%A1%D9%A0%D9%A0%D9%A7.png?raw=true',
    badge: 'https://github.com/e772299420-hue/Call/blob/main/BackgroundEraser_%D9%A2%D9%A0%D9%A2%D9%A5%D9%A0%D9%A9%D9%A0%D9%A5_%D9%A0%D9%A0%D9%A3%D9%A5%D9%A0%D9%A1%D9%A0%D9%A0%D9%A7.png?raw=true',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AZ السوق الشامل', options)
  );
});

// معالجة النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});
