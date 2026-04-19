#!/usr/bin/env python3
"""
Migrate local SQLite DB to add missing columns to users table.
Adds username, password_reset_token, password_reset_expires_at.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine

insp = inspect(engine)
cols = [c['name'] for c in insp.get_columns('users')]

with engine.connect() as conn:
    if 'username' not in cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(100)"))
        print("Added users.username")
    else:
        print("Skipped users.username")

    if 'password_reset_token' not in cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255)"))
        print("Added users.password_reset_token")
    else:
        print("Skipped users.password_reset_token")

    if 'password_reset_expires_at' not in cols:
        conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME"))
        print("Added users.password_reset_expires_at")
    else:
        print("Skipped users.password_reset_expires_at")

    conn.commit()

print("Users table migration complete.")
