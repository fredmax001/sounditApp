#!/usr/bin/env python3
"""
Migration: Create admin_roles table and seed default roles.
Works for both SQLite (local dev) and PostgreSQL (production).
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text, Column, Integer, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import sessionmaker
from database import Base, engine
from models import AdminRole


def migrate_sqlite():
    """SQLite migration using SQLAlchemy ORM"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if "admin_roles" in tables:
        print("[SQLite] admin_roles table already exists — skipping creation")
    else:
        print("[SQLite] Creating admin_roles table...")
        AdminRole.__table__.create(engine)
        print("[SQLite] admin_roles table created")
    
    if "admin_role_id" in [c["name"] for c in inspector.get_columns("users")]:
        print("[SQLite] users.admin_role_id already exists — skipping")
    else:
        print("[SQLite] Adding admin_role_id column to users...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN admin_role_id INTEGER"))
            conn.execute(text("CREATE INDEX ix_users_admin_role_id ON users (admin_role_id)"))
            conn.commit()
        print("[SQLite] Column added")
    
    Session = sessionmaker(bind=engine)
    db = Session()
    
    # Seed system roles
    _seed_roles(db)
    db.close()


def migrate_postgresql():
    """PostgreSQL migration using raw SQL for safety"""
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        print("[PostgreSQL] DATABASE_URL not set — skipping PostgreSQL migration")
        return
    
    pg_engine = create_engine(db_url)
    inspector = inspect(pg_engine)
    tables = inspector.get_table_names()
    
    if "admin_roles" in tables:
        print("[PostgreSQL] admin_roles table already exists — skipping creation")
    else:
        print("[PostgreSQL] Creating admin_roles table...")
        with pg_engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE admin_roles (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    description VARCHAR(500),
                    permissions JSON NOT NULL DEFAULT '[]',
                    is_system BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            conn.execute(text("CREATE INDEX ix_admin_roles_name ON admin_roles (name)"))
            conn.commit()
        print("[PostgreSQL] admin_roles table created")
    
    if "admin_role_id" in [c["name"] for c in inspector.get_columns("users")]:
        print("[PostgreSQL] users.admin_role_id already exists — skipping")
    else:
        print("[PostgreSQL] Adding admin_role_id column to users...")
        with pg_engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN admin_role_id INTEGER"))
            conn.execute(text("CREATE INDEX ix_users_admin_role_id ON users (admin_role_id)"))
            conn.execute(text("""
                ALTER TABLE users
                ADD CONSTRAINT fk_users_admin_role
                FOREIGN KEY (admin_role_id) REFERENCES admin_roles(id)
            """))
            conn.commit()
        print("[PostgreSQL] Column added")
    
    Session = sessionmaker(bind=pg_engine)
    db = Session()
    _seed_roles(db)
    db.close()


def _seed_roles(db):
    """Seed default system and custom roles if they don't exist"""
    existing = {r.name for r in db.query(AdminRole).all()}
    
    all_perms = [
        "dashboard", "analytics_read", "users_read", "events_read",
        "financials_read", "subscriptions_read", "content_read",
        "marketing_read", "support_read", "verifications_read",
        "settings_read", "admins_write",
    ]
    
    roles_to_seed = [
        {"name": "Super Admin", "description": "Full platform access", "permissions": all_perms, "is_system": True},
        {"name": "Admin", "description": "Legacy full admin access", "permissions": all_perms, "is_system": True},
        {"name": "Finance", "description": "Access to financial data and subscriptions", "permissions": ["dashboard", "analytics_read", "financials_read", "subscriptions_read"], "is_system": False},
        {"name": "Marketing", "description": "Access to ads, content, and analytics", "permissions": ["dashboard", "analytics_read", "marketing_read", "content_read"], "is_system": False},
        {"name": "Support", "description": "Access to users, verifications, and community moderation", "permissions": ["dashboard", "users_read", "support_read", "verifications_read"], "is_system": False},
        {"name": "Content Moderator", "description": "Access to content, events, and moderation", "permissions": ["dashboard", "content_read", "support_read", "events_read"], "is_system": False},
        {"name": "Community Manager", "description": "Access to community, marketing, and users", "permissions": ["dashboard", "support_read", "marketing_read", "users_read"], "is_system": False},
    ]
    
    for role_data in roles_to_seed:
        if role_data["name"] not in existing:
            role = AdminRole(**role_data)
            db.add(role)
            print(f"  Seeded role: {role_data['name']}")
        else:
            print(f"  Skipped existing role: {role_data['name']}")
    
    db.commit()


if __name__ == "__main__":
    print("=" * 60)
    print("Admin Roles Migration")
    print("=" * 60)
    
    migrate_sqlite()
    
    db_url = os.getenv("DATABASE_URL", "")
    if db_url and "postgresql" in db_url.lower():
        migrate_postgresql()
    
    print("=" * 60)
    print("Migration complete!")
    print("=" * 60)
