"""
Ticketing Service - Hybrid payment logic, auto-approval, and ticket generation
"""
from datetime import datetime, timezone, timedelta, date
from typing import Tuple, Optional
from sqlalchemy.orm import Session
import uuid
import qrcode
import io
import base64

from models import (
    Event, TicketOrder, TicketOrderStatus, Ticket, OrganizerProfile,
    UserRole, Notification, TicketTier
)
from services.subscription_service import SubscriptionService


def _create_notification(db: Session, user_id: int, title: str, message: str,
                         notification_type: str, data: dict = None):
    try:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            data=data or {},
            is_read=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(notification)
        db.commit()
    except Exception:
        db.rollback()
        # Notifications are non-critical; don't crash ticket flow
        pass


def get_event_organizer_plan(db: Session, event_id: int) -> str:
    """Returns the organizer's subscription plan: basic, pro, or premium"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event or not event.organizer_id:
        return "basic"  # Default for events without organizer
    
    organizer = db.query(OrganizerProfile).filter(
        OrganizerProfile.id == event.organizer_id
    ).first()
    if not organizer:
        return "basic"
    
    status = SubscriptionService.get_subscription_status(db, organizer.user_id)
    if status.get("has_active_subscription"):
        return status.get("plan_type", "basic")
    
    return "basic"


def get_ticket_price(db: Session, order: TicketOrder, event: Event) -> float:
    """Get the unit ticket price for an order"""
    if order.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == order.ticket_tier_id).first()
        if tier:
            return tier.price
    if event.ticket_price is not None:
        return event.ticket_price
    return 0.0


def validate_payment_screenshot(db: Session, order: TicketOrder, event: Event) -> Tuple[bool, str]:
    """
    Validate uploaded payment screenshot for Basic/Pro auto-approval.
    Returns (is_valid, notes).
    """
    unit_price = get_ticket_price(db, order, event)
    quantity = order.quantity or 1
    expected_amount = unit_price * quantity
    
    notes_parts = []
    is_valid = True
    
    # Amount validation
    if expected_amount > 0:
        if order.payment_amount >= expected_amount:
            notes_parts.append(f"Amount OK: ¥{order.payment_amount:.2f} >= ¥{expected_amount:.2f}")
        else:
            notes_parts.append(f"Amount insufficient: ¥{order.payment_amount:.2f} < ¥{expected_amount:.2f}")
            is_valid = False
    else:
        notes_parts.append("Free event - amount not validated")
    
    # Date validation (allow within last 2 days to handle timezone edge cases)
    today = date.today()
    payment_date = order.payment_date
    if not payment_date and order.created_at:
        payment_date = order.created_at.date() if hasattr(order.created_at, 'date') else None
    
    if payment_date:
        delta = (today - payment_date).days
        if 0 <= delta <= 2:
            notes_parts.append(f"Date OK: {payment_date}")
        else:
            notes_parts.append(f"Date mismatch: {payment_date} not within last 2 days")
            is_valid = False
    else:
        notes_parts.append(f"Date assumed today: {today}")
    
    return is_valid, "; ".join(notes_parts)


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
        # Already generated - prevent duplicates
        existing = db.query(Ticket).filter(Ticket.ticket_order_id == order.id).all()
        return len(existing), existing
    
    unit_price = get_ticket_price(db, order, event)
    quantity = order.quantity or 1
    
    # If payment_amount was higher than expected, still only generate quantity tickets
    # (quantity was set at order creation)
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
    
    # Update order
    order.tickets_generated = tickets_to_generate
    order.status = TicketOrderStatus.APPROVED
    order.auto_approved = auto_approved
    if reviewed_by:
        order.reviewed_by = reviewed_by
    order.reviewed_at = datetime.now(timezone.utc)
    
    # Also set legacy single ticket_code for backward compatibility
    if generated:
        order.ticket_code = generated[0].ticket_number
        order.ticket_qr_code = generated[0].qr_code
    
    # Increment event tickets sold
    if event.tickets_sold is None:
        event.tickets_sold = 0
    event.tickets_sold += tickets_to_generate
    
    # If tier exists, increment quantity_sold
    if order.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == order.ticket_tier_id).first()
        if tier:
            tier.quantity_sold = (tier.quantity_sold or 0) + tickets_to_generate
    
    db.commit()
    
    # Refresh all generated tickets to get IDs
    for t in generated:
        db.refresh(t)
    
    return tickets_to_generate, generated


def auto_process_ticket_order(db: Session, order_id: int) -> Tuple[bool, str]:
    """
    Auto-process a ticket order for ALL plans.
    Strict validation: if amount/date checks fail, order is REJECTED.
    If validation passes, tickets are generated immediately.
    Returns (success, message).
    """
    order = db.query(TicketOrder).filter(TicketOrder.id == order_id).first()
    if not order:
        return False, "Order not found"
    
    if order.status != TicketOrderStatus.PENDING:
        return False, f"Order is not pending (status: {order.status.value})"
    
    event = db.query(Event).filter(Event.id == order.event_id).first()
    if not event:
        return False, "Event not found"
    
    # Strict validation for all plans
    is_valid, notes = validate_payment_screenshot(db, order, event)
    order.validation_notes = notes
    
    if not is_valid:
        order.status = TicketOrderStatus.REJECTED
        order.rejection_reason = f"Auto-rejected: {notes}"
        order.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        
        _create_notification(
            db=db,
            user_id=order.user_id,
            title="Ticket Rejected",
            message=f"Your ticket order for '{event.title}' was auto-rejected. Reason: {notes}",
            notification_type="ticket_rejected",
            data={"order_id": order.id, "event_id": event.id, "reason": notes}
        )
        return False, f"Auto-rejected: {notes}"
    
    count, _ = generate_tickets_from_order(db, order, event, auto_approved=True)
    
    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Ticket Approved",
        message=f"Your ticket for '{event.title}' has been approved. Show your QR code at the entrance.",
        notification_type="ticket_approved",
        data={"order_id": order.id, "event_id": event.id, "tickets_count": count, "auto_approved": True}
    )
    
    return True, f"Ticket approved. Generated {count} ticket(s)."


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
        count += 1
    
    db.commit()
    return count
