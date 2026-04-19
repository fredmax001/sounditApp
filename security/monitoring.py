"""
Security Monitoring & Alerting
==============================

Real-time security monitoring, threat detection, and alerting.
Integrates with audit logs to detect suspicious patterns.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import redis
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class ThreatLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(str, Enum):
    BRUTE_FORCE_ATTACK = "brute_force_attack"
    SUSPICIOUS_LOGIN = "suspicious_login"
    PAYMENT_FRAUD = "payment_fraud"
    RATE_LIMIT_VIOLATION = "rate_limit_violation"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DATA_EXFILTRATION = "data_exfiltration"
    BOT_ACTIVITY = "bot_activity"
    SQL_INJECTION_ATTEMPT = "sql_injection_attempt"
    XSS_ATTEMPT = "xss_attempt"
    ADMIN_ACTION = "admin_action"


@dataclass
class SecurityAlert:
    alert_id: str
    alert_type: AlertType
    threat_level: ThreatLevel
    message: str
    timestamp: datetime
    source_ip: Optional[str]
    user_id: Optional[int]
    details: Dict
    acknowledged: bool = False
    resolved: bool = False


class SecurityMonitor:
    """
    Real-time security monitoring and alerting system.
    """
    
    def __init__(self):
        self.redis_client = None
        self._connect_redis()
        self.alert_handlers: List[Callable] = []
        self._load_thresholds()
    
    def _connect_redis(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.redis_client.ping()
        except Exception as e:
            logger.error(f"Security monitor Redis connection failed: {e}")
            self.redis_client = None
    
    def _load_thresholds(self):
        """Load detection thresholds"""
        self.thresholds = {
            # Brute force detection
            "max_failed_logins": 5,
            "failed_login_window_minutes": 15,
            
            # Rate limit violations
            "rate_limit_violations_before_alert": 10,
            
            # Suspicious activity
            "max_requests_per_minute": 200,
            "max_payment_attempts": 5,
            
            # Admin actions
            "alert_on_admin_login": True,
            "alert_on_privilege_change": True,
        }
    
    def register_alert_handler(self, handler: Callable):
        """Register a handler for security alerts"""
        self.alert_handlers.append(handler)
    
    def create_alert(
        self,
        alert_type: AlertType,
        threat_level: ThreatLevel,
        message: str,
        source_ip: Optional[str] = None,
        user_id: Optional[int] = None,
        details: Optional[Dict] = None
    ) -> str:
        """
        Create a security alert.
        
        Returns:
            alert_id
        """
        alert_id = f"alert_{datetime.utcnow().timestamp()}_{secrets.token_hex(4)}"
        
        alert = SecurityAlert(
            alert_id=alert_id,
            alert_type=alert_type,
            threat_level=threat_level,
            message=message,
            timestamp=datetime.utcnow(),
            source_ip=source_ip,
            user_id=user_id,
            details=details or {}
        )
        
        # Store alert
        if self.redis_client:
            try:
                alert_data = {
                    "alert_id": alert_id,
                    "alert_type": alert_type.value,
                    "threat_level": threat_level.value,
                    "message": message,
                    "timestamp": alert.timestamp.isoformat(),
                    "source_ip": source_ip,
                    "user_id": user_id,
                    "details": json.dumps(details or {}),
                    "acknowledged": "false",
                    "resolved": "false",
                }
                
                # Store in Redis
                self.redis_client.hset(f"security:alert:{alert_id}", mapping=alert_data)
                
                # Add to sorted set by timestamp
                self.redis_client.zadd(
                    "security:alerts",
                    {alert_id: alert.timestamp.timestamp()}
                )
                
                # Add to threat level index
                self.redis_client.zadd(
                    f"security:alerts:{threat_level.value}",
                    {alert_id: alert.timestamp.timestamp()}
                )
                
            except Exception as e:
                logger.error(f"Failed to store alert: {e}")
        
        # Log alert
        logger.warning(
            f"SECURITY ALERT [{threat_level.value.upper()}]: {message} "
            f"(Type: {alert_type.value}, IP: {source_ip}, User: {user_id})"
        )
        
        # Notify handlers
        for handler in self.alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.error(f"Alert handler error: {e}")
        
        return alert_id
    
    def detect_brute_force(self, ip_address: str, username: str) -> Optional[str]:
        """Detect brute force login attempts"""
        if not self.redis_client:
            return None
        
        try:
            key = f"security:failed_logins:{ip_address}"
            now = datetime.utcnow()
            
            # Add failed attempt
            self.redis_client.zadd(key, {str(now.timestamp()): now.timestamp()})
            
            # Remove old entries
            window = now - timedelta(minutes=self.thresholds["failed_login_window_minutes"])
            self.redis_client.zremrangebyscore(key, 0, window.timestamp())
            
            # Count recent failures
            count = self.redis_client.zcard(key)
            
            # Set expiry
            self.redis_client.expire(key, 3600)
            
            if count >= self.thresholds["max_failed_logins"]:
                return self.create_alert(
                    alert_type=AlertType.BRUTE_FORCE_ATTACK,
                    threat_level=ThreatLevel.HIGH,
                    message=f"Brute force attack detected from {ip_address}",
                    source_ip=ip_address,
                    details={
                        "failed_attempts": count,
                        "username_attempted": username,
                        "window_minutes": self.thresholds["failed_login_window_minutes"],
                    }
                )
            
            return None
            
        except Exception as e:
            logger.error(f"Brute force detection error: {e}")
            return None
    
    def detect_suspicious_login(
        self,
        user_id: int,
        ip_address: str,
        user_agent: str,
        geo_location: Optional[str] = None
    ) -> Optional[str]:
        """Detect suspicious login patterns"""
        if not self.redis_client:
            return None
        
        try:
            # Get user's last login info
            key = f"security:last_login:{user_id}"
            last_login = self.redis_client.hgetall(key)
            
            if last_login:
                last_ip = last_login.get("ip_address")
                
                # Check if IP changed significantly
                if last_ip and last_ip != ip_address:
                    # Could add GeoIP check here
                    return self.create_alert(
                        alert_type=AlertType.SUSPICIOUS_LOGIN,
                        threat_level=ThreatLevel.MEDIUM,
                        message=f"Login from new IP for user {user_id}",
                        source_ip=ip_address,
                        user_id=user_id,
                        details={
                            "previous_ip": last_ip,
                            "current_ip": ip_address,
                            "user_agent": user_agent,
                            "location": geo_location,
                        }
                    )
            
            # Update last login
            self.redis_client.hset(key, mapping={
                "ip_address": ip_address,
                "user_agent": user_agent,
                "timestamp": datetime.utcnow().isoformat(),
            })
            self.redis_client.expire(key, 86400 * 30)  # 30 days
            
            return None
            
        except Exception as e:
            logger.error(f"Suspicious login detection error: {e}")
            return None
    
    def detect_privilege_escalation(
        self,
        admin_id: int,
        target_user_id: int,
        old_role: str,
        new_role: str
    ) -> Optional[str]:
        """Detect privilege escalation attempts"""
        # Always alert on admin role changes
        if "admin" in new_role.lower() and "admin" not in old_role.lower():
            return self.create_alert(
                alert_type=AlertType.PRIVILEGE_ESCALATION,
                threat_level=ThreatLevel.HIGH,
                message=f"User {target_user_id} promoted to {new_role} by {admin_id}",
                user_id=admin_id,
                details={
                    "target_user_id": target_user_id,
                    "old_role": old_role,
                    "new_role": new_role,
                    "action": "privilege_grant",
                }
            )
        
        # Alert on role changes in general if configured
        if self.thresholds.get("alert_on_privilege_change"):
            return self.create_alert(
                alert_type=AlertType.ADMIN_ACTION,
                threat_level=ThreatLevel.LOW,
                message=f"Role changed for user {target_user_id} by {admin_id}",
                user_id=admin_id,
                details={
                    "target_user_id": target_user_id,
                    "old_role": old_role,
                    "new_role": new_role,
                }
            )
        
        return None
    
    def detect_bot_activity(
        self,
        ip_address: str,
        request_count: int,
        time_window_seconds: int = 60
    ) -> Optional[str]:
        """Detect bot-like activity patterns"""
        if request_count > self.thresholds["max_requests_per_minute"]:
            return self.create_alert(
                alert_type=AlertType.BOT_ACTIVITY,
                threat_level=ThreatLevel.MEDIUM,
                message=f"Bot-like activity detected from {ip_address}",
                source_ip=ip_address,
                details={
                    "requests_per_minute": request_count,
                    "threshold": self.thresholds["max_requests_per_minute"],
                }
            )
        return None
    
    def get_active_alerts(
        self,
        min_level: ThreatLevel = ThreatLevel.LOW,
        limit: int = 100
    ) -> List[SecurityAlert]:
        """Get active (unresolved) security alerts"""
        if not self.redis_client:
            return []
        
        try:
            alerts = []
            levels = [ThreatLevel.CRITICAL, ThreatLevel.HIGH, ThreatLevel.MEDIUM, ThreatLevel.LOW]
            
            for level in levels:
                if self._threat_level_value(level) < self._threat_level_value(min_level):
                    break
                
                alert_ids = self.redis_client.zrevrange(
                    f"security:alerts:{level.value}",
                    0, limit
                )
                
                for alert_id in alert_ids:
                    data = self.redis_client.hgetall(f"security:alert:{alert_id}")
                    if data and data.get("resolved") == "false":
                        alerts.append(self._dict_to_alert(data))
            
            # Sort by timestamp
            alerts.sort(key=lambda x: x.timestamp, reverse=True)
            return alerts[:limit]
            
        except Exception as e:
            logger.error(f"Get active alerts error: {e}")
            return []
    
    def acknowledge_alert(self, alert_id: str, acknowledged_by: int) -> bool:
        """Acknowledge a security alert"""
        if not self.redis_client:
            return False
        
        try:
            self.redis_client.hset(f"security:alert:{alert_id}", mapping={
                "acknowledged": "true",
                "acknowledged_by": acknowledged_by,
                "acknowledged_at": datetime.utcnow().isoformat(),
            })
            return True
        except Exception as e:
            logger.error(f"Acknowledge alert error: {e}")
            return False
    
    def resolve_alert(self, alert_id: str, resolved_by: int, resolution: str) -> bool:
        """Resolve a security alert"""
        if not self.redis_client:
            return False
        
        try:
            self.redis_client.hset(f"security:alert:{alert_id}", mapping={
                "resolved": "true",
                "resolved_by": resolved_by,
                "resolved_at": datetime.utcnow().isoformat(),
                "resolution": resolution,
            })
            return True
        except Exception as e:
            logger.error(f"Resolve alert error: {e}")
            return False
    
    def _threat_level_value(self, level: ThreatLevel) -> int:
        """Get numeric value for threat level"""
        values = {
            ThreatLevel.LOW: 1,
            ThreatLevel.MEDIUM: 2,
            ThreatLevel.HIGH: 3,
            ThreatLevel.CRITICAL: 4,
        }
        return values.get(level, 0)
    
    def _dict_to_alert(self, data: Dict) -> SecurityAlert:
        """Convert dict to SecurityAlert"""
        return SecurityAlert(
            alert_id=data.get("alert_id", ""),
            alert_type=AlertType(data.get("alert_type", "admin_action")),
            threat_level=ThreatLevel(data.get("threat_level", "low")),
            message=data.get("message", ""),
            timestamp=datetime.fromisoformat(data.get("timestamp", "2000-01-01")),
            source_ip=data.get("source_ip"),
            user_id=int(data.get("user_id")) if data.get("user_id") else None,
            details=json.loads(data.get("details", "{}")),
            acknowledged=data.get("acknowledged") == "true",
            resolved=data.get("resolved") == "true",
        )


# Global security monitor instance
security_monitor = SecurityMonitor()


# Default alert handler - logs to console
def default_alert_handler(alert: SecurityAlert):
    """Default handler that just logs alerts"""
    print(f"\nSECURITY ALERT [{alert.threat_level.value.upper()}]")
    print(f"   Type: {alert.alert_type.value}")
    print(f"   Message: {alert.message}")
    print(f"   Time: {alert.timestamp}")
    if alert.source_ip:
        print(f"   IP: {alert.source_ip}")
    if alert.user_id:
        print(f"   User: {alert.user_id}")
    print()


security_monitor.register_alert_handler(default_alert_handler)


import secrets
