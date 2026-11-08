#!/usr/bin/env python3
"""
Migrate local SQLite DB to community v2 schema.
Adds missing tables/columns for sections, comment likes, moderation, etc.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from database import engine

# engine already configured in database.py
conn = engine.connect()

# 1) community_sections
conn.execute(text("""
CREATE TABLE IF NOT EXISTS community_sections (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
)
"""))

# 2) community_comment_likes
conn.execute(text("""
CREATE TABLE IF NOT EXISTS community_comment_likes (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""))

# Helper to add columns if missing
def add_col(table, col, dtype, default=None):
    inspector = inspect(engine)
    cols = [c['name'] for c in inspector.get_columns(table)]
    if col not in cols:
        sql = f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"
        if default is not None:
            sql += f" DEFAULT {default}"
        conn.execute(text(sql))
        print(f"Added {table}.{col}")
    else:
        print(f"Skipped {table}.{col} (already exists)")

# 3) community_posts columns
add_col("community_posts", "author_type", "VARCHAR(20)", "'user'")
add_col("community_posts", "title", "VARCHAR(255)")
add_col("community_posts", "section_id", "INTEGER")
add_col("community_posts", "view_count", "INTEGER", 0)
add_col("community_posts", "is_approved", "BOOLEAN", 1)
add_col("community_posts", "deleted_at", "DATETIME")

# 4) community_comments columns
add_col("community_comments", "like_count", "INTEGER", 0)
add_col("community_comments", "is_approved", "BOOLEAN", 1)

# 5) Seed default sections
sections = [
    ("General", "general", "General discussion"),
    ("Events", "events", "Talk about events"),
    ("Music", "music", "Share and discover music"),
    ("Food & Drink", "food-drink", "Restaurants, bars, and nightlife"),
    ("City Guide", "city-guide", "Tips and recommendations"),
]
for name, slug, desc in sections:
    existing = conn.execute(text("SELECT id FROM community_sections WHERE slug = :slug"), {"slug": slug}).fetchone()
    if not existing:
        conn.execute(text("""
            INSERT INTO community_sections (name, slug, description, sort_order, is_active)
            VALUES (:name, :slug, :desc, :sort, 1)
        """), {"name": name, "slug": slug, "desc": desc, "sort": 0})
        print(f"Seeded section: {name}")
    else:
        print(f"Section exists: {name}")

conn.commit()
conn.close()
print("Community migration complete.")
