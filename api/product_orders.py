"""
Product Orders API - User-facing product order and vendor approval management
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import qrcode
import io
import base64
import os
import shutil
import hashlib

from database import get_db
from auth import get_current_user
from models import User, Product, ProductOrder, TicketOrderStatus, UserRole, Notification, VendorProfile
from api.notifications import create_notification

router = APIRouter(prefix="/product-orders", tags=["Product Orders"])

from utils.ocr_service import extract_payment_reference
from sqlalchemy import func




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


@router.post("/order")
def create_product_order(
    product_id: int = Form(...),
    payment_screenshot: UploadFile = File(...),
    payer_name: str = Form(...),
    payer_notes: Optional[str] = Form(None),
    payment_reference: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a product order with payment proof"""
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "marketplace purchases")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.status != "active":
        raise HTTPException(status_code=400, detail="Product is not available")
    
    if product.stock_quantity is not None and product.stock_quantity <= 0:
        raise HTTPException(status_code=400, detail="Product is out of stock")
    
    # Check for existing pending/approved order
    existing = db.query(ProductOrder).filter(
        and_(
            ProductOrder.product_id == product_id,
            ProductOrder.user_id == current_user.id,
            ProductOrder.status.in_([TicketOrderStatus.PENDING, TicketOrderStatus.APPROVED])
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have an order for this product")
    
    # Validate upload
    allowed_content_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if payment_screenshot.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WEBP are allowed.")
    
    # Read file bytes early for validation, hashing, and saving
    file_bytes = payment_screenshot.file.read()
    proof_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # 1. Payment Reference Duplicate Check and OCR Extraction
    if not payment_reference:
        # Attempt OCR extraction if reference is missing
        detected_ref = extract_payment_reference(file_bytes)
        if detected_ref:
            payment_reference = detected_ref
            print(f"[OCR] Automatically detected reference: {payment_reference}")

    if payment_reference:
        existing_ref = db.query(ProductOrder).filter(
            func.lower(ProductOrder.payment_reference) == payment_reference.strip().lower()
        ).first()
        if existing_ref:
            raise HTTPException(status_code=400, detail=f"This payment reference ({payment_reference}) has already been used.")

    # 2. Payment Proof Hash Duplicate Detection (Anti-Fraud)
    # Check across models
    from models import TicketOrder, Order, TableOrder, BookingRequest, Subscription
    exists_in_products = db.query(ProductOrder).filter(ProductOrder.payment_proof_hash == proof_hash).first()
    if exists_in_products:
        raise HTTPException(status_code=400, detail="This payment screenshot has already been used for product order.")
        
    for model in [TicketOrder, Order, TableOrder, BookingRequest, Subscription]:
        item_exists = db.query(model).filter(getattr(model, "payment_proof_hash") == proof_hash).first()
        if item_exists:
            raise HTTPException(status_code=400, detail="This payment screenshot has already been used in another order.")

    # Upload screenshot
    filename_str = payment_screenshot.filename or ""
    ext = filename_str.split(".")[-1].lower() if "." in filename_str else "png"
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        ext = "png"
    from utils.upload_storage import get_upload_dir
    upload_dir = get_upload_dir("product_orders")
    filename = f"payment_{product_id}_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    
    order = ProductOrder(
        product_id=product_id,
        user_id=current_user.id,
        payment_screenshot=f"/static/uploads/product_orders/{filename}",
        payment_proof_hash=proof_hash,
        payment_amount=product.price,
        payment_reference=payment_reference,
        payer_name=payer_name,
        payer_notes=payer_notes,
        status=TicketOrderStatus.PENDING
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)

    # Notify vendor of new order
    vendor = db.query(VendorProfile).filter(VendorProfile.id == product.vendor_id).first()
    if vendor:
        create_notification(
            db=db,
            user_id=vendor.user_id,
            title="New Product Order",
            message=f"{payer_name} placed an order for '{product.name}'. Review and approve it in your dashboard.",
            notification_type="product_order",
            data={"product_order_id": order.id, "product_id": product.id, "product_name": product.name}
        )

    return {
        "message": "Product order submitted. Awaiting vendor approval.",
        "order_id": order.id,
        "status": order.status.value,
    }


@router.get("/my-orders")
def get_my_product_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all my product orders"""
    orders = db.query(ProductOrder).filter(
        ProductOrder.user_id == current_user.id
    ).order_by(desc(ProductOrder.created_at)).all()
    
    result = []
    for order in orders:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        vendor = db.query(VendorProfile).filter(VendorProfile.id == product.vendor_id).first() if product else None
        result.append({
            "id": order.id,
            "product": {
                "id": product.id if product else None,
                "name": product.name if product else None,
                "image_url": product.image_url if product else None,
                "vendor": {
                    "id": vendor.id if vendor else None,
                    "business_name": vendor.business_name if vendor else None,
                } if vendor else None,
            },
            "payment_amount": order.payment_amount,
            "status": order.status.value,
            "order_code": order.order_code,
            "order_qr_code": order.order_qr_code,
            "rejection_reason": order.rejection_reason,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })
    
    return {"orders": result}


@router.get("/vendor/orders")
def get_vendor_product_orders(
    status: Optional[str] = None,
    product_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all product orders for current vendor"""
    if current_user.role != UserRole.VENDOR and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only vendors can access this endpoint")
    
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if not profile and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        return {"orders": []}
    
    # Get vendor's product IDs
    if profile:
        product_ids = [p.id for p in db.query(Product).filter(Product.vendor_id == profile.id).all()]
    else:
        # Admin can see all
        product_ids = [p.id for p in db.query(Product).all()]
    
    if not product_ids:
        return {"orders": []}
    
    query = db.query(ProductOrder).filter(ProductOrder.product_id.in_(product_ids))
    
    if status:
        query = query.filter(ProductOrder.status == TicketOrderStatus(status))
    if product_id:
        query = query.filter(ProductOrder.product_id == product_id)
    
    orders = query.order_by(desc(ProductOrder.created_at)).all()
    
    result = []
    for order in orders:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        user = db.query(User).filter(User.id == order.user_id).first()
        
        result.append({
            "id": order.id,
            "product": {
                "id": product.id if product else None,
                "name": product.name if product else None,
            },
            "user": {
                "id": user.id if user else None,
                "name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
                "email": user.email if user else None,
            },
            "payment_amount": order.payment_amount,
            "payer_name": order.payer_name,
            "payment_screenshot": order.payment_screenshot,
            "status": order.status.value,
            "order_code": order.order_code,
            "order_qr_code": order.order_qr_code,
            "rejection_reason": order.rejection_reason,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })
    
    return {"orders": result}


@router.post("/{order_id}/approve")
def approve_product_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a product order and generate pickup QR"""
    order = db.query(ProductOrder).filter(ProductOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify vendor owns this product
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if product.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only product vendor can approve")
    
    # Vendors need an active subscription to approve orders
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        from services.subscription_service import SubscriptionService
        sub_status = SubscriptionService.get_subscription_status(db, current_user.id)
        if not sub_status.get("has_active_subscription"):
            raise HTTPException(
                status_code=403,
                detail="An active subscription is required to accept orders. Please subscribe to continue."
            )
    
    if order.status != TicketOrderStatus.PENDING:
        raise HTTPException(status_code=400, detail="Order is not pending")
    
    # Decrement stock
    if product.stock_quantity is not None and product.stock_quantity > 0:
        product.stock_quantity -= 1
    
    # Generate order code and QR
    order_code = f"PO-{order.product_id}-{order.user_id}-{uuid.uuid4().hex[:8].upper()}"
    qr_data = f"SOUNDIT:{order_code}:PRODUCT:{order.product_id}:USER:{order.user_id}:STATUS:VALID"
    
    qr = qrcode.QRCode(version=6, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    order.status = TicketOrderStatus.APPROVED
    order.order_code = order_code
    order.order_qr_code = f"data:image/png;base64,{qr_base64}"
    order.reviewed_by = current_user.id
    order.reviewed_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Send notification to user
    _create_notification(
        db=db,
        user_id=order.user_id,
        title="Product Order Approved",
        message=f"Your order for '{product.name}' has been approved. Show your QR code to collect your item.",
        notification_type="product_order_approved",
        entity_type="product_order",
        entity_id=order.id
    )
    
    return {
        "message": "Product order approved",
        "order_id": order.id,
        "order_code": order_code,
        "order_qr": order.order_qr_code,
    }


@router.post("/{order_id}/reject")
def reject_product_order(
    order_id: int,
    reason: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a product order"""
    order = db.query(ProductOrder).filter(ProductOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify vendor owns this product
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if product.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only product vendor can reject")
    
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
        title="Product Order Rejected",
        message=f"Your order for '{product.name}' was rejected. Reason: {reason}",
        notification_type="product_order_rejected",
        entity_type="product_order",
        entity_id=order.id
    )
    
    return {"message": "Product order rejected", "order_id": order.id, "reason": reason}


@router.post("/validate")
def validate_product_order(
    order_code: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a product order QR code at pickup"""
    order = db.query(ProductOrder).filter(ProductOrder.order_code == order_code).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Invalid order")
    
    if order.status != TicketOrderStatus.APPROVED:
        raise HTTPException(status_code=400, detail=f"Order is {order.status.value}")
    
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Verify vendor owns this product
    profile = db.query(VendorProfile).filter(VendorProfile.user_id == current_user.id).first()
    if product.vendor_id != (profile.id if profile else None) and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only product vendor can validate orders")
    
    user = db.query(User).filter(User.id == order.user_id).first()
    
    # Mark as used
    order.status = TicketOrderStatus.USED
    order.used_at = datetime.now(timezone.utc)
    order.used_by = current_user.id
    
    db.commit()
    
    return {
        "valid": True,
        "order_code": order_code,
        "product": product.name if product else None,
        "user": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
        "used_at": order.used_at.isoformat(),
    }
