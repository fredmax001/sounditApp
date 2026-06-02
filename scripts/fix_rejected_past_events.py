#!/usr/bin/env python3
"""
Fix mistakenly rejected past events.
Finds events with status='rejected' and start_date in the past,
and re-approves them so they appear in the Past Events archive.
"""

import os
import sys
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Event, EventStatus

def load_env_file(path=".env"):
    """Load KEY=VALUE pairs from .env file, ignoring comments and blank lines."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value

def main():
    # Load .env if present
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_env_file(env_path)

    db_url = os.getenv("DATABASE_URL", "sqlite:///./soundit_local.db")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    now = datetime.now(timezone.utc)

    # Find rejected events with past start dates
    rejected_past = db.query(Event).filter(
        Event.status == EventStatus.REJECTED,
        Event.start_date < now
    ).all()

    if not rejected_past:
        print("✅ No rejected past events found. Nothing to fix.")
        return

    print(f"Found {len(rejected_past)} rejected past event(s):")
    for ev in rejected_past:
        print(f"  - ID {ev.id}: {ev.title} ({ev.start_date.isoformat()})")

    # Auto-approve when running non-interactively (no TTY)
    auto_approve = not sys.stdin.isatty()
    if auto_approve:
        print("\nRunning non-interactively — auto-approving...")
    else:
        confirm = input("\nRe-approve all of them? (yes/no): ").strip().lower()
        if confirm not in ("yes", "y"):
            print("Aborted.")
            return

    count = 0
    for ev in rejected_past:
        ev.status = EventStatus.APPROVED
        count += 1

    db.commit()
    print(f"\n✅ Re-approved {count} event(s). They will now appear in the Past Events archive.")

if __name__ == "__main__":
    main()
