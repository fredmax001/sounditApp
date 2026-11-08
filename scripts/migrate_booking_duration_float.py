"""
Migration: Update booking_requests.duration_hours to DOUBLE PRECISION (Float)
Supports 30-minute booking increments (e.g. 1.5, 2.5 hours).
"""
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine
from sqlalchemy import text

def run_migration():
    print("[MIGRATION] Altering booking_requests.duration_hours to FLOAT...")
    is_sqlite = "sqlite" in str(engine.url)
    
    with engine.begin() as conn:
        if is_sqlite:
            print("[MIGRATION] SQLite handles numeric dynamically, no alter needed.")
        else:
            try:
                conn.execute(text(
                    "ALTER TABLE booking_requests ALTER COLUMN duration_hours TYPE DOUBLE PRECISION USING duration_hours::DOUBLE PRECISION;"
                ))
                print("[MIGRATION] Successfully updated column type to DOUBLE PRECISION in PostgreSQL.")
            except Exception as e:
                print(f"[MIGRATION WARNING] Could not alter column: {e}")

    print("[MIGRATION] Complete.")

if __name__ == "__main__":
    run_migration()
