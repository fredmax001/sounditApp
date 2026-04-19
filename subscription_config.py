"""
Subscription Plans Configuration
Role-based pricing and feature access matrix
"""
from models import UserRole, SubscriptionPlan

# ==================== PRICING CONFIGURATION ====================

SUBSCRIPTION_PRICING = {
    UserRole.BUSINESS.value: {
        SubscriptionPlan.BASIC.value: 100.0,
        SubscriptionPlan.PRO.value: 200.0,
        SubscriptionPlan.PREMIUM.value: 400.0,
    },
    UserRole.VENDOR.value: {
        SubscriptionPlan.BASIC.value: 80.0,
        SubscriptionPlan.PRO.value: 150.0,
        SubscriptionPlan.PREMIUM.value: 300.0,
    },
    UserRole.ARTIST.value: {
        SubscriptionPlan.BASIC.value: 50.0,
        SubscriptionPlan.PRO.value: 100.0,
        SubscriptionPlan.PREMIUM.value: 200.0,
    },
}

# ==================== FEATURE CONFIGURATION ====================

SUBSCRIPTION_FEATURES = {
    UserRole.BUSINESS.value: {
        SubscriptionPlan.BASIC.value: {
            "name": "Basic",
            "description": "Essential tools for small organizers",
            "event_limit": 5,
            "featured_listing": False,
            "analytics_access": False,
            "priority_support": False,
            "verified_badge": False,
            "homepage_spotlight": False,
            "visibility_rank": 3,
            "features": [
                "Create up to 5 events per month",
                "Upload custom payment QR",
                "Basic event listing",
                "Manual ticket approval",
                "Basic dashboard",
            ],
        },
        SubscriptionPlan.PRO.value: {
            "name": "Pro",
            "description": "Professional tools for growing businesses",
            "event_limit": None,
            "featured_listing": True,
            "analytics_access": True,
            "priority_support": False,
            "verified_badge": False,
            "homepage_spotlight": False,
            "visibility_rank": 2,
            "features": [
                "Unlimited event creation",
                "Featured in category listings",
                "Basic analytics",
                "Medium visibility boost",
                "All Basic features",
            ],
        },
        SubscriptionPlan.PREMIUM.value: {
            "name": "Premium",
            "description": "Maximum exposure for professional organizers",
            "event_limit": None,
            "featured_listing": True,
            "analytics_access": True,
            "priority_support": True,
            "verified_badge": True,
            "homepage_spotlight": True,
            "visibility_rank": 1,
            "features": [
                "Homepage featured events",
                "Push notifications to users",
                "Advanced analytics",
                "Custom event branding",
                "Highest visibility ranking",
                "Verified badge",
                "All Pro features",
            ],
        },
    },
    UserRole.VENDOR.value: {
        SubscriptionPlan.BASIC.value: {
            "name": "Basic",
            "description": "Start selling your services",
            "portfolio_limit": 5,
            "featured_listing": False,
            "analytics_access": False,
            "priority_support": False,
            "verified_badge": False,
            "homepage_spotlight": False,
            "visibility_rank": 3,
            "features": [
                "Create vendor profile",
                "List services/products",
                "Appear in search",
                "Receive booking requests",
            ],
        },
        SubscriptionPlan.PRO.value: {
            "name": "Pro",
            "description": "Expand your vendor business",
            "portfolio_limit": 20,
            "featured_listing": True,
            "analytics_access": False,
            "priority_support": False,
            "verified_badge": False,
            "homepage_spotlight": False,
            "visibility_rank": 2,
            "features": [
                "Featured in vendor listings",
                "Priority search ranking",
                "Booking notifications",
                "Expanded portfolio",
                "All Basic features",
            ],
        },
        SubscriptionPlan.PREMIUM.value: {
            "name": "Premium",
            "description": "Maximum exposure for top vendors",
            "portfolio_limit": None,
            "featured_listing": True,
            "analytics_access": True,
            "priority_support": True,
            "verified_badge": True,
            "homepage_spotlight": True,
            "visibility_rank": 1,
            "features": [
                "Homepage spotlight",
                "Top search placement",
                "Verified badge",
                "Unlimited portfolio",
                "Analytics",
                "All Pro features",
            ],
        },
    },
    UserRole.ARTIST.value: {
        SubscriptionPlan.BASIC.value: {
            "name": "Basic",
            "description": "Showcase your talent",
            "media_limit": 5,
            "featured_listing": False,
            "analytics_access": False,
            "priority_support": False,
            "verified_badge": False,
            "homepage_spotlight": False,
            "visibility_rank": 3,
            "features": [
                "Create artist profile",
                "Upload limited media",
                "Appear in search",
            ],
        },
        SubscriptionPlan.PRO.value: {
            "name": "Pro",
            "description": "Grow your artist career",
            "media_limit": 20,
            "featured_listing": True,
            "analytics_access": False,
            "priority_support": False,
            "verified_badge": False,
            "homepage_spotlight": False,
            "visibility_rank": 2,
            "features": [
                "Featured artist listing",
                "Appear in recommendations",
                "Booking request system",
                "Social links integration",
                "All Basic features",
            ],
        },
        SubscriptionPlan.PREMIUM.value: {
            "name": "Premium",
            "description": "Elite status for professional artists",
            "media_limit": None,
            "featured_listing": True,
            "analytics_access": True,
            "priority_support": True,
            "verified_badge": True,
            "homepage_spotlight": True,
            "visibility_rank": 1,
            "features": [
                "Homepage spotlight",
                "Verified badge",
                "Top ranking in search",
                "Unlimited media uploads",
                "Priority booking access",
                "All Pro features",
            ],
        },
    },
}


def get_plan_price(role, plan_type):
    return SUBSCRIPTION_PRICING.get(role, {}).get(plan_type, 0.0)


def get_plan_features(role, plan_type):
    return SUBSCRIPTION_FEATURES.get(role, {}).get(plan_type, {})


def get_all_plans_for_role(role):
    plans = []
    for plan_type in [SubscriptionPlan.BASIC.value, SubscriptionPlan.PRO.value, SubscriptionPlan.PREMIUM.value]:
        features = get_plan_features(role, plan_type)
        price = get_plan_price(role, plan_type)
        if features:
            plans.append({
                "type": plan_type,
                "price": price,
                **features
            })
    return plans


def check_feature_access(role, plan_type, feature_name):
    features = get_plan_features(role, plan_type)
    return features.get(feature_name, False)
