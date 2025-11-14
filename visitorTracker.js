// visitorTracker.js - نظام تتبع الزوار بالبصمة الرقمية المحسّن

// تكوين Firebase
const firebaseConfig = {
    databaseURL: "https://chat-fat-free-default-rtdb.firebaseio.com/"
};

// متغيرات النظام
let currentFingerprint = null;
let currentVisitorId = null;
let isBanned = false;
let isInitialized = false;
let isRecordingVisit = false;

// ثوابت التخزين المحلي
const STORAGE_KEYS = {
    FINGERPRINT: 'visitor_fingerprint',
    INITIALIZED: 'visitor_system_initialized',
    VISITOR_ID: 'current_visitor_id'
};

// دالة التهيئة الرئيسية
function initializeVisitorTracker() {
    if (isInitialized || localStorage.getItem(STORAGE_KEYS.INITIALIZED) === 'true') {
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
    if (isInitialized) {
        console.log('النظام مفعل بالفعل');
        return;
    }

    try {
        // تهيئة Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // الحصول على البصمة الرقمية (من التخزين المحلي أو إنشاء جديدة)
        currentFingerprint = await getOrCreateFingerprint();
        console.log('البصمة الرقمية:', currentFingerprint);

        // التحقق من الحظر
        await checkIfBanned();

        if (isBanned) {
            handleBannedVisitor();
            return;
        }

        // تسجيل الزيارة (فقط إذا لم يتم تسجيلها مسبقاً لهذه الجلسة)
        if (!isRecordingVisit) {
            await recordVisit();
        }

        // تحديث حالة التهيئة
        isInitialized = true;
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

        // تسجيل الخروج عند مغادرة الصفحة
        window.addEventListener('beforeunload', () => {
            recordExitTime();
        });

        // التعامل مع إعادة تحميل الصفحة
        window.addEventListener('pagehide', () => {
            recordExitTime();
        });

    } catch (error) {
        console.error('خطأ في تهيئة نظام تتبع الزوار:', error);
        // إعادة تعيين حالة التهيئة في حالة الخطأ
        isInitialized = false;
        localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
    }
}

// الحصول على البصمة الحالية أو إنشاء جديدة
async function getOrCreateFingerprint() {
    // التحقق من وجود بصمة مخزنة مسبقاً
    const storedFingerprint = localStorage.getItem(STORAGE_KEYS.FINGERPRINT);
    
    if (storedFingerprint && storedFingerprint.length > 10) {
        console.log('تم العثور على بصمة مخزنة مسبقاً');
        return storedFingerprint;
    }
    
    // إنشاء بصمة جديدة
    const newFingerprint = await generateFingerprint();
    
    // تخزين البصمة محلياً
    localStorage.setItem(STORAGE_KEYS.FINGERPRINT, newFingerprint);
    
    return newFingerprint;
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
        vendor: navigator.vendor || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        maxTouchPoints: navigator.maxTouchPoints || 0
    };

    // إضافة طرق إضافية لزيادة الدقة
    try {
        components.fonts = await getFontsFingerprint();
        components.audio = getAudioFingerprint();
    } catch (error) {
        console.log('خطأ في جمع بعض مكونات البصمة:', error);
        components.fonts = 'error';
        components.audio = 'error';
    }

    // إضافة طابع زمني لمنع التكرار
    components.timestamp = Date.now();
    
    const fingerprintString = JSON.stringify(components);
    return hashString(fingerprintString);
}

// دالة التجزئة المحسنة
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    // إضافة بادئة للتمييز وإرجاع بصمة أطول
    return 'fp_' + Math.abs(hash).toString(16) + '_' + str.length.toString(16);
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
        
        return canvas.toDataURL().substring(0, 100); // تقليل الحجم
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
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            return hashString(vendor + renderer).substring(0, 20);
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
        'Impact', 'Webdings', 'Symbol', 'Tahoma',
        'MS Sans Serif', 'MS Serif', 'System'
    ];
    
    const availableFonts = [];
    
    // طريقة بسيطة للكشف عن الخطوط المتاحة
    for (const font of fontList) {
        if (await isFontAvailable(font)) {
            availableFonts.push(font);
        }
    }
    
    return availableFonts.join(',');
}

// التحقق من توفر الخط (محسنة)
function isFontAvailable(font) {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            const text = "abcdefghijklmnopqrstuvwxyz0123456789";
            context.font = `72px ${font}, monospace`;
            const width1 = context.measureText(text).width;
            
            context.font = '72px monospace';
            const width2 = context.measureText(text).width;
            
            resolve(width1 !== width2);
        } catch (e) {
            resolve(false);
        }
    });
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
            console.warn('تم اكتشاف زائر محظور:', currentFingerprint);
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
    if (isRecordingVisit) {
        console.log('جاري بالفعل تسجيل زيارة حالية');
        return;
    }

    isRecordingVisit = true;

    try {
        const database = firebase.database();
        
        // التحقق من عدم تسجيل هذه الزيارة مسبقاً
        const existingVisit = await database.ref('visits')
            .orderByChild('fingerprint')
            .equalTo(currentFingerprint)
            .limitToLast(1)
            .once('value');

        let isNewVisit = true;
        let nextSerial = 1;

        if (existingVisit.exists()) {
            existingVisit.forEach(childSnapshot => {
                const visit = childSnapshot.val();
                // إذا كانت الزيارة السابقة في آخر 5 دقائق، تعتبر نفس الزيارة
                const lastVisitTime = new Date(visit.entryTime).getTime();
                const currentTime = new Date().getTime();
                if (currentTime - lastVisitTime < 5 * 60 * 1000) { // 5 دقائق
                    isNewVisit = false;
                    currentVisitorId = childSnapshot.key;
                }
                nextSerial = Math.max(nextSerial, (visit.serial || 0) + 1);
            });
        }

        if (!isNewVisit) {
            console.log('زيارة موجودة مسبقاً، يتم تحديثها فقط');
            // تحديث وقت آخر مشاهدة فقط
            await database.ref(`visits/${currentVisitorId}`).update({
                lastActivity: new Date().toISOString()
            });
            return;
        }

        // الحصول على آخر رقم مسلسل للزيارات (إذا لم نحصل عليه من الأعلى)
        if (nextSerial === 1) {
            const serialSnapshot = await database.ref('visits').orderByChild('serial').limitToLast(1).once('value');
            if (serialSnapshot.exists()) {
                serialSnapshot.forEach(childSnapshot => {
                    nextSerial = childSnapshot.val().serial + 1;
                });
            }
        }

        // معلومات الصفحة الحالية
        const pageName = document.title || window.location.pathname || 'صفحة غير معروفة';
        const entryTime = new Date().toISOString();
        
        // إنشاء معرف فريد للزيارة
        currentVisitorId = `${currentFingerprint}_${Date.now()}`;
        localStorage.setItem(STORAGE_KEYS.VISITOR_ID, currentVisitorId);
        
        // الحصول على عنوان IP
        const ipAddress = await getIPAddress();
        
        // حفظ بيانات الزيارة
        await database.ref(`visits/${currentVisitorId}`).set({
            fingerprint: currentFingerprint,
            serial: nextSerial,
            page: pageName,
            entryTime: entryTime,
            exitTime: null,
            lastActivity: entryTime,
            userAgent: navigator.userAgent,
            ip: ipAddress,
            url: window.location.href,
            referrer: document.referrer || 'direct',
            sessionId: generateSessionId()
        });

        // تحديث بيانات البصمة الرقمية (مرة واحدة فقط)
        await updateDigitalFootprint(entryTime);
        
        console.log('تم تسجيل الزيارة بنجاح برقم مسلسل:', nextSerial);
    } catch (error) {
        console.error('خطأ في تسجيل الزيارة:', error);
        isRecordingVisit = false;
    }
}

// إنشاء معرف جلسة فريد
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// الحصول على عنوان IP
async function getIPAddress() {
    try {
        // استخدام خدمة ipify
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        try {
            // استخدام خدمة بديلة
            const response = await fetch('https://api64.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error2) {
            console.error('خطأ في الحصول على الـ IP:', error2);
            return 'unknown';
        }
    }
}

// تحديث بيانات البصمة الرقمية (محسنة لمنع التكرار)
async function updateDigitalFootprint(entryTime) {
    try {
        const database = firebase.database();
        const fingerprintRef = database.ref(`digitalFootprints/${currentFingerprint}`);
        const fingerprintSnapshot = await fingerprintRef.once('value');
        
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
            await fingerprintRef.set({
                serial: nextFpSerial,
                firstSeen: entryTime,
                lastSeen: entryTime,
                visitCount: 1,
                userAgent: navigator.userAgent,
                ip: await getIPAddress(),
                created: entryTime
            });
            console.log('تم إنشاء بصمة رقمية جديدة');
        } else {
            // تحديث البصمة الموجودة (فقط إذا مر وقت كافٍ)
            const currentData = fingerprintSnapshot.val();
            const lastSeen = new Date(currentData.lastSeen).getTime();
            const currentTime = new Date().getTime();
            
            // تحديث فقط إذا مر أكثر من 10 دقائق منذ آخر تحديث
            if (currentTime - lastSeen > 10 * 60 * 1000) {
                await fingerprintRef.update({
                    lastSeen: entryTime,
                    visitCount: (currentData.visitCount || 0) + 1,
                    updated: entryTime
                });
                console.log('تم تحديث البصمة الرقمية');
            } else {
                console.log('البصمة الرقمية محدثة بالفعل، لا حاجة للتحديث');
            }
        }
    } catch (error) {
        console.error('خطأ في تحديث البصمة الرقمية:', error);
    }
}

// تسجيل وقت الخروج
async function recordExitTime() {
    if (!currentVisitorId) {
        currentVisitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
    }
    
    if (currentVisitorId) {
        try {
            const database = firebase.database();
            await database.ref(`visits/${currentVisitorId}`).update({
                exitTime: new Date().toISOString(),
                sessionEnd: true
            });
            console.log('تم تسجيل وقت الخروج للزيارة:', currentVisitorId);
            
            // تنظيف التخزين المحلي
            localStorage.removeItem(STORAGE_KEYS.VISITOR_ID);
        } catch (error) {
            // لا نعرض خطأ هنا لأنه قد يحدث بسبب إغلاق الصفحة
            console.log('تم تسجيل وقت الخروج (باستخدام تخزين مؤقت)');
        }
    }
}

// التعامل مع الزائر المحظور
function handleBannedVisitor() {
    console.warn('تم منع الزائر المحظور من الوصول:', currentFingerprint);
    
    // إظهار رسالة للمستخدم
    const bannedMessage = document.createElement('div');
    bannedMessage.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
    `;
    bannedMessage.innerHTML = `
        <div>
            <h1 style="color: #e74c3c; margin-bottom: 20px; font-size: 2.5em;">⚠️ تم حظر دخولك</h1>
            <p style="font-size: 1.2em; margin-bottom: 30px; line-height: 1.6;">
                عذراً، ليس لديك صلاحية الدخول إلى هذا الموقع.<br>
                إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم الفني.
            </p>
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 10px 0; font-family: monospace; font-size: 0.9em;">
                    البصمة الرقمية: ${currentFingerprint}
                </p>
            </div>
            <p style="font-size: 0.9em; color: #bbb;">
                المرجع: ${document.referrer || 'دخول مباشر'}
            </p>
        </div>
    `;
    document.body.appendChild(bannedMessage);

    // منع أي تفاعل إضافي مع الصفحة
    document.body.style.overflow = 'hidden';
}

// إعادة تعيين النظام (لأغراض التطوير)
function resetVisitorSystem() {
    isInitialized = false;
    isRecordingVisit = false;
    currentFingerprint = null;
    currentVisitorId = null;
    
    localStorage.removeItem(STORAGE_KEYS.FINGERPRINT);
    localStorage.removeItem(STORAGE_KEYS.INITIALIZED);
    localStorage.removeItem(STORAGE_KEYS.VISITOR_ID);
    
    console.log('تم إعادة تعيين نظام تتبع الزوار');
}

// تصدير الدوال الرئيسية للاستخدام الخارجي
window.VisitorTracker = {
    initialize: initializeVisitorTracker,
    getFingerprint: () => currentFingerprint,
    isBanned: () => isBanned,
    recordExit: recordExitTime,
    reset: resetVisitorSystem,
    getVisitorId: () => currentVisitorId
};

// التهيئة التلقائية عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVisitorTracker);
} else {
    setTimeout(initializeVisitorTracker, 1000); // تأخير بسيط لضمان تحميل الصفحة بالكامل
}
