// visitorTracker.js - نظام تتبع الزوار بالبصمة الرقمية

// تكوين Firebase
const firebaseConfig = {
    databaseURL: "https://chat-fat-free-default-rtdb.firebaseio.com/"
};

// متغيرات النظام
let currentFingerprint = null;
let currentVisitorId = null;
let isBanned = false;
let isInitialized = false;

// دالة التهيئة الرئيسية
function initializeVisitorTracker() {
    if (isInitialized) {
        console.log('نظام تتبع الزوار مفعل مسبقاً');
        return;
    }

    // التحقق من وجود Firebase
    if (typeof firebase === 'undefined') {
        console.error('Firebase غير محمل. يرجى إضافة مكتبة Firebase أولاً.');
        loadFirebaseLibraries();
        return;
    }

    // تهيئة النظام
    initSystem();
}

// تحميل مكتبات Firebase إذا لم تكن محملة
function loadFirebaseLibraries() {
    const firebaseAppScript = document.createElement('script');
    firebaseAppScript.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js';
    firebaseAppScript.onload = () => {
        const firebaseDatabaseScript = document.createElement('script');
        firebaseDatabaseScript.src = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js';
        firebaseDatabaseScript.onload = () => {
            initSystem();
        };
        document.head.appendChild(firebaseDatabaseScript);
    };
    document.head.appendChild(firebaseAppScript);
}

// تهيئة النظام
async function initSystem() {
    try {
        // تهيئة Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // إنشاء البصمة الرقمية
        currentFingerprint = await generateFingerprint();
        console.log('البصمة الرقمية:', currentFingerprint);

        // التحقق من الحظر
        await checkIfBanned();

        if (isBanned) {
            handleBannedVisitor();
            return;
        }

        // تسجيل الزيارة
        await recordVisit();

        // تحديث حالة التهيئة
        isInitialized = true;

        // تسجيل الخروج عند مغادرة الصفحة
        window.addEventListener('beforeunload', recordExitTime);

    } catch (error) {
        console.error('خطأ في تهيئة نظام تتبع الزوار:', error);
    }
}

// إنشاء بصمة رقمية
async function generateFingerprint() {
    const components = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        plugins: Array.from(navigator.plugins).map(p => p.name).join(','),
        canvas: getCanvasFingerprint(),
        webgl: getWebGLFingerprint(),
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || 'unknown',
        vendor: navigator.vendor || 'unknown'
    };

    // إضافة طرق إضافية لزيادة الدقة
    components.fonts = await getFontsFingerprint();
    components.audio = getAudioFingerprint();

    const fingerprintString = JSON.stringify(components);
    return hashString(fingerprintString);
}

// دالة التجزئة
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// بصمة Canvas
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 200;
        canvas.height = 50;
        
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Browser fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Browser fingerprint', 4, 17);
        
        return canvas.toDataURL();
    } catch (e) {
        return 'canvas-unsupported';
    }
}

// بصمة WebGL
function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            return 'no-webgl';
        }
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            return {
                vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                version: gl.getParameter(gl.VERSION)
            };
        }
        
        return 'no-debug-info';
    } catch (e) {
        return 'webgl-error';
    }
}

// بصمة الخطوط
async function getFontsFingerprint() {
    const fontList = [
        'Arial', 'Arial Black', 'Helvetica', 'Times New Roman',
        'Courier New', 'Verdana', 'Georgia', 'Palatino',
        'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
        'Impact', 'Webdings', 'Symbol'
    ];
    
    const availableFonts = [];
    
    // طريقة بسيطة للكشف عن الخطوط المتاحة
    for (const font of fontList) {
        if (isFontAvailable(font)) {
            availableFonts.push(font);
        }
    }
    
    return availableFonts;
}

// التحقق من توفر الخط
function isFontAvailable(font) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    const text = "abcdefghijklmnopqrstuvwxyz0123456789";
    context.font = `72px ${font}, monospace`;
    const width1 = context.measureText(text).width;
    
    context.font = '72px monospace';
    const width2 = context.measureText(text).width;
    
    return width1 !== width2;
}

// بصمة الصوت
function getAudioFingerprint() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const analyser = audioContext.createAnalyser();
        const gain = audioContext.createGain();
        
        oscillator.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);
        
        gain.gain.value = 0;
        oscillator.start(0);
        oscillator.stop(0);
        
        return 'audio-supported';
    } catch (e) {
        return 'audio-unsupported';
    }
}

// التحقق من الحظر
async function checkIfBanned() {
    try {
        const database = firebase.database();
        const snapshot = await database.ref('bannedVisitors').once('value');
        const bannedVisitors = snapshot.val();
        
        if (bannedVisitors && bannedVisitors[currentFingerprint]) {
            isBanned = true;
            return true;
        }
        
        isBanned = false;
        return false;
    } catch (error) {
        console.error('خطأ في التحقق من الحظر:', error);
        isBanned = false;
        return false;
    }
}

// تسجيل الزيارة
async function recordVisit() {
    try {
        const database = firebase.database();
        
        // الحصول على آخر رقم مسلسل للزيارات
        const serialSnapshot = await database.ref('visits').orderByChild('serial').limitToLast(1).once('value');
        let nextSerial = 1;
        
        if (serialSnapshot.exists()) {
            serialSnapshot.forEach(childSnapshot => {
                nextSerial = childSnapshot.val().serial + 1;
            });
        }

        // معلومات الصفحة الحالية
        const pageName = document.title || window.location.pathname || 'صفحة غير معروفة';
        const entryTime = new Date().toISOString();
        
        // إنشاء معرف فريد للزيارة
        currentVisitorId = `${currentFingerprint}_${Date.now()}`;
        
        // الحصول على عنوان IP
        const ipAddress = await getIPAddress();
        
        // حفظ بيانات الزيارة
        await database.ref(`visits/${currentVisitorId}`).set({
            fingerprint: currentFingerprint,
            serial: nextSerial,
            page: pageName,
            entryTime: entryTime,
            exitTime: null,
            userAgent: navigator.userAgent,
            ip: ipAddress,
            url: window.location.href,
            referrer: document.referrer || 'direct'
        });

        // تحديث بيانات البصمة الرقمية
        await updateDigitalFootprint(entryTime);
        
        console.log('تم تسجيل الزيارة بنجاح برقم مسلسل:', nextSerial);
    } catch (error) {
        console.error('خطأ في تسجيل الزيارة:', error);
    }
}

// الحصول على عنوان IP
async function getIPAddress() {
    try {
        // طريقة 1: استخدام خدمة ipify
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        try {
            // طريقة 2: استخدام خدمة بديلة
            const response = await fetch('https://api64.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error2) {
            console.error('خطأ في الحصول على الـ IP:', error2);
            return 'unknown';
        }
    }
}

// تحديث بيانات البصمة الرقمية
async function updateDigitalFootprint(entryTime) {
    try {
        const database = firebase.database();
        const fingerprintSnapshot = await database.ref(`digitalFootprints/${currentFingerprint}`).once('value');
        
        if (!fingerprintSnapshot.exists()) {
            // الحصول على آخر رقم مسلسل للبصمات
            const fpSerialSnapshot = await database.ref('digitalFootprints').orderByChild('serial').limitToLast(1).once('value');
            let nextFpSerial = 1;
            
            if (fpSerialSnapshot.exists()) {
                fpSerialSnapshot.forEach(childSnapshot => {
                    nextFpSerial = childSnapshot.val().serial + 1;
                });
            }
            
            // تسجيل البصمة الجديدة
            await database.ref(`digitalFootprints/${currentFingerprint}`).set({
                serial: nextFpSerial,
                firstSeen: entryTime,
                lastSeen: entryTime,
                visitCount: 1,
                userAgent: navigator.userAgent,
                ip: await getIPAddress()
            });
        } else {
            // تحديث البصمة الموجودة
            const currentData = fingerprintSnapshot.val();
            await database.ref(`digitalFootprints/${currentFingerprint}`).update({
                lastSeen: entryTime,
                visitCount: (currentData.visitCount || 0) + 1
            });
        }
    } catch (error) {
        console.error('خطأ في تحديث البصمة الرقمية:', error);
    }
}

// تسجيل وقت الخروج
async function recordExitTime() {
    if (currentVisitorId) {
        try {
            const database = firebase.database();
            await database.ref(`visits/${currentVisitorId}`).update({
                exitTime: new Date().toISOString()
            });
        } catch (error) {
            // لا نعرض خطأ هنا لأنه قد يحدث بسبب إغلاق الصفحة
            console.log('تم تسجيل وقت الخروج');
        }
    }
}

// التعامل مع الزائر المحظور
function handleBannedVisitor() {
    // يمكنك تخصيص هذا السلوك حسب احتياجاتك
    console.warn('تم منع الزائر المحظور من الوصول');
    
    // مثال: إعادة التوجيه إلى صفحة الحظر
    // window.location.href = '/banned.html';
    
    // أو إظهار رسالة للمستخدم
    const bannedMessage = document.createElement('div');
    bannedMessage.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
    `;
    bannedMessage.innerHTML = `
        <div>
            <h1 style="color: #e74c3c; margin-bottom: 20px;">⚠️ تم حظر دخولك</h1>
            <p style="font-size: 18px; margin-bottom: 30px;">عذراً، ليس لديك صلاحية الدخول إلى هذا الموقع.</p>
            <p>البصمة الرقمية: ${currentFingerprint}</p>
        </div>
    `;
    document.body.appendChild(bannedMessage);
}

// تصدير الدوال الرئيسية للاستخدام الخارجي
window.VisitorTracker = {
    initialize: initializeVisitorTracker,
    getFingerprint: () => currentFingerprint,
    isBanned: () => isBanned,
    recordExit: recordExitTime
};

// التهيئة التلقائية عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVisitorTracker);
} else {
    initializeVisitorTracker();
      }
