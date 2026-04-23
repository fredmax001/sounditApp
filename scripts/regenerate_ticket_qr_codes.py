#!/usr/bin/env python3
"""
regenerate_ticket_qr_codes.py
------------------------------
Re-generates QR code images for all approved Ticket and TicketOrder records
that have NULL, empty, or truncated qr_code values.

A truncated base64 PNG is detectable because base64-encoded strings must have
a length that is a multiple of 4 (after stripping padding). More practically:
a valid PNG data-URL is always > 1000 chars; anything <= 1500 chars is
almost certainly the old truncated value.

Run this ONCE after deploying the column-type migration.

Usage:
    python3 scripts/regenerate_ticket_qr_codes.py [--dry-run]
"""

import os
import sys
import argparse
from typing import Optional

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from database import SessionLocal
from models import Ticket, TicketOrder, TicketOrderStatus, Event
from services.ticketing_service import _build_ticket_qr_payload, _generate_qr_code

# Anything at or below this length is considered a legacy truncated value.
TRUNCATED_THRESHOLD = 1502


def is_corrupt_or_missing(value: Optional[str]) -> bool:
    if not value:
        return True
    if len(value) <= TRUNCATED_THRESHOLD:
        return True
    # Must start with a PNG data-URL
    if not value.startswith("data:image/png;base64,"):
        return True
    return False


def main(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        tickets_fixed = 0
        orders_fixed = 0

        # ── Regenerate Ticket.qr_code ────────────────────────────────────────
        tickets = (
            db.query(Ticket)
            .filter(Ticket.status == "active", Ticket.is_used == False)
            .all()
        )
        print(f"\nFound {len(tickets)} active unused Ticket records to inspect …")

        for ticket in tickets:
            if not is_corrupt_or_missing(ticket.qr_code):
                continue

            order = None
            if ticket.ticket_order_id:
                order = db.query(TicketOrder).filter(
                    TicketOrder.id == ticket.ticket_order_id
                ).first()

            event = db.query(Event).filter(Event.id == ticket.event_id).first()
            if not event:
                print(f"  [Ticket {ticket.id}] SKIP — event not found")
                continue

            # Create a minimal stand-in order for helper functions if needed
            if order is None:
                class _FakeOrder:
                    user_id = ticket.user_id
                    email = None
                    phone_number = None
                    id = ticket.ticket_order_id or 0
                order = _FakeOrder()

            payload = _build_ticket_qr_payload(ticket, order, event)
            new_qr = _generate_qr_code(payload, ticket, order, event)

            print(
                f"  [Ticket {ticket.id}] {ticket.ticket_number} "
                f"old_len={len(ticket.qr_code or '')} new_len={len(new_qr)}"
                + (" [DRY-RUN]" if dry_run else " → SAVED")
            )

            if not dry_run:
                ticket.qr_code = new_qr
                tickets_fixed += 1

        # ── Regenerate TicketOrder.ticket_qr_code ────────────────────────────
        orders = (
            db.query(TicketOrder)
            .filter(TicketOrder.status == TicketOrderStatus.APPROVED)
            .all()
        )
        print(f"\nFound {len(orders)} approved TicketOrder records to inspect …")

        for order in orders:
            if not is_corrupt_or_missing(order.ticket_qr_code):
                continue

            # The order-level QR is just a copy of the first ticket's QR
            first_ticket = (
                db.query(Ticket)
                .filter(Ticket.ticket_order_id == order.id)
                .first()
            )

            if first_ticket and not is_corrupt_or_missing(first_ticket.qr_code):
                new_qr = first_ticket.qr_code
            else:
                print(
                    f"  [TicketOrder {order.id}] SKIP — no valid ticket QR to copy from"
                )
                continue

            print(
                f"  [TicketOrder {order.id}] ticket_code={order.ticket_code} "
                f"old_len={len(order.ticket_qr_code or '')} new_len={len(new_qr)}"
                + (" [DRY-RUN]" if dry_run else " → SAVED")
            )

            if not dry_run:
                order.ticket_qr_code = new_qr
                orders_fixed += 1

        if not dry_run:
            db.commit()

        print(f"\n── Summary ──────────────────────────────────────────────────")
        print(f"  Tickets regenerated:      {tickets_fixed}")
        print(f"  TicketOrders regenerated: {orders_fixed}")
        if dry_run:
            print("  (DRY-RUN — no changes written)")
        print("─────────────────────────────────────────────────────────────\n")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Regenerate truncated/missing QR codes for approved tickets"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be fixed without writing to the DB",
    )
    args = parser.parse_args()
    main(dry_run=args.dry_run)
