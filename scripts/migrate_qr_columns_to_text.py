#!/usr/bin/env python3
"""
migrate_qr_columns_to_text.py
------------------------------
Alter the four QR-code columns from VARCHAR(1500) → TEXT so base64-encoded
PNG QR images (typically 5 000–20 000 chars) are no longer silently truncated.

Affected tables / columns
  tickets           . qr_code
  ticket_orders     . ticket_qr_code
  product_orders    . order_qr_code
  table_orders      . ticket_qr_code

Safe to run multiple times (detects existing TEXT type and skips).

Usage
  python3 scripts/migrate_qr_columns_to_text.py
"""

import os
import sys

# ── Ensure project root is on the path ────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from sqlalchemy import text
from database import engine

MIGRATIONS = [
    # (table, column)
    ("tickets",       "qr_code"),
    ("ticket_orders", "ticket_qr_code"),
    ("product_orders","order_qr_code"),
    ("table_orders",  "ticket_qr_code"),
]


def is_postgresql(url: str) -> bool:
    return "postgresql" in url or "postgres" in url


def migrate_sqlite(conn) -> None:
    """SQLite does not enforce VARCHAR length limits at the storage level.
    The model change in models.py (String(1500) → Text) is sufficient.
    We log the current column declarations for informational purposes only.
    """
    for table, column in MIGRATIONS:
        try:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            col_info = {r[1]: r[2].upper() for r in rows}   # name -> type

            if column not in col_info:
                print(f"  [{table}.{column}] column not found — skipping")
                continue

            current_type = col_info[column]
            if current_type == "TEXT":
                print(f"  [{table}.{column}] already TEXT — no change needed")
            else:
                # SQLite stores VARCHAR(1500) as TEXT internally regardless of
                # declared type; no length is enforced. The ORM model change is
                # sufficient to make future writes store full-length values.
                print(
                    f"  [{table}.{column}] declared type is '{current_type}'. "
                    "SQLite does NOT enforce VARCHAR length limits — no DDL needed. "
                    "The models.py change to Column(Text) is already effective."
                )
        except Exception as exc:
            print(f"  [{table}.{column}] ERROR: {exc}")


def migrate_postgresql(conn) -> None:
    """ALTER the column type to TEXT for PostgreSQL."""
    for table, column in MIGRATIONS:
        try:
            # Check current data type
            row = conn.execute(
                text(
                    "SELECT data_type "
                    "FROM information_schema.columns "
                    "WHERE table_name = :tbl AND column_name = :col"
                ),
                {"tbl": table, "col": column},
            ).fetchone()

            if row is None:
                print(f"  [{table}.{column}] column not found — skipping")
                continue

            data_type = row[0].upper()
            if data_type == "TEXT":
                print(f"  [{table}.{column}] already TEXT — no change needed")
                continue

            print(f"  [{table}.{column}] current type: {data_type} → altering to TEXT …")
            conn.execute(
                text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE TEXT")
            )
            print(f"  [{table}.{column}] ✓ altered to TEXT")

        except Exception as exc:
            print(f"  [{table}.{column}] ERROR: {exc}")
            conn.execute(text("ROLLBACK"))


def main() -> None:
    db_url = str(engine.url)
    print(f"\nDatabase: {db_url}")
    print("─" * 60)

    with engine.connect() as conn:
        if is_postgresql(db_url):
            print("Detected PostgreSQL — running ALTER COLUMN migrations …\n")
            migrate_postgresql(conn)
            conn.execute(text("COMMIT"))
        else:
            print("Detected SQLite — checking storage behaviour …\n")
            migrate_sqlite(conn)

    print("\n─" * 60)
    print("Migration complete.\n")
    print("IMPORTANT: Re-approve any existing ticket orders so fresh (full-size)")
    print("QR images are generated and stored in the now-unlimited TEXT columns.")
    print("Alternatively, run: python3 scripts/regenerate_ticket_qr_codes.py\n")


if __name__ == "__main__":
    main()
