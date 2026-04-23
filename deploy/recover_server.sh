#!/bin/bash
# Run this on the SERVER itself (via Web Console / VNC / Serial Console)
# This restores the backend after a failed deploy

set -e

echo "=== Sound It Server Recovery ==="

# Set up directories
mkdir -p /var/www/soundit-uploads
mkdir -p /var/www/soundit/uploads
mkdir -p /var/www/soundit/static/uploads

# Restore backed-up files
if [ -d "/var/backups/soundit-uploads" ]; then
  echo "Restoring uploads from backup..."
  cp -rL /var/backups/soundit-uploads/* /var/www/soundit/uploads/ 2>/dev/null || true
  cp -rL /var/backups/soundit-uploads/static/* /var/www/soundit-uploads/ 2>/dev/null || true
fi

# Set permissions
chown -R root:root /var/www/soundit/uploads /var/www/soundit/static/uploads /var/www/soundit-uploads
chmod -R 755 /var/www/soundit/uploads /var/www/soundit/static/uploads /var/www/soundit-uploads

# Fix potential systemd service file if missing
if [ ! -f "/etc/systemd/system/soundit.service" ]; then
cat > /etc/systemd/system/soundit.service << 'EOF'
[Unit]
Description=Sound It FastAPI Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/soundit
Environment="PATH=/var/www/soundit/.venv/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=/var/www/soundit/.env
ExecStart=/var/www/soundit/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
fi

# Reload and start
systemctl daemon-reload
systemctl start soundit
systemctl enable soundit
systemctl restart nginx

# Check status
echo ""
echo "=== Service Status ==="
systemctl is-active soundit && echo "soundit: RUNNING" || echo "soundit: FAILED"
systemctl is-active nginx && echo "nginx: RUNNING" || echo "nginx: FAILED"

echo ""
echo "=== Backend Health Check ==="
curl -s http://localhost:8000/health || echo "Health check failed"

echo ""
echo "=== Recovery Complete ==="
