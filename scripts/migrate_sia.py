"""
Migration: Create SIA (Sound It Assistant) tables.

Run: python scripts/migrate_sia.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, Base
from models import AssistantSession, AssistantMessage, AssistantDraft


def migrate_sqlite():
    from sqlalchemy import create_engine
    db_path = engine.url.database
    print(f"[migrate_sia] Using SQLite: {db_path}")
    Base.metadata.create_all(bind=engine, tables=[
        AssistantSession.__table__,
        AssistantMessage.__table__,
        AssistantDraft.__table__,
    ])
    print("[migrate_sia] Tables created/verified.")


def migrate_postgres():
    print("[migrate_sia] Using PostgreSQL")
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS assistant_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200),
                context_json JSONB DEFAULT '{}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user_id ON assistant_sessions(user_id);
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS assistant_messages (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                payload_json JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_assistant_messages_session_id ON assistant_messages(session_id);
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS assistant_drafts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                draft_type VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'draft',
                title VARCHAR(300),
                payload_json JSONB DEFAULT '{}',
                source_media_url VARCHAR(500),
                published_event_id INTEGER REFERENCES events(id),
                published_product_ids JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_assistant_drafts_user_id ON assistant_drafts(user_id);
            CREATE INDEX IF NOT EXISTS idx_assistant_drafts_status ON assistant_drafts(status);
        """))
        conn.commit()
    print("[migrate_sia] Tables created/verified.")


if __name__ == "__main__":
    driver = engine.url.drivername
    if "sqlite" in driver:
        migrate_sqlite()
    elif "postgres" in driver:
        migrate_postgres()
    else:
        print(f"[migrate_sia] Unknown driver {driver}, attempting generic create_all")
        Base.metadata.create_all(bind=engine, tables=[
            AssistantSession.__table__,
            AssistantMessage.__table__,
            AssistantDraft.__table__,
        ])
