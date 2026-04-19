"""
Enhanced Authentication System
==============================

Implements secure authentication with:
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Token rotation
- Secure token storage in Redis
"""

import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from enum import Enum
from jose import JWTError, jwt
from fastapi import HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import redis
from config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


class EnhancedAuthManager:
    """
    Enhanced authentication with JWT access tokens and refresh tokens.
    """
    
    # Token lifetimes
    ACCESS_TOKEN_EXPIRE_MINUTES = 15
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    
    def __init__(self):
        self.redis_client = None
        self._connect_redis()
        self.security = HTTPBearer(auto_error=False)
    
    def _connect_redis(self):
        """Connect to Redis for token storage"""
        try:
            self.redis_client = redis.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
            self.redis_client.ping()
        except Exception as e:
            logger.error(f"Auth manager Redis connection failed: {e}")
            self.redis_client = None
    
    def create_access_token(
        self,
        user_id: int,
        role: str,
        extra_claims: Optional[Dict] = None
    ) -> str:
        """Create a short-lived access token"""
        now = datetime.utcnow()
        expire = now + timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        payload = {
            "sub": str(user_id),
            "role": role,
            "type": TokenType.ACCESS.value,
            "iat": now,
            "exp": expire,
            "jti": secrets.token_urlsafe(16),  # Unique token ID
        }
        
        if extra_claims:
            payload.update(extra_claims)
        
        token = jwt.encode(
            payload,
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM
        )
        
        # Store token metadata in Redis for revocation capability
        if self.redis_client:
            self.redis_client.setex(
                f"token:access:{payload['jti']}",
                self.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                str(user_id)
            )
        
        return token
    
    def create_refresh_token(self, user_id: int) -> Tuple[str, str]:
        """
        Create a refresh token.
        
        Returns:
            (token, token_id) - Store token_id to link with access tokens
        """
        token_id = secrets.token_urlsafe(32)
        now = datetime.utcnow()
        expire = now + timedelta(days=self.REFRESH_TOKEN_EXPIRE_DAYS)
        
        payload = {
            "sub": str(user_id),
            "type": TokenType.REFRESH.value,
            "iat": now,
            "exp": expire,
            "jti": token_id,
        }
        
        token = jwt.encode(
            payload,
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM
        )
        
        # Store refresh token hash in Redis
        if self.redis_client:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            self.redis_client.setex(
                f"token:refresh:{user_id}:{token_id}",
                self.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
                token_hash
            )
            
            # Track user's refresh tokens for cleanup
            self.redis_client.sadd(f"user:tokens:{user_id}", token_id)
        
        return token, token_id
    
    def verify_access_token(self, token: str) -> Optional[Dict]:
        """Verify an access token"""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Check token type
            if payload.get("type") != TokenType.ACCESS.value:
                return None
            
            # Check if token is revoked
            jti = payload.get("jti")
            if jti and self.redis_client:
                if not self.redis_client.exists(f"token:access:{jti}"):
                    return None  # Token revoked or expired
            
            return payload
            
        except JWTError:
            return None
    
    def verify_refresh_token(self, token: str) -> Optional[Dict]:
        """Verify a refresh token"""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Check token type
            if payload.get("type") != TokenType.REFRESH.value:
                return None
            
            # Verify against stored hash
            if self.redis_client:
                user_id = payload.get("sub")
                jti = payload.get("jti")
                stored_hash = self.redis_client.get(f"token:refresh:{user_id}:{jti}")
                
                if not stored_hash:
                    return None  # Token not found or expired
                
                # Verify hash matches
                token_hash = hashlib.sha256(token.encode()).hexdigest()
                if stored_hash != token_hash:
                    return None  # Token tampered
            
            return payload
            
        except JWTError:
            return None
    
    def refresh_access_token(self, refresh_token: str) -> Optional[Dict]:
        """
        Create new access token from refresh token.
        Implements token rotation for security.
        """
        payload = self.verify_refresh_token(refresh_token)
        if not payload:
            return None
        
        user_id = int(payload.get("sub"))
        old_jti = payload.get("jti")
        
        # Get user role from database
        from database import SessionLocal
        from models import User
        
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user or user.status.value != "active":
                return None
            
            # Create new token pair (rotation)
            access_token = self.create_access_token(user_id, user.role.value)
            new_refresh_token, new_jti = self.create_refresh_token(user_id)
            
            # Revoke old refresh token
            self.revoke_refresh_token(user_id, old_jti)
            
            return {
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": self.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            }
            
        finally:
            db.close()
    
    def revoke_access_token(self, jti: str):
        """Revoke an access token by its JTI"""
        if self.redis_client:
            self.redis_client.delete(f"token:access:{jti}")
    
    def revoke_refresh_token(self, user_id: int, jti: str):
        """Revoke a refresh token"""
        if self.redis_client:
            self.redis_client.delete(f"token:refresh:{user_id}:{jti}")
            self.redis_client.srem(f"user:tokens:{user_id}", jti)
    
    def revoke_all_user_tokens(self, user_id: int):
        """Revoke all tokens for a user (logout everywhere)"""
        if not self.redis_client:
            return
        
        # Get all refresh tokens
        token_ids = self.redis_client.smembers(f"user:tokens:{user_id}")
        
        # Delete all refresh tokens
        for jti in token_ids:
            self.redis_client.delete(f"token:refresh:{user_id}:{jti}")
        
        # Delete the set
        self.redis_client.delete(f"user:tokens:{user_id}")
        
        logger.info(f"All tokens revoked for user {user_id}")
    
    async def get_current_user(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = None
    ) -> Optional[Dict]:
        """Get current user from access token"""
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = credentials.credentials
        payload = self.verify_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return {
            "user_id": int(payload.get("sub")),
            "role": payload.get("role"),
            "token_jti": payload.get("jti"),
        }
    
    def generate_csrf_token(self, session_id: str) -> str:
        """Generate CSRF token for forms"""
        token = secrets.token_urlsafe(32)
        
        if self.redis_client:
            self.redis_client.setex(
                f"csrf:{session_id}",
                3600,  # 1 hour
                token
            )
        
        return token
    
    def verify_csrf_token(self, session_id: str, token: str) -> bool:
        """Verify CSRF token"""
        if not self.redis_client:
            return True  # Skip if Redis unavailable
        
        stored = self.redis_client.get(f"csrf:{session_id}")
        if not stored:
            return False
        
        return secrets.compare_digest(stored, token)


# Global auth manager instance
auth_manager = EnhancedAuthManager()
