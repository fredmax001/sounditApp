#!/bin/bash
# ============================================================
# Sound It - Fresh Production Deploy Script for sounditent.com
# Target: root@72.62.254.251
# Domain: sounditent.com
# Port: 8000 (DO NOT conflict with sounditentsl.com on 8001)
# ============================================================

set -e

SERVER_USER="root"
SERVER_HOST="72.62.254.251"
SERVER_PORT="22"
SSH_PASS='Jul1@n/221/cloudhost'
REMOTE_DIR="/var/www/soundit"
LOCAL_DIR="/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE"
UPLOAD_BACKUP_DIR="/var/backups/soundit-uploads"
PERSISTENT_UPLOAD_DIR="/var/www/soundit-uploads"

SSH="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Sound It — FRESH Production Deploy     ║"
echo "║   Target: $SERVER_HOST                   ║"
echo "║   Domain: sounditent.com                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Step 1: Test SSH connection
echo "▶ [1/6] Testing SSH connection..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"echo 'SSH OK'\""

# Step 2: Server cleanup — stop service, remove old files, clear nginx
echo ""
echo "▶ [2/6] Cleaning server (stopping services, removing old deployment)..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"
  systemctl stop soundit 2>/dev/null || true;
  systemctl disable soundit 2>/dev/null || true;
  echo '▶ Backing up uploads and .env before clean deploy...';
  mkdir -p $UPLOAD_BACKUP_DIR/static;
  if [ -d \"$REMOTE_DIR/uploads\" ]; then
    cp -rL \"$REMOTE_DIR/uploads/\"* $UPLOAD_BACKUP_DIR/ 2>/dev/null || true;
  fi
  if [ -d \"$REMOTE_DIR/static/uploads\" ]; then
    cp -rL \"$REMOTE_DIR/static/uploads/\"* $UPLOAD_BACKUP_DIR/static/ 2>/dev/null || true;
  fi
  if [ -f \"$REMOTE_DIR/.env\" ]; then
    cp \"$REMOTE_DIR/.env\" /tmp/soundit_env_backup 2>/dev/null || true;
  fi
  rm -rf $REMOTE_DIR;
  rm -f /etc/nginx/conf.d/soundit.conf;
  rm -f /etc/nginx/conf.d/soundit.conf.backup*;
  rm -f /etc/systemd/system/soundit.service;
  systemctl daemon-reload;
  echo 'Server cleaned';
\""

# Step 3: Build frontend locally
echo ""
echo "▶ [3/6] Building frontend..."
cd "$LOCAL_DIR/app"
npm run build

# Step 4: Create remote directory and sync project files
echo ""
echo "▶ [4/6] Syncing project files..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"mkdir -p $REMOTE_DIR\""

sshpass -p "$SSH_PASS" rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $SERVER_PORT" \
  --exclude='.venv/' \
  --exclude='venv/' \
  --exclude='.git/' \
  --exclude='.DS_Store' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='soundit_local.db' \
  --exclude='test.db' \
  --exclude='*.log' \
  --exclude='.playwright-mcp/' \
  --exclude='node_modules/' \
  --exclude='app/node_modules/' \
  --exclude='.vscode/' \
  --exclude='sound-it-platform/' \
  --exclude='Web images/' \
  --exclude='uploads/' \
  --exclude='static/uploads/' \
  --exclude='AGENTS.md' \
  --exclude='AUDIT_REPORT_*.md' \
  --exclude='DEPLOYMENT_CHECKLIST.md' \
  --exclude='MIGRATIONS.md' \
  --exclude='prompts/' \
  --exclude='docs/' \
  --exclude='tests/' \
  --exclude='scripts/' \
  --exclude='cli/' \
  "$LOCAL_DIR/" \
  "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"

echo ""
echo "▶ Restoring .env and uploads on server..."

# Restore .env if it was backed up
eval "$SSH $SERVER_USER@$SERVER_HOST \"
  if [ -f /tmp/soundit_env_backup ]; then
    cp /tmp/soundit_env_backup $REMOTE_DIR/.env
    rm -f /tmp/soundit_env_backup
    echo '.env restored'
  fi
\""

# Create temporary restore script to avoid eval quoting issues
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

# Copy and execute restore script on server
sshpass -p "$SSH_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SERVER_PORT" \
  "$RESTORE_SCRIPT" "$SERVER_USER@$SERVER_HOST:/tmp/restore_uploads.sh"

eval "$SSH $SERVER_USER@$SERVER_HOST \"bash /tmp/restore_uploads.sh\""

eval "$SSH $SERVER_USER@$SERVER_HOST \"rm -f /tmp/restore_uploads.sh\""
rm -f "$RESTORE_SCRIPT"

# Step 5: Upload deployment configs
echo ""
echo "▶ [5/6] Uploading deployment configs..."
sshpass -p "$SSH_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P $SERVER_PORT \
  "$LOCAL_DIR/deploy/nginx_sounditent.conf" \
  "$LOCAL_DIR/deploy/sounditent.service" \
  "$LOCAL_DIR/deploy/server_setup_sounditent.sh" \
  "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/deploy/"

# Step 6: Run remote setup
echo ""
echo "▶ [6/6] Running remote setup..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"bash $REMOTE_DIR/deploy/server_setup_sounditent.sh\""

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   [OK] Fresh Deployment Complete!          ║"
echo "║   https://sounditent.com                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
