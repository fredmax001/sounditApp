"""
Subscription Service - Business logic for subscription management
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict, Any

from models import (
    User, Subscription, SubscriptionFeatureUsage,
    SubscriptionStatus, SubscriptionPlan, UserRole, SubscriptionPlanConfig,
    ArtistProfile, BusinessProfile, OrganizerProfile, VendorProfile
)
from subscription_config import get_plan_price, get_plan_features


class SubscriptionService:
    @staticmethod
    def get_active_subscription(db: Session, user_id: int):
        now = datetime.now(timezone.utc)
        return db.query(Subscription).filter(
            and_(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.end_date > now
            )
        ).order_by(Subscription.end_date.desc()).first()
    
    @staticmethod
    def get_subscription_status(db: Session, user_id: int):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"has_active_subscription": False}
        
        # Verified users (admin-verified or premium badge) get unlimited premium access without subscription
        if user.verification_badge:
            return {
                "has_active_subscription": True,
                "plan_type": SubscriptionPlan.PREMIUM.value,
                "role": user.role.value,
                "days_remaining": 9999,
                "features": {
                    "event_limit": None,
                    "featured_listing": True,
                    "analytics_access": True,
                    "priority_support": True,
                    "verified_badge": True,
                    "homepage_spotlight": True,
                    "features": ["unlimited_events", "verified_badge", "analytics", "priority_support", "community_posts", "table_reservations", "payouts"],
                },
                "can_access_features": True,
                "is_verified_premium": True,
            }
        
        active_sub = SubscriptionService.get_active_subscription(db, user_id)
        
        if not active_sub:
            pending_sub = db.query(Subscription).filter(
                and_(
                    Subscription.user_id == user_id,
                    Subscription.status == SubscriptionStatus.PENDING
                )
            ).order_by(Subscription.created_at.desc()).first()
            
            return {
                "has_active_subscription": False,
                "has_pending_subscription": pending_sub is not None,
                "pending_subscription": pending_sub,
                "role": user.role.value,
                "can_access_features": False,
            }
        
        # Get plan features from database
        plan_config = db.query(SubscriptionPlanConfig).filter(
            SubscriptionPlanConfig.role == active_sub.role,
            SubscriptionPlanConfig.plan_type == active_sub.plan_type,
            SubscriptionPlanConfig.is_active == True
        ).first()
        
        features = {}
        if plan_config:
            features = {
                "event_limit": plan_config.event_limit,
                "featured_listing": plan_config.featured_listing,
                "analytics_access": plan_config.analytics_access,
                "priority_support": plan_config.priority_support,
                "verified_badge": plan_config.verified_badge,
                "homepage_spotlight": plan_config.homepage_spotlight,
                "features": plan_config.features,
            }
        
        return {
            "has_active_subscription": True,
            "subscription": active_sub,
            "plan_type": active_sub.plan_type.value,
            "role": active_sub.role.value,
            "start_date": active_sub.start_date,
            "end_date": active_sub.end_date,
            "days_remaining": (active_sub.end_date - datetime.now(timezone.utc)).days,
            "features": features,
            "can_access_features": True,
            "is_trial": getattr(active_sub, 'is_trial', False),
        }
    
    @staticmethod
    def is_profile_approved(db: Session, user: User) -> bool:
        """Check if user's role profile is approved by admin"""
        if user.role == UserRole.USER:
            return True
        if user.role == UserRole.ARTIST:
            profile = db.query(ArtistProfile).filter(ArtistProfile.user_id == user.id).first()
            return profile.is_approved if profile else False
        if user.role == UserRole.BUSINESS:
            business = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()
            organizer = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == user.id).first()
            return (business.is_approved if business else False) or (organizer.is_approved if organizer else False)
        if user.role == UserRole.VENDOR:
            profile = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
            return profile.is_approved if profile else False
        if user.role == UserRole.ORGANIZER:
            profile = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == user.id).first()
            return profile.is_approved if profile else False
        return True

    @staticmethod
    def can_create_event(db: Session, user_id: int):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False, "User not found"
        
        if user.role not in [UserRole.BUSINESS, UserRole.ORGANIZER]:
            return True, "User role doesn't require subscription"
        
        # Check admin approval first
        if not SubscriptionService.is_profile_approved(db, user):
            return False, "Account pending admin approval"
        
        status = SubscriptionService.get_subscription_status(db, user_id)
        
        if not status["has_active_subscription"]:
            return False, "Active subscription required"
        
        features = status.get("features", {})
        event_limit = features.get("event_limit")
        
        if event_limit is not None:
            usage = SubscriptionService.get_feature_usage(
                db, user_id, status["subscription"].id, "event_created"
            )
            if usage >= event_limit:
                return False, f"Event limit reached ({event_limit}/month)"
        
        return True, "Can create event"
    
    @staticmethod
    def get_feature_usage(db: Session, user_id: int, subscription_id: int, 
                          feature_type: str) -> int:
        now = datetime.now(timezone.utc)
        usage = db.query(SubscriptionFeatureUsage).filter(
            and_(
                SubscriptionFeatureUsage.user_id == user_id,
                SubscriptionFeatureUsage.subscription_id == subscription_id,
                SubscriptionFeatureUsage.feature_type == feature_type,
                SubscriptionFeatureUsage.period_start <= now,
                SubscriptionFeatureUsage.period_end >= now
            )
        ).first()
        
        return usage.usage_count if usage else 0
    
    @staticmethod
    def increment_feature_usage(db: Session, user_id: int, feature_type: str) -> bool:
        status = SubscriptionService.get_subscription_status(db, user_id)
        
        if not status["has_active_subscription"]:
            return False
        
        # Verified users have unlimited premium access without a real subscription
        if status.get("is_verified_premium"):
            return True
        
        subscription = status["subscription"]
        now = datetime.now(timezone.utc)
        
        usage = db.query(SubscriptionFeatureUsage).filter(
            and_(
                SubscriptionFeatureUsage.user_id == user_id,
                SubscriptionFeatureUsage.subscription_id == subscription.id,
                SubscriptionFeatureUsage.feature_type == feature_type,
                SubscriptionFeatureUsage.period_start <= now,
                SubscriptionFeatureUsage.period_end >= now
            )
        ).first()
        
        if not usage:
            usage = SubscriptionFeatureUsage(
                user_id=user_id,
                subscription_id=subscription.id,
                feature_type=feature_type,
                usage_count=0,
                period_start=subscription.start_date,
                period_end=subscription.end_date
            )
            db.add(usage)
        
        usage.usage_count += 1
        db.commit()
        return True
    
    @staticmethod
    def create_subscription(db: Session, user_id: int, plan_type: SubscriptionPlan,
                           role: UserRole, payment_method: str = None):
        price = get_plan_price(role.value, plan_type.value)
        
        subscription = Subscription(
            user_id=user_id,
            role=role,
            plan_type=plan_type,
            price=price,
            status=SubscriptionStatus.PENDING,
            payment_method=payment_method
        )
        
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        return subscription
    
    @staticmethod
    def activate_subscription(db: Session, subscription_id: int, 
                              admin_id: int, notes: str = None):
        subscription = db.query(Subscription).filter(
            Subscription.id == subscription_id
        ).first()
        
        if not subscription:
            raise ValueError("Subscription not found")
        
        if subscription.status != SubscriptionStatus.PENDING:
            raise ValueError("Subscription is not pending")
        
        now = datetime.now(timezone.utc)
        
        # Get plan config for duration
        plan_config = db.query(SubscriptionPlanConfig).filter(
            SubscriptionPlanConfig.role == subscription.role,
            SubscriptionPlanConfig.plan_type == subscription.plan_type,
            SubscriptionPlanConfig.is_active == True
        ).first()
        duration_days = plan_config.duration_days if plan_config else 30
        
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.start_date = now
        subscription.end_date = now + timedelta(days=duration_days)
        subscription.approved_by = admin_id
        subscription.approved_at = now
        subscription.admin_notes = notes
        
        # Grant verification badge if plan includes it
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if user:
            if plan_config and plan_config.verified_badge:
                user.verification_badge = True
                user.is_verified = True
        
        db.commit()
        db.refresh(subscription)
        return subscription
    
    @staticmethod
    def get_visibility_rank(db: Session, user_id: int) -> int:
        status = SubscriptionService.get_subscription_status(db, user_id)
        
        if not status["has_active_subscription"]:
            return 4
        
        features = status.get("features", {})
        return features.get("visibility_rank", 4)
    
    @staticmethod
    def create_trial_subscription(db: Session, user_id: int, role: UserRole):
        """Create a 30-day free PREMIUM trial subscription"""
        now = datetime.now(timezone.utc)
        trial = Subscription(
            user_id=user_id,
            role=role,
            plan_type=SubscriptionPlan.PREMIUM,
            price=0.0,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            end_date=now + timedelta(days=30),
            is_trial=True,
        )
        db.add(trial)
        
        # Grant verification badge for the premium trial
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.verification_badge = True
            user.is_verified = True
        
        db.commit()
        db.refresh(trial)
        return trial

    @staticmethod
    def check_expired_subscriptions(db: Session) -> list:
        """Mark expired active subscriptions as EXPIRED"""
        now = datetime.now(timezone.utc)
        expired = db.query(Subscription).filter(
            and_(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.end_date < now
            )
        ).all()
        
        for sub in expired:
            sub.status = SubscriptionStatus.EXPIRED
            # Check if we need to revoke verification badge
            user = db.query(User).filter(User.id == sub.user_id).first()
            if user and user.verification_badge:
                # Check if user has any other active subscription that grants verified_badge
                other_active = db.query(Subscription).filter(
                    and_(
                        Subscription.user_id == sub.user_id,
                        Subscription.id != sub.id,
                        Subscription.status == SubscriptionStatus.ACTIVE,
                        Subscription.end_date > now
                    )
                ).all()
                still_has_badge = False
                for other in other_active:
                    other_plan = db.query(SubscriptionPlanConfig).filter(
                        SubscriptionPlanConfig.role == other.role,
                        SubscriptionPlanConfig.plan_type == other.plan_type,
                        SubscriptionPlanConfig.is_active == True
                    ).first()
                    if other_plan and other_plan.verified_badge:
                        still_has_badge = True
                        break
                if not still_has_badge:
                    user.verification_badge = False
                    user.is_verified = False
        
        db.commit()
        return expired
