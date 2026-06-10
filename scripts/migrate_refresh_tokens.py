"""
Migration: Add refresh_token columns to users table.
Works on both SQLite and PostgreSQL.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from config import get_settings

def migrate():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        dialect = engine.dialect.name
        
        # Check if columns already exist
        if dialect == "postgresql":
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'refresh_token'
            """))
            has_refresh_token = result.fetchone() is not None
            
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'refresh_token_expires_at'
            """))
            has_refresh_expires = result.fetchone() is not None
        else:
            # SQLite
            result = conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            has_refresh_token = 'refresh_token' in columns
            has_refresh_expires = 'refresh_token_expires_at' in columns
        
        if not has_refresh_token:
            if dialect == "postgresql":
                conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(255) UNIQUE"))
                conn.execute(text("CREATE INDEX idx_users_refresh_token ON users(refresh_token)"))
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(255)"))
            print("✅ Added refresh_token column")
        else:
            print("ℹ️ refresh_token column already exists")
        
        if not has_refresh_expires:
            if dialect == "postgresql":
                conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token_expires_at TIMESTAMP WITH TIME ZONE"))
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token_expires_at TIMESTAMP"))
            print("✅ Added refresh_token_expires_at column")
        else:
            print("ℹ️ refresh_token_expires_at column already exists")
        
        conn.commit()
    
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
