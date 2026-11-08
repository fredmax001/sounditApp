#!/usr/bin/env python3
"""
Idempotent migration for booking_requests table.
Adds columns that exist in BookingRequestResponse schema but were missing from the model:
  payment_screenshot, payment_amount, payer_name, payer_notes, payment_status,
  reviewed_at, rejection_reason.

Supports SQLite and PostgreSQL.
"""
import argparse
import os
import sys

# Allow imports from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from config import settings


def get_columns(engine, table_name):
    inspector = inspect(engine)
    if not inspector.has_table(table_name):
        return []
    return [col['name'] for col in inspector.get_columns(table_name)]


def run_migration(engine):
    columns_to_add = [
        ("payment_screenshot", "VARCHAR(500)"),
        ("payment_amount", "FLOAT"),
        ("payer_name", "VARCHAR(100)"),
        ("payer_notes", "TEXT"),
        ("payment_status", "VARCHAR(20) DEFAULT 'pending'"),
        ("reviewed_at", "TIMESTAMP WITH TIME ZONE"),
        ("rejection_reason", "TEXT"),
    ]

    existing = get_columns(engine, "booking_requests")
    is_sqlite = engine.dialect.name == "sqlite"

    with engine.begin() as conn:
        for col_name, col_type in columns_to_add:
            if col_name in existing:
                print(f"[SKIP] Column '{col_name}' already exists.")
                continue

            if is_sqlite:
                # SQLite supports limited ALTER TABLE; adding nullable/default columns is fine.
                sql = f'ALTER TABLE booking_requests ADD COLUMN {col_name} {col_type}'
            else:
                sql = f'ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS {col_name} {col_type}'

            conn.execute(text(sql))
            print(f"[ADD] Column '{col_name}' added.")

    print("[OK] Booking columns migration completed.")


def rollback(engine):
    # Rollback is dangerous if data exists; provide a no-op / warning.
    print("[WARN] Rollback not implemented for booking columns migration (would drop payment data).")


def main():
    parser = argparse.ArgumentParser(description="Migrate booking_requests columns")
    parser.add_argument("--rollback", action="store_true", help="Rollback (not supported)")
    args = parser.parse_args()

    db_url = settings.DATABASE_URL
    print(f"[INFO] Using database: {db_url.replace('://', '://***:***@') if '://' in db_url else db_url}")
    engine = create_engine(db_url)

    if args.rollback:
        rollback(engine)
    else:
        run_migration(engine)


if __name__ == "__main__":
    main()
