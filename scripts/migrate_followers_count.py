#!/usr/bin/env python3
"""
Migration: Add followers_count columns to organizer_profiles and vendor_profiles.
Run this after updating models.py to add the new columns.
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, Base
from models import OrganizerProfile, VendorProfile

def migrate():
    db_type = engine.dialect.name
    
    with engine.connect() as conn:
        if db_type == "postgresql":
            # Check if column exists before adding
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'organizer_profiles' AND column_name = 'followers_count'
            """))
            if not result.fetchone():
                conn.execute(text("ALTER TABLE organizer_profiles ADD COLUMN followers_count INTEGER DEFAULT 0"))
                print("✅ Added followers_count to organizer_profiles")
            else:
                print("ℹ️ followers_count already exists on organizer_profiles")
            
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'vendor_profiles' AND column_name = 'followers_count'
            """))
            if not result.fetchone():
                conn.execute(text("ALTER TABLE vendor_profiles ADD COLUMN followers_count INTEGER DEFAULT 0"))
                print("✅ Added followers_count to vendor_profiles")
            else:
                print("ℹ️ followers_count already exists on vendor_profiles")
            
            conn.commit()
        else:
            # SQLite: use Alembic-style approach or create tables fresh
            from sqlalchemy import inspect
            inspector = inspect(engine)
            
            op_columns = [c['name'] for c in inspector.get_columns('organizer_profiles')]
            if 'followers_count' not in op_columns:
                conn.execute(text("ALTER TABLE organizer_profiles ADD COLUMN followers_count INTEGER DEFAULT 0"))
                print("✅ Added followers_count to organizer_profiles (SQLite)")
            else:
                print("ℹ️ followers_count already exists on organizer_profiles (SQLite)")
            
            vp_columns = [c['name'] for c in inspector.get_columns('vendor_profiles')]
            if 'followers_count' not in vp_columns:
                conn.execute(text("ALTER TABLE vendor_profiles ADD COLUMN followers_count INTEGER DEFAULT 0"))
                print("✅ Added followers_count to vendor_profiles (SQLite)")
            else:
                print("ℹ️ followers_count already exists on vendor_profiles (SQLite)")
            
            conn.commit()
    
    print("\n🎉 Migration complete!")

if __name__ == "__main__":
    migrate()
