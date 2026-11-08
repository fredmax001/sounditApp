import sqlite3
import sys

db_path = '/var/www/soundit/soundit.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(staff_members)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'password_hash' in columns:
        print("password_hash column already exists. Skipping.")
        sys.exit(0)
    
    # Add column
    cursor.execute("ALTER TABLE staff_members ADD COLUMN password_hash VARCHAR(255)")
    conn.commit()
    print("Successfully added password_hash column to staff_members")
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
