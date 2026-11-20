#!/usr/bin/env python3
"""
Migration: Full-Stack Performance Audit v2 — Targeted Single-Column & Composite Indexes
- Adds composite indexes for city-based discovery, events, artists, vendors, businesses,
  community posts/comments, reels, products, ticket tiers, clubs, food spots, and recaps.
- Adds foreign-key indexes on join/follow tables to eliminate full-table scans on eager loads.
- Supports safe rollback via `--rollback`.
"""
import os
import sys
import argparse
from sqlalchemy import text, inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# (table_name, [columns], index_name)
PERFORMANCE_V2_INDEXES = [
    # Events & Ticket Tiers
    ("events", ["city", "status", "is_featured", "start_date"], "ix_events_city_status_featured_start"),
    ("ticket_tiers", ["event_id", "status"], "ix_ticket_tiers_event_status"),
    ("event_artists", ["event_id"], "ix_event_artists_event_id"),
    ("event_artists", ["artist_id"], "ix_event_artists_artist_id"),
    ("event_vendors", ["event_id"], "ix_event_vendors_event_id"),
    ("event_vendors", ["vendor_id"], "ix_event_vendors_vendor_id"),

    # Profiles & Users (City Discovery & Filtering)
    ("users", ["role", "status", "preferred_city"], "ix_users_role_status_city"),
    ("artist_profiles", ["is_approved", "city", "is_featured", "followers_count"], "ix_artist_profiles_approved_city_featured"),
    ("vendor_profiles", ["is_approved", "city", "is_featured", "rating"], "ix_vendor_profiles_approved_city_featured"),
    ("business_profiles", ["is_approved", "city"], "ix_business_profiles_approved_city"),
    ("organizer_profiles", ["is_approved", "city", "is_featured"], "ix_organizer_profiles_approved_city_featured"),
    ("organizer_profiles", ["business_profile_id"], "ix_organizer_profiles_business_profile_id"),

    # Venues, Clubs & Food Spots
    ("clubs", ["city", "is_afrobeat_friendly"], "ix_clubs_city_afrobeat"),
    ("food_spots", ["city"], "ix_food_spots_city"),
    ("venues", ["city"], "ix_venues_city"),

    # Products & Marketplace
    ("products", ["vendor_id", "status", "is_featured", "created_at"], "ix_products_vendor_status_featured"),

    # Social Follow Tables
    ("artist_follows", ["user_id", "artist_id"], "ix_artist_follows_user_artist"),
    ("organizer_follows", ["organizer_id", "user_id"], "ix_organizer_follows_org_user"),
    ("organizer_follows", ["user_id", "organizer_id"], "ix_organizer_follows_user_org"),
    ("vendor_follows", ["user_id", "vendor_id"], "ix_vendor_follows_user_vendor"),
    ("event_follows", ["user_id", "event_id"], "ix_event_follows_user_event"),

    # Community Feed, Comments & Bookmarks
    ("community_posts", ["deleted_at", "is_approved", "created_at"], "ix_community_posts_vis_created"),
    ("community_posts", ["section_id", "deleted_at", "is_approved", "created_at"], "ix_community_posts_section_created"),
    ("community_posts", ["event_id"], "ix_community_posts_event_id"),
    ("community_posts", ["user_id", "created_at"], "ix_community_posts_user_created"),
    ("community_comments", ["post_id", "parent_comment_id", "created_at"], "ix_community_comments_post_parent_created"),
    ("community_comment_likes", ["comment_id", "user_id"], "ix_community_comment_likes_comment_user"),
    ("community_bookmarks", ["user_id", "post_id"], "ix_community_bookmarks_user_post"),

    # Reels & Recaps
    ("reels", ["status", "city", "is_featured", "created_at"], "ix_reels_status_city_featured_created"),
    ("reel_likes", ["reel_id", "user_id"], "ix_reel_likes_reel_user"),
    ("reel_saves", ["reel_id", "user_id"], "ix_reel_saves_reel_user"),
    ("recaps", ["status", "published_at"], "ix_recaps_status_published"),
    ("recaps", ["event_id"], "ix_recaps_event_id"),
    ("recaps", ["organizer_id"], "ix_recaps_organizer_id"),
]


def apply_indexes(target_engine=None):
    if target_engine is None:
        from database import engine as default_engine
        eng = default_engine
    else:
        eng = target_engine
    inspector = inspect(eng)
    tables = set(inspector.get_table_names())
    created_count = 0

    with eng.connect() as conn:
        for table, columns, idx_name in PERFORMANCE_V2_INDEXES:
            if table not in tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table)}
            if not all(col in existing_cols for col in columns):
                continue
            cols_sql = ", ".join(columns)
            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({cols_sql})"))
                created_count += 1
            except Exception as exc:
                print(f"[migrate_perf_v2] Warning creating {idx_name}: {exc}")
        conn.commit()
    return created_count


def rollback_indexes(target_engine=None):
    if target_engine is None:
        from database import engine as default_engine
        eng = default_engine
    else:
        eng = target_engine
    dropped_count = 0
    with eng.connect() as conn:
        for _, _, idx_name in reversed(PERFORMANCE_V2_INDEXES):
            try:
                conn.execute(text(f"DROP INDEX IF EXISTS {idx_name}"))
                dropped_count += 1
            except Exception as exc:
                print(f"[rollback_perf_v2] Warning dropping {idx_name}: {exc}")
        conn.commit()
    return dropped_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apply or rollback Sound It Performance v2 indexes")
    parser.add_argument("--rollback", action="store_true", help="Drop all Performance v2 indexes")
    args = parser.parse_args()

    if args.rollback:
        n = rollback_indexes()
        print(f"[rollback_perf_v2] Rolled back {n} indexes.")
    else:
        n = apply_indexes()
        print(f"[migrate_perf_v2] Ensured {n} performance indexes.")
