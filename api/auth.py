"""
Authentication API - Beta Launch Version
========================================
NO verification codes required.
Simplified signup flow with role selection.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from typing import Optional
import logging
import re
import uuid
import secrets

logger = logging.getLogger(__name__)

try:
    from security.rate_limiter import limiter
except ImportError:
    limiter = None

try:
    from security.monitoring import security_monitor
except ImportError:
    security_monitor = None

try:
    from security.audit_logger import audit_log, AuditEventType
except ImportError:
    audit_log = None
    AuditEventType = None

from database import get_db
from config import get_settings
from models import (
    User, UserRole, UserStatus, ArtistProfile, OrganizerProfile, 
    BusinessProfile, VendorProfile, City,
    ArtistFollow, EventFollow, OrganizerFollow, VendorFollow
)
# Security logging (imported locally in functions to avoid circular deps at module load)
def _get_client_ip(request: Request) -> str:
    """Extract client IP from request headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _log_security(
    db: Session,
    event_type: str,
    severity: str = "info",
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    endpoint: Optional[str] = None,
    method: Optional[str] = None,
    details: Optional[dict] = None
):
    """Fire-and-forget security event logging."""
    try:
        from api.admin import log_security_event
        log_security_event(
            db=db,
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            method=method,
            details=details
        )
    except Exception:
        pass  # Never fail the request because logging failed
from services.subscription_service import SubscriptionService
from schemas import (
    UserCreate, UserUpdate, UserResponse, UserLogin, Token,
    UserRegistration, SignupRedirectResponse, RoleSelectionResponse, RoleSignupConfig,
    SignupRole
)
from auth import (
    get_REDACTED_PLACEHOLDER_hash as get_password_hash, 
    verify_REDACTED_PLACEHOLDER as verify_password, 
    REDACTED_PLACEHOLDER as create_access_token, 
    get_current_user,
    validate_password_strength
)
from api.notifications import create_notification

# Columns that must never be echoed back in API payloads
SENSITIVE_USER_COLUMNS = {
    "password_hash",
    "pin_hash",
    "totp_secret",
    "refresh_token",
    "password_reset_token",
}

# Refresh token helpers
REFRESH_TOKEN_EXPIRE_DAYS = 30

def _generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def _hash_refresh_token(token: str) -> str:
    """Hash a plaintext refresh token for secure database storage (HMAC-SHA256)."""
    from config import get_settings as _get_settings
    import hashlib
    import hmac as _hmac
    _secret = _get_settings().JWT_SECRET or ""
    return _hmac.new(
        _secret.encode('utf-8'),
        token.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


def _set_refresh_token(user: User, db: Session, commit: bool = True) -> str:
    token = _generate_refresh_token()
    user.refresh_token = _hash_refresh_token(token)  # store hash, not plaintext
    user.refresh_token_expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    if commit:
        db.commit()
    return token  # return plaintext to client only


def _verify_refresh_token(user: User, token: str) -> bool:
    if not user.refresh_token or not user.refresh_token_expires_at:
        return False
    hashed = _hash_refresh_token(token)
    if not secrets.compare_digest(user.refresh_token, hashed):
        return False
    expires = user.refresh_token_expires_at
    # Ensure timezone-aware comparison
    if expires.tzinfo is None:
        from datetime import timezone as _tz
        expires = expires.replace(tzinfo=_tz.utc)
    if datetime.now(timezone.utc) > expires:
        return False
    return True
from email_service import send_email, send_welcome_email
from services.sms_notifications import send_sms_welcome
from security.enhanced_auth import auth_manager


router = APIRouter(prefix="/auth", tags=["Authentication"])



def _compute_user_counts(user: User, db: Session) -> dict:
    """Compute followers_count and following_count for a user in a single query."""
    from sqlalchemy import func, select
    try:
        following_subq = (
            select(func.count(ArtistFollow.id)).where(ArtistFollow.user_id == user.id).scalar_subquery()
            + select(func.count(EventFollow.id)).where(EventFollow.user_id == user.id).scalar_subquery()
            + select(func.count(OrganizerFollow.id)).where(OrganizerFollow.user_id == user.id).scalar_subquery()
            + select(func.count(VendorFollow.id)).where(VendorFollow.user_id == user.id).scalar_subquery()
        )
        if user.role == UserRole.ARTIST:
            followers_subq = (
                select(func.count(ArtistFollow.id))
                .join(ArtistProfile, ArtistProfile.id == ArtistFollow.artist_id)
                .where(ArtistProfile.user_id == user.id)
                .scalar_subquery()
            )
        elif user.role == UserRole.VENDOR:
            followers_subq = (
                select(func.count(VendorFollow.id))
                .join(VendorProfile, VendorProfile.id == VendorFollow.vendor_id)
                .where(VendorProfile.user_id == user.id)
                .scalar_subquery()
            )
        elif user.role in (UserRole.BUSINESS, UserRole.ORGANIZER):
            followers_subq = (
                select(func.count(OrganizerFollow.id))
                .join(OrganizerProfile, OrganizerProfile.id == OrganizerFollow.organizer_id)
                .where(OrganizerProfile.user_id == user.id)
                .scalar_subquery()
            )
        else:
            followers_subq = select(func.count(ArtistFollow.id)).where(ArtistFollow.id == -1).scalar_subquery()

        row = db.execute(
            select(
                following_subq.label("following_count"),
                followers_subq.label("followers_count"),
            )
        ).first()
        if row:
            return {
                "followers_count": int(row.followers_count or 0),
                "following_count": int(row.following_count or 0),
            }
    except Exception:
        pass
    return {"followers_count": 0, "following_count": 0}


# ==================== ROLE CONFIGURATION ====================

ROLE_CONFIGS = {
    UserRole.USER: RoleSignupConfig(
        role=UserRole.USER,
        title="User",
        description="Browse events, join the conversation, discover city guides",
        icon="user",
        required_fields=["email", "password", "first_name", "last_name"],
        optional_fields=["city", "avatar_url"]
    ),
    UserRole.BUSINESS: RoleSignupConfig(
        role=UserRole.BUSINESS,
        title="Business",
        description="Organizers, Clubs, Venues - Create and manage events",
        icon="business",
        required_fields=["email", "password", "first_name", "last_name", "business_name", "business_type"],
        optional_fields=["city", "avatar_url", "website", "bio"]
    ),
    UserRole.ARTIST: RoleSignupConfig(
        role=UserRole.ARTIST,
        title="Artist",
        description="DJs, MCs, Musicians, Dancers, Photographers - Showcase your talent and get booked",
        icon="artist",
        required_fields=["email", "password", "first_name", "last_name", "business_name", "artist_type", "bio"],
        optional_fields=["city", "avatar_url", "instagram", "twitter", "weibo", "website"]
    ),
    UserRole.VENDOR: RoleSignupConfig(
        role=UserRole.VENDOR,
        title="Vendor",
        description="Food, Clothing, Merchandise Sellers - Sell at events",
        icon="vendor",
        required_fields=["email", "password", "first_name", "last_name", "business_name", "vendor_type"],
        optional_fields=["city", "avatar_url", "website", "bio", "instagram"]
    )
}


def get_dashboard_redirect_url(role: UserRole) -> str:
    """Get the redirect URL for a role after signup/login"""
    redirect_map = {
        UserRole.USER: "/",
        UserRole.BUSINESS: "/dashboard/business",
        UserRole.ARTIST: "/dashboard/artist",
        UserRole.VENDOR: "/dashboard/vendor",
        UserRole.ADMIN: "/admin",
        UserRole.SUPER_ADMIN: "/admin"
    }
    return redirect_map.get(role, "/")


def _send_welcome_email_safe(user: User):
    """Send welcome email to new user (non-blocking)."""
    try:
        send_welcome_email(to_email=user.email, first_name=user.first_name or "")
    except Exception as e:
        # Don't fail signup if email fails
        logger.warning(f"Failed to send welcome email: {e}")


# ==================== ROLE SELECTION ENDPOINTS ====================

@router.get("/roles", response_model=RoleSelectionResponse)
@limiter.limit("30/minute") if limiter else lambda f: f
def get_signup_roles(request: Request):
    """
    Get available roles for signup.
    This is the FIRST screen shown when clicking "Sign Up".
    """
    return RoleSelectionResponse(
        roles=list(ROLE_CONFIGS.values())
    )


@router.get("/roles/{role}/config", response_model=RoleSignupConfig)
def get_role_config(role: UserRole):
    """
    Get configuration for a specific role signup form.
    """
    if role not in ROLE_CONFIGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role"
        )
    return ROLE_CONFIGS[role]


# ==================== AUTHENTICATION ENDPOINTS ====================

@router.post("/register", response_model=SignupRedirectResponse)
@limiter.limit("10/minute") if limiter else lambda f: f
def register(
    request: Request,
    data: UserRegistration,
    db: Session = Depends(get_db)
):
    """
    Register a new user - NO VERIFICATION CODE REQUIRED (Beta Launch).
    
    Flow:
    1. User enters details
    2. Account created immediately
    3. Welcome email sent
    4. User is logged in automatically
    5. Redirected to role-specific dashboard
    """
    # Verify Cloudflare Turnstile token if provided
    if data.turnstile_token:
        from security.turnstile import verify_turnstile_token
        client_ip = _get_client_ip(request)
        if not verify_turnstile_token(data.turnstile_token, remote_ip=client_ip):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security verification failed. Please refresh and try again."
            )

    # Check if email already exists
    if data.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Check if phone already exists
    if data.phone:
        existing = db.query(User).filter(User.phone == data.phone).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone already registered"
            )
    
    # Validate role
    if data.role not in ROLE_CONFIGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role selected"
        )

    # SignupRole is an explicit public-role allowlist. Convert to the ORM enum
    # before persistence and downstream role comparisons.
    signup_role = UserRole(data.role.value)

    clean_username = data.username.strip().lstrip('@') if getattr(data, 'username', None) and data.username.strip() else None
    if clean_username:
        existing_username = db.query(User).filter(User.username.ilike(clean_username)).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This username is already taken. Please choose another."
            )

    full_name = f"{(data.first_name or '').strip()} {(data.last_name or '').strip()}".strip()
    resolved_entity_name = (data.business_name or full_name or clean_username or data.email.split('@')[0]).strip()
    
    # Create user
    user = User(
        email=data.email,
        phone=data.phone,
        first_name=(data.first_name or resolved_entity_name).strip(),
        last_name=(data.last_name or "").strip(),
        username=clean_username,
        password_hash=get_password_hash(data.password),
        role=signup_role,
        status=UserStatus.ACTIVE,
        is_verified=False,
        preferred_city=data.city,
        avatar_url=data.avatar_url,
        bio=data.bio,
        instagram=data.instagram,
        twitter=data.twitter,
        website=data.website
    )
    
    db.add(user)
    db.flush()  # Get user ID
    
    # Log registration
    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")
    _log_security(db, "create", "info",
                  user_id=user.id, user_email=user.email,
                  ip_address=client_ip, user_agent=user_agent,
                  endpoint="/auth/register", method="POST",
                  details={"role": user.role.value, "source": "email"})
    if audit_log and AuditEventType:
        audit_log(
            AuditEventType.USER_REGISTERED,
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"role": user.role.value, "source": "email"}
        )
    
    # Create role-specific profile
    try:
        if signup_role == UserRole.ARTIST:
            artist_profile = ArtistProfile(
                user_id=user.id,
                stage_name=resolved_entity_name,
                artist_type=data.artist_type or "Artist",
                bio=data.bio,
                city=data.city,
                spotify_url=data.website if data.website and "spotify" in data.website else None,
                soundcloud_url=data.website if data.website and "soundcloud" in data.website else None,
                is_approved=True,
                is_verified=False
            )
            db.add(artist_profile)
            
        elif signup_role == UserRole.BUSINESS:
            business_profile = BusinessProfile(
                user_id=user.id,
                business_name=resolved_entity_name,
                business_type=[data.business_type] if data.business_type else ["organizer"],
                description=data.bio,
                city=data.city,
                website=data.website,
                is_verified=False,
                is_approved=True
            )
            db.add(business_profile)
            db.flush()
            
            # Also create organizer profile for backward compatibility
            organizer_profile = OrganizerProfile(
                user_id=user.id,
                business_profile_id=business_profile.id,
                organization_name=resolved_entity_name,
                description=data.bio,
                city=data.city,
                website=data.website,
                is_verified=False,
                is_approved=True
            )
            db.add(organizer_profile)
            
        elif signup_role == UserRole.VENDOR:
            vendor_profile = VendorProfile(
                user_id=user.id,
                business_name=resolved_entity_name,
                description=data.bio,
                vendor_type=data.vendor_type or "merchandise",
                city=data.city,
                website=data.website,
                is_verified=False,
                is_approved=True
            )
            db.add(vendor_profile)
    
    except Exception as e:
        db.rollback()
        logger.exception(
            "Registration profile creation failed",
            extra={"signup_role": signup_role.value, "user_id": user.id}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to complete registration. Please try again later."
        ) from e
    
    db.commit()
    db.refresh(user)
    
    # Create 30-day free trial subscription for organizer/business/artist/vendor roles
    if signup_role in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]:
        try:
            SubscriptionService.create_trial_subscription(db, user.id, signup_role)
        except Exception:
            # Non-blocking: trial creation failure shouldn't prevent signup
            pass
    
    # Send welcome email only for USER role (business/artist/vendor get welcome on approval)
    if signup_role == UserRole.USER:
        _send_welcome_email_safe(user)
    
    # Send welcome SMS (non-blocking, all roles)
    if data.phone:
        try:
            send_sms_welcome(data.phone, first_name=data.first_name)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send welcome SMS: {e}")
    
    # Notify admins about new signup
    try:
        admins = db.query(User).filter(User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])).all()
        for admin in admins:
            create_notification(
                db=db,
                user_id=admin.id,
                title="New User Joined",
                message=f"{user.first_name or 'Someone'} just joined Sound It as a {user.role.value}.",
                notification_type="signup",
                data={"new_user_id": user.id, "role": user.role.value}
            )
    except Exception:
        # Non-blocking
        pass
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = _set_refresh_token(user, db)
    
    # Get redirect URL
    redirect_url = get_dashboard_redirect_url(signup_role)
    
    # Build user dict manually to avoid email validation issues
    counts = _compute_user_counts(user, db)
    user_dict = {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "background_url": user.background_url,
        "bio": user.bio,
        "instagram": user.instagram,
        "twitter": user.twitter,
        "website": user.website,
        "preferred_city": user.preferred_city.value if user.preferred_city else None,
        "preferred_language": user.preferred_language,
        "foreigner_mode": user.foreigner_mode,
        "role": user.role.value,
        "status": user.status.value,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        **counts,
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_dict,
        "redirect_url": redirect_url
    }


@router.post("/login")
@limiter.limit("20/minute") if limiter else lambda f: f
def login(
    request: Request,
    credentials: UserLogin, 
    db: Session = Depends(get_db)
):
    """
    Login with email/phone and password.
    Returns token and redirect URL based on user role.
    """
    # Find user
    user = None
    if credentials.email:
        user = db.query(User).filter(User.email.ilike(credentials.email.strip())).first()
    elif credentials.phone:
        user = db.query(User).filter(User.phone == credentials.phone.strip()).first()
    
    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")

    # Helper to build a StaffMember login response
    def _login_as_staff_member(staff_obj):
        from models import BusinessProfile, OrganizerProfile
        biz_user = db.query(User).filter(User.id == staff_obj.business_id).first()
        if not biz_user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Business owner account not found")
        biz_name = biz_user.first_name or biz_user.username or biz_user.email
        if biz_user.organizer_profile and biz_user.organizer_profile.organization_name:
            biz_name = biz_user.organizer_profile.organization_name
        elif biz_user.business_profile and biz_user.business_profile.business_name:
            biz_name = biz_user.business_profile.business_name

        staff_obj.last_login = datetime.now(timezone.utc)
        db.commit()

        access_token = create_access_token(data={
            "sub": f"staff:{staff_obj.id}",
            "staff_id": staff_obj.id,
            "business_id": staff_obj.business_id,
        })
        role_lower = (staff_obj.role or "").strip().lower()
        perms = dict(staff_obj.permissions or {})
        if role_lower == "finance":
            perms.setdefault("financials", True)
            perms.setdefault("ordersApproval", True)
            perms.setdefault("payouts", True)
        redirect_url = "/dashboard/business/finance" if (role_lower == "finance" or perms.get("financials")) else "/dashboard/business"
        counts = _compute_user_counts(biz_user, db)
        user_dict = {
            "id": biz_user.id,
            "email": staff_obj.email or biz_user.email,
            "phone": staff_obj.phone or biz_user.phone,
            "first_name": staff_obj.full_name or biz_user.first_name,
            "last_name": "",
            "username": staff_obj.login or biz_user.username,
            "avatar_url": biz_user.avatar_url,
            "background_url": biz_user.background_url,
            "bio": biz_user.bio,
            "instagram": biz_user.instagram,
            "twitter": biz_user.twitter,
            "website": biz_user.website,
            "preferred_city": biz_user.preferred_city.value if biz_user.preferred_city else None,
            "preferred_language": biz_user.preferred_language,
            "foreigner_mode": biz_user.foreigner_mode,
            "role": UserRole.BUSINESS.value,
            "status": biz_user.status.value,
            "is_verified": biz_user.is_verified,
            "created_at": biz_user.created_at.isoformat() if biz_user.created_at else None,
            "staff_id": staff_obj.id,
            "staff_role": staff_obj.role,
            "staff_permissions": perms,
            "business_name": biz_name,
            **counts,
        }
        return {
            "access_token": access_token,
            "refresh_token": None,
            "token_type": "bearer",
            "user": user_dict,
            "redirect_url": redirect_url,
        }

    # Check if login matches an active StaffMember when user is not found or password fails on User
    def _find_matching_staff():
        from models import StaffMember
        from sqlalchemy import func
        ident = (credentials.email or credentials.phone or "").strip()
        if not ident:
            return None
        ident_lower = ident.lower()
        candidates = db.query(StaffMember).filter(
            StaffMember.status == "Active",
            (
                (func.lower(StaffMember.email) == ident_lower) |
                (func.lower(StaffMember.login) == ident_lower) |
                (StaffMember.phone == ident)
            )
        ).order_by(StaffMember.id.desc()).all()
        for cand in candidates:
            if cand.password_hash and verify_password(credentials.password, cand.password_hash):
                return cand
        return None
    
    if not user:
        staff_match = _find_matching_staff()
        if staff_match:
            return _login_as_staff_member(staff_match)
        _log_security(db, "failed_login", "warning",
                      user_email=credentials.email or credentials.phone,
                      ip_address=client_ip, user_agent=user_agent,
                      endpoint="/auth/login", method="POST",
                      details={"reason": "user_not_found"})
        if security_monitor:
            security_monitor.detect_brute_force(
                ip_address=client_ip,
                username=credentials.email or credentials.phone
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Verify password
    if not user.password_hash or not verify_password(credentials.password, user.password_hash):
        staff_match = _find_matching_staff()
        if staff_match:
            return _login_as_staff_member(staff_match)
        _log_security(db, "failed_login", "warning",
                      user_id=user.id, user_email=user.email,
                      ip_address=client_ip, user_agent=user_agent,
                      endpoint="/auth/login", method="POST",
                      details={"reason": "invalid_password"})
        if security_monitor:
            security_monitor.detect_brute_force(
                ip_address=client_ip,
                username=user.email or user.phone
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check status
    if user.status == UserStatus.SUSPENDED:
        _log_security(db, "failed_login", "error",
                      user_id=user.id, user_email=user.email,
                      ip_address=client_ip, user_agent=user_agent,
                      endpoint="/auth/login", method="POST",
                      details={"reason": "account_suspended"})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended. Please contact support."
        )
    
    if user.status == UserStatus.INACTIVE:
        _log_security(db, "failed_login", "error",
                      user_id=user.id, user_email=user.email,
                      ip_address=client_ip, user_agent=user_agent,
                      endpoint="/auth/login", method="POST",
                      details={"reason": "account_inactive"})
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account inactive. Please contact support."
        )

    # If a standard USER account is an active Finance or Manager staff member for a business,
    # log them into the Business Staff Workspace automatically.
    if user.role == UserRole.USER:
        from models import StaffMember
        from sqlalchemy import func
        linked_staff = db.query(StaffMember).filter(
            StaffMember.status == "Active",
            (
                (StaffMember.user_id == user.id) |
                (func.lower(StaffMember.email) == (user.email or "").lower())
            )
        ).order_by(StaffMember.id.desc()).all()
        for st in linked_staff:
            st_role = (st.role or "").strip().lower()
            st_perms = st.permissions or {}
            if st_role in ("finance", "manager") or st_perms.get("financials"):
                return _login_as_staff_member(st)
    
    # Two-factor authentication gate — users with TOTP enabled must complete
    # a second step (POST /auth/2fa/login) before tokens are issued.
    if user.totp_enabled and user.totp_secret:
        two_factor_token = create_access_token(
            data={"sub": str(user.id), "purpose": "2fa"},
            expires_delta=timedelta(minutes=5),
        )
        return {
            "requires_2fa": True,
            "two_factor_token": two_factor_token,
        }
    
    # Clear any outstanding password reset token on successful login
    if user.password_reset_token or user.password_reset_expires_at:
        user.password_reset_token = None
        user.password_reset_expires_at = None

    # Update last login and refresh token in a single transaction
    user.last_login = datetime.now(timezone.utc)
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = _set_refresh_token(user, db, commit=False)
    _log_security(db, "login", "info",
                  user_id=user.id, user_email=user.email,
                  ip_address=client_ip, user_agent=user_agent,
                  endpoint="/auth/login", method="POST",
                  details={"role": user.role.value})
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Run Redis / file security monitoring non-blocking so login never stalls
    import threading
    _uid, _role_val = user.id, user.role.value
    def _bg_login_audit():
        try:
            if security_monitor:
                security_monitor.detect_suspicious_login(
                    user_id=_uid,
                    ip_address=client_ip,
                    user_agent=user_agent
                )
            if audit_log and AuditEventType:
                audit_log(
                    AuditEventType.USER_LOGIN,
                    user_id=_uid,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    details={"role": _role_val}
                )
        except Exception:
            pass
    threading.Thread(target=_bg_login_audit, daemon=True).start()
    
    # Get redirect URL
    redirect_url = get_dashboard_redirect_url(user.role)
    
    # Build user dict manually to avoid email validation issues with .test domains
    counts = _compute_user_counts(user, db)
    user_dict = {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "background_url": user.background_url,
        "bio": user.bio,
        "instagram": user.instagram,
        "twitter": user.twitter,
        "website": user.website,
        "preferred_city": user.preferred_city.value if user.preferred_city else None,
        "preferred_language": user.preferred_language,
        "foreigner_mode": user.foreigner_mode,
        "role": user.role.value,
        "status": user.status.value,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        **counts,
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_dict,
        "redirect_url": redirect_url
    }


@router.post("/admin/login")
@limiter.limit("5/minute") if limiter else lambda f: f
def admin_login(
    request: Request,
    credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Dedicated, hardened Admin Console login endpoint.
    Strictly restricted to ADMIN and SUPER_ADMIN accounts with tighter rate limiting
    and mandatory security audit logging for every attempt.
    """
    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")

    if not credentials.email or not credentials.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin email and password are required."
        )

    user = db.query(User).filter(User.email.ilike(credentials.email.strip())).first()
    if not user or not user.password_hash or not verify_password(credentials.password, user.password_hash):
        _log_security(
            db, "failed_admin_login", "warning",
            user_id=user.id if user else None,
            user_email=credentials.email.strip().lower(),
            ip_address=client_ip, user_agent=user_agent,
            endpoint="/auth/admin/login", method="POST",
            details={"reason": "invalid_credentials"}
        )
        if security_monitor:
            security_monitor.detect_brute_force(ip_address=client_ip, username=credentials.email.strip().lower())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials."
        )

    if user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        _log_security(
            db, "unauthorized_admin_login", "error",
            user_id=user.id, user_email=user.email,
            ip_address=client_ip, user_agent=user_agent,
            endpoint="/auth/admin/login", method="POST",
            details={"reason": "non_admin_role", "role": user.role.value}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. This portal is restricted to authorized administrators."
        )

    if user.status != UserStatus.ACTIVE:
        _log_security(
            db, "failed_admin_login", "error",
            user_id=user.id, user_email=user.email,
            ip_address=client_ip, user_agent=user_agent,
            endpoint="/auth/admin/login", method="POST",
            details={"reason": f"account_{user.status.value}"}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator account is not active."
        )

    # 2FA gate if enabled on the admin account
    if user.totp_enabled and user.totp_secret:
        two_factor_token = create_access_token(
            data={"sub": str(user.id), "purpose": "2fa"},
            expires_delta=timedelta(minutes=5),
        )
        return {
            "requires_2fa": True,
            "two_factor_token": two_factor_token,
        }

    user.last_login = datetime.now(timezone.utc)
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = _set_refresh_token(user, db, commit=False)
    _log_security(
        db, "admin_login", "info",
        user_id=user.id, user_email=user.email,
        ip_address=client_ip, user_agent=user_agent,
        endpoint="/auth/admin/login", method="POST",
        details={"role": user.role.value, "portal": "admin_console"}
    )
    db.commit()

    user_dict = {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "role": user.role.value,
        "status": user.status.value,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "followers_count": 0,
        "following_count": 0,
    }
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_dict,
        "redirect_url": "/admin",
    }


class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/refresh")
@limiter.limit("10/minute") if limiter else lambda f: f
def refresh_access_token(
    request: Request,
    data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using a refresh token."""
    hashed = _hash_refresh_token(data.refresh_token)
    user = db.query(User).filter(User.refresh_token == hashed).first()
    if not user or not _verify_refresh_token(user, data.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Issue new access token + rotate refresh token
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = _set_refresh_token(user, db)

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
@limiter.limit("60/minute") if limiter else lambda f: f
def get_me(
    request: Request,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get current user profile"""
    counts = _compute_user_counts(current_user, db)
    base_data = {
        **{c.name: getattr(current_user, c.name) for c in current_user.__table__.columns},
        "artist_profile": current_user.artist_profile,
        "organizer_profile": current_user.organizer_profile,
        "business_profile": current_user.business_profile,
        "vendor_profile": current_user.vendor_profile,
        **counts,
    }
    staff_ctx = getattr(current_user, "_staff_context", None)
    if staff_ctx:
        perms = dict(staff_ctx.get("staff_permissions") or {})
        if (staff_ctx.get("staff_role") or "").strip().lower() == "finance":
            perms.setdefault("financials", True)
            perms.setdefault("ordersApproval", True)
            perms.setdefault("payouts", True)
        base_data.update({
            "first_name": staff_ctx.get("staff_name") or current_user.first_name,
            "last_name": "",
            "email": staff_ctx.get("staff_email") or current_user.email,
            "phone": staff_ctx.get("staff_phone") or current_user.phone,
            "role": UserRole.BUSINESS,
            "staff_id": staff_ctx.get("staff_id"),
            "staff_role": staff_ctx.get("staff_role"),
            "staff_permissions": perms,
            "business_name": staff_ctx.get("business_name"),
        })
    return base_data


@router.put("/me", response_model=UserResponse)
def update_me(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile.

    Accepts both backend and frontend field names (e.g. `preferred_city` or `city_id`).
    """
    if getattr(current_user, "_staff_context", None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff accounts cannot modify the business owner's profile",
        )

    # Update fields if present
    if user_data.first_name is not None:
        current_user.first_name = user_data.first_name.strip()
    if user_data.last_name is not None:
        current_user.last_name = user_data.last_name.strip()
    if user_data.username is not None:
        clean_un = user_data.username.strip().lstrip('@')
        if clean_un:
            clash = db.query(User).filter(User.username.ilike(clean_un), User.id != current_user.id).first()
            if clash:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")
            current_user.username = clean_un
        else:
            current_user.username = None
    if user_data.bio is not None:
        current_user.bio = user_data.bio
        if current_user.business_profile is not None:
            current_user.business_profile.description = user_data.bio
        if current_user.organizer_profile is not None:
            current_user.organizer_profile.description = user_data.bio
        if current_user.artist_profile is not None:
            current_user.artist_profile.bio = user_data.bio
        if current_user.vendor_profile is not None:
            current_user.vendor_profile.description = user_data.bio
    if getattr(user_data, 'business_name', None):
        bname = user_data.business_name.strip()
        if bname:
            if current_user.business_profile is not None:
                current_user.business_profile.business_name = bname
            if current_user.organizer_profile is not None:
                current_user.organizer_profile.organization_name = bname
            if current_user.vendor_profile is not None:
                current_user.vendor_profile.business_name = bname
            try:
                from utils.cache import invalidate_business_caches, invalidate_vendor_caches
                invalidate_business_caches()
                invalidate_vendor_caches()
            except Exception:
                pass
    elif (user_data.first_name is not None or user_data.last_name is not None):
        # Auto-heal legacy placeholder names like "<First>'s Business" when the user updates their name
        new_full = f"{(current_user.first_name or '').strip()} {(current_user.last_name or '').strip()}".strip()
        if new_full:
            def _is_legacy_placeholder(val: Optional[str]) -> bool:
                if not val:
                    return True
                low = val.strip().lower()
                return (
                    low.endswith("'s business")
                    or low.endswith("’s business")
                    or low.endswith("'s store")
                    or low.endswith("vendor services")
                    or low in ("my business", "my event business", "my vendor business", "business", "vendor")
                )
            changed_biz = False
            if current_user.business_profile is not None and _is_legacy_placeholder(current_user.business_profile.business_name):
                current_user.business_profile.business_name = new_full
                changed_biz = True
            if current_user.organizer_profile is not None and _is_legacy_placeholder(current_user.organizer_profile.organization_name):
                current_user.organizer_profile.organization_name = new_full
                changed_biz = True
            if current_user.vendor_profile is not None and _is_legacy_placeholder(current_user.vendor_profile.business_name):
                current_user.vendor_profile.business_name = new_full
                changed_biz = True
            if changed_biz:
                try:
                    from utils.cache import invalidate_business_caches, invalidate_vendor_caches
                    invalidate_business_caches()
                    invalidate_vendor_caches()
                except Exception:
                    pass
    if getattr(user_data, 'stage_name', None):
        sname = user_data.stage_name.strip()
        if sname and current_user.artist_profile is not None:
            current_user.artist_profile.stage_name = sname
    if user_data.avatar_url is not None:
        current_user.avatar_url = user_data.avatar_url
        if current_user.vendor_profile is not None:
            current_user.vendor_profile.logo_url = user_data.avatar_url
    if user_data.background_url is not None:
        current_user.background_url = user_data.background_url
        if current_user.vendor_profile is not None:
            current_user.vendor_profile.banner_url = user_data.background_url
    
    # Handle city from either city_id (frontend) or preferred_city using helper
    # Use model_fields_set to distinguish "not provided" from "explicitly null"
    city_fields_set = user_data.model_fields_set & {'city_id', 'preferred_city'}
    if city_fields_set:
        city = user_data.get_preferred_city()
        current_user.preferred_city = city  # allow clearing city by sending null
        if current_user.artist_profile is not None:
            current_user.artist_profile.city = city
        if current_user.organizer_profile is not None:
            current_user.organizer_profile.city = city
        if current_user.business_profile is not None:
            try:
                current_user.business_profile.city = City(city) if city else None
            except Exception:
                pass
        if current_user.vendor_profile is not None:
            try:
                current_user.vendor_profile.city = City(city) if city else None
            except Exception:
                pass
    
    if user_data.phone is not None:
        current_user.phone = user_data.phone if user_data.phone.strip() else None
    if user_data.preferred_language is not None:
        current_user.preferred_language = user_data.preferred_language
    if user_data.foreigner_mode is not None:
        current_user.foreigner_mode = user_data.foreigner_mode
    if user_data.instagram is not None:
        current_user.instagram = user_data.instagram
    if user_data.twitter is not None:
        current_user.twitter = user_data.twitter
    if getattr(user_data, "tiktok", None) is not None:
        current_user.tiktok = user_data.tiktok
    if user_data.wechat_id is not None:
        current_user.wechat_id = user_data.wechat_id
    if getattr(user_data, "gender", None) is not None:
        current_user.gender = user_data.gender
    if getattr(user_data, "date_of_birth", None) is not None:
        raw_dob = user_data.date_of_birth
        if isinstance(raw_dob, str) and raw_dob.strip():
            try:
                from datetime import datetime as _dt
                current_user.date_of_birth = _dt.fromisoformat(raw_dob.replace("Z", "+00:00"))
            except Exception:
                pass
        elif not raw_dob:
            current_user.date_of_birth = None
        else:
            current_user.date_of_birth = raw_dob
    if getattr(user_data, "profile_data", None) is not None and isinstance(user_data.profile_data, dict):
        existing_pdata = dict(current_user.profile_data or {})
        existing_pdata.update(user_data.profile_data)
        current_user.profile_data = existing_pdata
    if user_data.email is not None and str(user_data.email).strip():
        new_email = str(user_data.email).strip().lower()
        if new_email != (current_user.email or "").lower():
            clash = db.query(User).filter(User.email.ilike(new_email), User.id != current_user.id).first()
            if clash:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already in use")
            current_user.email = new_email
    if user_data.website is not None:
        current_user.website = user_data.website
        if current_user.business_profile is not None:
            current_user.business_profile.website = user_data.website
        if current_user.organizer_profile is not None:
            current_user.organizer_profile.website = user_data.website
        if current_user.vendor_profile is not None:
            current_user.vendor_profile.website = user_data.website

    db.commit()
    db.refresh(current_user)

    counts = _compute_user_counts(current_user, db)
    return {
        **{c.name: getattr(current_user, c.name) for c in current_user.__table__.columns
           if c.name not in SENSITIVE_USER_COLUMNS},
        "artist_profile": current_user.artist_profile,
        "organizer_profile": current_user.organizer_profile,
        "business_profile": current_user.business_profile,
        "vendor_profile": current_user.vendor_profile,
        **counts,
    }


# ==================== LEGACY ENDPOINTS (DEPRECATED) ====================

@router.post("/otp/send")
def send_otp_deprecated():
    """
    DEPRECATED: OTP system removed for Beta Launch.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="OTP verification has been removed. Please use email/password registration."
    )


@router.post("/otp/verify")
def verify_otp_deprecated():
    """
    DEPRECATED: OTP system removed for Beta Launch.
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="OTP verification has been removed. Please use email/password login."
    )


# ==================== SOCIAL LOGIN ====================

# Google OAuth Configuration
auth_settings = get_settings()

class GoogleAuthRequest(BaseModel):
    token: str  # Google ID token or access token from frontend
    role: Optional[str] = "user"
    business_name: Optional[str] = None
    artist_type: Optional[str] = None
    vendor_type: Optional[str] = None
    business_type: Optional[str] = None


@router.post("/google/login", response_model=SignupRedirectResponse)
@limiter.limit("30/minute") if limiter else lambda f: f
def google_login(
    request: Request,
    data: GoogleAuthRequest, db: Session = Depends(get_db)
):
    """
    Login/Register with Google OAuth.
    Frontend sends Google ID token (or access token) after user authenticates with Google.
    """
    try:
        import requests
        
        # 1. Verify the Google ID token via tokeninfo
        google_response = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={data.token}",
            timeout=10
        )
        
        used_access_token = False
        if google_response.status_code != 200:
            # Fallback: if client passed an OAuth2 access_token instead of id_token, verify via userinfo
            userinfo_resp = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {data.token}"},
                timeout=10
            )
            if userinfo_resp.status_code == 200:
                google_data = userinfo_resp.json()
                used_access_token = True
            else:
                _log_security(db, "failed_login", "warning",
                              endpoint="/auth/google/login", method="POST",
                              details={"reason": "invalid_google_token", "status_code": google_response.status_code})
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token"
                )
        else:
            google_data = google_response.json()

        allowed_client_ids = {
            auth_settings.GOOGLE_CLIENT_ID,
            "247782235504-v65bs2rl21kt1ovb3vrglskndf276li9.apps.googleusercontent.com",
            "247782235504-cn5jtjv983t1i1isied107dlrgf1vifs.apps.googleusercontent.com",
        }
        allowed_client_ids = {cid for cid in allowed_client_ids if cid}

        if not used_access_token:
            token_aud = str(google_data.get("aud") or "")
            token_azp = str(google_data.get("azp") or "")

            # Security: verify the token was issued for our Google Cloud project (247782235504)
            aud_ok = (token_aud in allowed_client_ids) or token_aud.startswith("247782235504-")
            azp_ok = (token_azp in allowed_client_ids) or token_azp.startswith("247782235504-")
            if not aud_ok and not azp_ok:
                _log_security(db, "failed_login", "error",
                              endpoint="/auth/google/login", method="POST",
                              details={"reason": "invalid_audience", "aud": token_aud, "azp": token_azp})
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token audience"
                )

        # Security: only trust verified emails
        email_verified = google_data.get("email_verified")
        if str(email_verified).lower() not in ("true", "1"):
            _log_security(db, "failed_login", "warning",
                          user_email=google_data.get("email"),
                          endpoint="/auth/google/login", method="POST",
                          details={"reason": "email_not_verified"})
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google email not verified"
            )
        
        # Extract user info from Google
        google_id = google_data.get("sub")
        email = (google_data.get("email") or "").strip().lower()
        first_name = google_data.get("given_name", "")
        last_name = google_data.get("family_name", "")
        picture = google_data.get("picture", "")
        
        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google token missing required information"
            )
        
        # Check if user exists by Google ID
        user = db.query(User).filter(User.google_id == google_id).first()
        
        if not user:
            # Check if user exists by email (case-insensitive)
            user = db.query(User).filter(User.email.ilike(email)).first()
            
            if user:
                if user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
                    _log_security(db, "blocked_admin_oauth", "warning",
                                  user_id=user.id, user_email=user.email,
                                  endpoint="/auth/google/login", method="POST",
                                  details={"reason": "admin_oauth_disabled"})
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Administrator accounts must sign in through the dedicated Admin Console."
                    )
                # Link Google account to existing user
                user.google_id = google_id
                if picture and not user.avatar_url:
                    user.avatar_url = picture
                _log_security(db, "update", "info",
                              user_id=user.id, user_email=user.email,
                              endpoint="/auth/google/login", method="POST",
                              details={"reason": "google_account_linked"})
            else:
                # Create new user — normalize role string safely
                raw_role = (data.role or "user").strip().lower()
                role_map = {
                    "user": UserRole.USER,
                    "business": UserRole.BUSINESS,
                    "organizer": UserRole.BUSINESS,
                    "artist": UserRole.ARTIST,
                    "artist_dj": UserRole.ARTIST,
                    "dj": UserRole.ARTIST,
                    "vendor": UserRole.VENDOR,
                }
                signup_role = role_map.get(raw_role, UserRole.USER)
                google_full_name = f"{first_name} {last_name}".strip()
                resolved_google_entity = (
                    (data.business_name or "").strip()
                    or google_full_name
                    or email.split("@")[0]
                )
                user = User(
                    email=email,
                    first_name=first_name or resolved_google_entity,
                    last_name=last_name,
                    google_id=google_id,
                    avatar_url=picture,
                    role=signup_role,
                    status=UserStatus.ACTIVE,
                    is_verified=False
                )
                db.add(user)
                db.flush()
                _log_security(db, "create", "info",
                              user_id=user.id, user_email=user.email,
                              endpoint="/auth/google/login", method="POST",
                              details={"role": user.role.value, "source": "google"})
                
                # Create basic profile based on role
                if signup_role == UserRole.ARTIST:
                    artist_profile = ArtistProfile(
                        user_id=user.id,
                        stage_name=resolved_google_entity,
                        artist_type=(data.artist_type or "DJ").strip(),
                        is_approved=True,
                        is_verified=False
                    )
                    db.add(artist_profile)
                elif signup_role == UserRole.BUSINESS:
                    business_profile = BusinessProfile(
                        user_id=user.id,
                        business_name=resolved_google_entity,
                        business_type=[(data.business_type or "organizer").strip().lower()],
                        is_verified=False,
                        is_approved=True
                    )
                    db.add(business_profile)
                    db.flush()  # Get business_profile.id before referencing it
                    organizer_profile = OrganizerProfile(
                        user_id=user.id,
                        business_profile_id=business_profile.id,
                        organization_name=resolved_google_entity,
                        is_verified=False,
                        is_approved=True
                    )
                    db.add(organizer_profile)
                elif signup_role == UserRole.VENDOR:
                    vendor_profile = VendorProfile(
                        user_id=user.id,
                        business_name=resolved_google_entity,
                        vendor_type=(data.vendor_type or "food").strip().lower(),
                        is_verified=False,
                        is_approved=True
                    )
                    db.add(vendor_profile)
                
                # Send welcome email only for USER role (business/artist/vendor get welcome on approval)
                if signup_role == UserRole.USER:
                    try:
                        send_welcome_email(to_email=user.email, first_name=user.first_name or "")
                    except Exception:
                        pass
                
                # Create 30-day free trial for non-user roles
                if signup_role in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]:
                    try:
                        SubscriptionService.create_trial_subscription(db, user.id, signup_role)
                    except Exception:
                        pass
        
        # Block Google OAuth if matched user is an Admin
        if user and user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            _log_security(db, "blocked_admin_oauth", "warning",
                          user_id=user.id, user_email=user.email,
                          endpoint="/auth/google/login", method="POST",
                          details={"reason": "admin_oauth_disabled"})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator accounts must sign in through the dedicated Admin Console."
            )

        # Update last login
        user.last_login = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        
        # Log successful Google login
        _log_security(db, "login", "info",
                      user_id=user.id, user_email=user.email,
                      endpoint="/auth/google/login", method="POST",
                      details={"role": user.role.value, "source": "google"})
        
        # Generate tokens
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = _set_refresh_token(user, db)
        
        # Get redirect URL
        redirect_url = get_dashboard_redirect_url(user.role)
        
        # Build user dict manually to avoid Pydantic ORM validation issues
        counts = _compute_user_counts(user, db)
        user_dict = {
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "username": user.username,
            "avatar_url": user.avatar_url,
            "background_url": user.background_url,
            "bio": user.bio,
            "instagram": user.instagram,
            "twitter": user.twitter,
            "website": user.website,
            "preferred_city": user.preferred_city.value if user.preferred_city else None,
            "preferred_language": user.preferred_language,
            "foreigner_mode": user.foreigner_mode,
            "role": user.role.value,
            "status": user.status.value,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            **counts,
        }
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user_dict,
            "redirect_url": redirect_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        _log_security(db, "failed_login", "error",
                      endpoint="/auth/google/login", method="POST",
                      details={"reason": "internal_error", "error": str(e)})
        logger.error(f"Google login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to authenticate with Google"
        )


@router.get("/google/config")
def get_google_config():
    """Get Google OAuth configuration for frontend"""
    return {
        "client_id": auth_settings.GOOGLE_CLIENT_ID,
        "enabled": bool(auth_settings.GOOGLE_CLIENT_ID and auth_settings.GOOGLE_CLIENT_SECRET)
    }


@router.get("/csrf-token")
def get_csrf_token(current_user: User = Depends(get_current_user)):
    """
    Get a CSRF token for the current user session.
    Frontend should include this token in X-CSRF-Token header for state-changing requests.
    """
    session_id = f"user_{current_user.id}"
    csrf_token = auth_manager.generate_csrf_token(session_id)
    
    return {
        "csrf_token": csrf_token,
        "expires_in": 3600  # 1 hour
    }
