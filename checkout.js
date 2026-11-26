import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD6fyP1mdM5xdL1euUcfTLZyFEzvcZGxY0",authDomain:"sayurfresh-8ceb8.firebaseapp.com",projectId:"sayurfresh-8ceb8",storageBucket:"sayurfresh-8ceb8.firebasestorage.app",messagingSenderId:"318005839589",appId:"1:318005839589:web:9001d01a61b3f84fcf760c",measurementId:"G-MEPJ8ZBJNQ"};
const app=initializeApp(firebaseConfig),db=getFirestore(app);
const $=id=>document.getElementById(id);
let waNumber="6281258019993";
let cart=[];
try{cart=JSON.parse(localStorage.getItem("sayurFreshCheckout")||"[]");if(!Array.isArray(cart))cart=[];}catch{cart=[];}
cart=cart.filter(x=>x&&typeof x.name==="string"&&Number.isFinite(Number(x.price))&&Number.isInteger(x.quantity)&&x.quantity>0);
let storeSettings={};
try {
  const settingsSnap=await getDoc(doc(db,"settings","store"));
  if(settingsSnap.exists()){
    storeSettings=settingsSnap.data();
    if(storeSettings.whatsapp) waNumber=String(storeSettings.whatsapp).replace(/\D/g,"");
  }
} catch(settingsError) {
  console.warn("Pengaturan toko belum dapat dibaca; memakai nomor WhatsApp default.",settingsError);
}
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const subtotal=cart.reduce((s,x)=>s+Number(x.price)*x.quantity,0);
function renderSummary(){
  $("checkout-lines").innerHTML=cart.length?cart.map(x=>`<div class="checkout-line"><div><b>${escapeHTML(x.name)}</b><small>${x.quantity} × ${rupiah(x.price)} / ${escapeHTML(x.unit||"")}</small></div><strong>${rupiah(x.price*x.quantity)}</strong></div>`).join(""):'<p class="checkout-help">Tidak ada produk katalog. Anda tetap bisa mengirim permintaan barang khusus.</p>';
  $("checkout-total").textContent=rupiah(subtotal);
}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function addCustomRow(){const row=document.createElement("div");row.className="custom-row";row.innerHTML='<input class="custom-name" maxlength="100" placeholder="Nama barang" aria-label="Nama barang"><input class="custom-qty" maxlength="50" placeholder="Jumlah" aria-label="Jumlah"><button type="button" aria-label="Hapus barang">×</button>';row.querySelector("button").addEventListener("click",()=>row.remove());$("custom-items").appendChild(row);}
$("add-custom-item").addEventListener("click",addCustomRow);
renderSummary();
if(!cart.length)addCustomRow();
$("checkout-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("submit-order"),msg=$("checkout-message");
  if(storeSettings.isOpen===false){
    msg.textContent="Maaf, toko sedang tidak menerima pesanan. Silakan coba kembali saat toko buka.";
    msg.className="admin-message error";return;
  }
  const customItems=[...document.querySelectorAll(".custom-row")].map(r=>({name:r.querySelector(".custom-name").value.trim(),quantity:r.querySelector(".custom-qty").value.trim()})).filter(x=>x.name&&x.quantity);
  const hasPartial=[...document.querySelectorAll(".custom-row")].some(r=>{const n=r.querySelector(".custom-name").value.trim(),q=r.querySelector(".custom-qty").value.trim();return (n&&!q)||(!n&&q);});
  if(hasPartial){msg.textContent="Lengkapi nama dan jumlah setiap barang khusus.";msg.className="admin-message error";return;}
  if(!cart.length&&!customItems.length){msg.textContent="Keranjang kosong. Tambahkan produk atau barang khusus.";msg.className="admin-message error";return;}
  const customer={name:$("customer-name").value.trim(),phone:$("customer-phone").value.trim(),address:$("customer-address").value.trim(),note:$("customer-note").value.trim()};
  if(!customer.name||!customer.phone||!customer.address)return;
  const payment=document.querySelector('input[name="payment"]:checked').value;
  const orderItems=cart.map(item=>({productId:String(item.id),name:String(item.name),price:Number(item.price),unit:String(item.unit||""),quantity:item.quantity}));
  const order={customer,items:orderItems,customItems,payment,subtotal,status:"new",shippingFee:null,total:null,createdAt:serverTimestamp(),createdAtClient:new Date().toISOString()};
  btn.disabled=true;btn.textContent="Menyimpan pesanan...";
  try{
    const ref=await addDoc(collection(db,"orders"),order);
    const lines=[
      "PESANAN SAYUR FRESH EFFENDI",`No. Pesanan: ${ref.id}`,"",
      `Nama: ${customer.name}`,`WhatsApp: ${customer.phone}`,`Alamat: ${customer.address}`,
      `Pembayaran: ${payment}`,"","PRODUK KATALOG:",
      ...(order.items.length?order.items.map(x=>`- ${x.name} (${x.quantity} ${x.unit}) = ${rupiah(x.price*x.quantity)}`):["- Tidak ada"]),
      "",`Subtotal katalog: ${rupiah(subtotal)}`,"",
      "PESANAN KHUSUS:",...(customItems.length?customItems.map(x=>`- ${x.name}: ${x.quantity} (mohon konfirmasi harga/ketersediaan)`):["- Tidak ada"]),
      "",`Catatan: ${customer.note||"-"}`,"Ongkir dan total akhir dikonfirmasi admin."
    ];
    localStorage.removeItem("sayurFreshCart");localStorage.removeItem("sayurFreshCheckout");
    msg.textContent="Pesanan tersimpan. WhatsApp akan dibuka untuk mengirim rincian pesanan.";msg.className="admin-message success";
    const url=`https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href=url;
  }catch(error){
    console.error(error);msg.textContent=`Pesanan belum tersimpan: ${error.message}. Periksa koneksi dan Firestore Rules.`;msg.className="admin-message error";
    btn.disabled=false;btn.textContent="Kirim pesanan ke WhatsApp";
  }
});
