#!/bin/bash
set -e
SERVER_USER="root"
SERVER_HOST="72.62.254.251"
SERVER_PORT="22"
SSH_PASS='Jul1@n/221/cloudhost'
REMOTE_DIR="/var/www/soundit"
LOCAL_DIR="/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE"
SSH="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "▶ Resuming deployment..."

RESTORE_SCRIPT=$(mktemp)
cat > "$RESTORE_SCRIPT" << 'RESTORE_EOF'
#!/bin/bash
set -e
PERSISTENT_UPLOAD_DIR="/var/www/soundit-uploads"
UPLOAD_BACKUP_DIR="/var/backups/soundit-uploads"
REMOTE_DIR="/var/www/soundit"

mkdir -p "$PERSISTENT_UPLOAD_DIR"
if id -u nginx >/dev/null 2>&1; then
  chown -R nginx:nginx "$PERSISTENT_UPLOAD_DIR"
else
  chown -R root:root "$PERSISTENT_UPLOAD_DIR"
fi
chmod -R 755 "$PERSISTENT_UPLOAD_DIR"

mkdir -p "$REMOTE_DIR/uploads"
mkdir -p "$REMOTE_DIR/static/uploads"

if [ -d "$UPLOAD_BACKUP_DIR" ]; then
  for entry in "$UPLOAD_BACKUP_DIR"/*; do
    [ -e "$entry" ] || continue
    basename_entry=$(basename "$entry")
    [ "$basename_entry" = "static" ] && continue
    cp -rL "$entry" "$REMOTE_DIR/uploads/" 2>/dev/null || true
  done
fi
if [ -d "$UPLOAD_BACKUP_DIR/static" ] && [ -n "$(ls -A "$UPLOAD_BACKUP_DIR/static" 2>/dev/null)" ]; then
  cp -rL "$UPLOAD_BACKUP_DIR/static"/* "$PERSISTENT_UPLOAD_DIR/" 2>/dev/null || true
fi

if id -u nginx >/dev/null 2>&1; then
  chown -R nginx:nginx "$REMOTE_DIR/uploads" "$REMOTE_DIR/static/uploads" "$PERSISTENT_UPLOAD_DIR"
else
  chown -R root:root "$REMOTE_DIR/uploads" "$REMOTE_DIR/static/uploads" "$PERSISTENT_UPLOAD_DIR"
fi
chmod -R 755 "$REMOTE_DIR/uploads" "$REMOTE_DIR/static/uploads" "$PERSISTENT_UPLOAD_DIR"
echo 'Uploads restored'
RESTORE_EOF

chmod +x "$RESTORE_SCRIPT"

sshpass -p "$SSH_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SERVER_PORT" \
  "$RESTORE_SCRIPT" "$SERVER_USER@$SERVER_HOST:/tmp/restore_uploads.sh"

eval "$SSH $SERVER_USER@$SERVER_HOST \"bash /tmp/restore_uploads.sh\""
eval "$SSH $SERVER_USER@$SERVER_HOST \"rm -f /tmp/restore_uploads.sh\""
rm -f "$RESTORE_SCRIPT"

echo "▶ [5/6] Uploading deployment configs..."
sshpass -p "$SSH_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P $SERVER_PORT \
  "$LOCAL_DIR/deploy/nginx_sounditent.conf" \
  "$LOCAL_DIR/deploy/sounditent.service" \
  "$LOCAL_DIR/deploy/server_setup_sounditent.sh" \
  "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/deploy/"

echo "▶ [6/6] Running remote setup..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"bash $REMOTE_DIR/deploy/server_setup_sounditent.sh\""

echo "╔══════════════════════════════════════════╗"
echo "║   [OK] Resumed Deployment Complete!        ║"
echo "║   https://sounditent.com                 ║"
echo "╚══════════════════════════════════════════╝"
