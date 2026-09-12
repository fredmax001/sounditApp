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
        # Return subscription plan if present
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
    
    # If tier exists, increment quantity_sold and update status
    if order.ticket_tier_id:
        tier = db.query(TicketTier).filter(TicketTier.id == order.ticket_tier_id).with_for_update().first()
        if tier:
            tier.quantity_sold = (tier.quantity_sold or 0) + tickets_to_generate
            if tier.quantity_sold >= tier.quantity:
                tier.status = TicketStatus.SOLD_OUT
    
    db.commit()
    
    # Refresh all generated tickets to get IDs
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
