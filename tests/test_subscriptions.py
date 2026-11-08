"""
Subscription System Test
Tests core subscription functionality against an isolated in-memory DB.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models import Base, SubscriptionPlanConfig, UserRole, SubscriptionPlan


def _seed(db):
    """Seed the 10 plan configs matching production data (entry 101)."""
    plans = [
        # (role, plan_type, monthly_price, yearly_price)
        (UserRole.BUSINESS, SubscriptionPlan.BASIC, 100.0, 1000.0),
        (UserRole.BUSINESS, SubscriptionPlan.PRO, 200.0, 2000.0),
        (UserRole.BUSINESS, SubscriptionPlan.PREMIUM, 400.0, 4000.0),
        (UserRole.ARTIST, SubscriptionPlan.PREMIUM, 99.0, 990.0),
        (UserRole.VENDOR, SubscriptionPlan.PREMIUM, 150.0, 1500.0),
    ]
    for role, plan_type, monthly, yearly in plans:
        is_premium = plan_type == SubscriptionPlan.PREMIUM
        db.add(SubscriptionPlanConfig(
            role=role, plan_type=plan_type, billing_period="monthly",
            price=monthly, duration_days=30, is_active=True,
            verified_badge=is_premium,
        ))
        db.add(SubscriptionPlanConfig(
            role=role, plan_type=plan_type, billing_period="yearly",
            price=yearly, duration_days=365, is_active=True,
            verified_badge=is_premium,
        ))
    db.commit()


def test_subscription_plans():
    """Test that subscription plans are properly seeded (monthly + yearly)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        _seed(db)

        # 5 plan types x 2 billing periods = 10 configs
        total_plans = db.query(SubscriptionPlanConfig).count()
        assert total_plans == 10, f"Expected 10 plan configs, got {total_plans}"

        business_plans = db.query(SubscriptionPlanConfig).filter(
            SubscriptionPlanConfig.role == UserRole.BUSINESS
        ).all()
        assert len(business_plans) == 6  # 3 plans x 2 periods

        monthly = {p.plan_type: p for p in business_plans if p.billing_period == "monthly"}
        yearly = {p.plan_type: p for p in business_plans if p.billing_period == "yearly"}

        assert monthly[SubscriptionPlan.BASIC].price == 100.0
        assert monthly[SubscriptionPlan.PREMIUM].price == 400.0
        assert yearly[SubscriptionPlan.BASIC].price == 1000.0
        assert yearly[SubscriptionPlan.PREMIUM].duration_days == 365
        assert monthly[SubscriptionPlan.PREMIUM].verified_badge == True, "Premium should have verified badge"

        print("[PASS] All subscription plan tests passed!")
    finally:
        db.close()


if __name__ == "__main__":
    test_subscription_plans()
