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
  if [ -n "${SSH_PASS:-}" ]; then
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "$@"
  else
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" "$@"
  fi
}

remote_scp() {
  # Usage: remote_scp <local> <remote>
  if [ -n "${SSH_PASS:-}" ]; then
    sshpass -p "$SSH_PASS" scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SERVER_PORT" "$1" "$2"
  else
    scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -P "$SERVER_PORT" "$1" "$2"
  fi
}

remote_rsync() {
  # Usage: remote_rsync <src> <dest>
  local ssh_cmd="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $SERVER_PORT"
  local rsync_cmd=(rsync -avz -e "$ssh_cmd"
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
  if [ -n "${SSH_PASS:-}" ]; then
    sshpass -p "$SSH_PASS" "${rsync_cmd[@]}"
  else
    "${rsync_cmd[@]}"
  fi
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
    else
      echo '  [WARN] No existing .env found; you must create $SHARED_DIR/.env before starting the app'
    fi
  fi

  # Seed shared/uploads from current deployment if it does not exist yet
  if [ ! -d '$SHARED_DIR/uploads' ]; then
    mkdir -p '$SHARED_DIR/uploads'
    if [ -L '$CURRENT_LINK' ] && [ -d '$CURRENT_LINK/uploads' ]; then
      cp -rL '$CURRENT_LINK/uploads/'* '$SHARED_DIR/uploads/' 2>/dev/null || true
      echo '  uploads copied from current release to shared/uploads'
    elif [ -d '$REMOTE_DIR/uploads' ]; then
      cp -rL '$REMOTE_DIR/uploads/'* '$SHARED_DIR/uploads/' 2>/dev/null || true
      echo '  uploads copied from $REMOTE_DIR/uploads to shared/uploads'
    fi
  fi

  # Symlink shared .env and uploads into the new release
  ln -sfn '$SHARED_DIR/.env' '$NEW_RELEASE/.env'
  ln -sfn '$SHARED_DIR/uploads' '$NEW_RELEASE/uploads'
  echo '  .env and uploads symlinked into new release'
"

# ── Step 6: Fix permissions for the web server user ─────────
echo "▶ [6/9] Fixing permissions..."
remote "
  set -e
  WEB_USER=\$(id -u nginx >/dev/null 2>&1 && echo 'nginx' || echo 'root')
  mkdir -p '$NEW_RELEASE/logs' '$NEW_RELEASE/static/uploads'

  # Release files: owner (nginx/root) can read/write, group/others read-only
  chown -R \${WEB_USER}:\${WEB_USER} '$NEW_RELEASE'
  find '$NEW_RELEASE' -type d -exec chmod 755 {} \;
  find '$NEW_RELEASE' -type f -exec chmod 644 {} \;

  # .env must not be world-readable
  if [ -f '$SHARED_DIR/.env' ]; then
    chown \${WEB_USER}:\${WEB_USER} '$SHARED_DIR/.env'
    chmod 600 '$SHARED_DIR/.env'
  fi

  # Uploads and logs must be writable by the service user
  chown -R \${WEB_USER}:\${WEB_USER} '$SHARED_DIR/uploads' '$PERSISTENT_UPLOAD_DIR' '$NEW_RELEASE/logs' '$NEW_RELEASE/static/uploads'
  chmod -R 755 '$SHARED_DIR/uploads' '$PERSISTENT_UPLOAD_DIR' '$NEW_RELEASE/logs' '$NEW_RELEASE/static/uploads'
"

# ── Step 7: Install / refresh Python dependencies ───────────
echo "▶ [7/9] Installing Python dependencies in shared venv..."
remote "
  set -e
  if [ ! -f '$VENV_DIR/bin/pip' ]; then
    python3 -m venv '$VENV_DIR'
  fi
  '$VENV_DIR/bin/pip' install --upgrade pip -q
  '$VENV_DIR/bin/pip' install -r '$NEW_RELEASE/requirements.txt' -q
"

# ── Step 7: Run migrations from the new release ─────────────
echo "▶ [8/9] Running database migrations..."
remote "
  set -e
  cd '$NEW_RELEASE'
  # Add migration scripts here as the project evolves.
  # At minimum we run the following if they exist.
  if [ -f 'scripts/migrate_all_missing_columns.py' ]; then
    echo '  Running migrate_all_missing_columns.py...'
    '$VENV_DIR/bin/python' scripts/migrate_all_missing_columns.py
  fi
  if [ -f 'scripts/migrate_indexes.py' ]; then
    echo '  Running migrate_indexes.py...'
    '$VENV_DIR/bin/python' scripts/migrate_indexes.py
  fi
"

# ── Step 8: Smoke-test the new release on a temp port ───────
echo "▶ [9/9] Smoke-testing new release on port $TEMP_PORT..."
LOG_FILE="/tmp/soundit_deploy_${TIMESTAMP}.log"
PID_FILE="/tmp/soundit_deploy_${TIMESTAMP}.pid"

remote "
  set -e
  cd '$NEW_RELEASE'
  nohup '$VENV_DIR/bin/uvicorn' main:app --host 127.0.0.1 --port $TEMP_PORT --workers 1 > '$LOG_FILE' 2>&1 &
  echo \$! > '$PID_FILE'
"

sleep 5

if ! remote "curl -fsS --max-time 10 http://127.0.0.1:$TEMP_PORT/health" >/dev/null 2>&1; then
  echo ""
  echo "[ERR] Health check on temporary port $TEMP_PORT failed."
  echo "      Log tail:"
  remote "tail -n 30 '$LOG_FILE'" || true
  remote "kill \$(cat '$PID_FILE' 2>/dev/null) 2>/dev/null || true"
  exit 1
fi

echo "  [OK] Temporary health check passed"

# Stop the temporary instance (run as root, so any log files it created are root-owned)
remote "kill \$(cat '$PID_FILE' 2>/dev/null) 2>/dev/null || true; rm -f '$PID_FILE' '$LOG_FILE'"

# Ensure log files are owned by the service user before the symlink switch
remote "
  set -e
  WEB_USER=\$(id -u nginx >/dev/null 2>&1 && echo 'nginx' || echo 'root')
  mkdir -p '$NEW_RELEASE/logs'
  touch '$NEW_RELEASE/logs/app.log' '$NEW_RELEASE/logs/audit.log'
  chown -R \${WEB_USER}:\${WEB_USER} '$NEW_RELEASE/logs'
  chmod -R 755 '$NEW_RELEASE/logs'
"

# ── Step 9: Atomically switch current symlink ───────────────
echo "▶ Activating new release..."
remote "ln -sfn '$NEW_RELEASE' '$CURRENT_LINK'"

# ── Step 10: Update systemd service if needed and restart ───
echo "▶ Restarting soundit service..."
remote "
  set -e
  cp '$NEW_RELEASE/deploy/sounditent.service' /etc/systemd/system/soundit.service
  systemctl daemon-reload
  systemctl restart soundit
  sleep 3
"

# ── Step 11: Final health check ─────────────────────────────
echo "▶ Running final health check..."
remote "sleep 5"
if ! remote "curl -4 -fsS --max-time 30 http://127.0.0.1:8000/health" >/dev/null 2>&1; then
  echo ""
  echo "[ERR] Final health check failed. Investigate with: journalctl -u soundit -n 50"
  exit 1
fi
echo "  [OK] soundit is healthy on port 8000"

# ── Step 12: Prune old releases ─────────────────────────────
echo "▶ Pruning old releases (keeping last $KEEP_RELEASES)..."
remote "
  cd '$RELEASES_DIR'
  ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
  echo '  Remaining releases:'
  ls -1dt */ 2>/dev/null || echo '  (none)'
"

# ── Done ────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   [OK] Safe versioned deploy complete!                   ║"
echo "║   Release: $NEW_RELEASE"
echo "║   https://sounditent.com                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
