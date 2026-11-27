// SAYUR BABA EFFENDI — Admin sederhana: Produk, Pesanan Masuk, Riwayat, Rekap Pesanan
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyD6fyP1mdM5xdL1euUcfTLZyFEzvcZGxY0",authDomain:"sayurfresh-8ceb8.firebaseapp.com",projectId:"sayurfresh-8ceb8",storageBucket:"sayurfresh-8ceb8.firebasestorage.app",messagingSenderId:"318005839589",appId:"1:318005839589:web:9001d01a61b3f84fcf760c",measurementId:"G-MEPJ8ZBJNQ"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const productsRef=collection(db,"product"),ordersRef=collection(db,"orders");
const $=id=>document.getElementById(id);let currentProducts=[],allOrders=[],unsubscribers=[];
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const e=$("admin-toast");e.textContent=m;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove("show"),2800);};
const msg=(id,t,type="")=>{const e=$(id);e.textContent=t;e.className=`admin-message ${type}`;};

let orderSoundEnabled=false, orderAudioContext=null, firstOrderSnapshot=true;
const unprocessedNewOrders=new Set();
let orderAlarmInterval=null, orderAlarmTimeout=null;

function stopOrderAlarm(){
 if(orderAlarmInterval){clearInterval(orderAlarmInterval);orderAlarmInterval=null;}
 if(orderAlarmTimeout){clearTimeout(orderAlarmTimeout);orderAlarmTimeout=null;}
}
function playOrderAlert(){
 if(!orderSoundEnabled||!orderAudioContext||!unprocessedNewOrders.size)return;
 try{
  const now=orderAudioContext.currentTime;
  // Dua nada yang lebih tegas, diulang selama alarm aktif.
  [0,0.28,0.56].forEach((offset,index)=>{
   const oscillator=orderAudioContext.createOscillator();
   const gain=orderAudioContext.createGain();
   oscillator.type="sine";
   oscillator.frequency.value=[880,1174,988][index];
   gain.gain.setValueAtTime(0.0001,now+offset);
   gain.gain.exponentialRampToValueAtTime(0.65,now+offset+0.025);
   gain.gain.setValueAtTime(0.65,now+offset+0.16);
   gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.24);
   oscillator.connect(gain);gain.connect(orderAudioContext.destination);
   oscillator.start(now+offset);oscillator.stop(now+offset+0.25);
  });
 }catch(err){console.warn("Suara notifikasi tidak dapat diputar.",err);}
}
function startOrderAlarm(){
 if(!orderSoundEnabled||!unprocessedNewOrders.size||orderAlarmInterval)return;
 playOrderAlert();
 orderAlarmInterval=setInterval(()=>{
  if(!unprocessedNewOrders.size){stopOrderAlarm();return;}
  playOrderAlert();
 },1100);
 // Alarm otomatis berhenti setelah maksimal 1 menit.
 orderAlarmTimeout=setTimeout(stopOrderAlarm,60000);
}
$("enable-order-sound").addEventListener("click",async()=>{
 const button=$("enable-order-sound");
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)throw new Error("Browser ini tidak mendukung audio.");
  if(!orderAudioContext)orderAudioContext=new AudioContextClass();
  if(orderAudioContext.state==="suspended")await orderAudioContext.resume();
  orderSoundEnabled=!orderSoundEnabled;
  button.textContent=orderSoundEnabled?"Suara pesanan: AKTIF":"Aktifkan suara pesanan";
  button.setAttribute("aria-pressed",String(orderSoundEnabled));
  if(orderSoundEnabled){
   // Bunyi singkat untuk memastikan speaker dan izin audio aktif.
   const hadPending=unprocessedNewOrders.size>0;
   if(hadPending)startOrderAlarm();
   else{
    const now=orderAudioContext.currentTime;
    const oscillator=orderAudioContext.createOscillator();
    const gain=orderAudioContext.createGain();
    oscillator.type="sine";oscillator.frequency.value=1046;
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.5,now+0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.45);
    oscillator.connect(gain);gain.connect(orderAudioContext.destination);
    oscillator.start(now);oscillator.stop(now+0.46);
   }
  }else stopOrderAlarm();
 }catch(err){
  orderSoundEnabled=false;stopOrderAlarm();
  button.textContent="Aktifkan suara pesanan";
  button.setAttribute("aria-pressed","false");
  toast(err.message||"Tidak dapat mengaktifkan suara.");
 }
});

const dateOf=o=>{const v=o.createdAt?.toDate?o.createdAt.toDate():(o.createdAtClient?new Date(o.createdAtClient):null);return v&&!isNaN(v)?v:null;};
const lines=o=>[...(o.items||[]),...(o.customItems||[])];
const subtotal=o=>Number.isFinite(Number(o.revenue))&&o.revenue!==null?Number(o.revenue):lines(o).reduce((s,x)=>s+Number(x.price||0)*Number(x.quantity||0),Number(o.subtotal)||0);
const total=o=>Number.isFinite(Number(o.total))&&o.total!==null?Number(o.total):subtotal(o)+(Number(o.shippingFee)||0);
const statusLabel=s=>({new:"Baru",accepted:"Diterima",preparing:"Disiapkan",shipping:"Dikirim",completed:"Selesai",cancelled:"Dibatalkan"}[s]||s||"Baru");
function setTab(id){document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));document.querySelectorAll(".admin-tab-panel").forEach(p=>p.hidden=p.id!==id);}
document.querySelectorAll(".admin-tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
function renderProducts(){
 $("total-products").textContent=currentProducts.filter(p=>p.active!==false).length;$("list-count").textContent=`${currentProducts.length} PRODUK`;
 $("admin-product-list").innerHTML=currentProducts.length?currentProducts.map(p=>`<tr><td><div class="admin-product-cell"><img src="${esc(p.image||"")}" alt="" onerror="this.style.opacity='.15'"><div><strong>${esc(p.name)}</strong><small>${esc(p.category||"")} · ${esc(p.unit||"")}</small></div></div></td><td>${rupiah(p.price)}</td><td><span class="status-pill ${p.active===false?"off":""}">${p.active===false?"Nonaktif":"Aktif"}</span></td><td><div class="table-actions"><button data-edit="${esc(p.id)}">Edit</button><button class="delete" data-delete-product="${esc(p.id)}">Hapus</button></div></td></tr>`).join(""):`<tr><td colspan="4" class="admin-empty">Belum ada produk.</td></tr>`;
}
function clearPreview(){const img=$("image-preview");img.hidden=true;img.removeAttribute("src");img.onerror=null;$("image-preview-empty").hidden=false;$("image-preview-empty").textContent="Pratinjau foto akan tampil di sini";}
function previewImage(){const img=$("image-preview"),url=$("product-image").value.trim();if(!url){clearPreview();return;}img.onerror=()=>{img.hidden=true;$("image-preview-empty").hidden=false;$("image-preview-empty").textContent="URL foto tidak dapat dibuka";};img.onload=()=>{img.hidden=false;$("image-preview-empty").hidden=true;};img.src=url;}
function resetProductForm(){$("product-form").reset();$("product-id").value="";$("product-active").checked=true;clearPreview();$("form-title").textContent="Tambah Produk";$("form-mode").textContent="PRODUK BARU";$("save-product").textContent="Simpan Produk";$("cancel-edit").hidden=true;msg("form-message","");}
$("product-image").addEventListener("input",previewImage);
$("cancel-edit").addEventListener("click",resetProductForm);
$("admin-product-list").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete-product]");if(edit){const p=currentProducts.find(x=>x.id===edit.dataset.edit);if(!p)return;$("product-id").value=p.id;$("product-name").value=p.name||"";$("product-category").value=p.category||"Sayuran";$("product-unit").value=p.unit||"";$("product-price").value=Number(p.price)||0;$("product-image").value=p.image||"";$("product-description").value=p.description||"";$("product-active").checked=p.active!==false;$("form-title").textContent="Edit Produk";$("form-mode").textContent="UBAH DATA";$("save-product").textContent="Simpan Perubahan";$("cancel-edit").hidden=false;previewImage();$("product-form").scrollIntoView({behavior:"smooth"});}if(del){const p=currentProducts.find(x=>x.id===del.dataset.deleteProduct);if(!p||!confirm(`Hapus produk "${p.name}"? Riwayat transaksi lama tetap tersimpan.`))return;try{await deleteDoc(doc(db,"product",p.id));toast("Produk dihapus.");}catch(err){toast(`Gagal menghapus: ${err.message}`);}}});
$("product-form").addEventListener("submit",async e=>{e.preventDefault();const b=$("save-product");b.disabled=true;try{const id=$("product-id").value;const image=$("product-image").value.trim();const data={name:$("product-name").value.trim(),category:$("product-category").value,unit:$("product-unit").value.trim(),price:Number($("product-price").value),image,description:$("product-description").value.trim(),active:$("product-active").checked,updatedAt:serverTimestamp()};if(!data.name||!data.unit||!image||!Number.isFinite(data.price)||data.price<0)throw new Error("Lengkapi nama, satuan, foto, dan harga jual dengan benar.");if(id)await updateDoc(doc(db,"product",id),data);else await addDoc(productsRef,{...data,createdAt:serverTimestamp()});resetProductForm();toast(id?"Produk diperbarui.":"Produk ditambahkan.");}catch(err){msg("form-message",`Gagal menyimpan: ${err.message}`,"error");}finally{b.disabled=false;}});
function renderOrders(){const active=allOrders.filter(o=>!['completed','cancelled'].includes(o.status));$("pending-orders").textContent=active.length;const today=new Date();today.setHours(0,0,0,0);$("today-orders").textContent=allOrders.filter(o=>dateOf(o)>=today).length;$("orders-list").innerHTML=active.length?active.map(o=>`<tr><td><strong>${esc(o.id.slice(0,8))}</strong><small>${lines(o).map(x=>`${esc(x.name)} × ${Number(x.quantity)||0}`).join("<br>")||"-"}</small></td><td>${esc(o.customer?.name||"-")}<small>${esc(o.customer?.phone||"")}</small></td><td>${rupiah(total(o))}</td><td>${esc(o.payment||"-")}</td><td><select data-order-status="${esc(o.id)}" aria-label="Status pesanan">${["new","accepted","preparing","shipping","completed","cancelled"].map(s=>`<option value="${s}" ${o.status===s?"selected":""}>${statusLabel(s)}</option>`).join("")}</select></td><td><div class="table-actions"><button data-order-detail="${esc(o.id)}">Detail</button></div></td></tr>`).join(""):`<tr><td colspan="6" class="admin-empty">Tidak ada pesanan aktif.</td></tr>`;renderHistory();renderRecap();}
function renderHistory(){const q=$("history-search").value.toLowerCase(),st=$("history-status").value;const arr=allOrders.filter(o=>["completed","cancelled"].includes(o.status)&&(!st||o.status===st)&&(`${o.id} ${o.customer?.name||""} ${o.customer?.phone||""}`).toLowerCase().includes(q));$("history-list").innerHTML=arr.length?arr.map(o=>`<tr><td>${esc(o.id.slice(0,8))}</td><td>${esc(o.customer?.name||"-")}</td><td>${dateOf(o)?.toLocaleString("id-ID")||"-"}</td><td>${rupiah(total(o))}</td><td>${statusLabel(o.status)}</td><td><div class="table-actions"><button data-order-detail="${esc(o.id)}">Detail</button><button class="delete" data-delete-order="${esc(o.id)}">Hapus</button></div></td></tr>`).join(""):`<tr><td colspan="6" class="admin-empty">Riwayat pesanan belum ada.</td></tr>`;}
$("history-search").addEventListener("input",renderHistory);$("history-status").addEventListener("change",renderHistory);
async function setOrderStatus(id,status){await updateDoc(doc(db,"orders",id),{status,statusUpdatedAt:serverTimestamp()});}
document.addEventListener("change",async e=>{const s=e.target.closest("[data-order-status]");if(!s)return;const old=allOrders.find(o=>o.id===s.dataset.orderStatus)?.status||"new";s.disabled=true;try{await setOrderStatus(s.dataset.orderStatus,s.value);toast("Status pesanan diperbarui.");}catch(err){s.value=old;toast(`Status tidak berubah: ${err.message}`);}finally{s.disabled=false;}});
async function deleteOrder(id){const o=allOrders.find(x=>x.id===id);if(!o||!confirm(`Hapus permanen riwayat pesanan ${id.slice(0,8)}? Data tidak dapat dipulihkan.`))return;try{await deleteDoc(doc(db,"orders",id));toast("Pesanan dihapus.");}catch(err){toast(`Gagal menghapus: ${err.message}`);}}
document.addEventListener("click",e=>{const d=e.target.closest("[data-order-detail]");if(d)openOrderDetail(d.dataset.orderDetail);const del=e.target.closest("[data-delete-order]");if(del)deleteOrder(del.dataset.deleteOrder);});
function openOrderDetail(id){const o=allOrders.find(x=>x.id===id);if(!o)return;const rows=lines(o).map((x,i)=>`<div class="order-edit-line"><div><strong>${esc(x.name)}</strong><small>${x.productId?"Produk katalog":"Barang khusus"} · ${Number(x.quantity)||0} ${esc(x.unit||"")}</small></div><label>Harga jual / unit<input type="number" min="0" step="1" data-line-price="${i}" value="${x.price==null?"":Number(x.price)}" placeholder="Harga"></label></div>`).join("");$("order-dialog-title").textContent=`Pesanan ${id.slice(0,8)}`;$("order-dialog-body").innerHTML=`<div class="order-customer-box"><strong>${esc(o.customer?.name||"-")}</strong><p>${esc(o.customer?.phone||"-")}<br>${esc(o.customer?.address||"-")}</p><small>Pembayaran: ${esc(o.payment||"-")} · Status: ${statusLabel(o.status)}</small></div><h3>Rincian item</h3>${rows||"<p>Tidak ada item.</p>"}<div class="admin-two order-money-fields"><div><label>Ongkos kirim (Rp)<input id="detail-shipping" type="number" min="0" value="${Number(o.shippingFee)||0}"></label></div></div><label>Catatan admin<input id="detail-admin-note" maxlength="300" value="${esc(o.adminNote||"")}"></label><div class="order-total-preview"><span>Subtotal item</span><strong id="detail-subtotal">${rupiah(subtotal(o))}</strong></div><div class="order-total-preview"><span>Total pesanan</span><strong id="detail-total">${rupiah(total(o))}</strong></div><div class="dialog-actions"><button type="button" class="admin-primary" id="save-order-detail">Simpan rincian</button><button type="button" class="admin-secondary" id="print-order">Cetak nota</button></div><div id="detail-message" class="admin-message"></div>`;
const calc=()=>{let sum=0;lines(o).forEach((it,i)=>{const el=document.querySelector(`[data-line-price="${i}"]`);sum+=(el&&el.value!==""?Number(el.value):Number(it.price)||0)*(Number(it.quantity)||0);});$("detail-subtotal").textContent=rupiah(sum);$("detail-total").textContent=rupiah(sum+Number($("detail-shipping").value||0));};$("order-dialog-body").querySelectorAll("input").forEach(el=>el.addEventListener("input",calc));
$("save-order-detail").addEventListener("click",async()=>{const b=$("save-order-detail");b.disabled=true;try{let index=0;const updated={items:(o.items||[]).map(it=>{const v=document.querySelector(`[data-line-price="${index++}"]`).value;return {...it,price:v===""?null:Number(v)};}),customItems:(o.customItems||[]).map(it=>{const v=document.querySelector(`[data-line-price="${index++}"]`).value;return {...it,price:v===""?null:Number(v)};})};const rev=[...updated.items,...updated.customItems].reduce((s,it)=>s+(Number(it.price)||0)*(Number(it.quantity)||0),0),shipping=Number($("detail-shipping").value)||0;if([...updated.items,...updated.customItems].some(it=>it.price!==null&&(!Number.isFinite(it.price)||it.price<0))||shipping<0)throw new Error("Harga dan ongkir tidak boleh negatif.");await updateDoc(doc(db,"orders",id),{...updated,revenue:rev,subtotal:rev,shippingFee:shipping,total:rev+shipping,adminNote:$("detail-admin-note").value.trim(),updatedAt:serverTimestamp()});msg("detail-message","Rincian pesanan berhasil disimpan.","success");toast("Rincian pesanan diperbarui.");}catch(err){msg("detail-message",`Gagal menyimpan: ${err.message}`,"error");}finally{b.disabled=false;}});$("print-order").addEventListener("click",()=>printInvoice(o,id));$("order-dialog").showModal();}
function printInvoice(o,id){const updated=allOrders.find(x=>x.id===id)||o;const rows=lines(updated).map(i=>`<tr><td>${esc(i.name)}</td><td>${Number(i.quantity)||0}</td><td>${rupiah(i.price)}</td><td>${rupiah(Number(i.price||0)*Number(i.quantity||0))}</td></tr>`).join("");const w=window.open("","_blank","width=760,height=800");if(!w){toast("Izinkan pop-up untuk mencetak nota.");return;}w.document.write(`<!doctype html><html><head><title>Nota ${esc(id)}</title><style>body{font:14px Arial;padding:30px;color:#222}h1{color:#174d32}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><h1>SAYUR FRESH EFFENDI</h1><p>Nota: ${esc(id)}<br>Nama: ${esc(updated.customer?.name)}<br>WhatsApp: ${esc(updated.customer?.phone)}<br>Alamat: ${esc(updated.customer?.address)}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p>Subtotal: ${rupiah(subtotal(updated))}<br>Ongkir: ${rupiah(Number(updated.shippingFee)||0)}<br><strong>Total: ${rupiah(total(updated))}</strong></p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();}
function rangeStart(){const now=new Date(),d=new Date(now);d.setHours(0,0,0,0);const r=$("recap-range").value;if(r==="today")return d;if(r==="yesterday"){d.setDate(d.getDate()-1);return d;}if(r==="7"){d.setDate(d.getDate()-6);return d;}if(r==="30"){d.setDate(d.getDate()-29);return d;}if(r==="month")return new Date(now.getFullYear(),now.getMonth(),1);return null;}
function recapOrders(){const start=rangeStart(),end=new Date();end.setHours(23,59,59,999);return allOrders.filter(o=>{const d=dateOf(o);return d&&(!start||d>=start)&&d<=end;});}
function renderRecap(){const arr=recapOrders(),completed=arr.filter(o=>o.status==="completed"),active=arr.filter(o=>!["completed","cancelled"].includes(o.status));$("recap-count").textContent=arr.length;$("recap-completed").textContent=completed.length;$("recap-active").textContent=active.length;$("recap-total").textContent=rupiah(arr.reduce((s,o)=>s+total(o),0));$("recap-period-label").textContent=$("recap-range").selectedOptions[0].text.toUpperCase();$("recap-list").innerHTML=arr.length?arr.map(o=>`<tr><td>${dateOf(o)?.toLocaleString("id-ID")||"-"}</td><td>${esc(o.id.slice(0,8))}</td><td>${esc(o.customer?.name||"-")}</td><td>${lines(o).reduce((s,x)=>s+(Number(x.quantity)||0),0)}</td><td>${rupiah(total(o))}</td><td>${statusLabel(o.status)}</td><td><button data-order-detail="${esc(o.id)}">Detail</button></td></tr>`).join(""):`<tr><td colspan="7" class="admin-empty">Belum ada pesanan pada periode ini.</td></tr>`;}
$("recap-range").addEventListener("change",renderRecap);$("export-recap").addEventListener("click",()=>{const rows=[["Tanggal","ID Pesanan","Pelanggan","WhatsApp","Jumlah Item","Subtotal","Ongkir","Total Pesanan","Pembayaran","Status"]];recapOrders().forEach(o=>rows.push([dateOf(o)?.toLocaleString("id-ID")||"",o.id,o.customer?.name||"",o.customer?.phone||"",lines(o).reduce((s,x)=>s+(Number(x.quantity)||0),0),subtotal(o),Number(o.shippingFee)||0,total(o),o.payment||"",statusLabel(o.status)]));const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`rekap-pesanan-sayur-fresh-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);});
$("login-form").addEventListener("submit",async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;msg("login-message","Sedang masuk...");try{await signInWithEmailAndPassword(auth,$("admin-email").value.trim(),$("admin-password").value);$("admin-password").value="";}catch(err){msg("login-message",`Login gagal: ${err.message}`,"error");}finally{b.disabled=false;}});$("logout-button").addEventListener("click",()=>signOut(auth));
function startListeners(){
 unsubscribers.forEach(fn=>fn());unsubscribers=[];firstOrderSnapshot=true;unprocessedNewOrders.clear();stopOrderAlarm();
 unsubscribers.push(onSnapshot(productsRef,s=>{
  currentProducts=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"id"));
  renderProducts();
 }));
 unsubscribers.push(onSnapshot(ordersRef,s=>{
  if(firstOrderSnapshot){firstOrderSnapshot=false;}
  else{
   s.docChanges().forEach(change=>{
    const order=change.doc.data();
    if(change.type==="added"&&order.status==="new"){
     unprocessedNewOrders.add(change.doc.id);
     toast("Pesanan baru masuk!");
     startOrderAlarm();
    }else if(change.type==="modified"&&order.status!=="new"){
     unprocessedNewOrders.delete(change.doc.id);
     if(!unprocessedNewOrders.size)stopOrderAlarm();
    }else if(change.type==="removed"){
     unprocessedNewOrders.delete(change.doc.id);
     if(!unprocessedNewOrders.size)stopOrderAlarm();
    }
   });
  }
  allOrders=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b)?.getTime()||0)-(dateOf(a)?.getTime()||0));
  renderOrders();
 }));
}
onAuthStateChanged(auth,user=>{if(user){$("login-panel").hidden=true;$("dashboard-panel").hidden=false;$("logout-button").hidden=false;startListeners();}else{unsubscribers.forEach(fn=>fn());unsubscribers=[];$("login-panel").hidden=false;$("dashboard-panel").hidden=true;$("logout-button").hidden=true;}});resetProductForm();
