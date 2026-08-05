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
    Falls back to in-memory storage when Redis is unavailable.
    
    Usage:
        limiter = RateLimiter()
        
        @limiter.limit("5/minute")
        def login_endpoint():
            pass
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.redis_client = None
        # In-memory fallback: {key: [(timestamp, count), ...]}
        self._memory_store: Dict[str, list] = {}
        self._memory_lock = False
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
            if not settings.DEBUG:
                # Redis is required for rate limiting in production
                logger.critical(
                    "Redis is unavailable in production. Rate limiting will not function correctly. "
                    "Install/start Redis or set REDIS_URL to a valid Redis instance."
                )
    
    def _memory_clean(self, key: str, cutoff: float):
        """Remove expired entries from in-memory store."""
        if key in self._memory_store:
            self._memory_store[key] = [
                (ts, cnt) for ts, cnt in self._memory_store[key] if ts > cutoff
            ]
    
    def _memory_is_allowed(self, identifier: str, endpoint: str, limit: str) -> tuple:
        """In-memory rate limit check (fallback when Redis is down)."""
        max_requests, window = self._parse_limit(limit)
        key = self._get_key(identifier, endpoint)
        now = time.time()
        cutoff = now - window
        
        self._memory_clean(key, cutoff)
        
        if key not in self._memory_store:
            self._memory_store[key] = []
        
        current = len(self._memory_store[key])
        
        if current >= max_requests:
            oldest_ts = self._memory_store[key][0][0] if self._memory_store[key] else now
            reset_time = int(oldest_ts + window - now)
            return False, 0, max(1, reset_time)
        
        self._memory_store[key].append((now, current + 1))
        remaining = max_requests - current - 1
        return True, remaining, 0
    
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
        Falls back to in-memory storage if Redis is unavailable.
        
        Returns: (allowed: bool, remaining: int, reset_time: int)
        """
        if not self.redis_client:
            # Fallback: Use in-memory rate limiting (per-process, but better than nothing)
            return self._memory_is_allowed(identifier, endpoint, limit)
        
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
            # Fallback to memory on Redis error
            return self._memory_is_allowed(identifier, endpoint, limit)
    
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
        """
        Get real client IP considering trusted proxies.
        
        If TRUSTED_PROXIES is set, only trust X-Forwarded-For entries added by
        those proxies. Otherwise fall back to the direct connection IP.
        """
        trusted_proxies = set()
        if settings.TRUSTED_PROXIES:
            trusted_proxies = {p.strip() for p in settings.TRUSTED_PROXIES.split(",") if p.strip()}
        
        direct_ip = request.client.host if request.client else "unknown"
        
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # X-Forwarded-For is client, proxy1, proxy2, ...
            # Take the rightmost address that is not a trusted proxy, up to TRUSTED_PROXY_COUNT.
            ips = [ip.strip() for ip in forwarded.split(",")]
            chain = [direct_ip] + ips
            
            # Walk from the right (closest to the app) skipping trusted proxies
            skip_count = max(1, settings.TRUSTED_PROXY_COUNT)
            candidate = direct_ip
            for ip in reversed(chain):
                if ip in trusted_proxies or ip == "unknown":
                    continue
                candidate = ip
                skip_count -= 1
                if skip_count <= 0:
                    break
            return candidate if candidate != "unknown" else direct_ip
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            if not trusted_proxies or direct_ip in trusted_proxies:
                return real_ip
        
        return direct_ip
    
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
    
    # Public read-only paths exempt from the global default rate limit
    EXEMPT_PATHS = {
        "/health",
        "/api/v1/system/status",
        "/",
        "/sitemap.xml",
    }
    EXEMPT_PREFIXES = (
        "/static/",
        "/assets/",
        "/uploads/",
    )
    
    @app.middleware("http")
    async def global_rate_limit_middleware(request: Request, call_next):
        path = request.url.path
        
        # Skip rate limiting for public static/read-only assets
        if path in EXEMPT_PATHS or path.startswith(EXEMPT_PREFIXES):
            return await call_next(request)
        
        # Apply a sane global default limit to all other routes
        identifier = limiter._get_identifier(request)
        allowed, remaining, reset_time = limiter.is_allowed(
            identifier, path, RATE_LIMITS["api"]["default"]
        )
        if not allowed:
            logger.warning(
                f"Global rate limit exceeded for {identifier} on {path}"
            )
            raise RateLimitExceeded(retry_after=reset_time)
        
        request.state.rate_limit_remaining = remaining
        response = await call_next(request)
        
        # Add rate limit headers
        headers = limiter.get_limit_headers(request)
        for key, value in headers.items():
            response.headers[key] = value
        
        return response
    
    logger.info("Rate limiting middleware configured")
    return app
