#!/bin/bash
set -e

SERVER_USER="root"
SERVER_HOST="72.62.254.251"
SSH_PASS='Jul1@n/221/cloudhost'
REMOTE_DIR="/var/www/soundit"
LOCAL_DIR="/Users/djfredmax/Desktop/SOUND IT WEB APP COMPLETE"

SSH="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
RSYNC="sshpass -p '$SSH_PASS' rsync -avz --delete -e 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'"

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
