#!/bin/bash
# ============================================================
# Sound It - Remote Server Setup for sounditent.com
# Run on AlmaLinux server
# ============================================================

set -e

REMOTE_DIR="/var/www/soundit"
VENV="$REMOTE_DIR/venv"

echo ""
echo "══════════════════════════════════════════"
echo "  Sound It — Fresh Server Setup"
echo "  Domain: sounditent.com"
echo "  Port: 8000"
echo "══════════════════════════════════════════"
echo ""

cd $REMOTE_DIR

# ── Install system packages ────────────────────────────────
echo "▶ Installing/updating system packages..."
dnf install -y python3-pip nginx postgresql-server postgresql-contrib tesseract tesseract-langpack-chi_sim 2>/dev/null || true
dnf install -y redis 2>/dev/null || dnf install -y redis6 2>/dev/null || true

# ── Ensure Redis is running ────────────────────────────────
echo "▶ Starting Redis..."
systemctl enable redis --now 2>/dev/null || systemctl enable redis-server --now 2>/dev/null || true
systemctl start redis 2>/dev/null || systemctl start redis-server 2>/dev/null || true

# ── Python + venv ──────────────────────────────────────────
echo "▶ Setting up Python virtual environment..."
if [ -d "$VENV" ] && [ ! -f "$VENV/bin/pip" ]; then
    rm -rf $VENV
fi
if [ ! -d "$VENV" ]; then
    python3 -m venv $VENV
fi

$VENV/bin/pip install --upgrade pip -q
$VENV/bin/pip install -r requirements.txt -q

echo "[OK] Python dependencies installed."

# ── Environment file ───────────────────────────────────────
echo "▶ Setting up environment..."
if [ ! -f "$REMOTE_DIR/.env" ]; then
    if [ -f "$REMOTE_DIR/.env.production" ]; then
        cp "$REMOTE_DIR/.env.production" "$REMOTE_DIR/.env"
        echo "[WARN]  Copied .env.production to .env — generating missing secrets..."
    else
        echo "[WARN]  No .env or .env.production found — service may fail to start."
    fi
fi

# Generate secrets if empty
if [ -f "$REMOTE_DIR/.env" ]; then
    NEW_SECRET_KEY=$(openssl rand -hex 64)
    NEW_JWT_SECRET=$(openssl rand -hex 64)

    # Only update if current value is empty
    if grep -q 'SECRET_KEY=""' "$REMOTE_DIR/.env"; then
        sed -i "s|SECRET_KEY=\"\"|SECRET_KEY=\"$NEW_SECRET_KEY\"|" "$REMOTE_DIR/.env"
        echo "[OK] Generated SECRET_KEY"
    fi
    if grep -q 'JWT_SECRET=""' "$REMOTE_DIR/.env"; then
        sed -i "s|JWT_SECRET=\"\"|JWT_SECRET=\"$NEW_JWT_SECRET\"|" "$REMOTE_DIR/.env"
        echo "[OK] Generated JWT_SECRET"
    fi
fi

# ── Fix permissions ────────────────────────────────────────
echo "▶ Setting file permissions..."
mkdir -p $REMOTE_DIR/static/uploads
mkdir -p $REMOTE_DIR/uploads
mkdir -p $REMOTE_DIR/logs
WEB_USER=$(id -u nginx >/dev/null 2>&1 && echo "nginx" || echo "root")
chown -R ${WEB_USER}:${WEB_USER} $REMOTE_DIR/dist
chown -R ${WEB_USER}:${WEB_USER} $REMOTE_DIR/static
chown -R ${WEB_USER}:${WEB_USER} $REMOTE_DIR/uploads
chown -R ${WEB_USER}:${WEB_USER} $REMOTE_DIR/logs
chmod -R 755 $REMOTE_DIR/dist
chmod -R 755 $REMOTE_DIR/static
chmod -R 755 $REMOTE_DIR/uploads

# ── Nginx Configuration ────────────────────────────────────
echo "▶ Configuring Nginx..."
cp $REMOTE_DIR/deploy/nginx_sounditent.conf /etc/nginx/conf.d/soundit.conf
nginx -t && systemctl reload nginx

echo "[OK] Nginx configured."

# ── Systemd Service ────────────────────────────────────────
echo "▶ Installing systemd service..."
cp $REMOTE_DIR/deploy/sounditent.service /etc/systemd/system/soundit.service
systemctl daemon-reload
systemctl enable soundit

# Restart (or start) the app
echo "▶ Starting Sound It service..."
systemctl restart soundit

sleep 3

# ── Status check ───────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
if systemctl is-active --quiet soundit; then
    echo "  [OK] Sound It is RUNNING"
    echo "     https://sounditent.com"
    echo "     https://sounditent.com/health"
    echo "     https://sounditent.com/api/v1/docs"
else
    echo "  [ERR] Service failed to start. Check logs:"
    echo "     journalctl -u soundit -n 50"
fi
echo "══════════════════════════════════════════"
echo ""
