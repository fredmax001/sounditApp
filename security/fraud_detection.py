"""
Fraud Detection System
======================

Real-time fraud detection for payments, ticket purchases, and user behavior.
Uses Redis for fast rule-based and behavioral analysis.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from enum import Enum
import redis
from config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class FraudRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FraudCheck(str, Enum):
    RAPID_PURCHASE = "rapid_purchase"
    MULTIPLE_ACCOUNTS = "multiple_accounts"
    SUSPICIOUS_IP = "suspicious_ip"
    VPN_TOR_USAGE = "vpn_tor_usage"
    UNUSUAL_LOCATION = "unusual_location"
    HIGH_VALUE_TRANSACTION = "high_value_transaction"
    VELOCITY_CHECK = "velocity_check"
    CARD_TESTING = "card_testing"
    DUPLICATE_PAYMENT = "duplicate_payment"
    BOT_BEHAVIOR = "bot_behavior"


class FraudDetector:
    """
    Multi-layer fraud detection system.
    """
    
    # Risk scoring thresholds
    THRESHOLDS = {
        FraudRiskLevel.LOW: 0,
        FraudRiskLevel.MEDIUM: 30,
        FraudRiskLevel.HIGH: 60,
        FraudRiskLevel.CRITICAL: 80,
    }
    
    def __init__(self):
        self.redis_client = None
        self._connect_redis()
        self._load_rules()
    
    def _connect_redis(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.redis_client.ping()
        except Exception as e:
            logger.error(f"Fraud detection Redis connection failed: {e}")
            self.redis_client = None
    
    def _load_rules(self):
        """Load fraud detection rules"""
        self.rules = {
            # Payment velocity rules
            "max_payments_per_minute": 5,
            "max_payments_per_hour": 20,
            "max_payment_amount": 10000,  # CNY
            "max_tickets_per_order": 20,
            "max_orders_per_day": 10,
            
            # Time-based rules
            "min_time_between_purchases_seconds": 10,
            
            # Value-based rules
            "high_value_threshold": 5000,  # CNY
            "suspicious_amounts": [99.99, 999.99, 9999.99],  # Common testing amounts
            
            # Behavioral rules
            "max_failed_payments": 3,
            "max_login_attempts": 5,
        }
    
    def check_payment_fraud(
        self,
        user_id: int,
        amount: float,
        ip_address: str,
        user_agent: str,
        payment_method: str,
        ticket_count: int = 1
    ) -> Dict[str, Any]:
        """
        Comprehensive fraud check for payment.
        
        Returns:
            {
                "allowed": bool,
                "risk_level": FraudRiskLevel,
                "risk_score": int,
                "checks": List[Dict],
                "action": str
            }
        """
        if not self.redis_client:
            return {"allowed": True, "risk_level": FraudRiskLevel.LOW, "risk_score": 0, "checks": [], "action": "allow"}
        
        checks = []
        total_risk_score = 0
        
        # 1. Velocity check - too many payments
        velocity_check = self._check_payment_velocity(user_id)
        checks.append(velocity_check)
        total_risk_score += velocity_check.get("score", 0)
        
        # 2. Rapid purchase check
        rapid_check = self._check_rapid_purchase(user_id)
        checks.append(rapid_check)
        total_risk_score += rapid_check.get("score", 0)
        
        # 3. Amount check
        amount_check = self._check_suspicious_amount(amount)
        checks.append(amount_check)
        total_risk_score += amount_check.get("score", 0)
        
        # 4. Ticket quantity check
        ticket_check = self._check_ticket_quantity(ticket_count)
        checks.append(ticket_check)
        total_risk_score += ticket_check.get("score", 0)
        
        # 5. IP reputation check
        ip_check = self._check_ip_reputation(ip_address)
        checks.append(ip_check)
        total_risk_score += ip_check.get("score", 0)
        
        # 6. Bot behavior check
        bot_check = self._check_bot_behavior(user_id, user_agent)
        checks.append(bot_check)
        total_risk_score += bot_check.get("score", 0)
        
        # 7. Failed payment history
        failed_check = self._check_failed_payment_history(user_id)
        checks.append(failed_check)
        total_risk_score += failed_check.get("score", 0)
        
        # Determine risk level
        risk_level = self._calculate_risk_level(total_risk_score)
        
        # Determine action
        action = self._determine_action(risk_level, checks)
        
        # Store check result for learning
        self._store_fraud_check(user_id, {
            "timestamp": datetime.utcnow().isoformat(),
            "amount": amount,
            "risk_score": total_risk_score,
            "risk_level": risk_level.value,
            "action": action,
            "checks": [c.get("check") for c in checks if c.get("triggered")]
        })
        
        return {
            "allowed": action in ["allow", "challenge"],
            "risk_level": risk_level,
            "risk_score": total_risk_score,
            "checks": checks,
            "action": action
        }
    
    def _check_payment_velocity(self, user_id: int) -> Dict:
        """Check if user is making too many payments"""
        try:
            # Check payments in last hour
            key = f"fraud:payments:{user_id}"
            now = datetime.utcnow()
            hour_ago = now - timedelta(hours=1)
            
            # Remove old entries
            self.redis_client.zremrangebyscore(key, 0, hour_ago.timestamp())
            
            # Count recent payments
            count = self.redis_client.zcard(key)
            
            if count > self.rules["max_payments_per_hour"]:
                return {
                    "check": FraudCheck.VELOCITY_CHECK,
                    "triggered": True,
                    "score": 40,
                    "details": f"{count} payments in last hour"
                }
            elif count > self.rules["max_payments_per_hour"] * 0.7:
                return {
                    "check": FraudCheck.VELOCITY_CHECK,
                    "triggered": True,
                    "score": 20,
                    "details": f"{count} payments in last hour"
                }
            
            return {"check": FraudCheck.VELOCITY_CHECK, "triggered": False, "score": 0}
            
        except Exception as e:
            logger.error(f"Velocity check error: {e}")
            return {"check": FraudCheck.VELOCITY_CHECK, "triggered": False, "score": 0}
    
    def _check_rapid_purchase(self, user_id: int) -> Dict:
        """Check time between purchases"""
        try:
            key = f"fraud:last_payment:{user_id}"
            last_payment = self.redis_client.get(key)
            
            if last_payment:
                last_time = datetime.fromtimestamp(float(last_payment))
                elapsed = (datetime.utcnow() - last_time).total_seconds()
                
                if elapsed < self.rules["min_time_between_purchases_seconds"]:
                    return {
                        "check": FraudCheck.RAPID_PURCHASE,
                        "triggered": True,
                        "score": 30,
                        "details": f"Purchase attempt {elapsed}s after last payment"
                    }
            
            # Update last payment time
            self.redis_client.setex(
                key,
                3600,  # 1 hour expiry
                datetime.utcnow().timestamp()
            )
            
            return {"check": FraudCheck.RAPID_PURCHASE, "triggered": False, "score": 0}
            
        except Exception as e:
            logger.error(f"Rapid purchase check error: {e}")
            return {"check": FraudCheck.RAPID_PURCHASE, "triggered": False, "score": 0}
    
    def _check_suspicious_amount(self, amount: float) -> Dict:
        """Check for suspicious payment amounts"""
        # Check for common testing amounts
        if amount in self.rules["suspicious_amounts"]:
            return {
                "check": FraudCheck.CARD_TESTING,
                "triggered": True,
                "score": 25,
                "details": f"Suspicious amount: {amount}"
            }
        
        # Check for high value
        if amount > self.rules["high_value_threshold"]:
            return {
                "check": FraudCheck.HIGH_VALUE_TRANSACTION,
                "triggered": True,
                "score": 20,
                "details": f"High value transaction: {amount}"
            }
        
        # Check for micro-amounts (testing)
        if amount < 1.0:
            return {
                "check": FraudCheck.CARD_TESTING,
                "triggered": True,
                "score": 15,
                "details": f"Micro amount: {amount}"
            }
        
        return {"check": FraudCheck.HIGH_VALUE_TRANSACTION, "triggered": False, "score": 0}
    
    def _check_ticket_quantity(self, ticket_count: int) -> Dict:
        """Check for suspicious ticket quantities"""
        if ticket_count > self.rules["max_tickets_per_order"]:
            return {
                "check": FraudCheck.VELOCITY_CHECK,
                "triggered": True,
                "score": 35,
                "details": f"Excessive tickets: {ticket_count}"
            }
        
        if ticket_count > self.rules["max_tickets_per_order"] * 0.8:
            return {
                "check": FraudCheck.VELOCITY_CHECK,
                "triggered": True,
                "score": 15,
                "details": f"High ticket count: {ticket_count}"
            }
        
        return {"check": FraudCheck.VELOCITY_CHECK, "triggered": False, "score": 0}
    
    def _check_ip_reputation(self, ip_address: str) -> Dict:
        """Check IP address reputation"""
        try:
            # Check for blocked IPs
            blocked = self.redis_client.sismember("fraud:blocked_ips", ip_address)
            if blocked:
                return {
                    "check": FraudCheck.SUSPICIOUS_IP,
                    "triggered": True,
                    "score": 100,
                    "details": "IP in blocklist"
                }
            
            # Check failed attempts from this IP
            key = f"fraud:ip_failures:{ip_address}"
            failures = int(self.redis_client.get(key) or 0)
            
            if failures > 10:
                return {
                    "check": FraudCheck.SUSPICIOUS_IP,
                    "triggered": True,
                    "score": 50,
                    "details": f"IP has {failures} failed attempts"
                }
            
            return {"check": FraudCheck.SUSPICIOUS_IP, "triggered": False, "score": 0}
            
        except Exception as e:
            logger.error(f"IP reputation check error: {e}")
            return {"check": FraudCheck.SUSPICIOUS_IP, "triggered": False, "score": 0}
    
    def _check_bot_behavior(self, user_id: int, user_agent: str) -> Dict:
        """Check for bot-like behavior"""
        bot_indicators = [
            "bot", "crawler", "spider", "scrape", "headless",
            "selenium", "puppeteer", "playwright"
        ]
        
        user_agent_lower = user_agent.lower()
        
        for indicator in bot_indicators:
            if indicator in user_agent_lower:
                return {
                    "check": FraudCheck.BOT_BEHAVIOR,
                    "triggered": True,
                    "score": 45,
                    "details": f"Bot indicator: {indicator}"
                }
        
        # Check for missing/empty user agent
        if not user_agent or user_agent == "":
            return {
                "check": FraudCheck.BOT_BEHAVIOR,
                "triggered": True,
                "score": 30,
                "details": "Empty user agent"
            }
        
        return {"check": FraudCheck.BOT_BEHAVIOR, "triggered": False, "score": 0}
    
    def _check_failed_payment_history(self, user_id: int) -> Dict:
        """Check user's failed payment history"""
        try:
            key = f"fraud:failed_payments:{user_id}"
            failed_count = int(self.redis_client.get(key) or 0)
            
            if failed_count >= self.rules["max_failed_payments"]:
                return {
                    "check": FraudCheck.CARD_TESTING,
                    "triggered": True,
                    "score": 35,
                    "details": f"{failed_count} recent failed payments"
                }
            
            return {"check": FraudCheck.CARD_TESTING, "triggered": False, "score": 0}
            
        except Exception as e:
            logger.error(f"Failed payment check error: {e}")
            return {"check": FraudCheck.CARD_TESTING, "triggered": False, "score": 0}
    
    def _calculate_risk_level(self, score: int) -> FraudRiskLevel:
        """Calculate risk level from score"""
        if score >= self.THRESHOLDS[FraudRiskLevel.CRITICAL]:
            return FraudRiskLevel.CRITICAL
        elif score >= self.THRESHOLDS[FraudRiskLevel.HIGH]:
            return FraudRiskLevel.HIGH
        elif score >= self.THRESHOLDS[FraudRiskLevel.MEDIUM]:
            return FraudRiskLevel.MEDIUM
        return FraudRiskLevel.LOW
    
    def _determine_action(self, risk_level: FraudRiskLevel, checks: List[Dict]) -> str:
        """Determine action based on risk level"""
        if risk_level == FraudRiskLevel.CRITICAL:
            return "block"
        elif risk_level == FraudRiskLevel.HIGH:
            # Check for specific high-risk patterns
            critical_checks = [FraudCheck.SUSPICIOUS_IP, FraudCheck.BOT_BEHAVIOR]
            for check in checks:
                if check.get("check") in critical_checks and check.get("triggered"):
                    return "block"
            return "challenge"
        elif risk_level == FraudRiskLevel.MEDIUM:
            return "challenge"
        return "allow"
    
    def _store_fraud_check(self, user_id: int, data: Dict):
        """Store fraud check result"""
        if not self.redis_client:
            return
        
        try:
            key = f"fraud:history:{user_id}"
            self.redis_client.lpush(key, json.dumps(data))
            self.redis_client.ltrim(key, 0, 99)  # Keep last 100
            self.redis_client.expire(key, 86400 * 7)  # 7 days
        except Exception as e:
            logger.error(f"Failed to store fraud check: {e}")
    
    def record_failed_payment(self, user_id: int, ip_address: str):
        """Record a failed payment attempt"""
        if not self.redis_client:
            return
        
        try:
            # Increment user failed payments
            user_key = f"fraud:failed_payments:{user_id}"
            self.redis_client.incr(user_key)
            self.redis_client.expire(user_key, 3600)  # 1 hour
            
            # Increment IP failures
            ip_key = f"fraud:ip_failures:{ip_address}"
            self.redis_client.incr(ip_key)
            self.redis_client.expire(ip_key, 86400)  # 24 hours
            
        except Exception as e:
            logger.error(f"Failed to record failed payment: {e}")
    
    def record_successful_payment(self, user_id: int, amount: float, order_id: str):
        """Record a successful payment"""
        if not self.redis_client:
            return
        
        try:
            key = f"fraud:payments:{user_id}"
            self.redis_client.zadd(key, {order_id: datetime.utcnow().timestamp()})
            self.redis_client.expire(key, 3600 * 24)  # 24 hours
            
            # Clear failed payment counter on success
            user_key = f"fraud:failed_payments:{user_id}"
            self.redis_client.delete(user_key)
            
        except Exception as e:
            logger.error(f"Failed to record successful payment: {e}")
    
    def block_ip(self, ip_address: str, reason: str, duration_hours: int = 24):
        """Block an IP address"""
        if not self.redis_client:
            return
        
        try:
            self.redis_client.sadd("fraud:blocked_ips", ip_address)
            
            # Store block reason
            self.redis_client.setex(
                f"fraud:block_reason:{ip_address}",
                duration_hours * 3600,
                reason
            )
            
            logger.warning(f"IP blocked: {ip_address}, reason: {reason}")
            
        except Exception as e:
            logger.error(f"Failed to block IP: {e}")
    
    def is_ip_blocked(self, ip_address: str) -> tuple:
        """Check if IP is blocked"""
        if not self.redis_client:
            return False, None
        
        try:
            blocked = self.redis_client.sismember("fraud:blocked_ips", ip_address)
            if blocked:
                reason = self.redis_client.get(f"fraud:block_reason:{ip_address}")
                return True, reason
            return False, None
        except Exception as e:
            logger.error(f"Failed to check IP block: {e}")
            return False, None


# Global fraud detector instance
fraud_detector = FraudDetector()
