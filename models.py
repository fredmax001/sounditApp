from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    USER = "user"
    BUSINESS = "business"
    ARTIST = "artist"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    VENDOR = "vendor"
    ORGANIZER = "organizer"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class TicketStatus(str, enum.Enum):
    AVAILABLE = "available"
    SOLD_OUT = "sold_out"
    LIMITED = "limited"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    STRIPE = "stripe"
    YOOPAY = "yoopay"
    WECHAT_PAY = "wechat_pay"
    ALIPAY = "alipay"
    APPLE_PAY = "apple_pay"
    GOOGLE_PAY = "google_pay"
    QR_TRANSFER = "qr_transfer"


class City(str, enum.Enum):
    BEIJING = "beijing"
    SHANGHAI = "shanghai"
    GUANGZHOU = "guangzhou"
    SHENZHEN = "shenzhen"
    CHENGDU = "chengdu"
    HANGZHOU = "hangzhou"
    NINGBO = "ningbo"
    YIWU = "yiwu"
    NANJING = "nanjing"
    WUHAN = "wuhan"
    XIAN = "xian"
    CHONGQING = "chongqing"
    SUZHOU = "suzhou"
    TIANJIN = "tianjin"
    QINGDAO = "qingdao"
    DALIAN = "dalian"
    XIAMEN = "xiamen"
    KUNMING = "kunming"
    CHANGSHA = "changsha"
    ZHENGZHOU = "zhengzhou"
    HARBIN = "harbin"
    CHANGCHUN = "changchun"
    SHENYANG = "shenyang"
    SHIJIAZHUANG = "shijiazhuang"
    TAIYUAN = "taiyuan"
    JINAN = "jinan"
    HEFEI = "hefei"
    NANCHANG = "nanchang"
    FUZHOU = "fuzhou"
    NANNING = "nanning"
    GUIYANG = "guiyang"
    LANZHOU = "lanzhou"
    HAIKOU = "haikou"
    HOHHOT = "hohhot"
    URUMQI = "urumqi"
    LHASA = "lhasa"
    YINCHUAN = "yinchuan"
    XINING = "xining"
    WUXI = "wuxi"
    NANTONG = "nantong"
    CHANGZHOU = "changzhou"
    XUZHOU = "xuzhou"
    YANGZHOU = "yangzhou"
    SHAOXING = "shaoxing"
    JIAXING = "jiaxing"
    TAIZHOU = "taizhou"
    WENZHOU = "wenzhou"
    JINHUA = "jinhua"
    QUZHOU = "quzhou"
    ZHOUSHAN = "zhoushan"
    DONGGUAN = "dongguan"
    FOSHAN = "foshan"
    ZHUHAI = "zhuhai"
    ZHONGSHAN = "zhongshan"
    JIANGMEN = "jiangmen"
    HUIZHOU = "huizhou"
    SHANTOU = "shantou"
    ZHANJIANG = "zhanjiang"
    ZHAOQING = "zhaoqing"
    MAOMING = "maoming"
    MEIZHOU = "meizhou"
    QINGYUAN = "qingyuan"
    OTHER = "other"


class PayoutStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PROCESSING = "processing"
    PAID = "paid"


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class VerificationType(str, enum.Enum):
    BUSINESS = "business"
    ARTIST = "artist"


class ArtistType(str, enum.Enum):
    ARTIST = "Artist"
    DJ = "DJ"
    MC = "MC"


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class RecapStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    
    # Social auth
    wechat_id = Column(String(255), unique=True, nullable=True)
    google_id = Column(String(255), unique=True, nullable=True)
    apple_id = Column(String(255), unique=True, nullable=True)
    
    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    username = Column(String(100), unique=True, index=True, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    background_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    instagram = Column(String(255), nullable=True)
    twitter = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Role & Status
    role = Column(Enum(UserRole), default=UserRole.USER)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE)
    is_verified = Column(Boolean, default=False)
    verification_badge = Column(Boolean, default=False)  # Premium badge assigned by super admin
    verification_badge_issued_at = Column(DateTime(timezone=True), nullable=True)
    verification_badge_issued_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Preferences
    preferred_city = Column(Enum(City), nullable=True)
    preferred_language = Column(String(10), default="en")
    notifications_enabled = Column(Boolean, default=True)
    
    # Foreigner mode
    foreigner_mode = Column(Boolean, default=False)
    
    # Password reset
    password_reset_token = Column(String(255), unique=True, nullable=True, index=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    tickets = relationship("Ticket", back_populates="user", foreign_keys="Ticket.user_id")
    artist_profile = relationship("ArtistProfile", back_populates="user", uselist=False)
    organizer_profile = relationship("OrganizerProfile", back_populates="user", uselist=False)
    business_profile = relationship("BusinessProfile", back_populates="user", uselist=False)
    vendor_profile = relationship("VendorProfile", back_populates="user", uselist=False)
    followed_artists = relationship("ArtistFollow", back_populates="user")
    followed_events = relationship("EventFollow", back_populates="user")
    followed_vendors = relationship("VendorFollow", back_populates="user")
    followed_organizers = relationship("OrganizerFollow", back_populates="user")
    payout_requests = relationship("PayoutRequest", back_populates="user", foreign_keys="PayoutRequest.user_id")
    verification_requests = relationship("VerificationRequest", back_populates="user", foreign_keys="VerificationRequest.user_id")
    booking_requests_sent = relationship("BookingRequest", back_populates="requester", foreign_keys="BookingRequest.requester_id")
    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    
    # Community feed relationships
    community_posts = relationship("CommunityPost", back_populates="user")
    community_comments = relationship("CommunityComment", back_populates="user")
    community_likes = relationship("CommunityLike", back_populates="user")
    community_comment_likes = relationship("CommunityCommentLike", back_populates="user")
    
    # Subscription and ticketing relationships
    subscriptions = relationship("Subscription", back_populates="user", foreign_keys="Subscription.user_id")
    ticket_orders = relationship("TicketOrder", back_populates="user", foreign_keys="TicketOrder.user_id")
    product_orders = relationship("ProductOrder", back_populates="user", foreign_keys="ProductOrder.user_id")
    
    # Table reservation relationships
    table_orders = relationship("TableOrder", back_populates="user", foreign_keys="TableOrder.user_id")


class ArtistProfile(Base):
    __tablename__ = "artist_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Artist Info
    stage_name = Column(String(100), nullable=False)
    artist_type = Column(String(20), nullable=True, default=ArtistType.ARTIST.value)
    genre = Column(String(100), nullable=True)
    genre_tags = Column(JSON, nullable=True)
    
    # Professional details
    bio = Column(Text, nullable=True)
    years_experience = Column(Integer, nullable=True)
    languages = Column(JSON, nullable=True)
    city = Column(Enum(City), nullable=True)
    
    # Music links
    spotify_url = Column(String(500), nullable=True)
    apple_music_url = Column(String(500), nullable=True)
    soundcloud_url = Column(String(500), nullable=True)
    hearthis_url = Column(String(500), nullable=True)
    youtube_url = Column(String(500), nullable=True)
    audiomack_url = Column(String(500), nullable=True)
    
    # Booking settings
    starting_price = Column(Float, nullable=True)
    performance_duration = Column(String(50), nullable=True)
    event_types = Column(JSON, nullable=True)
    equipment_provided = Column(JSON, nullable=True)
    travel_availability = Column(String(50), nullable=True)
    travel_fee = Column(Float, nullable=True)
    
    # Stats
    followers_count = Column(Integer, default=0)
    events_count = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    
    # Featured status
    is_featured = Column(Boolean, default=False)
    
    # Performance history
    performance_history = Column(JSON, nullable=True)
    
    # Payment QR codes for bookings
    wechat_qr_url = Column(String(500), nullable=True)
    alipay_qr_url = Column(String(500), nullable=True)
    payment_instructions = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="artist_profile")

    events = relationship("EventArtist", back_populates="artist")
    followers = relationship("ArtistFollow", back_populates="artist")
    booking_requests = relationship("BookingRequest", back_populates="artist")
    availability = relationship("ArtistAvailability", back_populates="artist")
    reviews = relationship("ArtistReview", back_populates="artist")



class OrganizerProfile(Base):
    __tablename__ = "organizer_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Organization Info
    organization_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(Enum(City), nullable=True)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    is_business = Column(Boolean, default=False)
    verification_documents = Column(JSON, nullable=True)
    
    # Featured status
    is_featured = Column(Boolean, default=False)
    
    # Stats
    events_count = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    followers_count = Column(Integer, default=0)
    
    # Link to unified BusinessProfile
    business_profile_id = Column(Integer, ForeignKey("business_profiles.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="organizer_profile")
    events = relationship("Event", back_populates="organizer")
    business_profile = relationship("BusinessProfile", back_populates="organizer_profiles")
    followers = relationship("OrganizerFollow", back_populates="organizer")


class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Business Info
    business_name = Column(String(200), nullable=False)
    business_type = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    verification_documents = Column(JSON, nullable=True)
    
    # Stats
    total_revenue = Column(Float, default=0.0)
    events_count = Column(Integer, default=0)
    
    # Location
    city = Column(Enum(City), nullable=True)
    
    # Media
    gallery_images = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="business_profile")
    organizer_profiles = relationship("OrganizerProfile", back_populates="business_profile")
    clubs = relationship("Club", back_populates="business_claimed_by")
    food_spots = relationship("FoodSpot", back_populates="business_claimed_by")


class Club(Base):
    __tablename__ = "clubs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Info
    name = Column(String(200), nullable=False)
    name_cn = Column(String(200), nullable=True)
    
    # Location
    city = Column(Enum(City), nullable=False)
    address = Column(String(500), nullable=False)
    district = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Music & Vibe
    music_genres = Column(JSON, nullable=True)
    is_afrobeat_friendly = Column(Boolean, default=False)
    category = Column(String(50), nullable=True)
    
    # Images
    cover_image = Column(String(500), nullable=True)
    gallery_images = Column(JSON, nullable=True)
    
    # Contact
    phone = Column(String(20), nullable=True)
    wechat_id = Column(String(100), nullable=True)
    
    # Status
    is_verified = Column(Boolean, default=False)
    
    # Business claim
    business_claimed_by_id = Column(Integer, ForeignKey("business_profiles.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    business_claimed_by = relationship("BusinessProfile", back_populates="clubs")


class FoodSpot(Base):
    __tablename__ = "food_spots"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Info
    name = Column(String(200), nullable=False)
    name_cn = Column(String(200), nullable=True)
    
    # Location
    city = Column(Enum(City), nullable=False)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Food details
    cuisine_type = Column(String(100), nullable=True)
    price_range = Column(String(10), nullable=True)
    
    # Images
    cover_image = Column(String(500), nullable=True)
    
    # Status
    is_verified = Column(Boolean, default=False)
    
    # Business claim
    business_claimed_by_id = Column(Integer, ForeignKey("business_profiles.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    business_claimed_by = relationship("BusinessProfile", back_populates="food_spots")


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    business_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    vendor_type = Column(String(50), nullable=True)
    
    logo_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    
    # Contact & Location
    city = Column(Enum(City), nullable=True)
    address = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    website = Column(String(500), nullable=True)
    instagram = Column(String(200), nullable=True)
    wechat = Column(String(200), nullable=True)
    
    # Stats
    rating = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    followers_count = Column(Integer, default=0)
    
    # Verification
    is_verified = Column(Boolean, default=False)
    
    # Featured status
    is_featured = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="vendor_profile")
    products = relationship("Product", back_populates="vendor")
    events = relationship("EventVendor", back_populates="vendor")
    followers = relationship("VendorFollow", back_populates="vendor")


class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendor_profiles.id"))
    
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    currency = Column(String(3), default="CNY")
    image_url = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    stock_quantity = Column(Integer, default=0)
    
    # Payment QR codes for manual checkout
    wechat_qr_url = Column(String(500), nullable=True)
    alipay_qr_url = Column(String(500), nullable=True)
    payment_instructions = Column(Text, nullable=True)
    
    status = Column(String(20), default="active")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    vendor = relationship("VendorProfile", back_populates="products")
    product_orders = relationship("ProductOrder", back_populates="product")


class EventVendor(Base):
    __tablename__ = "event_vendors"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    vendor_id = Column(Integer, ForeignKey("vendor_profiles.id"))
    
    booth_location = Column(String(100), nullable=True)
    status = Column(String(20), default="pending")
    fee_paid = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="vendors")
    vendor = relationship("VendorProfile", back_populates="events")


class BookingRequest(Base):
    __tablename__ = "booking_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # References
    artist_id = Column(Integer, ForeignKey("artist_profiles.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Status
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    
    # Event Details
    event_name = Column(String(200), nullable=True)
    event_type = Column(String(100), nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=True)
    event_city = Column(String(100), nullable=True)
    event_location = Column(String(255), nullable=True)
    
    # Booking Details
    budget = Column(Float, nullable=True)
    duration_hours = Column(Integer, nullable=True)
    message = Column(Text, nullable=True)
    
    # Contact Info
    contact_name = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    
    # Additional requirements
    equipment_needed = Column(JSON, nullable=True)
    travel_required = Column(Boolean, default=False)
    special_requests = Column(Text, nullable=True)
    
    # Pricing
    agreed_price = Column(Float, nullable=True)
    payment_method = Column(String(50), nullable=True)
    
    # Payment proof fields
    payment_screenshot = Column(String(500), nullable=True)
    payment_amount = Column(Float, nullable=True)
    payer_name = Column(String(100), nullable=True)
    payer_notes = Column(Text, nullable=True)
    payment_status = Column(String(50), nullable=True, default="pending")
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    artist = relationship("ArtistProfile", back_populates="booking_requests")
    event = relationship("Event")
    requester = relationship("User", back_populates="booking_requests_sent", foreign_keys=[requester_id])
    messages = relationship("BookingMessage", back_populates="booking")
    reviews = relationship("ArtistReview", back_populates="booking")


class BookingMessage(Base):
    __tablename__ = "booking_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    booking = relationship("BookingRequest", back_populates="messages")
    sender = relationship("User")


class ArtistReview(Base):
    __tablename__ = "artist_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    artist_id = Column(Integer, ForeignKey("artist_profiles.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Review content
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    event_type = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    artist = relationship("ArtistProfile", back_populates="reviews")
    booking = relationship("BookingRequest", back_populates="reviews")
    reviewer = relationship("User")


class ArtistAvailability(Base):
    __tablename__ = "artist_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    artist_id = Column(Integer, ForeignKey("artist_profiles.id"), nullable=False)
    
    # Date
    date = Column(DateTime(timezone=True), nullable=False)
    
    # Status
    status = Column(String(20), default="available")
    
    # Optional note
    note = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    artist = relationship("ArtistProfile", back_populates="availability")


class PayoutRequest(Base):
    __tablename__ = "payout_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User requesting payout
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="CNY")
    
    # Status
    status = Column(Enum(PayoutStatus), default=PayoutStatus.PENDING)
    
    # Payment method and details
    payment_method = Column(String(50), nullable=True)
    payment_details = Column(JSON, nullable=True)
    
    # Timestamps
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Processed by
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="payout_requests", foreign_keys=[user_id])
    processed_by = relationship("User", foreign_keys=[processed_by_id])


class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User requesting verification
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Request type
    request_type = Column(Enum(VerificationType), nullable=False)
    
    # Status
    status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    
    # Documents
    documents = Column(JSON, nullable=True)
    
    # Timestamps
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Processed by
    processed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Admin notes
    notes = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="verification_requests", foreign_keys=[user_id])
    processed_by = relationship("User", foreign_keys=[processed_by_id])


class Venue(Base):
    __tablename__ = "venues"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    name_cn = Column(String(200), nullable=True)
    
    # Location
    address = Column(String(500), nullable=False)
    city = Column(Enum(City), nullable=False)
    district = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Details
    description = Column(Text, nullable=True)
    description_cn = Column(Text, nullable=True)
    capacity = Column(Integer, nullable=True)
    
    # Foreigner friendly
    english_friendly = Column(Boolean, default=False)
    english_menu = Column(Boolean, default=False)
    accepts_foreign_cards = Column(Boolean, default=False)
    
    # Contact
    phone = Column(String(20), nullable=True)
    wechat_id = Column(String(100), nullable=True)
    dianping_url = Column(String(500), nullable=True)
    
    # Images
    images = Column(JSON, nullable=True)
    cover_image = Column(String(500), nullable=True)
    
    # Category
    category = Column(String(50), nullable=True)
    cuisine_type = Column(String(100), nullable=True)
    price_range = Column(String(10), nullable=True)
    
    # Hours
    opening_hours = Column(JSON, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    events = relationship("Event", back_populates="venue")


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    organizer_id = Column(Integer, ForeignKey("organizer_profiles.id"))
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=True)
    
    # Event Info
    title = Column(String(200), nullable=False)
    title_cn = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    description_cn = Column(Text, nullable=True)
    
    # Date & Time
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Location
    city = Column(Enum(City), nullable=False)
    address = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Media
    flyer_image = Column(String(500), nullable=True)
    gallery_images = Column(JSON, nullable=True)
    
    # Capacity & Status
    capacity = Column(Integer, nullable=True)
    status = Column(Enum(EventStatus), default=EventStatus.DRAFT)
    
    # Stats
    views_count = Column(Integer, default=0)
    tickets_sold = Column(Integer, default=0)
    
    # Featured status
    is_featured = Column(Boolean, default=False)
    
    # Social sharing
    share_url = Column(String(500), nullable=True)
    qr_code = Column(Text, nullable=True)
    
    # Tags / genres
    tags = Column(JSON, nullable=True)
    
    # Event details
    event_type = Column(String(100), nullable=True)
    refund_policy = Column(String(50), nullable=True)
    require_id = Column(Boolean, default=False)
    
    # Payment QR codes for manual ticketing
    wechat_qr_url = Column(String(500), nullable=True)
    alipay_qr_url = Column(String(500), nullable=True)
    ticket_price = Column(Float, nullable=True)
    payment_instructions = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organizer = relationship("OrganizerProfile", back_populates="events")
    venue = relationship("Venue", back_populates="events")
    ticket_tiers = relationship("TicketTier", back_populates="event")
    artists = relationship("EventArtist", back_populates="event")
    vendors = relationship("EventVendor", back_populates="event")
    followers = relationship("EventFollow", back_populates="event")
    tickets = relationship("Ticket", back_populates="event")
    community_posts = relationship("CommunityPost", back_populates="event")
    
    # Ticketing system relationships
    ticket_orders = relationship("TicketOrder", back_populates="event")
    payment_qr = relationship("EventPaymentQR", back_populates="event", uselist=False)
    
    # Table reservation relationships
    table_packages = relationship("TablePackage", back_populates="event")
    table_orders = relationship("TableOrder", back_populates="event")


class EventArtist(Base):
    __tablename__ = "event_artists"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    artist_id = Column(Integer, ForeignKey("artist_profiles.id"))
    performance_time = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    event = relationship("Event", back_populates="artists")
    artist = relationship("ArtistProfile", back_populates="events")


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
    
    # Limits
    max_per_order = Column(Integer, default=10)
    
    # Status
    status = Column(Enum(TicketStatus), default=TicketStatus.AVAILABLE)
    
    # Sale period
    sale_start = Column(DateTime(timezone=True), nullable=True)
    sale_end = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="ticket_tiers")
    tickets = relationship("Ticket", back_populates="ticket_tier")


class Ticket(Base):
    __tablename__ = "tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticket_tier_id = Column(Integer, ForeignKey("ticket_tiers.id"))
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    ticket_order_id = Column(Integer, ForeignKey("ticket_orders.id"), nullable=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    
    # Ticket Info
    ticket_number = Column(String(50), unique=True, nullable=False)
    qr_token = Column(String(255), unique=True, index=True, nullable=False)
    qr_code = Column(Text, nullable=True)  # base64 PNG – needs Text, not String(N)
    
    # Status
    status = Column(String(50), default="active", index=True)
    
    # Verification
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Audit trail
    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verification_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="tickets")
    ticket_tier = relationship("TicketTier", back_populates="tickets")
    order = relationship("Order", back_populates="tickets")
    ticket_order = relationship("TicketOrder", back_populates="tickets")
    event = relationship("Event", back_populates="tickets")
    verified_by_user = relationship("User", foreign_keys=[verified_by_user_id])


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Order Info
    order_number = Column(String(50), unique=True, nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payment_reference = Column(String(100), nullable=True)
    currency = Column(String(3), default="CNY")
    
    # Payment
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_id = Column(String(255), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    # Manual QR Payment Fields (Beta Launch)
    qr_code_url = Column(String(500), nullable=True)  # QR code image URL for manual payment
    qr_expires_at = Column(DateTime(timezone=True), nullable=True)  # 24 hour expiry
    payment_screenshot_url = Column(String(500), nullable=True)  # Uploaded payment proof
    screenshot_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who verified
    verified_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)  # If payment rejected
    
    # Refund
    refund_amount = Column(Float, nullable=True)
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    tickets = relationship("Ticket", back_populates="order")
    items = relationship("OrderItem", back_populates="order")
    
    # Table args for unique constraint on payment_proof_hash (when not null)
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
    
    # Relationships
    order = relationship("Order", back_populates="items")
    ticket_tier = relationship("TicketTier")
    product = relationship("Product")


class PaymentVerification(Base):
    """Stores payment screenshot uploads for manual/auto verification"""
    __tablename__ = "payment_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_ref = Column(String(50), nullable=False, index=True)
    
    # Screenshot image
    screenshot_url = Column(String(500), nullable=True)
    
    # Detected information
    detected_amount = Column(Float, nullable=True)
    detected_date = Column(String(50), nullable=True)
    detected_time = Column(String(50), nullable=True)
    detected_payee = Column(String(200), nullable=True)
    
    # Verification status
    status = Column(String(20), default="pending")
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Rejection reason
    rejection_reason = Column(Text, nullable=True)
    
    # Expected payment amount
    expected_amount = Column(Float, nullable=False)
    
    # External payment reference
    payment_id = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class YooPayPayment(Base):
    """Stores YooPay URL-based payment attempts and verifications"""
    __tablename__ = "yoopay_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Internal Payment ID (e.g., PAY-20250223-7842)
    payment_id = Column(String(50), unique=True, nullable=False, index=True)
    
    # Order reference
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # YooPay URL provided by user after payment
    yoopay_url = Column(String(500), nullable=True)
    
    # Extracted transaction ID from YooPay URL
    yoopay_transaction_id = Column(String(100), nullable=True, index=True)
    
    # Payment status
    status = Column(String(20), default="pending")  # pending, validating, completed, failed, reused
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    validated_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Validation notes
    validation_message = Column(Text, nullable=True)
    
    # Relationships
    order = relationship("Order")


class ArtistFollow(Base):
    __tablename__ = "artist_follows"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    artist_id = Column(Integer, ForeignKey("artist_profiles.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="followed_artists")
    artist = relationship("ArtistProfile", back_populates="followers")


class EventFollow(Base):
    __tablename__ = "event_follows"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="followed_events")
    event = relationship("Event", back_populates="followers")


class OTPCode(Base):
    __tablename__ = "otp_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    otp_type = Column(String(10), nullable=False, default="sms")
    purpose = Column(String(50), nullable=True, default="login")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VendorFollow(Base):
    __tablename__ = "vendor_follows"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    vendor_id = Column(Integer, ForeignKey("vendor_profiles.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="followed_vendors")
    vendor = relationship("VendorProfile", back_populates="followers")


class OrganizerFollow(Base):
    __tablename__ = "organizer_follows"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    organizer_id = Column(Integer, ForeignKey("organizer_profiles.id"))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="followed_organizers")
    organizer = relationship("OrganizerProfile", back_populates="followers")


# ===========================================================================
# SOCIAL FEED - Posts, Comments, Likes
# ===========================================================================

class Post(Base):
    """Social feed posts by users"""
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Content
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    
    # Optional event tag
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    
    # Stats
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    
    # Moderation
    is_deleted = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    event = relationship("Event")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    """Comments on posts"""
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Content
    content = Column(Text, nullable=False)
    
    # Moderation
    is_deleted = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="comments")
    user = relationship("User")


class PostLike(Base):
    """Likes on posts"""
    __tablename__ = "post_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("Post", back_populates="likes")
    user = relationship("User")
    
    # Unique constraint - one like per user per post
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class PostReport(Base):
    """Reports on posts for moderation"""
    __tablename__ = "post_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Report details
    reason = Column(String(100), nullable=False)  # spam, inappropriate, harassment, other
    details = Column(Text, nullable=True)
    
    # Status
    status = Column(String(20), default="pending")  # pending, resolved, dismissed
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class SearchLog(Base):
    __tablename__ = "search_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    query = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FeaturedItem(Base):
    __tablename__ = "featured_items"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    position = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="general")
    
    # Link to related entity
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ===========================================================================
# RECAPS - Event Photo Highlights Feature
# ===========================================================================

class Recap(Base):
    """
    Recaps - Event Photo Highlights
    Businesses/Organizers can post photos from past events (max 20 photos)
    to showcase the experience for users
    """
    __tablename__ = "recaps"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Reference to the event
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    organizer_id = Column(Integer, ForeignKey("organizer_profiles.id"), nullable=False)
    
    # Recap Info
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Photos (max 20)
    photos = Column(JSON, nullable=False, default=list)  # Array of photo URLs
    
    # Stats
    views_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    
    # Status
    status = Column(Enum(RecapStatus), default=RecapStatus.DRAFT)
    
    # Publishing
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    event = relationship("Event")
    organizer = relationship("OrganizerProfile")
    likes = relationship("RecapLike", back_populates="recap")


class RecapLike(Base):
    """User likes on recaps"""
    __tablename__ = "recap_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    recap_id = Column(Integer, ForeignKey("recaps.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recap = relationship("Recap", back_populates="likes")
    
    # Unique constraint
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


# ===========================================================================
# ADMIN DASHBOARD - Ads, CMS, Settings, Logs
# ===========================================================================

class AdPosition(str, enum.Enum):
    HOMEPAGE_HERO = "homepage_hero"
    HOMEPAGE_SIDEBAR = "homepage_sidebar"
    EVENTS_PAGE = "events_page"
    ARTISTS_PAGE = "artists_page"
    MOBILE_BANNER = "mobile_banner"


class AdStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    SCHEDULED = "scheduled"
    EXPIRED = "expired"


class Ad(Base):
    """Advertisement banners for the platform"""
    __tablename__ = "ads"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Ad content
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    link_url = Column(String(500), nullable=True)
    
    # Placement & targeting
    position = Column(Enum(AdPosition), default=AdPosition.HOMEPAGE_SIDEBAR)
    city = Column(Enum(City), nullable=True)  # Target specific city or NULL for all
    
    # Status & scheduling
    status = Column(Enum(AdStatus), default=AdStatus.PAUSED)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Performance tracking
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    budget = Column(Float, nullable=True)
    
    # Targeting options
    target_audience = Column(JSON, nullable=True)  # e.g., {"roles": ["user", "artist"]}
    
    # Created by
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CMSPage(Base):
    """CMS pages for static content"""
    __tablename__ = "cms_pages"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Page identification
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    title_cn = Column(String(200), nullable=True)
    
    # Content
    content = Column(Text, nullable=True)
    content_cn = Column(Text, nullable=True)
    
    # SEO
    meta_description = Column(String(500), nullable=True)
    meta_keywords = Column(String(500), nullable=True)
    
    # Status
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    # Author
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CMSBanner(Base):
    """CMS banners for homepage and other pages"""
    __tablename__ = "cms_banners"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Banner content
    title = Column(String(200), nullable=False)
    subtitle = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=False)
    link_url = Column(String(500), nullable=True)
    
    # Placement
    page = Column(String(50), default="homepage")  # homepage, events, artists, etc.
    position = Column(String(50), default="hero")  # hero, sidebar, footer
    
    # Display order
    sort_order = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Scheduling
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SystemSetting(Base):
    """System configuration settings"""
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Setting identification
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    value_type = Column(String(20), default="string")  # string, int, float, bool, json
    
    # Description for admin UI
    description = Column(String(500), nullable=True)
    category = Column(String(50), default="general")  # general, payment, email, etc.
    
    # Editable flag
    is_editable = Column(Boolean, default=True)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class CommissionRate(Base):
    """Commission rates by city"""
    __tablename__ = "commission_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    city = Column(Enum(City), nullable=True)  # NULL for default rate
    rate = Column(Float, nullable=False, default=0.10)  # 0.10 = 10%
    
    # Description
    description = Column(String(200), nullable=True)
    
    # Effective dates
    effective_from = Column(DateTime(timezone=True), server_default=func.now())
    effective_to = Column(DateTime(timezone=True), nullable=True)
    
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class AdminActivityLog(Base):
    """Admin activity logging"""
    __tablename__ = "admin_activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Who performed the action
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_name = Column(String(200), nullable=True)
    
    # Action details
    action = Column(String(50), nullable=False)  # create, update, delete, verify, etc.
    entity_type = Column(String(50), nullable=False)  # user, event, business, etc.
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String(200), nullable=True)
    
    # Additional details
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SecurityLog(Base):
    """Security audit logs"""
    __tablename__ = "security_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Event details
    event_type = Column(String(50), nullable=False)  # login, logout, failed_login, permission_denied, etc.
    severity = Column(String(20), default="info")  # info, warning, error, critical
    
    # User info
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String(255), nullable=True)
    
    # Request details
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    endpoint = Column(String(500), nullable=True)
    method = Column(String(10), nullable=True)
    
    # Additional data
    details = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())



# ===========================================================================
# COMMUNITY FEED MODELS - Posts, Comments, Likes, Shares
# ===========================================================================

class CommunitySection(Base):
    """Community sections/categories"""
    __tablename__ = "community_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    posts = relationship("CommunityPost", back_populates="section")
    creator = relationship("User", foreign_keys=[created_by])


class CommunityPost(Base):
    """Community posts about past events"""
    __tablename__ = "community_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Author
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_type = Column(String(20), default="user")
    
    # Guest author info
    guest_id = Column(String(64), nullable=True, index=True)
    guest_name = Column(String(100), nullable=True)
    guest_email = Column(String(255), nullable=True)
    
    # Content
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    images = Column(JSON, nullable=True)  # Array of image URLs
    videos = Column(JSON, nullable=True)  # Array of video URLs
    
    # Optional: Link to an event
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    
    # Section
    section_id = Column(Integer, ForeignKey("community_sections.id"), nullable=True)
    
    # Stats
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    
    # Visibility / Moderation
    is_visible = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="community_posts")
    event = relationship("Event", back_populates="community_posts")
    section = relationship("CommunitySection", back_populates="posts")
    comments = relationship("CommunityComment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("CommunityLike", back_populates="post", cascade="all, delete-orphan")


class CommunityComment(Base):
    """Comments on community posts"""
    __tablename__ = "community_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Post being commented on
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False)
    
    # Author
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Guest author info
    guest_id = Column(String(64), nullable=True, index=True)
    guest_name = Column(String(100), nullable=True)
    guest_email = Column(String(255), nullable=True)
    
    # Content
    content = Column(Text, nullable=False)
    
    # For nested replies (optional)
    parent_comment_id = Column(Integer, ForeignKey("community_comments.id"), nullable=True)
    
    # Stats / Moderation
    like_count = Column(Integer, default=0)
    is_approved = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    post = relationship("CommunityPost", back_populates="comments")
    user = relationship("User", back_populates="community_comments")
    replies = relationship("CommunityComment", backref="parent", remote_side=[id])
    comment_likes = relationship("CommunityCommentLike", back_populates="comment", cascade="all, delete-orphan")


class CommunityLike(Base):
    """Likes on community posts"""
    __tablename__ = "community_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Post being liked
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False)
    
    # User who liked
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Guest liker info
    guest_id = Column(String(64), nullable=True, index=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("CommunityPost", back_populates="likes")
    user = relationship("User", back_populates="community_likes")
    
    # Unique constraint: one like per user per post
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class CommunityCommentLike(Base):
    """Likes on community comments"""
    __tablename__ = "community_comment_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Comment being liked
    comment_id = Column(Integer, ForeignKey("community_comments.id"), nullable=False)
    
    # User who liked
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Guest liker info
    guest_id = Column(String(64), nullable=True, index=True)
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    comment = relationship("CommunityComment", back_populates="comment_likes")
    user = relationship("User", back_populates="community_comment_likes")
    
    # Unique constraint
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class CommunityShare(Base):
    """Shares of community posts"""
    __tablename__ = "community_shares"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Post being shared
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False)
    
    # User who shared
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Guest sharer info
    guest_id = Column(String(64), nullable=True)
    
    # Platform (optional, for analytics)
    platform = Column(String(50), nullable=True)  # 'internal', 'wechat', 'facebook', etc.
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("CommunityPost")
    user = relationship("User")



# ==================== SUBSCRIPTION SYSTEM MODELS ====================

class SubscriptionPlan(str, enum.Enum):
    BASIC = "basic"
    PRO = "pro"
    PREMIUM = "premium"


class SubscriptionStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class TicketOrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    USED = "used"


class SubscriptionPlanConfig(Base):
    """Configuration for subscription plans with role-based pricing"""
    __tablename__ = "subscription_plan_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_type = Column(Enum(SubscriptionPlan), nullable=False)
    role = Column(Enum(UserRole), nullable=False)  # business, vendor, artist
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, default=30)
    features = Column(JSON, default=list)  # List of feature keys
    event_limit = Column(Integer, nullable=True)  # For business: events per month
    featured_listing = Column(Boolean, default=False)
    analytics_access = Column(Boolean, default=False)
    priority_support = Column(Boolean, default=False)
    custom_branding = Column(Boolean, default=False)
    push_notifications = Column(Boolean, default=False)
    verified_badge = Column(Boolean, default=False)
    homepage_spotlight = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Subscription(Base):
    """User subscriptions"""
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    plan_type = Column(Enum(SubscriptionPlan), nullable=False)
    price = Column(Float, nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.PENDING)
    
    # Payment info
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    payment_reference = Column(String(255), nullable=True)  # YOOPAY reference / Manual Reference
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payment_screenshot = Column(String(500), nullable=True)  # URL to payment proof
    
    # Dates
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Trial tracking
    is_trial = Column(Boolean, default=False)
    
    # Admin approval
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="subscriptions")
    approver = relationship("User", foreign_keys=[approved_by])


class TicketOrder(Base):
    """Ticket orders with manual approval"""
    __tablename__ = "ticket_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Payment proof (now optional — external payment via organizer QR)
    payment_screenshot = Column(String(500), nullable=True)
    payment_amount = Column(Float, nullable=True)
    payment_date = Column(Date, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payer_name = Column(String(100), nullable=True)
    payer_notes = Column(Text, nullable=True)
    screenshot_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    
    # Attendee contact info (required for external payment flow)
    email = Column(String(255), nullable=True)
    phone_number = Column(String(50), nullable=True)
    
    # Order status
    status = Column(Enum(TicketOrderStatus), default=TicketOrderStatus.PENDING)
    quantity = Column(Integer, default=1)
    ticket_tier_id = Column(Integer, ForeignKey("ticket_tiers.id"), nullable=True)
    
    # QR Code for approved ticket
    ticket_qr_code = Column(Text, nullable=True)  # base64 PNG – needs Text, not String(N)
    ticket_code = Column(String(100), unique=True, nullable=True)  # Unique ticket code
    
    # Auto-approval tracking
    tickets_generated = Column(Integer, default=0)
    auto_approved = Column(Boolean, default=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    validation_notes = Column(Text, nullable=True)
    
    # Organizer approval
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Usage tracking
    used_at = Column(DateTime(timezone=True), nullable=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who scanned it
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="ticket_orders")
    user = relationship("User", foreign_keys=[user_id], back_populates="ticket_orders")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    tickets = relationship("Ticket", back_populates="ticket_order")


class ProductOrder(Base):
    """Product orders with manual approval"""
    __tablename__ = "product_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Payment proof
    payment_screenshot = Column(String(500), nullable=False)
    payment_amount = Column(Float, nullable=False)
    payer_name = Column(String(100), nullable=True)
    payer_notes = Column(Text, nullable=True)
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payment_reference = Column(String(100), nullable=True)
    
    # Order status (reuse TicketOrderStatus values)
    status = Column(Enum(TicketOrderStatus), default=TicketOrderStatus.PENDING)
    
    # QR Code for approved order
    order_qr_code = Column(Text, nullable=True)  # base64 PNG – needs Text, not String(N)
    order_code = Column(String(255), unique=True, nullable=True, index=True)
    
    # Vendor approval
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Usage tracking
    used_at = Column(DateTime(timezone=True), nullable=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    product = relationship("Product", back_populates="product_orders")
    user = relationship("User", foreign_keys=[user_id], back_populates="product_orders")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class EventPaymentQR(Base):
    """Organizer's payment QR codes for events"""
    __tablename__ = "event_payment_qrs"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, unique=True)
    organizer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # QR Images
    wechat_pay_qr = Column(String(500), nullable=True)
    alipay_qr = Column(String(500), nullable=True)
    
    # Instructions
    payment_instructions = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="payment_qr")


class SubscriptionFeatureUsage(Base):
    """Track feature usage for subscription limits"""
    __tablename__ = "subscription_feature_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    feature_type = Column(String(50), nullable=False)  # 'event_created', 'media_upload', etc.
    usage_count = Column(Integer, default=0)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Update User model relationships (add to User class)
# These will be added via back_populates in the actual User class


# ==================== TABLE RESERVATION SYSTEM (BOTTLE SERVICE) ====================

class TablePackage(Base):
    """Table reservation packages (Bottle Service tiers)"""
    __tablename__ = "table_packages"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    business_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Package Details
    name = Column(String(100), nullable=False)  # e.g., "VIP", "VVIP", "Premium Gold"
    price = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    
    # Included items (drinks, perks, etc.)
    included_items = Column(JSON, default=list)  # ["2 bottles of Champagne", "1 Shisha", "VIP seating"]
    drinks = Column(JSON, default=list)  # Structured drink list
    extras = Column(JSON, default=list)  # Additional perks
    
    # Capacity
    ticket_quantity = Column(Integer, default=0)  # Tickets included
    max_people = Column(Integer, nullable=True)  # Max people at table
    total_tables = Column(Integer, default=1)  # Total tables available for booking
    
    # Display settings
    display_order = Column(Integer, default=0)  # For custom sorting
    is_active = Column(Boolean, default=True)
    
    # Media
    image_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    event = relationship("Event", back_populates="table_packages")
    business = relationship("User", foreign_keys=[business_id])
    orders = relationship("TableOrder", back_populates="table_package")


class TableOrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class TableOrder(Base):
    """Table reservation orders"""
    __tablename__ = "table_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    table_package_id = Column(Integer, ForeignKey("table_packages.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    business_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Contact Info
    contact_name = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    contact_email = Column(String(255), nullable=True)
    guest_count = Column(Integer, nullable=True)  # Number of guests
    special_requests = Column(Text, nullable=True)
    
    # Payment
    payment_screenshot = Column(String(500), nullable=False)
    payment_amount = Column(Float, nullable=False)
    payment_notes = Column(Text, nullable=True)
    payment_proof_hash = Column(String(64), nullable=True, index=True)
    payment_reference = Column(String(100), nullable=True)
    
    # Status
    status = Column(Enum(TableOrderStatus), default=TableOrderStatus.PENDING)
    
    # Business Review
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    # QR Code for approved table order
    ticket_qr_code = Column(Text, nullable=True)  # base64 PNG – needs Text, not String(N)
    ticket_code = Column(String(100), unique=True, nullable=True)
    
    # Usage tracking
    used_at = Column(DateTime(timezone=True), nullable=True)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    table_package = relationship("TablePackage", back_populates="orders")
    event = relationship("Event", back_populates="table_orders")
    user = relationship("User", foreign_keys=[user_id], back_populates="table_orders")
    business = relationship("User", foreign_keys=[business_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class ModerationReport(Base):
    """Unified moderation reports for events, users, comments, messages"""
    __tablename__ = "moderation_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)  # event, user, comment, message, post
    entity_id = Column(Integer, nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Report details
    reason = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    severity = Column(String(20), default="medium")  # low, medium, high
    
    # Status
    status = Column(String(20), default="pending")  # pending, resolved, dismissed
    resolution_action = Column(String(50), nullable=True)  # remove, warn, ban, none
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id])
    resolver = relationship("User", foreign_keys=[resolved_by])


class ApiKey(Base):
    """API keys for integrations"""
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(8), nullable=False)
    key_hash = Column(String(255), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])


class Webhook(Base):
    """Webhook endpoints"""
    __tablename__ = "webhooks"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    events = Column(JSON, default=list)
    secret = Column(String(255), nullable=True)
    
    # Status
    status = Column(String(20), default="active")  # active, failed, inactive
    failure_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    
    # Ownership
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])


class Integration(Base):
    """Third-party service integrations"""
    __tablename__ = "integrations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(50), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon = Column(String(255), nullable=True)
    
    # Configuration
    config = Column(JSON, default=dict)
    
    # Status
    enabled = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PromoCode(Base):
    """Promo codes for events"""
    __tablename__ = "promo_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    business_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    code = Column(String(50), nullable=False)
    discount_type = Column(String(20), default="percentage")  # percentage, fixed
    discount_value = Column(Float, default=0.0)
    max_uses = Column(Integer, nullable=True)
    used_count = Column(Integer, default=0)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PageVisit(Base):
    """Tracks page visits for analytics"""
    __tablename__ = "page_visits"
    
    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(500), nullable=False, index=True)
    method = Column(String(10), default="GET")
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    referrer = Column(String(500), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class StaffMember(Base):
    """Business staff members (sub-accounts for events)"""
    __tablename__ = "staff_members"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    full_name = Column(String(200), nullable=False)
    login = Column(String(100), nullable=False, unique=True)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(50), nullable=False, default="Scanner")
    status = Column(String(20), nullable=False, default="Pending")  # Active, Pending
    
    # Permissions as JSON
    permissions = Column(JSON, nullable=True, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
