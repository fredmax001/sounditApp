"""
Subscription Service - Business logic for subscription management
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict, Any

from models import (
    User, Subscription, SubscriptionFeatureUsage,
    SubscriptionStatus, SubscriptionPlan, UserRole, SubscriptionPlanConfig
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
        
        # Verified users get unlimited premium access without subscription
        if user.is_verified:
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
        
        end_date = active_sub.end_date
        if end_date and end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        start_date = active_sub.start_date
        if start_date and start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        
        return {
            "has_active_subscription": True,
            "subscription": active_sub,
            "plan_type": active_sub.plan_type.value,
            "role": active_sub.role.value,
            "start_date": start_date,
            "end_date": end_date,
            "days_remaining": (end_date - datetime.now(timezone.utc)).days if end_date else 0,
            "features": features,
            "can_access_features": True,
            "is_trial": active_sub.is_trial or False,
        }
    
    @staticmethod
    def can_create_event(db: Session, user_id: int):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False, "User not found"
        
        if user.role not in [UserRole.BUSINESS, UserRole.ORGANIZER]:
            return True, "User role doesn't require subscription"
        
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
    def create_trial_subscription(db: Session, user_id: int, role: UserRole):
        """Create a 30-day free trial subscription for new business/vendor/artist users."""
        now = datetime.now(timezone.utc)
        
        # Check if user already had a trial
        existing_trial = db.query(Subscription).filter(
            and_(
                Subscription.user_id == user_id,
                Subscription.is_trial == True
            )
        ).first()
        
        if existing_trial:
            return existing_trial
        
        subscription = Subscription(
            user_id=user_id,
            role=role,
            plan_type=SubscriptionPlan.PRO,
            price=0.0,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            end_date=now + timedelta(days=30),
            is_trial=True,
            payment_method=None
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
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.start_date = now
        subscription.end_date = now + timedelta(days=30)
        subscription.approved_by = admin_id
        subscription.approved_at = now
        subscription.admin_notes = notes
        
        # Grant verification badge if plan includes it
        user = db.query(User).filter(User.id == subscription.user_id).first()
        if user:
            plan_config = db.query(SubscriptionPlanConfig).filter(
                SubscriptionPlanConfig.role == subscription.role,
                SubscriptionPlanConfig.plan_type == subscription.plan_type,
                SubscriptionPlanConfig.is_active == True
            ).first()
            if plan_config and plan_config.verified_badge:
                user.verification_badge = True
        
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
        
        db.commit()
        return expired
