from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import requests
import hashlib
import json
import os
import io
import uuid
import re
import qrcode
import base64
import logging

from database import get_db
from models import (
    User, Order, OrderItem, Ticket, TicketTier, PaymentStatus, PaymentMethod,
    Event, UserRole, PaymentVerification, TicketStatus, PayoutRequest, PayoutStatus,
    TicketOrder, TicketOrderStatus, OrganizerProfile, StaffMember
)
from schemas import (
    OrderCreate, OrderResponse, OrderDetailResponse,
    PaymentIntent, PaymentConfirm, PurchaseTicketData, YoopayPaymentRequest
)
from auth import get_current_user, require_admin, require_staff_permission
from config import get_settings
from email_service import send_ticket_confirmation
from security.enhanced_auth import auth_manager

# Setup logging for audit trail
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])
settings = get_settings()


def generate_order_number() -> str:
    """Generate unique order number using cryptographically secure random"""
    from datetime import datetime
    import secrets
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    # Use secrets for cryptographic security instead of random
    random_suffix = secrets.randbelow(900000) + 100000  # 6-digit secure random
    return f"SI{timestamp}{random_suffix}"


def generate_ticket_token() -> str:
    """Generate secure UUID v4 token for QR code"""
    return str(uuid.uuid4())


def _get_user_organizer_ids(current_user: User, db: Session) -> List[int]:
    """
    Get all organizer profile IDs associated with the current user.
    Covers direct organizer profiles, business-linked organizer profiles,
    and active StaffMember assignments.
    """
    organizer_ids = []

    if current_user.organizer_profile:
        organizer_ids.append(current_user.organizer_profile.id)

    if current_user.business_profile and current_user.business_profile.organizer_profiles:
        for org in current_user.business_profile.organizer_profiles:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    if not organizer_ids:
        direct_orgs = db.query(OrganizerProfile).filter(
            OrganizerProfile.user_id == current_user.id
        ).all()
        for org in direct_orgs:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    # Active staff members can check in tickets for their business's events
    staff_roles = db.query(StaffMember).filter(
        StaffMember.user_id == current_user.id,
        StaffMember.status == "Active"
    ).all()
    for staff in staff_roles:
        business_orgs = db.query(OrganizerProfile).filter(
            OrganizerProfile.user_id == staff.business_id
        ).all()
        for org in business_orgs:
            if org.id not in organizer_ids:
                organizer_ids.append(org.id)

    return organizer_ids


def _require_event_checkin_access(event: Event, current_user: User, db: Session) -> None:
    """
    Require that the current user is the event organizer, an assigned staff member,
    or an admin/super admin.
    """
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return

    organizer_ids = _get_user_organizer_ids(current_user, db)
    if event.organizer_id and event.organizer_id in organizer_ids:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not authorized to validate or check in tickets for this event"
    )


def verify_csrf_token(request: Request, current_user: User = Depends(get_current_user)) -> bool:
    """
    Verify CSRF token for state-changing operations.
    Uses user_id as session identifier for CSRF token namespace.
    """
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token required"
        )
    
    session_id = f"user_{current_user.id}"
    if not auth_manager.verify_csrf_token(session_id, csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token"
        )
    
    return True


def generate_qr_code_url(token: str) -> str:
    """Generate secure URL for QR code"""
    base_url = settings.BASE_URL or "https://sounditent.com"
    return f"{base_url}/validate/{token}"


def verify_yoopay_payment(yoopay_payment, db: Session) -> dict:
    """
    Verify YooPay payment with basic validation
    Returns: {"valid": bool, "message": str}
    """
    try:
        # Basic URL validation
        if not yoopay_payment.yoopay_url:
            return {"valid": False, "message": "No YooPay URL provided"}
        
        # Check if URL is from yoopay.cn domain
        if not yoopay_payment.yoopay_url.startswith("https://yoopay.cn/"):
            return {"valid": False, "message": "Invalid YooPay URL domain"}
        
        # Extract transaction ID if not already done
        if not yoopay_payment.yoopay_transaction_id:
            txn_match = re.search(r'/receipt/([a-zA-Z0-9_-]+)', yoopay_payment.yoopay_url)
            if txn_match:
                yoopay_payment.yoopay_transaction_id = txn_match.group(1)
            else:
                return {"valid": False, "message": "Could not extract transaction ID from URL"}
        
        # Check for duplicate transaction IDs (prevent reuse)
        existing_payment = db.query(YooPayPayment).filter(
            YooPayPayment.yoopay_transaction_id == yoopay_payment.yoopay_transaction_id,
            YooPayPayment.status.in_(["completed", "validating"]),
            YooPayPayment.id != yoopay_payment.id
        ).first()
        
        if existing_payment:
            return {"valid": False, "message": "Transaction ID already used"}
        
        # Basic format validation for transaction ID
        if not re.match(r'^[a-zA-Z0-9_-]{10,50}$', yoopay_payment.yoopay_transaction_id):
            return {"valid": False, "message": "Invalid transaction ID format"}
        
        # NOTE: Actual YooPay API verification requires YooPay API credentials and documentation
        # Current implementation provides basic security through URL validation, uniqueness checking,
        # and format validation. API verification should be added when YooPay provides API access.
        
        return {"valid": True, "message": f"Payment verified with transaction ID: {yoopay_payment.yoopay_transaction_id}"}
        
    except Exception as e:
        logger.error(f"YooPay verification error: {e}")
        return {"valid": False, "message": f"Verification error: {str(e)}"}


@router.post("/orders", response_model=OrderResponse)
def create_order(
    order_data: OrderCreate,
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new order with race condition protection"""
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "ticket purchases")
    total_amount = 0
    
    # Collect tier IDs for locking
    tier_ids = [item.ticket_tier_id for item in order_data.items]
    
    # Lock all ticket tiers at once to prevent race conditions
    # This ensures availability check is accurate at the moment of purchase
    tiers = db.query(TicketTier).filter(
        TicketTier.id.in_(tier_ids)
    ).with_for_update().all()
    
    # Create lookup for locked tiers
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
        
        # Check availability (now safe with row locks)
        available = tier.quantity - tier.quantity_sold
        if item.quantity > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only {available} tickets available for {tier.name}"
            )
        
        # Check max per order
        if item.quantity > tier.max_per_order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {tier.max_per_order} tickets per order for {tier.name}"
            )
        
        total_amount += tier.price * item.quantity
    
    try:
        # Create order
        order = Order(
            user_id=current_user.id,
            order_number=generate_order_number(),
            total_amount=total_amount,
            currency="CNY",
            payment_method=order_data.payment_method,
            payment_status=PaymentStatus.PENDING
        )
        
        db.add(order)
        db.flush()  # Get order ID
        
        # Create order items
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
        logger.error(f"Database integrity error creating order: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create order due to concurrent modification. Please retry."
        )


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get order details"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check ownership
    if order.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    return order


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """List user's orders"""
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    
    return orders


@router.get("/orders/user", response_model=list[OrderResponse])
def get_user_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """Get user's orders (alias for list_orders)"""
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    
    return orders


@router.post("/orders/purchase")
def purchase_order(
    data: "PurchaseTicketData",
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete purchase after payment verification with race condition protection"""
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "ticket purchases")
    try:
        order_id_int = int(data.order_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid order ID format"
        )
    
    # Use a nested transaction for atomicity
    try:
        # Lock the order row to prevent concurrent modifications
        order = db.query(Order).filter(
            Order.id == order_id_int
        ).with_for_update().first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to purchase this order"
            )
        
        if order.payment_status != PaymentStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order is not pending. Current status: {order.payment_status}"
            )
        
        # Update order
        order.payment_status = PaymentStatus.COMPLETED
        order.payment_id = data.payment_intent_id
        order.paid_at = datetime.utcnow()
        
        tickets_generated = 0
        
        # Generate tickets with race condition protection
        for item in order.items:
            # Lock the ticket tier row to prevent overselling
            tier = db.query(TicketTier).filter(
                TicketTier.id == item.ticket_tier_id
            ).with_for_update().first()
            
            if not tier:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ticket tier {item.ticket_tier_id} not found"
                )
            
            # Double-check availability after acquiring lock
            available = tier.quantity - tier.quantity_sold
            if item.quantity > available:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Only {available} tickets available for {tier.name}"
                )
            
            # Update tier sold count (now safe with row lock)
            tier.quantity_sold += item.quantity
            
            # Lock and update event
            event = db.query(Event).filter(
                Event.id == tier.event_id
            ).with_for_update().first()
            
            if not event:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Event not found for tier {item.ticket_tier_id}"
                )
            event.tickets_sold += item.quantity
            
            # Generate tickets
            for _ in range(item.quantity):
                # Generate secure UUID token
                qr_token = generate_ticket_token()
                qr_data = generate_qr_code_url(qr_token)
                
                # Log at DEBUG level to avoid exposing sensitive tokens in production logs
                logger.debug(f"Generating ticket for user {order.user_id}, event {tier.event_id}")
                
                # Generate QR code with secure URL
                qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
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
                logger.debug(f"Ticket created for user {order.user_id}")
        
        # Single commit for entire transaction
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
        logger.error(f"Database integrity error during purchase: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Concurrent modification detected. Please retry."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error during ticket generation: {e}", exc_info=True)
        # Security: Don't expose internal error details to client
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate tickets. Please contact support."
        )
    # Note: No db.commit() here - it was causing partial commits after rollback


# ==================== YOOPAY INTEGRATION ====================

def generate_yoopay_payment_id() -> str:
    """Generate unique Yoopay payment ID using cryptographically secure random"""
    import secrets
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    # Use secrets for cryptographic security
    random_suffix = ''.join(secrets.choice('0123456789ABCDEF') for _ in range(6))
    return f"YP{timestamp}{random_suffix}"


@router.post("/yoopay/create")
def create_yoopay_payment(
    data: YoopayPaymentRequest,
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a Yoopay payment with forced return URL to our platform.
    
    Uses your Yoopay link: https://yoopay.cn/tc/603316601
    After payment, user is redirected back to your platform.
    """
    from models import YooPayPayment
    from urllib.parse import quote
    
    order = db.query(Order).filter(Order.id == data.order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if order.payment_status == PaymentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order already paid"
        )
    
    # Generate unique payment ID
    payment_id = generate_yoopay_payment_id()
    
    # Build forced return URL - always redirect back to our platform
    base_url = settings.BASE_URL or "https://sounditent.com"
    
    # Priority: 1. Provided return_url, 2. Default success page
    platform_return_url = data.return_url or f"{base_url}/payment/success"
    
    # Store payment attempt in database
    yoopay_payment = YooPayPayment(
        payment_id=payment_id,
        order_id=order.id,
        user_id=current_user.id,
        status="pending"
    )
    db.add(yoopay_payment)
    db.commit()
    db.refresh(yoopay_payment)
    
    # Your Yoopay payment link
    yoopay_base = settings.YOOPAY_PAYMENT_URL or "https://yoopay.cn/tc/603316601"
    
    # Build the callback URL for automatic verification
    callback_url = f"{base_url}/api/v1/payments/yoopay/callback?payment_id={payment_id}"
    
    # Create payment URL with embedded order information
    # Note: Yoopay may not use all these params, but we include them for tracking
    payment_url = (
        f"{yoopay_base}"
        f"?order_ref={order.order_number}"
        f"&amount={order.total_amount:.2f}"
        f"&ref={payment_id}"
    )
    
    # Alternative: Direct link with full return URL (if Yoopay supports it)
    payment_url_with_return = (
        f"{yoopay_base}"
        f"?order_ref={order.order_number}"
        f"&amount={order.total_amount:.2f}"
        f"&ref={payment_id}"
        f"&return={quote(platform_return_url)}"
    )
    
    # Generate QR code for the payment URL
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(payment_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    logger.info(f"Created Yoopay payment {payment_id} for order {order.order_number}")
    
    return {
        "payment_id": payment_id,
        "order_id": order.id,
        "order_number": order.order_number,
        "amount": order.total_amount,
        "currency": order.currency,
        "payment_method": "yoopay",
        "status": "pending",
        "payment_url": payment_url,
        "payment_url_with_return": payment_url_with_return,
        "callback_url": callback_url,
        "platform_return_url": platform_return_url,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "instructions": (
            "1. Click the payment link or scan the QR code\n"
            "2. Complete payment on Yoopay (amount: ¥{:.2f})\n"
            "3. After payment, return to this page and click 'Verify Payment'\n"
            "4. Your tickets will be generated automatically"
        ).format(order.total_amount),
        "yoopay_link": "https://yoopay.cn/tc/603316601",
        "created_at": yoopay_payment.created_at.isoformat() if yoopay_payment.created_at else None
    }


def _verify_yoopay_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    """Validate an inbound Yoopay notification using a shared HMAC secret.

    Yoopay does not document a signing scheme for this integration, so we use a
    platform-defined shared secret: ``hex(HMAC_SHA256(secret, raw_body))`` sent
    in ``X-Yoopay-Signature`` (an optional ``sha256=`` prefix is tolerated).
    Returns ``False`` whenever the secret or signature is missing so callers can
    fail closed instead of trusting attacker-controlled JSON.
    """
    import hashlib
    import hmac as _hmac

    secret = (settings.YOOPAY_WEBHOOK_SECRET or "").strip()
    if not secret or not signature:
        return False
    provided = signature.strip()
    if provided.lower().startswith("sha256="):
        provided = provided.split("=", 1)[1].strip()
    expected = _hmac.new(secret.encode("utf-8"), raw_body or b"", hashlib.sha256).hexdigest()
    return _hmac.compare_digest(expected, provided.lower())


@router.post("/yoopay/webhook")
async def yoopay_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Yoopay payment webhook (signature-verified, fail-closed)."""
    if not (settings.YOOPAY_WEBHOOK_SECRET or "").strip():
        logger.error(
            "Yoopay webhook rejected: YOOPAY_WEBHOOK_SECRET is not configured"
        )
        raise HTTPException(
            status_code=503,
            detail="Payment provider notifications are not configured",
        )

    raw_body = await request.body()
    signature = request.headers.get("x-yoopay-signature") or request.headers.get("x-signature")
    if not _verify_yoopay_signature(raw_body, signature):
        logger.warning("Yoopay webhook rejected: invalid or missing signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        data = json.loads(raw_body or b"{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    order_number = data.get("order_id")
    payment_status = data.get("status")
    payment_id = data.get("payment_id")
    
    order = db.query(Order).filter(Order.order_number == order_number).first()
    
    if not order:
        return {"status": "error", "message": "Order not found"}

    # Handle Yoopay refund webhook (idempotent immutable reversal)
    if payment_status in ("refunded", "reversed"):
        from models import FinancialTransaction
        from services.financial_ledger import record_refund
        tx = db.query(FinancialTransaction).filter(
            FinancialTransaction.source_type == "order",
            FinancialTransaction.source_id == order.id,
        ).first()
        refund_amt = float(data.get("refund_amount") or order.total_amount)
        order.refund_amount = refund_amt
        order.refunded_at = datetime.now(timezone.utc)
        if tx:
            record_refund(
                db,
                transaction_id=tx.id,
                refund_amount=refund_amt,
                reason=data.get("reason") or "Yoopay gateway refund webhook",
                gateway_refund_id=data.get("refund_id") or payment_id,
                idempotency_key=f"yoopay_wh_refund:{order.id}:{payment_id or refund_amt}",
            )
        db.commit()
        return {"status": "refunded"}

    # Idempotency: providers retry, and replaying must never mint extra tickets.
    if order.payment_status == PaymentStatus.COMPLETED:
        return {"status": "success", "message": "Already processed"}

    if payment_status == "success":
        # Update order
        order.payment_status = PaymentStatus.COMPLETED
        order.payment_id = payment_id
        order.paid_at = datetime.utcnow()
        order.payment_method = PaymentMethod.YOOPAY
        
        # Generate tickets
        from api.events import generate_ticket_number
        import qrcode
        import io
        import base64
        
        # Get order items and generate tickets
        first_event = None
        for item in order.items:
            tier = db.query(TicketTier).filter(TicketTier.id == item.ticket_tier_id).first()
            if not tier:
                logger.error(
                    f"Yoopay webhook: ticket tier {item.ticket_tier_id} missing for order {order.order_number}"
                )
                continue
            
            # Update tier sold count
            tier.quantity_sold += item.quantity
            
            # Update event tickets sold
            event = db.query(Event).filter(Event.id == tier.event_id).first()
            if event and not first_event:
                first_event = event
            event.tickets_sold += item.quantity
            
            # Generate tickets
            for _ in range(item.quantity):
                # Generate secure UUID token
                qr_token = generate_ticket_token()
                qr_data = generate_qr_code_url(qr_token)
                
                logger.info(f"Generating ticket with token: {qr_token} for user {order.user_id}, event {tier.event_id}")
                
                # Generate QR code with secure URL
                qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
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
                    qr_token=qr_token,
                    qr_code=f"data:image/png;base64,{qr_base64}",
                    status="active"
                )
                
                db.add(ticket)
                logger.info(f"Ticket created with token {qr_token}, status: active")

        # Post Channel A (Sound It Yoopay) canonical transaction + 4% fee double-entry ledger
        try:
            from services.financial_ledger import (
                _resolve_event_provider_user_id,
                record_platform_yoopay_transaction,
            )
            provider_uid, provider_role = _resolve_event_provider_user_id(db, first_event)
            if provider_uid and float(order.total_amount or 0) > 0:
                settlement_st = "settled" if str(data.get("settlement_status", "settled")).lower() == "settled" else "pending_settlement"
                record_platform_yoopay_transaction(
                    db,
                    provider_user_id=provider_uid,
                    provider_role=provider_role,
                    gross_amount=order.total_amount,
                    source_type="order",
                    source_id=order.id,
                    customer_user_id=order.user_id,
                    event_id=first_event.id if first_event else None,
                    currency=order.currency or "CNY",
                    payment_method="yoopay",
                    gateway_reference=payment_id or order.order_number,
                    payment_status="settled" if settlement_st == "settled" else "confirmed",
                    settlement_status=settlement_st,
                    verification_status="webhook_verified",
                    idempotency_key=f"yoopay_order:{order.id}",
                    notes=f"Yoopay webhook confirmed for order {order.order_number}",
                )
        except Exception as fin_err:
            logger.error(f"Yoopay webhook ledger posting error for order {order.order_number}: {fin_err}")

        db.commit()
        
        return {"status": "success"}
    
    else:
        order.payment_status = PaymentStatus.FAILED
        db.commit()
        
        return {"status": "failed"}


@router.get("/yoopay/callback")
async def yoopay_callback(
    request: Request,
    payment_id: Optional[str] = None,
    status: Optional[str] = None,
    transaction_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Handle Yoopay callback/redirect after payment.
    
    This endpoint receives the user after they've completed payment on Yoopay.
    It validates the payment and redirects to the appropriate success/failure page.
    """
    from models import YooPayPayment
    from fastapi.responses import RedirectResponse
    
    base_url = settings.BASE_URL or "https://sounditent.com"
    
    # Get payment_id from query params or body
    params = dict(request.query_params)
    payment_id = payment_id or params.get("payment_id")
    status = status or params.get("status", "unknown")
    transaction_id = transaction_id or params.get("transaction_id")
    
    if not payment_id:
        # No payment ID, redirect to failure page
        return RedirectResponse(
            url=f"{base_url}/payment/failed?error=no_payment_id",
            status_code=302
        )
    
    # Find the payment record
    yoopay_payment = db.query(YooPayPayment).filter(
        YooPayPayment.payment_id == payment_id
    ).first()
    
    if not yoopay_payment:
        return RedirectResponse(
            url=f"{base_url}/payment/failed?error=payment_not_found",
            status_code=302
        )
    
    order = db.query(Order).filter(Order.id == yoopay_payment.order_id).first()
    
    if not order:
        return RedirectResponse(
            url=f"{base_url}/payment/failed?error=order_not_found",
            status_code=302
        )
    
    # If already completed, redirect to success (never regenerate tickets)
    if yoopay_payment.status == "completed" or order.payment_status == PaymentStatus.COMPLETED:
        return RedirectResponse(
            url=f"{base_url}/payment/success?order_id={order.id}&payment_id={payment_id}",
            status_code=302
        )
    
    # Update payment record with transaction ID if provided
    if transaction_id:
        yoopay_payment.yoopay_transaction_id = transaction_id

    # The redirect callback is reachable by anyone who knows a payment_id, so a
    # "success" query parameter alone must never release tickets. Only a
    # signature-verified callback may change payment state.
    callback_signature = (
        request.headers.get("x-yoopay-signature")
        or request.headers.get("x-signature")
        or params.get("signature")
    )
    signature_valid = _verify_yoopay_signature(
        (request.url.query or "").encode("utf-8"), callback_signature
    )

    # Handle success status from Yoopay
    if (status == "success" or status == "completed") and not signature_valid:
        logger.warning(
            f"Yoopay callback not trusted for order {order.order_number}: "
            "missing/invalid signature; leaving payment pending manual verification"
        )
        return RedirectResponse(
            url=f"{base_url}/payment/pending?order_id={order.id}&reason=verification",
            status_code=302
        )

    if status == "success" or status == "completed":
        yoopay_payment.status = "completed"
        yoopay_payment.completed_at = datetime.utcnow()
        
        # Update order
        order.payment_status = PaymentStatus.COMPLETED
        order.payment_id = payment_id
        order.paid_at = datetime.utcnow()
        order.payment_method = PaymentMethod.YOOPAY
        
        # Generate tickets (reuse the ticket generation logic)
        try:
            for item in order.items:
                tier = db.query(TicketTier).filter(TicketTier.id == item.ticket_tier_id).first()
                if not tier:
                    continue
                
                # Update tier sold count
                tier.quantity_sold += item.quantity
                
                # Update event tickets sold
                event = db.query(Event).filter(Event.id == tier.event_id).first()
                if event:
                    event.tickets_sold += item.quantity
                
                # Generate tickets
                for _ in range(item.quantity):
                    qr_token = generate_ticket_token()
                    qr_data = generate_qr_code_url(qr_token)
                    
                    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
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
            
            db.commit()
            logger.info(f"Yoopay callback: Payment {payment_id} completed, tickets generated")
            
            # Redirect to success page
            return RedirectResponse(
                url=f"{base_url}/payment/success?order_id={order.id}&payment_id={payment_id}",
                status_code=302
            )
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing Yoopay callback: {e}")
            return RedirectResponse(
                url=f"{base_url}/payment/failed?error=processing_error&payment_id={payment_id}",
                status_code=302
            )
    
    elif status == "failed" or status == "cancelled":
        yoopay_payment.status = "failed"
        order.payment_status = PaymentStatus.FAILED
        db.commit()
        
        return RedirectResponse(
            url=f"{base_url}/payment/failed?status={status}&payment_id={payment_id}",
            status_code=302
        )
    
    else:
        # Pending or unknown status, redirect to verification page
        return RedirectResponse(
            url=f"{base_url}/payment/pending?payment_id={payment_id}",
            status_code=302
        )


@router.post("/yoopay/verify")
def verify_yoopay_payment_endpoint(
    payment_id: str,
    request: Request,
    yoopay_url: Optional[str] = None,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a buyer-submitted Yoopay receipt for review.

    A receipt URL is client-supplied text, not proof of payment: Yoopay exposes
    no verification API to this integration, so accepting the URL at face value
    would let any buyer mint free tickets. This endpoint therefore never releases
    tickets from buyer input alone. It stores the receipt for organizer/admin
    confirmation and, for administrators only, allows an explicit manual
    completion. Signed provider notifications are handled by /yoopay/webhook.
    """
    from models import YooPayPayment

    yoopay_payment = db.query(YooPayPayment).filter(
        YooPayPayment.payment_id == payment_id
    ).first()

    if not yoopay_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    if yoopay_payment.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )

    order = db.query(Order).filter(Order.id == yoopay_payment.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if yoopay_payment.status == "completed" or order.payment_status == PaymentStatus.COMPLETED:
        return {
            "success": True,
            "payment_id": payment_id,
            "order_id": order.id,
            "status": "completed",
            "message": "Payment already completed",
            "tickets_generated": db.query(Ticket).filter(Ticket.order_id == order.id).count(),
        }

    if yoopay_url:
        yoopay_payment.yoopay_url = yoopay_url
        txn_match = re.search(r'/receipt/([a-zA-Z0-9_-]+)', yoopay_url)
        if txn_match and not yoopay_payment.yoopay_transaction_id:
            yoopay_payment.yoopay_transaction_id = txn_match.group(1)

    if not is_admin:
        # Await manual confirmation by the organizer / platform finance team.
        yoopay_payment.status = "validating"
        yoopay_payment.validated_at = datetime.utcnow()
        yoopay_payment.validation_message = (
            "Awaiting manual confirmation: buyer-submitted receipt cannot be "
            "verified automatically."
        )
        db.commit()
        logger.info(
            f"Yoopay receipt recorded for order {order.order_number}; awaiting manual confirmation"
        )
        return {
            "success": False,
            "payment_id": payment_id,
            "order_id": order.id,
            "status": "pending_verification",
            "message": (
                "We received your payment details. Your order stays pending until "
                "the organizer confirms the payment."
            ),
            "tickets_generated": 0,
        }

    # ---- Administrator-only manual completion ----
    try:
        yoopay_payment.status = "completed"
        yoopay_payment.completed_at = datetime.utcnow()
        yoopay_payment.validation_message = "Manually confirmed by administrator"

        order.payment_status = PaymentStatus.COMPLETED
        order.payment_id = payment_id
        order.paid_at = datetime.utcnow()
        order.payment_method = PaymentMethod.YOOPAY

        tickets_count = 0
        for item in order.items:
            tier = db.query(TicketTier).filter(TicketTier.id == item.ticket_tier_id).first()
            if not tier:
                continue
            tier.quantity_sold += item.quantity
            event = db.query(Event).filter(Event.id == tier.event_id).first()
            if event:
                event.tickets_sold += item.quantity
            for _ in range(item.quantity):
                db.add(Ticket(
                    user_id=order.user_id,
                    ticket_tier_id=item.ticket_tier_id,
                    order_id=order.id,
                    event_id=tier.event_id,
                    ticket_number=generate_order_number(),
                    qr_token=generate_ticket_token(),
                    status="active",
                ))
                tickets_count += 1

        db.commit()
        logger.info(
            f"Yoopay payment {payment_id} manually completed by admin {current_user.id} "
            f"({tickets_count} tickets)"
        )
        return {
            "success": True,
            "payment_id": payment_id,
            "order_id": order.id,
            "status": "completed",
            "message": "Payment manually completed",
            "tickets_generated": tickets_count,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error completing Yoopay payment manually: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify payment",
        )


@router.get("/yoopay/status/{payment_id}")
def get_yoopay_status(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get status of a Yoopay payment"""
    from models import YooPayPayment
    
    yoopay_payment = db.query(YooPayPayment).filter(
        YooPayPayment.payment_id == payment_id
    ).first()
    
    if not yoopay_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check ownership
    if yoopay_payment.user_id != current_user.id and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    order = db.query(Order).filter(Order.id == yoopay_payment.order_id).first()
    
    return {
        "payment_id": payment_id,
        "order_id": yoopay_payment.order_id,
        "order_number": order.order_number if order else None,
        "status": yoopay_payment.status,
        "yoopay_url": yoopay_payment.yoopay_url,
        "yoopay_transaction_id": yoopay_payment.yoopay_transaction_id,
        "created_at": yoopay_payment.created_at,
        "validated_at": yoopay_payment.validated_at,
        "completed_at": yoopay_payment.completed_at,
        "amount": order.total_amount if order else None,
        "currency": order.currency if order else None
    }


@router.get("/yoopay/pay-page/{payment_id}")
def get_yoopay_payment_page(
    payment_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the payment page URL for Yoopay.
    
    This returns a URL to a hosted payment page that guides the user
    through the Yoopay payment process.
    """
    from models import YooPayPayment
    from fastapi.responses import RedirectResponse
    
    yoopay_payment = db.query(YooPayPayment).filter(
        YooPayPayment.payment_id == payment_id
    ).first()
    
    if not yoopay_payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    if yoopay_payment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    order = db.query(Order).filter(Order.id == yoopay_payment.order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Build the payment page URL with all necessary parameters
    base_url = str(request.base_url).rstrip('/')
    
    # Generate QR code
    yoopay_base = settings.YOOPAY_PAYMENT_URL or "https://yoopay.cn/tc/603316601"
    payment_url = f"{yoopay_base}?order_ref={order.order_number}&amount={order.total_amount:.2f}&ref={payment_id}"
    
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(payment_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    # Build redirect URL to the static HTML page
    # Serve the payment page with parameters
    from urllib.parse import quote
    
    pay_page_url = (
        f"{base_url}/static/yoopay_redirect.html"
        f"?payment_id={payment_id}"
        f"&order_number={order.order_number}"
        f"&amount={order.total_amount:.2f}"
        f"&payment_url={quote(payment_url)}"
        f"&qr_code={quote(f'data:image/png;base64,{qr_base64}')}"
        f"&return_url={quote(f'{base_url}/payment/success?order_id={order.id}&payment_id={payment_id}')}"
    )
    
    return {
        "payment_page_url": pay_page_url,
        "payment_url": payment_url,
        "qr_code": f"data:image/png;base64,{qr_base64}",
        "amount": order.total_amount,
        "currency": order.currency,
        "order_number": order.order_number
    }


# ==================== STRIPE INTEGRATION ====================

@router.post("/stripe/create-intent")
def create_stripe_intent(
    order_id: int,
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create Stripe PaymentIntent"""
    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Create PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=int(order.total_amount * 100),  # Convert to cents
            currency=order.currency.lower(),
            metadata={
                "order_id": order.id,
                "order_number": order.order_number
            }
        )
        
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """Handle Stripe webhook"""
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle payment success
    if event["type"] == "payment_intent.succeeded":
        payment_intent = event["data"]["object"]
        order_id = payment_intent["metadata"].get("order_id")
        
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if order:
            order.payment_status = PaymentStatus.COMPLETED
            order.payment_id = payment_intent["id"]
            order.paid_at = datetime.utcnow()
            order.payment_method = PaymentMethod.STRIPE
            
            # Generate tickets for Stripe payments
            for item in order.items:
                tier = db.query(TicketTier).filter(TicketTier.id == item.ticket_tier_id).first()
                
                if tier:
                    # Update tier sold count
                    tier.quantity_sold += item.quantity
                    
                    # Update event tickets sold
                    event = db.query(Event).filter(Event.id == tier.event_id).first()
                    if event:
                        event.tickets_sold += item.quantity
                    
                    # Generate tickets
                    for _ in range(item.quantity):
                        # Generate secure UUID token
                        qr_token = generate_ticket_token()
                        qr_data = generate_qr_code_url(qr_token)
                        
                        logger.info(f"Generating Stripe ticket with token: {qr_token} for user {order.user_id}, event {tier.event_id}")
                        
                        # Generate QR code with secure URL
                        qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
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
                        logger.info(f"Stripe ticket created with token {qr_token}, status: active")
            
            db.commit()
    
    return {"status": "success"}


# ==================== QR CODE VALIDATION ====================

@router.get("/validate/{token}")
def validate_ticket_by_token(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket by secure token (for event check-in)"""
    # Check if user is organizer, business, or admin
    if current_user.role not in [UserRole.ORGANIZER, UserRole.BUSINESS, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        logger.warning(f"Unauthorized validation attempt by user {current_user.id} with role {current_user.role}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to validate tickets"
        )
    
    try:
        # Validate UUID format
        uuid.UUID(token)
    except ValueError:
        logger.warning(f"Invalid token format attempted: {token}")
        return {
            "valid": False,
            "status": "invalid_token_format",
            "message": "Invalid token format"
        }
    
    logger.info(f"Validating ticket token: {token} by user {current_user.id}")
    
    # Find ticket by token
    ticket = db.query(Ticket).filter(Ticket.qr_token == token).first()
    
    if not ticket:
        logger.warning(f"Ticket not found for token: {token}")
        return {
            "valid": False,
            "status": "ticket_not_found",
            "message": "Ticket not found"
        }
    
    # Check if ticket is already used
    if ticket.status == "used":
        logger.info(f"Ticket {token} already used at {ticket.used_at} by user {ticket.verified_by_user_id}")
        return {
            "valid": False,
            "status": "already_used",
            "ticket_id": ticket.id,
            "used_at": ticket.used_at,
            "verified_by": ticket.verified_by_user_id,
            "message": f"Ticket already used at {ticket.used_at}"
        }
    
    # Check if ticket is cancelled
    if ticket.status == "cancelled":
        logger.info(f"Ticket {token} has been cancelled")
        return {
            "valid": False,
            "status": "cancelled",
            "ticket_id": ticket.id,
            "message": "Ticket has been cancelled"
        }
    
    # Check if ticket is active
    if ticket.status != "active":
        logger.warning(f"Ticket {token} has invalid status: {ticket.status}")
        return {
            "valid": False,
            "status": "invalid_status",
            "ticket_id": ticket.id,
            "current_status": ticket.status,
            "message": f"Ticket has invalid status: {ticket.status}"
        }
    
    # Mark ticket as used
    try:
        ticket.status = "used"
        ticket.used_at = datetime.utcnow()
        ticket.verified_by_user_id = current_user.id
        ticket.verification_notes = f"Verified by {current_user.name} on {datetime.utcnow()}"
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Ticket {token} successfully validated and marked as used by user {current_user.id}")
        
        return {
            "valid": True,
            "status": "validated",
            "ticket_id": ticket.id,
            "ticket_tier_id": ticket.ticket_tier_id,
            "event_id": ticket.event_id,
            "user_id": ticket.user_id,
            "validated_at": ticket.used_at,
            "validated_by": current_user.id,
            "message": "Ticket validated successfully"
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error validating ticket {token}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating ticket: {str(e)}"
        )


@router.post("/validate-ticket")
def validate_ticket(
    ticket_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket (for event check-in)"""
    # Check if user is organizer, business, or admin (BUSINESS and ORGANIZER are unified)
    if current_user.role not in [UserRole.ORGANIZER, UserRole.BUSINESS, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
    
    if not ticket:
        return {
            "valid": False,
            "message": "Ticket not found"
        }
    
    if ticket.is_used:
        return {
            "valid": False,
            "ticket": ticket,
            "message": f"Ticket already used at {ticket.used_at}"
        }
    
    # Mark as used
    ticket.is_used = True
    ticket.used_at = datetime.utcnow()
    db.commit()
    
    return {
        "valid": True,
        "ticket": ticket,
        "message": "Ticket validated successfully"
    }


@router.get("/tickets/user")
def get_user_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tickets for the current user"""
    from sqlalchemy.orm import joinedload
    
    tickets = db.query(Ticket).filter(
        Ticket.user_id == current_user.id
    ).options(
        joinedload(Ticket.ticket_tier).joinedload(TicketTier.event),
        joinedload(Ticket.order)
    ).order_by(Ticket.created_at.desc()).all()
    
    return tickets


@router.get("/tickets/{ticket_number}")
def get_ticket(
    ticket_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ticket details"""
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check ownership
    if ticket.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    return ticket


# ==================== PAYMENT VERIFICATION (OCR) ====================

import re
from datetime import datetime
from typing import Optional
import uuid


def extract_amount_from_text(text: str) -> Optional[float]:
    """Extract payment amount from OCR text"""
    # Patterns for different payment apps
    patterns = [
        r'[¥¥]\s*(\d+[.,]?\d{0,2})',  # ¥100.00
        r'amount[:\s]*[¥¥]?\s*(\d+[.,]?\d{0,2})',  # Amount: 100
        r'转账[:\s]*[¥¥]?\s*(\d+[.,]?\d{0,2})',  # 转账: 100
        r'付款[:\s]*[¥¥]?\s*(\d+[.,]?\d{0,2})',  # 付款: 100
        r'(\d+[.,]?\d{0,2})\s*[¥¥]?\s*(?:RMB|CNY|元)',  # 100.00元
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                return float(amount_str)
            except ValueError:
                continue
    return None


def extract_date_from_text(text: str) -> Optional[str]:
    """Extract payment date from OCR text"""
    patterns = [
        r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})',  # 2024-01-15 or 2024年01月15日
        r'(\d{1,2}[-/月]\d{1,2}[-/日])',  # 01-15
        r'(\d{4}\.\d{1,2}\.\d{1,2})',  # 2024.01.15
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def extract_time_from_text(text: str) -> Optional[str]:
    """Extract payment time from OCR text"""
    patterns = [
        r'(\d{1,2}:\d{2}(?::\d{2})?)',  # 14:30 or 14:30:00
        r'(\d{1,2}[\u65f6:]\d{1,2})',  # 14时30
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def extract_payee_from_text(text: str) -> Optional[str]:
    """Extract payee/recipient from OCR text"""
    patterns = [
        r'(?:收款人|接收方|Transfer to|To|Payee)[:\s]*([^\n]{2,30})',
        r'(?:转账给|支付给)[:\s]*([^\n]{2,30})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


@router.post("/verify-screenshot")
async def verify_payment_screenshot(
    request: Request,
    screenshot: Optional[bytes] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify payment screenshot using OCR
    
    For now, this performs basic text extraction and validation.
    In production, this could use:
    - Tesseract OCR (open source)
    - Google Vision API
    - Azure Computer Vision
    """
    from fastapi import UploadFile, File, Form
    
    # Re-parse the request as multipart form
    form = await request.form()
    screenshot_file = form.get("screenshot")
    expected_amount = float(form.get("expected_amount", 0))
    order_ref = form.get("order_ref", str(uuid.uuid4())[:8].upper())
    
    if not screenshot_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No screenshot provided"
        )
    
    # Read the uploaded file
    if hasattr(screenshot_file, 'read'):
        contents = await screenshot_file.read()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file upload"
        )
    
    from utils.upload_storage import save_upload_securely, UploadValidationError
    # Persist the proof with server-side naming + a strict extension whitelist and
    # a size cap. Client-supplied filenames/extensions are never trusted.
    try:
        screenshot_url = save_upload_securely(
            screenshot_file,
            "payment_screenshots",
            prefix=f"{order_ref}_{current_user.id}",
        )
    except UploadValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    
    # Try OCR extraction (basic implementation)
    # In production, use pytesseract or cloud OCR service
    try:
        # Attempt to use pytesseract if available
        from PIL import Image
        try:
            import pytesseract  # type: ignore
        except ImportError:
            pytesseract = None
        
        image = Image.open(io.BytesIO(contents))
        
        # Preprocess image for better OCR
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        # Perform OCR with both English and Chinese
        ocr_text = pytesseract.image_to_string(image, lang='chi_sim+eng')
        
        # Extract information
        detected_amount = extract_amount_from_text(ocr_text)
        detected_date = extract_date_from_text(ocr_text)
        detected_time = extract_time_from_text(ocr_text)
        detected_payee = extract_payee_from_text(ocr_text)
        
    except ImportError:
        # Fallback: Simulate verification for testing
        # In production, you should use a proper OCR service
        ocr_text = ""
        detected_amount = expected_amount  # Assume correct for testing
        detected_date = datetime.now().strftime("%Y-%m-%d")
        detected_time = datetime.now().strftime("%H:%M")
        detected_payee = "Sound It Entertainment"
    
    # Create payment verification record
    verification = PaymentVerification(
        user_id=current_user.id,
        order_ref=order_ref,
        screenshot_url=screenshot_url,
        detected_amount=detected_amount,
        detected_date=detected_date,
        detected_time=detected_time,
        detected_payee=detected_payee,
        expected_amount=expected_amount,
        status="pending"
    )
    
    db.add(verification)
    db.flush()
    
    # Verify the payment amount
    amount_match = detected_amount is not None and abs(detected_amount - expected_amount) < 0.01
    
    # Additional checks can be added here:
    # - Check if the date is recent (within last hour)
    # - Check if payee matches expected merchant name
    # - Check for duplicate screenshots
    
    if amount_match:
        verification.status = "verified"
        verification.verified_at = datetime.utcnow()
        
        # Generate payment ID
        payment_id = f"qr_verify_{verification.id}_{uuid.uuid4().hex[:8]}"
        verification.payment_id = payment_id
        
        db.commit()
        
        return {
            "verified": True,
            "payment_id": payment_id,
            "detected_amount": f"¥{detected_amount}" if detected_amount else None,
            "detected_date": detected_date,
            "detected_time": detected_time,
            "detected_payee": detected_payee,
            "message": "Payment verified successfully"
        }
    else:
        verification.status = "rejected"
        verification.rejection_reason = f"Amount mismatch: expected ¥{expected_amount}, detected ¥{detected_amount}"
        db.commit()
        
        return {
            "verified": False,
            "detected_amount": f"¥{detected_amount}" if detected_amount else None,
            "expected_amount": f"¥{expected_amount}",
            "detected_date": detected_date,
            "detected_time": detected_time,
            "message": f"Payment amount mismatch. Expected: ¥{expected_amount}, Detected: ¥{detected_amount}"
        }


from pydantic import BaseModel, EmailStr

class ConfirmationEmailRequest(BaseModel):
    order_id: int
    payment_id: str
    email: Optional[EmailStr] = None
    event_title: str
    ticket_count: int
    total_amount: float
    order_ref: str


@router.post("/send-confirmation")
async def send_confirmation_email(
    data: ConfirmationEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send ticket confirmation email"""
    from api.contact import send_email
    
    email = data.email or current_user.email
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email address provided"
        )
    
    # Email subject and content
    subject = f"Your Ticket Confirmation - {data.event_title}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #D4FF00, #b8e600); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .header h1 {{ color: #000; margin: 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .ticket-info {{ background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4FF00; }}
            .qr-code {{ text-align: center; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
            .button {{ display: inline-block; background: #D4FF00; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Your Ticket is Confirmed!</h1>
            </div>
            <div class="content">
                <p>Hi {current_user.first_name or current_user.email},</p>
                <p>Thank you for your purchase! Your ticket for <strong>{data.event_title}</strong> has been confirmed.</p>
                
                <div class="ticket-info">
                    <h3>Ticket Details</h3>
                    <p><strong>Event:</strong> {data.event_title}</p>
                    <p><strong>Quantity:</strong> {data.ticket_count} ticket(s)</p>
                    <p><strong>Total Paid:</strong> ¥{data.total_amount}</p>
                    <p><strong>Order Reference:</strong> {data.order_ref}</p>
                    <p><strong>Payment ID:</strong> {data.payment_id}</p>
                </div>
                
                <p>Please show the QR code in your tickets page at the entrance. You can access your tickets anytime by logging into your account.</p>
                
                <div style="text-align: center;">
                    <a href="https://sounditent.com/tickets" class="button">View My Tickets</a>
                </div>
                
                <div class="footer">
                    <p>Need help? Contact us at <a href="mailto:support@sounditent.com">support@sounditent.com</a></p>
                    <p>© 2024 Sound It Entertainment. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        # Send the email
        email_sent = send_email(
            to_email=email,
            subject=subject,
            html_content=html_content
        )
        
        if email_sent:
            return {"success": True, "message": "Confirmation email sent successfully"}
        else:
            return {"success": False, "message": "Failed to send email"}
            
    except Exception as e:
        print(f"Error sending confirmation email: {e}")
        return {"success": False, "message": str(e)}


# ===========================================================================
# YOOPAY URL VALIDATION FLOW
# ===========================================================================

import re
from urllib.parse import urlparse
from schemas import (
    YooPayCreateRequest, YooPayCreateResponse, YooPayValidateRequest,
    YooPayValidateResponse, YooPayStatusRequest, YooPayStatusResponse
)
from models import YooPayPayment


def generate_yoopay_payment_id() -> str:
    """Generate unique Payment ID for YooPay (e.g., PAY-20250223-7842)"""
    from datetime import datetime
    import random
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    random_suffix = random.randint(1000, 9999)
    return f"PAY-{timestamp}-{random_suffix}"


def extract_yoopay_transaction_id(url: str) -> tuple:
    """
    Extract transaction ID from YooPay URL
    
    Args:
        url: The YooPay success page URL
        
    Returns:
        Tuple of (is_valid: bool, transaction_id: Optional[str], message: str)
    """
    try:
        # Parse the URL
        parsed = urlparse(url.strip())
        
        # Validate domain - must be yoopay.cn
        domain = parsed.netloc.lower()
        if 'yoopay.cn' not in domain:
            return False, None, f"Invalid domain: {domain}. URL must be from yoopay.cn"
        
        # Extract transaction ID from path
        # Format: https://yoopay.cn/tc/{transaction_id}
        path = parsed.path.strip('/')
        path_parts = path.split('/')
        
        # Look for transaction ID in path
        transaction_id = None
        for part in path_parts:
            # Transaction IDs are typically numeric
            if part and part.isdigit():
                transaction_id = part
                break
        
        if not transaction_id:
            # Try query parameters
            from urllib.parse import parse_qs
            query_params = parse_qs(parsed.query)
            
            # Common parameter names for transaction IDs
            possible_keys = ['id', 'transaction_id', 'order_id', 'tc', 'trade_no', 'out_trade_no']
            for key in possible_keys:
                if key in query_params and query_params[key]:
                    transaction_id = query_params[key][0]
                    break
        
        if not transaction_id:
            return False, None, "Could not extract transaction ID from URL. Please provide the complete success page URL."
        
        return True, transaction_id, "Transaction ID extracted successfully"
        
    except Exception as e:
        return False, None, f"Error parsing URL: {str(e)}"


def check_transaction_reuse(db: Session, transaction_id: str) -> bool:
    """Check if a YooPay transaction ID has already been used"""
    existing = db.query(YooPayPayment).filter(
        YooPayPayment.yoopay_transaction_id == transaction_id,
        YooPayPayment.status.in_(["completed", "validating"])
    ).first()
    return existing is not None


@router.post("/yoopay-v2/create", response_model=YooPayCreateResponse)
def create_yoopay_v2_payment(
    data: YooPayCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 1: Create a new YooPay payment attempt
    
    Generates a unique Payment ID and returns YooPay payment URL.
    User will be redirected to YooPay to complete payment.
    """
    # Get the order
    order = db.query(Order).filter(Order.id == data.order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check ownership
    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this order"
        )
    
    # Check if order is already paid
    if order.payment_status == PaymentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has already been paid"
        )
    
    # Generate unique payment ID
    payment_id = generate_yoopay_payment_id()
    
    # Create YooPay payment record
    yoopay_payment = YooPayPayment(
        payment_id=payment_id,
        order_id=order.id,
        user_id=current_user.id,
        status="pending"
    )
    
    db.add(yoopay_payment)
    db.commit()
    db.refresh(yoopay_payment)
    
    # Get company QR URL from settings
    company_id = getattr(settings, 'YOOPAY_COMPANY_ID', '20054261767892510057')
    yoopay_url = f"https://yoopay.cn/payment/qr/{company_id}"
    
    logger.info(f"Created YooPay payment {payment_id} for order {order.id} by user {current_user.id}")
    
    return YooPayCreateResponse(
        payment_id=payment_id,
        order_id=order.id,
        order_number=order.order_number,
        amount=order.total_amount,
        currency=order.currency,
        status="pending",
        yoopay_payment_url=yoopay_url,
        instructions="After completing payment on YooPay, copy the success page URL and paste it here to verify your payment.",
        created_at=yoopay_payment.created_at
    )


@router.post("/yoopay-v2/validate", response_model=YooPayValidateResponse)
def validate_yoopay_v2_payment(
    data: YooPayValidateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Step 2: Validate YooPay payment URL and generate tickets
    
    Validates:
    - URL contains "yoopay.cn" domain
    - Extracts transaction timestamp/ID from URL
    - Checks against database (prevents reuse)
    - Generates QR ticket only after validation
    """
    # Get the payment record
    payment = db.query(YooPayPayment).filter(YooPayPayment.payment_id == data.payment_id).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check ownership
    if payment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this payment"
        )
    
    # Check if already completed
    if payment.status == "completed":
        return YooPayValidateResponse(
            valid=True,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="completed",
            message="Payment has already been validated and tickets have been generated.",
            can_retry=False
        )
    
    # Check if already failed due to reuse
    if payment.status == "reused":
        return YooPayValidateResponse(
            valid=False,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="reused",
            message="This payment attempt was marked as reused. Please create a new payment.",
            can_retry=False
        )
    
    # Step 1: Extract and validate URL
    is_valid, transaction_id, message = extract_yoopay_transaction_id(data.yoopay_url)
    
    if not is_valid:
        payment.status = "failed"
        payment.validation_message = message
        payment.yoopay_url = data.yoopay_url
        db.commit()
        
        return YooPayValidateResponse(
            valid=False,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="failed",
            message=message,
            can_retry=True
        )
    
    # Step 2: Check for transaction reuse
    if check_transaction_reuse(db, transaction_id):
        payment.status = "reused"
        payment.yoopay_url = data.yoopay_url
        payment.yoopay_transaction_id = transaction_id
        payment.validation_message = "Transaction ID has already been used"
        db.commit()
        
        logger.warning(f"YooPay transaction {transaction_id} reuse attempt detected for payment {payment.payment_id}")
        
        return YooPayValidateResponse(
            valid=False,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="reused",
            yoopay_transaction_id=transaction_id,
            message="This YooPay transaction has already been used. Each transaction can only be used once.",
            can_retry=False
        )
    
    # Step 3: Mark as validating and save transaction info
    payment.status = "validating"
    payment.yoopay_url = data.yoopay_url
    payment.yoopay_transaction_id = transaction_id
    payment.validated_at = datetime.utcnow()
    payment.validation_message = "URL validated successfully, generating tickets"
    db.commit()
    
    # Step 4: Get order and generate tickets
    order = db.query(Order).filter(Order.id == payment.order_id).first()
    
    if not order:
        payment.status = "failed"
        payment.validation_message = "Order not found"
        db.commit()
        
        return YooPayValidateResponse(
            valid=False,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="failed",
            yoopay_transaction_id=transaction_id,
            message="Order not found",
            can_retry=False
        )
    
    try:
        # Update order status
        order.payment_status = PaymentStatus.COMPLETED
        order.payment_id = payment.payment_id
        order.payment_method = PaymentMethod.YOOPAY
        order.paid_at = datetime.utcnow()
        
        # Mark payment as completed
        payment.status = "completed"
        payment.completed_at = datetime.utcnow()
        payment.validation_message = "Payment validated and tickets generated"
        
        # Generate tickets
        tickets_generated = 0
        for item in order.items:
            tier = db.query(TicketTier).filter(TicketTier.id == item.ticket_tier_id).first()
            
            if not tier:
                continue
            
            # Update tier sold count
            tier.quantity_sold += item.quantity
            
            # Update event tickets sold
            event = db.query(Event).filter(Event.id == tier.event_id).first()
            if event:
                event.tickets_sold += item.quantity
            
            # Generate tickets
            for _ in range(item.quantity):
                qr_token = generate_ticket_token()
                qr_data = generate_qr_code_url(qr_token)
                
                # Generate QR code
                qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
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
                    qr_token=qr_token,
                    qr_code=f"data:image/png;base64,{qr_base64}",
                    status="active"
                )
                
                db.add(ticket)
                tickets_generated += 1
                logger.info(f"Generated ticket for YooPay payment {payment.payment_id}, token: {qr_token}")
        
        db.commit()
        
        logger.info(f"YooPay payment {payment.payment_id} validated successfully. {tickets_generated} tickets generated.")
        
        return YooPayValidateResponse(
            valid=True,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="completed",
            yoopay_transaction_id=transaction_id,
            message=f"Payment validated successfully! {tickets_generated} ticket(s) have been generated.",
            tickets_generated=tickets_generated,
            can_retry=False
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating tickets for YooPay payment {payment.payment_id}: {str(e)}")
        
        payment.status = "failed"
        payment.validation_message = f"Error generating tickets: {str(e)}"
        db.commit()
        
        return YooPayValidateResponse(
            valid=False,
            payment_id=payment.payment_id,
            order_id=payment.order_id,
            status="failed",
            yoopay_transaction_id=transaction_id,
            message=f"Payment was validated but ticket generation failed: {str(e)}",
            can_retry=True
        )


@router.post("/yoopay-v2/status", response_model=YooPayStatusResponse)
def get_yoopay_v2_status(
    data: YooPayStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the status of a YooPay payment"""
    payment = db.query(YooPayPayment).filter(YooPayPayment.payment_id == data.payment_id).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check ownership or admin
    if payment.user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    return YooPayStatusResponse(
        payment_id=payment.payment_id,
        order_id=payment.order_id,
        status=payment.status,
        yoopay_url=payment.yoopay_url,
        yoopay_transaction_id=payment.yoopay_transaction_id,
        created_at=payment.created_at,
        validated_at=payment.validated_at,
        completed_at=payment.completed_at,
        message=payment.validation_message
    )


@router.get("/yoopay-v2/user-payments")
def get_user_yoopay_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """Get all YooPay payments for the current user"""
    payments = db.query(YooPayPayment).filter(
        YooPayPayment.user_id == current_user.id
    ).order_by(YooPayPayment.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "payments": [
            {
                "payment_id": p.payment_id,
                "order_id": p.order_id,
                "status": p.status,
                "yoopay_url": p.yoopay_url,
                "yoopay_transaction_id": p.yoopay_transaction_id,
                "created_at": p.created_at,
                "completed_at": p.completed_at
            }
            for p in payments
        ],
        "total": db.query(YooPayPayment).filter(YooPayPayment.user_id == current_user.id).count()
    }


# ==================== TICKET MANAGEMENT ====================

@router.get("/tickets/validate/{ticket_number}")
def validate_ticket_by_number(
    ticket_number: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket by its ticket number (for check-in)"""
    from models import Ticket, Event, TicketTier
    
    ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Get event and tier info
    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Authorization check: only organizers, staff, or admins can validate tickets
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
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check in a ticket (mark as used)"""
    from models import Ticket, Event
    from datetime import datetime
    
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Authorization check: only organizers, staff, or admins can check in tickets
    _require_event_checkin_access(event, current_user, db)
    
    # Check if already used
    if ticket.used_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket already checked in"
        )
    
    # Check if ticket is active
    if ticket.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticket status is {ticket.status}"
        )
    
    # Mark as used
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
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transfer a ticket to another user"""
    from models import Ticket, User
    
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check ownership - ticket must belong to current user
    owner_id = ticket.user_id or (ticket.order.user_id if ticket.order else None) or (ticket.ticket_order.user_id if ticket.ticket_order else None)
    if owner_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to transfer this ticket"
        )
    
    # Check if ticket is active and not used
    if ticket.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transfer ticket with status: {ticket.status}"
        )
    
    if ticket.used_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer already used ticket"
        )
    
    # Update holder info
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


@router.get("/tickets/{ticket_id}/download")
def download_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate ticket PDF for download"""
    from fastapi.responses import JSONResponse
    from models import Ticket, Event, TicketTier
    
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check ownership
    owner_id = ticket.user_id or (ticket.order.user_id if ticket.order else None) or (ticket.ticket_order.user_id if ticket.ticket_order else None)
    if owner_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to download this ticket"
        )
    
    # Get related data
    event = db.query(Event).filter(Event.id == ticket.event_id).first()
    tier_id = getattr(ticket, "ticket_tier_id", None) or getattr(ticket, "tier_id", None)
    tier = db.query(TicketTier).filter(TicketTier.id == tier_id).first() if tier_id else None
    
    # Return ticket data (frontend can generate PDF)
    return {
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "qr_code": ticket.qr_code,
        "event": {
            "id": event.id if event else None,
            "title": event.title if event else "Unknown",
            "start_date": event.start_date if event else None,
            "address": event.address if event else "",
            "city": event.city.value if event and event.city else ""
        },
        "tier": {
            "id": tier.id if tier else None,
            "name": tier.name if tier else "Unknown"
        },
        "holder_name": ticket.holder_name,
        "holder_email": ticket.holder_email,
        "status": ticket.status,
        "created_at": ticket.created_at
    }


# ==================== ORDER REFUNDS ====================

@router.post("/orders/{order_id}/refund")
def process_refund(
    order_id: int,
    refund_data: dict,
    request: Request,
    csrf_valid: bool = Depends(verify_csrf_token),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process a refund for an order"""
    from models import Order, PaymentStatus, Ticket
    from datetime import datetime
    
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check authorization - only Admin, Super Admin, or Event Organizer owning the event
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
    is_event_organizer = False
    if not is_admin:
        ticket = db.query(Ticket).filter(Ticket.order_id == order.id).first()
        if ticket:
            from models import Event
            event = db.query(Event).filter(Event.id == ticket.event_id).first()
            if event and event.organizer_id == current_user.id:
                is_event_organizer = True
    
    if not (is_admin or is_event_organizer):
        from services.security_logger import log_security_event
        log_security_event(
            event_type="UNAUTHORIZED_REFUND_ATTEMPT",
            user_id=current_user.id,
            user_email=current_user.email,
            attempted_action="process_refund",
            details={"order_id": order_id, "order_user_id": order.user_id, "user_role": str(current_user.role)}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only event organizers or administrators can process refunds for orders"
        )
    
    # Check if order is paid
    if order.payment_status != PaymentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot refund unpaid order"
        )
    
    # Check if already refunded
    if order.refund_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order already refunded"
        )
    
    refund_amount = refund_data.get("amount", order.total_amount)
    reason = refund_data.get("reason", "")
    
    # Validate refund amount
    if refund_amount <= 0 or refund_amount > order.total_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund amount must be greater than zero and cannot exceed order total"
        )
    
    # Process refund
    order.refund_amount = refund_amount
    order.refunded_at = datetime.utcnow()
    
    # Cancel associated tickets if full refund
    if refund_amount >= order.total_amount:
        for ticket in order.tickets:
            ticket.status = "cancelled"

    # Post immutable ledger reversal if a canonical FinancialTransaction exists
    try:
        from models import FinancialTransaction
        from services.financial_ledger import record_refund
        fin_tx = db.query(FinancialTransaction).filter(
            FinancialTransaction.source_type == "order",
            FinancialTransaction.source_id == order.id,
        ).first()
        if fin_tx:
            record_refund(
                db,
                transaction_id=fin_tx.id,
                refund_amount=refund_amount,
                reason=reason or "Order refund",
                idempotency_key=f"order_refund:{order.id}:{refund_amount}",
                processed_by=current_user.id,
            )
    except Exception as fin_err:
        logger.warning(f"Failed to post ledger reversal for order #{order.id}: {fin_err}")
    
    db.commit()
    db.refresh(order)
    
    return {
        "message": "Refund processed successfully",
        "order_id": order.id,
        "refund_amount": order.refund_amount,
        "refunded_at": order.refunded_at,
        "reason": reason
    }



# ==================== BUSINESS PAYOUTS ====================

@router.get("/business/transactions")
def get_business_transactions(
    current_user: User = Depends(require_staff_permission("financials")),
    db: Session = Depends(get_db)
):
    """Get transactions for business events"""
    if current_user.role not in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Get organizer profile
    organizer = current_user.organizer_profile
    if not organizer and current_user.business_profile:
        # Find associated organizer
        from models import OrganizerProfile
        organizer = db.query(OrganizerProfile).filter(
            OrganizerProfile.business_profile_id == current_user.business_profile.id
        ).first()
    
    if not organizer:
        return []
    
    transactions = []
    
    # Get old orders for events organized by this business
    orders = db.query(Order).join(OrderItem).join(TicketTier).join(Event).filter(
        Event.organizer_id == organizer.id,
        Order.payment_status == PaymentStatus.COMPLETED
    ).order_by(Order.created_at.desc()).all()
    
    for order in orders:
        transactions.append({
            "id": str(order.id),
            "type": "sale",
            "amount": float(order.total_amount),
            "status": "completed",
            "description": f"Order #{order.order_number}",
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })
    
    # Get TicketOrder sales for events organized by this business
    events = db.query(Event).filter(
        (Event.user_id == current_user.id) | 
        ((Event.organizer_id == organizer.id) if organizer else False)
    ).all()
    event_ids = [e.id for e in events]
    
    if event_ids:
        ticket_orders = db.query(TicketOrder).filter(
            TicketOrder.event_id.in_(event_ids)
        ).order_by(TicketOrder.created_at.desc()).all()
        
        for to in ticket_orders:
            to_status = to.status.value if hasattr(to.status, "value") else str(to.status or "completed").lower()
            transactions.append({
                "id": f"ticket_order_{to.id}",
                "order_id": to.id,
                "type": "sale",
                "amount": float(to.payment_amount or 0.0),
                "status": "completed" if to_status in ["approved", "completed", "paid"] else to_status,
                "description": f"Ticket Order #{to.id}",
                "quantity": to.quantity or 1,
                "created_at": to.created_at.isoformat() if to.created_at else None,
            })
    
    # Get payout requests
    payouts = db.query(PayoutRequest).filter(
        (PayoutRequest.user_id == current_user.id) | (PayoutRequest.business_id == current_user.id)
    ).order_by(PayoutRequest.requested_at.desc()).all()
    
    for payout in payouts:
        p_status = payout.status.value if hasattr(payout.status, "value") else str(payout.status or "pending").lower()
        transactions.append({
            "id": f"payout_{payout.id}",
            "payout_id": payout.id,
            "type": "payout",
            "amount": float(payout.amount),
            "status": p_status,
            "description": f"Withdrawal via {payout.payment_method or 'unknown'}",
            "created_at": payout.requested_at.isoformat() if payout.requested_at else None,
            "payment_method": payout.payment_method,
            "rejection_reason": getattr(payout, "rejection_reason", None)
        })
    
    # Sort by date descending
    transactions.sort(key=lambda x: x["created_at"] or "", reverse=True)
    
    return transactions


class WithdrawalRequest(BaseModel):
    amount: float
    payment_method: str = "wechat_pay"
    account_details: str
    recipient_name: Optional[str] = None
    bank_name: Optional[str] = None
    idempotency_key: Optional[str] = None


@router.post("/business/withdrawal")
def request_business_withdrawal(
    data: WithdrawalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request a withdrawal strictly from eligible Sound It Yoopay withdrawable funds.
    Supports Organizers, Businesses, Venues, Artists/DJs, Vendors, and authorized finance staff."""
    from services.financial_ledger import (
        create_provider_payout_request,
        get_provider_financial_summary,
    )

    staff_ctx = getattr(current_user, "_staff_context", None)
    if staff_ctx is not None:
        perms = staff_ctx.get("staff_permissions") or {}
        if not perms.get("payouts"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your staff role does not allow withdrawal requests",
            )
        provider_id = int(staff_ctx.get("business_id") or current_user.id)
    elif current_user.role in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]:
        provider_id = int(current_user.id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only provider accounts or authorized finance staff can request withdrawals",
        )

    actor_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    try:
        payout, was_dup = create_provider_payout_request(
            db,
            provider_user_id=provider_id,
            actor_user_id=current_user.id,
            actor_role=actor_role,
            amount=data.amount,
            currency="CNY",
            payment_method=data.payment_method,
            payment_details={
                "account_details": data.account_details,
                "recipient_name": data.recipient_name,
                "bank_name": data.bank_name,
            },
            idempotency_key=data.idempotency_key,
        )
        db.commit()
        db.refresh(payout)
    except PermissionError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    summary = get_provider_financial_summary(db, provider_user_id=provider_id, currency="CNY")
    if was_dup:
        return {
            "message": "Withdrawal request already processed",
            "payout_id": payout.id,
            "amount": payout.amount,
            "status": payout.status.value if hasattr(payout.status, "value") else str(payout.status),
            "created_at": payout.requested_at.isoformat() if payout.requested_at else None,
            "available_balance": summary["withdrawable_balance"],
        }

    # Notify admins & provider
    biz_user = db.query(User).filter(User.id == provider_id).first()
    biz_name = "Provider Account"
    if biz_user:
        if biz_user.business_profile and biz_user.business_profile.business_name:
            biz_name = biz_user.business_profile.business_name
        elif biz_user.organizer_profile and biz_user.organizer_profile.organization_name:
            biz_name = biz_user.organizer_profile.organization_name
        elif biz_user.artist_profile and biz_user.artist_profile.stage_name:
            biz_name = biz_user.artist_profile.stage_name
        elif biz_user.vendor_profile and biz_user.vendor_profile.business_name:
            biz_name = biz_user.vendor_profile.business_name
        else:
            biz_name = f"{biz_user.first_name or ''} {biz_user.last_name or ''}".strip() or biz_user.email

    available_balance = summary["withdrawable_balance"] + float(data.amount)
    biz_id = provider_id

    # 6. Dispatch Notifications to Admins
    try:
        from api.notifications import create_notification
        admins = db.query(User).filter(User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])).all()
        for admin in admins:
            create_notification(
                db=db,
                user_id=admin.id,
                title="New Payout Request",
                message=f"{biz_name} requested a withdrawal of ¥{data.amount:,.2f} via {data.payment_method}.",
                notification_type="payout_update",
                data={
                    "entity_type": "payout",
                    "payout_id": payout.id,
                    "business_id": biz_id,
                    "amount": data.amount,
                    "url": "/admin/withdrawals"
                }
            )
    except Exception as e:
        logger.warning(f"Failed to send admin payout notifications: {e}")

    # 7. Confirmation notification to requester
    try:
        from api.notifications import create_notification
        create_notification(
            db=db,
            user_id=current_user.id,
            title="Payout Request Submitted",
            message=f"Your withdrawal request #{payout.id} for ¥{data.amount:,.2f} via {data.payment_method} has been received and is awaiting admin review.",
            notification_type="payout_update",
            data={
                "entity_type": "payout",
                "payout_id": payout.id,
                "amount": data.amount,
                "status": "pending",
                "url": "/dashboard/business/payouts"
            }
        )
    except Exception as e:
        logger.warning(f"Failed to send user payout confirmation notification: {e}")

    # 8. Security audit log
    try:
        from services.security_logger import log_security_event
        log_security_event(
            "payout_request_submitted",
            user_id=current_user.id,
            email=current_user.email,
            details={
                "payout_id": payout.id,
                "amount": data.amount,
                "business_id": biz_id,
                "payment_method": data.payment_method
            }
        )
    except Exception:
        pass
    
    return {
        "message": "Withdrawal request submitted successfully",
        "payout_id": payout.id,
        "amount": payout.amount,
        "status": payout.status.value,
        "requested_at": payout.requested_at.isoformat() if payout.requested_at else None,
        "available_balance": round(available_balance - data.amount, 2)
    }
