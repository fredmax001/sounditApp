"""
Migration: Approve all existing artist, business, organizer, and vendor profiles.

This ensures existing accounts that were previously visible remain visible
after the is_approved filter was added to public listings.
New signups will still require admin approval (is_approved defaults to False).
"""
import sys
sys.path.insert(0, '/var/www/soundit')

from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        # Approve all existing artist profiles
        result = conn.execute(text("UPDATE artist_profiles SET is_approved = TRUE WHERE is_approved = FALSE OR is_approved IS NULL"))
        print(f"Approved {result.rowcount} artist profiles")
        
        # Approve all existing business profiles
        result = conn.execute(text("UPDATE business_profiles SET is_approved = TRUE WHERE is_approved = FALSE OR is_approved IS NULL"))
        print(f"Approved {result.rowcount} business profiles")
        
        # Approve all existing organizer profiles
        result = conn.execute(text("UPDATE organizer_profiles SET is_approved = TRUE WHERE is_approved = FALSE OR is_approved IS NULL"))
        print(f"Approved {result.rowcount} organizer profiles")
        
        # Approve all existing vendor profiles
        result = conn.execute(text("UPDATE vendor_profiles SET is_approved = TRUE WHERE is_approved = FALSE OR is_approved IS NULL"))
        print(f"Approved {result.rowcount} vendor profiles")
        
        conn.commit()
    print("Migration complete. All existing profiles are now approved.")

if __name__ == "__main__":
    migrate()
