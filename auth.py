from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserStatus
from config import get_settings

settings = get_settings()


# REDACTED_PLACEHOLDER hashing
import bcrypt
# Monkey patch bcrypt for passlib compatibility
if not hasattr(bcrypt, '__about__'):
    class About:
        __version__ = bcrypt.__version__
    bcrypt.__about__ = About()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT setup
security = HTTPBearer(auto_error=False)



def verify_REDACTED_PLACEHOLDER(plain_REDACTED_PLACEHOLDER: str, hashed_REDACTED_PLACEHOLDER: str) -> bool:
    try:
        return pwd_context.verify(plain_REDACTED_PLACEHOLDER, hashed_REDACTED_PLACEHOLDER)
    except Exception:
        # Fallback for bcrypt version mismatch
        import bcrypt
        try:
            return bcrypt.checkpw(plain_REDACTED_PLACEHOLDER.encode('utf-8'), hashed_REDACTED_PLACEHOLDER.encode('utf-8'))
        except Exception:
            return False


def get_REDACTED_PLACEHOLDER_hash(REDACTED_PLACEHOLDER: str) -> str:
    try:
        return pwd_context.hash(REDACTED_PLACEHOLDER)
    except Exception:
        # Fallback for bcrypt version mismatch
        import bcrypt
        return bcrypt.hashpw(REDACTED_PLACEHOLDER.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def REDACTED_PLACEHOLDER(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_REDACTED_PLACEHOLDER(REDACTED_PLACEHOLDER: str) -> Optional[dict]:
    try:
        payload = jwt.decode(REDACTED_PLACEHOLDER, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    REDACTED_PLACEHOLDER = credentials.credentials
    payload = decode_REDACTED_PLACEHOLDER(REDACTED_PLACEHOLDER)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Handle staff tokens (sub = "staff:123")
    if isinstance(user_id, str) and user_id.startswith("staff:"):
        from models import StaffMember
        staff_id = int(user_id.split(":")[1])
        staff = db.query(StaffMember).filter(StaffMember.id == staff_id).first()
        if not staff or staff.status != "Active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Staff account not found or inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Return the business user that the staff belongs to
        user = db.query(User).filter(User.id == staff.business_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Business user not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Attach staff info to user for downstream use
        user._staff_context = {
            "staff_id": staff.id,
            "staff_name": staff.full_name,
            "staff_role": staff.role,
            "staff_permissions": staff.permissions or {},
            "event_id": payload.get("event_id"),
        }
        return user
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )
    
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if credentials is None:
        return None
        
    REDACTED_PLACEHOLDER = credentials.credentials
    payload = decode_REDACTED_PLACEHOLDER(REDACTED_PLACEHOLDER)
    
    if payload is None:
        return None
    
    user_id = payload.get("sub")
    if user_id is None:
        return None
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if user is None or user.status != UserStatus.ACTIVE:
        return None
        
    return user


# Alias for clarity
get_current_user_optional = get_optional_user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    from models import UserRole
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    from models import UserRole
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required",
        )
    return current_user


def require_permission(permission: str):
    """Factory that returns a dependency checking a specific permission key.
    Super admins and legacy admins (admin_role_id is None) always pass."""
    async def checker(current_user: User = Depends(require_admin)) -> User:
        from models import UserRole
        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user
        if current_user.role == UserRole.ADMIN and current_user.admin_role_id is None:
            return current_user
        role = current_user.admin_role
        if role and permission in role.permissions:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )
    return checker


async def require_organizer(current_user: User = Depends(get_current_user)) -> User:
    from models import UserRole
    # BUSINESS and ORGANIZER roles are unified - both can manage events
    if current_user.role not in [UserRole.ORGANIZER, UserRole.BUSINESS, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizer access required",
        )
    return current_user


# ─── Shared Password Validation ─────────────────────────────────────────────
import re as _re

def validate_password_strength(password: str) -> None:
    """Validate password meets security requirements. Shared across auth endpoints."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    if not _re.search(r'[A-Z]', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter"
        )
    if not _re.search(r'[a-z]', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter"
        )
    if not _re.search(r'\d', password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one digit"
        )
