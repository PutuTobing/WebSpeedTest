# 🚀 SpeedTest - SKY TECH

Modern, lightweight, and feature-rich internet speed test application with admin dashboard, built with vanilla JavaScript and Node.js.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![MySQL](https://img.shields.io/badge/MySQL-%3E%3D8.0-blue.svg)

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

### Prerequisites
```bash
- Node.js >= 18.0.0
- MySQL >= 8.0
- npm or yarn
```

### 1. Clone the repository
```bash
git clone https://github.com/PutuTobing/WebSpeedTest.git
cd speedtest-skytech
```

### 2. Backend setup
```bash
cd api

# Install dependencies
npm install

# Create .env file (copy from example)
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Run database migrations
# The tables will be created automatically on first run
```

### 3. Frontend setup
```bash
# Navigate to frontend directory
cd ..

# Update API_URL in assets/js/shared/config.js if needed
```

### 4. Start services

**Development mode:**
```bash
# Terminal 1 - Backend API
cd api
npm start  # Runs on port 3001

# Terminal 2 - Frontend
cd ..
python3 -m http.server 8000  # Or use any static server
```

**Production mode:**
```bash
# Using PM2
pm2 start api/server.js --name speedtest-api

# Or using systemd (see INSTALLATION.md for details)
sudo systemctl start speedtest-api
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
