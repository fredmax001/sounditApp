#!/usr/bin/env python3
"""
Migration: Add tiktok column to users table.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine

insp = inspect(engine)

with engine.connect() as conn:
    if 'users' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('users')]
        if 'tiktok' not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN tiktok VARCHAR(255)"))
            conn.commit()
            print("[OK] Added users.tiktok")
        else:
            print("[SKIP] users.tiktok already exists")
    else:
        print("[WARN] users table does not exist")
