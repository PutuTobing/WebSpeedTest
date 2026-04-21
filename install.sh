#!/bin/bash
# ================================================================
#  WebSpeedTest — Auto Installer
#  Repo   : https://github.com/PutuTobing/WebSpeedTest
#  Version: 1.1.0
#  Supports: Ubuntu 20.04+, Debian 10+, Linux Mint 20+
# ================================================================

set -euo pipefail
trap 'on_error $LINENO "$BASH_COMMAND"' ERR

# ── Defaults ─────────────────────────────────────────────────────
INSTALL_DIR="/opt/webspeedtest"
API_PORT=3001
FRONTEND_PORT=8000
DB_NAME="speedtest_db"
DB_USER="speedtest_user"
DB_PASS=""
ADMIN_PASS=""
JWT_SECRET=""
LOG="/var/log/webspeedtest-install.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_MIN_VERSION=18

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Logging helpers ───────────────────────────────────────────────
log()     { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
info()    { echo -e "  ${BLUE}[INFO]${NC}  $*"; log "INFO: $*"; }
success() { echo -e "  ${GREEN}[OK]${NC}    $*"; log "OK: $*"; }
warn()    { echo -e "  ${YELLOW}[WARN]${NC}  $*"; log "WARN: $*"; }
error()   { echo -e "  ${RED}[ERROR]${NC} $*" >&2; log "ERROR: $*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━ $* ━━${NC}"; log "STEP: $*"; }

# ── Error handler ─────────────────────────────────────────────────
on_error() {
    local line=$1 cmd=$2
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              ✗  INSTALASI GAGAL                      ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════╝${NC}"
    error "Terjadi kesalahan pada baris $line"
    error "Perintah  : $cmd"
    error "Log       : $LOG"
    echo ""
    echo -e "  ${BOLD}Langkah perbaikan:${NC}"
    echo -e "  1. Lihat log lengkap  : cat $LOG"
    echo -e "  2. Cek status API     : systemctl status webspeedtest-api"
    echo -e "  3. Cek status frontend: systemctl status webspeedtest-web"
    echo -e "  4. Cek MySQL          : systemctl status mysql"
    echo -e "  5. Jalankan ulang     : bash $SCRIPT_DIR/install.sh"
    echo ""
    exit 1
}

# ── Banner ────────────────────────────────────────────────────────
print_banner() {
    clear
    echo -e "${BOLD}${BLUE}"
    echo "  ╦ ╦╔═╗╔╗     ╔═╗╔═╗╔═╗╔═╗╔╦╗╔╦╗╔═╗╔═╗╔╦╗"
    echo "  ║║║║╣ ╠╩╗    ╚═╗╠═╝║╣ ║╣  ║  ║ ║╣ ╚═╗ ║ "
    echo "  ╚╩╝╚═╝╚═╝    ╚═╝╩  ╚═╝╚═╝ ╩  ╩ ╚═╝╚═╝ ╩ "
    echo -e "${NC}"
    echo -e "  ${BOLD}Auto Installer v1.1.0 — SKY TECH${NC}"
    echo -e "  ${CYAN}https://github.com/PutuTobing/WebSpeedTest${NC}"
    echo -e "  ──────────────────────────────────────────────"
    echo ""
}

# ── Check root ────────────────────────────────────────────────────
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Script harus dijalankan sebagai root!"
        echo -e "  Gunakan: ${BOLD}sudo bash install.sh${NC}"
        exit 1
    fi
}

# ── Check OS ──────────────────────────────────────────────────────
check_os() {
    step "Memeriksa sistem operasi"
    if [[ ! -f /etc/os-release ]]; then
        error "OS tidak dikenali. File /etc/os-release tidak ditemukan."
        exit 1
    fi
    source /etc/os-release
    case "${ID:-}" in
        ubuntu|debian|linuxmint|raspbian|pop)
            success "OS terdeteksi: ${PRETTY_NAME:-$ID}"
            ;;
        *)
            warn "OS '$ID' belum diuji. Melanjutkan dengan mode kompatibilitas Debian..."
            ;;
    esac

    info "Mengecek koneksi internet..."
    if ! curl -sf --max-time 5 https://registry.npmjs.org > /dev/null 2>&1; then
        error "Tidak ada koneksi internet. Instalasi membutuhkan koneksi internet."
        exit 1
    fi
    success "Koneksi internet OK"
}

# ── Prompt config ────────────────────────────────────────────────
prompt_config() {
    echo -e "\n${BOLD}  Konfigurasi Instalasi${NC}"
    echo -e "  Tekan ${CYAN}Enter${NC} untuk pakai nilai default [dalam kurung]\n"

    read -rp "  Port frontend web  [${FRONTEND_PORT}]: " input
    FRONTEND_PORT="${input:-$FRONTEND_PORT}"

    read -rp "  Port API backend   [${API_PORT}]: " input
    API_PORT="${input:-$API_PORT}"

    echo ""
    while true; do
        read -rsp "  Password DB user '${DB_USER}' (min 8 karakter): " DB_PASS; echo ""
        [[ ${#DB_PASS} -ge 8 ]] && break
        warn "Password minimal 8 karakter, coba lagi."
    done

    while true; do
        read -rsp "  Password admin aplikasi  (min 8 karakter): " ADMIN_PASS; echo ""
        [[ ${#ADMIN_PASS} -ge 8 ]] && break
        warn "Password minimal 8 karakter, coba lagi."
    done

    JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 64)

    local server_ip
    server_ip=$(hostname -I | awk '{print $1}')
    echo ""
    echo -e "  ${BOLD}Ringkasan Konfigurasi:${NC}"
    echo -e "  ┌─────────────────────────────────────────────┐"
    echo -e "  │  Port Frontend : ${FRONTEND_PORT}"
    echo -e "  │  Port API      : ${API_PORT}"
    echo -e "  │  DB Name       : ${DB_NAME}"
    echo -e "  │  DB User       : ${DB_USER}"
    echo -e "  │  JWT Secret    : (auto-generated 64 chars)"
    echo -e "  │  IP Server     : ${server_ip}"
    echo -e "  └─────────────────────────────────────────────┘"
    echo ""
    read -rp "  Lanjutkan instalasi? [Y/n]: " confirm
    if [[ "${confirm,,}" == "n" ]]; then
        echo -e "\n  Instalasi dibatalkan."
        exit 0
    fi
}

# ── Install system packages ───────────────────────────────────────
install_packages() {
    step "Update & install paket sistem"

    # ── Tunggu dpkg/apt lock bebas (unattended-upgrades, dll) ────────
    local lock_wait=0
    local lock_max=180
    while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock \
                /var/lib/dpkg/lock /var/cache/apt/archives/lock \
                >/dev/null 2>&1; do
        if [[ $lock_wait -eq 0 ]]; then
            info "Menunggu proses apt/dpkg lain selesai (unattended-upgrades?)..."
        fi
        if [[ $lock_wait -ge $lock_max ]]; then
            warn "Timeout menunggu lock. Mencoba paksa kill unattended-upgrades..."
            systemctl stop unattended-upgrades >> "$LOG" 2>&1 || true
            killall apt apt-get unattended-upgrade 2>/dev/null || true
            sleep 2
            break
        fi
        sleep 3
        lock_wait=$((lock_wait + 3))
    done
    [[ $lock_wait -gt 0 ]] && success "Lock dpkg bebas, melanjutkan..."

    info "Menjalankan apt-get update..."
    apt-get update -qq >> "$LOG" 2>&1 || {
        error "apt-get update gagal. Cek koneksi internet atau repository."
        exit 1
    }
    success "apt-get update selesai"

    local packages=(curl wget git mysql-server openssl python3)
    for pkg in "${packages[@]}"; do
        if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
            success "Sudah terpasang: $pkg"
        else
            info "Menginstall $pkg..."
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$pkg" >> "$LOG" 2>&1 || {
                error "Gagal install $pkg. Lihat log: $LOG"
                exit 1
            }
            success "Berhasil install: $pkg"
        fi
    done
}

# ── Install Node.js ───────────────────────────────────────────────
install_nodejs() {
    step "Instalasi Node.js"
    local current_version=0
    if command -v node &>/dev/null; then
        current_version=$(node -e "process.stdout.write(process.version.replace('v','').split('.')[0])" 2>/dev/null || echo 0)
    fi

    if [[ "$current_version" -ge "$NODE_MIN_VERSION" ]]; then
        success "Node.js $(node --version) sudah terpasang (>= v${NODE_MIN_VERSION})"
        return
    fi

    info "Mengunduh NodeSource setup untuk Node.js ${NODE_MIN_VERSION}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x" -o /tmp/nodesource_setup.sh >> "$LOG" 2>&1 || {
        error "Gagal download NodeSource setup. Cek koneksi internet."
        exit 1
    }
    bash /tmp/nodesource_setup.sh >> "$LOG" 2>&1 || {
        error "NodeSource setup gagal."
        exit 1
    }
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >> "$LOG" 2>&1 || {
        error "Gagal install nodejs."
        exit 1
    }
    rm -f /tmp/nodesource_setup.sh
    success "Node.js $(node --version) berhasil diinstall"
    success "npm $(npm --version)"
}

# ── Setup MySQL database ──────────────────────────────────────────
setup_database() {
    step "Setup database MySQL"

    systemctl start mysql  >> "$LOG" 2>&1 || \
    systemctl start mariadb >> "$LOG" 2>&1 || {
        error "Gagal menjalankan MySQL/MariaDB. Cek: systemctl status mysql"
        exit 1
    }
    systemctl enable mysql  >> "$LOG" 2>&1 || \
    systemctl enable mariadb >> "$LOG" 2>&1 || true
    success "MySQL/MariaDB berjalan"

    info "Membuat database '${DB_NAME}' dan user '${DB_USER}'..."
    mysql -u root 2>>"$LOG" <<EOF || { error "Gagal setup database. Pastikan MySQL bisa diakses dengan: mysql -u root"; exit 1; }
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
    success "Database dan user berhasil dibuat"

    info "Membuat tabel database..."
    mysql -u root "${DB_NAME}" 2>>"$LOG" <<'EOSQL' || { error "Gagal membuat tabel. Lihat log: $LOG"; exit 1; }
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','user') DEFAULT 'user',
    fullname      VARCHAR(100) DEFAULT '',
    email         VARCHAR(100) DEFAULT '',
    status        ENUM('active','inactive') DEFAULT 'active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servers (
    id                  VARCHAR(50)  PRIMARY KEY,
    company_name        VARCHAR(100) NOT NULL,
    location            VARCHAR(100) NOT NULL,
    bandwidth_capacity  VARCHAR(50)  NOT NULL,
    server_url          VARCHAR(255) NOT NULL,
    cpu_cores           INT DEFAULT 1,
    ram_size            INT DEFAULT 1,
    contact_name        VARCHAR(100) DEFAULT '',
    contact_email       VARCHAR(100) DEFAULT '',
    company_website     VARCHAR(255) DEFAULT '',
    additional_notes    TEXT,
    status              ENUM('pending','checking','approved','error') DEFAULT 'pending',
    last_status         ENUM('up','down') DEFAULT NULL,
    last_checked        TIMESTAMP NULL DEFAULT NULL,
    downtime_count      INT DEFAULT 0,
    status_changed_by   VARCHAR(50)  DEFAULT NULL,
    approved_by         VARCHAR(50)  DEFAULT NULL,
    approved_at         TIMESTAMP NULL DEFAULT NULL,
    created_by          VARCHAR(50)  NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS endpoints (
    id               VARCHAR(50)  PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    base_url         VARCHAR(255) NOT NULL,
    location         VARCHAR(100) DEFAULT '',
    is_active        BOOLEAN DEFAULT TRUE,
    linked_server_id VARCHAR(50)  DEFAULT NULL,
    added_by         VARCHAR(50)  DEFAULT 'admin',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS speedtest_history (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL,
    server_url    VARCHAR(255) DEFAULT '',
    server_name   VARCHAR(100) DEFAULT '',
    ping_ms       FLOAT DEFAULT 0,
    jitter_ms     FLOAT DEFAULT 0,
    download_mbps FLOAT DEFAULT 0,
    upload_mbps   FLOAT DEFAULT 0,
    tested_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
    id            INT NOT NULL DEFAULT 1,
    settings_json TEXT NOT NULL,
    updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOSQL
    success "Tabel database berhasil dibuat"
}

# ── Deploy files ──────────────────────────────────────────────────
deploy_files() {
    step "Deploy file aplikasi"
    info "Menyalin file ke ${INSTALL_DIR}..."

    mkdir -p "${INSTALL_DIR}"

    for item in admin.html dashboard.html index.html login.html css js; do
        [[ -e "${SCRIPT_DIR}/${item}" ]] && cp -r "${SCRIPT_DIR}/${item}" "${INSTALL_DIR}/"
    done

    mkdir -p "${INSTALL_DIR}/api"
    for item in server.js database.js package.json routes middleware; do
        [[ -e "${SCRIPT_DIR}/api/${item}" ]] && cp -r "${SCRIPT_DIR}/api/${item}" "${INSTALL_DIR}/api/"
    done

    success "File berhasil disalin ke ${INSTALL_DIR}"
}

# ── Create .env ────────────────────────────────────────────────────
create_env() {
    step "Membuat konfigurasi .env"
    local server_ip
    server_ip=$(hostname -I | awk '{print $1}')

    local backup_key
    backup_key=$(openssl rand -hex 32)

    cat > "${INSTALL_DIR}/api/.env" <<EOF
# WebSpeedTest — Environment Configuration
# Generated: $(date '+%Y-%m-%d %H:%M:%S')

DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}

JWT_SECRET=${JWT_SECRET}
DEFAULT_ADMIN_PASS=${ADMIN_PASS}

API_PORT=${API_PORT}
FRONTEND_URL=http://${server_ip}:${FRONTEND_PORT}

# AES-256-CBC key untuk enkripsi file backup database (auto-generated)
BACKUP_KEY=${backup_key}
EOF
    chmod 600 "${INSTALL_DIR}/api/.env"
    success ".env berhasil dibuat (mode 600 — hanya root yang bisa baca)"
}

# ── Update frontend config.js ──────────────────────────────────────
patch_frontend_config() {
    step "Patch konfigurasi frontend"
    cat > "${INSTALL_DIR}/js/config.js" <<EOF
// Auto-configured by install.sh
window.API_URL = window.location.protocol + '//' + window.location.hostname + ':${API_PORT}';
EOF
    success "Frontend config diupdate — API URL: [hostname]:${API_PORT}"
}

# ── npm install ───────────────────────────────────────────────────
install_npm_deps() {
    step "Install Node.js dependencies"
    info "Menjalankan npm install di ${INSTALL_DIR}/api ..."
    cd "${INSTALL_DIR}/api"
    npm install --omit=dev --loglevel=warn >> "$LOG" 2>&1 || {
        error "npm install gagal. Lihat log: $LOG"
        exit 1
    }
    success "npm dependencies berhasil diinstall"
}

# ── Systemd service: API ──────────────────────────────────────────
setup_api_service() {
    step "Setup systemd service — API Backend"

    local node_bin
    node_bin=$(which node)

    cat > "/etc/systemd/system/webspeedtest-api.service" <<EOF
[Unit]
Description=WebSpeedTest API Server
Documentation=https://github.com/PutuTobing/WebSpeedTest
After=network.target mysql.service mariadb.service
Wants=mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${INSTALL_DIR}/api
EnvironmentFile=${INSTALL_DIR}/api/.env
ExecStart=${node_bin} server.js
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webspeedtest-api

NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=${INSTALL_DIR}/api
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

    chown -R www-data:www-data "${INSTALL_DIR}"
    chmod -R 755 "${INSTALL_DIR}"
    chmod 600 "${INSTALL_DIR}/api/.env"

    systemctl daemon-reload >> "$LOG" 2>&1
    systemctl enable webspeedtest-api >> "$LOG" 2>&1
    systemctl restart webspeedtest-api >> "$LOG" 2>&1 || {
        error "Gagal start API service. Cek: journalctl -u webspeedtest-api -n 50"
        exit 1
    }
    success "webspeedtest-api aktif, enabled (auto-start saat boot)"
}

# ── Systemd service: Frontend ─────────────────────────────────────
setup_frontend_service() {
    step "Setup systemd service — Frontend Web"

    local python_bin
    python_bin=$(which python3)

    cat > "/etc/systemd/system/webspeedtest-web.service" <<EOF
[Unit]
Description=WebSpeedTest Frontend Web Server
Documentation=https://github.com/PutuTobing/WebSpeedTest
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${INSTALL_DIR}
ExecStart=${python_bin} -m http.server ${FRONTEND_PORT}
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webspeedtest-web

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload >> "$LOG" 2>&1
    systemctl enable webspeedtest-web >> "$LOG" 2>&1
    systemctl restart webspeedtest-web >> "$LOG" 2>&1 || {
        error "Gagal start frontend service. Cek: journalctl -u webspeedtest-web -n 50"
        exit 1
    }
    success "webspeedtest-web aktif, enabled (auto-start saat boot)"
}

# ── Firewall ──────────────────────────────────────────────────────
setup_firewall() {
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
        step "Konfigurasi firewall (ufw)"
        ufw allow "${FRONTEND_PORT}/tcp" comment "WebSpeedTest Frontend" >> "$LOG" 2>&1
        ufw allow "${API_PORT}/tcp"      comment "WebSpeedTest API"      >> "$LOG" 2>&1
        success "Firewall: port ${FRONTEND_PORT} dan ${API_PORT} dibuka"
    fi
}

# ── Final verification ────────────────────────────────────────────
final_check() {
    step "Verifikasi instalasi"
    local all_ok=true
    local server_ip
    server_ip=$(hostname -I | awk '{print $1}')

    sleep 3

    if curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/api/health" > /dev/null 2>&1; then
        success "API server UP"
    else
        warn "API belum merespons. Cek: journalctl -u webspeedtest-api -n 30"
        all_ok=false
    fi

    if curl -sf --max-time 5 "http://127.0.0.1:${FRONTEND_PORT}/" > /dev/null 2>&1; then
        success "Frontend UP"
    else
        warn "Frontend belum merespons. Cek: systemctl status webspeedtest-web"
        all_ok=false
    fi

    if systemctl is-active --quiet mysql || systemctl is-active --quiet mariadb; then
        success "Database MySQL/MariaDB UP"
    else
        warn "MySQL tidak berjalan. Cek: systemctl status mysql"
        all_ok=false
    fi

    echo ""
    if [[ "$all_ok" == true ]]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║          ✓  INSTALASI BERHASIL!                          ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║     ⚠  INSTALASI SELESAI (ada peringatan di atas)        ║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
    fi

    echo ""
    echo -e "  ${BOLD}🌐 Akses Aplikasi:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  Frontend   : http://${server_ip}:${FRONTEND_PORT}"
    echo -e "  │  API Health : http://${server_ip}:${API_PORT}/api/health"
    echo -e "  │  Login      : admin / (password yang Anda set tadi)"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${BOLD}📁 File Penting:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  App dir    : ${INSTALL_DIR}"
    echo -e "  │  Config .env: ${INSTALL_DIR}/api/.env"
    echo -e "  │  Log install: ${LOG}"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${BOLD}🔧 Manajemen Service:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  ${CYAN}# API Backend (Node.js — port ${API_PORT})${NC}"
    echo -e "  │  systemctl start   webspeedtest-api   # hidupkan"
    echo -e "  │  systemctl stop    webspeedtest-api   # matikan"
    echo -e "  │  systemctl restart webspeedtest-api   # restart"
    echo -e "  │  systemctl enable  webspeedtest-api   # aktifkan auto-start"
    echo -e "  │  systemctl disable webspeedtest-api   # nonaktifkan auto-start"
    echo -e "  │  systemctl status  webspeedtest-api   # cek status"
    echo -e "  │"
    echo -e "  │  ${CYAN}# Frontend Web (Python3 http.server — port ${FRONTEND_PORT})${NC}"
    echo -e "  │  systemctl start   webspeedtest-web   # hidupkan"
    echo -e "  │  systemctl stop    webspeedtest-web   # matikan"
    echo -e "  │  systemctl restart webspeedtest-web   # restart"
    echo -e "  │  systemctl enable  webspeedtest-web   # aktifkan auto-start"
    echo -e "  │  systemctl disable webspeedtest-web   # nonaktifkan auto-start"
    echo -e "  │  systemctl status  webspeedtest-web   # cek status"
    echo -e "  │"
    echo -e "  │  ${CYAN}# Log realtime${NC}"
    echo -e "  │  journalctl -u webspeedtest-api -f"
    echo -e "  │  journalctl -u webspeedtest-web -f"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${BOLD}  Kedua service otomatis restart jika crash, dan otomatis${NC}"
    echo -e "  ${BOLD}  aktif kembali setiap kali server dinyalakan/reboot.${NC}"
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────
main() {
    mkdir -p "$(dirname "$LOG")"
    touch "$LOG"

    print_banner
    check_root
    check_os
    prompt_config
    install_packages
    install_nodejs
    setup_database
    deploy_files
    create_env
    install_npm_deps
    patch_frontend_config
    setup_api_service
    setup_frontend_service
    setup_firewall
    final_check
}

main "$@"
