#!/usr/bin/env python3
"""
Migrate local SQLite DB to match production schema.
Adds missing columns/tables from recent production deployments.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text, inspect
from database import engine

insp = inspect(engine)

with engine.connect() as conn:
    # 1) business_profiles.gallery_images
    bp_cols = [c['name'] for c in insp.get_columns('business_profiles')]
    if 'gallery_images' not in bp_cols:
        conn.execute(text("ALTER TABLE business_profiles ADD COLUMN gallery_images JSON"))
        print("Added business_profiles.gallery_images")
    else:
        print("Skipped business_profiles.gallery_images")

    # 2) products.stock_quantity
    prod_cols = [c['name'] for c in insp.get_columns('products')]
    if 'stock_quantity' not in prod_cols:
        conn.execute(text("ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0"))
        print("Added products.stock_quantity")
    else:
        print("Skipped products.stock_quantity")

    # 3) promo_codes table
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

    conn.commit()

print("Production parity migration complete.")
