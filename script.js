
// إعدادات Firebase
const firebaseConfig = {
    databaseURL: "https://chat-fat-free-default-rtdb.firebaseio.com/"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// إعدادات Google Drive
// معرف مجلد Google Drive
const DRIVE_FOLDER_ID = '1A9kpKsUxVy8q0P0p3QaXmK3VeB-pSDms';

// رابط تطبيق الويب الذي نشرته من Google Apps Script
const DRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbxI1JTjuE8FcvORcW56clvMGgIyShuHkA20FMh7Nfob5fFMHpZoKLB8pr2Sy6r_5YPc/exec';

// رفع الصور إلى Google Drive
async function uploadImagesToDrive(files) {
    const uploadedImageIds = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', DRIVE_FOLDER_ID); // تحديد المجلد
        
        try {
            const response = await fetch(DRIVE_API_URL, {
                method: 'POST',
                body: formData
            });
            
            // إضافة فحص لحالة الرد
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`خطأ في استجابة الخادم: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            if (data && data.fileId) {
                uploadedImageIds.push(data.fileId); // معرف الصورة بعد الرفع
            } else {
                console.error('فشل رفع الصورة:', file.name, data);
                // رفع خطأ واضح إذا كان الرد لا يحتوي على fileId
                throw new Error('فشل رفع الصورة: لا يوجد معرف ملف في الرد.');
            }
            
        } catch (error) {
            console.error('خطأ في رفع الصورة:', file.name, error);
            throw new Error(`فشل رفع الصورة: ${error.message}`);
        }
    }
    
    return uploadedImageIds;
}

// دالة معالجة اختيار الصور التي تستخدم Google Drive
// ملاحظة: تم دمج هذه الدالة مع الدالة المشابهة في الكود الأصلي
async function handleImageSelection(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const progressElement = document.getElementById('upload-progress');
    const uploadedImagesElement = document.getElementById('uploaded-images');
    
    progressElement.classList.remove('hidden');
    progressElement.textContent = 'جاري رفع الصور...';
    uploadedImagesElement.innerHTML = '';
    
    try {
        const imageIds = await uploadImagesToDrive(files);
        
        imageIds.forEach((id, index) => {
            const img = document.createElement('img');
            img.className = 'uploaded-image';
            // استخدام blob URL للعرض الفوري
            img.src = URL.createObjectURL(files[index]);
            img.title = files[index].name;
            uploadedImagesElement.appendChild(img);
        });
        
        // تحديث متغير uploadedImageIds العام
        uploadedImageIds = imageIds; 
        document.getElementById('image-ids').value = imageIds.join(',');
        progressElement.textContent = `تم رفع ${imageIds.length} صورة بنجاح`;
        
    } catch (error) {
        console.error('حدث خطأ في رفع الصور:', error);
        progressElement.textContent = 'حدث خطأ في رفع الصور';
        // إضافة رسالة واضحة للمستخدم
        showAlert('حدث خطأ في رفع الصور: ' + error.message, 'error');
    }
}

// متغيرات عامة
let currentUser = null;
let currentUserType = null;
let currentLocation = null;
let allProducts = [];
let currentImageGallery = [];
let currentImageIndex = 0;
let uploadedImageIds = [];

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadInitialData();
});

// تهيئة التطبيق
function initializeApp() {
    showScreen('visitor-screen');
    loadProducts();
}

// إعداد مستمعات الأحداث
function setupEventListeners() {
    // أزرار التنقل
    document.getElementById('menu-btn').addEventListener('click', showLoginScreen);
    document.getElementById('close-login').addEventListener('click', showVisitorScreen);
    document.getElementById('admin-logout').addEventListener('click', logout);
    document.getElementById('merchant-logout').addEventListener('click', logout);
    
    // نموذج تسجيل الدخول
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // تحديد الموقع
    document.getElementById('get-location').addEventListener('click', getCurrentLocation);
    
    // التبويبات
    setupTabNavigation();
    
    // نماذج الأدمن
    document.getElementById('add-governorate-form').addEventListener('submit', addGovernorate);
    document.getElementById('add-area-form').addEventListener('submit', addArea);
    document.getElementById('add-category-form').addEventListener('submit', addCategory);
    document.getElementById('add-merchant-form').addEventListener('submit', addMerchant);
    
    // نماذج التاجر
    document.getElementById('add-product-form').addEventListener('submit', addProduct);
    document.getElementById('select-images').addEventListener('click', selectImages);
    document.getElementById('product-images').addEventListener('change', handleImageSelection);
    
    // الفلاتر
    setupFilters();
    
    // النوافذ المنبثقة
    setupModals();
    
    // تغيير المحافظة في نموذج التاجر
    document.getElementById('merchant-governorate').addEventListener('change', updateMerchantAreas);
}

// إدارة الشاشات
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showLoginScreen() {
    showScreen('login-screen');
}

function showVisitorScreen() {
    showScreen('visitor-screen');
}

// إعداد التبويبات
function setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabContainer = this.closest('.admin-tabs, .merchant-tabs').parentElement;
            const tabName = this.dataset.tab;
            
            // إزالة الفئة النشطة من جميع الأزرار
            tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // إخفاء جميع المحتويات وإظهار المحتوى المطلوب
            tabContainer.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName + '-tab').classList.add('active');
        });
    });
}

// تسجيل الدخول
async function handleLogin(e) {
    e.preventDefault();
    
    const userType = document.getElementById('user-type').value;
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!userType || !username || !password) {
        showAlert('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        if (userType === 'admin') {
            // تحقق من بيانات الأدمن
            const adminSnapshot = await database.ref('admins').child(username).once('value');
            const adminData = adminSnapshot.val();
            
            if (adminData && adminData.password === password) {
                currentUser = { username, name: adminData.name || 'المدير', type: 'admin' };
                currentUserType = 'admin';
                showScreen('admin-screen');
                loadAdminData();
                showAlert('تم تسجيل الدخول بنجاح', 'success');
            } else {
                showAlert('بيانات الأدمن غير صحيحة', 'error');
            }
        } else if (userType === 'merchant') {
            // تحقق من بيانات التاجر
            const merchantsSnapshot = await database.ref('merchants').once('value');
            const merchants = merchantsSnapshot.val() || {};
            
            let merchantFound = null;
            let merchantId = null;
            
            for (const [id, merchant] of Object.entries(merchants)) {
                if (merchant.username === username && merchant.password === password) {
                    merchantFound = merchant;
                    merchantId = id;
                    break;
                }
            }
            
            if (merchantFound) {
                currentUser = { ...merchantFound, id: merchantId };
                currentUserType = 'merchant';
                showScreen('merchant-screen');
                loadMerchantData();
                showAlert('تم تسجيل الدخول بنجاح', 'success');
            } else {
                showAlert('بيانات التاجر غير صحيحة', 'error');
            }
        }
        
        // مسح النموذج
        document.getElementById('login-form').reset();
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showAlert('حدث خطأ أثناء تسجيل الدخول', 'error');
    } finally {
        showLoading(false);
    }
}

// تسجيل الخروج
function logout() {
    currentUser = null;
    currentUserType = null;
    currentLocation = null;
    showScreen('visitor-screen');
    showAlert('تم تسجيل الخروج بنجاح', 'success');
}

// تحديد الموقع الجغرافي
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showAlert('المتصفح لا يدعم خدمات تحديد الموقع', 'error');
        return;
    }
    
    const locationBtn = document.getElementById('get-location');
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحديد الموقع...';
    locationBtn.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
        async function(position) {
            try {
                currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: Date.now()
                };
                
                // حفظ الموقع في قاعدة البيانات
                if (currentUser && currentUser.id) {
                    await database.ref(`merchants/${currentUser.id}/location`).set(currentLocation);
                    updateLocationStatus(true);
                    showAlert('تم حفظ موقعك بنجاح', 'success');
                }
            } catch (error) {
                console.error('خطأ في حفظ الموقع:', error);
                showAlert('حدث خطأ في حفظ الموقع', 'error');
            } finally {
                locationBtn.innerHTML = originalText;
                locationBtn.disabled = false;
            }
        },
        function(error) {
            console.error('خطأ في تحديد الموقع:', error);
            let message = 'لا يمكن تحديد الموقع';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = 'تم رفض الإذن لتحديد الموقع';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'معلومات الموقع غير متوفرة';
                    break;
                case error.TIMEOUT:
                    message = 'انتهت مهلة تحديد الموقع';
                    break;
            }
            
            showAlert(message, 'error');
            locationBtn.innerHTML = originalText;
            locationBtn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// تحديث حالة الموقع
function updateLocationStatus(hasLocation) {
    const statusElement = document.getElementById('location-status');
    const textElement = document.getElementById('location-text');
    
    if (hasLocation) {
        statusElement.classList.add('success');
        textElement.textContent = `تم حفظ الموقع: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
    } else {
        statusElement.classList.remove('success');
        textElement.textContent = 'لم يتم تحديد الموقع بعد';
    }
}

// تحميل البيانات الأولية
async function loadInitialData() {
    try {
        // إنشاء بيانات افتراضية إذا لم تكن موجودة
        await ensureDefaultData();
        
        // تحميل البيانات
        await loadDropdownData();
        
    } catch (error) {
        console.error('خطأ في تحميل البيانات الأولية:', error);
    }
}

// ضمان وجود البيانات الافتراضية
async function ensureDefaultData() {
    try {
        // التحقق من وجود أدمن افتراضي
        const adminSnapshot = await database.ref('admins').once('value');
        if (!adminSnapshot.exists()) {
            await database.ref('admins/admin').set({
                password: 'admin123',
                name: 'المدير العام'
            });
        }
        
        // التحقق من وجود محافظة افتراضية
        const governoratesSnapshot = await database.ref('governorates').once('value');
        if (!governoratesSnapshot.exists()) {
            const defaultGov = {
                name: 'بغداد',
                areas: {
                    'karrada': 'الكرادة',
                    'mansour': 'المنصور',
                    'sadr_city': 'مدينة الصدر'
                }
            };
            await database.ref('governorates/baghdad').set(defaultGov);
        }
        
        // التحقق من وجود أقسام افتراضية
        const categoriesSnapshot = await database.ref('categories').once('value');
        if (!categoriesSnapshot.exists()) {
            const defaultCategories = {
                'electronics': 'إلكترونيات',
                'accessories': 'إكسسوارات',
                'clothing': 'ملابس',
                'food': 'مواد غذائية'
            };
            await database.ref('categories').set(defaultCategories);
        }
        
    } catch (error) {
        console.error('خطأ في إنشاء البيانات الافتراضية:', error);
    }
}

// تحميل بيانات القوائم المنسدلة
async function loadDropdownData() {
    try {
        // تحميل المحافظات
        const governoratesSnapshot = await database.ref('governorates').once('value');
        const governorates = governoratesSnapshot.val() || {};
        updateGovernorateDropdowns(governorates);
        
        // تحميل الأقسام
        const categoriesSnapshot = await database.ref('categories').once('value');
        const categories = categoriesSnapshot.val() || {};
        updateCategoryDropdowns(categories);
        
    } catch (error) {
        console.error('خطأ في تحميل بيانات القوائم:', error);
    }
}

// تحديث قوائم المحافظات
function updateGovernorateDropdowns(governorates) {
    const dropdowns = [
        'filter-governorate',
        'area-governorate',
        'merchant-governorate'
    ];
    
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            const currentValue = dropdown.value;
            dropdown.innerHTML = '';
            
            // إضافة خيار افتراضي
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = dropdownId.includes('filter') ? 'جميع المحافظات' : 'اختر المحافظة';
            dropdown.appendChild(defaultOption);
            
            // إضافة المحافظات
            Object.entries(governorates).forEach(([id, gov]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = gov.name;
                dropdown.appendChild(option);
            });
            
            // استعادة القيمة المحددة سابقاً
            if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
                dropdown.value = currentValue;
            }
        }
    });
}

// تحديث قوائم الأقسام
function updateCategoryDropdowns(categories) {
    const dropdowns = ['filter-category', 'product-category'];
    
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            const currentValue = dropdown.value;
            dropdown.innerHTML = '';
            
            // إضافة خيار افتراضي
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = dropdownId.includes('filter') ? 'جميع الأقسام' : 'اختر القسم';
            dropdown.appendChild(defaultOption);
            
            // إضافة الأقسام
            Object.entries(categories).forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                dropdown.appendChild(option);
            });
            
            // استعادة القيمة المحددة سابقاً
            if (currentValue && [...dropdown.options].some(opt => opt.value === currentValue)) {
                dropdown.value = currentValue;
            }
        }
    });
}

// إعداد الفلاتر
function setupFilters() {
    document.getElementById('filter-governorate').addEventListener('change', updateAreaFilter);
    document.getElementById('filter-area').addEventListener('change', updateMerchantFilter);
    
    // إضافة مستمعات لجميع الفلاتر
    ['filter-governorate', 'filter-area', 'filter-merchant', 'filter-category', 'filter-availability'].forEach(filterId => {
        document.getElementById(filterId).addEventListener('change', filterProducts);
    });
}

// تحديث فلتر المناطق
async function updateAreaFilter() {
    const governorateId = document.getElementById('filter-governorate').value;
    const areaDropdown = document.getElementById('filter-area');
    
    areaDropdown.innerHTML = '<option value="">جميع المناطق</option>';
    
    if (governorateId) {
        try {
            const areasSnapshot = await database.ref(`governorates/${governorateId}/areas`).once('value');
            const areas = areasSnapshot.val() || {};
            
            Object.entries(areas).forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                areaDropdown.appendChild(option);
            });
        } catch (error) {
            console.error('خطأ في تحديث فلتر المناطق:', error);
        }
    }
    
    // إعادة تعيين فلتر التجار
    document.getElementById('filter-merchant').innerHTML = '<option value="">جميع التجار</option>';
    
    filterProducts();
}

// تحديث فلتر التجار
async function updateMerchantFilter() {
    const governorateId = document.getElementById('filter-governorate').value;
    const areaId = document.getElementById('filter-area').value;
    const merchantDropdown = document.getElementById('filter-merchant');
    
    merchantDropdown.innerHTML = '<option value="">جميع التجار</option>';
    
    if (governorateId) {
        try {
            const merchantsSnapshot = await database.ref('merchants').once('value');
            const merchants = merchantsSnapshot.val() || {};
            
            Object.entries(merchants).forEach(([id, merchant]) => {
                if (merchant.governorate === governorateId && (!areaId || merchant.area === areaId)) {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = merchant.name;
                    merchantDropdown.appendChild(option);
                }
            });
        } catch (error) {
            console.error('خطأ في تحديث فلتر التجار:', error);
        }
    }
    
    filterProducts();
}

// تصفية المنتجات
function filterProducts() {
    const filters = {
        governorate: document.getElementById('filter-governorate').value,
        area: document.getElementById('filter-area').value,
        merchant: document.getElementById('filter-merchant').value,
        category: document.getElementById('filter-category').value,
        availability: document.getElementById('filter-availability').value
    };
    
    let filteredProducts = allProducts.filter(product => {
        if (filters.governorate && product.governorate !== filters.governorate) return false;
        if (filters.area && product.area !== filters.area) return false;
        if (filters.merchant && product.merchantId !== filters.merchant) return false;
        if (filters.category && product.category !== filters.category) return false;
        if (filters.availability && product.availability !== filters.availability) return false;
        return true;
    });
    
    displayProducts(filteredProducts);
}

// تحميل المنتجات
async function loadProducts() {
    try {
        showLoading(true);
        
        const productsSnapshot = await database.ref('products').once('value');
        const products = productsSnapshot.val() || {};
        
        allProducts = Object.entries(products).map(([id, product]) => ({
            ...product,
            id
        }));
        
        // ترتيب المنتجات حسب تاريخ الإضافة (الأحدث أولاً)
        allProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        displayProducts(allProducts);
        
    } catch (error) {
        console.error('خطأ في تحميل المنتجات:', error);
        showAlert('حدث خطأ في تحميل المنتجات', 'error');
    } finally {
        showLoading(false);
    }
}

// عرض المنتجات
function displayProducts(products) {
    const grid = document.getElementById('products-grid');
    const noProducts = document.getElementById('no-products');
    
    grid.innerHTML = '';
    
    if (products.length === 0) {
        grid.classList.add('hidden');
        noProducts.classList.remove('hidden');
        return;
    }
    
    grid.classList.remove('hidden');
    noProducts.classList.add('hidden');
    
    products.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

// إنشاء بطاقة منتج
function createProductCard(product, isMerchantView = false) {
    const card = document.createElement('div');
    card.className = `product-card ${product.availability === 'unavailable' ? 'unavailable' : ''}`;
    
    // الصورة
    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image-container';
    
    if (product.imageIds && product.imageIds.length > 0) {
        const img = document.createElement('img');
        img.className = 'product-image';
        img.src = getDriveImageUrl(product.imageIds[0]);
        img.alt = product.name;
        img.addEventListener('click', () => openImageGallery(product.imageIds, product.name));
        imageContainer.appendChild(img);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'product-image';
        placeholder.style.background = '#f1f5f9';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#64748b';
        placeholder.innerHTML = '<i class="fas fa-image" style="font-size: 2rem;"></i>';
        imageContainer.appendChild(placeholder);
    }
    
    // معلومات المنتج
    const info = document.createElement('div');
    info.className = 'product-info';
    
    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = product.name;
    
    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = `${product.price} د.ع`;
    
    info.appendChild(name);
    
    if (product.description) {
        const description = document.createElement('p');
        description.className = 'product-description';
        description.textContent = product.description;
        info.appendChild(description);
    }
    
    info.appendChild(price);
    
    // اسم التاجر (للزوار فقط)
    if (!isMerchantView && product.merchantName) {
        const merchant = document.createElement('a');
        merchant.className = 'product-merchant';
        merchant.textContent = `التاجر: ${product.merchantName}`;
        merchant.addEventListener('click', (e) => {
            e.preventDefault();
            openMerchantLocation(product.merchantId);
        });
        info.appendChild(merchant);
    }
    
    // العلامات
    const tags = document.createElement('div');
    tags.className = 'product-tags';
    
    if (product.categoryName) {
        const categoryTag = document.createElement('span');
        categoryTag.className = 'product-category';
        categoryTag.textContent = product.categoryName;
        tags.appendChild(categoryTag);
    }
    
    const availabilityTag = document.createElement('span');
    availabilityTag.className = `product-availability ${product.availability}`;
    availabilityTag.textContent = product.availability === 'available' ? 'متوفر' : 'منتهي';
    tags.appendChild(availabilityTag);
    
    info.appendChild(tags);
    
    // زر حذف للتاجر
    if (isMerchantView) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> حذف';
        deleteBtn.addEventListener('click', () => deleteProduct(product.id));
        info.appendChild(deleteBtn);
    }
    
    card.appendChild(imageContainer);
    card.appendChild(info);
    
    return card;
}

// الحصول على رابط صورة Google Drive
function getDriveImageUrl(fileId) {
    return `https://drive.google.com/uc?id=${fileId}&export=view`;
}

// فتح موقع التاجر على الخريطة
async function openMerchantLocation(merchantId) {
    try {
        const locationSnapshot = await database.ref(`merchants/${merchantId}/location`).once('value');
        const location = locationSnapshot.val();
        
        if (location && location.latitude && location.longitude) {
            const url = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
            window.open(url, '_blank');
        } else {
            showAlert('موقع التاجر غير متوفر', 'warning');
        }
    } catch (error) {
        console.error('خطأ في فتح موقع التاجر:', error);
        showAlert('حدث خطأ في فتح الموقع', 'error');
    }
}

// وظائف الأدمن
async function loadAdminData() {
    try {
        await loadDropdownData();
        await displayGovernoratesAndAreas();
        await displayCategories();
        await displayMerchants();
    } catch (error) {
        console.error('خطأ في تحميل بيانات الأدمن:', error);
    }
}

// إضافة محافظة
async function addGovernorate(e) {
    e.preventDefault();
    
    const name = document.getElementById('governorate-name').value.trim();
    if (!name) {
        showAlert('يرجى إدخال اسم المحافظة', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const id = generateId(name);
        await database.ref(`governorates/${id}`).set({
            name: name,
            areas: {}
        });
        
        document.getElementById('add-governorate-form').reset();
        await loadDropdownData();
        await displayGovernoratesAndAreas();
        
        showAlert('تم إضافة المحافظة بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إضافة المحافظة:', error);
        showAlert('حدث خطأ في إضافة المحافظة', 'error');
    } finally {
        showLoading(false);
    }
}

// إضافة منطقة
async function addArea(e) {
    e.preventDefault();
    
    const governorateId = document.getElementById('area-governorate').value;
    const name = document.getElementById('area-name').value.trim();
    
    if (!governorateId || !name) {
        showAlert('يرجى اختيار المحافظة وإدخال اسم المنطقة', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const id = generateId(name);
        await database.ref(`governorates/${governorateId}/areas/${id}`).set(name);
        
        document.getElementById('add-area-form').reset();
        await displayGovernoratesAndAreas();
        
        showAlert('تم إضافة المنطقة بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إضافة المنطقة:', error);
        showAlert('حدث خطأ في إضافة المنطقة', 'error');
    } finally {
        showLoading(false);
    }
}

// إضافة قسم
async function addCategory(e) {
    e.preventDefault();
    
    const name = document.getElementById('category-name').value.trim();
    if (!name) {
        showAlert('يرجى إدخال اسم القسم', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const id = generateId(name);
        await database.ref(`categories/${id}`).set(name);
        
        document.getElementById('add-category-form').reset();
        await loadDropdownData();
        await displayCategories();
        
        showAlert('تم إضافة القسم بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إضافة القسم:', error);
        showAlert('حدث خطأ في إضافة القسم', 'error');
    } finally {
        showLoading(false);
    }
}

// إضافة تاجر
async function addMerchant(e) {
    e.preventDefault();
    
    const username = document.getElementById('merchant-username').value.trim();
    const password = document.getElementById('merchant-password').value;
    const name = document.getElementById('merchant-name').value.trim();
    const governorate = document.getElementById('merchant-governorate').value;
    const area = document.getElementById('merchant-area').value;
    
    if (!username || !password || !name || !governorate || !area) {
        showAlert('يرجى ملء جميع الحقول', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        // التحقق من عدم وجود اسم المستخدم مسبقاً
        const existingMerchant = await database.ref('merchants').orderByChild('username').equalTo(username).once('value');
        if (existingMerchant.exists()) {
            showAlert('اسم المستخدم موجود مسبقاً', 'error');
            return;
        }
        
        const merchantId = generateId(username);
        await database.ref(`merchants/${merchantId}`).set({
            username: username,
            password: password,
            name: name,
            governorate: governorate,
            area: area,
            createdAt: Date.now()
        });
        
        document.getElementById('add-merchant-form').reset();
        await displayMerchants();
        
        showAlert('تم إضافة التاجر بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إضافة التاجر:', error);
        showAlert('حدث خطأ في إضافة التاجر', 'error');
    } finally {
        showLoading(false);
    }
}

// تحديث مناطق التاجر
async function updateMerchantAreas() {
    const governorateId = document.getElementById('merchant-governorate').value;
    const areaDropdown = document.getElementById('merchant-area');
    
    areaDropdown.innerHTML = '<option value="">اختر المنطقة</option>';
    
    if (governorateId) {
        try {
            const areasSnapshot = await database.ref(`governorates/${governorateId}/areas`).once('value');
            const areas = areasSnapshot.val() || {};
            
            Object.entries(areas).forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                areaDropdown.appendChild(option);
            });
        } catch (error) {
            console.error('خطأ في تحديث مناطق التاجر:', error);
        }
    }
}

// عرض المحافظات والمناطق
async function displayGovernoratesAndAreas() {
    try {
        const governoratesSnapshot = await database.ref('governorates').once('value');
        const governorates = governoratesSnapshot.val() || {};
        
        const container = document.getElementById('governorates-content');
        container.innerHTML = '';
        
        Object.entries(governorates).forEach(([govId, gov]) => {
            const item = document.createElement('div');
            item.className = 'data-item';
            
            const info = document.createElement('div');
            info.className = 'data-item-info';
            
            const name = document.createElement('strong');
            name.textContent = gov.name;
            info.appendChild(name);
            
            if (gov.areas && Object.keys(gov.areas).length > 0) {
                const areasContainer = document.createElement('div');
                areasContainer.className = 'governorate-areas';
                
                Object.values(gov.areas).forEach(areaName => {
                    const areaTag = document.createElement('span');
                    areaTag.className = 'area-tag';
                    areaTag.textContent = areaName;
                    areasContainer.appendChild(areaTag);
                });
                
                info.appendChild(areasContainer);
            }
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', () => confirmDelete('governorate', govId, gov.name));
            
            item.appendChild(info);
            item.appendChild(deleteBtn);
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('خطأ في عرض المحافظات والمناطق:', error);
    }
}

// عرض الأقسام
async function displayCategories() {
    try {
        const categoriesSnapshot = await database.ref('categories').once('value');
        const categories = categoriesSnapshot.val() || {};
        
        const container = document.getElementById('categories-content');
        container.innerHTML = '';
        
        Object.entries(categories).forEach(([catId, name]) => {
            const item = document.createElement('div');
            item.className = 'data-item';
            
            const info = document.createElement('div');
            info.className = 'data-item-info';
            
            const nameElement = document.createElement('strong');
            nameElement.textContent = name;
            info.appendChild(nameElement);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', () => confirmDelete('category', catId, name));
            
            item.appendChild(info);
            item.appendChild(deleteBtn);
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('خطأ في عرض الأقسام:', error);
    }
}

// عرض التجار
async function displayMerchants() {
    try {
        const merchantsSnapshot = await database.ref('merchants').once('value');
        const governoratesSnapshot = await database.ref('governorates').once('value');
        
        const merchants = merchantsSnapshot.val() || {};
        const governorates = governoratesSnapshot.val() || {};
        
        const container = document.getElementById('merchants-content');
        container.innerHTML = '';
        
        Object.entries(merchants).forEach(([merchantId, merchant]) => {
            const item = document.createElement('div');
            item.className = 'data-item';
            
            const info = document.createElement('div');
            info.className = 'data-item-info';
            
            const name = document.createElement('strong');
            name.textContent = merchant.name;
            info.appendChild(name);
            
            const details = document.createElement('small');
            const govName = governorates[merchant.governorate]?.name || merchant.governorate;
            const areaName = governorates[merchant.governorate]?.areas?.[merchant.area] || merchant.area;
            details.innerHTML = `المستخدم: ${merchant.username}<br>المحافظة: ${govName} - ${areaName}`;
            info.appendChild(details);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', () => confirmDelete('merchant', merchantId, merchant.name));
            
            item.appendChild(info);
            item.appendChild(deleteBtn);
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('خطأ في عرض التجار:', error);
    }
}

// وظائف التاجر
async function loadMerchantData() {
    try {
        await loadDropdownData();
        await loadMerchantProducts();
        
        // تحميل موقع التاجر إذا كان محفوظاً
        if (currentUser && currentUser.id) {
            const locationSnapshot = await database.ref(`merchants/${currentUser.id}/location`).once('value');
            const location = locationSnapshot.val();
            if (location) {
                currentLocation = location;
                updateLocationStatus(true);
            }
        }
        
    } catch (error) {
        console.error('خطأ في تحميل بيانات التاجر:', error);
    }
}

// اختيار الصور
function selectImages() {
    document.getElementById('product-images').click();
}

// إضافة منتج
async function addProduct(e) {
    e.preventDefault();
    
    const name = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const description = document.getElementById('product-description').value.trim();
    const availability = document.getElementById('product-availability').value;
    const category = document.getElementById('product-category').value;
    
    if (!name || isNaN(price) || !availability || !category) {
        showAlert('يرجى ملء جميع الحقول المطلوبة', 'warning');
        return;
    }
    
    if (!currentUser || !currentUser.id) {
        showAlert('خطأ في بيانات التاجر', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        // الحصول على اسم القسم
        const categorySnapshot = await database.ref(`categories/${category}`).once('value');
        const categoryName = categorySnapshot.val();
        
        const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const productData = {
            name: name,
            price: price,
            description: description,
            availability: availability,
            category: category,
            categoryName: categoryName,
            merchantId: currentUser.id,
            merchantName: currentUser.name,
            governorate: currentUser.governorate,
            area: currentUser.area,
            imageIds: uploadedImageIds,
            createdAt: Date.now()
        };
        
        await database.ref(`products/${productId}`).set(productData);
        
        // إعادة تعيين النموذج
        document.getElementById('add-product-form').reset();
        document.getElementById('uploaded-images').innerHTML = '';
        document.getElementById('upload-progress').classList.add('hidden');
        uploadedImageIds = [];
        
        await loadMerchantProducts();
        await loadProducts(); // تحديث المنتجات في واجهة الزائر
        
        showAlert('تم إضافة المنتج بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في إضافة المنتج:', error);
        showAlert('حدث خطأ في إضافة المنتج', 'error');
    } finally {
        showLoading(false);
    }
}

// تحميل منتجات التاجر
async function loadMerchantProducts() {
    if (!currentUser || !currentUser.id) return;
    
    try {
        const productsSnapshot = await database.ref('products').orderByChild('merchantId').equalTo(currentUser.id).once('value');
        const products = productsSnapshot.val() || {};
        
        const productsList = Object.entries(products).map(([id, product]) => ({
            ...product,
            id
        }));
        
        // ترتيب المنتجات حسب تاريخ الإضافة (الأحدث أولاً)
        productsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        displayMerchantProducts(productsList);
        
        // تحديث عداد المنتجات
        document.getElementById('products-count').textContent = productsList.length;
        
    } catch (error) {
        console.error('خطأ في تحميل منتجات التاجر:', error);
    }
}

// عرض منتجات التاجر
function displayMerchantProducts(products) {
    const grid = document.getElementById('merchant-products-grid');
    grid.innerHTML = '';
    
    if (products.length === 0) {
        const message = document.createElement('div');
        message.className = 'no-products';
        message.innerHTML = `
            <i class="fas fa-box-open"></i>
            <p>لم تقم بإضافة أي منتجات بعد</p>
        `;
        grid.appendChild(message);
        return;
    }
    
    products.forEach(product => {
        const card = createProductCard(product, true);
        grid.appendChild(card);
    });
}

// حذف منتج
async function deleteProduct(productId) {
    const confirmed = await showConfirmDialog('هل أنت متأكد من حذف هذا المنتج؟');
    if (!confirmed) return;
    
    try {
        showLoading(true);
        
        await database.ref(`products/${productId}`).remove();
        await loadMerchantProducts();
        await loadProducts(); // تحديث المنتجات في واجهة الزائر
        
        showAlert('تم حذف المنتج بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في حذف المنتج:', error);
        showAlert('حدث خطأ في حذف المنتج', 'error');
    } finally {
        showLoading(false);
    }
}

// معرض الصور
function openImageGallery(imageIds, productName = '') {
    if (!imageIds || imageIds.length === 0) return;
    
    currentImageGallery = imageIds;
    currentImageIndex = 0;
    
    const modal = document.getElementById('image-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalImage = document.getElementById('modal-image');
    const currentImageSpan = document.getElementById('current-image');
    const totalImagesSpan = document.getElementById('total-images');
    const thumbnailStrip = document.getElementById('thumbnail-strip');
    
    modalTitle.textContent = productName || 'معرض الصور';
    totalImagesSpan.textContent = imageIds.length;
    
    // إنشاء الصور المصغرة
    thumbnailStrip.innerHTML = '';
    imageIds.forEach((imageId, index) => {
        const thumbnail = document.createElement('img');
        thumbnail.className = `thumbnail ${index === 0 ? 'active' : ''}`;
        thumbnail.src = getDriveImageUrl(imageId);
        thumbnail.addEventListener('click', () => setCurrentImage(index));
        thumbnailStrip.appendChild(thumbnail);
    });
    
    // عرض الصورة الأولى
    setCurrentImage(0);
    
    modal.classList.add('show');
}

// تعيين الصورة الحالية
function setCurrentImage(index) {
    if (index < 0 || index >= currentImageGallery.length) return;
    
    currentImageIndex = index;
    
    const modalImage = document.getElementById('modal-image');
    const currentImageSpan = document.getElementById('current-image');
    const thumbnails = document.querySelectorAll('.thumbnail');
    
    modalImage.src = getDriveImageUrl(currentImageGallery[index]);
    currentImageSpan.textContent = index + 1;
    
    // تحديث الصور المصغرة النشطة
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
    
    // تحديث أزرار التنقل
    document.getElementById('prev-image').disabled = index === 0;
    document.getElementById('next-image').disabled = index === currentImageGallery.length - 1;
}

// إعداد النوافذ المنبثقة
function setupModals() {
    // معرض الصور
    document.querySelector('#image-modal .close-modal').addEventListener('click', closeImageModal);
    document.getElementById('prev-image').addEventListener('click', () => {
        if (currentImageIndex > 0) {
            setCurrentImage(currentImageIndex - 1);
        }
    });
    document.getElementById('next-image').addEventListener('click', () => {
        if (currentImageIndex < currentImageGallery.length - 1) {
            setCurrentImage(currentImageIndex + 1);
        }
    });
    
    // إغلاق النافذة عند النقر خارجها
    document.getElementById('image-modal').addEventListener('click', (e) => {
        if (e.target.id === 'image-modal') {
            closeImageModal();
        }
    });
    
    // نافذة التأكيد
    document.getElementById('confirm-yes').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('show');
        if (window.confirmCallback) {
            window.confirmCallback(true);
            window.confirmCallback = null;
        }
    });
    
    document.getElementById('confirm-no').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('show');
        if (window.confirmCallback) {
            window.confirmCallback(false);
            window.confirmCallback = null;
        }
    });
    
    // التنقل بالكيبورد في معرض الصور
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('image-modal');
        if (modal.classList.contains('show')) {
            if (e.key === 'Escape') {
                closeImageModal();
            } else if (e.key === 'ArrowLeft') {
                if (currentImageIndex < currentImageGallery.length - 1) {
                    setCurrentImage(currentImageIndex + 1);
                }
            } else if (e.key === 'ArrowRight') {
                if (currentImageIndex > 0) {
                    setCurrentImage(currentImageIndex - 1);
                }
            }
        }
    });
}

// إغلاق معرض الصور
function closeImageModal() {
    document.getElementById('image-modal').classList.remove('show');
    currentImageGallery = [];
    currentImageIndex = 0;
}

// عرض نافذة التأكيد
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').classList.add('show');
        window.confirmCallback = resolve;
    });
}

// تأكيد الحذف
async function confirmDelete(type, id, name) {
    const typeNames = {
        governorate: 'المحافظة',
        category: 'القسم',
        merchant: 'التاجر'
    };
    
    const confirmed = await showConfirmDialog(`هل أنت متأكد من حذف ${typeNames[type]} "${name}"؟`);
    if (!confirmed) return;
    
    try {
        showLoading(true);
        
        if (type === 'governorate') {
            await database.ref(`governorates/${id}`).remove();
            await displayGovernoratesAndAreas();
            await loadDropdownData();
        } else if (type === 'category') {
            await database.ref(`categories/${id}`).remove();
            await displayCategories();
            await loadDropdownData();
        } else if (type === 'merchant') {
            await database.ref(`merchants/${id}`).remove();
            await displayMerchants();
        }
        
        showAlert(`تم حذف ${typeNames[type]} بنجاح`, 'success');
        
    } catch (error) {
        console.error(`خطأ في حذف ${typeNames[type]}:`, error);
        showAlert(`حدث خطأ في حذف ${typeNames[type]}`, 'error');
    } finally {
        showLoading(false);
    }
}

// الوظائف المساعدة
function generateId(text) {
    return text.toLowerCase()
        .replace(/[أ-ي]/g, (match) => {
            const arabicToEnglish = {
                'أ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
                'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
                'ض': 'd', 'ط': 't', 'ظ': 'th', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
                'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y'
            };
            return arabicToEnglish[match] || match;
        })
        .replace(/\s+/g, '_')
        .replace(/[^\w]/g, '');
}

function showAlert(message, type = 'info') {
    // يمكنك تطوير نظام تنبيهات أكثر تقدماً هنا
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // للتطوير السريع، استخدام alert
    if (type === 'error') {
        alert(`خطأ: ${message}`);
    } else if (type === 'success') {
        alert(`نجح: ${message}`);
    } else if (type === 'warning') {
        alert(`تحذير: ${message}`);
    } else {
        alert(message);
    }
}

function showLoading(show) {
    // يمكنك إضافة مؤشر تحميل هنا
    if (show) {
        document.body.style.cursor = 'wait';
    } else {
        document.body.style.cursor = 'default';
    }
}

// تحسينات إضافية
window.addEventListener('online', () => {
    console.log('تم الاتصال بالإنترنت');
});

window.addEventListener('offline', () => {
    console.log('انقطع الاتصال بالإنترنت');
    showAlert('انقطع الاتصال بالإنترنت. بعض الميزات قد لا تعمل بشكل صحيح.', 'warning');
});

// معالجة الأخطاء العامة
window.addEventListener('error', (e) => {
    console.error('خطأ عام:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('خطأ غير معالج:', e.reason);
});
