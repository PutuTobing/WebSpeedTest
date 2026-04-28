# WebSpeedTest

Aplikasi speed test internet dengan admin dashboard.  
Built with vanilla JavaScript, Node.js, dan MySQL.

---

## 📦 Instalasi

**Syarat:** Ubuntu 20.04+ / Debian 10+ dengan koneksi internet.

```bash
# 1. Clone repository
git clone https://github.com/PutuTobing/WebSpeedTest.git
cd WebSpeedTest

# 2. Jalankan installer
sudo bash install.sh
```

Script akan menanyakan password database dan password admin, lalu mengatur semuanya secara otomatis termasuk:
- Install Node.js & MySQL
- Buat database & tabel
- Setup systemd service (auto-start saat boot)
- Install phpMyAdmin

---

## 🔄 Update ke Versi Terbaru

```bash
# 1. Masuk ke folder repository
cd WebSpeedTest

# 2. Ambil versi terbaru
git pull origin main

# 3. Jalankan installer — pilih opsi [1] Update
sudo bash install.sh
```

> ✅ Mode Update **tidak** mengubah password, konfigurasi, atau data yang sudah ada.  
> Backup otomatis disimpan di `/root/.webspeedtest_env_*.bak` dan `/opt/webspeedtest.bak_*`.

---

## 🔌 Port

| Layanan      | Port | Keterangan                        |
|:-------------|:----:|:----------------------------------|
| Frontend     | 8000 | Halaman utama speed test          |
| API Backend  | 3001 | REST API (Node.js + Express)      |
| phpMyAdmin   | 80   | Manajemen database via browser    |
| MySQL        | 3306 | Database (hanya akses lokal)      |

> Port frontend dan API dapat diubah saat instalasi.

---

## 🔧 Pemeliharaan

**Cek status:**
```bash
systemctl status webspeedtest-api
systemctl status webspeedtest-web
```

**Restart:**
```bash
sudo systemctl restart webspeedtest-api
sudo systemctl restart webspeedtest-web
```

**Lihat log real-time:**
```bash
journalctl -u webspeedtest-api -f
journalctl -u webspeedtest-web -f
```

**Backup database:**
```bash
# Via admin panel: Login → Settings → Backup & Restore → Download Backup
# Atau manual:
mysqldump -u speedtest_user -p speedtest_db > backup_$(date +%Y%m%d).sql
```

**Edit konfigurasi:**
```bash
sudo nano /opt/webspeedtest/api/.env
sudo systemctl restart webspeedtest-api
```

**Lokasi file:**
```
/opt/webspeedtest/          → folder aplikasi
/opt/webspeedtest/api/.env  → konfigurasi (DB, JWT, dll)
/var/log/webspeedtest-install.log → log instalasi
```

---

## 🔒 Login Default

| Field    | Value    |
|:---------|:---------|
| Username | `admin`  |
| Password | *(yang Anda set saat instalasi)* |

URL admin panel: `http://your-server-ip:8000/admin.html`

---

## 📄 Lisensi

MIT License — [PutuTobing](https://github.com/PutuTobing)
