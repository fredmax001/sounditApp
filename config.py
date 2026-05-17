from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Sound It API"
    DEBUG: bool = False
    SECRET_KEY: str = ""  # Must be set via environment variable in production
    BASE_URL: str = "https://sounditent.com"
    CN_BASE_URL: str = "https://sounditent.cn"  # China domain
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/soundit"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    JWT_SECRET: str = ""  # Must be set via environment variable in production
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # OTP
    OTP_EXPIRATION_MINUTES: int = 5
    
    # Twilio (SMS)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""  # Your Twilio phone number
    TWILIO_VERIFY_SERVICE_SID: str = ""  # Twilio Verify Service SID
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "https://sounditent.com/auth/google/callback"
    
    # SMTP (Email)
    SMTP_HOST: str = "smtp.hostinger.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = ""  # e.g., otp@sounditent.com
    SMTP_PASS: str = ""  # Email password
    SMTP_FROM: str = ""  # e.g., "Sound It <otp@sounditent.com>"
    
    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    
    # Yoopay - Payment Link Configuration
    # Your Yoopay payment link: https://yoopay.cn/tc/603316601
    YOOPAY_PAYMENT_URL: str = "https://yoopay.cn/tc/603316601"
    YOOPAY_SELLER_EMAIL: str = ""  # Your Yoopay seller email
    YOOPAY_API_KEY: str = ""  # Optional: for API verification
    YOOPAY_COMPANY_ID: str = "603316601"  # Extracted from your payment URL
    
    # WeChat
    WECHAT_APP_ID: str = ""
    WECHAT_APP_SECRET: str = ""
    WECHAT_MCH_ID: str = ""
    WECHAT_API_KEY: str = ""
    
    # AWS S3 (for file uploads)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = "sound-it-uploads"
    AWS_REGION: str = "us-east-1"
    
    # Alibaba Cloud (SMS / API Gateway)
    ALIBABA_APP_KEY: str = ""
    ALIBABA_APP_SECRET: str = ""
    ALIBABA_APP_CODE: str = ""
    ALIBABA_SMS_SIGN_NAME: str = "SoundIt"  # SMS signature name registered in Alibaba Cloud
    ALIBABA_SMS_TEMPLATE_CODE: str = ""  # OTP template code
    ALIBABA_SMS_ENABLED: bool = False  # Toggle to use Alibaba Cloud instead of Twilio
    ALIBABA_MARKETPLACE_ENDPOINT: str = "https://kzsms.market.alicloudapi.com/api/sms/send"  # Marketplace SMS endpoint
    
    # Alibaba Cloud SMS Template Codes (register each template in Alibaba Cloud console)
    ALIBABA_SMS_TEMPLATE_CODE_TICKET_APPROVED: str = ""   # e.g. SMS_12345678
    ALIBABA_SMS_TEMPLATE_CODE_TICKET_REJECTED: str = ""   # e.g. SMS_12345679
    ALIBABA_SMS_TEMPLATE_CODE_WELCOME: str = ""           # e.g. SMS_12345680
    ALIBABA_SMS_TEMPLATE_CODE_EVENT_REMINDER: str = ""    # e.g. SMS_12345681
    

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
