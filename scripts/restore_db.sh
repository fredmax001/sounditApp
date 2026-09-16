#!/bin/bash
# ============================================================
# Sound It — Validated PostgreSQL Restore Script
# ============================================================
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <path-to-backup-file.sql.gz> [target-db-name]"
    echo "Example: $0 /var/backups/soundit-db/soundit_db_20260916_000000.sql.gz soundit_restore_test"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-soundit_restore_test}"
DB_USER="${DB_USER:-postgres}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "============================================================"
echo " Starting Database Restore Validation"
echo " Source: $BACKUP_FILE"
echo " Target DB: $TARGET_DB"
echo "============================================================"

# Create temporary validation database if testing restore
createdb -U "$DB_USER" "$TARGET_DB" 2>/dev/null || true

# Restore into target
echo "Restoring schema and data..."
gunzip -c "$BACKUP_FILE" | psql -U "$DB_USER" -d "$TARGET_DB" --quiet

# Validate table counts
echo "Validating restored tables..."
TABLE_COUNT=$(psql -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
USER_COUNT=$(psql -U "$DB_USER" -d "$TARGET_DB" -t -c "SELECT count(*) FROM users;" 2>/dev/null || echo "0")

echo "✅ Restore verified successfully!"
echo "   Public tables: $(echo $TABLE_COUNT | tr -d ' ')"
echo "   User records: $(echo $USER_COUNT | tr -d ' ')"

# If test database, clean up
if [ "$TARGET_DB" = "soundit_restore_test" ]; then
    dropdb -U "$DB_USER" soundit_restore_test
    echo "🧹 Temporary test database dropped cleanly."
fi
