// SAYUR FRESH EFFENDI — ADMIN DASHBOARD
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, getDocs, serverTimestamp
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
const auth = getAuth(app);
const db = getFirestore(app);
const productsRef = collection(db, "product");
const ordersRef = collection(db, "orders");

const $ = id => document.getElementById(id);
const loginPanel = $("login-panel");
const dashboardPanel = $("dashboard-panel");
const loginMessage = $("login-message");
const formMessage = $("form-message");
let currentProducts = [];
let unsubscribeProducts = null;
let unsubscribeOrders = null;
let allOrders = [];

const sampleProducts = [
  { name:"Bayam", price:4000, unit:"ikat", category:"Sayuran", description:"Bayam hijau segar pilihan.", image:"https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80", active:true },
  { name:"Wortel", price:15000, unit:"kg", category:"Sayuran", description:"Wortel segar dan berkualitas.", image:"https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600&q=80", active:true },
  { name:"Tomat", price:12000, unit:"kg", category:"Sayuran", description:"Tomat merah segar.", image:"https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=600&q=80", active:true },
  { name:"Brokoli", price:18000, unit:"kg", category:"Sayuran", description:"Brokoli hijau segar.", image:"https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80", active:true },
  { name:"Apel", price:25000, unit:"kg", category:"Buah", description:"Buah apel pilihan.", image:"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80", active:true },
  { name:"Jeruk", price:18000, unit:"kg", category:"Buah", description:"Jeruk segar pilihan.", image:"https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80", active:true },
  { name:"Bawang Putih", price:35000, unit:"kg", category:"Bumbu", description:"Bumbu dapur pilihan.", image:"https://food.fnr.sndimg.com/content/dam/images/food/fullset/2021/05/25/head-of-garlic-and-garlic-cloves.jpg.rend.hgtvcom.1280.960.suffix/1621974634336.jpeg", active:true },
  { name:"Kentang", price:18000, unit:"kg", category:"Lainnya", description:"Kentang segar berkualitas.", image:"https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", active:true }
];

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value)||0);
}
function setMessage(element, message, type="") {
  element.textContent = message;
  element.className = `admin-message ${type}`;
}
function toast(message) {
  const el = $("admin-toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

function orderDate(order) {
  const raw = order.createdAt?.toDate ? order.createdAt.toDate() : (order.createdAtClient ? new Date(order.createdAtClient) : null);
  return raw && !Number.isNaN(raw.getTime()) ? raw : null;
}
function orderTotal(order) {
  return Number.isFinite(Number(order.total)) ? Number(order.total) : Number(order.subtotal || 0) + Number(order.shippingFee || 0);
}
function renderOrders() {
  const active = allOrders.filter(o => !["completed","cancelled"].includes(o.status));
  const history = allOrders.filter(o => ["completed","cancelled"].includes(o.status));
  const printButton = o => `<button type="button" data-print-order="${escapeHTML(o.id)}">Cetak nota</button>`;
  const row = o => {
    const date=orderDate(o);
    const details=(o.items||[]).map(i=>`${i.name} × ${i.quantity}`).concat((o.customItems||[]).map(i=>`Khusus: ${i.name} (${i.quantity})`)).join(", ");
    return `<tr><td><strong>${escapeHTML(o.id.slice(0,8))}</strong><small class="order-detail">${date?date.toLocaleString("id-ID"):"Tanggal tidak tersedia"}<br>${escapeHTML(details||"Tidak ada rincian")}</small></td><td>${escapeHTML(o.customer?.name||"-")}<small class="order-detail">${escapeHTML(o.customer?.phone||"")}</small></td><td>${rupiah(o.subtotal||0)}</td><td>${escapeHTML(o.payment||"-")}</td><td><span class="status-pill">${escapeHTML(o.status||"new")}</span></td><td><div class="order-actions">${printButton(o)}<select data-status="${escapeHTML(o.id)}"><option value="new" ${o.status==="new"?"selected":""}>Baru</option><option value="accepted" ${o.status==="accepted"?"selected":""}>Diterima</option><option value="preparing" ${o.status==="preparing"?"selected":""}>Disiapkan</option><option value="shipping" ${o.status==="shipping"?"selected":""}>Dikirim</option><option value="completed" ${o.status==="completed"?"selected":""}>Selesai</option><option value="cancelled" ${o.status==="cancelled"?"selected":""}>Dibatalkan</option></select></div></td></tr>`;
  };
  $("orders-list").innerHTML=active.length?active.map(row).join(""):`<tr><td colspan="6" class="admin-empty">Belum ada pesanan aktif.</td></tr>`;
  $("history-list").innerHTML=history.length?history.map(o=>`<tr><td>${escapeHTML(o.id.slice(0,8))}</td><td>${escapeHTML(o.customer?.name||"-")}</td><td>${orderDate(o)?.toLocaleString("id-ID")||"-"}</td><td>${rupiah(orderTotal(o))}</td><td>${escapeHTML(o.status)}</td><td><div class="history-actions">${printButton(o)}<button class="history-delete" data-delete-order="${escapeHTML(o.id)}">Hapus</button></div></td></tr>`).join(""):`<tr><td colspan="6" class="admin-empty">Belum ada riwayat pesanan selesai/dibatalkan.</td></tr>`;

  const now=new Date();
  const today=new Date(now);today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const nextMonth=new Date(now.getFullYear(),now.getMonth()+1,1);
  const completed=allOrders.filter(o=>o.status==="completed"&&orderDate(o));
  const todayDone=completed.filter(o=>orderDate(o)>=today&&orderDate(o)<tomorrow);
  const monthDone=completed.filter(o=>orderDate(o)>=monthStart&&orderDate(o)<nextMonth);
  $("sales-today").textContent=rupiah(todayDone.reduce((s,o)=>s+orderTotal(o),0));
  $("orders-today").textContent=todayDone.length;
  $("sales-month").textContent=rupiah(monthDone.reduce((s,o)=>s+orderTotal(o),0));
  $("orders-month").textContent=monthDone.length;
}

document.querySelectorAll(".admin-tab").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b===button));
  document.querySelectorAll(".admin-tab-panel").forEach(panel=>panel.hidden=panel.id!==button.dataset.tab);
}));
document.addEventListener("change",async event=>{
  const select=event.target.closest("[data-status]");
  if(!select)return;
  const id=select.dataset.status,newStatus=select.value;
  try{await updateDoc(doc(db,"orders",id),{status:newStatus,statusUpdatedAt:serverTimestamp()});toast("Status pesanan diperbarui.");}
  catch(error){toast(`Gagal memperbarui status: ${error.message}`);}
});
function printOrderReceipt(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return toast("Pesanan tidak ditemukan.");
  const date = orderDate(order);
  const items = (order.items || []).map(item => ({
    name: item.name || "Barang",
    quantity: item.quantity ?? "",
    unit: item.unit || "",
    price: Number(item.price || item.unitPrice || 0),
    total: Number(item.total ?? item.subtotal ?? ((Number(item.price || item.unitPrice || 0)) * (Number(item.quantity) || 0)))
  }));
  const customItems = (order.customItems || []).map(item => ({
    name: `Pesanan khusus: ${item.name || "Barang"}`,
    quantity: item.quantity ?? "",
    unit: "",
    price: 0,
    total: 0
  }));
  const rows = [...items, ...customItems].map(item =>
    `<tr><td>${escapeHTML(item.name)}<small>${escapeHTML(String(item.quantity))} ${escapeHTML(item.unit)}</small></td><td>${item.price ? rupiah(item.price) : "-"}</td><td>${item.total ? rupiah(item.total) : "-"}</td></tr>`
  ).join("");
  const customer = order.customer || {};
  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Nota ${escapeHTML(order.id.slice(0,8))}</title><style>
    body{font-family:Arial,sans-serif;color:#222;max-width:420px;margin:24px auto;padding:12px}
    h2,p{text-align:center;margin:5px 0} .muted{color:#666;font-size:12px}
    hr{border:0;border-top:1px dashed #888;margin:14px 0}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
    th,td{text-align:left;padding:7px 3px;border-bottom:1px solid #ddd}
    th:last-child,td:last-child{text-align:right}
    small{display:block;color:#666;margin-top:3px}
    .total{font-weight:bold;text-align:right;font-size:17px;margin-top:14px}
    .footer{text-align:center;font-size:12px;margin-top:24px}
    @media print{body{margin:0 auto}}
  </style></head><body>
    <h2>SAYUR FRESH EFFENDI</h2><p class="muted">NOTA PEMBELIAN</p><hr>
    <p style="text-align:left">No. Pesanan: <b>${escapeHTML(order.id.slice(0,8))}</b></p>
    <p style="text-align:left">Tanggal: ${escapeHTML(date ? date.toLocaleString("id-ID") : "-")}</p>
    <p style="text-align:left">Pelanggan: ${escapeHTML(customer.name || "-")}</p>
    <p style="text-align:left">WhatsApp: ${escapeHTML(customer.phone || "-")}</p>
    <p style="text-align:left">Alamat: ${escapeHTML(customer.address || "-")}</p>
    <hr><table><thead><tr><th>Barang</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="text-align:right">Subtotal: ${rupiah(order.subtotal || 0)}</p>
    <p style="text-align:right">Ongkir: ${rupiah(order.shippingFee || 0)}</p>
    <p class="total">TOTAL: ${rupiah(orderTotal(order))}</p>
    <p style="text-align:left">Pembayaran: ${escapeHTML(order.payment || "-")}</p>
    <p style="text-align:left">Status: ${escapeHTML(order.status || "-")}</p>
    <div class="footer">Terima kasih sudah berbelanja!<br>SAYUR FRESH EFFENDI</div>
    <script>window.onload=()=>window.print();<\/script>
  </body></html>`;
  const printWindow = window.open("", "_blank", "width=520,height=720");
  if (!printWindow) return toast("Izinkan pop-up browser untuk mencetak nota.");
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
document.addEventListener("click", event => {
  const button = event.target.closest("[data-print-order]");
  if (button) printOrderReceipt(button.dataset.printOrder);
});

$("history-list").addEventListener("click",async event=>{
  const button=event.target.closest("[data-delete-order]");
  if(!button)return;
  const order=allOrders.find(o=>o.id===button.dataset.deleteOrder);
  if(!order)return;
  if(!confirm(`Hapus riwayat pesanan ${order.id.slice(0,8)} milik ${order.customer?.name||"pelanggan"}? Data yang dihapus tidak dapat dipulihkan.`))return;
  button.disabled=true;
  try{await deleteDoc(doc(db,"orders",order.id));toast("Riwayat pesanan berhasil dihapus.");}
  catch(error){button.disabled=false;toast(`Gagal menghapus riwayat: ${error.message}`);}
});

function resetForm() {
  $("product-form").reset();
  $("product-id").value = "";
  $("product-active").checked = true;
  $("form-title").textContent = "Tambah Produk";
  $("form-mode").textContent = "PRODUK BARU";
  $("save-product").textContent = "Simpan Produk";
  $("cancel-edit").hidden = true;
  $("image-preview").hidden = true;
  $("image-preview").removeAttribute("src");
  $("image-preview-empty").hidden = false;
  setMessage(formMessage, "");
}
function renderList() {
  $("total-products").textContent = currentProducts.filter(p => p.active !== false).length;
  $("list-count").textContent = `${currentProducts.length} PRODUK`;
  const tbody = $("admin-product-list");
  if (!currentProducts.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-empty">Belum ada produk. Tambahkan produk melalui formulir.</td></tr>`;
    return;
  }
  tbody.innerHTML = currentProducts.map(p => `
    <tr>
      <td><div class="admin-product-cell"><img src="${escapeHTML(p.image)}" alt="" onerror="this.style.opacity='.15'"><div><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.category)} · /${escapeHTML(p.unit)}</small></div></div></td>
      <td>${rupiah(p.price)}</td>
      <td><span class="status-pill ${p.active === false ? "off" : ""}">${p.active === false ? "Nonaktif" : "Aktif"}</span></td>
      <td><div class="table-actions"><button data-edit="${escapeHTML(p.id)}">Edit</button><button class="delete" data-delete="${escapeHTML(p.id)}">Hapus</button></div></td>
    </tr>`).join("");
}
function beginEdit(id) {
  const p = currentProducts.find(x => x.id === id);
  if (!p) return;
  $("product-id").value = p.id;
  $("product-name").value = p.name || "";
  $("product-category").value = p.category || "Sayuran";
  $("product-unit").value = p.unit || "";
  $("product-price").value = Number(p.price) || 0;
  $("product-image").value = p.image || "";
  $("product-description").value = p.description || "";
  $("product-active").checked = p.active !== false;
  $("form-title").textContent = "Edit Produk";
  $("form-mode").textContent = "UBAH DATA";
  $("save-product").textContent = "Simpan Perubahan";
  $("cancel-edit").hidden = false;
  updatePreview();
  $("product-form").scrollIntoView({ behavior:"smooth", block:"start" });
}
function updatePreview() {
  const url = $("product-image").value.trim();
  const img = $("image-preview");
  if (!url) {
    img.hidden = true; img.removeAttribute("src"); $("image-preview-empty").hidden = false; return;
  }
  img.src = url; img.hidden = false; $("image-preview-empty").hidden = true;
  img.onerror = () => { img.hidden = true; $("image-preview-empty").hidden = false; $("image-preview-empty").textContent = "URL foto tidak dapat dibuka"; };
  img.onload = () => { $("image-preview-empty").hidden = true; };
}
$("product-image").addEventListener("input", updatePreview);

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  setMessage(loginMessage, "Sedang masuk...");
  try {
    await signInWithEmailAndPassword(auth, $("admin-email").value.trim(), $("admin-password").value);
    $("admin-password").value = "";
  } catch (error) {
    setMessage(loginMessage, error.code === "auth/invalid-credential" ? "Email atau password salah." : `Login gagal: ${error.message}`, "error");
  } finally { button.disabled = false; }
});


// NOTIFIKASI PESANAN BARU — suara Marimba Triad
let orderSoundEnabled = false;
let orderSnapshotInitialized = false;
const pendingNewOrderIds = new Set();
const orderNotificationAudio = $("order-notification-audio");
const orderSoundButton = $("enable-order-sound");

function startOrderNotification() {
  if (!orderSoundEnabled || pendingNewOrderIds.size === 0 || !orderNotificationAudio) return;
  orderNotificationAudio.loop = true;
  orderNotificationAudio.play().catch(error => {
    console.warn("Suara notifikasi belum dapat diputar:", error);
    toast("Klik Aktifkan suara pesanan agar notifikasi dapat berbunyi.");
  });
}
function stopOrderNotification() {
  if (!orderNotificationAudio) return;
  orderNotificationAudio.pause();
  orderNotificationAudio.currentTime = 0;
}
if (orderSoundButton) {
  orderSoundButton.addEventListener("click", async () => {
    orderSoundEnabled = !orderSoundEnabled;
    orderSoundButton.setAttribute("aria-pressed", String(orderSoundEnabled));
    orderSoundButton.textContent = orderSoundEnabled ? "Matikan suara pesanan" : "Aktifkan suara pesanan";
    if (orderSoundEnabled) {
      try {
        await orderNotificationAudio.play();
        orderNotificationAudio.pause();
        orderNotificationAudio.currentTime = 0;
        startOrderNotification();
        toast("Suara notifikasi pesanan aktif.");
      } catch (error) {
        orderSoundEnabled = false;
        orderSoundButton.setAttribute("aria-pressed", "false");
        orderSoundButton.textContent = "Aktifkan suara pesanan";
        toast("Audio belum bisa diputar. Periksa file MP3 dan izin suara browser.");
      }
    } else {
      stopOrderNotification();
      toast("Suara notifikasi pesanan dimatikan.");
    }
  });
}
function handleOrderSnapshot(snapshot) {
  if (!orderSnapshotInitialized) {
    orderSnapshotInitialized = true;
    snapshot.docs.forEach(orderDoc => {
      const order = orderDoc.data();
      if (order.status === "new") pendingNewOrderIds.add(orderDoc.id);
    });
    // Pesanan lama tidak memicu alarm saat halaman admin baru dibuka.
    return;
  }
  snapshot.docChanges().forEach(change => {
    const order = change.doc.data();
    if (change.type === "added" && order.status === "new") {
      pendingNewOrderIds.add(change.doc.id);
      toast("Pesanan baru masuk!");
    } else if (change.type === "modified" || change.type === "removed") {
      if (change.type === "removed" || order.status !== "new") {
        pendingNewOrderIds.delete(change.doc.id);
      }
    }
  });
  if (pendingNewOrderIds.size > 0) startOrderNotification();
  else stopOrderNotification();
}

onAuthStateChanged(auth, user => {
  if (user) {
    loginPanel.hidden = true;
    dashboardPanel.hidden = false;
    $("logout-button").hidden = false;
    if (unsubscribeProducts) unsubscribeProducts();
    unsubscribeProducts = onSnapshot(productsRef, snapshot => {
      currentProducts = snapshot.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), "id"));
      renderList();
    }, error => setMessage(formMessage, `Tidak dapat membaca produk: ${error.message}`, "error"));
    if (unsubscribeOrders) unsubscribeOrders();
    orderSnapshotInitialized = false;
    pendingNewOrderIds.clear();
    stopOrderNotification();
    unsubscribeOrders = onSnapshot(ordersRef, snapshot => {
      handleOrderSnapshot(snapshot);
      allOrders = snapshot.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>(orderDate(b)?.getTime()||0)-(orderDate(a)?.getTime()||0));
      renderOrders();
    }, error => toast(`Tidak dapat membaca pesanan: ${error.message}`));
  } else {
    if (unsubscribeProducts) { unsubscribeProducts(); unsubscribeProducts = null; }
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    pendingNewOrderIds.clear(); orderSnapshotInitialized = false; stopOrderNotification();
    loginPanel.hidden = false; dashboardPanel.hidden = true; $("logout-button").hidden = true;
  }
});

$("logout-button").addEventListener("click", () => signOut(auth));
$("cancel-edit").addEventListener("click", resetForm);
$("product-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("save-product"); button.disabled = true;
  const data = {
    name:$("product-name").value.trim(),
    category:$("product-category").value,
    unit:$("product-unit").value.trim(),
    price:Number($("product-price").value),
    image:$("product-image").value.trim(),
    description:$("product-description").value.trim(),
    active:$("product-active").checked,
    updatedAt:serverTimestamp()
  };
  if (!data.name || !data.unit || !data.image || !Number.isFinite(data.price) || data.price < 0) {
    setMessage(formMessage, "Periksa nama, satuan, URL foto, dan harga produk.", "error"); button.disabled = false; return;
  }
  try {
    const id = $("product-id").value;
    if (id) await updateDoc(doc(db, "product", id), data);
    else await addDoc(productsRef, { ...data, createdAt:serverTimestamp() });
    resetForm(); toast(id ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
  } catch (error) {
    setMessage(formMessage, `Gagal menyimpan: ${error.message}`, "error");
  } finally { button.disabled = false; }
});
$("admin-product-list").addEventListener("click", async event => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  if (edit) beginEdit(edit.dataset.edit);
  if (del) {
    const p = currentProducts.find(x => x.id === del.dataset.delete);
    if (!p || !confirm(`Hapus produk "${p.name}"?`)) return;
    try { await deleteDoc(doc(db, "product", p.id)); toast("Produk berhasil dihapus."); }
    catch (error) { toast(`Gagal menghapus: ${error.message}`); }
  }
});
$("import-samples").addEventListener("click", async () => {
  if (!confirm("Impor 8 produk contoh? Produk dengan nama yang sama akan diperbarui, bukan dibuat duplikat.")) return;
  const button = $("import-samples"); button.disabled = true;
  try {
    const snapshot = await getDocs(productsRef);
    const existingByName = new Map(snapshot.docs.map(d => [String(d.data().name || "").toLowerCase(), d.id]));
    for (const item of sampleProducts) {
      const id = existingByName.get(item.name.toLowerCase());
      const payload = { ...item, updatedAt:serverTimestamp() };
      if (id) await updateDoc(doc(db, "product", id), payload);
      else await addDoc(productsRef, { ...payload, createdAt:serverTimestamp() });
    }
    toast("8 produk contoh berhasil dimasukkan/diperbarui.");
  } catch (error) {
    toast(`Impor gagal: ${error.message}`);
  } finally { button.disabled = false; }
});
resetForm();
