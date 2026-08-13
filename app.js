// ===== CONFIG =====
const CONFIG = {
    // تم إضافة رابط جوجل شيت الخاص بك هنا كقيمة افتراضية
    PRODUCTS_URL: localStorage.getItem('products_url') || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaWuGpR3GCmZ8uHFhdalvc69Cfe6olRsFw5lc34l3lvgetPfBEYktabRJb7bL-AfUjA8qpABGgMQB7/pub?gid=0&single=true&output=csv',
    WHATSAPP_NUMBER: "967730413413",
    WHATSAPP_NUMBER_2: "967734931886",
    ADMIN_PASSWORD: "Agate@2026",
    CURRENCY: "ريال"
};

// ===== DATA STORE =====
let products = [];
let cart = JSON.parse(localStorage.getItem('agates_cart')) || [];
let isLoading = false;

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', async function() {
    initMobileMenu();
    initScrollAnimations();
    
    // حاول جلب المنتجات من الرابط الخارجي أولاً
    if (CONFIG.PRODUCTS_URL) {
        await loadProductsFromURL(CONFIG.PRODUCTS_URL);
    } else {
        // fallback: استخدم البيانات المحلية
        products = JSON.parse(localStorage.getItem('agates_products')) || getDefaultProducts();
    }
    
    renderProducts();
    renderAllProducts();
    updateCartUI();
    renderAdminProducts();
    initURLParams();
    initSearch();
});

// ===== DEFAULT PRODUCTS (Fallback) =====
function getDefaultProducts() {
    return [
        {
            id: 1,
            name: "عقيق يمني كبدي درجة أولى",
            category: "عقيق",
            price: 2500,
            oldPrice: 3000,
            weight: "30 جرام",
            size: "14mm",
            description: "عقيق يمني أصلي 100% من مناجم اليمن، لون كبدي غامق مع عروق طبيعية مميزة. قطعة نادرة ومصقولة يدوياً بأعلى معايير الجودة.",
            badge: "الأكثر مبيعاً",
            featured: true,
            image: "https://images.unsplash.com/photo-1615655406736-b37c4fabf923?w=500&auto=format&fit=crop&q=80"
        },
        {
            id: 2,
            name: "سبح عقيق أحمر فاخر",
            category: "سبح",
            price: 1800,
            oldPrice: null,
            weight: "45 جرام",
            size: "10mm",
            description: "سبح 33 خرزة من العقيق الأحمر الطبيعي، خيوط حريرية فاخرة، إنهاء يدوي متقن.",
            badge: "جديد",
            featured: true,
            image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&auto=format&fit=crop&q=80"
        }
    ];
}

// ===== LOAD PRODUCTS FROM URL (Google Sheets / JSON / CSV) =====
async function loadProductsFromURL(url) {
    isLoading = true;
    showLoadingState();
    
    try {
        let fetchUrl = url;
        // إذا كان الرابط لا يحتوي على output=csv، نحاول تحويله لـ JSON
        if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv')) {
            const sheetId = extractSheetId(url);
            // التأكد من أن الآي دي ليس 'e' لتجنب الأخطاء مع الروابط المنشورة
            if (sheetId && sheetId !== 'e') {
                fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
            }
        }
        
        const response = await fetch(fetchUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Network response was not ok');
        
        let data = await response.text();
        
        // معالجة استجابة CSV (الروابط المنشورة بصيغة csv)
        if (fetchUrl.includes('output=csv') || data.startsWith('name,') || data.startsWith('اسم,')) {
            products = parseCSVData(data);
        }
        // معالجة استجابة Google Sheets JSON العادية
        else if (data.startsWith('/*O_o*/')) {
            data = data.replace(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
                       .replace(/\);$/, '');
            const json = JSON.parse(data);
            products = parseGoogleSheetData(json);
        } else {
            // JSON عادي
            const json = JSON.parse(data);
            products = Array.isArray(json) ? json : (json.products || []);
        }
        
        // تأكد من صحة البيانات
        products = products.map((p, idx) => ({
            id: p.id || idx + 1,
            name: p.name || p.اسم || 'منتج بدون اسم',
            category: p.category || p.فئة || 'عقيق',
            price: parseFloat(p.price || p.السعر) || 0,
            oldPrice: parseFloat(p.oldPrice || p.السعر_القديم) || null,
            weight: p.weight || p.الوزن || '',
            size: p.size || p.الحجم || '',
            description: p.description || p.وصف || '',
            badge: p.badge || p.شارة || '',
            featured: p.featured === true || p.featured === 'true' || p.featured === 'نعم' || p.مميز === 'نعم' || p.مميز === true,
            image: p.image || p.صورة || ''
        }));
        
        saveProducts();
        showToast('✅ تم تحديث المنتجات من المصدر');
        
        // تحديث الواجهة فوراً بالبيانات الجديدة
        renderProducts();
        renderAllProducts();
        renderAdminProducts();
        
    } catch (error) {
        console.error('Error loading products:', error);
        products = JSON.parse(localStorage.getItem('agates_products')) || getDefaultProducts();
        showToast('⚠️ تعذر الاتصال، تم استخدام البيانات المحلية');
    } finally {
        isLoading = false;
        hideLoadingState();
    }
}

function extractSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

// دالة جديدة لقراءة وتحليل ملفات الـ CSV بدقة
function parseCSVData(csv) {
    const lines = csv.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        // تعبير نمطي لتقسيم الفواصل وتجاهل الفواصل الموجودة داخل علامات التنصيص
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const obj = {};
        
        headers.forEach((header, index) => {
            let val = row[index] || '';
            // تنظيف القيمة من علامات التنصيص
            val = val.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
            obj[header] = val;
        });
        result.push(obj);
    }
    return result;
}

function parseGoogleSheetData(json) {
    const cols = json.table.cols.map(c => c.label);
    const rows = json.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
            if (cell && cols[i]) {
                obj[cols[i]] = cell.v;
            }
        });
        return obj;
    });
    return rows;
}

function showLoadingState() {
    const containers = ['featuredProducts', 'allProducts'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = Array(4).fill(`
                <div class="product-card">
                    <div class="product-image skeleton" style="aspect-ratio:1;"></div>
                    <div style="padding:20px;">
                        <div class="skeleton" style="height:14px;width:60%;margin-bottom:10px;"></div>
                        <div class="skeleton" style="height:20px;width:80%;margin-bottom:10px;"></div>
                        <div class="skeleton" style="height:16px;width:40%;"></div>
                    </div>
                </div>
            `).join('');
        }
    });
}

function hideLoadingState() {
    // سيتم إعادة الرender تلقائياً بواسطة الدوال الأخرى
}

// ===== SAVE DATA =====
function saveProducts() {
    localStorage.setItem('agates_products', JSON.stringify(products));
}

function saveCart() {
    localStorage.setItem('agates_cart', JSON.stringify(cart));
}

// ===== RENDER PRODUCTS =====
function renderProducts() {
    const container = document.getElementById('featuredProducts');
    if (!container) return;
    const featured = products.filter(p => p.featured);
    if (featured.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--gray);padding:40px;">لا توجد منتجات مميزة حالياً</div>';
        return;
    }
    container.innerHTML = featured.map(p => createProductCard(p)).join('');
}

function renderAllProducts(filter = 'all', searchQuery = '') {
    const container = document.getElementById('allProducts');
    if (!container) return;
    
    let filtered = filter === 'all' ? [...products] : products.filter(p => p.category === filter);
    
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                <i class="fas fa-search" style="font-size:48px;color:var(--gold-light);margin-bottom:16px;"></i>
                <h4 style="color:var(--dark);margin-bottom:8px;">لا توجد نتائج</h4>
                <p style="color:var(--gray);">جرب كلمات بحث مختلفة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(p => createProductCard(p)).join('');
}

function createProductCard(product) {
    const badgeClass = getBadgeClass(product.badge);
    const badgeHTML = product.badge ? 
        `<span class="product-badge ${badgeClass}">${product.badge}</span>` : '';
    const oldPriceHTML = product.oldPrice ? `<span class="old-price">${Number(product.oldPrice).toLocaleString()} ${CONFIG.CURRENCY}</span>` : '';
    const imageHTML = product.image ? 
        `<img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-gem\\' style=\\'font-size:50px;color:var(--primary);opacity:0.3;\\'></i>'">` : 
        `<i class="fas fa-gem" style="font-size:50px;color:var(--primary);opacity:0.3;"></i>`;

    return `
        <div class="product-card animate-fade-up" onclick="openProductModal(${product.id})">
            <div class="product-image">
                ${imageHTML}
                <div class="product-badges">${badgeHTML}</div>
                <div class="product-actions" onclick="event.stopPropagation()">
                    <button class="action-btn add-cart" onclick="addToCart(${product.id})" title="أضف للسلة">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                    <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent('مرحباً، أريد الاستفسار عن: ' + product.name)}" 
                       class="action-btn whatsapp" target="_blank" title="اطلب عبر واتساب">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button class="action-btn view" title="عرض التفاصيل" onclick="openProductModal(${product.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h4 class="product-name">${product.name}</h4>
                <div class="product-specs">
                    ${product.weight ? `<span><i class="fas fa-weight-hanging"></i> ${product.weight}</span>` : ''}
                    ${product.size ? `<span><i class="fas fa-ruler"></i> ${product.size}</span>` : ''}
                </div>
                <div class="product-price">
                    <span class="current-price">${Number(product.price).toLocaleString()} ${CONFIG.CURRENCY}</span>
                    ${oldPriceHTML}
                </div>
            </div>
        </div>
    `;
}

function getBadgeClass(badge) {
    if (!badge) return '';
    if (badge.includes('جديد')) return 'badge-new';
    if (badge.includes('عرض')) return 'badge-sale';
    if (badge.includes('مبيعاً') || badge.includes('الأكثر')) return 'badge-hot';
    if (badge.includes('نفذ') || badge.includes('sold')) return 'badge-sold';
    return 'badge-new';
}

// ===== PRODUCT MODAL =====
function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const badgeClass = getBadgeClass(product.badge);
    const badgeHTML = product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : '';
    const oldPriceHTML = product.oldPrice ? `<span class="old-price" style="font-size:18px;">${Number(product.oldPrice).toLocaleString()} ${CONFIG.CURRENCY}</span>` : '';
    
    const modalHTML = `
        <div class="modal-overlay active" id="productModal" onclick="closeProductModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${product.name}</h3>
                    <button class="modal-close" onclick="closeProductModal()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
                        <div style="background:linear-gradient(135deg,#F8F8F8,#F0F0F0);border-radius:var(--radius);overflow:hidden;aspect-ratio:1;display:flex;align-items:center;justify-content:center;">
                            ${product.image ? 
                                `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;">` :
                                `<i class="fas fa-gem" style="font-size:80px;color:var(--primary);opacity:0.3;"></i>`
                            }
                        </div>
                        <div>
                            <div style="margin-bottom:12px;">${badgeHTML}</div>
                            <div style="font-size:14px;color:var(--gold-dark);font-weight:800;margin-bottom:8px;">${product.category}</div>
                            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
                                <span style="font-size:28px;font-weight:900;color:var(--primary);">${Number(product.price).toLocaleString()} ${CONFIG.CURRENCY}</span>
                                ${oldPriceHTML}
                            </div>
                            <div style="display:flex;gap:16px;margin-bottom:20px;font-size:14px;color:var(--gray);">
                                ${product.weight ? `<span><i class="fas fa-weight-hanging" style="color:var(--gold);"></i> ${product.weight}</span>` : ''}
                                ${product.size ? `<span><i class="fas fa-ruler" style="color:var(--gold);"></i> ${product.size}</span>` : ''}
                            </div>
                            <p style="color:var(--gray);line-height:1.8;margin-bottom:24px;font-size:15px;">${product.description || 'لا يوجد وصف'}</p>
                            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                                <button class="btn-primary" onclick="addToCart(${product.id});closeProductModal();" style="border:none;cursor:pointer;">
                                    <i class="fas fa-cart-plus"></i> أضف للسلة
                                </button>
                                <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent('مرحباً، أريد طلب: ' + product.name)}" 
                                   class="btn-secondary" target="_blank" style="background:#25D366;color:#fff;border-color:#25D366;">
                                    <i class="fab fa-whatsapp"></i> اطلب عبر واتساب
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // إزالة أي مودال سابق
    const oldModal = document.getElementById('productModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden';
}

function closeProductModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
            document.body.style.overflow = '';
        }, 300);
    }
}

// ===== SEARCH =====
function initSearch() {
    const searchInput = document.getElementById('productSearch');
    if (!searchInput) return;
    
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const activeTab = document.querySelector('.filter-tab.active');
            const category = activeTab ? activeTab.dataset.category || 'all' : 'all';
            renderAllProducts(category, e.target.value);
        }, 300);
    });
}

// ===== FILTER PRODUCTS =====
function filterProducts(category, btnElement) {
    if (btnElement) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        btnElement.classList.add('active');
    }
    const searchInput = document.getElementById('productSearch');
    const searchQuery = searchInput ? searchInput.value : '';
    renderAllProducts(category, searchQuery);
}

function initURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const catFilter = urlParams.get('cat');
    if (catFilter) {
        const targetBtn = Array.from(document.querySelectorAll('.filter-tab')).find(
            b => b.textContent.trim() === catFilter
        );
        if (targetBtn) filterProducts(catFilter, targetBtn);
    }
}

// ===== CART FUNCTIONS =====
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    
    saveCart();
    updateCartUI();
    showToast(`✅ تمت إضافة "${product.name}" للسلة`);
    
    // تأثير على زر السلة
    const cartBtn = document.querySelector('.cart-btn');
    if (cartBtn) {
        cartBtn.style.transform = 'scale(1.2)';
        setTimeout(() => cartBtn.style.transform = '', 200);
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

function updateQty(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    item.qty += change;
    if (item.qty <= 0) {
        removeFromCart(productId);
        return;
    }
    saveCart();
    updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('#cartCount').forEach(el => {
        el.textContent = count;
        el.style.transform = 'scale(1.3)';
        setTimeout(() => el.style.transform = '', 200);
    });
    
    const itemsContainer = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    if (!itemsContainer || !footer) return;
    
    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-cart"></i>
                <p>السلة فارغة</p>
                <a href="products.html" style="color:var(--primary);text-decoration:none;font-weight:700;margin-top:10px;display:inline-block;" onclick="toggleCart()">
                    تصفح المنتجات ←
                </a>
            </div>
        `;
        footer.style.display = 'none';
    } else {
        itemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <button class="remove-item" onclick="removeFromCart(${item.id})"><i class="fas fa-times"></i></button>
                <div class="cart-item-image">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<i class="fas fa-gem" style="font-size:24px;color:var(--gray-light);"></i>`}
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${Number(item.price).toLocaleString()} ${CONFIG.CURRENCY}</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="updateQty(${item.id}, -1)">−</button>
                        <span style="font-weight:800;min-width:20px;text-align:center;">${item.qty}</span>
                        <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
                    </div>
                </div>
            </div>
        `).join('');
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const totalEl = document.getElementById('cartTotal');
        if (totalEl) totalEl.textContent = total.toLocaleString() + ' ' + CONFIG.CURRENCY;
        footer.style.display = 'block';
    }
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('active');
    document.getElementById('cartSidebar').classList.toggle('active');
}

function checkoutWhatsApp() {
    if (cart.length === 0) return;
    
    let message = '🛒 *طلب جديد من متجر عقيق يمني أصيل*\n\n';
    message += '*المنتجات:*\n';
    
    let total = 0;
    cart.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`;
        message += `   الكمية: ${item.qty} | السعر: ${(item.price * item.qty).toLocaleString()} ${CONFIG.CURRENCY}\n\n`;
        total += item.price * item.qty;
    });
    
    message += `\n*الإجمالي: ${total.toLocaleString()} ${CONFIG.CURRENCY}*\n\n`;
    message += 'يرجى تأكيد الطلب وإرسال عنوان التوصيل.';
    
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

// ===== TOAST =====
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== MOBILE MENU =====
function initMobileMenu() {
    const btn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav-links');
    if (!btn || !nav) return;
    
    btn.addEventListener('click', () => {
        nav.classList.toggle('mobile-active');
        const icon = btn.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        }
    });
    
    // إغلاق القائمة عند النقر على رابط
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('mobile-active');
            const icon = btn.querySelector('i');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        });
    });
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.product-card, .category-card, .feature-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ===== ADMIN LOGIC =====
function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    if (password === CONFIG.ADMIN_PASSWORD) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        renderAdminProducts();
        showToast('✅ تم تسجيل الدخول بنجاح');
    } else {
        showToast('❌ كلمة المرور غير صحيحة');
        const input = document.getElementById('adminPassword');
        input.style.borderColor = 'var(--danger)';
        input.style.animation = 'shake 0.5s';
        setTimeout(() => {
            input.style.borderColor = '';
            input.style.animation = '';
        }, 500);
    }
}

function renderAdminProducts() {
    const tbody = document.getElementById('adminProductsList');
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray);">لا توجد منتجات</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map((p, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    ${p.image ? `<img src="${p.image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : ''}
                    <strong style="font-size:13px;">${p.name}</strong>
                </div>
            </td>
            <td><span style="background:var(--light);padding:4px 10px;border-radius:20px;font-size:12px;">${p.category}</span></td>
            <td style="font-weight:800;color:var(--primary);">${Number(p.price).toLocaleString()} ${CONFIG.CURRENCY}</td>
            <td>${p.badge ? `<span class="product-badge ${getBadgeClass(p.badge)}" style="font-size:11px;">${p.badge}</span>` : '-'}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn-primary" onclick="editProduct(${p.id})" style="padding:6px 14px;font-size:12px;background:linear-gradient(135deg,var(--primary),var(--primary-light));">تعديل</button>
                    <button class="btn-danger" onclick="deleteProduct(${p.id})">حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function saveProduct() {
    const id = document.getElementById('prodId').value;
    const product = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('prodName').value.trim(),
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value) || 0,
        oldPrice: parseFloat(document.getElementById('prodOldPrice').value) || null,
        weight: document.getElementById('prodWeight').value.trim(),
        size: document.getElementById('prodSize').value.trim(),
        description: document.getElementById('prodDesc').value.trim(),
        badge: document.getElementById('prodBadge').value,
        featured: document.getElementById('prodFeatured').value === 'true',
        image: document.getElementById('prodImage') ? document.getElementById('prodImage').value.trim() : ''
    };
    
    if (!product.name || !product.price) {
        showToast('⚠️ يرجى ملء الاسم والسعر');
        return;
    }
    
    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) products[index] = product;
    } else {
        products.push(product);
    }
    
    saveProducts();
    clearForm();
    renderAdminProducts();
    renderProducts();
    renderAllProducts();
    showToast('✅ تم حفظ المنتج بنجاح');
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    document.getElementById('prodId').value = product.id;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodCategory').value = product.category;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodOldPrice').value = product.oldPrice || '';
    document.getElementById('prodWeight').value = product.weight;
    document.getElementById('prodSize').value = product.size;
    document.getElementById('prodDesc').value = product.description;
    document.getElementById('prodBadge').value = product.badge;
    document.getElementById('prodFeatured').value = product.featured.toString();
    if(document.getElementById('prodImage')) document.getElementById('prodImage').value = product.image || '';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('📝 جاري تعديل المنتج');
}

function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    products = products.filter(p => p.id !== id);
    saveProducts();
    renderAdminProducts();
    renderProducts();
    renderAllProducts();
    showToast('🗑️ تم حذف المنتج');
}

function clearForm() {
    document.getElementById('prodId').value = '';
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '';
    document.getElementById('prodOldPrice').value = '';
    document.getElementById('prodWeight').value = '';
    document.getElementById('prodSize').value = '';
    document.getElementById('prodDesc').value = '';
    document.getElementById('prodBadge').value = '';
    document.getElementById('prodFeatured').value = 'false';
    if(document.getElementById('prodImage')) document.getElementById('prodImage').value = '';
}

function exportData() {
    const dataStr = JSON.stringify(products, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('📥 تم تصدير البيانات');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data)) {
                    products = data;
                    saveProducts();
                    renderAdminProducts();
                    renderProducts();
                    renderAllProducts();
                    showToast('✅ تم استيراد البيانات بنجاح');
                } else {
                    throw new Error('Invalid format');
                }
            } catch (err) {
                showToast('❌ ملف غير صالح');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function setProductsURL() {
    const url = document.getElementById('productsURL').value.trim();
    if (url) {
        localStorage.setItem('products_url', url);
        CONFIG.PRODUCTS_URL = url;
        showToast('✅ تم حفظ الرابط، جاري التحديث...');
        loadProductsFromURL(url);
    } else {
        localStorage.removeItem('products_url');
        CONFIG.PRODUCTS_URL = '';
        showToast('⚠️ تم إزالة الرابط الخارجي');
    }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    // ESC لإغلاق السلة أو المودال
    if (e.key === 'Escape') {
        const cartSidebar = document.getElementById('cartSidebar');
        const modal = document.getElementById('productModal');
        if (cartSidebar && cartSidebar.classList.contains('active')) {
            toggleCart();
        } else if (modal) {
            closeProductModal();
        }
    }
});
