"""
Migration script to create newsletter_subscribers table if it does not exist.
"""
import os
import sys
from sqlalchemy import text

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine

def migrate():
    print("[MIGRATION] Checking/creating newsletter_subscribers table...")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                name VARCHAR(120),
                source VARCHAR(60) NOT NULL DEFAULT 'footer',
                frequency VARCHAR(30) NOT NULL DEFAULT 'weekly',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_sent_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                unsubscribed_at TIMESTAMP WITH TIME ZONE
            );
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_newsletter_subscribers_email ON newsletter_subscribers (email);
            CREATE INDEX IF NOT EXISTS ix_newsletter_subscribers_is_active ON newsletter_subscribers (is_active);
        """))
    print("[MIGRATION] newsletter_subscribers table successfully ensured.")

if __name__ == "__main__":
    migrate()
