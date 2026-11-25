"""
Table Reservation System API (Bottle Service Model)
Pro/Premium plan feature for Business users
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc, func, or_
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import shutil
import os
import qrcode
import io
import base64
import hashlib

from database import get_db
from auth import get_current_user, require_admin
from models import (
    User, Event, TablePackage, TableOrder, TableOrderStatus,
    DrinkItem, UserRole, SubscriptionPlan, SubscriptionStatus
)
from services.subscription_service import SubscriptionService
from services.ticketing_service import generate_tickets_for_table_order
from middleware.subscription_access import plan_restricted_error
from schemas import TableUpgradeSubmit, UpgradeResolve

router = APIRouter(prefix="/tables", tags=["Table Reservations"])

from utils.ocr_service import extract_payment_reference

from utils.upload_storage import (
    get_upload_dir,
    save_upload_securely,
    UploadValidationError,
    SAFE_IMAGE_EXTENSIONS,
)


def check_table_access(user: User, db: Session):
    """Check if user has access to table reservation features"""
    if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN, "admin", "super_admin"] or getattr(user, "is_superuser", False) or getattr(user, "role_type", "") in ["admin", "super_admin"]:
        return
    
    if user.role not in [UserRole.BUSINESS, UserRole.ORGANIZER]:
        raise HTTPException(
            status_code=403,
            detail="Table reservations are only available for Business and Organizer accounts"
        )
    
    if getattr(user, "is_verified", False) or getattr(user, "is_approved", False):
        return
    
    # Check subscription plan
    sub_status = SubscriptionService.get_subscription_status(db, user.id)
    
    if not sub_status["has_active_subscription"]:
        raise plan_restricted_error(
            feature_name="table_reservations",
            current_plan=None,
            required_plan="pro"
        )
    
    plan_type = sub_status.get("plan_type", "").lower()
    if plan_type not in ["pro", "premium"]:
        raise plan_restricted_error(
            feature_name="table_reservations",
            current_plan=plan_type,
            required_plan="pro"
        )


# ==================== BUSINESS ENDPOINTS ====================

@router.get("/business/packages")
def get_my_table_packages(
    event_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all table packages for the business"""
    check_table_access(current_user, db)
    
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN, "admin", "super_admin"] or getattr(current_user, "is_superuser", False)
    
    query = db.query(TablePackage)
    if not is_admin:
        query = query.filter(TablePackage.business_id == current_user.id)
    
    if event_id:
        query = query.filter(TablePackage.event_id == event_id)
    
    packages = query.order_by(asc(TablePackage.display_order)).all()
    
    return [{
        "id": p.id,
        "event_id": p.event_id,
        "event_title": p.event.title if p.event else None,
        "name": p.name,
        "price": p.price,
        "description": p.description,
        "included_items": p.included_items or [],
        "drinks": p.drinks or [],
        "extras": p.extras or [],
        "ticket_quantity": p.ticket_quantity,
        "max_people": p.max_people,
        "display_order": p.display_order,
        "is_active": p.is_active,
        "image_url": p.image_url,
        "drink_menu_image_url": p.drink_menu_image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in packages]


@router.post("/business/packages")
def create_table_package(
    event_id: int = Form(...),
    name: str = Form(...),
    price: float = Form(...),
    description: Optional[str] = Form(None),
    included_items: str = Form("[]"),  # JSON string
    drinks: str = Form("[]"),
    extras: str = Form("[]"),
    ticket_quantity: int = Form(0),
    max_people: Optional[int] = Form(None),
    total_tables: int = Form(1),
    display_order: int = Form(0),
    image: Optional[UploadFile] = File(None),
    drink_menu_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new table package"""
    check_table_access(current_user, db)
    
    # Verify event ownership
    # Resolve organizer_id from user's organizer profile
    organizer_id = None
    if current_user.organizer_profile:
        organizer_id = current_user.organizer_profile.id
    elif current_user.business_profile and current_user.business_profile.organizer_profiles:
        organizer_id = current_user.business_profile.organizer_profiles[0].id
    
    event = db.query(Event).filter(
        and_(
            Event.id == event_id,
            Event.organizer_id == organizer_id
        )
    ).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found or not owned by you")
    
    import json

    # Handle image upload
    image_url = None
    if image:
        try:
            image_url = save_upload_securely(
                image, "table_orders",
                allowed_extensions=SAFE_IMAGE_EXTENSIONS,
                prefix=f"table_pkg_{current_user.id}",
            )
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    # Handle drink menu image upload
    drink_menu_image_url = None
    if drink_menu_image:
        try:
            drink_menu_image_url = save_upload_securely(
                drink_menu_image, "table_orders",
                allowed_extensions=SAFE_IMAGE_EXTENSIONS,
                prefix=f"table_drink_menu_{current_user.id}",
            )
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    
    package = TablePackage(
        event_id=event_id,
        business_id=current_user.id,
        name=name,
        price=price,
        description=description,
        included_items=json.loads(included_items) if included_items else [],
        drinks=json.loads(drinks) if drinks else [],
        extras=json.loads(extras) if extras else [],
        ticket_quantity=ticket_quantity,
        max_people=max_people,
        total_tables=total_tables,
        display_order=display_order,
        image_url=image_url,
        drink_menu_image_url=drink_menu_image_url
    )
    
    db.add(package)
    db.commit()
    db.refresh(package)
    
    return {
        "message": "Table package created successfully",
        "package_id": package.id,
        "package": {
            "id": package.id,
            "name": package.name,
            "price": package.price,
            "event_id": package.event_id,
        }
    }


import json
from decimal import Decimal, ROUND_HALF_UP


def _yuan(cents: int) -> float:
    return float((Decimal(cents) / Decimal(100)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def _cents(value) -> int:
    return int((Decimal(str(value or 0)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _calc_table_financials(event, package, guest_count: int) -> dict:
    """Authoritative server-side calculation (integer cents) per Table_Packages_Drinks_Spec §2.

    ticket_total = guest_count × event ticket price
    table_allocation = ticket price × allocation% (ONCE per table)
    drink_allowance = package price − ticket_total − table_allocation
    Raises 400 with a clear configuration error when inputs are missing/invalid.
    """
    if event.ticket_price is None or event.ticket_price <= 0:
        raise HTTPException(status_code=400, detail="Table packages are unavailable: the event has no ticket price configured.")
    if event.table_allocation_percent is None:
        raise HTTPException(status_code=400, detail="Table packages are unavailable: the organizer has not configured the table allocation percentage for this event.")

    ticket_price_c = _cents(event.ticket_price)
    ticket_total_c = ticket_price_c * guest_count
    allocation_c = int((Decimal(ticket_price_c) * Decimal(str(event.table_allocation_percent)) / Decimal(100)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    package_c = _cents(package.price)
    allowance_c = package_c - ticket_total_c - allocation_c

    if allowance_c < 0:
        raise HTTPException(
            status_code=400,
            detail=(f"Package configuration error: the drink allowance would be negative "
                    f"(package ¥{_yuan(package_c)}, tickets ¥{_yuan(ticket_total_c)}, table allocation ¥{_yuan(allocation_c)}). "
                    f"Please contact the organizer.")
        )

    return {
        "ticket_price": _yuan(ticket_price_c),
        "ticket_total": _yuan(ticket_total_c),
        "allocation_percent": event.table_allocation_percent,
        "allocation_amount": _yuan(allocation_c),
        "package_price": _yuan(package_c),
        "drink_allowance": _yuan(allowance_c),
        "allowance_cents": allowance_c,
    }


def _serialize_order(o, include_tickets: bool = False, db=None):
    base = {
        "id": o.id,
        "package": {
            "id": o.table_package.id if o.table_package else None,
            "name": o.table_package.name if o.table_package else None,
            "price": o.table_package.price if o.table_package else None,
            "included_items": o.table_package.included_items if o.table_package else [],
        },
        "event": {
            "id": o.event.id if o.event else None,
            "title": o.event.title if o.event else None,
            "start_date": o.event.start_date.isoformat() if o.event and o.event.start_date else None,
        },
        "business": {
            "id": o.business.id if o.business else None,
            "name": f"{o.business.first_name or ''} {o.business.last_name or ''}".strip() if o.business else None,
        },
        "contact_name": o.contact_name,
        "contact_phone": o.contact_phone,
        "guest_count": o.guest_count,
        "guest_names": o.guest_names or [],
        "payment_amount": o.payment_amount,
        "status": o.status.value,
        "special_requests": o.special_requests,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "reviewed_at": o.reviewed_at.isoformat() if o.reviewed_at else None,
        "rejection_reason": o.rejection_reason,
        "ticket_code": o.ticket_code,
        "ticket_qr": o.ticket_qr_code,
        # Financial snapshot + drinks
        "ticket_price_snapshot": o.ticket_price_snapshot,
        "allocation_amount": o.allocation_amount,
        "drink_allowance": o.drink_allowance,
        "allowance_used": o.allowance_used,
        "drink_selections": o.drink_selections or [],
        "buyer_confirmed_at": o.buyer_confirmed_at.isoformat() if o.buyer_confirmed_at else None,
        # Upgrade workflow
        "upgrade_request": o.upgrade_request,
        "upgrade_status": str(o.upgrade_status or "none").lower(),
        "upgrade_final_price": o.upgrade_final_price,
        "upgrade_payment_status": o.upgrade_payment_status,
        "tickets_generated": o.tickets_generated or 0,
    }
    if include_tickets and db is not None:
        from models import Ticket
        tickets = db.query(Ticket).filter(Ticket.table_order_id == o.id).all()
        base["tickets"] = [{
            "id": t.id,
            "ticket_number": t.ticket_number,
            "qr_code": t.qr_code,
            "is_used": t.is_used,
        } for t in tickets]
    return base
    


@router.put("/business/packages/{package_id}")
def update_table_package(
    package_id: int,
    name: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    included_items: Optional[str] = Form(None),
    drinks: Optional[str] = Form(None),
    extras: Optional[str] = Form(None),
    ticket_quantity: Optional[int] = Form(None),
    max_people: Optional[int] = Form(None),
    total_tables: Optional[int] = Form(None),
    display_order: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    drink_menu_image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a table package"""
    check_table_access(current_user, db)
    
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN, "admin", "super_admin"] or getattr(current_user, "is_superuser", False)
    
    query = db.query(TablePackage).filter(TablePackage.id == package_id)
    if not is_admin:
        query = query.filter(TablePackage.business_id == current_user.id)
    
    package = query.first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    import json
    
    if name is not None:
        package.name = name
    if price is not None:
        package.price = price
    if description is not None:
        package.description = description
    if included_items is not None:
        package.included_items = json.loads(included_items)
    if drinks is not None:
        package.drinks = json.loads(drinks)
    if extras is not None:
        package.extras = json.loads(extras)
    if ticket_quantity is not None:
        package.ticket_quantity = ticket_quantity
    if max_people is not None:
        package.max_people = max_people
    if total_tables is not None:
        package.total_tables = total_tables
    if display_order is not None:
        package.display_order = display_order
    if is_active is not None:
        package.is_active = is_active
    
    # Handle drink menu image upload
    if drink_menu_image:
        try:
            package.drink_menu_image_url = save_upload_securely(
                drink_menu_image, "table_orders",
                allowed_extensions=SAFE_IMAGE_EXTENSIONS,
                prefix=f"table_drink_menu_{current_user.id}",
            )
        except UploadValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    
    db.commit()
    db.refresh(package)
    
    return {"message": "Table package updated", "package_id": package.id}


@router.delete("/business/packages/{package_id}")
def delete_table_package(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a table package"""
    check_table_access(current_user, db)
    
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN, "admin", "super_admin"] or getattr(current_user, "is_superuser", False)
    
    query = db.query(TablePackage).filter(TablePackage.id == package_id)
    if not is_admin:
        query = query.filter(TablePackage.business_id == current_user.id)
    
    package = query.first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Check for existing orders
    existing_orders = db.query(TableOrder).filter(
        TableOrder.table_package_id == package_id
    ).all()
    
    approved_orders = [o for o in existing_orders if o.status == TableOrderStatus.APPROVED]
    if approved_orders:
        # If approved customer orders exist, deactivate to keep order history intact
        package.is_active = False
        db.commit()
        return {"message": "Package deactivated (has approved orders)", "deactivated": True}
    
    # Clean up non-approved orders (pending/rejected/cancelled) and permanently delete package
    for o in existing_orders:
        db.delete(o)
    
    db.delete(package)
    db.commit()
    
    return {"message": "Table package deleted"}


@router.get("/business/orders")
def get_business_table_orders(
    status: Optional[str] = None,
    event_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all table orders for business"""
    check_table_access(current_user, db)
    
    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN, "admin", "super_admin"] or getattr(current_user, "is_superuser", False)
    query = db.query(TableOrder)
    if not is_admin:
        query = query.filter(TableOrder.business_id == current_user.id)
    
    if status:
        query = query.filter(TableOrder.status == TableOrderStatus(status))
    if event_id:
        query = query.filter(TableOrder.event_id == event_id)
    
    orders = query.order_by(desc(TableOrder.created_at)).all()
    
    return [_serialize_order(o, include_tickets=True, db=db) | {
        "user": {
            "id": o.user.id if o.user else None,
            "name": f"{o.user.first_name or ''} {o.user.last_name or ''}".strip() if o.user else None,
            "email": o.user.email if o.user else None,
        },
        "contact_phone": o.contact_phone,
        "contact_email": o.contact_email,
        "payment_screenshot": o.payment_screenshot,
    } for o in orders]


@router.get("/business/orders/export-pdf")
def export_business_table_orders_pdf(
    event_id: Optional[int] = None,
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download an Event-Day PDF sheet of table booking requests, drink selections, mixers, and special requests."""
    from fastapi.responses import Response
    from utils.table_orders_pdf import generate_table_orders_pdf
    import re

    check_table_access(current_user, db)

    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN, "admin", "super_admin"] or getattr(current_user, "is_superuser", False)
    query = db.query(TableOrder)
    if not is_admin:
        query = query.filter(TableOrder.business_id == current_user.id)

    if order_id:
        query = query.filter(TableOrder.id == order_id)
    else:
        if event_id:
            query = query.filter(TableOrder.event_id == event_id)
        if status and status != "all":
            if status == "active":
                query = query.filter(TableOrder.status.in_([TableOrderStatus.APPROVED, TableOrderStatus.PENDING, TableOrderStatus.USED]))
            else:
                query = query.filter(TableOrder.status == TableOrderStatus(status))

    orders = query.order_by(asc(TableOrder.id)).all()

    serialized = [_serialize_order(o, include_tickets=True, db=db) | {
        "user": {
            "id": o.user.id if o.user else None,
            "name": f"{o.user.first_name or ''} {o.user.last_name or ''}".strip() if o.user else None,
            "email": o.user.email if o.user else None,
        },
        "contact_phone": o.contact_phone,
        "contact_email": o.contact_email,
    } for o in orders]

    event_title = None
    event_date = None
    if event_id:
        ev = db.query(Event).filter(Event.id == event_id).first()
        if ev:
            event_title = ev.title
            event_date = ev.start_date.strftime("%Y-%m-%d %H:%M") if getattr(ev, "start_date", None) else None
    elif order_id and orders and orders[0].event:
        ev = orders[0].event
        event_title = ev.title
        event_date = ev.start_date.strftime("%Y-%m-%d %H:%M") if getattr(ev, "start_date", None) else None

    org_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.username or current_user.email
    pdf_bytes = generate_table_orders_pdf(
        orders=serialized,
        event_title=event_title,
        event_date=event_date,
        organizer_name=org_name,
    )

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", (event_title or "all-events")).strip("-").lower() or "event"
    date_part = datetime.now().strftime("%Y%m%d")
    filename = f"table-bookings-{slug}-{date_part}.pdf" if not order_id else f"table-booking-{order_id}-{date_part}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.post("/business/orders/{order_id}/approve")
def approve_table_order(
    order_id: int,
    notes: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a table order"""
    check_table_access(current_user, db)
    
    order = db.query(TableOrder).filter(
        and_(
            TableOrder.id == order_id,
            TableOrder.business_id == current_user.id
        )
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status != TableOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")
    
    # Capacity re-check before approval
    approved_count = db.query(func.count(TableOrder.id)).filter(
        TableOrder.table_package_id == order.table_package_id,
        TableOrder.status == TableOrderStatus.APPROVED
    ).scalar()
    package = order.table_package
    if approved_count >= (package.total_tables or 1):
        raise HTTPException(status_code=400, detail="This package is fully booked")
    
    # Generate ticket code and QR
    ticket_code = f"TBL-{order.event_id}-{order.user_id}-{uuid.uuid4().hex[:8].upper()}"
    qr_data = f"SOUNDIT:{ticket_code}:TABLE:{order.table_package_id}:EVENT:{order.event_id}:USER:{order.user_id}:STATUS:VALID"
    
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    order.status = TableOrderStatus.APPROVED
    order.ticket_code = ticket_code
    order.ticket_qr_code = f"data:image/png;base64,{qr_base64}"
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    order.admin_notes = notes
    
    db.commit()
    
    # Generate per-guest individual tickets (idempotent — safe on approval retries, spec §8)
    ticket_count, tickets = generate_tickets_for_table_order(
        db, order, order.event, count=package.ticket_quantity or order.guest_count
    )
    
    # Send notification to user
    from api.notifications import create_notification
    create_notification(
        db=db,
        user_id=order.user_id,
        title="Table Booking Approved",
        message=f"Your table booking for '{package.name}' at '{order.event.title if order.event else 'Event'}' has been approved with {ticket_count} ticket(s).",
        notification_type="table_booking_approved",
        data={"order_id": order.id, "event_id": order.event_id, "ticket_code": ticket_code}
    )
    
    return {
        "message": "Table order approved",
        "order_id": order.id,
        "status": order.status.value,
        "ticket_code": ticket_code,
        "ticket_qr": order.ticket_qr_code,
    }


@router.post("/business/orders/{order_id}/reject")
def reject_table_order(
    order_id: int,
    reason: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a table order"""
    check_table_access(current_user, db)
    
    order = db.query(TableOrder).filter(
        and_(
            TableOrder.id == order_id,
            TableOrder.business_id == current_user.id
        )
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status != TableOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")
    
    order.status = TableOrderStatus.REJECTED
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    order.rejection_reason = reason
    
    db.commit()
    
    # Send notification to user
    from api.notifications import create_notification
    create_notification(
        db=db,
        user_id=order.user_id,
        title="Table Booking Rejected",
        message=f"Your table booking was rejected. Reason: {reason}",
        notification_type="table_booking_rejected",
        data={"order_id": order.id, "event_id": order.event_id, "reason": reason}
    )
    
    return {
        "message": "Table order rejected",
        "order_id": order.id,
        "status": order.status.value,
    }


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/events/{event_id}/packages")
def get_event_table_packages(
    event_id: int,
    db: Session = Depends(get_db)
):
    """Get all active table packages for an event"""
    packages = db.query(TablePackage).filter(
        and_(
            TablePackage.event_id == event_id,
            TablePackage.is_active == True
        )
    ).order_by(asc(TablePackage.display_order)).all()
    
    return [{
        "id": p.id,
        "name": p.name,
        "price": p.price,
        "description": p.description,
        "included_items": p.included_items or [],
        "drinks": p.drinks or [],
        "extras": p.extras or [],
        "ticket_quantity": p.ticket_quantity,
        "max_people": p.max_people,
        "total_tables": p.total_tables or 1,
        "image_url": p.image_url,
        "drink_menu_image_url": p.drink_menu_image_url,
        "tables_remaining": max(0, (p.total_tables or 1) - db.query(func.count(TableOrder.id)).filter(
            TableOrder.table_package_id == p.id,
            TableOrder.status == TableOrderStatus.APPROVED
        ).scalar()),
    } for p in packages]


def _derive_guest_count(package) -> int:
    """Guest count is ALWAYS organizer-controlled: the package's ticket_quantity
    (fall back to max_people, then 1). The buyer cannot set it — extra guests
    buy regular tickets separately."""
    return package.ticket_quantity or package.max_people or 1


@router.post("/packages/{package_id}/book")
def book_table(
    package_id: int,
    contact_name: str = Form(...),
    contact_phone: str = Form(...),
    contact_email: Optional[str] = Form(None),
    special_requests: Optional[str] = Form(None),
    payment_screenshot: Optional[UploadFile] = File(None),
    payment_notes: Optional[str] = Form(None),
    payment_reference: Optional[str] = Form(None),
    drink_selections: Optional[str] = Form(None),   # JSON array of TableDrinkSelection
    buyer_confirmed: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Book a table package"""
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "table reservations")
    package = db.query(TablePackage).filter(
        and_(
            TablePackage.id == package_id,
            TablePackage.is_active == True
        )
    ).first()
    
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Capacity check
    approved_count = db.query(func.count(TableOrder.id)).filter(
        TableOrder.table_package_id == package_id,
        TableOrder.status == TableOrderStatus.APPROVED
    ).scalar()
    if approved_count >= (package.total_tables or 1):
        raise HTTPException(status_code=400, detail="This package is fully booked")

    # If the user already has an approved booking for a single-table package
    existing_approved = db.query(TableOrder).filter(
        and_(
            TableOrder.table_package_id == package_id,
            TableOrder.user_id == current_user.id,
            TableOrder.status == TableOrderStatus.APPROVED
        )
    ).first()
    if existing_approved and (package.total_tables or 1) <= 1:
        raise HTTPException(status_code=400, detail="You already have an approved booking for this package")

    # ---- Financial snapshot + drink selection (server-authoritative, spec §2/§5/§12) ----
    # Guest count is organizer-controlled via the package — the buyer only provides
    # their own contact details; per-guest tickets are issued automatically.
    event = package.event
    guests = _derive_guest_count(package)
    fin = _calc_table_financials(event, package, guests)

    confirmed_selections = []
    upgrade_line = None
    allowance_used_c = 0

    if drink_selections:
        try:
            raw_selections = json.loads(drink_selections)
            if not isinstance(raw_selections, list):
                raise ValueError("selections must be a list")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid drink_selections format (expected JSON array)")

        remaining_c = fin["allowance_cents"]
        for sel in raw_selections:
            item = db.query(DrinkItem).filter(
                and_(
                    DrinkItem.id == sel.get("item_id"),
                    DrinkItem.is_active == True,
                    or_(
                        DrinkItem.event_id == package.event_id,
                        and_(DrinkItem.event_id.is_(None), DrinkItem.business_id == package.business_id),
                    ),
                )
            ).first()
            if not item:
                raise HTTPException(status_code=400, detail=f"Drink item {sel.get('item_id')} is not available for this event")

            qty = max(1, min(int(sel.get("qty") or 1), 50))
            unit_price = item.event_price if (item.event_id == package.event_id and item.event_price is not None) else item.price
            unit_c = _cents(unit_price)
            line_c = unit_c * qty

            mixers = []
            for m in (sel.get("mixers") or []):
                mname = str(m.get("name", "")).strip()
                if not mname:
                    continue
                if item.supports_mixers and item.allowed_mixers and mname not in (item.allowed_mixers or []):
                    raise HTTPException(status_code=400, detail=f"Mixer '{mname}' is not allowed for {item.name}")
                mixers.append({"name": mname, "qty": max(1, min(int(m.get("qty") or 1), 20))})

            line = {
                "item_id": item.id,
                "name": item.name,
                "qty": qty,
                "unit_price": _yuan(unit_c),
                "mixers": mixers,
                "line_total": _yuan(line_c),
            }

            if line_c <= remaining_c:
                confirmed_selections.append(line)
                remaining_c -= line_c
                allowance_used_c += line_c
            else:
                # Over allowance → upgrade request workflow (spec §7), never auto-confirmed
                if upgrade_line is not None:
                    raise HTTPException(status_code=400, detail="Only one upgrade request can be submitted per booking")
                upgrade_line = {
                    "item_id": item.id,
                    "name": item.name,
                    "qty": qty,
                    "price_snapshot": _yuan(unit_c),
                    "estimated_extra": _yuan(max(0, line_c - remaining_c)),
                    "mixers": mixers,
                    "notes": special_requests or None,
                    "payment_preference": "contact_me",
                }

    # Process payment screenshot if provided (optional)
    file_bytes = None
    proof_hash = None
    screenshot_url = ""

    if payment_screenshot and getattr(payment_screenshot, 'filename', None):
        try:
            file_bytes = payment_screenshot.file.read()
        except Exception:
            file_bytes = None

        if file_bytes:
            proof_hash = hashlib.sha256(file_bytes).hexdigest()
            
            # 1. Payment Reference Duplicate Check and OCR Extraction
            if not payment_reference:
                detected_ref = extract_payment_reference(file_bytes)
                if detected_ref:
                    payment_reference = detected_ref
                    print(f"[OCR] Automatically detected reference: {payment_reference}")

            # 2. Payment Proof Hash Duplicate Detection (Anti-Fraud)
            from models import TicketOrder, Order, Subscription, ProductOrder
            exists_in_tables = db.query(TableOrder).filter(TableOrder.payment_proof_hash == proof_hash).first()
            if exists_in_tables:
                raise HTTPException(status_code=400, detail="This payment screenshot has already been used for table booking.")
                 
            for model in [TicketOrder, Order, Subscription, ProductOrder]:
                item_exists = db.query(model).filter(getattr(model, "payment_proof_hash") == proof_hash).first()
                if item_exists:
                    raise HTTPException(status_code=400, detail="This payment screenshot has already been used in another order.")

            upload_dir = get_upload_dir("table_orders")
            filename = f"table_payment_{package_id}_{current_user.id}_{uuid.uuid4().hex[:8]}.png"
            filepath = os.path.join(upload_dir, filename)
            with open(filepath, "wb") as f:
                f.write(file_bytes)
            screenshot_url = f"/static/uploads/table_orders/{filename}"

    if payment_reference:
        existing_ref = db.query(TableOrder).filter(
            func.lower(TableOrder.payment_reference) == payment_reference.strip().lower()
        ).first()
        if existing_ref:
            raise HTTPException(status_code=400, detail=f"This payment reference ({payment_reference}) has already been used.")
    
    order = TableOrder(
        table_package_id=package_id,
        event_id=package.event_id,
        user_id=current_user.id,
        business_id=package.business_id,
        contact_name=contact_name,
        contact_phone=contact_phone,
        contact_email=contact_email,
        guest_count=guests,
        special_requests=special_requests,
        payment_screenshot=screenshot_url,
        payment_proof_hash=proof_hash,
        payment_amount=package.price,
        payment_notes=payment_notes,
        payment_reference=payment_reference,
        status=TableOrderStatus.PENDING,
        ticket_price_snapshot=fin["ticket_price"],
        allocation_amount=fin["allocation_amount"],
        drink_allowance=fin["drink_allowance"],
        allowance_used=_yuan(allowance_used_c),
        drink_selections=confirmed_selections or None,
        upgrade_request=upgrade_line,
        upgrade_status='pending' if upgrade_line else 'none',
        buyer_confirmed_at=datetime.now(timezone.utc) if buyer_confirmed else None,
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Send notification to business
    from api.notifications import create_notification
    message_extra = ""
    if upgrade_line:
        message_extra = f" Includes an upgrade request ({upgrade_line['name']} x{upgrade_line['qty']}, +¥{upgrade_line['estimated_extra']})."
    
    buyer_label = contact_name or (current_user.first_name or current_user.email or "A buyer")
    event_title = package.event.title if package.event else 'Event'
    
    if buyer_confirmed:
        create_notification(
            db=db,
            user_id=package.business_id,
            title="Payment Reported: Approve Now",
            message=(
                f"¥{package.price:.2f} for '{package.name}' ({event_title}), "
                f"{buyer_label} confirmed they completed the payment. "
                f"Open Table Orders to approve and issue tickets instantly.{message_extra}"
            ),
            notification_type="table_payment_reported",
            data={"order_id": order.id, "event_id": package.event_id}
        )
    else:
        create_notification(
            db=db,
            user_id=package.business_id,
            title="New Table Booking" + (" + Upgrade Request" if upgrade_line else ""),
            message=f"You have a new table booking for '{package.name}' at '{event_title}'.{message_extra}",
            notification_type="table_booking_pending",
            data={"order_id": order.id, "event_id": package.event_id}
        )
    
    return {
        "message": "Table booking submitted. Awaiting approval.",
        "order_id": order.id,
        "status": order.status.value,
        "financials": fin,
        "drink_selections": confirmed_selections,
        "upgrade_request": upgrade_line,
        "tickets_included": package.ticket_quantity or guests,
    }


@router.get("/my-bookings")
def get_my_table_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's table bookings (with breakdown, drink selections, per-guest tickets)"""
    orders = db.query(TableOrder).filter(
        TableOrder.user_id == current_user.id
    ).order_by(desc(TableOrder.created_at)).all()
    
    return [_serialize_order(o, include_tickets=True, db=db) for o in orders]


@router.post("/validate")
def validate_table_order(
    ticket_code: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a table order QR code at event entry"""
    order = db.query(TableOrder).filter(TableOrder.ticket_code == ticket_code).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Invalid table ticket")
    
    if order.status != TableOrderStatus.APPROVED:
        raise HTTPException(status_code=400, detail=f"Table ticket is {order.status.value}")
    
    # Authorization: business owner or admin
    if current_user.id != order.business_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only the business owner can validate table tickets")
    
    # Mark as used
    order.status = TableOrderStatus.USED
    order.used_at = datetime.now(timezone.utc)
    order.used_by = current_user.id
    
    db.commit()
    
    return {
        "valid": True,
        "ticket_code": ticket_code,
        "package_name": order.table_package.name if order.table_package else None,
        "event": order.event.title if order.event else None,
        "user": f"{order.user.first_name or ''} {order.user.last_name or ''}".strip() if order.user else None,
        "guest_count": order.guest_count,
        "used_at": order.used_at.isoformat(),
    }


# ============================================================
# BUYER CONFIRMATION + UPGRADE WORKFLOW (Table_Packages_Drinks_Spec §7)
# ============================================================

@router.post("/orders/{order_id}/confirm-payment")
def confirm_table_payment(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Buyer one-tap 'I completed the payment' confirmation (mirrors ticket orders)."""
    order = db.query(TableOrder).filter(
        and_(TableOrder.id == order_id, TableOrder.user_id == current_user.id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.buyer_confirmed_at = datetime.now(timezone.utc)
    db.commit()

    from api.notifications import create_notification
    create_notification(
        db=db,
        user_id=order.business_id,
        title="Table Payment Confirmed",
        message=f"{order.contact_name} confirmed they completed the payment for '{order.table_package.name if order.table_package else 'table'}'. Please verify and approve.",
        notification_type="table_payment_confirmed",
        data={"order_id": order.id, "event_id": order.event_id}
    )

    return {"message": "Payment confirmation sent to the organizer", "buyer_confirmed_at": order.buyer_confirmed_at.isoformat()}


@router.post("/orders/{order_id}/upgrade")
def submit_upgrade_request(
    order_id: int,
    data: TableUpgradeSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Customer requests a drink upgrade above the allowance on an existing booking."""
    order = db.query(TableOrder).filter(
        and_(TableOrder.id == order_id, TableOrder.user_id == current_user.id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (TableOrderStatus.PENDING, TableOrderStatus.APPROVED):
        raise HTTPException(status_code=400, detail="Upgrades are only possible on pending or approved bookings")

    item = db.query(DrinkItem).filter(
        and_(
            DrinkItem.id == data.item_id,
            DrinkItem.is_active == True,
            or_(
                DrinkItem.event_id == order.event_id,
                and_(DrinkItem.event_id.is_(None), DrinkItem.business_id == order.business_id),
            ),
        )
    ).first()
    if not item:
        raise HTTPException(status_code=400, detail="Drink item is not available for this event")

    unit_price = item.event_price if (item.event_id == order.event_id and item.event_price is not None) else item.price
    remaining_c = _cents(order.drink_allowance or 0) - _cents(order.allowance_used or 0)
    line_c = _cents(unit_price) * data.qty
    estimated_extra = _yuan(max(0, line_c - remaining_c))

    order.upgrade_request = {
        "item_id": item.id,
        "name": item.name,
        "qty": data.qty,
        "price_snapshot": _yuan(_cents(unit_price)),
        "estimated_extra": estimated_extra,
        "notes": data.notes,
        "payment_preference": data.payment_preference or "contact_me",
    }
    order.upgrade_status = 'pending'
    db.commit()

    from api.notifications import create_notification
    create_notification(
        db=db,
        user_id=order.business_id,
        title="Drink Upgrade Requested",
        message=f"{order.contact_name} requested {item.name} x{data.qty} (est. +¥{estimated_extra}) on table booking #{order.id}.",
        notification_type="table_upgrade_pending",
        data={"order_id": order.id, "event_id": order.event_id}
    )

    return {"message": "Upgrade request submitted — pending organizer confirmation", "upgrade_status": "pending"}


@router.get("/business/upgrade-requests")
def get_upgrade_requests(
    event_id: Optional[int] = None,
    status: Optional[str] = "pending",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Organizer list of upgrade requests (filterable)."""
    check_table_access(current_user, db)
    query = db.query(TableOrder).filter(TableOrder.business_id == current_user.id)
    query = query.filter(TableOrder.upgrade_status != 'none')
    if status:
        query = query.filter(TableOrder.upgrade_status == status)
    if event_id:
        query = query.filter(TableOrder.event_id == event_id)
    orders = query.order_by(desc(TableOrder.updated_at)).all()
    return [_serialize_order(o, include_tickets=False, db=db) for o in orders]


@router.post("/business/orders/{order_id}/upgrade/approve")
def approve_upgrade(
    order_id: int,
    data: UpgradeResolve,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Organizer approves an upgrade request with a final price + payment arrangement."""
    check_table_access(current_user, db)
    order = db.query(TableOrder).filter(
        and_(TableOrder.id == order_id, TableOrder.business_id == current_user.id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.upgrade_status != 'pending' or not order.upgrade_request:
        raise HTTPException(status_code=400, detail="No pending upgrade request on this order")

    final_price = data.final_price if data.final_price is not None else order.upgrade_request.get("estimated_extra", 0)
    order.upgrade_status = 'approved'
    order.upgrade_final_price = final_price
    order.upgrade_payment_status = data.payment_status or "pending"
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    from api.notifications import create_notification
    create_notification(
        db=db,
        user_id=order.user_id,
        title="Upgrade Request Approved",
        message=f"Your upgrade request ({order.upgrade_request.get('name')} x{order.upgrade_request.get('qty')}) was approved. Additional payment: ¥{final_price} ({order.upgrade_payment_status}).",
        notification_type="table_upgrade_approved",
        data={"order_id": order.id, "event_id": order.event_id}
    )

    return {"message": "Upgrade approved", "upgrade_status": "approved", "final_price": final_price, "payment_status": order.upgrade_payment_status}


@router.post("/business/orders/{order_id}/upgrade/decline")
def decline_upgrade(
    order_id: int,
    data: UpgradeResolve,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Organizer declines an upgrade request (with optional reason)."""
    check_table_access(current_user, db)
    order = db.query(TableOrder).filter(
        and_(TableOrder.id == order_id, TableOrder.business_id == current_user.id)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.upgrade_status != 'pending' or not order.upgrade_request:
        raise HTTPException(status_code=400, detail="No pending upgrade request on this order")

    order.upgrade_status = 'declined'
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    from api.notifications import create_notification
    create_notification(
        db=db,
        user_id=order.user_id,
        title="Upgrade Request Declined",
        message=f"Your upgrade request ({order.upgrade_request.get('name')}) was declined. {data.reason or ''}".strip(),
        notification_type="table_upgrade_declined",
        data={"order_id": order.id, "event_id": order.event_id}
    )

    return {"message": "Upgrade declined", "upgrade_status": "declined"}
