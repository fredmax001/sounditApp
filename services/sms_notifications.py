"""
SMS Notification Service
Sends transactional SMS notifications for ticket orders, welcomes, and alerts
via Alibaba Cloud SMS (direct or marketplace).
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session

from config import get_settings
from services.alibaba_sms import send_sms_alibaba, send_sms_via_marketplace

settings = get_settings()
logger = logging.getLogger(__name__)


# ─── Helper ───

def _send_sms_safe(
    phone_number: str,
    template_code: str,
    template_param: dict,
    fallback_message: str = None
) -> dict:
    """
    Send SMS safely — never raises, always returns a result dict.
    Tries direct Alibaba SMS first, then marketplace fallback.
    """
    if not phone_number:
        return {"success": False, "message": "No phone number provided"}

    # Normalize phone: keep digits and leading +
    phone = phone_number.strip()
    if not phone.startswith("+") and not phone.startswith("00"):
        # Assume China mobile if no country code and starts with 1
        if phone.startswith("1") and len(phone) == 11:
            phone = "+86" + phone
        else:
            phone = "+86" + phone.lstrip("0")

    # If no template code configured, try raw marketplace send if we have AppCode
    if not template_code:
        if settings.ALIBABA_APP_CODE and fallback_message:
            return _send_raw_sms_marketplace(phone, fallback_message)
        return {"success": False, "message": "SMS template code not configured"}

    try:
        # Try direct Alibaba Cloud SMS (requires AccessKey + registered template)
        result = send_sms_alibaba(phone, template_code, template_param)
        if result.get("success"):
            logger.info(f"SMS sent via Alibaba direct to {phone}")
            return result
        # If direct failed with template-related error, try marketplace
        err_msg = str(result.get("message", ""))
        if "template" in err_msg.lower() or "sign" in err_msg.lower():
            logger.warning(f"Direct SMS failed: {err_msg}, trying marketplace")
        else:
            return result
    except Exception as e:
        logger.warning(f"Direct SMS exception: {e}")

    # Fallback: marketplace API (uses AppCode)
    if settings.ALIBABA_APP_CODE:
        try:
            result = send_sms_via_marketplace(phone, template_code, template_param)
            if result.get("success"):
                logger.info(f"SMS sent via Alibaba marketplace to {phone}")
            return result
        except Exception as e:
            logger.warning(f"Marketplace SMS exception: {e}")
            return {"success": False, "message": f"Marketplace SMS failed: {e}"}

    return {"success": False, "message": "SMS delivery failed"}


def _send_raw_sms_marketplace(phone_number: str, message: str) -> dict:
    """
    Attempt to send raw text SMS via Alibaba marketplace (no template needed).
    Not all marketplace products support this — falls back gracefully.
    """
    import requests
    app_code = settings.ALIBABA_APP_CODE
    if not app_code:
        return {"success": False, "message": "No AppCode configured for raw SMS"}

    phone = phone_number.lstrip("+")

    # Common marketplace raw SMS endpoint patterns
    endpoints = [
        "https://sms.market.alicloudapi.com/sendSingleSms",
        "https://sms.market.alicloudapi.com/sendSms",
        "https://smsapi.aliyuncs.com/send",
    ]

    for url in endpoints:
        try:
            headers = {
                "Authorization": f"APPCODE {app_code}",
                "Content-Type": "application/json",
            }
            payload = {
                "phone": phone,
                "message": message,
                "signName": settings.ALIBABA_SMS_SIGN_NAME or "SoundIt",
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") or data.get("Code") == "OK":
                    logger.info(f"Raw SMS sent to {phone} via {url}")
                    return {"success": True, "message": "SMS sent", "response": data}
        except Exception:
            continue

    return {"success": False, "message": "Raw SMS not supported by marketplace product"}


# ─── Public Notification Functions ───

def send_sms_ticket_approved(
    phone_number: str,
    event_title: str,
    quantity: int = 1,
    ticket_code: str = None
) -> dict:
    """Send ticket purchase confirmation SMS."""
    template_code = settings.ALIBABA_SMS_TEMPLATE_CODE_TICKET_APPROVED or settings.ALIBABA_SMS_TEMPLATE_CODE

    template_param = {
        "event": event_title[:30],
        "quantity": str(quantity),
        "code": ticket_code or "",
    }

    fallback = (
        f"【SoundIt】Ticket confirmed! {event_title[:20]} "
        f"x{quantity}. Check your tickets at sounditent.com/tickets"
    )

    return _send_sms_safe(phone_number, template_code, template_param, fallback)


def send_sms_ticket_rejected(
    phone_number: str,
    event_title: str,
    reason: str = None
) -> dict:
    """Send ticket order rejection SMS."""
    template_code = settings.ALIBABA_SMS_TEMPLATE_CODE_TICKET_REJECTED or settings.ALIBABA_SMS_TEMPLATE_CODE

    template_param = {
        "event": event_title[:30],
        "reason": (reason or "Payment verification failed")[:50],
    }

    fallback = (
        f"【SoundIt】Ticket request for {event_title[:20]} was not approved. "
        f"Reason: {reason or 'Payment verification failed'}. Contact support for help."
    )

    return _send_sms_safe(phone_number, template_code, template_param, fallback)


def send_sms_order_cancelled(
    phone_number: str,
    event_title: str = None
) -> dict:
    """Send ticket order cancellation SMS (stale orders)."""
    template_code = settings.ALIBABA_SMS_TEMPLATE_CODE_TICKET_REJECTED or settings.ALIBABA_SMS_TEMPLATE_CODE

    template_param = {
        "event": (event_title or "your event")[:30],
        "reason": "Payment not confirmed in time",
    }

    fallback = (
        f"【SoundIt】Your ticket order for {(event_title or 'the event')[:20]} "
        f"was cancelled — payment was not confirmed in time. You can place a new order."
    )

    return _send_sms_safe(phone_number, template_code, template_param, fallback)


def send_sms_welcome(
    phone_number: str,
    first_name: str = None
) -> dict:
    """Send welcome SMS to newly registered users."""
    template_code = settings.ALIBABA_SMS_TEMPLATE_CODE_WELCOME or settings.ALIBABA_SMS_TEMPLATE_CODE

    name = first_name or "there"
    template_param = {
        "name": name[:20],
    }

    fallback = (
        f"【SoundIt】Welcome to SoundIt, {name}! "
        f"Discover events, artists, and venues at sounditent.com"
    )

    return _send_sms_safe(phone_number, template_code, template_param, fallback)


def send_sms_event_reminder(
    phone_number: str,
    event_title: str,
    event_date: str,
    venue: str = None
) -> dict:
    """Send event reminder SMS."""
    template_code = settings.ALIBABA_SMS_TEMPLATE_CODE_EVENT_REMINDER or settings.ALIBABA_SMS_TEMPLATE_CODE

    template_param = {
        "event": event_title[:30],
        "date": event_date[:30],
        "venue": (venue or "")[:30],
    }

    venue_text = f" at {venue}" if venue else ""
    fallback = (
        f"【SoundIt】Reminder: {event_title[:20]}{venue_text} "
        f"on {event_date[:20]}. See you there!"
    )

    return _send_sms_safe(phone_number, template_code, template_param, fallback)


# ─── Batch / Convenience ───

def notify_user_ticket_approved(
    db: Session,
    user_id: int,
    event_title: str,
    quantity: int = 1,
    ticket_code: str = None
):
    """Fetch user's phone and send ticket approval SMS (non-blocking)."""
    try:
        from models import User
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.phone:
            result = send_sms_ticket_approved(user.phone, event_title, quantity, ticket_code)
            if not result.get("success"):
                logger.warning(f"Ticket approval SMS failed for user {user_id}: {result.get('message')}")
    except Exception as e:
        logger.warning(f"Failed to send ticket approval SMS: {e}")


def notify_user_ticket_rejected(
    db: Session,
    user_id: int,
    event_title: str,
    reason: str = None
):
    """Fetch user's phone and send ticket rejection SMS (non-blocking)."""
    try:
        from models import User
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.phone:
            result = send_sms_ticket_rejected(user.phone, event_title, reason)
            if not result.get("success"):
                logger.warning(f"Ticket rejection SMS failed for user {user_id}: {result.get('message')}")
    except Exception as e:
        logger.warning(f"Failed to send ticket rejection SMS: {e}")


def notify_user_order_cancelled(
    db: Session,
    user_id: int,
    event_title: str = None
):
    """Fetch user's phone and send order cancellation SMS (non-blocking)."""
    try:
        from models import User
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.phone:
            result = send_sms_order_cancelled(user.phone, event_title)
            if not result.get("success"):
                logger.warning(f"Order cancellation SMS failed for user {user_id}: {result.get('message')}")
    except Exception as e:
        logger.warning(f"Failed to send order cancellation SMS: {e}")
