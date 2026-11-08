import sqlite3

db_path = '/var/www/soundit/soundit.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cursor.fetchall()]
print('Tables:', tables)

if 'staff_members' in tables:
    cursor.execute("PRAGMA table_info(staff_members)")
    columns = [r[1] for r in cursor.fetchall()]
    print('staff_members columns:', columns)
else:
    print('staff_members table does NOT exist')

conn.close()
