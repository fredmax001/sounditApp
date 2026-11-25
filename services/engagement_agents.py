"""
Sound It - Autonomous Backend Engagement & Growth Agents
Replaces static "We Miss You" broadcasts with 4 specialized, supply-aware,
click-learning worker agents:

1. event_radar      — Supply-aware Event & Seasonal Radar (strict Silence Rule when 0 events)
2. talent_spotlight — Real Artists/DJs, Vendors & Businesses discovery (30-day no-repeat)
3. provider_coach   — Day 1 / Day 4 / Day 10 activation coaching for incomplete Artists,
                      Businesses/Organizers, and Vendors (stops automatically on completion)
4. click_optimizer  — Click-learning, morning-first timing (09:00 local default), topic
                      affinity ranking, and automatic fatigue throttling after 3 ignores.

Defaults safely to `mode="preview"` (creates inspectable drafts in Admin Mission Control
without sending) and supports 1-click switching to `mode="autopilot"`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from models import (
    AgentConfiguration,
    AgentMessageDraft,
    ArtistFollow,
    ArtistProfile,
    BusinessProfile,
    Event,
    EventStatus,
    Notification,
    NotificationPreference,
    OrganizerProfile,
    Product,
    ScheduledNotification,
    User,
    UserEngagementProfile,
    UserFollow,
    UserRole,
    VendorFollow,
    VendorProfile,
)
from services.ai_copywriter import generate_agent_copy, get_active_copywriter_status
from services.anti_spam import has_purchased_ticket
from services.timezone_service import (
    DEFAULT_TIMEZONE,
    local_to_utc,
    utc_to_local,
    validate_iana_timezone,
)

logger = logging.getLogger("soundit.engagement_agents")

# ---------------------------------------------------------------------------
# Default Agent Definitions (All start safely in Preview / Dry-Run Mode)
# ---------------------------------------------------------------------------

DEFAULT_AGENT_SPECS: List[Dict[str, Any]] = [
    {
        "agent_key": "event_radar",
        "name": "Event & Seasonal Radar",
        "description": (
            "Watches newly approved events and seasonal peaks (weekends, New Year's Eve, holidays) "
            "per city. Sends morning digests when real events exist and stays completely silent "
            "when there are no upcoming events."
        ),
        "is_enabled": True,
        "mode": "preview",
        "default_send_hour": 9,
        "max_per_week": 2,
        "cooldown_days": 30,
        "channels": ["push", "in_app", "email"],
        "config": {"lookahead_days": 45, "silence_when_empty": True},
    },
    {
        "agent_key": "talent_spotlight",
        "name": "Talent & Community Spotlight",
        "description": (
            "Highlights real Artists/DJs, Vendors with live products, and Venues/Organizers "
            "in each user's city so Sound It stays engaging between major events. Adapts to "
            "what each user clicks and never repeats the same profile within 30 days."
        ),
        "is_enabled": True,
        "mode": "preview",
        "default_send_hour": 9,
        "max_per_week": 2,
        "cooldown_days": 30,
        "channels": ["push", "in_app"],
        "config": {"rotate_roles": ["artist", "vendor", "business"]},
    },
    {
        "agent_key": "provider_coach",
        "name": "Provider Activation Coach",
        "description": (
            "Audits Artists/DJs, Businesses/Organizers, and Vendors with incomplete profiles or "
            "zero uploaded events/products and sends spaced Day 1 / Day 4 / Day 10 coaching nudges. "
            "Stops automatically the moment they complete their setup."
        ),
        "is_enabled": True,
        "mode": "preview",
        "default_send_hour": 10,
        "max_per_week": 2,
        "cooldown_days": 30,
        "channels": ["push", "in_app", "email"],
        "config": {"milestones_days": [1, 4, 10]},
    },
    {
        "agent_key": "click_optimizer",
        "name": "Click-Learning & Timing Optimizer",
        "description": (
            "Continuously learns each user's best open/click hour (defaulting to 09:00 AM local), "
            "ranks preferred topics, suppresses ignored categories, and auto-throttles users who "
            "ignore 3 consecutive messages."
        ),
        "is_enabled": True,
        "mode": "autopilot",  # Passive analytics/optimizer — does not send messages itself
        "default_send_hour": 9,
        "max_per_week": 0,
        "cooldown_days": 14,
        "channels": [],
        "config": {"min_clicks_to_learn_hour": 3, "ignore_throttle_threshold": 3, "throttle_days": 14},
    },
]


def ensure_default_agent_configs(db: Session) -> Dict[str, AgentConfiguration]:
    """Idempotently ensures all 4 agent configs exist in DB."""
    existing = {
        c.agent_key: c
        for c in db.query(AgentConfiguration).all()
    }
    created_any = False
    for spec in DEFAULT_AGENT_SPECS:
        if spec["agent_key"] not in existing:
            cfg = AgentConfiguration(
                agent_key=spec["agent_key"],
                name=spec["name"],
                description=spec["description"],
                is_enabled=spec["is_enabled"],
                mode=spec["mode"],
                default_send_hour=spec["default_send_hour"],
                max_per_week=spec["max_per_week"],
                cooldown_days=spec["cooldown_days"],
                channels=list(spec["channels"]),
                config=dict(spec["config"]),
            )
            db.add(cfg)
            existing[spec["agent_key"]] = cfg
            created_any = True
    if created_any:
        db.commit()
        for cfg in existing.values():
            db.refresh(cfg)
    return existing


# ---------------------------------------------------------------------------
# Helpers: Normalization, Timezone Morning Scheduling & Eligibility
# ---------------------------------------------------------------------------

def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _city_str(val: Any) -> str:
    if val is None:
        return ""
    if hasattr(val, "value"):
        return str(val.value).strip().lower()
    return str(val).strip().lower()


def _city_display(city_key: str) -> str:
    if not city_key or city_key == "all":
        return "China"
    return city_key.replace("_", " ").title()


def _role_str(user: User) -> str:
    r = getattr(user, "role_type", None) or getattr(user, "role", None) or "user"
    if hasattr(r, "value"):
        r = r.value
    return str(r).strip().lower()


def _is_user_active(user: User) -> bool:
    if not user or not user.email:
        return False
    if "@deleted." in user.email.lower() or "deleted_" in user.email.lower():
        return False
    status_val = getattr(user, "status", None)
    if status_val is not None:
        s = status_val.value if hasattr(status_val, "value") else str(status_val)
        if s.lower() not in ("active", "approved", "verified"):
            return False
    return True


def _get_or_create_engagement_profile(db: Session, user_id: int) -> UserEngagementProfile:
    prof = (
        db.query(UserEngagementProfile)
        .filter(UserEngagementProfile.user_id == user_id)
        .first()
    )
    if not prof:
        prof = UserEngagementProfile(
            user_id=user_id,
            preferred_topics={},
            suppressed_topics=[],
            total_sent=0,
            total_opened=0,
            total_clicked=0,
            consecutive_ignored=0,
        )
        db.add(prof)
        db.flush()
    return prof


def _compute_target_send_utc(
    db: Session,
    user: User,
    default_hour: int = 9,
    eng_profile: Optional[UserEngagementProfile] = None,
) -> Tuple[datetime, int]:
    """
    Schedules for the user's learned click hour (once >= 3 clicks) or the agent's
    morning default (09:00 AM local). If today's morning window already passed
    more than 2 hours ago, schedules for tomorrow morning at that local hour so
    messages land cleanly in the morning!
    """
    now_utc = datetime.now(timezone.utc)
    tz_str = validate_iana_timezone(getattr(user, "timezone", None) or DEFAULT_TIMEZONE)
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first()

    if eng_profile and eng_profile.learned_send_hour is not None:
        target_hour = int(eng_profile.learned_send_hour)
    elif pref and pref.preferred_delivery_hour is not None:
        target_hour = int(pref.preferred_delivery_hour)
    else:
        target_hour = int(default_hour)

    # Clamp safely outside overnight hours (08:00 - 21:00)
    target_hour = max(8, min(21, target_hour))
    local_now = utc_to_local(now_utc, tz_str)

    # If we are currently inside [target_hour - 1, target_hour + 2], dispatch promptly
    if target_hour <= local_now.hour <= min(21, target_hour + 1):
        return now_utc, target_hour

    target_date = local_now.date()
    if local_now.hour > target_hour + 1:
        target_date = target_date + timedelta(days=1)

    target_local = datetime(
        year=target_date.year,
        month=target_date.month,
        day=target_date.day,
        hour=target_hour,
        minute=0,
        second=0,
    )
    return local_to_utc(target_local, tz_str), target_hour


def _can_receive_proactive_agent_message(
    db: Session,
    user: User,
    agent_cfg: AgentConfiguration,
    eng_profile: UserEngagementProfile,
    topic_key: Optional[str] = None,
    global_weekly_cap: int = 2,
) -> Tuple[bool, str]:
    """Enforces opt-outs, fatigue throttling, topic suppression, and strict weekly cap."""
    now = datetime.now(timezone.utc)

    # 1. User notification preferences / opt-out check
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user.id).first()
    if pref:
        if agent_cfg.agent_key in ("event_radar", "talent_spotlight"):
            if not getattr(pref, "recommendations", True) and not getattr(pref, "reengagement", True):
                return False, "User opted out of discovery recommendations"
        if agent_cfg.agent_key == "event_radar" and not getattr(pref, "events", True):
            return False, "User opted out of event notifications"
        if not getattr(pref, "in_app_enabled", True) and not getattr(pref, "push_enabled", True) and not getattr(pref, "email_enabled", True):
            return False, "User disabled all notification channels"

    # 2. Automatic fatigue throttle (after 3 consecutive ignored messages)
    throttled_until = _as_utc(eng_profile.throttled_until)
    if throttled_until and throttled_until > now and agent_cfg.agent_key != "provider_coach":
        return False, f"Auto-throttled until {throttled_until.date().isoformat()} (fatigue guard)"

    # 3. Topic suppression check
    suppressed = eng_profile.suppressed_topics or []
    if topic_key and topic_key in suppressed:
        return False, f"Topic '{topic_key}' suppressed due to repeated non-engagement"

    # 4. Strict weekly cap across proactive discovery agents (max 2/week per user)
    week_ago = now - timedelta(days=7)
    effective_cap = min(agent_cfg.max_per_week or 2, global_weekly_cap) if agent_cfg.agent_key != "provider_coach" else (agent_cfg.max_per_week or 2)

    if agent_cfg.agent_key in ("event_radar", "talent_spotlight"):
        recent_discovery = (
            db.query(func.count(AgentMessageDraft.id))
            .filter(
                AgentMessageDraft.user_id == user.id,
                AgentMessageDraft.agent_key.in_(["event_radar", "talent_spotlight"]),
                AgentMessageDraft.status.in_(["draft", "queued", "sent", "opened", "clicked"]),
                AgentMessageDraft.created_at >= week_ago,
            )
            .scalar()
            or 0
        )
        if recent_discovery >= effective_cap:
            return False, f"Weekly discovery cap reached ({recent_discovery}/{effective_cap})"
    else:
        recent_coach = (
            db.query(func.count(AgentMessageDraft.id))
            .filter(
                AgentMessageDraft.user_id == user.id,
                AgentMessageDraft.agent_key == "provider_coach",
                AgentMessageDraft.status.in_(["draft", "queued", "sent", "opened", "clicked"]),
                AgentMessageDraft.created_at >= now - timedelta(days=3),
            )
            .scalar()
            or 0
        )
        if recent_coach >= 1:
            return False, "Provider coach cooldown (max 1 coaching nudge per 3 days)"

    return True, "ok"


def _recent_used_angles(db: Session, user_id: int, days: int = 30) -> Set[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(AgentMessageDraft.angle_key)
        .filter(
            AgentMessageDraft.user_id == user_id,
            AgentMessageDraft.created_at >= cutoff,
        )
        .all()
    )
    return {r[0] for r in rows if r[0]}


def _was_entity_sent_recently(
    db: Session,
    user_id: int,
    entity_type: str,
    entity_id: int,
    days: int = 30,
) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    row = (
        db.query(AgentMessageDraft.id)
        .filter(
            AgentMessageDraft.user_id == user_id,
            AgentMessageDraft.entity_type == entity_type,
            AgentMessageDraft.entity_id == entity_id,
            AgentMessageDraft.status.in_(["draft", "queued", "sent", "opened", "clicked"]),
            AgentMessageDraft.created_at >= cutoff,
        )
        .first()
    )
    return row is not None


def _detect_seasonal_occasion(now: datetime, earliest_event_dt: Optional[datetime]) -> Tuple[str, str, str]:
    """Detects real upcoming calendar moments (New Year's Eve, CNY, Weekend, etc.)."""
    m, d = now.month, now.day
    if (m == 12 and d >= 10) or (m == 1 and d == 1):
        return ("New Year's Eve: ", "New Year's Eve", "New Year's Eve")
    if (m == 1 and d >= 15) or (m == 2 and d <= 18):
        return ("Spring Festival: ", "Spring Festival", "the holiday week")
    if (m == 9 and d >= 20) or (m == 10 and d <= 6):
        return ("Golden Week: ", "Golden Week", "Golden Week")
    if earliest_event_dt:
        delta_days = (_as_utc(earliest_event_dt) - now).total_seconds() / 86400.0
        if delta_days <= 4.5:
            return ("This Weekend: ", "This Weekend", "this weekend")
    return ("", "Upcoming Events", "your next night out")


def _persist_and_maybe_queue_draft(
    db: Session,
    agent_cfg: AgentConfiguration,
    user: User,
    *,
    angle_key: str,
    entity_type: str,
    entity_id: Optional[int],
    idempotency_key: str,
    title: str,
    message: str,
    action_url: str,
    reasoning: str,
    generated_by: str,
    scheduled_for_utc: datetime,
    local_send_hour: int,
    category: str,
    channels: Optional[List[str]] = None,
) -> Optional[AgentMessageDraft]:
    """
    Creates an AgentMessageDraft. If agent_cfg.mode == 'autopilot', also queues
    a live ScheduledNotification immediately for delivery by notification_worker.
    """
    existing = (
        db.query(AgentMessageDraft.id)
        .filter(AgentMessageDraft.idempotency_key == idempotency_key)
        .first()
    )
    if existing:
        return None

    eff_channels = channels or list(agent_cfg.channels or ["push", "in_app"])
    draft = AgentMessageDraft(
        agent_key=agent_cfg.agent_key,
        user_id=user.id,
        recipient_role=_role_str(user),
        city=_city_str(user.preferred_city) or "shanghai",
        language=getattr(user, "preferred_language", None) or "en",
        angle_key=angle_key,
        entity_type=entity_type,
        entity_id=entity_id,
        idempotency_key=idempotency_key,
        title=title[:200],
        message=message,
        action_url=action_url,
        reasoning=reasoning,
        channels=eff_channels,
        generated_by=generated_by,
        scheduled_for_utc=scheduled_for_utc,
        local_send_hour=local_send_hour,
        status="draft",
    )
    db.add(draft)
    db.flush()

    if agent_cfg.mode == "autopilot":
        _enqueue_draft_to_scheduled_notification(db, draft, category=category)

    db.commit()
    db.refresh(draft)
    return draft


def _enqueue_draft_to_scheduled_notification(
    db: Session,
    draft: AgentMessageDraft,
    category: str = "recommendations",
    immediate: bool = False,
) -> ScheduledNotification:
    """Queues an AgentMessageDraft into the durable ScheduledNotification delivery pipeline."""
    # Map channel list to notification_worker channel field
    ch_set = set(draft.channels or ["push", "in_app"])
    channel_str = "all" if "email" in ch_set else "push"

    # Build click-tracking deep link for email CTAs while preserving direct app route
    track_url = f"https://sounditent.com/api/v1/agents/track-click/{draft.id}"
    sched_time = datetime.now(timezone.utc) if immediate else (draft.scheduled_for_utc or datetime.now(timezone.utc))

    sched = ScheduledNotification(
        user_id=draft.user_id,
        title=draft.title,
        message=draft.message,
        category=category,
        priority="normal",
        channel=channel_str,
        scheduled_for_utc=sched_time,
        status="pending",
        idempotency_key=f"agent_draft_{draft.id}",
        data={
            "agent_key": draft.agent_key,
            "agent_draft_id": draft.id,
            "entity_type": draft.entity_type,
            "entity_id": draft.entity_id,
            "event_id": draft.entity_id if draft.entity_type == "event" else None,
            "action_url": track_url,
            "deep_link": draft.action_url,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(sched)
    db.flush()

    draft.scheduled_notification_id = sched.id
    draft.status = "queued"
    return sched


# ---------------------------------------------------------------------------
# AGENT 1: Event & Seasonal Radar (Supply-Aware, Strict Silence Rule)
# ---------------------------------------------------------------------------

def run_event_radar_agent(db: Session, max_users: int = 80) -> Dict[str, Any]:
    configs = ensure_default_agent_configs(db)
    cfg = configs["event_radar"]
    now = datetime.now(timezone.utc)

    if not cfg.is_enabled:
        return {"agent": "event_radar", "status": "disabled", "drafted": 0}

    lookahead = int((cfg.config or {}).get("lookahead_days", 45))
    window_end = now + timedelta(days=lookahead)

    upcoming_events = (
        db.query(Event)
        .filter(
            Event.status == EventStatus.APPROVED,
            Event.start_date > now,
            Event.start_date <= window_end,
        )
        .order_by(Event.start_date.asc())
        .all()
    )

    # STRICT SILENCE RULE: Never fabricate hype when 0 real upcoming events exist
    if not upcoming_events:
        summary = {
            "status": "silent_no_upcoming_events",
            "upcoming_events": 0,
            "drafted": 0,
            "reason": "Silence rule active: 0 upcoming approved events on the platform.",
        }
        cfg.last_run_at = now
        cfg.last_run_summary = summary
        db.commit()
        return {"agent": "event_radar", **summary}

    events_by_city: Dict[str, List[Event]] = {}
    for ev in upcoming_events:
        c = _city_str(ev.city) or "shanghai"
        events_by_city.setdefault(c, []).append(ev)

    users = (
        db.query(User)
        .order_by(User.id.asc())
        .limit(max_users * 3)
        .all()
    )

    week_tag = now.strftime("%Y_W%W")
    drafted = 0
    skipped_no_city_events = 0
    skipped_cap = 0

    for idx, user in enumerate(users):
        if drafted >= max_users:
            break
        if not _is_user_active(user):
            continue
        role = _role_str(user)
        if role in ("admin", "super_admin"):
            continue

        user_city = _city_str(user.preferred_city)
        # Match user's city first; only use platform-wide events if user hasn't picked a city
        city_events = events_by_city.get(user_city, []) if user_city and user_city != "all" else upcoming_events
        # Filter out events user already bought tickets for or organized themselves
        eligible_events = [
            ev for ev in city_events
            if ev.organizer_id != user.id and not has_purchased_ticket(db, user.id, ev.id)
        ]

        if not eligible_events:
            skipped_no_city_events += 1
            continue

        eng_profile = _get_or_create_engagement_profile(db, user.id)
        ok, _reason = _can_receive_proactive_agent_message(
            db, user, cfg, eng_profile, topic_key="events"
        )
        if not ok:
            skipped_cap += 1
            continue

        used_angles = _recent_used_angles(db, user.id, days=cfg.cooldown_days)
        display_city = _city_display(user_city or _city_str(eligible_events[0].city))
        occ_prefix, occ_title, occ_lower = _detect_seasonal_occasion(now, eligible_events[0].start_date)
        sched_utc, local_hour = _compute_target_send_utc(db, user, cfg.default_send_hour, eng_profile)

        if len(eligible_events) == 1:
            ev = eligible_events[0]
            if _was_entity_sent_recently(db, user.id, "event", ev.id, days=cfg.cooldown_days):
                continue
            ev_date_str = _as_utc(ev.start_date).strftime("%b %d") if ev.start_date else "soon"
            facts = {
                "city": display_city,
                "event_title": ev.title,
                "event_date": ev_date_str,
                "venue": ev.venue_name or display_city,
                "occasion_prefix": occ_prefix,
                "occasion_title": occ_title,
                "occasion_lower": occ_lower,
            }
            copy = generate_agent_copy(
                "event_single",
                facts,
                used_angles=used_angles,
                language=getattr(user, "preferred_language", "en"),
                seed=user.id + ev.id,
            )
            slug_or_id = getattr(ev, "slug", None) or ev.id
            draft = _persist_and_maybe_queue_draft(
                db,
                cfg,
                user,
                angle_key=copy["angle_key"],
                entity_type="event",
                entity_id=ev.id,
                idempotency_key=f"radar_ev_{ev.id}_u_{user.id}",
                title=copy["title"],
                message=copy["message"],
                action_url=f"/events/{slug_or_id}",
                reasoning=f"1 upcoming approved event ('{ev.title}') in {display_city}; morning {local_hour:02d}:00 delivery.",
                generated_by=copy["generated_by"],
                scheduled_for_utc=sched_utc,
                local_send_hour=local_hour,
                category="events",
            )
        else:
            e1, e2 = eligible_events[0], eligible_events[1]
            e1_date = _as_utc(e1.start_date).strftime("%b %d") if e1.start_date else "soon"
            facts = {
                "city": display_city,
                "count": len(eligible_events),
                "other_count": len(eligible_events) - 1,
                "first_title": e1.title,
                "first_date": e1_date,
                "second_title": e2.title,
                "occasion_prefix": occ_prefix,
                "occasion_title": occ_title,
                "occasion_lower": occ_lower,
            }
            copy = generate_agent_copy(
                "event_digest",
                facts,
                used_angles=used_angles,
                language=getattr(user, "preferred_language", "en"),
                seed=user.id + len(eligible_events),
            )
            draft = _persist_and_maybe_queue_draft(
                db,
                cfg,
                user,
                angle_key=copy["angle_key"],
                entity_type="seasonal" if occ_prefix else "event",
                entity_id=e1.id,
                idempotency_key=f"radar_digest_{week_tag}_{display_city.lower()}_u_{user.id}",
                title=copy["title"],
                message=copy["message"],
                action_url=f"/events?city={user_city or _city_str(e1.city)}",
                reasoning=(
                    f"{len(eligible_events)} upcoming events in {display_city} ({occ_title}); "
                    f"scheduled for {local_hour:02d}:00 local time."
                ),
                generated_by=copy["generated_by"],
                scheduled_for_utc=sched_utc,
                local_send_hour=local_hour,
                category="events",
            )

        if draft:
            drafted += 1

    summary = {
        "status": "ok",
        "mode": cfg.mode,
        "upcoming_events": len(upcoming_events),
        "drafted": drafted,
        "skipped_no_city_events": skipped_no_city_events,
        "skipped_cap_or_pref": skipped_cap,
    }
    cfg.last_run_at = now
    cfg.last_run_summary = summary
    db.commit()
    return {"agent": "event_radar", **summary}


# ---------------------------------------------------------------------------
# AGENT 2: Talent & Community Spotlight (Artists, Vendors, Businesses)
# ---------------------------------------------------------------------------

def run_talent_spotlight_agent(db: Session, max_users: int = 80) -> Dict[str, Any]:
    configs = ensure_default_agent_configs(db)
    cfg = configs["talent_spotlight"]
    now = datetime.now(timezone.utc)

    if not cfg.is_enabled:
        return {"agent": "talent_spotlight", "status": "disabled", "drafted": 0}

    # 1. Gather spotlight-ready Artists/DJs (must have stage_name + bio/genre/mix)
    artists = (
        db.query(ArtistProfile)
        .filter(ArtistProfile.is_approved == True)
        .order_by(desc(ArtistProfile.is_featured), desc(ArtistProfile.is_verified), desc(ArtistProfile.followers_count))
        .limit(40)
        .all()
    )
    spotlight_artists = [
        a for a in artists
        if a.stage_name and (a.bio or a.genre or a.dj_mix_url or a.spotify_url or a.soundcloud_url)
    ]

    # 2. Gather spotlight-ready Vendors (must have >= 1 active Product)
    vendor_product_counts = dict(
        db.query(Product.vendor_id, func.count(Product.id))
        .filter(Product.status == "active")
        .group_by(Product.vendor_id)
        .all()
    )
    vendors = (
        db.query(VendorProfile)
        .filter(VendorProfile.id.in_(list(vendor_product_counts.keys()) or [-1]))
        .order_by(desc(VendorProfile.is_featured), desc(VendorProfile.is_verified))
        .limit(30)
        .all()
    )
    sample_products: Dict[int, str] = {}
    for v in vendors:
        prod = db.query(Product.name).filter(Product.vendor_id == v.id, Product.status == "active").first()
        if prod:
            sample_products[v.id] = prod[0]

    # 3. Gather spotlight-ready Businesses/Organizers
    businesses = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.business_name.isnot(None))
        .order_by(desc(BusinessProfile.is_verified), desc(BusinessProfile.events_count))
        .limit(30)
        .all()
    )
    spotlight_businesses = [b for b in businesses if b.business_name and b.description]

    # SILENCE RULE: If no spotlight-ready profiles exist, send nothing
    if not spotlight_artists and not vendors and not spotlight_businesses:
        summary = {
            "status": "silent_no_spotlight_profiles",
            "drafted": 0,
            "reason": "No complete artist, vendor, or business profiles ready for spotlight yet.",
        }
        cfg.last_run_at = now
        cfg.last_run_summary = summary
        db.commit()
        return {"agent": "talent_spotlight", **summary}

    users = db.query(User).order_by(User.id.asc()).limit(max_users * 3).all()
    week_tag = now.strftime("%Y_W%W")
    drafted = 0

    for user in users:
        if drafted >= max_users:
            break
        if not _is_user_active(user):
            continue
        if _role_str(user) in ("admin", "super_admin"):
            continue

        eng_profile = _get_or_create_engagement_profile(db, user.id)
        ok, _ = _can_receive_proactive_agent_message(db, user, cfg, eng_profile)
        if not ok:
            continue

        user_city = _city_str(user.preferred_city)
        suppressed = set(eng_profile.suppressed_topics or [])
        pref_scores = eng_profile.preferred_topics or {}

        # Order spotlight pools by user's learned topic preference (default: artist -> vendor -> business)
        pool_order = sorted(
            [t for t in ("artist", "vendor", "business") if t not in suppressed],
            key=lambda t: float(pref_scores.get(t, 0.0)),
            reverse=True,
        )
        # Rotate naturally by week + user id when scores are tied
        if len(pool_order) > 1 and all(float(pref_scores.get(t, 0.0)) == 0.0 for t in pool_order):
            shift = (user.id + now.isocalendar()[1]) % len(pool_order)
            pool_order = pool_order[shift:] + pool_order[:shift]

        used_angles = _recent_used_angles(db, user.id, days=cfg.cooldown_days)
        sched_utc, local_hour = _compute_target_send_utc(db, user, cfg.default_send_hour, eng_profile)

        chosen_draft = None
        for topic in pool_order:
            if topic == "artist" and spotlight_artists:
                # Prefer same-city artist first, exclude self & already-followed & recently-spotlighted
                followed_artist_ids = {
                    r[0] for r in db.query(ArtistFollow.artist_id).filter(ArtistFollow.user_id == user.id).all()
                }
                candidates = [
                    a for a in spotlight_artists
                    if a.user_id != user.id
                    and a.id not in followed_artist_ids
                    and not _was_entity_sent_recently(db, user.id, "artist", a.id, days=cfg.cooldown_days)
                ]
                same_city = [a for a in candidates if user_city and _city_str(a.city) == user_city]
                pick = (same_city or candidates)[0] if (same_city or candidates) else None
                if pick:
                    display_city = _city_display(_city_str(pick.city) or user_city)
                    bio_snippet = (pick.bio or f"{pick.genre or 'Afrobeats & Nightlife'} talent on Sound It.")[:90].strip()
                    if len(pick.bio or "") > 90:
                        bio_snippet += "..."
                    copy = generate_agent_copy(
                        "artist_spotlight",
                        {
                            "stage_name": pick.stage_name,
                            "city": display_city,
                            "genre": pick.genre or "Afrobeats & Nightlife",
                            "bio_snippet": bio_snippet,
                        },
                        used_angles=used_angles,
                        language=getattr(user, "preferred_language", "en"),
                        seed=user.id + pick.id,
                    )
                    slug_or_id = pick.slug or pick.id
                    chosen_draft = _persist_and_maybe_queue_draft(
                        db,
                        cfg,
                        user,
                        angle_key=copy["angle_key"],
                        entity_type="artist",
                        entity_id=pick.id,
                        idempotency_key=f"spotlight_artist_{pick.id}_{week_tag}_u_{user.id}",
                        title=copy["title"],
                        message=copy["message"],
                        action_url=f"/artists/{slug_or_id}",
                        reasoning=f"Spotlighting artist '{pick.stage_name}' ({display_city}) not yet followed by user; scheduled {local_hour:02d}:00 local.",
                        generated_by=copy["generated_by"],
                        scheduled_for_utc=sched_utc,
                        local_send_hour=local_hour,
                        category="recommendations",
                    )
                    break

            elif topic == "vendor" and vendors:
                followed_vendor_ids = {
                    r[0] for r in db.query(VendorFollow.vendor_id).filter(VendorFollow.user_id == user.id).all()
                }
                candidates = [
                    v for v in vendors
                    if v.user_id != user.id
                    and v.id not in followed_vendor_ids
                    and not _was_entity_sent_recently(db, user.id, "vendor", v.id, days=cfg.cooldown_days)
                ]
                same_city = [v for v in candidates if user_city and _city_str(v.city) == user_city]
                pick = (same_city or candidates)[0] if (same_city or candidates) else None
                if pick:
                    display_city = _city_display(_city_str(pick.city) or user_city)
                    p_count = vendor_product_counts.get(pick.id, 1)
                    copy = generate_agent_copy(
                        "vendor_spotlight",
                        {
                            "vendor_name": pick.business_name,
                            "city": display_city,
                            "product_count": p_count,
                            "sample_product": sample_products.get(pick.id, "featured products"),
                        },
                        used_angles=used_angles,
                        language=getattr(user, "preferred_language", "en"),
                        seed=user.id + pick.id,
                    )
                    chosen_draft = _persist_and_maybe_queue_draft(
                        db,
                        cfg,
                        user,
                        angle_key=copy["angle_key"],
                        entity_type="vendor",
                        entity_id=pick.id,
                        idempotency_key=f"spotlight_vendor_{pick.id}_{week_tag}_u_{user.id}",
                        title=copy["title"],
                        message=copy["message"],
                        action_url=f"/vendor-store/{pick.id}",
                        reasoning=f"Spotlighting vendor '{pick.business_name}' ({p_count} active products in {display_city}); scheduled {local_hour:02d}:00 local.",
                        generated_by=copy["generated_by"],
                        scheduled_for_utc=sched_utc,
                        local_send_hour=local_hour,
                        category="recommendations",
                    )
                    break

            elif topic == "business" and spotlight_businesses:
                candidates = [
                    b for b in spotlight_businesses
                    if b.user_id != user.id
                    and not _was_entity_sent_recently(db, user.id, "business", b.id, days=cfg.cooldown_days)
                ]
                same_city = [b for b in candidates if user_city and _city_str(b.city) == user_city]
                pick = (same_city or candidates)[0] if (same_city or candidates) else None
                if pick:
                    display_city = _city_display(_city_str(pick.city) or user_city)
                    bio_snippet = (pick.description or f"Entertainment hub in {display_city}.")[:90].strip()
                    if len(pick.description or "") > 90:
                        bio_snippet += "..."
                    copy = generate_agent_copy(
                        "business_spotlight",
                        {
                            "business_name": pick.business_name,
                            "city": display_city,
                            "bio_snippet": bio_snippet,
                        },
                        used_angles=used_angles,
                        language=getattr(user, "preferred_language", "en"),
                        seed=user.id + pick.id,
                    )
                    slug_or_id = pick.slug or pick.user_id or pick.id
                    chosen_draft = _persist_and_maybe_queue_draft(
                        db,
                        cfg,
                        user,
                        angle_key=copy["angle_key"],
                        entity_type="business",
                        entity_id=pick.id,
                        idempotency_key=f"spotlight_biz_{pick.id}_{week_tag}_u_{user.id}",
                        title=copy["title"],
                        message=copy["message"],
                        action_url=f"/business/{slug_or_id}",
                        reasoning=f"Spotlighting organizer/venue '{pick.business_name}' in {display_city}; scheduled {local_hour:02d}:00 local.",
                        generated_by=copy["generated_by"],
                        scheduled_for_utc=sched_utc,
                        local_send_hour=local_hour,
                        category="recommendations",
                    )
                    break

        if chosen_draft:
            drafted += 1

    summary = {
        "status": "ok",
        "mode": cfg.mode,
        "pool_sizes": {
            "artists": len(spotlight_artists),
            "vendors": len(vendors),
            "businesses": len(spotlight_businesses),
        },
        "drafted": drafted,
    }
    cfg.last_run_at = now
    cfg.last_run_summary = summary
    db.commit()
    return {"agent": "talent_spotlight", **summary}


# ---------------------------------------------------------------------------
# AGENT 3: Provider Activation Coach (Artists, Businesses/Organizers, Vendors)
# ---------------------------------------------------------------------------

def audit_provider_completeness(db: Session, user: User) -> Optional[Dict[str, Any]]:
    """
    Audits a provider account (artist/dj, business/organizer, vendor) and returns
    completion percentage, exact missing items, and direct CTA route.
    Returns None if user is a regular fan/admin or already 100% activated.
    """
    role = _role_str(user)
    if role in ("artist", "dj"):
        ap = db.query(ArtistProfile).filter(ArtistProfile.user_id == user.id).first()
        checks: List[Tuple[bool, str, str]] = [
            (bool(user.avatar_url), "profile photo", "/profile/edit"),
            (bool(ap and (ap.bio or user.bio)), "artist bio", "/profile/edit"),
            (bool(ap and ap.genre), "music genre", "/profile/edit"),
            (bool((ap and ap.city) or user.preferred_city), "city", "/profile/edit"),
            (
                bool(ap and (ap.dj_mix_url or ap.dance_video_url or ap.spotify_url or ap.soundcloud_url or ap.youtube_url)),
                "a mix or portfolio link",
                "/profile/edit",
            ),
        ]
        missing = [(label, path) for ok, label, path in checks if not ok]
        if not missing:
            return None
        pct = int(round(((len(checks) - len(missing)) / len(checks)) * 100))
        return {
            "provider_kind": "artist",
            "display_name": (ap.stage_name if ap and ap.stage_name else user.first_name or "your Artist profile"),
            "city": _city_display(_city_str((ap.city if ap else None) or user.preferred_city)),
            "completion_pct": pct,
            "missing_items": [m[0] for m in missing],
            "action_url": missing[0][1],
        }

    if role in ("business", "organizer"):
        bp = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()
        op = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == user.id).first()
        events_count = (
            db.query(func.count(Event.id))
            .filter(Event.organizer_id == (op.id if op else -1))
            .scalar()
            or 0
        )
        # Fallback check by organizer user_id if events linked directly
        if events_count == 0 and bp and (bp.events_count or 0) > 0:
            events_count = bp.events_count

        checks = [
            (bool(user.avatar_url), "logo/photo", "/profile/edit"),
            (bool((bp and bp.description) or (op and op.description) or user.bio), "business description", "/dashboard/business/profile"),
            (bool((bp and bp.city) or (op and op.city) or user.preferred_city), "city", "/dashboard/business/profile"),
            (events_count > 0, "your first event", "/dashboard/business/create-event"),
        ]
        missing = [(label, path) for ok, label, path in checks if not ok]
        if not missing:
            return None
        pct = int(round(((len(checks) - len(missing)) / len(checks)) * 100))
        # Prioritize creating first event CTA when profile basics exist
        cta_path = "/dashboard/business/create-event" if events_count == 0 and len(missing) <= 2 else missing[0][1]
        return {
            "provider_kind": "business",
            "display_name": (
                (bp.business_name if bp and bp.business_name else None)
                or (op.organization_name if op and op.organization_name else None)
                or user.first_name
                or "your Business"
            ),
            "city": _city_display(_city_str((bp.city if bp else None) or (op.city if op else None) or user.preferred_city)),
            "completion_pct": pct,
            "missing_items": [m[0] for m in missing],
            "action_url": cta_path,
        }

    if role == "vendor":
        vp = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
        products_count = (
            db.query(func.count(Product.id))
            .filter(Product.vendor_id == (vp.id if vp else -1))
            .scalar()
            or 0
        )
        checks = [
            (bool((vp and vp.logo_url) or user.avatar_url), "store logo", "/dashboard/vendor/profile"),
            (bool((vp and vp.description) or user.bio), "store description", "/dashboard/vendor/profile"),
            (bool((vp and vp.city) or user.preferred_city), "city", "/dashboard/vendor/profile"),
            (products_count > 0, "your first products", "/dashboard/vendor/products"),
        ]
        missing = [(label, path) for ok, label, path in checks if not ok]
        if not missing:
            return None
        pct = int(round(((len(checks) - len(missing)) / len(checks)) * 100))
        cta_path = "/dashboard/vendor/products" if products_count == 0 and len(missing) <= 2 else missing[0][1]
        return {
            "provider_kind": "vendor",
            "display_name": (vp.business_name if vp and vp.business_name else user.first_name or "your Vendor store"),
            "city": _city_display(_city_str((vp.city if vp else None) or user.preferred_city)),
            "completion_pct": pct,
            "missing_items": [m[0] for m in missing],
            "action_url": cta_path,
        }

    return None


def run_provider_coach_agent(db: Session, max_users: int = 80) -> Dict[str, Any]:
    configs = ensure_default_agent_configs(db)
    cfg = configs["provider_coach"]
    now = datetime.now(timezone.utc)

    if not cfg.is_enabled:
        return {"agent": "provider_coach", "status": "disabled", "drafted": 0}

    milestones = list((cfg.config or {}).get("milestones_days", [1, 4, 10]))
    provider_roles = [
        UserRole.ARTIST,
        UserRole.BUSINESS,
        UserRole.ORGANIZER,
        UserRole.VENDOR,
    ]
    providers = (
        db.query(User)
        .filter(User.role.in_(provider_roles))
        .order_by(User.id.asc())
        .limit(max_users * 3)
        .all()
    )

    drafted = 0
    already_complete = 0
    by_kind = {"artist": 0, "business": 0, "vendor": 0}

    for user in providers:
        if drafted >= max_users:
            break
        if not _is_user_active(user):
            continue

        audit = audit_provider_completeness(db, user)
        if audit is None:
            already_complete += 1
            continue

        eng_profile = _get_or_create_engagement_profile(db, user.id)
        ok, _ = _can_receive_proactive_agent_message(db, user, cfg, eng_profile)
        if not ok:
            continue

        # Determine which Day 1 / Day 4 / Day 10 coaching milestone applies
        created_at = _as_utc(user.created_at) or (now - timedelta(days=1))
        age_days = max(0.0, (now - created_at).total_seconds() / 86400.0)

        chosen_milestone_idx = None
        chosen_milestone_day = None
        for idx, day_num in enumerate(milestones):
            if age_days >= day_num:
                idem = f"coach_{audit['provider_kind']}_d{day_num}_u_{user.id}"
                exists = (
                    db.query(AgentMessageDraft.id)
                    .filter(AgentMessageDraft.idempotency_key == idem)
                    .first()
                )
                if not exists:
                    chosen_milestone_idx = idx
                    chosen_milestone_day = day_num
                    break

        if chosen_milestone_idx is None:
            continue

        missing_summary = ", ".join(audit["missing_items"][:3])
        sched_utc, local_hour = _compute_target_send_utc(db, user, cfg.default_send_hour, eng_profile)

        copy = generate_agent_copy(
            f"coach_{audit['provider_kind']}",
            {
                "display_name": audit["display_name"],
                "city": audit["city"],
                "completion_pct": audit["completion_pct"],
                "missing_summary": missing_summary,
            },
            language=getattr(user, "preferred_language", "en"),
            milestone_index=chosen_milestone_idx,
        )

        draft = _persist_and_maybe_queue_draft(
            db,
            cfg,
            user,
            angle_key=copy["angle_key"],
            entity_type="profile_coach",
            entity_id=user.id,
            idempotency_key=f"coach_{audit['provider_kind']}_d{chosen_milestone_day}_u_{user.id}",
            title=copy["title"],
            message=copy["message"],
            action_url=audit["action_url"],
            reasoning=(
                f"{audit['provider_kind'].title()} profile is {audit['completion_pct']}% complete "
                f"(missing: {missing_summary}). Day {chosen_milestone_day} onboarding nudge."
            ),
            generated_by=copy["generated_by"],
            scheduled_for_utc=sched_utc,
            local_send_hour=local_hour,
            category="recommendations",
        )
        if draft:
            drafted += 1
            by_kind[audit["provider_kind"]] = by_kind.get(audit["provider_kind"], 0) + 1

    summary = {
        "status": "ok",
        "mode": cfg.mode,
        "drafted": drafted,
        "by_role": by_kind,
        "already_complete_skipped": already_complete,
    }
    cfg.last_run_at = now
    cfg.last_run_summary = summary
    db.commit()
    return {"agent": "provider_coach", **summary}


# ---------------------------------------------------------------------------
# AGENT 4: Click-Learning & Timing Optimizer
# ---------------------------------------------------------------------------

def record_agent_interaction(
    db: Session,
    user_id: int,
    *,
    draft_id: Optional[int] = None,
    in_app_notification_id: Optional[int] = None,
    event: str = "clicked",  # "opened" | "clicked"
) -> Optional[AgentMessageDraft]:
    """
    Records an open or click on an agent-generated notification and updates
    the user's learned click hour, topic preferences, and fatigue counter.
    """
    now = datetime.now(timezone.utc)
    draft: Optional[AgentMessageDraft] = None

    if draft_id:
        draft = db.query(AgentMessageDraft).filter(AgentMessageDraft.id == draft_id).first()
    elif in_app_notification_id:
        draft = (
            db.query(AgentMessageDraft)
            .filter(AgentMessageDraft.in_app_notification_id == in_app_notification_id)
            .first()
        )
        if not draft:
            # Fallback: inspect Notification.data.agent_draft_id
            notif = db.query(Notification).filter(Notification.id == in_app_notification_id).first()
            if notif and isinstance(notif.data, dict) and notif.data.get("agent_draft_id"):
                draft = (
                    db.query(AgentMessageDraft)
                    .filter(AgentMessageDraft.id == int(notif.data["agent_draft_id"]))
                    .first()
                )

    if not draft or draft.user_id != user_id:
        return None

    changed_open = False
    changed_click = False
    if not draft.opened_at:
        draft.opened_at = now
        changed_open = True
    if event == "clicked" and not draft.clicked_at:
        draft.clicked_at = now
        changed_click = True
    draft.status = "clicked" if draft.clicked_at else "opened"

    eng = _get_or_create_engagement_profile(db, user_id)
    if changed_open:
        eng.total_opened = (eng.total_opened or 0) + 1
    if changed_click:
        eng.total_clicked = (eng.total_clicked or 0) + 1
        eng.last_clicked_at = now

    # Engagement resets fatigue throttling immediately
    eng.consecutive_ignored = 0
    eng.throttled_until = None

    # Update topic affinity score
    topic_map = {
        "event": "events",
        "seasonal": "events",
        "artist": "artist",
        "vendor": "vendor",
        "business": "business",
    }
    topic = topic_map.get(draft.entity_type or "")
    if topic:
        topics = dict(eng.preferred_topics or {})
        boost = 2.0 if changed_click else 0.75
        topics[topic] = round(float(topics.get(topic, 0.0)) + boost, 2)
        eng.preferred_topics = topics
        if topic in (eng.suppressed_topics or []):
            eng.suppressed_topics = [t for t in eng.suppressed_topics if t != topic]

    # Learn preferred local send hour once user has >= 3 opens/clicks
    if (eng.total_clicked or 0) + (eng.total_opened or 0) >= 3:
        user = db.query(User).filter(User.id == user_id).first()
        tz_str = validate_iana_timezone(getattr(user, "timezone", None) or DEFAULT_TIMEZONE)
        recent_engagements = (
            db.query(AgentMessageDraft.clicked_at, AgentMessageDraft.opened_at)
            .filter(
                AgentMessageDraft.user_id == user_id,
                (AgentMessageDraft.clicked_at.isnot(None)) | (AgentMessageDraft.opened_at.isnot(None)),
            )
            .order_by(desc(AgentMessageDraft.created_at))
            .limit(20)
            .all()
        )
        hour_votes: Dict[int, int] = {}
        for c_dt, o_dt in recent_engagements:
            dt = c_dt or o_dt
            if dt:
                h = utc_to_local(_as_utc(dt), tz_str).hour
                h_clamped = max(8, min(21, h))
                hour_votes[h_clamped] = hour_votes.get(h_clamped, 0) + (2 if c_dt else 1)
        if hour_votes:
            eng.learned_send_hour = max(hour_votes.items(), key=lambda kv: kv[1])[0]

    db.commit()
    db.refresh(draft)
    return draft


def run_click_optimizer_agent(db: Session) -> Dict[str, Any]:
    """
    Syncs delivery telemetry from sent AgentMessageDrafts, updates fatigue counters,
    suppresses repeatedly ignored topics, and throttles unresponsive users for 14 days.
    """
    configs = ensure_default_agent_configs(db)
    cfg = configs["click_optimizer"]
    now = datetime.now(timezone.utc)

    if not cfg.is_enabled:
        return {"agent": "click_optimizer", "status": "disabled"}

    ignore_threshold = int((cfg.config or {}).get("ignore_throttle_threshold", 3))
    throttle_days = int((cfg.config or {}).get("throttle_days", 14))
    stale_cutoff = now - timedelta(hours=48)

    # Find users who have sent drafts in the last 30 days
    month_ago = now - timedelta(days=30)
    user_ids = [
        r[0]
        for r in db.query(AgentMessageDraft.user_id)
        .filter(
            AgentMessageDraft.status.in_(["sent", "opened", "clicked"]),
            AgentMessageDraft.sent_at >= month_ago,
        )
        .distinct()
        .all()
    ]

    throttled_count = 0
    evaluated_users = 0

    for uid in user_ids:
        evaluated_users += 1
        eng = _get_or_create_engagement_profile(db, uid)
        recent = (
            db.query(AgentMessageDraft)
            .filter(
                AgentMessageDraft.user_id == uid,
                AgentMessageDraft.status.in_(["sent", "opened", "clicked"]),
                AgentMessageDraft.sent_at.isnot(None),
            )
            .order_by(desc(AgentMessageDraft.sent_at))
            .limit(10)
            .all()
        )

        # Count consecutive ignored (sent > 48h ago with no open/click)
        consec = 0
        topic_ignores: Dict[str, int] = {}
        for d in recent:
            if d.clicked_at or d.opened_at:
                break
            sent_dt = _as_utc(d.sent_at)
            if sent_dt and sent_dt <= stale_cutoff:
                consec += 1
                if d.entity_type in ("artist", "vendor", "business"):
                    topic_ignores[d.entity_type] = topic_ignores.get(d.entity_type, 0) + 1

        eng.consecutive_ignored = consec
        if consec >= ignore_threshold:
            if not eng.throttled_until or _as_utc(eng.throttled_until) < now:
                eng.throttled_until = now + timedelta(days=throttle_days)
                throttled_count += 1

        suppressed = set(eng.suppressed_topics or [])
        for t_key, cnt in topic_ignores.items():
            if cnt >= ignore_threshold:
                suppressed.add(t_key)
        eng.suppressed_topics = sorted(suppressed)

    summary = {
        "status": "ok",
        "evaluated_users": evaluated_users,
        "newly_throttled_users": throttled_count,
    }
    cfg.last_run_at = now
    cfg.last_run_summary = summary
    db.commit()
    return {"agent": "click_optimizer", **summary}


# ---------------------------------------------------------------------------
# Master Cycle & Admin Mission Control Helpers
# ---------------------------------------------------------------------------

def run_autonomous_agents_cycle(db: Session, agent_key: Optional[str] = None) -> Dict[str, Any]:
    """Runs all 4 autonomous agents (or one specific agent)."""
    ensure_default_agent_configs(db)
    results: Dict[str, Any] = {}

    order = (
        [agent_key]
        if agent_key
        else ["click_optimizer", "event_radar", "talent_spotlight", "provider_coach"]
    )

    for key in order:
        try:
            if key == "click_optimizer":
                results[key] = run_click_optimizer_agent(db)
            elif key == "event_radar":
                results[key] = run_event_radar_agent(db)
            elif key == "talent_spotlight":
                results[key] = run_talent_spotlight_agent(db)
            elif key == "provider_coach":
                results[key] = run_provider_coach_agent(db)
        except Exception as exc:
            logger.exception(f"Agent '{key}' failed: {exc}")
            results[key] = {"agent": key, "status": "error", "error": str(exc)[:200]}

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "copywriter": get_active_copywriter_status(),
        "agents": results,
    }


def approve_and_dispatch_draft(db: Session, draft_id: int, immediate: bool = True) -> Dict[str, Any]:
    """Approves a Preview draft and sends it via the live delivery pipeline."""
    draft = db.query(AgentMessageDraft).filter(AgentMessageDraft.id == draft_id).first()
    if not draft:
        raise ValueError(f"Draft #{draft_id} not found")
    if draft.status not in ("draft", "rejected"):
        raise ValueError(f"Draft #{draft_id} is already '{draft.status}'")

    category = "events" if draft.agent_key == "event_radar" else "recommendations"
    sched = _enqueue_draft_to_scheduled_notification(db, draft, category=category, immediate=immediate)
    db.commit()

    delivered_now = False
    if immediate:
        from services.notification_worker import process_single_scheduled_notification
        delivered_now = process_single_scheduled_notification(db, sched)
        db.refresh(draft)

    return {
        "draft_id": draft.id,
        "status": draft.status,
        "scheduled_notification_id": sched.id,
        "delivered_now": delivered_now,
    }


def reject_draft(db: Session, draft_id: int) -> Dict[str, Any]:
    draft = db.query(AgentMessageDraft).filter(AgentMessageDraft.id == draft_id).first()
    if not draft:
        raise ValueError(f"Draft #{draft_id} not found")
    draft.status = "rejected"
    db.commit()
    return {"draft_id": draft.id, "status": "rejected"}


def get_agents_mission_control_overview(db: Session) -> Dict[str, Any]:
    """Aggregates live inventory health, agent configs, and click-through metrics for Admin."""
    configs = ensure_default_agent_configs(db)
    now = datetime.now(timezone.utc)

    # Live platform supply inventory (explains silence vs active sending!)
    upcoming_events_count = (
        db.query(func.count(Event.id))
        .filter(Event.status == EventStatus.APPROVED, Event.start_date > now)
        .scalar()
        or 0
    )
    spotlight_artists_count = (
        db.query(func.count(ArtistProfile.id))
        .filter(ArtistProfile.is_approved == True)
        .scalar()
        or 0
    )
    active_vendors_with_products = (
        db.query(func.count(func.distinct(Product.vendor_id)))
        .filter(Product.status == "active")
        .scalar()
        or 0
    )

    # Count incomplete providers waiting for coaching
    provider_users = (
        db.query(User)
        .filter(
            User.role.in_([UserRole.ARTIST, UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.VENDOR])
        )
        .limit(300)
        .all()
    )
    incomplete_providers = {"artist": 0, "business": 0, "vendor": 0}
    for pu in provider_users:
        if not _is_user_active(pu):
            continue
        audit = audit_provider_completeness(db, pu)
        if audit:
            incomplete_providers[audit["provider_kind"]] += 1

    # Aggregate draft & CTR metrics per agent
    agents_payload = []
    total_sent_all = 0
    total_opened_all = 0
    total_clicked_all = 0
    total_preview_drafts = 0

    for spec in DEFAULT_AGENT_SPECS:
        key = spec["agent_key"]
        cfg = configs[key]

        preview_count = (
            db.query(func.count(AgentMessageDraft.id))
            .filter(AgentMessageDraft.agent_key == key, AgentMessageDraft.status == "draft")
            .scalar()
            or 0
        )
        sent_count = (
            db.query(func.count(AgentMessageDraft.id))
            .filter(AgentMessageDraft.agent_key == key, AgentMessageDraft.status.in_(["sent", "opened", "clicked"]))
            .scalar()
            or 0
        )
        opened_count = (
            db.query(func.count(AgentMessageDraft.id))
            .filter(AgentMessageDraft.agent_key == key, AgentMessageDraft.opened_at.isnot(None))
            .scalar()
            or 0
        )
        clicked_count = (
            db.query(func.count(AgentMessageDraft.id))
            .filter(AgentMessageDraft.agent_key == key, AgentMessageDraft.clicked_at.isnot(None))
            .scalar()
            or 0
        )

        total_preview_drafts += preview_count
        total_sent_all += sent_count
        total_opened_all += opened_count
        total_clicked_all += clicked_count

        ctr = round((clicked_count / sent_count) * 100, 1) if sent_count > 0 else 0.0
        open_rate = round((opened_count / sent_count) * 100, 1) if sent_count > 0 else 0.0

        agents_payload.append({
            "agent_key": cfg.agent_key,
            "name": cfg.name,
            "description": cfg.description,
            "is_enabled": cfg.is_enabled,
            "mode": cfg.mode,
            "default_send_hour": cfg.default_send_hour,
            "max_per_week": cfg.max_per_week,
            "cooldown_days": cfg.cooldown_days,
            "channels": cfg.channels or [],
            "last_run_at": cfg.last_run_at.isoformat() if cfg.last_run_at else None,
            "last_run_summary": cfg.last_run_summary,
            "metrics": {
                "preview_drafts": preview_count,
                "sent": sent_count,
                "opened": opened_count,
                "clicked": clicked_count,
                "open_rate_pct": open_rate,
                "ctr_pct": ctr,
            },
        })

    # Determine global sending mode (all 3 messaging agents)
    msg_modes = {configs[k].mode for k in ("event_radar", "talent_spotlight", "provider_coach")}
    global_mode = "autopilot" if msg_modes == {"autopilot"} else ("preview" if msg_modes == {"preview"} else "mixed")

    throttled_users = (
        db.query(func.count(UserEngagementProfile.id))
        .filter(UserEngagementProfile.throttled_until > now)
        .scalar()
        or 0
    )
    learned_timing_users = (
        db.query(func.count(UserEngagementProfile.id))
        .filter(UserEngagementProfile.learned_send_hour.isnot(None))
        .scalar()
        or 0
    )

    return {
        "global_mode": global_mode,
        "copywriter": get_active_copywriter_status(),
        "inventory_health": {
            "upcoming_approved_events": upcoming_events_count,
            "event_radar_silence_active": upcoming_events_count == 0,
            "spotlight_ready_artists": spotlight_artists_count,
            "spotlight_ready_vendors": active_vendors_with_products,
            "incomplete_providers": incomplete_providers,
            "total_incomplete_providers": sum(incomplete_providers.values()),
        },
        "telemetry": {
            "pending_preview_drafts": total_preview_drafts,
            "total_sent": total_sent_all,
            "total_opened": total_opened_all,
            "total_clicked": total_clicked_all,
            "overall_ctr_pct": round((total_clicked_all / total_sent_all) * 100, 1) if total_sent_all > 0 else 0.0,
            "overall_open_rate_pct": round((total_opened_all / total_sent_all) * 100, 1) if total_sent_all > 0 else 0.0,
            "learned_timing_users": learned_timing_users,
            "auto_throttled_users": throttled_users,
        },
        "agents": agents_payload,
    }
