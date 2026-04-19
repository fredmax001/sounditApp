#!/usr/bin/env python3
"""
Production PostgreSQL migration script.
Run on the server to add missing columns and tables.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from database import engine

insp = inspect(engine)

with engine.connect() as conn:
    # events
    cols = [c['name'] for c in insp.get_columns('events')]
    for col, col_type in [
        ('is_featured', 'BOOLEAN DEFAULT FALSE'),
        ('wechat_qr_url', 'VARCHAR(500)'),
        ('alipay_qr_url', 'VARCHAR(500)'),
        ('ticket_price', 'FLOAT'),
        ('payment_instructions', 'TEXT'),
        ('event_type', 'VARCHAR(100)'),
        ('refund_policy', 'VARCHAR(50)'),
        ('require_id', 'BOOLEAN DEFAULT FALSE'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added events.{col}")
        else:
            print(f"Skipped events.{col}")

    # products
    cols = [c['name'] for c in insp.get_columns('products')]
    for col, col_type in [
        ('wechat_qr_url', 'VARCHAR(500)'),
        ('alipay_qr_url', 'VARCHAR(500)'),
        ('payment_instructions', 'TEXT'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE products ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added products.{col}")
        else:
            print(f"Skipped products.{col}")

    # artist_profiles
    cols = [c['name'] for c in insp.get_columns('artist_profiles')]
    for col, col_type in [
        ('wechat_qr_url', 'VARCHAR(500)'),
        ('alipay_qr_url', 'VARCHAR(500)'),
        ('payment_instructions', 'TEXT'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE artist_profiles ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added artist_profiles.{col}")
        else:
            print(f"Skipped artist_profiles.{col}")

    # booking_requests
    cols = [c['name'] for c in insp.get_columns('booking_requests')]
    for col, col_type in [
        ('payment_screenshot', 'VARCHAR(500)'),
        ('payment_amount', 'FLOAT'),
        ('payer_name', 'VARCHAR(100)'),
        ('payer_notes', 'TEXT'),
        ("payment_status", "VARCHAR(20) DEFAULT 'pending'"),
        ('reviewed_at', 'TIMESTAMP WITH TIME ZONE'),
        ('rejection_reason', 'TEXT'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE booking_requests ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added booking_requests.{col}")
        else:
            print(f"Skipped booking_requests.{col}")

    # ticket_orders
    cols = [c['name'] for c in insp.get_columns('ticket_orders')]
    if 'quantity' not in cols:
        conn.execute(text("ALTER TABLE ticket_orders ADD COLUMN quantity INTEGER DEFAULT 1"))
        conn.commit()
        print("Added ticket_orders.quantity")
    else:
        print("Skipped ticket_orders.quantity")

    # table_packages
    cols = [c['name'] for c in insp.get_columns('table_packages')]
    if 'total_tables' not in cols:
        conn.execute(text("ALTER TABLE table_packages ADD COLUMN total_tables INTEGER DEFAULT 1"))
        conn.commit()
        print("Added table_packages.total_tables")
    else:
        print("Skipped table_packages.total_tables")

    # table_orders
    cols = [c['name'] for c in insp.get_columns('table_orders')]
    for col, col_type in [
        ('ticket_qr_code', 'VARCHAR(1500)'),
        ('ticket_code', 'VARCHAR(255)'),
        ('used_at', 'TIMESTAMP WITH TIME ZONE'),
        ('used_by', 'INTEGER'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE table_orders ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added table_orders.{col}")
        else:
            print(f"Skipped table_orders.{col}")

    # community_posts
    cols = [c['name'] for c in insp.get_columns('community_posts')]
    for col, col_type in [
        ('author_type', 'VARCHAR(20) DEFAULT \'user\''),
        ('title', 'VARCHAR(255)'),
        ('section_id', 'INTEGER'),
        ('view_count', 'INTEGER DEFAULT 0'),
        ('is_approved', 'BOOLEAN DEFAULT TRUE'),
        ('deleted_at', 'TIMESTAMP WITH TIME ZONE'),
        ('guest_id', 'VARCHAR(100)'),
        ('guest_name', 'VARCHAR(100)'),
        ('guest_email', 'VARCHAR(200)'),
        ('videos', 'JSON'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE community_posts ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added community_posts.{col}")
        else:
            print(f"Skipped community_posts.{col}")

    # community_comments
    cols = [c['name'] for c in insp.get_columns('community_comments')]
    for col, col_type in [
        ('like_count', 'INTEGER DEFAULT 0'),
        ('is_approved', 'BOOLEAN DEFAULT TRUE'),
        ('guest_id', 'VARCHAR(100)'),
        ('guest_name', 'VARCHAR(100)'),
        ('guest_email', 'VARCHAR(200)'),
    ]:
        if col not in cols:
            conn.execute(text(f"ALTER TABLE community_comments ADD COLUMN {col} {col_type}"))
            conn.commit()
            print(f"Added community_comments.{col}")
        else:
            print(f"Skipped community_comments.{col}")

    # community_likes
    cols = [c['name'] for c in insp.get_columns('community_likes')]
    if 'guest_id' not in cols:
        conn.execute(text("ALTER TABLE community_likes ADD COLUMN guest_id VARCHAR(100)"))
        conn.commit()
        print("Added community_likes.guest_id")
    else:
        print("Skipped community_likes.guest_id")

    # community_comment_likes table
    if 'community_comment_likes' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE community_comment_likes (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER NOT NULL,
                user_id INTEGER,
                guest_id VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()
        print("Created community_comment_likes table")
    else:
        cols = [c['name'] for c in insp.get_columns('community_comment_likes')]
        if 'guest_id' not in cols:
            conn.execute(text("ALTER TABLE community_comment_likes ADD COLUMN guest_id VARCHAR(100)"))
            conn.commit()
            print("Added community_comment_likes.guest_id")
        else:
            print("Skipped community_comment_likes.guest_id")

    # community_shares
    if 'community_shares' in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns('community_shares')]
        if 'guest_id' not in cols:
            conn.execute(text("ALTER TABLE community_shares ADD COLUMN guest_id VARCHAR(100)"))
            conn.commit()
            print("Added community_shares.guest_id")
        else:
            print("Skipped community_shares.guest_id")
    else:
        print("community_shares table does not exist")

    # promo_codes table
    if 'promo_codes' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE promo_codes (
                id SERIAL PRIMARY KEY,
                event_id INTEGER,
                code VARCHAR(50) NOT NULL,
                discount_type VARCHAR(20) NOT NULL,
                discount_value FLOAT NOT NULL,
                max_uses INTEGER,
                current_uses INTEGER DEFAULT 0,
                valid_from TIMESTAMP WITH TIME ZONE,
                valid_until TIMESTAMP WITH TIME ZONE,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            )
        """))
        conn.commit()
        print("Created promo_codes table")
    else:
        print("Skipped promo_codes table")

    # community_sections table
    if 'community_sections' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE community_sections (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                slug VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                icon VARCHAR(100),
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            )
        """))
        conn.commit()
        print("Created community_sections table")
    else:
        print("Skipped community_sections table")

    # product_orders table
    if 'product_orders' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE product_orders (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                payment_screenshot VARCHAR(500) NOT NULL,
                payment_amount FLOAT NOT NULL,
                payer_name VARCHAR(100),
                payer_notes TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                order_qr_code VARCHAR(1500),
                order_code VARCHAR(255) UNIQUE,
                reviewed_by INTEGER,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                rejection_reason TEXT,
                used_at TIMESTAMP WITH TIME ZONE,
                used_by INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            )
        """))
        conn.commit()
        print("Created product_orders table")
    else:
        print("Skipped product_orders table")

print("Production PostgreSQL migration complete.")
