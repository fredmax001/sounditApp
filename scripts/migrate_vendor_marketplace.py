#!/usr/bin/env python3
"""
Migration script for Vendor Marketplace Upgrade
Adds new columns, tables for vendor orders, payment settings, and menu import.
Works on both SQLite and PostgreSQL.
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect, Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey, Enum
from sqlalchemy.orm import sessionmaker
from database import engine, SessionLocal
from models import Base, VendorOrderStatus, VendorPaymentMethod, VendorPaymentSettings, VendorOrder, VendorOrderItem


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(table_name):
    """Check if a table exists."""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def migrate():
    db = SessionLocal()
    is_postgres = "postgresql" in str(engine.url)
    
    try:
        print("[migrate] Starting vendor marketplace migration...")
        
        # 1. Add columns to products table
        products_cols = [
            ("images", "JSON" if is_postgres else "TEXT"),
            ("is_featured", "BOOLEAN"),
            ("sort_order", "INTEGER"),
            ("event_id", "INTEGER"),
        ]
        
        for col_name, col_type in products_cols:
            if not column_exists("products", col_name):
                print(f"[migrate] Adding products.{col_name}")
                db.execute(text(f'ALTER TABLE products ADD COLUMN {col_name} {col_type}'))
                db.commit()
            else:
                print(f"[migrate] products.{col_name} already exists, skipping")
        
        # 2. Create vendor_payment_settings table
        if not table_exists("vendor_payment_settings"):
            print("[migrate] Creating vendor_payment_settings table")
            VendorPaymentSettings.__table__.create(engine)
        else:
            print("[migrate] vendor_payment_settings already exists, skipping")
        
        # 3. Create vendor_orders table
        if not table_exists("vendor_orders"):
            print("[migrate] Creating vendor_orders table")
            VendorOrder.__table__.create(engine)
        else:
            print("[migrate] vendor_orders already exists, skipping")
        
        # 4. Create vendor_order_items table
        if not table_exists("vendor_order_items"):
            print("[migrate] Creating vendor_order_items table")
            VendorOrderItem.__table__.create(engine)
        else:
            print("[migrate] vendor_order_items already exists, skipping")
        
        print("[migrate] Vendor marketplace migration complete!")
        
    except Exception as e:
        print(f"[migrate] Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
