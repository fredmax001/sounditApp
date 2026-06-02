#!/usr/bin/env python3
"""
Migration: Ensure staff_members table exists with all required columns.
Also adds user_id column for linking staff to existing platform users.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, Base
from sqlalchemy import text, inspect
from models import StaffMember

def migrate():
    inspector = inspect(engine)
    
    # Check if staff_members table exists
    if 'staff_members' not in inspector.get_table_names():
        print("Creating staff_members table...")
        StaffMember.__table__.create(engine)
        print("✅ staff_members table created")
    else:
        print("staff_members table exists, checking columns...")
        columns = [c['name'] for c in inspector.get_columns('staff_members')]
        
        with engine.begin() as conn:
            if 'last_login' not in columns:
                print("Adding last_login column...")
                conn.execute(text("ALTER TABLE staff_members ADD COLUMN last_login TIMESTAMP WITH TIME ZONE"))
                print("✅ last_login added")
            else:
                print("last_login already exists")
            
            if 'user_id' not in columns:
                print("Adding user_id column...")
                conn.execute(text("ALTER TABLE staff_members ADD COLUMN user_id INTEGER"))
                print("✅ user_id added")
            else:
                print("user_id already exists")
            
            # Check for duplicate updated_at columns (SQLite only)
            if engine.dialect.name == 'sqlite':
                # SQLite doesn't support DROP COLUMN easily, just log it
                print("⚠️ SQLite detected — if duplicate updated_at exists, recreate table manually")
            else:
                # PostgreSQL
                result = conn.execute(text("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_name = 'staff_members' AND column_name = 'updated_at'
                """)).scalar()
                if result and result > 1:
                    print(f"⚠️ Found {result} updated_at columns — fixing...")
                    # PostgreSQL fix: drop one duplicate
                    conn.execute(text("""
                        ALTER TABLE staff_members DROP COLUMN IF EXISTS updated_at;
                    """))
                    conn.execute(text("""
                        ALTER TABLE staff_members ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
                    """))
                    print("✅ Fixed duplicate updated_at")
    
    print("\n🎉 Staff members migration complete!")

if __name__ == "__main__":
    migrate()
