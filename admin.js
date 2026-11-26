// SAYUR FRESH EFFENDI — ADMIN DASHBOARD ULTIMATE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs,
  getDoc, serverTimestamp, runTransaction, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyD6fyP1mdM5xdL1euUcfTLZyFEzvcZGxY0",
  authDomain:"sayurfresh-8ceb8.firebaseapp.com",
  projectId:"sayurfresh-8ceb8",
  storageBucket:"sayurfresh-8ceb8.firebasestorage.app",
  messagingSenderId:"318005839589",
  appId:"1:318005839589:web:9001d01a61b3f84fcf760c",
  measurementId:"G-MEPJ8ZBJNQ"
};
const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const productsRef=collection(db,"product"), ordersRef=collection(db,"orders"), expensesRef=collection(db,"expenses"), stockMovementsRef=collection(db,"stockMovements");
const $=id=>document.getElementById(id);
let currentProducts=[], allOrders=[], allExpenses=[], allStockMovements=[], storeSettings={};
let unsubscribers=[];
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast=m=>{const e=$("admin-toast");e.textContent=m;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove("show"),2800);};
const msg=(id,text,type="")=>{const e=$(id);e.textContent=text;e.className=`admin-message ${type}`;};
const dateOf=o=>{const v=o.createdAt?.toDate?o.createdAt.toDate():(o.createdAtClient?new Date(o.createdAtClient):null);return v&&!isNaN(v)?v:null;};
const dayStart=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
const sumItems=items=>(items||[]).reduce((s,i)=>s+Number(i.price||0)*Number(i.quantity||0),0);
const allOrderLines=o=>[...(o.items||[]),...(o.customItems||[])];
const orderHasUnpriced=o=>allOrderLines(o).some(i=>i.price===null||i.price===undefined||!Number.isFinite(Number(i.price)));
const orderRevenue=o=>Number.isFinite(Number(o.revenue))&&o.revenue!==null?Number(o.revenue):sumItems(o.items)+sumItems(o.customItems);
const orderShipping=o=>Number(o.shippingFee||0);
const orderTotal=o=>orderHasUnpriced(o)?null:(Number.isFinite(Number(o.total))&&o.total!==null?Number(o.total):orderRevenue(o)+orderShipping(o));
const orderCogs=o=>{
  const all=allOrderLines(o);let sum=0,missing=0;
  for(const i of all){if(i.costPrice===null||i.costPrice===undefined||!Number.isFinite(Number(i.costPrice)))missing++;else sum+=Number(i.costPrice)*Number(i.quantity||0);}
  return {sum,missing};
};
const isDone=o=>o.status==="completed";
function setTab(id){
  document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
  document.querySelectorAll(".admin-tab-panel").forEach(p=>p.hidden=p.id!==id);
}
document.querySelectorAll(".admin-tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));

function renderProducts(){
  $("total-products").textContent=currentProducts.filter(p=>p.active!==false).length;
  $("low-stock").textContent=currentProducts.filter(p=>p.active!==false&&Number(p.stock)<=5).length;
  $("list-count").textContent=`${currentProducts.length} PRODUK`;
  $("admin-product-list").innerHTML=currentProducts.length?currentProducts.map(p=>`<tr>
    <td><div class="admin-product-cell"><img src="${escapeHTML(p.image)}" alt="" onerror="this.style.opacity='.15'"><div><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.category)} · ${escapeHTML(p.unit)}</small></div></div></td>
    <td>${rupiah(p.price)}</td><td>${rupiah(p.costPrice)}</td><td>${Number(p.stock)||0}</td>
    <td><span class="status-pill ${p.active===false?"off":""}">${p.active===false?"Nonaktif":"Aktif"}</span></td>
    <td><div class="table-actions"><button data-edit="${escapeHTML(p.id)}">Edit</button><button class="delete" data-delete-product="${escapeHTML(p.id)}">Hapus</button></div></td></tr>`).join(""):`<tr><td colspan="6" class="admin-empty">Belum ada produk.</td></tr>`;
  $("stock-product").innerHTML=currentProducts.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (stok ${Number(p.stock)||0})</option>`).join("");
  $("stock-list").innerHTML=currentProducts.map(p=>`<tr><td>${escapeHTML(p.name)}</td><td>${Number(p.stock)||0} ${escapeHTML(p.unit||"")}</td><td>${rupiah(p.costPrice)}</td><td><span class="status-pill ${Number(p.stock)<=5?"off":""}">${Number(p.stock)<=0?"Habis":Number(p.stock)<=5?"Menipis":"Aman"}</span></td></tr>`).join("")||`<tr><td colspan="4" class="admin-empty">Belum ada produk.</td></tr>`;
}
function resetProductForm(){
  $("product-form").reset();$("product-id").value="";$("product-active").checked=true;
  $("form-title").textContent="Tambah Produk";$("form-mode").textContent="PRODUK BARU";$("save-product").textContent="Simpan Produk";
  $("cancel-edit").hidden=true;$("image-preview").hidden=true;$("image-preview").removeAttribute("src");$("image-preview-empty").hidden=false;msg("form-message","");
}
function previewImage(){
  const url=$("product-image").value.trim(),img=$("image-preview");
  if(!url){img.hidden=true;img.removeAttribute("src");$("image-preview-empty").hidden=false;return;}
  img.src=url;img.hidden=false;$("image-preview-empty").hidden=true;
  img.onerror=()=>{img.hidden=true;$("image-preview-empty").hidden=false;$("image-preview-empty").textContent="URL foto tidak dapat dibuka";};
}
$("product-image").addEventListener("input",previewImage);
$("cancel-edit").addEventListener("click",resetProductForm);
$("admin-product-list").addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete-product]");
  if(edit){const p=currentProducts.find(x=>x.id===edit.dataset.edit);if(!p)return;
    $("product-id").value=p.id;$("product-name").value=p.name||"";$("product-category").value=p.category||"Sayuran";
    $("product-unit").value=p.unit||"";$("product-price").value=Number(p.price)||0;$("product-cost").value=Number(p.costPrice)||0;
    $("product-stock").value=Number(p.stock)||0;$("product-image").value=p.image||"";$("product-description").value=p.description||"";
    $("product-active").checked=p.active!==false;$("form-title").textContent="Edit Produk";$("form-mode").textContent="UBAH DATA";
    $("save-product").textContent="Simpan Perubahan";$("cancel-edit").hidden=false;previewImage();$("product-form").scrollIntoView({behavior:"smooth"});
  }
  if(del){const p=currentProducts.find(x=>x.id===del.dataset.deleteProduct);if(!p||!confirm(`Hapus produk "${p.name}"? Riwayat transaksi lama tetap tersimpan.`))return;
    try{await deleteDoc(doc(db,"product",p.id));toast("Produk dihapus.");}catch(err){toast(`Gagal menghapus: ${err.message}`);}
  }
});
$("product-form").addEventListener("submit",async e=>{
  e.preventDefault();const b=$("save-product");b.disabled=true;
  const data={name:$("product-name").value.trim(),category:$("product-category").value,unit:$("product-unit").value.trim(),
    price:Number($("product-price").value),costPrice:Number($("product-cost").value),stock:Number($("product-stock").value),
    image:$("product-image").value.trim(),description:$("product-description").value.trim(),active:$("product-active").checked,updatedAt:serverTimestamp()};
  if(!data.name||!data.unit||!data.image||!Number.isFinite(data.price)||data.price<0||!Number.isFinite(data.costPrice)||data.costPrice<0||!Number.isInteger(data.stock)||data.stock<0){
    msg("form-message","Periksa nama, satuan, URL foto, harga, modal, dan stok.","error");b.disabled=false;return;
  }
  try{const id=$("product-id").value;if(id)await updateDoc(doc(db,"product",id),data);else await addDoc(productsRef,{...data,createdAt:serverTimestamp()});
    resetProductForm();toast(id?"Produk diperbarui.":"Produk ditambahkan.");
  }catch(err){msg("form-message",`Gagal menyimpan: ${err.message}`,"error");}finally{b.disabled=false;}
});
const sampleProducts=[
  ["Bayam",4000,2500,"ikat","Sayuran",20,"https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80"],
  ["Wortel",15000,10000,"kg","Sayuran",20,"https://images.unsplash.com/photo-1445282768818-728615cc910a?w=600&q=80"],
  ["Tomat",12000,8000,"kg","Sayuran",15,"https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=600&q=80"],
  ["Brokoli",18000,12000,"kg","Sayuran",10,"https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80"],
  ["Apel",25000,18000,"kg","Buah",12,"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&q=80"],
  ["Jeruk",18000,12000,"kg","Buah",15,"https://images.unsplash.com/photo-1547514701-42782101795e?w=600&q=80"],
  ["Bawang Putih",35000,28000,"kg","Bumbu",10,"https://food.fnr.sndimg.com/content/dam/images/food/fullset/2021/05/25/head-of-garlic-and-garlic-cloves.jpg.rend.hgtvcom.1280.960.suffix/1621974634336.jpeg"],
  ["Kentang",18000,12000,"kg","Lainnya",20,"https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80"]
];
$("import-samples").addEventListener("click",async()=>{
  if(!confirm("Masukkan 8 produk contoh? Produk bernama sama akan diperbarui."))return;
  const b=$("import-samples");b.disabled=true;
  try{const snap=await getDocs(productsRef),map=new Map(snap.docs.map(d=>[String(d.data().name||"").toLowerCase(),d.id]));
    for(const [name,price,costPrice,unit,category,stock,image] of sampleProducts){
      const payload={name,price,costPrice,unit,category,stock,image,description:`${name} segar pilihan.`,active:true,updatedAt:serverTimestamp()};
      const id=map.get(name.toLowerCase());if(id)await updateDoc(doc(db,"product",id),payload);else await addDoc(productsRef,{...payload,createdAt:serverTimestamp()});
    }toast("Produk contoh berhasil diimpor.");
  }catch(err){toast(`Impor gagal: ${err.message}`);}finally{b.disabled=false;}
});

// Orders and detail editing
function statusLabel(s){return ({new:"Baru",accepted:"Diterima",preparing:"Disiapkan",shipping:"Dikirim",completed:"Selesai",cancelled:"Dibatalkan"})[s]||s||"Baru";}
function orderSummary(o){return [...(o.items||[]),...(o.customItems||[])].map(i=>`${i.name} × ${i.quantity}`).join(", ")||"Tidak ada rincian";}
function renderOrderRows(){
  const active=allOrders.filter(o=>!["completed","cancelled"].includes(o.status));
  $("pending-orders").textContent=active.length;
  $("orders-list").innerHTML=active.length?active.map(o=>`<tr>
    <td><strong>${escapeHTML(o.id.slice(0,8))}</strong><small class="order-detail">${escapeHTML(orderSummary(o))}</small></td>
    <td>${escapeHTML(o.customer?.name||"-")}<small class="order-detail">${escapeHTML(o.customer?.phone||"")}</small></td>
    <td>${orderTotal(o)===null?"Menunggu harga":rupiah(orderTotal(o))}${orderTotal(o)===null?'<small class="order-detail">Lengkapi harga barang khusus</small>':""}</td>
    <td>${escapeHTML(o.payment||"-")}</td><td><span class="status-pill">${escapeHTML(statusLabel(o.status))}</span></td>
    <td><div class="order-actions"><button data-order-detail="${escapeHTML(o.id)}">Detail</button><select data-order-status="${escapeHTML(o.id)}" aria-label="Status pesanan">${["new","accepted","preparing","shipping","completed","cancelled"].map(s=>`<option value="${s}" ${o.status===s?"selected":""}>${statusLabel(s)}</option>`).join("")}</select></div></td></tr>`).join(""):`<tr><td colspan="6" class="admin-empty">Belum ada pesanan aktif.</td></tr>`;
  renderHistory();
}
function renderHistory(){
  const term=($("history-search").value||"").toLowerCase(),status=$("history-status").value;
  const history=allOrders.filter(o=>["completed","cancelled"].includes(o.status))
    .filter(o=>(!status||o.status===status)&&(`${o.id} ${o.customer?.name||""} ${o.customer?.phone||""}`).toLowerCase().includes(term));
  $("history-list").innerHTML=history.length?history.map(o=>`<tr>
    <td>${escapeHTML(o.id.slice(0,8))}</td><td>${escapeHTML(o.customer?.name||"-")}</td>
    <td>${dateOf(o)?.toLocaleString("id-ID")||"-"}</td><td>${orderTotal(o)===null?"Belum lengkap":rupiah(orderTotal(o))}</td><td>${escapeHTML(statusLabel(o.status))}</td>
    <td><div class="table-actions"><button data-order-detail="${escapeHTML(o.id)}">Detail</button><button class="delete" data-delete-order="${escapeHTML(o.id)}">Hapus</button></div></td></tr>`).join(""):`<tr><td colspan="6" class="admin-empty">Belum ada riwayat sesuai pencarian.</td></tr>`;
}
$("history-search").addEventListener("input",renderHistory);$("history-status").addEventListener("change",renderHistory);
async function setOrderStatus(orderId,newStatus){
  await runTransaction(db,async tx=>{
    const orderRef=doc(db,"orders",orderId),orderSnap=await tx.get(orderRef);
    if(!orderSnap.exists())throw new Error("Pesanan tidak ditemukan.");
    const order=orderSnap.data(),wasDeducted=order.stockDeducted===true;
    if(newStatus==="completed" && allOrderLines(order).some(i=>i.price===null||i.price===undefined||i.costPrice===null||i.costPrice===undefined))
      throw new Error("Lengkapi harga jual dan harga modal semua item melalui tombol Detail sebelum menyelesaikan pesanan.");
    const shouldDeduct=["accepted","preparing","shipping","completed"].includes(newStatus);
    const shouldRestore=newStatus==="cancelled"&&wasDeducted;
    if((shouldDeduct&&!wasDeducted)||shouldRestore){
      const items=order.items||[],productSnaps=[];
      for(const item of items){if(!item.productId)continue;const pr=doc(db,"product",String(item.productId));productSnaps.push({item,ref:pr,snap:await tx.get(pr)});}
      for(const x of productSnaps){
        if(!x.snap.exists())throw new Error(`Produk ${x.item.name} tidak ditemukan; stok tidak dapat diperbarui.`);
        const current=Number(x.snap.data().stock)||0,qty=Number(x.item.quantity)||0;
        if(shouldDeduct&&current<qty)throw new Error(`Stok ${x.item.name} tidak cukup. Tersedia ${current}.`);
        const next=current+(shouldRestore?qty:-qty);
        tx.update(x.ref,{stock:next,updatedAt:serverTimestamp()});
        const movementRef=doc(collection(db,"stockMovements"));
        tx.set(movementRef,{productId:x.ref.id,productName:x.snap.data().name,kind:shouldRestore?"order_return":"order_out",quantity:qty,oldStock:current,newStock:next,note:`Pesanan ${orderId.slice(0,8)}`,createdAt:serverTimestamp(),createdAtClient:new Date().toISOString()});
      }
      tx.update(orderRef,{status:newStatus,stockDeducted:shouldRestore?false:true,statusUpdatedAt:serverTimestamp()});
    }else tx.update(orderRef,{status:newStatus,statusUpdatedAt:serverTimestamp()});
  });
}
document.addEventListener("change",async e=>{
  const select=e.target.closest("[data-order-status]");if(!select)return;
  const old=allOrders.find(o=>o.id===select.dataset.orderStatus)?.status||"new";
  select.disabled=true;
  try{await setOrderStatus(select.dataset.orderStatus,select.value);toast("Status pesanan diperbarui.");}
  catch(err){select.value=old;toast(`Status tidak berubah: ${err.message}`);}
  finally{select.disabled=false;}
});
async function deleteOrder(id){
  const o=allOrders.find(x=>x.id===id);if(!o||!confirm(`Hapus permanen riwayat pesanan ${id.slice(0,8)}? Data ini tidak dapat dipulihkan.`))return;
  try{await deleteDoc(doc(db,"orders",id));toast("Riwayat pesanan dihapus.");}catch(err){toast(`Gagal menghapus: ${err.message}`);}
}
document.addEventListener("click",e=>{
  const detail=e.target.closest("[data-order-detail]");if(detail)openOrderDetail(detail.dataset.orderDetail);
  const del=e.target.closest("[data-delete-order]");if(del)deleteOrder(del.dataset.deleteOrder);
});
function openOrderDetail(id){
  const o=allOrders.find(x=>x.id===id);if(!o)return;
  const items=(o.items||[]).map((x,i)=>({...x,_kind:"items",_index:i}));
  const custom=(o.customItems||[]).map((x,i)=>({...x,_kind:"customItems",_index:i}));
  const rows=[...items,...custom].map(x=>`<div class="order-edit-line">
    <div><strong>${escapeHTML(x.name)}</strong><small>${x._kind==="items"?"Produk katalog":"Barang khusus"} · ${Number(x.quantity)||0} ${escapeHTML(x.unit||"")}</small></div>
    <label>Harga jual / unit<input type="number" min="0" step="1" data-line-price="${x._kind}:${x._index}" value="${x.price==null?"":Number(x.price)}" placeholder="Harga"></label>
    <label>Modal / unit<input type="number" min="0" step="1" data-line-cost="${x._kind}:${x._index}" value="${x.costPrice==null?"":Number(x.costPrice)}" placeholder="Modal"></label>
  </div>`).join("");
  $("order-dialog-title").textContent=`Pesanan ${id.slice(0,8)}`;
  $("order-dialog-body").innerHTML=`
    <div class="order-customer-box"><strong>${escapeHTML(o.customer?.name||"-")}</strong><p>${escapeHTML(o.customer?.phone||"-")}<br>${escapeHTML(o.customer?.address||"-")}</p><small>Metode pembayaran: ${escapeHTML(o.payment||"-")} · Status: ${escapeHTML(statusLabel(o.status))}</small></div>
    <h3>Rincian item</h3>${rows||'<p>Pesanan tidak memiliki item katalog atau khusus.</p>'}
    <div class="admin-two order-money-fields"><div><label>Ongkos kirim (Rp)<input id="detail-shipping" type="number" min="0" value="${Number(o.shippingFee)||0}"></label></div><div><label>Biaya tambahan pesanan (Rp)<input id="detail-extra" type="number" min="0" value="${Number(o.operationalExpense)||0}"></label></div></div>
    <label>Catatan admin<input id="detail-admin-note" maxlength="300" value="${escapeHTML(o.adminNote||"")}"></label>
    <div class="order-total-preview"><span>Subtotal item</span><strong id="detail-subtotal">${rupiah(orderRevenue(o))}</strong></div>
    <div class="order-total-preview"><span>Total tagihan (item + ongkir)</span><strong id="detail-total">${rupiah(orderTotal(o))}</strong></div>
    <p class="admin-hint">Isi harga barang khusus sebelum pesanan diselesaikan. Harga modal diperlukan agar laba dapat dihitung. Ongkir dipisahkan dari omzet produk.</p>
    <div class="dialog-actions"><button type="button" class="admin-primary" id="save-order-detail">Simpan rincian pesanan</button><button type="button" class="admin-secondary" id="print-order">Cetak nota</button></div>
    <div id="detail-message" class="admin-message"></div>`;
  const calc=()=>{
    let revenue=0;for(const k of ["items","customItems"]){(o[k]||[]).forEach((it,i)=>{const el=document.querySelector(`[data-line-price="${k}:${i}"]`);const p=el&&el.value!==""?Number(el.value):Number(it.price)||0;revenue+=p*(Number(it.quantity)||0);});}
    $("detail-subtotal").textContent=rupiah(revenue);$("detail-total").textContent=rupiah(revenue+Number($("detail-shipping").value||0));
  };
  $("order-dialog-body").querySelectorAll("input").forEach(el=>el.addEventListener("input",calc));
  $("save-order-detail").addEventListener("click",async()=>{
    const btn=$("save-order-detail");btn.disabled=true;
    try{
      const updated={};
      for(const k of ["items","customItems"]){
        updated[k]=(o[k]||[]).map((it,i)=>{
          const p=document.querySelector(`[data-line-price="${k}:${i}"]`).value;
          const c=document.querySelector(`[data-line-cost="${k}:${i}"]`).value;
          return {...it,price:p===""?null:Number(p),costPrice:c===""?null:Number(c)};
        });
      }
      const revenue=sumItems(updated.items)+sumItems(updated.customItems),shipping=Number($("detail-shipping").value)||0,extra=Number($("detail-extra").value)||0;
      if([...updated.items,...updated.customItems].some(i=>(i.price!==null&&(!Number.isFinite(i.price)||i.price<0))||(i.costPrice!==null&&(!Number.isFinite(i.costPrice)||i.costPrice<0)))||shipping<0||extra<0)throw new Error("Harga dan biaya tidak boleh negatif.");
      await updateDoc(doc(db,"orders",id),{...updated,revenue,subtotal:revenue,shippingFee:shipping,total:revenue+shipping,operationalExpense:extra,adminNote:$("detail-admin-note").value.trim(),financialUpdatedAt:serverTimestamp()});
      msg("detail-message","Rincian pesanan berhasil disimpan.","success");toast("Rincian dan total pesanan diperbarui.");
    }catch(err){msg("detail-message",`Gagal menyimpan: ${err.message}`,"error");}finally{btn.disabled=false;}
  });
  $("print-order").addEventListener("click",()=>printInvoice(o,id));
  $("order-dialog").showModal();
}
function printInvoice(o,id){
  const updated=allOrders.find(x=>x.id===id)||o;
  const rows=[...(updated.items||[]),...(updated.customItems||[])].map(i=>`<tr><td>${escapeHTML(i.name)}</td><td>${i.quantity}</td><td>${rupiah(i.price)}</td><td>${rupiah(Number(i.price||0)*Number(i.quantity||0))}</td></tr>`).join("");
  const w=window.open("","_blank","width=760,height=800");if(!w){toast("Izinkan pop-up untuk mencetak nota.");return;}
  w.document.write(`<!doctype html><html><head><title>Nota ${id}</title><style>body{font:14px Arial;padding:30px;color:#222}h1{color:#174d32}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}</style></head><body><h1>SAYUR FRESH EFFENDI</h1><p>Nota pesanan: ${id}<br>Nama: ${escapeHTML(updated.customer?.name)}<br>WhatsApp: ${escapeHTML(updated.customer?.phone)}<br>Alamat: ${escapeHTML(updated.customer?.address)}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p>Subtotal: ${rupiah(orderRevenue(updated))}<br>Ongkir: ${rupiah(orderShipping(updated))}<br><strong>Total: ${rupiah(orderTotal(updated))}</strong></p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}

// Reports and costs
function rangeStart(){
  const now=new Date(),today=dayStart(now),r=$("report-range").value;
  if(r==="today")return today;if(r==="yesterday"){today.setDate(today.getDate()-1);return today;}
  if(r==="7"){today.setDate(today.getDate()-6);return today;}if(r==="30"){today.setDate(today.getDate()-29);return today;}
  if(r==="month")return new Date(now.getFullYear(),now.getMonth(),1);return null;
}
function reportOrders(){const start=rangeStart();return allOrders.filter(o=>isDone(o)&&dateOf(o)&&(!start||dateOf(o)>=start));}
function renderReports(){
  const orders=reportOrders(),start=rangeStart(),end=new Date();end.setHours(23,59,59,999);
  const expenses=allExpenses.filter(x=>{const d=x.date?.toDate?x.date.toDate():new Date(x.dateString||"");return d&&!isNaN(d)&&(!start||d>=start)&&d<=end;});
  const revenue=orders.reduce((s,o)=>s+orderRevenue(o),0),shipping=orders.reduce((s,o)=>s+orderShipping(o),0);
  let cogs=0,missing=0;orders.forEach(o=>{const c=orderCogs(o);cogs+=c.sum;missing+=c.missing;});
  const recordedExpenses=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const orderExpenses=orders.reduce((s,o)=>s+Number(o.operationalExpense||0),0);
  const expenseTotal=recordedExpenses+orderExpenses,profit=revenue-cogs-expenseTotal;
  const missingPrice=orders.reduce((n,o)=>n+allOrderLines(o).filter(i=>i.price===null||i.price===undefined).length,0);
  $("sales-revenue").textContent=rupiah(revenue);$("sales-cogs").textContent=rupiah(cogs);$("sales-expenses").textContent=rupiah(expenseTotal);
  $("sales-profit").textContent=(missing||missingPrice)?`Belum lengkap (${missing+missingPrice} data)`:rupiah(profit);$("sales-profit").classList.toggle("negative",!missing&&!missingPrice&&profit<0);
  $("sales-count").textContent=orders.length;$("sales-shipping").textContent=rupiah(shipping);
  $("report-period-label").textContent=$("report-range").selectedOptions[0].text.toUpperCase();
  $("report-note").textContent=missing||missingPrice?`${missingPrice} item belum memiliki harga jual dan ${missing} item belum memiliki harga modal. Lengkapi melalui Detail pesanan. Biaya operasional termasuk catatan biaya dan biaya tambahan pesanan.`:"Laba bersih estimasi = omzet produk/barang khusus - modal barang - biaya operasional tercatat. Ongkir dipisahkan dari omzet.";
  const productTotals={};orders.forEach(o=>(o.items||[]).forEach(i=>productTotals[i.name]=(productTotals[i.name]||0)+Number(i.quantity||0)));
  const top=Object.entries(productTotals).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("top-products").innerHTML=top.length?`<h3>Produk terlaris</h3>${top.map(([n,q])=>`<div class="top-product-row"><span>${escapeHTML(n)}</span><strong>${q} terjual</strong></div>`).join("")}`:"<p class='admin-hint'>Belum ada data produk terjual pada periode ini.</p>";
  $("overview-revenue").textContent=rupiah(orders.filter(o=>dateOf(o)&&dateOf(o)>=dayStart(new Date())).reduce((s,o)=>s+orderRevenue(o),0));
}
$("report-range").addEventListener("change",renderReports);
$("export-report").addEventListener("click",()=>{
  const orders=reportOrders(),rows=[["Tanggal","ID Pesanan","Pelanggan","Omzet Item","Ongkir","Modal","Biaya Pesanan","Status"]];
  orders.forEach(o=>{const c=orderCogs(o);rows.push([dateOf(o)?.toLocaleString("id-ID")||"",o.id,o.customer?.name||"",orderRevenue(o),orderShipping(o),c.sum,Number(o.operationalExpense||0),o.status]);});
  rows.push([]);rows.push(["Biaya operasional terpisah"]);allExpenses.forEach(x=>rows.push([x.dateString||"",x.name||"",x.category||"",Number(x.amount||0)]));
  const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`laporan-sayur-fresh-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
});

function renderStockMovements(){
  $("stock-movement-list").innerHTML=allStockMovements.length?allStockMovements.slice(0,40).map(x=>{
    const d=x.createdAt?.toDate?x.createdAt.toDate():(x.createdAtClient?new Date(x.createdAtClient):null);
    const delta=x.newStock!=null&&x.oldStock!=null?Number(x.newStock)-Number(x.oldStock):0;
    return `<tr><td>${d&&!isNaN(d)?d.toLocaleString("id-ID"):"-"}</td><td>${escapeHTML(x.productName||"-")}</td><td>${delta>0?"+":""}${delta}</td><td>${escapeHTML(x.note||x.kind||"")}</td></tr>`;
  }).join(""):`<tr><td colspan="4" class="admin-empty">Belum ada pergerakan stok.</td></tr>`;
}

// Inventory changes are committed with a transaction and logged.
$("stock-form").addEventListener("submit",async e=>{
  e.preventDefault();const id=$("stock-product").value,kind=$("stock-kind").value,qty=Number($("stock-quantity").value),note=$("stock-note").value.trim();
  if(!id||!Number.isInteger(qty)||qty<0||(kind!=="set"&&qty<1)){msg("stock-message","Masukkan produk dan jumlah yang valid.","error");return;}
  try{
    const productRef=doc(db,"product",id),logRef=doc(collection(db,"stockMovements"));
    await runTransaction(db,async tx=>{const snap=await tx.get(productRef);if(!snap.exists())throw new Error("Produk tidak ditemukan.");
      const old=Number(snap.data().stock)||0,next=kind==="in"?old+qty:kind==="out"?old-qty:qty;if(next<0)throw new Error("Stok tidak cukup.");
      tx.update(productRef,{stock:next,updatedAt:serverTimestamp()});
      tx.set(logRef,{productId:id,productName:snap.data().name,kind,quantity:qty,oldStock:old,newStock:next,note,createdAt:serverTimestamp(),createdAtClient:new Date().toISOString()});
    });
    $("stock-form").reset();msg("stock-message","Stok berhasil diperbarui.","success");toast("Stok diperbarui.");
  }catch(err){msg("stock-message",`Gagal: ${err.message}`,"error");}
});

// Separate operating expenses
$("expense-date").value=new Date().toISOString().slice(0,10);
$("expense-form").addEventListener("submit",async e=>{
  e.preventDefault();const amount=Number($("expense-amount").value),name=$("expense-name").value.trim();
  if(!name||!Number.isFinite(amount)||amount<=0){msg("expense-message","Nama dan jumlah biaya wajib valid.","error");return;}
  try{await addDoc(expensesRef,{name,amount,category:$("expense-category").value,dateString:$("expense-date").value,createdAt:serverTimestamp()});$("expense-form").reset();$("expense-date").value=new Date().toISOString().slice(0,10);msg("expense-message","Biaya berhasil dicatat.","success");}
  catch(err){msg("expense-message",`Gagal: ${err.message}`,"error");}
});
$("expense-list").addEventListener("click",async e=>{const b=e.target.closest("[data-delete-expense]");if(!b)return;if(!confirm("Hapus catatan biaya ini?"))return;try{await deleteDoc(doc(db,"expenses",b.dataset.deleteExpense));toast("Biaya dihapus.");}catch(err){toast(err.message);}});
function renderExpenses(){
  $("expense-list").innerHTML=allExpenses.length?allExpenses.map(x=>`<tr><td>${escapeHTML(x.dateString||"-")}</td><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.category)}</td><td>${rupiah(x.amount)}</td><td><button class="history-delete" data-delete-expense="${escapeHTML(x.id)}">Hapus</button></td></tr>`).join(""):`<tr><td colspan="5" class="admin-empty">Belum ada biaya dicatat.</td></tr>`;
  renderReports();
}

// Customer directory derived from orders; no extra personal data is collected.
function renderCustomers(){
  const map=new Map();
  allOrders.forEach(o=>{const c=o.customer||{},key=String(c.phone||c.name||"unknown");if(!map.has(key))map.set(key,{name:c.name||"-",phone:c.phone||"-",address:c.address||"-",count:0,total:0});const x=map.get(key);x.count++;if(o.status==="completed")x.total+=orderTotal(o);if(c.address)x.address=c.address;});
  $("customers-list").innerHTML=[...map.values()].sort((a,b)=>b.count-a.count).map(c=>`<tr><td>${escapeHTML(c.name)}</td><td>${escapeHTML(c.phone)}</td><td>${escapeHTML(c.address)}</td><td>${c.count}</td><td>${rupiah(c.total)}</td></tr>`).join("")||`<tr><td colspan="5" class="admin-empty">Belum ada data pelanggan.</td></tr>`;
}

// Store settings
async function loadSettings(){
  const snap=await getDoc(doc(db,"settings","store"));storeSettings=snap.exists()?snap.data():{};
  $("setting-whatsapp").value=storeSettings.whatsapp||"6282148764748";$("setting-bank").value=storeSettings.bank||"BCA";
  $("setting-account-name").value=storeSettings.accountName||"";$("setting-account-number").value=storeSettings.accountNumber||"";
  $("setting-areas").value=Array.isArray(storeSettings.areas)?storeSettings.areas.join(", "):"";
  $("setting-hours").value=storeSettings.hours||"";$("setting-open").checked=storeSettings.isOpen!==false;
}
$("settings-form").addEventListener("submit",async e=>{
  e.preventDefault();const data={whatsapp:$("setting-whatsapp").value.trim().replace(/\D/g,""),bank:$("setting-bank").value.trim(),
    accountName:$("setting-account-name").value.trim(),accountNumber:$("setting-account-number").value.trim(),
    areas:$("setting-areas").value.split(",").map(x=>x.trim()).filter(Boolean),hours:$("setting-hours").value.trim(),isOpen:$("setting-open").checked,updatedAt:serverTimestamp()};
  if(data.whatsapp.length<8){msg("settings-message","Nomor WhatsApp tidak valid.","error");return;}
  try{await setDoc(doc(db,"settings","store"),data,{merge:true});storeSettings=data;msg("settings-message","Pengaturan toko tersimpan.","success");}
  catch(err){msg("settings-message",`Gagal menyimpan: ${err.message}`,"error");}
});

$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();const b=e.submitter;b.disabled=true;msg("login-message","Sedang masuk...");
  try{await signInWithEmailAndPassword(auth,$("admin-email").value.trim(),$("admin-password").value);$("admin-password").value="";}
  catch(err){msg("login-message",`Login gagal: ${err.message}`,"error");}finally{b.disabled=false;}
});
$("logout-button").addEventListener("click",()=>signOut(auth));
$("history-list").addEventListener("click",()=>{}); // delegated document handler above
function startListeners(){
  unsubscribers.forEach(fn=>fn());unsubscribers=[];
  unsubscribers.push(onSnapshot(productsRef,s=>{currentProducts=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"id"));renderProducts();}));
  unsubscribers.push(onSnapshot(ordersRef,s=>{allOrders=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b)?.getTime()||0)-(dateOf(a)?.getTime()||0));renderOrderRows();renderCustomers();renderReports();}));
  unsubscribers.push(onSnapshot(expensesRef,s=>{allExpenses=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.dateString||"").localeCompare(String(a.dateString||"")));renderExpenses();}));
  unsubscribers.push(onSnapshot(stockMovementsRef,s=>{allStockMovements=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));renderStockMovements();}));
}
onAuthStateChanged(auth,async user=>{
  if(user){$("login-panel").hidden=true;$("dashboard-panel").hidden=false;$("logout-button").hidden=false;
    startListeners();try{await loadSettings();}catch(err){msg("settings-message",`Pengaturan belum dapat dibaca: ${err.message}`,"error");}
  }else{unsubscribers.forEach(fn=>fn());unsubscribers=[];$("login-panel").hidden=false;$("dashboard-panel").hidden=true;$("logout-button").hidden=true;}
});
resetProductForm();
