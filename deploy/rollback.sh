#!/bin/bash
# ============================================================
# Sound It — Release Rollback
#
# Lists recent releases, switches /var/www/soundit/current to
# the previous release, restarts the service, and health-checks.
# If the health check fails, the symlink is restored to the
# original release and the service is restarted again.
# ============================================================

set -euo pipefail

SERVER_USER="root"
SERVER_HOST="72.62.254.251"
SERVER_PORT="22"
REMOTE_DIR="/var/www/soundit"
RELEASES_DIR="$REMOTE_DIR/releases"
CURRENT_LINK="$REMOTE_DIR/current"

SSH="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p $SERVER_PORT"

remote() {
  $SSH "$SERVER_USER@$SERVER_HOST" "$@"
}

section() {
  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo "  $1"
  echo "══════════════════════════════════════════════════════════"
}

section "Sound It — Rollback"

# ── List recent releases ────────────────────────────────────
echo "▶ Recent releases:"
RELEASES=$(remote "ls -1dt $RELEASES_DIR/*/ 2>/dev/null | head -10" || true)
if [ -z "$RELEASES" ]; then
  echo "[ERR] No releases found in $RELEASES_DIR"
  exit 1
fi
printf '%s\n' "$RELEASES"

# ── Identify current and previous release ───────────────────
CURRENT_TARGET=$(remote "readlink -f $CURRENT_LINK" 2>/dev/null || true)
if [ -z "$CURRENT_TARGET" ]; then
  echo "[ERR] Could not resolve $CURRENT_LINK"
  exit 1
fi
echo ""
echo "▶ Current release: $CURRENT_TARGET"

PREV_RELEASE=$(printf '%s\n' "$RELEASES" | grep -vFx "$CURRENT_TARGET/" | grep -vFx "$CURRENT_TARGET" | head -n 1)
if [ -z "$PREV_RELEASE" ]; then
  echo "[ERR] No previous release available to roll back to."
  exit 1
fi
echo "▶ Rollback target: $PREV_RELEASE"

# ── Confirm with user unless --yes is passed ────────────────
if [ "${1:-}" != "--yes" ]; then
  echo ""
  read -rp "Rollback to the release above? [y/N]: " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
  fi
fi

# ── Perform rollback ────────────────────────────────────────
echo ""
echo "▶ Switching symlink and restarting service..."
if remote "
  set -e
  ln -sfn '$PREV_RELEASE' '$CURRENT_LINK'
  systemctl daemon-reload
  systemctl restart soundit
  sleep 3
  curl -fsS --max-time 30 http://127.0.0.1:8000/health
"; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║   [OK] Rollback successful                               ║"
  echo "║   Current release: $PREV_RELEASE"
  echo "║   https://sounditent.com/health                          ║"
  echo "╚══════════════════════════════════════════════════════════╝"
else
  echo ""
  echo "[ERR] Rollback health check failed. Reverting to original release..."
  remote "
    set -e
    ln -sfn '$CURRENT_TARGET' '$CURRENT_LINK'
    systemctl restart soundit
    sleep 3
  "
  if remote "curl -fsS --max-time 30 http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    echo "[OK] Reverted to original release and service is healthy."
  else
    echo "[ERR] Revert failed. Investigate immediately: journalctl -u soundit -n 50"
  fi
  exit 1
fi
