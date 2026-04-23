"""
Migration: Add email and phone_number to ticket_orders
Also makes payment_screenshot and payment_amount nullable.

Run with: python scripts/migrate_ticket_order_contact_fields.py
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine, SessionLocal
from config import get_settings

settings = get_settings()

def migrate():
    db = SessionLocal()
    try:
        if settings.DATABASE_URL and settings.DATABASE_URL.startswith("postgresql"):
            # PostgreSQL
            print("Running PostgreSQL migration...")
            
            # Check if columns already exist
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ticket_orders' AND column_name = 'email'
            """))
            has_email = result.fetchone() is not None
            
            if not has_email:
                db.execute(text("ALTER TABLE ticket_orders ADD COLUMN email VARCHAR(255)"))
                print("  ✓ Added email column")
            else:
                print("  • email column already exists")
            
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'ticket_orders' AND column_name = 'phone_number'
            """))
            has_phone = result.fetchone() is not None
            
            if not has_phone:
                db.execute(text("ALTER TABLE ticket_orders ADD COLUMN phone_number VARCHAR(50)"))
                print("  ✓ Added phone_number column")
            else:
                print("  • phone_number column already exists")
            
            # Make payment_screenshot nullable
            db.execute(text("""
                ALTER TABLE ticket_orders 
                ALTER COLUMN payment_screenshot DROP NOT NULL
            """))
            print("  ✓ Made payment_screenshot nullable")
            
            # Make payment_amount nullable
            db.execute(text("""
                ALTER TABLE ticket_orders 
                ALTER COLUMN payment_amount DROP NOT NULL
            """))
            print("  ✓ Made payment_amount nullable")
            
        else:
            # SQLite
            print("Running SQLite migration...")
            
            # SQLite supports ADD COLUMN easily
            try:
                db.execute(text("ALTER TABLE ticket_orders ADD COLUMN email VARCHAR(255)"))
                print("  ✓ Added email column")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("  • email column already exists")
                else:
                    raise
            
            try:
                db.execute(text("ALTER TABLE ticket_orders ADD COLUMN phone_number VARCHAR(50)"))
                print("  ✓ Added phone_number column")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("  • phone_number column already exists")
                else:
                    raise
            
            # SQLite doesn't enforce NOT NULL strictly in the same way for ALTER,
            # but we need to recreate the table to truly make columns nullable.
            # However, SQLite allows NULLs in existing columns even if marked NOT NULL
            # in some versions. Let's check the schema and recreate if needed.
            result = db.execute(text("PRAGMA table_info(ticket_orders)"))
            columns = result.fetchall()
            
            screenshot_not_null = False
            amount_not_null = False
            for col in columns:
                # col: (cid, name, type, notnull, dflt_value, pk)
                if col[1] == 'payment_screenshot' and col[3] == 1:
                    screenshot_not_null = True
                if col[1] == 'payment_amount' and col[3] == 1:
                    amount_not_null = True
            
            if screenshot_not_null or amount_not_null:
                print("  → Recreating ticket_orders table to make columns nullable...")
                
                # Get current schema
                result = db.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='ticket_orders'"))
                create_sql = result.scalar()
                
                # Modify the CREATE TABLE statement
                new_create = create_sql.replace(
                    'payment_screenshot VARCHAR(500) NOT NULL',
                    'payment_screenshot VARCHAR(500)'
                ).replace(
                    'payment_amount FLOAT NOT NULL',
                    'payment_amount FLOAT'
                )
                
                # SQLite table recreation
                db.execute(text("ALTER TABLE ticket_orders RENAME TO ticket_orders_old"))
                db.execute(text(new_create))
                
                # Copy data
                col_names = [c[1] for c in columns]
                cols_str = ', '.join(f'"{c}"' for c in col_names)
                db.execute(text(f"INSERT INTO ticket_orders ({cols_str}) SELECT {cols_str} FROM ticket_orders_old"))
                
                # Drop old table
                db.execute(text("DROP TABLE ticket_orders_old"))
                print("  ✓ Recreated table with nullable columns")
            else:
                print("  • Columns already nullable")
        
        db.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
