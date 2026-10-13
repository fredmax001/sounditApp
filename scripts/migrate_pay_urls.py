"""Migration: add wechat_pay_url / alipay_pay_url columns and backfill by
decoding existing WeChat/Alipay QR images.

Idempotent, safe to run multiple times. Supports SQLite and PostgreSQL.

Usage:
    python3 scripts/migrate_pay_urls.py            # add columns + backfill
    python3 scripts/migrate_pay_urls.py --columns-only   # only add columns
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import inspect, text  # noqa: E402
from database import engine, SessionLocal  # noqa: E402
import models  # noqa: E402,F401  (ensure all models are registered on Base)

TARGETS = [
    ("events", "event"),
    ("artist_profiles", "artist profile"),
    ("vendor_payment_settings", "vendor payment settings"),
    ("products", "product"),
]

NEW_COLUMNS = [
    ("wechat_pay_url", "VARCHAR(1000)"),
    ("alipay_pay_url", "VARCHAR(1000)"),
]


def column_exists(table: str, column: str) -> bool:
    inspector = inspect(engine)
    if not inspector.has_table(table):
        return False
    return any(c["name"] == column for c in inspector.get_columns(table))


def add_columns():
    created = []
    # Inspect OUTSIDE the ALTER transaction: the uncommitted ALTER holds an
    # ACCESS EXCLUSIVE lock on the table, so any inspection query issued from
    # a second pooled connection (e.g. get_columns) would self-deadlock.
    missing = []
    for table, _label in TARGETS:
        for col_name, col_type in NEW_COLUMNS:
            if column_exists(table, col_name):
                print(f"  [skip] {table}.{col_name} already exists")
            else:
                missing.append((table, col_name, col_type))

    with engine.begin() as conn:
        for table, col_name, col_type in missing:
            conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {col_name} {col_type}'))
            created.append(f"{table}.{col_name}")
            print(f"  [ok] added {table}.{col_name}")
    return created


def backfill():
    from utils.qr_decoder import decode_qr
    from sqlalchemy import text as sql_text

    db = SessionLocal()
    total_decoded = 0
    try:
        with engine.connect() as conn:
            for table, label in TARGETS:
                if not (column_exists(table, "wechat_pay_url") and column_exists(table, "wechat_qr_url")):
                    continue
                rows = conn.execute(sql_text(
                    f'SELECT id, wechat_qr_url, alipay_qr_url FROM "{table}" '
                    f'WHERE wechat_qr_url IS NOT NULL OR alipay_qr_url IS NOT NULL'
                )).fetchall()
                for row in rows:
                    row_id, wechat_qr, alipay_qr = row
                    updates = {}
                    if wechat_qr:
                        content = decode_qr(wechat_qr)
                        if content:
                            updates["wechat_pay_url"] = content
                            total_decoded += 1
                            print(f"  [decode] {label} #{row_id} wechat -> {content[:60]}")
                    if alipay_qr:
                        content = decode_qr(alipay_qr)
                        if content:
                            updates["alipay_pay_url"] = content
                            total_decoded += 1
                            print(f"  [decode] {label} #{row_id} alipay -> {content[:60]}")
                    if updates:
                        assignments = ", ".join(f"{k} = :{k}" for k in updates)
                        updates["rid"] = row_id
                        conn.execute(sql_text(
                            f'UPDATE "{table}" SET {assignments} WHERE id = :rid'
                        ), updates)
                        conn.commit()
        print(f"\nBackfill complete: {total_decoded} QR code(s) decoded.")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--columns-only", action="store_true", help="Only add columns, skip backfill")
    args = parser.parse_args()

    print("Adding pay_url columns...")
    add_columns()

    if not args.columns_only:
        print("\nBackfilling decoded payment URLs from existing QR images...")
        backfill()

    print("\nDone.")


if __name__ == "__main__":
    main()
