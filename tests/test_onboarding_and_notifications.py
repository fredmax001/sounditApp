"""
End-to-End & Security Verification Suite:
1. Mobile-Only First-Time Onboarding Persistence, Eligibility & Role Checklists
2. Cross-Platform Push Delivery (iOS APNs, Android FCM, Web/PWA VAPID)
3. Notification Deduplication, Preferences, Mandatory Security Alerts & IDOR Prevention
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app
from models import (
    User,
    UserRole,
    UserInterest,
    ArtistProfile,
    BusinessProfile,
    OrganizerProfile,
    Event,
    EventStatus,
    Notification,
    NotificationPreference,
    NativePushToken,
    PushSubscription,
)
from auth import create_access_token
from api.notifications import create_notification
from services.push_service import PushService


@pytest.fixture()
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield db
    finally:
        app.dependency_overrides.clear()
        db.close()


@pytest.fixture()
def client(test_db):
    return TestClient(app)


def _make_user(db, email: str, role: UserRole = UserRole.USER, age_minutes: int = 1, profile_data=None) -> User:
    u = User(
        email=email,
        first_name="Test",
        last_name="User",
        role=role,
        profile_data=profile_data or {},
        created_at=datetime.now(timezone.utc) - timedelta(minutes=age_minutes),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _auth_headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


# ==================== ONBOARDING TESTS ====================


def test_new_mobile_user_eligible_and_persists_across_reinstall_and_devices(client, test_db):
    user = _make_user(test_db, "new_ios@sounditent.com", UserRole.USER, age_minutes=1)
    headers = _auth_headers(user)

    # 1. Init new user after registration
    r = client.post("/api/v1/onboarding/init-new-user", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["is_first_time_eligible"] is True
    assert body["completed"] is False

    # 2. Save incomplete wizard step + interests + declined permission
    r2 = client.put(
        "/api/v1/onboarding/progress",
        headers=headers,
        json={
            "current_step": 1,
            "preferred_city": "Shanghai",
            "selected_interests": ["afrobeats", "nightlife", "restaurants"],
            "permissions_prompted": {"location": "denied", "notifications": "granted"},
        },
    )
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["current_step"] == 1
    assert set(b2["selected_interests"]) == {"afrobeats", "nightlife", "restaurants"}
    assert b2["permissions_prompted"]["location"] == "denied"
    # Verify real UserInterest rows seeded
    assert test_db.query(UserInterest).filter(UserInterest.user_id == user.id).count() >= 3

    # 3. Complete onboarding -> persists permanently across reinstalls/devices/logins
    r3 = client.post("/api/v1/onboarding/complete", headers=headers, json={"skipped": False})
    assert r3.status_code == 200
    assert r3.json()["completed"] is True
    assert r3.json()["is_first_time_eligible"] is False

    # 4. Calling init-new-user again after logout/login or reinstall never resets completion
    r4 = client.post("/api/v1/onboarding/init-new-user", headers=headers)
    assert r4.status_code == 200
    assert r4.json()["completed"] is True
    assert r4.json()["is_first_time_eligible"] is False


def test_existing_user_never_triggered_for_onboarding(client, test_db):
    existing = _make_user(test_db, "legacy_user@sounditent.com", UserRole.USER, age_minutes=60 * 24 * 30)
    headers = _auth_headers(existing)

    r = client.get("/api/v1/onboarding/state", headers=headers)
    assert r.status_code == 200
    assert r.json()["is_first_time_eligible"] is False

    r2 = client.post("/api/v1/onboarding/init-new-user", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["is_first_time_eligible"] is False


def test_role_specific_checklists_compute_from_real_db_state(client, test_db):
    org_user = _make_user(test_db, "org@sounditent.com", UserRole.BUSINESS, age_minutes=2)
    op = OrganizerProfile(user_id=org_user.id, organization_name="Sound It Club", description="Live nights")
    test_db.add(op)
    test_db.commit()
    test_db.refresh(op)

    ev = Event(
        organizer_id=op.id,
        title="Afro Night Shanghai",
        description="Big show",
        flyer_image="/flyer.jpg",
        ticket_price=100.0,
        status=EventStatus.APPROVED,
        start_date=datetime.now(timezone.utc) + timedelta(days=5),
    )
    test_db.add(ev)
    test_db.commit()

    r = client.get("/api/v1/onboarding/state", headers=_auth_headers(org_user))
    assert r.status_code == 200
    checklist = {item["id"]: item["completed"] for item in r.json()["checklist"]}
    assert checklist["complete_organizer_profile"] is True
    assert checklist["create_first_event"] is True
    assert checklist["configure_event_info"] is True
    assert checklist["publish_first_event"] is True


# ==================== NOTIFICATIONS & CROSS-PLATFORM PUSH TESTS ====================


def test_ios_and_android_native_token_registration_and_cleanup(client, test_db):
    user = _make_user(test_db, "mobile@sounditent.com", UserRole.USER)
    headers = _auth_headers(user)

    # Register iOS APNs token
    r_ios = client.post(
        "/api/v1/notifications/native-token",
        headers=headers,
        json={"token": "ABCDEF1234567890", "platform": "ios", "device_id": "iphone-1"},
    )
    assert r_ios.status_code == 200

    # Register Android FCM token (must preserve case!)
    fcm_tok = "eXyZ_CaseSensitive_FCM_Token_987654321"
    r_and = client.post(
        "/api/v1/notifications/native-token",
        headers=headers,
        json={"token": fcm_tok, "platform": "android", "device_id": "pixel-1"},
    )
    assert r_and.status_code == 200

    saved_and = test_db.query(NativePushToken).filter(NativePushToken.platform == "android").first()
    assert saved_and is not None and saved_and.token == fcm_tok

    # Verify /devices returns both platforms
    devs = client.get("/api/v1/notifications/devices", headers=headers).json()
    assert {d["platform"] for d in devs["native_devices"]} == {"ios", "android"}

    # Deactivate Android token
    r_del = client.delete(f"/api/v1/notifications/native-token?token={fcm_tok}", headers=headers)
    assert r_del.status_code == 200
    test_db.refresh(saved_and)
    assert saved_and.is_active is False


def test_deduplication_and_mandatory_security_alerts(test_db):
    user = _make_user(test_db, "prefs@sounditent.com", UserRole.USER)

    # Mute all optional categories and in_app
    prefs = NotificationPreference(
        user_id=user.id,
        social=False,
        messages=False,
        in_app_enabled=False,
        push_enabled=False,
    )
    test_db.add(prefs)
    test_db.commit()

    # Optional social alert must be dropped
    dropped = create_notification(
        test_db, user.id, "New Like", "Someone liked your post", notification_type="community_like"
    )
    assert dropped is None

    # Security alert MUST bypass user mute preferences
    sec1 = create_notification(
        test_db,
        user.id,
        "New Login Detected",
        "Logged in from iPhone in Shanghai",
        notification_type="security_alert",
        dedupe_key="login-123",
    )
    assert sec1 is not None and sec1.id is not None

    # Duplicate trigger within window returns existing notification (no duplicate row)
    sec2 = create_notification(
        test_db,
        user.id,
        "New Login Detected",
        "Logged in from iPhone in Shanghai",
        notification_type="security_alert",
        dedupe_key="login-123",
    )
    assert sec2.id == sec1.id
    assert test_db.query(Notification).filter(Notification.user_id == user.id).count() == 1


def test_idor_blocked_on_notifications_and_push_unsubscribe(client, test_db):
    alice = _make_user(test_db, "alice@sounditent.com", UserRole.USER)
    bob = _make_user(test_db, "bob@sounditent.com", UserRole.USER)

    notif = create_notification(test_db, alice.id, "Private Alert", "Alice only", notification_type="system_alert")
    sub = PushSubscription(
        user_id=alice.id,
        endpoint="https://fcm.googleapis.com/fcm/send/alice-secret-endpoint",
        p256dh="key1",
        auth="auth1",
        is_active=True,
    )
    test_db.add(sub)
    test_db.commit()

    bob_headers = _auth_headers(bob)

    # Bob cannot inspect, mark read, or delete Alice's notification
    assert client.get(f"/api/v1/notifications/detail/{notif.id}", headers=bob_headers).status_code == 404
    assert client.post(f"/api/v1/notifications/{notif.id}/read", headers=bob_headers).status_code == 404
    assert client.delete(f"/api/v1/notifications/{notif.id}", headers=bob_headers).status_code == 404

    # Bob cannot deactivate Alice's push subscription
    assert (
        client.post(
            "/api/v1/notifications/push-unsubscribe",
            headers=bob_headers,
            json={"endpoint": sub.endpoint},
        ).status_code
        == 404
    )
    test_db.refresh(sub)
    assert sub.is_active is True


def test_expired_apns_and_fcm_tokens_auto_deactivated(test_db):
    user = _make_user(test_db, "delivery@sounditent.com", UserRole.USER)
    ios_tok = NativePushToken(user_id=user.id, token="deadbeef1234", platform="ios", is_active=True)
    and_tok = NativePushToken(user_id=user.id, token="ExpiredAndroidToken", platform="android", is_active=True)
    test_db.add_all([ios_tok, and_tok])
    test_db.commit()

    notif = Notification(user_id=user.id, title="Event Starting", message="Doors open!", type="event_reminder")
    test_db.add(notif)
    test_db.commit()
    test_db.refresh(notif)

    svc = PushService(test_db)

    # Simulate APNs 410 Unregistered response
    mock_apns_resp = MagicMock(status_code=410, text='{"reason":"Unregistered"}')
    mock_fcm_resp = MagicMock(status_code=404, text='{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}')

    with patch("services.push_service.settings") as mock_settings:
        mock_settings.APNS_KEY_ID = "KEY123"
        mock_settings.APNS_TEAM_ID = "TEAM123"
        mock_settings.APNS_BUNDLE_ID = "app.sounditent.com"
        mock_settings.APNS_AUTH_KEY = "fake"
        mock_settings.APNS_USE_SANDBOX = True
        mock_settings.FCM_SERVER_KEY = ""
        mock_settings.FCM_SERVICE_ACCOUNT_JSON = ""

        with patch("jwt.encode", return_value="mock-jwt"), patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__.return_value.post.return_value = mock_apns_resp
            svc._send_apns(notif)

        test_db.refresh(ios_tok)
        assert ios_tok.is_active is False

        with patch.object(svc, "_get_fcm_access_token", return_value=("oauth-tok", "soundit-proj")), patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__.return_value.post.return_value = mock_fcm_resp
            svc._send_fcm(notif)

        test_db.refresh(and_tok)
        assert and_tok.is_active is False
