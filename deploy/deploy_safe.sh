#!/bin/bash
# ============================================================
# Sound It — Safe Production Deploy Script for sounditent.com
# Uses SSH ControlMaster to avoid multiple connections (prevents Fail2Ban)
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

# SSH with ControlMaster for a single persistent connection
SSH_CONTROL="/tmp/ssh_control_soundit_$$"
SSH_BASE="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlMaster=auto -o ControlPath=$SSH_CONTROL -o ControlPersist=10m -p $SERVER_PORT"
SSH="sshpass -p '$SSH_PASS' $SSH_BASE"
SCP="sshpass -p '$SSH_PASS' scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlPath=$SSH_CONTROL"
RSYNC_SSH="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlPath=$SSH_CONTROL -p $SERVER_PORT"

cleanup() {
  echo ""
  echo "Closing SSH master connection..."
  $SSH_BASE -O exit $SERVER_USER@$SERVER_HOST 2>/dev/null || true
  rm -f $SSH_CONTROL 2>/dev/null || true
}
trap cleanup EXIT

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Sound It — Safe Production Deploy      ║"
echo "║   Target: $SERVER_HOST                   ║"
echo "║   Domain: sounditent.com                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Step 0: Open persistent SSH connection
echo "▶ [0/6] Opening persistent SSH connection..."
sshpass -p "$SSH_PASS" $SSH_BASE -fN $SERVER_USER@$SERVER_HOST
sleep 1
eval "$SSH $SERVER_USER@$SERVER_HOST \"echo 'SSH OK'\""

# Step 1: Build frontend locally FIRST (before touching server)
echo ""
echo "▶ [1/6] Building frontend locally..."
cd "$LOCAL_DIR/app"
npm run build

# Step 2: Server cleanup — stop service, backup data, remove old files
echo ""
echo "▶ [2/6] Preparing server (backup + cleanup)..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"
  set -e
  echo 'Stopping soundit service...'
  systemctl stop soundit 2>/dev/null || true
  systemctl disable soundit 2>/dev/null || true
  
  echo 'Backing up uploads and .env...'
  mkdir -p $UPLOAD_BACKUP_DIR/static
  if [ -d '$REMOTE_DIR/uploads' ]; then
    cp -rL '$REMOTE_DIR/uploads/'* $UPLOAD_BACKUP_DIR/ 2>/dev/null || true
  fi
  if [ -d '$REMOTE_DIR/static/uploads' ]; then
    cp -rL '$REMOTE_DIR/static/uploads/'* $UPLOAD_BACKUP_DIR/static/ 2>/dev/null || true
  fi
  if [ -f '$REMOTE_DIR/.env' ]; then
    cp '$REMOTE_DIR/.env' /tmp/soundit_env_backup 2>/dev/null || true
  fi
  
  echo 'Removing old deployment...'
  rm -rf $REMOTE_DIR
  rm -f /etc/nginx/conf.d/soundit.conf
  rm -f /etc/systemd/system/soundit.service
  systemctl daemon-reload
  echo 'Server prepared'
\""

# Step 3: Create remote directory
echo ""
echo "▶ [3/6] Creating remote directory..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"mkdir -p $REMOTE_DIR\""

# Step 4: Sync project files using rsync (single SSH connection via ControlMaster)
echo ""
echo "▶ [4/6] Syncing project files..."
sshpass -p "$SSH_PASS" rsync -avz --delete \
  -e "$RSYNC_SSH" \
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

# Step 5: Restore uploads and .env
echo ""
echo "▶ [5/6] Restoring persistent data..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"
  set -e
  mkdir -p $REMOTE_DIR/uploads $REMOTE_DIR/static/uploads $PERSISTENT_UPLOAD_DIR
  
  if [ -d '$UPLOAD_BACKUP_DIR' ]; then
    cp -rL $UPLOAD_BACKUP_DIR/* '$REMOTE_DIR/uploads/' 2>/dev/null || true
    cp -rL $UPLOAD_BACKUP_DIR/static/* '$REMOTE_DIR/static/uploads/' 2>/dev/null || true
    cp -rL $UPLOAD_BACKUP_DIR/static/* '$PERSISTENT_UPLOAD_DIR/' 2>/dev/null || true
  fi
  
  if [ -f '/tmp/soundit_env_backup' ]; then
    cp /tmp/soundit_env_backup '$REMOTE_DIR/.env'
    rm -f /tmp/soundit_env_backup
  fi
  
  # Ensure .env exists with DB credentials
  if [ ! -f '$REMOTE_DIR/.env' ]; then
    cp '$REMOTE_DIR/.env.production' '$REMOTE_DIR/.env' 2>/dev/null || true
  fi
  
  chown -R root:root $REMOTE_DIR/uploads $REMOTE_DIR/static/uploads $PERSISTENT_UPLOAD_DIR
  chmod -R 755 $REMOTE_DIR/uploads $REMOTE_DIR/static/uploads $PERSISTENT_UPLOAD_DIR
\""

# Step 6: Run server setup
echo ""
echo "▶ [6/6] Running server setup..."
eval "$SSH $SERVER_USER@$SERVER_HOST \"cd $REMOTE_DIR && bash deploy/server_setup_sounditent.sh\""

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         DEPLOYMENT COMPLETE              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Check: https://sounditent.com/health"
