"""
Sound It - Dynamic Interest Scoring Engine
Calculates user interest affinities with exponential recency decay
across Afrobeats, Hip-hop, DJs, Live music, Nightlife, Artists, Events, and Venues.
"""
import math
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import UserInterest, Event, ArtistProfile
import logging

logger = logging.getLogger("soundit.interest_engine")

# 21-day half life decay constant: lambda = ln(2) / 21 =~ 0.033007
HALF_LIFE_DAYS = 21.0
DECAY_LAMBDA = math.log(2.0) / HALF_LIFE_DAYS

VALID_CATEGORIES = [
    "afrobeats",
    "hip_hop",
    "djs",
    "live_music",
    "nightlife",
    "artists",
    "events",
    "restaurants",
    "venues",
    "community",
]

def update_user_interest(
    db: Session,
    user_id: int,
    category: str,
    weight: float,
) -> UserInterest:
    """
    Applies exponential recency decay to existing score and adds new interaction weight.
    """
    cat = category.lower().strip()
    if cat not in VALID_CATEGORIES:
        cat = "events"

    now = datetime.now(timezone.utc)
    record = (
        db.query(UserInterest)
        .filter(UserInterest.user_id == user_id, UserInterest.category == cat)
        .first()
    )

    if record:
        # Calculate days elapsed since last interaction for decay
        last_dt = record.last_interaction_at or record.updated_at or now
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        
        days_elapsed = max(0.0, (now - last_dt).total_seconds() / 86400.0)
        decayed_score = record.score * math.exp(-DECAY_LAMBDA * days_elapsed)

        record.score = round(decayed_score + weight, 3)
        record.interaction_count += 1
        record.last_interaction_at = now
        record.updated_at = now
    else:
        record = UserInterest(
            user_id=user_id,
            category=cat,
            score=round(weight, 3),
            interaction_count=1,
            last_interaction_at=now,
            updated_at=now,
        )
        db.add(record)

    try:
        db.commit()
        db.refresh(record)
        return record
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update interest for user {user_id}, category {category}: {e}")
        raise e

def get_top_user_interests(
    db: Session,
    user_id: int,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Returns user's highest scored interests with decayed values.
    """
    now = datetime.now(timezone.utc)
    records = (
        db.query(UserInterest)
        .filter(UserInterest.user_id == user_id)
        .order_by(desc(UserInterest.score))
        .all()
    )

    results = []
    for r in records:
        last_dt = r.last_interaction_at or r.updated_at or now
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        days = max(0.0, (now - last_dt).total_seconds() / 86400.0)
        current_score = round(r.score * math.exp(-DECAY_LAMBDA * days), 2)
        if current_score > 0.1:
            results.append({
                "category": r.category,
                "score": current_score,
                "interactions": r.interaction_count,
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]

def match_users_for_event(
    db: Session,
    event_id: int,
    min_score: float = 2.0,
    limit: int = 200,
) -> List[int]:
    """
    Finds registered users whose calculated interest scores match an event's categories/tags.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return []

    # Infer target categories for event
    event_text = f"{event.title or ''} {event.description or ''} {event.music_genre or ''} {event.category or ''}"
    from services.activity_tracker import detect_categories
    matched_cats = detect_categories(event_text)
    if not matched_cats:
        matched_cats = ["events", "nightlife"]

    now = datetime.now(timezone.utc)

    # Query users with interest in these categories
    records = (
        db.query(UserInterest)
        .filter(
            UserInterest.category.in_(matched_cats),
            UserInterest.score >= min_score,
        )
        .order_by(desc(UserInterest.score))
        .all()
    )

    matched_users = set()
    for r in records:
        last_dt = r.last_interaction_at or r.updated_at or now
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        days = max(0.0, (now - last_dt).total_seconds() / 86400.0)
        decayed = r.score * math.exp(-DECAY_LAMBDA * days)
        if decayed >= min_score:
            matched_users.add(r.user_id)
        if len(matched_users) >= limit:
            break

    return list(matched_users)
