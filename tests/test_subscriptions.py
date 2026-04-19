"""
Basic Subscription System Test
Tests core subscription functionality
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import SubscriptionPlanConfig, UserRole, SubscriptionPlan

def test_subscription_plans():
    """Test that subscription plans are properly seeded"""
    db = SessionLocal()
    try:
        print("Testing subscription plans...")

        # Check total plans
        total_plans = db.query(SubscriptionPlanConfig).count()
        print(f"Total plans: {total_plans}")
        assert total_plans == 9, f"Expected 9 plans, got {total_plans}"

        # Check business plans
        business_plans = db.query(SubscriptionPlanConfig).filter(
            SubscriptionPlanConfig.role == UserRole.BUSINESS
        ).all()
        print(f"Business plans: {len(business_plans)}")
        assert len(business_plans) == 3

        # Check pricing
        basic_business = next(p for p in business_plans if p.plan_type == SubscriptionPlan.BASIC)
        assert basic_business.price == 100.0, f"Basic business price should be 100, got {basic_business.price}"

        premium_business = next(p for p in business_plans if p.plan_type == SubscriptionPlan.PREMIUM)
        assert premium_business.price == 400.0, f"Premium business price should be 400, got {premium_business.price}"
        assert premium_business.verified_badge == True, "Premium should have verified badge"

        print("[PASS] All subscription plan tests passed!")

    except Exception as e:
        print(f"[FAIL] Test failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    test_subscription_plans()