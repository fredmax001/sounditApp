"""
Sound It - Anti-Spam and Frequency Control Service
Enforces daily/weekly notification caps, prevents duplicate messages,
and excludes users from reminders for events they have already bought tickets to.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import (
    ScheduledNotification,
    NotificationPreference,
    SmartNotificationRule,
    TicketOrder,
    TicketOrderStatus,
)
import logging

logger = logging.getLogger("soundit.anti_spam")

# Bypass categories (never subject to promotional rate limits)
EXEMPT_CATEGORIES = {"payments", "bookings", "verifications", "security", "cancellations"}

def is_duplicate(db: Session, idempotency_key: Optional[str]) -> bool:
    """Checks if a notification with the given idempotency key has already been queued or sent."""
    if not idempotency_key:
        return False
    exists = (
        db.query(ScheduledNotification.id)
        .filter(ScheduledNotification.idempotency_key == idempotency_key)
        .first()
    )
    return exists is not None

def has_purchased_ticket(db: Session, user_id: int, event_id: Optional[int]) -> bool:
    """
    Checks if user has already bought an approved/confirmed ticket for this event.
    Prevents nagging ticket purchasers to buy tickets.
    """
    if not event_id or not user_id:
        return False
    
    order = (
        db.query(TicketOrder.id)
        .filter(
            TicketOrder.user_id == user_id,
            TicketOrder.event_id == event_id,
            TicketOrder.status.in_([TicketOrderStatus.APPROVED, "approved", "paid", "confirmed"]),
        )
        .first()
    )
    return order is not None

def check_frequency_cap(
    db: Session,
    user_id: int,
    category: str,
    rule_key: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Verifies user has not exceeded daily (3) or weekly (10) promotional limits.
    """
    if category.lower() in EXEMPT_CATEGORIES:
        return True, None

    # Load custom rule limits if available
    cap_daily = 3
    cap_weekly = 10
    if rule_key:
        rule = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == rule_key).first()
        if rule and rule.frequency_cap_daily:
            cap_daily = rule.frequency_cap_daily
        if rule and rule.frequency_cap_weekly:
            cap_weekly = rule.frequency_cap_weekly

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    # Count sent/queued promotional notifications in last 24h
    daily_count = (
        db.query(func.count(ScheduledNotification.id))
        .filter(
            ScheduledNotification.user_id == user_id,
            ScheduledNotification.created_at >= day_ago,
            ScheduledNotification.category.notin_(EXEMPT_CATEGORIES),
            ScheduledNotification.status.in_(["sent", "delivered", "pending"]),
        )
        .scalar()
        or 0
    )

    if daily_count >= cap_daily:
        return False, f"Daily limit exceeded ({daily_count}/{cap_daily})"

    # Count sent/queued promotional notifications in last 7 days
    weekly_count = (
        db.query(func.count(ScheduledNotification.id))
        .filter(
            ScheduledNotification.user_id == user_id,
            ScheduledNotification.created_at >= week_ago,
            ScheduledNotification.category.notin_(EXEMPT_CATEGORIES),
            ScheduledNotification.status.in_(["sent", "delivered", "pending"]),
        )
        .scalar()
        or 0
    )

    if weekly_count >= cap_weekly:
        return False, f"Weekly limit exceeded ({weekly_count}/{cap_weekly})"

    return True, None

def should_exclude_from_event_promo(db: Session, user_id: int, event_id: Optional[int]) -> bool:
    """Convenience alias for ticket purchase check."""
    return has_purchased_ticket(db, user_id, event_id)


def check_rate_limits(db: Session, user_id: int) -> Tuple[bool, str]:
    """Convenience alias for frequency cap check."""
    return check_frequency_cap(db, user_id, category="promotional")


def check_notification_eligibility(

    db: Session,
    user_id: int,
    category: str,
    priority: str = "normal",
    idempotency_key: Optional[str] = None,
    event_id: Optional[int] = None,
    rule_key: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Comprehensive eligibility gate:
    1. Idempotency / duplicate check
    2. User category preference opt-in
    3. Ticket purchase check (no purchase prompts to existing ticket holders)
    4. Frequency limit enforcement
    """
    # 1. Duplicate check
    if is_duplicate(db, idempotency_key):
        return False, "Duplicate notification (idempotency key match)"

    # 2. Check user notification preferences
    prefs = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if prefs:
        cat_lower = category.lower()
        if cat_lower == "events" and not prefs.events:
            return False, "User opted out of event notifications"
        if cat_lower == "artist_updates" and hasattr(prefs, "artist_updates") and not prefs.artist_updates:
            return False, "User opted out of artist updates"
        if cat_lower == "recommendations" and hasattr(prefs, "recommendations") and not prefs.recommendations:
            return False, "User opted out of recommendations"
        if cat_lower == "social" and hasattr(prefs, "social") and not prefs.social:
            return False, "User opted out of social notifications"
        if cat_lower == "reengagement" and hasattr(prefs, "reengagement") and not prefs.reengagement:
            return False, "User opted out of re-engagement"
        if cat_lower == "marketing" and not prefs.marketing:
            return False, "User opted out of marketing notifications"

    # 3. Ticket purchase exclusion for promotional/sales reminders
    if category in ("events", "recommendations", "ticket_alert") and event_id:
        if has_purchased_ticket(db, user_id, event_id):
            return False, "User already purchased tickets for this event"

    # 4. Frequency cap check
    if priority not in ("critical", "high"):
        ok, reason = check_frequency_cap(db, user_id, category, rule_key)
        if not ok:
            return False, reason

    return True, None
