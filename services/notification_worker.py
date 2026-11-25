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

        # C. Email Delivery via Hostinger SMTP SSL
        target_channel = getattr(item, "channel", "all") or "all"
        send_email_allowed = (target_channel in ("all", "email")) and (not pref or getattr(pref, "email_enabled", True))

        if send_email_allowed and user.email:
            try:
                from email_service import send_email, _email_wrapper, is_deliverable_email
                if is_deliverable_email(user.email):
                    # Format call-to-action button if event_id or url is present
                    event_id = (item.data or {}).get("event_id") if isinstance(item.data, dict) else None
                    action_url = (item.data or {}).get("action_url") if isinstance(item.data, dict) else None
                    if not action_url and event_id:
                        action_url = f"https://sounditent.com/events/{event_id}"
                    elif not action_url:
                        action_url = "https://sounditent.com/notifications"

                    cta_button = f'''
                    <div style="margin: 28px 0; text-align: center;">
                        <a href="{action_url}" style="background-color: #d3da0c; color: #020b00; padding: 14px 28px; text-decoration: none; border-radius: 9999px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(211,218,12,0.35);">
                            View Details on Sound It &rarr;
                        </a>
                    </div>
                    '''

                    email_content = f'''
                    <h2 style="color: #020b00; font-size: 20px; font-weight: 800; margin: 0 0 16px;">{item.title}</h2>
                    <p style="color: #3f3f46; font-size: 15px; line-height: 1.6; margin: 0 0 20px; white-space: pre-wrap;">{item.message}</p>
                    {cta_button}
                    <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px; text-align: center;">
                        You received this because email notifications are enabled in your Sound It account.
                        <br/>
                        <a href="https://sounditent.com/settings/notifications" style="color: #71717a; text-decoration: underline;">Manage Notification Preferences</a>
                    </p>
                    '''

                    html_body = _email_wrapper(item.title, email_content)
                    email_sent = send_email(
                        to_email=user.email,
                        subject=item.title,
                        body=item.message,
                        html_body=html_body,
                        is_marketing=(item.category in ("recommendation", "reengagement", "promotional", "social"))
                    )
                    if email_sent:
                        logger.info(f"Successfully sent automated email for notification {item.id} to {user.email}")
            except Exception as ee:
                logger.warning(f"Automated email delivery failed for notification {item.id}: {ee}")

        # D. SMS Delivery for Critical Alerts
        if (target_channel in ("all", "sms")) and pref and getattr(pref, "sms_enabled", False) and item.priority == "critical" and user.phone:
            try:
                from services.sms_notifications import _send_sms_safe
                _send_sms_safe(
                    phone_number=user.phone,
                    template_code=None,
                    template_param={},
                    fallback_message=f"Sound It Alert: {item.title} - {item.message}"
                )
            except Exception as se:
                logger.warning(f"SMS delivery failed for notification {item.id}: {se}")

        # E. Mark ScheduledNotification as sent & sync AgentMessageDraft telemetry if applicable
        item.status = "sent"
        item.sent_at = datetime.utcnow()
        draft_id = (item.data or {}).get("agent_draft_id") if isinstance(item.data, dict) else None
        if draft_id:
            try:
                from models import AgentMessageDraft, UserEngagementProfile
                draft = db.query(AgentMessageDraft).filter(AgentMessageDraft.id == int(draft_id)).first()
                if draft:
                    draft.in_app_notification_id = in_app.id
                    draft.status = "sent"
                    draft.sent_at = datetime.utcnow()
                eng = db.query(UserEngagementProfile).filter(UserEngagementProfile.user_id == user.id).first()
                if not eng:
                    eng = UserEngagementProfile(user_id=user.id, preferred_topics={}, suppressed_topics=[])
                    db.add(eng)
                eng.total_sent = (eng.total_sent or 0) + 1
                eng.last_sent_at = datetime.utcnow()
            except Exception as sync_err:
                logger.warning(f"Failed to sync agent draft telemetry for {draft_id}: {sync_err}")
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
