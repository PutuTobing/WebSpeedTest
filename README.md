# WebSpeedTest — SKY TECH

Sistem monitoring kecepatan internet berbasis web dengan dashboard admin, manajemen server, dan riwayat pengujian.

---

## Fitur

- Dashboard monitoring real-time kecepatan internet
- Manajemen server & endpoint (tambah, edit, hapus, approve)
- Riwayat hasil speedtest per pengguna
- Sistem autentikasi JWT (admin & user)
- Auto-check status server tiap 1 jam
- Tampilan responsif dengan dark/light mode
- 2 systemd service (API + Frontend) — auto-start saat boot, auto-restart jika crash

---

## Persyaratan

| Komponen | Versi Minimum |
|----------|--------------|
| OS       | Ubuntu 20.04 / Debian 10 / Linux Mint 20 |
| RAM      | 512 MB |
| Disk     | 2 GB |
| Node.js  | 18 (diinstall otomatis) |
| MySQL    | 8.0 / MariaDB 10.5 (diinstall otomatis) |
| Python3  | 3.8+ (diinstall otomatis) |

---

## Instalasi Cepat

```bash
# 1. Masuk sebagai root
sudo su

# 2. Clone repository
git clone https://github.com/PutuTobing/WebSpeedTest.git

# 3. Masuk ke folder
cd WebSpeedTest

# 4. Beri izin eksekusi
chmod +x install.sh

# 5. Jalankan installer
bash install.sh
```

Installer akan memandu Anda mengisi:
- Port frontend (default: **8000**)
- Port API (default: **3001**)
- Password database
- Password admin aplikasi

Semua konfigurasi lain (JWT secret, struktur database) dibuat **otomatis**.

---

## Proses Instalasi

```
━━ Memeriksa sistem operasi ━━
━━ Update & install paket sistem ━━
━━ Instalasi Node.js ━━
━━ Setup database MySQL ━━
━━ Deploy file aplikasi ━━
━━ Membuat konfigurasi .env ━━
━━ Install Node.js dependencies ━━
━━ Patch konfigurasi frontend ━━
━━ Setup systemd service — API Backend ━━
━━ Setup systemd service — Frontend Web ━━
━━ Konfigurasi firewall (ufw) ━━
━━ Verifikasi instalasi ━━
```

---

## Akses Setelah Instalasi

| Layanan   | URL                                   |
|-----------|---------------------------------------|
| Frontend  | `http://<IP-SERVER>:8000`            |
| API       | `http://<IP-SERVER>:3001`            |
| Health    | `http://<IP-SERVER>:3001/api/health` |

Login default:
- **Username**: `admin`
- **Password**: password yang Anda set saat instalasi

---

## Manajemen Service

Aplikasi berjalan sebagai 2 systemd service yang **otomatis aktif saat server boot** dan **otomatis restart jika crash**.

### API Backend (Node.js — port 3001)

```bash
systemctl start   webspeedtest-api   # hidupkan
systemctl stop    webspeedtest-api   # matikan
systemctl restart webspeedtest-api   # restart
systemctl enable  webspeedtest-api   # aktifkan auto-start saat boot
systemctl disable webspeedtest-api   # nonaktifkan auto-start
systemctl status  webspeedtest-api   # cek status
```

### Frontend Web (Python3 http.server — port 8000)

```bash
systemctl start   webspeedtest-web   # hidupkan
systemctl stop    webspeedtest-web   # matikan
systemctl restart webspeedtest-web   # restart
systemctl enable  webspeedtest-web   # aktifkan auto-start saat boot
systemctl disable webspeedtest-web   # nonaktifkan auto-start
systemctl status  webspeedtest-web   # cek status
```

### Log Realtime

```bash
journalctl -u webspeedtest-api -f   # log API
journalctl -u webspeedtest-web -f   # log Frontend
```

---

## Struktur File

```
WebSpeedTest/
├── install.sh          # Auto installer
├── index.html          # Halaman utama / speedtest
├── login.html          # Halaman login
├── dashboard.html      # Dashboard user
├── admin.html          # Panel admin
├── css/
│   └── style.css       # Stylesheet utama
├── js/
│   ├── config.js       # Konfigurasi URL API
│   ├── admin.js        # Logika panel admin
│   ├── auth.js         # Autentikasi & session
│   ├── api-client.js   # HTTP client ke API
│   ├── dashboard.js    # Dashboard logic
│   ├── login.js        # Login form logic
│   ├── speedtest.js    # Speedtest engine
│   ├── storage.js      # Local storage helper
│   ├── theme.js        # Dark/light mode
│   └── client-info.js  # Info client (IP, ISP)
└── api/
    ├── server.js       # Express API server
    ├── database.js     # Koneksi MySQL
    ├── package.json    # Dependensi Node.js
    ├── .env.example    # Contoh konfigurasi
    ├── middleware/
    │   └── auth.js     # JWT middleware
    └── routes/
        ├── auth.js     # Route login/register
        ├── servers.js  # Route manajemen server
        ├── endpoints.js # Route endpoint
        ├── history.js  # Route riwayat
        └── users.js    # Route manajemen user
```

---

## Konfigurasi Manual (.env)

File konfigurasi berada di `/opt/webspeedtest/api/.env` (dibuat otomatis saat instalasi).

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=speedtest_user
DB_PASS=YOUR_DB_PASSWORD
DB_NAME=speedtest_db

JWT_SECRET=YOUR_64_CHAR_SECRET
DEFAULT_ADMIN_PASS=YOUR_ADMIN_PASSWORD

API_PORT=3001
FRONTEND_URL=http://YOUR_IP:8000
```

Setelah mengubah `.env`, restart API:
```bash
systemctl restart webspeedtest-api
```

---

## Troubleshooting

### API tidak bisa diakses
```bash
# Cek status service
systemctl status webspeedtest-api

# Lihat log error
journalctl -u webspeedtest-api -n 50

# Cek port sudah listen
ss -tlnp | grep 3001
```

### Frontend tidak bisa diakses
```bash
systemctl status webspeedtest-web
journalctl -u webspeedtest-web -n 30
ss -tlnp | grep 8000
```

### Database error
```bash
systemctl status mysql
mysql -u speedtest_user -p speedtest_db
```

### Lihat log instalasi
```bash
cat /var/log/webspeedtest-install.log
```

---

## Lisensi

© 2026 SKY TECH — Putu Tobing
