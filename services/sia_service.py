"""
SIA — Sound It Assistant Service

Core AI logic for the Sound It platform assistant. Handles:
- Natural language chat and platform Q&A
- Event draft extraction from flyer images
- Product draft extraction from menus/catalogs

Design: rule-based extraction by default; optional OpenAI enhancement when
OPENAI_API_KEY is configured. SIA never auto-publishes — all extractions are
saved as AssistantDraft records with status=draft.
"""
import io
import re
import json
import logging
from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field

from config import get_settings

# Optional OCR / image deps (same graceful degradation as menu_import_service.py)
try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

# Optional OpenAI enhancement
try:
    import openai
except ImportError:
    openai = None

from services.menu_import_service import parse_text_menu, MenuItem
from utils.upload_storage import get_upload_dir

logger = logging.getLogger(__name__)
settings = get_settings()


# -----------------------------------------------------------------------------
# Data classes
# -----------------------------------------------------------------------------

@dataclass
class ExtractedEvent:
    title: Optional[str] = None
    title_cn: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None  # ISO date YYYY-MM-DD
    start_time: Optional[str] = None  # HH:MM
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    lineup: List[str] = field(default_factory=list)
    ticket_price: Optional[float] = None
    currency: str = "CNY"
    tags: List[str] = field(default_factory=list)
    event_type: Optional[str] = None
    raw_text: str = ""
    confidence: float = 0.0
    missing_fields: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "title_cn": self.title_cn,
            "description": self.description,
            "start_date": self.start_date,
            "start_time": self.start_time,
            "end_date": self.end_date,
            "end_time": self.end_time,
            "venue": self.venue,
            "address": self.address,
            "city": self.city,
            "lineup": self.lineup,
            "ticket_price": self.ticket_price,
            "currency": self.currency,
            "tags": self.tags,
            "event_type": self.event_type,
            "raw_text": self.raw_text,
            "confidence": self.confidence,
            "missing_fields": self.missing_fields,
        }


@dataclass
class ExtractedProduct:
    name: str
    price: float
    description: Optional[str] = None
    category: Optional[str] = None
    currency: str = "CNY"
    stock_quantity: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "price": self.price,
            "description": self.description,
            "category": self.category,
            "currency": self.currency,
            "stock_quantity": self.stock_quantity,
        }


# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

EVENT_TYPES = ["Party", "Concert", "Festival", "Day Party", "Rooftop Party",
               "Club Night", "Live Music", "DJ Set", "After Party", "Workshop"]

CITY_NAMES = [
    "beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "hangzhou",
    "ningbo", "yiwu", "nanjing", "wuhan", "xian", "chongqing", "suzhou",
    "tianjin", "qingdao", "dalian", "xiamen", "kunming", "changsha",
    "zhengzhou", "harbin", "changchun", "shenyang", "other"
]

# Regex patterns
DATE_PATTERNS = [
    # 2026-06-19, 2026/06/19, 2026.06.19
    (r"\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b", "ymd"),
    # 19-06-2026, 19/06/2026 (European/Chinese style)
    (r"\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b", "dmy"),
    # June 19, 2026 | Jun 19 | 19 June 2026
    (r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(0?[1-9]|[12]\d|3[01])\b(?:,?\s+(20\d{2}))?", "mdy"),
    # 6月19日 | 6月19号 | 六月十九日
    (r"\b(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]\b", "cn_month_day"),
]

TIME_PATTERNS = [
    # 22:00 | 10:00 PM | 10PM | 晚上10点
    (r"\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?\b", "hmm"),
    (r"\b(\d{1,2})\s*(AM|PM|am|pm)\b", "ham"),
    (r"(?:晚上|下午|上午|凌晨)(\d{1,2})\s*[点時](?:\d{1,2})?\s*分?", "cn_period"),
]

PRICE_PATTERNS = [
    r"[¥￥]\s*(\d+(?:\.\d{1,2})?)",
    r"(\d+(?:\.\d{1,2})?)\s*[元圆]",
    r"(?:Ticket|Price|Admission|Entry|Presale|Door|Early)\s*[:：]?\s*[¥￥$]?\s*(\d+(?:\.\d{1,2})?)",
    r"RMB\s*(\d+(?:\.\d{1,2})?)",
    r"CNY\s*(\d+(?:\.\d{1,2})?)",
]

# Headers/labels commonly found on flyers that help identify fields
VENUE_MARKERS = ["venue", "location", "address", "at ", "地点", "地址", "场地"]
LINEUP_MARKERS = ["lineup", "featuring", "feat", "with", "performing", " DJs", " DJ ", "line up", "阵容"]


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _ocr_image(image_bytes: bytes) -> str:
    """Run OCR on image bytes using tesseract (same graceful fallback as menu import)."""
    if Image is None:
        return ""
    if pytesseract is None:
        return ""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        try:
            text = pytesseract.image_to_string(image, lang="eng+chi_sim")
        except Exception:
            text = pytesseract.image_to_string(image, lang="eng")
        return text or ""
    except Exception as e:
        logger.error(f"[SIA OCR] {e}")
        return ""


def _normalize_text(text: str) -> str:
    """Clean OCR output for parsing."""
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        line = line.strip()
        if line:
            cleaned.append(line)
    return "\n".join(cleaned)


def _parse_date(line: str, default_year: int = None) -> Optional[Tuple[str, str]]:
    """Return (iso_date, matched_text) or None."""
    if default_year is None:
        default_year = datetime.now().year

    line_lower = line.lower()
    for pattern, fmt in DATE_PATTERNS:
        match = re.search(pattern, line, re.IGNORECASE)
        if not match:
            continue
        try:
            if fmt == "ymd":
                year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            elif fmt == "dmy":
                day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            elif fmt == "mdy":
                month_str = match.group(1).capitalize()[:3]
                month = datetime.strptime(month_str, "%b").month
                day = int(match.group(2))
                year = int(match.group(3)) if match.group(3) else default_year
            elif fmt == "cn_month_day":
                month, day = int(match.group(1)), int(match.group(2))
                year = default_year
            else:
                continue
            return (f"{year:04d}-{month:02d}-{day:02d}", match.group(0))
        except Exception:
            continue
    return None


def _parse_time(line: str) -> Optional[Tuple[str, str]]:
    """Return (hh:mm, matched_text) or None."""
    for pattern, fmt in TIME_PATTERNS:
        match = re.search(pattern, line, re.IGNORECASE)
        if not match:
            continue
        try:
            if fmt == "hmm":
                hour, minute = int(match.group(1)), int(match.group(2))
                period = (match.group(3) or "").upper()
                if period == "PM" and hour != 12:
                    hour += 12
                if period == "AM" and hour == 12:
                    hour = 0
            elif fmt == "ham":
                hour = int(match.group(1))
                period = match.group(2).upper()
                if period == "PM" and hour != 12:
                    hour += 12
                if period == "AM" and hour == 12:
                    hour = 0
                minute = 0
            elif fmt == "cn_period":
                hour = int(match.group(1))
                minute = 0
            else:
                continue
            if 0 <= hour < 24 and 0 <= minute < 60:
                return (f"{hour:02d}:{minute:02d}", match.group(0))
        except Exception:
            continue
    return None


def _parse_price(line: str) -> Optional[float]:
    """Extract a ticket/price value from text."""
    for pattern in PRICE_PATTERNS:
        match = re.search(pattern, line, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def _detect_city(text: str) -> Optional[str]:
    """Detect city from text (Sound It operates primarily in China cities)."""
    text_lower = text.lower()
    for city in CITY_NAMES:
        if city in text_lower:
            return city
    return None


def _detect_event_type(text: str) -> Optional[str]:
    """Guess event type from keywords."""
    text_lower = text.lower()
    type_keywords = {
        "festival": ["festival", "音乐节"],
        "concert": ["concert", "演唱会"],
        "club night": ["club night", "夜店"],
        "dj set": ["dj set", "dj ", "电音"],
        "day party": ["day party", "pool party"],
        "rooftop party": ["rooftop", "露台"],
        "live music": ["live music", "现场音乐"],
        "party": ["party", "派对"],
    }
    for etype, keywords in type_keywords.items():
        for kw in keywords:
            if kw in text_lower:
                return etype.title()
    return None


def _is_likely_title(line: str) -> bool:
    """Heuristic: title is a prominent non-price, non-date, non-venue line."""
    stripped = line.strip()
    if len(stripped) < 4 or len(stripped) > 80:
        return False
    if re.search(r"\b(tel|phone|address|email|wechat|ticket|price|door|presale)\b", stripped, re.IGNORECASE):
        return False
    if _parse_price(stripped):
        return False
    if _parse_date(stripped):
        return False
    return True


def _detect_venue(line: str) -> Optional[str]:
    """Extract venue/location from a line."""
    text_lower = line.lower()
    for marker in VENUE_MARKERS:
        idx = text_lower.find(marker.lower())
        if idx != -1:
            # Take everything after the marker and clean
            remainder = line[idx + len(marker):].strip(" :-：")
            if remainder and len(remainder) > 2:
                return remainder
    # "at Venue Name" pattern
    match = re.search(r"\bat\s+(.{3,80})\b", line, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None


def _extract_lineup(text: str) -> List[str]:
    """Simple heuristic to extract artist/DJ names from lineup sections."""
    lineup = []
    lines = text.splitlines()
    in_lineup = False
    for line in lines:
        line_stripped = line.strip()
        lower = line_stripped.lower()
        # Trigger lineup section
        for marker in LINEUP_MARKERS:
            if marker.lower().strip() in lower:
                in_lineup = True
                # Remove marker from line and see if name remains
                cleaned = re.sub(re.escape(marker), "", lower, flags=re.IGNORECASE).strip(" :-：")
                if cleaned and len(cleaned) > 2:
                    lineup.append(line_stripped)
                break
        if in_lineup and line_stripped:
            # Collect short lines that look like artist names
            if 2 < len(line_stripped) < 50 and not _parse_price(line_stripped):
                if line_stripped not in lineup:
                    lineup.append(line_stripped)
        # Blank line often ends lineup block
        if in_lineup and not line_stripped:
            in_lineup = False
    return lineup[:15]  # cap


# -----------------------------------------------------------------------------
# Event extraction
# -----------------------------------------------------------------------------

def extract_event_from_flyer(image_bytes: Optional[bytes] = None,
                             text_hint: Optional[str] = None) -> ExtractedEvent:
    """Extract event details from a flyer image or raw text."""
    raw_text = text_hint or ""
    if image_bytes:
        raw_text = _ocr_image(image_bytes)

    raw_text = _normalize_text(raw_text)
    event = ExtractedEvent(raw_text=raw_text)

    if not raw_text.strip():
        event.missing_fields = ["title", "date", "time", "venue"]
        return event

    lines = raw_text.splitlines()

    # Title: take the first plausible long line near the top
    for line in lines[:8]:
        if _is_likely_title(line):
            event.title = line.strip()
            break
    if not event.title:
        for line in lines:
            if _is_likely_title(line):
                event.title = line.strip()
                break

    # Date / time scanning
    for line in lines:
        date_result = _parse_date(line)
        if date_result and not event.start_date:
            event.start_date = date_result[0]
        time_result = _parse_time(line)
        if time_result and not event.start_time:
            event.start_time = time_result[0]

    # Venue
    for line in lines:
        venue = _detect_venue(line)
        if venue:
            event.venue = venue
            break

    # City
    event.city = _detect_city(raw_text)

    # Price
    prices = []
    for line in lines:
        price = _parse_price(line)
        if price and price not in prices:
            prices.append(price)
    if prices:
        event.ticket_price = min(prices)  # prefer lowest/early-bird

    # Event type
    event.event_type = _detect_event_type(raw_text)

    # Lineup
    event.lineup = _extract_lineup(raw_text)

    # Tags
    tags = set()
    if event.event_type:
        tags.add(event.event_type.lower().replace(" ", "-"))
    if event.city:
        tags.add(event.city)
    for kw in ["live", "dj", "electronic", "hip-hop", "rap", "r&b", "house", "techno"]:
        if kw in raw_text.lower():
            tags.add(kw)
    event.tags = list(tags)[:5]

    # Description: compose a short summary
    parts = []
    if event.title:
        parts.append(event.title)
    if event.start_date:
        parts.append(f"Date: {event.start_date}")
    if event.start_time:
        parts.append(f"Time: {event.start_time}")
    if event.venue:
        parts.append(f"Venue: {event.venue}")
    if event.ticket_price:
        parts.append(f"Price: ¥{event.ticket_price}")
    if event.lineup:
        parts.append("Lineup: " + ", ".join(event.lineup[:5]))
    event.description = "\n".join(parts)

    # Missing fields
    if not event.title:
        event.missing_fields.append("title")
    if not event.start_date:
        event.missing_fields.append("date")
    if not event.start_time:
        event.missing_fields.append("time")
    if not event.venue:
        event.missing_fields.append("venue")

    # Confidence heuristic
    score = 0.0
    if event.title:
        score += 0.3
    if event.start_date:
        score += 0.25
    if event.start_time:
        score += 0.15
    if event.venue:
        score += 0.15
    if event.ticket_price:
        score += 0.1
    if event.city:
        score += 0.05
    event.confidence = round(min(score, 1.0), 2)

    return event


# -----------------------------------------------------------------------------
# Product extraction
# -----------------------------------------------------------------------------

def extract_products_from_menu(file_bytes: Optional[bytes] = None,
                               mime_type: Optional[str] = None,
                               text_hint: Optional[str] = None) -> List[ExtractedProduct]:
    """Extract product drafts from image/PDF/text menu."""
    items: List[MenuItem] = []

    if text_hint:
        items = parse_text_menu(text_hint)
    elif file_bytes and mime_type:
        if mime_type.startswith("image/"):
            items = parse_text_menu(_ocr_image(file_bytes))
        elif mime_type == "application/pdf":
            # reuse PDF logic from menu_import_service
            from services.menu_import_service import parse_pdf_menu
            items = parse_pdf_menu(file_bytes)

    products = []
    for item in items:
        products.append(ExtractedProduct(
            name=item.name,
            price=item.price,
            description=item.description,
            category=item.category,
            currency="CNY",
            stock_quantity=0,
        ))
    return products


# -----------------------------------------------------------------------------
# SIA Phase 1 — Smart FAQ + live data chat
# -----------------------------------------------------------------------------

SIA_SYSTEM_PROMPT = """You are SIA — Sound It Assistant. You work for Sound It Entertainment, a platform connecting people with African and global music events, DJs, venues, and experiences in China and beyond.

YOUR JOB:
- Help users navigate the Sound It platform
- Answer questions about events, tickets, accounts, and features
- Recommend events, DJs, and venues based on what's trending
- Solve common customer service issues
- Be warm, helpful, and SPECIFIC — NEVER generic

PERSONALITY:
- Knowledgeable friend who works at Sound It
- Warm but efficient — get to the answer fast
- Uses natural language, not corporate speak
- Acknowledges when you don't know something — then offers to escalate
- Match the user's energy: frustrated = extra helpful, casual = casual back
- NEVER say "I'm just an AI" — you're SIA, part of the team

CRITICAL RULES:
1. READ the user's actual question and answer it DIRECTLY.
2. If you have access to live data, USE IT. Don't say "check the app" when you can just tell them the answer.
3. If you DON'T know something, say so honestly. Offer to connect them to a human or suggest where they might find the info. NEVER make up answers.
4. For customer service issues (payments, refunds, tickets not working): show empathy first, ask 1-2 clarifying questions, offer specific next steps, escalate to human support when needed.
5. For recommendations and discovery: base them on actual data, give 2-3 SPECIFIC options with names, ask follow-up questions to narrow down preferences.
6. Keep small talk brief. Users came to get things done.
7. ALWAYS end with an offer to help further.
8. NEVER respond with just a link — always summarize what they'll find.

RESPONSE FORMAT:
- Keep responses concise (2-4 sentences for simple questions)
- Use line breaks for readability
- Bold important info like **times**, **prices**, **names**
- Use bullet points for step-by-step help
- For event recommendations, include: name, date, venue, price
"""


@dataclass
class ChatResult:
    answer: str
    source: str  # faq, api, ai, fallback
    confidence: float
    intent: str
    suggested_actions: List[str] = field(default_factory=list)
    related_events: List[Dict[str, Any]] = field(default_factory=list)
    escalated: bool = False
    context: Dict[str, Any] = field(default_factory=dict)


def _normalize_message(message: str) -> str:
    return re.sub(r"[^\w\s]", " ", message.lower().strip())


def match_faq(message: str, faqs: List[Any]) -> Optional[Tuple[Any, float]]:
    """Keyword/phrase match against FAQ patterns. Returns (faq, score) or None."""
    if not faqs:
        return None
    norm = _normalize_message(message)
    words = set(norm.split())
    best = None
    best_score = 0.0

    for faq in faqs:
        patterns = faq.question_patterns or []
        score = 0.0
        for pattern in patterns:
            pattern_norm = _normalize_message(pattern)
            if pattern_norm in norm:
                score += 2.0
            pattern_words = set(pattern_norm.split())
            if pattern_words:
                overlap = len(words & pattern_words) / len(pattern_words)
                score += overlap
        if score > best_score:
            best_score = score
            best = faq

    if best_score >= 1.0:
        return best, min(best_score, 1.0)
    return None


def detect_intent(message: str) -> str:
    """Detect user intent from a message."""
    lower = message.lower()
    if any(kw in lower for kw in ["flyer", "poster", "event image", "upload flyer"]):
        return "extract_event"
    if any(kw in lower for kw in ["menu", "product catalog", "upload menu", "import product"]):
        return "extract_products"
    if any(kw in lower for kw in ["refund", "money back", "cancel ticket"]):
        return "refund"
    if any(kw in lower for kw in ["contact organizer", "message organizer", "reach event host", "talk to organizer"]):
        return "contact_organizer"
    if any(kw in lower for kw in ["my ticket", "ticket not", "qr code", "didn't get my ticket", "double charge", "payment failed"]):
        return "ticket_support"
    if any(kw in lower for kw in ["buy ticket", "get ticket", "purchase ticket", "ticket price"]):
        return "tickets"
    if any(kw in lower for kw in ["trending dj", "popular dj", "who's playing"]):
        return "trending_djs"
    if any(kw in lower for kw in ["trending event", "popular event", "what's trending", "sold out"]):
        return "trending_events"
    if any(kw in lower for kw in ["venue", "club", "where is ", "event at "]):
        return "venue"
    if any(kw in lower for kw in ["artist", "dj ", "when is ", "playing next"]):
        return "artist"
    if any(kw in lower for kw in ["this weekend", "tonight", "tomorrow", "happening", "what's on", "upcoming event", "recommend"]):
        return "event_discovery"
    if any(kw in lower for kw in ["subscription", "plan", "pricing", "premium"]):
        return "subscriptions"
    if any(kw in lower for kw in ["vendor", "marketplace", "store", "food vendor"]):
        return "vendors"
    if any(kw in lower for kw in ["account", "login", "sign up", "verify", "profile", "password"]):
        return "account"
    if any(kw in lower for kw in ["support", "help", "contact", "human"]):
        return "support"
    return "general"


def generate_welcome(user_name: Optional[str] = None, mode: str = "public") -> str:
    name_part = f" Hi {user_name}," if user_name else ""
    if mode == "dashboard":
        return (
            f"👋{name_part} I'm **SIA** — your dashboard assistant.\n\n"
            "I can speed up your workflow:\n"
            "• Build an **event draft** from a flyer\n"
            "• Build **product drafts** from a menu\n"
            "• Answer dashboard and platform questions\n\n"
            "Everything stays as a draft until you review and publish."
        )
    return (
        f"👋{name_part} I'm **SIA** — your Sound It Assistant.\n\n"
        "I can help you:\n"
        "• Discover events and buy tickets\n"
        "• Find DJs and venues\n"
        "• Answer platform and account questions\n"
        "• Connect you with support when needed\n\n"
        "What can I help you with today?"
    )


def _extract_date_window(message: str) -> Tuple[Optional[date], Optional[date]]:
    """Extract a date window from relative phrases like 'this weekend', 'tonight'."""
    lower = message.lower()
    today = date.today()
    start = None
    end = None

    if any(kw in lower for kw in ["tonight", "today"]):
        start = today
        end = today
    elif "tomorrow" in lower:
        start = today + timedelta(days=1)
        end = today + timedelta(days=1)
    elif "this weekend" in lower:
        # Saturday and Sunday
        days_until_sat = (5 - today.weekday()) % 7
        start = today + timedelta(days=days_until_sat)
        end = start + timedelta(days=1)
    elif "next week" in lower:
        start = today + timedelta(days=7 - today.weekday())
        end = start + timedelta(days=6)
    elif "this week" in lower:
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)

    return start, end


def _fetch_events(db: Any, start: Optional[date] = None, end: Optional[date] = None,
                  city: Optional[str] = None, genre: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
    """Fetch upcoming events from the database."""
    from models import Event, EventStatus
    from sqlalchemy import or_
    try:
        query = db.query(Event).filter(Event.status == EventStatus.APPROVED)
        if start:
            query = query.filter(Event.start_date >= datetime.combine(start, datetime.min.time()))
        if end:
            query = query.filter(Event.start_date <= datetime.combine(end, datetime.max.time()))
        if city:
            query = query.filter(or_(Event.city.ilike(city), Event.address.ilike(f"%{city}%")))
        if genre:
            query = query.filter(or_(
                Event.event_type.ilike(f"%{genre}%"),
                Event.tags.contains([genre]),
                Event.title.ilike(f"%{genre}%"),
                Event.description.ilike(f"%{genre}%")
            ))
        events = query.order_by(Event.start_date.asc()).limit(limit).all()
        return [_event_to_dict(e) for e in events]
    except Exception as e:
        logger.warning(f"[SIA] fetch events failed: {e}")
        return []


def _event_to_dict(event: Any) -> Dict[str, Any]:
    return {
        "id": event.id,
        "title": event.title,
        "start_date": event.start_date.strftime("%Y-%m-%d") if event.start_date else None,
        "start_time": event.start_date.strftime("%H:%M") if event.start_date else None,
        "venue": event.address or getattr(event.venue, "name", None) if hasattr(event, "venue") else event.address,
        "city": event.city.value if event.city else None,
        "ticket_price": float(event.ticket_price) if event.ticket_price else None,
        "currency": "CNY",
        "cover_image": event.cover_image,
    }


def _fetch_trending_events(db: Any, limit: int = 3) -> List[Dict[str, Any]]:
    """Fetch trending events by views/saves."""
    from models import Event, EventStatus
    try:
        events = db.query(Event).filter(
            Event.status == EventStatus.APPROVED,
            Event.start_date >= datetime.utcnow()
        ).order_by(Event.views.desc().nullslast()).limit(limit).all()
        return [_event_to_dict(e) for e in events]
    except Exception as e:
        logger.warning(f"[SIA] fetch trending events failed: {e}")
        return []


def _fetch_user_tickets(db: Any, user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
    """Fetch user's recent ticket orders."""
    from models import TicketOrder
    try:
        orders = db.query(TicketOrder).filter(
            TicketOrder.user_id == user_id
        ).order_by(TicketOrder.created_at.desc()).limit(limit).all()
        result = []
        for order in orders:
            event = getattr(order, "event", None)
            result.append({
                "order_id": order.id,
                "status": order.status.value if order.status else None,
                "quantity": order.quantity,
                "total_amount": float(order.total_amount) if order.total_amount else None,
                "event_title": event.title if event else None,
                "event_date": event.start_date.strftime("%Y-%m-%d") if event and event.start_date else None,
            })
        return result
    except Exception as e:
        logger.warning(f"[SIA] fetch user tickets failed: {e}")
        return []


def _fetch_venues(db: Any, city: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
    """Fetch venues."""
    from models import Venue
    try:
        query = db.query(Venue)
        if city:
            query = query.filter(Venue.city.ilike(city))
        venues = query.limit(limit).all()
        return [{
            "id": v.id,
            "name": v.name,
            "address": v.address,
            "city": v.city.value if v.city else None,
            "category": v.category,
        } for v in venues]
    except Exception as e:
        logger.warning(f"[SIA] fetch venues failed: {e}")
        return []


def _fetch_artists(db: Any, limit: int = 5) -> List[Dict[str, Any]]:
    """Fetch artist/DJ profiles."""
    from models import ArtistProfile
    try:
        artists = db.query(ArtistProfile).limit(limit).all()
        return [{
            "id": a.id,
            "name": a.artist_name or a.stage_name,
            "genre": a.genre,
            "bio": (a.bio or "")[:120],
        } for a in artists]
    except Exception as e:
        logger.warning(f"[SIA] fetch artists failed: {e}")
        return []


def _build_data_response(intent: str, data: Any, message: str) -> Optional[str]:
    """Build a natural language response from live data."""
    if intent in ("event_discovery", "trending_events"):
        events = data.get("events", [])
        if not events:
            return "I don't see any upcoming events matching that right now. New events get added all the time — want me to let you know when something drops?"
        lines = ["Here are some events I found:"]
        for e in events[:3]:
            price = f"¥{int(e['ticket_price'])}" if e.get("ticket_price") else "Price on page"
            lines.append(f"• **{e['title']}** — {e['start_date']} at {e['venue'] or 'TBA'} ({price})")
        lines.append("Want details on any of these?")
        return "\n".join(lines)

    if intent == "tickets":
        return (
            "Here's how to buy tickets:\n"
            "1. Find the event and tap the ticket price\n"
            "2. Select how many tickets\n"
            "3. Pay with WeChat Pay or AliPay\n"
            "4. Your tickets appear in 'My Tickets'\n\n"
            "Want me to recommend an event first?"
        )

    if intent == "ticket_support":
        return (
            "Sorry about that — let's figure it out.\n"
            "• Check 'My Tickets' in your profile first\n"
            "• If the QR isn't scanning, try a screenshot and make sure your brightness is up\n"
            "• For payment issues, check if you got charged twice\n\n"
            "Tell me more about what's happening and I'll help or escalate it."
        )

    if intent == "refund":
        return (
            "Refund policies are set by each event organizer. I can put you in touch with them directly, "
            "or if it's a platform issue (double charge, wrong event), our support team can step in. "
            "Which situation applies to you?"
        )

    if intent == "contact_organizer":
        return (
            "On the event page, tap the organizer's name — there should be a 'Message' or 'Contact' button. "
            "If it's not there, the organizer might have disabled direct messages. "
            "Which event are you trying to reach them about?"
        )

    if intent == "venue":
        venues = data.get("venues", [])
        if not venues:
            return "I don't have venues matching that. Want me to show popular venues in Shanghai instead?"
        lines = ["Here are some venues:"]
        for v in venues[:3]:
            lines.append(f"• **{v['name']}** — {v['address']}")
        return "\n".join(lines)

    if intent == "artist":
        artists = data.get("artists", [])
        if not artists:
            return "I don't see that artist on the platform. Want me to suggest some trending DJs?"
        lines = ["Here are some artists/DJs on Sound It:"]
        for a in artists[:3]:
            lines.append(f"• **{a['name']}** — {a['genre'] or 'DJ/Artist'}")
        return "\n".join(lines)

    if intent == "trending_djs":
        artists = data.get("artists", [])
        if not artists:
            return "I can check trending DJs for you. Are you looking for a specific genre?"
        lines = ["Here are some DJs getting attention right now:"]
        for a in artists[:3]:
            lines.append(f"• **{a['name']}** — {a['genre'] or 'DJ'}")
        return "\n".join(lines)

    if intent == "vendors":
        return (
            "Visit the Marketplace to browse vendor products, or open your vendor dashboard "
            "to manage your store, orders, and payments. Want me to take you to either?"
        )

    if intent == "subscriptions":
        return (
            "Sound It offers subscription plans for businesses, vendors, and artists. "
            "Each tier unlocks more features. Check the 'Subscriptions' section in your profile for current pricing and features."
        )

    if intent == "account":
        return (
            "I can help with account issues. Try the 'Settings' section in your profile for password resets, "
            "profile edits, and verification. If you're locked out, let me know your phone number and I can flag it for support."
        )

    if intent == "support":
        return (
            "I can handle most questions, but if you need a human, reach our support team through the 'Help' section in your profile. "
            "For urgent issues at an event, check your ticket for the emergency contact."
        )

    return None


def process_chat_message(
    message: str,
    user: Any,
    db: Any,
    history: Optional[List[Dict[str, str]]] = None,
    user_context: Optional[Dict[str, Any]] = None,
    faqs: Optional[List[Any]] = None,
    mode: str = "public"
) -> ChatResult:
    """
    Main SIA chat processor.

    Flow: FAQ match → intent detection → live data query → response generation.
    Falls back to OpenAI if configured, otherwise uses rule-based responses.
    Logs unanswered questions for admin review.
    """
    from models import AssistantFAQ, AssistantUnansweredQuestion

    history = history or []
    user_context = user_context or {}

    # 1. FAQ matching
    if faqs is None and db is not None:
        try:
            faqs = db.query(AssistantFAQ).all()
        except Exception as e:
            logger.warning(f"[SIA] Failed to load FAQs: {e}")
            faqs = []

    # 2. Intent detection (run before FAQ so specific data requests can bypass generic FAQ answers)
    intent = detect_intent(message)
    start, end = _extract_date_window(message)
    has_specific_request = intent not in ("general", "support") or start is not None

    faq_match = match_faq(message, faqs or [])
    if faq_match:
        faq, score = faq_match
        # If the user asks something specific (e.g. "this weekend") and the FAQ is only a partial match,
        # prefer live data instead of a generic FAQ answer.
        if not has_specific_request or score >= 2.0:
            try:
                faq.usage_count = (faq.usage_count or 0) + 1
                db.commit()
            except Exception:
                pass
            return ChatResult(
                answer=faq.answer,
                source="faq",
                confidence=score,
                intent=intent,
                suggested_actions=["Find events", "Buy tickets", "Contact support"]
            )

    # 3. Live data queries
    data: Dict[str, Any] = {}
    start, end = _extract_date_window(message)
    city = user_context.get("city")
    genre = None
    if "afrobeats" in message.lower():
        genre = "afrobeats"
    elif "amapiano" in message.lower():
        genre = "amapiano"
    elif "rnb" in message.lower() or "r&b" in message.lower():
        genre = "rnb"
    elif "hip hop" in message.lower() or "hiphop" in message.lower():
        genre = "hiphop"

    if intent in ("event_discovery", "trending_events"):
        if intent == "trending_events":
            data["events"] = _fetch_trending_events(db)
        else:
            data["events"] = _fetch_events(db, start=start, end=end, city=city, genre=genre)
    elif intent == "tickets":
        data["events"] = _fetch_events(db, start=date.today(), limit=3)
    elif intent == "ticket_support" and user:
        data["tickets"] = _fetch_user_tickets(db, user.id)
    elif intent == "venue":
        data["venues"] = _fetch_venues(db, city=city)
    elif intent in ("artist", "trending_djs"):
        data["artists"] = _fetch_artists(db)

    # 4. Rule-based response from live data
    rule_answer = _build_data_response(intent, data, message)

    # 5. OpenAI enhancement (if enabled)
    ai_answer = None
    if settings.OPENAI_API_KEY:
        context_block = ""
        if data:
            context_block = f"\n\nLIVE PLATFORM DATA:\n{json.dumps(data, ensure_ascii=False, default=str)[:1500]}"
        ai_messages = history[-6:] + [{"role": "user", "content": message + context_block}]
        ai_answer = openai_chat_reply(ai_messages)

    answer = ai_answer or rule_answer or generate_response(intent, message, user.role.value if user else None)
    source = "ai" if ai_answer else ("api" if rule_answer else "fallback")
    confidence = 0.9 if ai_answer else (0.8 if rule_answer else 0.5)

    # 6. Log unanswered/escalation-worthy questions
    escalated = False
    if intent == "general" and not ai_answer and not rule_answer:
        escalated = True
        try:
            db.add(AssistantUnansweredQuestion(
                user_id=user.id if user else None,
                question=message,
                context=json.dumps(user_context, ensure_ascii=False, default=str)[:1000]
            ))
            db.commit()
        except Exception as e:
            logger.warning(f"[SIA] Failed to log unanswered question: {e}")
        answer = (
            "That's a good question — I don't have the answer to that right now. "
            "Let me connect you with someone who can help, or I can make a note to get this answered and follow up with you. "
            "Which would you prefer?"
        )
        source = "fallback"
        confidence = 0.3

    suggested_actions = []
    if intent in ("event_discovery", "trending_events"):
        suggested_actions = ["This weekend", "Afrobeats events", "Trending DJs"]
    elif intent == "tickets":
        suggested_actions = ["Recommend an event", "Refund policy", "My tickets"]
    elif intent == "refund":
        suggested_actions = ["Contact organizer", "Support"]
    elif intent == "ticket_support":
        suggested_actions = ["My tickets", "Contact support"]
    elif intent == "general":
        suggested_actions = ["Find events", "How do I buy tickets?", "Contact support"]

    related_events = data.get("events", [])[:3]

    return ChatResult(
        answer=answer,
        source=source,
        confidence=confidence,
        intent=intent,
        suggested_actions=suggested_actions,
        related_events=related_events,
        escalated=escalated,
        context=data
    )


def generate_response(intent: str, message: str, user_role: Optional[str] = None) -> str:
    """Generate a natural language response for general/platform questions."""
    if intent == "extract_event":
        return (
            "Sure! Upload your event flyer or poster and I'll extract the title, date, time, "
            "venue, lineup, pricing, and tags. I'll save it as a draft for you to review."
        )
    if intent == "extract_products":
        return (
            "Great! Upload a photo or PDF of your menu/product list, or paste the text. "
            "I'll extract products with prices and categories and save them as drafts."
        )
    # General fallback
    return (
        "I'm SIA, your Sound It Assistant. Ask me about events, tickets, DJs, venues, "
        "or upload a flyer/menu and I'll help you out. What can I do for you?"
    )


# -----------------------------------------------------------------------------
# Optional OpenAI enhancement
# -----------------------------------------------------------------------------

def _openai_client():
    if openai is None:
        return None
    key = settings.OPENAI_API_KEY
    if not key:
        return None
    return openai.OpenAI(api_key=key)


def enhance_event_with_openai(raw_text: str) -> Optional[Dict[str, Any]]:
    """Optional GPT-based refinement of event extraction."""
    client = _openai_client()
    if not client:
        return None
    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a structured data extractor for event flyers. Return only valid JSON."},
                {"role": "user", "content": (
                    f"Extract event details from this flyer OCR text and return JSON with keys: "
                    f"title, title_cn, description, start_date (YYYY-MM-DD), start_time (HH:MM), "
                    f"end_date, end_time, venue, address, city, lineup (list), ticket_price (number), "
                    f"currency, tags (list), event_type. If a value is unknown, use null.\n\n{raw_text}"
                )}
            ],
            temperature=0.2,
            max_tokens=800,
        )
        content = response.choices[0].message.content
        # Strip markdown code fences if present
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
        return json.loads(content)
    except Exception as e:
        logger.warning(f"[SIA OpenAI] enhancement failed: {e}")
        return None


def enhance_products_with_openai(raw_text: str) -> Optional[List[Dict[str, Any]]]:
    """Optional GPT-based refinement of product extraction."""
    client = _openai_client()
    if not client:
        return None
    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a structured data extractor for menus. Return only valid JSON array."},
                {"role": "user", "content": (
                    f"Extract product items from this menu text and return a JSON array of objects with "
                    f"keys: name, price (number), description, category, currency (default CNY). "
                    f"If a value is unknown, use null.\n\n{raw_text}"
                )}
            ],
            temperature=0.2,
            max_tokens=1200,
        )
        content = response.choices[0].message.content
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.MULTILINE)
        return json.loads(content)
    except Exception as e:
        logger.warning(f"[SIA OpenAI] product enhancement failed: {e}")
        return None


def openai_chat_reply(messages: List[Dict[str, str]]) -> Optional[str]:
    """Optional GPT-based chat reply using the official SIA system prompt."""
    client = _openai_client()
    if not client:
        return None
    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "system", "content": SIA_SYSTEM_PROMPT}] + messages,
            temperature=0.7,
            max_tokens=600,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"[SIA OpenAI] chat failed: {e}")
        return None
