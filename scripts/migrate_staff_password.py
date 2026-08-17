#!/usr/bin/env python3
"""
Migration script to add password_hash column to staff_members table.
Run this on production before deploying the new code.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from config import get_settings

def migrate():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if password_hash column already exists
        result = conn.execute(text("""
            PRAGMA table_info(staff_members)
        """))
        columns = [row[1] for row in result.fetchall()]
        
        if 'password_hash' in columns:
            print("password_hash column already exists. Skipping migration.")
            return
        
        # Add password_hash column
        conn.execute(text("""
            ALTER TABLE staff_members ADD COLUMN password_hash VARCHAR(255)
        """))
        conn.commit()
        print("Successfully added password_hash column to staff_members table")

if __name__ == "__main__":
    migrate()
