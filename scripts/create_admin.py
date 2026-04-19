#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import SessionLocal
from models import User, UserRole, UserStatus
from auth import get_REDACTED_PLACEHOLDER_hash as get_password_hash

admins = [
    ('admin@sounditent.com', UserRole.SUPER_ADMIN),
    ('admin@soundit.com', UserRole.SUPER_ADMIN),
]
password = 'SoundIt2026!Admin'

db = SessionLocal()
try:
    for email, role in admins:
        u = db.query(User).filter(User.email == email).first()
        if u:
            u.password_hash = get_password_hash(password)
            u.role = role
            u.status = UserStatus.ACTIVE
            u.is_verified = True
            db.commit()
            print('Updated existing admin:', u.email, '->', role.value)
        else:
            new = User(
                email=email,
                password_hash=get_password_hash(password),
                first_name='Admin',
                last_name='SoundIt',
                phone=None,
                role=role,
                status=UserStatus.ACTIVE,
                is_verified=True,
                preferred_city=None,
                preferred_language='en'
            )
            db.add(new)
            db.commit()
            db.refresh(new)
            print('Created admin:', new.email, '->', role.value)
except Exception as e:
    print('Error:', e)
    raise
finally:
    db.close()
