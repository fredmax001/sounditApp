"""
API Key Management
==================

Secure API key generation, storage, and validation for:
- Internal service communication
- Third-party integrations
- Webhook authentication
"""

import secrets
import hashlib
import hmac
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from enum import Enum
import redis
from config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class APIKeyScope(str, Enum):
    """API key permission scopes"""
    READ_ONLY = "read:only"
    PAYMENTS = "payments"
    WEBHOOKS = "webhooks"
    ADMIN = "admin"
    TICKET_SCAN = "ticket:scan"
    EVENTS_READ = "events:read"
    EVENTS_WRITE = "events:write"


class APIKeyStatus(str, Enum):
    """API key status"""
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class APIKeyManager:
    """
    Secure API key management system.
    
    Keys are stored as hashed values (like passwords).
    Only the full key is shown once upon creation.
    """
    
    def __init__(self):
        self.redis_client = None
        self._connect_redis()
        self.key_prefix = "apikey"
        self.default_expiry_days = 365
    
    def _connect_redis(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.redis_client.ping()
        except Exception as e:
            logger.error(f"API Key manager Redis connection failed: {e}")
            self.redis_client = None
    
    def generate_key(
        self,
        name: str,
        owner_id: int,
        scopes: List[APIKeyScope],
        expires_days: Optional[int] = None,
        metadata: Optional[Dict] = None
    ) -> Tuple[str, str]:
        """
        Generate a new API key.
        
        Returns:
            (key_id, full_key) - Full key is only shown once!
        """
        if not self.redis_client:
            raise RuntimeError("Redis not available for API key storage")
        
        # Generate key components
        key_id = f"{self.key_prefix}_{secrets.token_hex(8)}"
        secret_part = secrets.token_urlsafe(32)
        full_key = f"{key_id}.{secret_part}"
        
        # Hash the secret part for storage (like password hashing)
        key_hash = self._hash_key(secret_part)
        
        # Calculate expiry
        expires_days = expires_days or self.default_expiry_days
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        # Store key data
        key_data = {
            "key_id": key_id,
            "key_hash": key_hash,
            "name": name,
            "owner_id": owner_id,
            "scopes": [s.value for s in scopes],
            "status": APIKeyStatus.ACTIVE.value,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": expires_at.isoformat(),
            "last_used": None,
            "use_count": 0,
            "metadata": metadata or {},
        }
        
        # Store in Redis
        self.redis_client.hset(f"apikey:data:{key_id}", mapping={
            k: str(v) if not isinstance(v, (list, dict)) else str(v)
            for k, v in key_data.items()
        })
        
        # Add to owner's key set
        self.redis_client.sadd(f"apikey:owner:{owner_id}", key_id)
        
        # Set expiry
        self.redis_client.expire(f"apikey:data:{key_id}", expires_days * 86400)
        
        logger.info(f"API key generated: {key_id} for owner {owner_id}")
        
        return key_id, full_key
    
    def validate_key(self, full_key: str) -> Tuple[bool, Optional[Dict]]:
        """
        Validate an API key.
        
        Returns:
            (is_valid, key_data)
        """
        if not self.redis_client:
            return False, None
        
        try:
            # Parse key
            if "." not in full_key:
                return False, None
            
            key_id, secret_part = full_key.split(".", 1)
            
            # Get key data
            key_data = self.redis_client.hgetall(f"apikey:data:{key_id}")
            if not key_data:
                return False, None
            
            # Check status
            status = key_data.get("status")
            if status == APIKeyStatus.REVOKED.value:
                return False, {"error": "Key revoked", "key_id": key_id}
            if status == APIKeyStatus.SUSPENDED.value:
                return False, {"error": "Key suspended", "key_id": key_id}
            
            # Check expiry
            expires_at = datetime.fromisoformat(key_data.get("expires_at", "2000-01-01"))
            if datetime.utcnow() > expires_at:
                self.redis_client.hset(f"apikey:data:{key_id}", "status", APIKeyStatus.EXPIRED.value)
                return False, {"error": "Key expired", "key_id": key_id}
            
            # Verify hash
            stored_hash = key_data.get("key_hash")
            provided_hash = self._hash_key(secret_part)
            
            if not hmac.compare_digest(stored_hash, provided_hash):
                return False, {"error": "Invalid key", "key_id": key_id}
            
            # Update usage stats
            self.redis_client.hincrby(f"apikey:data:{key_id}", "use_count", 1)
            self.redis_client.hset(f"apikey:data:{key_id}", "last_used", datetime.utcnow().isoformat())
            
            # Parse scopes back to list
            scopes_str = key_data.get("scopes", "[]")
            try:
                import ast
                scopes = ast.literal_eval(scopes_str)
            except:
                scopes = []
            
            return True, {
                "key_id": key_id,
                "owner_id": int(key_data.get("owner_id", 0)),
                "scopes": scopes,
                "name": key_data.get("name"),
            }
            
        except Exception as e:
            logger.error(f"Key validation error: {e}")
            return False, None
    
    def revoke_key(self, key_id: str, reason: str = "") -> bool:
        """Revoke an API key"""
        if not self.redis_client:
            return False
        
        try:
            self.redis_client.hset(f"apikey:data:{key_id}", mapping={
                "status": APIKeyStatus.REVOKED.value,
                "revoked_at": datetime.utcnow().isoformat(),
                "revoke_reason": reason,
            })
            
            logger.info(f"API key revoked: {key_id}, reason: {reason}")
            return True
            
        except Exception as e:
            logger.error(f"Key revocation error: {e}")
            return False
    
    def get_owner_keys(self, owner_id: int) -> List[Dict]:
        """Get all API keys for an owner"""
        if not self.redis_client:
            return []
        
        try:
            key_ids = self.redis_client.smembers(f"apikey:owner:{owner_id}")
            keys = []
            
            for key_id in key_ids:
                key_data = self.redis_client.hgetall(f"apikey:data:{key_id}")
                if key_data:
                    # Don't expose hash
                    key_data.pop("key_hash", None)
                    keys.append(key_data)
            
            return keys
            
        except Exception as e:
            logger.error(f"Get owner keys error: {e}")
            return []
    
    def check_scope(self, key_data: Dict, required_scope: APIKeyScope) -> bool:
        """Check if key has required scope"""
        scopes = key_data.get("scopes", [])
        
        # ADMIN scope has all permissions
        if APIKeyScope.ADMIN.value in scopes:
            return True
        
        return required_scope.value in scopes
    
    def _hash_key(self, secret: str) -> str:
        """Hash API key secret for storage"""
        return hashlib.sha256(
            f"{secret}:{settings.SECRET_KEY}".encode()
        ).hexdigest()
    
    def generate_webhook_secret(self, name: str) -> str:
        """Generate a secure webhook signing secret"""
        prefix = f"whsec_{name}_"
        secret = secrets.token_hex(32)
        return f"{prefix}{secret}"
    
    def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        secret: str
    ) -> bool:
        """
        Verify webhook signature (Stripe-style).
        
        Args:
            payload: Raw request body
            signature: Header signature (t=timestamp,v1=signature)
            secret: Webhook secret
        
        Returns:
            True if signature is valid
        """
        try:
            # Parse signature header
            # Format: t=1234567890,v1=signature_hash
            sig_parts = {}
            for part in signature.split(","):
                if "=" in part:
                    key, value = part.split("=", 1)
                    sig_parts[key] = value
            
            timestamp = sig_parts.get("t")
            sig_hash = sig_parts.get("v1")
            
            if not timestamp or not sig_hash:
                return False
            
            # Check timestamp (prevent replay attacks)
            import time
            current_time = int(time.time())
            sig_time = int(timestamp)
            
            # Allow 5 minute window
            if abs(current_time - sig_time) > 300:
                return False
            
            # Compute expected signature
            signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
            expected_sig = hmac.new(
                secret.encode(),
                signed_payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(sig_hash, expected_sig)
            
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False
    
    def create_request_signature(
        self,
        method: str,
        path: str,
        body: bytes,
        timestamp: int,
        secret: str
    ) -> str:
        """
        Create HMAC signature for internal API requests.
        
        Args:
            method: HTTP method
            path: Request path
            body: Request body
            timestamp: Unix timestamp
            secret: API secret
        
        Returns:
            Signature string
        """
        # Build signed string
        body_hash = hashlib.sha256(body).hexdigest()
        signed_string = f"{method}|{path}|{body_hash}|{timestamp}"
        
        # Create HMAC
        signature = hmac.new(
            secret.encode(),
            signed_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"v1={signature},t={timestamp}"


# Global API key manager instance
api_key_manager = APIKeyManager()
