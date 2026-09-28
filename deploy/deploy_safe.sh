#!/bin/bash
# ============================================================
# Sound It — Safe Versioned Production Deploy
# Target: $SERVER_USER@$SERVER_HOST
# Domain: sounditent.com
#
# This script performs a non-destructive, versioned release:
#   * builds the frontend locally
#   * pushes code to /var/www/soundit/releases/<timestamp>/
#   * preserves .env and uploads via a shared/ directory
#   * runs migrations
#   * smoke-tests the new release on a temporary port
#   * atomically switches the /var/www/soundit/current symlink
#   * restarts the systemd service and health-checks
#   * keeps the last 5 releases and prunes the rest
#
# It prefers key-based SSH auth, but will use sshpass if SSH_PASS
# is provided as an environment variable.
# ============================================================

set -euo pipefail

# SSH password must be provided via the SSH_PASS environment variable.
# Never hardcode credentials in this script (it is tracked in git).
if [ -z "${SSH_PASS:-}" ]; then
  echo "[ERR] SSH_PASS environment variable is not set."
  echo "      Export it before running:  export SSH_PASS='your-password'"
  exit 1
fi
export SSHPASS="$SSH_PASS"

SERVER_USER="root"
SERVER_HOST="72.62.254.251"
SERVER_PORT="22"
REMOTE_DIR="/var/www/soundit"
LOCAL_DIR="/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE"
UPLOAD_BACKUP_DIR="/var/backups/soundit-uploads"
PERSISTENT_UPLOAD_DIR="/var/www/soundit-uploads"

RELEASES_DIR="$REMOTE_DIR/releases"
SHARED_DIR="$REMOTE_DIR/shared"
CURRENT_LINK="$REMOTE_DIR/current"
VENV_DIR="$REMOTE_DIR/venv"
TEMP_PORT="8001"
KEEP_RELEASES=5

TIMESTAMP=$(date +%Y%m%d%H%M%S)
NEW_RELEASE="$RELEASES_DIR/$TIMESTAMP"

trap 'echo ""; echo "[ERR] Deploy failed at line $LINENO. New release $NEW_RELEASE was not activated."' ERR

# SSH/SCP helpers that correctly handle password auth via sshpass
remote() {
  sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "$@"
}

remote_scp() {
  # Usage: remote_scp <local> <remote>
  sshpass -e scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password -P "$SERVER_PORT" "$1" "$2"
}

remote_rsync() {
  # Usage: remote_rsync <src> <dest>
  local ssh_cmd="sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no -o PreferredAuthentications=password -p $SERVER_PORT"
  local rsync_cmd=(rsync -avz --partial --timeout=120 -e "$ssh_cmd"
    --exclude='.venv/'
    --exclude='venv/'
    --exclude='.git/'
    --exclude='.DS_Store'
    --exclude='__pycache__/'
    --exclude='*.pyc'
    --exclude='.env'
    --exclude='.env.local'
    --exclude='soundit_local.db'
    --exclude='test.db'
    --exclude='*.log'
    --exclude='.playwright-mcp/'
    --exclude='node_modules/'
    --exclude='app/node_modules/'
    --exclude='app/android/'
    --exclude='app/ios/'
    --exclude='electron/node_modules/'
    --exclude='electron/build/'
    --exclude='electron/dist/' 
    --exclude='.vscode/'
    --exclude='sound-it-platform/'
    --exclude='Web images/'
    --exclude='uploads/'
    --exclude='static/uploads/'
    --exclude='AGENTS.md'
    --exclude='AUDIT_REPORT_*.md'
    --exclude='DEPLOYMENT_CHECKLIST.md'
    --exclude='MIGRATIONS.md'
    --exclude='prompts/'
    --exclude='docs/'
    --exclude='tests/'
    --exclude='cli/'
    "$1" "$2")
  "${rsync_cmd[@]}"
}

section() {
  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo "  $1"
  echo "══════════════════════════════════════════════════════════"
}

section "Sound It — Safe Versioned Deploy"
echo "  Server: $SERVER_USER@$SERVER_HOST"
echo "  New release: $NEW_RELEASE"
echo ""

# ── Step 1: Test SSH connection ─────────────────────────────
echo "▶ [1/9] Testing SSH connection..."
remote "echo 'SSH OK'"

# ── Step 2: Build frontend locally ──────────────────────────
echo "▶ [2/9] Building frontend locally..."
cd "$LOCAL_DIR/app"
npm run build

# ── Step 3: Prepare remote directories ──────────────────────
echo "▶ [3/9] Preparing remote release and shared directories..."
remote "mkdir -p $RELEASES_DIR $SHARED_DIR $VENV_DIR $PERSISTENT_UPLOAD_DIR"

# ── Step 4: Rsync code into the new release ─────────────────
echo "▶ [4/9] Syncing project files to $NEW_RELEASE..."
remote_rsync \
  "$LOCAL_DIR/" \
  "$SERVER_USER@$SERVER_HOST:$NEW_RELEASE/"

# ── Step 5: Preserve .env and uploads in shared/ ────────────
echo "▶ [5/9] Preserving .env and uploads..."
# ── Step 5 to 12: Remote Setup, Migration, Smoke Test & Activation ──
echo "▶ [5/9] Configuring release, running migrations, smoke testing & activating..."
LOG_FILE="/tmp/soundit_deploy_${TIMESTAMP}.log"
PID_FILE="/tmp/soundit_deploy_${TIMESTAMP}.pid"

remote "
  set -e
  # Seed shared/.env from current deployment if we do not have one yet
  if [ ! -f '$SHARED_DIR/.env' ]; then
    if [ -L '$CURRENT_LINK' ] && [ -f '$CURRENT_LINK/.env' ]; then
      cp -L '$CURRENT_LINK/.env' '$SHARED_DIR/.env'
      echo '  .env copied from current release to shared/.env'
    elif [ -f '$REMOTE_DIR/.env' ]; then
      cp '$REMOTE_DIR/.env' '$SHARED_DIR/.env'
      echo '  .env copied from $REMOTE_DIR/.env to shared/.env'
    fi
  fi

  # Seed shared/uploads from current deployment if it does not exist yet
  if [ ! -d '$SHARED_DIR/uploads' ]; then
    mkdir -p '$SHARED_DIR/uploads'
    if [ -L '$CURRENT_LINK' ] && [ -d '$CURRENT_LINK/uploads' ]; then
      cp -rL '$CURRENT_LINK/uploads/'* '$SHARED_DIR/uploads/' 2>/dev/null || true
    elif [ -d '$REMOTE_DIR/uploads' ]; then
      cp -rL '$REMOTE_DIR/uploads/'* '$SHARED_DIR/uploads/' 2>/dev/null || true
    fi
  fi

  # Symlink shared .env and uploads into the new release
  ln -sfn '$SHARED_DIR/.env' '$NEW_RELEASE/.env'
  ln -sfn '$SHARED_DIR/uploads' '$NEW_RELEASE/uploads'
  echo '  .env and uploads symlinked'

  # Permissions
  WEB_USER=\$(id -u nginx >/dev/null 2>&1 && echo 'nginx' || echo 'root')
  mkdir -p '$NEW_RELEASE/logs' '$NEW_RELEASE/static/uploads'
  chown -R \${WEB_USER}:\${WEB_USER} '$NEW_RELEASE'
  find '$NEW_RELEASE' -type d -exec chmod 755 {} \;
  find '$NEW_RELEASE' -type f -exec chmod 644 {} \;
  if [ -f '$SHARED_DIR/.env' ]; then
    chown \${WEB_USER}:\${WEB_USER} '$SHARED_DIR/.env'
    chmod 600 '$SHARED_DIR/.env'
  fi
  chown -R \${WEB_USER}:\${WEB_USER} '$SHARED_DIR/uploads' '$PERSISTENT_UPLOAD_DIR' '$NEW_RELEASE/logs' '$NEW_RELEASE/static/uploads'
  chmod -R 755 '$SHARED_DIR/uploads' '$PERSISTENT_UPLOAD_DIR' '$NEW_RELEASE/logs' '$NEW_RELEASE/static/uploads'
  echo '  permissions set'

  # Python dependencies in shared venv
  if [ ! -f '$VENV_DIR/bin/pip' ]; then
    python3 -m venv '$VENV_DIR'
  fi
  '$VENV_DIR/bin/pip' install --upgrade pip -q
  '$VENV_DIR/bin/pip' install -r '$NEW_RELEASE/requirements.txt' -q
  echo '  python dependencies ready'

  # Database migrations
  cd '$NEW_RELEASE'
  if [ -f 'scripts/migrate_all_missing_columns.py' ]; then
    '$VENV_DIR/bin/python' scripts/migrate_all_missing_columns.py
  fi
  if [ -f 'scripts/migrate_indexes.py' ]; then
    '$VENV_DIR/bin/python' scripts/migrate_indexes.py
  fi
  echo '  migrations complete'

  # Smoke test on temp port
  echo '  smoke-testing new release on port $TEMP_PORT...'
  nohup '$VENV_DIR/bin/uvicorn' main:app --host 127.0.0.1 --port $TEMP_PORT --workers 1 > '$LOG_FILE' 2>&1 &
  echo \$! > '$PID_FILE'

  HEALTH_PASSED=false
  for i in \$(seq 1 15); do
    sleep 2
    if curl -fsS --max-time 5 http://127.0.0.1:$TEMP_PORT/health >/dev/null 2>&1; then
      HEALTH_PASSED=true
      break
    fi
  done

  if [ \"\$HEALTH_PASSED\" != \"true\" ]; then
    echo '[ERR] Health check on temporary port $TEMP_PORT failed.'
    tail -n 30 '$LOG_FILE'
    kill \$(cat '$PID_FILE' 2>/dev/null) 2>/dev/null || true
    rm -f '$PID_FILE' '$LOG_FILE'
    exit 1
  fi

  kill \$(cat '$PID_FILE' 2>/dev/null) 2>/dev/null || true
  rm -f '$PID_FILE' '$LOG_FILE'
  echo '  temporary health check passed'

  touch '$NEW_RELEASE/logs/app.log' '$NEW_RELEASE/logs/audit.log'
  chown -R \${WEB_USER}:\${WEB_USER} '$NEW_RELEASE/logs'
  chmod -R 755 '$NEW_RELEASE/logs'

  # Activate symlink
  ln -sfn '$NEW_RELEASE' '$CURRENT_LINK'
  echo '  activated new release symlink'

  # Update systemd & nginx
  cp '$NEW_RELEASE/deploy/sounditent.service' /etc/systemd/system/soundit.service
  cp '$NEW_RELEASE/deploy/nginx_sounditent.conf' /etc/nginx/conf.d/soundit.conf
  nginx -t
  systemctl reload nginx
  systemctl daemon-reload
  systemctl restart soundit
  sleep 3

  # Final health check
  HEALTH_OK=''
  for i in \$(seq 1 12); do
    if curl -4 -fsS --max-time 10 http://127.0.0.1:8000/health >/dev/null 2>&1; then
      HEALTH_OK=1
      break
    fi
    echo '  ... waiting for app to come up'
    sleep 5
  done
  if [ -z \"\$HEALTH_OK\" ]; then
    echo '[ERR] Final health check failed. Investigate with: journalctl -u soundit -n 50'
    exit 1
  fi
  echo '  soundit is healthy on port 8000'

  # Prune old releases
  cd '$RELEASES_DIR'
  ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
  echo '  pruned old releases'
"

# ── Done ────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   [OK] Safe versioned deploy complete!                   ║"
echo "║   Release: $NEW_RELEASE"
echo "║   https://sounditent.com                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
