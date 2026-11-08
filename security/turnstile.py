"""
Cloudflare Turnstile Verification Helper
========================================

Verifies Turnstile challenge tokens server-side with Cloudflare API.
Gracefully passes in development mode if no secret key is configured.
"""
import logging
import urllib.request
import urllib.parse
import json
from typing import Optional
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """
    Verify Cloudflare Turnstile token with Cloudflare API.
    Returns True if valid or if Turnstile is unconfigured in development.
    """
    secret_key = getattr(settings, "CLOUDFLARE_TURNSTILE_SECRET_KEY", "") or ""
    
    # If not configured, allow in development; log warning in production
    if not secret_key:
        if settings.DEBUG:
            return True
        logger.warning("CLOUDFLARE_TURNSTILE_SECRET_KEY not set; passing verification.")
        return True

    if not token:
        logger.warning("Turnstile verification failed: missing token")
        return False

    try:
        data = {
            "secret": secret_key,
            "response": token,
        }
        if remote_ip:
            data["remoteip"] = remote_ip

        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(
            TURNSTILE_VERIFY_URL,
            data=encoded_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
            success = result.get("success", False)
            if not success:
                logger.warning(f"Turnstile verification rejected: {result.get('error-codes', [])}")
            return success
    except Exception as e:
        logger.error(f"Turnstile verification request failed: {e}")
        # In case of network error communicating with Cloudflare, fail safe
        return False
