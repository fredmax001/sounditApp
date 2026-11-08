#!/usr/bin/env python3
"""
Migration: Add promoter_name column to event_promoters table.
This column was added to the model but missing from the original migration.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine

insp = inspect(engine)

with engine.connect() as conn:
    if 'event_promoters' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('event_promoters')]
        if 'promoter_name' not in cols:
            conn.execute(text("ALTER TABLE event_promoters ADD COLUMN promoter_name VARCHAR(100)"))
            conn.commit()
            print("[OK] Added event_promoters.promoter_name")
        else:
            print("[SKIP] event_promoters.promoter_name already exists")
    else:
        print("[WARN] event_promoters table does not exist")
