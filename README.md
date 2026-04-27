# 🚀 SpeedTest - SKY TECH

Modern, lightweight, and feature-rich internet speed test application with admin dashboard, built with vanilla JavaScript and Node.js.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![MySQL](https://img.shields.io/badge/MySQL-%3E%3D8.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Ubuntu%20%7C%20Debian-orange.svg)

---

## 🎯 Quick Start

**Install dalam 2 langkah!** Script otomatis akan mengatur semuanya:

```bash
git clone https://github.com/PutuTobing/WebSpeedTest.git && cd WebSpeedTest
sudo bash install.sh
```

✅ **Selesai!** Akses aplikasi di `http://your-server-ip:8000`

📖 [Baca dokumentasi lengkap](#-quick-install-recommended) untuk detail instalasi.

---

## ✨ Features

### 🎯 Speed Test
- **Real-time testing**: Ping, Jitter, Download, and Upload speed measurement
- **Server selection**: Choose from multiple test servers
- **Smart timeout detection**: Automatic error handling for unreachable servers
- **Test history**: Track your speed test results over time
- **Responsive gauge display**: Visual feedback during tests
- **Client information**: Display IP, ISP, AS Number, and location

### 🛡️ Admin Dashboard
- **User management**: Create, edit, and manage user accounts
- **Server approval**: Review and approve/reject server registrations
- **Endpoint management**: Configure test endpoints
- **Site customization**: 
  - Dynamic site title configuration
  - Logo and branding customization
  - Contact information settings
  - Email & WhatsApp message templates
- **Backup & Restore**: AES-256 encrypted database backup/restore
- **Authentication**: JWT-based secure authentication

### 🎨 UI/UX
- **Dark/Light theme**: Toggle between themes
- **Fully responsive**: Mobile, tablet, and desktop support
- **Modern CSS**: Glassmorphism design with smooth animations
- **Accessibility**: Semantic HTML and ARIA labels

## 🛠️ Tech Stack

### Frontend
- **Vanilla JavaScript** - No frameworks, pure performance
- **HTML5 & CSS3** - Modern web standards
- **Modular architecture** - Organized code structure

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **AES-256-CBC** - Backup encryption

## 📦 Installation

### 🚀 Quick Install (Recommended)

**Install otomatis dalam 1 perintah!** Script installer akan mengatur semuanya untuk Anda.

```bash
# 1. Clone repository
git clone https://github.com/PutuTobing/WebSpeedTest.git
cd WebSpeedTest

# 2. Jalankan installer (butuh sudo)
sudo bash install.sh
```

**Apa yang dilakukan script installer:**
- ✅ Install Node.js (v18+) otomatis
- ✅ Install & setup MySQL/MariaDB
- ✅ Buat database dan user otomatis
- ✅ Install semua dependencies (npm packages)
- ✅ Deploy frontend & backend
- ✅ Setup systemd services (auto-start on boot)
- ✅ Generate JWT secret & encryption keys
- ✅ Konfigurasi firewall (opsional)
- ✅ Buat admin user default

**Sistem yang didukung:**
- Ubuntu 20.04+
- Debian 10+
- Linux Mint 20+
- Pop!_OS 20.04+

**Setelah instalasi selesai:**
```bash
# Akses aplikasi
Frontend : http://your-server-ip:8000
API      : http://your-server-ip:3001

# Login admin default
Username : admin
Password : (yang Anda set saat instalasi)

# Cek status services
sudo systemctl status webspeedtest-api
sudo systemctl status webspeedtest-web

# Restart services
sudo systemctl restart webspeedtest-api
sudo systemctl restart webspeedtest-web

# Lihat logs
sudo journalctl -u webspeedtest-api -f
```

---

### 🔧 Manual Installation

Jika Anda ingin install manual atau customize lebih lanjut:

#### Prerequisites
- Node.js >= 18.0.0
- MySQL >= 8.0
- npm atau yarn

#### 1. Clone repository
```bash
git clone https://github.com/PutuTobing/WebSpeedTest.git
cd WebSpeedTest
```

#### 2. Backend setup
```bash
cd api

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
DB_HOST=localhost
DB_USER=speedtest_user
DB_PASS=your_secure_password
DB_NAME=speedtest_db
DB_PORT=3306

JWT_SECRET=your_jwt_secret_min_32_chars
BACKUP_KEY=your_backup_encryption_key_64_hex_chars

PORT=3001
EOF

# Buat database MySQL
mysql -u root -p << 'SQL'
CREATE DATABASE IF NOT EXISTS speedtest_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'speedtest_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON speedtest_db.* TO 'speedtest_user'@'localhost';
FLUSH PRIVILEGES;
SQL

# Jalankan API
npm start
```

#### 3. Frontend setup
```bash
# Update API_URL in assets/js/shared/config.js jika perlu
# Default: http://localhost:3001

# Serve frontend (development)
python3 -m http.server 8000
```

#### 4. Buat admin user
```bash
# Masuk ke MySQL
mysql -u speedtest_user -p speedtest_db

# Insert admin user (password: admin123)
INSERT INTO users (username, password, role, created_at) 
VALUES ('admin', '$2b$10$rBV2r0N5z9F5qU5K3Q3Qc.XGfvYx8Z5J5yY8z9X1Y2Z3A4B5C6D7E', 'admin', NOW());
```

**Production mode:**
```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start api/server.js --name speedtest-api
pm2 startup  # Enable auto-start on boot
pm2 save

# Serve frontend with nginx (recommended for production)
# See nginx configuration example below
```

---

### 🌐 Nginx Configuration (Production)

Create `/etc/nginx/sites-available/speedtest`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /opt/webspeedtest;
        index index.html;
        try_files $uri $uri/ =404;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/speedtest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 Configuration

### Environment Variables (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=speedtest_user
DB_PASS=your_password
DB_NAME=speedtest_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# Backup Encryption (32-byte hex key)
BACKUP_KEY=generate-with-openssl-rand-32-hex

# Server
PORT=3001
NODE_ENV=production
```

### Generate Encryption Key
```bash
# Generate BACKUP_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📖 Usage

### User Flow
1. Visit `http://localhost:8000`
2. Select a server from the dropdown
3. Click "MULAI" to start speed test
4. View results and test history

### Admin Flow
1. Visit `http://localhost:8000/login.html`
2. Login with admin credentials
3. Access admin dashboard
4. Manage users, servers, and settings
5. Download/restore database backups

### Default Admin Account
```
Username: admin
Password: admin123
⚠️ Change this immediately after first login!
```

---

## ❓ FAQ & Troubleshooting

### Tentang install.sh

**Q: Apakah install.sh aman dijalankan?**  
A: Ya! Script ini open source dan dapat Anda review sebelum dijalankan. Script tidak melakukan modifikasi sistem yang berbahaya.

**Q: Berapa lama proses instalasi?**  
A: Tergantung kecepatan internet dan spek server, biasanya 5-15 menit.

**Q: Apakah data saya aman?**  
A: Ya, password database dan JWT secret di-generate secara random dan disimpan di file `.env` yang tidak akan di-push ke Git.

**Q: Bisa install tanpa sudo?**  
A: Tidak, install.sh membutuhkan akses root untuk install packages (Node.js, MySQL) dan setup systemd services.

**Q: Apakah bisa custom port?**  
A: Ya! Script akan menanyakan port frontend dan API saat instalasi. Tekan Enter untuk gunakan default (8000 & 3001).

**Q: Apakah install.sh akan menghapus MySQL yang sudah ada?**  
A: Tidak, script hanya membuat database dan user baru. MySQL/MariaDB yang sudah ada tidak akan terpengaruh.

### Troubleshooting instalasi

**❌ Error: "apt-get lock" atau "dpkg lock"**
```bash
# Script akan menunggu otomatis, tapi jika stuck, jalankan:
sudo systemctl stop unattended-upgrades
sudo killall apt apt-get
sudo bash install.sh  # Jalankan ulang
```

**❌ Error: "MySQL connection refused"**
```bash
# Cek status MySQL
sudo systemctl status mysql
sudo systemctl start mysql

# Test koneksi
mysql -u speedtest_user -p speedtest_db
```

**❌ Error: "Port 3001 already in use"**
```bash
# Cek process yang menggunakan port
sudo lsof -i :3001
sudo kill -9 <PID>

# Atau ubah port di file .env
sudo nano /opt/webspeedtest/api/.env
# Ubah PORT=3001 ke port lain
sudo systemctl restart webspeedtest-api
```

**❌ Frontend tidak bisa akses API (CORS error)**
```bash
# Pastikan API_URL di config.js sesuai
nano /opt/webspeedtest/assets/js/shared/config.js
# Seharusnya: const API_URL = 'http://your-server-ip:3001';
```

**❌ Error: "Cannot find module"**
```bash
# Install ulang dependencies
cd /opt/webspeedtest/api
sudo npm install
sudo systemctl restart webspeedtest-api
```

### Perintah berguna

```bash
# Cek status services
sudo systemctl status webspeedtest-api
sudo systemctl status webspeedtest-web

# Restart services
sudo systemctl restart webspeedtest-api
sudo systemctl restart webspeedtest-web

# Stop services
sudo systemctl stop webspeedtest-api
sudo systemctl stop webspeedtest-web

# Lihat logs real-time
sudo journalctl -u webspeedtest-api -f
sudo journalctl -u webspeedtest-web -f

# Lihat log instalasi
cat /var/log/webspeedtest-install.log

# Test API endpoint
curl http://localhost:3001/api/servers

# Uninstall (jika diperlukan)
sudo systemctl stop webspeedtest-api webspeedtest-web
sudo systemctl disable webspeedtest-api webspeedtest-web
sudo rm /etc/systemd/system/webspeedtest-*.service
sudo rm -rf /opt/webspeedtest
# Note: Database tidak dihapus, hapus manual jika perlu
```

### Keamanan setelah instalasi

```bash
# 1. Ganti password admin default
# Login ke dashboard → User Management → Edit admin user

# 2. Setup firewall (jika belum)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# 3. Setup SSL dengan Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 4. Backup .env file
sudo cp /opt/webspeedtest/api/.env /root/.env.backup
```

---

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions including:
- Nginx reverse proxy setup
- SSL/TLS configuration
- PM2 process management
- Systemd service configuration

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation if needed

## 📝 API Documentation

### Authentication Endpoints
```
POST /api/auth/login       - User login
POST /api/auth/check       - Verify JWT token
POST /api/auth/logout      - User logout
```

### User Management (Admin only)
```
GET    /api/users          - List all users
POST   /api/users          - Create new user
PUT    /api/users/:id      - Update user
DELETE /api/users/:id      - Delete user
```

### Server Management
```
GET    /api/servers        - List all servers
POST   /api/servers        - Register new server
PUT    /api/servers/:id    - Update server status
DELETE /api/servers/:id    - Delete server
```

### Speed Test Endpoints
```
POST   /ping               - Ping test endpoint
GET    /download           - Download test endpoint
POST   /upload             - Upload test endpoint
```

### Backup & Restore (Admin only)
```
GET    /api/backup         - Download encrypted backup
POST   /api/backup         - Restore from backup
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **SQL Injection Protection** - Parameterized queries
- **XSS Prevention** - Input sanitization
- **CORS Configuration** - Controlled cross-origin requests
- **Encrypted Backups** - AES-256-CBC encryption
- **Admin-only Routes** - Role-based access control

## 🐛 Known Issues & Roadmap

### Known Issues
- None currently reported

### Roadmap
- [ ] Multi-language support (i18n)
- [ ] Export test history to CSV/PDF
- [ ] Speed test scheduling
- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] Docker containerization
- [ ] Redis caching layer
- [ ] WebSocket real-time updates

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**SKY TECH - PT. SKY Base Technologhy Digital**
- Website: [https://btd.co.id](https://btd.co.id)
- Email: office@btd.co.id
- Phone: +62 822-1783-5764

## 🙏 Acknowledgments

- Inspired by Ookla Speedtest
- Built with love for the community
- Thanks to all contributors

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Email: office@btd.co.id
- WhatsApp: +62 822-1783-5764

---

**⭐ If you find this project useful, please give it a star on GitHub!**
