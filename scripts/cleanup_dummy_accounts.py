"""
Script to inspect and deactivate dummy/test user accounts in the database
(e.g., @test.com, @example.com, or accounts matching blocked patterns).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from config import get_settings
from email_service import is_deliverable_email


def clean_accounts():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, email, first_name, last_name, role, status FROM users"))
        rows = result.fetchall()

        dummy_count = 0
        for row in rows:
            user_id, email, first_name, last_name, role, status = row
            if email and not is_deliverable_email(email):
                print(f"[FOUND DUMMY/UNDELIVERABLE] ID: {user_id}, Email: {email}, Name: {first_name} {last_name}, Role: {role}, Status: {status}")
                conn.execute(
                    text("UPDATE users SET status = 'INACTIVE' WHERE id = :user_id"),
                    {"user_id": user_id}
                )
                dummy_count += 1

        conn.commit()
        print(f"\n✅ Total undeliverable/dummy accounts flagged & set to INACTIVE: {dummy_count}")


if __name__ == "__main__":
    clean_accounts()
