"""
Open Graph (OG) Meta Tag Server-Side Injection

Serves the SPA index.html with dynamically injected OG meta tags
for social media crawlers and link previews.

Routes handled:
- /events/{event_id}
- /artists/{artist_id}
- /vendors/{vendor_id}
- /profiles/{profile_id}
- /community
- /city-guide, /discovery
"""

import os
import re
from typing import Optional
from database import SessionLocal
from models import Event, ArtistProfile, VendorProfile, User, BusinessProfile, OrganizerProfile

BASE_URL = os.getenv("BASE_URL", "https://sounditent.com")
INDEX_PATH = os.path.join("app", "dist", "index.html")


def _read_index_html() -> str:
    """Read the production-built index.html from disk."""
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def _make_absolute_url(url: str) -> str:
    """Ensure a URL is absolute for OG meta tags."""
    if not url:
        return f"{BASE_URL}/logo.png"
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return f"{BASE_URL}{url}"
    return f"{BASE_URL}/{url}"


def _build_og_html(
    base_html: str,
    title: str,
    description: str,
    image: str,
    url: str,
    og_type: str = "website",
) -> str:
    """Inject OG meta tags into the base HTML."""
    if not base_html:
        # Fallback minimal HTML if dist/index.html is missing
        return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<meta name="description" content="{description}" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{image}" />
<meta property="og:url" content="{url}" />
<meta property="og:type" content="{og_type}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{description}" />
<meta name="twitter:image" content="{image}" />
</head>
<body><div id="root"></div></body>
</html>"""

    html = base_html

    def _replace_tag(
        html_str: str,
        attr_name: str,
        attr_value: str,
        content_attr: str,
        new_content: str,
    ) -> str:
        """Replace a meta tag's content attribute, or inject a new tag."""
        # Pattern 1: property/name first, content second
        pattern1 = rf'(<meta\s+[^>]*{attr_name}=["\']{re.escape(attr_value)}["\']\s+[^>]*{content_attr}=["\'])[^"\']*(["\'][^>]*>)'
        if re.search(pattern1, html_str, re.IGNORECASE):
            return re.sub(pattern1, rf'\g<1>{new_content}\g<2>', html_str, count=1, flags=re.IGNORECASE)

        # Pattern 2: content first, property/name second
        pattern2 = rf'(<meta\s+[^>]*{content_attr}=["\'])[^"\']*(["\']\s+[^>]*{attr_name}=["\']{re.escape(attr_value)}["\'][^>]*>)'
        if re.search(pattern2, html_str, re.IGNORECASE):
            return re.sub(pattern2, rf'\g<1>{new_content}\g<2>', html_str, count=1, flags=re.IGNORECASE)

        # Not found — inject before </head>
        return html_str.replace('</head>', f'<meta {attr_name}="{attr_value}" {content_attr}="{new_content}" />\n</head>', 1)

    def _replace_title(html_str: str, new_title: str) -> str:
        if re.search(r'<title>[^<]*</title>', html_str, re.IGNORECASE):
            return re.sub(r'(<title>)[^<]*(</title>)', rf'\g<1>{new_title}\g<2>', html_str, count=1, flags=re.IGNORECASE)
        return html_str.replace('</head>', f'<title>{new_title}</title>\n</head>', 1)

    def _replace_desc(html_str: str, new_desc: str) -> str:
        if re.search(r'<meta\s+[^>]*name=["\']description["\']', html_str, re.IGNORECASE):
            return _replace_tag(html_str, 'name', 'description', 'content', new_desc)
        return html_str.replace('</head>', f'<meta name="description" content="{new_desc}" />\n</head>', 1)

    html = _replace_title(html, title)
    html = _replace_desc(html, description)
    html = _replace_tag(html, 'property', 'og:title', 'content', title)
    html = _replace_tag(html, 'property', 'og:description', 'content', description)
    html = _replace_tag(html, 'property', 'og:image', 'content', image)
    html = _replace_tag(html, 'property', 'og:url', 'content', url)
    html = _replace_tag(html, 'property', 'og:type', 'content', og_type)
    html = _replace_tag(html, 'name', 'twitter:title', 'content', title)
    html = _replace_tag(html, 'name', 'twitter:description', 'content', description)
    html = _replace_tag(html, 'name', 'twitter:image', 'content', image)
    return html


def serve_event_og(event_id: int) -> Optional[str]:
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return None

        title = event.title or "Event on Sound It"
        description = (event.description or "Discover amazing events on Sound It.")[:300]
        image = _make_absolute_url(event.flyer_image)
        url = f"{BASE_URL}/events/{event_id}"

        base_html = _read_index_html()
        return _build_og_html(base_html, title, description, image, url, "event")
    finally:
        db.close()


def serve_artist_og(artist_id: int) -> Optional[str]:
    db = SessionLocal()
    try:
        artist = db.query(ArtistProfile).filter(ArtistProfile.id == artist_id).first()
        if not artist:
            return None

        user = db.query(User).filter(User.id == artist.user_id).first() if artist.user_id else None
        title = artist.stage_name or "Artist on Sound It"
        description = (artist.bio or "Discover talented artists on Sound It.")[:300]
        image = _make_absolute_url(user.avatar_url if user else None)
        url = f"{BASE_URL}/artists/{artist_id}"

        base_html = _read_index_html()
        return _build_og_html(base_html, title, description, image, url, "profile")
    finally:
        db.close()


def serve_vendor_og(vendor_id: int) -> Optional[str]:
    db = SessionLocal()
    try:
        vendor = db.query(VendorProfile).filter(VendorProfile.id == vendor_id).first()
        if not vendor:
            return None

        title = vendor.business_name or "Vendor on Sound It"
        description = (vendor.description or "Discover amazing vendors on Sound It.")[:300]
        image = _make_absolute_url(vendor.logo_url or vendor.banner_url)
        url = f"{BASE_URL}/vendors/{vendor_id}"

        base_html = _read_index_html()
        return _build_og_html(base_html, title, description, image, url, "profile")
    finally:
        db.close()


def serve_profile_og(profile_id: int) -> Optional[str]:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == profile_id).first()
        if not user:
            return None

        biz = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()
        org = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == user.id).first()

        if biz:
            title = biz.business_name or "Business on Sound It"
            description = (biz.description or "Discover amazing businesses on Sound It.")[:300]
        elif org:
            title = org.organization_name or "Organizer on Sound It"
            description = (org.description or "Discover amazing organizers on Sound It.")[:300]
        else:
            name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            title = name or "Profile on Sound It"
            description = (user.bio or "Discover amazing profiles on Sound It.")[:300]

        image = _make_absolute_url(user.avatar_url)
        url = f"{BASE_URL}/profiles/{profile_id}"

        base_html = _read_index_html()
        return _build_og_html(base_html, title, description, image, url, "profile")
    finally:
        db.close()


def serve_default_og(path: str = "") -> str:
    """Serve the default OG tags for non-entity pages."""
    base_html = _read_index_html()
    title = "Sound It - 5 years of Excellence in Entertainment"
    description = "Discover curated events, artists, and nightlife experiences with Sound It."
    image = f"{BASE_URL}/logo.png"
    url = f"{BASE_URL}/{path}".rstrip("/")
    return _build_og_html(base_html, title, description, image, url, "website")
