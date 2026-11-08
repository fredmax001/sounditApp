"""
Migration: Add 'slug' column and backfill human-readable slugs for:
- artist_profiles (from stage_name)
- events (from title)
- organizer_profiles (from organization_name)
- business_profiles (from business_name)
- vendor_profiles (from business_name)
"""
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, get_db
from sqlalchemy import text
from utils.slug import slugify, generate_unique_slug
from models import ArtistProfile, Event, OrganizerProfile, BusinessProfile, VendorProfile


def run_migration():
    print("[MIGRATION] Ensuring 'slug' column exists on all entity tables...")
    
    statements = [
        # Columns
        "ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS slug VARCHAR(120);",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS slug VARCHAR(220);",
        "ALTER TABLE organizer_profiles ADD COLUMN IF NOT EXISTS slug VARCHAR(220);",
        "ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS slug VARCHAR(220);",
        "ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS slug VARCHAR(220);",
        # Indexes
        "CREATE INDEX IF NOT EXISTS ix_artist_profiles_slug ON artist_profiles (slug);",
        "CREATE INDEX IF NOT EXISTS ix_events_slug ON events (slug);",
        "CREATE INDEX IF NOT EXISTS ix_organizer_profiles_slug ON organizer_profiles (slug);",
        "CREATE INDEX IF NOT EXISTS ix_business_profiles_slug ON business_profiles (slug);",
        "CREATE INDEX IF NOT EXISTS ix_vendor_profiles_slug ON vendor_profiles (slug);",
    ]
    
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"[WARN] Statement failed: {stmt} -> {e}")

    print("[MIGRATION] Columns and indexes ready. Now backfilling slugs...")

    # Backfill with DB session
    from database import SessionLocal
    db = SessionLocal()
    try:
        # 1. Artists
        artists = db.query(ArtistProfile).all()
        existing_artist_slugs = set()
        for a in artists:
            if not a.slug:
                a.slug = generate_unique_slug(a.stage_name or f"artist-{a.id}", existing_artist_slugs, a.id)
            existing_artist_slugs.add(a.slug)
            print(f"  Artist {a.id} ({a.stage_name}) -> slug: {a.slug}")

        # 2. Events
        events = db.query(Event).all()
        existing_event_slugs = set()
        for ev in events:
            if not ev.slug:
                ev.slug = generate_unique_slug(ev.title or f"event-{ev.id}", existing_event_slugs, ev.id)
            existing_event_slugs.add(ev.slug)
            print(f"  Event {ev.id} ({ev.title}) -> slug: {ev.slug}")

        # 3. Organizers
        organizers = db.query(OrganizerProfile).all()
        existing_org_slugs = set()
        for o in organizers:
            if not o.slug:
                o.slug = generate_unique_slug(o.organization_name or f"organizer-{o.id}", existing_org_slugs, o.id)
            existing_org_slugs.add(o.slug)
            print(f"  Organizer {o.id} ({o.organization_name}) -> slug: {o.slug}")

        # 4. Businesses
        businesses = db.query(BusinessProfile).all()
        existing_biz_slugs = set()
        for b in businesses:
            if not b.slug:
                b.slug = generate_unique_slug(b.business_name or f"business-{b.id}", existing_biz_slugs, b.id)
            existing_biz_slugs.add(b.slug)
            print(f"  Business {b.id} ({b.business_name}) -> slug: {b.slug}")

        # 5. Vendors
        vendors = db.query(VendorProfile).all()
        existing_vendor_slugs = set()
        for v in vendors:
            if not v.slug:
                v.slug = generate_unique_slug(v.business_name or f"vendor-{v.id}", existing_vendor_slugs, v.id)
            existing_vendor_slugs.add(v.slug)
            print(f"  Vendor {v.id} ({v.business_name}) -> slug: {v.slug}")

        db.commit()
        print("[MIGRATION] Backfill complete and committed!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Backfill failed: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()
