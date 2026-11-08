#!/usr/bin/env python3
"""
Migration script for Promoter & Referral System
Run on production PostgreSQL to add new tables and columns.
"""

import os
import sys

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from database import engine

Base = declarative_base()


def migrate():
    with engine.connect() as conn:
        # 1. Add promoter columns to events table
        event_cols = [
            ("promoter_enabled", "BOOLEAN DEFAULT FALSE"),
            ("default_commission_rate", "FLOAT DEFAULT 10.0"),
            ("default_discount_percent", "FLOAT DEFAULT 5.0"),
            ("max_discount_amount", "FLOAT"),
        ]
        for col, col_type in event_cols:
            try:
                conn.execute(text(f"ALTER TABLE events ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                conn.commit()
                print(f"[OK] Added events.{col}")
            except Exception as e:
                print(f"[WARN] events.{col}: {e}")

        # 2. Add promoter columns to ticket_orders table
        ticket_cols = [
            ("event_promoter_id", "INTEGER"),
            ("referral_code", "VARCHAR(50)"),
            ("discount_applied", "FLOAT DEFAULT 0.0"),
            ("final_amount", "FLOAT"),
        ]
        for col, col_type in ticket_cols:
            try:
                conn.execute(text(f"ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS {col} {col_type}"))
                conn.commit()
                print(f"[OK] Added ticket_orders.{col}")
            except Exception as e:
                print(f"[WARN] ticket_orders.{col}: {e}")

        # 3. Create promoter_profiles table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS promoter_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    referral_code VARCHAR(50) NOT NULL UNIQUE,
                    total_referrals INTEGER DEFAULT 0,
                    total_conversions INTEGER DEFAULT 0,
                    total_sales FLOAT DEFAULT 0.0,
                    total_commission FLOAT DEFAULT 0.0,
                    total_paid_out FLOAT DEFAULT 0.0,
                    pending_commission FLOAT DEFAULT 0.0,
                    tier VARCHAR(20) DEFAULT 'basic',
                    commission_rate FLOAT DEFAULT 10.0,
                    is_active BOOLEAN DEFAULT TRUE,
                    payment_method VARCHAR(50),
                    payment_account VARCHAR(255),
                    payment_name VARCHAR(100),
                    contact_phone VARCHAR(20),
                    contact_wechat VARCHAR(100),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            conn.commit()
            print("[OK] Created promoter_profiles table")
        except Exception as e:
            print(f"[WARN] promoter_profiles: {e}")

        # 4. Create event_promoters table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS event_promoters (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    promoter_id INTEGER NOT NULL REFERENCES promoter_profiles(id) ON DELETE CASCADE,
                    referral_code VARCHAR(50) NOT NULL UNIQUE,
                    commission_rate FLOAT,
                    discount_percent FLOAT,
                    max_discount_amount FLOAT,
                    status VARCHAR(20) DEFAULT 'pending',
                    assigned_by INTEGER REFERENCES users(id),
                    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    promoter_name VARCHAR(100),
                    clicks INTEGER DEFAULT 0,
                    conversions INTEGER DEFAULT 0,
                    tickets_sold INTEGER DEFAULT 0,
                    revenue_generated FLOAT DEFAULT 0.0,
                    commission_earned FLOAT DEFAULT 0.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    UNIQUE(event_id, promoter_id)
                )
            """))
            conn.commit()
            print("[OK] Created event_promoters table")
        except Exception as e:
            print(f"[WARN] event_promoters: {e}")

        # 5. Create promoter_referrals table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS promoter_referrals (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    event_promoter_id INTEGER NOT NULL REFERENCES event_promoters(id) ON DELETE CASCADE,
                    referral_code VARCHAR(50) NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent VARCHAR(500),
                    visitor_user_id INTEGER REFERENCES users(id),
                    converted BOOLEAN DEFAULT FALSE,
                    ticket_order_id INTEGER REFERENCES ticket_orders(id),
                    conversion_value FLOAT,
                    commission_amount FLOAT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    converted_at TIMESTAMP WITH TIME ZONE
                )
            """))
            conn.commit()
            print("[OK] Created promoter_referrals table")
        except Exception as e:
            print(f"[WARN] promoter_referrals: {e}")

        # 6. Create promoter_payouts table
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS promoter_payouts (
                    id SERIAL PRIMARY KEY,
                    promoter_id INTEGER NOT NULL REFERENCES promoter_profiles(id) ON DELETE CASCADE,
                    amount FLOAT NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    period_start TIMESTAMP WITH TIME ZONE,
                    period_end TIMESTAMP WITH TIME ZONE,
                    payment_method VARCHAR(50),
                    payment_account VARCHAR(255),
                    payment_reference VARCHAR(100),
                    notes TEXT,
                    paid_at TIMESTAMP WITH TIME ZONE,
                    paid_by INTEGER REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE
                )
            """))
            conn.commit()
            print("[OK] Created promoter_payouts table")
        except Exception as e:
            print(f"[WARN] promoter_payouts: {e}")

        # 7. Create indexes
        indexes = [
            ("CREATE INDEX IF NOT EXISTS idx_event_promoters_event_id ON event_promoters(event_id)"),
            ("CREATE INDEX IF NOT EXISTS idx_event_promoters_promoter_id ON event_promoters(promoter_id)"),
            ("CREATE INDEX IF NOT EXISTS idx_promoter_referrals_code ON promoter_referrals(referral_code)"),
            ("CREATE INDEX IF NOT EXISTS idx_promoter_referrals_event_promoter ON promoter_referrals(event_promoter_id)"),
            ("CREATE INDEX IF NOT EXISTS idx_ticket_orders_referral ON ticket_orders(referral_code)"),
            ("CREATE INDEX IF NOT EXISTS idx_ticket_orders_event_promoter ON ticket_orders(event_promoter_id)"),
        ]
        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                conn.commit()
                print(f"[OK] Index: {idx_sql.split('INDEX IF NOT EXISTS ')[1].split(' ON')[0]}")
            except Exception as e:
                print(f"[WARN] Index failed: {e}")

    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
