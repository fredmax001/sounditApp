"""Migration: add buyer_confirmed_at to ticket_orders and make
payment_screenshot nullable (buyer-confirmed orders may lack a screenshot).

Idempotent, safe to run multiple times. Supports SQLite and PostgreSQL.

Usage:
    python3 scripts/migrate_buyer_confirmed.py
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import inspect, text  # noqa: E402
from database import engine  # noqa: E402
import models  # noqa: E402,F401  (ensure all models are registered on Base)


def column_exists(table: str, column: str) -> bool:
    inspector = inspect(engine)
    if not inspector.has_table(table):
        return False
    return any(c["name"] == column for c in inspector.get_columns(table))


def main():
    dialect = engine.dialect.name
    print(f"Dialect: {dialect}")

    with engine.begin() as conn:
        # 1. Add buyer_confirmed_at column
        if column_exists("ticket_orders", "buyer_confirmed_at"):
            print("  [skip] ticket_orders.buyer_confirmed_at already exists")
        else:
            conn.execute(text(
                'ALTER TABLE "ticket_orders" ADD COLUMN buyer_confirmed_at TIMESTAMPTZ'
            ))
            print("  [ok] added ticket_orders.buyer_confirmed_at")

        if dialect == "postgresql":
            # 2. Drop NOT NULL on payment_screenshot (PG supports it directly)
            conn.execute(text(
                'ALTER TABLE "ticket_orders" ALTER COLUMN payment_screenshot DROP NOT NULL'
            ))
            print("  [ok] ticket_orders.payment_screenshot is now nullable")
        else:
            print("  [info] SQLite: recreate tables to make payment_screenshot nullable"
                  " (fresh dev DBs get it from create_all)")

    # 3. Index for the organizer approval queue lookups
    if dialect == "postgresql":
        with engine.begin() as conn:
            conn.execute(text(
                'CREATE INDEX IF NOT EXISTS ix_ticket_orders_buyer_confirmed_at '
                'ON "ticket_orders" (buyer_confirmed_at)'
            ))
            print("  [ok] index ix_ticket_orders_buyer_confirmed_at ready")

    print("\nDone.")


if __name__ == "__main__":
    main()
