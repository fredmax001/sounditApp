"""
Subscription-based Feature Access Control
Decorators and middleware for enforcing subscription limits
"""
import asyncio
from functools import wraps
from fastapi import HTTPException, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User
from services.subscription_service import SubscriptionService


def plan_restricted_error(feature_name: str = None, current_plan: str = None, required_plan: str = None):
    """Return a standardized PLAN_RESTRICTED HTTPException"""
    message = "Upgrade required to access this feature"
    if feature_name and required_plan:
        message = f"This feature is available on the {required_plan} plan and above."
    detail = {
        "error": True,
        "code": "PLAN_RESTRICTED",
        "message": message,
        "feature": feature_name,
        "current_plan": current_plan,
        "required_plan": required_plan,
        "upgrade_url": "/subscriptions/plans"
    }
    return HTTPException(status_code=403, detail=detail)


def _run_check(feature_name: str, db: Session, current_user):
    status = SubscriptionService.get_subscription_status(db, current_user.id)
    
    if not status["has_active_subscription"]:
        raise plan_restricted_error(
            feature_name=feature_name,
            current_plan=None,
            required_plan="basic"
        )
    
    if feature_name:
        features = status.get("features", {})
        if not features.get(feature_name, False):
            current_plan = status.get("plan_type")
            required_plan = _infer_required_plan(feature_name)
            raise plan_restricted_error(
                feature_name=feature_name,
                current_plan=current_plan,
                required_plan=required_plan
            )
    return status


def require_subscription(feature_name: str = None):
    """Decorator to require active subscription for a feature"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            db = kwargs.get('db')
            current_user = kwargs.get('current_user')
            
            if not db or not current_user:
                raise HTTPException(status_code=500, detail="Missing dependencies")
            
            _run_check(feature_name, db, current_user)
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


def require_event_creation():
    """Decorator to check if user can create events"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            db = kwargs.get('db')
            current_user = kwargs.get('current_user')
            
            if not db or not current_user:
                raise HTTPException(status_code=500, detail="Missing dependencies")
            
            can_create, message = SubscriptionService.can_create_event(db, current_user.id)
            
            if not can_create:
                status = SubscriptionService.get_subscription_status(db, current_user.id)
                current_plan = status.get("plan_type")
                
                if not status["has_active_subscription"]:
                    raise plan_restricted_error(
                        feature_name="event_creation",
                        current_plan=current_plan,
                        required_plan="basic"
                    )
                else:
                    raise plan_restricted_error(
                        feature_name="event_creation",
                        current_plan=current_plan,
                        required_plan="pro"
                    )
            
            SubscriptionService.increment_feature_usage(db, current_user.id, "event_created")
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


def track_feature_usage(feature_type: str):
    """Decorator to track feature usage"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            db = kwargs.get('db')
            current_user = kwargs.get('current_user')
            
            result = func(*args, **kwargs)
            
            if db and current_user:
                SubscriptionService.increment_feature_usage(db, current_user.id, feature_type)
            
            return result
        return wrapper
    return decorator


def _infer_required_plan(feature_name: str) -> str:
    """Infer minimum required plan for a feature."""
    premium_features = {
        "priority_support", "verified_badge", "homepage_spotlight",
        "push_notifications", "advanced_analytics"
    }
    if feature_name in premium_features:
        return "premium"
    return "pro"


def check_feature_access(db: Session, user_id: int, feature_name: str):
    """Inline helper to check feature access and raise standardized error if denied."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise plan_restricted_error(feature_name=feature_name)
    _run_check(feature_name, db, user)

