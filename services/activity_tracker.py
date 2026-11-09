"""
Sound It - User Behaviour Tracking Service
Records meaningful user interactions with weighted importance points,
debouncing duplicate actions and piping events to the User Interest Engine.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import UserActivity
import logging

logger = logging.getLogger("soundit.activity_tracker")

# Initial configurable activity weights
DEFAULT_WEIGHTS: Dict[str, float] = {
    "profile_view": 1.0,
    "artist_view": 1.5,
    "category_search": 2.0,
    "reel_watch": 2.0,
    "reel_like": 3.0,
    "reel_share": 4.0,
    "reel_save": 3.0,
    "community_post_view": 1.0,
    "community_post_like": 3.0,
    "community_post_comment": 4.0,
    "event_collection_view": 1.5,
    "event_view": 1.5,
    "event_save": 5.0,
    "follow": 5.0,
    "unfollow": 0.5,
    "ticket_purchase": 10.0,
    "event_attendance": 12.0,
    "venue_explore": 1.5,
    "friend_invite": 3.0,
    "social_interaction": 2.0,
}

# Category mappings for interest attribution
CATEGORY_KEYWORDS = {
    "afrobeats": ["afrobeats", "amapiano", "afro", "afropop", "boa", "burna", "wizkid"],
    "hip_hop": ["hip-hop", "hiphop", "rap", "trap", "r&b", "rnb", "urban"],
    "djs": ["dj", "deck", "turntable", "mixing", "electronic", "edm", "house", "techno"],
    "live_music": ["live", "band", "concert", "performance", "acoustic", "singer", "artist"],
    "nightlife": ["nightlife", "club", "party", "lounge", "bar", "late night", "after hours"],
    "restaurants": ["restaurant", "food", "dining", "cuisine", "drink", "cocktail", "brunch"],
    "venues": ["venue", "rooftop", "hall", "stadium", "space"],
    "community": ["community", "meetup", "networking", "workshop", "social", "dance"],
}

def detect_categories(text: Optional[str]) -> list[str]:
    """Extract relevant interest categories from title, description, or search query."""
    if not text:
        return []
    text_lower = text.lower()
    matched = []
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            matched.append(cat)
    return matched

def track_activity(
    db: Session,
    user_id: int,
    action_type: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    category: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    weight: Optional[float] = None,
    dedup_window_minutes: int = 5,
) -> Optional[UserActivity]:
    """
    Log a meaningful user interaction with debouncing and interest piping.
    """
    if not user_id:
        return None

    meta = dict(metadata or {})
    if category:
        meta["category"] = category

    now = datetime.now(timezone.utc)
    final_weight = weight if weight is not None else DEFAULT_WEIGHTS.get(action_type, 1.0)

    # Debounce passive views to avoid excessive DB writes
    if action_type in ("profile_view", "artist_view", "event_view", "reel_watch", "community_post_view"):
        cutoff = now - timedelta(minutes=dedup_window_minutes)
        recent = (
            db.query(UserActivity.id)
            .filter(
                UserActivity.user_id == user_id,
                UserActivity.action_type == action_type,
                UserActivity.entity_type == entity_type,
                UserActivity.entity_id == entity_id,
                UserActivity.created_at >= cutoff,
            )
            .first()
        )
        if recent:
            return None  # Debounced

    activity = UserActivity(
        user_id=user_id,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        weight=final_weight,
        metadata_json=metadata or {},
        created_at=now,
    )
    db.add(activity)

    try:
        db.commit()
        db.refresh(activity)

        # Pipe activity directly to interest engine
        _pipe_to_interest_engine(db, user_id, action_type, entity_type, entity_id, metadata, final_weight)
        return activity
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record activity for user {user_id}: {e}")
        return None

def _pipe_to_interest_engine(
    db: Session,
    user_id: int,
    action_type: str,
    entity_type: Optional[str],
    entity_id: Optional[int],
    metadata: Optional[Dict[str, Any]],
    weight: float,
):
    """Internal helper to infer category and update user interest score."""
    from services.interest_engine import update_user_interest

    categories = []
    meta = metadata or {}

    # Explicit category in metadata
    if "category" in meta and meta["category"]:
        cat = str(meta["category"]).lower()
        if cat in CATEGORY_KEYWORDS:
            categories.append(cat)

    # Category from query or text
    if "query" in meta:
        categories.extend(detect_categories(meta["query"]))
    if "title" in meta:
        categories.extend(detect_categories(meta["title"]))
    if "tags" in meta and isinstance(meta["tags"], list):
        for tag in meta["tags"]:
            categories.extend(detect_categories(str(tag)))

    # Inferred categories from action / entity type
    if action_type in ("reel_watch", "reel_like", "reel_share"):
        categories.append("djs")
        categories.append("nightlife")
    elif action_type in ("ticket_purchase", "event_save", "event_view", "event_attendance"):
        categories.append("events")
        categories.append("nightlife")
    elif action_type in ("artist_view", "follow"):
        categories.append("artists")
        categories.append("live_music")
    elif action_type in ("community_post_view", "community_post_like", "community_post_comment"):
        categories.append("community")

    # Update each unique category score
    for cat in set(categories):
        try:
            update_user_interest(db, user_id, cat, weight)
        except Exception as e:
            logger.warning(f"Could not update interest {cat} for user {user_id}: {e}")

# Alias for compatibility
track_user_activity = track_activity

