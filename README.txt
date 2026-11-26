SAYUR FRESH EFFENDI — PAKET DASHBOARD ULTIMATE

ISI FOLDER
- index.html, style.css, app.js: website pelanggan
- checkout.html, checkout.css, checkout.js: checkout dan pesanan khusus
- admin.html, admin.css, admin.js: dashboard admin
- FIRESTORE-RULES.txt: aturan keamanan Firestore
- PETUNJUK-INSTALASI.txt: panduan pemasangan dan pengujian

CARA MEMASANG
1. Buat salinan cadangan folder website lama.
2. Ekstrak ZIP ini ke folder baru.
3. Buka folder hasil ekstrak di VS Code.
4. Jalankan index.html dengan Live Server.
5. Dashboard admin: http://127.0.0.1:5500/admin.html
6. Login dengan akun Firebase Authentication admin yang sudah ada.

PENTING: FIRESTORE RULES
1. Buka Firebase Console > Firestore Database > Rules.
2. Buka FIRESTORE-RULES.txt dari paket ini.
3. Pastikan email pada fungsi isAdmin() sama persis dengan email akun admin Firebase Authentication.
4. Salin seluruh Rules, lalu Publish.
5. Jangan gunakan Test Mode atau izin write publik.

FITUR PAKET
- Katalog produk realtime dari collection product.
- Tambah, edit, hapus produk dan harga modal.
- Checkout tanpa login; pesanan katalog dan barang khusus.
- Simpan order ke collection orders dan buka WhatsApp untuk dikirim pelanggan.
- Admin dapat memberi harga barang khusus, modal, ongkir, biaya tambahan, dan catatan admin.
- Total transaksi dihitung dari item yang telah diberi harga + ongkir.
- Pesanan tidak dapat ditandai Selesai sebelum harga jual dan modal semua item dilengkapi.
- Stok dikurangi satu kali saat pesanan diterima/disiapkan/dikirim/diselesaikan; stok dikembalikan jika pesanan yang sudah mengurangi stok dibatalkan.
- Penyesuaian stok manual, riwayat pergerakan stok, dan peringatan stok menipis.
- Riwayat transaksi, pencarian/filter, detail, cetak nota, dan hapus permanen.
- Laporan periode, omzet item, modal, ongkir, biaya operasional, estimasi laba bersih, dan ekspor CSV yang dapat dibuka di Excel.
- Database pelanggan berdasarkan data pesanan.
- Pengaturan nomor WhatsApp, rekening, area layanan, jam operasional, dan status toko.
- Biaya operasional disimpan di collection expenses.

PENJELASAN KEUANGAN
- Omzet = harga jual produk katalog + harga jual barang khusus untuk pesanan selesai.
- Ongkir ditampilkan terpisah dan tidak dihitung sebagai omzet toko.
- Modal = harga modal per unit x jumlah item yang terjual.
- Biaya = catatan biaya operasional di menu Biaya + biaya tambahan pada detail pesanan.
- Estimasi laba bersih = omzet - modal - biaya.
- Jika harga jual atau modal item kosong, laporan laba akan menampilkan Belum lengkap.
- Pastikan harga modal produk diisi sebelum transaksi baru; harga modal disalin ke snapshot pesanan ketika checkout.
- Pesanan lama mungkin belum memiliki snapshot harga modal. Lengkapi lewat Detail pesanan untuk laporan yang lebih akurat.

CATATAN PENTING / BATASAN
- Foto produk memakai URL gambar langsung; tidak ada upload file ke Firebase Storage.
- WhatsApp dibuka dengan teks pesanan terisi; pelanggan tetap harus menekan tombol Kirim di WhatsApp.
- Stok dipotong ketika admin mengubah status ke Diterima, Disiapkan, Dikirim, atau Selesai. Jangan ubah stok manual bersamaan dengan pesanan yang sedang diproses tanpa memeriksa riwayat stok.
- Firebase Rules hanya memastikan admin mengelola data. Validasi harga/stock pada checkout publik tidak sama dengan backend transaksi tepercaya. Untuk skala transaksi besar, payment gateway, atau stok real-time berisiko tinggi, tambahkan backend tepercaya/Cloud Functions dan App Check.
- Hapus riwayat pesanan bersifat permanen. Sebaiknya ekspor laporan/nota sebelum menghapus transaksi.
- Uji dulu dengan pesanan percobaan dan stok kecil sebelum dipakai menerima pesanan sungguhan.
