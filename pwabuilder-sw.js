// =============================================
// Service Worker المتكامل لـ AZ السوق الشامل
// الإصدار: az-market-pro-v1.0
// تاريخ: ${new Date().toLocaleDateString('ar-EG')}
// =============================================

const VERSION = 'az-market-pro-v1.0';
const CACHE_NAMES = {
  STATIC: `az-static-${VERSION}`,
  PAGES: `az-pages-${VERSION}`,
  IMAGES: `az-images-${VERSION}`,
  ASSETS: `az-assets-${VERSION}`
};

// ==================== إعدادات التخزين ====================
const CACHE_LIMITS = {
  IMAGES: 50, // عدد الصور المخزنة كحد أقصى
  PAGES: 30,  // عدد الصفحات المخزنة كحد أقصى
  MAX_SIZE: 200 * 1024 * 1024 // 200MB كحد أقصى للتخزين
};

// ==================== قوائم الموارد ====================
const STATIC_RESOURCES = {
  ESSENTIAL: [
    '/',
    '/Call/index.html',
    '/Call/manifest.json',
    '/Call/service-worker.js',
    // الأيقونات
    '/Call/pwa-icon-512x512 (1).png',
    '/Call/icon-192x192-1768170166207.png',
    '/Call/favicon.ico',
    // CSS الأساسي
    '/Call/css/main.css'
  ],
  
  CORE_PAGES: [
    // الصفحات الرئيسية
    '/Call/mr.html',
    '/Call/as.html',
    '/Call/dm.html',
    '/Call/help.html',
    '/Call/seasa.html',
    '/Call/mrwan.html',
    '/Call/mnjr_admin.html',
    // صفحات المنتجات
    '/Call/1_1.html',
    '/Call/1_2.html',
    '/Call/1_5.html',
    '/Call/1_6.html',
    '/Call/index_mt.html',
    '/Call/txtx.html'
  ],
  
  DEPENDENCIES: [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap',
    // مكتبات JS مهمة (اختيارية)
    'https://unpkg.com/lazysizes@5.3.2/lazysizes.min.js'
  ]
};

// ==================== قوائم الاستبعاد ====================
const EXCLUDE_PATTERNS = [
  // طلبات غير GET
  /POST|PUT|DELETE|PATCH/i,
  // المسارات الديناميكية
  /\/api\//,
  /\/auth\//,
  /\/admin\//,
  /\/dashboard\//,
  // الملفات الكبيرة
  /\.(mp4|avi|mov|mkv|zip|rar|tar|gz)$/i,
  // خدمات التحليلات
  /google-analytics/,
  /analytics\.google/,
  /googletagmanager/,
  /facebook\.com\/tr\//,
  // روابط خاصة
  /chrome-extension:/,
  /safari-extension:/,
  /moz-extension:/
];

// ==================== استراتيجيات الكاش ====================
const CACHE_STRATEGIES = {
  NETWORK_FIRST: ['html', 'htm', 'php', 'aspx'],
  CACHE_FIRST: ['css', 'js', 'woff', 'woff2', 'ttf', 'eot'],
  CACHE_ONLY: ['manifest', 'json', 'webmanifest'],
  STALE_WHILE_REVALIDATE: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp']
};

// ==================== تحسينات Google Drive ====================
const GOOGLE_DRIVE_OPTIMIZATIONS = {
  // تحويل روابط Google Drive إلى روابط مباشرة للصور
  transformImageUrl: (url) => {
    try {
      const urlObj = new URL(url);
      
      // إذا كان رابط Google Drive
      if (urlObj.hostname.includes('drive.google.com')) {
        const fileId = urlObj.pathname.match(/\/d\/([^\/]+)/)?.[1] || 
                      urlObj.searchParams.get('id');
        
        if (fileId) {
          // رابط مباشر للصورة مع تحسينات
          return `https://drive.google.com/uc?export=view&id=${fileId}&w=800&h=600&fit=crop`;
        }
      }
      
      // إذا كان رابط Googleusercontent
      if (urlObj.hostname.includes('googleusercontent.com')) {
        const params = new URLSearchParams(urlObj.search);
        params.set('w', '800'); // تحديد العرض
        params.set('h', '600'); // تحديد الارتفاع
        params.set('fit', 'crop'); // اقتصاص الصورة
        params.set('quality', '85'); // جودة مضغوطة
        
        urlObj.search = params.toString();
        return urlObj.toString();
      }
      
      return url;
    } catch (e) {
      return url;
    }
  }
};

// ==================== تثبيت Service Worker ====================
self.addEventListener('install', (event) => {
  console.log(`📦 تثبيت ${VERSION}...`);
  
  event.waitUntil(
    (async () => {
      try {
        // فتح جميع أنواع الكاش
        const cachesToOpen = Object.values(CACHE_NAMES);
        await Promise.all(cachesToOpen.map(name => caches.open(name)));
        
        // تخزين الموارد الأساسية فقط أولاً
        const staticCache = await caches.open(CACHE_NAMES.STATIC);
        await staticCache.addAll(STATIC_RESOURCES.ESSENTIAL);
        
        console.log('✅ تم التثبيت بنجاح');
        return self.skipWaiting();
      } catch (error) {
        console.error('❌ خطأ في التثبيت:', error);
        throw error;
      }
    })()
  );
});

// ==================== تفعيل Service Worker ====================
self.addEventListener('activate', (event) => {
  console.log(`🚀 تفعيل ${VERSION}...`);
  
  event.waitUntil(
    (async () => {
      try {
        // حذف الكاش القديم
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys.map(key => {
            if (!Object.values(CACHE_NAMES).includes(key)) {
              console.log(`🗑️ حذف كاش قديم: ${key}`);
              return caches.delete(key);
            }
          })
        );
        
        // المطالبة بالتحكم في جميع التبويبات
        await self.clients.claim();
        
        // تحميل الصفحات الأساسية في الخلفية
        await preloadCorePages();
        
        console.log('✅ Service Worker مفعل وجاهز');
      } catch (error) {
        console.error('❌ خطأ في التفعيل:', error);
      }
    })()
  );
});

// ==================== اعتراض الطلبات ====================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل الطلبات المستبعدة
  if (shouldExcludeRequest(request)) {
    return;
  }
  
  // اختيار الاستراتيجية المناسبة
  const strategy = getCacheStrategy(request);
  
  try {
    switch (strategy) {
      case 'NETWORK_FIRST':
        return handleNetworkFirst(event, request);
        
      case 'CACHE_FIRST':
        return handleCacheFirst(event, request);
        
      case 'STALE_WHILE_REVALIDATE':
        return handleStaleWhileRevalidate(event, request);
        
      case 'CACHE_ONLY':
        return handleCacheOnly(event, request);
        
      default:
        return handleDefault(event, request);
    }
  } catch (error) {
    console.error('❌ خطأ في معالجة الطلب:', error);
    return handleError(event, request, error);
  }
});

// ==================== وظائف المساعدة ====================

// تحديد ما إذا كان يجب استبعاد الطلب
function shouldExcludeRequest(request) {
  const url = request.url.toLowerCase();
  
  // التحقق من قوائم الاستبعاد
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(url) || pattern.test(request.method)) {
      return true;
    }
  }
  
  // استبعاد الطلبات التي تحتوي على استعلامات ديناميكية كثيرة
  if (new URL(url).search.length > 100) {
    return true;
  }
  
  return false;
}

// تحديد استراتيجية الكاش المناسبة
function getCacheStrategy(request) {
  const url = request.url.toLowerCase();
  const extension = url.split('.').pop().split('?')[0];
  
  // الصفحات الديناميكية - Network First
  if (CACHE_STRATEGIES.NETWORK_FIRST.includes(extension) ||
      request.headers.get('Accept')?.includes('text/html')) {
    return 'NETWORK_FIRST';
  }
  
  // الموارد الثابتة - Cache First
  if (CACHE_STRATEGIES.CACHE_FIRST.includes(extension) ||
      url.includes('.css') || url.includes('.js')) {
    return 'CACHE_FIRST';
  }
  
  // الصور - Stale While Revalidate
  if (CACHE_STRATEGIES.STALE_WHILE_REVALIDATE.includes(extension) ||
      request.headers.get('Accept')?.includes('image/')) {
    return 'STALE_WHILE_REVALIDATE';
  }
  
  // ملفات التكوين - Cache Only
  if (CACHE_STRATEGIES.CACHE_ONLY.includes(extension) ||
      url.includes('manifest') || url.includes('service-worker')) {
    return 'CACHE_ONLY';
  }
  
  return 'DEFAULT';
}

// ==================== استراتيجيات الكاش ====================

// Network First للصفحات
async function handleNetworkFirst(event, request) {
  event.respondWith(
    (async () => {
      try {
        // المحاولة من الشبكة أولاً
        const networkResponse = await fetchWithTimeout(request, 5000);
        
        if (networkResponse && networkResponse.ok) {
          // تخزين في الكاش في الخلفية
          cacheResponse(CACHE_NAMES.PAGES, request, networkResponse.clone());
          return networkResponse;
        }
        throw new Error('فشل الاتصال بالشبكة');
      } catch (error) {
        // البحث في الكاش
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
          console.log(`📂 استرجاع من الكاش: ${getFileName(request.url)}`);
          return cachedResponse;
        }
        
        // إذا كانت الصفحة الرئيسية
        const url = new URL(request.url);
        if (url.pathname === '/' || url.pathname === '/Call/' || !url.pathname.includes('.')) {
          const indexPage = await caches.match('/Call/index.html');
          if (indexPage) return indexPage;
        }
        
        // عرض صفحة الأوفلاين
        return getEnhancedOfflinePage(request);
      }
    })()
  );
}

// Cache First للموارد الثابتة
async function handleCacheFirst(event, request) {
  event.respondWith(
    (async () => {
      // البحث في الكاش أولاً
      const cachedResponse = await caches.match(request);
      
      if (cachedResponse) {
        // تحديث في الخلفية
        updateCacheInBackground(request);
        return cachedResponse;
      }
      
      try {
        // الجلب من الشبكة
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
          // تخزين في الكاش المناسب
          const cacheName = request.url.includes('.css') || request.url.includes('.js') 
            ? CACHE_NAMES.ASSETS 
            : CACHE_NAMES.STATIC;
          
          cacheResponse(cacheName, request, networkResponse.clone());
          return networkResponse;
        }
        
        throw new Error('فشل تحميل المورد');
      } catch (error) {
        // إرجاع رد افتراضي حسب نوع المورد
        return getFallbackResponse(request);
      }
    })()
  );
}

// Stale While Revalidate للصور
async function handleStaleWhileRevalidate(event, request) {
  event.respondWith(
    (async () => {
      // محاولة تحسين رابط Google Drive
      const optimizedRequest = optimizeGoogleDriveRequest(request);
      
      // البحث في كاش الصور أولاً
      const cachedResponse = await caches.match(optimizedRequest, {
        cacheName: CACHE_NAMES.IMAGES,
        ignoreSearch: true
      });
      
      // إرجاع من الكاش إذا وجد
      if (cachedResponse) {
        // تحديث الصورة في الخلفية
        updateImageCache(optimizedRequest);
        return cachedResponse;
      }
      
      try {
        // تحميل من الشبكة
        const networkResponse = await fetchImageWithOptimization(optimizedRequest);
        
        if (networkResponse.ok) {
          // تخزين في كاش الصور
          await cacheResponse(CACHE_NAMES.IMAGES, optimizedRequest, networkResponse.clone());
          
          // التحقق من حدود التخزين
          await enforceCacheLimits(CACHE_NAMES.IMAGES, CACHE_LIMITS.IMAGES);
          
          return networkResponse;
        }
        
        throw new Error('فشل تحميل الصورة');
      } catch (error) {
        console.warn(`⚠️ فشل تحميل الصورة: ${request.url}`);
        
        // إرجاع صورة افتراضية
        return getDefaultImageResponse(request);
      }
    })()
  );
}

// Cache Only للملفات الهامة
async function handleCacheOnly(event, request) {
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response;
      }
      return new Response('Not Found', { status: 404 });
    })
  );
}

// الاستراتيجية الافتراضية
async function handleDefault(event, request) {
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
}

// معالجة الأخطاء
async function handleError(event, request, error) {
  console.error(`❌ خطأ في ${request.url}:`, error);
  
  // محاولة استرجاع من الكاش
  const cached = await caches.match(request);
  if (cached) return cached;
  
  // صفحة خطأ مخصصة
  return new Response(
    `<h1>خطأ في التحميل</h1>
     <p>عذراً، حدث خطأ في تحميل الصفحة.</p>
     <button onclick="location.reload()">إعادة المحاولة</button>`,
    { 
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// ==================== وظائف متقدمة ====================

// تحميل الصفحات الأساسية في الخلفية
async function preloadCorePages() {
  const cache = await caches.open(CACHE_NAMES.PAGES);
  
  // تحميل الصفحات الأساسية فقط
  const pagesToPreload = STATIC_RESOURCES.CORE_PAGES.slice(0, 5);
  
  for (const pageUrl of pagesToPreload) {
    try {
      const response = await fetch(pageUrl, { priority: 'low' });
      if (response.ok) {
        await cache.put(pageUrl, response.clone());
        console.log(`🔮 تم تحميل: ${getFileName(pageUrl)}`);
      }
    } catch (error) {
      // تجاهل الأخطاء في التحميل المسبق
    }
  }
}

// تحسين طلبات Google Drive
function optimizeGoogleDriveRequest(request) {
  const url = request.url;
  
  // إذا كانت صورة من Google Drive
  if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
    const optimizedUrl = GOOGLE_DRIVE_OPTIMIZATIONS.transformImageUrl(url);
    
    if (optimizedUrl !== url) {
      console.log(`🔄 تحسين رابط Google Drive: ${getFileName(url)}`);
      return new Request(optimizedUrl, request);
    }
  }
  
  return request;
}

// جلب الصور مع تحسينات
async function fetchImageWithOptimization(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(request, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// تحديث الصور في الخلفية
async function updateImageCache(request) {
  setTimeout(async () => {
    try {
      const response = await fetchImageWithOptimization(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAMES.IMAGES);
        await cache.put(request, response);
      }
    } catch (error) {
      // تجاهل أخطاء التحديث الخلفي
    }
  }, 1000);
}

// تطبيق حدود التخزين
async function enforceCacheLimits(cacheName, limit) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > limit) {
      // حذف أقدم العناصر
      const itemsToDelete = keys.slice(0, keys.length - limit);
      await Promise.all(itemsToDelete.map(key => cache.delete(key)));
      
      console.log(`🗑️ حذف ${itemsToDelete.length} عنصر من ${cacheName}`);
    }
  } catch (error) {
    console.warn(`⚠️ فشل في تطبيق حدود التخزين: ${error}`);
  }
}

// ==================== وظائف مساعدة أخرى ====================

// الجلب مع مهلة زمنية
async function fetchWithTimeout(request, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
  }
}

// تخزين الاستجابة في الكاش
async function cacheResponse(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    return true;
  } catch (error) {
    console.warn(`⚠️ فشل تخزين ${request.url}:`, error);
    return false;
  }
}

// تحديث الكاش في الخلفية
async function updateCacheInBackground(request) {
  setTimeout(async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cacheName = getCacheForRequest(request);
        await cacheResponse(cacheName, request, response);
      }
    } catch (error) {
      // تجاهل أخطاء التحديث الخلفي
    }
  }, 2000);
}

// تحديد الكاش المناسب للطلب
function getCacheForRequest(request) {
  const url = request.url.toLowerCase();
  
  if (url.includes('.css') || url.includes('.js') || url.includes('.woff')) {
    return CACHE_NAMES.ASSETS;
  }
  
  if (url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    return CACHE_NAMES.IMAGES;
  }
  
  if (url.includes('.html') || request.headers.get('Accept')?.includes('text/html')) {
    return CACHE_NAMES.PAGES;
  }
  
  return CACHE_NAMES.STATIC;
}

// الحصول على اسم الملف من URL
function getFileName(url) {
  try {
    const path = new URL(url).pathname;
    return path.split('/').pop() || path;
  } catch {
    return url;
  }
}

// ==================== صفحات وردود افتراضية ====================

// صفحة الأوفلاين المحسنة
async function getEnhancedOfflinePage(request) {
  const url = new URL(request.url);
  const requestedPage = getFileName(url.pathname);
  
  // محاولة إيجاد صفحات مشابهة في الكاش
  const allCaches = await caches.keys();
  let alternativePage = null;
  
  for (const cacheName of allCaches) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    // البحث عن صفحات HTML مخزنة
    const htmlPages = keys.filter(key => 
      key.url.includes('.html') && 
      key.url.includes('/Call/')
    );
    
    if (htmlPages.length > 0) {
      alternativePage = htmlPages[0].url;
      break;
    }
  }
  
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AZ السوق الشامل - وضع عدم الاتصال</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
        
        :root {
          --primary: #2563eb;
          --secondary: #7c3aed;
          --success: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --dark: #1e293b;
          --light: #f8fafc;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Cairo', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: var(--dark);
          line-height: 1.6;
        }
        
        .offline-container {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 24px;
          padding: 40px;
          max-width: 800px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          animation: slideIn 0.5s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .icon {
          font-size: 80px;
          color: var(--danger);
          margin-bottom: 20px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        h1 {
          color: var(--danger);
          font-size: 32px;
          margin-bottom: 10px;
          font-weight: 700;
        }
        
        .subtitle {
          color: var(--dark);
          font-size: 18px;
          opacity: 0.8;
          margin-bottom: 30px;
        }
        
        .page-info {
          background: linear-gradient(135deg, var(--light), #e2e8f0);
          border-radius: 16px;
          padding: 20px;
          margin: 25px 0;
          border-right: 4px solid var(--primary);
        }
        
        .page-info p {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0;
        }
        
        .info-icon {
          color: var(--primary);
          font-size: 20px;
        }
        
        .available-pages {
          background: var(--light);
          border-radius: 16px;
          padding: 25px;
          margin: 30px 0;
        }
        
        .pages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
        
        .page-card {
          background: white;
          padding: 15px;
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .page-card:hover {
          transform: translateY(-5px);
          border-color: var(--primary);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
        }
        
        .page-card i {
          font-size: 24px;
          color: var(--primary);
          margin-bottom: 10px;
        }
        
        .page-card span {
          display: block;
          font-weight: 600;
          color: var(--dark);
        }
        
        .actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 40px;
        }
        
        .btn {
          padding: 16px 24px;
          border-radius: 12px;
          border: none;
          font-family: 'Cairo', sans-serif;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, var(--primary), #1d4ed8);
          color: white;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
        }
        
        .btn-secondary {
          background: var(--light);
          color: var(--dark);
          border: 2px solid #cbd5e1;
        }
        
        .btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 25px rgba(0,0,0,0.2);
        }
        
        .btn:active {
          transform: translateY(0);
        }
        
        .connection-status {
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border-radius: 12px;
          padding: 15px;
          margin-top: 30px;
          text-align: center;
          border: 2px solid #f59e0b;
        }
        
        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: white;
          border-radius: 50px;
          margin-top: 10px;
        }
        
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--danger);
          animation: blink 1.5s infinite;
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        @media (max-width: 768px) {
          .offline-container {
            padding: 25px 20px;
            margin: 10px;
          }
          
          .pages-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          }
          
          .actions {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
      <div class="offline-container">
        <div class="header">
          <div class="icon">
            <i class="fas fa-wifi-slash"></i>
          </div>
          <h1>لا يوجد اتصال بالإنترنت</h1>
          <div class="subtitle">
            الصفحة المطلوبة غير متوفرة حالياً
          </div>
        </div>
        
        <div class="page-info">
          <p><i class="fas fa-info-circle info-icon"></i> <strong>الصفحة المطلوبة:</strong> ${requestedPage}</p>
          <p><i class="fas fa-clock info-icon"></i> <strong>آخر تحديث:</strong> ${new Date().toLocaleString('ar-EG')}</p>
          <p><i class="fas fa-database info-icon"></i> <strong>البيانات المخزنة:</strong> ${allCaches.length} نوع كاش</p>
        </div>
        
        ${alternativePage ? `
        <div class="available-pages">
          <h3 style="color: var(--dark); margin-bottom: 15px;">
            <i class="fas fa-box-open"></i> الصفحات المتاحة حالياً
          </h3>
          <div class="pages-grid" id="pagesGrid">
            <!-- سيتم ملؤها بالجافاسكريبت -->
          </div>
        </div>
        ` : ''}
        
        <div class="actions">
          <button class="btn btn-primary" onclick="handleRetry()">
            <i class="fas fa-redo"></i> إعادة المحاولة
          </button>
          <button class="btn btn-secondary" onclick="handleGoBack()">
            <i class="fas fa-arrow-right"></i> العودة للخلف
          </button>
          <button class="btn btn-secondary" onclick="handleGoHome()">
            <i class="fas fa-home"></i> الصفحة الرئيسية
          </button>
        </div>
        
        <div class="connection-status">
          <p><i class="fas fa-sync-alt"></i> جاري محاولة إعادة الاتصال تلقائياً...</p>
          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>غير متصل</span>
          </div>
        </div>
      </div>
      
      <script>
        // البحث عن الصفحات المخزنة
        async function findStoredPages() {
          try {
            const cacheNames = await caches.keys();
            const pages = [];
            
            for (const cacheName of cacheNames) {
              if (cacheName.includes('pages') || cacheName.includes('static')) {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();
                
                for (const request of requests) {
                  if (request.url.includes('.html') && request.url.includes('/Call/')) {
                    const url = new URL(request.url);
                    const pageName = url.pathname.split('/').pop() || url.pathname;
                    const title = pageName.replace('.html', '').replace(/_/g, ' ');
                    
                    if (!pages.some(p => p.url === request.url)) {
                      pages.push({
                        url: request.url,
                        name: pageName,
                        title: title
                      });
                    }
                  }
                }
              }
            }
            
            return pages;
          } catch (error) {
            return [];
          }
        }
        
        // عرض الصفحات المتاحة
        async function displayAvailablePages() {
          const pagesGrid = document.getElementById('pagesGrid');
          if (!pagesGrid) return;
          
          const pages = await findStoredPages();
          
          if (pages.length > 0) {
            pagesGrid.innerHTML = pages.map(page => \`
              <div class="page-card" onclick="navigateTo('\${page.url}')">
                <i class="fas fa-file-alt"></i>
                <span>\${page.title}</span>
              </div>
            \`).join('');
          } else {
            pagesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">لا توجد صفحات مخزنة</p>';
          }
        }
        
        // التنقل إلى صفحة
        function navigateTo(url) {
          window.location.href = url;
        }
        
        // معالجة الأزرار
        function handleRetry() {
          const btn = event.target.closest('.btn');
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إعادة المحاولة...';
          btn.disabled = true;
          
          setTimeout(() => {
            location.reload();
          }, 2000);
        }
        
        function handleGoBack() {
          if (history.length > 1) {
            history.back();
          } else {
            handleGoHome();
          }
        }
        
        function handleGoHome() {
          window.location.href = '/Call/index.html';
        }
        
        // محاولة إعادة الاتصال تلقائياً
        let retryCount = 0;
        const maxRetries = 10;
        
        function checkConnection() {
          if (navigator.onLine) {
            document.querySelector('.status-dot').style.background = '#10b981';
            document.querySelector('.status-indicator span').textContent = 'متصل';
            document.querySelector('.connection-status p').innerHTML = 
              '<i class="fas fa-check-circle"></i> تم استعادة الاتصال! سيتم التحديث تلقائياً...';
            
            setTimeout(() => {
              location.reload();
            }, 1500);
          } else {
            retryCount++;
            if (retryCount <= maxRetries) {
              setTimeout(checkConnection, 3000);
            } else {
              document.querySelector('.connection-status p').innerHTML = 
                '<i class="fas fa-exclamation-triangle"></i> توقف عن محاولة إعادة الاتصال تلقائياً';
            }
          }
        }
        
        // بدء فحص الاتصال بعد 3 ثواني
        setTimeout(checkConnection, 3000);
        
        // تحميل الصفحات المتاحة عند التحميل
        document.addEventListener('DOMContentLoaded', displayAvailablePages);
        
        // إضافة تأثيرات للأزرار
        document.addEventListener('DOMContentLoaded', () => {
          document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function() {
              this.style.transform = 'scale(0.95)';
              setTimeout(() => {
                this.style.transform = '';
              }, 150);
            });
          });
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(offlineHTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

// الحصول على رد افتراضي للموارد
function getFallbackResponse(request) {
  const url = request.url.toLowerCase();
  
  if (url.includes('.css')) {
    return new Response('', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  
  if (url.includes('.js')) {
    return new Response('// ملف JS غير متوفر حالياً', {
      headers: { 'Content-Type': 'application/javascript' }
    });
  }
  
  return new Response('', { status: 404 });
}

// الحصول على صورة افتراضية
function getDefaultImageResponse(request) {
  const url = request.url.toLowerCase();
  const fileName = getFileName(url);
  
  // إنشاء صورة SVG افتراضية حسب نوع المحتوى
  let svgContent = '';
  
  if (fileName.includes('product') || fileName.includes('item')) {
    svgContent = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#f8fafc"/>
        <rect x="100" y="50" width="200" height="200" rx="15" fill="#e2e8f0"/>
        <rect x="120" y="70" width="160" height="160" rx="10" fill="#cbd5e1"/>
        <circle cx="200" cy="150" r="50" fill="#94a3b8"/>
        <text x="200" y="270" text-anchor="middle" font-family="Cairo" font-size="14" fill="#475569">
          منتج غير متوفر حالياً
        </text>
      </svg>
    `;
  } else if (fileName.includes('user') || fileName.includes('profile')) {
    svgContent = `
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="70" r="40" fill="#cbd5e1"/>
        <path d="M30 140 Q100 200 170 140" fill="#e2e8f0"/>
        <text x="100" y="190" text-anchor="middle" font-family="Cairo" font-size="12" fill="#64748b">
          صورة الملف الشخصي
        </text>
      </svg>
    `;
  } else {
    svgContent = `
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="200" fill="#f1f5f9"/>
        <path d="M50,50 L250,50 L250,150 L50,150 Z" fill="#cbd5e1" fill-opacity="0.5" stroke="#94a3b8" stroke-width="2"/>
        <line x1="50" y1="50" x2="250" y2="150" stroke="#94a3b8" stroke-width="1"/>
        <line x1="250" y1="50" x2="50" y2="150" stroke="#94a3b8" stroke-width="1"/>
        <text x="150" y="180" text-anchor="middle" font-family="Cairo" font-size="14" fill="#64748b">
          صورة غير متوفرة
        </text>
      </svg>
    `;
  }
  
  return new Response(svgContent, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}

// ==================== التواصل مع الصفحات ====================
self.addEventListener('message', async (event) => {
  const { data } = event;
  
  switch (data.action) {
    case 'UPDATE_CACHE':
      await updateSpecificCache(data.cacheName, data.urls);
      break;
      
    case 'CLEAR_CACHE':
      await clearCache(data.cacheName);
      break;
      
    case 'GET_STATS':
      const stats = await getCacheStatistics();
      event.ports[0]?.postMessage(stats);
      break;
      
    case 'PREFETCH_PAGE':
      await prefetchPage(data.url);
      break;
  }
});

// تحديث كاش محدد
async function updateSpecificCache(cacheName, urls) {
  try {
    const cache = await caches.open(cacheName);
    const promises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`⚠️ فشل تحديث ${url}:`, error);
      }
    });
    
    await Promise.allSettled(promises);
  } catch (error) {
    console.error('❌ خطأ في تحديث الكاش:', error);
  }
}

// مسح الكاش
async function clearCache(cacheName) {
  if (cacheName === 'ALL') {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  } else {
    await caches.delete(cacheName);
  }
}

// الحصول على إحصائيات الكاش
async function getCacheStatistics() {
  const stats = {};
  
  for (const [name, cacheName] of Object.entries(CACHE_NAMES)) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      stats[name] = {
        count: keys.length,
        size: await calculateCacheSize(cache),
        items: keys.slice(0, 10).map(k => getFileName(k.url))
      };
    } catch (error) {
      stats[name] = { error: error.message };
    }
  }
  
  return stats;
}

// حساب حجم الكاش
async function calculateCacheSize(cache) {
  const requests = await cache.keys();
  let totalSize = 0;
  
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        totalSize += parseInt(contentLength);
      }
    }
  }
  
  return totalSize;
}

// تحميل صفحة مسبقاً
async function prefetchPage(url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.PAGES);
      await cache.put(url, response);
      console.log(`🔮 تم التحميل المسبق: ${getFileName(url)}`);
    }
  } catch (error) {
    console.warn(`⚠️ فشل التحميل المسبق لـ ${url}:`, error);
  }
}

// ==================== التحديث التلقائي ====================
// تحديث الكاش كل ساعة
setInterval(async () => {
  console.log('🔄 تحديث الكاش التلقائي...');
  
  try {
    // تحديث الموارد الأساسية
    await updateSpecificCache(CACHE_NAMES.STATIC, STATIC_RESOURCES.ESSENTIAL);
    
    // تحديث الصفحات المخزنة مؤخراً
    const pagesCache = await caches.open(CACHE_NAMES.PAGES);
    const pageKeys = await pagesCache.keys();
    const recentPages = pageKeys.slice(-10).map(k => k.url);
    
    await updateSpecificCache(CACHE_NAMES.PAGES, recentPages);
    
    console.log('✅ اكتمل التحديث التلقائي');
  } catch (error) {
    console.warn('⚠️ فشل التحديث التلقائي:', error);
  }
}, 60 * 60 * 1000); // كل ساعة

// ==================== تسجيل الخدمة ====================
console.log(`
=============================================
✅ Service Worker لـ AZ السوق الشامل محمل
📊 الإصدار: ${VERSION}
📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}
=============================================
`);
