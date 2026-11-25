"""
Tickets API - User-facing ticket order and business approval management
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, desc, func
from typing import List, Optional
from datetime import datetime, timezone, date, timedelta
import qrcode
import io
import base64
import hashlib

from database import get_db
from auth import get_current_user, require_organizer, staff_allows
from models import (
    User, Event, TicketOrder, TicketOrderStatus, Ticket, TicketStatus, UserRole, Notification,
    OrganizerFollow, OrganizerProfile, TicketTier,
    EventPromoter, EventPromoterStatus, PromoterReferral, PromoterProfile
)
from services.ticketing_service import (
    get_event_organizer_plan,
    generate_tickets_from_order,
    _generate_qr_code
)
from email_service import send_ticket_approved_email
from services.sms_notifications import notify_user_ticket_approved, notify_user_ticket_rejected

router = APIRouter(prefix="/tickets", tags=["Tickets"])

from utils.upload_storage import save_upload_securely, UploadValidationError


def _create_notification(db: Session, user_id: int, title: str, message: str, notification_type: str, entity_type: str = None, entity_id: int = None):
    """Create in-app notification and trigger push delivery."""
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
    db.refresh(notification)

    # Trigger push delivery (non-blocking)
    try:
        from services.push_service import PushService
        PushService(db).send_notification(notification)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[Push] Failed to send notification: {e}")

    return notification


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
    
    # Update event-promoter stats
    ep.conversions = (ep.conversions or 0) + 1
    ep.tickets_sold = (ep.tickets_sold or 0) + (order.quantity or 1)
    ep.revenue_generated = (ep.revenue_generated or 0) + (order.final_amount or order.payment_amount)
    ep.commission_earned = (ep.commission_earned or 0) + commission_amount
    
    # Update promoter profile stats
    promoter = db.query(PromoterProfile).filter(PromoterProfile.id == ep.promoter_id).first()
    if promoter:
        promoter.total_conversions = (promoter.total_conversions or 0) + 1
        promoter.total_sales = (promoter.total_sales or 0) + (order.final_amount or order.payment_amount)
        promoter.total_commission = (promoter.total_commission or 0) + commission_amount
        promoter.pending_commission = (promoter.pending_commission or 0) + commission_amount
    
    # Update the referral record to converted
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
    buyer_confirmed: bool = Form(False),
    payment_screenshot: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a ticket order after external payment. Order stays PENDING until organizer approves.

    When buyer_confirmed=true the buyer tapped "I completed the payment" after
    returning from the Alipay/WeChat app, so the screenshot is optional and the
    organizer is notified instantly for one-tap approval.
    """
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "ticket purchases")
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

    # One-tap payment confirmation from the mobile deep-link flow
    if buyer_confirmed:
        order.buyer_confirmed_at = datetime.now(timezone.utc)
    
    # Apply referral discount if code provided
    _apply_referral_discount(db, event, order, referral_code)
    
    # Handle screenshot upload (extension whitelist + size cap + server-side name)
    if payment_screenshot:
        try:
            screenshot_url = save_upload_securely(
                payment_screenshot,
                "payment_proofs",
                prefix="ticket_order",
            )
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        order.payment_screenshot = screenshot_url
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
    
    # Instant notification: buyer confirmed payment via the app deep-link flow.
    # This is the manual-QR "callback" - the organizer's own Alipay/WeChat app
    # already notified them of the incoming transfer; we tell them to approve.
    if buyer_confirmed and event.organizer_id:
        try:
            organizer_profile = db.query(OrganizerProfile).filter(
                OrganizerProfile.id == event.organizer_id
            ).first()
            if organizer_profile:
                buyer_label = payer_name or (current_user.first_name or current_user.email or "A buyer")
                _create_notification(
                    db=db,
                    user_id=organizer_profile.user_id,
                    title="Payment Reported: Approve Now",
                    message=(
                        f"¥{actual_payment_amount:.2f} for '{event.title}', "
                        f"{buyer_label} confirmed they completed the payment. "
                        f"Open Ticket Orders to approve and issue the ticket instantly."
                    ),
                    notification_type="ticket_payment_reported",
                    entity_type="ticket_order",
                    entity_id=order.id
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify organizer of buyer confirmation: {e}")
    
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
        tier = None
        if order.ticket_tier_id:
            tier = db.query(TicketTier).filter(TicketTier.id == order.ticket_tier_id).first()
        result.append({
            "id": order.id,
            "event": {
                "id": event.id if event else None,
                "title": event.title if event else None,
                "start_date": event.start_date.isoformat() if event and event.start_date else None,
                "flyer_image": event.flyer_image if event else None,
                "refund_policy": event.refund_policy if event else None,
                "refunds_allowed": bool(event.refunds_allowed) if event else False,
            },
            "payment_amount": order.payment_amount,
            "quantity": order.quantity or 1,
            "status": order.status.value,
            "ticket_code": order.ticket_code,
            "ticket_qr": order.ticket_qr_code,
            "tickets_generated": order.tickets_generated,
            "auto_approved": order.auto_approved,
            "rejection_reason": order.rejection_reason,
            "cancel_reason": order.cancel_reason,
            "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
            "payer_name": order.payer_name,
            "ticket_tier_name": tier.name if tier else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })
    
    return {"orders": result}


@router.post("/my-orders/{order_id}/cancel")
def cancel_my_order(
    order_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel the current user's own ticket order (pending or approved, before the event starts).
    Sets status to CANCELLED and records the reason + the event's refund policy for display."""
    order = db.query(TicketOrder).filter(
        TicketOrder.id == order_id,
        TicketOrder.user_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == TicketOrderStatus.CANCELLED:
        return {
            "message": "Order is already cancelled",
            "status": "cancelled",
            "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
            "refund_policy": None,
        }

    if order.status not in (TicketOrderStatus.PENDING, TicketOrderStatus.APPROVED):
        raise HTTPException(status_code=400, detail="This order can no longer be cancelled")

    event = db.query(Event).filter(Event.id == order.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.refunds_allowed:
        raise HTTPException(status_code=400, detail="Cancellations and refunds are not allowed for this event")

    if order.status == TicketOrderStatus.APPROVED and event.start_date:
        start = event.start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if start <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This event has already started and can no longer be cancelled")

    order.status = TicketOrderStatus.CANCELLED
    order.cancelled_at = datetime.now(timezone.utc)
    order.cancel_reason = (reason or "").strip()[:500] or None
    db.commit()
    db.refresh(order)

    return {
        "message": "Order cancelled successfully",
        "status": "cancelled",
        "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
        "cancel_reason": order.cancel_reason,
        "refund_policy": event.refund_policy if event else None,
    }


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

    # Self-heal: legacy/seeded APPROVED orders approved without ticket generation
    # (no Ticket rows) get their tickets + QR codes generated on first view, so the
    # buyer always has a staff-scannable QR.
    if not tickets and order.status == TicketOrderStatus.APPROVED:
        event = db.query(Event).filter(Event.id == order.event_id).first()
        if event:
            try:
                # generate_tickets_from_order no-ops when tickets_generated > 0,
                # so reset the counter when no Ticket rows actually exist (legacy data)
                order.tickets_generated = 0
                generate_tickets_from_order(
                    db, order, event, reviewed_by=order.reviewed_by, auto_approved=bool(order.auto_approved)
                )
                tickets = db.query(Ticket).filter(Ticket.ticket_order_id == order_id).all()
            except Exception:
                db.rollback()

    # Backfill any ticket missing its QR image
    for t in tickets:
        if not t.qr_code:
            t.qr_code = _generate_qr_code(t.ticket_number)
            db.add(t)
    if any(not t.qr_code for t in tickets):
        db.commit()
        for t in tickets:
            db.refresh(t)

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
    
    # Pre-fetch all ticket tiers and individual tickets in one query to avoid N+1
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
            "buyer_confirmed": order.buyer_confirmed_at is not None,
            "buyer_confirmed_at": order.buyer_confirmed_at.isoformat() if order.buyer_confirmed_at else None,
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

    # Staff workspaces authenticate as the business owner; require the explicit
    # payment-approval permission so check-in staff cannot validate money.
    if not staff_allows(current_user, "ordersApproval"):
        raise HTTPException(
            status_code=403,
            detail="Your staff role does not allow approving ticket payments",
        )
    
    if order.status != TicketOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")
    
    # Prevent duplicate generation
    if order.tickets_generated and order.tickets_generated > 0:
        raise HTTPException(status_code=400, detail="Tickets already generated for this order")
    
    count, tickets = generate_tickets_from_order(
        db, order, event, reviewed_by=current_user.id, auto_approved=False
    )
    
    # Track promoter commission on approval
    _track_conversion_on_approval(db, order)

    # Record canonical financial transaction (Direct QR if organizer QR configured -> 0% fee, NEVER withdrawable)
    try:
        from services.financial_ledger import (
            _event_has_direct_qr,
            _resolve_event_provider_user_id,
            record_direct_qr_transaction,
        )
        amt = float(order.final_amount if order.final_amount is not None else order.payment_amount or 0.0)
        provider_uid, provider_role = _resolve_event_provider_user_id(db, event)
        if amt > 0 and provider_uid:
            has_org_qr = _event_has_direct_qr(db, event)
            ref = (order.payment_reference or "").strip()
            pm = "wechat_qr" if ref.startswith(("4200", "4500")) else ("alipay_qr" if "alipay" in ref.lower() or ref.startswith("2026") else "direct_qr")
            record_direct_qr_transaction(
                db,
                provider_user_id=provider_uid,
                provider_role=provider_role,
                gross_amount=amt,
                source_type="ticket_order",
                source_id=order.id,
                customer_user_id=order.user_id,
                event_id=order.event_id,
                currency="CNY",
                payment_method=pm,
                gateway_reference=ref or None,
                payment_status="confirmed",
                verification_status="evidence_submitted" if order.payment_screenshot else "provider_reported",
                idempotency_key=f"ticket_order:{order.id}",
                classification_confidence="confirmed" if has_org_qr else "ambiguous_needs_review",
                needs_review=not has_org_qr,
                notes=f"Ticket order #{order.id} approved by user #{current_user.id}",
            )
            db.commit()
    except Exception as fin_err:
        logger.warning(f"Warning: failed to record ticket_order #{order.id} financial entry: {fin_err}")
    
    # Send notification to user
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
        # Build list of all individual tickets with their QR codes
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
    
    # Send SMS confirmation (non-blocking) - skip for guest orders
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

    # See approve_ticket_order: staff need the payment-approval permission.
    if not staff_allows(current_user, "ordersApproval"):
        raise HTTPException(
            status_code=403,
            detail="Your staff role does not allow rejecting ticket payments",
        )
    
    if order.status != TicketOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")
    
    order.status = TicketOrderStatus.REJECTED
    order.rejection_reason = reason
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Send notification to user
    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Ticket Rejected",
        message=f"Your ticket request for '{event.title}' was rejected. Reason: {reason}",
        notification_type="ticket_rejected",
        entity_type="ticket_order",
        entity_id=order.id
    )
    
    # Send SMS rejection notice (non-blocking)
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
    
    # Clean input
    ticket_code = ticket_code.strip()
    logger.info(f"Validating ticket (fallback endpoint): '{ticket_code}'")

    # First try to find by TicketOrder ticket_code
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
        
        # Mark as used
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
    
    # Fallback: check individual Ticket records
    ticket = db.query(Ticket).filter(
        func.lower(Ticket.ticket_number) == func.lower(ticket_code)
    ).first()
    
    if not ticket:
        # Also try qr_token
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
    
    # Also mark associated TicketOrder as used if all tickets are used
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
