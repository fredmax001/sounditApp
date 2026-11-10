import logging
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any

logger = logging.getLogger("soundit.security")

def log_security_event(
    event_type: str,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    attempted_action: Optional[str] = None,
    target_resource: Optional[str] = None,
    target_id: Optional[Any] = None,
    client_ip: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "WARNING"
):
    """
    Log structured security audit events.
    Never logs passwords, access tokens, or sensitive credentials.
    """
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "severity": severity,
        "user_id": user_id,
        "user_email": user_email,
        "attempted_action": attempted_action,
        "target_resource": target_resource,
        "target_id": str(target_id) if target_id is not None else None,
        "client_ip": client_ip,
        "details": details or {}
    }
    log_msg = f"[SECURITY_AUDIT] {json.dumps(payload)}"
    if severity == "CRITICAL" or severity == "ERROR":
        logger.error(log_msg)
    else:
        logger.warning(log_msg)
