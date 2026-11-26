// SAYUR FRESH EFFENDI — CUSTOMER STORE + FIRESTORE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    getFirestore, collection, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD6fyP1mdM5xdL1euUcfTLZyFEzvcZGxY0",
    authDomain: "sayurfresh-8ceb8.firebaseapp.com",
    projectId: "sayurfresh-8ceb8",
    storageBucket: "sayurfresh-8ceb8.firebasestorage.app",
    messagingSenderId: "318005839589",
    appId: "1:318005839589:web:9001d01a61b3f84fcf760c",
    measurementId: "G-MEPJ8ZBJNQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productsCollection = collection(db, "product");

const sampleProducts = [
    { id: "sample-1", name: "Bayam", price: 4000, unit: "ikat", category: "Sayuran", stock: 20, description: "Bayam hijau segar pilihan.", image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80", active: true },
    { id: "sample-2", name: "Wortel", price: 15000, unit: "kg", category: "Sayuran", stock: 20, description: "Wortel segar dan berkualitas.", image: "https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600&q=80", active: true },
    { id: "sample-3", name: "Tomat", price: 12000, unit: "kg", category: "Sayuran", stock: 15, description: "Tomat merah segar.", image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=600&q=80", active: true },
    { id: "sample-4", name: "Brokoli", price: 18000, unit: "kg", category: "Sayuran", stock: 10, description: "Brokoli hijau segar.", image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80", active: true },
    { id: "sample-5", name: "Apel", price: 25000, unit: "kg", category: "Buah", stock: 12, description: "Buah apel pilihan.", image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80", active: true },
    { id: "sample-6", name: "Jeruk", price: 18000, unit: "kg", category: "Buah", stock: 15, description: "Jeruk segar pilihan.", image: "https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80", active: true },
    { id: "sample-7", name: "Bawang Putih", price: 35000, unit: "kg", category: "Bumbu", stock: 10, description: "Bumbu dapur pilihan.", image: "https://food.fnr.sndimg.com/content/dam/images/food/fullset/2021/05/25/head-of-garlic-and-garlic-cloves.jpg.rend.hgtvcom.1280.960.suffix/1621974634336.jpeg", active: true },
    { id: "sample-8", name: "Kentang", price: 18000, unit: "kg", category: "Lainnya", stock: 20, description: "Kentang segar berkualitas.", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", active: true }
];

const productList = document.getElementById("product-list");
const emptyProducts = document.getElementById("empty-products");
const searchInput = document.getElementById("product-search");
const cartCount = document.getElementById("cart-count");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartSubtitle = document.getElementById("cart-subtitle");
const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
const toast = document.getElementById("toast");

let products = [];
let activeCategory = "Semua";
let cart = [];

function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}
function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
function saveCart() {
    try { localStorage.setItem("sayurFreshCart", JSON.stringify(cart)); } catch (error) { console.warn(error); }
}
function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem("sayurFreshCart") || "[]");
        cart = Array.isArray(saved) ? saved.filter(x => x && Number.isInteger(x.quantity) && x.quantity > 0).map(x => ({ id: String(x.id), quantity: x.quantity })) : [];
    } catch { cart = []; }
}
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function renderProducts() {
    const keyword = searchInput.value.trim().toLowerCase();
    const visible = products.filter(p => p.active !== false &&
        (activeCategory === "Semua" || p.category === activeCategory) &&
        String(p.name || "").toLowerCase().includes(keyword));
    productList.innerHTML = "";
    emptyProducts.hidden = visible.length !== 0;
    visible.forEach(product => {
        const card = document.createElement("article");
        card.className = "product-card";
        card.innerHTML = `
          <div class="product-image">
            <img src="${safeText(product.image)}" alt="${safeText(product.name)}" loading="lazy"
                 onerror="this.style.opacity='.15'; this.alt='Foto tidak tersedia';">
            <span class="product-category">${safeText(product.category)}</span>
          </div>
          <div class="product-info">
            <h3>${safeText(product.name)}</h3>
            <p class="product-description">${safeText(product.description || "")}</p>
            <div class="product-price">${formatRupiah(product.price)} <small>/ ${safeText(product.unit || "")}</small></div>
            <div class="product-bottom">
              <button class="add-button" data-add="${safeText(product.id)}" aria-label="Tambah ${safeText(product.name)}">+</button>
            </div>
          </div>`;
        productList.appendChild(card);
    });
}
function findProduct(id) { return products.find(p => String(p.id) === String(id)); }
function cleanCartAgainstProducts() {
    cart = cart.map(item => {
        const p = findProduct(item.id);
        return p ? { id: String(p.id), quantity: Math.max(1, Number(item.quantity) || 1) } : null;
    }).filter(Boolean);
    saveCart();
}
function getCartTotal() {
    return cart.reduce((sum, item) => {
        const p = findProduct(item.id);
        return sum + (p ? (Number(p.price) || 0) * item.quantity : 0);
    }, 0);
}
function renderCart() {
    const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = quantity;
    cartSubtitle.textContent = `${quantity} produk dipilih`;
    cartTotal.textContent = formatRupiah(getCartTotal());
    if (!cart.length) {
        cartItems.innerHTML = `<div class="cart-empty"><span>🛒</span><h3>Keranjang masih kosong</h3><p>Yuk, pilih sayuran favorit Anda.</p></div>`;
        return;
    }
    cartItems.innerHTML = "";
    cart.forEach(item => {
        const p = findProduct(item.id);
        if (!p) return;
        const el = document.createElement("div");
        el.className = "cart-item";
        el.innerHTML = `<img src="${safeText(p.image)}" alt="${safeText(p.name)}">
          <div class="cart-item-info"><strong>${safeText(p.name)}</strong><small>${formatRupiah(p.price)} / ${safeText(p.unit || "")}</small>
          <div class="quantity-controls"><button data-minus="${safeText(p.id)}">−</button><span>${item.quantity}</span><button data-plus="${safeText(p.id)}">+</button></div></div>`;
        cartItems.appendChild(el);
    });
}
function addToCart(id) {
    const p = findProduct(id);
    if (!p) return showToast("Produk tidak tersedia.");
    const item = cart.find(x => String(x.id) === String(id));
    if (item) item.quantity++;
    else cart.push({ id: String(id), quantity: 1 });
    saveCart(); renderCart(); showToast(`${p.name} ditambahkan ke keranjang.`);
}
function decreaseQuantity(id) {
    const item = cart.find(x => String(x.id) === String(id));
    if (!item) return;
    item.quantity--;
    if (item.quantity <= 0) cart = cart.filter(x => String(x.id) !== String(id));
    saveCart(); renderCart();
}
function increaseQuantity(id) {
    const item = cart.find(x => String(x.id) === String(id));
    const p = findProduct(id);
    if (!item || !p) return;
    item.quantity++; saveCart(); renderCart();
}
function openCart() { cartDrawer.classList.add("open"); cartOverlay.classList.add("show"); document.body.style.overflow = "hidden"; }
function closeCart() { cartDrawer.classList.remove("open"); cartOverlay.classList.remove("show"); document.body.style.overflow = ""; }

document.querySelectorAll(".category-card").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".category-card").forEach(item => item.classList.remove("active"));
    button.classList.add("active"); activeCategory = button.dataset.category; renderProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
}));
searchInput.addEventListener("input", renderProducts);
document.getElementById("search-focus").addEventListener("click", () => {
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => searchInput.focus(), 400);
});
productList.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(button.dataset.add);
});
cartItems.addEventListener("click", event => {
    const minus = event.target.closest("[data-minus]");
    const plus = event.target.closest("[data-plus]");
    if (minus) decreaseQuantity(minus.dataset.minus);
    if (plus) increaseQuantity(plus.dataset.plus);
});
document.getElementById("open-cart").addEventListener("click", openCart);
document.getElementById("close-cart").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeCart(); });
document.getElementById("checkout-button").addEventListener("click", () => {
    if (!cart.length) return showToast("Keranjang masih kosong.");
    try {
        localStorage.setItem("sayurFreshCheckout", JSON.stringify(
            cart.map(item => {
                const p = findProduct(item.id);
                return p ? { id: String(p.id), name: p.name, price: Number(p.price), unit: p.unit || "", quantity: item.quantity, image: p.image || "" } : null;
            }).filter(Boolean)
        ));
        window.location.href = "checkout.html";
    } catch (error) {
        showToast("Tidak dapat menyiapkan checkout. Coba lagi.");
    }
});

loadCart();
onSnapshot(productsCollection, snapshot => {
    products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.active !== false)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
    renderProducts();
    cleanCartAgainstProducts();
    renderCart();
}, error => {
    console.error("Firestore products error:", error);
    productList.innerHTML = `<div class="loading-products">Produk belum dapat dimuat. Periksa koneksi dan Firestore Rules.</div>`;
});
