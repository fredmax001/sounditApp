#!/usr/bin/env python3
"""
Sound It - Payment Security Migration Script (v1)
==============================================
This script adds columns for payment reference tracking and fraud prevention (SHA256 hashing)
across all manual payment models.

Run on production server:
python3 scripts/migrate_payment_security_v1.py
"""
import sys
import os
from sqlalchemy import create_engine, text, inspect

# Add parent directory to sys.path to allow imports from database and models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from database import engine
except ImportError:
    print("Could not import engine from database.py. Ensure script is run from project root.")
    sys.exit(1)

def run_migration():
    print("Starting Payment Security Migration...")
    
    insp = inspect(engine)
    
    # 1. Booking Requests
    print("Migrating booking_requests...")
    cols = [c['name'] for c in insp.get_columns('booking_requests')]
    with engine.connect() as conn:
        if 'payment_proof_hash' not in cols:
            conn.execute(text("ALTER TABLE booking_requests ADD COLUMN payment_proof_hash VARCHAR(64)"))
            conn.commit()
            print("  + Added booking_requests.payment_proof_hash")
            conn.execute(text("CREATE INDEX idx_booking_payments_hash ON booking_requests(payment_proof_hash)"))
            conn.commit()
    
    # 2. Orders (Manual QR Flow)
    print("Migrating orders...")
    cols = [c['name'] for c in insp.get_columns('orders')]
    with engine.connect() as conn:
        if 'payment_proof_hash' not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN payment_proof_hash VARCHAR(64)"))
            conn.commit()
            print("  + Added orders.payment_proof_hash")
            conn.execute(text("CREATE INDEX idx_orders_payments_hash ON orders(payment_proof_hash)"))
            conn.commit()
        if 'payment_reference' not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(100)"))
            conn.commit()
            print("  + Added orders.payment_reference")
        if 'screenshot_uploaded_at' not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN screenshot_uploaded_at TIMESTAMP WITH TIME ZONE"))
            conn.commit()
            print("  + Added orders.screenshot_uploaded_at")

    # 3. Subscriptions
    print("Migrating subscriptions...")
    cols = [c['name'] for c in insp.get_columns('subscriptions')]
    with engine.connect() as conn:
        if 'payment_proof_hash' not in cols:
            conn.execute(text("ALTER TABLE subscriptions ADD COLUMN payment_proof_hash VARCHAR(64)"))
            conn.commit()
            print("  + Added subscriptions.payment_proof_hash")
            conn.execute(text("CREATE INDEX idx_subscriptions_payments_hash ON subscriptions(payment_proof_hash)"))
            conn.commit()
        if 'payment_reference' not in cols:
            conn.execute(text("ALTER TABLE subscriptions ADD COLUMN payment_reference VARCHAR(255)"))
            conn.commit()
            print("  + Added subscriptions.payment_reference")
        if 'payment_screenshot' not in cols:
            conn.execute(text("ALTER TABLE subscriptions ADD COLUMN payment_screenshot VARCHAR(500)"))
            conn.commit()
            print("  + Added subscriptions.payment_screenshot")
        if 'screenshot_uploaded_at' not in cols:
            conn.execute(text("ALTER TABLE subscriptions ADD COLUMN screenshot_uploaded_at TIMESTAMP WITH TIME ZONE"))
            conn.commit()
            print("  + Added subscriptions.screenshot_uploaded_at")

    # 4. Ticket Orders
    print("Migrating ticket_orders...")
    cols = [c['name'] for c in insp.get_columns('ticket_orders')]
    with engine.connect() as conn:
        if 'payment_proof_hash' not in cols:
            conn.execute(text("ALTER TABLE ticket_orders ADD COLUMN payment_proof_hash VARCHAR(64)"))
            conn.commit()
            print("  + Added ticket_orders.payment_proof_hash")
            conn.execute(text("CREATE INDEX idx_ticket_orders_payments_hash ON ticket_orders(payment_proof_hash)"))
            conn.commit()
        if 'screenshot_uploaded_at' not in cols:
            conn.execute(text("ALTER TABLE ticket_orders ADD COLUMN screenshot_uploaded_at TIMESTAMP WITH TIME ZONE"))
            conn.commit()
            print("  + Added ticket_orders.screenshot_uploaded_at")

    # 5. Product Orders
    print("Migrating product_orders...")
    cols = [c['name'] for c in insp.get_columns('product_orders')]
    with engine.connect() as conn:
        if 'payment_proof_hash' not in cols:
            conn.execute(text("ALTER TABLE product_orders ADD COLUMN payment_proof_hash VARCHAR(64)"))
            conn.commit()
            print("  + Added product_orders.payment_proof_hash")
            conn.execute(text("CREATE INDEX idx_product_orders_payments_hash ON product_orders(payment_proof_hash)"))
            conn.commit()
        if 'screenshot_uploaded_at' not in cols:
            conn.execute(text("ALTER TABLE product_orders ADD COLUMN screenshot_uploaded_at TIMESTAMP WITH TIME ZONE"))
            conn.commit()
            print("  + Added product_orders.screenshot_uploaded_at")

    # 6. Table Orders
    print("Migrating table_orders...")
    cols = [c['name'] for c in insp.get_columns('table_orders')]
    with engine.connect() as conn:
        if 'payment_proof_hash' not in cols:
            conn.execute(text("ALTER TABLE table_orders ADD COLUMN payment_proof_hash VARCHAR(64)"))
            conn.commit()
            print("  + Added table_orders.payment_proof_hash")
            conn.execute(text("CREATE INDEX idx_table_orders_payments_hash ON table_orders(payment_proof_hash)"))
            conn.commit()
        if 'screenshot_uploaded_at' not in cols:
            conn.execute(text("ALTER TABLE table_orders ADD COLUMN screenshot_uploaded_at TIMESTAMP WITH TIME ZONE"))
            conn.commit()
            print("  + Added table_orders.screenshot_uploaded_at")

    print("Migration complete!")

if __name__ == "__main__":
    run_migration()
