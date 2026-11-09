"""
Sound It - Complete Time Zone Intelligence Service
Handles IANA time zones, UTC conversion, daylight saving transitions,
and strict quiet hours enforcement.
"""
from datetime import datetime, timezone, time, timedelta
from typing import Optional, Tuple
import zoneinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import logging

logger = logging.getLogger("soundit.timezone_service")

# Common IANA timezones across Sound It userbase
SUPPORTED_TIMEZONES = [
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Asia/Dubai",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Africa/Freetown",
    "Africa/Lagos",
    "Africa/Accra",
    "Africa/Nairobi",
    "Africa/Johannesburg",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "America/Toronto",
    "Australia/Sydney",
    "UTC",
]

DEFAULT_TIMEZONE = "Asia/Shanghai"

def is_valid_timezone(tz_name: Optional[str]) -> bool:
    """Returns True if tz_name is a valid IANA time zone identifier."""
    if not tz_name or not isinstance(tz_name, str):
        return False
    try:
        ZoneInfo(tz_name.strip())
        return True
    except (ZoneInfoNotFoundError, ValueError, Exception):
        return False


def validate_iana_timezone(tz_name: Optional[str]) -> str:
    """Validates that a time zone string is a recognized IANA zone, fallback to Asia/Shanghai."""
    if not tz_name:
        return DEFAULT_TIMEZONE
    clean = tz_name.strip()
    try:
        zoneinfo.ZoneInfo(clean)
        return clean
    except Exception:
        logger.warning(f"Invalid IANA timezone '{clean}', defaulting to {DEFAULT_TIMEZONE}")
        return DEFAULT_TIMEZONE

def utc_to_local(dt_utc: datetime, tz_str: str) -> datetime:
    """Converts a UTC datetime to user's local datetime according to IANA timezone."""
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    target_zone = zoneinfo.ZoneInfo(validate_iana_timezone(tz_str))
    return dt_utc.astimezone(target_zone)

def local_to_utc(dt_local: datetime, tz_str: str) -> datetime:
    """Converts a user's local datetime to standard UTC datetime."""
    target_zone = zoneinfo.ZoneInfo(validate_iana_timezone(tz_str))
    if dt_local.tzinfo is None:
        dt_local = dt_local.replace(tzinfo=target_zone)
    return dt_local.astimezone(timezone.utc)

def parse_time_str(t_str: Optional[str], default_time: time) -> time:
    """Parses 'HH:MM' string into time object."""
    if not t_str:
        return default_time
    try:
        parts = t_str.strip().split(":")
        return time(hour=int(parts[0]), minute=int(parts[1]))
    except Exception:
        return default_time

def _is_in_quiet_hours_raw(
    utc_now: datetime,
    user_tz_str: str,
    quiet_start_str: Optional[str] = "22:00",
    quiet_end_str: Optional[str] = "08:00",
) -> bool:
    local_now = utc_to_local(utc_now, user_tz_str)
    current_time = local_now.time()

    start_t = parse_time_str(quiet_start_str, time(22, 0))
    end_t = parse_time_str(quiet_end_str, time(8, 0))

    if start_t > end_t:
        return current_time >= start_t or current_time < end_t
    else:
        return start_t <= current_time < end_t


def is_in_quiet_hours(
    arg1,
    arg2,
    arg3 = None,
    quiet_end_str: Optional[str] = "08:00",
) -> bool:
    """
    Polymorphic quiet hours checker:
    Accepts: is_in_quiet_hours(db, user_id, utc_now) OR is_in_quiet_hours(utc_now, user_tz_str, ...)
    """
    from sqlalchemy.orm import Session
    from models import User, NotificationPreference

    if isinstance(arg1, Session):
        db = arg1
        user_id = arg2
        utc_now = arg3 or datetime.utcnow()
        user = db.query(User).filter(User.id == user_id).first()
        tz_str = getattr(user, "timezone", "Asia/Shanghai") or "Asia/Shanghai"
        pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        if pref and not getattr(pref, "quiet_hours_enabled", True):
            return False
        q_start = getattr(pref, "quiet_hours_start", "22:00") or "22:00"
        q_end = getattr(pref, "quiet_hours_end", "08:00") or "08:00"
        return _is_in_quiet_hours_raw(utc_now, tz_str, q_start, q_end)
    else:
        utc_now = arg1
        user_tz_str = arg2
        quiet_start_str = arg3 or "22:00"
        return _is_in_quiet_hours_raw(utc_now, user_tz_str, quiet_start_str, quiet_end_str)


def _get_next_suitable_delivery_utc_raw(
    utc_now: datetime,
    user_tz_str: str,
    preferred_hour: int = 18,
    quiet_start_str: Optional[str] = "22:00",
    quiet_end_str: Optional[str] = "08:00",
) -> datetime:
    local_now = utc_to_local(utc_now, user_tz_str)
    
    if not _is_in_quiet_hours_raw(utc_now, user_tz_str, quiet_start_str, quiet_end_str):
        return utc_now

    end_t = parse_time_str(quiet_end_str, time(8, 0))
    target_hour = max(end_t.hour + 1, min(preferred_hour, 21))
    
    target_date = local_now.date()
    if local_now.time() >= parse_time_str(quiet_start_str, time(22, 0)):
        target_date = target_date + timedelta(days=1)

    target_local = datetime(
        year=target_date.year,
        month=target_date.month,
        day=target_date.day,
        hour=target_hour,
        minute=0,
        second=0,
        tzinfo=zoneinfo.ZoneInfo(validate_iana_timezone(user_tz_str)),
    )
    return local_to_utc(target_local, user_tz_str)


def get_next_suitable_delivery_utc(
    arg1,
    arg2,
    arg3 = None,
    preferred_hour: int = 18,
    quiet_start_str: Optional[str] = "22:00",
    quiet_end_str: Optional[str] = "08:00",
    **kwargs,
) -> datetime:
    """
    Polymorphic delivery scheduler:
    Accepts: get_next_suitable_delivery_utc(db, user_id, utc_now) OR (utc_now, user_tz_str, ...)
    """
    from sqlalchemy.orm import Session
    from models import User, NotificationPreference

    if isinstance(arg1, Session):
        db = arg1
        user_id = arg2
        utc_now = arg3 or datetime.utcnow()
        user = db.query(User).filter(User.id == user_id).first()
        tz_str = getattr(user, "timezone", "Asia/Shanghai") or "Asia/Shanghai"
        pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        pref_hour = getattr(pref, "preferred_delivery_hour", 18) or 18
        q_start = getattr(pref, "quiet_hours_start", "22:00") or "22:00"
        q_end = getattr(pref, "quiet_hours_end", "08:00") or "08:00"
        return _get_next_suitable_delivery_utc_raw(utc_now, tz_str, pref_hour, q_start, q_end)
    else:
        utc_now = arg1
        user_tz_str = arg2
        pref_hour = arg3 if isinstance(arg3, int) else 18
        return _get_next_suitable_delivery_utc_raw(utc_now, user_tz_str, pref_hour, quiet_start_str, quiet_end_str)

    return target_local.astimezone(timezone.utc)
