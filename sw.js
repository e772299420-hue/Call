// Service Worker المتكامل للإشعارات وتخزين الملفات
const CACHE_NAME = 'az-souk-al-shamel-notifications-v1';

// ==========================================
// 1️⃣ تثبيت وتفعيل Service Worker
// ==========================================
self.addEventListener('install', (event) => {
    console.log('🚀 Service Worker: تم التثبيت بنجاح');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('🔥 Service Worker: تم التفعيل وجاهز لاستقبال الإشعارات');
    event.waitUntil(self.clients.claim());
});

// ==========================================
// 🔔 2️⃣ الجزء الأهم: استقبال وعرض الإشعارات
// ==========================================
self.addEventListener('push', (event) => {
    console.log('🔔 Service Worker: تم استقبال إشعار جديد!');
    
    // البيانات تأتي من Firebase أو الخادم
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        console.warn('⚠️ لم تصل بيانات الإشعار بصيغة JSON، استخدام بيانات افتراضية');
        data = {
            title: 'AZ السوق الشامل',
            body: 'تم اكتشاف منتجات جديدة!',
            icon: 'https://raw.githubusercontent.com/e772299420-hue/Call/main/icon-512x5122.png',
            data: { url: 'https://e772299420-hue.github.io/Call/1_1.html' }
        };
    }

    const title = data.title || 'AZ السوق الشامل';
    const body = data.body || 'عرض جديد أو منتج مضاف';
    const icon = data.icon || 'https://raw.githubusercontent.com/e772299420-hue/Call/main/icon-512x5122.png';
    const badge = 'https://raw.githubusercontent.com/e772299420-hue/Call/main/icon-512x5122.png';

    // إعدادات الإشعار المميزة
    const options = {
        body: body,
        icon: icon,
        badge: badge,
        vibrate: [200, 100, 200, 100, 200], // نمط اهتزاز جذاب
        timestamp: Date.now(),
        data: data.data || {
            url: 'https://e772299420-hue.github.io/Call/1_1.html',
            productId: null,
            merchantId: null,
            type: 'general'
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
        ],
        requireInteraction: true, // يبقى الإشعار حتى ينقر عليه المستخدم
        tag: 'az-market-notification' // لمنع التكرار
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ==========================================
// 🖱️ 3️⃣ معالجة نقر المستخدم على الإشعار
// ==========================================
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ Service Worker: تم النقر على الإشعار - الإجراء:', event.action);
    
    event.notification.close();

    const urlToOpen = event.notification.data.url || 'https://e772299420-hue.github.io/Call/1_1.html';

    if (event.action === 'open' || event.action === '') {
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then((windowClients) => {
                // إذا كان التطبيق مفتوحاً بالفعل، ركز على النافذة
                for (let client of windowClients) {
                    if (client.url.includes('e772299420-hue.github.io/Call') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // إذا لم يكن مفتوحاً، افتح نافذة جديدة
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// ==========================================
// 💾 4️⃣ تخزين الملفات في الكاش (Cache) - نسخة مبسطة
// ==========================================
const urlsToCache = [
    '/Call/1_1.html',
    '/Call/manifest.json',
    'https://raw.githubusercontent.com/e772299420-hue/Call/main/icon-512x5122.png'
];

self.addEventListener('fetch', (event) => {
    // تجاهل طلبات Firebase لتجنب المشاكل
    if (event.request.url.includes('firebase') || event.request.method === 'POST') {
        return;
    }

    // فقط للملفات الأساسية
    if (event.request.destination === 'document' || 
        event.request.url.includes('1_1.html') ||
        event.request.url.includes('manifest.json')) {
        
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request);
                })
                .catch(() => {
                    // إذا فشل كل شيء، حاول تقديم الصفحة الرئيسية
                    if (event.request.destination === 'document') {
                        return caches.match('/Call/1_1.html');
                    }
                    return new Response('يرجى التحقق من اتصال الإنترنت');
                })
        );
    }
});
