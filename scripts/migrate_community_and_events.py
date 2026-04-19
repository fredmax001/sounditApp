"""
Migration script for community module enhancements and event lat/lng.
Run this on the production server after deploying backend code.
"""
import sys
sys.path.insert(0, '/var/www/soundit')

from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        # 1. Create community_sections table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS community_sections (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                icon VARCHAR(255),
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            )
        """))
        
        # 2. Alter community_posts
        columns_to_add = [
            ("title", "VARCHAR(255)"),
            ("section_id", "INTEGER REFERENCES community_sections(id)"),
            ("author_type", "VARCHAR(20) DEFAULT 'user'"),
            ("view_count", "INTEGER DEFAULT 0"),
            ("is_approved", "BOOLEAN DEFAULT TRUE"),
            ("deleted_at", "TIMESTAMP WITH TIME ZONE"),
        ]
        for col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"""
                    ALTER TABLE community_posts 
                    ADD COLUMN IF NOT EXISTS {col_name} {col_type}
                """))
            except Exception as e:
                print(f"Note: community_posts.{col_name}: {e}")
        
        # 3. Alter community_comments
        try:
            conn.execute(text("""
                ALTER TABLE community_comments 
                ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0
            """))
        except Exception as e:
            print(f"Note: community_comments.like_count: {e}")
        
        try:
            conn.execute(text("""
                ALTER TABLE community_comments 
                ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE
            """))
        except Exception as e:
            print(f"Note: community_comments.is_approved: {e}")
        
        # 4. Create community_comment_likes table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS community_comment_likes (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(comment_id, user_id)
            )
        """))
        
        # 5. Alter events - add lat/lng
        try:
            conn.execute(text("""
                ALTER TABLE events 
                ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION
            """))
        except Exception as e:
            print(f"Note: events.latitude: {e}")
        
        try:
            conn.execute(text("""
                ALTER TABLE events 
                ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
            """))
        except Exception as e:
            print(f"Note: events.longitude: {e}")
        
        # 6. Alter clubs - add lat/lng/category (for city guide)
        try:
            conn.execute(text("""
                ALTER TABLE clubs 
                ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION
            """))
        except Exception as e:
            print(f"Note: clubs.latitude: {e}")
        
        try:
            conn.execute(text("""
                ALTER TABLE clubs 
                ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
            """))
        except Exception as e:
            print(f"Note: clubs.longitude: {e}")
        
        try:
            conn.execute(text("""
                ALTER TABLE clubs 
                ADD COLUMN IF NOT EXISTS category VARCHAR(50)
            """))
        except Exception as e:
            print(f"Note: clubs.category: {e}")
        
        # 7. Alter food_spots - add lat/lng
        try:
            conn.execute(text("""
                ALTER TABLE food_spots 
                ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION
            """))
        except Exception as e:
            print(f"Note: food_spots.latitude: {e}")
        
        try:
            conn.execute(text("""
                ALTER TABLE food_spots 
                ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
            """))
        except Exception as e:
            print(f"Note: food_spots.longitude: {e}")
        
        # 8. Seed default community sections
        sections = [
            ("General", "general", "General discussions"),
            ("Events", "events", "Discuss upcoming and past events"),
            ("Music", "music", "Share and discover music"),
            ("Venues", "venues", "Talk about venues and locations"),
            ("Artists", "artists", "Connect with artists and DJs"),
        ]
        for name, slug, desc in sections:
            conn.execute(text("""
                INSERT INTO community_sections (name, slug, description, sort_order, is_active)
                VALUES (:name, :slug, :desc, 0, TRUE)
                ON CONFLICT (slug) DO NOTHING
            """), {"name": name, "slug": slug, "desc": desc})
        
        conn.commit()
        print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
