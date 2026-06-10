"""
Vendor Analytics Service — Compute sales, orders, and customer metrics for vendors.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date

from models import VendorOrder, VendorOrderItem, VendorOrderStatus, Product, User


def _get_date_range(period: str) -> tuple:
    """Get start and end datetime for a period."""
    now = datetime.now(timezone.utc)
    end = now
    
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    elif period == "year":
        start = now - timedelta(days=365)
    else:
        start = now - timedelta(days=30)
    
    return start, end


def get_orders_count(db: Session, vendor_id: int, period: str = "today") -> int:
    """Get order count for a vendor in a period."""
    start, end = _get_date_range(period)
    return db.query(VendorOrder).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.created_at >= start,
        VendorOrder.created_at <= end,
        VendorOrder.status != VendorOrderStatus.CANCELLED
    ).count()


def get_revenue(db: Session, vendor_id: int, period: str = "today") -> float:
    """Get total revenue for a vendor in a period."""
    start, end = _get_date_range(period)
    result = db.query(func.coalesce(func.sum(VendorOrder.total_amount), 0.0)).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.created_at >= start,
        VendorOrder.created_at <= end,
        VendorOrder.status.in_([VendorOrderStatus.ACCEPTED, VendorOrderStatus.PREPARING, VendorOrderStatus.READY, VendorOrderStatus.COMPLETED])
    ).scalar()
    return float(result) if result else 0.0


def get_total_revenue(db: Session, vendor_id: int) -> float:
    """Get all-time revenue for a vendor."""
    result = db.query(func.coalesce(func.sum(VendorOrder.total_amount), 0.0)).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.status.in_([VendorOrderStatus.ACCEPTED, VendorOrderStatus.PREPARING, VendorOrderStatus.READY, VendorOrderStatus.COMPLETED])
    ).scalar()
    return float(result) if result else 0.0


def get_total_orders(db: Session, vendor_id: int) -> int:
    """Get all-time order count for a vendor."""
    return db.query(VendorOrder).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.status != VendorOrderStatus.CANCELLED
    ).count()


def get_average_order_value(db: Session, vendor_id: int) -> float:
    """Get average order value for a vendor."""
    result = db.query(func.coalesce(func.avg(VendorOrder.total_amount), 0.0)).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.status.in_([VendorOrderStatus.ACCEPTED, VendorOrderStatus.PREPARING, VendorOrderStatus.READY, VendorOrderStatus.COMPLETED])
    ).scalar()
    return float(result) if result else 0.0


def get_unique_customers(db: Session, vendor_id: int) -> int:
    """Get count of unique customers."""
    return db.query(VendorOrder.user_id).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.status != VendorOrderStatus.CANCELLED
    ).distinct().count()


def get_repeat_customers(db: Session, vendor_id: int) -> int:
    """Get count of customers with 2+ orders."""
    from sqlalchemy import distinct
    subquery = db.query(
        VendorOrder.user_id,
        func.count(VendorOrder.id).label("order_count")
    ).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.status != VendorOrderStatus.CANCELLED
    ).group_by(VendorOrder.user_id).having(func.count(VendorOrder.id) >= 2).subquery()
    
    return db.query(func.count(subquery.c.user_id)).scalar() or 0


def get_daily_sales(db: Session, vendor_id: int, days: int = 30) -> List[Dict]:
    """Get daily sales breakdown for the last N days."""
    start = datetime.now(timezone.utc) - timedelta(days=days)
    
    # For PostgreSQL use cast; for SQLite use func.date
    from database import engine
    is_postgres = "postgresql" in str(engine.url)
    
    if is_postgres:
        date_col = cast(VendorOrder.created_at, Date)
    else:
        date_col = func.date(VendorOrder.created_at)
    
    results = db.query(
        date_col.label("date"),
        func.coalesce(func.sum(VendorOrder.total_amount), 0.0).label("revenue"),
        func.count(VendorOrder.id).label("orders")
    ).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.created_at >= start,
        VendorOrder.status.in_([VendorOrderStatus.ACCEPTED, VendorOrderStatus.PREPARING, VendorOrderStatus.READY, VendorOrderStatus.COMPLETED])
    ).group_by(date_col).order_by(date_col).all()
    
    return [
        {
            "date": str(r.date) if r.date else None,
            "revenue": float(r.revenue) if r.revenue else 0.0,
            "orders": int(r.orders) if r.orders else 0
        }
        for r in results
    ]


def get_best_selling_products(db: Session, vendor_id: int, limit: int = 10) -> List[Dict]:
    """Get top selling products by quantity."""
    results = db.query(
        VendorOrderItem.product_id,
        VendorOrderItem.product_name,
        func.coalesce(func.sum(VendorOrderItem.quantity), 0).label("total_sold"),
        func.coalesce(func.sum(VendorOrderItem.subtotal), 0.0).label("total_revenue")
    ).join(
        VendorOrder, VendorOrderItem.vendor_order_id == VendorOrder.id
    ).filter(
        VendorOrder.vendor_id == vendor_id,
        VendorOrder.status.in_([VendorOrderStatus.ACCEPTED, VendorOrderStatus.PREPARING, VendorOrderStatus.READY, VendorOrderStatus.COMPLETED])
    ).group_by(
        VendorOrderItem.product_id,
        VendorOrderItem.product_name
    ).order_by(
        func.sum(VendorOrderItem.quantity).desc()
    ).limit(limit).all()
    
    return [
        {
            "product_id": r.product_id,
            "product_name": r.product_name,
            "total_sold": int(r.total_sold) if r.total_sold else 0,
            "total_revenue": float(r.total_revenue) if r.total_revenue else 0.0
        }
        for r in results
    ]


def get_vendor_analytics(db: Session, vendor_id: int) -> Dict:
    """Get complete analytics package for a vendor."""
    overview = {
        "orders_today": get_orders_count(db, vendor_id, "today"),
        "orders_this_week": get_orders_count(db, vendor_id, "week"),
        "orders_this_month": get_orders_count(db, vendor_id, "month"),
        "revenue_today": get_revenue(db, vendor_id, "today"),
        "revenue_this_week": get_revenue(db, vendor_id, "week"),
        "revenue_this_month": get_revenue(db, vendor_id, "month"),
        "total_revenue": get_total_revenue(db, vendor_id),
        "total_orders": get_total_orders(db, vendor_id),
        "average_order_value": get_average_order_value(db, vendor_id),
        "unique_customers": get_unique_customers(db, vendor_id),
        "repeat_customers": get_repeat_customers(db, vendor_id),
    }
    
    sales_trend = {
        "daily": get_daily_sales(db, vendor_id, days=30)
    }
    
    best_sellers = get_best_selling_products(db, vendor_id, limit=10)
    
    return {
        "overview": overview,
        "sales_trend": sales_trend,
        "best_sellers": best_sellers
    }
