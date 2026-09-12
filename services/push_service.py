"""
Push Notification Service — Web Push delivery using pywebpush
"""
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import PushSubscription, Notification
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Lazy import pywebpush to avoid import errors if not installed
try:
    from pywebpush import webpush, WebPushException
    _PYWEBPUSH_AVAILABLE = True
except ImportError:
    _PYWEBPUSH_AVAILABLE = False
    logger.warning("pywebpush not installed. Push notifications will be disabled.")


class PushService:
    def __init__(self, db: Session):
        self.db = db
    
    def send_notification(self, notification: Notification) -> bool:
        """Send push notification to all active devices for this user."""
        
        if not _PYWEBPUSH_AVAILABLE:
            logger.warning("pywebpush not available, skipping push delivery")
            return False
        
        if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys not configured, skipping push delivery")
            return False
        
        subscriptions = self.db.query(PushSubscription).filter(
            PushSubscription.user_id == notification.user_id,
            PushSubscription.is_active == True
        ).all()
        
        if not subscriptions:
            logger.info(f"No active push subscriptions for user {notification.user_id}")
            return False
        
        # Build payload
        img_url = getattr(notification, "image_url", None) or (
            notification.data.get("image_url") if notification.data and isinstance(notification.data, dict) else None
        )
        if img_url:
            img_url = str(img_url).strip()
            if img_url.startswith('/var/www/soundit-uploads/'):
                img_url = img_url.replace('/var/www/soundit-uploads/', '/static/uploads/')
            if img_url.startswith('/'):
                base = (settings.BASE_URL or "https://sounditent.com").rstrip('/')
                img_url = f"{base}{img_url}"
            elif img_url.startswith('http://sounditent.com') or img_url.startswith('http://sounditent.cn'):
                img_url = img_url.replace('http://', 'https://')

        payload = {
            "title": notification.title,
            "body": notification.message,
            "icon": f"{(settings.BASE_URL or 'https://sounditent.com').rstrip('/')}/android-chrome-192x192.png",
            "badge": f"{(settings.BASE_URL or 'https://sounditent.com').rstrip('/')}/android-chrome-192x192.png",
            "tag": str(notification.id),
            "requireInteraction": True,
            "data": {
                "notification_id": notification.id,
                "action_url": self._build_action_url(notification),
                "category": notification.type or "general",
                "image_url": img_url,
                "payload": notification.data
            }
        }
        if img_url:
            payload["image"] = img_url
        
        # Add actions based on notification type (prefix-matched)
        notif_type = (notification.type or "").lower()
        if notif_type == "booking_request":
            payload["actions"] = [
                {"action": "accept", "title": "Accept"},
                {"action": "decline", "title": "Decline"}
            ]
        elif notif_type.startswith("message"):
            payload["actions"] = [
                {"action": "reply", "title": "Reply"},
                {"action": "dismiss", "title": "Dismiss"}
            ]
        
        payload_json = json.dumps(payload)
        any_success = False
        
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth
                        }
                    },
                    data=payload_json,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={
                        "sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}"
                    }
                )
                
                # Success
                sub.last_used = datetime.utcnow()
                sub.failure_count = 0
                any_success = True
                logger.info(f"Push sent to subscription {sub.id}")
                
            except WebPushException as e:
                logger.error(f"Push failed for subscription {sub.id}: {e}")
                sub.failure_count += 1
                if sub.failure_count >= 3:
                    sub.is_active = False
                    logger.warning(f"Deactivated subscription {sub.id} after 3 failures")
            except Exception as e:
                logger.error(f"Unexpected error sending push to {sub.id}: {e}")
                sub.failure_count += 1
        
        self.db.commit()
        return any_success
    
    def subscribe(self, user_id: int, subscription_data: dict) -> PushSubscription:
        """Register a new push subscription from a device."""
        
        endpoint = subscription_data.get("endpoint")
        keys = subscription_data.get("keys", {})
        
        existing = self.db.query(PushSubscription).filter(
            PushSubscription.endpoint == endpoint
        ).first()
        
        if existing:
            existing.user_id = user_id
            existing.p256dh = keys.get("p256dh", existing.p256dh)
            existing.auth = keys.get("auth", existing.auth)
            existing.device_type = subscription_data.get("device_type", existing.device_type)
            existing.browser = subscription_data.get("browser", existing.browser)
            existing.is_active = True
            existing.failure_count = 0
            existing.last_used = datetime.utcnow()
            self.db.commit()
            return existing
        
        new_sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=keys.get("p256dh", ""),
            auth=keys.get("auth", ""),
            device_type=subscription_data.get("device_type", "unknown"),
            browser=subscription_data.get("browser", "unknown")
        )
        
        self.db.add(new_sub)
        self.db.commit()
        self.db.refresh(new_sub)
        return new_sub
    
    def unsubscribe(self, endpoint: str) -> bool:
        """Deactivate a push subscription."""
        sub = self.db.query(PushSubscription).filter(
            PushSubscription.endpoint == endpoint
        ).first()
        
        if sub:
            sub.is_active = False
            self.db.commit()
            return True
        return False
    
    def _build_action_url(self, notification: Notification) -> Optional[str]:
        """Build a deep link URL based on notification type (prefix-matched) and data."""
        data = notification.data or {}
        ntype = (notification.type or "").lower()
        entity_type = data.get("entity_type")
        entity_id = data.get("entity_id")

        if ntype.startswith("message"):
            sender_id = data.get("sender_id")
            if sender_id:
                return f"/messages/{sender_id}"
            return "/messages"
        if ntype.startswith("booking"):
            # New booking requests go to the artist dashboard; updates/replies to the client bookings view
            if ntype == "booking_request":
                return "/dashboard/artist/bookings"
            return "/dashboard/bookings"
        if ntype.startswith(("staff_invite", "staff_invitation")):
            return "/settings"
        if ntype.startswith("ticket_order"):
            return "/dashboard/business/tickets"
        if ntype.startswith("ticket"):
            return "/tickets"
        if ntype.startswith(("product_order", "vendor_order")):
            return "/orders"
        if ntype.startswith("table_booking"):
            return "/dashboard/business/tables"
        if ntype.startswith("verification"):
            return "/verification"
        if ntype.startswith("subscription"):
            return "/subscriptions"
        if ntype.startswith("event"):
            event_id = data.get("event_id") or entity_id
            if event_id:
                return f"/events/{event_id}"
            return "/events"
        if ntype.startswith("follower") or ntype.endswith("_update"):
            if entity_type and entity_id:
                return f"/{entity_type}s/{entity_id}"

        return None
