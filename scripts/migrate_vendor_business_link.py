#!/usr/bin/env python3
"""
Migration: Vendor business-ownership link
- Adds vendor_profiles.business_profile_id (nullable FK to business_profiles.id)
- Adds index ix_vendor_profiles_business_profile_id
- Idempotent: safe to run multiple times
- Supports SQLite and PostgreSQL; --rollback removes the column/index
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine


COLUMN = "business_profile_id"
TABLE = "vendor_profiles"
INDEX = "ix_vendor_profiles_business_profile_id"


def migrate():
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns(TABLE)]
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if COLUMN not in columns:
            if dialect == "postgresql":
                conn.execute(text(
                    f'ALTER TABLE {TABLE} ADD COLUMN {COLUMN} INTEGER REFERENCES business_profiles(id)'
                ))
            else:
                conn.execute(text(f'ALTER TABLE {TABLE} ADD COLUMN {COLUMN} INTEGER'))
            print(f"Added column {TABLE}.{COLUMN}")

        if dialect == "postgresql":
            conn.execute(text(
                f'CREATE INDEX IF NOT EXISTS {INDEX} ON {TABLE} ({COLUMN})'
            ))
        else:
            indexes = [i["name"] for i in inspector.get_indexes(TABLE)]
            if INDEX not in indexes:
                conn.execute(text(f'CREATE INDEX {INDEX} ON {TABLE} ({COLUMN})'))
        print(f"Ensured index {INDEX}")


def rollback():
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns(TABLE)]
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if dialect == "postgresql":
            conn.execute(text(f'DROP INDEX IF EXISTS {INDEX}'))
            if COLUMN in columns:
                conn.execute(text(f'ALTER TABLE {TABLE} DROP COLUMN IF EXISTS {COLUMN}'))
        else:
            indexes = [i["name"] for i in inspector.get_indexes(TABLE)]
            if INDEX in indexes:
                conn.execute(text(f'DROP INDEX {INDEX}'))
            if COLUMN in columns:
                conn.execute(text(f'ALTER TABLE {TABLE} DROP COLUMN {COLUMN}'))
    print("Rollback complete")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true")
    args = parser.parse_args()
    if args.rollback:
        rollback()
    else:
        migrate()
