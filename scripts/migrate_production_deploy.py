#!/usr/bin/env python3
"""
Production migration script for deployment 2026-04-21.
Run on the production server after code deployment.
"""
import sys
sys.path.insert(0, '/var/www/soundit')

from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        # 1. Add hearthis_url to artist_profiles
        conn.execute(text("""
            ALTER TABLE artist_profiles
            ADD COLUMN IF NOT EXISTS hearthis_url VARCHAR(500);
        """))
        print("[OK] artist_profiles.hearthis_url added")

        # 2. Add payment fields to booking_requests
        conn.execute(text("""
            ALTER TABLE booking_requests
            ADD COLUMN IF NOT EXISTS payment_screenshot VARCHAR(500),
            ADD COLUMN IF NOT EXISTS payment_amount FLOAT,
            ADD COLUMN IF NOT EXISTS payer_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS payer_notes TEXT,
            ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        """))
        print("[OK] booking_requests payment fields added")

        conn.commit()
        print("[OK] All migrations committed successfully")

if __name__ == "__main__":
    migrate()
