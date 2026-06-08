#!/usr/bin/env python3
"""
Generate VAPID keys for Web Push notifications.
Run this once and add the keys to your .env file.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from py_vapid import Vapid
except ImportError:
    print("Installing py-vapid...")
    os.system(f"{sys.executable} -m pip install py-vapid")
    from py_vapid import Vapid


def generate():
    vapid = Vapid()
    vapid.generate_keys()
    
    print("\n" + "=" * 60)
    print("VAPID KEYS GENERATED")
    print("=" * 60)
    print(f"\nVAPID_PUBLIC_KEY={vapid.public_key}")
    print(f"VAPID_PRIVATE_KEY={vapid.private_key}")
    print(f"VAPID_CLAIM_EMAIL=admin@sounditent.com")
    print("\n" + "=" * 60)
    print("Add these to your .env file:")
    print("=" * 60)
    print(f"\nVAPID_PUBLIC_KEY={vapid.public_key}")
    print(f"VAPID_PRIVATE_KEY={vapid.private_key}")
    print(f"VAPID_CLAIM_EMAIL=admin@sounditent.com\n")


if __name__ == "__main__":
    generate()
