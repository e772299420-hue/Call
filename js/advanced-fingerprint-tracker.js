// ملف: /js/advanced-fingerprint-tracker.js
// نظام متكامل لتتبع الزوار وحفظ البيانات في ملفات

class AdvancedFingerprintTracker {
    constructor(options = {}) {
        this.config = {
            serverEndpoint: options.serverEndpoint || '/api/tracker.php',
            storageKey: options.storageKey || 'adv_fingerprint_v3',
            sessionKey: options.sessionKey || 'adv_session_v3',
            enableAdvancedTracking: options.enableAdvancedTracking !== false,
            enableBehaviorAnalysis: options.enableBehaviorAnalysis !== false,
            enableSecurityMonitoring: options.enableSecurityMonitoring !== false,
            ...options
        };

        this.visitorData = {
            fingerprint: null,
            sessionId: null,
            visitorId: null,
            firstVisit: null,
            lastVisit: null,
            visitCount: 0,
            currentPage: null,
            pageHistory: [],
            entryTime: null,
            exitTime: null,
            timeSpent: 0,
            behaviorData: {},
            securityFlags: [],
            deviceInfo: {},
            banned: false
        };

        this.currentSession = {
            page: null,
            entryTime: null,
            exitTime: null,
            timeSpent: 0,
            scrollDepth: 0,
            clicks: 0,
            mouseMovements: 0
        };

        this.initialized = false;
        this.bannedVisitors = new Set();
        this.loadBannedVisitors();
    }

    async init() {
        if (this.initialized) return;

        try {
            // تحميل قائمة المحظورين أولاً
            await this.loadBannedVisitors();
            
            // تهيئة بيانات الزائر
            await this.initializeVisitorData();
            
            // تسجيل دخول الصفحة الحالية
            await this.trackPageEntry();
            
            // إعداد متتبعات السلوك
            this.setupBehaviorTracking();
            
            // إعداد متتبعات الأمان
            this.setupSecurityMonitoring();
            
            // إعداد متتبعات الخروج
            this.setupExitTracking();
            
            this.initialized = true;
            
            console.log('✅ نظام البصمة الرقمية المتقدم - جاهز للتشغيل');
        } catch (error) {
            console.error('❌ خطأ في تهيئة النظام:', error);
        }
    }

    // === تحميل قائمة الزوار المحظورين ===
    async loadBannedVisitors() {
        try {
            const response = await fetch('/data/banned_visitors.json?' + Date.now());
            if (response.ok) {
                const data = await response.json();
                data.banned.forEach(visitor => {
                    this.bannedVisitors.add(visitor.fingerprint);
                    this.bannedVisitors.add(visitor.visitorId);
                });
                console.log(`✅ تم تحميل ${data.banned.length} زائر محظور`);
            }
        } catch (error) {
            console.log('⚠️ لا توجد قائمة محظورين أو حدث خطأ في التحميل');
        }
    }

    // === تهيئة بيانات الزائر ===
    async initializeVisitorData() {
        const storedData = this.getStoredData();
        
        if (storedData && this.isDataValid(storedData)) {
            this.visitorData = storedData;
            this.visitorData.lastVisit = new Date().toISOString();
            this.visitorData.visitCount++;
            
            // التحقق من الحظر
            if (this.bannedVisitors.has(this.visitorData.fingerprint) || 
                this.bannedVisitors.has(this.visitorData.visitorId)) {
                this.visitorData.banned = true;
                console.warn('🚫 هذا الزائر محظور من الوصول');
                return;
            }
        } else {
            await this.createNewVisitor();
        }

        this.updateStoredData();
    }

    async createNewVisitor() {
        const fingerprint = await this.generateAdvancedFingerprint();
        const sessionId = this.generateUUID();
        const visitorId = this.generateVisitorId(fingerprint);

        // التحقق من الحظر قبل الإنشاء
        if (this.bannedVisitors.has(fingerprint) || this.bannedVisitors.has(visitorId)) {
            this.visitorData.banned = true;
            console.warn('🚫 هذا الزائر محظور من الوصول');
            return;
        }

        this.visitorData = {
            fingerprint,
            sessionId,
            visitorId,
            firstVisit: new Date().toISOString(),
            lastVisit: new Date().toISOString(),
            visitCount: 1,
            currentPage: this.getCurrentPageInfo(),
            pageHistory: [],
            entryTime: new Date().toISOString(),
            exitTime: null,
            timeSpent: 0,
            behaviorData: {
                totalVisits: 1,
                totalTimeSpent: 0,
                preferredPages: [],
                clickPatterns: [],
                scrollPatterns: [],
                averageTimePerPage: 0
            },
            securityFlags: this.runSecurityChecks(),
            deviceInfo: await this.collectDeviceInfo(),
            networkInfo: this.collectNetworkInfo(),
            banned: false
        };
    }

    // === تتبع دخول الصفحة ===
    async trackPageEntry() {
        if (this.visitorData.banned) return;

        const pageInfo = this.getCurrentPageInfo();
        this.currentSession = {
            page: pageInfo,
            entryTime: new Date().toISOString(),
            exitTime: null,
            timeSpent: 0,
            scrollDepth: 0,
            clicks: 0,
            mouseMovements: 0
        };

        // إضافة إلى سجل الصفحات
        this.visitorData.pageHistory.push({
            page: pageInfo,
            entryTime: this.currentSession.entryTime,
            exitTime: null,
            timeSpent: 0,
            sessionId: this.visitorData.sessionId
        });

        // حفظ البيانات
        await this.saveVisitorData('page_entry');
    }

    // === تتبع خروج الصفحة ===
    async trackPageExit() {
        if (this.visitorData.banned) return;

        const now = new Date().toISOString();
        this.currentSession.exitTime = now;
        this.currentSession.timeSpent = this.calculateTimeSpent(
            this.currentSession.entryTime, 
            now
        );

        // تحديث سجل الصفحات
        const currentPageRecord = this.visitorData.pageHistory[this.visitorData.pageHistory.length - 1];
        if (currentPageRecord) {
            currentPageRecord.exitTime = now;
            currentPageRecord.timeSpent = this.currentSession.timeSpent;
            currentPageRecord.scrollDepth = this.currentSession.scrollDepth;
            currentPageRecord.clicks = this.currentSession.clicks;
        }

        // تحديث الإحصائيات
        this.visitorData.timeSpent += this.currentSession.timeSpent;
        this.visitorData.behaviorData.totalTimeSpent = this.visitorData.timeSpent;
        this.visitorData.behaviorData.averageTimePerPage = 
            this.visitorData.timeSpent / this.visitorData.pageHistory.length;

        // حفظ البيانات
        await this.saveVisitorData('page_exit');
    }

    // === تتبع السلوك ===
    setupBehaviorTracking() {
        if (this.visitorData.banned) return;

        // تتبع التمرير
        let scrollTracking = false;
        window.addEventListener('scroll', () => {
            if (!scrollTracking) {
                scrollTracking = true;
                setTimeout(() => {
                    const scrollPercent = Math.round(
                        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
                    );
                    this.currentSession.scrollDepth = Math.max(this.currentSession.scrollDepth, scrollPercent);
                    scrollTracking = false;
                }, 100);
            }
        }, { passive: true });

        // تتبع النقرات
        document.addEventListener('click', (e) => {
            this.currentSession.clicks++;
            
            const clickData = {
                timestamp: new Date().toISOString(),
                element: e.target.tagName,
                className: e.target.className,
                id: e.target.id,
                x: e.clientX,
                y: e.clientY
            };
            
            this.visitorData.behaviorData.clickPatterns.push(clickData);
            
            // حفظ كل 10 نقرات
            if (this.currentSession.clicks % 10 === 0) {
                this.saveVisitorData('click_tracking');
            }
        }, { passive: true });

        // تتبع حركة الماوس
        let mouseMovements = 0;
        document.addEventListener('mousemove', () => {
            mouseMovements++;
            this.currentSession.mouseMovements = mouseMovements;
        }, { passive: true });

        // تتبع تغيير حجم النافذة
        window.addEventListener('resize', () => {
            this.visitorData.deviceInfo.viewport = `${window.innerWidth}x${window.innerHeight}`;
        }, { passive: true });
    }

    // === المراقبة الأمنية ===
    setupSecurityMonitoring() {
        // كشف أدوات المطور
        let devToolsOpen = false;
        
        const devToolsChecker = setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            
            if (widthThreshold || heightThreshold) {
                if (!devToolsOpen) {
                    this.addSecurityFlag('developer_tools', 'تم فتح أدوات المطور');
                    devToolsOpen = true;
                    this.saveVisitorData('security_alert');
                }
            } else {
                devToolsOpen = false;
            }
        }, 1000);

        // كشف محاولات التلاعب
        Object.defineProperty(window, 'performance', {
            writable: false,
            configurable: false
        });
    }

    // === تتبع الخروج ===
    setupExitTracking() {
        // قبل إغلاق الصفحة
        window.addEventListener('beforeunload', () => {
            this.trackPageExit();
        });

        // عند فقدان التركيز
        window.addEventListener('blur', () => {
            if (this.currentSession.entryTime && !this.currentSession.exitTime) {
                this.visitorData.behaviorData.totalBlurTime = 
                    (this.visitorData.behaviorData.totalBlurTime || 0) + 1;
            }
        });

        // عند العودة للصفحة
        window.addEventListener('focus', () => {
            // يمكن إضافة تحديثات عند العودة
        });
    }

    // === توليد البصمة المتقدمة ===
    async generateAdvancedFingerprint() {
        const components = await Promise.all([
            this.getBasicBrowserInfo(),
            this.getCanvasFingerprint(),
            this.getWebGLFingerprint(),
            this.getAudioFingerprint(),
            this.getFontFingerprint(),
            this.getHardwareInfo(),
            this.getAdvancedBrowserFeatures()
        ]);

        const fingerprintData = Object.assign({}, ...components);
        return this.hashSHA256(JSON.stringify(fingerprintData));
    }

    getBasicBrowserInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            maxTouchPoints: navigator.maxTouchPoints
        };
    }

    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 240;
            canvas.height = 60;

            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#069';
            ctx.font = '14px Arial';
            ctx.fillText('Advanced Fingerprint System', 10, 25);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.font = '12px Verdana';
            ctx.fillText('Security Tracking v3.0', 10, 45);

            return {
                canvas: this.hashSimple(canvas.toDataURL())
            };
        } catch (error) {
            return { canvas: 'error' };
        }
    }

    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return { webgl: 'unsupported' };

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                webglVendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                webglRenderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                webglVersion: gl.getParameter(gl.VERSION)
            };
        } catch (error) {
            return { webgl: 'error' };
        }
    }

    getAudioFingerprint() {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const compressor = context.createDynamicsCompressor();
            
            oscillator.connect(compressor);
            compressor.connect(context.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(10000, context.currentTime);
            
            return {
                audio: context.sampleRate > 0 ? 'supported' : 'unsupported'
            };
        } catch (error) {
            return { audio: 'unsupported' };
        }
    }

    getFontFingerprint() {
        const fonts = [
            'Arial', 'Verdana', 'Helvetica', 'Times New Roman',
            'Courier New', 'Georgia', 'Palatino', 'Garamond',
            'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black',
            'Impact', 'Webdings', 'Wingdings'
        ];

        const availableFonts = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        fonts.forEach(font => {
            ctx.font = '72px ' + font + ', monospace';
            const text = 'abcdefghijklmnopqrstuvwxyz';
            const width1 = ctx.measureText(text).width;
            
            ctx.font = '72px invalid-font-name, ' + font;
            const width2 = ctx.measureText(text).width;
            
            if (width1 !== width2) {
                availableFonts.push(font);
            }
        });

        return { fonts: availableFonts };
    }

    getHardwareInfo() {
        return {
            cores: navigator.hardwareConcurrency,
            memory: navigator.deviceMemory,
            screen: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }

    getAdvancedBrowserFeatures() {
        return {
            serviceWorker: 'serviceWorker' in navigator,
            webWorker: !!window.Worker,
            webAssembly: !!window.WebAssembly,
            webRTC: !!window.RTCPeerConnection,
            webGL: !!window.WebGLRenderingContext,
            geolocation: 'geolocation' in navigator,
            notifications: 'Notification' in window,
            pushManager: 'pushManager' in navigator.serviceWorker,
            storage: {
                localStorage: !!window.localStorage,
                sessionStorage: !!window.sessionStorage,
                indexedDB: !!window.indexedDB
            }
        };
    }

    // === جمع معلومات الجهاز ===
    async collectDeviceInfo() {
        return {
            ...this.getBasicBrowserInfo(),
            ...this.getHardwareInfo(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            touchSupport: 'ontouchstart' in window,
            online: navigator.onLine,
            connection: this.getConnectionInfo(),
            plugins: this.getPluginsInfo(),
            storage: this.getStorageInfo()
        };
    }

    getConnectionInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return connection ? {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt
        } : { available: false };
    }

    getPluginsInfo() {
        const plugins = [];
        for (let i = 0; i < navigator.plugins.length; i++) {
            plugins.push(navigator.plugins[i].name);
        }
        return plugins;
    }

    getStorageInfo() {
        return {
            localStorage: !!window.localStorage,
            sessionStorage: !!window.sessionStorage,
            indexedDB: !!window.indexedDB,
            cookies: navigator.cookieEnabled
        };
    }

    collectNetworkInfo() {
        return {
            ip: 'سيتم تحديده من الخادم',
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            origin: window.location.origin
        };
    }

    runSecurityChecks() {
        const flags = [];
        
        if (!navigator.cookieEnabled) flags.push('no_cookies');
        if (window.self !== window.top) flags.push('iframe_detected');
        if (navigator.webdriver) flags.push('webdriver_detected');
        
        return flags;
    }

    // === أدوات مساعدة ===
    getCurrentPageInfo() {
        return {
            title: document.title,
            url: window.location.href,
            path: window.location.pathname,
            hostname: window.location.hostname,
            protocol: window.location.protocol
        };
    }

    calculateTimeSpent(start, end) {
        const startTime = new Date(start);
        const endTime = new Date(end);
        return Math.round((endTime - startTime) / 1000); // بالثواني
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generateVisitorId(fingerprint) {
        return this.hashSHA256(fingerprint + navigator.userAgent).substring(0, 16);
    }

    // === التجزئة ===
    async hashSHA256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    hashSimple(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    // === التخزين المحلي ===
    getStoredData() {
        try {
            const stored = localStorage.getItem(this.config.storageKey);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            return null;
        }
    }

    updateStoredData() {
        try {
            localStorage.setItem(this.config.storageKey, JSON.stringify(this.visitorData));
            sessionStorage.setItem(this.config.sessionKey, this.visitorData.sessionId);
        } catch (error) {
            console.error('خطأ في التخزين المحلي:', error);
        }
    }

    isDataValid(data) {
        return data && 
               data.fingerprint && 
               data.visitorId && 
               data.firstVisit && 
               Array.isArray(data.pageHistory);
    }

    // === حفظ البيانات في الملف ===
    async saveVisitorData(action = 'auto_save') {
        if (this.visitorData.banned) return;

        try {
            const dataToSave = {
                action,
                timestamp: new Date().toISOString(),
                visitor: {
                    fingerprint: this.visitorData.fingerprint,
                    visitorId: this.visitorData.visitorId,
                    sessionId: this.visitorData.sessionId
                },
                session: this.currentSession,
                statistics: {
                    visitCount: this.visitorData.visitCount,
                    totalTimeSpent: this.visitorData.timeSpent,
                    averageTimePerPage: this.visitorData.behaviorData.averageTimePerPage
                },
                pageInfo: this.getCurrentPageInfo(),
                deviceInfo: this.visitorData.deviceInfo
            };

            const response = await fetch(this.config.serverEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSave)
            });

            if (!response.ok) {
                throw new Error(`خطأ في الخادم: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في حفظ البيانات:', error);
            // يمكن إضافة آلية احتياطية للتخزين المحلي
            this.saveToLocalBackup(dataToSave);
        }
    }

    saveToLocalBackup(data) {
        try {
            const backups = JSON.parse(localStorage.getItem('tracker_backups') || '[]');
            backups.push({
                timestamp: new Date().toISOString(),
                data: data
            });
            
            // الاحتفاظ بآخر 50 نسخة احتياطية فقط
            if (backups.length > 50) {
                backups.shift();
            }
            
            localStorage.setItem('tracker_backups', JSON.stringify(backups));
        } catch (error) {
            console.error('❌ خطأ في النسخ الاحتياطي المحلي:', error);
        }
    }

    // === API عام ===
    getVisitorData() {
        return { ...this.visitorData };
    }

    getSessionData() {
        return { ...this.currentSession };
    }

    isBanned() {
        return this.visitorData.banned;
    }

    // === تنظيف البيانات ===
    clearData() {
        localStorage.removeItem(this.config.storageKey);
        sessionStorage.removeItem(this.config.sessionKey);
        this.initialized = false;
        this.visitorData = {};
        this.currentSession = {};
    }
}

// التهيئة التلقائية
window.advancedFingerprintTracker = new AdvancedFingerprintTracker();

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.advancedFingerprintTracker.init();
    }, 1000);
});

// تصدير للاستخدام في وحدات أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedFingerprintTracker;
}
