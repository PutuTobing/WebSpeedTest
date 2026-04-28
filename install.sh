#!/bin/bash
# ================================================================
#  WebSpeedTest — Auto Installer & Updater
#  Repo   : https://github.com/PutuTobing/WebSpeedTest
#  Version: 1.2.0
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
MODE=""   # "install" atau "upgrade"

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
    echo -e "${RED}║              ✗  PROSES GAGAL                         ║${NC}"
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
    echo -e "  ${BOLD}Auto Installer & Updater v1.2.0 — SKY TECH${NC}"
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

# ── Detect mode (install baru atau upgrade) ───────────────────────
detect_mode() {
    if [[ -d "${INSTALL_DIR}" && -f "${INSTALL_DIR}/api/.env" ]]; then
        echo ""
        echo -e "  ${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
        echo -e "  ${YELLOW}║  ⚠  Instalasi WebSpeedTest sudah ada di sistem!      ║${NC}"
        echo -e "  ${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "  ${BOLD}Pilih mode:${NC}"
        echo ""
        echo -e "  ${CYAN}[1]${NC} ${BOLD}Update / Upgrade${NC}  — Update ke versi terbaru"
        echo -e "           Data, password, dan konfigurasi lama tetap aman"
        echo ""
        echo -e "  ${CYAN}[2]${NC} ${BOLD}Instalasi Ulang${NC}   — Bersihkan semua dan install dari awal"
        echo -e "           ${RED}⚠ Data aplikasi akan dihapus!${NC}"
        echo ""
        echo -e "  ${CYAN}[0]${NC} Batal"
        echo ""
        read -rp "  Pilihan [1/2/0]: " choice
        case "$choice" in
            1) MODE="upgrade" ;;
            2) MODE="install"
               echo ""
               warn "Semua data di ${INSTALL_DIR} akan dihapus!"
               read -rp "  Ketik 'YA' untuk konfirmasi: " konfirm
               if [[ "$konfirm" != "YA" ]]; then
                   echo -e "\n  Dibatalkan."
                   exit 0
               fi
               ;;
            0) echo -e "\n  Dibatalkan."; exit 0 ;;
            *) error "Pilihan tidak valid."; exit 1 ;;
        esac
    else
        MODE="install"
    fi
}

# ══════════════════════════════════════════════════════════════════
#  MODE: UPGRADE
# ══════════════════════════════════════════════════════════════════
do_upgrade() {
    print_banner
    echo -e "  ${BOLD}${GREEN}► MODE: UPDATE / UPGRADE KE VERSI TERBARU${NC}"
    echo ""

    if [[ ! -f "${SCRIPT_DIR}/api/server.js" || ! -f "${SCRIPT_DIR}/index.html" ]]; then
        error "File project tidak ditemukan di ${SCRIPT_DIR}/"
        error "Pastikan install.sh dijalankan dari dalam direktori WebSpeedTest."
        exit 1
    fi

    local server_ip
    server_ip=$(hostname -I | awk '{print $1}')
    local backup_ts
    backup_ts=$(date '+%Y%m%d_%H%M%S')

    # Stop services
    step "Menghentikan service"
    systemctl stop webspeedtest-api >> "$LOG" 2>&1 || warn "webspeedtest-api tidak berjalan"
    systemctl stop webspeedtest-web >> "$LOG" 2>&1 || warn "webspeedtest-web tidak berjalan"
    success "Service dihentikan"

    # Backup .env
    step "Backup konfigurasi"
    local env_backup="/root/.webspeedtest_env_${backup_ts}.bak"
    cp "${INSTALL_DIR}/api/.env" "${env_backup}"
    success "Backup .env: ${env_backup}"

    # Baca port dari .env lama
    API_PORT=$(grep "^API_PORT=" "${INSTALL_DIR}/api/.env" 2>/dev/null | cut -d= -f2 | tr -d ' \r' || echo "3001")
    API_PORT="${API_PORT:-3001}"

    # Baca frontend port dari service
    FRONTEND_PORT=$(grep "http.server" /etc/systemd/system/webspeedtest-web.service 2>/dev/null | grep -o '[0-9]\{4,5\}' | tail -1 || echo "8000")
    FRONTEND_PORT="${FRONTEND_PORT:-8000}"
    success "Konfigurasi lama: API port ${API_PORT}, Frontend port ${FRONTEND_PORT}"

    # Backup folder aplikasi
    local app_backup="${INSTALL_DIR}.bak_${backup_ts}"
    info "Membuat backup folder aplikasi..."
    cp -r "${INSTALL_DIR}" "${app_backup}" >> "$LOG" 2>&1 && \
        success "Backup aplikasi: ${app_backup}" || \
        warn "Tidak bisa membuat backup folder, melanjutkan..."

    # Update file aplikasi (TIDAK menyentuh .env)
    step "Update file aplikasi"

    for html in admin.html dashboard.html index.html login.html; do
        [[ -f "${SCRIPT_DIR}/${html}" ]] && cp "${SCRIPT_DIR}/${html}" "${INSTALL_DIR}/" && info "Updated: ${html}"
    done

    if [[ -d "${SCRIPT_DIR}/assets" ]]; then
        rm -rf "${INSTALL_DIR}/assets"
        cp -r "${SCRIPT_DIR}/assets" "${INSTALL_DIR}/"
        success "Updated: assets/ (CSS & JavaScript)"
    fi

    for file in server.js database.js package.json; do
        [[ -f "${SCRIPT_DIR}/api/${file}" ]] && cp "${SCRIPT_DIR}/api/${file}" "${INSTALL_DIR}/api/" && info "Updated: api/${file}"
    done

    for dir in routes middleware; do
        if [[ -d "${SCRIPT_DIR}/api/${dir}" ]]; then
            rm -rf "${INSTALL_DIR}/api/${dir}"
            cp -r "${SCRIPT_DIR}/api/${dir}" "${INSTALL_DIR}/api/"
            info "Updated: api/${dir}/"
        fi
    done

    success "File aplikasi diupdate (.env tidak diubah)"

    # Patch frontend config dengan port lama
    step "Update konfigurasi frontend"
    local config_file="${INSTALL_DIR}/assets/js/shared/config.js"
    if [[ -f "$config_file" ]]; then
        cat > "$config_file" <<EOF
// Auto-configured by install.sh — updated: $(date '+%Y-%m-%d %H:%M:%S')
window.API_URL = window.location.protocol + '//' + window.location.hostname + ':${API_PORT}';
EOF
        success "Frontend config diupdate — API port: ${API_PORT}"
    fi

    # npm install
    step "Update Node.js dependencies"
    cd "${INSTALL_DIR}/api"
    npm install --omit=dev --loglevel=warn >> "$LOG" 2>&1 || {
        error "npm install gagal. Cek log: $LOG"
        warn "Melakukan rollback..."
        cp -r "${app_backup}/." "${INSTALL_DIR}/" >> "$LOG" 2>&1 || true
        systemctl start webspeedtest-api >> "$LOG" 2>&1 || true
        systemctl start webspeedtest-web >> "$LOG" 2>&1 || true
        exit 1
    }
    success "Dependencies diupdate"

    # Fix permissions
    chown -R www-data:www-data "${INSTALL_DIR}" >> "$LOG" 2>&1 || true
    chmod -R 755 "${INSTALL_DIR}" >> "$LOG" 2>&1 || true
    chmod 600 "${INSTALL_DIR}/api/.env"

    # Restart services
    step "Menjalankan kembali service"
    systemctl daemon-reload >> "$LOG" 2>&1
    systemctl restart webspeedtest-api >> "$LOG" 2>&1 || {
        error "Gagal restart API. Cek: journalctl -u webspeedtest-api -n 30"
        exit 1
    }
    systemctl restart webspeedtest-web >> "$LOG" 2>&1 || {
        error "Gagal restart frontend. Cek: journalctl -u webspeedtest-web -n 30"
        exit 1
    }
    success "Service berhasil direstart"

    # Verifikasi
    step "Verifikasi"
    sleep 3
    local all_ok=true

    if curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/api/health" > /dev/null 2>&1; then
        success "API UP — http://${server_ip}:${API_PORT}"
    else
        warn "API belum merespons. Cek: journalctl -u webspeedtest-api -n 30"
        all_ok=false
    fi

    if curl -sf --max-time 5 "http://127.0.0.1:${FRONTEND_PORT}/" > /dev/null 2>&1; then
        success "Frontend UP — http://${server_ip}:${FRONTEND_PORT}"
    else
        warn "Frontend belum merespons. Cek: systemctl status webspeedtest-web"
        all_ok=false
    fi

    echo ""
    if [[ "$all_ok" == true ]]; then
        echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║          ✓  UPDATE BERHASIL!                              ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║     ⚠  UPDATE SELESAI (ada peringatan di atas)           ║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
    fi

    echo ""
    echo -e "  ${BOLD}📋 Ringkasan Update:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  Frontend   : http://${server_ip}:${FRONTEND_PORT}"
    echo -e "  │  API        : http://${server_ip}:${API_PORT}"
    echo -e "  │  Backup .env: ${env_backup}"
    echo -e "  │  Backup app : ${app_backup}"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${CYAN}✓ Password, data, dan konfigurasi tidak berubah.${NC}"
    echo ""
}

# ══════════════════════════════════════════════════════════════════
#  MODE: FRESH INSTALL
# ══════════════════════════════════════════════════════════════════

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

install_packages() {
    step "Update & install paket sistem"

    local lock_wait=0
    local lock_max=180
    while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock \
                /var/lib/dpkg/lock /var/cache/apt/archives/lock \
                >/dev/null 2>&1; do
        if [[ $lock_wait -eq 0 ]]; then
            info "Menunggu proses apt/dpkg lain selesai..."
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

    apt-get update -qq >> "$LOG" 2>&1 || { error "apt-get update gagal."; exit 1; }
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
        error "Gagal download NodeSource setup."
        exit 1
    }
    bash /tmp/nodesource_setup.sh >> "$LOG" 2>&1
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >> "$LOG" 2>&1 || {
        error "Gagal install nodejs."
        exit 1
    }
    rm -f /tmp/nodesource_setup.sh
    success "Node.js $(node --version) berhasil diinstall"
}

setup_database() {
    step "Setup database MySQL"

    systemctl start mysql  >> "$LOG" 2>&1 || \
    systemctl start mariadb >> "$LOG" 2>&1 || {
        error "Gagal menjalankan MySQL/MariaDB."
        exit 1
    }
    systemctl enable mysql  >> "$LOG" 2>&1 || \
    systemctl enable mariadb >> "$LOG" 2>&1 || true
    success "MySQL/MariaDB berjalan"

    mysql -u root 2>>"$LOG" <<EOF || { error "Gagal setup database."; exit 1; }
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF
    success "Database dan user berhasil dibuat"

    mysql -u root "${DB_NAME}" 2>>"$LOG" <<'EOSQL' || { error "Gagal membuat tabel."; exit 1; }
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

deploy_files() {
    step "Deploy file aplikasi"

    if [[ ! -f "${SCRIPT_DIR}/api/server.js" || ! -f "${SCRIPT_DIR}/index.html" ]]; then
        error "File project tidak ditemukan. Jalankan dari direktori WebSpeedTest."
        exit 1
    fi

    rm -rf "${INSTALL_DIR}"
    mkdir -p "${INSTALL_DIR}"
    info "Menyalin file ke ${INSTALL_DIR}..."

    for html in admin.html dashboard.html index.html login.html; do
        [[ -f "${SCRIPT_DIR}/${html}" ]] && cp "${SCRIPT_DIR}/${html}" "${INSTALL_DIR}/"
    done

    [[ -d "${SCRIPT_DIR}/assets" ]] && cp -r "${SCRIPT_DIR}/assets" "${INSTALL_DIR}/"

    mkdir -p "${INSTALL_DIR}/api"
    for item in server.js database.js package.json; do
        [[ -f "${SCRIPT_DIR}/api/${item}" ]] && cp "${SCRIPT_DIR}/api/${item}" "${INSTALL_DIR}/api/"
    done
    for item in routes middleware; do
        [[ -d "${SCRIPT_DIR}/api/${item}" ]] && cp -r "${SCRIPT_DIR}/api/${item}" "${INSTALL_DIR}/api/"
    done

    success "File berhasil disalin ke ${INSTALL_DIR}"
}

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

BACKUP_KEY=${backup_key}
EOF
    chmod 600 "${INSTALL_DIR}/api/.env"
    success ".env berhasil dibuat (mode 600)"
}

patch_frontend_config() {
    step "Patch konfigurasi frontend"
    local config_file="${INSTALL_DIR}/assets/js/shared/config.js"
    mkdir -p "$(dirname "$config_file")"
    cat > "$config_file" <<EOF
// Auto-configured by install.sh — $(date '+%Y-%m-%d %H:%M:%S')
window.API_URL = window.location.protocol + '//' + window.location.hostname + ':${API_PORT}';
EOF
    success "Frontend config diupdate — API port: ${API_PORT}"
}

install_npm_deps() {
    step "Install Node.js dependencies"
    cd "${INSTALL_DIR}/api"
    npm install --omit=dev --loglevel=warn >> "$LOG" 2>&1 || {
        error "npm install gagal. Lihat log: $LOG"
        exit 1
    }
    success "npm dependencies berhasil diinstall"
}

insert_admin_user() {
    step "Membuat akun admin"
    local final_hash
    final_hash=$(cd "${INSTALL_DIR}/api" && node -e "
        const bcrypt = require('bcrypt');
        bcrypt.hash('${ADMIN_PASS}', 10).then(h => process.stdout.write(h)).catch(() => process.exit(1));
    " 2>>"$LOG") || {
        warn "Tidak bisa hash password, buat akun admin manual via panel"
        return
    }

    mysql -u root "${DB_NAME}" 2>>"$LOG" <<EOF || warn "Akun admin mungkin sudah ada"
INSERT IGNORE INTO users (username, password_hash, role, fullname, status)
VALUES ('admin', '${final_hash}', 'admin', 'Administrator', 'active');
EOF
    success "Akun admin 'admin' berhasil dibuat"
}

setup_api_service() {
    step "Setup systemd service — API Backend"
    local node_bin
    node_bin=$(which node)

    cat > "/etc/systemd/system/webspeedtest-api.service" <<EOF
[Unit]
Description=WebSpeedTest API Server
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
        error "Gagal start API. Cek: journalctl -u webspeedtest-api -n 50"
        exit 1
    }
    success "webspeedtest-api aktif (auto-start saat boot)"
}

setup_frontend_service() {
    step "Setup systemd service — Frontend Web"
    local python_bin
    python_bin=$(which python3)

    cat > "/etc/systemd/system/webspeedtest-web.service" <<EOF
[Unit]
Description=WebSpeedTest Frontend Web Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${INSTALL_DIR}
ExecStart=${python_bin} -m http.server ${FRONTEND_PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webspeedtest-web

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload >> "$LOG" 2>&1
    systemctl enable webspeedtest-web >> "$LOG" 2>&1
    systemctl restart webspeedtest-web >> "$LOG" 2>&1 || {
        error "Gagal start frontend. Cek: journalctl -u webspeedtest-web -n 50"
        exit 1
    }
    success "webspeedtest-web aktif (auto-start saat boot)"
}

install_phpmyadmin() {
    step "Install phpMyAdmin"
    echo 'phpmyadmin phpmyadmin/dbconfig-install boolean false'            | debconf-set-selections
    echo 'phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2' | debconf-set-selections
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
        apache2 php php-mysql libapache2-mod-php phpmyadmin >> "$LOG" 2>&1 || {
        warn "phpMyAdmin gagal. Install manual: sudo apt-get install phpmyadmin"
        return
    }
    a2enconf phpmyadmin >> "$LOG" 2>&1 || true
    systemctl enable apache2 >> "$LOG" 2>&1
    systemctl restart apache2 >> "$LOG" 2>&1
    local server_ip
    server_ip=$(hostname -I | awk '{print $1}')
    success "phpMyAdmin: http://${server_ip}/phpmyadmin/"
}

setup_firewall() {
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
        step "Konfigurasi firewall (ufw)"
        ufw allow "${FRONTEND_PORT}/tcp" comment "WebSpeedTest Frontend" >> "$LOG" 2>&1
        ufw allow "${API_PORT}/tcp"      comment "WebSpeedTest API"      >> "$LOG" 2>&1
        ufw allow "80/tcp"               comment "Apache2 phpMyAdmin"    >> "$LOG" 2>&1
        success "Port ${FRONTEND_PORT}, ${API_PORT}, 80 dibuka"
    fi
}

final_check() {
    step "Verifikasi instalasi"
    local all_ok=true
    local server_ip
    server_ip=$(hostname -I | awk '{print $1}')
    sleep 3

    curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/api/health" > /dev/null 2>&1 && \
        success "API server UP" || { warn "API belum merespons"; all_ok=false; }

    curl -sf --max-time 5 "http://127.0.0.1:${FRONTEND_PORT}/" > /dev/null 2>&1 && \
        success "Frontend UP" || { warn "Frontend belum merespons"; all_ok=false; }

    { systemctl is-active --quiet mysql || systemctl is-active --quiet mariadb; } && \
        success "MySQL/MariaDB UP" || { warn "MySQL tidak berjalan"; all_ok=false; }

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
    echo -e "  │  Frontend    : http://${server_ip}:${FRONTEND_PORT}"
    echo -e "  │  API Health  : http://${server_ip}:${API_PORT}/api/health"
    echo -e "  │  phpMyAdmin  : http://${server_ip}/phpmyadmin/"
    echo -e "  │  Login admin : admin / (password yang Anda set tadi)"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${BOLD}📁 Lokasi File:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  Aplikasi : ${INSTALL_DIR}"
    echo -e "  │  Config   : ${INSTALL_DIR}/api/.env"
    echo -e "  │  Log      : ${LOG}"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${BOLD}🔧 Perintah Service:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  systemctl restart webspeedtest-api   # restart API"
    echo -e "  │  systemctl restart webspeedtest-web   # restart frontend"
    echo -e "  │  journalctl -u webspeedtest-api -f    # log real-time"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
    echo -e "  ${BOLD}🔄 Cara update ke versi terbaru:${NC}"
    echo -e "  ┌────────────────────────────────────────────────────────┐"
    echo -e "  │  git pull origin main && sudo bash install.sh          │"
    echo -e "  │  (pilih opsi [1] Update saat diminta)                  │"
    echo -e "  └────────────────────────────────────────────────────────┘"
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────
main() {
    mkdir -p "$(dirname "$LOG")"
    touch "$LOG"

    print_banner
    check_root
    check_os
    detect_mode

    if [[ "$MODE" == "upgrade" ]]; then
        do_upgrade
        exit 0
    fi

    # Fresh install
    echo -e "  ${BOLD}${GREEN}► MODE: INSTALASI BARU${NC}"
    echo ""

    prompt_config
    install_packages
    install_nodejs
    install_phpmyadmin
    setup_database
    deploy_files
    create_env
    install_npm_deps
    patch_frontend_config
    setup_api_service
    setup_frontend_service
    insert_admin_user
    setup_firewall
    final_check
}

main "$@"
