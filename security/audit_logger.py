"""
Audit Logger
============

Comprehensive audit logging for security events.
Tracks all critical actions for compliance and forensics.
"""

import json
import logging
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from contextvars import ContextVar
import redis
from config import get_settings

settings = get_settings()

# Context variable for request ID
request_id_var: ContextVar[str] = ContextVar('request_id', default='unknown')


class AuditEventType(str, Enum):
    """Types of audit events"""
    # Authentication
    USER_LOGIN = "user_login"
    USER_LOGIN_FAILED = "user_login_failed"
    USER_LOGOUT = "user_logout"
    USER_REGISTERED = "user_registered"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    PASSWORD_RESET_COMPLETED = "password_reset_completed"
    TOKEN_REFRESHED = "token_refreshed"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    
    # Payments
    PAYMENT_INITIATED = "payment_initiated"
    PAYMENT_COMPLETED = "payment_completed"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_REFUNDED = "payment_refunded"
    PAYMENT_DISPUTED = "payment_disputed"
    
    # Tickets
    TICKET_PURCHASED = "ticket_purchased"
    TICKET_VALIDATED = "ticket_validated"
    TICKET_TRANSFERRED = "ticket_transferred"
    TICKET_CANCELLED = "ticket_cancelled"
    TICKET_SCANNED = "ticket_scanned"
    
    # Events
    EVENT_CREATED = "event_created"
    EVENT_UPDATED = "event_updated"
    EVENT_DELETED = "event_deleted"
    EVENT_APPROVED = "event_approved"
    EVENT_REJECTED = "event_rejected"
    EVENT_PUBLISHED = "event_published"
    
    # User Management
    PROFILE_UPDATED = "profile_updated"
    ROLE_CHANGED = "role_changed"
    ACCOUNT_SUSPENDED = "account_suspended"
    ACCOUNT_DELETED = "account_deleted"
    
    # Admin Actions
    ADMIN_LOGIN = "admin_login"
    ADMIN_ACTION = "admin_action"
    USER_VERIFIED = "user_verified"
    USER_BANNED = "user_banned"
    PAYOUT_APPROVED = "payout_approved"
    
    # Security
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_TOKEN = "invalid_token"
    PERMISSION_DENIED = "permission_denied"
    
    # API
    API_KEY_CREATED = "api_key_created"
    API_KEY_REVOKED = "api_key_revoked"
    WEBHOOK_RECEIVED = "webhook_received"


class AuditLogger:
    """
    High-performance audit logger using Redis and file logging.
    """
    
    def __init__(self):
        self.redis_client = None
        self.logger = logging.getLogger("audit")
        self._setup_logger()
        self._connect_redis()
    
    def _setup_logger(self):
        """Setup dedicated audit log file"""
        handler = logging.FileHandler("logs/audit.log")
        handler.setFormatter(
            logging.Formatter('%(asctime)s | %(message)s')
        )
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def _connect_redis(self):
        """Connect to Redis for audit stream"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.redis_client.ping()
        except Exception as e:
            logging.error(f"Audit Redis connection failed: {e}")
            self.redis_client = None
    
    def log(
        self,
        event_type: AuditEventType,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "info",
        request_id: Optional[str] = None
    ) -> str:
        """
        Log an audit event.
        
        Returns:
            audit_id: Unique identifier for this event
        """
        # Generate unique audit ID
        timestamp = datetime.utcnow()
        audit_id = self._generate_audit_id(timestamp, event_type, user_id)
        
        # Get request ID from context if not provided
        if not request_id:
            request_id = request_id_var.get()
        
        # Build audit event
        event = {
            "audit_id": audit_id,
            "timestamp": timestamp.isoformat(),
            "event_type": event_type.value,
            "user_id": user_id,
            "ip_address": self._hash_ip(ip_address) if ip_address else None,
            "user_agent": user_agent,
            "request_id": request_id,
            "severity": severity,
            "details": self._sanitize_details(details or {}),
        }
        
        # Log to file
        self.logger.info(json.dumps(event))
        
        # Store in Redis for real-time analysis
        if self.redis_client:
            try:
                # Add to time-series stream
                self.redis_client.xadd(
                    "audit:stream",
                    {"data": json.dumps(event)},
                    maxlen=100000
                )
                
                # Add to user-specific set for quick lookup
                if user_id:
                    self.redis_client.zadd(
                        f"audit:user:{user_id}",
                        {audit_id: timestamp.timestamp()}
                    )
                    # Keep only last 1000 events per user
                    self.redis_client.zremrangebyrank(
                        f"audit:user:{user_id}",
                        0, -1001
                    )
                
                # Add to event-type index
                self.redis_client.zadd(
                    f"audit:type:{event_type.value}",
                    {audit_id: timestamp.timestamp()}
                )
                
            except Exception as e:
                logging.error(f"Failed to store audit in Redis: {e}")
        
        return audit_id
    
    def _generate_audit_id(
        self,
        timestamp: datetime,
        event_type: AuditEventType,
        user_id: Optional[int]
    ) -> str:
        """Generate unique audit ID"""
        data = f"{timestamp.isoformat()}:{event_type.value}:{user_id}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def _hash_ip(self, ip_address: str) -> str:
        """Hash IP address for privacy"""
        return hashlib.sha256(ip_address.encode()).hexdigest()[:16]
    
    def _sanitize_details(self, details: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive data from details"""
        sensitive_keys = [
            'password', 'token', 'secret', 'credit_card', 'cvv',
            'api_key', 'private_key', 'password_hash'
        ]
        
        sanitized = {}
        for key, value in details.items():
            if any(sk in key.lower() for sk in sensitive_keys):
                sanitized[key] = "***REDACTED***"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_details(value)
            else:
                sanitized[key] = value
        
        return sanitized
    
    def get_user_events(
        self,
        user_id: int,
        event_types: Optional[List[AuditEventType]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get audit events for a specific user"""
        if not self.redis_client:
            return []
        
        try:
            # Get audit IDs from sorted set
            min_score = start_time.timestamp() if start_time else 0
            max_score = end_time.timestamp() if end_time else float('inf')
            
            audit_ids = self.redis_client.zrevrangebyscore(
                f"audit:user:{user_id}",
                max_score,
                min_score,
                start=0,
                num=limit
            )
            
            # Get full events from stream
            events = []
            for audit_id in audit_ids:
                # Search in stream for this audit_id
                stream_data = self.redis_client.xrange("audit:stream")
                for _, data in stream_data:
                    event = json.loads(data.get("data", "{}"))
                    if event.get("audit_id") == audit_id:
                        if not event_types or event["event_type"] in [e.value for e in event_types]:
                            events.append(event)
                        break
            
            return events
            
        except Exception as e:
            logging.error(f"Failed to get user events: {e}")
            return []
    
    def get_recent_events(
        self,
        event_types: Optional[List[AuditEventType]] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent audit events"""
        if not self.redis_client:
            return []
        
        try:
            stream_data = self.redis_client.xrevrange("audit:stream", count=limit * 2)
            events = []
            
            for _, data in stream_data:
                event = json.loads(data.get("data", "{}"))
                if not event_types or event["event_type"] in [e.value for e in event_types]:
                    events.append(event)
                    if len(events) >= limit:
                        break
            
            return events
            
        except Exception as e:
            logging.error(f"Failed to get recent events: {e}")
            return []
    
    def get_security_alerts(self, hours: int = 24) -> List[Dict]:
        """Get security-related alerts"""
        alert_types = [
            AuditEventType.SUSPICIOUS_ACTIVITY,
            AuditEventType.RATE_LIMIT_EXCEEDED,
            AuditEventType.PERMISSION_DENIED,
            AuditEventType.USER_LOGIN_FAILED,
        ]
        
        from_time = datetime.utcnow().timestamp() - (hours * 3600)
        
        alerts = []
        for event_type in alert_types:
            try:
                audit_ids = self.redis_client.zrevrangebyscore(
                    f"audit:type:{event_type.value}",
                    float('inf'),
                    from_time
                )
                
                for audit_id in audit_ids[:50]:  # Limit per type
                    stream_data = self.redis_client.xrange("audit:stream")
                    for _, data in stream_data:
                        event = json.loads(data.get("data", "{}"))
                        if event.get("audit_id") == audit_id:
                            alerts.append(event)
                            break
                            
            except Exception as e:
                logging.error(f"Failed to get alerts for {event_type}: {e}")
        
        # Sort by timestamp
        alerts.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return alerts[:100]


# Global audit logger instance
audit_logger = AuditLogger()


# Convenience function for quick logging
def audit_log(
    event_type: AuditEventType,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    severity: str = "info"
) -> str:
    """Quick function to log audit event"""
    return audit_logger.log(
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        severity=severity
    )
