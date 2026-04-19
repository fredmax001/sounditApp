"""
Migration script for Hybrid Payment & Auto-Ticketing System
Run this after deploying the new code to add necessary columns.
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal

def migrate():
    db = SessionLocal()
    try:
        is_postgres = not str(engine.url).startswith("sqlite")
        
        if is_postgres:
            # PostgreSQL migrations
            migrations = [
                # TicketOrder new columns
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS ticket_tier_id INTEGER",
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS tickets_generated INTEGER DEFAULT 0",
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE",
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE",
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS validation_notes TEXT",
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS payment_date DATE",
                "ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS payment_proof_hash VARCHAR(64)",
                # Ticket new column
                "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_order_id INTEGER",
                "ALTER TABLE tickets ALTER COLUMN order_id DROP NOT NULL",
            ]
            
            for sql in migrations:
                try:
                    db.execute(text(sql))
                    print(f"OK: {sql}")
                except Exception as e:
                    print(f"SKIP/ERROR: {sql} -- {e}")
                    db.rollback()
        else:
            # SQLite migrations (handled in init_db, but we can run them here too)
            with engine.connect() as conn:
                for col, col_type in [
                    ("ticket_tier_id", "INTEGER"),
                    ("tickets_generated", "INTEGER DEFAULT 0"),
                    ("auto_approved", "BOOLEAN DEFAULT 0"),
                    ("cancelled_at", "DATETIME"),
                    ("validation_notes", "TEXT"),
                    ("payment_date", "DATE"),
                ]:
                    try:
                        conn.execute(text(f"ALTER TABLE ticket_orders ADD COLUMN {col} {col_type}"))
                        conn.commit()
                        print(f"OK: Added ticket_orders.{col}")
                    except Exception as e:
                        print(f"SKIP: ticket_orders.{col} -- {e}")
                
                try:
                    conn.execute(text("ALTER TABLE tickets ADD COLUMN ticket_order_id INTEGER"))
                    conn.commit()
                    print("OK: Added tickets.ticket_order_id")
                except Exception as e:
                    print(f"SKIP: tickets.ticket_order_id -- {e}")
        
        db.commit()
        print("Migration completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
