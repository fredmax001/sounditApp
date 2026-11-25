"""
Vendor Orders API, Multi-item cart orders with status workflow
"""
import uuid
import qrcode
import io
import base64
import os
import hashlib
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func

from database import get_db
from auth import get_current_user, require_vendor
from models import (
    User, UserRole, VendorProfile, Product, VendorOrder, VendorOrderItem,
    VendorOrderStatus, VendorPaymentSettings, Event, TicketOrder, EventVendor
)
from schemas import (
    VendorOrderCreate, VendorOrderResponse, VendorOrderListResponse,
    VendorOrderTrackResponse, VendorOrderUpdateStatus, VendorOrderItemResponse
)
from services.push_service import PushService

router = APIRouter(prefix="/vendor-orders", tags=["Vendor Orders"])


def _create_notification(db: Session, user_id: int, title: str, message: str, notification_type: str, entity_type: str = None, entity_id: int = None):
    """Create in-app notification and trigger push delivery."""
    from models import Notification
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
    
    # Trigger push
    try:
        push_service = PushService(db)
        push_service.send_notification(notification)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[Push] Failed to send notification: {e}")
    
    return notification


# ========== CUSTOMER-FACING ENDPOINTS ==========

@router.post("/", response_model=VendorOrderResponse)
def create_vendor_order(
    vendor_id: int = Form(...),
    items: str = Form(...),  # JSON array of {product_id, quantity}
    customer_name: str = Form(...),
    customer_phone: Optional[str] = Form(None),
    delivery_location: Optional[str] = Form(None),
    customer_notes: Optional[str] = Form(None),
    payment_method: str = Form(...),
    event_id: Optional[int] = Form(None),
    payment_screenshot: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a multi-item vendor order with payment proof"""
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "vendor orders")
    import json
    
    # Parse items
    try:
        items_data = json.loads(items)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid items JSON")
    
    if not items_data or not isinstance(items_data, list):
        raise HTTPException(status_code=400, detail="Items must be a non-empty array")
    
    # Validate vendor
    vendor = db.query(VendorProfile).filter(VendorProfile.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Validate event if provided
    if event_id:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
    
    # Validate payment method
    if payment_method not in ("wechat_pay", "alipay"):
        raise HTTPException(status_code=400, detail="Payment method must be wechat_pay or alipay")
    
    # Validate file
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if payment_screenshot.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, WEBP allowed.")
    
    file_bytes = payment_screenshot.file.read()
    proof_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # Anti-fraud: duplicate hash check across all order types
    exists = db.query(VendorOrder).filter(VendorOrder.payment_proof_hash == proof_hash).first()
    if exists:
        raise HTTPException(status_code=400, detail="This payment screenshot has already been used.")
    
    for model in [TicketOrder]:
        item_exists = db.query(model).filter(getattr(model, "payment_proof_hash") == proof_hash).first()
        if item_exists:
            raise HTTPException(status_code=400, detail="This payment screenshot has already been used in another order.")
    
    # Build order items
    order_items = []
    total_amount = 0.0
    
    for item in items_data:
        product_id = item.get("product_id")
        quantity = item.get("quantity", 1)
        
        if not product_id:
            raise HTTPException(status_code=400, detail="Each item must have a product_id")
        
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.vendor_id == vendor_id
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found for this vendor")
        
        if product.status != "active":
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' is not available")
        
        is_item_preorder = bool(getattr(product, "is_preorder_enabled", False))
        avail_qty = (
            product.preorder_quantity
            if is_item_preorder and getattr(product, "preorder_quantity", None) is not None
            else product.stock_quantity
        )
        if avail_qty is not None and avail_qty < quantity:
            raise HTTPException(status_code=400, detail=f"Product '{product.name}' has insufficient stock/preorder quantity")
        
        subtotal = product.price * quantity
        total_amount += subtotal
        
        order_items.append({
            "product_id": product_id,
            "product_name": product.name,
            "product_price": product.price,
            "quantity": quantity,
            "subtotal": subtotal
        })
    
    # Save screenshot
    from utils.upload_storage import get_upload_dir
    filename_str = payment_screenshot.filename or ""
    ext = filename_str.split(".")[-1].lower() if "." in filename_str else "png"
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        ext = "png"
    upload_dir = get_upload_dir("vendor_orders")
    filename = f"payment_{vendor_id}_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    
    # Create order
    order = VendorOrder(
        vendor_id=vendor_id,
        user_id=current_user.id,
        event_id=event_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        delivery_location=delivery_location,
        customer_notes=customer_notes,
        payment_method=payment_method,
        payment_screenshot=f"/static/uploads/vendor_orders/{filename}",
        payment_proof_hash=proof_hash,
        total_amount=total_amount,
        currency="CNY",
        status=VendorOrderStatus.PENDING_VERIFICATION
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Create order items
    for item_data in order_items:
        db_item = VendorOrderItem(
            vendor_order_id=order.id,
            **item_data
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(order)
    
    # Notify vendor
    _create_notification(
        db=db,
        user_id=vendor.user_id,
        title="New Order Received",
        message=f"New order from {customer_name} for ¥{total_amount:.2f}. Items: {len(order_items)}",
        notification_type="vendor_order_new",
        entity_type="vendor_order",
        entity_id=order.id
    )
    
    return _serialize_order(order)


@router.get("/my-orders", response_model=VendorOrderListResponse)
def get_my_vendor_orders(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all vendor orders for current customer"""
    query = db.query(VendorOrder).filter(VendorOrder.user_id == current_user.id)
    
    if status:
        try:
            query = query.filter(VendorOrder.status == VendorOrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    
    orders = query.order_by(desc(VendorOrder.created_at)).all()
    return {"orders": [_serialize_order(o) for o in orders]}


@router.get("/{order_id}", response_model=VendorOrderResponse)
def get_vendor_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vendor order detail (customer or vendor owner)"""
    order = db.query(VendorOrder).filter(VendorOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Authorization: customer or vendor owner or admin
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    is_vendor = profile and profile.id == order.vendor_id
    is_customer = order.user_id == current_user.id
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    
    if not (is_customer or is_vendor or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to view this order")
    
    return _serialize_order(order)


@router.get("/{order_id}/track", response_model=VendorOrderTrackResponse)
def track_vendor_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    """Public order tracking (minimal data)"""
    order = db.query(VendorOrder).filter(VendorOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    vendor = db.query(VendorProfile).filter(VendorProfile.id == order.vendor_id).first()
    
    return {
        "id": order.id,
        "status": order.status.value,
        "customer_name": order.customer_name,
        "total_amount": order.total_amount,
        "currency": order.currency,
        "vendor_name": vendor.business_name if vendor else None,
        "items": [
            VendorOrderItemResponse(
                id=item.id,
                vendor_order_id=item.vendor_order_id,
                product_id=item.product_id,
                product_name=item.product_name,
                product_price=item.product_price,
                quantity=item.quantity,
                subtotal=item.subtotal,
                created_at=item.created_at
            ) for item in order.items
        ],
        "created_at": order.created_at,
        "updated_at": order.updated_at
    }


# ========== VENDOR-FACING ENDPOINTS ==========

@router.get("/vendor/orders", response_model=VendorOrderListResponse)
def get_vendor_orders(
    status: Optional[str] = None,
    event_id: Optional[int] = None,
    vendor_id: Optional[int] = Query(None, description="Admin only: filter orders by specific vendor_id"),
    current_user: User = Depends(require_vendor),
    db: Session = Depends(get_db)
):
    """Get all orders for current vendor (strictly tenant scoped)"""
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        if not profile:
            raise HTTPException(status_code=403, detail="Vendor profile not found for this account")
        target_vendor_id = profile.id
    else:
        # Admin must explicitly specify vendor_id or have their own vendor profile
        if vendor_id:
            target_vendor_id = vendor_id
        elif profile:
            target_vendor_id = profile.id
        else:
            raise HTTPException(
                status_code=400,
                detail="Admin must specify a vendor_id parameter to view scoped vendor orders"
            )
    
    query = db.query(VendorOrder).filter(VendorOrder.vendor_id == target_vendor_id)
    
    if status:
        try:
            query = query.filter(VendorOrder.status == VendorOrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    
    if event_id:
        query = query.filter(VendorOrder.event_id == event_id)
    
    orders = query.order_by(desc(VendorOrder.created_at)).all()
    return {"orders": [_serialize_order(o) for o in orders]}


@router.post("/{order_id}/accept")
def accept_vendor_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a vendor order and generate pickup QR"""
    order = db.query(VendorOrder).filter(VendorOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify vendor owns this order
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if order.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only order vendor can accept")
    
    # Vendors need an active subscription to accept orders
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        from services.subscription_service import SubscriptionService
        sub_status = SubscriptionService.get_subscription_status(db, current_user.id)
        if not sub_status.get("has_active_subscription"):
            raise HTTPException(
                status_code=403,
                detail="An active subscription is required to accept orders. Please subscribe to continue."
            )
    
    if order.status != VendorOrderStatus.PENDING_VERIFICATION:
        raise HTTPException(status_code=400, detail="Order is not pending verification")
    
    # Decrement stock for each item
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product and product.stock_quantity is not None and product.stock_quantity >= item.quantity:
            product.stock_quantity -= item.quantity
    
    # Generate order code and QR
    order_code = f"VO-{order.vendor_id}-{order.user_id}-{uuid.uuid4().hex[:8].upper()}"
    qr_data = f"SOUNDIT:{order_code}:VENDOR_ORDER:{order.id}:USER:{order.user_id}:STATUS:VALID"
    
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    order.status = VendorOrderStatus.ACCEPTED
    order.order_code = order_code
    order.order_qr_code = f"data:image/png;base64,{qr_base64}"
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Notify customer
    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Order Accepted",
        message=f"Your order for ¥{order.total_amount:.2f} has been accepted by the vendor.",
        notification_type="vendor_order_accepted",
        entity_type="vendor_order",
        entity_id=order.id
    )
    
    return {
        "message": "Order accepted",
        "order_id": order.id,
        "order_code": order_code,
        "order_qr": order.order_qr_code,
    }


@router.post("/{order_id}/reject")
def reject_vendor_order(
    order_id: int,
    reason: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a vendor order"""
    order = db.query(VendorOrder).filter(VendorOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if order.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only order vendor can reject")
    
    if order.status != VendorOrderStatus.PENDING_VERIFICATION:
        raise HTTPException(status_code=400, detail="Order is not pending verification")
    
    order.status = VendorOrderStatus.CANCELLED
    order.rejection_reason = reason
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Notify customer
    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Order Rejected",
        message=f"Your order for ¥{order.total_amount:.2f} was rejected. Reason: {reason}",
        notification_type="vendor_order_rejected",
        entity_type="vendor_order",
        entity_id=order.id
    )
    
    return {"message": "Order rejected", "order_id": order.id, "reason": reason}


@router.post("/{order_id}/status")
def update_vendor_order_status(
    order_id: int,
    status_update: VendorOrderUpdateStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update order status (preparing → ready → completed)"""
    order = db.query(VendorOrder).filter(VendorOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if order.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only order vendor can update status")
    
    # Validate status transition (supports both regular and preorder status names)
    status_alias = {
        "confirmed": VendorOrderStatus.ACCEPTED,
        "accepted": VendorOrderStatus.ACCEPTED,
        "preparing": VendorOrderStatus.PREPARING,
        "ready": VendorOrderStatus.READY,
        "ready_for_collection": VendorOrderStatus.READY,
        "completed": VendorOrderStatus.COMPLETED,
        "cancelled": VendorOrderStatus.CANCELLED,
    }
    new_status = status_alias.get(status_update.status.lower())
    if not new_status:
        try:
            new_status = VendorOrderStatus(status_update.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_update.status}")

    order.status = new_status
    db.commit()
    
    # Notify customer of status update
    is_preorder = bool(getattr(order, "is_preorder", False))
    order_label = "preorder" if is_preorder else "order"
    status_messages = {
        VendorOrderStatus.ACCEPTED: f"Your {order_label} (#{order.id}) has been confirmed by the vendor.",
        VendorOrderStatus.PREPARING: f"Your {order_label} (#{order.id}) is now being prepared.",
        VendorOrderStatus.READY: f"Your {order_label} (#{order.id}) is Ready for Collection!",
        VendorOrderStatus.COMPLETED: f"Your {order_label} (#{order.id}) has been completed. Thank you!",
        VendorOrderStatus.CANCELLED: f"Your {order_label} (#{order.id}) was cancelled. Reason: {order.rejection_reason or 'Updated by vendor'}",
    }
    
    msg = status_messages.get(new_status, f"Your order status updated to {new_status.value}.")
    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Order Update",
        message=msg,
        notification_type="vendor_order_status",
        entity_type="vendor_order",
        entity_id=order.id
    )
    
    return {"message": "Status updated", "order_id": order.id, "status": new_status.value}


@router.post("/{order_id}/validate")
def validate_vendor_order(
    order_code: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a vendor order QR code at pickup"""
    order = db.query(VendorOrder).filter(VendorOrder.order_code == order_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Invalid order code")
    
    if order.status not in (VendorOrderStatus.ACCEPTED, VendorOrderStatus.PREPARING, VendorOrderStatus.READY):
        raise HTTPException(status_code=400, detail=f"Order is {order.status.value}")
    
    # Verify vendor owns this order
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if order.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only order vendor can validate")
    
    # Mark as completed
    order.status = VendorOrderStatus.COMPLETED
    order.used_at = datetime.now(timezone.utc)
    order.used_by = current_user.id
    
    db.commit()
    
    return {
        "valid": True,
        "order_code": order_code,
        "customer": order.customer_name,
        "items": [item.product_name for item in order.items],
        "used_at": order.used_at.isoformat(),
    }


# ========== EVENT INTEGRATION ==========

@router.get("/event/{event_id}", response_model=VendorOrderListResponse)
def get_event_vendor_orders(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vendor orders linked to an event (vendor or organizer view)"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Authorization: vendor at event, event organizer, or admin
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    is_vendor = profile and db.query(EventVendor).filter(
        EventVendor.event_id == event_id,
        EventVendor.vendor_id == profile.id
    ).first() is not None
    
    is_organizer = event.organizer_id == current_user.id if hasattr(event, 'organizer_id') else False
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    
    if not (is_vendor or is_organizer or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(VendorOrder).filter(VendorOrder.event_id == event_id)
    if profile and not is_admin:
        query = query.filter(VendorOrder.vendor_id == profile.id)
    
    orders = query.order_by(desc(VendorOrder.created_at)).all()
    return {"orders": [_serialize_order(o) for o in orders]}


# ========== HELPERS ==========

def _serialize_order(order: VendorOrder) -> dict:
    """Serialize VendorOrder to response dict."""
    return {
        "id": order.id,
        "vendor_id": order.vendor_id,
        "user_id": order.user_id,
        "event_id": order.event_id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "delivery_location": order.delivery_location,
        "customer_notes": order.customer_notes,
        "payment_method": order.payment_method,
        "payment_screenshot": order.payment_screenshot,
        "payment_reference": order.payment_reference,
        "total_amount": order.total_amount,
        "currency": order.currency,
        "status": order.status.value,
        "is_preorder": bool(getattr(order, "is_preorder", False)),
        "fulfilment_date": getattr(order, "fulfilment_date", None),
        "order_code": order.order_code,
        "order_qr_code": order.order_qr_code,
        "reviewed_by": order.reviewed_by,
        "reviewed_at": order.reviewed_at,
        "rejection_reason": order.rejection_reason,
        "used_at": order.used_at,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "items": [
            {
                "id": item.id,
                "vendor_order_id": item.vendor_order_id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "product_price": item.product_price,
                "quantity": item.quantity,
                "subtotal": item.subtotal,
                "created_at": item.created_at,
            }
            for item in order.items
        ]
    }
