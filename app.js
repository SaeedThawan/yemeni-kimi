// ===== CONFIG =====
const CONFIG = {
    // رابط جوجل شيت الخاص بك
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
    
    if (CONFIG.PRODUCTS_URL) {
        await loadProductsFromURL(CONFIG.PRODUCTS_URL);
    } else {
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
    return [];
}

// ===== LOAD PRODUCTS FROM URL (Google Sheets / JSON / CSV) =====
async function loadProductsFromURL(url) {
    isLoading = true;
    showLoadingState();
    
    try {
        let fetchUrl = url;
        if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv')) {
            const sheetId = extractSheetId(url);
            if (sheetId && sheetId !== 'e') {
                fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
            }
        }
        
        const response = await fetch(fetchUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Network response was not ok');
        
        let data = await response.text();
        
        if (fetchUrl.includes('output=csv') || data.startsWith('name,') || data.startsWith('اسم,') || data.startsWith('id,')) {
            products = parseCSVData(data);
        }
        else if (data.startsWith('/*O_o*/')) {
            data = data.replace(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(/, '')
                       .replace(/\);$/, '');
            const json = JSON.parse(data);
            products = parseGoogleSheetData(json);
        } else {
            const json = JSON.parse(data);
            products = Array.isArray(json) ? json : (json.products || []);
        }
        
        // تأكد من صحة البيانات وإضافة رقم الموديل (id)
        products = products.map((p, idx) => ({
            id: p.id || p.ID || p['رقم الموديل'] || idx + 1, // سحب رقم الموديل من الإكسل
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
        
        renderProducts();
        renderAllProducts();
        renderAdminProducts();
        
    } catch (error) {
        console.error('Error loading products:', error);
        products = JSON.parse(localStorage.getItem('agates_products')) || getDefaultProducts();
    } finally {
        isLoading = false;
        hideLoadingState();
    }
}

function extractSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function parseCSVData(csv) {
    const lines = csv.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const obj = {};
        
        headers.forEach((header, index) => {
            let val = row[index] || '';
            val = val.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
            obj[header] = val;
        });
        result.push(obj);
    }
    return result;
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

function hideLoadingState() {}

// ===== SAVE DATA =====
function saveProducts() { localStorage.setItem('agates_products', JSON.stringify(products)); }
function saveCart() { localStorage.setItem('agates_cart', JSON.stringify(cart)); }

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
            (String(p.id).toLowerCase().includes(q))
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
    const badgeHTML = product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : '';
    const oldPriceHTML = product.oldPrice ? `<span class="old-price">${Number(product.oldPrice).toLocaleString()} ${CONFIG.CURRENCY}</span>` : '';
    const imageHTML = product.image ? 
        `<img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-gem\\' style=\\'font-size:50px;color:var(--primary);opacity:0.3;\\'></i>'">` : 
        `<i class="fas fa-gem" style="font-size:50px;color:var(--primary);opacity:0.3;"></i>`;

    return `
        <div class="product-card animate-fade-up" onclick="openProductModal('${product.id}')">
            <div class="product-image">
                ${imageHTML}
                <div class="product-badges">${badgeHTML}</div>
                <div class="product-actions" onclick="event.stopPropagation()">
                    <button class="action-btn add-cart" onclick="addToCart('${product.id}')" title="أضف للسلة">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                    <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent('مرحباً، أريد الاستفسار عن: ' + product.name + ' (موديل: ' + product.id + ')')}" 
                       class="action-btn whatsapp" target="_blank" title="اطلب عبر واتساب">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button class="action-btn view" title="عرض التفاصيل" onclick="openProductModal('${product.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div class="product-category">${product.category}</div>
                    <div style="font-size:11px; color:var(--gray); background:var(--gray-bg); padding:2px 8px; border-radius:4px; font-weight:700;">#${product.id}</div>
                </div>
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
    const product = products.find(p => p.id == productId);
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
                            <div style="margin-bottom:12px; display:flex; gap:10px; align-items:center;">
                                ${badgeHTML}
                                <span style="font-size:12px; color:var(--gray); background:var(--gray-bg); padding:4px 8px; border-radius:4px; font-weight:700;">موديل: #${product.id}</span>
                            </div>
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
                                <button class="btn-primary" onclick="addToCart('${product.id}');closeProductModal();" style="border:none;cursor:pointer;">
                                    <i class="fas fa-cart-plus"></i> أضف للسلة
                                </button>
                                <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent('مرحباً، أريد طلب: ' + product.name + ' (موديل: ' + product.id + ')')}" 
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
    const product = products.find(p => p.id == productId);
    if (!product) return;
    
    const existing = cart.find(item => item.id == productId);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    
    saveCart();
    updateCartUI();
    showToast(`✅ تمت إضافة "${product.name}" للسلة`);
    
    const cartBtn = document.querySelector('.cart-btn');
    if (cartBtn) {
        cartBtn.style.transform = 'scale(1.2)';
        setTimeout(() => cartBtn.style.transform = '', 200);
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId);
    saveCart();
    updateCartUI();
}

function updateQty(productId, change) {
    const item = cart.find(item => item.id == productId);
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
                <button class="remove-item" onclick="removeFromCart('${item.id}')"><i class="fas fa-times"></i></button>
                <div class="cart-item-image">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<i class="fas fa-gem" style="font-size:24px;color:var(--gray-light);"></i>`}
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div style="font-size:11px; color:var(--gray); margin-bottom:4px;">موديل: #${item.id}</div>
                    <div class="cart-item-price">${Number(item.price).toLocaleString()} ${CONFIG.CURRENCY}</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="updateQty('${item.id}', -1)">−</button>
                        <span style="font-weight:800;min-width:20px;text-align:center;">${item.qty}</span>
                        <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
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
        message += `${index + 1}. ${item.name} (موديل: ${item.id})\n`;
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
            <td>${p.id}</td>
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
                    <button class="btn-primary" onclick="editProduct('${p.id}')" style="padding:6px 14px;font-size:12px;background:linear-gradient(135deg,var(--primary),var(--primary-light));">تعديل</button>
                    <button class="btn-danger" onclick="deleteProduct('${p.id}')">حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ... (Rest of Admin Functions kept minimal as they rely on standard array manipulation) ...

document.addEventListener('keydown', (e) => {
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
