"""
Security Headers Middleware
===========================

Implements OWASP recommended security headers.
Protects against XSS, clickjacking, MIME sniffing, and other attacks.
"""

from fastapi import FastAPI, Request
from fastapi.responses import Response
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class SecurityHeaders:
    """
    Security headers configuration following OWASP guidelines.
    """
    
    # Security headers for production
    PRODUCTION_HEADERS = {
        # Prevent XSS attacks
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        
        # Content Security Policy - strict
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://js.stripe.com https://yoopay.cn https://accounts.google.com https://accounts.google.com/gsi/client https://apis.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' https://fonts.gstatic.com; "
            "connect-src 'self' https://api.stripe.com https://yoopay.cn https://accounts.google.com https://apis.google.com; "
            "frame-src https://js.stripe.com https://yoopay.cn https://accounts.google.com; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        ),
        
        # Strict Transport Security
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        
        # Referrer Policy
        "Referrer-Policy": "strict-origin-when-cross-origin",
        
        # Permissions Policy
        "Permissions-Policy": (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(self), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(self), "
            "usb=()"
        ),
        
        # Cache Control for sensitive data
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    
    # Relaxed headers for development
    DEVELOPMENT_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }


def setup_security_headers(app: FastAPI, debug: bool = False):
    """
    Add security headers middleware to FastAPI app.
    
    Args:
        app: FastAPI application
        debug: If True, use relaxed headers for development
    """
    
    headers = SecurityHeaders.DEVELOPMENT_HEADERS if debug else SecurityHeaders.PRODUCTION_HEADERS
    
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        for header, value in headers.items():
            response.headers[header] = value
        
        # Remove server header to prevent information leakage
        if "server" in response.headers:
            del response.headers["server"]
        
        return response
    
    logger.info(f"Security headers configured (debug={debug})")
    return app


class CORSSecurity:
    """
    CORS configuration with security best practices.
    """
    
    # Production origins - strict whitelist
    PRODUCTION_ORIGINS = [
        "https://sounditent.com",
        "https://www.sounditent.com",
        "https://app.sounditent.com",
        "https://admin.sounditent.com",
    ]
    
    # Development origins
    DEVELOPMENT_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]
    
    @classmethod
    def get_cors_config(cls, debug: bool = False) -> Dict:
        """Get CORS configuration"""
        
        origins = cls.DEVELOPMENT_ORIGINS if debug else cls.PRODUCTION_ORIGINS
        
        return {
            "allow_origins": origins,
            "allow_credentials": True,
            "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": [
                "Authorization",
                "Content-Type",
                "X-Requested-With",
                "X-Request-ID",
                "Accept",
                "Origin",
            ],
            "expose_headers": [
                "X-Total-Count",
                "X-RateLimit-Remaining",
                "X-Request-ID",
            ],
            "max_age": 600,  # 10 minutes
        }
