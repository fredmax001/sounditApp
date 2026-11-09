"""
Smart Notification Engine - Background Scheduler Worker (Phase 7)
Processes scheduled notifications, enforces delivery constraints, and evaluates automated triggers.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    ScheduledNotification,
    SmartNotificationRule,
    Notification,
    User,
    NotificationPreference,
)
from services.push_service import PushService
from services.timezone_service import is_in_quiet_hours, get_next_suitable_delivery_utc
from services.anti_spam import check_rate_limits, should_exclude_from_event_promo
from services.notification_triggers import evaluate_all_rules

logger = logging.getLogger("soundit.smart_notifications.worker")

# Flag for system-wide promotions pause
_PROMOTIONS_PAUSED = False

def set_promotions_paused(paused: bool):
    global _PROMOTIONS_PAUSED
    _PROMOTIONS_PAUSED = paused

def get_promotions_paused() -> bool:
    return _PROMOTIONS_PAUSED


def process_single_scheduled_notification(db: Session, item: ScheduledNotification) -> bool:
    """
    Validates delivery constraints and delivers a single scheduled notification.
    Returns True if sent, False if postponed or failed.
    """
    now = datetime.utcnow()

    # 1. Global pause check (only for promotional/recommendations/reengagement)
    if _PROMOTIONS_PAUSED and item.category in ("recommendation", "reengagement", "promotional", "social"):
        logger.info(f"Promotions paused globally. Postponing notification {item.id}")
        item.scheduled_for_utc = now + timedelta(hours=2)
        db.commit()
        return False

    # 2. User Existence & Preferences
    user = db.query(User).filter(User.id == item.user_id).first()
    if not user:
        item.status = "failed"
        item.error_reason = "User no longer exists"
        db.commit()
        return False

    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first()
    if pref:
        # Check category toggles
        if item.category == "recommendation" and not getattr(pref, "recommendations", True):
            item.status = "skipped"
            item.error_reason = "User disabled recommendations"
            db.commit()
            return False
        if item.category == "artist_update" and not getattr(pref, "artist_updates", True):
            item.status = "skipped"
            item.error_reason = "User disabled artist updates"
            db.commit()
            return False
        if item.category == "reengagement" and not getattr(pref, "reengagement", True):
            item.status = "skipped"
            item.error_reason = "User disabled re-engagement notifications"
            db.commit()
            return False
        if item.category == "social" and not getattr(pref, "social", True):
            item.status = "skipped"
            item.error_reason = "User disabled social notifications"
            db.commit()
            return False

    # 3. Quiet hours check (Critical alerts bypass quiet hours)
    if item.priority != "critical":
        if is_in_quiet_hours(db, user.id, now):
            next_allowed = get_next_suitable_delivery_utc(db, user.id, now)
            logger.info(f"User {user.id} in quiet hours. Rescheduling item {item.id} to {next_allowed}")
            item.scheduled_for_utc = next_allowed
            db.commit()
            return False

    # 4. Anti-Spam frequency cap check (Daily <= 3, Weekly <= 10 for promotional)
    if item.priority != "critical" and item.category in ("recommendation", "reengagement", "promotional"):
        allowed, reason = check_rate_limits(db, user.id)
        if not allowed:
            logger.info(f"Rate limit hit for user {user.id} ({reason}). Rescheduling item {item.id} by 12 hours.")
            item.scheduled_for_utc = now + timedelta(hours=12)
            db.commit()
            return False

    # 5. Ticket exclusion check (Do not promote events user already bought tickets for)
    event_id = (item.data or {}).get("event_id") if isinstance(item.data, dict) else None
    if event_id and item.category in ("recommendation", "ticket_alert", "promotional"):
        if should_exclude_from_event_promo(db, user.id, event_id):
            item.status = "skipped"
            item.error_reason = f"User {user.id} already holds ticket for event {event_id}"
            db.commit()
            return False

    # 6. Delivery Dispatch
    try:
        # A. Create in-app Notification record
        in_app = Notification(
            user_id=user.id,
            title=item.title,
            message=item.message,
            type=item.category,
            data=item.data or {},
            is_read=False,
            created_at=now,
        )
        db.add(in_app)
        db.flush()

        # B. Push Notification (APNs & WebPush)
        try:
            push_svc = PushService(db)
            push_svc.send_notification(in_app)
        except Exception as pe:
            logger.warning(f"Push delivery failed for scheduled notification {item.id}: {pe}")

        # C. Mark ScheduledNotification as sent
        item.status = "sent"
        item.sent_at = datetime.utcnow()
        db.commit()
        logger.info(f"Successfully delivered smart notification {item.id} to user {user.id}")
        return True

    except Exception as e:
        db.rollback()
        logger.exception(f"Error delivering notification {item.id}: {e}")
        item.retry_count = (item.retry_count or 0) + 1
        if item.retry_count >= 3:
            item.status = "failed"
            item.error_reason = str(e)[:250]
        else:
            # Exponential backoff: 5m, 15m
            backoff_min = 5 * (2 ** (item.retry_count - 1))
            item.scheduled_for_utc = datetime.utcnow() + timedelta(minutes=backoff_min)
            item.error_reason = f"Retry {item.retry_count}: {str(e)[:180]}"
        db.commit()
        return False


def process_pending_queue(db: Session, batch_size: int = 50) -> int:
    """
    Finds and processes pending scheduled notifications due for delivery.
    """
    now = datetime.utcnow()
    pending_items = (
        db.query(ScheduledNotification)
        .filter(
            ScheduledNotification.status == "pending",
            ScheduledNotification.scheduled_for_utc <= now,
        )
        .order_by(
            # Critical priority first
            ScheduledNotification.priority.desc(),
            ScheduledNotification.scheduled_for_utc.asc(),
        )
        .limit(batch_size)
        .all()
    )

    delivered_count = 0
    for item in pending_items:
        if process_single_scheduled_notification(db, item):
            delivered_count += 1

    return delivered_count


def run_worker_cycle(db: Session) -> dict:
    """
    Executes one complete cycle: evaluates trigger rules, then dispatches the pending queue.
    """
    logger.info("Executing smart notification worker cycle...")
    
    # 1. Trigger evaluation
    trigger_stats = evaluate_all_rules(db)
    
    # 2. Queue dispatch
    delivered = process_pending_queue(db)

    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "triggers": trigger_stats,
        "delivered": delivered,
    }
    logger.info(f"Worker cycle complete: {result}")
    return result


async def start_smart_notification_worker(interval_seconds: int = 300):
    """
    Async background task that periodically runs the notification worker cycle.
    Runs every 5 minutes by default.
    """
    logger.info(f"Starting Smart Notification background worker (interval: {interval_seconds}s)...")
    while True:
        try:
            db = SessionLocal()
            try:
                # Wrap synchronous DB operations in thread pool so async event loop isn't blocked
                await asyncio.to_thread(run_worker_cycle, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Smart Notification background worker stopped.")
            break
        except Exception as e:
            logger.exception(f"Unexpected error in smart notification worker loop: {e}")

        await asyncio.sleep(interval_seconds)
