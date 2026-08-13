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
    setupZoomOverlay(); 
    
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

function getDefaultProducts() { return []; }

function convertDriveLink(url) {
    if (!url) return '';
    url = url.trim();
    if (url.includes('drive.google.com')) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return `https://drive.google.com/uc?export=view&id=${match[1]}`;
        }
    }
    return url;
}

// ===== LOAD PRODUCTS =====
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
        
        if (fetchUrl.includes('output=csv') || data.startsWith('name') || data.startsWith('id') || data.startsWith('اسم')) {
            const lines = data.split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.trim());
            products = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                const obj = {};
                headers.forEach((header, index) => {
                    let val = row[index] || '';
                    obj[header] = val.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
                });
                products.push(obj);
            }
        } else if (data.startsWith('/*O_o*/')) {
            data = data.replace(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(/, '').replace(/\);$/, '');
            const json = JSON.parse(data);
            products = parseGoogleSheetData(json);
        } else {
            const json = JSON.parse(data);
            products = Array.isArray(json) ? json : (json.products || []);
        }
        
        products = products.map((p, idx) => {
            let prodId = p.id || p.ID || p['رقم الموديل'] || idx + 1;
            let rawImage = p.image || p.صورة || '';
            let imageArray = [];
            
            // الفكرة العبقرية: إذا كانت خلية الصورة في الإكسل فارغة، سيبحث عن الصورة برقم الموديل في مجلد images في جيت هاب
            if (rawImage.trim() !== '') {
                imageArray = rawImage.split(',').map(img => convertDriveLink(img.trim())).filter(img => img !== '');
            } else {
                imageArray = [`images/${prodId}.jpg`];
            }
            
            return {
                id: prodId,
                name: p.name || p.اسم || 'منتج بدون اسم',
                category: p.category || p.فئة || 'عقيق',
                price: parseFloat(p.price || p.السعر) || 0,
                oldPrice: parseFloat(p.oldPrice || p.السعر_القديم) || null,
                weight: p.weight || p.الوزن || '',
                size: p.size || p.الحجم || '',
                description: p.description || p.وصف || '',
                badge: p.badge || p.شارة || '',
                featured: p.featured === true || p.featured === 'true' || p.featured === 'نعم' || p.مميز === 'نعم' || p.مميز === true,
                images: imageArray,
                image: imageArray.length > 0 ? imageArray[0] : ''
            };
        });
        
        saveProducts();
        
    } catch (error) {
        console.error('Error:', error);
        products = JSON.parse(localStorage.getItem('agates_products')) || getDefaultProducts();
    } finally {
        isLoading = false;
        hideLoadingState();
        renderProducts();
        renderAllProducts();
        renderAdminProducts();
    }
}

function extractSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function parseGoogleSheetData(json) {
    const cols = json.table.cols.map(c => c.label);
    return json.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => { if (cell && cols[i]) obj[cols[i]] = cell.v; });
        return obj;
    });
}

function showLoadingState() {
    const containers = ['featuredProducts', 'allProducts'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = Array(4).fill(`<div class="product-card"><div class="product-image skeleton" style="aspect-ratio:1;"></div><div style="padding:20px;"><div class="skeleton" style="height:14px;width:60%;margin-bottom:10px;"></div><div class="skeleton" style="height:20px;width:80%;margin-bottom:10px;"></div></div></div>`).join('');
    });
}

function hideLoadingState() {}
function saveProducts() { localStorage.setItem('agates_products', JSON.stringify(products)); }
function saveCart() { localStorage.setItem('agates_cart', JSON.stringify(cart)); }

// ===== RENDER PRODUCTS =====
function renderProducts() {
    const container = document.getElementById('featuredProducts');
    if (!container) return;
    const featured = products.filter(p => p.featured);
    if (featured.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">لا توجد منتجات مميزة حالياً</div>';
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
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><h4 style="color:var(--text-main);margin-bottom:8px;">لا توجد نتائج</h4></div>`;
        return;
    }
    container.innerHTML = filtered.map(p => createProductCard(p)).join('');
}

function createProductCard(product) {
    const badgeClass = getBadgeClass(product.badge);
    const badgeHTML = product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : '';
    const oldPriceHTML = product.oldPrice ? `<span class="old-price">${Number(product.oldPrice).toLocaleString()} ${CONFIG.CURRENCY}</span>` : '';
    const imageHTML = product.image ? `<img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/500x500.png?text=صورة+غير+متوفرة'">` : `<i class="fas fa-gem" style="font-size:50px;color:var(--primary);opacity:0.3;"></i>`;

    return `
        <div class="product-card animate-fade-up" onclick="openProductModal('${product.id}')">
            <div class="product-image">
                ${imageHTML}
                <div class="product-badges">${badgeHTML}</div>
                <div class="product-actions" onclick="event.stopPropagation()">
                    <button class="action-btn add-cart" onclick="addToCart('${product.id}')" title="أضف للسلة"><i class="fas fa-cart-plus"></i></button>
                    <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent('مرحباً، أريد الاستفسار عن: ' + product.name + ' (موديل: ' + product.id + ')')}" class="action-btn whatsapp" target="_blank"><i class="fab fa-whatsapp"></i></a>
                    <button class="action-btn view" onclick="openProductModal('${product.id}')"><i class="fas fa-eye"></i></button>
                </div>
            </div>
            <div class="product-info">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div class="product-category">${product.category}</div>
                    <div style="font-size:11px; color:var(--text-muted); background:var(--bg-secondary); padding:2px 8px; border-radius:4px; font-weight:700;">#${product.id}</div>
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
    return 'badge-new';
}

// ===== MODAL & ZOOM =====
function openProductModal(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) return;
    
    const badgeHTML = product.badge ? `<span class="product-badge ${getBadgeClass(product.badge)}">${product.badge}</span>` : '';
    const oldPriceHTML = product.oldPrice ? `<span class="old-price">${Number(product.oldPrice).toLocaleString()} ${CONFIG.CURRENCY}</span>` : '';
    
    let galleryHTML = '';
    if (product.images && product.images.length > 1) {
        galleryHTML = '<div class="product-gallery">';
        product.images.forEach((img, idx) => {
            galleryHTML += `<img src="${img}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalImage(this, '${img}')" onerror="this.src='https://via.placeholder.com/65x65.png?text=مفقود'">`;
        });
        galleryHTML += '</div>';
    }
    
    const mainImgSrc = product.images && product.images.length > 0 ? product.images[0] : '';
    
    const modalHTML = `
        <div class="modal-overlay active" id="productModal" onclick="closeProductModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${product.name}</h3>
                    <button class="modal-close" onclick="closeProductModal()"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:24px;">
                        <div class="modal-image-container">
                            <div style="background:var(--bg-secondary);border-radius:var(--radius);overflow:hidden;aspect-ratio:1;position:relative;">
                                ${mainImgSrc ? 
                                    `<img src="${mainImgSrc}" id="mainModalImage" onclick="openZoom()" onerror="this.src='https://via.placeholder.com/500x500.png?text=صورة+غير+متوفرة'" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;">
                                     <div class="zoom-hint"><i class="fas fa-search-plus"></i> اضغط للتكبير</div>` :
                                    `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><i class="fas fa-gem" style="font-size:80px;color:var(--primary);opacity:0.3;"></i></div>`
                                }
                            </div>
                            ${galleryHTML}
                        </div>
                        <div>
                            <div style="margin-bottom:12px; display:flex; gap:10px; align-items:center;">
                                ${badgeHTML}
                                <span style="font-size:12px; color:var(--text-muted); background:var(--bg-secondary); padding:4px 8px; border-radius:4px; font-weight:700;">موديل: #${product.id}</span>
                            </div>
                            <div style="font-size:14px;color:var(--gold);font-weight:800;margin-bottom:8px;">${product.category}</div>
                            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
                                <span style="font-size:28px;font-weight:900;color:var(--primary);">${Number(product.price).toLocaleString()} ${CONFIG.CURRENCY}</span>
                                ${oldPriceHTML}
                            </div>
                            <div style="display:flex;gap:16px;margin-bottom:20px;font-size:14px;color:var(--text-muted);">
                                ${product.weight ? `<span><i class="fas fa-weight-hanging" style="color:var(--gold);"></i> ${product.weight}</span>` : ''}
                                ${product.size ? `<span><i class="fas fa-ruler" style="color:var(--gold);"></i> ${product.size}</span>` : ''}
                            </div>
                            <p style="color:var(--text-muted);line-height:1.8;margin-bottom:24px;font-size:15px;">${product.description || 'لا يوجد وصف متاح لهذا المنتج.'}</p>
                            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                                <button class="btn-primary" onclick="addToCart('${product.id}');closeProductModal();" style="flex:1;"><i class="fas fa-cart-plus"></i> أضف للسلة</button>
                                <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent('مرحباً، أريد طلب: ' + product.name + ' (موديل: ' + product.id + ')')}" class="btn-secondary" target="_blank" style="flex:1;justify-content:center;background:#25D366;color:#FFF;border:none;"><i class="fab fa-whatsapp"></i> اطلب عبر واتساب</a>
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
    if (modal) { modal.classList.remove('active'); setTimeout(() => { modal.remove(); document.body.style.overflow = ''; }, 300); }
}

function setupZoomOverlay() {
    if (!document.getElementById('zoomOverlay')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="zoom-overlay" id="zoomOverlay" onclick="closeZoom()">
                <button class="close-zoom" onclick="closeZoom()"><i class="fas fa-times"></i></button>
                <img id="zoomedImage" src="" onclick="event.stopPropagation()">
            </div>
        `);
    }
}
window.changeModalImage = function(element, src) {
    document.getElementById('mainModalImage').src = src;
    document.querySelectorAll('.gallery-thumb').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
};
window.openZoom = function() {
    const mainImg = document.getElementById('mainModalImage');
    if(mainImg && mainImg.src) {
        document.getElementById('zoomedImage').src = mainImg.src;
        document.getElementById('zoomOverlay').classList.add('active');
    }
};
window.closeZoom = function() { document.getElementById('zoomOverlay').classList.remove('active'); };

// ===== SEARCH & FILTER =====
function initSearch() {
    const searchInput = document.getElementById('productSearch');
    if (!searchInput) return;
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const activeTab = document.querySelector('.filter-tab.active');
            renderAllProducts(activeTab ? activeTab.dataset.category || 'all' : 'all', e.target.value);
        }, 300);
    });
}
function filterProducts(category, btnElement) {
    if (btnElement) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        btnElement.classList.add('active');
    }
    const searchInput = document.getElementById('productSearch');
    renderAllProducts(category, searchInput ? searchInput.value : '');
}
function initURLParams() {
    const catFilter = new URLSearchParams(window.location.search).get('cat');
    if (catFilter) {
        const targetBtn = Array.from(document.querySelectorAll('.filter-tab')).find(b => b.textContent.trim() === catFilter);
        if (targetBtn) filterProducts(catFilter, targetBtn);
    }
}

// ===== CART FUNCTIONS =====
function addToCart(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) return;
    
    const existing = cart.find(item => item.id == productId);
    if (existing) existing.qty++; else cart.push({ ...product, qty: 1 });
    
    saveCart();
    updateCartUI();
    showToast(`✅ تمت إضافة "${product.name}" للسلة`);
    
    const cartBtn = document.querySelector('.cart-btn');
    if (cartBtn) { cartBtn.style.transform = 'scale(1.2)'; setTimeout(() => cartBtn.style.transform = '', 200); }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id != productId);
    saveCart(); updateCartUI();
}

function updateQty(productId, change) {
    const item = cart.find(item => item.id == productId);
    if (!item) return;
    item.qty += change;
    if (item.qty <= 0) { removeFromCart(productId); return; }
    saveCart(); updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('#cartCount').forEach(el => { el.textContent = count; });
    
    const itemsContainer = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    if (!itemsContainer || !footer) return;
    
    if (cart.length === 0) {
        itemsContainer.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-cart"></i><p>السلة فارغة</p></div>`;
        footer.style.display = 'none';
    } else {
        itemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <button class="remove-item" onclick="removeFromCart('${item.id}')"><i class="fas fa-times"></i></button>
                <div class="cart-item-image"><img src="${item.image || ''}"></div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
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
        document.getElementById('cartTotal').textContent = total.toLocaleString() + ' ' + CONFIG.CURRENCY;
        footer.style.display = 'block';
    }
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('active');
    document.getElementById('cartSidebar').classList.toggle('active');
}

function checkoutWhatsApp() {
    if (cart.length === 0) return;
    let message = '🛒 *طلب جديد من متجر عقيق يمني أصيل*\n\n*المنتجات:*\n';
    let total = 0;
    cart.forEach((item, index) => {
        message += `${index + 1}. ${item.name} (موديل: ${item.id})\n   الكمية: ${item.qty} | السعر: ${(item.price * item.qty).toLocaleString()} ${CONFIG.CURRENCY}\n\n`;
        total += item.price * item.qty;
    });
    message += `\n*الإجمالي: ${total.toLocaleString()} ${CONFIG.CURRENCY}*\n\nيرجى تأكيد الطلب.`;
    window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

// ===== UTILS =====
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.classList.add('show');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

function initMobileMenu() {
    const btn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav-links');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => { nav.classList.toggle('mobile-active'); });
    nav.querySelectorAll('a').forEach(link => { link.addEventListener('click', () => { nav.classList.remove('mobile-active'); }); });
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.product-card, .category-card, .feature-item').forEach(el => {
        el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.transition = 'opacity 0.6s ease, transform 0.6s ease'; observer.observe(el);
    });
}

// Admin Functions
function loginAdmin() {
    if (document.getElementById('adminPassword').value === CONFIG.ADMIN_PASSWORD) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        renderAdminProducts(); showToast('✅ تم تسجيل الدخول بنجاح');
    } else { showToast('❌ كلمة المرور غير صحيحة'); }
}
function renderAdminProducts() {
    const tbody = document.getElementById('adminProductsList');
    if (!tbody) return;
    tbody.innerHTML = products.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:30px;">لا توجد منتجات</td></tr>' : products.map((p, idx) => `
        <tr><td>${p.id}</td><td><strong style="font-size:13px;">${p.name}</strong></td><td>${p.category}</td><td style="color:var(--primary);">${Number(p.price).toLocaleString()} ${CONFIG.CURRENCY}</td>
        <td>${p.badge || '-'}</td><td><button class="btn-danger" onclick="deleteProduct('${p.id}')">حذف</button></td></tr>
    `).join('');
}
function deleteProduct(id) {
    if (confirm('هل أنت متأكد؟')) { products = products.filter(p => p.id != id); saveProducts(); renderAdminProducts(); renderProducts(); renderAllProducts(); showToast('🗑️ تم الحذف'); }
}
function setProductsURL() {
    const url = document.getElementById('productsURL').value.trim();
    if (url) { localStorage.setItem('products_url', url); CONFIG.PRODUCTS_URL = url; loadProductsFromURL(url); } 
    else { localStorage.removeItem('products_url'); CONFIG.PRODUCTS_URL = ''; showToast('تم الإزالة'); }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('zoomOverlay')?.classList.contains('active')) closeZoom();
        else if (document.getElementById('cartSidebar')?.classList.contains('active')) toggleCart();
        else closeProductModal();
    }
});
