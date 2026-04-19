"""
Sound It Security Module
=========================

Production-level security framework implementing:
- API rate limiting
- Authentication hardening
- Fraud detection
- Audit logging
- Security headers
"""

from .rate_limiter import RateLimiter, setup_rate_limiting
from .audit_logger import AuditLogger, audit_log
from .fraud_detection import FraudDetector, FraudCheck
from .security_headers import setup_security_headers
from .file_security import FileSecurityScanner
from .api_key_manager import APIKeyManager

__all__ = [
    "RateLimiter",
    "setup_rate_limiting",
    "AuditLogger",
    "audit_log",
    "FraudDetector",
    "FraudCheck",
    "setup_security_headers",
    "FileSecurityScanner",
    "APIKeyManager",
]
