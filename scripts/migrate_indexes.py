#!/usr/bin/env python3
"""
Migration: Performance indexes and unique constraints
- Adds single-column indexes to hot foreign keys and filter/sort columns
- Adds composite indexes on events for common query patterns
- Adds unique constraints on post_likes and community_likes
- Adds users.last_login column if missing
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine, SessionLocal


# (table_name, column_name, index_name)
SINGLE_COLUMN_INDEXES = [
    ("events", "end_date", "ix_events_end_date"),
    ("events", "is_featured", "ix_events_is_featured"),
    ("events", "views_count", "ix_events_views_count"),
    ("events", "tickets_sold", "ix_events_tickets_sold"),
    ("products", "vendor_id", "ix_products_vendor_id"),
    ("products", "event_id", "ix_products_event_id"),
    ("vendor_orders", "vendor_id", "ix_vendor_orders_vendor_id"),
    ("vendor_orders", "user_id", "ix_vendor_orders_user_id"),
    ("ticket_orders", "event_id", "ix_ticket_orders_event_id"),
    ("ticket_orders", "user_id", "ix_ticket_orders_user_id"),
    ("tickets", "user_id", "ix_tickets_user_id"),
    ("tickets", "event_id", "ix_tickets_event_id"),
    ("tickets", "ticket_tier_id", "ix_tickets_ticket_tier_id"),
    ("tickets", "order_id", "ix_tickets_order_id"),
    ("orders", "user_id", "ix_orders_user_id"),
    ("notifications", "user_id", "ix_notifications_user_id"),
    ("messages", "conversation_id", "ix_messages_conversation_id"),
    ("messages", "sender_id", "ix_messages_sender_id"),
    ("conversations", "participant_1_id", "ix_conversations_participant_1_id"),
    ("conversations", "participant_2_id", "ix_conversations_participant_2_id"),
    ("posts", "user_id", "ix_posts_user_id"),
    ("posts", "event_id", "ix_posts_event_id"),
    ("comments", "post_id", "ix_comments_post_id"),
    ("comments", "user_id", "ix_comments_user_id"),
    ("post_likes", "post_id", "ix_post_likes_post_id"),
    ("post_likes", "user_id", "ix_post_likes_user_id"),
    ("community_likes", "post_id", "ix_community_likes_post_id"),
    ("community_likes", "user_id", "ix_community_likes_user_id"),
    ("booking_requests", "artist_id", "ix_booking_requests_artist_id"),
    ("booking_requests", "requester_id", "ix_booking_requests_requester_id"),
    ("users", "last_login", "ix_users_last_login"),
]

# (table_name, [columns], index_name)
COMPOSITE_INDEXES = [
    ("events", ["status", "start_date", "end_date"], "ix_events_status_start_end"),
    ("events", ["city", "status", "start_date"], "ix_events_city_status_start"),
]

# (table_name, [columns], constraint_name)
UNIQUE_CONSTRAINTS = [
    ("post_likes", ["post_id", "user_id"], "uq_post_likes_post_user"),
    ("community_likes", ["post_id", "user_id"], "uq_community_likes_post_user"),
]


def _column_type_for_dialect(dialect_name, col_type):
    """Return a type string suitable for the current dialect."""
    if col_type == "last_login":
        return "TIMESTAMP WITH TIME ZONE" if dialect_name == "postgresql" else "DATETIME"
    return "TEXT"


def _ensure_column(db, inspector, table, column, col_type):
    columns = {c["name"] for c in inspector.get_columns(table)}
    if column in columns:
        print(f"[migrate] Column {table}.{column} already exists")
        return

    type_str = _column_type_for_dialect(engine.dialect.name, col_type)
    print(f"[migrate] Adding {table}.{column} ({type_str})...")
    db.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {type_str}"))
    db.commit()
    print(f"[migrate] ✓ {table}.{column} added")


def _create_single_index(db, inspector, table, column, name):
    existing = {idx["name"] for idx in inspector.get_indexes(table)}
    if name in existing:
        print(f"[migrate] Index {name} already exists")
        return
    print(f"[migrate] Creating index {name} on {table}({column})...")
    db.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})"))
    db.commit()
    print(f"[migrate] ✓ {name} created")


def _create_composite_index(db, inspector, table, columns, name):
    existing = {idx["name"] for idx in inspector.get_indexes(table)}
    if name in existing:
        print(f"[migrate] Composite index {name} already exists")
        return
    cols = ", ".join(columns)
    print(f"[migrate] Creating composite index {name} on {table}({cols})...")
    db.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})"))
    db.commit()
    print(f"[migrate] ✓ {name} created")


def _unique_constraint_exists(inspector, table, name, columns):
    # SQLAlchemy's inspector.get_unique_constraints works for both PostgreSQL
    # and SQLite (the latter parses sqlite_master). If a named constraint
    # exists we skip; otherwise we fall back to checking for an existing
    # unique index on the same columns.
    existing = {c["name"] for c in inspector.get_unique_constraints(table)}
    if name in existing:
        return True
    for idx in inspector.get_indexes(table):
        if idx["unique"] and set(idx["column_names"]) == set(columns):
            return True
    return False


def _create_unique_constraint(db, inspector, table, columns, name):
    if _unique_constraint_exists(inspector, table, name, columns):
        print(f"[migrate] Unique constraint {name} already exists")
        return

    cols = ", ".join(columns)
    print(f"[migrate] Creating unique constraint {name} on {table}({cols})...")

    if engine.dialect.name == "postgresql":
        db.execute(text(
            f"ALTER TABLE {table} ADD CONSTRAINT {name} UNIQUE ({cols})"
        ))
    else:
        # SQLite does not support ADD CONSTRAINT via ALTER TABLE
        db.execute(text(
            f"CREATE UNIQUE INDEX {name} ON {table} ({cols})"
        ))
    db.commit()
    print(f"[migrate] ✓ {name} created")


def migrate():
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        # 1. Ensure users.last_login column exists (required for its index)
        if "users" in tables:
            _ensure_column(db, inspector, "users", "last_login", "last_login")

        # 2. Single-column indexes
        for table, column, name in SINGLE_COLUMN_INDEXES:
            if table not in tables:
                print(f"[migrate] Skipping {name}: table {table} not found")
                continue
            _create_single_index(db, inspector, table, column, name)

        # 3. Composite indexes
        for table, columns, name in COMPOSITE_INDEXES:
            if table not in tables:
                print(f"[migrate] Skipping {name}: table {table} not found")
                continue
            _create_composite_index(db, inspector, table, columns, name)

        # 4. Unique constraints
        for table, columns, name in UNIQUE_CONSTRAINTS:
            if table not in tables:
                print(f"[migrate] Skipping {name}: table {table} not found")
                continue
            _create_unique_constraint(db, inspector, table, columns, name)

        print("[migrate] All indexes and constraints ready ✓")

    except Exception as e:
        db.rollback()
        print(f"[migrate] ERROR: {e}")
        raise
    finally:
        db.close()


def _drop_index(db, table, name):
    print(f"[rollback] Dropping index {name}...")
    db.execute(text(f"DROP INDEX IF EXISTS {name}"))
    db.commit()
    print(f"[rollback] ✓ {name} dropped")


def _drop_unique_constraint(db, table, name):
    print(f"[rollback] Dropping unique constraint {name}...")
    if engine.dialect.name == "postgresql":
        db.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name}"))
    else:
        db.execute(text(f"DROP INDEX IF EXISTS {name}"))
    db.commit()
    print(f"[rollback] ✓ {name} dropped")


def rollback():
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        # Drop unique constraints first (some may be backed by indexes)
        for table, columns, name in UNIQUE_CONSTRAINTS:
            if table in tables:
                _drop_unique_constraint(db, table, name)

        # Drop composite indexes
        for table, columns, name in COMPOSITE_INDEXES:
            if table in tables:
                _drop_index(db, table, name)

        # Drop single-column indexes
        for table, column, name in SINGLE_COLUMN_INDEXES:
            if table in tables:
                _drop_index(db, table, name)

        # Note: we intentionally do not drop the users.last_login column,
        # because it may contain data since the migration ran.

        print("[rollback] Done")

    except Exception as e:
        db.rollback()
        print(f"[rollback] ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Add or remove performance indexes and unique constraints."
    )
    parser.add_argument("--rollback", action="store_true", help="Rollback migration")
    args = parser.parse_args()

    if args.rollback:
        rollback()
    else:
        migrate()
