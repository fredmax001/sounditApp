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
        payload = {
            "title": notification.title,
            "body": notification.message,
            "icon": "/android-chrome-192x192.png",
            "badge": "/android-chrome-192x192.png",
            "tag": str(notification.id),
            "requireInteraction": True,
            "data": {
                "notification_id": notification.id,
                "action_url": self._build_action_url(notification),
                "category": notification.type or "general",
                "payload": notification.data
            }
        }
        
        # Add actions based on notification type
        if notification.type == "booking":
            payload["actions"] = [
                {"action": "accept", "title": "Accept"},
                {"action": "decline", "title": "Decline"}
            ]
        elif notification.type == "message":
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
        """Build a deep link URL based on notification type and data."""
        data = notification.data or {}
        
        if notification.type == "booking":
            return "/dashboard/artist/bookings"
        elif notification.type == "message":
            sender_id = data.get("sender_id")
            if sender_id:
                return f"/messages/{sender_id}"
            return "/messages"
        elif notification.type == "staff_invite":
            return "/settings/notifications"
        elif notification.type == "ticket_order":
            return "/dashboard/business/tickets"
        elif notification.type == "verification":
            return "/verification"
        elif notification.type == "subscription":
            return "/subscriptions"
        elif notification.type == "event":
            event_id = data.get("event_id") or data.get("entity_id")
            if event_id:
                return f"/events/{event_id}"
            return "/events"
        elif notification.type == "follower":
            entity_type = data.get("entity_type")
            entity_id = data.get("entity_id")
            if entity_type and entity_id:
                return f"/{entity_type}s/{entity_id}"
        
        return None
