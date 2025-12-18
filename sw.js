// Service Worker متوازن - 50% إشعارات / 50% تخزين
const CACHE_NAME = 'az-market-v2';

// ==================== تخزين الملفات ====================
const urlsToCache = [
    '/Call/1_1.html',
    '/Call/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://raw.githubusercontent.com/e772299420-hue/Call/main/icon-512x5122.png'
];

self.addEventListener('install', (event) => {
    console.log('📦 التثبيت: جاري تخزين الملفات المهمة');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('✅ التفعيل: جاهز للإشعارات والتخزين');
    event.waitUntil(self.clients.claim());
});

// ==================== الإشعارات الدفعية ====================
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {
        title: 'AZ السوق الشامل',
        body: 'منتج جديد!',
        icon: 'https://raw.githubusercontent.com/e772299420-hue/Call/main/icon-512x5122.png'
    };

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            vibrate: [200, 100, 200],
            data: { url: '/Call/1_1.html' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/Call/1_1.html')
    );
});

// ==================== خدمة الطلبات ====================
self.addEventListener('fetch', (event) => {
    // تجاهل Firebase والطلبات الديناميكية
    if (event.request.url.includes('firebase') || event.request.method === 'POST') {
        return;
    }

    // للملفات الأساسية فقط: استخدم الكاش أولاً
    if (urlsToCache.some(url => event.request.url.includes(url))) {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});
