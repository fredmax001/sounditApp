"""
Social API - Follow artists, vendors, organizers and get trending items
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta

from database import get_db
from auth import get_current_user, get_optional_user, require_admin
from models import (
    User, ArtistProfile, OrganizerProfile, VendorProfile, BusinessProfile, Event,
    ArtistFollow, OrganizerFollow, VendorFollow, EventFollow, UserFollow,
    SearchLog, FeaturedItem, Notification, UserRole, ModerationReport
)

router = APIRouter(prefix="/social", tags=["Social"])


def _resolve_organizer(organizer_id: int, db: Session):
    """Resolve an organizer ID. If it's a business_profile ID, find or create the linked organizer."""
    organizer = db.query(OrganizerProfile).filter(OrganizerProfile.id == organizer_id).first()
    if organizer:
        return organizer
    # Try business profile
    bp = db.query(BusinessProfile).filter(BusinessProfile.id == organizer_id).first()
    if bp:
        if bp.organizer_profiles:
            return bp.organizer_profiles[0]
        # Auto-create organizer for this business
        organizer = OrganizerProfile(
            user_id=bp.user_id,
            business_profile_id=bp.id,
            organization_name=bp.business_name,
            is_verified=bp.is_verified
        )
        db.add(organizer)
        db.commit()
        db.refresh(organizer)
        return organizer
    return None


# ==================== FOLLOW ENDPOINTS ====================

def _check_can_follow(current_user: User):
    """Admins cannot follow other accounts."""
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot follow other accounts."
        )


def _check_target_not_admin(user: Optional[User]):
    """Admins cannot be followed and are kept strictly hidden from other accounts."""
    if user and user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found."
        )


# ===========================================================================
# UNIVERSAL SOCIAL FOLLOW SYSTEM (ANY ROLE -> ANY ROLE)
# Ordinary users, DJs, Artists, Organizers, Businesses & Vendors
# ===========================================================================

@router.post("/users/{target_user_id}/follow")
def universal_follow_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Universal Follow: Allows ANY account type (User, DJ, Artist, Organizer, Business, Vendor)
    to follow ANY other account without role-based restriction.
    Supports private account requests, follow back detection, and notifications.
    """
    _check_can_follow(current_user)

    if current_user.id == target_user_id:
        raise HTTPException(status_code=400, detail="You cannot follow your own account.")

    target = db.query(User).filter(User.id == target_user_id).first()
    if not target or target.status != "active":
        raise HTTPException(status_code=404, detail="User account not found.")

    _check_target_not_admin(target)

    # Check existing follow relationship
    existing = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == target_user_id
    ).first()

    target_is_private = getattr(target, 'is_private', False)
    target_status = "pending" if target_is_private else "accepted"

    # Check if target user already follows current_user (mutual / follow back)
    target_follows_me = db.query(UserFollow).filter(
        UserFollow.follower_id == target_user_id,
        UserFollow.following_id == current_user.id,
        UserFollow.status == "accepted"
    ).first() is not None

    if existing:
        if existing.status == "accepted":
            return {
                "success": True,
                "status": "following",
                "is_mutual": target_follows_me,
                "message": "Already following this user."
            }
        elif existing.status == "pending":
            return {
                "success": True,
                "status": "requested",
                "is_mutual": target_follows_me,
                "message": "Follow request is already pending."
            }
        else:
            existing.status = target_status
            db.commit()
    else:
        new_follow = UserFollow(
            follower_id=current_user.id,
            following_id=target_user_id,
            status=target_status
        )
        db.add(new_follow)

    # Also keep legacy profile follow tables in sync if target owns a specialized profile
    if target_status == "accepted":
        # Artist profile
        ap = db.query(ArtistProfile).filter(ArtistProfile.user_id == target_user_id).first()
        if ap:
            af = db.query(ArtistFollow).filter(ArtistFollow.user_id == current_user.id, ArtistFollow.artist_id == ap.id).first()
            if not af:
                db.add(ArtistFollow(user_id=current_user.id, artist_id=ap.id))
                ap.followers_count = (ap.followers_count or 0) + 1

        # Organizer profile
        op = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == target_user_id).first()
        if op:
            ofo = db.query(OrganizerFollow).filter(OrganizerFollow.user_id == current_user.id, OrganizerFollow.organizer_id == op.id).first()
            if not ofo:
                db.add(OrganizerFollow(user_id=current_user.id, organizer_id=op.id))
                op.followers_count = (getattr(op, 'followers_count', 0) or 0) + 1

        # Vendor profile
        vp = db.query(VendorProfile).filter(VendorProfile.user_id == target_user_id).first()
        if vp:
            vf = db.query(VendorFollow).filter(VendorFollow.user_id == current_user.id, VendorFollow.vendor_id == vp.id).first()
            if not vf:
                db.add(VendorFollow(user_id=current_user.id, vendor_id=vp.id))
                vp.followers_count = (getattr(vp, 'followers_count', 0) or 0) + 1

    # Send Notification to target
    author_display = f"@{current_user.username}" if current_user.username else (
        f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or "Someone"
    )

    if target_status == "pending":
        notif_title = "Follow Request"
        notif_msg = f"{author_display} requested to follow you."
        notif_type = "follow_request"
    elif target_follows_me:
        notif_title = "New Follower (Follow Back)"
        notif_msg = f"{author_display} followed you back! You are now mutually connected."
        notif_type = "follow_back"
    else:
        notif_title = "New Follower"
        notif_msg = f"{author_display} started following you."
        notif_type = "social_follow"

    notification = Notification(
        user_id=target_user_id,
        title=notif_title,
        message=notif_msg,
        type=notif_type,
        entity_type="user",
        entity_id=current_user.id,
        image_url=current_user.avatar_url,
        data={
            "follower_id": current_user.id,
            "username": current_user.username,
            "avatar_url": current_user.avatar_url,
            "is_mutual": target_follows_me
        }
    )
    db.add(notification)
    db.commit()

    return {
        "success": True,
        "status": "following" if target_status == "accepted" else "requested",
        "is_mutual": target_follows_me,
        "message": "Follow request sent." if target_status == "pending" else "Following user."
    }


@router.delete("/users/{target_user_id}/follow")
def universal_unfollow_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow any account type."""
    _check_can_follow(current_user)

    follow = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == target_user_id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following this user.")

    db.delete(follow)

    # Sync legacy profile follow tables if applicable
    ap = db.query(ArtistProfile).filter(ArtistProfile.user_id == target_user_id).first()
    if ap:
        af = db.query(ArtistFollow).filter(ArtistFollow.user_id == current_user.id, ArtistFollow.artist_id == ap.id).first()
        if af:
            db.delete(af)
            if ap.followers_count and ap.followers_count > 0:
                ap.followers_count -= 1

    op = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == target_user_id).first()
    if op:
        ofo = db.query(OrganizerFollow).filter(OrganizerFollow.user_id == current_user.id, OrganizerFollow.organizer_id == op.id).first()
        if ofo:
            db.delete(ofo)
            if getattr(op, 'followers_count', 0) > 0:
                op.followers_count -= 1

    vp = db.query(VendorProfile).filter(VendorProfile.user_id == target_user_id).first()
    if vp:
        vf = db.query(VendorFollow).filter(VendorFollow.user_id == current_user.id, VendorFollow.vendor_id == vp.id).first()
        if vf:
            db.delete(vf)
            if getattr(vp, 'followers_count', 0) > 0:
                vp.followers_count -= 1

    db.commit()

    # Check if target still follows current_user so UI can offer "Follow Back"
    they_follow = db.query(UserFollow).filter(
        UserFollow.follower_id == target_user_id,
        UserFollow.following_id == current_user.id,
        UserFollow.status == "accepted"
    ).first() is not None

    return {
        "success": True,
        "status": "none",
        "is_followed_by": they_follow,
        "mutual_follows": they_follow,
        "message": "Unfollowed successfully."
    }


@router.get("/users/{target_user_id}/relationship")
def get_user_relationship(
    target_user_id: int,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Get full social relationship between current user and target user:
    Returns button_state: 'self' | 'following' | 'requested' | 'follow_back' | 'follow'
    """
    if not current_user:
        return {
            "button_state": "follow",
            "is_following": False,
            "is_pending": False,
            "is_followed_by": False,
            "is_mutual": False
        }

    if current_user.id == target_user_id:
        return {
            "button_state": "self",
            "is_following": False,
            "is_pending": False,
            "is_followed_by": False,
            "is_mutual": False
        }

    i_follow = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == target_user_id
    ).first()

    they_follow = db.query(UserFollow).filter(
        UserFollow.follower_id == target_user_id,
        UserFollow.following_id == current_user.id,
        UserFollow.status == "accepted"
    ).first()

    is_following = i_follow is not None and i_follow.status == "accepted"
    is_pending = i_follow is not None and i_follow.status == "pending"
    is_followed_by = they_follow is not None
    is_mutual = is_following and is_followed_by

    if is_following:
        button_state = "following"
    elif is_pending:
        button_state = "requested"
    elif is_followed_by:
        button_state = "follow_back"
    else:
        button_state = "follow"

    return {
        "button_state": button_state,
        "is_following": is_following,
        "is_pending": is_pending,
        "is_followed_by": is_followed_by,
        "is_mutual": is_mutual
    }


@router.get("/users/{target_user_id}/follow-counts")
def get_user_follow_counts(
    target_user_id: int,
    db: Session = Depends(get_db)
):
    """Get accurate followers and following counts for any user profile."""
    followers_count = db.query(UserFollow).filter(
        UserFollow.following_id == target_user_id,
        UserFollow.status == "accepted"
    ).count()

    following_count = db.query(UserFollow).filter(
        UserFollow.follower_id == target_user_id,
        UserFollow.status == "accepted"
    ).count()

    return {
        "followers_count": followers_count,
        "following_count": following_count
    }


def _resolve_public_display_name(u: User) -> str:
    """Resolve the user's real business/vendor/stage display name before personal name."""
    if u.role == UserRole.VENDOR and u.vendor_profile and u.vendor_profile.business_name:
        return u.vendor_profile.business_name
    if u.role in (UserRole.BUSINESS, UserRole.ORGANIZER):
        if u.business_profile and u.business_profile.business_name:
            return u.business_profile.business_name
        if u.organizer_profile and u.organizer_profile.organization_name:
            return u.organizer_profile.organization_name
    if u.role == UserRole.ARTIST and u.artist_profile and u.artist_profile.stage_name:
        return u.artist_profile.stage_name
    return f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "Sound It User"


@router.get("/users/{target_user_id}/followers")
def list_user_followers(
    target_user_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """List accounts that follow the given user, enriched with profile details and follow-back states."""
    follows = db.query(UserFollow).filter(
        UserFollow.following_id == target_user_id,
        UserFollow.status == "accepted"
    ).order_by(UserFollow.created_at.desc()).offset(offset).limit(limit).all()

    my_following_ids = set()
    if current_user:
        my_following_ids = set(
            r[0] for r in db.query(UserFollow.following_id).filter(
                UserFollow.follower_id == current_user.id,
                UserFollow.status == "accepted"
            ).all()
        )

    results = []
    for f in follows:
        u = db.query(User).filter(User.id == f.follower_id).first()
        if not u or u.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            continue

        name = _resolve_public_display_name(u)
        is_following_them = u.id in my_following_ids
        button_state = "self" if (current_user and current_user.id == u.id) else (
            "following" if is_following_them else "follow"
        )

        results.append({
            "id": u.id,
            "username": u.username or f"user{u.id}",
            "name": name,
            "avatar_url": u.avatar_url,
            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
            "is_verified": bool(u.is_verified or u.verification_badge),
            "is_following": is_following_them,
            "button_state": button_state,
            "followed_at": f.created_at.isoformat() if f.created_at else None
        })

    return {"followers": results, "total": len(results)}


@router.get("/users/{target_user_id}/following")
def list_user_following(
    target_user_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """List accounts that the given user follows, enriched with profile details and follow states."""
    follows = db.query(UserFollow).filter(
        UserFollow.follower_id == target_user_id,
        UserFollow.status == "accepted"
    ).order_by(UserFollow.created_at.desc()).offset(offset).limit(limit).all()

    my_following_ids = set()
    if current_user:
        my_following_ids = set(
            r[0] for r in db.query(UserFollow.following_id).filter(
                UserFollow.follower_id == current_user.id,
                UserFollow.status == "accepted"
            ).all()
        )

    results = []
    for f in follows:
        u = db.query(User).filter(User.id == f.following_id).first()
        if not u or u.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            continue

        name = _resolve_public_display_name(u)
        is_following_them = u.id in my_following_ids
        button_state = "self" if (current_user and current_user.id == u.id) else (
            "following" if is_following_them else "follow"
        )

        results.append({
            "id": u.id,
            "username": u.username or f"user{u.id}",
            "name": name,
            "avatar_url": u.avatar_url,
            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
            "is_verified": bool(u.is_verified or u.verification_badge),
            "is_following": is_following_them,
            "button_state": button_state,
            "followed_at": f.created_at.isoformat() if f.created_at else None
        })

    return {"following": results, "total": len(results)}


@router.get("/suggested-users")
def get_suggested_users_to_follow(
    limit: int = Query(10, ge=1, le=30),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Suggested accounts to follow across all categories:
    Popular creators, DJs, Artists, and active platform members.
    """
    already_following_ids = set()
    if current_user:
        already_following_ids = set(
            r[0] for r in db.query(UserFollow.following_id).filter(
                UserFollow.follower_id == current_user.id
            ).all()
        )
        already_following_ids.add(current_user.id)

    query = db.query(User).filter(
        User.status == "active",
        User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    )
    if already_following_ids:
        query = query.filter(User.id.notin_(already_following_ids))

    users = query.order_by(User.is_verified.desc(), User.id.desc()).limit(limit).all()

    suggestions = []
    for u in users:
        # Check follower count
        f_count = db.query(UserFollow).filter(UserFollow.following_id == u.id, UserFollow.status == "accepted").count()
        name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "Sound It User"

        suggestions.append({
            "id": u.id,
            "username": u.username or f"user{u.id}",
            "name": name,
            "avatar_url": u.avatar_url,
            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
            "is_verified": bool(u.is_verified or u.verification_badge),
            "followers_count": f_count,
            "button_state": "follow"
        })

    return {"suggestions": suggestions}


@router.post("/artists/{artist_id}/follow")
def follow_artist(
    artist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follow an artist (any role except admin can follow)"""
    _check_can_follow(current_user)

    # Check if artist exists by profile ID or fallback to user_id
    artist = db.query(ArtistProfile).filter(ArtistProfile.id == artist_id).first()
    if not artist:
        artist = db.query(ArtistProfile).filter(ArtistProfile.user_id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    _check_target_not_admin(artist.user)
    if artist.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow your own account.")

    # Check if already following
    existing = db.query(ArtistFollow).filter(
        ArtistFollow.user_id == current_user.id,
        ArtistFollow.artist_id == artist.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already following this artist")

    # Create follow
    follow = ArtistFollow(user_id=current_user.id, artist_id=artist.id)
    db.add(follow)

    # Keep universal UserFollow in sync
    if artist.user_id:
        uf = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == artist.user_id
        ).first()
        if not uf:
            db.add(UserFollow(follower_id=current_user.id, following_id=artist.user_id, status="accepted"))

    # Update artist followers count
    artist.followers_count = (artist.followers_count or 0) + 1

    db.commit()

    return {"message": "Artist followed successfully"}


@router.delete("/artists/{artist_id}/follow")
def unfollow_artist(
    artist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow an artist"""
    _check_can_follow(current_user)

    artist = db.query(ArtistProfile).filter(ArtistProfile.id == artist_id).first()
    if not artist:
        artist = db.query(ArtistProfile).filter(ArtistProfile.user_id == artist_id).first()
    resolved_artist_id = artist.id if artist else artist_id

    follow = db.query(ArtistFollow).filter(
        ArtistFollow.user_id == current_user.id,
        ArtistFollow.artist_id == resolved_artist_id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following this artist")

    db.delete(follow)

    if artist and artist.user_id:
        uf = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == artist.user_id
        ).first()
        if uf:
            db.delete(uf)

    # Update artist followers count
    if artist and artist.followers_count and artist.followers_count > 0:
        artist.followers_count -= 1

    db.commit()

    return {"message": "Artist unfollowed successfully"}


@router.post("/vendors/{vendor_id}/follow")
def follow_vendor(
    vendor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follow a vendor (any role except admin can follow)"""
    _check_can_follow(current_user)

    vendor = db.query(VendorProfile).filter(VendorProfile.id == vendor_id).first()
    if not vendor:
        vendor = db.query(VendorProfile).filter(VendorProfile.user_id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    _check_target_not_admin(vendor.user)
    if vendor.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow your own account.")

    existing = db.query(VendorFollow).filter(
        VendorFollow.user_id == current_user.id,
        VendorFollow.vendor_id == vendor.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already following this vendor")

    follow = VendorFollow(user_id=current_user.id, vendor_id=vendor.id)
    db.add(follow)

    if vendor.user_id:
        uf = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == vendor.user_id
        ).first()
        if not uf:
            db.add(UserFollow(follower_id=current_user.id, following_id=vendor.user_id, status="accepted"))

    # Update vendor followers count
    vendor.followers_count = (getattr(vendor, 'followers_count', None) or 0) + 1

    db.commit()

    return {"message": "Vendor followed successfully"}


@router.delete("/vendors/{vendor_id}/follow")
def unfollow_vendor(
    vendor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow a vendor"""
    _check_can_follow(current_user)

    vendor = db.query(VendorProfile).filter(VendorProfile.id == vendor_id).first()
    if not vendor:
        vendor = db.query(VendorProfile).filter(VendorProfile.user_id == vendor_id).first()
    resolved_vendor_id = vendor.id if vendor else vendor_id

    follow = db.query(VendorFollow).filter(
        VendorFollow.user_id == current_user.id,
        VendorFollow.vendor_id == resolved_vendor_id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following this vendor")

    db.delete(follow)

    if vendor and vendor.user_id:
        uf = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == vendor.user_id
        ).first()
        if uf:
            db.delete(uf)

    # Update vendor followers count
    if vendor and (getattr(vendor, 'followers_count', None) or 0) > 0:
        vendor.followers_count -= 1

    db.commit()

    return {"message": "Vendor unfollowed successfully"}


@router.post("/organizers/{organizer_id}/follow")
def follow_organizer(
    organizer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Follow an organizer / business (any role except admin can follow)"""
    _check_can_follow(current_user)

    organizer = _resolve_organizer(organizer_id, db)
    if not organizer:
        raise HTTPException(status_code=404, detail="Organizer not found")
    _check_target_not_admin(organizer.user)
    if organizer.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow your own account.")

    existing = db.query(OrganizerFollow).filter(
        OrganizerFollow.user_id == current_user.id,
        OrganizerFollow.organizer_id == organizer.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already following this organizer")

    follow = OrganizerFollow(user_id=current_user.id, organizer_id=organizer.id)
    db.add(follow)

    if organizer.user_id:
        uf = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == organizer.user_id
        ).first()
        if not uf:
            db.add(UserFollow(follower_id=current_user.id, following_id=organizer.user_id, status="accepted"))

    # Update organizer followers count
    organizer.followers_count = (getattr(organizer, 'followers_count', None) or 0) + 1

    db.commit()

    return {"message": "Organizer followed successfully"}


@router.delete("/organizers/{organizer_id}/follow")
def unfollow_organizer(
    organizer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unfollow an organizer / business"""
    _check_can_follow(current_user)

    organizer = _resolve_organizer(organizer_id, db)
    if not organizer:
        raise HTTPException(status_code=404, detail="Organizer not found")

    follow = db.query(OrganizerFollow).filter(
        OrganizerFollow.user_id == current_user.id,
        OrganizerFollow.organizer_id == organizer.id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following this organizer")

    db.delete(follow)

    if organizer.user_id:
        uf = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == organizer.user_id
        ).first()
        if uf:
            db.delete(uf)
    
    # Update organizer followers count
    if (getattr(organizer, 'followers_count', None) or 0) > 0:
        organizer.followers_count -= 1
    
    db.commit()
    
    return {"message": "Organizer unfollowed successfully"}


@router.get("/following")
def get_following(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all entities the user is following (excluding admins)"""
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return {"artists": [], "vendors": [], "organizers": []}

    artists = (
        db.query(ArtistProfile)
        .options(joinedload(ArtistProfile.user))
        .join(ArtistFollow)
        .join(User, ArtistProfile.user_id == User.id)
        .filter(
            ArtistFollow.user_id == current_user.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
        )
        .all()
    )

    vendors = (
        db.query(VendorProfile)
        .options(joinedload(VendorProfile.user))
        .join(VendorFollow)
        .join(User, VendorProfile.user_id == User.id)
        .filter(
            VendorFollow.user_id == current_user.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
        )
        .all()
    )

    organizers = (
        db.query(OrganizerProfile)
        .options(joinedload(OrganizerProfile.user))
        .join(OrganizerFollow)
        .join(User, OrganizerProfile.user_id == User.id)
        .filter(
            OrganizerFollow.user_id == current_user.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
        )
        .all()
    )

    from utils.slug import slugify

    return {
        "artists": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "stage_name": a.stage_name,
                "slug": getattr(a, 'slug', None) or slugify(a.stage_name),
                "avatar_url": (a.user.avatar_url or a.user.background_url) if a.user else None,
                "genre": a.genre,
                "genres": a.genre_tags or ([a.genre] if a.genre else []),
                "city": (
                    a.city.value
                    if a.city
                    else (a.user.preferred_city.value if a.user and a.user.preferred_city else None)
                ),
                "follower_count": a.followers_count or 0,
                "followers_count": a.followers_count or 0,
                "is_verified": getattr(a.user, 'is_verified', False) if a.user else False,
            }
            for a in artists
        ],
        "vendors": [
            {
                "id": v.id,
                "user_id": v.user_id,
                "business_name": v.business_name,
                "slug": getattr(v, 'slug', None) or slugify(v.business_name),
                "vendor_type": v.vendor_type,
                "logo_url": getattr(v, "logo_url", None) or (v.user.avatar_url if v.user else None),
                "city": v.city.value if v.city else None,
                "follower_count": getattr(v, "followers_count", 0) or 0,
                "followers_count": getattr(v, "followers_count", 0) or 0,
                "is_verified": getattr(v, 'is_verified', False),
            }
            for v in vendors
        ],
        "organizers": [
            {
                "id": o.id,
                "user_id": o.user_id,
                "organization_name": o.organization_name,
                "slug": getattr(o, 'slug', None) or slugify(o.organization_name),
                "logo_url": getattr(o, "logo_url", None) or (o.user.avatar_url if o.user else None),
                "city": o.city.value if hasattr(o.city, 'value') else (o.city or None),
                "follower_count": getattr(o, "followers_count", 0) or 0,
                "followers_count": getattr(o, "followers_count", 0) or 0,
                "is_verified": getattr(o, 'is_verified', False),
            }
            for o in organizers
        ],
    }


@router.get("/followers")
def get_user_followers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all followers of current user's profile across any role (Artist, Business/Organizer, Vendor, User).
    Admins are strictly excluded from follower lists.
    """
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return []

    followers = []
    seen_follower_user_ids = set()

    # IDs current user is following (to compute is_following follow-back status)
    following_artist_ids = set(r[0] for r in db.query(ArtistFollow.artist_id).filter(ArtistFollow.user_id == current_user.id).all())
    following_organizer_ids = set(r[0] for r in db.query(OrganizerFollow.organizer_id).filter(OrganizerFollow.user_id == current_user.id).all())
    following_vendor_ids = set(r[0] for r in db.query(VendorFollow.vendor_id).filter(VendorFollow.user_id == current_user.id).all())

    from utils.slug import slugify

    def _format_follower(u: User, created_at):
        role_type = "user"
        target_id = u.id
        slug_raw = u.username
        is_following_back = False

        if u.artist_profile:
            role_type = "artist"
            target_id = u.artist_profile.id
            slug_raw = getattr(u.artist_profile, 'slug', None) or u.artist_profile.stage_name
            is_following_back = (u.artist_profile.id in following_artist_ids)
        elif u.organizer_profile:
            role_type = "organizer"
            target_id = u.organizer_profile.id
            slug_raw = getattr(u.organizer_profile, 'slug', None) or u.organizer_profile.organization_name
            is_following_back = (u.organizer_profile.id in following_organizer_ids)
        elif u.business_profile and u.business_profile.organizer_profiles:
            org = u.business_profile.organizer_profiles[0]
            role_type = "organizer"
            target_id = org.id
            slug_raw = getattr(org, 'slug', None) or org.organization_name
            is_following_back = (org.id in following_organizer_ids)
        elif u.vendor_profile:
            role_type = "vendor"
            target_id = u.vendor_profile.id
            slug_raw = getattr(u.vendor_profile, 'slug', None) or u.vendor_profile.business_name
            is_following_back = (u.vendor_profile.id in following_vendor_ids)

        name = ""
        if u.artist_profile and u.artist_profile.stage_name:
            name = u.artist_profile.stage_name
        elif u.business_profile and u.business_profile.business_name:
            name = u.business_profile.business_name
        elif u.vendor_profile and u.vendor_profile.business_name:
            name = u.vendor_profile.business_name
        else:
            name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "Music Lover"

        return {
            "id": target_id,
            "user_id": u.id,
            "name": name,
            "type": role_type,
            "avatar_url": u.avatar_url or (u.vendor_profile.logo_url if u.vendor_profile else None),
            "city": u.preferred_city.value if u.preferred_city else None,
            "is_verified": getattr(u, 'is_verified', False),
            "slug": slugify(slug_raw) if slug_raw else str(u.id),
            "is_following": is_following_back,
            "joinedDate": created_at.strftime("%Y-%m-%d") if created_at else None,
        }

    # 1. Artist followers
    if current_user.artist_profile:
        art_follows = db.query(ArtistFollow).join(User, ArtistFollow.user_id == User.id).filter(
            ArtistFollow.artist_id == current_user.artist_profile.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
        ).order_by(ArtistFollow.created_at.desc()).all()
        for f in art_follows:
            if f.user and f.user.id not in seen_follower_user_ids:
                seen_follower_user_ids.add(f.user.id)
                followers.append(_format_follower(f.user, f.created_at))

    # 2. Organizer / Business followers
    organizer_id = None
    if current_user.organizer_profile:
        organizer_id = current_user.organizer_profile.id
    elif current_user.business_profile and current_user.business_profile.organizer_profiles:
        organizer_id = current_user.business_profile.organizer_profiles[0].id

    if organizer_id:
        org_follows = db.query(OrganizerFollow).join(User, OrganizerFollow.user_id == User.id).filter(
            OrganizerFollow.organizer_id == organizer_id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
        ).order_by(OrganizerFollow.created_at.desc()).all()
        for f in org_follows:
            if f.user and f.user.id not in seen_follower_user_ids:
                seen_follower_user_ids.add(f.user.id)
                followers.append(_format_follower(f.user, f.created_at))

    # 3. Vendor followers
    if current_user.vendor_profile:
        ven_follows = db.query(VendorFollow).join(User, VendorFollow.user_id == User.id).filter(
            VendorFollow.vendor_id == current_user.vendor_profile.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
        ).order_by(VendorFollow.created_at.desc()).all()
        for f in ven_follows:
            if f.user and f.user.id not in seen_follower_user_ids:
                seen_follower_user_ids.add(f.user.id)
                followers.append(_format_follower(f.user, f.created_at))

    return followers


@router.get("/suggested")
def get_suggested_connections(
    limit: int = 12,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get suggested accounts to connect with / follow across China (Artists, Businesses, Vendors).
    Excludes admins completely and accounts already followed.
    """
    from utils.slug import slugify

    # IDs already followed
    following_artist_ids = set(r[0] for r in db.query(ArtistFollow.artist_id).filter(ArtistFollow.user_id == current_user.id).all())
    following_organizer_ids = set(r[0] for r in db.query(OrganizerFollow.organizer_id).filter(OrganizerFollow.user_id == current_user.id).all())
    following_vendor_ids = set(r[0] for r in db.query(VendorFollow.vendor_id).filter(VendorFollow.user_id == current_user.id).all())

    suggested = []

    # 1. Top Artists not yet followed
    artists_query = (
        db.query(ArtistProfile)
        .join(User, ArtistProfile.user_id == User.id)
        .filter(
            User.id != current_user.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            ArtistProfile.is_approved == True
        )
    )
    if following_artist_ids:
        artists_query = artists_query.filter(ArtistProfile.id.notin_(following_artist_ids))
    top_artists = artists_query.order_by(
        ArtistProfile.is_featured.desc(),
        ArtistProfile.is_verified.desc(),
        ArtistProfile.followers_count.desc()
    ).limit(max(4, limit // 2)).all()

    for a in top_artists:
        suggested.append({
            "id": a.id,
            "user_id": a.user_id,
            "name": a.stage_name,
            "type": "artist",
            "slug": getattr(a, 'slug', None) or slugify(a.stage_name),
            "avatar_url": a.user.avatar_url if a.user else None,
            "genre": a.genre,
            "city": a.city.value if a.city else (a.user.preferred_city.value if a.user and a.user.preferred_city else None),
            "followers_count": a.followers_count or 0,
            "is_verified": getattr(a.user, 'is_verified', False) if a.user else False,
            "is_following": False,
        })

    # 2. Top Organizers / Businesses not yet followed
    orgs_query = (
        db.query(OrganizerProfile)
        .join(User, OrganizerProfile.user_id == User.id)
        .filter(
            User.id != current_user.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            OrganizerProfile.is_approved == True
        )
    )
    if following_organizer_ids:
        orgs_query = orgs_query.filter(OrganizerProfile.id.notin_(following_organizer_ids))
    top_orgs = orgs_query.order_by(
        OrganizerProfile.is_featured.desc(),
        OrganizerProfile.is_verified.desc(),
        OrganizerProfile.events_count.desc()
    ).limit(max(3, limit // 3)).all()

    for o in top_orgs:
        suggested.append({
            "id": o.id,
            "user_id": o.user_id,
            "name": o.organization_name,
            "type": "organizer",
            "slug": getattr(o, 'slug', None) or slugify(o.organization_name),
            "avatar_url": getattr(o, "logo_url", None) or (o.user.avatar_url if o.user else None),
            "genre": "Venue & Events",
            "city": o.city.value if hasattr(o.city, 'value') else (o.city or None),
            "followers_count": getattr(o, "followers_count", 0) or 0,
            "is_verified": getattr(o, 'is_verified', False),
            "is_following": False,
        })

    # 3. Top Vendors not yet followed
    vendors_query = (
        db.query(VendorProfile)
        .join(User, VendorProfile.user_id == User.id)
        .filter(
            User.id != current_user.id,
            User.role.notin_([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            VendorProfile.is_approved == True
        )
    )
    if following_vendor_ids:
        vendors_query = vendors_query.filter(VendorProfile.id.notin_(following_vendor_ids))
    top_vendors = vendors_query.order_by(
        VendorProfile.is_featured.desc(),
        VendorProfile.is_verified.desc(),
        VendorProfile.rating.desc()
    ).limit(max(3, limit // 3)).all()

    for v in top_vendors:
        suggested.append({
            "id": v.id,
            "user_id": v.user_id,
            "name": v.business_name,
            "type": "vendor",
            "slug": getattr(v, 'slug', None) or slugify(v.business_name),
            "avatar_url": getattr(v, "logo_url", None) or (v.user.avatar_url if v.user else None),
            "genre": v.vendor_type or "Vendor",
            "city": v.city.value if v.city else None,
            "followers_count": getattr(v, "followers_count", 0) or 0,
            "is_verified": getattr(v, 'is_verified', False),
            "is_following": False,
        })

    return suggested


# ==================== TRENDING & FEATURED ====================

@router.get("/trending/artists")
def get_trending_artists(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get trending artists based on follows and searches"""
    # Get artists with most follows in last 30 days
    trending = db.query(ArtistProfile).order_by(
        desc(ArtistProfile.followers_count)
    ).limit(limit).all()
    
    return [{
        "id": a.id,
        "stage_name": a.stage_name,
        "genre": a.genre,
        "followers_count": a.followers_count,
        "events_count": a.events_count
    } for a in trending]


@router.get("/trending/events")
def get_trending_events(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get trending events based on views and follows"""
    trending = db.query(Event).filter(
        Event.status == 'approved'
    ).order_by(
        desc(Event.views_count + Event.tickets_sold)
    ).limit(limit).all()
    
    return [{
        "id": e.id,
        "title": e.title,
        "start_date": e.start_date,
        "city": e.city.value if e.city else None,
        "views_count": e.views_count,
        "tickets_sold": e.tickets_sold
    } for e in trending]


@router.get("/featured")
def get_featured_items(
    entity_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get featured items (artists, events, vendors, organizers)"""
    query = db.query(FeaturedItem).filter(FeaturedItem.is_active == True)
    
    if entity_type:
        query = query.filter(FeaturedItem.entity_type == entity_type)
    
    featured = query.order_by(FeaturedItem.position).all()
    
    result = []
    for f in featured:
        item_data = {
            "id": f.id,
            "entity_type": f.entity_type,
            "entity_id": f.entity_id,
            "position": f.position,
            "created_at": f.created_at.isoformat() if f.created_at else None
        }
        
        # Get entity details
        if f.entity_type == "artist":
            entity = db.query(ArtistProfile).filter(ArtistProfile.id == f.entity_id).first()
            if entity:
                item_data["details"] = {
                    "stage_name": entity.stage_name,
                    "genre": entity.genre
                }
        elif f.entity_type == "event":
            entity = db.query(Event).filter(Event.id == f.entity_id).first()
            if entity:
                item_data["details"] = {
                    "title": entity.title,
                    "start_date": entity.start_date
                }
        elif f.entity_type == "vendor":
            entity = db.query(VendorProfile).filter(VendorProfile.id == f.entity_id).first()
            if entity:
                item_data["details"] = {
                    "business_name": entity.business_name
                }
        elif f.entity_type == "organizer":
            entity = db.query(OrganizerProfile).filter(OrganizerProfile.id == f.entity_id).first()
            if entity:
                item_data["details"] = {
                    "organization_name": entity.organization_name
                }
        
        result.append(item_data)
    
    return result


# ==================== SEARCH ====================

@router.get("/search")
def search_entities(
    q: str = Query(..., min_length=1),
    entity_type: Optional[str] = None,  # artist, vendor, organizer, event
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for artists, vendors, organizers, events"""
    results = {
        "artists": [],
        "vendors": [],
        "organizers": [],
        "events": []
    }
    
    search_term = f"%{q}%"
    
    # Search artists
    if not entity_type or entity_type == "artist":
        artists = db.query(ArtistProfile).filter(
            ArtistProfile.stage_name.ilike(search_term)
        ).limit(10).all()
        results["artists"] = [{
            "id": a.id,
            "stage_name": a.stage_name,
            "genre": a.genre,
            "followers_count": a.followers_count
        } for a in artists]
    
    # Search vendors
    if not entity_type or entity_type == "vendor":
        vendors = db.query(VendorProfile).filter(
            VendorProfile.business_name.ilike(search_term)
        ).limit(10).all()
        results["vendors"] = [{
            "id": v.id,
            "business_name": v.business_name,
            "vendor_type": v.vendor_type
        } for v in vendors]
    
    # Search organizers
    if not entity_type or entity_type == "organizer":
        organizers = db.query(OrganizerProfile).filter(
            OrganizerProfile.organization_name.ilike(search_term)
        ).limit(10).all()
        results["organizers"] = [{
            "id": o.id,
            "organization_name": o.organization_name,
            "events_count": o.events_count
        } for o in organizers]
    
    # Log search
    search_log = SearchLog(
        user_id=current_user.id if current_user else None,
        query=q,
        entity_type=entity_type or "all"
    )
    db.add(search_log)
    db.commit()
    
    return results


@router.get("/users/search")
def search_users_for_tagging(
    q: str = Query(..., min_length=1),
    limit: int = Query(15, ge=1, le=50),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Search registered users for friend tagging in Reels/Community posts and event invites."""
    term = f"%{q.strip()}%"
    users = db.query(User).filter(
        (User.username.ilike(term)) |
        (User.first_name.ilike(term)) |
        (User.last_name.ilike(term)) |
        (User.email.ilike(term))
    ).limit(limit).all()

    return [{
        "id": u.id,
        "username": u.username or f"user{u.id}",
        "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "Sound It User",
        "avatar_url": u.avatar_url,
        "is_verified": bool(u.is_verified or u.verification_badge),
        "role": u.role,
    } for u in users]



# ==================== ADMIN FEATURE ENDPOINTS ====================

@router.post("/admin/feature", dependencies=[Depends(require_admin)])
def feature_item(
    entity_type: str,
    entity_id: int,
    feature_type: str = "weekly",  # weekly, monthly, permanent
    expires_days: Optional[int] = None,
    display_order: int = 0,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Feature an item (admin only)"""
    expires_at = None
    if expires_days:
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
    
    featured = FeaturedItem(
        entity_type=entity_type,
        entity_id=entity_id,
        featured_by_id=current_user.id,
        featured_at=datetime.utcnow(),
        expires_at=expires_at,
        feature_type=feature_type,
        display_order=display_order,
        is_active=True
    )
    
    db.add(featured)
    db.commit()
    
    return {"message": f"{entity_type} featured successfully"}


@router.delete("/admin/feature/{feature_id}", dependencies=[Depends(require_admin)])
def remove_feature(
    feature_id: int,
    db: Session = Depends(get_db)
):
    """Remove a featured item (admin only)"""
    featured = db.query(FeaturedItem).filter(FeaturedItem.id == feature_id).first()
    if not featured:
        raise HTTPException(status_code=404, detail="Featured item not found")
    
    featured.is_active = False
    db.commit()
    
    return {"message": "Feature removed successfully"}


@router.get("/admin/stats", dependencies=[Depends(require_admin)])
def get_social_stats(
    db: Session = Depends(get_db)
):
    """Get social stats for admin (admin only)"""
    # Top searched
    top_searches = db.query(
        SearchLog.query,
        func.count(SearchLog.id).label('count')
    ).group_by(SearchLog.query).order_by(desc('count')).limit(10).all()
    
    # Most followed artists
    top_artists = db.query(ArtistProfile).order_by(
        desc(ArtistProfile.followers_count)
    ).limit(10).all()
    
    return {
        "top_searches": [{"query": s.query, "count": s.count} for s in top_searches],
        "top_artists": [{"id": a.id, "stage_name": a.stage_name, "followers": a.followers_count} for a in top_artists]
    }


@router.get("/organizers/{organizer_id}/followers")
def get_organizer_followers(
    organizer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get followers of an organizer/business"""
    organizer = db.query(OrganizerProfile).filter(OrganizerProfile.id == organizer_id).first()
    if not organizer:
        raise HTTPException(status_code=404, detail="Organizer not found")
    
    # Check ownership
    if organizer.user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view followers"
        )
    
    follows = db.query(OrganizerFollow).filter(
        OrganizerFollow.organizer_id == organizer_id
    ).order_by(OrganizerFollow.created_at.desc()).all()
    
    return [{
        "id": f.id,
        "name": f"{f.user.first_name or ''} {f.user.last_name or ''}".strip() if f.user else "Unknown",
        "email": f.user.email if f.user else None,
        "joinedDate": f.created_at.strftime("%Y-%m-%d") if f.created_at else None,
        "eventsAttended": 0,
    } for f in follows]


@router.get("/business/followers")
def get_business_followers_alias(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for GET /business/followers, get followers for current business/organizer."""
    organizer = current_user.organizer_profile
    if not organizer and current_user.business_profile:
        if current_user.business_profile.organizer_profiles:
            organizer = current_user.business_profile.organizer_profiles[0]
    
    if not organizer:
        return []
    
    follows = db.query(OrganizerFollow).filter(
        OrganizerFollow.organizer_id == organizer.id
    ).order_by(OrganizerFollow.created_at.desc()).all()
    
    return [{
        "id": f.id,
        "name": f"{f.user.first_name or ''} {f.user.last_name or ''}".strip() if f.user else "Unknown",
        "email": f.user.email if f.user else None,
        "joinedDate": f.created_at.strftime("%Y-%m-%d") if f.created_at else None,
        "eventsAttended": 0,
    } for f in follows]


# ===========================================================================
# UGC SAFETY: CONTENT REPORTING & USER BLOCKING (Apple Guideline 1.2)
# ===========================================================================

class SocialReportPayload(BaseModel):
    entity_type: str = Field(..., pattern="^(user|post|reel|comment|event|message)$")
    entity_id: int
    reason: str = Field(..., min_length=2, max_length=100)
    details: Optional[str] = Field(None, max_length=1000)


class BlockUserPayload(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)
    also_report: bool = False


@router.post("/report")
def submit_ugc_report(
    payload: SocialReportPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Report objectionable content or an abusive account into the Admin Moderation queue."""
    if payload.entity_type == "user" and payload.entity_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report your own account.")

    existing = db.query(ModerationReport).filter(
        ModerationReport.entity_type == payload.entity_type,
        ModerationReport.entity_id == payload.entity_id,
        ModerationReport.reporter_id == current_user.id,
        ModerationReport.status == "pending",
    ).first()
    if existing:
        return {
            "success": True,
            "report_id": existing.id,
            "message": "Your report has already been submitted and is under review.",
        }

    severity = "high" if any(
        kw in payload.reason.lower()
        for kw in ("harassment", "hate", "abuse", "scam", "fraud", "nsfw", "violence")
    ) else "medium"

    report = ModerationReport(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        reporter_id=current_user.id,
        reason=payload.reason.strip(),
        details=(payload.details or "").strip() or None,
        severity=severity,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "success": True,
        "report_id": report.id,
        "message": "Report submitted. Our moderation team will review it within 24 hours.",
    }


@router.post("/users/{target_user_id}/block")
def block_user(
    target_user_id: int,
    payload: Optional[BlockUserPayload] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Block another user: removes mutual follows and hides their content from the blocker."""
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block your own account.")

    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    profile_data = dict(current_user.profile_data or {})
    blocked = list(profile_data.get("blocked_user_ids") or [])
    if target_user_id not in blocked:
        blocked.append(target_user_id)
    profile_data["blocked_user_ids"] = blocked
    current_user.profile_data = profile_data
    flag_modified(current_user, "profile_data")

    # Remove follow relationships in both directions
    db.query(UserFollow).filter(
        ((UserFollow.follower_id == current_user.id) & (UserFollow.following_id == target_user_id))
        | ((UserFollow.follower_id == target_user_id) & (UserFollow.following_id == current_user.id))
    ).delete(synchronize_session=False)

    if payload and payload.also_report:
        db.add(ModerationReport(
            entity_type="user",
            entity_id=target_user_id,
            reporter_id=current_user.id,
            reason=(payload.reason or "Abusive behavior / blocked user").strip(),
            severity="high",
            status="pending",
        ))

    db.commit()
    return {
        "success": True,
        "blocked_user_id": target_user_id,
        "blocked_user_ids": blocked,
        "message": "User blocked. Their content has been hidden from your feed.",
    }


@router.delete("/users/{target_user_id}/block")
def unblock_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unblock a previously blocked user."""
    profile_data = dict(current_user.profile_data or {})
    blocked = [uid for uid in (profile_data.get("blocked_user_ids") or []) if uid != target_user_id]
    profile_data["blocked_user_ids"] = blocked
    current_user.profile_data = profile_data
    flag_modified(current_user, "profile_data")
    db.commit()
    return {
        "success": True,
        "blocked_user_ids": blocked,
        "message": "User unblocked.",
    }


@router.get("/blocked")
def list_blocked_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all user IDs blocked by the current user."""
    profile_data = current_user.profile_data or {}
    blocked_ids = [int(uid) for uid in (profile_data.get("blocked_user_ids") or []) if str(uid).isdigit()]
    users = []
    if blocked_ids:
        rows = db.query(User).filter(User.id.in_(blocked_ids)).all()
        users = [
            {
                "id": u.id,
                "username": u.username or f"user{u.id}",
                "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username or "User",
                "avatar_url": u.avatar_url,
            }
            for u in rows
        ]
    return {"blocked_user_ids": blocked_ids, "users": users}
