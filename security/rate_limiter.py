"""
API Rate Limiter
================

Multi-layer rate limiting using Redis.
Prevents API abuse, bot attacks, and DDoS.
"""

import time
import redis
from typing import Optional, Dict, Callable
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from functools import wraps
from config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimitExceeded(HTTPException):
    def __init__(self, detail: str = "Rate limit exceeded", retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail
        )
        self.retry_after = retry_after


class RateLimiter:
    """
    Redis-based rate limiter with sliding window algorithm.
    
    Usage:
        limiter = RateLimiter()
        
        @limiter.limit("5/minute")
        def login_endpoint():
            pass
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.redis_client = None
        self._connect()
    
    def _connect(self):
        """Establish Redis connection"""
        try:
            self.redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                health_check_interval=30
            )
            self.redis_client.ping()
            logger.info("Rate limiter connected to Redis")
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis_client = None
    
    def _get_key(self, identifier: str, endpoint: str) -> str:
        """Generate Redis key for rate limiting"""
        return f"ratelimit:{identifier}:{endpoint}"
    
    def _parse_limit(self, limit: str) -> tuple:
        """Parse limit string like '5/minute' to (count, window_seconds)"""
        parts = limit.split('/')
        if len(parts) != 2:
            raise ValueError(f"Invalid rate limit format: {limit}")
        
        count = int(parts[0])
        window_str = parts[1].lower()
        
        windows = {
            'second': 1,
            'minute': 60,
            'hour': 3600,
            'day': 86400,
        }
        
        # Handle plural forms
        for key, value in windows.items():
            if window_str in (key, key + 's'):
                return count, value
        
        raise ValueError(f"Invalid time window: {window_str}")
    
    def is_allowed(self, identifier: str, endpoint: str, limit: str) -> tuple:
        """
        Check if request is allowed under rate limit.
        
        Returns: (allowed: bool, remaining: int, reset_time: int)
        """
        if not self.redis_client:
            # Fallback: Allow all if Redis unavailable
            logger.warning("Redis unavailable, allowing request")
            return True, 1, 0
        
        try:
            max_requests, window = self._parse_limit(limit)
            key = self._get_key(identifier, endpoint)
            now = time.time()
            
            # Remove old entries outside the window
            cutoff = now - window
            self.redis_client.zremrangebyscore(key, 0, cutoff)
            
            # Count current requests
            current = self.redis_client.zcard(key)
            
            if current >= max_requests:
                # Get oldest request for reset time
                oldest = self.redis_client.zrange(key, 0, 0, withscores=True)
                reset_time = int(oldest[0][1] + window - now) if oldest else window
                return False, 0, reset_time
            
            # Add current request
            self.redis_client.zadd(key, {str(now): now})
            # Set expiry on the key
            self.redis_client.expire(key, window)
            
            remaining = max_requests - current - 1
            return True, remaining, 0
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True, 1, 0  # Allow on error
    
    def limit(self, limit_string: str, key_func: Optional[Callable] = None):
        """
        Decorator to apply rate limiting to endpoints.
        
        Args:
            limit_string: e.g., "5/minute", "100/hour"
            key_func: Function to extract identifier from request
                     Default: IP address + user ID (if authenticated)
        """
        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                request = None
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
                
                if not request:
                    # Try to find in kwargs
                    request = kwargs.get('request')
                
                if request:
                    identifier = self._get_identifier(request, key_func)
                    endpoint = request.url.path
                    
                    allowed, remaining, reset_time = self.is_allowed(
                        identifier, endpoint, limit_string
                    )
                    
                    if not allowed:
                        logger.warning(
                            f"Rate limit exceeded for {identifier} on {endpoint}"
                        )
                        raise RateLimitExceeded(retry_after=reset_time)
                    
                    # Store rate limit info in request state for headers
                    request.state.rate_limit_remaining = remaining
                
                return await func(*args, **kwargs)
            
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                request = None
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
                
                if not request:
                    request = kwargs.get('request')
                
                if request:
                    identifier = self._get_identifier(request, key_func)
                    endpoint = request.url.path
                    
                    allowed, remaining, reset_time = self.is_allowed(
                        identifier, endpoint, limit_string
                    )
                    
                    if not allowed:
                        logger.warning(
                            f"Rate limit exceeded for {identifier} on {endpoint}"
                        )
                        raise RateLimitExceeded(retry_after=reset_time)
                    
                    request.state.rate_limit_remaining = remaining
                
                return func(*args, **kwargs)
            
            return async_wrapper if self._is_async(func) else sync_wrapper
        return decorator
    
    def _get_identifier(self, request: Request, key_func: Optional[Callable] = None) -> str:
        """Get unique identifier for rate limiting"""
        if key_func:
            return key_func(request)
        
        # Default: IP + user ID (if authenticated)
        client_ip = self._get_client_ip(request)
        
        # Try to get user ID from token
        user_id = "anon"
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # Extract user ID without full validation for rate limiting
            try:
                from auth import decode_token
                token = auth_header.replace("Bearer ", "")
                payload = decode_token(token)
                if payload and payload.get("sub"):
                    user_id = payload.get("sub")
            except:
                pass
        
        return f"{client_ip}:{user_id}"
    
    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP considering proxies"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _is_async(self, func) -> bool:
        """Check if function is async"""
        import asyncio
        return asyncio.iscoroutinefunction(func)
    
    def get_limit_headers(self, request: Request) -> Dict[str, str]:
        """Get rate limit headers for response"""
        remaining = getattr(request.state, 'rate_limit_remaining', None)
        if remaining is not None:
            return {
                "X-RateLimit-Remaining": str(remaining),
            }
        return {}


# Predefined rate limits for different endpoint types
RATE_LIMITS = {
    "auth": {
        "login": "5/minute",
        "register": "3/minute",
        "otp_send": "3/minute",
        "otp_verify": "10/minute",
        "forgot_password": "3/minute",
    },
    "payments": {
        "create_order": "10/minute",
        "process_payment": "10/minute",
        "create_intent": "10/minute",
    },
    "tickets": {
        "verify": "30/minute",
        "purchase": "5/minute",
    },
    "api": {
        "default": "100/minute",
        "upload": "10/minute",
        "search": "60/minute",
    }
}


# Global rate limiter instance
limiter = RateLimiter()


def setup_rate_limiting(app):
    """Setup rate limiting middleware for FastAPI app"""
    
    @app.middleware("http")
    async def add_rate_limit_headers(request: Request, call_next):
        response = await call_next(request)
        
        # Add rate limit headers
        headers = limiter.get_limit_headers(request)
        for key, value in headers.items():
            response.headers[key] = value
        
        return response
    
    logger.info("Rate limiting middleware configured")
    return app
