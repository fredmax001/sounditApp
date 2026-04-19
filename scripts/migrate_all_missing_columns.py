#!/usr/bin/env python3
"""
Comprehensive migration for local SQLite DB to match production schema.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine

insp = inspect(engine)

with engine.connect() as conn:
    # 1) users table
    user_cols = [c['name'] for c in insp.get_columns('users')]
    for col, col_type in [
        ('username', 'VARCHAR(100)'),
        ('password_reset_token', 'VARCHAR(255)'),
        ('password_reset_expires_at', 'DATETIME'),
    ]:
        if col not in user_cols:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
            print(f"Added users.{col}")
        else:
            print(f"Skipped users.{col}")

    # 2) business_profiles
    bp_cols = [c['name'] for c in insp.get_columns('business_profiles')]
    if 'gallery_images' not in bp_cols:
        conn.execute(text("ALTER TABLE business_profiles ADD COLUMN gallery_images JSON"))
        print("Added business_profiles.gallery_images")
    else:
        print("Skipped business_profiles.gallery_images")

    # 3) products
    prod_cols = [c['name'] for c in insp.get_columns('products')]
    for col, col_type in [
        ('stock_quantity', 'INTEGER DEFAULT 0'),
        ('wechat_qr_url', 'VARCHAR(500)'),
        ('alipay_qr_url', 'VARCHAR(500)'),
        ('payment_instructions', 'TEXT'),
    ]:
        if col not in prod_cols:
            conn.execute(text(f"ALTER TABLE products ADD COLUMN {col} {col_type}"))
            print(f"Added products.{col}")
        else:
            print(f"Skipped products.{col}")

    # 3b) artist_profiles
    artist_cols = [c['name'] for c in insp.get_columns('artist_profiles')]
    for col, col_type in [
        ('wechat_qr_url', 'VARCHAR(500)'),
        ('alipay_qr_url', 'VARCHAR(500)'),
        ('payment_instructions', 'TEXT'),
    ]:
        if col not in artist_cols:
            conn.execute(text(f"ALTER TABLE artist_profiles ADD COLUMN {col} {col_type}"))
            print(f"Added artist_profiles.{col}")
        else:
            print(f"Skipped artist_profiles.{col}")
    
    # 3c) booking_requests
    booking_cols = [c['name'] for c in insp.get_columns('booking_requests')]
    for col, col_type in [
        ('payment_screenshot', 'VARCHAR(500)'),
        ('payment_amount', 'FLOAT'),
        ('payer_name', 'VARCHAR(100)'),
        ('payer_notes', 'TEXT'),
        ("payment_status", "VARCHAR(20) DEFAULT 'pending'"),
        ('reviewed_at', 'DATETIME'),
        ('rejection_reason', 'TEXT'),
    ]:
        if col not in booking_cols:
            conn.execute(text(f"ALTER TABLE booking_requests ADD COLUMN {col} {col_type}"))
            print(f"Added booking_requests.{col}")
        else:
            print(f"Skipped booking_requests.{col}")
    
    # 4) events
    event_cols = [c['name'] for c in insp.get_columns('events')]
    for col, col_type in [
        ('wechat_qr_url', 'VARCHAR(500)'),
        ('alipay_qr_url', 'VARCHAR(500)'),
        ('ticket_price', 'FLOAT'),
        ('payment_instructions', 'TEXT'),
        ('is_featured', 'BOOLEAN DEFAULT 0'),
        ('latitude', 'FLOAT'),
        ('longitude', 'FLOAT'),
        ('event_type', 'VARCHAR(100)'),
        ('refund_policy', 'VARCHAR(50)'),
        ('require_id', 'BOOLEAN DEFAULT 0'),
    ]:
        if col not in event_cols:
            conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
            print(f"Added events.{col}")
        else:
            print(f"Skipped events.{col}")

    # 5) clubs
    club_cols = [c['name'] for c in insp.get_columns('clubs')]
    for col, col_type in [
        ('latitude', 'FLOAT'),
        ('longitude', 'FLOAT'),
        ('category', 'VARCHAR(50)'),
    ]:
        if col not in club_cols:
            conn.execute(text(f"ALTER TABLE clubs ADD COLUMN {col} {col_type}"))
            print(f"Added clubs.{col}")
        else:
            print(f"Skipped clubs.{col}")

    # 6) food_spots
    food_cols = [c['name'] for c in insp.get_columns('food_spots')]
    for col, col_type in [
        ('latitude', 'FLOAT'),
        ('longitude', 'FLOAT'),
    ]:
        if col not in food_cols:
            conn.execute(text(f"ALTER TABLE food_spots ADD COLUMN {col} {col_type}"))
            print(f"Added food_spots.{col}")
        else:
            print(f"Skipped food_spots.{col}")

    # 6b) product_orders table
    if 'product_orders' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE product_orders (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
                reviewed_at DATETIME,
                rejection_reason TEXT,
                used_at DATETIME,
                used_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """))
        print("Created product_orders table")
    else:
        print("Skipped product_orders table")
    
    # 7) promo_codes table
    if 'promo_codes' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE promo_codes (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                code VARCHAR(50) NOT NULL,
                discount_type VARCHAR(20) NOT NULL,
                discount_value FLOAT NOT NULL,
                max_uses INTEGER,
                current_uses INTEGER DEFAULT 0,
                valid_from DATETIME,
                valid_until DATETIME,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """))
        print("Created promo_codes table")
    else:
        print("Skipped promo_codes table")

    # 8) community_sections table
    if 'community_sections' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE community_sections (
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
        print("Created community_sections table")
    else:
        print("Skipped community_sections table")

    # 9) community_comment_likes table
    if 'community_comment_likes' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE community_comment_likes (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                comment_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("Created community_comment_likes table")
    else:
        print("Skipped community_comment_likes table")

    # 10) community_posts missing columns
    cp_cols = [c['name'] for c in insp.get_columns('community_posts')]
    for col, col_type, default in [
        ('author_type', 'VARCHAR(20)', "'user'"),
        ('title', 'VARCHAR(255)', None),
        ('section_id', 'INTEGER', None),
        ('view_count', 'INTEGER', '0'),
        ('is_approved', 'BOOLEAN', '1'),
        ('deleted_at', 'DATETIME', None),
        ('guest_id', 'VARCHAR(64)', None),
        ('guest_name', 'VARCHAR(100)', None),
        ('guest_email', 'VARCHAR(255)', None),
        ('videos', 'JSON', None),
    ]:
        if col not in cp_cols:
            sql = f"ALTER TABLE community_posts ADD COLUMN {col} {col_type}"
            if default is not None:
                sql += f" DEFAULT {default}"
            conn.execute(text(sql))
            print(f"Added community_posts.{col}")
        else:
            print(f"Skipped community_posts.{col}")

    # 11) community_comments missing columns
    cc_cols = [c['name'] for c in insp.get_columns('community_comments')]
    for col, col_type, default in [
        ('like_count', 'INTEGER', '0'),
        ('is_approved', 'BOOLEAN', '1'),
        ('guest_id', 'VARCHAR(64)', None),
        ('guest_name', 'VARCHAR(100)', None),
        ('guest_email', 'VARCHAR(255)', None),
    ]:
        if col not in cc_cols:
            sql = f"ALTER TABLE community_comments ADD COLUMN {col} {col_type}"
            if default is not None:
                sql += f" DEFAULT {default}"
            conn.execute(text(sql))
            print(f"Added community_comments.{col}")
        else:
            print(f"Skipped community_comments.{col}")
    
    # 11b) community_likes missing columns
    cl_cols = [c['name'] for c in insp.get_columns('community_likes')]
    for col, col_type in [
        ('guest_id', 'VARCHAR(64)'),
    ]:
        if col not in cl_cols:
            conn.execute(text(f"ALTER TABLE community_likes ADD COLUMN {col} {col_type}"))
            print(f"Added community_likes.{col}")
        else:
            print(f"Skipped community_likes.{col}")
    
    # 11c) community_comment_likes missing columns
    ccl_cols = [c['name'] for c in insp.get_columns('community_comment_likes')]
    for col, col_type in [
        ('guest_id', 'VARCHAR(64)'),
    ]:
        if col not in ccl_cols:
            conn.execute(text(f"ALTER TABLE community_comment_likes ADD COLUMN {col} {col_type}"))
            print(f"Added community_comment_likes.{col}")
        else:
            print(f"Skipped community_comment_likes.{col}")
    
    # 11d) community_shares missing columns
    cs_cols = [c['name'] for c in insp.get_columns('community_shares')]
    for col, col_type in [
        ('guest_id', 'VARCHAR(64)'),
    ]:
        if col not in cs_cols:
            conn.execute(text(f"ALTER TABLE community_shares ADD COLUMN {col} {col_type}"))
            print(f"Added community_shares.{col}")
        else:
            print(f"Skipped community_shares.{col}")
    
    # 12) ticket_orders new columns
    to_cols = [c['name'] for c in insp.get_columns('ticket_orders')]
    for col, col_type in [
        ('quantity', 'INTEGER DEFAULT 1'),
    ]:
        if col not in to_cols:
            conn.execute(text(f"ALTER TABLE ticket_orders ADD COLUMN {col} {col_type}"))
            print(f"Added ticket_orders.{col}")
        else:
            print(f"Skipped ticket_orders.{col}")
    
    # 13) table_packages new columns
    tp_cols = [c['name'] for c in insp.get_columns('table_packages')]
    for col, col_type in [
        ('total_tables', 'INTEGER DEFAULT 1'),
    ]:
        if col not in tp_cols:
            conn.execute(text(f"ALTER TABLE table_packages ADD COLUMN {col} {col_type}"))
            print(f"Added table_packages.{col}")
        else:
            print(f"Skipped table_packages.{col}")
    
    # 14) table_orders new columns
    tbo_cols = [c['name'] for c in insp.get_columns('table_orders')]
    for col, col_type in [
        ('ticket_qr_code', 'VARCHAR(1500)'),
        ('ticket_code', 'VARCHAR(100)'),
        ('used_at', 'DATETIME'),
        ('used_by', 'INTEGER'),
    ]:
        if col not in tbo_cols:
            conn.execute(text(f"ALTER TABLE table_orders ADD COLUMN {col} {col_type}"))
            print(f"Added table_orders.{col}")
        else:
            print(f"Skipped table_orders.{col}")
    
    # 15) table_packages table
    if 'table_packages' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE table_packages (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                business_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                price FLOAT NOT NULL,
                description TEXT,
                included_items JSON,
                drinks JSON,
                extras JSON,
                ticket_quantity INTEGER DEFAULT 0,
                max_people INTEGER,
                total_tables INTEGER DEFAULT 1,
                display_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                image_url VARCHAR(500),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """))
        print("Created table_packages table")
    else:
        print("Skipped table_packages table")
    
    # 16) table_orders table
    if 'table_orders' not in insp.get_table_names():
        conn.execute(text("""
            CREATE TABLE table_orders (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                table_package_id INTEGER NOT NULL,
                event_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                business_id INTEGER NOT NULL,
                contact_name VARCHAR(100),
                contact_phone VARCHAR(20),
                contact_email VARCHAR(255),
                guest_count INTEGER,
                special_requests TEXT,
                payment_screenshot VARCHAR(500) NOT NULL,
                payment_amount FLOAT NOT NULL,
                payment_notes TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                reviewed_by INTEGER,
                reviewed_at DATETIME,
                rejection_reason TEXT,
                admin_notes TEXT,
                ticket_qr_code VARCHAR(1500),
                ticket_code VARCHAR(100) UNIQUE,
                used_at DATETIME,
                used_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """))
        print("Created table_orders table")
    else:
        print("Skipped table_orders table")

    conn.commit()

print("Comprehensive migration complete.")
