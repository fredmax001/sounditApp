#!/usr/bin/env python3
"""
Migration: Add is_trial column to subscriptions table.
Run on the production server after code deployment.
"""
import sys
sys.path.insert(0, '/var/www/soundit')

from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions' AND column_name = 'is_trial'
        """))
        has_column = result.fetchone() is not None
        
        if not has_column:
            conn.execute(text("""
                ALTER TABLE subscriptions
                ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE
            """))
            conn.commit()
            print("[OK] subscriptions.is_trial column added")
        else:
            print("[OK] subscriptions.is_trial column already exists")
        
        print("[OK] Migration completed successfully")

if __name__ == "__main__":
    migrate()
