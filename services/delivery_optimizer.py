"""
Sound It - Smart Notification Delivery Optimizer
Learns user engagement patterns to schedule non-urgent notifications
during optimal active hours, while never delaying critical alerts.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from models import User, NotificationPreference, UserActivity
from services.timezone_service import (
    validate_iana_timezone,
    utc_to_local,
    is_in_quiet_hours,
    get_next_suitable_delivery_utc,
)
import logging

logger = logging.getLogger("soundit.delivery_optimizer")

CRITICAL_CATEGORIES = {"payments", "bookings", "verifications", "security", "cancellations"}

def is_urgent_notification(category: str, priority: str = "normal") -> bool:
    """Critical transactional and security notifications must bypass quiet hours."""
    if priority in ("critical", "high"):
        return True
    if category.lower() in CRITICAL_CATEGORIES:
        return True
    return False

def get_learned_engagement_hour(db: Session, user_id: int) -> Optional[int]:
    """
    Finds the user's most frequent local active hour based on historical activity logs.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    user_tz = validate_iana_timezone(user.timezone)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=30)

    activities = (
        db.query(UserActivity.created_at)
        .filter(UserActivity.user_id == user_id, UserActivity.created_at >= cutoff)
        .limit(100)
        .all()
    )

    if len(activities) < 5:
        return None  # Insufficient data, use default/preferred hour

    hour_counts = {}
    for (act_dt,) in activities:
        if act_dt:
            local_dt = utc_to_local(act_dt, user_tz)
            h = local_dt.hour
            hour_counts[h] = hour_counts.get(h, 0) + 1

    if not hour_counts:
        return None

    best_hour = max(hour_counts.items(), key=lambda x: x[1])[0]
    return best_hour

def calculate_optimal_delivery_utc(
    db: Session,
    user_id: int,
    category: str,
    priority: str = "normal",
) -> datetime:
    """
    Computes optimal UTC dispatch time. Critical notifications return now (0 delay).
    Promotional notifications avoid quiet hours and align with user active hours.
    """
    now_utc = datetime.now(timezone.utc)

    # 1. Urgent notifications are never delayed
    if is_urgent_notification(category, priority):
        return now_utc

    # 2. Get user preferences & timezone
    user = db.query(User).filter(User.id == user_id).first()
    prefs = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()

    user_tz = validate_iana_timezone(user.timezone if user else None)
    quiet_start = prefs.quiet_hours_start if prefs else "22:00"
    quiet_end = prefs.quiet_hours_end if prefs else "08:00"

    # 3. Determine target delivery hour:
    # Priority: user explicit preference > click-learned hour > activity-learned hour > 09:00 AM morning default
    from models import UserEngagementProfile
    eng_profile = (
        db.query(UserEngagementProfile)
        .filter(UserEngagementProfile.user_id == user_id)
        .first()
    )
    click_learned_hour = eng_profile.learned_send_hour if eng_profile else None
    activity_learned_hour = get_learned_engagement_hour(db, user_id) if click_learned_hour is None else None
    explicit_hour = prefs.preferred_delivery_hour if prefs and prefs.preferred_delivery_hour is not None else None

    if click_learned_hour is not None:
        target_hour = click_learned_hour
    elif explicit_hour is not None:
        target_hour = explicit_hour
    elif activity_learned_hour is not None:
        target_hour = activity_learned_hour
    else:
        target_hour = 9  # 09:00 AM user local morning default for discovery & planning

    # 4. Check quiet hours and return optimal UTC time
    return get_next_suitable_delivery_utc(
        now_utc,
        user_tz,
        preferred_hour=target_hour,
        quiet_start_str=quiet_start,
        quiet_end_str=quiet_end,
    )
