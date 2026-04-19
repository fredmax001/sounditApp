from typing import Generator
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from config import get_settings

settings = get_settings()

# Configure engine based on database type
if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite configuration for local development
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
else:
    # PostgreSQL configuration for production
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    if settings.DATABASE_URL.startswith("sqlite"):
        # Import all models to ensure they're registered with Base
        from models import (
            User, OTPCode, Event, Club, FoodSpot, Order, 
            ArtistProfile, OrganizerProfile, BusinessProfile,
            BookingRequest, PayoutRequest, VerificationRequest, Venue,
            EventArtist, TicketTier, Ticket, OrderItem,
            ArtistFollow, EventFollow, Notification,
            Subscription, SubscriptionPlan, SubscriptionPlanConfig, SubscriptionFeatureUsage,
            ModerationReport, ApiKey, Webhook, Integration, PromoCode,
            CommunitySection, CommunityPost, CommunityComment, CommunityLike,
            CommunityCommentLike, CommunityShare,
            ProductOrder, TablePackage, TableOrder
        )
        Base.metadata.create_all(bind=engine)
        
        # SQLite: add new columns that may be missing from existing DB
        with engine.connect() as conn:
            # Events table new columns
            for col, col_type in [
                ("wechat_qr_url", "VARCHAR(500)"),
                ("alipay_qr_url", "VARCHAR(500)"),
                ("ticket_price", "FLOAT"),
                ("payment_instructions", "TEXT"),
                ("is_featured", "BOOLEAN DEFAULT 0"),
                ("latitude", "FLOAT"),
                ("longitude", "FLOAT"),
                ("event_type", "VARCHAR(100)"),
                ("refund_policy", "VARCHAR(50)"),
                ("require_id", "BOOLEAN DEFAULT 0"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE events ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass  # Column likely already exists
            
            # Users table new columns
            for col, col_type in [
                ("username", "VARCHAR(100)"),
                ("password_reset_token", "VARCHAR(255)"),
                ("password_reset_expires_at", "DATETIME"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Business profiles new columns
            try:
                conn.execute(text("ALTER TABLE business_profiles ADD COLUMN gallery_images JSON"))
                conn.commit()
            except Exception:
                pass
            
            # Products new columns
            for col, col_type in [
                ("stock_quantity", "INTEGER DEFAULT 0"),
                ("wechat_qr_url", "VARCHAR(500)"),
                ("alipay_qr_url", "VARCHAR(500)"),
                ("payment_instructions", "TEXT"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE products ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Artist profiles new columns
            for col, col_type in [
                ("wechat_qr_url", "VARCHAR(500)"),
                ("alipay_qr_url", "VARCHAR(500)"),
                ("payment_instructions", "TEXT"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE artist_profiles ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Booking requests new columns
            for col, col_type in [
                ("payment_screenshot", "VARCHAR(500)"),
                ("payment_amount", "FLOAT"),
                ("payer_name", "VARCHAR(100)"),
                ("payer_notes", "TEXT"),
                ("payment_status", "VARCHAR(20) DEFAULT 'pending'"),
                ("reviewed_at", "DATETIME"),
                ("rejection_reason", "TEXT"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE booking_requests ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Community posts new columns
            for col, col_type in [
                ("guest_id", "VARCHAR(64)"),
                ("guest_name", "VARCHAR(100)"),
                ("guest_email", "VARCHAR(255)"),
                ("videos", "JSON"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE community_posts ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Community comments new columns
            for col, col_type in [
                ("guest_id", "VARCHAR(64)"),
                ("guest_name", "VARCHAR(100)"),
                ("guest_email", "VARCHAR(255)"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE community_comments ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Community likes new columns
            for col, col_type in [
                ("guest_id", "VARCHAR(64)"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE community_likes ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Community comment likes new columns
            for col, col_type in [
                ("guest_id", "VARCHAR(64)"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE community_comment_likes ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Community shares new columns
            for col, col_type in [
                ("guest_id", "VARCHAR(64)"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE community_shares ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Clubs / Food spots new columns
            for table in ["clubs", "food_spots"]:
                for col, col_type in [("latitude", "FLOAT"), ("longitude", "FLOAT")]:
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception:
                        pass
            
            # Ticket orders new columns
            for col, col_type in [
                ("quantity", "INTEGER DEFAULT 1"),
                ("ticket_tier_id", "INTEGER"),
                ("tickets_generated", "INTEGER DEFAULT 0"),
                ("auto_approved", "BOOLEAN DEFAULT 0"),
                ("cancelled_at", "DATETIME"),
                ("validation_notes", "TEXT"),
                ("payment_date", "DATE"),
                ("payment_proof_hash", "VARCHAR(64)"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE ticket_orders ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Tickets table new columns
            for col, col_type in [
                ("ticket_order_id", "INTEGER"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE tickets ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Table packages new columns
            for col, col_type in [
                ("total_tables", "INTEGER DEFAULT 1"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE table_packages ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Table orders new columns
            for col, col_type in [
                ("ticket_qr_code", "VARCHAR(1500)"),
                ("ticket_code", "VARCHAR(100)"),
                ("used_at", "DATETIME"),
                ("used_by", "INTEGER"),
            ]:
                try:
                    conn.execute(text(f"ALTER TABLE table_orders ADD COLUMN {col} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
            
            # Seed subscription plans if empty
            try:
                result = conn.execute(text("SELECT COUNT(*) FROM subscription_plan_configs"))
                count = result.scalar()
                if count == 0:
                    from models import UserRole, SubscriptionPlan
                    plans = [
                        (UserRole.BUSINESS, SubscriptionPlan.BASIC, 100, 5, False, False, False, False, False),
                        (UserRole.BUSINESS, SubscriptionPlan.PRO, 200, None, True, True, True, False, False),
                        (UserRole.BUSINESS, SubscriptionPlan.PREMIUM, 400, None, True, True, True, True, True),
                        (UserRole.VENDOR, SubscriptionPlan.BASIC, 80, None, False, False, False, False, False),
                        (UserRole.VENDOR, SubscriptionPlan.PRO, 150, None, True, True, True, False, False),
                        (UserRole.VENDOR, SubscriptionPlan.PREMIUM, 300, None, True, True, True, True, True),
                        (UserRole.ARTIST, SubscriptionPlan.BASIC, 50, None, False, False, False, False, False),
                        (UserRole.ARTIST, SubscriptionPlan.PRO, 100, None, True, True, True, False, False),
                        (UserRole.ARTIST, SubscriptionPlan.PREMIUM, 200, None, True, True, True, True, True),
                    ]
                    for role, plan, price, event_limit, featured, analytics, support, badge, spotlight in plans:
                        conn.execute(text("""
                            INSERT INTO subscription_plan_configs 
                            (role, plan_type, price, duration_days, event_limit, featured_listing, analytics_access, priority_support, verified_badge, homepage_spotlight, is_active)
                            VALUES (:role, :plan, :price, 30, :event_limit, :featured, :analytics, :support, :badge, :spotlight, 1)
                        """), {
                            "role": role.value,
                            "plan": plan.value,
                            "price": price,
                            "event_limit": event_limit,
                            "featured": featured,
                            "analytics": analytics,
                            "support": support,
                            "badge": badge,
                            "spotlight": spotlight,
                        })
                        conn.commit()
                    print("Seeded subscription plan configs")
            except Exception:
                pass
    else:
        # Import all models to ensure they're registered with Base
        from models import (
            User, OTPCode, Event, Club, FoodSpot, Order,
            ArtistProfile, OrganizerProfile, BusinessProfile,
            BookingRequest, PayoutRequest, VerificationRequest, Venue,
            EventArtist, TicketTier, Ticket, OrderItem,
            ArtistFollow, EventFollow, Notification,
            Subscription, SubscriptionPlan, SubscriptionPlanConfig, SubscriptionFeatureUsage,
            ModerationReport, ApiKey, Webhook, Integration, PromoCode,
            CommunitySection, CommunityPost, CommunityComment, CommunityLike,
            CommunityCommentLike, CommunityShare,
            ProductOrder, TablePackage, TableOrder
        )
        Base.metadata.create_all(bind=engine)
        # Verify the connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()


def cleanup_old_data(db: Session, days: int = 90) -> dict:
    """Clean up old data from database - stub implementation"""
    return {
        "otp_codes": 0,
        "expired_tokens": 0,
        "old_notifications": 0,
        "old_audit_logs": 0
    }
