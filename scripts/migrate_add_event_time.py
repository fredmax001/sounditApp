import os
import psycopg2
import sqlite3
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("Starting migration...")
    if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
        print(f"Connecting to PostgreSQL...")
        conn = psycopg2.connect(DATABASE_URL)
    else:
        print("Connecting to SQLite...")
        conn = sqlite3.connect("soundit.db")
        
    c = conn.cursor()
    
    try:
        c.execute("ALTER TABLE booking_requests ADD COLUMN event_time VARCHAR(50);")
        print("Successfully added event_time to booking_requests table")
    except Exception as e:
        print(f"Error adding event_time: {e}")
        
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
