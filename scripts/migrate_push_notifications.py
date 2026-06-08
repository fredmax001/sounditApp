#!/usr/bin/env python3
"""
Migration: Push Notification System Tables
- Adds data column to notifications
- Creates push_subscriptions table
- Creates notification_preferences table
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine, SessionLocal


def migrate():
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # 1. Add data column to notifications if missing
        if "notifications" in tables:
            columns = [c["name"] for c in inspector.get_columns("notifications")]
            if "data" not in columns:
                print("[migrate] Adding 'data' column to notifications...")
                db.execute(text("ALTER TABLE notifications ADD COLUMN data JSONB"))
                db.commit()
                print("[migrate] ✓ data column added")
            else:
                print("[migrate] data column already exists")
        
        # 2. Create push_subscriptions table
        if "push_subscriptions" not in tables:
            print("[migrate] Creating push_subscriptions table...")
            db.execute(text("""
                CREATE TABLE push_subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    device_type VARCHAR(20) DEFAULT 'unknown',
                    browser VARCHAR(20) DEFAULT 'unknown',
                    is_active BOOLEAN DEFAULT TRUE,
                    failure_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            db.execute(text("CREATE INDEX idx_push_sub_user ON push_subscriptions(user_id)"))
            db.execute(text("CREATE INDEX idx_push_sub_active ON push_subscriptions(is_active)"))
            db.commit()
            print("[migrate] ✓ push_subscriptions table created")
        else:
            print("[migrate] push_subscriptions table already exists")
        
        # 3. Create notification_preferences table
        if "notification_preferences" not in tables:
            print("[migrate] Creating notification_preferences table...")
            db.execute(text("""
                CREATE TABLE notification_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    signup_alerts BOOLEAN DEFAULT TRUE,
                    messages BOOLEAN DEFAULT TRUE,
                    bookings BOOLEAN DEFAULT TRUE,
                    booking_updates BOOLEAN DEFAULT TRUE,
                    payments BOOLEAN DEFAULT TRUE,
                    verifications BOOLEAN DEFAULT TRUE,
                    subscriptions BOOLEAN DEFAULT TRUE,
                    events BOOLEAN DEFAULT TRUE,
                    marketing BOOLEAN DEFAULT FALSE,
                    push_enabled BOOLEAN DEFAULT TRUE,
                    email_enabled BOOLEAN DEFAULT TRUE,
                    sms_enabled BOOLEAN DEFAULT FALSE,
                    quiet_hours_start VARCHAR(5),
                    quiet_hours_end VARCHAR(5),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            db.execute(text("CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id)"))
            db.commit()
            print("[migrate] ✓ notification_preferences table created")
        else:
            print("[migrate] notification_preferences table already exists")
        
        print("[migrate] All push notification tables ready ✓")
        
    except Exception as e:
        db.rollback()
        print(f"[migrate] ERROR: {e}")
        raise
    finally:
        db.close()


def rollback():
    db = SessionLocal()
    try:
        print("[rollback] Dropping push notification tables...")
        db.execute(text("DROP TABLE IF EXISTS notification_preferences"))
        db.execute(text("DROP TABLE IF EXISTS push_subscriptions"))
        # Note: we don't drop the 'data' column from notifications
        db.commit()
        print("[rollback] Done")
    except Exception as e:
        db.rollback()
        print(f"[rollback] ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rollback", action="store_true", help="Rollback migration")
    args = parser.parse_args()
    
    if args.rollback:
        rollback()
    else:
        migrate()
