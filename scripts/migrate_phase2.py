"""
Phase 2 migration — add 2FA / PIN columns to the users table.

Idempotent: checks PRAGMA table_info(users) and only ALTERs in missing columns.
SQLite-only (local dev database); PostgreSQL uses its own migration tooling.
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "soundit_local.db")

NEW_COLUMNS = {
    "totp_secret": "VARCHAR(64)",
    "totp_enabled": "BOOLEAN DEFAULT 0",
    "pin_hash": "VARCHAR(255)",
    "pin_enabled": "BOOLEAN DEFAULT 0",
}


def table_columns(conn: sqlite3.Connection, table: str) -> set:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def main() -> None:
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"Database not found: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    try:
        existing = table_columns(conn, "users")
        for name, col_type in NEW_COLUMNS.items():
            if name in existing:
                print(f"  - users.{name}: already exists, skipping")
            else:
                conn.execute(f"ALTER TABLE users ADD COLUMN {name} {col_type}")
                print(f"  + users.{name}: added ({col_type})")
        conn.commit()
        
        # Verify
        existing = table_columns(conn, "users")
        missing = [name for name in NEW_COLUMNS if name not in existing]
        if missing:
            raise SystemExit(f"MIGRATION FAILED — missing columns: {missing}")
        print("Migration complete: users 2FA/PIN columns verified.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
