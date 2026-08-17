#!/usr/bin/env python3
"""
Broadcast Test Script — Send a test broadcast email via the Sound It API.
Run this on the production server where SMTP is configured.

Usage:
  python3 test_broadcast_email.py --email djfredmax221@gmail.com --token <your_jwt_token>
  
Or for direct SMTP test (no API needed):
  python3 test_broadcast_email.py --smtp-test --to djfredmax221@gmail.com
"""
import argparse
import sys
import os

# Ensure we can import from the project root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def send_via_api(email: str, token: str, event_id: int = None):
    """Send a test broadcast through the API."""
    import requests
    
    base_url = "https://sounditent.com/api/v1"
    
    payload = {
        "event_id": event_id,
        "target": "followers",
        "title": "Test Broadcast from Sound It",
        "message": "This is a test broadcast message to verify email delivery is working correctly. If you received this, the broadcast system is functioning!",
        "send_email": True,
        "send_push": False,
        "send_in_app": False
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        res = requests.post(f"{base_url}/notifications/broadcast", json=payload, headers=headers, timeout=30)
        data = res.json()
        print(f"Status: {res.status_code}")
        print(f"Response: {data}")
        return res.ok
    except Exception as e:
        print(f"Error: {e}")
        return False


def send_via_smtp_direct(to_email: str):
    """Send a test email directly via SMTP (requires .env with SMTP credentials)."""
    from email_service import send_organizer_announcement_email
    
    try:
        result = send_organizer_announcement_email(
            to_emails=[to_email],
            announcement_title="Sound It Broadcast Test",
            announcement_body="This is a direct SMTP test from the Sound It platform. If you received this email, the broadcast email system is working correctly!",
            organizer_name="Sound It Platform",
            event_title=None,
            event_id=None
        )
        print(f"SMTP Result: {result}")
        return result.get("sent", 0) > 0
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False


def send_test_email_only(to_email: str):
    """Send the built-in test email template."""
    from email_service import send_test_email
    
    try:
        result = send_test_email(to_email)
        print(f"Test email result: {result}")
        return result
    except Exception as e:
        print(f"Test email error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Test Sound It broadcast email")
    parser.add_argument("--email", default="djfredmax221@gmail.com", help="Recipient email")
    parser.add_argument("--token", help="JWT auth token for API mode")
    parser.add_argument("--event-id", type=int, help="Optional event ID to target")
    parser.add_argument("--smtp-test", action="store_true", help="Send directly via SMTP instead of API")
    parser.add_argument("--template-test", action="store_true", help="Send the built-in test email template")
    args = parser.parse_args()
    
    print("=" * 50)
    print("Sound It — Broadcast Email Test")
    print("=" * 50)
    print(f"Target email: {args.email}")
    
    if args.template_test:
        print("\nSending built-in test email template...")
        success = send_test_email_only(args.email)
    elif args.smtp_test:
        print("\nSending direct SMTP test...")
        success = send_via_smtp_direct(args.email)
    elif args.token:
        print("\nSending via API...")
        success = send_via_api(args.email, args.token, args.event_id)
    else:
        print("\nNo mode selected. Use one of:")
        print("  --token <jwt>     Send via API (requires auth token)")
        print("  --smtp-test       Send directly via SMTP (requires .env SMTP config)")
        print("  --template-test   Send the built-in test email template")
        return 1
    
    print("\n" + "=" * 50)
    if success:
        print("SUCCESS: Test email was sent!")
    else:
        print("FAILED: Could not send test email.")
    print("=" * 50)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
