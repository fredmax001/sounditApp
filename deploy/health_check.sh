#!/bin/bash
# ============================================================
# Sound It — Health Check
#
# Usage:
#   ./deploy/health_check.sh [URL] [TIMEOUT_SECONDS]
#
# Examples:
#   ./deploy/health_check.sh
#   ./deploy/health_check.sh https://sounditent.com
#   ./deploy/health_check.sh http://127.0.0.1:8000 10
#
# Exits with 0 on success and non-zero on failure.
# ============================================================

set -euo pipefail

HOST="${1:-https://sounditent.com}"
TIMEOUT="${2:-30}"

# Remove trailing slash from HOST so we don't end up with //health
HOST="${HOST%/}"

echo "▶ Health check: $HOST/health (timeout ${TIMEOUT}s)"

if curl -fsS --max-time "$TIMEOUT" "$HOST/health"; then
  echo ""
  echo "[OK] Health check passed: $HOST/health"
  exit 0
else
  echo ""
  echo "[ERR] Health check failed: $HOST/health"
  exit 1
fi
