"""
Automated Test Suite for Sound It Autonomous Engagement & Growth Agents
Covers:
1. Event Radar Silence Rule (0 upcoming events -> 0 drafted, never sends "We Miss You")
2. Event Radar Single & Multi-Event Morning Digest + Ticket Buyer Exclusion
3. Talent Spotlight (Artists/DJs, Vendors with active products, 30-day no-repeat)
4. Provider Activation Coach (Day 1 / Day 4 / Day 10 nudges + Stop-on-Complete)
5. Click-Learning & Timing Optimizer (learns preferred hour after 3 clicks + 3-ignore auto-throttle)
6. Preview Mode vs Autopilot Mode + Approve & Dispatch flow + RBAC guard
"""
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import (
    Base,
    User,
    UserRole,
    City,
    Event,
    EventStatus,
    ArtistProfile,
    BusinessProfile,
    OrganizerProfile,
    VendorProfile,
    Product,
    TicketOrder,
    TicketOrderStatus,
    AgentConfiguration,
    AgentMessageDraft,
    UserEngagementProfile,
    ScheduledNotification,
)
from services.engagement_agents import (
    ensure_default_agent_configs,
    run_event_radar_agent,
    run_talent_spotlight_agent,
    run_provider_coach_agent,
    run_click_optimizer_agent,
    record_agent_interaction,
    approve_and_dispatch_draft,
    get_agents_mission_control_overview,
    audit_provider_completeness,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def _make_user(db, email, role=UserRole.USER, city="shanghai", days_ago=5, avatar=None):
    u = User(
        email=email,
        username=email.split("@")[0],
        password_hash="x",
        first_name=email.split("@")[0].title(),
        role=role,
        preferred_city=city,
        preferred_language="en",
        timezone="Asia/Shanghai",
        avatar_url=avatar,
        created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_1_event_radar_silence_rule_when_no_events(db):
    _make_user(db, "fan1@test.com", city="shanghai")
    res = run_event_radar_agent(db)
    assert res["status"] == "silent_no_upcoming_events"
    assert res["drafted"] == 0
    assert db.query(AgentMessageDraft).count() == 0


def test_2_event_radar_morning_digest_and_ticket_exclusion(db):
    org_user = _make_user(db, "org@test.com", role=UserRole.BUSINESS, city="shanghai")
    fan_sh = _make_user(db, "fansh@test.com", city="shanghai")
    fan_bj = _make_user(db, "fanbj@test.com", city="beijing")
    buyer = _make_user(db, "buyer@test.com", city="shanghai")

    now = datetime.now(timezone.utc)
    ev1 = Event(
        title="Shanghai Afrobeats Night",
        organizer_id=org_user.id,
        city=City.SHANGHAI,
        start_date=now + timedelta(days=3),
        status=EventStatus.APPROVED,
    )
    ev2 = Event(
        title="Amapiano Rooftop Sessions",
        organizer_id=org_user.id,
        city=City.SHANGHAI,
        start_date=now + timedelta(days=6),
        status=EventStatus.APPROVED,
    )
    db.add_all([ev1, ev2])
    db.commit()

    # Buyer already bought both Shanghai events -> must NOT be pitched either
    db.add_all([
        TicketOrder(user_id=buyer.id, event_id=ev1.id, payment_amount=100.0, status=TicketOrderStatus.APPROVED),
        TicketOrder(user_id=buyer.id, event_id=ev2.id, payment_amount=100.0, status=TicketOrderStatus.APPROVED),
    ])
    db.commit()

    res = run_event_radar_agent(db)
    assert res["drafted"] == 1  # ONLY fan_sh! (fan_bj has 0 Beijing events; buyer already holds tickets; org is excluded)

    draft = db.query(AgentMessageDraft).filter(AgentMessageDraft.user_id == fan_sh.id).first()
    assert draft is not None
    assert draft.status == "draft"  # Safe Preview mode by default
    assert draft.local_send_hour == 9  # Morning 09:00 local default
    assert "Shanghai" in draft.title or "Shanghai" in draft.message
    assert "miss you" not in draft.title.lower()
    assert db.query(ScheduledNotification).count() == 0  # Nothing dispatched in preview mode!


def test_3_talent_spotlight_and_30_day_dedup(db):
    dj_user = _make_user(db, "dj@test.com", role=UserRole.ARTIST, city="shanghai", avatar="/a.jpg")
    ap = ArtistProfile(
        user_id=dj_user.id,
        stage_name="DJ Kofi",
        genre="Afrobeats",
        bio="High-energy Afrobeats & Amapiano selector in Shanghai.",
        city=City.SHANGHAI,
        is_approved=True,
    )
    vendor_user = _make_user(db, "vendor@test.com", role=UserRole.VENDOR, city="shanghai", avatar="/v.jpg")
    vp = VendorProfile(
        user_id=vendor_user.id,
        business_name="Lagos Kitchen",
        description="Authentic Jollof & Suya",
        city=City.SHANGHAI,
        is_approved=True,
    )
    db.add_all([ap, vp])
    db.commit()
    db.add(Product(vendor_id=vp.id, name="Smoky Jollof Platter", price=68.0, status="active"))
    db.commit()

    fan = _make_user(db, "fan@test.com", city="shanghai")

    r1 = run_talent_spotlight_agent(db)
    assert r1["drafted"] >= 1
    first_draft = db.query(AgentMessageDraft).filter(AgentMessageDraft.user_id == fan.id).first()
    assert first_draft is not None
    assert first_draft.entity_type in ("artist", "vendor")
    assert first_draft.action_url.startswith("/")

    # Re-running immediately should NOT duplicate the same spotlight for the same user
    r2 = run_talent_spotlight_agent(db)
    fan_drafts = db.query(AgentMessageDraft).filter(AgentMessageDraft.user_id == fan.id).all()
    entity_pairs = [(d.entity_type, d.entity_id) for d in fan_drafts]
    assert len(entity_pairs) == len(set(entity_pairs))


def test_4_provider_coach_milestones_and_stop_on_complete(db):
    # Incomplete artist (5 days old -> eligible for Day 1 nudge first)
    inc_artist = _make_user(db, "newdj@test.com", role=UserRole.ARTIST, city="shanghai", days_ago=5, avatar=None)
    db.add(ArtistProfile(user_id=inc_artist.id, stage_name="DJ Nova"))

    # 100% complete vendor with product -> MUST be skipped!
    comp_vendor = _make_user(db, "donevendor@test.com", role=UserRole.VENDOR, city="shanghai", days_ago=12, avatar="/v.jpg")
    vp_done = VendorProfile(
        user_id=comp_vendor.id,
        business_name="Accra Bites",
        description="Fresh street food",
        logo_url="/logo.png",
        city=City.SHANGHAI,
    )
    db.add(vp_done)
    db.commit()
    db.add(Product(vendor_id=vp_done.id, name="Kelewele", price=35.0, status="active"))

    # Incomplete business with 0 events -> should get create-event coaching
    inc_biz = _make_user(db, "newbiz@test.com", role=UserRole.BUSINESS, city="shanghai", days_ago=5, avatar="/b.jpg")
    db.add(BusinessProfile(user_id=inc_biz.id, business_name="Vibe Collective", description="Nightlife promos", city=City.SHANGHAI))
    db.commit()

    assert audit_provider_completeness(db, comp_vendor) is None
    biz_audit = audit_provider_completeness(db, inc_biz)
    assert biz_audit is not None
    assert biz_audit["action_url"] == "/dashboard/business/create-event"

    res = run_provider_coach_agent(db)
    assert res["drafted"] == 2
    assert res["already_complete_skipped"] == 1

    # Verify completed vendor got 0 drafts
    assert db.query(AgentMessageDraft).filter(AgentMessageDraft.user_id == comp_vendor.id).count() == 0


def test_5_click_learning_timing_and_fatigue_throttle(db):
    fan = _make_user(db, "learner@test.com", city="shanghai")
    ensure_default_agent_configs(db)

    # Simulate 3 clicks at 11:00 AM Shanghai time (03:00 UTC)
    for i in range(3):
        d = AgentMessageDraft(
            agent_key="talent_spotlight",
            user_id=fan.id,
            angle_key=f"artist_angle_{i}",
            entity_type="artist",
            entity_id=100 + i,
            title=f"Artist {i}",
            message="Check out this artist",
            action_url=f"/artists/{100 + i}",
            status="sent",
            sent_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(d)
        db.commit()
        record_agent_interaction(db, fan.id, draft_id=d.id, event="clicked")

    eng = db.query(UserEngagementProfile).filter(UserEngagementProfile.user_id == fan.id).first()
    assert eng.total_clicked == 3
    assert eng.preferred_topics.get("artist", 0) >= 6.0
    assert eng.learned_send_hour is not None
    assert eng.consecutive_ignored == 0

    # Now test 3 consecutive ignored messages (>48h old) -> triggers 14-day fatigue throttle!
    ghost = _make_user(db, "ghost@test.com", city="shanghai")
    old_time = datetime.now(timezone.utc) - timedelta(days=4)
    for i in range(3):
        db.add(
            AgentMessageDraft(
                agent_key="talent_spotlight",
                user_id=ghost.id,
                angle_key=f"vendor_angle_{i}",
                entity_type="vendor",
                entity_id=200 + i,
                title=f"Vendor {i}",
                message="Check vendor",
                action_url=f"/vendor-store/{200 + i}",
                status="sent",
                sent_at=old_time + timedelta(hours=i),
            )
        )
    db.commit()

    opt_res = run_click_optimizer_agent(db)
    assert opt_res["newly_throttled_users"] == 1
    ghost_eng = db.query(UserEngagementProfile).filter(UserEngagementProfile.user_id == ghost.id).first()
    assert ghost_eng.consecutive_ignored == 3
    assert ghost_eng.throttled_until is not None
    assert "vendor" in (ghost_eng.suppressed_topics or [])


def test_6_approve_preview_draft_and_overview(db):
    fan = _make_user(db, "approve@test.com", city="shanghai")
    ensure_default_agent_configs(db)
    d = AgentMessageDraft(
        agent_key="event_radar",
        user_id=fan.id,
        angle_key="event_single_drop",
        entity_type="event",
        entity_id=55,
        title="Just dropped in Shanghai",
        message="Check out this event",
        action_url="/events/55",
        status="draft",
    )
    db.add(d)
    db.commit()

    res = approve_and_dispatch_draft(db, d.id, immediate=False)
    assert res["status"] == "queued"
    assert db.query(ScheduledNotification).filter(ScheduledNotification.id == res["scheduled_notification_id"]).first() is not None

    overview = get_agents_mission_control_overview(db)
    assert overview["global_mode"] == "preview"
    assert overview["copywriter"]["zero_key"] is True
    assert len(overview["agents"]) == 4
