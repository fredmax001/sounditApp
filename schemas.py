from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Any
from typing import Optional, List
from datetime import datetime
from enum import Enum
from models import EventStatus, TicketStatus, PaymentStatus, PaymentMethod


# ==================== ENUMS ====================

class City(str, Enum):
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


class UserRole(str, Enum):
    USER = "user"
    BUSINESS = "business"
    ARTIST = "artist"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    VENDOR = "vendor"
    ORGANIZER = "organizer"


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class VerificationRequestType(str, Enum):
    BUSINESS = "business"
    ARTIST = "artist"
    VENUE = "venue"


class BookingStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


# ==================== USER SCHEMAS ====================

class UserBase(BaseModel):
    email: Optional[Any] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    background_url: Optional[str] = None
    bio: Optional[str] = None
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    wechat_id: Optional[str] = None
    website: Optional[str] = None
    preferred_city: Optional[str] = None  # Changed from City enum to str
    city_id: Optional[str] = None  # Frontend sends city_id, maps to preferred_city
    preferred_language: str = "en"
    foreigner_mode: Optional[bool] = False
    role: UserRole = UserRole.USER
    city: Optional[str] = None  # Changed from City enum to str
    
    @field_validator('email', mode='before')
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        # Accept any string as email (bypass Pydantic email validation)
        return str(v) if v else None
    
    def get_preferred_city(self) -> Optional[str]:
        """Returns the preferred city from either city_id or preferred_city"""
        if self.city_id:
            return self.city_id.lower()
        return self.preferred_city


class UserCreate(UserBase):
    REDACTED_PLACEHOLDER: Optional[str] = None


class UserUpdate(UserBase):
    pass


class UserResponse(UserBase):
    id: int
    status: str
    is_verified: bool
    verification_badge: bool = False
    created_at: datetime
    
    artist_profile: Optional["ArtistProfileResponse"] = None
    organizer_profile: Optional["OrganizerProfileResponse"] = None
    business_profile: Optional["BusinessProfileResponse"] = None
    vendor_profile: Optional["VendorProfileResponse"] = None
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: Optional[UserResponse] = None


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None


class UserRegistration(BaseModel):
    """User registration - No verification codes required (Beta Launch)"""
    # Required fields for all roles
    email: str
    REDACTED_PLACEHOLDER: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole
    
    # Optional fields
    city: Optional[City] = None
    avatar_url: Optional[str] = None
    
    # Role-specific fields
    # Business/Artist/Vendor
    business_name: Optional[str] = None  # Business/Venue/Stage Name
    business_type: Optional[str] = None  # organizer, club, venue, etc.
    
    # Artist specific
    artist_type: Optional[str] = None  # DJ, MC, Musician, Band
    
    # Vendor specific
    vendor_type: Optional[str] = None  # food, clothing, merchandise
    
    # Social links (Artist required, others optional)
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    weibo: Optional[str] = None
    website: Optional[str] = None
    
    # Bio (Artist required, others optional)
    bio: Optional[str] = None


class RoleSignupConfig(BaseModel):
    """Configuration for role-specific signup forms"""
    role: UserRole
    title: str
    description: str
    icon: str
    required_fields: List[str]
    optional_fields: List[str]


class RoleSelectionResponse(BaseModel):
    """Available roles for signup"""
    roles: List[RoleSignupConfig]
    

class SimpleUserResponse(BaseModel):
    """Simplified user response without strict email validation"""
    model_config = {"arbitrary_types_allowed": True}
    
    id: int
    email: Optional[Any] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    status: str
    is_verified: bool
    created_at: Any
    
    @field_validator('email', mode='before')
    @classmethod
    def bypass_email_validation(cls, v):
        return v

class SignupRedirectResponse(BaseModel):
    """Response after successful signup with redirect URL"""
    access_REDACTED_PLACEHOLDER: str
    REDACTED_PLACEHOLDER_type: str = "bearer"
    user: SimpleUserResponse
    redirect_url: str


class REDACTED_PLACEHOLDER(BaseModel):
    access_REDACTED_PLACEHOLDER: str
    REDACTED_PLACEHOLDER_type: str = "bearer"
    user: UserResponse


# ==================== OTP SCHEMAS ====================

class OTPSend(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    code: str


# ==================== ARTIST SCHEMAS (formerly DJ) ====================

class ArtistProfileBase(BaseModel):
    stage_name: str
    genre: Optional[str] = None
    genre_tags: List[str] = []
    bio: Optional[str] = None
    booking_enabled: bool = False
    spotify_url: Optional[str] = None
    apple_music_url: Optional[str] = None
    soundcloud_url: Optional[str] = None
    artist_type: Optional[str] = "Artist"  # Artist, DJ, or MC
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    payment_instructions: Optional[str] = None


class ArtistProfileCreate(ArtistProfileBase):
    pass


class ArtistProfileResponse(ArtistProfileBase):
    id: int
    user_id: int
    followers_count: int
    events_count: int
    is_verified: bool = False
    verification_badge: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Backward compatibility aliases
DJProfileBase = ArtistProfileBase
DJProfileCreate = ArtistProfileCreate
DJProfileResponse = ArtistProfileResponse


# ==================== BUSINESS PROFILE SCHEMAS ====================

class BusinessType(str, Enum):
    CLUB = "club"
    FOOD_SPOT = "food_spot"
    EVENT_VENUE = "event_venue"
    PROMOTER = "promoter"


class BusinessProfileBase(BaseModel):
    business_name: str
    business_type: Optional[List[str]] = []
    description: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[City] = None
    city_id: Optional[str] = None  # Frontend sends city_id, maps to city


class BusinessProfileCreate(BusinessProfileBase):
    gallery_images: Optional[List[str]] = None


class BusinessProfileResponse(BusinessProfileBase):
    id: int
    user_id: int
    is_verified: bool
    total_revenue: Optional[float] = 0.0
    events_count: Optional[int] = 0
    gallery_images: Optional[List[str]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== ORGANIZER PROFILE SCHEMAS ====================

class OrganizerProfileBase(BaseModel):
    organization_name: str
    description: Optional[str] = None
    website: Optional[str] = None


class OrganizerProfileCreate(OrganizerProfileBase):
    pass


class OrganizerProfileResponse(OrganizerProfileBase):
    id: int
    user_id: int
    is_verified: bool = False
    events_count: int = 0
    total_revenue: float = 0.0
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== CLUB SCHEMAS ====================

class ClubBase(BaseModel):
    name: str
    name_cn: Optional[str] = None
    city: City
    address: str
    description: Optional[str] = None
    music_genres: List[str] = []
    is_afrobeat_friendly: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    category: Optional[str] = None


class ClubCreate(ClubBase):
    pass


class ClubResponse(ClubBase):
    id: int
    cover_image: Optional[str] = None
    is_verified: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== FOOD SPOT SCHEMAS ====================

class FoodSpotBase(BaseModel):
    name: str
    name_cn: Optional[str] = None
    city: City
    address: str
    description: Optional[str] = None
    cuisine_type: Optional[str] = None
    price_range: Optional[str] = None  # $, $$, $$$, $$$$
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FoodSpotCreate(FoodSpotBase):
    pass


class FoodSpotResponse(FoodSpotBase):
    id: int
    cover_image: Optional[str] = None
    is_verified: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== VENDOR PROFILE SCHEMAS ====================

class VendorType(str, Enum):
    FOOD = "food"
    BEVERAGE = "beverage"
    MERCH = "merch"
    SERVICE = "service"


class VendorProfileBase(BaseModel):
    business_name: str
    description: Optional[str] = None
    vendor_type: Optional[VendorType] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    city_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    instagram: Optional[str] = None
    wechat: Optional[str] = None


class VendorProfileCreate(VendorProfileBase):
    pass


class VendorProfileResponse(VendorProfileBase):
    id: int
    user_id: int
    rating: float = 0.0
    reviews_count: int = 0
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== PRODUCT SCHEMAS ====================

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    currency: str = "CNY"
    image_url: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: int = 0
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    payment_instructions: Optional[str] = None
    status: str = "active"


class ProductCreate(ProductBase):
    vendor_id: Optional[int] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Optional[int] = None
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    payment_instructions: Optional[str] = None
    status: Optional[str] = None


class ProductResponse(ProductBase):
    id: int
    vendor_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== EVENT VENDOR SCHEMAS ====================

class EventVendorBase(BaseModel):
    event_id: int
    vendor_id: int
    booth_location: Optional[str] = None
    status: str = "pending"
    fee_paid: bool = False


class EventVendorCreate(EventVendorBase):
    pass


class EventVendorResponse(EventVendorBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== VENUE SCHEMAS ====================

class VenueBase(BaseModel):
    name: str
    name_cn: Optional[str] = None
    address: str
    city: City
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    description_cn: Optional[str] = None
    capacity: Optional[int] = None
    english_friendly: bool = False
    english_menu: bool = False
    accepts_foreign_cards: bool = False
    phone: Optional[str] = None
    wechat_id: Optional[str] = None
    dianping_url: Optional[str] = None
    category: Optional[str] = None
    cuisine_type: Optional[str] = None
    price_range: Optional[str] = None
    opening_hours: Optional[dict] = None


class VenueCreate(VenueBase):
    pass


class VenueResponse(VenueBase):
    id: int
    images: Optional[List[str]] = None
    cover_image: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== TICKET TIER SCHEMAS ====================

class TicketTierBase(BaseModel):
    name: str
    name_cn: Optional[str] = None
    description: Optional[str] = None
    price: float
    currency: str = "CNY"
    quantity: int
    max_per_order: int = 10
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None


class TicketTierCreate(TicketTierBase):
    pass


class TicketTierResponse(TicketTierBase):
    id: int
    event_id: int
    quantity_sold: int
    status: TicketStatus
    
    class Config:
        from_attributes = True


# ==================== EVENT SCHEMAS ====================

class EventBase(BaseModel):
    title: str
    title_cn: Optional[str] = None
    description: Optional[str] = None
    description_cn: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    city: City
    address: Optional[str] = None
    capacity: Optional[int] = None
    event_type: Optional[str] = None
    refund_policy: Optional[str] = None
    require_id: Optional[bool] = False
    tags: Optional[List[str]] = None


class EventCreate(EventBase):
    venue_id: Optional[int] = None
    dj_ids: Optional[List[int]] = None
    status: Optional[EventStatus] = None
    flyer_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    ticket_price: Optional[float] = None
    payment_instructions: Optional[str] = None
    event_type: Optional[str] = None
    refund_policy: Optional[str] = None
    require_id: Optional[bool] = False
    tags: Optional[List[str]] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    title_cn: Optional[str] = None
    description: Optional[str] = None
    description_cn: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    city: Optional[City] = None
    address: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[EventStatus] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    flyer_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    ticket_price: Optional[float] = None
    payment_instructions: Optional[str] = None
    event_type: Optional[str] = None
    refund_policy: Optional[str] = None
    require_id: Optional[bool] = False
    tags: Optional[List[str]] = None


class EventResponse(EventBase):
    id: int
    organizer_id: Optional[int] = None
    venue_id: Optional[int] = None
    flyer_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    status: EventStatus
    views_count: int
    tickets_sold: int
    is_featured: bool = False
    share_url: Optional[str] = None
    qr_code: Optional[str] = None
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    ticket_price: Optional[float] = None
    payment_instructions: Optional[str] = None
    event_type: Optional[str] = None
    refund_policy: Optional[str] = None
    require_id: Optional[bool] = False
    tags: Optional[List[str]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class EventBusiness(BaseModel):
    id: int
    user_id: int
    business_name: str
    logo_url: Optional[str] = None
    verification_badge: bool = False
    
    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    venue: Optional[VenueResponse] = None
    business: Optional[EventBusiness] = None
    djs: Optional[List[ArtistProfileResponse]] = None
    vendors: Optional[List[EventVendorResponse]] = None
    ticket_tiers: Optional[List["TicketTierResponse"]] = None
    organizer_plan: Optional[str] = "basic"


class EventListResponse(BaseModel):
    id: int
    title: str
    start_date: datetime
    end_date: Optional[datetime] = None
    city: City
    address: Optional[str] = None
    flyer_image: Optional[str] = None
    gallery_images: Optional[List[str]] = None
    status: EventStatus
    tickets_sold: int
    capacity: Optional[int] = None
    views_count: int = 0
    is_featured: bool = False
    event_type: Optional[str] = None
    tags: Optional[List[str]] = None
    ticket_tiers: Optional[List[TicketTierResponse]] = None
    venue: Optional[VenueResponse] = None
    
    class Config:
        from_attributes = True




# ==================== TICKET SCHEMAS ====================

class TicketResponse(BaseModel):
    id: int
    user_id: int
    ticket_tier_id: int
    order_id: Optional[int] = None
    ticket_number: str
    qr_code: Optional[str] = None
    is_used: bool
    used_at: Optional[datetime] = None
    created_at: datetime
    
    # Include event and ticket_tier information
    event: Optional["EventListResponse"] = None
    ticket_tier: Optional["TicketTierResponse"] = None
    
    # Computed event_id from ticket_tier.event
    event_id: Optional[int] = None
    
    @classmethod
    def from_orm(cls, obj):
        result = super().from_orm(obj)
        # Compute event_id from the event relationship
        if obj.ticket_tier and obj.ticket_tier.event:
            result.event_id = obj.ticket_tier.event.id
        return result
    
    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    ticket_tier: TicketTierResponse
    event: Optional[EventListResponse] = None


# ==================== ORDER SCHEMAS ====================

class OrderItem(BaseModel):
    ticket_tier_id: int
    quantity: int


class OrderCreate(BaseModel):
    event_id: int
    items: List[OrderItem]
    payment_method: Optional[PaymentMethod] = None
    attendee_info: Optional[dict] = None


class OrderResponse(BaseModel):
    id: int
    user_id: int
    order_number: str
    total_amount: float
    currency: str
    payment_method: Optional[PaymentMethod] = None
    payment_status: PaymentStatus
    paid_at: Optional[datetime] = None
    created_at: datetime
    
    # Manual QR Payment Fields
    qr_code_url: Optional[str] = None
    qr_expires_at: Optional[datetime] = None
    screenshot_uploaded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    class Config:
        from_attributes = True


class OrderDetailResponse(OrderResponse):
    tickets: List[TicketResponse]


# ==================== MANUAL QR PAYMENT SCHEMAS ====================

class ManualQRPaymentCreate(BaseModel):
    """Create a manual QR payment order"""
    event_id: int
    items: List[OrderItem]


class ManualQRPaymentResponse(BaseModel):
    """Response after creating manual QR payment"""
    order_id: int
    order_number: str
    amount: float
    currency: str
    qr_code_url: Optional[str] = None
    qr_expires_at: datetime
    status: str
    instructions: str
    time_remaining_seconds: int
    payment_link: Optional[str] = None  # For mobile devices
    device_type: Optional[str] = None   # 'mobile' or 'web'


class PaymentProofUpload(BaseModel):
    """Upload payment screenshot"""
    order_id: int


class PaymentProofResponse(BaseModel):
    """Response after uploading payment proof"""
    success: bool
    order_id: int
    status: str
    message: str
    uploaded_at: datetime


class AdminPaymentVerification(BaseModel):
    """Admin verification of payment"""
    order_id: int
    action: str  # "verify" or "reject"
    rejection_reason: Optional[str] = None


class AdminPaymentQueueItem(BaseModel):
    """Item in admin payment verification queue"""
    order_id: int
    order_number: str
    user_id: int
    user_name: str
    user_email: str
    event_name: str
    amount: float
    currency: str
    screenshot_url: str
    uploaded_at: datetime
    time_remaining_seconds: int
    
    class Config:
        from_attributes = True


# ==================== PAYMENT SCHEMAS ====================

class PaymentIntent(BaseModel):
    order_id: int
    amount: float
    currency: str
    payment_method: PaymentMethod


class PaymentConfirm(BaseModel):
    order_id: int
    payment_id: str


class PurchaseTicketData(BaseModel):
    order_id: int
    payment_intent_id: str


class YoopayPaymentRequest(BaseModel):
    order_id: int
    return_url: Optional[str] = None


# ==================== PAYOUT SCHEMAS ====================

class PayoutRequestCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_method: PaymentMethod
    payment_details: dict  # Bank account, Alipay ID, etc.


class PayoutRequestResponse(BaseModel):
    id: int
    user_id: int
    amount: float
    status: RequestStatus
    payment_method: PaymentMethod
    requested_at: datetime
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ==================== VERIFICATION SCHEMAS ====================

class VerificationRequestCreate(BaseModel):
    request_type: VerificationRequestType
    documents: List[str]  # URLs to uploaded documents


class VerificationRequestResponse(BaseModel):
    id: int
    user_id: int
    request_type: VerificationRequestType
    status: RequestStatus
    documents: List[str]
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    rejection_reason: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== BOOKING SCHEMAS ====================

class BookingRequestCreate(BaseModel):
    artist_id: int
    event_id: Optional[int] = None
    proposed_date: datetime
    message: Optional[str] = None


class BookingRequestResponse(BaseModel):
    id: int
    artist_id: int
    requester_id: int
    event_id: Optional[int] = None
    proposed_date: datetime
    message: Optional[str] = None
    status: BookingStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== ADMIN SCHEMAS ====================

class AdminDashboardStats(BaseModel):
    total_users: int
    total_businesses: int
    total_artists: int
    total_events: int
    total_tickets_sold: int
    total_revenue: float
    pending_payouts: int
    pending_verifications: int


class UserFilter(BaseModel):
    role: Optional[UserRole] = None
    city: Optional[City] = None
    is_verified: Optional[bool] = None
    search: Optional[str] = None


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    per_page: int


class EventModerationAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"


class EventModerationRequest(BaseModel):
    event_id: int
    action: EventModerationAction
    reason: Optional[str] = None  # Required when rejecting


# ==================== QR CODE SCHEMAS ====================

class QRValidateRequest(BaseModel):
    ticket_number: str


class QRValidateResponse(BaseModel):
    valid: bool
    ticket: Optional[TicketResponse] = None
    message: str


# ==================== SEARCH SCHEMAS ====================

class EventSearch(BaseModel):
    city: Optional[City] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    genre: Optional[str] = None
    query: Optional[str] = None


# ==================== NOTIFICATION SCHEMAS ====================

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== SOCIAL FEED SCHEMAS ====================

class PostCreate(BaseModel):
    """Create a new post"""
    content: str = Field(..., max_length=500)
    image_url: Optional[str] = None
    event_id: Optional[int] = None


class PostAuthor(BaseModel):
    """Author information for posts"""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    
    class Config:
        from_attributes = True


class PostResponse(BaseModel):
    """Post response"""
    id: int
    user_id: int
    author: PostAuthor
    content: str
    image_url: Optional[str] = None
    event_id: Optional[int] = None
    event_title: Optional[str] = None
    likes_count: int
    comments_count: int
    is_deleted: bool
    is_liked_by_me: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    """Create a comment"""
    content: str = Field(..., max_length=500)


class CommentResponse(BaseModel):
    """Comment response"""
    id: int
    post_id: int
    user_id: int
    author: PostAuthor
    content: str
    is_deleted: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PostReportCreate(BaseModel):
    """Report a post"""
    post_id: int
    reason: str = Field(..., pattern="^(spam|inappropriate|harassment|other)$")
    details: Optional[str] = None


class PostReportResponse(BaseModel):
    """Report response"""
    id: int
    post_id: int
    reporter_id: int
    reason: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class FeedPagination(BaseModel):
    """Paginated feed response"""
    posts: List[PostResponse]
    total: int
    page: int
    per_page: int
    has_more: bool


# ==================== STATS SCHEMAS ====================

class BusinessStats(BaseModel):
    total_events: int
    tickets_sold: int
    total_revenue: float
    platform_commission: float = 0.0
    net_earnings: float = 0.0
    pending_artist_payments: float


class ArtistStats(BaseModel):
    followers: int
    rating: float
    total_gigs: int
    earnings: float


class VendorStats(BaseModel):
    total_sales: float
    active_listings: int
    pending_orders: int
    event_booths: int


class RoleDashboardStats(BaseModel):
    role: UserRole
    business_stats: Optional[BusinessStats] = None
    artist_stats: Optional[ArtistStats] = None
    vendor_stats: Optional[VendorStats] = None


class DashboardStats(BaseModel):
    total_users: int
    total_events: int
    total_tickets_sold: int
    total_revenue: float
    recent_orders: List[OrderResponse]
    popular_events: List[EventListResponse]


class OrganizerStats(BaseModel):
    total_events: int
    total_tickets_sold: int
    total_revenue: float
    upcoming_events: List[EventListResponse]


# ==================== BOOKING SYSTEM SCHEMAS ====================

class BookingStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


# ----- Artist Track Schemas -----




# ----- Artist Availability Schemas -----

class ArtistAvailabilityBase(BaseModel):
    date: datetime
    status: str = "available"  # available, booked, unavailable
    note: Optional[str] = None


class ArtistAvailabilityCreate(ArtistAvailabilityBase):
    pass


class ArtistAvailabilityResponse(ArtistAvailabilityBase):
    id: int
    artist_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ----- Artist Review Schemas -----

class ArtistReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    event_type: Optional[str] = None


class ArtistReviewCreate(ArtistReviewBase):
    pass


class ReviewerInfo(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class ArtistReviewResponse(ArtistReviewBase):
    id: int
    artist_id: int
    booking_id: int
    reviewer_id: int
    reviewer: Optional[ReviewerInfo] = None
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ----- Booking Message Schemas -----

class BookingMessageBase(BaseModel):
    message: str


class BookingMessageCreate(BookingMessageBase):
    pass


class SenderInfo(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class BookingMessageResponse(BookingMessageBase):
    id: int
    booking_id: int
    sender_id: int
    sender: Optional[SenderInfo] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ----- Booking Request Schemas -----

class BookingRequestBase(BaseModel):
    artist_id: int
    event_name: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[datetime] = None
    event_city: Optional[str] = None
    event_location: Optional[str] = None
    budget: Optional[float] = None
    duration_hours: Optional[int] = None
    message: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    equipment_needed: Optional[List[str]] = None
    travel_required: Optional[bool] = False
    special_requests: Optional[str] = None


class BookingRequestCreate(BookingRequestBase):
    pass


class BookingRequestUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    agreed_price: Optional[float] = None
    payment_method: Optional[str] = None


class ArtistInfo(BaseModel):
    id: int
    stage_name: str
    artist_type: Optional[str] = None
    genre: Optional[str] = None
    avatar_url: Optional[str] = None
    wechat_qr_url: Optional[str] = None
    alipay_qr_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class BookingRequestResponse(BaseModel):
    id: int
    artist_id: int
    artist: Optional[ArtistInfo] = None
    requester_id: int
    requester: Optional[SenderInfo] = None
    event_id: Optional[int] = None
    status: BookingStatus
    
    # Event Details
    event_name: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[datetime] = None
    event_city: Optional[str] = None
    event_location: Optional[str] = None
    
    # Booking Details
    budget: Optional[float] = None
    duration_hours: Optional[int] = None
    message: Optional[str] = None
    
    # Contact Info
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    
    # Additional
    equipment_needed: Optional[List[str]] = None
    travel_required: Optional[bool] = False
    special_requests: Optional[str] = None
    agreed_price: Optional[float] = None
    payment_method: Optional[str] = None
    
    # Payment proof fields
    payment_screenshot: Optional[str] = None
    payment_amount: Optional[float] = None
    payer_name: Optional[str] = None
    payer_notes: Optional[str] = None
    payment_status: Optional[str] = "pending"
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    messages: Optional[List[BookingMessageResponse]] = []
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ----- Detailed Artist Profile Schema -----

class ArtistProfileDetailed(BaseModel):
    id: int
    user_id: int
    stage_name: str
    artist_type: Optional[str] = None
    genre: Optional[str] = None
    genre_tags: Optional[List[str]] = None
    bio: Optional[str] = None
    years_experience: Optional[int] = None
    languages: Optional[List[str]] = None
    city: Optional[str] = None
    
    # Music links
    spotify_url: Optional[str] = None
    apple_music_url: Optional[str] = None
    soundcloud_url: Optional[str] = None
    
    # Booking settings
    starting_price: Optional[float] = None
    performance_duration: Optional[str] = None
    event_types: Optional[List[str]] = None
    equipment_provided: Optional[List[str]] = None
    travel_availability: Optional[str] = None
    travel_fee: Optional[float] = None
    
    # Stats
    followers_count: int = 0
    events_count: int = 0
    rating: float = 0.0
    reviews_count: int = 0
    is_verified: bool = False
    verification_badge: bool = False
    
    # Related data
    reviews: Optional[List[ArtistReviewResponse]] = []
    
    class Config:
        from_attributes = True



# ===========================================================================
# RECAPS SCHEMAS - Event Photo Highlights
# ===========================================================================

class RecapStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


class RecapCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    photos: List[str] = Field(..., min_items=1, max_items=20)
    event_id: Optional[int] = None


class RecapUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    photos: Optional[List[str]] = Field(None, min_items=1, max_items=20)
    event_id: Optional[int] = None


class RecapResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    photos: List[str]
    views_count: int
    likes_count: int
    status: RecapStatus
    event_id: Optional[int] = None
    organizer_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    organizer_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class RecapDetailResponse(RecapResponse):
    user_liked: bool = False
    event: Optional[EventListResponse] = None


# ===========================================================================
# YOOPAY URL VALIDATION SCHEMAS
# ===========================================================================

class YooPayCreateRequest(BaseModel):
    """Request to create a new YooPay payment attempt"""
    order_id: int


class YooPayCreateResponse(BaseModel):
    """Response after creating a YooPay payment attempt"""
    payment_id: str
    order_id: int
    order_number: str
    amount: float
    currency: str
    status: str
    yoopay_payment_url: str
    instructions: str
    created_at: datetime


class YooPayValidateRequest(BaseModel):
    """Request to validate a YooPay payment URL"""
    payment_id: str
    yoopay_url: str


class YooPayValidateResponse(BaseModel):
    """Response after validating a YooPay URL"""
    valid: bool
    payment_id: str
    order_id: int
    status: str
    yoopay_transaction_id: Optional[str] = None
    message: str
    tickets_generated: Optional[int] = None
    can_retry: bool = True


class YooPayPaymentResponse(BaseModel):
    """YooPay payment record response"""
    id: int
    payment_id: str
    order_id: int
    yoopay_url: Optional[str] = None
    yoopay_transaction_id: Optional[str] = None
    status: str
    created_at: datetime
    validated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    validation_message: Optional[str] = None
    
    class Config:
        from_attributes = True


class YooPayStatusRequest(BaseModel):
    """Request to check YooPay payment status"""
    payment_id: str


class YooPayStatusResponse(BaseModel):
    """Response with YooPay payment status"""
    payment_id: str
    order_id: int
    status: str
    yoopay_url: Optional[str] = None
    yoopay_transaction_id: Optional[str] = None
    created_at: datetime
    validated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    message: Optional[str] = None





# ===========================================================================
# COMMUNITY FEED SCHEMAS - Posts, Comments, Likes, Shares
# ===========================================================================

class CommunitySectionBase(BaseModel):
    """Base schema for community sections"""
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class CommunitySectionResponse(CommunitySectionBase):
    """Schema for community section responses"""
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    post_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


class CommunityPostBase(BaseModel):
    """Base schema for community posts"""
    title: Optional[str] = Field(None, max_length=255)
    content: str = Field(..., min_length=1, max_length=2000)
    images: Optional[List[str]] = []
    videos: Optional[List[str]] = []
    section_id: Optional[int] = None
    event_id: Optional[int] = None


class CommunityPostCreate(CommunityPostBase):
    """Schema for creating a community post"""
    author_type: Optional[str] = "user"  # 'user', 'business', 'artist', 'vendor'
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None


class CommunityPostUpdate(BaseModel):
    """Schema for updating a community post"""
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = Field(None, min_length=1, max_length=2000)
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    section_id: Optional[int] = None


class CommunityAuthor(BaseModel):
    """Author info for community posts/comments"""
    id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_guest: bool = False
    
    class Config:
        from_attributes = True


class CommunityCommentResponse(BaseModel):
    """Schema for community comments"""
    id: int
    post_id: int
    user: CommunityAuthor
    content: str
    like_count: int = 0
    has_liked: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    replies: Optional[List['CommunityCommentResponse']] = []
    
    class Config:
        from_attributes = True


class CommunityPostResponse(BaseModel):
    """Schema for community post responses"""
    id: int
    user: CommunityAuthor
    author_type: str = "user"
    title: Optional[str] = None
    content: str
    images: List[str] = []
    videos: List[str] = []
    section_id: Optional[int] = None
    section: Optional[CommunitySectionResponse] = None
    event_id: Optional[int] = None
    event_title: Optional[str] = None
    
    # Stats
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    view_count: int = 0
    has_liked: bool = False
    
    # Comments (limited preview)
    comments: List[CommunityCommentResponse] = []
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CommunityCommentCreate(BaseModel):
    """Schema for creating a comment"""
    content: str = Field(..., min_length=1, max_length=1000)
    parent_comment_id: Optional[int] = None
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None


class CommunityFeedFilters(BaseModel):
    """Filters for community feed"""
    event_id: Optional[int] = None
    user_id: Optional[int] = None
    section_id: Optional[int] = None
    search: Optional[str] = None


class CommunityPaginatedResponse(BaseModel):
    """Paginated response for community feed"""
    posts: List[CommunityPostResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class CommunityStatsResponse(BaseModel):
    """Stats for community feed"""
    total_posts: int
    total_comments: int
    total_likes: int
    total_shares: int
    total_users: int
    trending_events: List[dict]  # Events with most posts


class CommunityMetricsResponse(BaseModel):
    """Admin metrics for community moderation"""
    total_posts: int
    total_pending_posts: int
    total_comments: int
    total_pending_comments: int
    total_sections: int
    posts_today: int
    posts_this_week: int
    top_sections: List[dict]
    recent_flagged: List[dict] = []


# ==================== PRODUCT ORDER SCHEMAS ====================

class ProductOrderCreate(BaseModel):
    product_id: int
    payer_name: str
    payer_notes: Optional[str] = None


class ProductOrderResponse(BaseModel):
    id: int
    product_id: int
    product: Optional[ProductResponse] = None
    user_id: int
    payment_screenshot: str
    payment_amount: float
    payer_name: Optional[str] = None
    payer_notes: Optional[str] = None
    status: str
    order_qr_code: Optional[str] = None
    order_code: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProductOrderListResponse(BaseModel):
    orders: List[ProductOrderResponse]
