#!/usr/bin/env python3
"""
Non-destructive Migration for Smart Notification Engine:
- Adds timezone to users
- Adds category toggles & preferred_delivery_hour to notification_preferences
- Creates user_activities table
- Creates user_interests table
- Creates scheduled_notifications table
- Creates smart_notification_rules table
- Seeds default smart notification rules
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine

def run_migration():
    insp = inspect(engine)
    is_postgres = engine.dialect.name == "postgresql"
    print(f"[*] Running migration on dialect: {engine.dialect.name}")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. users table: timezone
            user_cols = [c["name"] for c in insp.get_columns("users")]
            if "timezone" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Shanghai'"))
                print("[+] Added users.timezone")
            else:
                print("[=] users.timezone already exists")

            # 2. notification_preferences: additional preference columns
            pref_cols = [c["name"] for c in insp.get_columns("notification_preferences")]
            for col, col_type in [
                ("artist_updates", "BOOLEAN DEFAULT TRUE"),
                ("recommendations", "BOOLEAN DEFAULT TRUE"),
                ("social", "BOOLEAN DEFAULT TRUE"),
                ("reengagement", "BOOLEAN DEFAULT TRUE"),
                ("preferred_delivery_hour", "INTEGER DEFAULT 18"),
            ]:
                if col not in pref_cols:
                    conn.execute(text(f"ALTER TABLE notification_preferences ADD COLUMN {col} {col_type}"))
                    print(f"[+] Added notification_preferences.{col}")
                else:
                    print(f"[=] notification_preferences.{col} already exists")

            # 3. user_activities table
            tables = insp.get_table_names()
            if "user_activities" not in tables:
                json_type = "JSONB" if is_postgres else "TEXT"
                tz_dt = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
                conn.execute(text(f"""
                    CREATE TABLE user_activities (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        action_type VARCHAR(50) NOT NULL,
                        entity_type VARCHAR(50),
                        entity_id INTEGER,
                        weight FLOAT DEFAULT 1.0,
                        metadata {json_type},
                        created_at {tz_dt} DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX ix_user_activities_user_id ON user_activities(user_id)"))
                conn.execute(text("CREATE INDEX ix_user_activities_action_type ON user_activities(action_type)"))
                conn.execute(text("CREATE INDEX ix_user_activities_created_at ON user_activities(created_at)"))
                print("[+] Created table user_activities")
            else:
                print("[=] Table user_activities already exists")

            # 4. user_interests table
            if "user_interests" not in tables:
                tz_dt = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
                conn.execute(text(f"""
                    CREATE TABLE user_interests (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        category VARCHAR(50) NOT NULL,
                        score FLOAT DEFAULT 0.0,
                        interaction_count INTEGER DEFAULT 0,
                        last_interaction_at {tz_dt},
                        updated_at {tz_dt} DEFAULT NOW(),
                        CONSTRAINT uq_user_category UNIQUE (user_id, category)
                    )
                """))
                conn.execute(text("CREATE INDEX ix_user_interests_user_id ON user_interests(user_id)"))
                conn.execute(text("CREATE INDEX ix_user_interests_category ON user_interests(category)"))
                print("[+] Created table user_interests")
            else:
                print("[=] Table user_interests already exists")

            # 5. scheduled_notifications table (Durable queue & dispatch history)
            if "scheduled_notifications" not in tables:
                json_type = "JSONB" if is_postgres else "TEXT"
                tz_dt = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
                conn.execute(text(f"""
                    CREATE TABLE scheduled_notifications (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title VARCHAR(200) NOT NULL,
                        message TEXT NOT NULL,
                        category VARCHAR(50) NOT NULL,
                        priority VARCHAR(20) DEFAULT 'normal',
                        channel VARCHAR(20) DEFAULT 'all',
                        scheduled_for_utc {tz_dt} NOT NULL,
                        sent_at {tz_dt},
                        status VARCHAR(20) DEFAULT 'pending',
                        idempotency_key VARCHAR(255) UNIQUE,
                        error_reason TEXT,
                        retry_count INTEGER DEFAULT 0,
                        data {json_type},
                        created_at {tz_dt} DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX ix_scheduled_notif_user_id ON scheduled_notifications(user_id)"))
                conn.execute(text("CREATE INDEX ix_scheduled_notif_scheduled ON scheduled_notifications(scheduled_for_utc)"))
                conn.execute(text("CREATE INDEX ix_scheduled_notif_status ON scheduled_notifications(status)"))
                conn.execute(text("CREATE INDEX ix_scheduled_notif_idempotency ON scheduled_notifications(idempotency_key)"))
                print("[+] Created table scheduled_notifications")
            else:
                print("[=] Table scheduled_notifications already exists")

            # 6. smart_notification_rules table
            if "smart_notification_rules" not in tables:
                tz_dt = "TIMESTAMP WITH TIME ZONE" if is_postgres else "DATETIME"
                conn.execute(text(f"""
                    CREATE TABLE smart_notification_rules (
                        id SERIAL PRIMARY KEY,
                        rule_key VARCHAR(50) UNIQUE NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        description TEXT,
                        category VARCHAR(50) NOT NULL,
                        is_enabled BOOLEAN DEFAULT TRUE,
                        frequency_cap_daily INTEGER DEFAULT 3,
                        frequency_cap_weekly INTEGER DEFAULT 10,
                        min_interest_score FLOAT DEFAULT 2.0,
                        last_run_at {tz_dt},
                        created_at {tz_dt} DEFAULT NOW(),
                        updated_at {tz_dt} DEFAULT NOW()
                    )
                """))
                print("[+] Created table smart_notification_rules")

                # Seed default core rules
                default_rules = [
                    ("event_interest_match", "Event Interest Match", "Notify users of new approved events matching their scored music & nightlife interests", "events", True, 2, 6, 2.0),
                    ("followed_artist_update", "Followed Creator Activity", "Notify followers when an artist or DJ releases a reel or is booked for an event", "artist_updates", True, 3, 10, 1.0),
                    ("event_countdown_48h", "48-Hour Event Reminder", "Alert saved attendees 48 hours before event start with logistics or closing ticket alerts", "countdown", True, 1, 3, 1.0),
                    ("event_countdown_24h", "24-Hour Final Countdown", "Alert saved attendees 24 hours before event start with venue details and schedule", "countdown", True, 1, 3, 1.0),
                    ("ticket_closing_soon", "Ticket Closing Alert", "Notify users when ticket sales are closing within 12 hours or low tickets remain", "ticket_alert", True, 1, 3, 2.5),
                    ("inactive_reengagement", "Inactive Member Re-engagement", "Send weekly personalized event recommendations to users inactive for 7+ days", "reengagement", True, 1, 2, 1.5),
                ]
                for key, name, desc, cat, enabled, cap_d, cap_w, min_score in default_rules:
                    conn.execute(text("""
                        INSERT INTO smart_notification_rules 
                        (rule_key, name, description, category, is_enabled, frequency_cap_daily, frequency_cap_weekly, min_interest_score, created_at, updated_at)
                        VALUES (:key, :name, :desc, :cat, :enabled, :cap_d, :cap_w, :min_score, NOW(), NOW())
                        ON CONFLICT (rule_key) DO NOTHING
                    """), {
                        "key": key, "name": name, "desc": desc, "cat": cat, "enabled": enabled,
                        "cap_d": cap_d, "cap_w": cap_w, "min_score": min_score
                    })
                print("[+] Seeded 6 default smart notification rules")
            else:
                print("[=] Table smart_notification_rules already exists")

            trans.commit()
            print("[SUCCESS] All Smart Notification schema additions applied cleanly!")
        except Exception as e:
            trans.rollback()
            print(f"[ERROR] Migration failed: {e}")
            raise e

if __name__ == "__main__":
    run_migration()
