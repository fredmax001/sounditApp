"""Migration: Add geo/demographic columns to page_visits table."""
import sys
sys.path.insert(0, '/var/www/soundit')

from sqlalchemy import text
from database import engine

MIGRATION_SQL = """
DO $$
BEGIN
    -- Geo columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='country') THEN
        ALTER TABLE page_visits ADD COLUMN country VARCHAR(100);
        CREATE INDEX idx_page_visits_country ON page_visits(country);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='country_code') THEN
        ALTER TABLE page_visits ADD COLUMN country_code VARCHAR(5);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='city') THEN
        ALTER TABLE page_visits ADD COLUMN city VARCHAR(100);
        CREATE INDEX idx_page_visits_city ON page_visits(city);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='region') THEN
        ALTER TABLE page_visits ADD COLUMN region VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='latitude') THEN
        ALTER TABLE page_visits ADD COLUMN latitude FLOAT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='longitude') THEN
        ALTER TABLE page_visits ADD COLUMN longitude FLOAT;
    END IF;
    
    -- Demographics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='gender') THEN
        ALTER TABLE page_visits ADD COLUMN gender VARCHAR(20);
        CREATE INDEX idx_page_visits_gender ON page_visits(gender);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='age') THEN
        ALTER TABLE page_visits ADD COLUMN age INTEGER;
        CREATE INDEX idx_page_visits_age ON page_visits(age);
    END IF;
    
    -- Device / browser
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='browser') THEN
        ALTER TABLE page_visits ADD COLUMN browser VARCHAR(50);
        CREATE INDEX idx_page_visits_browser ON page_visits(browser);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='browser_version') THEN
        ALTER TABLE page_visits ADD COLUMN browser_version VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='os') THEN
        ALTER TABLE page_visits ADD COLUMN os VARCHAR(50);
        CREATE INDEX idx_page_visits_os ON page_visits(os);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='os_version') THEN
        ALTER TABLE page_visits ADD COLUMN os_version VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='page_visits' AND column_name='device_type') THEN
        ALTER TABLE page_visits ADD COLUMN device_type VARCHAR(20);
        CREATE INDEX idx_page_visits_device_type ON page_visits(device_type);
    END IF;
END $$;
"""

def run_migration():
    with engine.begin() as conn:
        conn.execute(text(MIGRATION_SQL))
    print("✅ Analytics columns migration completed successfully.")

if __name__ == "__main__":
    run_migration()
