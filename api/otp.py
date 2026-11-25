"""
OTP API Module - Production Ready
Twilio Verify (SMS) & SendGrid (Email) & Alibaba Cloud SMS - Real delivery only
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db

# Initialize router
router = APIRouter(prefix="/otp", tags=["OTP"])

# Settings
settings = get_settings()


# Request/Response Models
class PhoneOTPRequest(BaseModel):
    phone: str = Field(..., description="Phone number in E.164 format (+8619121327942)")
    purpose: str = Field(default="login", description="Purpose: login, register, reset_password")


class EmailOTPRequest(BaseModel):
    email: EmailStr
    purpose: str = Field(default="register", description="Purpose: register, reset_password, verify_email")


class VerifyOTPRequest(BaseModel):
    identifier: str = Field(..., description="Phone number or email")
    code: str = Field(..., min_length=4, max_length=10, description="OTP code")
    # Optional registration data
    password: Optional[str] = Field(None, description="User password (for registration)")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    city_id: Optional[str] = Field(None, description="City ID")
    role_type: Optional[str] = Field(None, description="User role: user, business, artist, organizer, vendor")


class OTPResponse(BaseModel):
    success: bool
    message: str
    expires_in: Optional[int] = 600  # seconds


class VerifyOTPResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None


# Helper functions
def normalize_phone(phone: str) -> str:
    """Normalize phone number to E.164 format"""
    # Remove spaces, dashes, and other non-numeric characters except +
    cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
    
    # If no country code, assume China (+86)
    if not cleaned.startswith('+'):
        if cleaned.startswith('86'):
            cleaned = '+' + cleaned
        else:
            cleaned = '+86' + cleaned.lstrip('0')
    
    return cleaned


def send_verify_code(identifier: str, channel: str) -> bool:
    """Send verification code using Twilio Verify or Alibaba Cloud SMS"""
    # Check if Alibaba Cloud SMS is enabled and configured
    if settings.ALIBABA_SMS_ENABLED:
        try:
            from services.alibaba_sms import send_otp_sms, is_configured
            if is_configured():
                # Generate OTP code locally for Alibaba Cloud
                import random
                otp_code = ''.join(random.choices('0123456789', k=6))
                
                # Store OTP in database before sending
                from database import SessionLocal
                from models import OTPCode
                from datetime import datetime, timedelta
                
                db = SessionLocal()
                try:
                    # Mark existing unused OTPs as used
                    existing_otps = db.query(OTPCode).filter(
                        OTPCode.identifier == identifier,
                        OTPCode.is_used == False,
                        OTPCode.expires_at > datetime.utcnow()
                    ).all()
                    for otp in existing_otps:
                        otp.is_used = True
                    
                    # Create new OTP record
                    otp_record = OTPCode(
                        identifier=identifier,
                        code=otp_code,
                        otp_type="sms",
                        purpose="login",
                        expires_at=datetime.utcnow() + timedelta(minutes=10),
                        is_used=False
                    )
                    db.add(otp_record)
                    db.commit()
                finally:
                    db.close()
                
                result = send_otp_sms(identifier, otp_code)
                print(f"Alibaba Cloud SMS sent: {result}")
                return result.get("success", False)
        except Exception as e:
            print(f"Alibaba Cloud SMS failed, falling back to Twilio: {e}")
    
    # Fallback to Twilio Verify
    try:
        from twilio.rest import Client
        
        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token = settings.TWILIO_AUTH_TOKEN
        service_sid = settings.TWILIO_VERIFY_SERVICE_SID
        
        if not all([account_sid, auth_token, service_sid]):
            raise Exception("Twilio credentials not configured")
        
        client = Client(account_sid, auth_token)
        
        verification = client.verify.v2.services(service_sid).verifications.create(
            to=identifier,
            channel=channel
        )
        
        print(f"Verification sent: {verification.sid} ({verification.status})")
        return True
        
    except Exception as e:
        print(f"Verification sending failed: {e}")
        raise e


def send_email_via_sendgrid(to_email: str, otp_code: str) -> bool:
    """Send verification code via SendGrid or Hostinger SMTP SSL fallback."""
    # 1. Try SendGrid if credentials are configured
    if getattr(settings, 'SENDGRID_API_KEY', None) and getattr(settings, 'SENDGRID_FROM_EMAIL', None):
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            
            api_key = settings.SENDGRID_API_KEY
            from_email = settings.SENDGRID_FROM_EMAIL
            subject = "Your Sound It Verification Code"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }}
                    .container {{ max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .header {{ background: linear-gradient(135deg, #d3da0c 0%, #a8cc00 100%); padding: 30px; text-align: center; }}
                    .header h1 {{ margin: 0; color: #020b00; font-size: 24px; font-weight: 800; }}
                    .content {{ padding: 40px 30px; text-align: center; }}
                    .otp-code {{ font-size: 44px; font-weight: bold; color: #020b00; letter-spacing: 10px; margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 2px dashed #d3da0c; }}
                    .message {{ color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0; }}
                    .footer {{ background: #f9f9f9; padding: 20px; text-align: center; color: #999; font-size: 12px; }}
                    .warning {{ color: #ff6b6b; font-size: 14px; margin-top: 20px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Sound It</h1>
                    </div>
                    <div class="content">
                        <h2>Verify Your Email</h2>
                        <p class="message">Use the verification code below to complete your login or registration:</p>
                        <div class="otp-code">{otp_code}</div>
                        <p class="message">This code will expire in <strong>10 minutes</strong>.</p>
                        <p class="warning">If you didn't request this code, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2026 Sound It Entertainment. All rights reserved.</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            message = Mail(
                from_email=from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            sg = SendGridAPIClient(api_key)
            response = sg.send(message)
            if response.status_code in [200, 201, 202]:
                print(f"SendGrid email sent: Status {response.status_code}")
                return True
        except Exception as e:
            print(f"SendGrid send failed, falling back to Hostinger SMTP: {e}")

    # 2. Hostinger SMTP SSL Delivery (Production live provider)
    try:
        from email_service import send_email, _email_wrapper, is_deliverable_email
        if not is_deliverable_email(to_email):
            print(f"[EMAIL OTP SKIPPED] Non-deliverable or dummy email: '{to_email}'")
            return False

        subject = "Your Sound It Verification Code"
        content_html = f"""
        <div style="text-align: center; padding: 10px 0;">
            <h2 style="color: #020b00; font-size: 22px; font-weight: 800; margin: 0 0 12px;">Verify Your Email</h2>
            <p style="color: #52525b; font-size: 15px; line-height: 1.5; margin: 0 0 24px;">Use the verification code below to complete your login or registration:</p>
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #020b00; margin: 24px auto; padding: 16px 24px; background: #f4f4f5; border: 2px dashed #d3da0c; border-radius: 12px; max-width: 260px; text-align: center;">
                {otp_code}
            </div>
            <p style="color: #71717a; font-size: 13px; margin: 20px 0 8px;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="color: #ef4444; font-size: 12px; margin: 0;">If you did not request this code, please ignore this email.</p>
        </div>
        """
        html_body = _email_wrapper(subject, content_html)
        sent = send_email(
            to_email=to_email,
            subject=subject,
            body=f"Your Sound It Verification Code is: {otp_code} (Valid for 10 minutes)",
            html_body=html_body
        )
        print(f"[SMTP OTP EMAIL] Sent to {to_email}: {sent}")
        return sent
    except Exception as e:
        print(f"SMTP OTP email sending failed: {e}")
        return False


def check_verify_code(identifier: str, code: str) -> bool:
    """Check verification code using Twilio Verify or Alibaba Cloud SMS (database-based)"""
    # For Alibaba Cloud SMS, verification is done via database OTP record
    # This is handled in the verify_otp endpoint
    
    # Fallback to Twilio Verify for SMS
    try:
        from twilio.rest import Client
        
        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token = settings.TWILIO_AUTH_TOKEN
        service_sid = settings.TWILIO_VERIFY_SERVICE_SID
        
        if not all([account_sid, auth_token, service_sid]):
            raise Exception("Twilio credentials not configured")
            
        client = Client(account_sid, auth_token)
        
        verification_check = client.verify.v2.services(service_sid).verification_checks.create(
            to=identifier,
            code=code
        )
        
        print(f"Verification check: {verification_check.status}")
        return verification_check.status == "approved"
        
    except Exception as e:
        print(f"Verification check failed: {e}")
        return False


# API Endpoints
@router.post("/sms/send", response_model=OTPResponse)
async def send_sms_otp(request: PhoneOTPRequest):
    """Send OTP via SMS using Twilio"""
    try:
        phone = normalize_phone(request.phone)
        
        # Send via Twilio Verify
        success = send_verify_code(phone, "sms")
        
        return OTPResponse(
            success=success,
            message="Verification code sent to your phone",
            expires_in=600
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {str(e)}")


@router.post("/email/send", response_model=OTPResponse)
async def send_email_otp(request: EmailOTPRequest):
    """Send OTP via Email using SendGrid"""
    try:
        from database import SessionLocal
        from models import OTPCode
        from datetime import datetime, timedelta
        import random
        
        email = request.email.lower().strip()
        
        # Generate OTP
        otp_code = ''.join(random.choices('0123456789', k=6))
        
        # Store OTP in database
        db = SessionLocal()
        try:
            # Mark existing unused OTPs as used
            existing_otps = db.query(OTPCode).filter(
                OTPCode.identifier == email,
                OTPCode.is_used == False,
                OTPCode.expires_at > datetime.utcnow()
            ).all()
            for otp in existing_otps:
                otp.is_used = True
            
            # Create new OTP record
            otp_record = OTPCode(
                identifier=email,
                code=otp_code,
                otp_type="email",
                purpose=request.purpose,
                expires_at=datetime.utcnow() + timedelta(minutes=10),
                is_used=False
            )
            db.add(otp_record)
            db.commit()
        finally:
            db.close()
        
        # Send via SendGrid or Hostinger SMTP
        email_sent = send_email_via_sendgrid(email, otp_code)
        
        print(f"[EMAIL OTP] To: {email}, Code: {otp_code}, Sent: {email_sent}")
        
        return OTPResponse(
            success=True,
            message="Verification code sent to your email",
            expires_in=600
        )
        
    except Exception as e:
        print(f"Email send failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/verify", response_model=VerifyOTPResponse)
async def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP code and login/register user with optional registration data"""
    try:
        from models import User, UserRole, UserStatus, OTPCode, City, OrganizerProfile, VendorProfile
        from auth import REDACTED_PLACEHOLDER as create_access_token, get_REDACTED_PLACEHOLDER_hash as get_password_hash
        from datetime import datetime
        
        identifier = request.identifier.lower().strip()
        
        # Determine if it's sms (phone) or email to normalize phone
        is_phone = '@' not in identifier
        if is_phone:
             identifier = normalize_phone(identifier)
        
        # First, try to verify via database (for SendGrid emails)
        is_valid = False
        
        # Check database for OTP
        otp_record = db.query(OTPCode).filter(
            OTPCode.identifier == identifier,
            OTPCode.code == request.code,
            OTPCode.is_used == False,
            OTPCode.expires_at > datetime.utcnow()
        ).first()
        
        if otp_record:
            is_valid = True
            otp_record.is_used = True
            db.commit()
            print(f"[VERIFY] Database OTP verified for {identifier}")
        else:
            # Try Twilio Verify for SMS
            if is_phone:
                is_valid = check_verify_code(identifier, request.code)
                print(f"[VERIFY] Twilio verification result: {is_valid}")
        
        if not is_valid:
            return VerifyOTPResponse(
                success=False,
                message="Invalid or expired verification code"
            )
        
        # Find or create user
        if is_phone:
            user = db.query(User).filter(User.phone == identifier).first()
        else:
            user = db.query(User).filter(User.email == identifier).first()
        
        if not user:
            # Create new user with registration data if provided
            # Map role - organizers are businesses
            role_mapping = {
                'user': UserRole.USER,
                'business': UserRole.BUSINESS,
                'artist': UserRole.ARTIST,
                'artist_dj': UserRole.ARTIST,
                'organizer': UserRole.BUSINESS,  # Organizers are businesses
                'vendor': UserRole.VENDOR
            }
            user_role = role_mapping.get(request.role_type, UserRole.USER)
            
            # Map city_id to City enum dynamically
            preferred_city = None
            if request.city_id:
                city_value = request.city_id.lower().replace(' ', '_').replace('-', '_')
                try:
                    preferred_city = City(city_value)
                except ValueError:
                    preferred_city = None
            
            user = User(
                phone=identifier if is_phone else None,
                email=identifier if not is_phone else None,
                first_name=request.first_name,
                last_name=request.last_name,
                password_hash=get_password_hash(request.password) if request.password else None,
                preferred_city=preferred_city,
                role=user_role,
                status=UserStatus.ACTIVE,
                is_verified=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create profile based on role
            otp_full_name = f"{(request.first_name or '').strip()} {(getattr(request, 'last_name', '') or '').strip()}".strip()
            if request.role_type == 'artist' or request.role_type == 'artist_dj':
                from models import ArtistProfile
                artist = ArtistProfile(
                    user_id=user.id,
                    stage_name=otp_full_name or "Artist",
                    artist_type="DJ",
                    city=preferred_city,
                    is_verified=False
                )
                db.add(artist)
                db.commit()
            elif request.role_type == 'organizer' or request.role_type == 'business':
                # Create business profile (unified business/organizer role)
                from models import BusinessProfile
                business = BusinessProfile(
                    user_id=user.id,
                    business_name=otp_full_name or "Business",
                    city=preferred_city,
                    is_verified=False
                )
                db.add(business)
                db.commit()
                db.refresh(business)
                
                # Also create an organizer profile linked to the business
                organizer = OrganizerProfile(
                    user_id=user.id,
                    business_profile_id=business.id,
                    organization_name=business.business_name,
                    city=preferred_city,
                    is_verified=False
                )
                db.add(organizer)
                db.commit()
            elif request.role_type == 'vendor':
                # Create vendor profile
                vendor = VendorProfile(
                    user_id=user.id,
                    business_name=otp_full_name or "Vendor",
                    is_verified=False
                )
                db.add(vendor)
                db.commit()
            
            # Create 30-day free trial for non-user roles
            if user_role in [UserRole.BUSINESS, UserRole.ORGANIZER, UserRole.ARTIST, UserRole.VENDOR]:
                try:
                    from services.subscription_service import SubscriptionService
                    SubscriptionService.create_trial_subscription(db, user.id, user_role)
                except Exception:
                    pass
        else:
            # User exists, update with registration data if provided
            if request.password and not user.password_hash:
                user.password_hash = get_password_hash(request.password)
            if request.first_name:
                user.first_name = request.first_name
            if request.last_name:
                user.last_name = request.last_name
            if request.city_id:
                city_value = request.city_id.lower().replace(' ', '_').replace('-', '_')
                try:
                    user.preferred_city = City(city_value)
                except ValueError:
                    user.preferred_city = None
            db.commit()
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        # Generate JWT token
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return VerifyOTPResponse(
            success=True,
            message="Verification successful",
            token=access_token
        )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/sms/resend", response_model=OTPResponse)
async def resend_sms_otp(request: PhoneOTPRequest):
    """Resend SMS OTP"""
    return await send_sms_otp(request)


@router.post("/email/resend", response_model=OTPResponse)
async def resend_email_otp(request: EmailOTPRequest):
    """Resend Email OTP"""
    return await send_email_otp(request)
