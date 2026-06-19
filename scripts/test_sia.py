"""Quick smoke test for SIA endpoints."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User, BusinessProfile, OrganizerProfile

client = TestClient(app)


def get_token(user_id: int) -> str:
    from auth import REDACTED_PLACEHOLDER as create_access_token
    return create_access_token({"sub": str(user_id)})


def test_config():
    r = client.get("/api/v1/assistant/config")
    assert r.status_code == 200
    print("config:", r.json())


def test_chat(user_id: int):
    token = get_token(user_id)
    r = client.post(
        "/api/v1/assistant/chat",
        json={"message": "How do I create an event?"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    data = r.json()
    print("chat:", data["message"][:100], "...")
    return data["session_id"]


def test_extract_event_text(user_id: int):
    token = get_token(user_id)
    text = """
    SUMMER VIBES PARTY
    Saturday, June 28, 2026
    22:00 - Late
    Venue: The Roof Shanghai
    Lineup: DJ Afro, MC Blaze
    Tickets: ¥120
    """
    r = client.post(
        "/api/v1/assistant/extract-event",
        data={"text": text},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    data = r.json()
    print("extract-event:", data["draft"]["title"], "confidence:", data["confidence"])
    return data["draft_id"]


def test_extract_products_text(user_id: int):
    token = get_token(user_id)
    text = """
    Cocktails
    Mojito - ¥45
    Margarita - ¥50
    Long Island - ¥60
    """
    r = client.post(
        "/api/v1/assistant/extract-products",
        data={"text": text},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    data = r.json()
    print("extract-products:", data["count"], "products")
    return data["draft_id"]


def test_drafts(user_id: int):
    token = get_token(user_id)
    r = client.get("/api/v1/assistant/drafts", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    print("drafts:", len(r.json()["drafts"]))


def setup_business_profile(user_id: int):
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError("User not found")
        if not user.business_profile:
            bp = BusinessProfile(user_id=user_id, business_name="SIA Test Biz", business_type="organizer")
            db.add(bp)
            db.commit()
            db.refresh(bp)
            org = OrganizerProfile(user_id=user_id, business_profile_id=bp.id, organization_name=bp.business_name)
            db.add(org)
            db.commit()
            print("created business profile")
        else:
            print("business profile exists")


if __name__ == "__main__":
    user_id = 7
    setup_business_profile(user_id)
    test_config()
    test_chat(user_id)
    event_draft_id = test_extract_event_text(user_id)
    product_draft_id = test_extract_products_text(user_id)
    test_drafts(user_id)
    print("All SIA smoke tests passed.")
