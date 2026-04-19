#!/usr/bin/env python3
"""
Migrate PostgreSQL City enum to include all 63 supported cities.
Run this on the production server before deploying the city expansion.
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

NEW_CITIES = [
    "harbin", "changchun", "shenyang", "shijiazhuang", "taiyuan", "jinan",
    "hefei", "nanchang", "fuzhou", "nanning", "guiyang", "lanzhou", "haikou",
    "hohhot", "urumqi", "lhasa", "yinchuan", "xining", "wuxi", "nantong",
    "changzhou", "xuzhou", "yangzhou", "shaoxing", "jiaxing", "taizhou",
    "wenzhou", "jinhua", "quzhou", "zhoushan", "dongguan", "foshan", "zhuhai",
    "zhongshan", "jiangmen", "huizhou", "shantou", "zhanjiang", "zhaoqing",
    "maoming", "meizhou", "qingyuan",
]


def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Get existing enum values
    cur.execute("""
        SELECT enumlabel
        FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'city'
    """)
    existing = {row[0] for row in cur.fetchall()}
    print(f"Existing city enum values: {len(existing)}")

    added = 0
    for city in NEW_CITIES:
        if city not in existing:
            cur.execute(f"ALTER TYPE city ADD VALUE '{city}'")
            added += 1
            print(f"Added: {city}")
        else:
            print(f"Skipped (already exists): {city}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone. Added {added} new city enum values.")


if __name__ == "__main__":
    main()
