"""
Sound It - Automated Event Triggers Engine
Evaluates real platform activities and generates personalized,
time-zone-aware scheduled notifications for eligible users.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_

from models import (
    Event,
    EventStatus,
    User,
    ArtistProfile,
    ArtistFollow,
    EventFollow,
    TicketOrder,
    TicketOrderStatus,
    SmartNotificationRule,
    ScheduledNotification,
    UserActivity,
)
from services.interest_engine import match_users_for_event, get_top_user_interests
from services.anti_spam import check_notification_eligibility
from services.delivery_optimizer import calculate_optimal_delivery_utc
import logging

logger = logging.getLogger("soundit.notification_triggers")

# Helper to schedule notification safely
def schedule_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    category: str,
    priority: str = "normal",
    channel: str = "all",
    idempotency_key: Optional[str] = None,
    event_id: Optional[int] = None,
    data: Optional[Dict[str, Any]] = None,
    rule_key: Optional[str] = None,
) -> Optional[ScheduledNotification]:
    """
    Validates anti-spam eligibility, computes time-zone-optimized delivery time,
    and inserts into durable queue.
    """
    eligible, reason = check_notification_eligibility(
        db,
        user_id=user_id,
        category=category,
        priority=priority,
        idempotency_key=idempotency_key,
        event_id=event_id,
        rule_key=rule_key,
    )

    if not eligible:
        logger.debug(f"User {user_id} ineligible for {category}: {reason}")
        return None

    # Calculate optimal UTC delivery time respecting quiet hours & user active hours
    scheduled_utc = calculate_optimal_delivery_utc(db, user_id, category, priority)

    payload = data or {}
    if event_id:
        payload["event_id"] = event_id

    scheduled = ScheduledNotification(
        user_id=user_id,
        title=title,
        message=message,
        category=category,
        priority=priority,
        channel=channel,
        scheduled_for_utc=scheduled_utc,
        status="pending",
        idempotency_key=idempotency_key,
        data=payload,
        created_at=datetime.now(timezone.utc),
    )
    db.add(scheduled)
    try:
        db.commit()
        db.refresh(scheduled)
        return scheduled
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to queue notification: {e}")
        return None


# ---------------------------------------------------------------------------
# TRIGGER 1: New Event Matching User's Interests
# ---------------------------------------------------------------------------
def trigger_new_event_matching_interests(db: Session, event_id: int) -> int:
    """Matches users whose dynamic interest scores match a newly published event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or event.status != EventStatus.APPROVED:
        return 0

    rule = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == "event_interest_match").first()
    if rule and not rule.is_enabled:
        return 0
    min_score = rule.min_interest_score if rule else 2.0

    matched_user_ids = match_users_for_event(db, event_id, min_score=min_score, limit=150)
    count = 0

    for uid in matched_user_ids:
        # Don't notify organizer of their own event
        if uid == event.organizer_id:
            continue
        key = f"interest_match_ev_{event.id}_u_{uid}"
        notif = schedule_notification(
            db,
            user_id=uid,
            title=f"New Event for You: {event.title}",
            message=f"Based on your music & nightlife interests, check out '{event.title}' in {event.city.capitalize() if event.city else 'China'}!",
            category="events",
            priority="normal",
            idempotency_key=key,
            event_id=event.id,
            rule_key="event_interest_match",
        )
        if notif:
            count += 1

    return count


# ---------------------------------------------------------------------------
# TRIGGER 2: New Event or Content from Followed Artist / DJ
# ---------------------------------------------------------------------------
def trigger_followed_artist_content(
    db: Session,
    artist_id: int,
    content_type: str,  # 'event' | 'reel' | 'track'
    title: str,
    content_id: int,
) -> int:
    """Notifies users who follow an artist or DJ when they post or perform."""
    rule = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == "followed_artist_update").first()
    if rule and not rule.is_enabled:
        return 0

    artist = db.query(ArtistProfile).filter(ArtistProfile.id == artist_id).first()
    artist_name = artist.stage_name if artist else "A creator you follow"

    # Get followers
    followers = db.query(ArtistFollow.user_id).filter(ArtistFollow.artist_id == artist_id).all()
    count = 0

    for (uid,) in followers:
        key = f"art_update_{artist_id}_{content_type}_{content_id}_u_{uid}"
        msg = (
            f"{artist_name} is performing at an upcoming event!"
            if content_type == "event"
            else f"{artist_name} just shared a new {content_type}: '{title}'."
        )
        notif = schedule_notification(
            db,
            user_id=uid,
            title=f"New from {artist_name}",
            message=msg,
            category="artist_updates",
            priority="normal",
            idempotency_key=key,
            event_id=content_id if content_type == "event" else None,
            data={"artist_id": artist_id, "content_type": content_type, "content_id": content_id},
            rule_key="followed_artist_update",
        )
        if notif:
            count += 1

    return count


# ---------------------------------------------------------------------------
# TRIGGER 3 & 4: Approaching Event Countdowns (48h and 24h)
# ---------------------------------------------------------------------------
def trigger_event_countdowns(db: Session) -> Dict[str, int]:
    """
    Scans upcoming approved events and schedules 48h and 24h reminders.
    If user bought a ticket -> Attendee logistics reminder.
    If user saved event but hasn't bought -> Last chance ticket alert.
    """
    now = datetime.now(timezone.utc)
    results = {"48h": 0, "24h": 0}

    # Window for 48h: 46h to 50h ahead
    w48_start = now + timedelta(hours=46)
    w48_end = now + timedelta(hours=50)

    # Window for 24h: 22h to 26h ahead
    w24_start = now + timedelta(hours=22)
    w24_end = now + timedelta(hours=26)

    # Query events in countdown windows
    events_48h = db.query(Event).filter(
        Event.status == EventStatus.APPROVED,
        Event.start_date >= w48_start,
        Event.start_date <= w48_end,
    ).all()

    events_24h = db.query(Event).filter(
        Event.status == EventStatus.APPROVED,
        Event.start_date >= w24_start,
        Event.start_date <= w24_end,
    ).all()

    # Process 48h Countdown
    for ev in events_48h:
        # 1. Ticket buyers
        buyer_ids = [
            order.user_id
            for order in db.query(TicketOrder.user_id)
            .filter(TicketOrder.event_id == ev.id, TicketOrder.status.in_([TicketOrderStatus.APPROVED, "approved", "confirmed", "completed"]))
            .all()
        ]
        for uid in set(buyer_ids):
            key = f"ev_48h_attendee_{ev.id}_u_{uid}"
            notif = schedule_notification(
                db,
                user_id=uid,
                title=f"48h Reminder: {ev.title}",
                message=f"Get ready! '{ev.title}' starts in 2 days. View your ticket pass and venue directions.",
                category="events",
                priority="high",
                idempotency_key=key,
                event_id=ev.id,
                rule_key="event_countdown_48h",
            )
            if notif:
                results["48h"] += 1

        # 2. Saved users who haven't bought yet
        saved_user_ids = [
            f.user_id
            for f in db.query(EventFollow.user_id).filter(EventFollow.event_id == ev.id).all()
            if f.user_id not in buyer_ids
        ]
        for uid in set(saved_user_ids):
            key = f"ev_48h_saved_{ev.id}_u_{uid}"
            notif = schedule_notification(
                db,
                user_id=uid,
                title=f"2 Days Left: {ev.title}",
                message=f"'{ev.title}' is coming up in 48 hours. Grab your ticket before sales end!",
                category="events",
                priority="normal",
                idempotency_key=key,
                event_id=ev.id,
                rule_key="event_countdown_48h",
            )
            if notif:
                results["48h"] += 1

    # Process 24h Countdown
    for ev in events_24h:
        buyer_ids = [
            order.user_id
            for order in db.query(TicketOrder.user_id)
            .filter(TicketOrder.event_id == ev.id, TicketOrder.status.in_([TicketOrderStatus.APPROVED, "approved", "confirmed", "completed"]))
            .all()
        ]
        for uid in set(buyer_ids):
            key = f"ev_24h_attendee_{ev.id}_u_{uid}"
            notif = schedule_notification(
                db,
                user_id=uid,
                title=f"Tomorrow: {ev.title}!",
                message=f"'{ev.title}' starts tomorrow at {ev.venue_name or 'the venue'}. Have your QR ticket ready!",
                category="events",
                priority="high",
                idempotency_key=key,
                event_id=ev.id,
                rule_key="event_countdown_24h",
            )
            if notif:
                results["24h"] += 1

        saved_user_ids = [
            f.user_id
            for f in db.query(EventFollow.user_id).filter(EventFollow.event_id == ev.id).all()
            if f.user_id not in buyer_ids
        ]
        for uid in set(saved_user_ids):
            key = f"ev_24h_saved_{ev.id}_u_{uid}"
            notif = schedule_notification(
                db,
                user_id=uid,
                title=f"Final Call: {ev.title} Tomorrow",
                message=f"Ticket sales for '{ev.title}' are ending today! Secure your spot now.",
                category="ticket_alert",
                priority="normal",
                idempotency_key=key,
                event_id=ev.id,
                rule_key="event_countdown_24h",
            )
            if notif:
                results["24h"] += 1

    return results


# ---------------------------------------------------------------------------
# TRIGGER 5: Ticket Sales Closing Alert
# ---------------------------------------------------------------------------
def trigger_ticket_sales_closing(db: Session) -> int:
    """Scans for events whose sales end in < 12 hours and alerts interested users."""
    now = datetime.now(timezone.utc)
    closing_window_end = now + timedelta(hours=12)

    closing_events = db.query(Event).filter(
        Event.status == EventStatus.APPROVED,
        Event.start_date > now,
        Event.start_date <= closing_window_end,
    ).all()

    count = 0
    for ev in closing_events:
        # Target users who saved event or matched interests, but haven't bought yet
        buyers = {
            o.user_id
            for o in db.query(TicketOrder.user_id)
            .filter(TicketOrder.event_id == ev.id, TicketOrder.status.in_([TicketOrderStatus.APPROVED, "approved", "confirmed"]))
            .all()
        }
        savers = [
            f.user_id
            for f in db.query(EventFollow.user_id).filter(EventFollow.event_id == ev.id).all()
            if f.user_id not in buyers
        ]

        for uid in savers:
            key = f"ticket_close_ev_{ev.id}_u_{uid}"
            notif = schedule_notification(
                db,
                user_id=uid,
                title=f"Tickets Closing Soon: {ev.title}",
                message=f"Online tickets for '{ev.title}' will close in a few hours. Don't miss out!",
                category="ticket_alert",
                priority="high",
                idempotency_key=key,
                event_id=ev.id,
                rule_key="ticket_closing_soon",
            )
            if notif:
                count += 1

    return count


# ---------------------------------------------------------------------------
# TRIGGER 6: Event Changes or Cancellations (High Urgency)
# ---------------------------------------------------------------------------
def trigger_event_change_or_cancellation(
    db: Session,
    event_id: int,
    change_type: str,  # 'cancelled' | 'venue_change' | 'time_change'
    details: str,
) -> int:
    """Immediate high-priority alert for ticket holders and event followers."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return 0

    # Get all ticket holders and followers
    target_users = set(
        [
            o.user_id
            for o in db.query(TicketOrder.user_id).filter(TicketOrder.event_id == event_id).all()
        ]
        + [f.user_id for f in db.query(EventFollow.user_id).filter(EventFollow.event_id == event_id).all()]
    )

    title = (
        f"EVENT CANCELLED: {event.title}"
        if change_type == "cancelled"
        else f"IMPORTANT UPDATE: {event.title}"
    )

    count = 0
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    for uid in target_users:
        key = f"ev_change_{event_id}_{change_type}_{now_str}_u_{uid}"
        notif = schedule_notification(
            db,
            user_id=uid,
            title=title,
            message=details,
            category="cancellations" if change_type == "cancelled" else "events",
            priority="critical",  # Always bypasses quiet hours and promotional limits
            channel="all",
            idempotency_key=key,
            event_id=event_id,
            data={"change_type": change_type, "details": details},
        )
        if notif:
            count += 1

    return count


# ---------------------------------------------------------------------------
# TRIGGER 7: Inactive User Re-engagement (Weekly)
# ---------------------------------------------------------------------------
def trigger_inactive_user_reengagement(db: Session) -> int:
    """Scans for users with zero activity in 7+ days and recommends trending events."""
    rule = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == "inactive_reengagement").first()
    if rule and not rule.is_enabled:
        return 0

    now = datetime.now(timezone.utc)
    inactive_cutoff = now - timedelta(days=7)

    # Active users in last 7 days
    active_user_ids = {
        r[0]
        for r in db.query(UserActivity.user_id)
        .filter(UserActivity.created_at >= inactive_cutoff)
        .distinct()
        .all()
    }

    # Candidate users: active account, but no activity in 7+ days
    candidate_users = (
        db.query(User.id, User.preferred_city)
        .filter(User.id.notin_(active_user_ids))
        .limit(100)
        .all()
    )

    week_str = now.strftime("%Y_W%W")
    count = 0

    for uid, city in candidate_users:
        key = f"reengage_{week_str}_u_{uid}"

        # Get user's top interest category
        top_interests = get_top_user_interests(db, uid, limit=1)
        fav_genre = top_interests[0]["category"].capitalize() if top_interests else "Entertainment"

        notif = schedule_notification(
            db,
            user_id=uid,
            title="We Miss You on Sound It! 🎉",
            message=f"Discover trending {fav_genre} events and nightlife highlights happening this weekend.",
            category="reengagement",
            priority="low",
            idempotency_key=key,
            rule_key="inactive_reengagement",
        )
        if notif:
            count += 1

    return count


def evaluate_all_rules(db: Session) -> Dict[str, Any]:
    """
    Evaluates all active trigger rules against current platform state.
    Called periodically by the background scheduler worker.
    """
    stats = {}
    try:
        # 1. 48h & 24h Event Countdowns
        rule_48 = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == "event_countdown_48h").first()
        if not rule_48 or rule_48.is_active:
            stats["countdowns"] = trigger_event_countdowns(db)
    except Exception as e:
        logger.error(f"Error evaluating countdown rules: {e}")
        stats["countdowns_error"] = str(e)

    try:
        # 2. Ticket Sales Closing Soon
        rule_close = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == "ticket_closing_soon").first()
        if not rule_close or rule_close.is_active:
            stats["ticket_closing"] = trigger_ticket_sales_closing(db)
    except Exception as e:
        logger.error(f"Error evaluating ticket closing rules: {e}")
        stats["ticket_closing_error"] = str(e)

    try:
        # 3. Inactive User Re-engagement
        rule_reengage = db.query(SmartNotificationRule).filter(SmartNotificationRule.rule_key == "inactive_reengagement").first()
        if not rule_reengage or rule_reengage.is_active:
            stats["reengagement"] = trigger_inactive_user_reengagement(db)
    except Exception as e:
        logger.error(f"Error evaluating reengagement rules: {e}")
        stats["reengagement_error"] = str(e)

    return stats

