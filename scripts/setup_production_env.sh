#!/bin/bash
# Production Environment Setup Script
# ===================================
# Generates secure secrets and sets up production environment

set -e

echo "[TOOL] Sound It - Production Environment Setup"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if .env.production exists
if [ -f ".env.production" ]; then
    echo -e "${YELLOW}[WARN]  WARNING: .env.production already exists!${NC}"
    read -p "Do you want to overwrite it? (yes/no): " OVERWRITE
    if [ "$OVERWRITE" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
    cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backup created."
fi

echo ""
echo "[LOCK] Generating secure secrets..."
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -hex 64)
SECRET_KEY=$(openssl rand -hex 64)

echo -e "${GREEN}[OK] Secrets generated${NC}"
echo ""

# Prompt for external service credentials
echo "[NOTE] Enter your production credentials:"
echo "(Leave blank if not using the service)"
echo ""

read -p "SendGrid API Key: " SENDGRID_API_KEY
read -p "Twilio Account SID: " TWILIO_ACCOUNT_SID
read -p "Twilio Auth Token: " TWILIO_AUTH_TOKEN
read -p "Twilio Verify Service SID: " TWILIO_VERIFY_SERVICE_SID
read -p "Twilio Phone Number: " TWILIO_PHONE_NUMBER
read -p "Database URL (postgresql://...): " DATABASE_URL
read -p "Redis URL (redis://localhost:6379/0): " REDIS_URL

# Default Redis URL if not provided
REDIS_URL=${REDIS_URL:-"redis://localhost:6379/0"}

echo ""
echo "[SAVE] Creating .env.production file..."

cat > .env.production << EOF
# Sound It Backend - Production Environment
# Generated: $(date)
# ============================================

# App Settings
APP_NAME="Sound It API"
DEBUG=False
SECRET_KEY="$SECRET_KEY"

# Database - PostgreSQL (Production)
DATABASE_URL="${DATABASE_URL:-postgresql://user:pass@localhost:5432/soundit_prod}"

# Redis
REDIS_URL="$REDIS_URL"

# JWT Authentication
JWT_SECRET="$JWT_SECRET"
JWT_ALGORITHM="HS256"
JWT_EXPIRATION_HOURS=24

# OTP Settings
OTP_EXPIRATION_MINUTES=5

# SendGrid (Email)
SENDGRID_API_KEY="$SENDGRID_API_KEY"
SENDGRID_FROM_EMAIL="noreply@sounditent.com"

# Twilio (SMS & Verify)
TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN"
TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER"
TWILIO_VERIFY_SERVICE_SID="$TWILIO_VERIFY_SERVICE_SID"

# Yoopay (Chinese Payment Gateway)
YOOPAY_API_KEY=""
YOOPAY_SELLER_EMAIL=""
YOOPAY_PAYMENT_URL="https://yoopay.cn/tc/603316601"
YOOPAY_COMPANY_ID="20054261767892510057"
YOOPAY_QR_URL="https://yoopay.cn/payment/qr/20054261767892510057"

# Stripe (International Payments)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PUBLISHABLE_KEY=""

# WeChat Pay
WECHAT_APP_ID=""
WECHAT_APP_SECRET=""
WECHAT_MCH_ID=""
WECHAT_API_KEY=""

# AWS S3 (File Uploads)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET="sound-it-uploads"
AWS_REGION="us-east-1"
AWS_S3_ENDPOINT="https://s3.us-east-1.amazonaws.com"
AWS_CLOUDFRONT_URL=""

# hearthis.at (DJ Mixes Integration)
HEARTHIS_API_KEY=""
HEARTHIS_API_URL="https://hearthis.at/api/v1/"

# Server Configuration
ALLOWED_HOSTS="sounditent.com,www.sounditent.com,api.sounditent.com"
CORS_ORIGINS="https://sounditent.com,https://www.sounditent.com"
EOF

echo ""
echo -e "${GREEN}[OK] .env.production created successfully!${NC}"
echo ""

# Set restrictive permissions
chmod 600 .env.production

echo "[LOCK] File permissions set to 600 (owner read/write only)"
echo ""

# Generate add to .gitignore
echo "[NOTE] Adding to .gitignore..."
if ! grep -q "^\.env\.production$" .gitignore 2>/dev/null; then
    echo ".env.production" >> .gitignore
    echo ".env.production added to .gitignore"
fi

if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    echo ".env added to .gitignore"
fi

echo ""
echo "==========================================="
echo "[DONE] Production environment setup complete!"
echo "==========================================="
echo ""
echo "[LIST] NEXT STEPS:"
echo ""
echo "1. Review .env.production and fill in any missing values"
echo ""
echo "2. Set up your production server:"
echo "   - Install PostgreSQL and create database"
echo "   - Install and start Redis"
echo "   - Configure Nginx (see DEPLOYMENT_CHECKLIST.md)"
echo ""
echo "3. Deploy environment variables to server:"
echo "   - Copy .env.production to your server"
echo "   - Or use a secrets manager (AWS Secrets Manager, etc.)"
echo ""
echo "4. Run database migrations:"
echo "   python -c 'from database import init_db; init_db()'"
echo ""
echo "5. Start the application:"
echo "   uvicorn main_secure:app --host 0.0.0.0 --port 8000 --workers 4"
echo ""
echo "[WARN]  IMPORTANT: Never commit .env.production to git!"
echo ""
echo "[LINK] See DEPLOYMENT_CHECKLIST.md for full deployment instructions"
echo ""
