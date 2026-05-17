#!/bin/bash
# ============================================================
# SOUND IT — CHINA SERVER SETUP SCRIPT
# Server: Alibaba Cloud ECS (47.100.211.43)
# Domain: sounditent.cn
# Run as root
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# 1. SYSTEM UPDATE & DEPENDENCIES
# ============================================================
log "Updating system packages..."
apt-get update && apt-get upgrade -y

log "Installing dependencies..."
apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    curl \
    wget \
    git \
    unzip \
    rsync \
    htop \
    fail2ban \
    ufw \
    logrotate

# ============================================================
# 2. FIREWALL CONFIGURATION
# ============================================================
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# ============================================================
# 3. FAIL2BAN (Brute-force protection)
# ============================================================
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# ============================================================
# 4. NGINX CACHE DIRECTORY
# ============================================================
log "Creating nginx cache directories..."
mkdir -p /var/cache/nginx/soundit_media
chown -R nginx:nginx /var/cache/nginx

# ============================================================
# 5. DEPLOYMENT DIRECTORY
# ============================================================
log "Creating deployment directories..."
mkdir -p /var/www/soundit/app/dist
mkdir -p /var/www/certbot
mkdir -p /var/log/nginx
chown -R nginx:nginx /var/www/soundit

# ============================================================
# 6. COPY NGINX CONFIG
# ============================================================
log "Installing nginx configuration..."
# NOTE: Copy the nginx-china.conf file to this server first
# cp /path/to/nginx-china.conf /etc/nginx/conf.d/soundit.conf

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t || error "Nginx configuration test failed"

# ============================================================
# 7. SSL CERTIFICATE (Let's Encrypt)
# ============================================================
log "Obtaining SSL certificate for sounditent.cn..."
# IMPORTANT: Ensure DNS A record for sounditent.cn points to 47.100.211.43
certbot --nginx -d sounditent.cn -d www.sounditent.cn --non-interactive --agree-tos --email admin@sounditent.com || \
    warn "Certbot failed — you may need to run manually after DNS is configured"

# Auto-renewal cron job
echo "0 3 * * * /usr/bin/certbot renew --quiet --nginx" | crontab -

# ============================================================
# 8. START NGINX
# ============================================================
log "Starting nginx..."
systemctl enable nginx
systemctl restart nginx

# ============================================================
# 9. LOGROTATE
# ============================================================
log "Configuring logrotate..."
cat > /etc/logrotate.d/soundit << 'EOF'
/var/log/nginx/soundit_cn_access.log /var/log/nginx/soundit_cn_error.log {
    daily
    rotate 30
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
EOF

# ============================================================
# 10. HEALTH CHECK SCRIPT
# ============================================================
log "Creating health check script..."
cat > /usr/local/bin/soundit-health-check.sh << 'EOF'
#!/bin/bash
# Health check: verify API connectivity to main server
MAIN_API="https://sounditent.com/health"
CN_DOMAIN="https://sounditent.cn/health"

main_status=$(curl -s -o /dev/null -w "%{http_code}" "$MAIN_API" 2>/dev/null)
cn_status=$(curl -s -o /dev/null -w "%{http_code}" "$CN_DOMAIN" 2>/dev/null)

if [ "$main_status" != "200" ]; then
    echo "[$(date)] WARNING: Main API unreachable (HTTP $main_status)" >> /var/log/soundit-health.log
fi

if [ "$cn_status" != "200" ]; then
    echo "[$(date)] WARNING: China frontend unreachable (HTTP $cn_status)" >> /var/log/soundit-health.log
fi
EOF
chmod +x /usr/local/bin/soundit-health-check.sh

# Run health check every 5 minutes
echo "*/5 * * * * /usr/local/bin/soundit-health-check.sh" | crontab -

# ============================================================
# DONE
# ============================================================
log "============================================================"
log "China server setup COMPLETE!"
log "============================================================"
log ""
log "Next steps:"
log "  1. Copy frontend build to /var/www/soundit/app/dist/"
log "  2. Copy nginx-china.conf to /etc/nginx/conf.d/soundit.conf"
log "  3. Run: nginx -t && systemctl restart nginx"
log "  4. Verify: curl -s https://sounditent.cn/health"
log ""
log "Firewall status:"
ufw status
log ""
log "Nginx status:"
systemctl status nginx --no-pager
