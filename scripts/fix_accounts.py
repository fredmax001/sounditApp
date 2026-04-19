"""
Fix sign-in issues for specified accounts.
Run on the production server:
    cd /var/www/soundit && source venv/bin/activate && python3 scripts/fix_accounts.py
"""
import sys
sys.path.insert(0, '/var/www/soundit')

from database import SessionLocal
from models import User
from auth import get_password_hash
from datetime import datetime, timezone

# Accounts to ensure exist and are active
ACCOUNTS = [
    {"email": "sounditmusic232@gmail.com", "first_name": "SoundIt", "last_name": "Music", "role": "super_admin"},
    {"email": "djfredmax221@gmail.com", "first_name": "DJ", "last_name": "FredMax", "role": "admin"},
    {"email": "maxrick221@gmail.com", "first_name": "Max", "last_name": "Rick", "role": "user"},
    {"email": "rnbnslowsessions@gmail.com", "first_name": "RNB", "last_name": "Slow", "role": "user"},
]

RESET_PASSWORD = "SoundIt2026!Reset"

def fix_accounts():
    db = SessionLocal()
    try:
        for info in ACCOUNTS:
            email = info["email"]
            user = db.query(User).filter(User.email == email).first()
            
            if user:
                print(f"[FOUND] {email}: id={user.id}, role={user.role}, status={user.status}")
                # Reactivate if inactive
                if user.status.value != "active":
                    print(f"  -> Reactivating account (was {user.status.value})")
                    user.status = "active"
                
                # Reset password so they can log in
                user.password_hash = get_password_hash(RESET_PASSWORD)
                user.updated_at = datetime.now(timezone.utc)
                db.commit()
                print(f"  -> Password reset to: {RESET_PASSWORD}")
            else:
                print(f"[MISSING] {email}: Creating new account...")
                new_user = User(
                    email=email,
                    password_hash=get_password_hash(RESET_PASSWORD),
                    first_name=info["first_name"],
                    last_name=info["last_name"],
                    role=info["role"],
                    status="active",
                    is_verified=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                print(f"  -> Created account with id={new_user.id}, password: {RESET_PASSWORD}")
        
        print("\nAll accounts fixed. Temporary password for all 4 accounts:")
        print(f"  {RESET_PASSWORD}")
        print("\nAdvise users to change their password after logging in.")
    finally:
        db.close()

if __name__ == "__main__":
    fix_accounts()
