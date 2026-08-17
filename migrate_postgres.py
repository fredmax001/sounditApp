#!/usr/bin/env python3
"""Add password_hash column to staff_members table (PostgreSQL)."""
import os
import sys

# Use the app's virtual environment
sys.path.insert(0, '/var/www/soundit/current')
os.environ.setdefault('PYTHONPATH', '/var/www/soundit/current')

from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

# Read DATABASE_URL from .env
env_path = '/var/www/soundit/current/.env'
database_url = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                database_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                break

if not database_url:
    print("ERROR: Could not find DATABASE_URL in .env")
    sys.exit(1)

engine = create_engine(database_url)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE staff_members ADD COLUMN password_hash VARCHAR(255)"))
        conn.commit()
        print("Successfully added password_hash column to staff_members")
    except ProgrammingError as e:
        if 'already exists' in str(e).lower() or 'duplicate column' in str(e).lower():
            print("password_hash column already exists. Skipping.")
        else:
            raise
