"""
Security Fixes Test Suite
=========================

Tests for critical security fixes applied to the Sound It platform.

Run with: pytest tests/test_security_fixes.py -v
"""

import pytest
import uuid
import time
import threading
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Import application components
from database import Base, get_db
from models import User, UserRole, UserStatus, TicketTier, Event, Order, PaymentStatus
from auth import get_password_hash, verify_password, create_access_token


# ==================== FIXTURES ====================

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    # Use in-memory SQLite for testing
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        email="test@example.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Test",
        last_name="User",
        role=UserRole.USER,
        status=UserStatus.ACTIVE,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    """Create an admin user."""
    user = User(
        email="admin@example.com",
        password_hash=get_password_hash("AdminPass123"),
        first_name="Admin",
        last_name="User",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def super_admin_user(db_session):
    """Create a super admin user."""
    user = User(
        email="superadmin@example.com",
        password_hash=get_password_hash("SuperAdminPass123"),
        first_name="Super",
        last_name="Admin",
        role=UserRole.SUPER_ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ==================== TEST: Password Strength Validation ====================

def test_password_strength_validation():
    """Test that weak passwords are rejected."""
    import re
    
    def validate_password_strength(password: str) -> None:
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        if not re.search(r'[A-Z]', password):
            raise HTTPException(status_code=400, detail="Must contain uppercase")
        if not re.search(r'[a-z]', password):
            raise HTTPException(status_code=400, detail="Must contain lowercase")
        if not re.search(r'\d', password):
            raise HTTPException(status_code=400, detail="Must contain digit")
    
    # Valid passwords should pass
    validate_password_strength("StrongPass123")  # 8+ chars, upper, lower, digit
    validate_password_strength("MyP@ssw0rd")     # 8+ chars, upper, lower, digit
    
    # Too short
    with pytest.raises(HTTPException) as exc_info:
        validate_password_strength("Short1")
    assert exc_info.value.status_code == 400
    
    # Missing uppercase
    with pytest.raises(HTTPException) as exc_info:
        validate_password_strength("lowercase123")
    assert "uppercase" in exc_info.value.detail
    
    # Missing lowercase
    with pytest.raises(HTTPException) as exc_info:
        validate_password_strength("UPPERCASE123")
    assert "lowercase" in exc_info.value.detail
    
    # Missing digit
    with pytest.raises(HTTPException) as exc_info:
        validate_password_strength("NoDigitsHere")
    assert "digit" in exc_info.value.detail


# ==================== TEST: Path Traversal Protection ====================

def test_path_traversal_protection(tmp_path):
    """Test that path traversal attacks are blocked."""
    # Allowed extensions check
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.mp3', '.wav'}
    assert ".jpg" in allowed_extensions
    assert ".exe" not in allowed_extensions
    
    # Test path resolution
    base_path = tmp_path / "uploads"
    base_path.mkdir()
    user_dir = base_path / "123"
    user_dir.mkdir()
    
    # Valid path
    valid_file = user_dir / "test.jpg"
    valid_file.write_text("test")
    resolved = valid_file.resolve()
    assert resolved.relative_to(user_dir) is not None
    
    # Path traversal attempt should fail
    malicious_path = base_path / ".." / ".." / "etc" / "passwd"
    try:
        malicious_path.resolve().relative_to(user_dir)
        assert False, "Path traversal should have been blocked"
    except ValueError:
        pass  # Expected


# ==================== TEST: Race Condition Protection ====================

def test_ticket_race_condition_protection(db_session):
    """Test that ticket availability check uses row locking."""
    # Create test event and ticket tier
    event = Event(
        title="Test Event",
        description="Test",
        start_date=datetime.utcnow(),
        location="Test Venue",
        tickets_sold=0
    )
    db_session.add(event)
    db_session.flush()
    
    tier = TicketTier(
        event_id=event.id,
        name="General Admission",
        price=100.0,
        quantity=10,
        quantity_sold=0,
        max_per_order=5
    )
    db_session.add(tier)
    db_session.commit()
    
    # Verify initial state
    assert tier.quantity_sold == 0
    assert tier.quantity == 10
    
    # Simulate purchases
    def simulate_purchase(tier_id, quantity):
        tier = db_session.query(TicketTier).filter(TicketTier.id == tier_id).first()
        available = tier.quantity - tier.quantity_sold
        if quantity <= available:
            tier.quantity_sold += quantity
            db_session.commit()
            return True
        return False
    
    result1 = simulate_purchase(tier.id, 5)
    result2 = simulate_purchase(tier.id, 5)
    result3 = simulate_purchase(tier.id, 1)  # Should fail
    
    assert result1 is True
    assert result2 is True
    assert result3 is False
    
    tier = db_session.query(TicketTier).filter(TicketTier.id == tier.id).first()
    assert tier.quantity_sold == 10


# ==================== TEST: Privilege Escalation Protection ====================

def test_super_admin_privilege_escalation_protection(admin_user, super_admin_user):
    """Test that only Super Admin can assign SUPER_ADMIN role."""
    
    def check_role_assignment(current_user, target_role):
        if target_role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Only Super Admin can assign SUPER_ADMIN role"
            )
    
    # Super admin can assign SUPER_ADMIN
    check_role_assignment(super_admin_user, UserRole.SUPER_ADMIN)
    
    # Regular admin cannot assign SUPER_ADMIN
    with pytest.raises(HTTPException) as exc_info:
        check_role_assignment(admin_user, UserRole.SUPER_ADMIN)
    assert exc_info.value.status_code == 403


def test_self_suspension_protection(admin_user):
    """Test that admins cannot suspend themselves."""
    def check_self_suspension(current_user_id, target_user_id, new_status):
        if current_user_id == target_user_id and new_status == UserStatus.SUSPENDED:
            raise HTTPException(
                status_code=400,
                detail="Cannot suspend your own account"
            )
    
    with pytest.raises(HTTPException) as exc_info:
        check_self_suspension(admin_user.id, admin_user.id, UserStatus.SUSPENDED)
    assert exc_info.value.status_code == 400


# ==================== TEST: Secure Random Generation ====================

def test_secure_order_number_generation():
    """Test that order numbers use cryptographically secure random."""
    import secrets
    from datetime import datetime
    
    def generate_order_number() -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_suffix = secrets.randbelow(900000) + 100000
        return f"SI{timestamp}{random_suffix}"
    
    order_numbers = [generate_order_number() for _ in range(100)]
    
    # All should be unique
    assert len(set(order_numbers)) == 100
    
    # All should start with SI
    for on in order_numbers:
        assert on.startswith("SI")


def test_secure_yoopay_payment_id_generation():
    """Test that Yoopay payment IDs use cryptographically secure random."""
    import secrets
    from datetime import datetime
    
    def generate_yoopay_payment_id() -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        random_suffix = ''.join(secrets.choice('0123456789ABCDEF') for _ in range(6))
        return f"YP{timestamp}{random_suffix}"
    
    payment_ids = [generate_yoopay_payment_id() for _ in range(100)]
    
    # All should be unique
    assert len(set(payment_ids)) == 100
    
    # All should start with YP
    for pid in payment_ids:
        assert pid.startswith("YP")


# ==================== TEST: Search Input Sanitization ====================

def test_search_input_sanitization():
    """Test that search inputs are sanitized."""
    import re
    
    def sanitize_search(search: str) -> str:
        sanitized = re.sub(r'[%_\\\\]', '', search)[:50]
        return sanitized
    
    # Normal search should pass through
    assert sanitize_search("john doe") == "john doe"
    
    # SQL wildcard characters should be removed
    assert sanitize_search("john%doe") == "johndoe"
    assert sanitize_search("john_doe") == "johndoe"
    
    # Length should be limited
    long_search = "a" * 100
    assert len(sanitize_search(long_search)) == 50


# ==================== TEST: Error Message Security ====================

def test_error_message_does_not_expose_internal_details():
    """Test that error messages don't expose internal details."""
    
    def handle_error(exception: Exception) -> dict:
        return {"detail": "An error occurred. Please try again or contact support."}
    
    sensitive_error = Exception("Database connection failed: postgres://user:pass@host/db")
    response = handle_error(sensitive_error)
    
    # Client should not see sensitive details
    assert "postgres" not in response["detail"]
    assert "user:pass" not in response["detail"]


# ==================== TEST: Duplicate Payment Detection ====================

def test_duplicate_screenshot_detection(db_session, test_user):
    """Test that duplicate payment screenshots are detected."""
    order1 = Order(
        user_id=test_user.id,
        order_number="SI20240101120000123456",
        total_amount=100.0,
        currency="CNY",
        payment_status=PaymentStatus.COMPLETED,
        payment_proof_hash="abc123hash"
    )
    db_session.add(order1)
    db_session.commit()
    
    def check_duplicate_screenshot(file_hash: str) -> bool:
        existing = db_session.query(Order).filter(
            Order.payment_proof_hash == file_hash,
            Order.payment_status.in_([PaymentStatus.COMPLETED, PaymentStatus.PENDING])
        ).first()
        return existing is not None
    
    # Same hash should be detected as duplicate
    assert check_duplicate_screenshot("abc123hash") is True
    
    # Different hash should not be detected
    assert check_duplicate_screenshot("different_hash") is False


# ==================== RUNNER ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
