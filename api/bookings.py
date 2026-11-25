"""
Booking system API for artists.
Handles booking requests, availability, reviews, and messages.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date, timedelta
import os
import shutil
import uuid
import hashlib
from urllib.parse import urlparse

from database import get_db
from models import (
    User, ArtistProfile, ArtistPortfolioMedia, BookingRequest, BookingStatus, BookingMessage,
    ArtistReview, ArtistAvailability, UserRole, City
)
from schemas import (
    BookingRequestCreate, BookingRequestResponse, BookingRequestUpdate,
    BookingMessageCreate, BookingMessageResponse,
    ArtistReviewCreate, ArtistReviewResponse,
    ArtistAvailabilityCreate, ArtistAvailabilityResponse,
    ArtistProfileDetailed
)
from auth import get_current_user, require_admin
from email_service import send_email, send_booking_status_update_email
from api.notifications import create_notification
from security.enhanced_auth import auth_manager

router = APIRouter(prefix="/bookings", tags=["Bookings"])

from utils.ocr_service import extract_payment_reference


def _gate_booking_artist_payment(booking, db: Session):
    artist = booking.artist
    if not artist:
        return
    from services.subscription_service import SubscriptionService
    eligible = SubscriptionService.has_active_artist_subscription(db, artist.user_id)
    artist.deposit_eligible = eligible
    if not eligible:
        artist.wechat_qr_url = artist.alipay_qr_url = None
        artist.wechat_pay_url = artist.alipay_pay_url = artist.payment_instructions = None


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


# ==================== ARTIST PUBLIC PROFILE ====================

@router.get("/artists/{artist_id}/profile")
def get_artist_public_profile(
    artist_id: str,
    db: Session = Depends(get_db)
):
    """Get detailed public profile for an artist (booking page). Supports ID or slug."""
    from utils.slug import resolve_artist, slugify
    artist = resolve_artist(db, artist_id)
    
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )

    from services.subscription_service import SubscriptionService
    deposit_eligible = SubscriptionService.has_active_artist_subscription(db, artist.user_id)
    portfolio_media = db.query(ArtistPortfolioMedia).filter_by(artist_id=artist.id).order_by(ArtistPortfolioMedia.position).all()
    
    # Load user and reviews separately to avoid joinedload issues
    user = artist.user
    reviews = db.query(ArtistReview).filter(
        ArtistReview.artist_id == artist.id
    ).options(
        joinedload(ArtistReview.reviewer)
    ).order_by(
        ArtistReview.created_at.desc()
    ).all()
    
    # Build response with user data including verification_badge
    return {
        "id": artist.id,
        "user_id": artist.user_id,
        "slug": artist.slug or slugify(artist.stage_name),
        "stage_name": artist.stage_name,
        "artist_type": artist.artist_type,
        "genre": artist.genre,
        "genre_tags": artist.genre_tags or [],
        "bio": artist.bio,
        "years_experience": artist.years_experience,
        "languages": artist.languages or [],
        "city": (artist.city.value if hasattr(artist.city, 'value') else artist.city) or (artist.user.preferred_city.value if getattr(artist, 'user', None) and getattr(artist.user, 'preferred_city', None) else None),
        "spotify_url": artist.spotify_url,
        "apple_music_url": artist.apple_music_url,
        "soundcloud_url": artist.soundcloud_url,
        "youtube_url": artist.youtube_url,
        "audiomack_url": artist.audiomack_url,
        "hearthis_url": artist.hearthis_url,
        "music_links": [link for link in (artist.music_links or []) if isinstance(link, dict) and urlparse(str(link.get("url", ""))).scheme in ("http", "https") and urlparse(str(link.get("url", ""))).netloc],
        "portfolio_media": [{"id": m.id, "media_type": m.media_type, "title": m.title, "url": m.url, "duration_seconds": m.duration_seconds, "position": m.position} for m in portfolio_media],
        "dj_mix_url": artist.dj_mix_url,
        "dj_mix_title": artist.dj_mix_title,
        "dj_mix_duration": artist.dj_mix_duration,
        "dance_video_url": artist.dance_video_url,
        "dance_video_title": artist.dance_video_title,
        "dance_video_duration": artist.dance_video_duration,
        "starting_price": artist.starting_price,
        "performance_duration": artist.performance_duration,
        "event_types": artist.event_types or [],
        "equipment_provided": artist.equipment_provided,
        "travel_availability": artist.travel_availability,
        "travel_fee": artist.travel_fee,
        "followers_count": artist.followers_count or 0,
        "events_count": artist.events_count or 0,
        "rating": artist.rating or 0.0,
        "reviews_count": artist.reviews_count or 0,
        "is_verified": user.is_verified if user else False,
        "verification_badge": user.verification_badge if user else False,
        "avatar_url": user.avatar_url if user else None,
        "background_url": user.background_url if user else None,
        "instagram": user.instagram if user else None,
        "twitter": user.twitter if user else None,
        "tiktok": user.tiktok if user else None,
        "wechat_id": user.wechat_id if user else None,
        "website": user.website if user else None,
        "deposit_eligible": deposit_eligible,
        "wechat_qr_url": artist.wechat_qr_url if deposit_eligible else None,
        "alipay_qr_url": artist.alipay_qr_url if deposit_eligible else None,
        "wechat_pay_url": artist.wechat_pay_url if deposit_eligible else None,
        "alipay_pay_url": artist.alipay_pay_url if deposit_eligible else None,
        "payment_instructions": artist.payment_instructions if deposit_eligible else None,
        "reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "comment": r.comment,
                "event_type": r.event_type,
                "is_verified": r.is_verified,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "reviewer": {
                    "first_name": r.reviewer.first_name if r.reviewer else None,
                    "last_name": r.reviewer.last_name if r.reviewer else None,
                    "avatar_url": r.reviewer.avatar_url if r.reviewer else None,
                }
            }
            for r in reviews
        ] if reviews else []
    }


@router.get("/artists/{artist_id}/availability")
def get_artist_availability(
    artist_id: str,
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year (e.g., 2026)"),
    db: Session = Depends(get_db)
):
    """Get artist's availability calendar. Accepts artist ID or slug."""
    from utils.slug import resolve_artist
    artist = resolve_artist(db, artist_id)
    if not artist:
        return []
    artist_profile_id = artist.id
    
    query = db.query(ArtistAvailability).filter(
        ArtistAvailability.artist_id == artist_profile_id
    )
    
    if month and year:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        query = query.filter(
            ArtistAvailability.date >= start_date,
            ArtistAvailability.date < end_date
        )
    
    availability = query.order_by(ArtistAvailability.date).all()
    
    return [
        {
            "id": a.id,
            "date": a.date.strftime("%Y-%m-%d"),
            "status": a.status,  # available, booked, unavailable
            "note": a.note
        }
        for a in availability
    ]


@router.get("/artists/{artist_id}/reviews", response_model=List[ArtistReviewResponse])
def get_artist_reviews(
    artist_id: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get artist's reviews with verified booking badge. Accepts artist ID or slug."""
    from utils.slug import resolve_artist
    artist = resolve_artist(db, artist_id)
    if not artist:
        return []
    artist_profile_id = artist.id
    
    reviews = db.query(ArtistReview).filter(
        ArtistReview.artist_id == artist_profile_id
    ).options(
        joinedload(ArtistReview.reviewer)
    ).order_by(
        ArtistReview.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return reviews


# ==================== BOOKING REQUESTS ====================

@router.post("/requests", response_model=BookingRequestResponse)
def create_booking_request(
    booking_data: BookingRequestCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new booking request for an artist."""
    from auth import forbid_admin_consumer_action
    forbid_admin_consumer_action(current_user, "artist bookings")
    # Verify artist exists
    artist = db.query(ArtistProfile).filter(
        ArtistProfile.id == booking_data.artist_id
    ).first()
    
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist not found"
        )
    
    # Cannot book yourself
    if artist.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book yourself"
        )
    
    # Prevent accidental duplicate bookings from rapid/double submissions.
    # If an identical pending request from the same user for the same artist
    # and event details was created within the last 5 minutes, return it.
    recent_window = datetime.now() - timedelta(minutes=5)
    duplicate = db.query(BookingRequest).filter(
        BookingRequest.requester_id == current_user.id,
        BookingRequest.artist_id == booking_data.artist_id,
        BookingRequest.status == BookingStatus.PENDING,
        BookingRequest.created_at >= recent_window,
        BookingRequest.event_name == booking_data.event_name,
        BookingRequest.event_city == booking_data.event_city,
        BookingRequest.event_date == booking_data.event_date,
    ).first()
    
    if duplicate:
        return duplicate
    
    # Create booking request
    booking = BookingRequest(
        artist_id=booking_data.artist_id,
        requester_id=current_user.id,
        event_name=booking_data.event_name,
        event_type=booking_data.event_type,
        event_date=booking_data.event_date,
        event_time=booking_data.event_time,
        event_city=booking_data.event_city,
        event_location=booking_data.event_location,
        budget=booking_data.budget,
        duration_hours=booking_data.duration_hours,
        message=booking_data.message,
        creative_role=artist.artist_type,
        contact_name=booking_data.contact_name or f"{current_user.first_name} {current_user.last_name}".strip(),
        contact_phone=booking_data.contact_phone or current_user.phone,
        contact_email=booking_data.contact_email or current_user.email,
        equipment_needed=booking_data.equipment_needed,
        travel_required=booking_data.travel_required,
        special_requests=booking_data.special_requests,
        status=BookingStatus.PENDING
    )
    
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    # Send notification to artist
    create_notification(
        db=db,
        user_id=artist.user_id,
        title="New Booking Request",
        message=f"You have a new booking request from {current_user.first_name} {current_user.last_name} for {booking.event_date.strftime('%B %d, %Y') if booking.event_date else 'TBD'}" + (f" at {booking.event_time}" if booking.event_time else ""),
        notification_type="booking_request",
        data={
            "booking_id": booking.id,
            "requester_name": f"{current_user.first_name} {current_user.last_name}",
            "event_date": booking.event_date.isoformat() if booking.event_date else None,
            "event_time": booking.event_time,
            "venue": booking.event_location
        }
    )
    
    # Send confirmation email to user
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d3da0c;">Booking Request Sent!</h2>
        <p>Hi {current_user.first_name},</p>
        <p>Your booking request has been sent to {artist.stage_name or f"{artist.user.first_name} {artist.user.last_name}"}.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3>Booking Details:</h3>
            <p><strong>Artist:</strong> {artist.stage_name or f"{artist.user.first_name} {artist.user.last_name}"}</p>
            <p><strong>Event Date:</strong> {booking.event_date.strftime('%B %d, %Y') if booking.event_date else 'TBD'}</p>
            <p><strong>Event Time:</strong> {booking.event_time or 'TBD'}</p>
            <p><strong>Venue:</strong> {booking.event_location or 'TBD'}</p>
            <p><strong>Duration:</strong> {booking.duration_hours or 'TBD'} hours</p>
            <p><strong>Budget:</strong> {'$' + f'{booking.budget:,.2f}' if booking.budget else 'TBD'}</p>
        </div>
        <p>You will be notified once the artist responds to your request.</p>
        <p>Best regards,<br>The Sound It Team</p>
    </div>
    """
    
    try:
        send_email(
            to_email=current_user.email,
            subject="Booking Request Sent - Sound It",
            html_body=email_html
        )
    except Exception as e:
        import logging
        logging.getLogger("soundit").warning(f"Failed to send booking confirmation email to {current_user.email}: {e}")
    
    _gate_booking_artist_payment(booking, db)
    return booking


@router.get("/requests/my", response_model=List[BookingRequestResponse])
def get_my_booking_requests(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: pending, accepted, confirmed, completed, rejected, cancelled"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get booking requests sent by current user."""
    query = db.query(BookingRequest).filter(
        BookingRequest.requester_id == current_user.id
    ).options(
        joinedload(BookingRequest.artist),
        joinedload(BookingRequest.messages)
    )
    
    if status_filter:
        try:
            status_enum = BookingStatus(status_filter.lower())
            query = query.filter(BookingRequest.status == status_enum)
        except ValueError:
            pass
    
    bookings = query.order_by(BookingRequest.created_at.desc()).all()
    for booking in bookings:
        _gate_booking_artist_payment(booking, db)
    return bookings


@router.get("/requests/incoming", response_model=List[BookingRequestResponse])
def get_incoming_booking_requests(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get booking requests for artist (if user is an artist)."""
    # Check if user is an artist
    if not current_user.artist_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only artists can view incoming booking requests"
        )
    
    query = db.query(BookingRequest).filter(
        BookingRequest.artist_id == current_user.artist_profile.id
    ).options(
        joinedload(BookingRequest.requester),
        joinedload(BookingRequest.messages)
    )
    
    if status_filter:
        try:
            status_enum = BookingStatus(status_filter.lower())
            query = query.filter(BookingRequest.status == status_enum)
        except ValueError:
            pass
    
    bookings = query.order_by(BookingRequest.created_at.desc()).all()
    return bookings


@router.get("/requests/{booking_id}", response_model=BookingRequestResponse)
def get_booking_details(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific booking request."""
    booking = db.query(BookingRequest).filter(
        BookingRequest.id == booking_id
    ).options(
        joinedload(BookingRequest.artist),
        joinedload(BookingRequest.requester),
        joinedload(BookingRequest.messages).joinedload(BookingMessage.sender)
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Check permission - only artist or requester can view
    is_artist = current_user.artist_profile and booking.artist_id == current_user.artist_profile.id
    is_requester = booking.requester_id == current_user.id
    
    if not (is_artist or is_requester or current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this booking"
        )

    _gate_booking_artist_payment(booking, db)
    
    return booking


@router.put("/requests/{booking_id}/status", response_model=BookingRequestResponse)
def update_booking_status(
    booking_id: int,
    status_update: BookingRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update booking status (accept, reject, confirm, cancel, complete)."""
    booking = db.query(BookingRequest).filter(
        BookingRequest.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    is_artist = current_user.artist_profile and booking.artist_id == current_user.artist_profile.id
    is_requester = booking.requester_id == current_user.id
    
    # Validate status transition based on role
    new_status = status_update.status
    
    if new_status in [BookingStatus.ACCEPTED, BookingStatus.REJECTED]:
        # Only artist can accept/reject
        if not is_artist:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the artist can accept or reject bookings"
            )
    
    elif new_status in [BookingStatus.CONFIRMED, BookingStatus.CANCELLED]:
        # Both artist and requester can confirm/cancel
        if not (is_artist or is_requester):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this booking"
            )
    
    elif new_status == BookingStatus.COMPLETED:
        # Only artist or admin can mark as completed
        if not (is_artist or current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the artist can mark bookings as completed"
            )
    
    # Update booking
    booking.status = new_status
    if status_update.agreed_price:
        booking.agreed_price = status_update.agreed_price
    if status_update.payment_method:
        booking.payment_method = status_update.payment_method
    if status_update.rejection_reason and new_status == BookingStatus.REJECTED:
        booking.rejection_reason = status_update.rejection_reason
    
    if new_status in [BookingStatus.ACCEPTED, BookingStatus.REJECTED]:
        booking.reviewed_at = datetime.now()
    
    db.commit()
    db.refresh(booking)
    
    # Send notification to other party
    if is_artist:
        # Artist updated status, notify requester
        artist_name = booking.artist.stage_name or f"{booking.artist.user.first_name} {booking.artist.user.last_name}".strip() or "Artist"
        event_date_str = booking.event_date.strftime("%B %d, %Y") if booking.event_date else None
        create_notification(
            db=db,
            user_id=booking.requester_id,
            title=f"Booking {new_status.value.title()}",
            message=f"Your booking request with {artist_name} has been {new_status.value.lower()}",
            notification_type="booking_update",
            data={
                "booking_id": booking.id,
                "new_status": new_status.value,
                "artist_name": artist_name
            }
        )
        if booking.requester and new_status in (BookingStatus.ACCEPTED, BookingStatus.REJECTED):
            send_booking_status_update_email(
                to_email=booking.requester.email,
                requester_name=booking.requester.first_name,
                artist_name=artist_name,
                event_name=booking.event_name,
                event_date=event_date_str,
                event_city=booking.event_city,
                status=new_status.value,
                rejection_reason=booking.rejection_reason
            )
    else:
        # Requester updated status, notify artist
        create_notification(
            db=db,
            user_id=booking.artist.user_id,
            title=f"Booking {new_status.value.title()}",
            message=f"Booking request from {booking.contact_name} has been {new_status.value.lower()}",
            notification_type="booking_update",
            data={
                "booking_id": booking.id,
                "new_status": new_status.value,
                "requester_name": booking.contact_name
            }
        )
    _gate_booking_artist_payment(booking, db)
    return booking


@router.post("/requests/{booking_id}/upload-payment")
def upload_booking_payment(
    booking_id: int,
    payment_screenshot: UploadFile = File(...),
    payer_name: str = Form(...),
    payer_notes: Optional[str] = Form(None),
    payment_reference: Optional[str] = Form(None),
    payment_choice: str = Form("deposit"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload payment screenshot for a booking request"""
    booking = db.query(BookingRequest).filter(BookingRequest.id == booking_id).with_for_update().first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the requester can upload payment proof")

    from services.subscription_service import SubscriptionService
    if not SubscriptionService.has_active_artist_subscription(db, booking.artist.user_id):
        raise HTTPException(status_code=403, detail="This artist is not currently eligible to receive deposits through Sound It.")

    if booking.payment_status in ("submitted", "verified"):
        raise HTTPException(status_code=409, detail="Payment proof has already been submitted for this booking.")
    
    if booking.status not in [BookingStatus.PENDING, BookingStatus.ACCEPTED]:
        raise HTTPException(status_code=400, detail="Cannot upload payment for this booking status")
    
    # Validate upload
    allowed_content_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if payment_screenshot.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WEBP are allowed.")
    
    # Read file bytes early for validation, hashing, and saving
    file_bytes = payment_screenshot.file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Payment proof image must be 10 MB or smaller.")
    try:
        from PIL import Image
        from io import BytesIO
        proof_image = Image.open(BytesIO(file_bytes))
        if proof_image.format not in {"JPEG", "PNG", "WEBP"}:
            raise ValueError("unsupported image")
        proof_image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Payment proof must be a valid JPEG, PNG, or WEBP image.")
    proof_hash = hashlib.sha256(file_bytes).hexdigest()
    
    # 1. Payment Reference Duplicate Check and OCR Extraction
    if not payment_reference:
        # Attempt OCR extraction if reference is missing
        detected_ref = extract_payment_reference(file_bytes)
        if detected_ref:
            payment_reference = detected_ref
            print(f"[OCR] Automatically detected reference: {payment_reference}")

    if payment_reference:
        existing_ref = db.query(BookingRequest).filter(
            func.lower(BookingRequest.payment_reference) == payment_reference.strip().lower()
        ).first()
        if existing_ref:
            raise HTTPException(status_code=400, detail=f"This payment reference ({payment_reference}) has already been used for a booking request.")

    # 2. Payment Proof Hash Duplicate Detection (Anti-Fraud)
    # Check across relevant models
    from models import TicketOrder, Order, TableOrder, Subscription, ProductOrder
    exists_in_bookings = db.query(BookingRequest).filter(BookingRequest.payment_proof_hash == proof_hash).first()
    if exists_in_bookings:
        raise HTTPException(status_code=400, detail="This payment screenshot has already been used for a booking request.")
        
    for model in [TicketOrder, Order, TableOrder, Subscription, ProductOrder]:
        item_exists = db.query(model).filter(getattr(model, "payment_proof_hash") == proof_hash).first()
        if item_exists:
            raise HTTPException(status_code=400, detail="This payment screenshot has already been used in another order.")

    from utils.upload_storage import get_upload_dir
    upload_dir = get_upload_dir("bookings")
    
    # Upload screenshot
    filename_str = payment_screenshot.filename or ""
    ext = filename_str.split(".")[-1].lower() if "." in filename_str else "png"
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        ext = "png"
    filename = f"payment_{booking_id}_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    
    booking.payment_screenshot = f"/static/uploads/bookings/{filename}"
    booking.payment_proof_hash = proof_hash
    base_amount = booking.agreed_price if booking.agreed_price is not None else booking.budget
    if payment_choice not in {"deposit", "full"}:
        raise HTTPException(status_code=400, detail="Payment choice must be deposit or full.")
    booking.deposit_amount = (round(float(base_amount) * (0.5 if payment_choice == "deposit" else 1.0), 2) if base_amount is not None else None)
    booking.payment_amount = booking.deposit_amount
    booking.payer_name = payer_name
    booking.payer_notes = payer_notes
    booking.payment_reference = payment_reference
    booking.payment_status = "submitted"
    booking.payment_submitted_at = datetime.now()
    
    db.commit()
    db.refresh(booking)
    
    # Notify artist
    create_notification(
        db=db,
        user_id=booking.artist.user_id,
        title="Deposit Awaiting Review",
        message=f"{booking.contact_name} submitted deposit payment proof for booking '{booking.event_name}'. Verify the transfer before confirming payment.",
        notification_type="booking_payment_uploaded",
        data={"booking_id": booking.id, "event_name": booking.event_name}
    )
    
    return {
        "message": "Payment proof submitted and awaiting artist review.",
        "booking_id": booking.id,
        "payment_status": booking.payment_status,
    }


@router.put("/requests/{booking_id}/payment-status")
def review_booking_payment(booking_id: int, decision: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(BookingRequest).filter_by(id=booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not current_user.artist_profile or booking.artist_id != current_user.artist_profile.id:
        raise HTTPException(status_code=403, detail="Only the booked artist can review this payment proof")
    if booking.payment_status != "submitted":
        raise HTTPException(status_code=409, detail="There is no submitted payment proof awaiting review.")
    decision = decision.strip().lower()
    if decision not in {"verified", "rejected"}:
        raise HTTPException(status_code=400, detail="Decision must be verified or rejected.")
    booking.payment_status = decision
    booking.payment_verified_at = datetime.now() if decision == "verified" else None
    booking.payment_reviewed_at = datetime.now()
    db.commit()
    create_notification(db=db, user_id=booking.requester_id, title=f"Deposit {decision.title()}", message=f"The artist marked your booking deposit as {decision}.", notification_type="booking_payment_reviewed", data={"booking_id": booking.id, "payment_status": decision})
    return {"booking_id": booking.id, "payment_status": booking.payment_status, "payment_verified_at": booking.payment_verified_at}


# ==================== BOOKING MESSAGES ====================

@router.post("/requests/{booking_id}/messages", response_model=BookingMessageResponse)
def send_booking_message(
    booking_id: int,
    message_data: BookingMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message within a booking conversation."""
    booking = db.query(BookingRequest).filter(
        BookingRequest.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Check permission
    is_artist = current_user.artist_profile and booking.artist_id == current_user.artist_profile.id
    is_requester = booking.requester_id == current_user.id
    
    if not (is_artist or is_requester):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send messages in this booking"
        )
    
    # Create message
    message = BookingMessage(
        booking_id=booking_id,
        sender_id=current_user.id,
        message=message_data.message
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send notification to other party
    if is_artist:
        # Artist sent message, notify requester
        create_notification(
            db=db,
            user_id=booking.requester_id,
            title="New Message from Artist",
            message=f"{booking.artist.stage_name or f'{booking.artist.user.first_name} {booking.artist.user.last_name}'} sent you a message about your booking",
            notification_type="booking_message",
            data={
                "booking_id": booking.id,
                "message_id": message.id,
                "sender_name": booking.artist.stage_name or f"{booking.artist.user.first_name} {booking.artist.user.last_name}"
            }
        )
    else:
        # Requester sent message, notify artist
        create_notification(
            db=db,
            user_id=booking.artist.user_id,
            title="New Message from Client",
            message=f"{booking.contact_name} sent you a message about their booking request",
            notification_type="booking_message",
            data={
                "booking_id": booking.id,
                "message_id": message.id,
                "sender_name": booking.contact_name
            }
        )
    
    return message


@router.get("/requests/{booking_id}/messages", response_model=List[BookingMessageResponse])
def get_booking_messages(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages for a booking."""
    booking = db.query(BookingRequest).filter(
        BookingRequest.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Check permission
    is_artist = current_user.artist_profile and booking.artist_id == current_user.artist_profile.id
    is_requester = booking.requester_id == current_user.id
    
    if not (is_artist or is_requester):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view messages in this booking"
        )
    
    messages = db.query(BookingMessage).filter(
        BookingMessage.booking_id == booking_id
    ).options(
        joinedload(BookingMessage.sender)
    ).order_by(BookingMessage.created_at.asc()).all()
    
    return messages


# ==================== REVIEWS ====================

@router.post("/requests/{booking_id}/reviews", response_model=ArtistReviewResponse)
def create_review(
    booking_id: int,
    review_data: ArtistReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Leave a review for an artist after a completed booking."""
    booking = db.query(BookingRequest).filter(
        BookingRequest.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Only requester can review
    if booking.requester_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event organizer can leave a review"
        )
    
    # Booking must be completed
    if booking.status != BookingStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only review completed bookings"
        )
    
    # Check if already reviewed
    existing_review = db.query(ArtistReview).filter(
        ArtistReview.booking_id == booking_id
    ).first()
    
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this booking"
        )
    
    # Create review
    review = ArtistReview(
        artist_id=booking.artist_id,
        booking_id=booking_id,
        reviewer_id=current_user.id,
        rating=review_data.rating,
        comment=review_data.comment,
        event_type=booking.event_type,
        is_verified=True
    )
    
    db.add(review)
    
    # Update artist rating
    artist = db.query(ArtistProfile).filter(
        ArtistProfile.id == booking.artist_id
    ).first()
    
    if artist:
        # Calculate new average rating
        all_reviews = db.query(ArtistReview).filter(
            ArtistReview.artist_id == artist.id
        ).all()
        
        total_rating = sum(r.rating for r in all_reviews) + review_data.rating
        artist.rating = total_rating / (len(all_reviews) + 1)
        artist.reviews_count = len(all_reviews) + 1
    
    db.commit()
    db.refresh(review)
    
    return review


# ==================== ARTIST AVAILABILITY MANAGEMENT ====================

@router.post("/availability", response_model=ArtistAvailabilityResponse)
def set_availability(
    availability_data: ArtistAvailabilityCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set availability for a date (artist only)."""
    if not current_user.artist_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only artists can set availability"
        )
    
    # Check if entry exists for this date
    existing = db.query(ArtistAvailability).filter(
        ArtistAvailability.artist_id == current_user.artist_profile.id,
        func.date(ArtistAvailability.date) == availability_data.date.date()
    ).first()
    
    if existing:
        # Update existing
        existing.status = availability_data.status
        existing.note = availability_data.note
        db.commit()
        db.refresh(existing)
        return existing
    
    # Create new
    availability = ArtistAvailability(
        artist_id=current_user.artist_profile.id,
        date=availability_data.date,
        status=availability_data.status,
        note=availability_data.note
    )
    
    db.add(availability)
    db.commit()
    db.refresh(availability)
    
    return availability


@router.delete("/availability/{availability_id}")
def delete_availability(
    availability_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete availability entry (artist only)."""
    if not current_user.artist_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only artists can manage availability"
        )
    
    availability = db.query(ArtistAvailability).filter(
        ArtistAvailability.id == availability_id,
        ArtistAvailability.artist_id == current_user.artist_profile.id
    ).first()
    
    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability entry not found"
        )
    
    db.delete(availability)
    db.commit()
    
    return {"message": "Availability entry deleted"}


# ==================== HEALTH CHECK ====================

@router.get("/health")
def bookings_health_check():
    """Health check for bookings endpoint."""
    return {"status": "healthy", "service": "bookings"}
