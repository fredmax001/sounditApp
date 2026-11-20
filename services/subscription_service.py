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


def _aware(dt):
    """SQLite drops tzinfo on datetime read — normalize to UTC-aware."""
    if dt is None:
        return None
    if getattr(dt, 'tzinfo', None) is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class SubscriptionService:
    @staticmethod
    def has_active_artist_subscription(db: Session, user_id: int) -> bool:
        """Deposit receiving requires an active subscription or active trial for the artist role."""
        sub = SubscriptionService.get_active_subscription(db, user_id)
        return bool(
            sub
            and sub.role in [UserRole.ARTIST, UserRole.ADMIN, UserRole.SUPER_ADMIN]
            and sub.status == SubscriptionStatus.ACTIVE
        )

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
                    "table_reservations": True,
                    "event_booths": True,
                    "can_receive_deposits": True,
                    "features": ["unlimited_events", "verified_badge", "analytics", "priority_support", "community_posts", "table_reservations", "payouts", "event_booths", "can_receive_deposits"],
                },
                "can_access_features": True,
                "is_verified_premium": True,
                "is_trial": False,
                "is_trial_expired": False,
            }
        
        active_sub = SubscriptionService.get_active_subscription(db, user_id)
        
        # Check if user ever had a trial
        any_trial = db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.is_trial == True
        ).first()

        # If user is in a creator/business role (vendor, organizer, business, artist)
        # and has never had a trial or subscription, auto-grant 30-day trial if account was created within last 30 days
        if not active_sub and not any_trial and user.role in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]:
            account_created = _aware(user.created_at) if getattr(user, 'created_at', None) else None
            now = datetime.now(timezone.utc)
            if account_created and (now - account_created).days < 30:
                trial = Subscription(
                    user_id=user.id,
                    role=user.role,
                    plan_type=SubscriptionPlan.PREMIUM,
                    price=0.0,
                    status=SubscriptionStatus.ACTIVE,
                    start_date=account_created,
                    end_date=account_created + timedelta(days=30),
                    is_trial=True,
                )
                db.add(trial)
                db.commit()
                db.refresh(trial)
                active_sub = trial

        if not active_sub:
            pending_sub = db.query(Subscription).filter(
                and_(
                    Subscription.user_id == user_id,
                    Subscription.status == SubscriptionStatus.PENDING
                )
            ).order_by(Subscription.created_at.desc()).first()
            
            is_trial_expired = (any_trial is not None) or (
                user.role in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]
            )

            return {
                "has_active_subscription": False,
                "has_pending_subscription": pending_sub is not None,
                "pending_subscription": pending_sub,
                "role": user.role.value,
                "can_access_features": False,
                "is_trial": False,
                "is_trial_expired": is_trial_expired,
                "days_remaining": 0,
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
        else:
            from subscription_config import get_plan_features
            features = dict(get_plan_features(active_sub.role.value, active_sub.plan_type.value) or {})

        # If trial is active, ensure all premium features are fully unlocked
        if getattr(active_sub, 'is_trial', False):
            features["event_limit"] = None
            features["portfolio_limit"] = None
            features["media_limit"] = None
            features["featured_listing"] = True
            features["analytics_access"] = True
            features["priority_support"] = True
            features["homepage_spotlight"] = True
            features["table_reservations"] = True
            features["event_booths"] = True
            features["can_receive_deposits"] = True
        
        days_left = max(0, (_aware(active_sub.end_date) - datetime.now(timezone.utc)).days)

        return {
            "has_active_subscription": True,
            "subscription": active_sub,
            "plan_type": active_sub.plan_type.value,
            "role": active_sub.role.value,
            "start_date": active_sub.start_date,
            "end_date": active_sub.end_date,
            # SQLite drops tzinfo on read — normalize before arithmetic
            "days_remaining": days_left,
            "features": features,
            "can_access_features": True,
            "is_trial": getattr(active_sub, 'is_trial', False),
            "is_trial_expired": False,
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
            if status.get("is_trial_expired"):
                return False, "Your 1-month free trial has ended. An active subscription is required to create events."
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
                           role: UserRole, payment_method: str = None,
                           billing_period: str = "monthly"):
        # Prefer the admin-configured DB price for the requested billing period;
        # fall back to monthly config, then to the hardcoded matrix.
        price = None
        duration_days = None
        try:
            from models import SubscriptionPlanConfig
            cfg = db.query(SubscriptionPlanConfig).filter(
                SubscriptionPlanConfig.role == role,
                SubscriptionPlanConfig.plan_type == plan_type,
                SubscriptionPlanConfig.billing_period == billing_period,
                SubscriptionPlanConfig.is_active == True
            ).first()
            if not cfg and billing_period != "monthly":
                cfg = db.query(SubscriptionPlanConfig).filter(
                    SubscriptionPlanConfig.role == role,
                    SubscriptionPlanConfig.plan_type == plan_type,
                    SubscriptionPlanConfig.is_active == True
                ).first()
            if cfg:
                price = cfg.price
                duration_days = cfg.duration_days
        except Exception:
            price = None
        if price is None:
            price = get_plan_price(role.value, plan_type.value)
        if duration_days is None:
            duration_days = 365 if billing_period == "yearly" else 30

        subscription = Subscription(
            user_id=user_id,
            role=role,
            plan_type=plan_type,
            billing_period=billing_period,
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

        # Require proof of payment before activation (unless free/trial)
        if not subscription.is_trial and (subscription.price or 0) > 0:
            if not subscription.payment_proof_hash and not subscription.payment_screenshot and not subscription.payment_reference:
                raise ValueError("Cannot approve: no payment proof (screenshot or reference) on this subscription")
        
        now = datetime.now(timezone.utc)
        
        # Lifetime subscriptions (admin-granted) never expire
        period = subscription.billing_period or "monthly"
        if period == "lifetime":
            duration_days = 36500
        else:
            # Match duration to the billing period purchased (default monthly)
            plan_config = db.query(SubscriptionPlanConfig).filter(
                SubscriptionPlanConfig.role == subscription.role,
                SubscriptionPlanConfig.plan_type == subscription.plan_type,
                SubscriptionPlanConfig.billing_period == period,
                SubscriptionPlanConfig.is_active == True
            ).first()
            if plan_config:
                duration_days = plan_config.duration_days
            else:
                duration_days = 365 if period == "yearly" else 30
        
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
        """Create a 30-day free PREMIUM trial subscription for new vendors, organizers, and artists."""
        # Only grant trials to creator/business roles
        valid_roles = [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]
        if role not in valid_roles:
            return None

        # Check if user already had a trial
        existing = db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.is_trial == True
        ).first()
        if existing:
            return existing

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
        
        db.commit()
        db.refresh(trial)
        return trial

    # ── User self-service: cancel / resume / restore ────────────────────────
    # Payments are one-off YOOPAY transfers (no store billing, no auto-renew),
    # so "cancel" never refunds and never cuts access to a period already paid for.

    @staticmethod
    def cancel_subscription(db: Session, user_id: int, reason: Optional[str] = None) -> Dict[str, Any]:
        """Cancel the user's current subscription.

        - PENDING (not yet approved)  -> withdrawn immediately (status CANCELLED)
        - Free trial                  -> ends immediately (status CANCELLED)
        - Paid ACTIVE                 -> marked cancelled, access kept until end_date,
                                         then the expiry job moves it to EXPIRED
        """
        now = datetime.now(timezone.utc)
        reason = (reason or "").strip()[:500] or None

        pending = db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.PENDING,
        ).order_by(Subscription.created_at.desc()).first()
        active = SubscriptionService.get_active_subscription(db, user_id)

        if not pending and not active:
            raise ValueError("You don't have a subscription to cancel")

        if pending and not active:
            pending.status = SubscriptionStatus.CANCELLED
            pending.cancelled_at = now
            pending.cancel_reason = reason
            pending.admin_notes = ((pending.admin_notes or "") + " | Withdrawn by user").strip(" |")
            db.commit()
            return {"action": "withdrawn", "subscription": pending, "access_until": None}

        if (active.billing_period or "") == "lifetime":
            raise ValueError("Lifetime plans granted by Sound It can't be cancelled from the app. Please contact support.")

        if active.cancelled_at:
            raise ValueError("This subscription is already cancelled")

        active.cancelled_at = now
        active.cancel_reason = reason

        if active.is_trial or (active.price or 0) <= 0:
            active.status = SubscriptionStatus.CANCELLED
            active.end_date = now
            db.commit()
            return {"action": "ended", "subscription": active, "access_until": None}

        db.commit()
        return {"action": "cancelled_at_period_end", "subscription": active, "access_until": active.end_date}

    @staticmethod
    def resume_subscription(db: Session, user_id: int) -> Subscription:
        """Undo a cancellation on a paid plan that hasn't reached its end date yet."""
        now = datetime.now(timezone.utc)
        sub = db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.cancelled_at.isnot(None),
            Subscription.end_date > now,
        ).order_by(Subscription.end_date.desc()).first()
        if not sub:
            raise ValueError("No cancelled subscription to resume")
        sub.cancelled_at = None
        sub.cancel_reason = None
        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def restore_purchases(db: Session, user_id: int) -> Dict[str, Any]:
        """Re-sync the user's paid access from the server record.

        Used after reinstalling the app, switching phones, or if the app shows no
        plan even though one was paid for. Repairs paid subscriptions whose period
        hasn't ended but were wrongly moved to EXPIRED, and re-grants the plan's
        verification badge.
        """
        now = datetime.now(timezone.utc)
        restored = []

        wrongly_expired = db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.EXPIRED,
            Subscription.end_date > now,
            Subscription.approved_at.isnot(None),
        ).all()
        for sub in wrongly_expired:
            sub.status = SubscriptionStatus.ACTIVE
            restored.append(sub.id)

        active = SubscriptionService.get_active_subscription(db, user_id)
        if active:
            plan_config = db.query(SubscriptionPlanConfig).filter(
                SubscriptionPlanConfig.role == active.role,
                SubscriptionPlanConfig.plan_type == active.plan_type,
                SubscriptionPlanConfig.is_active == True,
            ).first()
            if plan_config and plan_config.verified_badge:
                user = db.query(User).filter(User.id == user_id).first()
                if user and not user.verification_badge:
                    user.verification_badge = True
                    user.is_verified = True

        db.commit()

        pending = db.query(Subscription).filter(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.PENDING,
        ).order_by(Subscription.created_at.desc()).first()

        return {
            "active": active,
            "pending": pending,
            "restored_ids": restored,
        }

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
            if sub.role == UserRole.ARTIST:
                try:
                    from api.notifications import create_notification
                    create_notification(
                        db=db,
                        user_id=sub.user_id,
                        title="Artist subscription expired",
                        message="Your artist subscription has expired. You can keep your profile and bookings, but receiving booking deposits through Sound It requires an active subscription.",
                        notification_type="subscription_update",
                        data={"subscription_id": sub.id, "eligibility": "booking_deposits_disabled"},
                    )
                except Exception:
                    # Expiry state must still be persisted if notification delivery fails.
                    pass
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
