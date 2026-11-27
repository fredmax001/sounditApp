"""
Admin API Router
Comprehensive admin endpoints for managing the Sound It platform
"""

from fastapi import APIRouter, Body, Depends, HTTPException, status, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, distinct, func, or_  # type: ignore
from sqlalchemy.orm import joinedload
from typing import List, Optional, Union, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import io
import csv
import secrets

from database import get_db
from auth import require_admin, require_super_admin
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
from email_service import (
    send_email, send_welcome_email, send_business_welcome_email,
    send_artist_welcome_email, send_vendor_welcome_email,
    send_admin_role_invite_email
)
from models import (
    User, UserRole, UserStatus, ArtistProfile, OrganizerProfile, Venue, Event, 
    EventStatus, EventArtist, TicketTier, Ticket, Order, OrderItem, PaymentStatus, PaymentMethod,
    City, ArtistFollow, EventFollow, Notification, EventVendor,
    PayoutRequest, PayoutStatus, VerificationRequest, VerificationStatus, VerificationType,
    AdminNotificationLog,
    Ad, AdPosition, AdStatus, CMSPage, CMSBanner, SystemSetting, 
    CommissionRate, AdminActivityLog, SecurityLog,
    ModerationReport, Integration, ApiKey, Webhook, FeaturedItem,
    CommunitySection, CommunityPost, CommunityComment, CommunityLike, CommunityShare,
    PageVisit,
    TablePackage, TableOrder, TableOrderStatus, TicketOrder, TicketOrderStatus, ProductOrder, Recap, PromoCode, EventPaymentQR,
    ArtistReview, ArtistAvailability, BusinessProfile,
    Subscription, SubscriptionStatus,
    AdminRole as AdminRoleModel,
    OrganizerFollow, VendorFollow, VendorProfile, Product,
    BookingRequest, BookingStatus, BookingMessage
)
from services.subscription_service import SubscriptionService
from schemas import (
    UserResponse, EventResponse, EventListResponse, EventUpdate,
    VenueResponse, VenueCreate, TicketTierResponse, OrderResponse, EventVendorResponse,
    CommunitySectionBase, CommunitySectionResponse, CommunityPostResponse, CommunityPaginatedResponse
)

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


# ==================== ADMIN SCHEMAS ====================

from pydantic import BaseModel


class DashboardStatsResponse(BaseModel):
    total_users: int
    total_businesses: int
    total_artists: int
    total_vendors: int
    total_events: int
    total_tickets_sold: int
    total_revenue: float
    pending_payouts: int
    pending_verifications: int
    pending_vendor_approvals: int = 0
    total_visits_30d: int = 0
    unique_visitors_30d: int = 0
    total_cities: int = 0
    total_bookings: int = 0
    # Role sub-type breakdowns (power role-tailored admin overview)
    vendors_by_type: Dict[str, int] = {}
    artists_by_type: Dict[str, int] = {}
    business_owned_vendors: int = 0
    # Canonical ledger & live operational metrics (strictly additive)
    active_subscriptions: int = 0
    pending_events: int = 0
    pending_reports: int = 0
    pending_business_approvals: int = 0
    platform_processed_revenue: float = 0.0
    platform_fee_revenue: float = 0.0
    subscription_revenue: float = 0.0
    direct_qr_reported_volume: float = 0.0
    available_platform_cash: float = 0.0
    new_users_30d: int = 0
    new_events_30d: int = 0
    users_growth_pct: Optional[float] = None
    events_growth_pct: Optional[float] = None
    visits_growth_pct: Optional[float] = None
    daily_series: List[Dict[str, Any]] = []
    recent_activity: List[Dict[str, Any]] = []
    
    class Config:
        from_attributes = True


class PendingActionItem(BaseModel):
    id: int
    type: str  # 'event_approval', 'user_verification', 'payout'
    title: str
    description: str
    created_at: Optional[datetime] = None
    entity_id: Optional[int] = None
    entity_type: str
    action_url: str


class PendingActionsResponse(BaseModel):
    actions: List[PendingActionItem]
    total_count: int


class AdminRoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class AdminRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class AdminRoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    is_system: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_count: int = 0

    class Config:
        from_attributes = True


class AdminUserItem(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    admin_role_id: Optional[int] = None
    admin_role_name: Optional[str] = None
    avatar_url: Optional[str] = None


class AdminInviteRequest(BaseModel):
    email: str
    role_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    notes: Optional[str] = None


class UserListResponse(UserResponse):
    artist_profile: Optional[dict] = None
    organizer_profile: Optional[dict] = None
    business_profile: Optional[dict] = None
    vendor_profile: Optional[dict] = None
    stats: Optional[dict] = None
    slug: Optional[str] = None
    subscription_status: Optional[str] = None
    pending_subscription_id: Optional[int] = None


class UserAdminUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    is_verified: Optional[bool] = None
    artist_type: Optional[str] = None
    vendor_type: Optional[str] = None
    business_type: Optional[str] = None


class BusinessResponse(BaseModel):
    id: int
    organization_name: str
    business_name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    is_verified: bool = False
    is_approved: bool = False
    is_featured: bool = False
    events_count: int = 0
    total_revenue: float = 0.0
    user_id: int
    user_name: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    slug: Optional[str] = None
    status: str = "active"
    verification_badge: bool = False
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class BusinessUpdate(BaseModel):
    organization_name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None


class ArtistResponse(BaseModel):
    id: int
    stage_name: str
    artist_type: Optional[str] = "Artist"
    genre: Optional[str] = None
    followers_count: int = 0
    events_count: int = 0
    user_id: int
    user_name: Optional[str] = None
    spotify_url: Optional[str] = None
    soundcloud_url: Optional[str] = None
    apple_music_url: Optional[str] = None
    mixcloud_url: Optional[str] = None
    instagram_url: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    slug: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[datetime] = None
    is_verified: bool = False
    is_approved: bool = False
    is_featured: bool = False
    status: str = "active"
    
    class Config:
        from_attributes = True


class ArtistUpdate(BaseModel):
    stage_name: Optional[str] = None
    genre: Optional[str] = None
    city: Optional[str] = None
    spotify_url: Optional[str] = None
    apple_music_url: Optional[str] = None
    soundcloud_url: Optional[str] = None
    hearthis_url: Optional[str] = None


class EventAdminResponse(EventResponse):
    organizer_name: Optional[str] = None
    business_name: Optional[str] = None
    attendees_count: Optional[int] = 0
    venue_name: Optional[str] = None
    is_featured: bool = False


class VerificationRequestItem(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: Optional[str] = None
    type: str  # 'business', 'artist', 'venue', 'vendor', 'event'
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    status: str
    documents: Optional[List[dict]] = None
    notes: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    class Config:
        from_attributes = True


class VerificationReview(BaseModel):
    notes: Optional[str] = None


class PayoutRequestItem(BaseModel):
    id: int
    entity_id: int
    entity_name: str
    entity_type: str  # 'organizer', 'venue'
    amount: float
    currency: str
    status: str
    requested_at: datetime
    payment_method: Optional[str] = None
    payment_details: Optional[dict] = None
    
    class Config:
        from_attributes = True


class PaymentTransaction(BaseModel):
    id: int
    order_number: str
    user_id: int
    user_name: Optional[str] = None
    amount: float
    currency: str
    payment_method: Optional[str] = None
    payment_status: str
    created_at: datetime
    paid_at: Optional[datetime] = None
    transaction_type: Optional[str] = "order"
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class CityStats(BaseModel):
    city: str
    total_events: int
    total_venues: int
    total_users: int
    image_url: Optional[str] = None


class CityImagesUpdate(BaseModel):
    image_url: Optional[str] = None
    cover_image_url: Optional[str] = None


class RefundRequest(BaseModel):
    amount: Optional[float] = None
    reason: Optional[str] = None


# ==================== DASHBOARD ====================

@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get admin dashboard statistics with canonical ledger metrics and live 14-day series"""
    now_utc = datetime.now(timezone.utc)
    now_naive = datetime.utcnow()
    thirty_days_ago = now_naive - timedelta(days=30)
    sixty_days_ago = now_naive - timedelta(days=60)

    # Exclude anonymized deleted users from active platform headcount
    non_deleted_filter = ~User.email.like("deleted_%@deleted.local")
    total_users = db.query(User).filter(non_deleted_filter).count()

    # Business count (organizers belonging to active non-deleted users)
    total_businesses = db.query(OrganizerProfile).join(
        User, OrganizerProfile.user_id == User.id
    ).filter(non_deleted_filter).count()

    # Artist count (DJs / talent)
    total_artists = db.query(ArtistProfile).join(
        User, ArtistProfile.user_id == User.id
    ).filter(non_deleted_filter).count()

    # Vendor count
    total_vendors = db.query(VendorProfile).join(
        User, VendorProfile.user_id == User.id
    ).filter(non_deleted_filter).count()

    # Event count
    total_events = db.query(Event).count()

    # Total bookings count
    total_bookings = db.query(BookingRequest).count()

    # Active paid/trial subscriptions
    active_subscriptions = db.query(Subscription).filter(
        Subscription.status == SubscriptionStatus.ACTIVE,
        Subscription.end_date > now_utc
    ).count()

    # Tickets sold (from approved ticket orders)
    tickets_sold = db.query(func.sum(TicketOrder.quantity)).filter(
        TicketOrder.status == TicketOrderStatus.APPROVED
    ).scalar() or 0

    # Canonical financial breakdown from services.financial_ledger
    platform_processed_revenue = 0.0
    platform_fee_revenue = 0.0
    subscription_revenue = 0.0
    direct_qr_reported_volume = 0.0
    available_platform_cash = 0.0
    try:
        from services.financial_ledger import get_admin_financial_overview
        fin = get_admin_financial_overview(db, days="all", currency="CNY")
        platform_processed_revenue = float(fin.get("platform_payment_volume", 0.0) or 0.0)
        platform_fee_revenue = float(fin.get("transaction_fee_revenue", 0.0) or 0.0)
        subscription_revenue = float(fin.get("subscription_revenue", 0.0) or 0.0)
        direct_qr_reported_volume = float(fin.get("direct_qr_transaction_volume", 0.0) or 0.0)
        available_platform_cash = float(fin.get("available_platform_cash", 0.0) or 0.0)
    except Exception:
        subscription_revenue = float(db.query(func.sum(Subscription.price)).filter(
            Subscription.status == SubscriptionStatus.ACTIVE
        ).scalar() or 0.0)

    # Canonical total platform-recognized revenue (fees + subscriptions) while exposing Direct QR separately
    total_revenue = round(platform_fee_revenue + subscription_revenue, 2)

    # Pending queues (all excluding deleted/anonymized users)
    pending_payouts = db.query(PayoutRequest).filter(
        PayoutRequest.status.in_([PayoutStatus.PENDING, PayoutStatus.PROCESSING])
    ).count()
    pending_verifications = db.query(VerificationRequest).filter(
        VerificationRequest.status == VerificationStatus.PENDING
    ).count()
    pending_vendor_approvals = db.query(VendorProfile).join(
        User, VendorProfile.user_id == User.id
    ).filter(
        VendorProfile.is_approved == False,
        non_deleted_filter
    ).count()
    pending_business_approvals = db.query(OrganizerProfile).join(
        User, OrganizerProfile.user_id == User.id
    ).filter(
        OrganizerProfile.is_approved == False,
        non_deleted_filter
    ).count()
    pending_events = db.query(Event).filter(Event.status == EventStatus.PENDING).count()
    try:
        pending_reports = db.query(ModerationReport).filter(
            ModerationReport.status == "pending"
        ).count()
    except Exception:
        pending_reports = 0

    # Active cities count
    total_cities = db.query(func.count(distinct(User.preferred_city))).filter(
        User.preferred_city.isnot(None),
        non_deleted_filter,
        User.role.in_([UserRole.BUSINESS, UserRole.ARTIST, UserRole.VENDOR, UserRole.ORGANIZER])
    ).scalar() or 0

    # Visitor metrics (last 30 days & previous 30 days)
    total_visits_30d = db.query(PageVisit).filter(
        PageVisit.created_at >= thirty_days_ago
    ).count()
    prev_visits_30d = db.query(PageVisit).filter(
        PageVisit.created_at >= sixty_days_ago,
        PageVisit.created_at < thirty_days_ago
    ).count()
    unique_visitors_30d = db.query(func.count(distinct(PageVisit.ip_address))).filter(
        PageVisit.created_at >= thirty_days_ago
    ).scalar() or 0

    # Real 30-day growth calculations
    new_users_30d = db.query(User).filter(
        non_deleted_filter,
        User.created_at >= thirty_days_ago
    ).count()
    prev_users_30d = db.query(User).filter(
        non_deleted_filter,
        User.created_at >= sixty_days_ago,
        User.created_at < thirty_days_ago
    ).count()
    new_events_30d = db.query(Event).filter(Event.created_at >= thirty_days_ago).count()
    prev_events_30d = db.query(Event).filter(
        Event.created_at >= sixty_days_ago,
        Event.created_at < thirty_days_ago
    ).count()

    def _growth_pct(curr: int, prev: int) -> Optional[float]:
        if prev <= 0:
            return None
        return round(((curr - prev) / prev) * 100.0, 1)

    users_growth_pct = _growth_pct(new_users_30d, prev_users_30d)
    events_growth_pct = _growth_pct(new_events_30d, prev_events_30d)
    visits_growth_pct = _growth_pct(total_visits_30d, prev_visits_30d)

    # Real 14-day daily activity series (visits, signups, approved orders & volume)
    days_window = 14
    start_day = (now_naive - timedelta(days=days_window - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets: Dict[str, Dict[str, Any]] = {}
    for offset in range(days_window):
        d = start_day + timedelta(days=offset)
        key = d.strftime("%Y-%m-%d")
        buckets[key] = {
            "date": key,
            "label": d.strftime("%b %d"),
            "visits": 0,
            "signups": 0,
            "orders": 0,
            "volume": 0.0,
        }

    for row in db.query(PageVisit.created_at).filter(PageVisit.created_at >= start_day).all():
        if row[0]:
            k = row[0].strftime("%Y-%m-%d")
            if k in buckets:
                buckets[k]["visits"] += 1

    for row in db.query(User.created_at).filter(non_deleted_filter, User.created_at >= start_day).all():
        if row[0]:
            k = row[0].strftime("%Y-%m-%d")
            if k in buckets:
                buckets[k]["signups"] += 1

    for row in db.query(TicketOrder.created_at, TicketOrder.payment_amount).filter(
        TicketOrder.status == TicketOrderStatus.APPROVED,
        TicketOrder.created_at >= start_day
    ).all():
        if row[0]:
            k = row[0].strftime("%Y-%m-%d")
            if k in buckets:
                buckets[k]["orders"] += 1
                buckets[k]["volume"] = round(buckets[k]["volume"] + float(row[1] or 0.0), 2)

    daily_series = list(buckets.values())

    # Recent admin activity (last 8 real entries)
    recent_activity = []
    try:
        logs = db.query(AdminActivityLog).order_by(desc(AdminActivityLog.created_at)).limit(8).all()
        for lg in logs:
            recent_activity.append({
                "id": lg.id,
                "action": lg.action,
                "entity_type": lg.entity_type,
                "entity_id": lg.entity_id,
                "details": lg.details if isinstance(lg.details, str) else None,
                "created_at": lg.created_at.isoformat() if lg.created_at else None,
            })
    except Exception:
        recent_activity = []

    # Role sub-type breakdowns
    vendors_by_type = {
        (row[0] or "other"): row[1]
        for row in db.query(VendorProfile.vendor_type, func.count(VendorProfile.id))
        .join(User, VendorProfile.user_id == User.id)
        .filter(non_deleted_filter)
        .group_by(VendorProfile.vendor_type).all()
    }
    artists_by_type = {
        (row[0] or "Artist"): row[1]
        for row in db.query(ArtistProfile.artist_type, func.count(ArtistProfile.id))
        .join(User, ArtistProfile.user_id == User.id)
        .filter(non_deleted_filter)
        .group_by(ArtistProfile.artist_type).all()
    }
    business_owned_vendors = db.query(VendorProfile).join(
        User, VendorProfile.user_id == User.id
    ).filter(
        VendorProfile.business_profile_id.isnot(None),
        non_deleted_filter
    ).count()

    return DashboardStatsResponse(
        total_users=total_users,
        total_businesses=total_businesses,
        total_artists=total_artists,
        total_vendors=total_vendors,
        total_events=total_events,
        total_tickets_sold=int(tickets_sold),
        total_revenue=float(total_revenue),
        pending_payouts=pending_payouts,
        pending_verifications=pending_verifications,
        pending_vendor_approvals=pending_vendor_approvals,
        total_visits_30d=total_visits_30d,
        unique_visitors_30d=unique_visitors_30d,
        total_cities=total_cities,
        total_bookings=total_bookings,
        vendors_by_type=vendors_by_type,
        artists_by_type=artists_by_type,
        business_owned_vendors=business_owned_vendors,
        active_subscriptions=active_subscriptions,
        pending_events=pending_events,
        pending_reports=pending_reports,
        pending_business_approvals=pending_business_approvals,
        platform_processed_revenue=platform_processed_revenue,
        platform_fee_revenue=platform_fee_revenue,
        subscription_revenue=subscription_revenue,
        direct_qr_reported_volume=direct_qr_reported_volume,
        available_platform_cash=available_platform_cash,
        new_users_30d=new_users_30d,
        new_events_30d=new_events_30d,
        users_growth_pct=users_growth_pct,
        events_growth_pct=events_growth_pct,
        visits_growth_pct=visits_growth_pct,
        daily_series=daily_series,
        recent_activity=recent_activity,
    )


@router.get("/pending-actions", response_model=PendingActionsResponse)
def get_pending_actions(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all pending actions for admin review"""
    actions = []
    
    # 1. Pending event approvals
    pending_events = db.query(Event).filter(Event.status == EventStatus.PENDING).all()
    for event in pending_events:
        actions.append(PendingActionItem(
            id=event.id,
            type="event_approval",
            title=f"Event Approval: {event.title}",
            description=f"Event in {event.city.value if event.city else 'Unknown'} awaiting approval",
            created_at=event.created_at,
            entity_id=event.id,
            entity_type="event",
            action_url=f"/admin/events"
        ))
    
    # 2. Pending business approvals (unapproved organizers with active non-deleted users)
    unapproved_organizers = db.query(OrganizerProfile).join(
        User, OrganizerProfile.user_id == User.id
    ).filter(
        OrganizerProfile.is_approved == False,
        ~User.email.like("deleted_%@deleted.local")
    ).all()
    for org in unapproved_organizers:
        if not org.user_id:
            continue
        org_label = (org.organization_name or "").strip()
        if org_label.lower() == "deleted organizer":
            continue
        actions.append(PendingActionItem(
            id=org.id,
            type="business_approval",
            title=f"Approve: {org_label or 'Business'}",
            description="Organizer approval pending",
            created_at=org.created_at,
            entity_id=org.user_id,
            entity_type="organizer",
            action_url="/admin/businesses"
        ))
    
    # 3. Pending document verification requests (ONLY real active pending requests submitted by users)
    pending_verifs = db.query(VerificationRequest).filter(
        VerificationRequest.status == VerificationStatus.PENDING
    ).all()
    for vr in pending_verifs:
        user = vr.user
        name = (f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or user.email) if user else "User"
        req_type_str = vr.request_type.value if hasattr(vr.request_type, 'value') else str(vr.request_type)
        actions.append(PendingActionItem(
            id=vr.id,
            type="verification_request",
            title=f"Verification: {name} ({req_type_str.title()})",
            description=f"Document verification request awaiting review",
            created_at=vr.submitted_at,
            entity_id=vr.id,
            entity_type="verification",
            action_url=f"/admin/verification-center"
        ))
    
    # 4. Pending payout / withdrawal requests
    pending_payout_records = db.query(PayoutRequest).filter(
        PayoutRequest.status.in_([PayoutStatus.PENDING, PayoutStatus.PROCESSING])
    ).all()
    for po in pending_payout_records:
        actions.append(PendingActionItem(
            id=po.id,
            type="payout_request",
            title=f"Payout Request: ¥{float(po.amount or 0):,.2f}",
            description="Withdrawal request awaiting review",
            created_at=po.created_at,
            entity_id=po.id,
            entity_type="payout",
            action_url="/admin/withdrawals"
        ))

    # 5. Pending vendor approvals (unapproved vendors with active non-deleted users)
    unapproved_vendors = db.query(VendorProfile).join(
        User, VendorProfile.user_id == User.id
    ).filter(
        VendorProfile.is_approved == False,
        ~User.email.like("deleted_%@deleted.local")
    ).all()
    for vendor in unapproved_vendors:
        actions.append(PendingActionItem(
            id=vendor.id,
            type="vendor_approval",
            title=f"Approve Vendor: {vendor.business_name or 'Vendor'}",
            description="Vendor account awaiting approval",
            created_at=vendor.created_at,
            entity_id=vendor.user_id,
            entity_type="vendor",
            action_url="/admin/vendors"
        ))
    
    # Sort by created_at (newest first)
    actions.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
    
    return PendingActionsResponse(
        actions=actions,
        total_count=len(actions)
    )


# Helper resolution functions for admin detail inspection
def _get_artist_profile(db: Session, artist_id: int):
    """Resolve an artist profile from either ArtistProfile.id or User.id.
    If a user has role=artist but no profile, auto-create one."""
    dj = db.query(ArtistProfile).filter(ArtistProfile.id == artist_id).first()
    if dj:
        return dj
    user = db.query(User).filter(User.id == artist_id, User.role == UserRole.ARTIST).first()
    if user:
        if user.artist_profile:
            return user.artist_profile
        from utils.slug import slugify
        profile = ArtistProfile(
            user_id=user.id,
            stage_name=f"{user.first_name or ''} {user.last_name or ''}".strip() or "Artist",
            genre="Electronic",
            bio=user.bio,
            slug=slugify(f"{user.first_name or ''} {user.last_name or ''}".strip() or f"artist-{user.id}")
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile
    return None


def _get_business_profile(db: Session, business_id: int):
    """Resolve business profile from OrganizerProfile or BusinessProfile (by id or user_id)"""
    org = db.query(OrganizerProfile).filter(OrganizerProfile.id == business_id).first()
    if org:
        return org, "organizer"
    org = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == business_id).first()
    if org:
        return org, "organizer"
    biz = db.query(BusinessProfile).filter(BusinessProfile.id == business_id).first()
    if biz:
        return biz, "business"
    biz = db.query(BusinessProfile).filter(BusinessProfile.user_id == business_id).first()
    if biz:
        return biz, "business"
    user = db.query(User).filter(
        User.id == business_id,
        User.role.in_([UserRole.ORGANIZER, UserRole.BUSINESS])
    ).first()
    if user:
        if user.organizer_profile:
            return user.organizer_profile, "organizer"
        if user.business_profile:
            return user.business_profile, "business"
    return None, None


def _get_vendor_profile(db: Session, vendor_id: int):
    """Resolve vendor profile from VendorProfile.id or User.id"""
    v = db.query(VendorProfile).filter(VendorProfile.id == vendor_id).first()
    if v:
        return v
    v = db.query(VendorProfile).filter(VendorProfile.user_id == vendor_id).first()
    if v:
        return v
    user = db.query(User).filter(User.id == vendor_id, User.role == UserRole.VENDOR).first()
    if user:
        v = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
        if v:
            return v
    return None


# ==================== USER MANAGEMENT ====================

@router.get("/users", response_model=List[UserListResponse])
def list_users(
    role: Optional[UserRole] = None,
    city: Optional[str] = None,
    status: Optional[UserStatus] = None,
    search: Optional[str] = None,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 500,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all users with filters"""
    query = db.query(User)
    if not include_deleted:
        query = query.filter(~User.email.like("deleted_%@deleted.local"))
    
    if role:
        query = query.filter(User.role == role)
    if city:
        query = query.filter(User.preferred_city == city)
    if status:
        query = query.filter(User.status == status)
    if search:
        # Security: Sanitize search input to prevent SQL injection via wildcards
        import re
        # Remove dangerous characters and limit length
        sanitized_search = re.sub(r'[%_\\]', '', search)[:50]
        if sanitized_search:
            search_filter = f"%{sanitized_search}%"
            query = query.filter(
                (User.first_name.ilike(search_filter)) |
                (User.last_name.ilike(search_filter)) |
                (User.email.ilike(search_filter)) |
                (User.phone.ilike(search_filter))
            )
    
    users = query.order_by(desc(User.created_at)).offset(skip).limit(limit).all()
    
    # Add profile info to response
    result = []
    for user in users:
        # Check for pending subscription
        pending_sub = db.query(Subscription).filter(
            Subscription.user_id == user.id,
            Subscription.status == SubscriptionStatus.PENDING
        ).order_by(desc(Subscription.created_at)).first()
        
        active_sub = db.query(Subscription).filter(
            Subscription.user_id == user.id,
            Subscription.status == SubscriptionStatus.ACTIVE
        ).order_by(desc(Subscription.created_at)).first()
        
        # Get attached vendor and business profiles
        vendor_prof = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
        biz_prof = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()

        user_city = user.preferred_city.value if hasattr(user.preferred_city, 'value') else user.preferred_city
        if user.role == UserRole.ARTIST and user.artist_profile and user.artist_profile.city:
            user_city = user.artist_profile.city.value if hasattr(user.artist_profile.city, 'value') else user.artist_profile.city
        elif not user_city:
            if user.artist_profile and user.artist_profile.city:
                user_city = user.artist_profile.city.value if hasattr(user.artist_profile.city, 'value') else user.artist_profile.city
            elif vendor_prof and vendor_prof.city:
                user_city = vendor_prof.city.value if hasattr(vendor_prof.city, 'value') else vendor_prof.city
            elif biz_prof and hasattr(biz_prof, 'city') and biz_prof.city:
                user_city = biz_prof.city.value if hasattr(biz_prof.city, 'value') else biz_prof.city
            elif user.organizer_profile and user.organizer_profile.city:
                user_city = user.organizer_profile.city.value if hasattr(user.organizer_profile.city, 'value') else user.organizer_profile.city

        user_dict = {
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "preferred_city": user_city,
            "preferred_language": user.preferred_language,
            "foreigner_mode": user.foreigner_mode,
            "role": user.role,
            "status": user.status,
            "is_verified": user.is_verified,
            "verification_badge": user.verification_badge,
            "created_at": user.created_at,
            "slug": getattr(user, 'slug', None),
            "artist_profile": None,
            "organizer_profile": None,
            "business_profile": None,
            "vendor_profile": None,
            "subscription_status": pending_sub.status.value if pending_sub else (active_sub.status.value if active_sub else None),
            "pending_subscription_id": pending_sub.id if pending_sub else None,
        }
        if user.artist_profile:
            ap_c = user.artist_profile.city.value if hasattr(user.artist_profile.city, 'value') else user.artist_profile.city
            user_dict["artist_profile"] = {
                "id": user.artist_profile.id,
                "stage_name": user.artist_profile.stage_name,
                "artist_type": getattr(user.artist_profile, 'artist_type', None) or "Artist",
                "genre": user.artist_profile.genre,
                "city": ap_c or user_city,
                "slug": getattr(user.artist_profile, 'slug', None),
                "followers_count": user.artist_profile.followers_count or 0,
                "events_count": user.artist_profile.events_count or 0
            }
        if user.organizer_profile:
            user_dict["organizer_profile"] = {
                "id": user.organizer_profile.id,
                "organization_name": user.organizer_profile.organization_name,
                "slug": getattr(user.organizer_profile, 'slug', None),
                "is_verified": user.organizer_profile.is_verified or False,
                "events_count": user.organizer_profile.events_count or 0,
                "total_revenue": user.organizer_profile.total_revenue or 0.0
            }
        if biz_prof:
            raw_btype = getattr(biz_prof, 'business_type', None)
            primary_btype = raw_btype[0] if isinstance(raw_btype, list) and raw_btype else (raw_btype if isinstance(raw_btype, str) else "organizer")
            user_dict["business_profile"] = {
                "id": biz_prof.id,
                "organization_name": getattr(biz_prof, 'business_name', '') or getattr(biz_prof, 'organization_name', ''),
                "business_type": primary_btype,
                "slug": getattr(biz_prof, 'slug', None),
                "is_verified": getattr(biz_prof, 'is_verified', False)
            }
        if vendor_prof:
            user_dict["vendor_profile"] = {
                "id": vendor_prof.id,
                "business_name": vendor_prof.business_name,
                "slug": getattr(vendor_prof, 'slug', None),
                "vendor_type": vendor_prof.vendor_type or "other",
                "category": vendor_prof.vendor_type or "other",
                "is_approved": vendor_prof.is_approved or False,
                "is_verified": vendor_prof.is_verified or False
            }
        result.append(user_dict)
    
    return result


@router.get("/users/{user_id}", response_model=UserListResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get rich user details for admin inspection"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    vendor_prof = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
    biz_prof = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()

    # User activity stats with safety fallbacks
    try:
        tickets_count = db.query(func.count(TicketOrder.id)).filter(TicketOrder.user_id == user.id).scalar() or 0
        ticket_spent = db.query(func.coalesce(func.sum(TicketOrder.payment_amount), 0)).filter(
            TicketOrder.user_id == user.id,
            TicketOrder.status == TicketOrderStatus.APPROVED
        ).scalar() or 0.0
    except Exception:
        tickets_count, ticket_spent = 0, 0.0

    try:
        table_spent = db.query(func.coalesce(func.sum(TableOrder.payment_amount), 0)).filter(
            TableOrder.user_id == user.id,
            TableOrder.status == TableOrderStatus.APPROVED
        ).scalar() or 0.0
    except Exception:
        table_spent = 0.0

    try:
        product_spent = db.query(func.coalesce(func.sum(ProductOrder.payment_amount), 0)).filter(
            ProductOrder.user_id == user.id,
            ProductOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])
        ).scalar() or 0.0
    except Exception:
        product_spent = 0.0

    total_spent = round(float(ticket_spent + table_spent + product_spent), 2)
    
    try:
        bookings_count = db.query(func.count(BookingRequest.id)).filter(BookingRequest.requester_id == user.id).scalar() or 0
    except Exception:
        bookings_count = 0

    try:
        artist_following = db.query(func.count(ArtistFollow.id)).filter(ArtistFollow.user_id == user.id).scalar() or 0
    except Exception:
        artist_following = 0

    try:
        organizer_following = db.query(func.count(OrganizerFollow.id)).filter(OrganizerFollow.user_id == user.id).scalar() or 0
    except Exception:
        organizer_following = 0

    try:
        vendor_following = db.query(func.count(VendorFollow.id)).filter(VendorFollow.user_id == user.id).scalar() or 0
    except Exception:
        vendor_following = 0

    following_count = artist_following + organizer_following + vendor_following
    
    followers_count = 0
    if user.artist_profile:
        try:
            followers_count += db.query(func.count(ArtistFollow.id)).filter(ArtistFollow.artist_id == user.artist_profile.id).scalar() or 0
        except Exception:
            pass
    if user.organizer_profile:
        try:
            followers_count += db.query(func.count(OrganizerFollow.id)).filter(OrganizerFollow.organizer_id == user.organizer_profile.id).scalar() or 0
        except Exception:
            pass
    if vendor_prof:
        try:
            followers_count += db.query(func.count(VendorFollow.id)).filter(VendorFollow.vendor_id == vendor_prof.id).scalar() or 0
        except Exception:
            pass

    # Check subscriptions
    pending_sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == SubscriptionStatus.PENDING
    ).order_by(desc(Subscription.created_at)).first()
    
    active_sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == SubscriptionStatus.ACTIVE
    ).order_by(desc(Subscription.created_at)).first()

    pref_city = user.preferred_city.value if hasattr(user.preferred_city, 'value') else user.preferred_city
    if user.role == UserRole.ARTIST and user.artist_profile and user.artist_profile.city:
        pref_city = user.artist_profile.city.value if hasattr(user.artist_profile.city, 'value') else user.artist_profile.city
    elif not pref_city:
        if user.artist_profile and user.artist_profile.city:
            pref_city = user.artist_profile.city.value if hasattr(user.artist_profile.city, 'value') else user.artist_profile.city
        elif user.vendor_profile and user.vendor_profile.city:
            pref_city = user.vendor_profile.city.value if hasattr(user.vendor_profile.city, 'value') else user.vendor_profile.city
        elif user.organizer_profile and user.organizer_profile.city:
            pref_city = user.organizer_profile.city.value if hasattr(user.organizer_profile.city, 'value') else user.organizer_profile.city

    user_dict = {
        "id": user.id,
        "email": user.email,
        "phone": user.phone,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "preferred_city": pref_city,
        "preferred_language": user.preferred_language or "en",
        "foreigner_mode": user.foreigner_mode or False,
        "role": user.role,
        "status": user.status.value if hasattr(user.status, 'value') else (user.status or "active"),
        "is_verified": user.is_verified or False,
        "verification_badge": user.verification_badge or False,
        "created_at": user.created_at,
        "slug": getattr(user, 'slug', None),
        "followers_count": followers_count,
        "following_count": following_count,
        "subscription_status": pending_sub.status.value if pending_sub else (active_sub.status.value if active_sub else None),
        "pending_subscription_id": pending_sub.id if pending_sub else None,
        "artist_profile": None,
        "organizer_profile": None,
        "business_profile": None,
        "vendor_profile": None,
        "stats": {
            "tickets_count": tickets_count,
            "total_spent": total_spent,
            "bookings_count": bookings_count,
            "following_count": following_count,
            "followers_count": followers_count
        }
    }
    if user.artist_profile:
        ap_city = user.artist_profile.city.value if hasattr(user.artist_profile.city, 'value') else user.artist_profile.city
        user_dict["artist_profile"] = {
            "id": user.artist_profile.id,
            "stage_name": user.artist_profile.stage_name,
            "genre": user.artist_profile.genre,
            "city": ap_city or pref_city,
            "bio": getattr(user.artist_profile, 'bio', None),
            "slug": getattr(user.artist_profile, 'slug', None),
            "followers_count": user.artist_profile.followers_count or 0,
            "events_count": user.artist_profile.events_count or 0,
            "spotify_url": getattr(user.artist_profile, 'spotify_url', None),
            "soundcloud_url": getattr(user.artist_profile, 'soundcloud_url', None),
            "apple_music_url": getattr(user.artist_profile, 'apple_music_url', None),
            "mixcloud_url": getattr(user.artist_profile, 'mixcloud_url', None),
            "instagram_url": getattr(user.artist_profile, 'instagram_url', None)
        }
    if user.organizer_profile:
        org = user.organizer_profile
        org_city = org.city.value if hasattr(org.city, 'value') else org.city
        user_dict["organizer_profile"] = {
            "id": org.id,
            "organization_name": org.organization_name,
            "slug": getattr(org, 'slug', None),
            "is_verified": org.is_verified or False,
            "events_count": org.events_count or 0,
            "total_revenue": org.total_revenue or 0.0,
            "city": org_city or pref_city,
            "contact_email": getattr(org, 'email', None) or getattr(org, 'contact_email', None) or user.email,
            "contact_phone": getattr(org, 'phone', None) or getattr(org, 'contact_phone', None) or user.phone
        }
    if biz_prof:
        biz_city = biz_prof.city.value if hasattr(biz_prof.city, 'value') else biz_prof.city
        user_dict["business_profile"] = {
            "id": biz_prof.id,
            "organization_name": getattr(biz_prof, 'business_name', '') or getattr(biz_prof, 'organization_name', ''),
            "slug": getattr(biz_prof, 'slug', None),
            "is_verified": getattr(biz_prof, 'is_verified', False) or False,
            "events_count": getattr(biz_prof, 'events_count', 0) or 0,
            "total_revenue": getattr(biz_prof, 'total_revenue', 0.0) or 0.0,
            "city": biz_city or pref_city
        }
    if vendor_prof:
        try:
            vendor_products_count = db.query(Product).filter(Product.vendor_id == vendor_prof.id).count()
            vendor_sales = db.query(func.coalesce(func.sum(ProductOrder.payment_amount), 0)).join(Product).filter(
                Product.vendor_id == vendor_prof.id,
                ProductOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])
            ).scalar() or 0.0
        except Exception:
            vendor_products_count, vendor_sales = 0, 0.0

        vendor_city = vendor_prof.city.value if hasattr(vendor_prof.city, 'value') else vendor_prof.city
        user_dict["vendor_profile"] = {
            "id": vendor_prof.id,
            "business_name": vendor_prof.business_name,
            "slug": getattr(vendor_prof, 'slug', None),
            "category": vendor_prof.vendor_type,
            "is_approved": vendor_prof.is_approved or False,
            "is_verified": vendor_prof.is_verified or False,
            "products_count": vendor_products_count,
            "total_sales": float(vendor_sales),
            "logo_url": vendor_prof.logo_url,
            "city": vendor_city or pref_city
        }
    
    return user_dict


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserAdminUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user (including role change)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_data.first_name is not None:
        user.first_name = user_data.first_name
    if user_data.last_name is not None:
        user.last_name = user_data.last_name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.role is not None:
        # Prevent privilege escalation: only super_admin can assign SUPER_ADMIN role
        from models import UserRole
        if user_data.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin can assign SUPER_ADMIN role"
            )
        # Prevent self-demotion for admins
        if user_id == current_user.id and user_data.status == UserStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot suspend your own account"
            )
        user.role = user_data.role
    if user_data.status is not None:
        user.status = user_data.status
    if user_data.is_verified is not None:
        user.is_verified = user_data.is_verified

    # Sync role-specific profiles & subroles (artist_type, vendor_type, business_type)
    target_role = user_data.role or user.role
    display_name = (
        f"{user.first_name or ''} {user.last_name or ''}".strip()
        or getattr(user, "username", None)
        or (user.email.split("@")[0] if user.email else "Sound It Member")
    )

    if target_role == UserRole.ARTIST or user_data.artist_type is not None:
        artist_prof = db.query(ArtistProfile).filter(ArtistProfile.user_id == user.id).first()
        if not artist_prof and target_role == UserRole.ARTIST:
            artist_prof = ArtistProfile(
                user_id=user.id,
                stage_name=display_name,
                artist_type=(user_data.artist_type or "DJ").strip(),
                city=user.preferred_city,
                is_approved=True,
                is_verified=bool(user.is_verified or user.verification_badge),
            )
            db.add(artist_prof)
        elif artist_prof and user_data.artist_type is not None:
            artist_prof.artist_type = user_data.artist_type.strip() or "Artist"

    if target_role == UserRole.VENDOR or user_data.vendor_type is not None:
        vendor_prof = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
        if not vendor_prof and target_role == UserRole.VENDOR:
            vendor_prof = VendorProfile(
                user_id=user.id,
                business_name=display_name,
                vendor_type=(user_data.vendor_type or "food").strip().lower(),
                city=user.preferred_city,
                is_approved=True,
                is_verified=bool(user.is_verified or user.verification_badge),
            )
            db.add(vendor_prof)
        elif vendor_prof and user_data.vendor_type is not None:
            vendor_prof.vendor_type = user_data.vendor_type.strip().lower() or "other"

    if target_role in (UserRole.BUSINESS, UserRole.ORGANIZER) or user_data.business_type is not None:
        biz_prof = db.query(BusinessProfile).filter(BusinessProfile.user_id == user.id).first()
        org_prof = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == user.id).first()
        clean_btype = (user_data.business_type or "organizer").strip().lower()
        if not biz_prof and target_role in (UserRole.BUSINESS, UserRole.ORGANIZER):
            biz_prof = BusinessProfile(
                user_id=user.id,
                business_name=(org_prof.organization_name if org_prof and org_prof.organization_name else display_name),
                business_type=[clean_btype],
                city=user.preferred_city,
                is_approved=True,
                is_verified=bool(user.is_verified or user.verification_badge),
            )
            db.add(biz_prof)
            db.flush()
        elif biz_prof and user_data.business_type is not None:
            biz_prof.business_type = [clean_btype]
        if not org_prof and target_role in (UserRole.BUSINESS, UserRole.ORGANIZER):
            org_prof = OrganizerProfile(
                user_id=user.id,
                business_profile_id=biz_prof.id if biz_prof else None,
                organization_name=(biz_prof.business_name if biz_prof and biz_prof.business_name else display_name),
                city=user.preferred_city,
                is_approved=True,
                is_verified=bool(user.is_verified or user.verification_badge),
            )
            db.add(org_prof)

    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/suspend")
def suspend_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Suspend user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend/ban your own account"
        )
    
    user.status = UserStatus.SUSPENDED
    db.commit()
    
    return {"message": "User suspended successfully"}


@router.post("/users/{user_id}/ban")
def ban_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Ban user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend/ban your own account"
        )
    
    user.status = UserStatus.INACTIVE
    db.commit()
    
    return {"message": "User banned successfully"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Soft-delete user account to avoid FK constraint issues"""
    from datetime import datetime
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Admin deletion rules
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete your own account from this endpoint"
        )
    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin accounts cannot be deleted"
        )
    if user.role == UserRole.ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a Super Admin can delete admin accounts"
        )
    
    # Soft delete: anonymize PII and mark inactive
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    user.email = f"deleted_{user_id}_{timestamp}@deleted.local"
    user.phone = None
    user.password_hash = ""
    user.first_name = "Deleted"
    user.last_name = "User"
    user.avatar_url = None
    user.background_url = None
    user.bio = None
    user.instagram = None
    user.twitter = None
    user.website = None
    user.status = UserStatus.INACTIVE
    user.is_verified = False
    user.verification_badge = False
    user.notifications_enabled = False
    user.foreigner_mode = False
    
    db.commit()
    
    return {"message": "User deleted successfully"}


# ==================== BUSINESS MANAGEMENT ====================

@router.get("/businesses", response_model=List[BusinessResponse])
def list_businesses(
    verified: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all businesses (organizers)"""
    query = db.query(OrganizerProfile).join(User).filter(
        ~User.email.like("deleted_%@deleted.local")
    )
    
    if verified is not None:
        query = query.filter(OrganizerProfile.is_verified == verified)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (OrganizerProfile.organization_name.ilike(search_filter)) |
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter))
        )
    
    organizers = query.order_by(desc(OrganizerProfile.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for org in organizers:
        org_city = org.city.value if hasattr(org.city, 'value') else org.city
        pref_city = org.user.preferred_city.value if org.user and hasattr(org.user.preferred_city, 'value') else (org.user.preferred_city if org.user else None)
        
        real_events = db.query(func.count(Event.id)).filter(Event.organizer_id == org.id).scalar() or 0
        real_rev = db.query(func.coalesce(func.sum(TicketOrder.payment_amount), 0)).join(
            Event, TicketOrder.event_id == Event.id
        ).filter(
            Event.organizer_id == org.id,
            TicketOrder.status == TicketOrderStatus.APPROVED
        ).scalar() or 0.0

        result.append({
            "id": org.id,
            "organization_name": org.organization_name,
            "business_name": org.organization_name,
            "description": org.description,
            "website": org.website,
            "logo_url": org.user.avatar_url if org.user else None,
            "email": getattr(org, 'email', None) or getattr(org, 'contact_email', None) or (org.user.email if org.user else None),
            "phone": getattr(org, 'phone', None) or getattr(org, 'contact_phone', None) or (org.user.phone if org.user else None),
            "city": org_city or pref_city,
            "slug": getattr(org, 'slug', None),
            "is_verified": org.is_verified or False,
            "is_approved": org.is_approved or False,
            "is_featured": getattr(org, 'is_featured', False),
            "events_count": real_events,
            "total_revenue": float(real_rev),
            "user_id": org.user_id,
            "user_name": f"{org.user.first_name or ''} {org.user.last_name or ''}".strip() if org.user else None,
            "status": org.user.status.value if org.user and org.user.status else "active",
            "verification_badge": org.user.verification_badge if org.user else False,
            "created_at": org.created_at
        })
    
    return result


@router.get("/businesses/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get business details from OrganizerProfile or BusinessProfile"""
    org, ptype = _get_business_profile(db, business_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    user = org.user
    org_city = org.city.value if hasattr(org.city, 'value') else org.city
    pref_city = user.preferred_city.value if user and hasattr(user.preferred_city, 'value') else (user.preferred_city if user else None)
    
    real_events = db.query(func.count(Event.id)).filter(Event.organizer_id == org.id).scalar() or 0
    real_rev = db.query(func.coalesce(func.sum(TicketOrder.payment_amount), 0)).join(
        Event, TicketOrder.event_id == Event.id
    ).filter(
        Event.organizer_id == org.id,
        TicketOrder.status == TicketOrderStatus.APPROVED
    ).scalar() or 0.0

    if ptype == "organizer":
        return {
            "id": org.id,
            "organization_name": org.organization_name,
            "business_name": org.organization_name,
            "description": org.description,
            "website": org.website,
            "logo_url": user.avatar_url if user else None,
            "email": getattr(org, 'email', None) or getattr(org, 'contact_email', None) or (user.email if user else None),
            "phone": getattr(org, 'phone', None) or getattr(org, 'contact_phone', None) or (user.phone if user else None),
            "city": org_city or pref_city,
            "slug": getattr(org, 'slug', None),
            "is_verified": org.is_verified or False,
            "is_approved": org.is_approved or False,
            "is_featured": getattr(org, 'is_featured', False),
            "events_count": real_events,
            "total_revenue": float(real_rev),
            "user_id": org.user_id,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "status": user.status.value if user and user.status else "active",
            "verification_badge": user.verification_badge if user else False,
            "created_at": org.created_at
        }
    else:
        return {
            "id": org.id,
            "organization_name": getattr(org, 'business_name', '') or getattr(org, 'organization_name', ''),
            "business_name": getattr(org, 'business_name', '') or getattr(org, 'organization_name', ''),
            "description": org.description,
            "website": org.website,
            "logo_url": user.avatar_url if user else None,
            "email": getattr(org, 'email', None) or (user.email if user else None),
            "phone": getattr(org, 'phone', None) or (user.phone if user else None),
            "city": org_city or pref_city,
            "slug": getattr(org, 'slug', None),
            "is_verified": getattr(org, 'is_verified', False) or False,
            "is_approved": getattr(org, 'is_approved', False) or False,
            "is_featured": getattr(org, 'is_featured', False),
            "events_count": real_events,
            "total_revenue": float(real_rev),
            "user_id": org.user_id,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "status": user.status.value if user and user.status else "active",
            "verification_badge": user.verification_badge if user else False,
            "created_at": org.created_at
        }


@router.put("/businesses/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: int,
    business_data: BusinessUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Edit business profile"""
    org = db.query(OrganizerProfile).filter(OrganizerProfile.id == business_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    if business_data.organization_name is not None:
        clean_org_name = business_data.organization_name.strip()
        if clean_org_name:
            org.organization_name = clean_org_name
            bp = (
                db.query(BusinessProfile).filter(BusinessProfile.id == org.business_profile_id).first()
                if org.business_profile_id
                else db.query(BusinessProfile).filter(BusinessProfile.user_id == org.user_id).first()
            )
            if bp:
                bp.business_name = clean_org_name
                if not org.business_profile_id:
                    org.business_profile_id = bp.id
    if business_data.description is not None:
        org.description = business_data.description
    if business_data.website is not None:
        org.website = business_data.website
    
    db.commit()
    db.refresh(org)
    try:
        from utils.cache import invalidate_business_caches
        invalidate_business_caches()
    except Exception:
        pass
    
    return {
        "id": org.id,
        "organization_name": org.organization_name,
        "description": org.description,
        "website": org.website,
        "is_verified": org.is_verified or False,
        "is_approved": org.is_approved or False,
        "is_featured": getattr(org, 'is_featured', False),
        "events_count": org.events_count or 0,
        "total_revenue": org.total_revenue or 0.0,
        "user_id": org.user_id,
        "user_name": f"{org.user.first_name or ''} {org.user.last_name or ''}".strip() if org.user else None,
        "status": org.user.status.value if org.user and org.user.status else "active",
        "created_at": org.created_at
    }


@router.post("/businesses/{business_id}/verify")
def verify_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Verify business"""
    org, _ = _get_business_profile(db, business_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    org.is_verified = True
    if org.user:
        org.user.is_verified = True
        org.user.verification_badge = True
    db.commit()
    
    return {"message": "Business verified successfully"}


@router.post("/businesses/{business_id}/unverify")
def unverify_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unverify business (removes verification badge)"""
    org, _ = _get_business_profile(db, business_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    org.is_verified = False
    if org.user:
        org.user.is_verified = False
        org.user.verification_badge = False
    db.commit()
    
    return {"message": "Business unverified successfully"}


@router.post("/businesses/{business_id}/approve")
def approve_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve business account (allows them to operate on the platform)"""
    org, _ = _get_business_profile(db, business_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    org.is_approved = True
    
    # Also approve linked business profile if exists
    if hasattr(org, 'business_profile_id') and org.business_profile_id:
        bp = db.query(BusinessProfile).filter(BusinessProfile.id == org.business_profile_id).first()
        if bp:
            bp.is_approved = True
    elif org.user_id:
        bp = db.query(BusinessProfile).filter(BusinessProfile.user_id == org.user_id).first()
        if bp:
            bp.is_approved = True
    
    db.commit()
    
    # Send business welcome email after approval
    try:
        if org.user_id:
            user = db.query(User).filter(User.id == org.user_id).first()
            if user and user.email:
                send_business_welcome_email(
                    to_email=user.email,
                    first_name=user.first_name or ""
                )
    except Exception:
        pass
    
    return {"message": "Business approved successfully", "is_approved": True}


@router.post("/businesses/{business_id}/unapprove")
def unapprove_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unapprove business account"""
    org, _ = _get_business_profile(db, business_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    org.is_approved = False
    
    # Also unapprove linked business profile if exists
    if hasattr(org, 'business_profile_id') and org.business_profile_id:
        bp = db.query(BusinessProfile).filter(BusinessProfile.id == org.business_profile_id).first()
        if bp:
            bp.is_approved = False
    elif org.user_id:
        bp = db.query(BusinessProfile).filter(BusinessProfile.user_id == org.user_id).first()
        if bp:
            bp.is_approved = False
    
    db.commit()
    
    return {"message": "Business unapproved successfully", "is_approved": False}


@router.post("/events/{event_id}/feature")
def feature_event(
    event_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Feature an event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.is_featured = True
    
    # Also create a FeaturedItem record for tracking (ignore missing columns)
    try:
        featured = FeaturedItem(
            entity_type="event",
            entity_id=event_id,
            is_active=True
        )
        db.add(featured)
        db.commit()
    except Exception:
        db.rollback()
        db.commit()
    
    return {"message": "Event featured successfully", "event_id": event_id}


@router.delete("/events/{event_id}/feature")
def unfeature_event(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unfeature an event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.is_featured = False
    
    # Deactivate any active FeaturedItem records for this event
    db.query(FeaturedItem).filter(
        FeaturedItem.entity_type == "event",
        FeaturedItem.entity_id == event_id,
        FeaturedItem.is_active == True
    ).update({"is_active": False}, synchronize_session=False)
    
    db.commit()
    
    return {"message": "Event unfeatured successfully", "event_id": event_id}


@router.delete("/businesses/{business_id}")
def delete_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete business by soft-deleting the associated user account"""
    business = db.query(BusinessProfile).filter(BusinessProfile.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    # Soft-delete the associated user to preserve events and other data integrity
    user = db.query(User).filter(User.id == business.user_id).first()
    if user:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        user.email = f"deleted_{user.id}_{timestamp}@deleted.local"
        user.phone = None
        user.password_hash = ""
        user.first_name = "Deleted"
        user.last_name = "Business"
        user.avatar_url = None
        user.background_url = None
        user.bio = None
        user.status = UserStatus.INACTIVE
        user.is_verified = False
        user.verification_badge = False
        user.notifications_enabled = False
    
    db.commit()
    
    return {"message": "Business deleted successfully"}


# ==================== ARTIST MANAGEMENT ====================

@router.get("/artists", response_model=List[ArtistResponse])
def list_artists(
    verified: Optional[bool] = None,
    genre: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all artists (DJs), includes users with artist role even if they lack an ArtistProfile"""
    # Query users with artist role, left-joining their artist profile
    query = db.query(User, ArtistProfile).outerjoin(
        ArtistProfile, User.id == ArtistProfile.user_id
    ).filter(
        User.role == UserRole.ARTIST,
        ~User.email.like("deleted_%@deleted.local")
    )
    
    if verified is not None:
        query = query.filter(User.is_verified == verified)
    if genre:
        query = query.filter(ArtistProfile.genre.ilike(f"%{genre}%"))
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (ArtistProfile.stage_name.ilike(search_filter)) |
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter)) |
            (User.email.ilike(search_filter))
        )
    
    rows = query.order_by(desc(ArtistProfile.followers_count)).offset(skip).limit(limit).all()
    
    result = []
    seen_ids = set()
    for user, ap in rows:
        # Prefer ArtistProfile id when available; otherwise use user id
        artist_id = ap.id if ap else user.id
        if artist_id in seen_ids:
            continue
        seen_ids.add(artist_id)
        
        artist_city = ap.city.value if ap and hasattr(ap.city, 'value') else (ap.city if ap else None)
        user_city = user.preferred_city.value if hasattr(user.preferred_city, 'value') else user.preferred_city
        resolved_city = artist_city or user_city

        stage_name = ap.stage_name if ap else f"{user.first_name or ''} {user.last_name or ''}".strip() or "Artist"
        real_events = db.query(func.count(EventArtist.id)).filter(EventArtist.artist_id == ap.id).scalar() or 0 if ap else 0
        real_followers = db.query(func.count(ArtistFollow.id)).filter(ArtistFollow.artist_id == ap.id).scalar() or (ap.followers_count if ap else 0) or 0
        result.append({
            "id": artist_id,
            "stage_name": stage_name,
            "artist_type": (getattr(ap, 'artist_type', None) or "Artist") if ap else "Artist",
            "genre": ap.genre if ap else None,
            "followers_count": real_followers,
            "events_count": real_events,
            "user_id": user.id,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or None,
            "spotify_url": ap.spotify_url if ap else None,
            "soundcloud_url": ap.soundcloud_url if ap else None,
            "apple_music_url": getattr(ap, 'apple_music_url', None) if ap else None,
            "mixcloud_url": getattr(ap, 'mixcloud_url', None) if ap else None,
            "instagram_url": getattr(ap, 'instagram_url', None) if ap else None,
            "avatar_url": user.avatar_url,
            "bio": getattr(ap, 'bio', None) if ap else user.bio,
            "city": resolved_city,
            "slug": getattr(ap, 'slug', None) if ap else getattr(user, 'slug', None),
            "email": user.email,
            "phone": user.phone,
            "created_at": ap.created_at if ap else user.created_at,
            "is_verified": user.is_verified or False,
            "is_approved": ap.is_approved if ap else False,
            "is_featured": ap.is_featured if ap else False,
            "status": user.status.value if user.status else "active"
        })
    
    return result


@router.get("/artists/{artist_id}", response_model=ArtistResponse)
def get_artist(
    artist_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get artist details"""
    dj = _get_artist_profile(db, artist_id)
    if not dj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    pref_city = dj.user.preferred_city.value if dj.user and hasattr(dj.user.preferred_city, 'value') else (dj.user.preferred_city if dj.user else None)
    artist_city = dj.city.value if hasattr(dj.city, 'value') else dj.city
    resolved_city = artist_city or pref_city
    
    real_events = db.query(func.count(EventArtist.id)).filter(EventArtist.artist_id == dj.id).scalar() or 0
    real_followers = db.query(func.count(ArtistFollow.id)).filter(ArtistFollow.artist_id == dj.id).scalar() or (dj.followers_count or 0)
    
    return {
        "id": dj.id,
        "stage_name": dj.stage_name,
        "genre": dj.genre,
        "followers_count": real_followers,
        "events_count": real_events,
        "user_id": dj.user_id,
        "user_name": f"{dj.user.first_name or ''} {dj.user.last_name or ''}".strip() if dj.user else None,
        "spotify_url": dj.spotify_url,
        "soundcloud_url": dj.soundcloud_url,
        "apple_music_url": getattr(dj, 'apple_music_url', None),
        "mixcloud_url": getattr(dj, 'mixcloud_url', None),
        "instagram_url": getattr(dj, 'instagram_url', None),
        "avatar_url": dj.user.avatar_url if dj.user else None,
        "bio": getattr(dj, 'bio', None) or (dj.user.bio if dj.user else None),
        "city": resolved_city,
        "slug": getattr(dj, 'slug', None),
        "email": dj.user.email if dj.user else None,
        "phone": dj.user.phone if dj.user else None,
        "created_at": dj.created_at,
        "is_verified": dj.user.is_verified if dj.user else False,
        "is_approved": dj.is_approved or False,
        "is_featured": dj.is_featured or False,
        "status": dj.user.status.value if dj.user and dj.user.status else "active"
    }


@router.put("/artists/{artist_id}", response_model=ArtistResponse)
def update_artist(
    artist_id: int,
    artist_data: ArtistUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Edit artist profile"""
    dj = db.query(ArtistProfile).filter(ArtistProfile.id == artist_id).first()
    if not dj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    if artist_data.stage_name is not None:
        dj.stage_name = artist_data.stage_name
    if artist_data.genre is not None:
        dj.genre = artist_data.genre
    if artist_data.city is not None:
        from models import City as CityEnum
        raw_city = artist_data.city.strip().lower() if artist_data.city else None
        try:
            city_val = CityEnum(raw_city) if raw_city else None
        except ValueError:
            city_val = None
        dj.city = city_val
        if dj.user and city_val:
            dj.user.preferred_city = city_val
    if artist_data.spotify_url is not None:
        dj.spotify_url = artist_data.spotify_url
    if artist_data.apple_music_url is not None:
        dj.apple_music_url = artist_data.apple_music_url
    if artist_data.soundcloud_url is not None:
        dj.soundcloud_url = artist_data.soundcloud_url
    if artist_data.hearthis_url is not None:
        dj.hearthis_url = artist_data.hearthis_url
    
    db.commit()
    db.refresh(dj)
    
    pref_city = dj.user.preferred_city.value if dj.user and hasattr(dj.user.preferred_city, 'value') else (dj.user.preferred_city if dj.user else None)
    artist_city = dj.city.value if hasattr(dj.city, 'value') else dj.city
    resolved_city = artist_city or pref_city

    return {
        "id": dj.id,
        "stage_name": dj.stage_name,
        "genre": dj.genre,
        "followers_count": dj.followers_count,
        "events_count": dj.events_count,
        "user_id": dj.user_id,
        "user_name": f"{dj.user.first_name or ''} {dj.user.last_name or ''}".strip() if dj.user else None,
        "spotify_url": dj.spotify_url,
        "soundcloud_url": dj.soundcloud_url,
        "city": resolved_city,
        "created_at": dj.created_at,
        "is_verified": dj.user.is_verified if dj.user else False
    }


@router.post("/artists/{artist_id}/verify")
def verify_artist(
    artist_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Verify artist (marks user as verified)"""
    dj = _get_artist_profile(db, artist_id)
    if not dj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    # Mark the user as verified
    if dj.user:
        dj.user.is_verified = True
        dj.user.verification_badge = True
        db.commit()
    
    dj.is_verified = True
    db.commit()
    
    return {"message": "Artist verified successfully"}


@router.post("/artists/{artist_id}/unverify")
def unverify_artist(
    artist_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unverify artist (removes verification badge)"""
    dj = _get_artist_profile(db, artist_id)
    if not dj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    if dj.user:
        dj.user.is_verified = False
        dj.user.verification_badge = False
        db.commit()
    
    dj.is_verified = False
    db.commit()
    
    return {"message": "Artist unverified successfully"}


@router.post("/artists/{artist_id}/approve")
def approve_artist(
    artist_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Approve artist account (allows them to operate on the platform)"""
    dj = _get_artist_profile(db, artist_id)
    if not dj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    dj.is_approved = True
    db.commit()
    
    # Send artist welcome email after approval
    try:
        if dj.user_id:
            user = db.query(User).filter(User.id == dj.user_id).first()
            if user and user.email:
                send_artist_welcome_email(
                    to_email=user.email,
                    first_name=user.first_name or ""
                )
    except Exception:
        pass
    
    return {"message": "Artist approved successfully", "is_approved": True}


@router.post("/artists/{artist_id}/unapprove")
def unapprove_artist(
    artist_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unapprove artist account"""
    dj = _get_artist_profile(db, artist_id)
    if not dj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    dj.is_approved = False
    db.commit()
    
    return {"message": "Artist unapproved successfully", "is_approved": False}


@router.delete("/artists/{artist_id}")
def delete_artist(
    artist_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Delete artist profile and related records"""
    artist = _get_artist_profile(db, artist_id)
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    user_id = artist.user_id
    
    # Delete related records in correct order (respecting FK constraints)
    db.query(ArtistReview).filter(ArtistReview.artist_id == artist_id).delete()
    db.query(ArtistFollow).filter(ArtistFollow.artist_id == artist_id).delete()
    db.query(ArtistAvailability).filter(ArtistAvailability.artist_id == artist_id).delete()
    db.query(EventArtist).filter(EventArtist.artist_id == artist_id).delete()
    db.query(BookingRequest).filter(BookingRequest.artist_id == artist_id).delete()
    
    db.delete(artist)
    
    # Update user role back to regular user
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.role = UserRole.USER
    
    db.commit()
    
    return {"message": "Artist deleted successfully"}


# ==================== EVENT MANAGEMENT ====================

@router.get("/events", response_model=List[EventAdminResponse])
def list_events(
    status: Optional[EventStatus] = None,
    city: Optional[str] = None,
    organizer_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all events with filters"""
    try:
        from api.events import auto_complete_past_events
        auto_complete_past_events(db)
    except Exception:
        pass
        
    query = db.query(Event)
    
    if status:
        query = query.filter(Event.status == status)
    if city:
        query = query.filter(Event.city == city)
    if organizer_id:
        query = query.filter(Event.organizer_id == organizer_id)
    if date_from:
        query = query.filter(Event.start_date >= date_from)
    if date_to:
        query = query.filter(Event.start_date <= date_to)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Event.title.ilike(search_filter)) |
            (Event.description.ilike(search_filter))
        )
    
    events = query.order_by(desc(Event.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for event in events:
        real_tickets = db.query(func.coalesce(func.sum(TicketOrder.quantity), 0)).filter(
            TicketOrder.event_id == event.id,
            TicketOrder.status == TicketOrderStatus.APPROVED
        ).scalar() or 0
        
        org_name = (event.organizer.organization_name if event.organizer and event.organizer.organization_name else None)
        if not org_name and event.organizer:
            u = db.query(User).filter(User.id == event.organizer.user_id).first()
            bp = db.query(BusinessProfile).filter(BusinessProfile.user_id == event.organizer.user_id).first()
            org_name = (bp.business_name if bp else None) or (f"{u.first_name or ''} {u.last_name or ''}".strip() if u else None) or (u.email if u else None)
        if not org_name and event.organizer_id:
            u = db.query(User).filter(User.id == event.organizer_id).first()
            if u:
                org_name = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email

        venue_str = (event.venue.name if event.venue else None) or event.address or "Sound It Venue"

        result.append({
            "id": event.id,
            "organizer_id": event.organizer_id,
            "venue_id": event.venue_id,
            "title": event.title,
            "title_cn": event.title_cn,
            "description": event.description,
            "description_cn": event.description_cn,
            "start_date": event.start_date,
            "end_date": event.end_date,
            "city": event.city,
            "address": event.address,
            "capacity": event.capacity,
            "flyer_image": event.flyer_image,
            "gallery_images": event.gallery_images,
            "status": event.status,
            "views_count": event.views_count or 0,
            "tickets_sold": real_tickets,
            "attendees_count": real_tickets,
            "share_url": event.share_url,
            "qr_code": event.qr_code,
            "created_at": event.created_at,
            "organizer_name": org_name or "Sound Events",
            "business_name": org_name or "Sound Events",
            "venue_name": venue_str,
            "is_featured": getattr(event, 'is_featured', False)
        })
    
    return result


@router.get("/events/{event_id}", response_model=EventAdminResponse)
def get_event(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get event details"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    real_tickets = db.query(func.coalesce(func.sum(TicketOrder.quantity), 0)).filter(
        TicketOrder.event_id == event.id,
        TicketOrder.status == TicketOrderStatus.APPROVED
    ).scalar() or 0
    
    org_name = (event.organizer.organization_name if event.organizer and event.organizer.organization_name else None)
    if not org_name and event.organizer:
        u = db.query(User).filter(User.id == event.organizer.user_id).first()
        bp = db.query(BusinessProfile).filter(BusinessProfile.user_id == event.organizer.user_id).first()
        org_name = (bp.business_name if bp else None) or (f"{u.first_name or ''} {u.last_name or ''}".strip() if u else None) or (u.email if u else None)

    venue_str = (event.venue.name if event.venue else None) or event.address or "Sound It Venue"

    return {
        "id": event.id,
        "organizer_id": event.organizer_id,
        "venue_id": event.venue_id,
        "title": event.title,
        "title_cn": event.title_cn,
        "description": event.description,
        "description_cn": event.description_cn,
        "start_date": event.start_date,
        "end_date": event.end_date,
        "city": event.city,
        "address": event.address,
        "capacity": event.capacity,
        "flyer_image": event.flyer_image,
        "gallery_images": event.gallery_images,
        "status": event.status,
        "views_count": event.views_count or 0,
        "tickets_sold": real_tickets,
        "attendees_count": real_tickets,
        "share_url": event.share_url,
        "qr_code": event.qr_code,
        "created_at": event.created_at,
        "organizer_name": org_name or "Sound Events",
        "business_name": org_name or "Sound Events",
        "venue_name": venue_str,
        "is_featured": getattr(event, 'is_featured', False)
    }


@router.put("/events/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_data: EventUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Edit any event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event_data.title is not None:
        event.title = event_data.title
    if event_data.title_cn is not None:
        event.title_cn = event_data.title_cn
    if event_data.description is not None:
        event.description = event_data.description
    if event_data.description_cn is not None:
        event.description_cn = event_data.description_cn
    if event_data.start_date is not None:
        event.start_date = event_data.start_date
    if event_data.end_date is not None:
        event.end_date = event_data.end_date
    if event_data.city is not None:
        event.city = event_data.city
    if event_data.address is not None:
        event.address = event_data.address
    if event_data.capacity is not None:
        event.capacity = event_data.capacity
    if event_data.status is not None:
        event.status = event_data.status
    
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Delete related records
    db.query(EventArtist).filter(EventArtist.event_id == event_id).delete()
    db.query(EventFollow).filter(EventFollow.event_id == event_id).delete()
    db.query(EventVendor).filter(EventVendor.event_id == event_id).delete()
    db.query(PromoCode).filter(PromoCode.event_id == event_id).delete()
    db.query(EventPaymentQR).filter(EventPaymentQR.event_id == event_id).delete()
    
    # Delete ticket orders and their tickets
    ticket_orders = db.query(TicketOrder).filter(TicketOrder.event_id == event_id).all()
    for order in ticket_orders:
        db.query(Ticket).filter(Ticket.ticket_order_id == order.id).delete()
        db.delete(order)
    
    # Delete table orders and packages
    db.query(TableOrder).filter(TableOrder.event_id == event_id).delete()
    db.query(TablePackage).filter(TablePackage.event_id == event_id).delete()
    
    # Remove event references from recaps and community posts
    db.query(Recap).filter(Recap.event_id == event_id).update({"event_id": None}, synchronize_session=False)
    db.query(CommunityPost).filter(CommunityPost.event_id == event_id).update({"event_id": None}, synchronize_session=False)
    
    # Delete ticket tiers and tickets
    ticket_tiers = db.query(TicketTier).filter(TicketTier.event_id == event_id).all()
    for tier in ticket_tiers:
        db.query(Ticket).filter(Ticket.ticket_tier_id == tier.id).delete()
        db.delete(tier)
    
    # Also delete any remaining tickets with direct event reference
    db.query(Ticket).filter(Ticket.event_id == event_id).delete()
    
    db.delete(event)
    db.commit()
    
    return {"message": "Event deleted successfully"}


@router.post("/events/{event_id}/approve")
def approve_event(
    event_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Approve event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.status = EventStatus.APPROVED
    db.commit()
    
    return {"message": "Event approved successfully"}


@router.post("/events/{event_id}/reject")
def reject_event(
    event_id: int,
    reason: Optional[str] = Body(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Reject event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.status = EventStatus.REJECTED
    event.rejection_reason = reason
    db.commit()
    
    return {"message": "Event rejected successfully", "reason": reason}


@router.post("/events/{event_id}/cancel")
def cancel_event(
    event_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Cancel event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event.status = EventStatus.CANCELLED
    db.commit()
    
    return {"message": "Event cancelled successfully", "reason": reason}


# ==================== CLUB/VENUE MANAGEMENT ====================

@router.get("/clubs", response_model=List[VenueResponse])
def list_clubs(
    city: Optional[str] = None,
    category: Optional[str] = None,
    verified: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all clubs/venues"""
    query = db.query(Venue).filter(
        (Venue.category == "club") | (Venue.category == "bar")
    )
    
    if city:
        query = query.filter(Venue.city == city)
    if category:
        query = query.filter(Venue.category == category)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Venue.name.ilike(search_filter)) |
            (Venue.address.ilike(search_filter))
        )
    
    venues = query.order_by(desc(Venue.created_at)).offset(skip).limit(limit).all()
    return venues


@router.post("/clubs", response_model=VenueResponse)
def create_club(
    venue_data: VenueCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add new club"""
    venue = Venue(
        name=venue_data.name,
        name_cn=venue_data.name_cn,
        address=venue_data.address,
        city=venue_data.city,
        district=venue_data.district,
        latitude=venue_data.latitude,
        longitude=venue_data.longitude,
        description=venue_data.description,
        description_cn=venue_data.description_cn,
        capacity=venue_data.capacity,
        english_friendly=venue_data.english_friendly,
        english_menu=venue_data.english_menu,
        accepts_foreign_cards=venue_data.accepts_foreign_cards,
        phone=venue_data.phone,
        wechat_id=venue_data.wechat_id,
        dianping_url=venue_data.dianping_url,
        category=venue_data.category or "club",
        cuisine_type=venue_data.cuisine_type,
        price_range=venue_data.price_range,
        opening_hours=venue_data.opening_hours,
        is_active=True
    )
    
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue


@router.get("/clubs/{club_id}", response_model=VenueResponse)
def get_club(
    club_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get club details"""
    venue = db.query(Venue).filter(Venue.id == club_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Club not found"
        )
    return venue


@router.put("/clubs/{club_id}", response_model=VenueResponse)
def update_club(
    club_id: int,
    venue_data: VenueCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Edit club"""
    venue = db.query(Venue).filter(Venue.id == club_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Club not found"
        )
    
    venue.name = venue_data.name
    venue.name_cn = venue_data.name_cn
    venue.address = venue_data.address
    venue.city = venue_data.city
    venue.district = venue_data.district
    venue.latitude = venue_data.latitude
    venue.longitude = venue_data.longitude
    venue.description = venue_data.description
    venue.description_cn = venue_data.description_cn
    venue.capacity = venue_data.capacity
    venue.english_friendly = venue_data.english_friendly
    venue.english_menu = venue_data.english_menu
    venue.accepts_foreign_cards = venue_data.accepts_foreign_cards
    venue.phone = venue_data.phone
    venue.wechat_id = venue_data.wechat_id
    venue.dianping_url = venue_data.dianping_url
    venue.category = venue_data.category or venue.category
    venue.cuisine_type = venue_data.cuisine_type
    venue.price_range = venue_data.price_range
    venue.opening_hours = venue_data.opening_hours
    
    db.commit()
    db.refresh(venue)
    return venue


@router.delete("/clubs/{club_id}")
def delete_club(
    club_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete club"""
    venue = db.query(Venue).filter(Venue.id == club_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Club not found"
        )
    
    # Check if venue has events
    events_count = db.query(Event).filter(Event.venue_id == club_id).count()
    if events_count > 0:
        # Soft delete - mark as inactive
        venue.is_active = False
        db.commit()
        return {"message": "Club deactivated (has associated events)"}
    
    db.delete(venue)
    db.commit()
    return {"message": "Club deleted successfully"}


# ==================== FOODSPOT MANAGEMENT ====================

@router.get("/foodspots", response_model=List[VenueResponse])
def list_foodspots(
    city: Optional[str] = None,
    cuisine_type: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all food spots"""
    query = db.query(Venue).filter(
        (Venue.category == "restaurant") | (Venue.category == "cafe")
    )
    
    if city:
        query = query.filter(Venue.city == city)
    if cuisine_type:
        query = query.filter(Venue.cuisine_type.ilike(f"%{cuisine_type}%"))
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Venue.name.ilike(search_filter)) |
            (Venue.address.ilike(search_filter))
        )
    
    venues = query.order_by(desc(Venue.created_at)).offset(skip).limit(limit).all()
    return venues


@router.post("/foodspots", response_model=VenueResponse)
def create_foodspot(
    venue_data: VenueCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add new food spot"""
    venue = Venue(
        name=venue_data.name,
        name_cn=venue_data.name_cn,
        address=venue_data.address,
        city=venue_data.city,
        district=venue_data.district,
        latitude=venue_data.latitude,
        longitude=venue_data.longitude,
        description=venue_data.description,
        description_cn=venue_data.description_cn,
        capacity=venue_data.capacity,
        english_friendly=venue_data.english_friendly,
        english_menu=venue_data.english_menu,
        accepts_foreign_cards=venue_data.accepts_foreign_cards,
        phone=venue_data.phone,
        wechat_id=venue_data.wechat_id,
        dianping_url=venue_data.dianping_url,
        category=venue_data.category or "restaurant",
        cuisine_type=venue_data.cuisine_type,
        price_range=venue_data.price_range,
        opening_hours=venue_data.opening_hours,
        is_active=True
    )
    
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue


@router.get("/foodspots/{foodspot_id}", response_model=VenueResponse)
def get_foodspot(
    foodspot_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get food spot details"""
    venue = db.query(Venue).filter(Venue.id == foodspot_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food spot not found"
        )
    return venue


@router.put("/foodspots/{foodspot_id}", response_model=VenueResponse)
def update_foodspot(
    foodspot_id: int,
    venue_data: VenueCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Edit food spot"""
    venue = db.query(Venue).filter(Venue.id == foodspot_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food spot not found"
        )
    
    venue.name = venue_data.name
    venue.name_cn = venue_data.name_cn
    venue.address = venue_data.address
    venue.city = venue_data.city
    venue.district = venue_data.district
    venue.latitude = venue_data.latitude
    venue.longitude = venue_data.longitude
    venue.description = venue_data.description
    venue.description_cn = venue_data.description_cn
    venue.capacity = venue_data.capacity
    venue.english_friendly = venue_data.english_friendly
    venue.english_menu = venue_data.english_menu
    venue.accepts_foreign_cards = venue_data.accepts_foreign_cards
    venue.phone = venue_data.phone
    venue.wechat_id = venue_data.wechat_id
    venue.dianping_url = venue_data.dianping_url
    venue.category = venue_data.category or venue.category
    venue.cuisine_type = venue_data.cuisine_type
    venue.price_range = venue_data.price_range
    venue.opening_hours = venue_data.opening_hours
    
    db.commit()
    db.refresh(venue)
    return venue


@router.delete("/foodspots/{foodspot_id}")
def delete_foodspot(
    foodspot_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete food spot"""
    venue = db.query(Venue).filter(Venue.id == foodspot_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Food spot not found"
        )
    
    # Check if venue has events
    events_count = db.query(Event).filter(Event.venue_id == foodspot_id).count()
    if events_count > 0:
        venue.is_active = False
        db.commit()
        return {"message": "Food spot deactivated (has associated events)"}
    
    db.delete(venue)
    db.commit()
    return {"message": "Food spot deleted successfully"}


# ==================== PAYMENT & FINANCIAL ====================

@router.get("/payments", response_model=List[PaymentTransaction])
def list_payments(
    status: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all transactions across tickets, tables, vendor merchandise, subscriptions, and orders"""
    all_transactions = []
    
    # 1. Ticket Orders
    t_query = db.query(TicketOrder, User).join(User, TicketOrder.user_id == User.id)
    if date_from:
        t_query = t_query.filter(TicketOrder.created_at >= date_from)
    if date_to:
        t_query = t_query.filter(TicketOrder.created_at <= date_to)
    if search:
        s_pat = f"%{search}%"
        t_query = t_query.filter(
            (TicketOrder.ticket_code.ilike(s_pat)) |
            (User.first_name.ilike(s_pat)) |
            (User.last_name.ilike(s_pat)) |
            (User.email.ilike(s_pat))
        )
    for to, u in t_query.all():
        st_val = to.status.value if hasattr(to.status, 'value') else str(to.status)
        if status and status.lower() not in (st_val.lower(), "all"):
            continue
        all_transactions.append({
            "id": to.id,
            "order_number": to.ticket_code or f"TICK-{to.id}",
            "user_id": to.user_id,
            "user_name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
            "amount": float(to.payment_amount or 0.0),
            "currency": "CNY",
            "payment_method": "wechat_alipay",
            "payment_status": st_val,
            "created_at": to.created_at or datetime.utcnow(),
            "paid_at": to.created_at,
            "transaction_type": "ticket",
            "description": f"Ticket Order #{to.id} ({to.quantity} tickets)"
        })
        
    # 2. Table Orders
    tb_query = db.query(TableOrder, User).join(User, TableOrder.user_id == User.id)
    if date_from:
        tb_query = tb_query.filter(TableOrder.created_at >= date_from)
    if date_to:
        tb_query = tb_query.filter(TableOrder.created_at <= date_to)
    if search:
        s_pat = f"%{search}%"
        tb_query = tb_query.filter(
            (TableOrder.payment_reference.ilike(s_pat)) |
            (User.first_name.ilike(s_pat)) |
            (User.last_name.ilike(s_pat)) |
            (User.email.ilike(s_pat))
        )
    for tb, u in tb_query.all():
        st_val = tb.status.value if hasattr(tb.status, 'value') else str(tb.status)
        if status and status.lower() not in (st_val.lower(), "all"):
            continue
        all_transactions.append({
            "id": tb.id,
            "order_number": tb.payment_reference or f"TAB-{tb.id}",
            "user_id": tb.user_id,
            "user_name": tb.contact_name or f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
            "amount": float(tb.payment_amount or 0.0),
            "currency": "CNY",
            "payment_method": "wechat_alipay",
            "payment_status": st_val,
            "created_at": tb.created_at or datetime.utcnow(),
            "paid_at": tb.created_at,
            "transaction_type": "table_reservation",
            "description": f"VIP Table Reservation #{tb.id}"
        })

    # 3. Product Orders
    po_query = db.query(ProductOrder, User).join(User, ProductOrder.user_id == User.id)
    if date_from:
        po_query = po_query.filter(ProductOrder.created_at >= date_from)
    if date_to:
        po_query = po_query.filter(ProductOrder.created_at <= date_to)
    if search:
        s_pat = f"%{search}%"
        po_query = po_query.filter(
            (ProductOrder.order_code.ilike(s_pat)) |
            (User.first_name.ilike(s_pat)) |
            (User.last_name.ilike(s_pat)) |
            (User.email.ilike(s_pat))
        )
    for po, u in po_query.all():
        st_val = po.status.value if hasattr(po.status, 'value') else str(po.status)
        if status and status.lower() not in (st_val.lower(), "all"):
            continue
        all_transactions.append({
            "id": po.id,
            "order_number": po.order_code or f"PROD-{po.id}",
            "user_id": po.user_id,
            "user_name": po.payer_name or f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
            "amount": float(po.payment_amount or 0.0),
            "currency": "CNY",
            "payment_method": "wechat_alipay",
            "payment_status": st_val,
            "created_at": po.created_at or datetime.utcnow(),
            "paid_at": po.created_at,
            "transaction_type": "vendor_product",
            "description": f"Vendor Merchandise #{po.id}"
        })

    # 4. Subscriptions
    sub_query = db.query(Subscription, User).join(User, Subscription.user_id == User.id)
    if date_from:
        sub_query = sub_query.filter(Subscription.created_at >= date_from)
    if date_to:
        sub_query = sub_query.filter(Subscription.created_at <= date_to)
    for sub, u in sub_query.all():
        st_val = sub.status.value if hasattr(sub.status, 'value') else str(sub.status)
        if status and status.lower() not in (st_val.lower(), "all"):
            continue
        all_transactions.append({
            "id": sub.id,
            "order_number": f"SUB-{sub.id}",
            "user_id": sub.user_id,
            "user_name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
            "amount": float(sub.price or 0.0),
            "currency": "CNY",
            "payment_method": "membership",
            "payment_status": st_val,
            "created_at": sub.created_at or datetime.utcnow(),
            "paid_at": sub.created_at,
            "transaction_type": "subscription",
            "description": f"Subscription ({sub.plan_type.value if hasattr(sub.plan_type, 'value') else sub.plan_type})"
        })

    # 5. Legacy Orders
    o_query = db.query(Order).join(User, Order.user_id == User.id)
    if date_from:
        o_query = o_query.filter(Order.created_at >= date_from)
    if date_to:
        o_query = o_query.filter(Order.created_at <= date_to)
    if search:
        s_pat = f"%{search}%"
        o_query = o_query.filter(
            (Order.order_number.ilike(s_pat)) |
            (User.first_name.ilike(s_pat)) |
            (User.last_name.ilike(s_pat)) |
            (User.email.ilike(s_pat))
        )
    for o in o_query.all():
        st_val = o.payment_status.value if hasattr(o.payment_status, 'value') else str(o.payment_status)
        if status and status.lower() not in (st_val.lower(), "all"):
            continue
        all_transactions.append({
            "id": o.id,
            "order_number": o.order_number,
            "user_id": o.user_id,
            "user_name": f"{o.user.first_name or ''} {o.user.last_name or ''}".strip() if o.user else None,
            "amount": float(o.total_amount or 0.0),
            "currency": o.currency,
            "payment_method": o.payment_method.value if o.payment_method else None,
            "payment_status": st_val,
            "created_at": o.created_at or datetime.utcnow(),
            "paid_at": o.paid_at,
            "transaction_type": "order",
            "description": "Platform Order"
        })

    all_transactions.sort(key=lambda x: x["created_at"] or datetime.min, reverse=True)
    return all_transactions[skip : skip + limit]


@router.post("/payments/{order_id}/refund")
def refund_payment(
    order_id: int,
    refund_data: RefundRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Issue refund"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order.payment_status != PaymentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not eligible for refund"
        )
    
    refund_amount = refund_data.amount or order.total_amount
    
    order.payment_status = PaymentStatus.REFUNDED
    order.refund_amount = refund_amount
    order.refunded_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "Refund processed successfully",
        "order_id": order_id,
        "refund_amount": refund_amount,
        "reason": refund_data.reason
    }


@router.get("/financial-reports")
def download_financial_report(
    start_date: datetime,
    end_date: datetime,
    report_type: str = "transactions",  # transactions, revenue, events
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Download CSV financial report"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "transactions":
        writer.writerow([
            "Order ID", "Order Number", "User ID", "User Name", "Amount", 
            "Currency", "Payment Method", "Status", "Created At", "Paid At"
        ])
        
        orders = db.query(Order).filter(
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).all()
        
        for order in orders:
            user_name = f"{order.user.first_name or ''} {order.user.last_name or ''}".strip() if order.user else "N/A"
            writer.writerow([
                order.id,
                order.order_number,
                order.user_id,
                user_name,
                order.total_amount,
                order.currency,
                order.payment_method.value if order.payment_method else "N/A",
                order.payment_status.value,
                order.created_at.isoformat(),
                order.paid_at.isoformat() if order.paid_at else "N/A"
            ])
    
    elif report_type == "revenue":
        writer.writerow(["Date", "Total Revenue", "Ticket Sales", "Order Count"])
        
        # Group by date and calculate revenue
        from sqlalchemy import func, cast, Date
        
        daily_revenue = db.query(
            cast(Order.created_at, Date).label('date'),
            func.sum(Order.total_amount).label('revenue'),
            func.count(Order.id).label('order_count')
        ).filter(
            Order.payment_status == PaymentStatus.COMPLETED,
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).group_by(cast(Order.created_at, Date)).all()
        
        for row in daily_revenue:
            writer.writerow([
                row.date.isoformat() if row.date else "N/A",
                row.revenue or 0,
                "N/A",  # Would calculate from ticket sales
                row.order_count or 0
            ])
    
    elif report_type == "events":
        writer.writerow([
            "Event ID", "Title", "City", "Organizer", "Tickets Sold", 
            "Revenue", "Status", "Start Date"
        ])
        
        events = db.query(Event).filter(
            Event.created_at >= start_date,
            Event.created_at <= end_date
        ).all()
        
        for event in events:
            # Calculate revenue for this event
            revenue = db.query(func.sum(Order.total_amount)).join(OrderItem).join(TicketTier).filter(  # type: ignore
                TicketTier.event_id == event.id,
                Order.payment_status == PaymentStatus.COMPLETED
            ).scalar() or 0
            
            writer.writerow([
                event.id,
                event.title,
                event.city.value if event.city else "N/A",
                event.organizer.organization_name if event.organizer else "N/A",
                event.tickets_sold,
                revenue,
                event.status.value,
                event.start_date.isoformat() if event.start_date else "N/A"
            ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=financial_report_{report_type}_{start_date.date()}_{end_date.date()}.csv"
        }
    )


# ==================== VERIFICATION MANAGEMENT ====================

def _normalize_documents(docs):
    """Normalize verification documents to a list of {title, url, type} dicts."""
    if not docs:
        return []
    if isinstance(docs, list):
        return docs
    if isinstance(docs, dict):
        # Handle dict format like {"license": "url", "id_card": "url"}
        return [{"title": k.replace("_", " ").title(), "url": v, "type": "document"} for k, v in docs.items() if v]
    return []





# ==================== CITY MANAGEMENT ====================

@router.get("/cities", response_model=List[CityStats])
def list_cities(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List cities with stats"""
    cities = []
    
    for city in City:
        # Count events in city
        event_count = db.query(Event).filter(
            Event.city == city,
            Event.status == EventStatus.APPROVED
        ).count()
        
        # Count venues in city
        venue_count = db.query(Venue).filter(Venue.city == city).count()
        
        # Count users who prefer this city
        user_count = db.query(User).filter(User.preferred_city == city).count()
        
        cities.append({
            "city": city.value,
            "total_events": event_count,
            "total_venues": venue_count,
            "total_users": user_count,
            "image_url": None  # Would be stored in a city config table
        })
    
    return cities


@router.post("/cities/{city}/images")
def update_city_images(
    city: str,
    images: CityImagesUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update city images"""
    try:
        city_enum = City(city.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid city: {city}"
        )
    
    return {
        "message": f"Images updated for {city}",
        "city": city,
        "image_url": images.image_url,
        "cover_image_url": images.cover_image_url
    }


# ==================== ADMIN MANAGEMENT ====================

import enum
from auth import require_super_admin, get_REDACTED_PLACEHOLDER_hash as get_password_hash


class AdminRole(str, enum.Enum):
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class CreateAdminRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: AdminRole = AdminRole.ADMIN


class UpdateAdminRequest(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[AdminRole] = None
    status: Optional[UserStatus] = None


class AdminResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: str
    status: str
    is_verified: bool
    admin_role_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AdminRoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str]


class AdminRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class AdminRoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str]
    is_system: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_count: int = 0
    
    class Config:
        from_attributes = True


@router.get("/admins", response_model=List[AdminResponse])
def list_admins(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all admin users (Super Admin and Admin roles)"""
    admins = db.query(User).filter(
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    ).order_by(desc(User.created_at)).all()
    
    return admins


@router.post("/admins", response_model=AdminResponse)
def create_admin(
    admin_data: CreateAdminRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Create a new admin user (Super Admin only)"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == admin_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new admin user
    new_admin = User(
        email=admin_data.email,
        password_hash=get_password_hash(admin_data.password),
        first_name=admin_data.first_name,
        last_name=admin_data.last_name,
        phone=admin_data.phone,
        role=UserRole.SUPER_ADMIN if admin_data.role == AdminRole.SUPER_ADMIN else UserRole.ADMIN,
        status=UserStatus.ACTIVE,
        is_verified=True
    )
    
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    
    return new_admin


@router.get("/admins/{admin_id}", response_model=AdminResponse)
def get_admin(
    admin_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get admin user details"""
    admin = db.query(User).filter(
        User.id == admin_id,
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    return admin


@router.put("/admins/{admin_id}", response_model=AdminResponse)
def update_admin(
    admin_id: int,
    admin_data: UpdateAdminRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Update admin user (Super Admin only)"""
    admin = db.query(User).filter(
        User.id == admin_id,
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    # Prevent demoting the last super admin
    if admin.role == UserRole.SUPER_ADMIN and admin_data.role == AdminRole.ADMIN:
        super_admin_count = db.query(User).filter(User.role == UserRole.SUPER_ADMIN).count()
        if super_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last Super Admin"
            )
    
    # Prevent self-demotion from super admin
    if admin.id == current_user.id and admin_data.role == AdminRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot demote yourself from Super Admin"
        )
    
    if admin_data.email is not None:
        # Check if new email is already taken by another user
        existing = db.query(User).filter(
            User.email == admin_data.email,
            User.id != admin_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        admin.email = admin_data.email
    
    if admin_data.first_name is not None:
        admin.first_name = admin_data.first_name
    if admin_data.last_name is not None:
        admin.last_name = admin_data.last_name
    if admin_data.phone is not None:
        admin.phone = admin_data.phone
    if admin_data.role is not None:
        admin.role = UserRole.SUPER_ADMIN if admin_data.role == AdminRole.SUPER_ADMIN else UserRole.ADMIN
    if admin_data.status is not None:
        admin.status = admin_data.status
    
    db.commit()
    db.refresh(admin)
    
    return admin


@router.delete("/admins/{admin_id}")
def delete_admin(
    admin_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Delete admin user (Super Admin only)"""
    admin = db.query(User).filter(
        User.id == admin_id,
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    # Prevent deleting yourself
    if admin.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Prevent deleting the last super admin
    if admin.role == UserRole.SUPER_ADMIN:
        super_admin_count = db.query(User).filter(User.role == UserRole.SUPER_ADMIN).count()
        if super_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last Super Admin"
            )
    
    db.delete(admin)
    db.commit()
    
    return {"message": "Admin deleted successfully"}


@router.post("/admins/{admin_id}/reset-password")
def reset_admin_password(
    admin_id: int,
    new_password: str = Body(..., min_length=8),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Reset admin password (Super Admin only)"""
    admin = db.query(User).filter(
        User.id == admin_id,
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    ).first()
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    admin.password_hash = get_password_hash(new_password)
    db.commit()
    
    return {"message": "Password reset successfully"}


# All available admin permission keys
ALL_ADMIN_PERMISSIONS = [
    "dashboard",
    "analytics_read",
    "users_read",
    "events_read",
    "financials_read",
    "subscriptions_read",
    "content_read",
    "marketing_read",
    "support_read",
    "verifications_read",
    "settings_read",
    "admins_write",
]


@router.get("/admins/me/permissions")
def get_admin_permissions(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get current admin permissions from database"""
    is_super = current_user.role == UserRole.SUPER_ADMIN
    
    if is_super:
        perms = ALL_ADMIN_PERMISSIONS.copy()
    elif current_user.role == UserRole.ADMIN and current_user.admin_role_id is None:
        perms = ALL_ADMIN_PERMISSIONS.copy()
    elif current_user.admin_role:
        perms = current_user.admin_role.permissions or []
    else:
        perms = []
    
    return {
        "role": current_user.role.value,
        "is_super_admin": is_super,
        "permissions": perms,
        "admin_role_id": current_user.admin_role_id,
        "admin_role_name": current_user.admin_role.name if current_user.admin_role else None,
    }


# ==================== MISSING ENDPOINTS ADDED ====================

@router.post("/users/{user_id}/verify")
def verify_user(
    user_id: int,
    verify_data: Optional[dict] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Verify or toggle user account verification"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    verified = True
    if verify_data and "verified" in verify_data:
        verified = bool(verify_data["verified"])
    
    # Mark user as verified or unverified
    user.is_verified = verified
    user.verification_badge = verified
    
    # Also update their business/artist/vendor profile if exists
    if user.organizer_profile:
        user.organizer_profile.is_verified = verified
    if user.artist_profile:
        user.artist_profile.is_verified = verified
    if user.business_profile:
        user.business_profile.is_verified = verified
    
    vendor_prof = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
    if vendor_prof:
        vendor_prof.is_verified = verified
    
    db.commit()
    
    action_text = "verified" if verified else "unverified"
    return {"message": f"User {action_text} successfully", "user_id": user_id, "is_verified": verified}


@router.post("/users/{user_id}/unverify")
def unverify_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unverify user account (removes verification badge)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_verified = False
    user.verification_badge = False
    
    if user.organizer_profile:
        user.organizer_profile.is_verified = False
    if user.artist_profile:
        user.artist_profile.is_verified = False
    if user.business_profile:
        user.business_profile.is_verified = False
    vendor_prof = db.query(VendorProfile).filter(VendorProfile.user_id == user.id).first()
    if vendor_prof:
        vendor_prof.is_verified = False
    
    db.commit()
    
    return {"message": "User unverified successfully"}
    
    # Also unverify their profiles
    if user.organizer_profile:
        user.organizer_profile.is_verified = False
    if user.artist_profile:
        user.artist_profile.is_verified = False
    if user.business_profile:
        user.business_profile.is_verified = False
    if user.vendor_profile:
        user.vendor_profile.is_verified = False
    
    db.commit()
    
    return {"message": "User unverified successfully", "user_id": user_id}


@router.post("/users/{user_id}/freeze")
def freeze_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Freeze/suspend user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.status = UserStatus.SUSPENDED
    db.commit()
    
    return {"message": "User frozen successfully", "user_id": user_id}


@router.post("/users/{user_id}/unfreeze")
def unfreeze_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Unfreeze/reactivate user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.status = UserStatus.ACTIVE
    db.commit()
    
    return {"message": "User unfrozen successfully", "user_id": user_id}


@router.post("/users/{user_id}/activate")
def activate_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Activate/reactivate user account"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.status = UserStatus.ACTIVE
    db.commit()
    
    return {"message": "User activated successfully"}


@router.post("/users/{user_id}/approve-subscription")
def approve_user_subscription(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve pending subscription for a user and grant verified badge"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    pending_sub = db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status == SubscriptionStatus.PENDING
    ).order_by(desc(Subscription.created_at)).first()
    
    if not pending_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no pending subscription"
        )
    
    # Activate the subscription
    try:
        SubscriptionService.activate_subscription(
            db=db,
            subscription_id=pending_sub.id,
            admin_id=current_user.id,
            notes="Approved via user management"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Ensure user is active (verification is handled by activate_subscription based on plan)
    user.status = UserStatus.ACTIVE
    db.commit()
    
    return {
        "message": "Subscription approved. User is now active.",
        "user_id": user_id,
        "subscription_id": pending_sub.id
    }


@router.post("/users/invite")
def invite_user(
    invite_data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Invite a new user by email"""
    # Check if user already exists
    existing = db.query(User).filter(User.email == invite_data.get('email')).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Create new user with pending status
    role_str = invite_data.get('role', 'user')
    try:
        user_role = UserRole(role_str.upper())
    except ValueError:
        user_role = UserRole.USER
    
    new_user = User(
        email=invite_data.get('email'),
        first_name=invite_data.get('first_name', ''),
        last_name=invite_data.get('last_name', ''),
        role=user_role,
        status=UserStatus.ACTIVE,
        is_verified=False
    )
    
    db.add(new_user)
    db.commit()
    
    return {"message": f"Invitation sent to {invite_data.get('email')}", "user_id": new_user.id}


@router.post("/broadcast")
def broadcast_message(
    broadcast_data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Send broadcast message to all users via email"""
    subject = broadcast_data.get('subject', 'Message from Sound It')
    message = broadcast_data.get('message', '')
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required"
        )
    
    # Get all active users with email addresses
    users = db.query(User).filter(
        User.status == UserStatus.ACTIVE,
        User.email.isnot(None)
    ).all()
    
    # Import email service
    from email_service import send_email
    
    # Build HTML body from plain text message
    html_body = f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#141414;border-radius:16px;overflow:hidden;">
<div style="background:#d3da0c;padding:32px;text-align:center;"><h1 style="margin:0;color:#000;font-size:24px;">Sound It</h1></div>
<div style="padding:32px;line-height:1.6;">
<p style="margin:0 0 16px;white-space:pre-wrap;">{message}</p>
</div>
<div style="padding:24px 32px;text-align:center;color:#666;font-size:12px;border-top:1px solid #222;">
<p>Sound It China, Your Nightlife Connection</p>
</div>
</div></body></html>"""
    
    # Send email to each user
    sent_count = 0
    failed_count = 0
    
    for user in users:
        if user.email and '@' in user.email:
            success = send_email(
                to_email=user.email,
                subject=subject,
                body=message,
                html_body=html_body
            )
            if success:
                sent_count += 1
            else:
                failed_count += 1
    
    return {
        "message": "Broadcast processed",
        "total_recipients": len(users),
        "sent": sent_count,
        "failed": failed_count,
        "from_email": "support@sounditent.com"
    }


# ==================== VENDOR MANAGEMENT ====================

from models import VendorProfile, Product, VendorFollow, ProductOrder, TicketOrderStatus

class VendorResponse(BaseModel):
    id: int
    business_name: str
    description: Optional[str] = None
    vendor_type: Optional[str] = None
    category: Optional[str] = None  # alias for vendor_type (frontend compatibility)
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    rating: float = 0.0
    reviews_count: int = 0
    user_id: int
    user_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    slug: Optional[str] = None
    is_verified: bool = False
    is_approved: bool = False
    is_featured: bool = False
    status: str = "active"
    verification_badge: bool = False
    products_count: int = 0
    total_sales: float = 0.0
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class VendorUpdate(BaseModel):
    business_name: Optional[str] = None
    description: Optional[str] = None
    vendor_type: Optional[str] = None


@router.get("/vendors", response_model=List[VendorResponse])
def list_vendors(
    vendor_type: Optional[str] = None,
    verified: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all vendors"""
    query = db.query(VendorProfile).join(User).filter(
        ~User.email.like("deleted_%@deleted.local")
    )
    
    if vendor_type:
        query = query.filter(VendorProfile.vendor_type == vendor_type)
    if verified is not None:
        query = query.filter(VendorProfile.is_verified == verified)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (VendorProfile.business_name.ilike(search_filter)) |
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter))
        )
    
    vendors = query.order_by(desc(VendorProfile.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for vendor in vendors:
        # Compute products count
        products_count = db.query(Product).filter(Product.vendor_id == vendor.id).count()
        
        # Compute total sales from approved/used product orders
        total_sales = db.query(func.sum(ProductOrder.payment_amount)).join(Product).filter(
            Product.vendor_id == vendor.id,
            ProductOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])
        ).scalar() or 0
        
        vendor_city = vendor.city.value if hasattr(vendor.city, 'value') else vendor.city
        pref_city = vendor.user.preferred_city.value if vendor.user and hasattr(vendor.user.preferred_city, 'value') else (vendor.user.preferred_city if vendor.user else None)
        result.append({
            "id": vendor.id,
            "business_name": vendor.business_name,
            "description": vendor.description,
            "vendor_type": vendor.vendor_type,
            "category": vendor.vendor_type,
            "logo_url": vendor.logo_url,
            "banner_url": vendor.banner_url,
            "rating": vendor.rating or 0.0,
            "reviews_count": vendor.reviews_count or 0,
            "user_id": vendor.user_id,
            "user_name": f"{vendor.user.first_name or ''} {vendor.user.last_name or ''}".strip() if vendor.user else None,
            "email": getattr(vendor, 'email', None) or (vendor.user.email if vendor.user else None),
            "phone": getattr(vendor, 'phone', None) or getattr(vendor, 'contact_phone', None) or (vendor.user.phone if vendor.user else None),
            "city": vendor_city or pref_city,
            "slug": getattr(vendor, 'slug', None),
            "is_verified": vendor.is_verified or False,
            "is_approved": vendor.is_approved or False,
            "is_featured": getattr(vendor, 'is_featured', False),
            "status": vendor.user.status.value if vendor.user and vendor.user.status else "active",
            "verification_badge": vendor.user.verification_badge if vendor.user else False,
            "products_count": products_count,
            "total_sales": float(total_sales),
            "created_at": vendor.created_at
        })
    
    return result


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get vendor details"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Compute products count
    products_count = db.query(Product).filter(Product.vendor_id == vendor.id).count()
    
    # Compute total sales
    total_sales = db.query(func.coalesce(func.sum(ProductOrder.payment_amount), 0)).join(Product).filter(
        Product.vendor_id == vendor.id,
        ProductOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])
    ).scalar() or 0.0
    
    vendor_city = vendor.city.value if hasattr(vendor.city, 'value') else vendor.city
    pref_city = vendor.user.preferred_city.value if vendor.user and hasattr(vendor.user.preferred_city, 'value') else (vendor.user.preferred_city if vendor.user else None)
    
    return {
        "id": vendor.id,
        "business_name": vendor.business_name,
        "description": vendor.description,
        "vendor_type": vendor.vendor_type,
        "category": vendor.vendor_type,
        "logo_url": vendor.logo_url,
        "banner_url": vendor.banner_url,
        "rating": vendor.rating or 0.0,
        "reviews_count": vendor.reviews_count or 0,
        "user_id": vendor.user_id,
        "user_name": f"{vendor.user.first_name or ''} {vendor.user.last_name or ''}".strip() if vendor.user else None,
        "email": getattr(vendor, 'email', None) or (vendor.user.email if vendor.user else None),
        "phone": getattr(vendor, 'phone', None) or getattr(vendor, 'contact_phone', None) or (vendor.user.phone if vendor.user else None),
        "city": vendor_city or pref_city,
        "slug": getattr(vendor, 'slug', None),
        "is_verified": vendor.is_verified or False,
        "is_approved": vendor.is_approved or False,
        "is_featured": getattr(vendor, 'is_featured', False),
        "status": vendor.user.status.value if vendor.user and vendor.user.status else "active",
        "verification_badge": vendor.user.verification_badge if vendor.user else False,
        "products_count": products_count,
        "total_sales": float(total_sales),
        "created_at": vendor.created_at
    }


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor_data: VendorUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Edit vendor profile"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    if vendor_data.business_name is not None:
        vendor.business_name = vendor_data.business_name
    if vendor_data.description is not None:
        vendor.description = vendor_data.description
    if vendor_data.vendor_type is not None:
        vendor.vendor_type = vendor_data.vendor_type
    
    db.commit()
    db.refresh(vendor)
    
    # Compute products count
    products_count = db.query(Product).filter(Product.vendor_id == vendor.id).count()
    
    # Compute total sales
    total_sales = db.query(func.coalesce(func.sum(ProductOrder.payment_amount), 0)).join(Product).filter(
        Product.vendor_id == vendor.id,
        ProductOrder.status.in_([TicketOrderStatus.APPROVED, TicketOrderStatus.USED])
    ).scalar() or 0.0
    
    return {
        "id": vendor.id,
        "business_name": vendor.business_name,
        "description": vendor.description,
        "vendor_type": vendor.vendor_type,
        "category": vendor.vendor_type,
        "logo_url": vendor.logo_url,
        "banner_url": vendor.banner_url,
        "rating": vendor.rating or 0.0,
        "reviews_count": vendor.reviews_count or 0,
        "user_id": vendor.user_id,
        "user_name": f"{vendor.user.first_name or ''} {vendor.user.last_name or ''}".strip() if vendor.user else None,
        "is_verified": vendor.is_verified or False,
        "is_featured": getattr(vendor, 'is_featured', False),
        "status": vendor.user.status.value if vendor.user and vendor.user.status else "active",
        "verification_badge": vendor.user.verification_badge if vendor.user else False,
        "products_count": products_count,
        "total_sales": float(total_sales),
        "created_at": vendor.created_at
    }


@router.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete vendor account"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Delete related records in correct order (respecting FK constraints)
    # ProductOrders reference Products, so delete them first
    products = db.query(Product).filter(Product.vendor_id == vendor.id).all()
    for product in products:
        db.query(ProductOrder).filter(ProductOrder.product_id == product.id).delete()
        db.delete(product)
    
    db.query(VendorFollow).filter(VendorFollow.vendor_id == vendor.id).delete()
    
    db.delete(vendor)
    db.commit()
    
    return {"message": "Vendor deleted successfully"}


@router.post("/vendors/{vendor_id}/verify")
def verify_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Verify vendor (marks vendor as verified)"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Mark the vendor as verified
    vendor.is_verified = True
    
    # Also verify their user account if exists
    if vendor.user:
        vendor.user.is_verified = True
        vendor.user.verification_badge = True
    
    db.commit()
    
    return {"message": "Vendor verified successfully", "vendor_id": vendor_id}


@router.post("/vendors/{vendor_id}/unverify")
def unverify_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unverify vendor (removes verification badge)"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    vendor.is_verified = False
    if vendor.user:
        vendor.user.is_verified = False
        vendor.user.verification_badge = False
    db.commit()
    
    return {"message": "Vendor unverified successfully"}


@router.post("/vendors/{vendor_id}/approve")
def approve_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve vendor account (allows them to operate on the platform)"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    vendor.is_approved = True
    db.commit()
    
    # Send vendor welcome email after approval
    try:
        if vendor.user_id:
            user = db.query(User).filter(User.id == vendor.user_id).first()
            if user and user.email:
                send_vendor_welcome_email(
                    to_email=user.email,
                    first_name=user.first_name or ""
                )
    except Exception:
        pass
    
    return {"message": "Vendor approved successfully", "is_approved": True}


@router.post("/vendors/{vendor_id}/unapprove")
def unapprove_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unapprove vendor account"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    vendor.is_approved = False
    db.commit()
    
    return {"message": "Vendor unapproved successfully", "is_approved": False}


@router.post("/vendors/{vendor_id}/feature")
def feature_vendor(
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Toggle featured status for vendor"""
    vendor = _get_vendor_profile(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Toggle featured status
    vendor.is_featured = not getattr(vendor, 'is_featured', False)
    db.commit()
    
    return {
        "message": f"Vendor {'featured' if vendor.is_featured else 'unfeatured'} successfully",
        "vendor_id": vendor_id,
        "is_featured": vendor.is_featured
    }


@router.post("/artists/{artist_id}/feature")
def feature_artist(
    artist_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Toggle featured status for artist"""
    artist = _get_artist_profile(db, artist_id)
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    # Toggle featured status
    artist.is_featured = not getattr(artist, 'is_featured', False)
    db.commit()
    
    return {
        "message": f"Artist {'featured' if artist.is_featured else 'unfeatured'} successfully",
        "artist_id": artist_id,
        "is_featured": artist.is_featured
    }


@router.post("/businesses/{business_id}/feature")
def feature_business(
    business_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Toggle featured status for business/organizer"""
    business, _ = _get_business_profile(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    # Toggle featured status
    business.is_featured = not getattr(business, 'is_featured', False)
    db.commit()
    
    return {
        "message": f"Business {'featured' if business.is_featured else 'unfeatured'} successfully",
        "business_id": business_id,
        "is_featured": business.is_featured
    }


@router.get("/featured")
def get_all_featured(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all featured businesses, artists, and vendors"""
    featured_artists = db.query(ArtistProfile).filter(
        ArtistProfile.is_featured == True
    ).all()
    
    featured_businesses = db.query(OrganizerProfile).filter(
        OrganizerProfile.is_featured == True
    ).all()
    
    featured_vendors = db.query(VendorProfile).filter(
        VendorProfile.is_featured == True
    ).all()
    
    return {
        "artists": [{"id": a.id, "name": a.stage_name or "Unknown"} for a in featured_artists],
        "businesses": [{"id": b.id, "name": b.organization_name or "Unknown"} for b in featured_businesses],
        "vendors": [{"id": v.id, "name": v.business_name or "Unknown"} for v in featured_vendors]
    }


# ==================== BOOKING MANAGEMENT ====================

from models import BookingRequest, BookingStatus, BookingMessage

class BookingAdminResponse(BaseModel):
    id: int
    artist_id: int
    artist_name: str
    requester_id: int
    requester_name: str
    event_name: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[datetime] = None
    event_city: Optional[str] = None
    budget: Optional[float] = None
    duration_hours: Optional[float] = None
    status: str
    agreed_price: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class BookingStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


@router.get("/bookings", response_model=List[BookingAdminResponse])
def list_bookings(
    status: Optional[str] = None,
    artist_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all booking requests"""
    query = db.query(BookingRequest)
    
    if status:
        try:
            booking_status = BookingStatus(status.upper())
            query = query.filter(BookingRequest.status == booking_status)
        except ValueError:
            pass
    if artist_id:
        query = query.filter(BookingRequest.artist_id == artist_id)
    if date_from:
        query = query.filter(BookingRequest.event_date >= date_from)
    if date_to:
        query = query.filter(BookingRequest.event_date <= date_to)
    
    bookings = query.order_by(desc(BookingRequest.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for booking in bookings:
        result.append({
            "id": booking.id,
            "artist_id": booking.artist_id,
            "artist_name": booking.artist.stage_name if booking.artist else "Unknown",
            "requester_id": booking.requester_id,
            "requester_name": f"{booking.requester.first_name or ''} {booking.requester.last_name or ''}".strip() if booking.requester else "Unknown",
            "event_name": booking.event_name,
            "event_type": booking.event_type,
            "event_date": booking.event_date,
            "event_city": booking.event_city,
            "budget": booking.budget,
            "duration_hours": booking.duration_hours,
            "status": booking.status.value,
            "agreed_price": booking.agreed_price,
            "created_at": booking.created_at,
            "updated_at": booking.updated_at
        })
    
    return result


@router.get("/bookings/{booking_id}", response_model=BookingAdminResponse)
def get_booking(
    booking_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get booking details"""
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    return {
        "id": booking.id,
        "artist_id": booking.artist_id,
        "artist_name": booking.artist.stage_name if booking.artist else "Unknown",
        "requester_id": booking.requester_id,
        "requester_name": f"{booking.requester.first_name or ''} {booking.requester.last_name or ''}".strip() if booking.requester else "Unknown",
        "event_name": booking.event_name,
        "event_type": booking.event_type,
        "event_date": booking.event_date,
        "event_city": booking.event_city,
        "budget": booking.budget,
        "duration_hours": booking.duration_hours,
        "status": booking.status.value,
        "agreed_price": booking.agreed_price,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at
    }


@router.put("/bookings/{booking_id}/status")
def update_booking_status(
    booking_id: int,
    status_update: BookingStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update booking status (admin override)"""
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    try:
        new_status = BookingStatus(status_update.status.upper())
        booking.status = new_status
        db.commit()
        
        return {
            "message": "Booking status updated",
            "booking_id": booking_id,
            "new_status": new_status.value,
            "reason": status_update.reason
        }
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {[s.value for s in BookingStatus]}"
        )


@router.get("/bookings/{booking_id}/messages")
def get_booking_messages(
    booking_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all messages for a booking"""
    messages = db.query(BookingMessage).filter(
        BookingMessage.booking_id == booking_id
    ).order_by(BookingMessage.created_at).all()
    
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": f"{m.sender.first_name or ''} {m.sender.last_name or ''}".strip() if m.sender else "Unknown",
            "message": m.message,
            "is_read": m.is_read,
            "created_at": m.created_at
        }
        for m in messages
    ]


# ==================== ANALYTICS & REPORTS ====================

class AnalyticsResponse(BaseModel):
    total_revenue: float
    total_orders: int
    total_users: int
    total_events: int
    revenue_by_month: List[dict]
    user_growth: List[dict]
    event_stats: List[dict]
    top_events: List[dict]
    top_artists: List[dict]


@router.get("/analytics")
def get_analytics(
    period: str = "30d",  # 7d, 30d, 90d, 1y
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get platform analytics"""
    from datetime import timedelta
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "7d":
        start_date = now - timedelta(days=7)
    elif period == "30d":
        start_date = now - timedelta(days=30)
    elif period == "90d":
        start_date = now - timedelta(days=90)
    elif period == "1y":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Total revenue in period across all income sources
    ticket_rev = db.query(func.coalesce(func.sum(TicketOrder.payment_amount), 0)).filter(
        TicketOrder.status == TicketOrderStatus.APPROVED,
        TicketOrder.created_at >= start_date
    ).scalar() or 0.0
    table_rev = db.query(func.coalesce(func.sum(TableOrder.payment_amount), 0)).filter(
        TableOrder.status == TableOrderStatus.APPROVED,
        TableOrder.created_at >= start_date
    ).scalar() or 0.0
    product_rev = db.query(func.coalesce(func.sum(ProductOrder.payment_amount), 0)).filter(
        ProductOrder.status == TicketOrderStatus.APPROVED,
        ProductOrder.created_at >= start_date
    ).scalar() or 0.0
    sub_rev = db.query(func.coalesce(func.sum(Subscription.price), 0)).filter(
        Subscription.status == SubscriptionStatus.ACTIVE,
        Subscription.created_at >= start_date
    ).scalar() or 0.0
    legacy_rev = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        Order.payment_status == PaymentStatus.COMPLETED,
        Order.created_at >= start_date
    ).scalar() or 0.0
    total_revenue = round(float(ticket_rev + table_rev + product_rev + sub_rev + legacy_rev), 2)
    
    # Total orders in period
    ticket_orders_cnt = db.query(TicketOrder).filter(TicketOrder.created_at >= start_date).count()
    table_orders_cnt = db.query(TableOrder).filter(TableOrder.created_at >= start_date).count()
    product_orders_cnt = db.query(ProductOrder).filter(ProductOrder.created_at >= start_date).count()
    sub_orders_cnt = db.query(Subscription).filter(Subscription.created_at >= start_date).count()
    legacy_orders_cnt = db.query(Order).filter(Order.created_at >= start_date).count()
    total_orders = ticket_orders_cnt + table_orders_cnt + product_orders_cnt + sub_orders_cnt + legacy_orders_cnt
    
    # New users in period
    total_users = db.query(User).filter(
        User.created_at >= start_date
    ).count()
    
    # New events in period
    total_events = db.query(Event).filter(
        Event.created_at >= start_date
    ).count()
    
    # Revenue by month (calculated in Python to ensure 100% compatibility with Postgres and SQLite)
    from collections import defaultdict
    monthly_rev = defaultdict(lambda: {"revenue": 0.0, "orders": 0})
    
    # Add ticket orders
    for to_date, to_amt in db.query(TicketOrder.created_at, TicketOrder.payment_amount).filter(
        TicketOrder.status == TicketOrderStatus.APPROVED,
        TicketOrder.created_at >= start_date
    ).all():
        if to_date:
            m = to_date.strftime("%Y-%m")
            monthly_rev[m]["revenue"] += float(to_amt or 0.0)
            monthly_rev[m]["orders"] += 1
            
    # Add table orders
    for tab_date, tab_amt in db.query(TableOrder.created_at, TableOrder.payment_amount).filter(
        TableOrder.status == TableOrderStatus.APPROVED,
        TableOrder.created_at >= start_date
    ).all():
        if tab_date:
            m = tab_date.strftime("%Y-%m")
            monthly_rev[m]["revenue"] += float(tab_amt or 0.0)
            monthly_rev[m]["orders"] += 1

    # Add legacy orders
    for o_date, o_amt in db.query(Order.created_at, Order.total_amount).filter(
        Order.payment_status == PaymentStatus.COMPLETED,
        Order.created_at >= start_date
    ).all():
        if o_date:
            m = o_date.strftime("%Y-%m")
            monthly_rev[m]["revenue"] += float(o_amt or 0.0)
            monthly_rev[m]["orders"] += 1
            
    revenue_by_month = [
        {"month": k, "revenue": round(v["revenue"], 2), "orders": v["orders"]}
        for k, v in sorted(monthly_rev.items())
    ]
    
    # User growth by month (calculated in Python)
    monthly_users = defaultdict(int)
    for u_date, in db.query(User.created_at).filter(User.created_at >= start_date).all():
        if u_date:
            m = u_date.strftime("%Y-%m")
            monthly_users[m] += 1
            
    user_growth = [
        {"month": k, "users": v}
        for k, v in sorted(monthly_users.items())
    ]
    
    # Top events by revenue
    top_events_data = db.query(
        Event.id,
        Event.title,
        func.coalesce(func.sum(TicketOrder.payment_amount), 0).label("revenue")
    ).join(
        TicketOrder,
        and_(
            Event.id == TicketOrder.event_id,
            TicketOrder.status == TicketOrderStatus.APPROVED
        )
    ).group_by(Event.id, Event.title).order_by(desc("revenue")).limit(5).all()
    
    top_events = [
        {
            "id": te.id,
            "title": te.title,
            "revenue": float(te.revenue)
        }
        for te in top_events_data
    ]
    
    # Top artists by bookings
    top_artists = db.query(
        ArtistProfile,
        func.count(BookingRequest.id).label('booking_count')
    ).outerjoin(BookingRequest).group_by(
        ArtistProfile.id
    ).order_by(desc('booking_count')).limit(5).all()
    
    return {
        "total_revenue": float(total_revenue),
        "total_orders": total_orders,
        "total_users": total_users,
        "total_events": total_events,
        "revenue_by_month": [
            {"month": r.month, "revenue": float(r.revenue), "orders": r.orders}
            for r in revenue_by_month
        ],
        "user_growth": [
            {"month": u.month, "users": u.users}
            for u in user_growth
        ],
        "top_events": [
            {
                "id": e.id,
                "title": e.title,
                "revenue": float(revenue) if revenue else 0
            }
            for e, revenue in top_events
        ],
        "top_artists": [
            {
                "id": a.id,
                "stage_name": a.stage_name,
                "bookings": count
            }
            for a, count in top_artists
        ]
    }


# ==================== EVENT VENDOR MANAGEMENT ====================

@router.get("/events/{event_id}/vendors", response_model=List[EventVendorResponse])
def get_event_vendors(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all vendors for an event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return db.query(EventVendor).options(
        joinedload(EventVendor.vendor).joinedload(VendorProfile.user)
    ).filter(EventVendor.event_id == event_id).all()


@router.post("/events/{event_id}/vendors/{vendor_id}/approve")
def approve_event_vendor(
    event_id: int,
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve vendor for event"""
    event_vendor = db.query(EventVendor).filter(
        EventVendor.event_id == event_id,
        EventVendor.vendor_id == vendor_id
    ).first()
    if not event_vendor:
        raise HTTPException(status_code=404, detail="Event vendor application not found")
    
    event_vendor.status = "approved"
    db.commit()
    
    return {"message": "Vendor approved for event"}


@router.post("/events/{event_id}/vendors/{vendor_id}/reject")
def reject_event_vendor(
    event_id: int,
    vendor_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject vendor for event"""
    event_vendor = db.query(EventVendor).filter(
        EventVendor.event_id == event_id,
        EventVendor.vendor_id == vendor_id
    ).first()
    if not event_vendor:
        raise HTTPException(status_code=404, detail="Event vendor application not found")
    
    event_vendor.status = "rejected"
    db.commit()
    
    return {"message": "Vendor rejected for event", "reason": reason}


@router.delete("/events/{event_id}/vendors/{vendor_id}")
def remove_event_vendor(
    event_id: int,
    vendor_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove vendor from event"""
    event_vendor = db.query(EventVendor).filter(
        EventVendor.event_id == event_id,
        EventVendor.vendor_id == vendor_id
    ).first()
    if not event_vendor:
        raise HTTPException(status_code=404, detail="Event vendor not found")
    
    db.delete(event_vendor)
    db.commit()
    
    return {"message": "Vendor removed from event"}





# ==================== COMMISSION & SYSTEM MANAGEMENT ====================

class CommissionRatesResponse(BaseModel):
    rates: dict  # city -> rate mapping


class SystemFlagsResponse(BaseModel):
    maintenanceMode: bool
    featuredEventLimit: int
    allowNewRegistrations: bool


class CommissionRateUpdate(BaseModel):
    rate: float


class SystemFlagUpdate(BaseModel):
    value: Union[bool, int, str]


@router.get("/commission-rates", response_model=CommissionRatesResponse)
def get_commission_rates(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get commission rates by city"""
    # For now, return default rates. In production, this would be stored in a config table
    rates = {}
    for city in City:
        rates[city.value] = 0.10  # 10% default commission

    return {"rates": rates}


@router.put("/commission-rates/{city}")
def update_commission_rate(
    city: str,
    rate_data: CommissionRateUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update commission rate for a city"""
    try:
        city_enum = City(city.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid city: {city}"
        )

    if rate_data.rate < 0 or rate_data.rate > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Commission rate must be between 0 and 1"
        )

    # In production, this would update a config table
    # For now, just return success
    return {
        "message": f"Commission rate updated for {city}",
        "city": city,
        "rate": rate_data.rate
    }


@router.get("/system-flags", response_model=SystemFlagsResponse)
def get_system_flags(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get system configuration flags"""
    # In production, this would be stored in a config table
    return {
        "maintenanceMode": False,
        "featuredEventLimit": 6,
        "allowNewRegistrations": True
    }


@router.put("/system-flags/maintenance")
def toggle_maintenance_mode(
    enabled: bool = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Toggle maintenance mode"""
    # In production, this would update a config table
    return {
        "message": f"Maintenance mode {'enabled' if enabled else 'disabled'}",
        "maintenanceMode": enabled
    }


@router.put("/system-flags/{flag}")
def update_system_flag(
    flag: str,
    flag_data: SystemFlagUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a system flag"""
    valid_flags = ["featuredEventLimit", "allowNewRegistrations"]

    if flag not in valid_flags:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid flag. Must be one of: {valid_flags}"
        )

    # In production, this would update a config table
    return {
        "message": f"System flag {flag} updated",
        "flag": flag,
        "value": flag_data.value
    }


# ==================== FEATURED EVENTS MANAGEMENT ====================

# ==================== DISABLED EVENTS MANAGEMENT ====================

class DisabledEventsResponse(BaseModel):
    events: List[int]  # List of disabled event IDs


@router.get("/disabled-events")
def get_disabled_events(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get list of disabled event IDs"""
    # In production, this would query disabled events
    return {"events": []}


@router.post("/disabled-events/{event_id}")
def disable_event(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Disable/hide event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    event.status = EventStatus.REJECTED
    db.commit()
    return {
        "message": "Event disabled successfully",
        "event_id": event_id,
        "status": event.status.value
    }


@router.delete("/disabled-events/{event_id}")
def enable_event(
    event_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Re-enable event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    event.status = EventStatus.APPROVED
    db.commit()
    return {
        "message": "Event re-enabled successfully",
        "event_id": event_id,
        "status": event.status.value
    }


# ==================== ESCROW & PAYOUT MANAGEMENT ====================

class EscrowStatsResponse(BaseModel):
    total_balance: float
    released_total: float
    pending_releases: int


@router.get("/escrow-stats", response_model=EscrowStatsResponse)
def get_escrow_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get escrow account statistics"""
    # In production, this would query escrow/payout tables
    return {
        "total_balance": 0.0,
        "released_total": 0.0,
        "pending_releases": 0
    }


def _serialize_payout_item(p, db: Session):
    requester = db.query(User).filter(User.id == p.user_id).first() if p.user_id else None
    biz_user = db.query(User).filter(User.id == (p.business_id or p.user_id)).first() if (p.business_id or p.user_id) else None
    
    biz_name = "Business Account"
    if biz_user:
        if biz_user.business_profile and biz_user.business_profile.business_name:
            biz_name = biz_user.business_profile.business_name
        elif biz_user.organizer_profile and biz_user.organizer_profile.organization_name:
            biz_name = biz_user.organizer_profile.organization_name
        elif biz_user.first_name:
            biz_name = f"{biz_user.first_name} {biz_user.last_name or ''}".strip()
        elif biz_user.email:
            biz_name = biz_user.email.split('@')[0]

    req_name = f"{requester.first_name or ''} {requester.last_name or ''}".strip() if requester else biz_name
    if not req_name:
        req_name = requester.username if requester else biz_name

    details = p.payment_details or {}
    account_str = (
        details.get("account_details")
        or details.get("bank_account")
        or details.get("account_number")
        or details.get("alipay_account")
        or details.get("wechat_id")
        or ""
    )
    payout_status = p.status.value if hasattr(p.status, "value") else str(p.status or "pending").lower()
    created_iso = p.requested_at.isoformat() if p.requested_at else None
    processed_iso = p.processed_at.isoformat() if p.processed_at else None

    return {
        "id": p.id,
        "user_id": p.user_id,
        "business_id": p.business_id or p.user_id,
        "user_name": req_name,
        "targetName": biz_name,
        "business": biz_name,
        "business_name": biz_name,
        "targetType": requester.role.value if (requester and hasattr(requester.role, "value")) else "business",
        "email": requester.email if requester else (biz_user.email if biz_user else ""),
        "amount": float(p.amount),
        "commission": 0.0,
        "currency": p.currency or "CNY",
        "status": payout_status,
        "payment_method": p.payment_method or "bank_transfer",
        "payment_details": details,
        "account_details": account_str,
        "bankAccount": account_str,
        "created_at": created_iso,
        "requested_at": created_iso,
        "processed_at": processed_iso,
        "rejection_reason": getattr(p, "rejection_reason", None),
        "admin_notes": getattr(p, "admin_notes", None),
        "transactionId": getattr(p, "transaction_reference", None),
        "transaction_reference": getattr(p, "transaction_reference", None),
        "eventName": "Payout Request",
        "city": ""
    }


@router.get("/payouts")
def get_payouts(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get payout requests"""
    payouts_q = db.query(PayoutRequest)
    if status and status.lower() != 'all':
        try:
            payout_status = PayoutStatus(status.lower())
            payouts_q = payouts_q.filter(PayoutRequest.status == payout_status)
        except ValueError:
            pass
    payouts = payouts_q.order_by(desc(PayoutRequest.requested_at)).all()
    
    escrow_balance = 0.0
    released_total = 0.0
    result = []
    for p in payouts:
        item = _serialize_payout_item(p, db)
        payout_status = item["status"]
        if payout_status in ["pending", "approved", "processing"]:
            escrow_balance += p.amount
        elif payout_status in ["released", "paid", "completed"]:
            released_total += p.amount
        result.append(item)
    
    return {
        "payouts": result,
        "escrow_balance": round(escrow_balance, 2),
        "released_total": round(released_total, 2)
    }


@router.post("/payouts/{payout_id}/approve")
def approve_payout(
    payout_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve payout request with eligible-balance & state-machine verification."""
    from services.financial_ledger import transition_payout_status
    try:
        payout = transition_payout_status(
            db,
            payout_id=payout_id,
            target_status="approved",
            admin_user=current_user,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        code = 404 if "not found" in str(e).lower() else 400
        raise HTTPException(status_code=code, detail=str(e))
    
    try:
        from api.notifications import create_notification
        create_notification(
            db=db,
            user_id=payout.user_id,
            title="Payout Request Approved",
            message=f"Your withdrawal request #{payout.id} for ¥{payout.amount:,.2f} has been approved by admin.",
            notification_type="payout_update",
            data={"entity_type": "payout", "payout_id": payout.id, "status": "approved", "url": "/dashboard/business/payouts"}
        )
    except Exception as e:
        logger.warning(f"Failed to send payout approval notification: {e}")

    try:
        from services.security_logger import log_security_event
        log_security_event("admin_payout_approved", user_id=current_user.id, email=current_user.email, details={"payout_id": payout_id, "amount": payout.amount})
    except Exception:
        pass
    
    return {
        "message": "Payout approved successfully",
        "payout_id": payout_id,
        "status": "approved"
    }


@router.post("/payouts/{payout_id}/process")
def process_payout(
    payout_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Process (approve) payout request"""
    return approve_payout(payout_id=payout_id, current_user=current_user, db=db)


class RejectPayoutBody(BaseModel):
    reason: Optional[str] = None


class ReleasePayoutBody(BaseModel):
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None


@router.post("/payouts/{payout_id}/reject")
def reject_payout(
    payout_id: int,
    payload: Optional[RejectPayoutBody] = Body(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject payout request and reverse locked funds back to provider withdrawable balance."""
    from services.financial_ledger import transition_payout_status
    reason_text = payload.reason if (payload and payload.reason) else "Request rejected by administrator"
    try:
        payout = transition_payout_status(
            db,
            payout_id=payout_id,
            target_status="rejected",
            admin_user=current_user,
            reason=reason_text,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        code = 404 if "not found" in str(e).lower() else 400
        raise HTTPException(status_code=code, detail=str(e))
    
    try:
        from api.notifications import create_notification
        create_notification(
            db=db,
            user_id=payout.user_id,
            title="Payout Request Rejected",
            message=f"Your withdrawal request #{payout.id} for ¥{payout.amount:,.2f} was rejected: {reason_text}",
            notification_type="payout_update",
            data={"entity_type": "payout", "payout_id": payout.id, "status": "rejected", "reason": reason_text, "url": "/dashboard/business/payouts"}
        )
    except Exception as e:
        logger.warning(f"Failed to send payout rejection notification: {e}")

    try:
        from services.security_logger import log_security_event
        log_security_event("admin_payout_rejected", user_id=current_user.id, email=current_user.email, details={"payout_id": payout_id, "amount": payout.amount, "reason": reason_text})
    except Exception:
        pass
    
    return {
        "message": "Payout rejected",
        "payout_id": payout_id,
        "reason": reason_text,
        "status": "rejected"
    }


@router.post("/payouts/{payout_id}/release")
def release_payout(
    payout_id: int,
    payload: Optional[ReleasePayoutBody] = Body(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Complete payout settlement: verifies eligible funds & posts immutable cash outflow ledger entry."""
    from services.financial_ledger import transition_payout_status
    try:
        payout = transition_payout_status(
            db,
            payout_id=payout_id,
            target_status="paid",
            admin_user=current_user,
            reason=payload.notes if payload else None,
            transaction_reference=payload.transaction_reference if payload else None,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        code = 404 if "not found" in str(e).lower() else 400
        raise HTTPException(status_code=code, detail=str(e))
    
    try:
        from api.notifications import create_notification
        create_notification(
            db=db,
            user_id=payout.user_id,
            title="Payout Completed",
            message=f"Your withdrawal request #{payout.id} for ¥{payout.amount:,.2f} has been processed and paid out.",
            notification_type="payout_update",
            data={"entity_type": "payout", "payout_id": payout.id, "status": "paid", "url": "/dashboard/business/payouts"}
        )
    except Exception:
        pass
    
    return {
        "message": "Funds released successfully",
        "payout_id": payout_id,
        "transaction_reference": payout.transaction_reference,
        "status": "paid"
    }


# ==================== WITHDRAWALS ====================

@router.get("/withdrawals")
def get_withdrawals(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get withdrawal requests for Admin Dashboard"""
    query = db.query(PayoutRequest)
    if status and status.lower() != 'all':
        try:
            status_enum = PayoutStatus(status.lower())
            query = query.filter(PayoutRequest.status == status_enum)
        except ValueError:
            pass
    
    payouts = query.order_by(desc(PayoutRequest.requested_at)).all()
    
    return {
        "withdrawals": [
            _serialize_payout_item(p, db)
            for p in payouts
        ]
    }


@router.post("/withdrawals/{withdrawal_id}/approve")
def approve_withdrawal(
    withdrawal_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve withdrawal request"""
    return approve_payout(payout_id=withdrawal_id, current_user=current_user, db=db)


@router.post("/withdrawals/{withdrawal_id}/reject")
def reject_withdrawal(
    withdrawal_id: int,
    payload: Optional[RejectPayoutBody] = Body(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject withdrawal request with reason"""
    return reject_payout(payout_id=withdrawal_id, payload=payload, current_user=current_user, db=db)


@router.get("/withdrawals/stats")
def get_withdrawal_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get withdrawal statistics matching both frontend interfaces"""
    total = db.query(PayoutRequest).count()
    pending_payouts = db.query(PayoutRequest).filter(
        PayoutRequest.status.in_([PayoutStatus.PENDING, PayoutStatus.PROCESSING])
    ).all()
    pending_count = len(pending_payouts)
    pending_amount = sum(float(p.amount) for p in pending_payouts)
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    processed_today = db.query(PayoutRequest).filter(
        PayoutRequest.processed_at >= today_start,
        PayoutRequest.status.in_([PayoutStatus.APPROVED, PayoutStatus.PAID])
    ).count()
    
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    payouts_30d = db.query(PayoutRequest).filter(
        PayoutRequest.processed_at >= thirty_days_ago,
        PayoutRequest.status.in_([PayoutStatus.APPROVED, PayoutStatus.PAID])
    ).all()
    total_processed_30d = sum(float(p.amount) for p in payouts_30d)
    
    approved = db.query(PayoutRequest).filter(PayoutRequest.status == PayoutStatus.APPROVED).count()
    rejected = db.query(PayoutRequest).filter(PayoutRequest.status == PayoutStatus.REJECTED).count()
    completed = db.query(PayoutRequest).filter(PayoutRequest.status == PayoutStatus.PAID).count()
    
    return {
        "pending_count": pending_count,
        "pending_amount": round(pending_amount, 2),
        "processed_today": processed_today,
        "total_processed_30d": round(total_processed_30d, 2),
        "total": total,
        "pending": pending_count,
        "approved": approved,
        "rejected": rejected,
        "completed": completed
    }


# ==================== SETTINGS & CONFIGURATION ====================

class CommissionRatesResponse(BaseModel):
    default_rate: float
    rates: dict


class CommissionRateUpdate(BaseModel):
    city: Optional[str] = None  # null for default
    rate: Optional[float] = None
    rates: Optional[dict] = None  # bulk update support


class SystemFlagsResponse(BaseModel):
    maintenance_mode: bool
    registration_enabled: bool
    payments_enabled: bool
    vendor_applications_open: bool
    event_creation_enabled: bool
    beta_features: bool
    featured_event_limit: int


@router.get("/settings/commissions", response_model=CommissionRatesResponse)
def get_commission_rates(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get commission rates by city"""
    # Get default rate (where city is None)
    default_rate_obj = db.query(CommissionRate).filter(CommissionRate.city == None).first()
    default_rate = default_rate_obj.rate if default_rate_obj else 0.10
    
    # Get all city-specific rates
    city_rates = db.query(CommissionRate).filter(CommissionRate.city != None).all()
    
    rates = {}
    for cr in city_rates:
        if cr.city:
            rates[cr.city.value] = cr.rate
    
    # Fill in missing cities with default rate
    for city in City:
        if city.value not in rates:
            rates[city.value] = default_rate
    
    return {
        "default_rate": default_rate,
        "rates": rates
    }


@router.put("/settings/commissions")
def update_commission_rate(
    rate_data: CommissionRateUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update commission rate for a city or default"""
    # Handle bulk update
    if rate_data.rates is not None:
        updated = []
        for city_name, rate in rate_data.rates.items():
            if rate < 0 or rate > 1:
                raise HTTPException(status_code=400, detail=f"Rate must be between 0 and 1 for {city_name}")
            
            city = None
            if city_name:
                try:
                    city = City(city_name.lower())
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid city: {city_name}")
            
            existing = db.query(CommissionRate).filter(CommissionRate.city == city).first()
            if existing:
                existing.rate = rate
                existing.updated_by_id = current_user.id
            else:
                new_rate = CommissionRate(city=city, rate=rate, updated_by_id=current_user.id)
                db.add(new_rate)
            updated.append({"city": city_name, "rate": rate})
        
        db.commit()
        return {"message": "Commission rates updated", "updated": updated}
    
    # Handle single update
    if rate_data.rate is None:
        raise HTTPException(status_code=400, detail="Rate is required")
    
    if rate_data.rate < 0 or rate_data.rate > 1:
        raise HTTPException(status_code=400, detail="Rate must be between 0 and 1")
    
    city = None
    if rate_data.city:
        try:
            city = City(rate_data.city.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid city")
    
    # Find existing rate
    existing = db.query(CommissionRate).filter(CommissionRate.city == city).first()
    
    if existing:
        existing.rate = rate_data.rate
        existing.updated_by_id = current_user.id
    else:
        new_rate = CommissionRate(
            city=city,
            rate=rate_data.rate,
            updated_by_id=current_user.id
        )
        db.add(new_rate)
    
    db.commit()
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update",
        entity_type="commission_rate",
        entity_id=None,
        details={"city": rate_data.city, "rate": rate_data.rate},
        db=db
    )
    
    return {"message": "Commission rate updated", "city": rate_data.city, "rate": rate_data.rate}


@router.get("/settings/flags", response_model=SystemFlagsResponse)
def get_system_flags(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get system feature flags from database"""
    flags = {}
    flag_keys = [
        "maintenance_mode",
        "registration_enabled",
        "payments_enabled",
        "vendor_applications_open",
        "event_creation_enabled",
        "beta_features",
        "featured_event_limit"
    ]
    
    for key in flag_keys:
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            if setting.value_type == "bool":
                flags[key] = setting.value.lower() == "true" if setting.value else False
            elif setting.value_type == "int":
                flags[key] = int(setting.value) if setting.value else 0
            else:
                flags[key] = setting.value == "true" if setting.value else False
        else:
            # Default values
            flags[key] = False if "maintenance" in key or "beta" in key else True
    
    return SystemFlagsResponse(**flags)


@router.put("/settings/flags")
def update_system_flags(
    flags: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update system feature flags"""
    for key, value in flags.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        
        if setting:
            setting.value = str(value).lower() if isinstance(value, bool) else str(value)
            setting.updated_by_id = current_user.id
        else:
            new_setting = SystemSetting(
                key=key,
                value=str(value).lower() if isinstance(value, bool) else str(value),
                value_type="bool" if isinstance(value, bool) else "string",
                description=f"System flag: {key}",
                category="system",
                is_editable=True,
                updated_by_id=current_user.id
            )
            db.add(new_setting)
    
    db.commit()
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update",
        entity_type="system_flags",
        entity_id=None,
        details=flags,
        db=db
    )
    
    return {"message": "System flags updated", "flags": flags}


# ─── Intro / Splash Screen Settings ───

INTRO_SCREEN_KEY = "intro_screen"
INTRO_SCREEN_DEFAULTS = {
    "enabled": True,
    "logo_url": "",  # empty = platform default /logo.png
    "title": "",
    "tagline": "YOUR GATEWAY TO ENTERTAINMENT IN CHINA.",
    "show_ad": False,
    "ad_image_url": "",
    "ad_title": "",
    "ad_link_url": "",
    "ad_badge": "Featured Partner",
    "duration_seconds": 2.8,
}


def read_intro_screen(db: Session) -> dict:
    """Read intro/splash screen settings (used by admin endpoint and the public system endpoint)."""
    import json as _json
    data = dict(INTRO_SCREEN_DEFAULTS)
    row = db.query(SystemSetting).filter(SystemSetting.key == INTRO_SCREEN_KEY).first()
    if row and row.value:
        try:
            stored = _json.loads(row.value)
            if isinstance(stored, dict):
                data.update({k: stored[k] for k in INTRO_SCREEN_DEFAULTS if k in stored})
                if str(data.get("tagline", "")).strip().lower() == "5 years of excellence in entertainment":
                    data["tagline"] = INTRO_SCREEN_DEFAULTS["tagline"]
        except Exception:
            pass

    # Check if there is an active Ad with position "intro_screen" in Ads Manager
    try:
        now = datetime.utcnow()
        active_intro_ad = db.query(Ad).filter(
            Ad.status == AdStatus.ACTIVE,
            Ad.position == AdPosition.INTRO_SCREEN
        ).filter(
            or_(Ad.start_date.is_(None), Ad.start_date <= now)
        ).filter(
            or_(Ad.end_date.is_(None), Ad.end_date >= now)
        ).order_by(desc(Ad.created_at)).first()

        if active_intro_ad:
            data["show_ad"] = True
            if active_intro_ad.image_url:
                data["ad_image_url"] = active_intro_ad.image_url
            if active_intro_ad.title:
                data["ad_title"] = active_intro_ad.title
            if active_intro_ad.link_url:
                data["ad_link_url"] = active_intro_ad.link_url
            data["ad_id"] = active_intro_ad.id
    except Exception:
        pass

    return data


class IntroScreenSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    logo_url: Optional[str] = None
    title: Optional[str] = None
    tagline: Optional[str] = None
    show_ad: Optional[bool] = None
    ad_image_url: Optional[str] = None
    ad_title: Optional[str] = None
    ad_link_url: Optional[str] = None
    ad_badge: Optional[str] = None
    duration_seconds: Optional[float] = None


@router.get("/intro-screen")
def get_intro_screen_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get intro/splash screen content settings."""
    return read_intro_screen(db)


@router.put("/intro-screen")
def update_intro_screen_settings(
    data: IntroScreenSettingsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update intro/splash screen content settings (logo, title, tagline, enabled)."""
    import json as _json
    current = read_intro_screen(db)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            current[key] = value

    row = db.query(SystemSetting).filter(SystemSetting.key == INTRO_SCREEN_KEY).first()
    if row:
        row.value = _json.dumps(current)
        row.updated_by_id = current_user.id
    else:
        db.add(SystemSetting(
            key=INTRO_SCREEN_KEY,
            value=_json.dumps(current),
            value_type="json",
            description="Intro/splash screen content (logo, title, tagline)",
            category="content",
            is_editable=True,
            updated_by_id=current_user.id
        ))
    db.commit()

    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update",
        entity_type="intro_screen",
        entity_id=None,
        details=current,
        db=db
    )
    return current


# ==================== ADS MANAGEMENT ====================

class AdResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    position: str
    status: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    impressions: int = 0
    clicks: int = 0
    budget: Optional[float] = None
    city: Optional[str] = None
    created_at: datetime


class AdCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    position: str = "homepage_sidebar"
    status: str = "paused"
    city: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None


class AdStatusUpdate(BaseModel):
    status: str


@router.get("/ads", response_model=List[AdResponse])
def get_ads(
    position: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all ads with optional filtering"""
    query = db.query(Ad)
    
    if position:
        try:
            ad_position = AdPosition(position)
            query = query.filter(Ad.position == ad_position)
        except ValueError:
            pass
    if status:
        try:
            ad_status = AdStatus(status)
            query = query.filter(Ad.status == ad_status)
        except ValueError:
            pass
    if city:
        try:
            city_enum = City(city.lower())
            query = query.filter(Ad.city == city_enum)
        except ValueError:
            pass
    
    ads = query.order_by(desc(Ad.created_at)).all()
    
    result = []
    for ad in ads:
        result.append({
            "id": ad.id,
            "title": ad.title,
            "description": ad.description,
            "image_url": ad.image_url,
            "link_url": ad.link_url,
            "position": ad.position.value if ad.position else "homepage_sidebar",
            "status": ad.status.value if ad.status else "paused",
            "city": ad.city.value if ad.city else None,
            "start_date": ad.start_date,
            "end_date": ad.end_date,
            "impressions": ad.impressions,
            "clicks": ad.clicks,
            "budget": ad.budget,
            "created_at": ad.created_at
        })
    
    return result


@router.post("/ads")
def create_ad(
    ad_data: AdCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new ad"""
    # Parse dates if provided
    start_date = None
    end_date = None
    if ad_data.start_date:
        try:
            start_date = datetime.fromisoformat(ad_data.start_date.replace('Z', '+00:00'))
        except:
            pass
    if ad_data.end_date:
        try:
            end_date = datetime.fromisoformat(ad_data.end_date.replace('Z', '+00:00'))
        except:
            pass
    
    # Parse position
    try:
        position = AdPosition(ad_data.position)
    except ValueError:
        position = AdPosition.HOMEPAGE_SIDEBAR
    
    # Parse status
    try:
        ad_status = AdStatus(ad_data.status)
    except ValueError:
        ad_status = AdStatus.PAUSED
    
    # Parse city
    city = None
    if ad_data.city:
        try:
            city = City(ad_data.city.lower())
        except ValueError:
            pass
    
    new_ad = Ad(
        title=ad_data.title,
        description=ad_data.description,
        image_url=ad_data.image_url,
        link_url=ad_data.link_url,
        position=position,
        status=ad_status,
        city=city,
        start_date=start_date,
        end_date=end_date,
        budget=ad_data.budget,
        impressions=0,
        clicks=0,
        created_by_id=current_user.id
    )
    
    db.add(new_ad)
    db.commit()
    db.refresh(new_ad)
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="create",
        entity_type="ad",
        entity_id=new_ad.id,
        details={"title": ad_data.title},
        db=db
    )
    
    return {"message": "Ad created successfully", "ad_id": new_ad.id}


@router.put("/ads/{ad_id}")
def update_ad(
    ad_id: int,
    ad_data: AdCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update an existing ad"""
    ad = db.query(Ad).filter(Ad.id == ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    ad.title = ad_data.title
    ad.description = ad_data.description
    ad.image_url = ad_data.image_url
    ad.link_url = ad_data.link_url
    ad.budget = ad_data.budget
    
    if ad_data.start_date:
        try:
            ad.start_date = datetime.fromisoformat(ad_data.start_date.replace('Z', '+00:00'))
        except:
            pass
    if ad_data.end_date:
        try:
            ad.end_date = datetime.fromisoformat(ad_data.end_date.replace('Z', '+00:00'))
        except:
            pass
    
    try:
        ad.position = AdPosition(ad_data.position)
    except ValueError:
        pass
    
    try:
        ad.status = AdStatus(ad_data.status)
    except ValueError:
        pass
    
    if ad_data.city:
        try:
            ad.city = City(ad_data.city.lower())
        except ValueError:
            pass
    
    db.commit()
    db.refresh(ad)
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update",
        entity_type="ad",
        entity_id=ad.id,
        details={"title": ad_data.title},
        db=db
    )
    
    return {"message": "Ad updated successfully", "ad_id": ad.id}


@router.delete("/ads/{ad_id}")
def delete_ad(
    ad_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete an ad"""
    ad = db.query(Ad).filter(Ad.id == ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    db.delete(ad)
    db.commit()
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="delete",
        entity_type="ad",
        entity_id=ad_id,
        details={"title": ad.title},
        db=db
    )
    
    return {"message": "Ad deleted successfully"}


@router.put("/ads/{ad_id}/status")
def update_ad_status(
    ad_id: int,
    status_data: AdStatusUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update ad status (active/paused)"""
    ad = db.query(Ad).filter(Ad.id == ad_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    try:
        ad.status = AdStatus(status_data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    db.commit()
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update_status",
        entity_type="ad",
        entity_id=ad_id,
        details={"status": status_data.status},
        db=db
    )
    
    return {"message": f"Ad {status_data.status}", "ad_id": ad_id}


# ==================== SECURITY & AUDIT ====================

class SecurityLogResponse(BaseModel):
    id: int
    event_type: str
    severity: str
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/security/logs", response_model=List[SecurityLogResponse])
def get_security_logs(
    days: int = 7,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get security audit logs"""
    from datetime import timedelta
    
    since = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(SecurityLog).filter(SecurityLog.created_at >= since)
    
    if event_type:
        query = query.filter(SecurityLog.event_type == event_type)
    if severity:
        query = query.filter(SecurityLog.severity == severity)
    
    logs = query.order_by(desc(SecurityLog.created_at)).limit(1000).all()
    return logs


@router.get("/security/stats")
def get_security_stats(
    days: int = 7,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get security statistics"""
    from datetime import timedelta
    
    since = datetime.utcnow() - timedelta(days=days)
    
    total_logs = db.query(SecurityLog).filter(SecurityLog.created_at >= since).count()
    
    failed_logins = db.query(SecurityLog).filter(
        SecurityLog.created_at >= since,
        SecurityLog.event_type == "failed_login"
    ).count()
    
    suspicious = db.query(SecurityLog).filter(
        SecurityLog.created_at >= since,
        SecurityLog.severity.in_(["warning", "error", "critical"])
    ).count()
    
    return {
        "total_logs_7d": total_logs,
        "failed_logins_7d": failed_logins,
        "suspicious_activities_7d": suspicious
    }


def log_security_event(
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
    """Log a security event"""
    log = SecurityLog(
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
    db.add(log)
    db.commit()


# ==================== NOTIFICATIONS ====================

@router.get("/notifications")
def get_admin_notifications(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get admin notifications"""
    notifications = db.query(Notification).filter(
        Notification.type.in_(["admin", "system", "broadcast"])
    ).order_by(Notification.created_at.desc()).limit(50).all()
    
    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": _display_type(n),
                "image_url": getattr(n, "image_url", None) or (n.data.get("image_url") if n.data and isinstance(n.data, dict) else None),
                "target_role": (n.data.get("target_role") if n.data and isinstance(n.data, dict) else "all"),
                "status": "sent",
                "is_read": n.is_read,
                "created_at": n.created_at
            }
            for n in notifications
        ]
    }


def _display_type(notification) -> str:
    """Derive the delivery channel(s) a notification was sent through for display."""
    channels = None
    if notification.data and isinstance(notification.data, dict):
        channels = notification.data.get("channels")
    if isinstance(channels, list) and channels:
        if "push" in channels and "email" in channels:
            return "both"
        return str(channels[0])
    # Legacy rows have no channels recorded - stored type is 'broadcast'
    return "push"


@router.post("/notifications/send")
def send_notification(
    notification: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Send notification to users via in-app + email (optional), with optional image attachment"""
    title = notification.get('title', '').strip()
    message = notification.get('message', '').strip()
    notif_type = notification.get('type', 'push')
    target_role = notification.get('target_role', 'all')
    image_url = notification.get('image_url', '').strip() if notification.get('image_url') else None
    if image_url:
        if image_url.startswith('/var/www/soundit-uploads/'):
            image_url = image_url.replace('/var/www/soundit-uploads/', '/static/uploads/')
        if image_url.startswith('/'):
            base = (settings.BASE_URL or "https://sounditent.com").rstrip('/')
            image_url = f"{base}{image_url}"
        elif image_url.startswith('http://sounditent.com') or image_url.startswith('http://sounditent.cn'):
            image_url = image_url.replace('http://', 'https://')

    if notif_type not in ('push', 'email', 'both'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid notification type '{notif_type}'. Supported: push, email, both"
        )
    if target_role not in ('all', 'user', 'business', 'artist', 'vendor', 'admin'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target_role '{target_role}'"
        )

    # Scheduling is not supported by the backend yet - reject instead of silently ignoring
    if notification.get('scheduled_at'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheduled notifications are not supported yet. Send now or remove the schedule."
        )

    channels = []
    if notif_type in ('push', 'both'):
        channels.append('push')
    if notif_type in ('email', 'both'):
        channels.append('email')

    if not title or not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title and message are required"
        )
    
    # Build user query based on target_role
    query = db.query(User).filter(User.status == UserStatus.ACTIVE)
    if target_role != 'all':
        role_map = {
            'user': UserRole.USER,
            'business': UserRole.BUSINESS,
            'artist': UserRole.ARTIST,
            'vendor': UserRole.VENDOR,
            'admin': UserRole.ADMIN,
        }
        if target_role in role_map:
            query = query.filter(User.role == role_map[target_role])
    
    users = query.all()
    
    # 1. Create in-app notifications + push delivery
    in_app_count = 0
    push_sent = 0
    if notif_type in ('push', 'both'):
        created = []
        for user in users:
            notif_data = {
                "target_role": target_role,
                "channels": channels,
            }
            if image_url:
                notif_data["image_url"] = image_url

            notif = Notification(
                user_id=user.id,
                title=title,
                message=message,
                type="broadcast",
                image_url=image_url,
                data=notif_data,
                entity_type="admin_broadcast",
                entity_id=current_user.id
            )
            db.add(notif)
            created.append(notif)
            in_app_count += 1
        db.commit()

        # Actually deliver web push (admin broadcasts bypass per-user prefs by design)
        from services.push_service import PushService
        import logging
        push_logger = logging.getLogger(__name__)
        push_service = PushService(db)
        for notif in created:
            try:
                if push_service.send_notification(notif):
                    push_sent += 1
            except Exception as e:
                push_logger.error(f"Admin broadcast push failed for user {notif.user_id}: {e}")
    
    # 2. Send emails
    email_sent = 0
    email_failed = 0
    if notif_type in ('email', 'both'):
        img_tag = f'<div style="text-align:center;margin:20px 0;"><img src="{image_url}" alt="" style="max-width:100%;height:auto;border-radius:12px;display:inline-block;border:1px solid #e4e4e7;" /></div>' if image_url else ""
        from email_service import _email_wrapper, is_deliverable_email
        html_body = _email_wrapper(
            title,
            f'''<h2 style="color:#111111;font-size:22px;font-weight:800;margin:0 0 16px;">{title}</h2>
{img_tag}
<p style="margin:0 0 16px;white-space:pre-wrap;color:#3f3f46;">{message}</p>
<p style="margin:0;color:#a1a1aa;font-size:12px;">You received this because you are subscribed to Sound It updates.</p>'''
        )
        for user in users:
            if user.email and is_deliverable_email(user.email):
                success = send_email(
                    to_email=user.email,
                    subject=title,
                    body=message,
                    html_body=html_body,
                    is_marketing=True,
                    unsubscribe_scope="all",
                )
                if success:
                    email_sent += 1
                else:
                    email_failed += 1
    
    # 3. Record in the admin history log (covers ALL channel types, incl. email-only)
    db.add(AdminNotificationLog(
        title=title,
        message=message,
        channels=channels,
        target_role=target_role,
        image_url=image_url,
        total_recipients=len(users),
        in_app_sent=in_app_count,
        push_sent=push_sent,
        email_sent=email_sent,
        email_failed=email_failed,
        sent_by_id=current_user.id
    ))
    db.commit()

    return {
        "message": "Notification sent successfully",
        "type": notif_type,
        "target_role": target_role,
        "image_url": image_url,
        "total_recipients": len(users),
        "in_app_sent": in_app_count,
        "push_sent": push_sent,
        "email_sent": email_sent,
        "email_failed": email_failed
    }


@router.get("/notifications/log")
def get_admin_notification_log(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin broadcast history from the dedicated log table (all channel types)."""
    logs = db.query(AdminNotificationLog).order_by(
        AdminNotificationLog.created_at.desc()
    ).limit(50).all()

    def _log_type(entry):
        ch = entry.channels or []
        if "push" in ch and "email" in ch:
            return "both"
        return ch[0] if ch else "push"

    return {
        "notifications": [
            {
                "id": entry.id,
                "source": "log",
                "title": entry.title,
                "message": entry.message,
                "type": _log_type(entry),
                "channels": entry.channels or [],
                "image_url": entry.image_url,
                "target_role": entry.target_role or "all",
                "status": "sent",
                "total_recipients": entry.total_recipients,
                "in_app_sent": entry.in_app_sent,
                "push_sent": entry.push_sent,
                "email_sent": entry.email_sent,
                "email_failed": entry.email_failed,
                "created_at": entry.created_at,
            }
            for entry in logs
        ]
    }



# ==================== CMS ====================

class CMSBannerResponse(BaseModel):
    id: int
    title: str
    subtitle: Optional[str] = None
    image_url: str
    link_url: Optional[str] = None
    page: str
    position: str
    sort_order: int
    is_active: bool
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class CMSBannerCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image_url: str
    link_url: Optional[str] = None
    page: str = "homepage"
    position: str = "hero"
    sort_order: int = 0
    is_active: bool = True


class CMSPageResponse(BaseModel):
    id: int
    slug: str
    title: str
    title_cn: Optional[str] = None
    is_published: bool
    published_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CMSPageDetailResponse(BaseModel):
    id: int
    slug: str
    title: str
    title_cn: Optional[str] = None
    content: Optional[str] = None
    content_cn: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    is_published: bool
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CMSPageCreate(BaseModel):
    slug: str
    title: str
    title_cn: Optional[str] = None
    content: Optional[str] = None
    content_cn: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    is_published: bool = False


@router.get("/cms/banners", response_model=List[CMSBannerResponse])
def get_cms_banners(
    page: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get CMS banners"""
    query = db.query(CMSBanner)
    if page:
        query = query.filter(CMSBanner.page == page)
    
    banners = query.order_by(CMSBanner.sort_order).all()
    return banners


@router.post("/cms/banners")
def create_cms_banner(
    banner_data: CMSBannerCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new CMS banner"""
    banner = CMSBanner(
        title=banner_data.title,
        subtitle=banner_data.subtitle,
        image_url=banner_data.image_url,
        link_url=banner_data.link_url,
        page=banner_data.page,
        position=banner_data.position,
        sort_order=banner_data.sort_order,
        is_active=banner_data.is_active
    )
    
    db.add(banner)
    db.commit()
    db.refresh(banner)
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="create",
        entity_type="cms_banner",
        entity_id=banner.id,
        details={"title": banner_data.title},
        db=db
    )
    
    return {"message": "Banner created successfully", "banner_id": banner.id}


@router.put("/cms/banners/{banner_id}")
def update_cms_banner(
    banner_id: int,
    banner_data: CMSBannerCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a CMS banner"""
    banner = db.query(CMSBanner).filter(CMSBanner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    banner.title = banner_data.title
    banner.subtitle = banner_data.subtitle
    banner.image_url = banner_data.image_url
    banner.link_url = banner_data.link_url
    banner.page = banner_data.page
    banner.position = banner_data.position
    banner.sort_order = banner_data.sort_order
    banner.is_active = banner_data.is_active
    
    db.commit()
    db.refresh(banner)
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update",
        entity_type="cms_banner",
        entity_id=banner.id,
        details={"title": banner_data.title},
        db=db
    )
    
    return {"message": "Banner updated successfully", "banner_id": banner.id}


@router.delete("/cms/banners/{banner_id}")
def delete_cms_banner(
    banner_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a CMS banner"""
    banner = db.query(CMSBanner).filter(CMSBanner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    db.delete(banner)
    db.commit()
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="delete",
        entity_type="cms_banner",
        entity_id=banner_id,
        details={"title": banner.title},
        db=db
    )
    
    return {"message": "Banner deleted successfully"}


@router.get("/cms/pages", response_model=List[CMSPageResponse])
def get_cms_pages(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get CMS pages"""
    pages = db.query(CMSPage).order_by(CMSPage.slug).all()
    return pages


@router.get("/cms/pages/{page_id}", response_model=CMSPageDetailResponse)
def get_cms_page(
    page_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get CMS page details"""
    page = db.query(CMSPage).filter(CMSPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.post("/cms/pages")
def create_cms_page(
    page_data: CMSPageCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new CMS page"""
    # Check if slug already exists
    existing = db.query(CMSPage).filter(CMSPage.slug == page_data.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Page with this slug already exists")
    
    page = CMSPage(
        slug=page_data.slug,
        title=page_data.title,
        title_cn=page_data.title_cn,
        content=page_data.content,
        content_cn=page_data.content_cn,
        meta_description=page_data.meta_description,
        meta_keywords=page_data.meta_keywords,
        is_published=page_data.is_published,
        created_by_id=current_user.id
    )
    
    if page_data.is_published:
        page.published_at = datetime.utcnow()
    
    db.add(page)
    db.commit()
    db.refresh(page)
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="create",
        entity_type="cms_page",
        entity_id=page.id,
        details={"slug": page_data.slug, "title": page_data.title},
        db=db
    )
    
    return {"message": "Page created successfully", "page_id": page.id}


@router.put("/cms/pages/{page_id}")
def update_cms_page(
    page_id: int,
    page_data: CMSPageCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a CMS page"""
    page = db.query(CMSPage).filter(CMSPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Check slug uniqueness if changed
    if page_data.slug != page.slug:
        existing = db.query(CMSPage).filter(CMSPage.slug == page_data.slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="Page with this slug already exists")
    
    page.slug = page_data.slug
    page.title = page_data.title
    page.title_cn = page_data.title_cn
    page.content = page_data.content
    page.content_cn = page_data.content_cn
    page.meta_description = page_data.meta_description
    page.meta_keywords = page_data.meta_keywords
    
    # Handle publish status change
    if page_data.is_published and not page.is_published:
        page.published_at = datetime.utcnow()
    page.is_published = page_data.is_published
    
    db.commit()
    db.refresh(page)
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="update",
        entity_type="cms_page",
        entity_id=page.id,
        details={"slug": page_data.slug, "title": page_data.title},
        db=db
    )
    
    return {"message": "Page updated successfully", "page_id": page.id}


@router.delete("/cms/pages/{page_id}")
def delete_cms_page(
    page_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a CMS page"""
    page = db.query(CMSPage).filter(CMSPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    db.delete(page)
    db.commit()
    
    # Log activity
    log_activity(
        user_id=current_user.id,
        user_name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip(),
        action="delete",
        entity_type="cms_page",
        entity_id=page_id,
        details={"slug": page.slug, "title": page.title},
        db=db
    )
    
    return {"message": "Page deleted successfully"}


# ==================== SYSTEM ====================

@router.post("/system/cache/reset")
def reset_system_cache(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reset system cache"""
    return {"message": "Cache cleared successfully"}


# ==================== FINANCIALS ====================

@router.get("/financials")
def get_financials(
    days: str = "all",
    currency: str = "CNY",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get reconciled Admin financial summary separating Sound It Yoopay volume,
    Direct QR volume (operational metric only), Subscription revenue, 4% Fee revenue,
    Payout liabilities, Platform cash, and channel-separated Refunds."""
    from services.financial_ledger import (
        get_admin_financial_overview,
        get_admin_subscription_report,
    )

    overview = get_admin_financial_overview(db, days=days, currency=currency.upper())
    sub_report = get_admin_subscription_report(db, currency=currency.upper())

    # Build separated revenue composition (ONLY actual platform revenue: Subscriptions + 4% Yoopay Fees)
    total_plat_rev = overview["total_platform_revenue"]
    revenue_by_category = []
    if overview["subscription_revenue"] > 0:
        revenue_by_category.append({
            "category": "Subscription Revenue",
            "amount": overview["subscription_revenue"],
            "percentage": round((overview["subscription_revenue"] / total_plat_rev) * 100, 1) if total_plat_rev > 0 else 0,
            "color": "#10b981",
        })
    if overview["transaction_fee_revenue"] > 0:
        revenue_by_category.append({
            "category": "Yoopay 4% Fee Revenue",
            "amount": overview["transaction_fee_revenue"],
            "percentage": round((overview["transaction_fee_revenue"] / total_plat_rev) * 100, 1) if total_plat_rev > 0 else 0,
            "color": "#d3da0c",
        })

    return {
        **overview,
        "subscription_report": sub_report,
        # Strictly corrected backwards-compatible aliases (never mix Direct QR into Sound It revenue!)
        "total_revenue": overview["total_platform_revenue"],
        "gross_ticket_sales": overview["platform_payment_volume"],
        "gross_lifetime_revenue": overview["lifetime_platform_revenue"],
        "platform_commission": overview["transaction_fee_revenue"],
        "total_commission": overview["transaction_fee_revenue"],
        "net_profit": overview["total_platform_revenue"],
        "net_platform_revenue": overview["total_platform_revenue"],
        "organizer_earnings": round(max(0.0, overview["platform_payment_volume"] - overview["transaction_fee_revenue"]), 2),
        "pending_payouts": overview["pending_payout_requests_amount"],
        "pending_payouts_count": overview["pending_payout_requests_count"],
        "total_payouts": overview["completed_payouts"],
        "refunded_amount": overview["refunds"]["total"],
        "total_transactions": overview["platform_payment_count"] + overview["direct_qr_transaction_count"] + overview["subscription_payments_count"],
        "failed_transactions": overview["audit_flags"]["failed_transactions"],
        "revenue_by_category": revenue_by_category,
        "event_commission_rate": 4,
        "artist_commission_rate": 4,
        "vendor_commission_rate": 4,
        "direct_qr_commission_rate": 0,
        "processing_fee_rate": 4.0,
    }


@router.get("/financials/export")
def export_financials(
    days: int = 30,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Export financial data as CSV"""
    from fastapi.responses import StreamingResponse
    import csv
    import io
    from datetime import timedelta

    since = datetime.utcnow() - timedelta(days=days)
    orders = db.query(Order).filter(Order.created_at >= since).order_by(desc(Order.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Order ID", "User", "Email", "Amount", "Status", "Payment Method", "Created At"])

    for order in orders:
        user = db.query(User).filter(User.id == order.user_id).first()
        writer.writerow([
            order.order_number or order.id,
            f"{user.first_name or ''} {user.last_name or ''}".strip() or "N/A",
            user.email or "N/A",
            order.total_amount,
            order.payment_status.value if order.payment_status else "N/A",
            order.payment_method.value if order.payment_method else "N/A",
            order.created_at.isoformat() if order.created_at else "N/A"
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=financial-report-{datetime.utcnow().date()}.csv"}
    )


# ==================== MODERATION & REPORTS ====================

class ModerationReportResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    reporter_name: Optional[str] = None
    reason: str
    details: Optional[str] = None
    severity: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ReportResolution(BaseModel):
    action: str = "remove"  # remove, warn, ban, none


@router.get("/reports")
def get_reports(
    status: Optional[str] = None,
    type: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get moderation reports"""
    query = db.query(ModerationReport)
    
    if status:
        query = query.filter(ModerationReport.status == status)
    if type:
        query = query.filter(ModerationReport.entity_type == type)
    
    reports = query.order_by(desc(ModerationReport.created_at)).all()
    
    result = []
    for report in reports:
        reporter = db.query(User).filter(User.id == report.reporter_id).first()
        result.append({
            "id": report.id,
            "entity_type": report.entity_type,
            "entity_id": report.entity_id,
            "reporter_name": f"{reporter.first_name or ''} {reporter.last_name or ''}".strip() if reporter else "Unknown",
            "reason": report.reason,
            "details": report.details,
            "severity": report.severity,
            "status": report.status,
            "created_at": report.created_at,
        })
    
    return result


@router.get("/reports/stats")
def get_report_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get moderation statistics"""
    total = db.query(ModerationReport).count()
    pending = db.query(ModerationReport).filter(ModerationReport.status == "pending").count()
    resolved = db.query(ModerationReport).filter(ModerationReport.status == "resolved").count()
    dismissed = db.query(ModerationReport).filter(ModerationReport.status == "dismissed").count()
    
    from datetime import date
    today = date.today()
    resolved_today = db.query(ModerationReport).filter(
        ModerationReport.status == "resolved",
        func.date(ModerationReport.resolved_at) == today
    ).count()
    
    return {
        "total": total,
        "pending": pending,
        "resolved": resolved,
        "dismissed": dismissed,
        "resolved_today": resolved_today,
        "auto_moderated": 0
    }


@router.post("/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    resolution: ReportResolution,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Resolve a moderation report"""
    report = db.query(ModerationReport).filter(ModerationReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = "resolved"
    report.resolution_action = resolution.action
    report.resolved_at = datetime.now(timezone.utc)
    report.resolved_by = current_user.id
    db.commit()
    
    return {"message": "Report resolved", "report_id": report_id}


@router.post("/reports/{report_id}/dismiss")
def dismiss_report(
    report_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Dismiss a moderation report"""
    report = db.query(ModerationReport).filter(ModerationReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.status = "dismissed"
    report.resolved_at = datetime.now(timezone.utc)
    report.resolved_by = current_user.id
    db.commit()
    
    return {"message": "Report dismissed", "report_id": report_id}


# ==================== API INTEGRATIONS ====================

class IntegrationResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    enabled: bool
    config: Optional[dict] = None
    
    class Config:
        from_attributes = True


class IntegrationUpdate(BaseModel):
    enabled: bool


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    key: str  # masked key
    created_at: datetime
    
    class Config:
        from_attributes = True


class WebhookCreate(BaseModel):
    url: str
    events: List[str]


class WebhookResponse(BaseModel):
    id: int
    url: str
    events: List[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


def _ensure_default_integrations(db: Session):
    """Seed default integrations if none exist"""
    if db.query(Integration).count() == 0:
        defaults = [
            Integration(name="SendGrid", slug="sendgrid", description="Email delivery service", icon=None, config={"api_key": ""}),
            Integration(name="Twilio", slug="twilio", description="SMS and verification", icon=None, config={"account_sid": "", "auth_token": ""}),
            Integration(name="AWS S3", slug="aws_s3", description="File storage", icon=None, config={"bucket": "", "region": ""}),
            Integration(name="Stripe", slug="stripe", description="Payment processing", icon=None, config={"publishable_key": "", "secret_key": ""}),
            Integration(name="Google Maps", slug="google_maps", description="Location services", icon=None, config={"api_key": ""}),
        ]
        for integration in defaults:
            db.add(integration)
        db.commit()


def _ensure_default_api_key(db: Session, current_user: User):
    """Ensure at least one API key exists"""
    if db.query(ApiKey).count() == 0:
        raw_key = "si_" + secrets.token_urlsafe(32)
        key = ApiKey(
            name="Production API Key",
            key_prefix=raw_key[:8],
            key_hash=raw_key,  # In production, hash this
            created_by=current_user.id
        )
        db.add(key)
        db.commit()


@router.get("/integrations", response_model=List[IntegrationResponse])
def get_integrations(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get third-party integrations"""
    _ensure_default_integrations(db)
    integrations = db.query(Integration).all()
    return integrations


@router.put("/integrations/{integration_id}")
def update_integration(
    integration_id: int,
    update: IntegrationUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update integration status"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    integration.enabled = update.enabled
    db.commit()
    
    return {"message": f"Integration {'enabled' if update.enabled else 'disabled'}", "integration_id": integration_id}


@router.get("/api-keys", response_model=List[ApiKeyResponse])
def get_api_keys(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get API keys"""
    _ensure_default_api_key(db, current_user)
    keys = db.query(ApiKey).filter(ApiKey.is_active == True).all()
    
    result = []
    for key in keys:
        result.append({
            "id": key.id,
            "name": key.name,
            "key": f"{key.key_prefix}••••••••••••••••••••••••••",
            "created_at": key.created_at,
        })
    
    return result


@router.post("/api-keys/{key_id}/regenerate")
def regenerate_api_key(
    key_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Regenerate an API key"""
    if key_id == 0:
        # Create new key
        raw_key = "si_" + secrets.token_urlsafe(32)
        key = ApiKey(
            name="Generated API Key",
            key_prefix=raw_key[:8],
            key_hash=raw_key,
            created_by=current_user.id
        )
        db.add(key)
        db.commit()
        db.refresh(key)
        return {"message": "API key generated", "key_id": key.id, "key": raw_key}
    
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    raw_key = "si_" + secrets.token_urlsafe(32)
    key.key_hash = raw_key
    key.key_prefix = raw_key[:8]
    key.created_at = datetime.now(timezone.utc)
    db.commit()
    
    return {"message": "API key regenerated", "key_id": key_id, "key": raw_key}


@router.get("/webhooks", response_model=List[WebhookResponse])
def get_webhooks(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get webhook endpoints"""
    webhooks = db.query(Webhook).all()
    return webhooks


@router.post("/webhooks", response_model=WebhookResponse)
def create_webhook(
    webhook_data: WebhookCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a webhook endpoint"""
    webhook = Webhook(
        url=webhook_data.url,
        events=webhook_data.events,
        secret=secrets.token_urlsafe(32),
        status="active",
        created_by=current_user.id
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook


@router.delete("/webhooks/{webhook_id}")
def delete_webhook(
    webhook_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a webhook endpoint"""
    webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    db.delete(webhook)
    db.commit()
    
    return {"message": "Webhook deleted", "webhook_id": webhook_id}


# ==================== ACTIVITIES ====================

class ActivityLogResponse(BaseModel):
    id: int
    admin_id: int
    admin_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime


class AdminActivitiesResponse(BaseModel):
    activities: List[ActivityLogResponse]


@router.get("/activities", response_model=AdminActivitiesResponse)
def get_admin_activities(
    limit: int = 50,
    admin_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get recent admin activities from AdminActivityLog, falling back to synthesized DB events"""
    query = db.query(AdminActivityLog)

    if admin_id:
        query = query.filter(AdminActivityLog.admin_id == admin_id)
    if entity_type:
        query = query.filter(AdminActivityLog.entity_type == entity_type)

    activities = query.order_by(desc(AdminActivityLog.created_at)).limit(limit).all()

    # If no admin logs exist, synthesize from actual database events
    if not activities:
        synthesized: List[ActivityLogResponse] = []

        # Recent user registrations
        recent_users = db.query(User).order_by(desc(User.created_at)).limit(limit).all()
        for u in recent_users:
            synthesized.append(ActivityLogResponse(
                id=u.id,
                admin_id=0,
                admin_name="System",
                action="user_registered",
                entity_type="user",
                entity_id=u.id,
                entity_name=f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
                details={"email": u.email, "role": u.role.value if u.role else None},
                ip_address=None,
                created_at=u.created_at,
            ))

        # Recent events
        recent_events = db.query(Event).order_by(desc(Event.created_at)).limit(limit).all()
        for e in recent_events:
            synthesized.append(ActivityLogResponse(
                id=e.id,
                admin_id=0,
                admin_name="System",
                action="event_created",
                entity_type="event",
                entity_id=e.id,
                entity_name=e.title,
                details={"status": e.status.value if e.status else None, "city": e.city.value if e.city else None},
                ip_address=None,
                created_at=e.created_at,
            ))

        # Recent artist profiles
        recent_artists = db.query(ArtistProfile).order_by(desc(ArtistProfile.created_at)).limit(limit // 2).all()
        for a in recent_artists:
            synthesized.append(ActivityLogResponse(
                id=a.id,
                admin_id=0,
                admin_name="System",
                action="artist_profile_created",
                entity_type="artist",
                entity_id=a.id,
                entity_name=a.stage_name,
                details={"user_id": a.user_id},
                ip_address=None,
                created_at=a.created_at,
            ))

        # Recent business (organizer) profiles
        recent_businesses = db.query(OrganizerProfile).order_by(desc(OrganizerProfile.created_at)).limit(limit // 2).all()
        for b in recent_businesses:
            synthesized.append(ActivityLogResponse(
                id=b.id,
                admin_id=0,
                admin_name="System",
                action="business_profile_created",
                entity_type="business",
                entity_id=b.id,
                entity_name=b.organization_name,
                details={"user_id": b.user_id},
                ip_address=None,
                created_at=b.created_at,
            ))

        # Recent payout requests
        recent_payouts = db.query(PayoutRequest).order_by(desc(PayoutRequest.requested_at)).limit(limit // 2).all()
        for p in recent_payouts:
            synthesized.append(ActivityLogResponse(
                id=p.id,
                admin_id=0,
                admin_name="System",
                action=f"payout_{p.status.value if p.status else 'requested'}",
                entity_type="payout",
                entity_id=p.id,
                entity_name=f"Payout {p.amount} {p.currency}",
                details={"user_id": p.user_id, "amount": p.amount, "currency": p.currency},
                ip_address=None,
                created_at=p.requested_at,
            ))

        # Sort by created_at descending and take limit
        synthesized.sort(key=lambda x: x.created_at, reverse=True)
        activities = synthesized[:limit]

    return {"activities": activities}


# ==================== VERIFICATION BADGE MANAGEMENT ====================

class VerificationBadgeUpdate(BaseModel):
    user_id: int
    badge_status: bool  # True to assign, False to remove

@router.post("/verification-badge")
def update_verification_badge(
    data: VerificationBadgeUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Assign or remove verification badge from a user.
    Only super admins can manage verification badges.
    """
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update badge status
    target_user.verification_badge = data.badge_status
    target_user.is_verified = data.badge_status
    
    # Sync profile verification status
    if data.badge_status:
        target_user.verification_badge_issued_at = datetime.now(timezone.utc)
        target_user.verification_badge_issued_by = current_user.id
        if target_user.organizer_profile:
            target_user.organizer_profile.is_verified = True
        if target_user.artist_profile:
            target_user.artist_profile.is_verified = True
        if target_user.business_profile:
            target_user.business_profile.is_verified = True
        if target_user.vendor_profile:
            target_user.vendor_profile.is_verified = True
        action = "assigned"
    else:
        target_user.verification_badge_issued_at = None
        target_user.verification_badge_issued_by = None
        if target_user.organizer_profile:
            target_user.organizer_profile.is_verified = False
        if target_user.artist_profile:
            target_user.artist_profile.is_verified = False
        if target_user.business_profile:
            target_user.business_profile.is_verified = False
        if target_user.vendor_profile:
            target_user.vendor_profile.is_verified = False
        action = "removed"
    
    db.commit()
    db.refresh(target_user)

    # Notify the user when a badge is awarded (non-blocking)
    if data.badge_status:
        try:
            from api.notifications import create_notification
            create_notification(
                db=db,
                user_id=target_user.id,
                title="Verified Badge Awarded",
                message="Congratulations! You have been awarded a verified badge by administrators.",
                notification_type="badge_granted",
                data={"badge": True}
            )
        except Exception:
            pass
    
    return {
        "message": f"Verification badge {action} successfully",
        "user_id": target_user.id,
        "user_name": f"{target_user.first_name or ''} {target_user.last_name or ''}".strip() or target_user.email,
        "verification_badge": target_user.verification_badge,
        "issued_by": f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email,
        "issued_at": target_user.verification_badge_issued_at
    }


@router.get("/verification-badge/users")
def get_verified_users_with_badge(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Get all users who have the verification badge."""
    users = db.query(User).filter(User.verification_badge == True).all()
    
    return [
        {
            "id": u.id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
            "email": u.email,
            "role": u.role.value,
            "avatar_url": u.avatar_url,
            "issued_at": u.verification_badge_issued_at,
            "issued_by": (
                (lambda issuer: f"{issuer.first_name or ''} {issuer.last_name or ''}".strip() if issuer else None)
                (db.query(User).filter(User.id == u.verification_badge_issued_by).first())
            ) if u.verification_badge_issued_by else None
        }
        for u in users
    ]






def log_activity(
    user_id: int,
    user_name: str,
    action: str,
    entity_type: str,
    entity_id = None,
    entity_name = None,
    details = None,
    db = None
):
    """Persist an admin activity log to the database."""
    if db is None:
        return
    from models import AdminActivityLog
    from datetime import datetime
    log = AdminActivityLog(
        admin_id=user_id,
        admin_name=user_name or None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        details=details,
        created_at=datetime.utcnow()
    )
    db.add(log)
    db.commit()

# ==================== COMMUNITY MANAGEMENT ====================

@router.get("/community/sections", response_model=List[CommunitySectionResponse])
def list_community_sections(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all community sections (including inactive)"""
    sections = db.query(CommunitySection).order_by(CommunitySection.sort_order, CommunitySection.name).all()
    result = []
    for s in sections:
        post_count = db.query(CommunityPost).filter(CommunityPost.section_id == s.id, CommunityPost.deleted_at == None).count()
        result.append(CommunitySectionResponse(
            id=s.id,
            name=s.name,
            slug=s.slug,
            description=s.description,
            icon=s.icon,
            sort_order=s.sort_order,
            is_active=s.is_active,
            created_by=s.created_by,
            created_at=s.created_at,
            updated_at=s.updated_at,
            post_count=post_count
        ))
    return result


@router.post("/community/sections", response_model=CommunitySectionResponse)
def create_community_section(
    data: CommunitySectionBase,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new community section"""
    slug = data.slug or data.name.lower().replace(" ", "-")
    existing = db.query(CommunitySection).filter(CommunitySection.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Section with this slug already exists")
    
    section = CommunitySection(
        name=data.name,
        slug=slug,
        description=data.description,
        icon=data.icon,
        sort_order=data.sort_order,
        is_active=data.is_active,
        created_by=current_user.id
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return CommunitySectionResponse(
        id=section.id,
        name=section.name,
        slug=section.slug,
        description=section.description,
        icon=section.icon,
        sort_order=section.sort_order,
        is_active=section.is_active,
        created_by=section.created_by,
        created_at=section.created_at,
        updated_at=section.updated_at,
        post_count=0
    )


@router.put("/community/sections/{section_id}", response_model=CommunitySectionResponse)
def update_community_section(
    section_id: int,
    data: CommunitySectionBase,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a community section"""
    section = db.query(CommunitySection).filter(CommunitySection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    if data.name is not None:
        section.name = data.name
    if data.description is not None:
        section.description = data.description
    if data.icon is not None:
        section.icon = data.icon
    if data.sort_order is not None:
        section.sort_order = data.sort_order
    if data.is_active is not None:
        section.is_active = data.is_active
    if data.slug:
        existing = db.query(CommunitySection).filter(CommunitySection.slug == data.slug, CommunitySection.id != section_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Section with this slug already exists")
        section.slug = data.slug
    
    section.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(section)
    
    post_count = db.query(CommunityPost).filter(CommunityPost.section_id == section.id, CommunityPost.deleted_at == None).count()
    return CommunitySectionResponse(
        id=section.id,
        name=section.name,
        slug=section.slug,
        description=section.description,
        icon=section.icon,
        sort_order=section.sort_order,
        is_active=section.is_active,
        created_by=section.created_by,
        created_at=section.created_at,
        updated_at=section.updated_at,
        post_count=post_count
    )


@router.delete("/community/sections/{section_id}")
def delete_community_section(
    section_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a community section (only if no posts are linked)"""
    section = db.query(CommunitySection).filter(CommunitySection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    linked_posts = db.query(CommunityPost).filter(CommunityPost.section_id == section_id).count()
    if linked_posts > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete section with {linked_posts} linked posts. Reassign posts first.")
    
    db.delete(section)
    db.commit()
    return {"success": True, "message": "Section deleted"}


@router.get("/community/posts")
def list_community_posts_admin(
    status: str = Query("all", regex="^(all|approved|pending)$"),
    section_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all community posts for moderation"""
    query = db.query(CommunityPost).filter(CommunityPost.deleted_at == None)
    
    if status == "approved":
        query = query.filter(CommunityPost.is_approved == True)
    elif status == "pending":
        query = query.filter(CommunityPost.is_approved == False)
    
    if section_id:
        query = query.filter(CommunityPost.section_id == section_id)
    
    if search:
        query = query.filter(
            (CommunityPost.title.ilike(f"%{search}%")) |
            (CommunityPost.content.ilike(f"%{search}%"))
        )
    
    total = query.count()
    posts = query.order_by(desc(CommunityPost.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    
    result = []
    for post in posts:
        user_data = None
        if post.user:
            user_data = {
                "id": post.user.id,
                "first_name": post.user.first_name or "",
                "last_name": post.user.last_name or "",
                "avatar_url": post.user.avatar_url,
                "is_guest": getattr(post.user, 'is_guest', False)
            }
        result.append({
            "id": post.id,
            "title": post.title,
            "content": post.content[:200] + "..." if len(post.content) > 200 else post.content,
            "user": user_data,
            "guest_name": post.guest_name,
            "author_type": post.author_type,
            "section": post.section.name if post.section else None,
            "is_approved": post.is_approved,
            "is_visible": post.is_visible,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "view_count": post.view_count,
            "created_at": post.created_at,
        })
    
    return {
        "posts": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/community/posts/{post_id}/approve")
def approve_community_post(
    post_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve a community post"""
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post.is_approved = True
    post.is_visible = True
    db.commit()
    return {"success": True, "message": "Post approved"}


@router.post("/community/posts/{post_id}/reject")
def reject_community_post(
    post_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject/hide a community post"""
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post.is_approved = False
    post.is_visible = False
    db.commit()
    return {"success": True, "message": "Post rejected"}


@router.get("/community/comments")
def list_community_comments_admin(
    status: str = Query("all", regex="^(all|approved|pending)$"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all community comments for moderation"""
    query = db.query(CommunityComment)
    
    if status == "approved":
        query = query.filter(CommunityComment.is_approved == True)
    elif status == "pending":
        query = query.filter(CommunityComment.is_approved == False)
    
    if search:
        query = query.filter(CommunityComment.content.ilike(f"%{search}%"))
    
    total = query.count()
    comments = query.order_by(desc(CommunityComment.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    
    result = []
    for c in comments:
        user_data = None
        if c.user:
            user_data = {
                "id": c.user.id,
                "first_name": c.user.first_name or "",
                "last_name": c.user.last_name or "",
                "avatar_url": c.user.avatar_url
            }
        result.append({
            "id": c.id,
            "content": c.content[:200] + "..." if len(c.content) > 200 else c.content,
            "user_id": c.user_id,
            "user": user_data,
            "guest_name": c.guest_name,
            "post_id": c.post_id,
            "post_title": c.post.title if c.post else None,
            "is_approved": c.is_approved,
            "like_count": c.like_count,
            "created_at": c.created_at,
        })
    
    return {
        "comments": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/community/comments/{comment_id}/approve")
def approve_community_comment(
    comment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve a community comment"""
    comment = db.query(CommunityComment).filter(CommunityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.is_approved = True
    db.commit()
    return {"success": True, "message": "Comment approved"}


@router.post("/community/comments/{comment_id}/reject")
def reject_community_comment(
    comment_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject/hide a community comment"""
    comment = db.query(CommunityComment).filter(CommunityComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.is_approved = False
    db.commit()
    return {"success": True, "message": "Comment rejected"}


@router.get("/community/metrics")
def get_community_metrics(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get community metrics for admin dashboard"""
    from datetime import timedelta
    
    total_posts = db.query(CommunityPost).filter(CommunityPost.deleted_at == None).count()
    total_pending_posts = db.query(CommunityPost).filter(CommunityPost.deleted_at == None, CommunityPost.is_approved == False).count()
    total_comments = db.query(CommunityComment).count()
    total_pending_comments = db.query(CommunityComment).filter(CommunityComment.is_approved == False).count()
    total_sections = db.query(CommunitySection).count()
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    posts_today = db.query(CommunityPost).filter(CommunityPost.created_at >= today).count()
    posts_this_week = db.query(CommunityPost).filter(CommunityPost.created_at >= week_ago).count()
    
    # Top sections by post count
    top_sections = db.query(
        CommunitySection.id,
        CommunitySection.name,
        func.count(CommunityPost.id).label("post_count")
    ).outerjoin(
        CommunityPost, (CommunityPost.section_id == CommunitySection.id) & (CommunityPost.deleted_at == None)
    ).group_by(CommunitySection.id).order_by(desc("post_count")).limit(5).all()
    
    # Recent flagged (pending) posts
    recent_flagged = db.query(CommunityPost).filter(
        CommunityPost.deleted_at == None,
        CommunityPost.is_approved == False
    ).order_by(desc(CommunityPost.created_at)).limit(5).all()
    
    return {
        "total_posts": total_posts,
        "total_pending_posts": total_pending_posts,
        "total_comments": total_comments,
        "total_pending_comments": total_pending_comments,
        "total_sections": total_sections,
        "posts_today": posts_today,
        "posts_this_week": posts_this_week,
        "top_sections": [
            {"id": s.id, "name": s.name, "post_count": s.post_count}
            for s in top_sections
        ],
        "recent_flagged": [
            {
                "id": p.id,
                "title": p.title,
                "content": p.content[:150] + "..." if len(p.content) > 150 else p.content,
                "author_name": f"{p.user.first_name or ''} {p.user.last_name or ''}".strip() or p.user.email,
                "created_at": p.created_at,
            }
            for p in recent_flagged
        ]
    }


# ==================== ROLES & PERMISSIONS ====================

@router.get("/roles")
def get_admin_roles(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all platform roles with user counts (includes custom admin roles)"""
    roles = []
    for role in UserRole:
        count = db.query(User).filter(User.role == role).count()
        roles.append({
            "name": role.value,
            "description": role.value.replace("_", " ").title(),
            "user_count": count
        })
    return roles


@router.get("/permissions")
def get_admin_permissions(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get list of available admin permission keys with labels"""
    permissions = [
        {"key": "dashboard", "label": "Dashboard", "category": "Core"},
        {"key": "analytics_read", "label": "View Analytics", "category": "Core"},
        {"key": "users_read", "label": "View Users & Profiles", "category": "Platform"},
        {"key": "events_read", "label": "View Events & Bookings", "category": "Platform"},
        {"key": "financials_read", "label": "View Financials", "category": "Finance"},
        {"key": "subscriptions_read", "label": "View Subscriptions", "category": "Finance"},
        {"key": "content_read", "label": "View Content", "category": "Content"},
        {"key": "marketing_read", "label": "View Marketing", "category": "Marketing"},
        {"key": "support_read", "label": "View Support & Community", "category": "Support"},
        {"key": "verifications_read", "label": "View Verifications", "category": "Verification"},
        {"key": "settings_read", "label": "View Settings & Logs", "category": "System"},
        {"key": "admins_write", "label": "Manage Admin Roles", "category": "System"},
    ]
    return permissions


@router.get("/admin-roles", response_model=List[AdminRoleResponse])
def list_admin_roles(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all custom and system admin roles with user counts"""
    roles = db.query(AdminRoleModel).order_by(AdminRoleModel.id.asc()).all()
    result = []
    for r in roles:
        user_count = db.query(User).filter(User.admin_role_id == r.id).count()
        result.append(AdminRoleResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=r.permissions or [],
            is_system=bool(r.is_system),
            created_at=r.created_at,
            updated_at=r.updated_at,
            user_count=user_count
        ))
    return result


@router.post("/admin-roles", response_model=AdminRoleResponse)
def create_admin_role(
    data: AdminRoleCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Create a new custom admin role (super admin only)"""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Role name is required")
    
    existing = db.query(AdminRoleModel).filter(func.lower(AdminRoleModel.name) == name.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Role '{name}' already exists")
    
    # Ensure dashboard permission is always included
    perms = list(set(data.permissions or []))
    if "dashboard" not in perms:
        perms.insert(0, "dashboard")
    
    role = AdminRoleModel(
        name=name,
        description=data.description,
        permissions=perms,
        is_system=False
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return AdminRoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=role.permissions,
        is_system=role.is_system,
        created_at=role.created_at,
        updated_at=role.updated_at,
        user_count=0
    )


@router.put("/admin-roles/{role_id}", response_model=AdminRoleResponse)
def update_admin_role(
    role_id: int,
    data: AdminRoleUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Update a custom admin role (super admin only)"""
    role = db.query(AdminRoleModel).filter(AdminRoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be modified")
    
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Role name cannot be empty")
        existing = db.query(AdminRoleModel).filter(
            func.lower(AdminRoleModel.name) == name.lower(),
            AdminRoleModel.id != role_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Role '{name}' already exists")
        role.name = name
    
    if data.description is not None:
        role.description = data.description
    
    if data.permissions is not None:
        perms = list(set(data.permissions))
        if "dashboard" not in perms:
            perms.insert(0, "dashboard")
        role.permissions = perms
    
    role.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(role)
    
    user_count = db.query(User).filter(User.admin_role_id == role.id).count()
    return AdminRoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=role.permissions,
        is_system=role.is_system,
        created_at=role.created_at,
        updated_at=role.updated_at,
        user_count=user_count
    )


@router.delete("/admin-roles/{role_id}")
def delete_admin_role(
    role_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Delete a custom admin role (super admin only)"""
    role = db.query(AdminRoleModel).filter(AdminRoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system and (role.name or "").strip().lower() in ("super admin", "super_admin"):
        raise HTTPException(status_code=400, detail="Super Admin system role cannot be deleted")
    
    role_name = role.name
    # Unassign role from users and demote non-super-admin role managers so deleting a scoped role never elevates them to Full Admin
    affected_users = db.query(User).filter(User.admin_role_id == role_id).all()
    for u in affected_users:
        u.admin_role_id = None
        if u.role == UserRole.ADMIN:
            if u.organizer_profile or u.business_profile:
                u.role = UserRole.BUSINESS
            elif u.artist_profile:
                u.role = UserRole.ARTIST
            elif u.vendor_profile:
                u.role = UserRole.VENDOR
            else:
                u.role = UserRole.USER

    db.delete(role)
    db.commit()
    return {"message": f"Role '{role_name}' deleted successfully"}


@router.get("/admins", response_model=List[AdminUserItem])
def list_admin_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all administrators and staff with their assigned custom roles"""
    from sqlalchemy import or_
    admins = db.query(User).filter(
        or_(
            User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
            User.admin_role_id.isnot(None)
        )
    ).all()
    
    result = []
    for a in admins:
        role_name = None
        if a.admin_role_id:
            r = db.query(AdminRoleModel).filter(AdminRoleModel.id == a.admin_role_id).first()
            if r:
                role_name = r.name
        
        result.append(AdminUserItem(
            id=a.id,
            email=a.email,
            first_name=a.first_name,
            last_name=a.last_name,
            role=a.role.value if hasattr(a.role, 'value') else str(a.role),
            admin_role_id=a.admin_role_id,
            admin_role_name=role_name,
            avatar_url=a.avatar_url
        ))
    return result


@router.get("/admins/me/permissions")
def get_my_admin_permissions(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get permissions for current logged-in admin user"""
    if current_user.role == UserRole.SUPER_ADMIN:
        all_keys = [
            "dashboard", "analytics_read", "users_read", "events_read",
            "financials_read", "subscriptions_read", "content_read",
            "marketing_read", "support_read", "verifications_read",
            "settings_read", "admins_write"
        ]
        return {
            "role": "super_admin",
            "role_name": "Super Admin",
            "is_system": True,
            "permissions": all_keys
        }
    
    if current_user.admin_role_id:
        role = db.query(AdminRoleModel).filter(AdminRoleModel.id == current_user.admin_role_id).first()
        if role:
            return {
                "role": "admin",
                "role_id": role.id,
                "role_name": role.name,
                "is_system": role.is_system,
                "permissions": role.permissions or ["dashboard"]
            }
    
    return {
        "role": "admin",
        "role_name": "Admin",
        "is_system": True,
        "permissions": [
            "dashboard", "analytics_read", "users_read", "events_read",
            "content_read", "marketing_read", "support_read", "verifications_read"
        ]
    }


@router.post("/users/{user_id}/assign-role")
def assign_user_admin_role(
    user_id: int,
    role_id: Optional[int] = Body(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Assign or unassign an admin role to a user (super admin only). Pass role_id=-1 to revoke admin access completely."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role == UserRole.SUPER_ADMIN and user.id != current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify other Super Admin roles")
    
    if role_id == -1:
        user.admin_role_id = None
        if user.role != UserRole.SUPER_ADMIN:
            if user.organizer_profile or user.business_profile:
                user.role = UserRole.BUSINESS
            elif user.artist_profile:
                user.role = UserRole.ARTIST
            elif user.vendor_profile:
                user.role = UserRole.VENDOR
            else:
                user.role = UserRole.USER
        db.commit()
        return {"message": "Admin role revoked", "user_id": user.id, "admin_role_id": None}

    if role_id is not None:
        role = db.query(AdminRoleModel).filter(AdminRoleModel.id == role_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Admin role not found")
        user.admin_role_id = role_id
        if user.role != UserRole.SUPER_ADMIN:
            user.role = UserRole.ADMIN
    else:
        user.admin_role_id = None
    
    db.commit()
    return {"message": "Admin role updated successfully", "user_id": user.id, "admin_role_id": user.admin_role_id}


@router.post("/admins/invite")
def invite_admin_user(
    data: AdminInviteRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Invite a user by email to a custom admin role (Finance, Marketing, Content Moderator, etc.)"""
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    role = db.query(AdminRoleModel).filter(AdminRoleModel.id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Specified admin role not found")
    
    user = db.query(User).filter(func.lower(User.email) == email).first()
    
    if not user:
        temp_pass = secrets.token_urlsafe(12)
        from auth import get_password_hash
        user = User(
            email=email,
            password_hash=get_password_hash(temp_pass),
            first_name=data.first_name,
            last_name=data.last_name,
            role=UserRole.ADMIN,
            admin_role_id=role.id,
            status=UserStatus.ACTIVE,
            is_verified=True,
            is_email_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.role = UserRole.ADMIN
        user.admin_role_id = role.id
        if data.first_name and not user.first_name:
            user.first_name = data.first_name
        if data.last_name and not user.last_name:
            user.last_name = data.last_name
        db.commit()
    
    admin_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or "Sound It Admin"
    user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
    from config import get_settings
    settings = get_settings()
    invite_url = f"{settings.BASE_URL or 'https://sounditent.com'}/admin"
    
    email_sent = send_admin_role_invite_email(
        to_email=user.email,
        name=user_name,
        role_name=role.name,
        invite_url=invite_url,
        assigned_by_name=admin_name
    )
    
    return {
        "message": f"Successfully assigned {role.name} role to {user.email}",
        "user_id": user.id,
        "email": user.email,
        "role_name": role.name,
        "email_sent": email_sent
    }


# ==================== VERIFICATION CENTER ====================

@router.get("/verifications", response_model=List[VerificationRequestItem])
def list_verification_requests(
    status: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List document verification requests for admin review (ONLY real requests submitted by users)"""
    query = db.query(VerificationRequest).options(
        joinedload(VerificationRequest.user).joinedload(User.artist_profile),
        joinedload(VerificationRequest.user).joinedload(User.business_profile),
        joinedload(VerificationRequest.user).joinedload(User.organizer_profile),
        joinedload(VerificationRequest.user).joinedload(User.vendor_profile),
    )
    
    if status and status.lower() != "all":
        try:
            vstatus = VerificationStatus(status.lower())
            query = query.filter(VerificationRequest.status == vstatus)
        except Exception:
            pass
    
    if type and type.lower() != "all":
        try:
            vtype = VerificationType(type.lower())
            query = query.filter(VerificationRequest.request_type == vtype)
        except Exception:
            pass
    
    requests = query.order_by(VerificationRequest.submitted_at.desc()).all()
    result = []
    
    for r in requests:
        user = r.user
        user_name = (f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username or user.email) if user else "Unknown"
        req_type_str = r.request_type.value if hasattr(r.request_type, 'value') else str(r.request_type)
        
        # Determine entity display name
        entity_name = user_name
        if user:
            if user.artist_profile and user.artist_profile.stage_name:
                entity_name = user.artist_profile.stage_name
            elif user.business_profile and user.business_profile.business_name:
                entity_name = user.business_profile.business_name
            elif user.organizer_profile and user.organizer_profile.organization_name:
                entity_name = user.organizer_profile.organization_name
            elif user.vendor_profile and user.vendor_profile.business_name:
                entity_name = user.vendor_profile.business_name
        
        # Filter by search term if provided
        if search:
            st = search.lower()
            if st not in user_name.lower() and st not in entity_name.lower() and (not user or st not in (user.email or "").lower()):
                continue
        
        result.append({
            "id": str(r.id),
            "user_id": str(r.user_id),
            "name": user_name,
            "type": req_type_str.lower(),
            "entity_id": r.user_id,
            "entity_name": entity_name,
            "submitted_by": user_name,
            "submitted_at": r.submitted_at,
            "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
            "documents": _normalize_documents(r.documents),
            "notes": r.notes,
            "email": user.email if user else None,
            "phone": user.phone if user else None,
        })
    
    return result


@router.post("/verifications/{request_id}/approve")
def approve_verification_request(
    request_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve a verification request and grant verification badge"""
    # Clean request_id (supports both int string '123' and prefixed 'req_123' or 'art_123')
    clean_id_str = request_id.replace("req_", "").replace("biz_", "").replace("art_", "").replace("vendor_", "").replace("evt_", "")
    try:
        numeric_id = int(clean_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid verification request ID")
    
    req = db.query(VerificationRequest).filter(VerificationRequest.id == numeric_id).first()
    if not req:
        # Fallback: check if the numeric_id was a user_id
        req = db.query(VerificationRequest).filter(
            VerificationRequest.user_id == numeric_id,
            VerificationRequest.status == VerificationStatus.PENDING
        ).first()
    
    user = None
    if req:
        req.status = VerificationStatus.APPROVED
        req.processed_at = datetime.now(timezone.utc)
        req.processed_by_id = current_user.id
        user = db.query(User).filter(User.id == req.user_id).first()
    else:
        # If no VerificationRequest found, check if it was a direct user approval
        user = db.query(User).filter(User.id == numeric_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Verification request not found")
    
    if user:
        user.is_verified = True
        user.verification_badge = True
        if user.artist_profile:
            user.artist_profile.is_verified = True
        if user.business_profile:
            user.business_profile.is_verified = True
        if user.organizer_profile:
            user.organizer_profile.is_verified = True
        if user.vendor_profile:
            user.vendor_profile.is_verified = True
        
        # Send in-app notification to user
        try:
            from api.notifications import create_notification
            create_notification(
                db=db,
                user_id=user.id,
                title="Verification Approved",
                message="Congratulations! Your verification request has been approved and your profile is now verified with a badge.",
                notification_type="verification_approved",
                data={"badge": True}
            )
        except Exception:
            pass
    
    db.commit()
    return {"message": "Verification approved successfully", "request_id": request_id, "status": "approved"}


@router.post("/verifications/{request_id}/reject")
def reject_verification_request(
    request_id: str,
    data: Optional[VerificationReview] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject a verification request"""
    clean_id_str = request_id.replace("req_", "").replace("biz_", "").replace("art_", "").replace("vendor_", "").replace("evt_", "")
    try:
        numeric_id = int(clean_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid verification request ID")
    
    req = db.query(VerificationRequest).filter(VerificationRequest.id == numeric_id).first()
    if not req:
        req = db.query(VerificationRequest).filter(
            VerificationRequest.user_id == numeric_id,
            VerificationRequest.status == VerificationStatus.PENDING
        ).first()
    
    user = None
    if req:
        req.status = VerificationStatus.REJECTED
        req.processed_at = datetime.now(timezone.utc)
        req.processed_by_id = current_user.id
        if data and data.notes:
            req.notes = data.notes
        user = db.query(User).filter(User.id == req.user_id).first()
    else:
        user = db.query(User).filter(User.id == numeric_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Verification request not found")
    
    if user:
        user.verification_badge = False
        # Send in-app notification to user
        try:
            from api.notifications import create_notification
            reason_msg = f" Note: {data.notes}" if data and data.notes else ""
            create_notification(
                db=db,
                user_id=user.id,
                title="Verification Request Update",
                message=f"Your verification request was reviewed and was not approved at this time.{reason_msg}",
                notification_type="verification_rejected"
            )
        except Exception:
            pass
    
    db.commit()
    return {"message": "Verification request rejected", "request_id": request_id, "status": "rejected"}