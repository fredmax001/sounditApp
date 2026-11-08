"""
Slug utilities for human-readable & SEO-friendly URLs across Sound It entities:
- Artists (e.g. 'Fred Max' -> 'fred-max')
- Events (e.g. 'Beatz of Afrika' -> 'beatz-of-afrika')
- Organizers (e.g. 'Sound It Entertainment' -> 'sound-it-entertainment')
- Businesses & Venues (e.g. 'The Press Room' -> 'the-press-room')
- Vendors (e.g. 'LaBurg' -> 'laburg')
"""
import re
import unicodedata
from typing import Optional


def slugify(text: Optional[str]) -> str:
    """
    Convert a name or title into a clean URL-friendly slug.
    Examples:
        'Fred Max' -> 'fred-max'
        'Beatz of Afrika 2026!' -> 'beatz-of-afrika-2026'
        'DJ FredMax' -> 'dj-fredmax'
        'LaBurg Burger & Fries' -> 'laburg-burger-fries'
    """
    if not text:
        return ""
    text = str(text).strip()
    # Normalize unicode characters
    normalized = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    # Convert non-alphanumeric to spaces
    clean = re.sub(r'[^\w\s-]', '', normalized).strip().lower()
    # Convert whitespace/dashes into single hyphens
    slug = re.sub(r'[-\s]+', '-', clean)
    return slug.strip('-')


def generate_unique_slug(base_text: str, existing_slugs: set, row_id: Optional[int] = None) -> str:
    """
    Generate a slug that is unique among existing_slugs.
    If the base slug is taken, append -2, -3, or the row_id.
    """
    base = slugify(base_text)
    if not base:
        base = f"item-{row_id}" if row_id else "item"
    
    if base not in existing_slugs:
        return base
    
    if row_id and f"{base}-{row_id}" not in existing_slugs:
        return f"{base}-{row_id}"
        
    counter = 2
    while f"{base}-{counter}" in existing_slugs:
        counter += 1
    return f"{base}-{counter}"


def resolve_artist(db, identifier: str):
    """
    Find ArtistProfile by:
    1. Integer ID (ArtistProfile.id or ArtistProfile.user_id)
    2. Exact slug (ArtistProfile.slug)
    3. stage_name case-insensitively / unslugged
    """
    from models import ArtistProfile
    from sqlalchemy import func
    raw = str(identifier).strip()
    if not raw:
        return None
    
    # 1. Check numeric ID
    if raw.isdigit():
        int_id = int(raw)
        artist = db.query(ArtistProfile).filter(ArtistProfile.id == int_id).first()
        if not artist:
            artist = db.query(ArtistProfile).filter(ArtistProfile.user_id == int_id).first()
        if artist:
            return artist
            
    clean_slug = slugify(raw)
    # 2. Check stored slug
    artist = db.query(ArtistProfile).filter(ArtistProfile.slug == clean_slug).first()
    if artist:
        return artist
        
    # 3. Check stage_name unslugged
    unslugged = clean_slug.replace('-', ' ')
    artist = db.query(ArtistProfile).filter(func.lower(ArtistProfile.stage_name) == unslugged).first()
    if artist:
        return artist
        
    # 4. Fallback search
    all_artists = db.query(ArtistProfile).all()
    for a in all_artists:
        if a.stage_name and slugify(a.stage_name) == clean_slug:
            return a
            
    return None


def resolve_event(db, identifier: str):
    """
    Find Event by:
    1. Integer ID (Event.id)
    2. Exact slug (Event.slug)
    3. Title case-insensitively / unslugged
    """
    from models import Event
    from sqlalchemy import func
    raw = str(identifier).strip()
    if not raw:
        return None
        
    if raw.isdigit():
        return db.query(Event).filter(Event.id == int(raw)).first()
        
    clean_slug = slugify(raw)
    # Check stored slug
    event = db.query(Event).filter(Event.slug == clean_slug).first()
    if event:
        return event
        
    # Check title unslugged
    unslugged = clean_slug.replace('-', ' ')
    event = db.query(Event).filter(func.lower(Event.title) == unslugged).first()
    if event:
        return event
        
    all_events = db.query(Event).all()
    for ev in all_events:
        if ev.title and slugify(ev.title) == clean_slug:
            return ev
            
    return None


def resolve_vendor(db, identifier: str):
    """
    Find VendorProfile by:
    1. Integer ID (VendorProfile.id or VendorProfile.user_id)
    2. Exact slug (VendorProfile.slug)
    3. business_name case-insensitively / unslugged
    """
    from models import VendorProfile
    from sqlalchemy import func
    raw = str(identifier).strip()
    if not raw:
        return None
        
    if raw.isdigit():
        int_id = int(raw)
        v = db.query(VendorProfile).filter(VendorProfile.id == int_id).first()
        if not v:
            v = db.query(VendorProfile).filter(VendorProfile.user_id == int_id).first()
        if v:
            return v
            
    clean_slug = slugify(raw)
    v = db.query(VendorProfile).filter(VendorProfile.slug == clean_slug).first()
    if v:
        return v
        
    unslugged = clean_slug.replace('-', ' ')
    v = db.query(VendorProfile).filter(func.lower(VendorProfile.business_name) == unslugged).first()
    if v:
        return v
        
    all_vendors = db.query(VendorProfile).all()
    for vendor in all_vendors:
        if vendor.business_name and slugify(vendor.business_name) == clean_slug:
            return vendor
            
    return None


def resolve_organizer(db, identifier: str):
    """
    Find OrganizerProfile by:
    1. Integer ID (OrganizerProfile.id or OrganizerProfile.user_id)
    2. Exact slug (OrganizerProfile.slug)
    3. organization_name case-insensitively / unslugged
    """
    from models import OrganizerProfile
    from sqlalchemy import func
    raw = str(identifier).strip()
    if not raw:
        return None

    if raw.isdigit():
        int_id = int(raw)
        org = db.query(OrganizerProfile).filter(OrganizerProfile.id == int_id).first()
        if not org:
            org = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == int_id).first()
        if org:
            return org

    clean_slug = slugify(raw)
    org = db.query(OrganizerProfile).filter(OrganizerProfile.slug == clean_slug).first()
    if org:
        return org

    unslugged = clean_slug.replace('-', ' ')
    org = db.query(OrganizerProfile).filter(func.lower(OrganizerProfile.organization_name) == unslugged).first()
    if org:
        return org

    all_orgs = db.query(OrganizerProfile).all()
    for o in all_orgs:
        if o.organization_name and slugify(o.organization_name) == clean_slug:
            return o

    return None


def resolve_business(db, identifier: str):
    """
    Find BusinessProfile by:
    1. Integer ID (BusinessProfile.id or BusinessProfile.user_id)
    2. Exact slug (BusinessProfile.slug)
    3. business_name case-insensitively / unslugged
    """
    from models import BusinessProfile
    from sqlalchemy import func
    raw = str(identifier).strip()
    if not raw:
        return None

    if raw.isdigit():
        int_id = int(raw)
        biz = db.query(BusinessProfile).filter(BusinessProfile.id == int_id).first()
        if not biz:
            biz = db.query(BusinessProfile).filter(BusinessProfile.user_id == int_id).first()
        if biz:
            return biz

    clean_slug = slugify(raw)
    biz = db.query(BusinessProfile).filter(BusinessProfile.slug == clean_slug).first()
    if biz:
        return biz

    unslugged = clean_slug.replace('-', ' ')
    biz = db.query(BusinessProfile).filter(func.lower(BusinessProfile.business_name) == unslugged).first()
    if biz:
        return biz

    all_biz = db.query(BusinessProfile).all()
    for b in all_biz:
        if b.business_name and slugify(b.business_name) == clean_slug:
            return b

    return None


def resolve_user_profile(db, identifier: str):
    """
    Resolve a User for public profile display by:
    - User ID
    - Organizer Profile ID / Slug / organization_name
    - Business Profile ID / Slug / business_name
    - Artist Profile ID / Slug / stage_name
    - Vendor Profile ID / Slug / business_name
    - Username
    """
    from models import User, UserStatus
    from sqlalchemy.orm import joinedload
    raw = str(identifier).strip()
    if not raw:
        return None

    user_query = (
        db.query(User)
        .options(
            joinedload(User.artist_profile),
            joinedload(User.organizer_profile),
            joinedload(User.business_profile),
            joinedload(User.vendor_profile),
        )
        .filter(User.status == UserStatus.ACTIVE)
    )

    # 1. Numeric check
    if raw.isdigit():
        user = user_query.filter(User.id == int(raw)).first()
        if user:
            return user

    # 2. Organizer check
    org = resolve_organizer(db, raw)
    if org:
        user = user_query.filter(User.id == org.user_id).first()
        if user:
            return user

    # 3. Business check
    biz = resolve_business(db, raw)
    if biz:
        user = user_query.filter(User.id == biz.user_id).first()
        if user:
            return user

    # 4. Artist check
    artist = resolve_artist(db, raw)
    if artist:
        user = user_query.filter(User.id == artist.user_id).first()
        if user:
            return user

    # 5. Vendor check
    vendor = resolve_vendor(db, raw)
    if vendor:
        user = user_query.filter(User.id == vendor.user_id).first()
        if user:
            return user

    # 6. Username check
    clean = raw.lower()
    user = user_query.filter(User.username.ilike(clean)).first()
    if user:
        return user

    return None
