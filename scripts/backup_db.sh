#!/bin/bash
# ============================================================
# Sound It — Automated PostgreSQL Daily Backup & Rotation Script
# ============================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/soundit-db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${DB_NAME:-soundit}"
DB_USER="${DB_USER:-postgres}"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/soundit_db_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting PostgreSQL backup for database: $DB_NAME..."

# Export compressed dump
pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$BACKUP_FILE"

# Verify backup was created and is non-empty
if [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup successful: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Backup failed or file is empty!"
    exit 1
fi

# Prune backups older than RETENTION_DAYS
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "soundit_db_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process complete."
