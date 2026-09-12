#!/bin/bash
set -e

SERVER_USER="root"
SERVER_HOST="72.62.254.251"

# SSH password must be provided via the SSH_PASS environment variable.
# Never hardcode credentials in this script (it is tracked in git).
if [ -z "${SSH_PASS:-}" ]; then
  echo "[ERR] SSH_PASS environment variable is not set."
  echo "      Export it before running:  export SSH_PASS='your-password'"
  exit 1
fi
export SSHPASS="$SSH_PASS"

REMOTE_DIR="/var/www/soundit"
LOCAL_DIR="/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE"

SSH="sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
RSYNC="sshpass -e rsync -avz --delete -e 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'"

echo "▶ Deploying backend files..."
eval "$RSYNC \"$LOCAL_DIR/api/\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/api/\""
eval "$RSYNC \"$LOCAL_DIR/models.py\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/models.py\""
eval "$RSYNC \"$LOCAL_DIR/main.py\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/main.py\""
eval "$RSYNC \"$LOCAL_DIR/database.py\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/database.py\""
eval "$RSYNC \"$LOCAL_DIR/schemas.py\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/schemas.py\""
eval "$RSYNC \"$LOCAL_DIR/scripts/migrate_promoter_system.py\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/scripts/migrate_promoter_system.py\""

echo "▶ Deploying frontend build..."
eval "$RSYNC \"$LOCAL_DIR/app/dist/\" \"$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/app/dist/\""

echo "▶ Restarting service..."
eval "$SSH $SERVER_USER@$SERVER_HOST 'cd $REMOTE_DIR && source .venv/bin/activate && systemctl restart soundit'"

echo "▶ Done!"
