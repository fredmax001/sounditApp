"""
Push Notification Service, Web Push delivery using pywebpush
"""
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import PushSubscription, NativePushToken, Notification
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
        """Send push notification to active iOS (APNs), Android (FCM), and Web/PWA devices for this user."""
        ios_sent = self._send_apns(notification)
        android_sent = self._send_fcm(notification)
        native_sent = ios_sent or android_sent
        
        if not _PYWEBPUSH_AVAILABLE:
            logger.warning("pywebpush not available, skipping web push delivery")
            return native_sent
        
        if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys not configured, skipping web push delivery")
            return native_sent
        
        subscriptions = self.db.query(PushSubscription).filter(
            PushSubscription.user_id == notification.user_id,
            PushSubscription.is_active == True
        ).all()
        
        if not subscriptions:
            logger.info(f"No active push subscriptions for user {notification.user_id}")
            return native_sent
        
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
        any_success = native_sent
        
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
                status_code = getattr(getattr(e, "response", None), "status_code", None)
                logger.error(f"Push failed for subscription {sub.id} (status={status_code}): {e}")
                sub.failure_count += 1
                if status_code in (404, 410) or sub.failure_count >= 3:
                    sub.is_active = False
                    logger.warning(f"Deactivated expired/failing subscription {sub.id} (status={status_code}, failures={sub.failure_count})")
            except Exception as e:
                logger.error(f"Unexpected error sending push to {sub.id}: {e}")
                sub.failure_count += 1
        
        self.db.commit()
        return any_success

    def _send_apns(self, notification: Notification) -> bool:
        """Send an APNs alert to active native iOS tokens when credentials exist."""
        tokens = self.db.query(NativePushToken).filter(
            NativePushToken.user_id == notification.user_id,
            NativePushToken.platform == "ios",
            NativePushToken.is_active == True,
        ).all()
        if not tokens:
            return False
        if not (settings.APNS_KEY_ID and settings.APNS_TEAM_ID and settings.APNS_AUTH_KEY):
            logger.warning("APNs credentials are not configured; iOS push delivery skipped")
            return False
        try:
            import time
            import jwt
            import httpx
            key = settings.APNS_AUTH_KEY.replace('\\n', '\n')
            bearer = jwt.encode(
                {"iss": settings.APNS_TEAM_ID, "iat": int(time.time())},
                key, algorithm="ES256", headers={"kid": settings.APNS_KEY_ID},
            )
        except Exception:
            logger.exception("APNs JWT dependencies or credentials are invalid")
            return False

        host = "https://api.sandbox.push.apple.com" if settings.APNS_USE_SANDBOX else "https://api.push.apple.com"
        action_url = self._build_action_url(notification) or f"/notifications/{notification.id}"
        payload = {
            "aps": {
                "alert": {"title": notification.title, "body": notification.message},
                "sound": "default",
                "badge": self._unread_count(notification.user_id),
                "mutable-content": 1,
            },
            "notification_id": notification.id,
            "action_url": action_url,
            "url": action_url,
            "category": notification.type or "general",
        }
        sent = False
        now = datetime.utcnow()
        with httpx.Client(http2=True, timeout=10) as client:
            for row in tokens:
                try:
                    response = client.post(
                        f"{host}/3/device/{row.token}", json=payload,
                        headers={
                            "authorization": f"bearer {bearer}",
                            "apns-topic": settings.APNS_BUNDLE_ID,
                            "apns-push-type": "alert",
                            "apns-priority": "10",
                        },
                    )
                    if response.status_code == 200:
                        sent = True
                        row.failure_count = 0
                        row.last_used_at = now
                    elif response.status_code == 410 or (
                        response.status_code == 400 and any(r in response.text for r in ("BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"))
                    ):
                        row.is_active = False
                        logger.info("Deactivated expired/invalid APNs token id=%s status=%s", row.id, response.status_code)
                    else:
                        row.failure_count = (row.failure_count or 0) + 1
                        if row.failure_count >= 5:
                            row.is_active = False
                        logger.warning("APNs rejected token id=%s status=%s body=%s", row.id, response.status_code, response.text[:300])
                except Exception:
                    logger.exception("APNs delivery failed for native token id=%s", row.id)
        self.db.commit()
        return sent

    def _get_fcm_access_token(self) -> tuple[Optional[str], Optional[str]]:
        """Mint an OAuth2 access token for FCM HTTP v1 using FCM_SERVICE_ACCOUNT_JSON."""
        raw_sa = (getattr(settings, "FCM_SERVICE_ACCOUNT_JSON", "") or "").strip()
        if not raw_sa:
            return None, None
        try:
            import time
            import jwt
            import httpx
            sa = json.loads(raw_sa) if raw_sa.startswith("{") else json.load(open(raw_sa, "r", encoding="utf-8"))
            project_id = getattr(settings, "FCM_PROJECT_ID", "") or sa.get("project_id")
            client_email = sa.get("client_email")
            private_key = (sa.get("private_key") or "").replace("\\n", "\n")
            token_uri = sa.get("token_uri") or "https://oauth2.googleapis.com/token"
            if not (project_id and client_email and private_key):
                return None, None

            now = int(time.time())
            assertion = jwt.encode(
                {
                    "iss": client_email,
                    "scope": "https://www.googleapis.com/auth/firebase.messaging",
                    "aud": token_uri,
                    "iat": now,
                    "exp": now + 3500,
                },
                private_key,
                algorithm="RS256",
            )
            with httpx.Client(timeout=10) as client:
                resp = client.post(
                    token_uri,
                    data={
                        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                        "assertion": assertion,
                    },
                )
                if resp.status_code == 200:
                    return resp.json().get("access_token"), project_id
                logger.warning("FCM OAuth2 token exchange failed: %s %s", resp.status_code, resp.text[:200])
                return None, None
        except Exception:
            logger.exception("Failed to mint FCM HTTP v1 OAuth2 token")
            return None, None

    def _send_fcm(self, notification: Notification) -> bool:
        """Send an FCM push alert to active native Android tokens (HTTP v1 with legacy key fallback)."""
        tokens = self.db.query(NativePushToken).filter(
            NativePushToken.user_id == notification.user_id,
            NativePushToken.platform == "android",
            NativePushToken.is_active == True,
        ).all()
        if not tokens:
            return False

        access_token, project_id = self._get_fcm_access_token()
        legacy_key = (getattr(settings, "FCM_SERVER_KEY", "") or "").strip()
        if not (access_token and project_id) and not legacy_key:
            logger.warning("FCM credentials are not configured; Android push delivery skipped")
            return False

        try:
            import httpx
        except ImportError:
            logger.warning("httpx not available; Android FCM delivery skipped")
            return False

        action_url = self._build_action_url(notification) or f"/notifications/{notification.id}"
        unread = self._unread_count(notification.user_id)
        data_payload = {
            "notification_id": str(notification.id),
            "action_url": action_url,
            "url": action_url,
            "category": str(notification.type or "general"),
            "badge": str(unread),
        }
        sent = False
        now = datetime.utcnow()

        with httpx.Client(timeout=10) as client:
            for row in tokens:
                try:
                    if access_token and project_id:
                        fcm_body = {
                            "message": {
                                "token": row.token,
                                "notification": {
                                    "title": notification.title,
                                    "body": notification.message,
                                },
                                "data": data_payload,
                                "android": {
                                    "priority": "HIGH",
                                    "notification": {
                                        "channel_id": "soundit_default",
                                        "sound": "default",
                                        "click_action": "OPEN_NOTIFICATION",
                                    },
                                },
                            }
                        }
                        response = client.post(
                            f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
                            json=fcm_body,
                            headers={"Authorization": f"Bearer {access_token}"},
                        )
                        if response.status_code == 200:
                            sent = True
                            row.failure_count = 0
                            row.last_used_at = now
                        elif response.status_code in (404, 410) or "UNREGISTERED" in response.text or "INVALID_ARGUMENT" in response.text:
                            row.is_active = False
                            logger.info("Deactivated expired/invalid FCM token id=%s status=%s", row.id, response.status_code)
                        else:
                            row.failure_count = (row.failure_count or 0) + 1
                            if row.failure_count >= 5:
                                row.is_active = False
                            logger.warning("FCM v1 rejected token id=%s status=%s body=%s", row.id, response.status_code, response.text[:300])
                    elif legacy_key:
                        response = client.post(
                            "https://fcm.googleapis.com/fcm/send",
                            json={
                                "to": row.token,
                                "priority": "high",
                                "notification": {"title": notification.title, "body": notification.message, "sound": "default"},
                                "data": data_payload,
                            },
                            headers={"Authorization": f"key={legacy_key}", "Content-Type": "application/json"},
                        )
                        if response.status_code == 200:
                            res_json = response.json()
                            if res_json.get("success", 0) > 0:
                                sent = True
                                row.failure_count = 0
                                row.last_used_at = now
                            else:
                                err = str((res_json.get("results") or [{}])[0].get("error", ""))
                                if err in ("NotRegistered", "InvalidRegistration", "MismatchSenderId"):
                                    row.is_active = False
                        else:
                            row.failure_count = (row.failure_count or 0) + 1
                            if row.failure_count >= 5:
                                row.is_active = False
                except Exception:
                    logger.exception("FCM delivery failed for native token id=%s", row.id)

        self.db.commit()
        return sent

    def _unread_count(self, user_id: int) -> int:
        from sqlalchemy import func
        return self.db.query(func.count(Notification.id)).filter(
            Notification.user_id == user_id, Notification.is_read == False
        ).scalar() or 0
    
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
    
    def unsubscribe(self, endpoint: str, user_id: Optional[int] = None) -> bool:
        """Deactivate a push subscription (strictly owner-scoped when user_id is provided)."""
        query = self.db.query(PushSubscription).filter(
            PushSubscription.endpoint == endpoint
        )
        if user_id is not None:
            query = query.filter(PushSubscription.user_id == user_id)
        sub = query.first()
        
        if sub:
            sub.is_active = False
            self.db.commit()
            return True
        return False
    
    def _build_action_url(self, notification: Notification) -> Optional[str]:
        """Build a deep link URL based on notification type (prefix-matched) and data."""
        data = notification.data or {}
        if isinstance(data, dict) and data.get("action_url"):
            return str(data["action_url"])

        ntype = (notification.type or "").lower()
        entity_type = data.get("entity_type") or notification.entity_type
        entity_id = data.get("entity_id") or notification.entity_id

        if ntype.startswith("message"):
            return "/dashboard/artist/messages"
        if ntype.startswith("booking"):
            if ntype == "booking_request":
                return "/dashboard/artist/bookings"
            return "/dashboard/artist/bookings"
        if ntype.startswith(("staff_invite", "staff_invitation")):
            return "/notifications"
        if ntype.startswith("ticket_order"):
            return "/dashboard/business/ticket-orders"
        if ntype.startswith("ticket"):
            return "/tickets"
        if ntype.startswith(("product_order", "vendor_order")):
            return "/orders"
        if ntype.startswith("table_booking"):
            return "/dashboard/business/tables"
        if ntype.startswith("verification"):
            return "/get-verified"
        if ntype.startswith("subscription"):
            return "/subscriptions"
        if ntype.startswith(("community_", "reel_", "recap_")):
            return "/recaps"
        if ntype.startswith("event"):
            event_id = data.get("event_id") or entity_id
            if event_id:
                return f"/events/{event_id}"
            return "/events"
        if ntype.startswith(("follow", "new_follower")):
            actor_id = data.get("actor_id") or data.get("follower_id") or entity_id
            if actor_id:
                return f"/profiles/{actor_id}"
            return "/followers"
        if ntype.endswith("_update") and entity_type and entity_id:
            return f"/{entity_type}s/{entity_id}"

        return f"/notifications/{notification.id}"
