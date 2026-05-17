#!/usr/bin/env python3
"""
Migration script for Analytics v2 enterprise system.
Adds AnalyticsEvent, AnalyticsSession tables and User demographics columns.
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL

def migrate():
    print("🚀 Running Analytics v2 Migration...")
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as conn:
        # Add User demographics columns
        print("  → Adding gender, date_of_birth to users...")
        conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
            ADD COLUMN IF NOT EXISTS date_of_birth DATE;
        """))
        
        # Create analytics_events table
        print("  → Creating analytics_events table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS analytics_events (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                event_category VARCHAR(50),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                session_id VARCHAR(100),
                event_data JSONB,
                path VARCHAR(500),
                referrer VARCHAR(500),
                ip_address VARCHAR(45),
                country VARCHAR(100),
                country_code VARCHAR(5),
                city VARCHAR(100),
                region VARCHAR(100),
                device_type VARCHAR(20),
                browser VARCHAR(50),
                os VARCHAR(50),
                domain VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                
                INDEX idx_analytics_events_type (event_type),
                INDEX idx_analytics_events_category (event_category),
                INDEX idx_analytics_events_user (user_id),
                INDEX idx_analytics_events_session (session_id),
                INDEX idx_analytics_events_created (created_at),
                INDEX idx_analytics_events_country (country),
                INDEX idx_analytics_events_city (city),
                INDEX idx_analytics_events_domain (domain),
                INDEX idx_analytics_events_type_created (event_type, created_at)
            );
        """))
        
        # Create analytics_sessions table
        print("  → Creating analytics_sessions table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS analytics_sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(100) NOT NULL UNIQUE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ended_at TIMESTAMP WITH TIME ZONE,
                duration_seconds INTEGER,
                page_views INTEGER DEFAULT 0,
                events_count INTEGER DEFAULT 0,
                entry_path VARCHAR(500),
                exit_path VARCHAR(500),
                ip_address VARCHAR(45),
                country VARCHAR(100),
                country_code VARCHAR(5),
                city VARCHAR(100),
                device_type VARCHAR(20),
                browser VARCHAR(50),
                os VARCHAR(50),
                domain VARCHAR(50),
                
                INDEX idx_analytics_sessions_id (session_id),
                INDEX idx_analytics_sessions_user (user_id),
                INDEX idx_analytics_sessions_started (started_at),
                INDEX idx_analytics_sessions_country (country),
                INDEX idx_analytics_sessions_domain (domain)
            );
        """))
        
        conn.commit()
    
    print("✅ Analytics v2 migration complete!")

if __name__ == "__main__":
    migrate()
