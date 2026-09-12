# Sound It — Full Ticketing Code Reference

> This document compiles the core ticketing code from the Sound It platform for reuse on another platform.
> Stack: FastAPI + SQLAlchemy (backend), React + TypeScript + Zustand (frontend).
>
> **Scope note:** This is a curated collection of the ticketing-specific modules. Supporting models such as `User`, `Event` base columns, `OrganizerProfile`, `BusinessProfile`, `StaffMember`, `EventPromoter`, etc. are referenced but not duplicated in full.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Models](#2-database-models)
3. [Pydantic Schemas](#3-pydantic-schemas)
4. [Ticketing Service](#4-ticketing-service)
5. [Backend API — Tickets (`api/tickets.py`)](#5-backend-api--tickets-apiticketspy)
6. [Backend API — Organizer Ticketing (`api/ticketing_organizer.py`)](#6-backend-api--organizer-ticketing-apiticketing_organizerpy)
7. [Backend API — Event Ticket Tiers (`api/events.py` excerpts)](#7-backend-api--event-ticket-tiers-apieventspy-excerpts)
8. [Backend API — Payments Order Flow (`api/payments.py` excerpts)](#8-backend-api--payments-order-flow-apipaymentspy-excerpts)
9. [Email Service (`email_service.py` excerpts)](#9-email-service-email_servicepy-excerpts)
10. [Frontend State — `ticketStore.ts`](#10-frontend-state--ticketstorets)
11. [Frontend — `EventDetail.tsx`](#11-frontend--eventdetailtsx)
12. [Frontend — `Checkout.tsx`](#12-frontend--checkouttsx)
13. [Frontend — `user/Tickets.tsx`](#13-frontend--userticketstsx)
14. [Frontend — `business/TicketOrders.tsx`](#14-frontend--businessticketorderstsx)
15. [Frontend — `Scan.tsx`](#15-frontend--scantsx)
16. [Main App Wiring (`main.py` excerpts)](#16-main-app-wiring-mainpy-excerpts)
17. [License / Attribution](#17-license--attribution)

---

## 1. Architecture Overview

The platform has two overlapping order/ticket paths:

| Path | Model | Purpose | Approval |
|------|-------|---------|----------|
| Manual screenshot flow | `TicketOrder` | Buyer pays via WeChat/Alipay, uploads screenshot | Organizer/admin approves |
| Stripe/YooPay/order flow | `Order` + `OrderItem` + `Ticket` | Card/online payments | Auto-issued on payment confirmation |

Both paths generate `Ticket` records with unique `ticket_number` + `qr_token` + `qr_code`. Door staff validate tickets via `POST /ticketing/organizer/validate-ticket` or `POST /tickets/validate`.

Key concepts:
- **TicketTier** — priced inventory buckets per event (GA, VIP, early-bird, etc.).
- **Ticket** — one per attendee; has unique QR code.
- **TicketOrder** — manual-approval order with payment screenshot.
- **Order / OrderItem** — payment-order flow for Stripe/YooPay and the `payments` module.
- **Event.ticket_sales_closed** — manual kill-switch for sales.
- **Event.tickets_sold** — running counter incremented when tickets are generated.

---

## 2. Database Models

### 2.1 Enums

```python
# models.py (excerpt)
import enum

class TicketStatus(str, enum.Enum):
    AVAILABLE = "available"
    SOLD_OUT = "sold_out"
    LIMITED = "limited"
    CLOSED = "closed"
    ENDED = "ended"

class TicketOrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    USED = "used"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentMethod(str, enum.Enum):
    STRIPE = "stripe"
    YOOPAY = "yoopay"
    MANUAL = "manual"
    WECHAT = "wechat"
    ALIPAY = "alipay"
```

### 2.2 Event (ticket-related columns)

```python
class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    # ... other event columns ...

    # Display & Ticket Control options
    show_remaining_tickets = Column(Boolean, default=True)
    ticket_sales_closed = Column(Boolean, default=False, index=True)

    # Stats
    tickets_sold = Column(Integer, default=0, index=True)

    # Social sharing
    share_url = Column(String(500), nullable=True)
    qr_code = Column(Text, nullable=True)

    # Payment QR codes for manual ticketing
    wechat_qr_url = Column(String(500), nullable=True)
    alipay_qr_url = Column(String(500), nullable=True)
    ticket_price = Column(Float, nullable=True)
    payment_instructions = Column(Text, nullable=True)

    # Relationships
    ticket_tiers = relationship("TicketTier", back_populates="event")
    tickets = relationship("Ticket", back_populates="event")
    ticket_orders = relationship("TicketOrder", back_populates="event")
    payment_qr = relationship("EventPaymentQR", back_populates="event", uselist=False)

    # Composite indexes
    __table_args__ = (
        Index('ix_events_status_start_end', status, start_date, end_date),
        Index('ix_events_city_status_start', city, status, start_date),
    )
```

### 2.3 TicketTier

```python
class TicketTier(Base):
    __tablename__ = "ticket_tiers"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))

    name = Column(String(100), nullable=False)
    name_cn = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    price = Column(Float, nullable=False)
    currency = Column(String(3), default="CNY")

    quantity = Column(Integer, nullable=False)
    quantity_sold = Column(Integer, default=0)

    max_per_order = Column(Integer, default=10)

    status = Column(Enum(TicketStatus), default=TicketStatus.AVAILABLE)

    sale_start = Column(DateTime(timezone=True), nullable=True)
    sale_end = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="ticket_tiers")
    tickets = relationship("Ticket", back_populates="ticket_tier")
```

### 2.4 Ticket

```python
class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    ticket_tier_id = Column(Integer, ForeignKey("ticket_tiers.id"), index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    ticket_order_id = Column(Integer, ForeignKey("ticket_orders.id"), nullable=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True, index=True)

    ticket_number = Column(String(50), unique=True, nullable=False)
    qr_token = Column(String(255), unique=True, index=True, nullable=False)
    qr_code = Column(String(1500), nullable=True)

    status = Column(String(50), default="active", index=True)

    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime(timezone=True), nullable=True, index=True)

    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verification_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id], back_populates="tickets")
    ticket_tier = relationship("TicketTier", back_populates="tickets")
    order = relationship("Order", back_populates="tickets")
    ticket_order = relationship("TicketOrder", back_populates="tickets")
    event = relationship("Event", back_populates="tickets")
    verified_by_user = relationship("User", foreign_keys=[verified_by_user_id])
```

### 2.5 Order / OrderItem

```python
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    order_number = Column(String(50), unique=True, nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payment_reference = Column(String(100), nullable=True)
    currency = Column(String(3), default="CNY")

    payment_method = Column(Enum(PaymentMethod), nullable=True)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_id = Column(String(255), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Manual QR Payment Fields (Beta)
    qr_code_url = Column(String(500), nullable=True)
    qr_expires_at = Column(DateTime(timezone=True), nullable=True)
    payment_screenshot_url = Column(String(500), nullable=True)
    screenshot_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Refund
    refund_amount = Column(Float, nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    tickets = relationship("Ticket", back_populates="order")
    items = relationship("OrderItem", back_populates="order")

    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    ticket_tier_id = Column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    ticket_tier = relationship("TicketTier")
    product = relationship("Product")
```

### 2.6 TicketOrder

```python
class TicketOrder(Base):
    """Ticket orders with manual approval"""
    __tablename__ = "ticket_orders"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    payment_screenshot = Column(String(500), nullable=False)
    payment_amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payer_name = Column(String(100), nullable=True)
    payer_notes = Column(Text, nullable=True)
    screenshot_uploaded_at = Column(DateTime(timezone=True), nullable=True)

    # Guest order info
    guest_name = Column(String(150), nullable=True)
    guest_email = Column(String(255), nullable=True)
    guest_phone = Column(String(50), nullable=True)
    is_guest_order = Column(Boolean, default=False)

    status = Column(Enum(TicketOrderStatus), default=TicketOrderStatus.PENDING, index=True)
    quantity = Column(Integer, default=1)
    ticket_tier_id = Column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)

    ticket_qr_code = Column(String(1500), nullable=True)
    ticket_code = Column(String(100), unique=True, nullable=True)

    tickets_generated = Column(Integer, default=0)
    auto_approved = Column(Boolean, default=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    validation_notes = Column(Text, nullable=True)

    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Promoter & Referral tracking
    event_promoter_id = Column(Integer, ForeignKey("event_promoters.id"), nullable=True)
    referral_code = Column(String(50), nullable=True, index=True)
    discount_applied = Column(Float, default=0.0)
    final_amount = Column(Float, nullable=True)

    used_at = Column(DateTime(timezone=True), nullable=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("Event", back_populates="ticket_orders")
    user = relationship("User", foreign_keys=[user_id], back_populates="ticket_orders")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    tickets = relationship("Ticket", back_populates="ticket_order")
    event_promoter = relationship("EventPromoter", back_populates="ticket_orders")
```

### 2.7 EventPaymentQR

```python
class EventPaymentQR(Base):
    """Organizer's payment QR codes for events"""
    __tablename__ = "event_payment_qrs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, unique=True)
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    wechat_pay_qr = Column(String(500), nullable=True)
    alipay_qr = Column(String(500), nullable=True)
    payment_instructions = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("Event", back_populates="payment_qr")
```

---

## 3. Pydantic Schemas

```python
# schemas.py (excerpt)
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from models import EventStatus, TicketStatus, PaymentStatus, PaymentMethod

# ==================== TICKET TIER SCHEMAS ====================

class TicketTierBase(BaseModel):
    name: str
    name_cn: Optional[str] = None
    description: Optional[str] = None
    price: float
    currency: str = "CNY"
    quantity: int
    max_per_order: int = 10
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None


class TicketTierCreate(TicketTierBase):
    pass


class TicketTierResponse(TicketTierBase):
    id: int
    event_id: int
    quantity_sold: int
    status: TicketStatus

    class Config:
        from_attributes = True


# ==================== EVENT SCHEMAS (ticket fields) ====================

class EventBase(BaseModel):
    title: str = Field(..., max_length=255)
    title_cn: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=10000)
    description_cn: Optional[str] = Field(None, max_length=10000)
    start_date: datetime
    end_date: Optional[datetime] = None
    city: City
    address: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, ge=0)
    event_type: Optional[str] = Field(None, max_length=100)
    refund_policy: Optional[str] = Field(None, max_length=2000)
    require_id: Optional[bool] = False
    show_remaining_tickets: Optional[bool] = True
    ticket_sales_closed: Optional[bool] = False
    tags: Optional[List[str]] = None


class EventCreate(EventBase):
    venue_id: Optional[int] = None
    dj_ids: Optional[List[int]] = None
    status: Optional[EventStatus] = None
    flyer_image: Optional[str] = Field(None, max_length=1000)
    gallery_images: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    wechat_qr_url: Optional[str] = Field(None, max_length=1000)
    alipay_qr_url: Optional[str] = Field(None, max_length=1000)
    ticket_price: Optional[float] = Field(None, ge=0)
    payment_instructions: Optional[str] = Field(None, max_length=2000)
    promoter_enabled: Optional[bool] = False
    default_commission_rate: Optional[float] = Field(10.0, ge=0, le=100)
    default_discount_percent: Optional[float] = Field(5.0, ge=0, le=100)
    max_discount_amount: Optional[float] = Field(None, ge=0)


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    title_cn: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=10000)
    description_cn: Optional[str] = Field(None, max_length=10000)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    city: Optional[City] = None
    address: Optional[str] = Field(None, max_length=500)
    capacity: Optional[int] = Field(None, ge=0)
    status: Optional[EventStatus] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    flyer_image: Optional[str] = Field(None, max_length=1000)
    gallery_images: Optional[List[str]] = None
    wechat_qr_url: Optional[str] = Field(None, max_length=1000)
    alipay_qr_url: Optional[str] = Field(None, max_length=1000)
    ticket_price: Optional[float] = Field(None, ge=0)
    payment_instructions: Optional[str] = Field(None, max_length=2000)
    event_type: Optional[str] = Field(None, max_length=100)
    refund_policy: Optional[str] = Field(None, max_length=2000)
    require_id: Optional[bool] = False
    show_remaining_tickets: Optional[bool] = None
    ticket_sales_closed: Optional[bool] = None
    tags: Optional[List[str]] = None
    dj_ids: Optional[List[int]] = None
    promoter_enabled: Optional[bool] = False
    default_commission_rate: Optional[float] = 10.0
    default_discount_percent: Optional[float] = 5.0
    max_discount_amount: Optional[float] = None


class EventResponse(EventBase):
    id: int
    organizer_id: Optional[int] = None
    venue_id: Optional[int] = None
    flyer_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    status: EventStatus
    views_count: int
    tickets_sold: int
    share_url: Optional[str] = None
    qr_code: Optional[str] = None
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    ticket_price: Optional[float] = None
    payment_instructions: Optional[str] = None
    event_type: Optional[str] = None
    refund_policy: Optional[str] = None
    require_id: Optional[bool] = False
    show_remaining_tickets: bool = True
    ticket_sales_closed: bool = False
    tags: Optional[List[str]] = None
    promoter_enabled: bool = False
    default_commission_rate: float = 10.0
    default_discount_percent: float = 5.0
    max_discount_amount: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    venue: Optional[VenueResponse] = None
    business: Optional[EventBusiness] = None
    djs: Optional[List[ArtistProfileResponse]] = None
    vendors: Optional[List[EventVendorResponse]] = None
    ticket_tiers: Optional[List["TicketTierResponse"]] = None
    organizer_plan: Optional[str] = "basic"


class EventListResponse(BaseModel):
    id: int
    title: str
    start_date: datetime
    end_date: Optional[datetime] = None
    city: City
    address: Optional[str] = None
    flyer_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    status: EventStatus
    tickets_sold: int
    capacity: Optional[int] = None
    views_count: int = 0
    is_featured: bool = False
    event_type: Optional[str] = None
    tags: Optional[List[str]] = None
    ticket_tiers: Optional[List[TicketTierResponse]] = None
    venue: Optional[VenueResponse] = None
    promoter_enabled: bool = False

    class Config:
        from_attributes = True


# ==================== TICKET SCHEMAS ====================

class TicketResponse(BaseModel):
    id: int
    user_id: int
    ticket_tier_id: int
    order_id: int
    ticket_number: str
    qr_code: Optional[str] = None
    is_used: bool
    used_at: Optional[datetime] = None
    created_at: datetime

    event: Optional["EventListResponse"] = None
    ticket_tier: Optional["TicketTierResponse"] = None

    event_id: Optional[int] = None

    @classmethod
    def from_orm(cls, obj):
        result = super().from_orm(obj)
        if obj.ticket_tier and obj.ticket_tier.event:
            result.event_id = obj.ticket_tier.event.id
        return result

    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    ticket_tier: TicketTierResponse
    event: Optional[EventListResponse] = None


# ==================== ORDER SCHEMAS ====================

class OrderItem(BaseModel):
    ticket_tier_id: int
    quantity: int


class OrderCreate(BaseModel):
    event_id: int
    items: List[OrderItem]
    payment_method: Optional[PaymentMethod] = None
    attendee_info: Optional[dict] = None


class OrderResponse(BaseModel):
    id: int
    user_id: int
    order_number: str
    total_amount: float
    currency: str
    payment_method: Optional[PaymentMethod] = None
    payment_status: PaymentStatus
    paid_at: Optional[datetime] = None
    created_at: datetime

    qr_code_url: Optional[str] = None
    qr_expires_at: Optional[datetime] = None
    screenshot_uploaded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True


class OrderDetailResponse(OrderResponse):
    tickets: List[TicketResponse]


# ==================== QR CODE SCHEMAS ====================

class QRValidateRequest(BaseModel):
    ticket_number: str


class QRValidateResponse(BaseModel):
    valid: bool
    ticket: Optional[TicketResponse] = None
    message: str
```

---

## 4. Ticketing Service

`services/ticketing_service.py` — core ticket generation, QR creation, stale-order cleanup.

```python
"""
Ticketing Service - Hybrid payment logic, auto-approval, and ticket generation
"""
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
from sqlalchemy.orm import Session
import uuid
import qrcode
import io
import base64

from models import Event, TicketOrder, TicketOrderStatus, Ticket, TicketStatus, TicketTier, OrganizerProfile, User
from services.sms_notifications import (
    notify_user_order_cancelled,
)
from api.notifications import create_notification as _create_notification


def get_event_organizer_plan(db: Session, event_id: int) -> str:
    """Return the subscription plan name of the event organizer (defaults to 'free')."""
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return "free"
        organizer = db.query(OrganizerProfile).filter(
            OrganizerProfile.id == event.organizer_id
        ).first()
        if not organizer:
            return "free"
        user = db.query(User).filter(User.id == organizer.user_id).first()
        if not user:
            return "free"
        if hasattr(user, "subscription") and user.subscription:
            plan = user.subscription
            if hasattr(plan, "plan_type"):
                return plan.plan_type.value if hasattr(plan.plan_type, "value") else str(plan.plan_type)
        return "free"
    except Exception:
        return "free"


def get_ticket_price(db: Session, order: TicketOrder, event: Event) -> float:
    """Get the unit ticket price for an order"""
    if order.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == order.ticket_tier_id).first()
        if tier:
            return tier.price
    if event.ticket_price is not None:
        return event.ticket_price
    return 0.0


def _generate_qr_code(ticket_code: str) -> str:
    """Generate a base64 PNG QR code for a ticket code"""
    qr_data = ticket_code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"


def generate_tickets_from_order(
    db: Session,
    order: TicketOrder,
    event: Event,
    reviewed_by: Optional[int] = None,
    auto_approved: bool = False
) -> Tuple[int, list]:
    """
    Generate individual Ticket records for an approved TicketOrder.
    Returns (count_generated, list_of_tickets).
    """
    if order.tickets_generated and order.tickets_generated > 0:
        existing = db.query(Ticket).filter(Ticket.ticket_order_id == order.id).all()
        return len(existing), existing

    unit_price = get_ticket_price(db, order, event)
    quantity = order.quantity or 1
    tickets_to_generate = quantity

    generated = []
    for i in range(tickets_to_generate):
        ticket_code = f"TKT-{event.id}-{order.user_id}-{uuid.uuid4().hex[:8].upper()}-{i+1}"
        qr_token = f"qr-{uuid.uuid4().hex}"
        qr_code = _generate_qr_code(ticket_code)

        ticket = Ticket(
            user_id=order.user_id,
            event_id=event.id,
            ticket_tier_id=order.ticket_tier_id,
            ticket_order_id=order.id,
            ticket_number=ticket_code,
            qr_token=qr_token,
            qr_code=qr_code,
            status="active",
            is_used=False,
        )
        db.add(ticket)
        generated.append(ticket)

    order.tickets_generated = tickets_to_generate
    order.status = TicketOrderStatus.APPROVED
    order.auto_approved = auto_approved
    if reviewed_by:
        order.reviewed_by = reviewed_by
    order.reviewed_at = datetime.now(timezone.utc)

    if generated:
        order.ticket_code = generated[0].ticket_number
        order.ticket_qr_code = generated[0].qr_code

    if event.tickets_sold is None:
        event.tickets_sold = 0
    event.tickets_sold += tickets_to_generate

    if order.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == order.ticket_tier_id).with_for_update().first()
        if tier:
            tier.quantity_sold = (tier.quantity_sold or 0) + tickets_to_generate
            if tier.quantity_sold >= tier.quantity:
                tier.status = TicketStatus.SOLD_OUT

    db.commit()

    for t in generated:
        db.refresh(t)

    return tickets_to_generate, generated


def cancel_stale_orders(db: Session, hours: int = 24) -> int:
    """
    Cancel pending ticket orders older than N hours.
    Returns number of orders cancelled.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    stale_orders = db.query(TicketOrder).filter(
        TicketOrder.status == TicketOrderStatus.PENDING,
        TicketOrder.created_at < cutoff
    ).all()

    count = 0
    for order in stale_orders:
        order.status = TicketOrderStatus.CANCELLED
        order.cancelled_at = datetime.now(timezone.utc)
        order.validation_notes = "Auto-cancelled: order expired without approval"

        _create_notification(
            db=db,
            user_id=order.user_id,
            title="Ticket Order Cancelled",
            message="Your ticket order was cancelled because the payment was not confirmed in time.",
            notification_type="ticket_cancelled",
            data={"order_id": order.id, "event_id": order.event_id}
        )
        notify_user_order_cancelled(
            db=db,
            user_id=order.user_id,
            event_title=None
        )
        count += 1

    db.commit()
    return count
```


---

## 5. Backend API — Tickets (`api/tickets.py`)

User-facing ticket order flow + business approval endpoints.

```python
"""
Tickets API - User-facing ticket order and business approval management
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, desc, func
from typing import List, Optional
from datetime import datetime, timezone, date, timedelta
import uuid
import qrcode
import io
import base64
import os
import shutil
import hashlib

from database import get_db
from auth import get_current_user, require_organizer
from models import (
    User, Event, TicketOrder, TicketOrderStatus, Ticket, TicketStatus, UserRole, Notification,
    OrganizerFollow, OrganizerProfile, TicketTier,
    EventPromoter, EventPromoterStatus, PromoterReferral, PromoterProfile
)
from services.ticketing_service import (
    get_event_organizer_plan,
    generate_tickets_from_order
)
from email_service import send_ticket_approved_email
from services.sms_notifications import notify_user_ticket_approved, notify_user_ticket_rejected

router = APIRouter(prefix="/tickets", tags=["Tickets"])

from utils.upload_storage import get_upload_dir


def _create_notification(db: Session, user_id: int, title: str, message: str, notification_type: str, entity_type: str = None, entity_id: int = None):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        entity_type=entity_type,
        entity_id=entity_id,
        is_read=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(notification)
    db.commit()


def _apply_referral_discount(
    db: Session, event: Event, order: TicketOrder, referral_code: Optional[str]
) -> None:
    """Apply referral discount and link promoter to order."""
    if not referral_code:
        order.final_amount = order.payment_amount
        return

    code = referral_code.upper().strip()
    ep = db.query(EventPromoter).filter(
        EventPromoter.referral_code == code,
        EventPromoter.event_id == event.id,
        EventPromoter.status == EventPromoterStatus.ACTIVE
    ).first()

    if not ep:
        order.final_amount = order.payment_amount
        return

    discount_pct = ep.discount_percent if ep.discount_percent is not None else event.default_discount_percent
    if discount_pct:
        discount = order.payment_amount * (discount_pct / 100)
        max_disc = ep.max_discount_amount if ep.max_discount_amount is not None else event.max_discount_amount
        if max_disc and discount > max_disc:
            discount = max_disc
        order.discount_applied = round(discount, 2)
        order.final_amount = round(order.payment_amount - discount, 2)
    else:
        order.final_amount = order.payment_amount

    order.referral_code = code
    order.event_promoter_id = ep.id


def _track_conversion_on_approval(db: Session, order: TicketOrder) -> None:
    """Track commission when an order with a referral is approved."""
    if not order.event_promoter_id or not order.referral_code:
        return

    ep = db.query(EventPromoter).filter(EventPromoter.id == order.event_promoter_id).first()
    if not ep or ep.status != EventPromoterStatus.ACTIVE:
        return

    event = db.query(Event).filter(Event.id == order.event_id).first()
    commission_rate = ep.commission_rate if ep.commission_rate is not None else (event.default_commission_rate if event else 10.0)
    commission_amount = round((order.final_amount or order.payment_amount) * (commission_rate / 100), 2)

    ep.conversions = (ep.conversions or 0) + 1
    ep.tickets_sold = (ep.tickets_sold or 0) + (order.quantity or 1)
    ep.revenue_generated = (ep.revenue_generated or 0) + (order.final_amount or order.payment_amount)
    ep.commission_earned = (ep.commission_earned or 0) + commission_amount

    promoter = db.query(PromoterProfile).filter(PromoterProfile.id == ep.promoter_id).first()
    if promoter:
        promoter.total_conversions = (promoter.total_conversions or 0) + 1
        promoter.total_sales = (promoter.total_sales or 0) + (order.final_amount or order.payment_amount)
        promoter.total_commission = (promoter.total_commission or 0) + commission_amount
        promoter.pending_commission = (promoter.pending_commission or 0) + commission_amount

    referral = db.query(PromoterReferral).filter(
        PromoterReferral.referral_code == order.referral_code,
        PromoterReferral.event_id == order.event_id,
        PromoterReferral.converted == False
    ).order_by(PromoterReferral.created_at.desc()).first()

    if referral:
        referral.converted = True
        referral.ticket_order_id = order.id
        referral.conversion_value = order.final_amount or order.payment_amount
        referral.commission_amount = commission_amount
        referral.converted_at = datetime.now(timezone.utc)

    db.commit()


@router.post("/order")
def create_ticket_order(
    event_id: int = Form(...),
    payer_name: str = Form(...),
    email: Optional[str] = Form(None),
    phone_number: Optional[str] = Form(None),
    quantity: int = Form(1),
    payment_amount: Optional[float] = Form(None),
    ticket_tier_id: Optional[int] = Form(None),
    payer_notes: Optional[str] = Form(None),
    payment_reference: Optional[str] = Form(None),
    referral_code: Optional[str] = Form(None),
    payment_screenshot: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a ticket order after external payment. Order stays PENDING until organizer approves."""
    event = db.query(Event).filter(Event.id == event_id).with_for_update().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    # 1. Manual closing check
    if getattr(event, 'ticket_sales_closed', False):
        raise HTTPException(status_code=400, detail="Ticket sales for this event have been closed by the organizer.")

    # 2. Automated event end date check
    now_utc = datetime.now(timezone.utc)
    event_end_time = event.end_date or event.start_date
    if event_end_time:
        if event_end_time.tzinfo is None:
            event_end_time = event_end_time.replace(tzinfo=timezone.utc)
        if now_utc > event_end_time:
            raise HTTPException(status_code=400, detail="Ticket sales for this event have closed because the event has ended.")

    # 3. Determine ticket price & validate tier
    unit_price = event.ticket_price or 0
    if ticket_tier_id:
        tier = db.query(TicketTier).filter(
            TicketTier.id == ticket_tier_id,
            TicketTier.event_id == event_id
        ).with_for_update().first()
        if tier:
            unit_price = tier.price
            if tier.status in (TicketStatus.SOLD_OUT, TicketStatus.CLOSED, TicketStatus.ENDED):
                raise HTTPException(status_code=400, detail=f"Ticket sales for '{tier.name}' are closed.")
            if tier.sale_end:
                sale_end_time = tier.sale_end
                if sale_end_time.tzinfo is None:
                    sale_end_time = sale_end_time.replace(tzinfo=timezone.utc)
                if now_utc > sale_end_time:
                    raise HTTPException(status_code=400, detail=f"Ticket sales for '{tier.name}' have ended.")

    expected_amount = unit_price * quantity
    actual_payment_amount = payment_amount if payment_amount is not None else expected_amount

    # Capacity check (event-level)
    current_sold = event.tickets_sold or 0
    max_capacity = event.capacity or 0
    if max_capacity > 0 and (current_sold + quantity) > max_capacity:
        raise HTTPException(status_code=400, detail=f"Only {max_capacity - current_sold} tickets remaining")

    # Tier-level capacity check
    if ticket_tier_id:
        tier = db.query(TicketTier).filter(
            TicketTier.id == ticket_tier_id,
            TicketTier.event_id == event_id
        ).with_for_update().first()
        if tier:
            tier_remaining = (tier.quantity or 0) - (tier.quantity_sold or 0)
            if tier_remaining < quantity:
                raise HTTPException(status_code=400, detail=f"Only {tier_remaining} tickets remaining for this tier")

    # Velocity check (prevent double submission)
    last_minute_order = db.query(TicketOrder).filter(
        TicketOrder.user_id == current_user.id,
        TicketOrder.event_id == event_id,
        TicketOrder.created_at >= datetime.now(timezone.utc) - timedelta(seconds=60)
    ).first()
    if last_minute_order:
        raise HTTPException(status_code=400, detail="You just submitted a similar order. Please wait a minute or check your tickets.")

    order = TicketOrder(
        event_id=event_id,
        user_id=current_user.id,
        ticket_tier_id=ticket_tier_id,
        payment_amount=actual_payment_amount,
        payment_date=date.today(),
        payer_name=payer_name,
        payer_notes=payer_notes,
        quantity=quantity,
        payment_reference=payment_reference,
        status=TicketOrderStatus.PENDING
    )

    _apply_referral_discount(db, event, order, referral_code)

    # Handle screenshot upload
    if payment_screenshot:
        upload_dir = get_upload_dir("payment_proofs")
        os.makedirs(upload_dir, exist_ok=True)
        file_ext = payment_screenshot.filename.split(".")[-1] if payment_screenshot.filename else "jpg"
        filename = f"ticket_order_{uuid.uuid4().hex}.{file_ext}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(payment_screenshot.file, buffer)

        order.payment_screenshot = f"/static/uploads/payment_proofs/{filename}"
        order.screenshot_uploaded_at = datetime.now(timezone.utc)

    db.add(order)
    db.commit()
    db.refresh(order)

    # Auto-follow event organizer if exists
    if event.organizer_id:
        existing_follow = db.query(OrganizerFollow).filter(
            OrganizerFollow.user_id == current_user.id,
            OrganizerFollow.organizer_id == event.organizer_id
        ).first()
        if not existing_follow:
            follow = OrganizerFollow(user_id=current_user.id, organizer_id=event.organizer_id)
            db.add(follow)
            db.commit()

    return {
        "message": "Order submitted successfully. Your ticket will be issued after organizer confirmation.",
        "order_id": order.id,
        "status": order.status.value,
        "quantity": quantity,
        "auto_approved": False,
    }


@router.post("/guest-order")
def create_guest_ticket_order(
    event_id: int = Form(...),
    payer_name: str = Form(...),
    email: str = Form(...),
    phone_number: str = Form(...),
    quantity: int = Form(1),
    payment_amount: Optional[float] = Form(None),
    ticket_tier_id: Optional[int] = Form(None),
    payer_notes: Optional[str] = Form(None),
    payment_reference: Optional[str] = Form(None),
    referral_code: Optional[str] = Form(None),
    payment_screenshot: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """Create a ticket order without user account (guest checkout)."""
    raise HTTPException(status_code=403, detail="Guest checkout is disabled. Please create an account to purchase tickets.")


@router.get("/my-orders")
def get_my_ticket_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all my ticket orders"""
    orders = db.query(TicketOrder).options(
        joinedload(TicketOrder.event)
    ).filter(
        TicketOrder.user_id == current_user.id
    ).order_by(desc(TicketOrder.created_at)).all()

    result = []
    for order in orders:
        event = order.event
        result.append({
            "id": order.id,
            "event": {
                "id": event.id if event else None,
                "title": event.title if event else None,
                "start_date": event.start_date.isoformat() if event and event.start_date else None,
                "flyer_image": event.flyer_image if event else None,
            },
            "payment_amount": order.payment_amount,
            "quantity": order.quantity or 1,
            "status": order.status.value,
            "ticket_code": order.ticket_code,
            "ticket_qr": order.ticket_qr_code,
            "tickets_generated": order.tickets_generated,
            "auto_approved": order.auto_approved,
            "rejection_reason": order.rejection_reason,
            "payer_name": order.payer_name,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    return {"orders": result}


@router.get("/my-orders/{order_id}/tickets")
def get_my_order_tickets(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get individual tickets generated from a ticket order"""
    order = db.query(TicketOrder).filter(
        TicketOrder.id == order_id,
        TicketOrder.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    tickets = db.query(Ticket).filter(
        Ticket.ticket_order_id == order_id
    ).all()

    return {
        "order_id": order_id,
        "tickets": [
            {
                "id": t.id,
                "ticket_number": t.ticket_number,
                "qr_token": t.qr_token,
                "qr_code": t.qr_code,
                "status": t.status,
                "is_used": t.is_used,
                "event_id": t.event_id,
            }
            for t in tickets
        ]
    }


@router.get("/business/tickets")
def get_business_ticket_orders(
    status: Optional[str] = None,
    event_id: Optional[int] = None,
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Get all ticket orders for business events. Admins see all orders."""
    from api.events import get_user_organizer_ids

    # Admins/super_admins can see ALL ticket orders across the platform
    if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        query = db.query(TicketOrder)
    else:
        organizer_ids = get_user_organizer_ids(current_user, db)
        events = db.query(Event).filter(Event.organizer_id.in_(organizer_ids)).all()
        event_ids = [e.id for e in events]

        if not event_ids:
            return {"orders": []}

        query = db.query(TicketOrder).filter(TicketOrder.event_id.in_(event_ids))

    if status:
        query = query.filter(TicketOrder.status == TicketOrderStatus(status))
    if event_id:
        query = query.filter(TicketOrder.event_id == event_id)

    orders = query.options(
        joinedload(TicketOrder.event),
        joinedload(TicketOrder.user),
    ).order_by(desc(TicketOrder.created_at)).all()

    tier_ids = [o.ticket_tier_id for o in orders if o.ticket_tier_id]
    tiers = {}
    if tier_ids:
        for tier in db.query(TicketTier).filter(TicketTier.id.in_(tier_ids)).all():
            tiers[tier.id] = tier

    order_ids = [o.id for o in orders]
    tickets_by_order = {}
    if order_ids:
        for ticket in db.query(Ticket).filter(Ticket.ticket_order_id.in_(order_ids)).all():
            if ticket.ticket_order_id not in tickets_by_order:
                tickets_by_order[ticket.ticket_order_id] = []
            tickets_by_order[ticket.ticket_order_id].append({
                "id": ticket.id,
                "ticket_number": ticket.ticket_number,
                "qr_code": ticket.qr_code,
                "qr_token": ticket.qr_token,
                "is_used": ticket.is_used,
                "used_at": ticket.used_at.isoformat() if ticket.used_at else None,
                "status": ticket.status,
            })

    result = []
    for order in orders:
        event = order.event
        user = order.user
        plan = get_event_organizer_plan(db, order.event_id)
        ticket_tier = tiers.get(order.ticket_tier_id) if order.ticket_tier_id else None

        display_name = order.guest_name if order.is_guest_order else (
            f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email or user.phone or user.username or f"User #{user.id}"
            if user else None
        )
        display_email = order.guest_email if order.is_guest_order else (user.email if user else None)
        display_phone = order.guest_phone if order.is_guest_order else (user.phone if user else None)
        result.append({
            "id": order.id,
            "event": {
                "id": event.id if event else None,
                "title": event.title if event else None,
            },
            "user": {
                "id": user.id if user else None,
                "name": display_name,
                "email": display_email,
                "phone": display_phone,
                "username": user.username if user else None,
            },
            "payment_amount": order.payment_amount,
            "quantity": order.quantity or 1,
            "payer_name": order.payer_name,
            "payment_screenshot": order.payment_screenshot,
            "status": order.status.value,
            "plan": plan,
            "auto_approved": order.auto_approved,
            "ticket_code": order.ticket_code,
            "ticket_qr": order.ticket_qr_code,
            "tickets_generated": order.tickets_generated,
            "validation_notes": order.validation_notes,
            "used_at": order.used_at.isoformat() if order.used_at else None,
            "used_by": order.used_by,
            "is_guest_order": order.is_guest_order,
            "guest_name": order.guest_name,
            "guest_email": order.guest_email,
            "guest_phone": order.guest_phone,
            "ticket_tier": {
                "id": ticket_tier.id if ticket_tier else None,
                "name": ticket_tier.name if ticket_tier else None,
            } if ticket_tier else None,
            "tickets": tickets_by_order.get(order.id, []),
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    return {"orders": result}


@router.post("/{order_id}/approve")
def approve_ticket_order(
    order_id: int,
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Approve a ticket order and generate ticket QR(s)."""
    order = db.query(TicketOrder).filter(TicketOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    event = db.query(Event).filter(Event.id == order.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    from api.events import get_organizer_profile_id
    organizer_id = get_organizer_profile_id(current_user, db)
    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only event organizer can approve")

    if order.status != TicketOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")

    if order.tickets_generated and order.tickets_generated > 0:
        raise HTTPException(status_code=400, detail="Tickets already generated for this order")

    count, tickets = generate_tickets_from_order(
        db, order, event, reviewed_by=current_user.id, auto_approved=False
    )

    _track_conversion_on_approval(db, order)

    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Ticket Approved",
        message=f"Your ticket for '{event.title}' has been approved. Show your QR code at the entrance.",
        notification_type="ticket_approved",
        entity_type="ticket_order",
        entity_id=order.id
    )

    # Send email confirmation with ALL ticket QR codes
    try:
        event_date_str = ""
        if event.start_date:
            event_date_str = event.start_date.strftime("%A, %B %d, %Y at %H:%M") if hasattr(event.start_date, 'strftime') else str(event.start_date)
        ticket_list = [
            {"ticket_number": t.ticket_number, "qr_code": t.qr_code}
            for t in tickets if t.qr_code
        ]
        if order.is_guest_order and order.guest_email:
            send_ticket_approved_email(
                to_email=order.guest_email,
                first_name=order.guest_name or "",
                event_title=event.title or "",
                event_date=event_date_str,
                event_venue=event.venue or event.address or "",
                tickets=ticket_list,
                quantity=order.quantity or 1
            )
        else:
            buyer = db.query(User).filter(User.id == order.user_id).first()
            if buyer and buyer.email:
                send_ticket_approved_email(
                    to_email=buyer.email,
                    first_name=buyer.first_name or "",
                    event_title=event.title or "",
                    event_date=event_date_str,
                    event_venue=event.venue or event.address or "",
                    tickets=ticket_list,
                    quantity=order.quantity or 1
                )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to send ticket approval email: {e}")

    if not order.is_guest_order:
        notify_user_ticket_approved(
            db=db,
            user_id=order.user_id,
            event_title=event.title or "",
            quantity=order.quantity or 1,
            ticket_code=order.ticket_code
        )

    return {
        "message": f"Ticket approved. Generated {count} ticket(s).",
        "order_id": order.id,
        "ticket_code": order.ticket_code,
        "ticket_qr": order.ticket_qr_code,
        "tickets_count": count,
    }


@router.post("/{order_id}/reject")
def reject_ticket_order(
    order_id: int,
    reason: str = Form(...),
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Reject a ticket order"""
    order = db.query(TicketOrder).filter(TicketOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    event = db.query(Event).filter(Event.id == order.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    from api.events import get_organizer_profile_id
    organizer_id = get_organizer_profile_id(current_user, db)
    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only event organizer can reject")

    if order.status != TicketOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")

    order.status = TicketOrderStatus.REJECTED
    order.rejection_reason = reason
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)

    db.commit()

    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Ticket Rejected",
        message=f"Your ticket request for '{event.title}' was rejected. Reason: {reason}",
        notification_type="ticket_rejected",
        entity_type="ticket_order",
        entity_id=order.id
    )

    notify_user_ticket_rejected(
        db=db,
        user_id=order.user_id,
        event_title=event.title or "",
        reason=reason
    )

    return {"message": "Ticket rejected", "order_id": order.id, "reason": reason}


@router.post("/validate")
def validate_ticket_order(
    ticket_code: str = Form(...),
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Validate a ticket order QR code at event entry"""
    import logging
    logger = logging.getLogger(__name__)

    ticket_code = ticket_code.strip()
    logger.info(f"Validating ticket (fallback endpoint): '{ticket_code}'")

    order = db.query(TicketOrder).filter(
        func.lower(TicketOrder.ticket_code) == func.lower(ticket_code)
    ).first()

    if order:
        if order.status == TicketOrderStatus.USED:
            raise HTTPException(status_code=409, detail="Ticket already used")

        if order.status != TicketOrderStatus.APPROVED:
            raise HTTPException(status_code=400, detail=f"Ticket is {order.status.value}")

        event = db.query(Event).filter(Event.id == order.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        from api.events import get_organizer_profile_id
        organizer_id = get_organizer_profile_id(current_user, db)
        if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            raise HTTPException(status_code=403, detail="Only event organizer can validate tickets")

        order.status = TicketOrderStatus.USED
        order.used_at = datetime.now(timezone.utc)
        order.used_by = current_user.id

        db.commit()

        user = db.query(User).filter(User.id == order.user_id).first()

        return {
            "valid": True,
            "ticket_code": ticket_code,
            "event": event.title if event else None,
            "user": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "used_at": order.used_at.isoformat(),
        }

    ticket = db.query(Ticket).filter(
        func.lower(Ticket.ticket_number) == func.lower(ticket_code)
    ).first()

    if not ticket:
        ticket = db.query(Ticket).filter(
            func.lower(Ticket.qr_token) == func.lower(ticket_code)
        ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Invalid ticket")

    if ticket.is_used:
        raise HTTPException(status_code=409, detail="Ticket already used")

    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    from api.events import get_organizer_profile_id
    organizer_id = get_organizer_profile_id(current_user, db)
    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only event organizer can validate tickets")

    ticket.is_used = True
    ticket.used_at = datetime.now(timezone.utc)
    ticket.status = "used"

    if ticket.ticket_order_id:
        order = db.query(TicketOrder).filter(TicketOrder.id == ticket.ticket_order_id).first()
        if order:
            unused_count = db.query(Ticket).filter(
                Ticket.ticket_order_id == order.id,
                Ticket.is_used == False
            ).count()
            if unused_count == 0:
                order.status = TicketOrderStatus.USED
                order.used_at = datetime.now(timezone.utc)
                order.used_by = current_user.id

    db.commit()

    user = db.query(User).filter(User.id == ticket.user_id).first()

    return {
        "valid": True,
        "ticket_code": ticket.ticket_number,
        "event": event.title if event else None,
        "user": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
        "used_at": ticket.used_at.isoformat(),
    }


@router.post("/events/{event_id}/toggle-sales")
def toggle_event_ticket_sales(
    event_id: int,
    closed: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually toggle or set ticket sales closed/opened status for an event."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    from api.events import get_organizer_profile_id
    organizer_id = get_organizer_profile_id(current_user, db)
    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only event organizer can toggle ticket sales")

    if closed is not None:
        event.ticket_sales_closed = closed
    else:
        event.ticket_sales_closed = not getattr(event, 'ticket_sales_closed', False)

    db.commit()
    db.refresh(event)

    status_str = "closed" if event.ticket_sales_closed else "opened"
    return {
        "message": f"Ticket sales for '{event.title}' are now {status_str}.",
        "ticket_sales_closed": event.ticket_sales_closed,
        "event_id": event.id
    }


@router.put("/tiers/{tier_id}/status")
def update_ticket_tier_status(
    tier_id: int,
    status_val: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a specific ticket tier status (available, sold_out, limited, closed, ended)."""
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Ticket tier not found")

    event = db.query(Event).filter(Event.id == tier.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    from api.events import get_organizer_profile_id
    organizer_id = get_organizer_profile_id(current_user, db)
    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only event organizer can update ticket tier status")

    clean_status = status_val.lower().strip()
    try:
        tier.status = TicketStatus(clean_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status '{status_val}'. Valid values: available, sold_out, limited, closed, ended")

    db.commit()
    db.refresh(tier)

    return {
        "message": f"Ticket tier '{tier.name}' status updated to {tier.status.value}",
        "tier_id": tier.id,
        "status": tier.status.value
    }
```


---

## 6. Backend API — Organizer Ticketing (`api/ticketing_organizer.py`)

Organizer/staff ticket management: list orders, approve/reject, guest orders, primary QR scan endpoint.

```python
"""
Ticketing Organizer API - Ticket approval and management
"""
from fastapi import APIRouter, Depends, HTTPException, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, func
from typing import List, Optional
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs
import re
import json

from database import get_db
from auth import get_current_user
from models import (
    User, Event, TicketOrder, TicketOrderStatus, UserRole, Ticket, TicketTier,
    OrganizerProfile, StaffMember
)
from api.tickets import approve_ticket_order as approve_ticket_order_core
from config import get_settings


def _get_user_organizer_id(current_user: User, db: Session) -> Optional[int]:
    if current_user.organizer_profile:
        return current_user.organizer_profile.id
    if current_user.business_profile:
        if hasattr(current_user.business_profile, 'organizer_profiles') and current_user.business_profile.organizer_profiles:
            return current_user.business_profile.organizer_profiles[0].id
        from models import OrganizerProfile
        organizer = OrganizerProfile(
            user_id=current_user.id,
            business_profile_id=current_user.business_profile.id,
            organization_name=current_user.business_profile.business_name,
            is_verified=current_user.business_profile.is_verified,
            is_approved=current_user.business_profile.is_approved
        )
        db.add(organizer)
        db.commit()
        db.refresh(organizer)
        return organizer.id
    return None


def _get_user_organizer_ids(current_user: User, db: Session) -> List[int]:
    """Get ALL organizer profile IDs associated with the user for robust ownership checks.
    Includes organizer profiles of businesses where the user is an active staff member."""
    organizer_ids = []
    if current_user.organizer_profile:
        organizer_ids.append(current_user.organizer_profile.id)
    if current_user.business_profile and current_user.business_profile.organizer_profiles:
        for org in current_user.business_profile.organizer_profiles:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)
    if not organizer_ids:
        direct_orgs = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == current_user.id).all()
        for org in direct_orgs:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    staff_roles = db.query(StaffMember).filter(
        StaffMember.user_id == current_user.id,
        StaffMember.status == "Active"
    ).all()
    for staff in staff_roles:
        business_orgs = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == staff.business_id).all()
        for org in business_orgs:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    return organizer_ids


def _normalize_ticket_candidates(raw_value: str) -> tuple[List[str], Optional[int], Optional[int]]:
    """Normalize ticket input and extract event_id / ticket_id when available."""
    value = (raw_value or "").strip()
    if not value:
        return [], None, None

    candidates: List[str] = [value]
    event_id: Optional[int] = None
    ticket_id: Optional[int] = None

    # SOUNDIT:<ticket_code>:<event_id>[:TID:<ticket_id>:UID:<user_ref>]
    if value.upper().startswith("SOUNDIT:"):
        parts = value.split(":")
        if len(parts) > 1 and parts[1].strip():
            candidates.append(parts[1].strip())
        if len(parts) > 2 and parts[2].strip().isdigit():
            event_id = int(parts[2].strip())
        if len(parts) > 4 and parts[3].strip().upper() == "TID" and parts[4].strip().isdigit():
            ticket_id = int(parts[4].strip())

    # JSON payload support
    if value.startswith("{") and value.endswith("}"):
        try:
            payload = json.loads(value)
            if isinstance(payload, dict):
                for key in ("ticket_code", "ticket_number", "ticket", "qr_token", "token"):
                    raw_candidate = payload.get(key)
                    if raw_candidate is not None and str(raw_candidate).strip():
                        candidates.append(str(raw_candidate).strip())

                raw_event_id = payload.get("event_id") or payload.get("eid")
                if raw_event_id is not None and str(raw_event_id).isdigit():
                    event_id = int(str(raw_event_id))

                raw_ticket_id = payload.get("ticket_id") or payload.get("tid")
                if raw_ticket_id is not None and str(raw_ticket_id).isdigit():
                    ticket_id = int(str(raw_ticket_id))
        except Exception:
            pass

    validate_match = re.search(r"/validate/([^/?#]+)", value, re.IGNORECASE)
    if validate_match and validate_match.group(1).strip():
        candidates.append(validate_match.group(1).strip())

    try:
        parsed = urlparse(value)
        query = parse_qs(parsed.query or "")
        for key in ("ticket_code", "ticket", "token"):
            vals = query.get(key)
            if vals and vals[0].strip():
                candidates.append(vals[0].strip())
    except Exception:
        pass

    deduped: List[str] = []
    seen = set()
    for item in candidates:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped, event_id, ticket_id


def _is_event_share_qr(raw_value: str) -> bool:
    value = (raw_value or "").strip().lower()
    return "/events/" in value and "/validate/" not in value


class GuestOrderCreate(BaseModel):
    event_id: int
    guest_name: str
    guest_email: str
    guest_phone: Optional[str] = None
    quantity: int = 1
    ticket_tier_id: Optional[int] = None


router = APIRouter(prefix="/ticketing/organizer", tags=["Ticketing Organizer"])


@router.get("/orders")
def get_organizer_orders(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all ticket orders for organizer's events"""
    organizer_ids = _get_user_organizer_ids(current_user, db)
    if not organizer_ids:
        return {"orders": []}
    events = db.query(Event).filter(Event.organizer_id.in_(organizer_ids)).all()
    event_ids = [e.id for e in events]

    if not event_ids:
        return {"orders": []}

    query = db.query(TicketOrder).filter(TicketOrder.event_id.in_(event_ids))

    if status:
        query = query.filter(TicketOrder.status == TicketOrderStatus(status))

    orders = query.order_by(desc(TicketOrder.created_at)).all()

    result = []
    for order in orders:
        event = db.query(Event).filter(Event.id == order.event_id).first()
        user = db.query(User).filter(User.id == order.user_id).first()

        display_name = order.guest_name if order.is_guest_order else (
            f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email or user.phone or user.username or f"User #{user.id}"
            if user else None
        )
        display_email = order.guest_email if order.is_guest_order else (user.email if user else None)
        display_phone = order.guest_phone if order.is_guest_order else (user.phone if user else None)
        result.append({
            "id": order.id,
            "event": {
                "id": event.id if event else None,
                "title": event.title if event else None,
            },
            "user": {
                "id": user.id if user else None,
                "name": display_name,
                "email": display_email,
                "phone": display_phone,
                "username": user.username if user else None,
            },
            "payment_amount": order.payment_amount,
            "payer_name": order.payer_name,
            "payment_screenshot": order.payment_screenshot,
            "status": order.status.value,
            "auto_approved": order.auto_approved,
            "tickets_generated": order.tickets_generated,
            "ticket_code": order.ticket_code,
            "is_guest_order": order.is_guest_order,
            "guest_name": order.guest_name,
            "guest_email": order.guest_email,
            "guest_phone": order.guest_phone,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    return {"orders": result}


@router.post("/orders/{order_id}/approve")
def approve_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Legacy compatibility endpoint delegated to the canonical Tickets API flow."""
    return approve_ticket_order_core(order_id=order_id, current_user=current_user, db=db)


@router.post("/orders/{order_id}/reject")
def reject_order(
    order_id: int,
    reason: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a ticket order"""
    order = db.query(TicketOrder).filter(TicketOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    event = db.query(Event).filter(Event.id == order.event_id).first()
    organizer_ids = _get_user_organizer_ids(current_user, db)
    if not event or (event.organizer_id not in organizer_ids and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]):
        raise HTTPException(status_code=403, detail="Only organizer can reject")

    if order.status != TicketOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")

    order.status = TicketOrderStatus.REJECTED
    order.rejection_reason = reason
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)

    db.commit()

    return {"message": "Ticket rejected", "order_id": order.id, "reason": reason}


@router.post("/guest-order")
def create_guest_order(
    data: GuestOrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a guest ticket order (organizer/staff only). Order is pending until payment is confirmed."""
    event = db.query(Event).filter(Event.id == data.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    organizer_ids = _get_user_organizer_ids(current_user, db)
    if event.organizer_id not in organizer_ids and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only event organizer can create guest orders")

    current_sold = event.tickets_sold or 0
    if event.capacity and (current_sold + data.quantity) > event.capacity:
        raise HTTPException(status_code=400, detail="Not enough tickets available")

    unit_price = event.ticket_price or 0.0
    if data.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == data.ticket_tier_id).first()
        if tier:
            unit_price = tier.price or unit_price

    order = TicketOrder(
        event_id=data.event_id,
        user_id=current_user.id,
        guest_name=data.guest_name,
        guest_email=data.guest_email,
        guest_phone=data.guest_phone,
        is_guest_order=True,
        payer_name=data.guest_name,
        payment_amount=unit_price * data.quantity,
        payment_screenshot="",
        status=TicketOrderStatus.PENDING,
        quantity=data.quantity,
        ticket_tier_id=data.ticket_tier_id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    settings = get_settings()
    yoopay_base = settings.YOOPAY_PAYMENT_URL or "https://yoopay.cn/tc/603316601"
    payment_url = f"{yoopay_base}?order_ref=GUEST-{order.id}&amount={order.payment_amount:.2f}"

    return {
        "message": "Guest ticket order created. Pending payment.",
        "order_id": order.id,
        "payment_amount": order.payment_amount,
        "payment_url": payment_url,
    }


@router.post("/validate-ticket")
def validate_ticket(
    ticket_code: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket at event entry (scan QR)"""
    import logging
    logger = logging.getLogger(__name__)

    ticket_code = ticket_code.strip()
    if not ticket_code:
        raise HTTPException(status_code=400, detail="Ticket code is required")

    if _is_event_share_qr(ticket_code):
        raise HTTPException(
            status_code=400,
            detail="This is an event share QR code. Please scan the attendee ticket QR code."
        )

    candidates, extracted_event_id, extracted_ticket_id = _normalize_ticket_candidates(ticket_code)
    candidate_lowers = [c.lower() for c in candidates]
    logger.info(
        "Validating ticket "
        f"raw='{ticket_code}' normalized={candidates} "
        f"event_id={extracted_event_id} ticket_id={extracted_ticket_id} "
        f"(user: {current_user.id})"
    )

    # PRIORITY 1: Check individual Ticket records first
    ticket_match_filters = [
        func.lower(Ticket.ticket_number).in_(candidate_lowers),
        func.lower(Ticket.qr_token).in_(candidate_lowers),
    ]
    if extracted_ticket_id is not None:
        ticket_match_filters.append(Ticket.id == extracted_ticket_id)

    ticket = db.query(Ticket).filter(or_(*ticket_match_filters)).first()

    if ticket:
        if ticket.is_used:
            raise HTTPException(status_code=409, detail="Ticket already used")

        event = db.query(Event).filter(Event.id == ticket.event_id).first()

        if extracted_event_id is not None and event and event.id != extracted_event_id:
            raise HTTPException(status_code=400, detail="Ticket QR does not match this event")

        organizer_ids = _get_user_organizer_ids(current_user, db)
        if not event or event.organizer_id not in organizer_ids:
            raise HTTPException(status_code=403, detail="Only event organizer can validate tickets")

        ticket.is_used = True
        ticket.used_at = datetime.now(timezone.utc)
        ticket.status = "used"

        if ticket.ticket_order_id:
            order = db.query(TicketOrder).filter(TicketOrder.id == ticket.ticket_order_id).first()
            if order:
                unused_count = db.query(Ticket).filter(
                    Ticket.ticket_order_id == order.id,
                    Ticket.is_used == False
                ).count()
                if unused_count == 0:
                    order.status = TicketOrderStatus.USED
                    order.used_at = datetime.now(timezone.utc)
                    order.used_by = current_user.id

        db.commit()

        user = db.query(User).filter(User.id == ticket.user_id).first()
        tier = db.query(TicketTier).filter(TicketTier.id == ticket.ticket_tier_id).first() if ticket.ticket_tier_id else None
        if not tier and event:
            tier = db.query(TicketTier).filter(TicketTier.event_id == event.id).first()
        logger.info(
            f"Ticket validated ticket_id={ticket.id} ticket_number={ticket.ticket_number} "
            f"event_id={ticket.event_id} by user={current_user.id}"
        )

        return {
            "valid": True,
            "ticket_id": ticket.id,
            "ticket_code": ticket.ticket_number,
            "event_id": event.id if event else None,
            "event": event.title if event else None,
            "event_start_date": event.start_date.isoformat() if event and event.start_date else None,
            "flyer_image": event.flyer_image if event else None,
            "user": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "tier_name": tier.name if tier else "General Admission",
            "tier_price": float(tier.price) if tier and tier.price else 0,
            "used_at": ticket.used_at.isoformat(),
        }

    # FALLBACK: Check TicketOrder
    order = db.query(TicketOrder).filter(
        func.lower(TicketOrder.ticket_code).in_(candidate_lowers)
    ).first()

    if order:
        if order.status == TicketOrderStatus.USED:
            raise HTTPException(status_code=409, detail="Ticket already used")

        if order.status != TicketOrderStatus.APPROVED:
            raise HTTPException(status_code=400, detail=f"Ticket is {order.status.value}")

        event = db.query(Event).filter(Event.id == order.event_id).first()

        if extracted_event_id is not None and event and event.id != extracted_event_id:
            raise HTTPException(status_code=400, detail="Ticket QR does not match this event")

        organizer_ids = _get_user_organizer_ids(current_user, db)
        if not event or event.organizer_id not in organizer_ids:
            raise HTTPException(status_code=403, detail="Only event organizer can validate tickets")

        order.status = TicketOrderStatus.USED
        order.used_at = datetime.now(timezone.utc)
        order.used_by = current_user.id

        db.commit()

        user = db.query(User).filter(User.id == order.user_id).first()
        tier = db.query(TicketTier).filter(TicketTier.event_id == event.id).first() if event else None
        logger.info(f"Ticket order validated order_id={order.id} ticket_code={order.ticket_code} by user={current_user.id}")

        return {
            "valid": True,
            "ticket_id": order.id,
            "ticket_code": order.ticket_code,
            "event_id": event.id if event else None,
            "event": event.title if event else None,
            "event_start_date": event.start_date.isoformat() if event and event.start_date else None,
            "flyer_image": event.flyer_image if event else None,
            "user": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "tier_name": tier.name if tier else "General Admission",
            "tier_price": float(tier.price) if tier and tier.price else 0,
            "used_at": order.used_at.isoformat(),
        }

    logger.warning(f"Ticket not found in DB: raw='{ticket_code}', normalized={candidates}")
    raise HTTPException(status_code=404, detail="Invalid ticket")
```


---

## 7. Backend API — Event Ticket Tiers (`api/events.py` excerpts)

Helper functions and ticket-tier CRUD endpoints.

```python
# api/events.py (excerpts)
import random
import string
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session, joinedload

from database import get_db
from auth import get_current_user, require_organizer
from models import User, Event, TicketTier, UserRole, OrganizerProfile, BusinessProfile
from schemas import TicketTierCreate, TicketTierResponse

router = APIRouter(prefix="/events", tags=["Events"])


def generate_ticket_number() -> str:
    """Generate unique ticket number"""
    timestamp = datetime.utcnow().strftime("%y%m%d")
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"TKT-{timestamp}-{random_str}"


def get_organizer_profile_id(current_user: User, db: Session) -> int:
    """
    Get the organizer profile ID for the current user.
    BUSINESS and ORGANIZER roles are unified - both can manage events.
    """
    if current_user.organizer_profile:
        return current_user.organizer_profile.id

    if current_user.business_profile:
        if current_user.business_profile.organizer_profiles:
            return current_user.business_profile.organizer_profiles[0].id

        organizer = OrganizerProfile(
            user_id=current_user.id,
            business_profile_id=current_user.business_profile.id,
            organization_name=current_user.business_profile.business_name,
            is_verified=current_user.business_profile.is_verified,
            is_approved=current_user.business_profile.is_approved
        )
        db.add(organizer)
        db.commit()
        db.refresh(organizer)
        return organizer.id

    if current_user.role in [UserRole.BUSINESS, UserRole.ORGANIZER]:
        default_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or (current_user.email or "Business")
        business = BusinessProfile(
            user_id=current_user.id,
            business_name=default_name,
        )
        db.add(business)
        db.commit()
        db.refresh(business)

        organizer = OrganizerProfile(
            user_id=current_user.id,
            business_profile_id=business.id,
            organization_name=default_name,
            is_verified=False,
            is_approved=False
        )
        db.add(organizer)
        db.commit()
        db.refresh(organizer)
        return organizer.id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="User does not have an organizer or business profile"
    )


def get_user_organizer_ids(current_user: User, db: Session) -> List[int]:
    """Get ALL organizer profile IDs associated with the user."""
    organizer_ids = []

    if current_user.organizer_profile:
        organizer_ids.append(current_user.organizer_profile.id)

    if current_user.business_profile and current_user.business_profile.organizer_profiles:
        for org in current_user.business_profile.organizer_profiles:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    if not organizer_ids:
        direct_orgs = db.query(OrganizerProfile).filter(OrganizerProfile.user_id == current_user.id).all()
        for org in direct_orgs:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    if not organizer_ids and current_user.role in [UserRole.BUSINESS, UserRole.ORGANIZER]:
        return [get_organizer_profile_id(current_user, db)]

    return organizer_ids


# ==================== TICKET TIERS ====================

@router.post("/{event_id}/ticket-tiers", response_model=TicketTierResponse)
def create_ticket_tier(
    event_id: int,
    tier_data: TicketTierCreate,
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Create a ticket tier for an event"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    organizer_id = get_organizer_profile_id(current_user, db)
    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )

    tier = TicketTier(
        event_id=event_id,
        name=tier_data.name,
        name_cn=tier_data.name_cn,
        description=tier_data.description,
        price=tier_data.price,
        currency=tier_data.currency,
        quantity=tier_data.quantity,
        max_per_order=tier_data.max_per_order,
        sale_start=tier_data.sale_start,
        sale_end=tier_data.sale_end
    )

    db.add(tier)
    db.commit()
    db.refresh(tier)

    return tier


@router.get("/{event_id}/ticket-tiers", response_model=List[TicketTierResponse])
def list_ticket_tiers(
    event_id: int,
    db: Session = Depends(get_db)
):
    """List ticket tiers for an event"""
    tiers = db.query(TicketTier).filter(
        TicketTier.event_id == event_id
    ).all()

    return tiers


@router.patch("/ticket-tiers/{tier_id}", response_model=TicketTierResponse)
def update_ticket_tier(
    tier_id: int,
    tier_data: TicketTierCreate,
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Update a ticket tier"""
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()

    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket tier not found"
        )

    event = db.query(Event).filter(Event.id == tier.event_id).first()
    organizer_id = get_organizer_profile_id(current_user, db)

    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this ticket tier"
        )

    update_data = tier_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(tier, field):
            setattr(tier, field, value)

    db.commit()
    db.refresh(tier)

    return tier


@router.get("/ticket-tiers/{tier_id}", response_model=TicketTierResponse)
def get_ticket_tier(
    tier_id: int,
    db: Session = Depends(get_db)
):
    """Get a single ticket tier by ID (public endpoint)"""
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()
    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket tier not found"
        )
    return tier


@router.delete("/ticket-tiers/{tier_id}")
def delete_ticket_tier(
    tier_id: int,
    current_user: User = Depends(require_organizer),
    db: Session = Depends(get_db)
):
    """Delete a ticket tier"""
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first()

    if not tier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket tier not found"
        )

    event = db.query(Event).filter(Event.id == tier.event_id).first()
    organizer_id = get_organizer_profile_id(current_user, db)

    if event.organizer_id != organizer_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this ticket tier"
        )

    db.delete(tier)
    db.commit()

    return {"message": "Ticket tier deleted successfully"}
```


---

## 8. Backend API — Payments Order Flow (`api/payments.py` excerpts)

The payments router handles Stripe/YooPay/card orders. It uses `Order` + `OrderItem` + `Ticket` models.

```python
# api/payments.py (excerpts)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
import qrcode
import io
import base64

from database import get_db
from auth import get_current_user
from models import User, Event, TicketTier, Ticket, Order, OrderItem, PaymentStatus, TicketStatus, UserRole
from schemas import OrderCreate, OrderResponse, OrderDetailResponse, PurchaseTicketData

router = APIRouter(prefix="/payments", tags=["Payments"])


def generate_order_number() -> str:
    """Generate a unique order/ticket reference."""
    from datetime import datetime
    import uuid
    return f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


def generate_ticket_token() -> str:
    """Generate a secure validation token."""
    import secrets
    return secrets.token_urlsafe(32)


def generate_qr_code_url(token: str) -> str:
    """Build the public validation URL embedded in ticket QR codes."""
    from urllib.parse import urljoin
    base_url = "https://sounditent.com"
    return f"{base_url}/validate/{token}"


def _require_event_checkin_access(event: Event, current_user: User, db: Session):
    """Require that current_user is organizer, staff, or admin for the event."""
    from api.events import get_user_organizer_ids
    if current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        return True
    organizer_ids = get_user_organizer_ids(current_user, db)
    if event.organizer_id in organizer_ids:
        return True
    # Check active staff membership for the event's business
    from models import StaffMember
    staff = db.query(StaffMember).filter(
        StaffMember.user_id == current_user.id,
        StaffMember.business_id == event.organizer_id,
        StaffMember.status == "Active"
    ).first()
    if staff:
        return True
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to validate or check in tickets for this event"
    )


@router.post("/orders", response_model=OrderResponse)
def create_order(
    order_data: OrderCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new order with race condition protection"""
    total_amount = 0

    tier_ids = [item.ticket_tier_id for item in order_data.items]

    # Lock all ticket tiers at once to prevent race conditions
    tiers = db.query(TicketTier).filter(
        TicketTier.id.in_(tier_ids)
    ).with_for_update().all()

    tier_map = {tier.id: tier for tier in tiers}

    # Validate items and calculate total
    for item in order_data.items:
        tier = tier_map.get(item.ticket_tier_id)

        if not tier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket tier {item.ticket_tier_id} not found"
            )

        # Check event & ticket tier sales status
        event = tier.event
        if event:
            if getattr(event, 'ticket_sales_closed', False):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ticket sales for '{event.title}' have been closed by the organizer."
                )
            now_utc = datetime.now(timezone.utc)
            event_end_time = event.end_date or event.start_date
            if event_end_time:
                if event_end_time.tzinfo is None:
                    event_end_time = event_end_time.replace(tzinfo=timezone.utc)
                if now_utc > event_end_time:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ticket sales for '{event.title}' have closed because the event has ended."
                    )
        if tier.status in (TicketStatus.SOLD_OUT, TicketStatus.CLOSED, TicketStatus.ENDED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ticket sales for tier '{tier.name}' are closed."
            )

        available = tier.quantity - tier.quantity_sold
        if item.quantity > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {available} tickets available for {tier.name}"
            )

        if item.quantity > tier.max_per_order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {tier.max_per_order} tickets per order for {tier.name}"
            )

        total_amount += tier.price * item.quantity

    try:
        order = Order(
            user_id=current_user.id,
            order_number=generate_order_number(),
            total_amount=total_amount,
            currency="CNY",
            payment_method=order_data.payment_method,
            payment_status=PaymentStatus.PENDING
        )

        db.add(order)
        db.flush()

        for item in order_data.items:
            tier = tier_map[item.ticket_tier_id]
            order_item = OrderItem(
                order_id=order.id,
                ticket_tier_id=item.ticket_tier_id,
                quantity=item.quantity,
                price=tier.price
            )
            db.add(order_item)

        db.commit()
        db.refresh(order)

        return order

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create order due to concurrent modification. Please retry."
        )


@router.post("/orders/purchase")
def purchase_order(
    data: PurchaseTicketData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete purchase after payment verification with race condition protection"""
    try:
        order_id_int = int(data.order_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )

    try:
        order = db.query(Order).filter(
            Order.id == order_id_int
        ).with_for_update().first()

        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to purchase this order")

        if order.payment_status != PaymentStatus.PENDING:
            raise HTTPException(
                status_code=400,
                detail=f"Order is not pending. Current status: {order.payment_status}"
            )

        order.payment_status = PaymentStatus.COMPLETED
        order.payment_id = data.payment_intent_id
        order.paid_at = datetime.utcnow()

        tickets_generated = 0

        for item in order.items:
            tier = db.query(TicketTier).filter(
                TicketTier.id == item.ticket_tier_id
            ).with_for_update().first()

            if not tier:
                raise HTTPException(status_code=400, detail=f"Ticket tier {item.ticket_tier_id} not found")

            available = tier.quantity - tier.quantity_sold
            if item.quantity > available:
                raise HTTPException(status_code=400, detail=f"Only {available} tickets available for {tier.name}")

            tier.quantity_sold += item.quantity

            event = db.query(Event).filter(
                Event.id == tier.event_id
            ).with_for_update().first()

            if not event:
                raise HTTPException(status_code=400, detail=f"Event not found for tier {item.ticket_tier_id}")

            event.tickets_sold += item.quantity

            for _ in range(item.quantity):
                qr_token = generate_ticket_token()
                qr_data = generate_qr_code_url(qr_token)

                qr = qrcode.QRCode(version=1, box_size=10, border=5)
                qr.add_data(qr_data)
                qr.make(fit=True)

                img = qr.make_image(fill_color="black", back_color="white")
                buffered = io.BytesIO()
                img.save(buffered, format="PNG")
                qr_base64 = base64.b64encode(buffered.getvalue()).decode()

                ticket = Ticket(
                    user_id=order.user_id,
                    ticket_tier_id=item.ticket_tier_id,
                    order_id=order.id,
                    event_id=tier.event_id,
                    ticket_number=generate_order_number(),
                    qr_token=qr_token,
                    qr_code=f"data:image/png;base64,{qr_base64}",
                    status="active"
                )

                db.add(ticket)
                tickets_generated += 1

        db.commit()

        return {
            "success": True,
            "order_id": order.id,
            "status": "completed",
            "tickets_generated": tickets_generated,
            "message": "Tickets generated successfully"
        }

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Concurrent modification detected. Please retry."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate tickets. Please contact support."
        )


@router.get("/validate/{token}")
def validate_ticket_by_token(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket by secure token (for event check-in)"""
    ticket = db.query(Ticket).filter(Ticket.qr_token == token).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    _require_event_checkin_access(event, current_user, db)

    if ticket.used_at:
        raise HTTPException(status_code=400, detail="Ticket already used")

    if ticket.status != "active":
        raise HTTPException(status_code=400, detail=f"Ticket is {ticket.status}")

    ticket.used_at = datetime.utcnow()
    ticket.is_used = True
    ticket.status = "used"
    ticket.verified_by_user_id = current_user.id

    db.commit()
    db.refresh(ticket)

    return {
        "valid": True,
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "status": "validated",
        "validated_at": ticket.used_at,
        "validated_by": current_user.id,
        "message": "Ticket validated successfully"
    }


@router.get("/tickets/validate/{ticket_number}")
def validate_ticket_by_number(
    ticket_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket by its ticket number (for check-in)"""
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    _require_event_checkin_access(event, current_user, db)

    tier = db.query(TicketTier).filter(TicketTier.id == ticket.ticket_tier_id).first()
    holder = ticket.user

    return {
        "valid": ticket.status == "active" and not ticket.used_at,
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "event_name": event.title,
        "event_date": event.start_date,
        "tier_name": tier.name if tier else "Unknown",
        "holder_name": holder.username if holder else None,
        "holder_email": holder.email if holder else None,
        "status": ticket.status,
        "used_at": ticket.used_at,
        "verified_by_user_id": ticket.verified_by_user_id
    }


@router.post("/tickets/{ticket_id}/check-in")
def check_in_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check in a ticket (mark as used)"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    _require_event_checkin_access(event, current_user, db)

    if ticket.used_at:
        raise HTTPException(status_code=400, detail="Ticket already checked in")

    if ticket.status != "active":
        raise HTTPException(status_code=400, detail=f"Ticket status is {ticket.status}")

    ticket.used_at = datetime.utcnow()
    ticket.is_used = True
    ticket.status = "used"
    ticket.verified_by_user_id = current_user.id

    db.commit()
    db.refresh(ticket)

    return {
        "message": "Ticket checked in successfully",
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "checked_in_at": ticket.used_at,
        "checked_in_by": current_user.id
    }


@router.post("/tickets/{ticket_id}/transfer")
def transfer_ticket(
    ticket_id: int,
    transfer_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transfer a ticket to another user"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to transfer this ticket")

    if ticket.status != "active":
        raise HTTPException(status_code=400, detail=f"Cannot transfer ticket with status: {ticket.status}")

    if ticket.used_at:
        raise HTTPException(status_code=400, detail="Cannot transfer already used ticket")

    new_holder_name = transfer_data.get("holder_name")
    new_holder_email = transfer_data.get("holder_email")

    if new_holder_name:
        ticket.holder_name = new_holder_name
    if new_holder_email:
        ticket.holder_email = new_holder_email

    db.commit()
    db.refresh(ticket)

    return {
        "message": "Ticket transferred successfully",
        "ticket_id": ticket.id,
        "new_holder_name": ticket.holder_name,
        "new_holder_email": ticket.holder_email
    }


@router.post("/orders/{order_id}/refund")
def process_refund(
    order_id: int,
    refund_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process a refund for an order"""
    order = db.query(Order).filter(Order.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to refund this order")

    if order.payment_status != PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot refund unpaid order")

    if order.refund_amount:
        raise HTTPException(status_code=400, detail="Order already refunded")

    refund_amount = refund_data.get("amount", order.total_amount)
    reason = refund_data.get("reason", "")

    if refund_amount > order.total_amount:
        raise HTTPException(status_code=400, detail="Refund amount cannot exceed order total")

    order.refund_amount = refund_amount
    order.refunded_at = datetime.utcnow()

    if refund_amount >= order.total_amount:
        for ticket in order.tickets:
            ticket.status = "cancelled"

    db.commit()
    db.refresh(order)

    return {
        "message": "Refund processed successfully",
        "order_id": order.id,
        "refund_amount": order.refund_amount,
        "refunded_at": order.refunded_at,
        "reason": reason
    }
```


---

## 9. Email Service (`email_service.py` excerpts)

Ticket approval email with ZIP of QR codes.

```python
# email_service.py (excerpts)
import base64
import io
import zipfile
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


def _decode_qr_bytes(qr_data: str) -> bytes:
    """Decode a base64 data URI into raw PNG bytes."""
    try:
        if qr_data.startswith("data:image"):
            qr_data = qr_data.split(",", 1)[-1]
        return base64.b64decode(qr_data)
    except Exception:
        return b""


def send_ticket_approved_email(
    to_email: str,
    first_name: str,
    event_title: str,
    event_date: str,
    event_venue: str,
    tickets: List[dict],  # Each dict: {ticket_number, qr_code}
    quantity: int = 1
) -> bool:
    """Send ticket approval email with QR codes bundled in a ZIP attachment."""
    subject = f"Your tickets for {event_title} are confirmed!"
    name = first_name or "there"
    safe_title = "".join(c if c.isalnum() else "_" for c in event_title)[:30]

    ticket_list_text = "\n".join(
        f"• Ticket #{i+1}: {t['ticket_number']}" for i, t in enumerate(tickets)
    )
    body = f"""Hi {name},

Great news! Your ticket order for "{event_title}" has been approved.

Event Details:
• Event: {event_title}
• Date: {event_date}
• Venue: {event_venue}
• Quantity: {quantity} ticket(s)

Your Tickets:
{ticket_list_text}

Please download the attached ZIP file and show each QR code at the entrance (one per person).
You can also view your tickets online: https://sounditent.com/tickets

— Sound It Team"""

    ticket_rows = "\n".join(
        f"""<tr>
            <td style="padding:10px 16px; border-bottom:1px solid #222; color:#d3da0c; font-weight:700;">Ticket #{i+1}</td>
            <td style="padding:10px 16px; border-bottom:1px solid #222; color:#e5e5e5; font-family:monospace;">{t['ticket_number']}</td>
        </tr>"""
        for i, t in enumerate(tickets)
    )

    html = _email_wrapper(
        subject,
        f"""<p>Hi {name},</p>
        <p>Great news! Your ticket order for <strong>{event_title}</strong> has been approved.</p>
        <div style="background:#0a0a0a; padding:16px; border-radius:12px; margin:16px 0;">
            <p style="margin:4px 0;"><strong>Event:</strong> {event_title}</p>
            <p style="margin:4px 0;"><strong>Date:</strong> {event_date}</p>
            <p style="margin:4px 0;"><strong>Venue:</strong> {event_venue}</p>
            <p style="margin:4px 0;"><strong>Quantity:</strong> {quantity} ticket(s)</p>
        </div>
        <p style="margin:0 0 12px; font-weight:600;">Your tickets:</p>
        <table style="width:100%; border-collapse:collapse; margin:0 0 20px;">
            {ticket_rows}
        </table>
        <p style="margin:0 0 16px;">📎 <strong>Download the attached ZIP file</strong> for your QR codes. Show each QR at the entrance (one per person).</p>
        <a href="https://sounditent.com/tickets" class="cta">View My Tickets</a>
        <p style="margin-top:24px; color:#888;">— Sound It Team</p>"""
    )

    attachments = []
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, t in enumerate(tickets):
                qr_bytes = _decode_qr_bytes(t.get("qr_code", ""))
                if qr_bytes:
                    filename = f"ticket_{i+1}_{t['ticket_number']}.png"
                    zf.writestr(filename, qr_bytes)
        zip_buffer.seek(0)
        zip_filename = f"soundit_tickets_{safe_title}.zip"
        attachments.append((zip_filename, zip_buffer.getvalue(), "application/zip"))
    except Exception as e:
        logger.warning(f"Failed to create ticket ZIP: {e}")

    return send_email(to_email, subject, body, html, attachments=attachments)


def send_ticket_confirmation(
    to_email: str,
    order_details: dict,
    tickets: List[dict],
    event_details: dict
) -> bool:
    """Send ticket confirmation email."""
    subject = f"Your tickets for {event_details.get('title', 'the event')}"
    body = f"Hi! Your ticket order (#{order_details.get('id')}) is confirmed. See you at the event!"
    return send_email(to_email, subject, body)
```


---

## 10. Frontend State — `ticketStore.ts`

Zustand store for the `Order`/`Ticket` payment flow.

```typescript
// app/src/store/ticketStore.ts
import { create } from 'zustand';
import axios from 'axios';
import { useAuthStore } from './authStore';

const API_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

function getApiErrorDetail(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } } };
    return e.response?.data?.detail || fallback;
  }
  return fallback;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { detail?: string } }; message?: string };
    return e.response?.data?.detail || e.message || 'Unknown error';
  }
  return 'Unknown error';
}

export interface Ticket {
  id: string;
  order_id: string;
  user_id: string;
  ticket_tier_id: string;
  event_id: string;
  ticket_number: string;
  qr_code: string;
  attendee_name: string;
  attendee_email: string;
  is_used: boolean;
  used_at?: string;
  created_at: string;
  event?: {
    id: string;
    title: string;
    start_date: string;
    flyer_image: string;
    city: string;
  };
  ticket_tier?: {
    name: string;
    price: number;
  };
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  event_id: string;
  total_amount: number;
  currency: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  created_at: string;
  event?: {
    title: string;
    start_date: string;
    flyer_image: string;
    city: string;
  };
  tickets?: Ticket[];
}

export interface TicketState {
  tickets: Ticket[];
  orders: Order[];
  currentTicket: Ticket | null;
  isLoading: boolean;
  error: string | null;

  fetchUserTickets: () => Promise<void>;
  fetchUserOrders: () => Promise<void>;
  fetchTicketById: (id: string) => Promise<void>;
  createOrder: (data: CreateOrderData) => Promise<Order>;
  purchaseTicket: (data: PurchaseTicketData) => Promise<Ticket[]>;
  validateTicket: (ticketNumber: string) => Promise<Ticket | null>;
  checkInTicket: (ticketId: string) => Promise<void>;
  transferTicket: (ticketId: string, newOwnerEmail: string) => Promise<void>;
  downloadTicket: (ticketId: string) => Promise<Blob>;
  requestRefund: (orderId: string, reason?: string) => Promise<boolean>;
}

export interface CreateOrderData {
  event_id: string;
  items: {
    ticket_tier_id: string;
    quantity: number;
  }[];
  attendee_info: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface PurchaseTicketData {
  order_id: string;
  payment_intent_id: string;
}

const getAuthToken = () => {
  const token = useAuthStore.getState().session?.access_token;
  if (token) return token;
  return localStorage.getItem('auth-token') || localStorage.getItem('token');
};

export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  orders: [],
  currentTicket: null,
  isLoading: false,
  error: null,

  fetchUserTickets: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.get(`${API_URL}/payments/tickets/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ tickets: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  fetchUserOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.get(`${API_URL}/payments/orders/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ orders: response.data || [], isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  fetchTicketById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.get(`${API_URL}/payments/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ currentTicket: response.data, isLoading: false });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  createOrder: async (data: CreateOrderData) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.post(`${API_URL}/payments/orders`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  purchaseTicket: async (data: PurchaseTicketData) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.post(`${API_URL}/payments/orders/purchase`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  validateTicket: async (ticketNumber: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.get(`${API_URL}/payments/tickets/validate/${ticketNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error), isLoading: false });
      return null;
    }
  },

  checkInTicket: async (ticketId: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      await axios.post(`${API_URL}/payments/tickets/${ticketId}/check-in`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  transferTicket: async (ticketId: string, newOwnerEmail: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      await axios.post(`${API_URL}/payments/tickets/${ticketId}/transfer`,
        { email: newOwnerEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      set({ isLoading: false });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  downloadTicket: async (ticketId: string) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await axios.get(`${API_URL}/payments/tickets/${ticketId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      return response.data;
    } catch (error: unknown) {
      console.error('Failed to download ticket:', error);
      throw new Error(getApiErrorDetail(error, 'Failed to download ticket'));
    }
  },

  requestRefund: async (orderId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Not authenticated');
      await axios.post(`${API_URL}/payments/orders/${orderId}/refund`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      set({ isLoading: false });
      return true;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },
}));

export default useTicketStore;
```


---

## 11. Frontend — `EventDetail.tsx`

Public event page with ticket tier selection, quantity picker, QR payment modal, order submission, and sales-closed handling.

```typescript
// app/src/pages/EventDetail.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, ArrowLeft, Share2, Heart, X, ShoppingCart, Check, Upload, Ticket, MessageCircle, Copy, Eye, EyeOff, Mail, Lock, UserPlus, LogIn, Store, AlertCircle } from 'lucide-react';
import MobileQrPayment from '@/components/MobileQrPayment';
import { toast } from 'sonner';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import VerificationBadge from '@/components/VerificationBadge';
import TableBooking from '@/components/TableBooking';
import UniversalShareModal from '@/components/ui/UniversalShareModal';
import { API_BASE_URL } from '@/config/api';
import { WEB_ORIGIN } from '@/lib/appUrl';
import { Analytics } from '@/lib/analytics';

export default function EventDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuthStore();
  const { currentEvent, fetchEventById, isLoading, events } = useEventStore();
  const [isLiked, setIsLiked] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Ticket order flow
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [payerName, setPayerName] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralDiscount, setReferralDiscount] = useState<number | null>(null);
  const [recentOrder, setRecentOrder] = useState<{ status: string; ticket_qr?: string; ticket_code?: string } | null>(null);
  const [eventVendors, setEventVendors] = useState<Array<any>>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'ticket' | 'save' | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Fetch event vendors
  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE_URL}/events/${id}/vendors`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.vendors) setEventVendors(data.vendors);
      })
      .catch(() => {});
  }, [id]);

  // Read referral code from URL ?ref= and track click
  useEffect(() => {
    const refFromUrl = searchParams.get('ref');
    if (refFromUrl && id) {
      const code = refFromUrl.toUpperCase();
      setReferralCode(code);
      fetch(`${API_BASE_URL}/promoters/track-click/${code}?event_id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
      fetch(`${API_BASE_URL}/promoters/validate/${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.discount_percent) {
            setReferralDiscount(data.discount_percent);
          }
        })
        .catch(() => {});
    }
  }, [searchParams, id]);

  useEffect(() => {
    if (id) {
      fetchEventById(id);
      setSelectedTierId(null);
      Analytics.trackEvent("event_view", "engagement", { event_id: id });
    }
  }, [id, fetchEventById]);

  // Update meta tags for sharing
  useEffect(() => {
    if (!currentEvent) return;
    const title = currentEvent.title || 'Sound It';
    const description = currentEvent.description
      ? currentEvent.description.replace(/<[^>]+>/g, '').slice(0, 160)
      : '5 years of Excellence in Entertainment';
    const image = currentEvent.flyer_image
      ? (currentEvent.flyer_image.startsWith('http') ? currentEvent.flyer_image : `${WEB_ORIGIN}${currentEvent.flyer_image}`)
      : `${WEB_ORIGIN}/logo.png`;
    const url = `${WEB_ORIGIN}/events/${id}`;

    document.title = `${title} - Sound It`;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const attr = selector.startsWith('[property=') ? 'property' : 'name';
        const val = selector.match(/"([^"]+)"/)?.[1] || '';
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[property="og:type"]', 'event');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);
  }, [currentEvent, id]);

  // Fetch most recent order for this event
  useEffect(() => {
    if (!profile || !id) return;
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    fetch(`${API_BASE_URL}/tickets/my-orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const found = data.orders?.find((o: { event?: { id: number }; status: string }) => String(o.event?.id) === id);
        if (found) {
          setRecentOrder({ status: found.status, ticket_qr: found.ticket_qr, ticket_code: found.ticket_code });
        }
      })
      .catch(() => {});
  }, [profile, id]);

  // Check if event is saved
  useEffect(() => {
    if (!profile || !id) return;
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    fetch(`${API_BASE_URL}/events/saved`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((data: { id?: number; events?: { id: number }[] }) => {
        const saved = (data.events || data || []) as { id: number }[];
        setIsLiked(saved.some((e) => String(e.id) === id));
      })
      .catch(() => {});
  }, [profile, id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] pt-32 px-4 text-center">
        <h1 className="text-2xl text-white mb-4">{t('eventDetail.eventNotFound')}</h1>
        <button onClick={() => id && fetchEventById(id)} className="text-[#d3da0c] hover:underline mb-4 block">
          {t('eventDetail.retry')}
        </button>
        <Link to="/events" className="text-gray-400 hover:underline">
          {t('eventDetail.backToEvents')}
        </Link>
      </div>
    );
  }

  const hasQrPayment = currentEvent.wechat_qr_url || currentEvent.alipay_qr_url || currentEvent.ticket_price != null || currentEvent.ticket_tiers != null;
  const eventEndDate = currentEvent.end_date ? new Date(currentEvent.end_date) : (currentEvent.start_date ? new Date(currentEvent.start_date) : null);
  const isEventPast = eventEndDate ? new Date() > eventEndDate : false;
  const isSalesClosed = Boolean(currentEvent.ticket_sales_closed || isEventPast || currentEvent.status === 'completed' || currentEvent.status === 'cancelled');

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshot || !payerName.trim()) {
      toast.error(t('eventDetail.pleaseUploadScreenshotAndName'));
      return;
    }
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      setPendingAction('ticket');
      setShowAuthModal(true);
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('event_id', String(currentEvent.id));
    formData.append('payment_screenshot', screenshot);
    formData.append('payer_name', payerName);
    formData.append('quantity', String(quantity));
    if (selectedTierId) formData.append('ticket_tier_id', selectedTierId);
    const tier = currentEvent.ticket_tiers?.find((t) => String(t.id) === selectedTierId);
    const rawTierPrice = tier?.price;
    const tierPrice = typeof rawTierPrice === 'number' && !isNaN(rawTierPrice) ? rawTierPrice : undefined;
    const unitPrice = tierPrice ?? currentEvent.ticket_price ?? 0;
    formData.append('payment_amount', String(unitPrice * quantity));
    formData.append('payment_reference', paymentReference.trim());
    if (payerNotes) formData.append('payer_notes', payerNotes);
    if (referralCode.trim()) formData.append('referral_code', referralCode.trim().toUpperCase());

    try {
      const res = await fetch(`${API_BASE_URL}/tickets/order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'rejected') {
          toast.error(data.message || t('eventDetail.orderFailed'));
        } else {
          toast.success(data.auto_approved ? t('eventDetail.orderAutoApproved') : t('eventDetail.orderSubmitted'));
        }
        setRecentOrder({ status: data.status || 'pending', ticket_qr: undefined, ticket_code: undefined });
        setShowOrderModal(false);
        setShowSuccessModal(true);
        Analytics.trackEvent("ticket_purchased", "conversion", { event_id: id, amount: unitPrice * quantity });
      } else {
        toast.error(data.detail || t('eventDetail.orderFailed'));
      }
    } catch {
      toast.error(t('eventDetail.orderFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const relatedEvents = (events || [])
    .filter((e) => e.city === currentEvent?.city && e.id !== currentEvent?.id)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-16 lg:pt-20">
      {/* Back Button */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />{t('eventDetail.back')}</button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-[40vh] lg:h-[50vh]">
        <img
          src={currentEvent.flyer_image || '/placeholder_event.jpg'}
          alt={currentEvent.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent" />

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={async () => {
              const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
              if (!token) {
                toast.info(t('eventDetail.loginToSave'));
                return;
              }
              try {
                if (isLiked) {
                  const res = await fetch(`${API_BASE_URL}/events/${id}/save`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) { setIsLiked(false); Analytics.trackEvent("event_saved", "engagement", { event_id: id, action: "unsave" }); }
                } else {
                  const res = await fetch(`${API_BASE_URL}/events/${id}/save`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) { setIsLiked(true); Analytics.trackEvent("event_saved", "engagement", { event_id: id, action: "save" }); }
                }
              } catch {
                toast.error(t('eventDetail.saveError'));
              }
            }}
            className={`p-3 rounded-full backdrop-blur-md transition-colors ${isLiked
              ? 'bg-red-500 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
              }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => { setIsShareModalOpen(true); Analytics.trackEvent("event_shared", "social", { event_id: id }); }}
            className="p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <span className="inline-block px-4 py-1.5 bg-[#d3da0c] text-black text-sm font-semibold rounded-full mb-4">
                {currentEvent.event_type || t('eventDetail.event')}
              </span>

              {currentEvent.tags && currentEvent.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {currentEvent.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-white/5 rounded-lg text-xs text-white/60">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                {currentEvent.title}
              </h1>

              {/* Info Grid */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.date')}</p>
                    <p className="text-white font-medium">
                      {new Date(currentEvent.start_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.time')}</p>
                    <p className="text-white font-medium">
                      {new Date(currentEvent.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.venue')}</p>
                    <p className="text-white font-medium">{currentEvent.venue?.name || currentEvent.address || t('eventDetail.toBeAnnounced')}</p>
                    <p className="text-white/50 text-sm">{currentEvent.venue?.address || currentEvent.city}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.availability')}</p>
                    <p className="text-white font-medium">
                      {currentEvent.show_remaining_tickets === false
                        ? ((currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0
                            ? currentEvent.ticket_tiers.every(t => t.status === 'sold_out' || (t.quantity_sold || 0) >= (t.quantity || 0))
                            : false) || (currentEvent.capacity && currentEvent.tickets_sold >= currentEvent.capacity) ? t('eventDetail.soldOut') : t('eventDetail.ticketsAvailable'))
                        : currentEvent.capacity ? `${(currentEvent.capacity - (currentEvent.tickets_sold || 0))} / ${currentEvent.capacity} ${t('eventDetail.ticketsLabel')}` : t('eventDetail.limitedAvailability')
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t('eventDetail.aboutThisEvent')}
                </h2>
                <div className="text-white/60 leading-relaxed whitespace-pre-wrap">
                  {currentEvent.description}
                </div>
              </div>

              {/* Table Packages */}
              <div className="mb-8">
                <TableBooking
                  eventId={Number(currentEvent.id)}
                  eventTitle={currentEvent.title}
                  wechatQrUrl={currentEvent.wechat_qr_url}
                  alipayQrUrl={currentEvent.alipay_qr_url}
                  paymentInstructions={currentEvent.payment_instructions}
                />
              </div>

              {/* Artist Section */}
              {currentEvent.djs && currentEvent.djs.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.featuredDJsAndArtists')}
                  </h2>
                  <div className="grid gap-4">
                    {currentEvent.djs.map((dj) => (
                      <Link
                        key={dj.id}
                        to={`/artists/${dj.id}`}
                        className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                      >
                        <img
                          src={dj.avatar_url || '/default-avatar.png'}
                          alt={dj.stage_name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                        <div>
                          <p className="text-white font-semibold flex items-center gap-2">
                            {dj.stage_name}
                            {dj.verification_badge && <VerificationBadge size="sm" />}
                          </p>
                          <p className="text-white/50 text-sm">
                            {dj.genres?.join(', ') || t('eventDetail.artist')}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Business */}
              {currentEvent.business && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.business')}
                  </h2>
                  <Link
                    to={`/profiles/${currentEvent.business.id}`}
                    className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                  >
                    <img
                      src={currentEvent.business.logo_url || '/placeholder.jpg'}
                      alt={currentEvent.business.business_name}
                      className="w-16 h-16 rounded-xl object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                    />
                    <div>
                      <p className="text-white font-semibold flex items-center gap-2">
                        {currentEvent.business.business_name}
                        {currentEvent.business.verification_badge && <VerificationBadge size="sm" />}
                      </p>
                      <p className="text-white/50 text-sm">
                        {currentEvent.business.verification_badge ? t('eventDetail.verifiedBusiness') : t('eventDetail.business')}
                      </p>
                    </div>
                  </Link>
                </div>
              )}

              {/* Vendors at this Event */}
              {eventVendors.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Vendors at this Event
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {eventVendors.map((vendor) => (
                      <Link
                        key={vendor.id}
                        to={`/store/${vendor.vendor_id}`}
                        className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                      >
                        <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                          {vendor.logo_url ? (
                            <img
                              src={vendor.logo_url}
                              alt={vendor.business_name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Store className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold flex items-center gap-2 truncate">
                            {vendor.business_name}
                            {vendor.is_verified && <VerificationBadge size="sm" />}
                          </p>
                          <p className="text-white/50 text-sm capitalize">
                            {vendor.vendor_type || 'Vendor'}
                            {vendor.booth_location && ` · Booth ${vendor.booth_location}`}
                          </p>
                          {vendor.products && vendor.products.length > 0 && (
                            <p className="text-[#d3da0c] text-xs mt-1">
                              {vendor.products.length} item{vendor.products.length > 1 ? 's' : ''} available
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Events */}
              {relatedEvents.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.similarEvents')}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {relatedEvents.map((related) => (
                      <Link
                        key={related.id}
                        to={`/events/${related.id}`}
                        className="flex gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                      >
                        <img
                          src={related.flyer_image || '/placeholder_event.jpg'}
                          alt={related.title}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div>
                          <p className="text-white font-medium line-clamp-1">
                            {related.title}
                          </p>
                          <p className="text-white/50 text-sm">
                            {new Date(related.start_date).toLocaleDateString()}
                          </p>
                          <p className="text-[#d3da0c] font-semibold mt-1">
                            {related.ticket_tiers?.[0]?.currency || 'CNY'} {related.ticket_tiers?.[0]?.price || 0}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar / Ticket Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-[#141414] rounded-2xl p-6 border border-white/5">
                {isSalesClosed && (
                  <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {isEventPast
                        ? t('eventDetail.eventEnded', 'Event Ended')
                        : t('eventDetail.salesClosed', 'Ticket Sales Closed')}
                    </p>
                    <p className="text-xs text-red-400/80 mt-1">
                      {isEventPast
                        ? t('eventDetail.eventEndedDesc', 'This event has already ended. Ticket sales are closed.')
                        : t('eventDetail.salesClosedDesc', 'Ticket sales for this event have been closed by the organizer.')}
                    </p>
                  </div>
                )}
                {currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0 ? (
                  <>
                    <div className="mb-4">
                      <label className="text-white/50 text-sm mb-3 block">
                        {t('eventDetail.selectTicketType')}
                      </label>
                      <div className="space-y-3">
                        {currentEvent.ticket_tiers.map((tier) => {
                          const isTierClosed = tier.status === 'sold_out' || tier.status === 'closed' || tier.status === 'ended' || (tier.sale_end ? new Date() > new Date(tier.sale_end) : false);
                          return (
                            <button
                              key={tier.id}
                              disabled={isSalesClosed || isTierClosed}
                              onClick={() => setSelectedTierId(String(tier.id))}
                              className={`w-full p-4 rounded-xl border text-left transition-all disabled:opacity-50 ${
                                selectedTierId === String(tier.id)
                                  ? 'border-[#d3da0c] bg-[#d3da0c]/10'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-white">{tier.name}</span>
                                <span className="text-[#d3da0c] font-bold">
                                  {tier.currency} {tier.price}
                                </span>
                              </div>
                              <p className="text-white/50 text-xs">
                                {isTierClosed
                                  ? (tier.status === 'closed' || tier.status === 'ended' ? t('eventDetail.salesClosed', 'Sales Closed') : t('eventDetail.soldOut'))
                                  : currentEvent.show_remaining_tickets === false
                                    ? t('eventDetail.ticketsAvailable')
                                    : `${(tier.quantity || 0) - (tier.quantity_sold || 0)} ${t('eventDetail.ticketsRemaining')}`
                                }
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      disabled={isSalesClosed}
                      onClick={() => {
                        if (isSalesClosed) return;
                        if (!selectedTierId) {
                          toast.error(t('eventDetail.pleaseSelectTicketType'));
                          return;
                        }
                        if (!profile) {
                          setPendingAction('ticket');
                          setShowAuthModal(true);
                          return;
                        }
                        setShowQuantityModal(true);
                      }}
                      className={`w-full py-4 rounded-xl font-semibold transition-colors ${
                        isSalesClosed
                          ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-white/5'
                          : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b] cursor-pointer'
                      }`}
                    >
                      {isEventPast
                        ? t('eventDetail.eventEnded', 'Event Ended')
                        : isSalesClosed
                          ? t('eventDetail.salesClosed', 'Sales Closed')
                          : t('eventDetail.buyTicket')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <p className="text-white/50 text-sm mb-2">{t('eventDetail.ticketPrice')}</p>
                      <p className="text-3xl font-bold text-white">
                        ¥{currentEvent.ticket_price || 0}
                      </p>
                    </div>

                    <button
                      disabled={isSalesClosed}
                      onClick={() => {
                        if (isSalesClosed) return;
                        if (!profile) {
                          setPendingAction('ticket');
                          setShowAuthModal(true);
                          return;
                        }
                        setShowQuantityModal(true);
                      }}
                      className={`w-full py-4 rounded-xl font-semibold transition-colors mb-4 ${
                        isSalesClosed
                          ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-white/5'
                          : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b] cursor-pointer'
                      }`}
                    >
                      {isEventPast
                        ? t('eventDetail.eventEnded', 'Event Ended')
                        : isSalesClosed
                          ? t('eventDetail.salesClosed', 'Sales Closed')
                          : t('eventDetail.buyTicket')}
                    </button>
                  </>
                )}

                {!(currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0) && !hasQrPayment && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-8 h-8 text-[#d3da0c]" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{t('eventDetail.ticketsComingSoon')}</h3>
                    <p className="text-white/50 text-sm mb-6">{t('eventDetail.ticketInfoSoon')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Selector Modal */}
      {showQuantityModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.selectQuantity')}</h3>
              <button onClick={() => { setShowQuantityModal(false); setQuantity(1); }} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            {selectedTierId && currentEvent?.ticket_tiers?.length > 0 && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <p className="text-white font-medium">
                  {currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.name}
                </p>
                <p className="text-[#d3da0c] font-bold">
                  {currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.currency || '¥'}
                  {currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.price || 0}
                  <span className="text-white/50 text-sm font-normal"> / {t('eventDetail.ticket')}</span>
                </p>
              </div>
            )}
            {!selectedTierId && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <p className="text-white font-medium">{t('eventDetail.standardTicket')}</p>
                <p className="text-[#d3da0c] font-bold">
                  ¥{currentEvent?.ticket_price || 0}
                  <span className="text-white/50 text-sm font-normal"> / {t('eventDetail.ticket')}</span>
                </p>
              </div>
            )}
            <div className="mb-4">
              <label className="text-white/60 text-sm block mb-2">{t('eventDetail.quantity')}</label>
              <div className="flex items-center gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-xl bg-white/5 text-white hover:bg-white/10 text-xl font-bold"
                >-</button>
                <span className="text-white font-bold text-2xl w-12 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-12 h-12 rounded-xl bg-white/5 text-white hover:bg-white/10 text-xl font-bold"
                >+</button>
              </div>
            </div>
            <div className="mb-6 p-3 bg-[#d3da0c]/10 rounded-xl text-center">
              <p className="text-white/60 text-sm">{t('eventDetail.total')}</p>
              <p className="text-[#d3da0c] text-2xl font-bold">
                ¥{((currentEvent?.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent?.ticket_price ?? 0) * quantity).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => { setShowQuantityModal(false); setShowQrModal(true); }}
              className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
            >
              {t('eventDetail.proceedToPayment')}
            </button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.scanToPay')}</h3>
              <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="mb-3 text-center">
              <p className="text-white/60 text-xs">
                {quantity > 1 ? `${quantity} × ` : ''}
                {selectedTierId && currentEvent?.ticket_tiers
                  ? currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.name
                  : t('eventDetail.standardTicket')}
              </p>
            </div>
            <MobileQrPayment
              amount={(currentEvent.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent.ticket_price ?? 0) * quantity}
              wechatQrUrl={currentEvent.wechat_qr_url}
              alipayQrUrl={currentEvent.alipay_qr_url}
              paymentInstructions={currentEvent.payment_instructions}
              hideYoopay={!!currentEvent.wechat_qr_url || !!currentEvent.alipay_qr_url}
            />
            <button
              onClick={() => { setShowQrModal(false); setShowOrderModal(true); }}
              className="w-full mt-4 bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
            >
              {t('eventDetail.iHavePaid')}
            </button>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.confirmPayment')}</h3>
              <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.yourName')} *</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterYourName')}
                  required
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.quantity')}</label>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-lg bg-white/5 text-white font-medium">
                    {quantity} {quantity === 1 ? t('eventDetail.ticket') : t('eventDetail.tickets')}
                  </div>
                  <span className="text-[#d3da0c] font-bold">
                    ¥{((currentEvent?.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent?.ticket_price ?? 0) * quantity).toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.paymentScreenshot')} *</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-white/50 mb-2" />
                    <p className="text-sm text-white/60">{screenshot ? screenshot.name : t('eventDetail.clickToUpload')}</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">
                  {t('eventDetail.paymentReference')}
                  <span className="ml-1 text-[#d3da0c] font-medium">(Optional - We will try to auto-detect)</span>
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterPaymentReference')}
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">
                  {t('eventDetail.referralCode') || 'Referral Code'}
                  <span className="ml-1 text-purple-400 font-medium">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                  placeholder={t('eventDetail.enterReferralCode') || 'Enter referral code'}
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.notesOptional')}</label>
                <textarea
                  value={payerNotes}
                  onChange={(e) => setPayerNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.anyNotes')}
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
              >
                {submitting ? t('eventDetail.submitting') : t('eventDetail.submitOrder')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Universal Share Modal */}
      {isShareModalOpen && currentEvent && (
        <UniversalShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          item={{
            type: 'event',
            id: currentEvent.id,
            title: currentEvent.title,
            subtitle: (currentEvent as any).organizer_name || (currentEvent as any).organizer?.organization_name || 'Sound It Event',
            image: currentEvent.flyer_image,
            date: currentEvent.start_date ? new Date(currentEvent.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            time: currentEvent.start_date ? new Date(currentEvent.start_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
            location: (currentEvent as any).venue_name || currentEvent.venue?.name || currentEvent.address || currentEvent.city || '',
            city: currentEvent.city,
            description: currentEvent.description,
            price: currentEvent.ticket_tiers?.[0]?.price ? `¥${currentEvent.ticket_tiers[0].price}` : 'Free',
            url: `${WEB_ORIGIN}/events/${currentEvent.id}`
          }}
        />
      )}

      {/* Order Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t('eventDetail.orderSuccessTitle')}</h3>
            <p className="text-gray-400 text-sm mb-6">
              {recentOrder?.status === 'approved' || recentOrder?.status === 'used'
                ? t('eventDetail.orderAutoApproved')
                : t('eventDetail.orderSubmitted')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowSuccessModal(false); navigate('/tickets'); }}
                className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
              >
                {t('eventDetail.viewMyTickets')}
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-colors"
              >
                {t('eventDetail.continueBrowsing')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal — Login / Register inline */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`text-lg font-semibold pb-1 border-b-2 transition-colors ${authTab === 'login' ? 'text-[#d3da0c] border-[#d3da0c]' : 'text-white/40 border-transparent'}`}
                >
                  {t('nav.login')}
                </button>
                <button
                  onClick={() => setAuthTab('register')}
                  className={`text-lg font-semibold pb-1 border-b-2 transition-colors ${authTab === 'register' ? 'text-[#d3da0c] border-[#d3da0c]' : 'text-white/40 border-transparent'}`}
                >
                  {t('nav.register')}
                </button>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!authEmail.trim() || !authPassword) {
                  toast.error(t('auth.login.enterIdentifierError', { method: t('auth.login.email') }));
                  return;
                }
                setAuthLoading(true);
                try {
                  const { loginWithEmail } = useAuthStore.getState();
                  await loginWithEmail(authEmail.trim(), authPassword);
                  toast.success(t('auth.login.welcomeBack'));
                  setShowAuthModal(false);
                  setAuthEmail('');
                  setAuthPassword('');
                  if (pendingAction === 'ticket') {
                    setShowQrModal(true);
                  }
                  setPendingAction(null);
                } catch (err) {
                  toast.error((err as Error).message || t('auth.login.loginFailed'));
                } finally {
                  setAuthLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.emailLabel')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.emailPlaceholder')}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.passwordLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.passwordPlaceholder')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showAuthPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authLoading ? <LogIn className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  {t('nav.login')}
                </button>
              </form>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!authEmail.trim() || !authPassword || !authFirstName.trim()) {
                  toast.error(t('auth.register.fillAllFieldsError'));
                  return;
                }
                if (authPassword.length < 8) {
                  toast.error(t('auth.register.passwordMinLength'));
                  return;
                }
                setAuthLoading(true);
                try {
                  const { registerWithEmail } = useAuthStore.getState();
                  await registerWithEmail({
                    email: authEmail.trim(),
                    password: authPassword,
                    first_name: authFirstName.trim(),
                    last_name: authLastName.trim(),
                    role_type: 'user',
                  });
                  toast.success(t('auth.register.accountCreated'));
                  const { loginWithEmail } = useAuthStore.getState();
                  await loginWithEmail(authEmail.trim(), authPassword);
                  setShowAuthModal(false);
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthFirstName('');
                  setAuthLastName('');
                  if (pendingAction === 'ticket') {
                    setShowQrModal(true);
                  }
                  setPendingAction(null);
                } catch (err) {
                  toast.error((err as Error).message || t('auth.register.registrationFailed'));
                } finally {
                  setAuthLoading(false);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm block mb-2">{t('common.firstName') || 'First Name'} *</label>
                    <input
                      type="text"
                      value={authFirstName}
                      onChange={(e) => setAuthFirstName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm block mb-2">{t('common.lastName') || 'Last Name'}</label>
                    <input
                      type="text"
                      value={authLastName}
                      onChange={(e) => setAuthLastName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.emailLabel')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.emailPlaceholder')}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.passwordLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.passwordPlaceholder')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showAuthPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authLoading ? <UserPlus className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                  {t('nav.register')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```


---

## 12. Frontend — `Checkout.tsx`

Dedicated payment/checkout page used when navigating from cart.

```typescript
// app/src/pages/payment/Checkout.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MobileQrPayment from '@/components/MobileQrPayment';
import {
  ArrowLeft, Check, Upload, X, Loader2, QrCode, Calendar, MapPin
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

const Checkout = () => {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { events, currentEvent, fetchEventById, isLoading: isEventLoading } = useEventStore();
  const { profile, isAuthenticated } = useAuthStore();

  const [step, setStep] = useState<'qr' | 'form' | 'success'>('qr');
  const [payerName, setPayerName] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ order_id: number; status: string; message?: string } | null>(null);

  useEffect(() => {
    if (eventId && !events.find(e => String(e.id) === eventId) && String(currentEvent?.id) !== eventId) {
      fetchEventById(eventId);
    }
  }, [eventId, events, currentEvent, fetchEventById]);

  const event = events.find(e => String(e.id) === eventId) || (String(currentEvent?.id) === eventId ? currentEvent : undefined);
  const ticketCount = (location.state as { ticketCount?: number })?.ticketCount || 1;

  if (!eventId) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <p className="text-red-400">{t('payment.checkout.missingEventId')}</p>
      </div>
    );
  }

  if (isEventLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{t('payment.eventNotFound')}</p>
          <button
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium"
          >{t('payment.browseEvents')}</button>
        </div>
      </div>
    );
  }

  const hasQrPayment = event.wechat_qr_url || event.alipay_qr_url || event.ticket_price !== undefined && event.ticket_price !== null;
  const ticketTier = event.ticket_tiers?.find(t => String(t.id) === String((location.state as { tierId?: string | number })?.tierId)) || event.ticket_tiers?.[0];
  const ticketPrice = hasQrPayment ? (event.ticket_price || 0) : (ticketTier?.price || 0);
  const totalAmount = ticketPrice * ticketCount;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshot || !payerName.trim() || !paymentReference.trim()) {
      if (!screenshot || !payerName.trim()) {
        toast.error(t('payment.checkout.uploadScreenshotAndName'));
      }
      if (!paymentReference.trim()) {
        toast.error(t('eventDetail.paymentReferenceRequired'));
      }
      return;
    }
    if (!isAuthenticated || !profile) {
      toast.error(t('payment.checkout.pleaseSignIn'));
      navigate('/login', { state: { from: `/checkout/${eventId}` } });
      return;
    }

    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: `/checkout/${eventId}` } });
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('event_id', String(event.id));
    formData.append('payment_screenshot', screenshot);
    formData.append('payer_name', payerName);
    formData.append('quantity', String(ticketCount));
    formData.append('payment_amount', String(totalAmount));
    if ((location.state as { tierId?: string | number })?.tierId) {
      formData.append('ticket_tier_id', String((location.state as { tierId?: string | number }).tierId));
    }
    if (payerNotes) formData.append('payer_notes', payerNotes);
    formData.append('payment_reference', paymentReference.trim());

    try {
      const res = await fetch(`${API_BASE_URL}/tickets/order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.auto_approved ? t('eventDetail.orderAutoApproved') : 'Order submitted. Awaiting approval.');
        setOrderResult(data);
        setStep('success');
      } else {
        toast.error(data.detail || 'Failed to submit order');
      }
    } catch {
      toast.error('Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-6">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('payment.backLabel')}
          </button>
        </div>

        {/* Event Summary */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex gap-4">
            <img
              src={event.flyer_image || '/event_placeholder.jpg'}
              alt={event.title}
              className="w-24 h-24 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-xl font-bold text-white">{event.title}</h1>
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <Calendar className="w-4 h-4 text-[#d3da0c]" />
                {new Date(event.start_date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <MapPin className="w-4 h-4 text-[#d3da0c]" />
                {event.city}
              </div>
            </div>
          </div>
        </div>

        {step === 'qr' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display text-white mb-2">
                {t('payment.completeLabel')} <span className="text-[#d3da0c]">{t('payment.paymentLabel')}</span>
              </h2>
              <p className="text-gray-400">Scan the QR code and complete your payment</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-[#d3da0c]" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Manual Payment</h3>
                  <p className="text-gray-400 text-sm">WeChat Pay or Alipay</p>
                </div>
              </div>
              <ul className="text-gray-400 text-sm space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#d3da0c]" /> Scan QR code with your phone</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#d3da0c]" /> Complete the transfer</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#d3da0c]" /> Upload screenshot for verification</li>
              </ul>
            </div>

            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-400">Amount to Pay</span>
              <span className="text-2xl font-bold text-[#d3da0c]">¥{totalAmount}</span>
            </div>
            {ticketTier && !hasQrPayment && (
              <div className="flex justify-between items-center mb-6">
                <span className="text-gray-400">Tickets</span>
                <span className="text-white">{ticketCount}x {ticketTier.name}</span>
              </div>
            )}

            <div className="mb-6">
              <MobileQrPayment amount={totalAmount} />
            </div>

            <button
              onClick={() => setStep('form')}
              className="w-full py-4 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
            >
              I Have Paid
            </button>
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Confirm Payment</h3>
              <button onClick={() => setStep('qr')} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">Your Name *</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Payment Screenshot *</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-white/50 mb-2" />
                    <p className="text-sm text-white/60">{screenshot ? screenshot.name : 'Click to upload screenshot'}</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.paymentReference')} *</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterPaymentReference')}
                  required
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">Notes (optional)</label>
                <textarea
                  value={payerNotes}
                  onChange={(e) => setPayerNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Any notes for the organizer"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Order'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'success' && orderResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-display text-white mb-2">
              {orderResult?.status === 'approved'
                ? 'Order Approved!'
                : orderResult?.status === 'rejected'
                  ? 'Order Rejected'
                  : 'Order Submitted'}
            </h2>
            <p className="text-gray-400 mb-6">
              {orderResult?.status === 'approved'
                ? 'Your ticket has been approved. Check your tickets page for your QR code.'
                : orderResult?.status === 'rejected'
                  ? (orderResult?.message || 'Your ticket order was rejected. Please contact the organizer for more information.')
                  : 'Your ticket request is pending organizer approval. You will receive a notification once approved.'}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/tickets')}
                className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
              >
                View My Tickets
              </button>
              <button
                onClick={() => navigate('/events')}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
              >
                Browse Events
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
```


---

## 13. Frontend — `user/Tickets.tsx`

User ticket wallet: lists active/past tickets and orders, shows QR codes, sharing, and download fallback.

```typescript
// app/src/pages/user/Tickets.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Clock, X, Download, Share2, Check, Loader2, Ticket, Package, Lock, ExternalLink } from 'lucide-react';
import { useTicketStore } from '@/store/ticketStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { WEB_ORIGIN } from '@/lib/appUrl';

interface TicketOrder {
  id: number;
  event: {
    id: number;
    title: string;
    start_date: string;
    flyer_image?: string;
  };
  payment_amount: number;
  quantity?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  tickets_generated?: number;
  auto_approved?: boolean;
  rejection_reason?: string;
  created_at: string;
}

interface ProductOrder {
  id: number;
  product: {
    id: number;
    name: string;
    image_url?: string;
    vendor?: {
      id: number;
      business_name?: string;
    } | null;
  };
  payment_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'used';
  order_code?: string;
  order_qr_code?: string;
  rejection_reason?: string;
  created_at: string;
}

const Tickets = () => {
  const { t } = useTranslation();
  const isAuthenticated = !!(localStorage.getItem('auth-token') || localStorage.getItem('token'));
  const { tickets, fetchUserTickets, isLoading } = useTicketStore();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TicketOrder | null>(null);

  const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);
  const [productOrdersLoading, setProductOrdersLoading] = useState(false);
  const [selectedProductOrder, setSelectedProductOrder] = useState<ProductOrder | null>(null);

  const [orderIndividualTickets, setOrderIndividualTickets] = useState<Array<{id: number; ticket_number: string; qr_token: string; qr_code: string}>>([]);
  const [loadingOrderTickets, setLoadingOrderTickets] = useState(false);

  useEffect(() => {
    fetchUserTickets();
    fetchTicketOrders();
    fetchProductOrders();
  }, [fetchUserTickets]);

  const fetchTicketOrders = async () => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTicketOrders(data.orders || []);
    } catch {
      // silent fail
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchProductOrders = async () => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) return;
    setProductOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/product-orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProductOrders(data.orders || []);
    } catch {
      // silent fail
    } finally {
      setProductOrdersLoading(false);
    }
  };

  const now = new Date();
  const activeTickets = tickets.filter(t => {
    const eventDate = t.event ? new Date(t.event.start_date) : null;
    return !t.is_used && eventDate && eventDate > now;
  });
  const pastTickets = tickets.filter(t => {
    const eventDate = t.event ? new Date(t.event.start_date) : null;
    return t.is_used || (eventDate && eventDate <= now);
  });

  const activeTicketOrders = ticketOrders.filter(o => {
    const eventDate = o.event ? new Date(o.event.start_date) : null;
    return o.status === 'approved' && eventDate && eventDate > now;
  });
  const pendingTicketOrders = ticketOrders.filter(o => o.status === 'pending');
  const pastTicketOrders = ticketOrders.filter(o => {
    const eventDate = o.event ? new Date(o.event.start_date) : null;
    return o.status === 'rejected' || o.status === 'cancelled' || (o.status === 'approved' && eventDate && eventDate <= now);
  });

  const activeProductOrders = productOrders.filter(o => o.status === 'pending' || o.status === 'approved');
  const pastProductOrders = productOrders.filter(o => o.status === 'rejected' || o.status === 'used');

  const combinedActive = [...activeTickets, ...activeTicketOrders, ...pendingTicketOrders, ...activeProductOrders];
  const combinedPast = [...pastTickets, ...pastTicketOrders, ...pastProductOrders];

  const currentItems = activeTab === 'active' ? combinedActive : combinedPast;

  const handleShare = async (item: typeof tickets[0] | TicketOrder | ProductOrder) => {
    const isProduct = isProductOrder(item);
    const isOrder = isTicketOrder(item);
    const eventId = isProduct ? null : (item as TicketOrder | typeof tickets[0]).event?.id;
    const shareUrl = eventId ? `${WEB_ORIGIN}/events/${eventId}` : `${WEB_ORIGIN}/events`;
    const shareData = {
      title: isProduct
        ? item.product?.name || t('user.tickets.thisEvent')
        : item.event?.title || t('user.tickets.thisEvent'),
      text: t('user.tickets.shareText', {
        title: isProduct
          ? item.product?.name || t('user.tickets.thisEvent')
          : item.event?.title || t('user.tickets.thisEvent'),
        date: !isProduct && item.event?.start_date
          ? new Date(item.event.start_date).toLocaleDateString()
          : t('user.tickets.tba'),
        location: isOrder ? t('user.tickets.tba') : isProduct
          ? (item.product?.vendor?.business_name || t('user.tickets.tba'))
          : (item as typeof tickets[0]).event?.city || t('user.tickets.tba')
      }),
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success(t('user.tickets.ticketInfoCopied'));
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error(t('user.tickets.failedToShareTicket'));
      }
    }
  };

  const handleDownload = async (ticketId: string) => {
    setDownloadingId(ticketId);

    try {
      const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/tickets/${ticketId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
          const ticketData = t('user.tickets.downloadText', {
            ticketNumber: ticket.ticket_number,
            title: ticket.event?.title || t('user.tickets.na'),
            date: ticket.event?.start_date ? new Date(ticket.event.start_date).toLocaleString() : t('user.tickets.na'),
            location: ticket.event?.city || t('user.tickets.na'),
            tier: ticket.ticket_tier?.name || t('user.tickets.standard')
          }).trim();

          const blob = new Blob([ticketData], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ticket-${ticket.ticket_number}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast.success(t('user.tickets.ticketInfoDownloaded'));
        } else {
          throw new Error('Ticket not found');
        }
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${ticketId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t('user.tickets.ticketPdfDownloaded'));
    } catch {
      toast.error(t('user.tickets.failedToDownloadTicket'));
    } finally {
      setDownloadingId(null);
    }
  };

  const getTicketStatus = (ticket: typeof tickets[0]) => {
    if (ticket.is_used) return 'used';
    const event = ticket.event as any;
    if (!event) return 'active';
    const eventEnd = event.end_date
      ? new Date(event.end_date)
      : (event.start_date ? new Date(new Date(event.start_date).getTime() + 24 * 3600 * 1000) : null);
    if (eventEnd && eventEnd <= now) return 'expired';
    return 'active';
  };

  const getTicketOrderStatus = (order: TicketOrder) => {
    if (order.status === 'rejected') return 'rejected';
    if (order.status === 'pending') return 'pending';
    if (order.status === 'used') return 'used';
    const event = order.event as any;
    if (!event) return 'active';
    const eventEnd = event.end_date
      ? new Date(event.end_date)
      : (event.start_date ? new Date(new Date(event.start_date).getTime() + 24 * 3600 * 1000) : null);
    if (eventEnd && eventEnd <= now) return 'expired';
    return 'active';
  };

  const getProductOrderStatus = (order: ProductOrder) => {
    if (order.status === 'rejected') return 'rejected';
    if (order.status === 'pending') return 'pending';
    if (order.status === 'used') return 'used';
    return 'active';
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return { text: t('user.tickets.statusActive'), class: 'bg-green-500/20 text-green-500' };
      case 'used':
        return { text: 'Used', class: 'bg-gray-500/20 text-gray-500' };
      case 'expired':
        return { text: t('user.tickets.statusExpired'), class: 'bg-red-500/20 text-red-500' };
      case 'pending':
        return { text: 'Pending', class: 'bg-yellow-500/20 text-yellow-500' };
      case 'rejected':
        return { text: 'Rejected', class: 'bg-red-500/20 text-red-500' };
      case 'cancelled':
        return { text: 'Cancelled', class: 'bg-gray-500/20 text-gray-500' };
      default:
        return { text: status, class: 'bg-gray-500/20 text-gray-500' };
    }
  };

  const isTicketOrder = (item: any): item is TicketOrder => 'ticket_code' in item;
  const isProductOrder = (item: any): item is ProductOrder => 'order_code' in item;

  return (
    <div className="min-h-screen pt-20 pb-24">
      <section className="relative py-16 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
              {t('user.tickets.myCollection')}
            </span>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-6">
              {t('user.tickets.my')}{' '}
              <span className="text-[#d3da0c]">{t('user.tickets.tickets')}</span>
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-8 text-center border border-[#d3da0c]/30 mb-8"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#d3da0c]/10 flex items-center justify-center">
                <Ticket className="w-7 h-7 text-[#d3da0c]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Access Your Event Tickets</h3>
              <p className="text-gray-300 max-w-md mx-auto mb-6 text-sm">
                Sign in to view your tickets, QR passes, and event entry details.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/login?redirect=/tickets"
                  className="w-full sm:w-auto px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all shadow-lg shadow-[#d3da0c]/20"
                >
                  Sign In to View Tickets
                </Link>
                <button
                  onClick={() => {
                    window.location.href = window.location.href.replace('http://', 'https://') + (window.location.href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 text-[#d3da0c]" />
                  Open in Default Browser
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'active'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
            >
              {t('user.tickets.active', { count: combinedActive.length })}
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'past'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
            >
              {t('user.tickets.past', { count: combinedPast.length })}
            </button>
          </div>

          {(isLoading || ordersLoading || productOrdersLoading) && (
            <div className="text-center py-24">
              <div className="w-12 h-12 mx-auto mb-4 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400">{t('user.tickets.loadingTickets')}</p>
            </div>
          )}

          {!isLoading && !ordersLoading && !productOrdersLoading && currentItems.length > 0 ? (
            <div className="space-y-6">
              {currentItems.map((item, index) => {
                const productOrder = isProductOrder(item) ? item : null;
                const ticketOrder = isTicketOrder(item) ? item : null;
                const regularTicket = !productOrder && !ticketOrder ? item as typeof tickets[0] : null;

                const status = productOrder
                  ? getProductOrderStatus(productOrder)
                  : ticketOrder
                    ? getTicketOrderStatus(ticketOrder)
                    : getTicketStatus(regularTicket!);
                const statusDisplay = getStatusDisplay(status);
                const eventDate = ticketOrder?.event
                  ? new Date(ticketOrder.event.start_date)
                  : regularTicket?.event
                    ? new Date(regularTicket.event.start_date)
                    : null;

                return (
                  <motion.div
                    key={productOrder ? `product-${productOrder.id}` : ticketOrder ? `order-${ticketOrder.id}` : `ticket-${regularTicket!.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass rounded-2xl overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 h-48 md:h-auto relative">
                        <img
                          src={productOrder
                            ? productOrder.product?.image_url || '/event_placeholder.jpg'
                            : ticketOrder
                              ? ticketOrder.event?.flyer_image || '/event_placeholder.jpg'
                              : regularTicket!.event?.flyer_image || '/event_placeholder.jpg'}
                          alt={productOrder
                            ? productOrder.product?.name || t('user.tickets.event')
                            : ticketOrder
                              ? ticketOrder.event?.title || t('user.tickets.event')
                              : regularTicket!.event?.title || t('user.tickets.event')}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0A0A0A]/80 md:bg-gradient-to-l" />
                      </div>

                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-white mb-1">
                              {productOrder
                                ? productOrder.product?.name || t('user.tickets.event')
                                : ticketOrder
                                  ? ticketOrder.event?.title || t('user.tickets.event')
                                  : regularTicket!.event?.title || t('user.tickets.event')}
                            </h3>
                            <span className={`inline-block px-3 py-1 text-xs rounded-full ${statusDisplay.class}`}>
                              {statusDisplay.text}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[#d3da0c] font-bold">
                              {productOrder
                                ? (productOrder.order_qr_code ? 'QR Order' : 'Product Order')
                                : ticketOrder
                                  ? (ticketOrder.ticket_code ? `QR Ticket${ticketOrder.quantity && ticketOrder.quantity > 1 ? ` x${ticketOrder.quantity}` : ''}` : 'Manual Order')
                                  : (regularTicket!.ticket_tier?.name || t('user.tickets.standard'))}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {productOrder ? productOrder.order_code : ticketOrder ? ticketOrder.ticket_code : regularTicket!.ticket_number}
                            </p>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2 text-gray-400">
                            {productOrder ? (
                              <>
                                <Package className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {productOrder.product?.vendor?.business_name || t('user.tickets.tba')}
                                </span>
                              </>
                            ) : (
                              <>
                                <Calendar className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {eventDate ? eventDate.toLocaleDateString() : t('user.tickets.tba')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            {productOrder ? (
                              <>
                                <Clock className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {productOrder.created_at ? new Date(productOrder.created_at).toLocaleDateString() : t('user.tickets.tba')}
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {eventDate ? eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('user.tickets.tba')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <MapPin className="w-4 h-4 text-[#d3da0c]" />
                            <span className="text-sm">
                              {regularTicket ? regularTicket.event?.city : t('user.tickets.tba')}
                            </span>
                          </div>
                        </div>

                        {(ticketOrder?.status === 'rejected' || productOrder?.status === 'rejected') && (ticketOrder?.rejection_reason || productOrder?.rejection_reason) && (
                          <p className="text-red-400 text-sm mb-4">Reason: {ticketOrder?.rejection_reason || productOrder?.rejection_reason}</p>
                        )}

                        {(status === 'active' || status === 'pending') && (
                          <div className="flex gap-3">
                            {productOrder && productOrder.order_qr_code ? (
                              <button
                                onClick={() => setSelectedProductOrder(productOrder)}
                                className="flex-1 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                              >
                                Show QR Code
                              </button>
                            ) : ticketOrder && status === 'active' ? (
                              <button
                                onClick={async () => {
                                  setSelectedOrder(ticketOrder);
                                  if (ticketOrder.quantity > 1) {
                                    setLoadingOrderTickets(true);
                                    try {
                                      const token = localStorage.getItem('auth-token');
                                      const res = await fetch(
                                        `${import.meta.env.VITE_API_URL}/tickets/my-orders/${ticketOrder.id}/tickets`,
                                        { headers: { Authorization: `Bearer ${token}` } }
                                      );
                                      if (res.ok) {
                                        const data = await res.json();
                                        setOrderIndividualTickets(data.tickets || []);
                                      }
                                    } catch {}
                                    setLoadingOrderTickets(false);
                                  } else {
                                    setOrderIndividualTickets([]);
                                  }
                                }}
                                className="flex-1 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                              >
                                Show QR Code
                              </button>
                            ) : regularTicket ? (
                              <button
                                onClick={() => setSelectedTicket(String(regularTicket.id))}
                                className="flex-1 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                              >
                                {t('user.tickets.showQrCode')}
                              </button>
                            ) : null}
                            {(regularTicket || productOrder || ticketOrder) && (
                              <button
                                onClick={() => handleShare(item)}
                                className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                              >
                                <Share2 className="w-5 h-5" />
                              </button>
                            )}
                            {regularTicket && (
                              <button
                                onClick={() => handleDownload(String(regularTicket.id))}
                                disabled={downloadingId === String(regularTicket.id)}
                                className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                              >
                                {downloadingId === String(regularTicket.id) ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Download className="w-5 h-5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : !isLoading && !ordersLoading && !productOrdersLoading && (
            <div className="text-center py-24">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#111111] flex items-center justify-center">
                <Calendar className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {activeTab === 'active' ? t('user.tickets.noActiveTickets') : t('user.tickets.noPastTickets')}
              </h3>
              <p className="text-gray-400">
                {activeTab === 'active'
                  ? t('user.tickets.browseAndBook')
                  : t('user.tickets.pastEventsAppearHere')}
              </p>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {(selectedTicket || selectedOrder || selectedProductOrder) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => { setSelectedTicket(null); setSelectedOrder(null); setSelectedProductOrder(null); setOrderIndividualTickets([]); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">{t('user.tickets.yourTicket')}</h3>
                <button
                  onClick={() => { setSelectedTicket(null); setSelectedOrder(null); setSelectedProductOrder(null); setOrderIndividualTickets([]); }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedProductOrder ? (
                <>
                  <div className="bg-white rounded-xl p-6 mb-6">
                    {selectedProductOrder.order_qr_code ? (
                      <img src={selectedProductOrder.order_qr_code} alt="Order QR" className="w-full h-auto" />
                    ) : (
                      <div className="text-center text-black">{t('user.tickets.noQrAvailable')}</div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">
                      {selectedProductOrder.product?.name || t('user.tickets.event')}
                    </p>
                    <p className="text-[#d3da0c] text-sm mt-2 font-mono">{selectedProductOrder.order_code}</p>
                  </div>
                </>
              ) : selectedOrder ? (
                <>
                  {selectedOrder.quantity > 1 ? (
                    <>
                      <div className="mb-4">
                        <p className="text-white font-semibold text-center mb-1">
                          {selectedOrder.event?.title || t('user.tickets.event')}
                        </p>
                        <p className="text-gray-400 text-sm text-center">
                          {selectedOrder.quantity} {selectedOrder.quantity > 1 ? t('user.tickets.tickets') : t('user.tickets.ticket')}
                        </p>
                      </div>
                      {loadingOrderTickets ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                          {orderIndividualTickets.map((ticket, idx) => (
                            <div key={ticket.id} className="bg-white rounded-xl p-3">
                              <p className="text-center text-black text-xs font-semibold mb-2">
                                #{idx + 1}
                              </p>
                              {ticket.qr_code ? (
                                <img src={ticket.qr_code} alt={`Ticket QR #${idx + 1}`} className="w-full h-auto" />
                              ) : (
                                <QRCodeSVG
                                  value={ticket.ticket_number}
                                  size={120}
                                  className="w-full"
                                  level="H"
                                />
                              )}
                              <p className="text-center text-black text-[10px] font-mono mt-2 truncate">
                                {ticket.ticket_number}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-white rounded-xl p-6 mb-6">
                        {selectedOrder.ticket_qr ? (
                          <img src={selectedOrder.ticket_qr} alt="Ticket QR" className="w-full h-auto" />
                        ) : (
                          <div className="text-center text-black">{t('user.tickets.noQrAvailable')}</div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-white font-semibold mb-1">
                          {selectedOrder.event?.title || t('user.tickets.event')}
                        </p>
                        <p className="text-[#d3da0c] text-sm mt-2 font-mono">{selectedOrder.ticket_code}</p>
                      </div>
                    </>
                  )}
                </>
              ) : (() => {
                const ticket = tickets.find(t => t.id === selectedTicket);
                if (!ticket) return null;
                return (
                  <>
                    <div className="bg-white rounded-xl p-6 mb-6">
                      <QRCodeSVG
                        value={ticket.ticket_number}
                        size={200}
                        className="w-full"
                        level="H"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold mb-1">
                        {ticket.event?.title || t('user.tickets.event')}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {ticket.ticket_tier?.name || t('user.tickets.standard')}
                      </p>
                      <p className="text-[#d3da0c] text-sm mt-2">{ticket.ticket_number}</p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-gray-400 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{t('user.tickets.showQrAtEntrance')}</span>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tickets;
```


---

## 14. Frontend — `business/TicketOrders.tsx`

Organizer/business ticket order management: approve/reject, guest-ticket creation, payment proof and QR modals.

```typescript
// app/src/pages/business/TicketOrders.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import {
  Ticket, Loader2, User, CheckCircle2, XCircle, Clock, Search, Eye,
  QrCode, Calendar, Download, Filter, Smartphone, Plus, X, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface OrderTicket {
  id: number;
  ticket_number: string;
  qr_code: string;
  qr_token: string;
  is_used: boolean;
  used_at?: string;
  status: string;
}

interface TicketOrder {
  id: number;
  event: { id: number; title: string };
  user: { id: number; name: string; email: string; phone?: string };
  quantity?: number;
  payment_amount: number;
  payer_name: string;
  payment_screenshot: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  auto_approved?: boolean;
  tickets_generated?: number;
  used_at?: string;
  used_by?: number;
  is_guest_order?: boolean;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  ticket_tier?: { id: number; name: string } | null;
  tickets?: OrderTicket[];
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-500/10 text-green-400', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-400', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-400', icon: XCircle },
  used: { label: 'Used', color: 'bg-blue-500/10 text-blue-400', icon: CheckCircle2 },
};

const TicketOrdersPage = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();

  const [orders, setOrders] = useState<TicketOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'used'>('all');
  const [eventFilter, setEventFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [selectedOrderTickets, setSelectedOrderTickets] = useState<TicketOrder | null>(null);

  const [showGuestModal, setShowGuestModal] = useState(false);
  const [events, setEvents] = useState<Array<{ id: number; title: string }>>([]);
  const [ticketTiers, setTicketTiers] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [guestForm, setGuestForm] = useState({
    event_id: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    quantity: '1',
    ticket_tier_id: '',
  });
  const [isSubmittingGuest, setIsSubmittingGuest] = useState(false);

  const fetchEvents = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/events/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEvents(data.map((e: any) => ({ id: e.id, title: e.title })));
      }
    } catch {
      // silently fail
    }
  };

  const fetchTicketTiers = async (eventId: number) => {
    if (!session?.access_token || !eventId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/ticket-tiers`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTicketTiers(data.map((t: any) => ({ id: t.id, name: t.name, price: t.price })));
      }
    } catch {
      setTicketTiers([]);
    }
  };

  const handleCreateGuestOrder = async () => {
    if (!session?.access_token) return;
    if (!guestForm.event_id || !guestForm.guest_name || !guestForm.guest_email) {
      toast.error(t('business.ticketOrders.fillRequired') || 'Please fill in all required fields');
      return;
    }
    setIsSubmittingGuest(true);
    try {
      const res = await fetch(`${API_BASE_URL}/ticketing/organizer/guest-order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: Number(guestForm.event_id),
          guest_name: guestForm.guest_name,
          guest_email: guestForm.guest_email,
          guest_phone: guestForm.guest_phone || undefined,
          quantity: Number(guestForm.quantity) || 1,
          ticket_tier_id: guestForm.ticket_tier_id ? Number(guestForm.ticket_tier_id) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.ticketOrders.guestOrderCreated') || 'Guest ticket created. Pending payment.');
        if (data.payment_url) {
          window.open(data.payment_url, '_blank', 'noopener,noreferrer');
        }
        setShowGuestModal(false);
        setGuestForm({ event_id: '', guest_name: '', guest_email: '', guest_phone: '', quantity: '1', ticket_tier_id: '' });
        fetchOrders();
      } else {
        toast.error(data.detail || t('business.ticketOrders.guestOrderFailed') || 'Failed to create guest ticket');
      }
    } catch {
      toast.error(t('business.ticketOrders.guestOrderFailed') || 'Failed to create guest ticket');
    } finally {
      setIsSubmittingGuest(false);
    }
  };

  const fetchOrders = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (eventFilter !== 'all') params.append('event_id', String(eventFilter));
      const url = `${API_BASE_URL}/tickets/business/tickets${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
      } else {
        toast.error(data.detail || t('business.dashboard.failedToLoadTicketOrders') || 'Failed to load ticket orders');
      }
    } catch {
      toast.error(t('business.dashboard.failedToLoadTicketOrders') || 'Failed to load ticket orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [session, filter, eventFilter]);

  const handleApprove = async (id: number) => {
    if (!session?.access_token) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.dashboard.approve') || 'Approved');
        fetchOrders();
      } else {
        toast.error(data.detail || t('business.dashboard.failedToApprove') || 'Failed to approve');
      }
    } catch {
      toast.error(t('business.dashboard.failedToApprove') || 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t('business.dashboard.enterRejectionReason') || 'Enter rejection reason:');
    if (!reason || !session?.access_token) return;
    setProcessingId(id);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      const res = await fetch(`${API_BASE_URL}/tickets/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.dashboard.reject') || 'Rejected');
        fetchOrders();
      } else {
        toast.error(data.detail || t('business.dashboard.failedToReject') || 'Failed to reject');
      }
    } catch {
      toast.error(t('business.dashboard.failedToReject') || 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const uniqueEvents = Array.from(
    new Map(orders.map((o) => [o.event.id, o.event])).values()
  ).sort((a, b) => a.title.localeCompare(b.title));

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      (o.payer_name || '').toLowerCase().includes(term) ||
      (o.user?.email || '').toLowerCase().includes(term) ||
      (o.user?.phone || '').toLowerCase().includes(term) ||
      (o.event?.title || '').toLowerCase().includes(term) ||
      (o.ticket_tier?.name || '').toLowerCase().includes(term) ||
      (o.ticket_code || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display text-white mb-1 flex items-center gap-3">
            <Ticket className="w-8 h-8 text-[#d3da0c]" />
            {t('business.dashboard.ticketOrders') || 'Ticket Orders'}
          </h1>
          <p className="text-gray-400">{t('business.dashboard.manageTicketOrders') || 'Manage and approve ticket orders for your events.'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => { setShowGuestModal(true); fetchEvents(); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {t('business.ticketOrders.addGuestTicket') || 'Add Guest Ticket'}
          </button>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search') || 'Search orders...'}
              className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-64 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-40 appearance-none text-sm"
            >
              <option value="all">{t('business.dashboard.all') || 'All'}</option>
              <option value="pending">{t('business.dashboard.pending') || 'Pending'}</option>
              <option value="approved">{t('business.dashboard.approved') || 'Approved'}</option>
              <option value="rejected">{t('business.dashboard.rejected') || 'Rejected'}</option>
              <option value="used">{t('business.dashboard.used') || 'Used'}</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-52 appearance-none text-sm"
            >
              <option value="all">{t('business.dashboard.allEvents') || 'All Events'}</option>
              {uniqueEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Guest Order Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                {t('business.ticketOrders.addGuestTicket') || 'Add Guest Ticket'}
              </h2>
              <button onClick={() => setShowGuestModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.event') || 'Event'} *</label>
                <select
                  value={guestForm.event_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuestForm({ ...guestForm, event_id: val, ticket_tier_id: '' });
                    if (val) fetchTicketTiers(Number(val));
                  }}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                >
                  <option value="">{t('business.ticketOrders.selectEvent') || 'Select event...'}</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.guestName') || 'Guest Name'} *</label>
                <input
                  type="text"
                  value={guestForm.guest_name}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.guestEmail') || 'Guest Email'} *</label>
                <input
                  type="email"
                  value={guestForm.guest_email}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.guestPhone') || 'Guest Phone'}</label>
                <input
                  type="tel"
                  value={guestForm.guest_phone}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_phone: e.target.value })}
                  placeholder="+86138xxxx"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.quantity') || 'Quantity'} *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={guestForm.quantity}
                    onChange={(e) => setGuestForm({ ...guestForm, quantity: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.ticketTier') || 'Ticket Tier'}</label>
                  <select
                    value={guestForm.ticket_tier_id}
                    onChange={(e) => setGuestForm({ ...guestForm, ticket_tier_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                  >
                    <option value="">{t('business.ticketOrders.default') || 'Default'}</option>
                    {ticketTiers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (¥{t.price})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowGuestModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-white text-sm font-bold rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreateGuestOrder}
                disabled={isSubmittingGuest}
                className="flex-1 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('business.ticketOrders.pay') || 'Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#d3da0c] mx-auto" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-gray-400">
          <Ticket className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-medium text-white mb-1">{t('business.dashboard.noTicketOrders') || 'No ticket orders found'}</p>
          <p className="text-sm">{t('business.dashboard.noTicketOrdersHint') || 'Orders will appear here once customers purchase tickets.'}</p>
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 text-gray-400 text-xs font-medium border-b border-white/5">
            <div className="col-span-2">{t('business.dashboard.name') || 'Name'}</div>
            <div className="col-span-2">{t('business.dashboard.email') || 'Email'}</div>
            <div className="col-span-1">{t('business.dashboard.mobile') || 'Mobile'}</div>
            <div className="col-span-2">{t('business.dashboard.eventName') || 'Event'}</div>
            <div className="col-span-1">{t('business.dashboard.ticketType') || 'Type'}</div>
            <div className="col-span-1 text-center">{t('business.dashboard.checkIn') || 'Check'}</div>
            <div className="col-span-1 text-center">{t('business.dashboard.amount') || 'Amt'}</div>
            <div className="col-span-2 text-right">{t('common.actions') || 'Actions'}</div>
          </div>

          <div className="divide-y divide-white/5">
            {filteredOrders.map((order, idx) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const usedCount = order.tickets?.filter((t) => t.is_used).length || 0;
              const totalCount = order.tickets?.length || order.quantity || 1;
              const isCheckIn = usedCount > 0;
              const isFullyUsed = order.status === 'used' || (usedCount > 0 && usedCount === totalCount);
              const isPartiallyUsed = usedCount > 0 && usedCount < totalCount;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="px-4 py-3"
                >
                  {/* Desktop Row */}
                  <div className="hidden lg:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <p className="text-white text-xs font-medium truncate flex items-center gap-1">
                        {order.payer_name || order.user?.name || '-'}
                        {order.is_guest_order && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase">Guest</span>
                        )}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-300 text-xs truncate">{order.user?.email || '-'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-gray-300 text-xs truncate">{order.user?.phone || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-300 text-xs truncate">{order.event?.title || '-'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-gray-300 text-xs truncate">{order.ticket_tier?.name || '-'}</p>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {isFullyUsed ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('business.dashboard.in') || 'In'}
                        </span>
                      ) : isPartiallyUsed ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {usedCount}/{totalCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          {t('business.dashboard.out') || 'Out'}
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 text-center">
                      <p className="text-gray-300 text-xs">¥{order.payment_amount?.toLocaleString?.() || order.payment_amount}</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {order.payment_screenshot && (
                        <button
                          onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                          className="px-1.5 py-1 rounded bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
                          title={t('business.tableReservations.viewPaymentProof') || 'Proof'}
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      {order.tickets && order.tickets.length > 0 && (
                        <button
                          onClick={() => setSelectedOrderTickets(order)}
                          className="px-1.5 py-1 rounded bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
                          title={`${order.tickets.length} ticket(s)`}
                        >
                          <QrCode className="w-3 h-3" />
                          <span className="text-[10px]">{order.tickets.length}</span>
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={processingId === order.id}
                            className="px-1.5 py-1 rounded bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (t('business.dashboard.approve') || 'Ok')}
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={processingId === order.id}
                            className="px-1.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (t('business.dashboard.reject') || 'No')}
                          </button>
                        </>
                      )}
                      {order.status !== 'pending' && (
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${isPartiallyUsed ? 'bg-purple-500/10 text-purple-400' : status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {isPartiallyUsed ? `${usedCount}/${totalCount} Used` : status.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="lg:hidden">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-white font-semibold flex items-center gap-1">
                          {order.payer_name || order.user?.name || '-'}
                          {order.is_guest_order && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">Guest</span>
                          )}
                        </p>
                        <p className="text-gray-400 text-sm">{order.user?.email || '-'}</p>
                        {order.user?.phone && (
                          <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                            <Smartphone className="w-3 h-3" /> {order.user.phone}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.eventName') || 'Event'}</p>
                        <p className="text-gray-300 truncate">{order.event?.title || '-'}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.ticketType') || 'Ticket Type'}</p>
                        <p className="text-gray-300 truncate">{order.ticket_tier?.name || '-'}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.checkIn') || 'Check In'}</p>
                        <p className={`text-xs font-medium ${isFullyUsed ? 'text-green-400' : isPartiallyUsed ? 'text-amber-400' : 'text-gray-400'}`}>
                          {isFullyUsed
                            ? (t('business.dashboard.checkedIn') || 'Checked In')
                            : isPartiallyUsed
                            ? `${usedCount}/${totalCount} Checked In`
                            : (t('business.dashboard.notCheckedIn') || 'Not Checked In')}
                          {order.used_at && (
                            <span className="block text-gray-500 font-normal">
                              {new Date(order.used_at).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.amount') || 'Amount'}</p>
                        <p className="text-gray-300 truncate">¥{order.payment_amount?.toLocaleString?.() || order.payment_amount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.payment_screenshot && (
                        <button
                          onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                          className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          {t('business.tableReservations.viewPaymentProof') || 'Proof'}
                        </button>
                      )}
                      {order.tickets && order.tickets.length > 0 && (
                        <button
                          onClick={() => setSelectedOrderTickets(order)}
                          className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          <QrCode className="w-4 h-4" />
                          {order.tickets.length} {order.tickets.length === 1 ? 'Ticket' : 'Tickets'}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={processingId === order.id}
                            className="px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('business.dashboard.approve') || 'Approve')}
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={processingId === order.id}
                            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('business.dashboard.reject') || 'Reject')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="bg-[#141414] rounded-2xl p-4 max-w-2xl w-full border border-white/10">
            <img
              src={selectedScreenshot}
              alt="Payment proof"
              className="w-full rounded-xl"
              onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedQr && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedQr(null)}
        >
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center">
            <img src={selectedQr} alt="Ticket QR" className="w-48 h-48 mx-auto rounded-xl" />
            <p className="text-gray-400 text-sm mt-4">{t('business.dashboard.ticketQrCode') || 'Ticket QR Code'}</p>
            <div className="flex justify-center gap-3 mt-4">
              <a
                href={selectedQr}
                download
                className="px-4 py-2 rounded-lg bg-[#d3da0c] text-black text-sm font-medium hover:bg-[#bbc10b] flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('common.download') || 'Download'}
              </a>
              <button
                onClick={() => setSelectedQr(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Tickets Modal */}
      {selectedOrderTickets && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedOrderTickets(null)}
        >
          <div
            className="bg-[#141414] rounded-2xl p-6 max-w-2xl w-full border border-white/10 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedOrderTickets.payer_name || selectedOrderTickets.user?.name || 'Guest'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {selectedOrderTickets.event?.title} · {selectedOrderTickets.quantity} ticket(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderTickets(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedOrderTickets.tickets?.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className={`bg-white rounded-xl p-4 text-center ${ticket.is_used ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-black font-bold text-sm">#{idx + 1}</span>
                    {ticket.is_used ? (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">
                        USED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#d3da0c] text-black text-[10px] font-bold rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {ticket.qr_code ? (
                    <img
                      src={ticket.qr_code}
                      alt={`Ticket QR #${idx + 1}`}
                      className="w-full h-auto rounded-lg"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-black text-xs">
                      No QR
                    </div>
                  )}
                  <p className="text-black text-[10px] font-mono mt-2 truncate">
                    {ticket.ticket_number}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={() => setSelectedOrderTickets(null)}
                className="px-6 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketOrdersPage;
```


---

## 15. Frontend — `Scan.tsx`

Mobile-optimized ticket scanner using `html5-qrcode`.

```typescript
// app/src/pages/Scan.tsx
/**
 * Ticket Scanner Page
 * Mobile-optimized ticket scanning using html5-qrcode
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  Flashlight,
  Keyboard,
  X,
  CheckCircle,
  AlertCircle,
  Ticket,
  User,
  Calendar,
  Loader2,
  Camera,
  RefreshCcw,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useStaffAuthStore } from '@/store/staffAuthStore';
import { useStaffStore } from '@/store/staffStore';
import { API_BASE_URL } from '@/config/api';
import { Html5Qrcode } from 'html5-qrcode';

interface ScanResult {
  success: boolean;
  ticket?: {
    id: string;
    ticket_number: string;
    event_title: string;
    event_date: string;
    user_name: string;
    status: string;
    tier_name?: string;
    event_id?: number;
  };
  message: string;
}

const ScanPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const { memberships, events: staffEvents, fetchMemberships, fetchEvents, isStaff } = useStaffStore();
  const isStaffUser = isStaff();

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Fetch staff info on mount
  useEffect(() => {
    if (session?.access_token) {
      fetchMemberships().then(() => {
        if (isStaff()) {
          fetchEvents();
        }
      });
    }
  }, [session, fetchMemberships, fetchEvents, isStaff]);

  // Start camera scanner
  const startScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }

    setCameraError(null);
    setScanResult(null);

    try {
      const scanner = new Html5Qrcode('scan-video-container');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {
          // No QR found in frame — ignore
        }
      );

      setIsScanning(true);
      setHasCamera(true);
    } catch (err) {
      console.error('Camera start failed:', err);
      setIsScanning(false);
      setHasCamera(false);
      setCameraError(
        t('scan.cameraDenied') || 'Unable to access camera. Please check permissions or use manual entry.'
      );
    }
  }, [t]);

  // Stop camera scanner
  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  // Validate ticket via API
  const handleScan = async (code: string) => {
    if (!code.trim() || isValidating) return;

    setIsValidating(true);
    setScanResult(null);

    await stopScanner();

    try {
      const staffToken = useStaffAuthStore.getState().token;
      const token = session?.access_token || staffToken || localStorage.getItem('auth-token') || '';
      if (!token) {
        setScanResult({
          success: false,
          message: t('scan.authRequired') || 'Please log in to validate tickets',
        });
        toast.error(t('scan.authRequired') || 'Please log in to validate tickets');
        setIsValidating(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/ticketing/organizer/validate-ticket`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ ticket_code: code.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setScanResult({
          success: true,
          ticket: {
            id: String(data.ticket_id || ''),
            ticket_number: data.ticket_code || code,
            event_title: data.event || t('scan.unknownEvent'),
            event_date: data.event_start_date
              ? new Date(data.event_start_date).toLocaleString()
              : '',
            user_name: data.user || t('scan.unknownUser'),
            status: data.status || 'validated',
            tier_name: data.tier_name,
            event_id: data.event_id,
          },
          message: data.message || t('scan.ticketValidatedSuccess'),
        });
        toast.success(data.message || t('scan.ticketValidated'));
      } else {
        setScanResult({
          success: false,
          message: data.detail || data.message || t('scan.invalidTicket'),
        });
        toast.error(data.detail || data.message || t('scan.invalidTicket'));
      }
    } catch {
      setScanResult({
        success: false,
        message: t('scan.networkError') || 'Network error. Please try again.',
      });
      toast.error(t('scan.validationFailed') || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setManualCode('');
    setShowManualEntry(false);
    startScanner();
  };

  const toggleFlashlight = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as unknown as { torch?: boolean };

      if (capabilities.torch) {
        await track.applyConstraints({ advanced: [{ torch: !flashlightOn }] } as unknown);
        setFlashlightOn(!flashlightOn);
      } else {
        toast.error(t('scan.flashlightNotAvailable') || 'Flashlight not available');
      }
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      toast.error(t('scan.flashlightNotAvailable') || 'Flashlight not available');
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border-b border-white/10 z-10">
        <button
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate('/');
          }}
          className="p-2 text-white hover:bg-white/10 rounded-full"
        >
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-white font-semibold">{t('scan.title') || 'Ticket Scanner'}</h1>
        <div className="w-10" />
      </div>

      {/* Scan Result Overlay */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#111111] rounded-2xl p-6 w-full max-w-sm border border-white/5"
            >
              {scanResult.success ? (
                <>
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <h2 className="text-white text-xl font-bold text-center mb-2">
                    {t('scan.validTicket') || 'Valid Ticket'}
                  </h2>

                  {selectedEventId && scanResult.ticket?.event_id && scanResult.ticket.event_id !== selectedEventId && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-sm text-center font-medium">
                        {t('scan.wrongEventWarning') || 'This ticket is for a different event'}
                      </p>
                    </div>
                  )}

                  {scanResult.ticket && (
                    <div className="space-y-3 mb-6">
                      <div className="bg-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-5 h-5 text-[#d3da0c]" />
                          <div>
                            <p className="text-gray-500 text-xs">{t('scan.ticketNumber') || 'Ticket'}</p>
                            <p className="text-white text-sm font-mono">{scanResult.ticket.ticket_number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-[#d3da0c]" />
                          <div>
                            <p className="text-gray-500 text-xs">{t('scan.event') || 'Event'}</p>
                            <p className="text-white text-sm">{scanResult.ticket.event_title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-[#d3da0c]" />
                          <div>
                            <p className="text-gray-500 text-xs">{t('scan.attendee') || 'Attendee'}</p>
                            <p className="text-white text-sm">{scanResult.ticket.user_name}</p>
                          </div>
                        </div>
                        {scanResult.ticket.tier_name && (
                          <div className="flex items-center gap-3">
                            <Ticket className="w-5 h-5 text-[#d3da0c]" />
                            <div>
                              <p className="text-gray-500 text-xs">{t('scan.tier') || 'Tier'}</p>
                              <p className="text-white text-sm">{scanResult.ticket.tier_name}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-white text-xl font-bold text-center mb-2">
                    {t('scan.invalidTicketTitle') || 'Invalid Ticket'}
                  </h2>
                  <p className="text-gray-400 text-center mb-6">{scanResult.message}</p>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetScan}
                  className="flex-1 py-3 bg-white/10 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  {t('scan.scanAnother') || 'Scan Another'}
                </button>
                <button
                  onClick={() => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate('/');
                  }}
                  className="flex-1 py-3 bg-[#d3da0c] text-black rounded-xl font-medium"
                >
                  {t('scan.done') || 'Done'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validating overlay */}
      {isValidating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#d3da0c] animate-spin mx-auto mb-3" />
            <p className="text-white">{t('scan.validating') || 'Validating...'}</p>
          </div>
        </div>
      )}

      {/* Camera / Manual Entry */}
      {!scanResult && !showManualEntry && (
        <div className="flex-1 relative flex flex-col">
          {hasCamera !== false ? (
            <>
              {/* Event Selector for Staff */}
              {isStaffUser && staffEvents.length > 0 && (
                <div className="bg-[#111111] border-b border-white/10 px-4 py-3">
                  <label className="block text-gray-500 text-xs mb-1.5">{t('scan.selectEvent') || 'Select Event'}</label>
                  <div className="relative">
                    <select
                      value={selectedEventId || ''}
                      onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm appearance-none focus:border-[#d3da0c] focus:outline-none"
                    >
                      <option value="" className="bg-[#111111]">{t('scan.allEvents') || 'All Events'}</option>
                      {staffEvents.map(event => (
                        <option key={event.id} value={event.id} className="bg-[#111111]">
                          {event.title} — {event.city || ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Scanner Viewport */}
              <div className="flex-1 relative bg-black">
                <div
                  ref={videoContainerRef}
                  id="scan-video-container"
                  className="w-full h-full"
                />

                {/* Scan Frame Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-64">
                    <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-[#d3da0c]" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-[#d3da0c]" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-[#d3da0c]" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-[#d3da0c]" />

                    {isScanning && (
                      <motion.div
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-0.5 bg-[#d3da0c] shadow-[0_0_10px_#d3da0c]"
                      />
                    )}
                  </div>
                </div>

                <div className="absolute top-6 left-0 right-0 text-center pointer-events-none">
                  <p className="text-white/70 text-sm font-medium">
                    {t('scan.positionQR') || 'Point camera at ticket QR code'}
                  </p>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="bg-[#0A0A0A] border-t border-white/10 p-4 pb-safe">
                {cameraError && (
                  <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm text-center">{cameraError}</p>
                  </div>
                )}

                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={toggleFlashlight}
                    className={`p-4 rounded-full transition-colors ${
                      flashlightOn ? 'bg-[#d3da0c] text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    <Flashlight className="w-6 h-6" />
                  </button>

                  <button
                    onClick={() => {
                      stopScanner();
                      setShowManualEntry(true);
                    }}
                    className="p-4 rounded-full bg-white/10 text-white"
                  >
                    <Keyboard className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <Camera className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-center mb-4">
                {cameraError || t('scan.cameraNotAvailable') || 'Camera not available'}
              </p>
              <button
                onClick={() => {
                  setCameraError(null);
                  startScanner();
                }}
                className="px-6 py-3 bg-[#d3da0c] text-black rounded-xl font-medium mb-4"
              >
                {t('scan.retryCamera') || 'Retry Camera'}
              </button>
              <button
                onClick={() => setShowManualEntry(true)}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium"
              >
                {t('scan.enterCodeManually') || 'Enter Code Manually'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry */}
      {showManualEntry && !scanResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 p-4 flex flex-col"
        >
          <form onSubmit={handleManualSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
              <label className="text-white text-lg font-medium mb-4">
                {t('scan.enterTicketCode') || 'Enter Ticket Code'}
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t('scan.codePlaceholder') || 'TKT-XXX-XXX-XXXXXXX-X'}
                className="w-full max-w-xs px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-center text-xl tracking-wider focus:border-[#d3da0c] focus:outline-none font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowManualEntry(false);
                  startScanner();
                }}
                className="flex-1 py-4 bg-white/10 text-white rounded-xl font-medium"
              >
                {t('scan.back') || 'Back'}
              </button>
              <button
                type="submit"
                disabled={!manualCode.trim() || isValidating}
                className="flex-1 py-4 bg-[#d3da0c] text-black rounded-xl font-medium disabled:opacity-50"
              >
                {isValidating ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  t('scan.validate') || 'Validate'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
};

export default ScanPage;
```


---

## 16. Main App Wiring (`main.py` excerpts)

Router registration and the hourly stale-order cleanup background task.

```python
# main.py (excerpts)
from fastapi import FastAPI, BackgroundTasks
from contextlib import asynccontextmanager
import asyncio

from api import (
    payments,
    payments_manual_qr,
    ticketing,
    ticketing_organizer,
    tickets,
    events,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Background task loop
    while True:
        await asyncio.sleep(3600)  # every hour
        try:
            from database import SessionLocal
            from services.ticketing_service import cancel_stale_orders
            db = SessionLocal()
            try:
                count = cancel_stale_orders(db, hours=24)
                logger.info(f"Cancelled {count} stale ticket orders")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Stale order cleanup failed: {e}")


app = FastAPI(title="Sound It API", lifespan=lifespan)

# Register routers
app.include_router(events.router, prefix="/api/v1/events", tags=["Events"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(payments_manual_qr.router, prefix="/api/v1/payments-manual-qr", tags=["Manual QR Payments"])
app.include_router(ticketing.router, prefix="/api/v1/ticketing", tags=["Ticketing"])
app.include_router(ticketing_organizer.router, prefix="/api/v1/ticketing/organizer", tags=["Ticketing Organizer"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["Tickets"])


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

---

## 17. License / Attribution

This code is extracted from the **Sound It** platform project.
It is provided as-is for reference/porting to another platform.
If reused in production, ensure you also port the related supporting code:

- Authentication (`auth.py`, JWT dependency, `get_current_user`, `require_organizer`)
- User / Organizer / Business / Staff models and role checks
- Event model and related endpoints
- Notification service (`api/notifications.py`)
- SMS notification helpers (`services/sms_notifications.py`)
- Upload storage configuration (`utils/upload_storage.py`)
- Payment provider integrations (Stripe, YooPay) if needed
- Database migrations (`scripts/migrate_indexes.py`, `scripts/migrate_all_missing_columns.py`)

---

*Document generated: 2026-08-29*
