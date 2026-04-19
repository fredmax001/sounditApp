# Production Deployment Checklist
## Sound It Platform - Security Hardened Release

**Version:** 2.0.0-secure  
**Date:** 2026-04-08  
**Status:** [RED] CRITICAL SECURITY UPDATES REQUIRED

---

## [WARN] PRE-DEPLOYMENT CRITICAL ACTIONS

### 1. Credential Rotation (MUST DO - Before ANY Deployment)

- [ ] **Twilio Credentials**
  - [ ] Rotate Account SID at https://www.twilio.com/console
  - [ ] Rotate Auth Token
  - [ ] Update Verify Service SID
  - [ ] Test SMS functionality after rotation

- [ ] **SendGrid API Key**
  - [ ] Generate new API key at https://app.sendgrid.com/settings/api_keys
  - [ ] Delete old exposed key
  - [ ] Test email sending

- [ ] **JWT Secret**
  ```bash
  # Generate cryptographically secure secret
  openssl rand -hex 64
  ```
  - [ ] Set as environment variable `JWT_SECRET`
  - [ ] Minimum 64 characters

- [ ] **Application Secret Key**
  ```bash
  openssl rand -hex 64
  ```
  - [ ] Set as environment variable `SECRET_KEY`

### 2. Git History Cleanup (MUST DO)

```bash
# Install BFG Repo-Cleaner
brew install bfg

# Create a bare clone
git clone --mirror git@github.com:yourusername/soundit.git

# Remove sensitive files from history
bfg --delete-files .env.production soundit.git
bfg --delete-files .env soundit.git

# Clean up
 cd soundit.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history!)
git push --force

# Clean up local clone
rm -rf soundit.git
```

- [ ] Verify secrets no longer in git history: `git log --all --full-history -- .env.production`

### 3. Environment Configuration

- [ ] **Remove .env.production from repository**
  ```bash
  git rm .env.production
  git commit -m "Remove production env file from repo"
  echo ".env.production" >> .gitignore
  ```

- [ ] **Set environment variables on server**
  ```bash
  # Add to /etc/environment or use your secrets manager
  export JWT_SECRET="your-generated-secret"
  export SECRET_KEY="your-generated-secret"
  export SENDGRID_API_KEY="your-new-api-key"
  export TWILIO_AUTH_TOKEN="your-new-auth-token"
  export TWILIO_ACCOUNT_SID="your-account-sid"
  export TWILIO_VERIFY_SERVICE_SID="your-verify-sid"
  export DATABASE_URL="postgresql://..."
  export DEBUG="False"
  ```

---

## [FIX] DEPLOYMENT STEPS

### Step 1: Pre-Deployment Testing

- [ ] Run unit tests
  ```bash
  pytest tests/test_security_fixes.py -v
  ```

- [ ] Run full test suite
  ```bash
  pytest tests/ -v --tb=short
  ```

- [ ] Check for syntax errors
  ```bash
  python -m py_compile main.py main_production.py main_secure.py
  ```

### Step 2: Database Preparation

- [ ] Backup production database
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] Verify database migrations (if any)
  ```bash
  # If using Alembic
  alembic upgrade head
  
  # Or verify current schema
  psql $DATABASE_URL -c "\dt"
  ```

- [ ] Test database connectivity
  ```bash
  python -c "from database import engine; print(engine.connect())"
  ```

### Step 3: Infrastructure Setup

- [ ] **Redis (for rate limiting)**
  - [ ] Install Redis: `sudo apt install redis-server`
  - [ ] Start Redis: `sudo systemctl start redis`
  - [ ] Enable auto-start: `sudo systemctl enable redis`
  - [ ] Test connection: `redis-cli ping` (should return PONG)
  - [ ] Set Redis URL in environment: `REDIS_URL=redis://localhost:6379/0`

- [ ] **Nginx Configuration**
  ```nginx
  # /etc/nginx/sites-available/soundit
  server {
      listen 80;
      server_name sounditent.com www.sounditent.com;
      return 301 https://$server_name$request_uri;
  }
  
  server {
      listen 443 ssl http2;
      server_name sounditent.com www.sounditent.com;
      
      ssl_certificate /path/to/cert.pem;
      ssl_certificate_key /path/to/key.pem;
      ssl_protocols TLSv1.2 TLSv1.3;
      ssl_ciphers HIGH:!aNULL:!MD5;
      
      # Security headers
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
      
      location / {
          proxy_pass http://127.0.0.1:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
      
      location /static {
          alias /path/to/static;
          expires 1y;
          add_header Cache-Control "public, immutable";
      }
  }
  ```
  - [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/soundit /etc/nginx/sites-enabled/`
  - [ ] Test config: `sudo nginx -t`
  - [ ] Reload nginx: `sudo systemctl reload nginx`

### Step 4: Application Deployment

- [ ] **Create virtual environment**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

- [ ] **Install dependencies**
  ```bash
  pip install --upgrade pip
  pip install -r requirements.txt
  ```

- [ ] **Verify critical imports**
  ```bash
  python -c "
  from main import app
  from main_secure import app as secure_app
  from security.rate_limiter import limiter
  from security.enhanced_auth import auth_manager
  print('All imports successful')
  "
  ```

- [ ] **Run database initialization**
  ```bash
  python -c "from database import init_db; init_db()"
  ```

- [ ] **Start application with systemd**
  ```ini
  # /etc/systemd/system/soundit.service
  [Unit]
  Description=Sound It API
  After=network.target
  
  [Service]
  User=www-data
  Group=www-data
  WorkingDirectory=/var/www/soundit
  Environment="PATH=/var/www/soundit/venv/bin"
  EnvironmentFile=/var/www/soundit/.env
  ExecStart=/var/www/soundit/venv/bin/uvicorn main_secure:app --host 127.0.0.1 --port 8000 --workers 4
  Restart=always
  RestartSec=3
  
  [Install]
  WantedBy=multi-user.target
  ```
  
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable soundit
  sudo systemctl start soundit
  ```

### Step 5: Post-Deployment Verification

- [ ] **Health check**
  ```bash
  curl https://api.sounditent.com/health
  # Should return: {"status": "healthy"}
  ```

- [ ] **Test authentication**
  ```bash
  # Test login rate limiting (should allow 5, then block)
  for i in {1..7}; do
    curl -X POST https://api.sounditent.com/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email": "test@test.com", "password": "wrong"}'
  done
  # 6th+ request should return 429 Too Many Requests
  ```

- [ ] **Test password strength**
  ```bash
  curl -X POST https://api.sounditent.com/api/v1/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email": "test@test.com", "password": "weak", "first_name": "Test", "last_name": "User", "role": "user"}'
  # Should return 400 with password requirements
  ```

- [ ] **Test path traversal protection**
  ```bash
  # This should be blocked
  curl -X DELETE https://api.sounditent.com/api/v1/media/delete \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"url": "https://api.sounditent.com/static/uploads/../../../etc/passwd"}'
  # Should return 403 Forbidden
  ```

- [ ] **Test privilege escalation protection**
  ```bash
  # As admin, try to make yourself super_admin
  curl -X PUT https://api.sounditent.com/api/v1/admin/users/YOUR_USER_ID \
    -H "Authorization: Bearer ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"role": "super_admin"}'
  # Should return 403 Forbidden
  ```

- [ ] **Verify security headers**
  ```bash
  curl -I https://api.sounditent.com/
  # Should see: X-Frame-Options, X-Content-Type-Options, etc.
  ```

---

## [SEARCH] MONITORING & LOGGING

### Application Logs

- [ ] Configure log rotation
  ```bash
  # /etc/logrotate.d/soundit
  /var/log/soundit/*.log {
      daily
      rotate 30
      compress
      delaycompress
      missingok
      notifempty
      create 0640 www-data www-data
      sharedscripts
      postrotate
          systemctl reload soundit
      endscript
  }
  ```

- [ ] Set up centralized logging (optional)
  - [ ] Configure ELK stack or similar
  - [ ] Set up log aggregation

### Monitoring Alerts

- [ ] Set up alerts for:
  - [ ] High rate of 401/403 errors (possible attacks)
  - [ ] Rate limiting triggered frequently
  - [ ] Database connection failures
  - [ ] Unusual payment patterns
  - [ ] Failed login attempts > 100/hour

---

## [TEST] TESTING SCENARIOS

### Security Testing

- [ ] **Brute force protection**
  - Try 10 incorrect logins in 1 minute
  - Verify account temporarily locks

- [ ] **SQL injection attempts**
  - Search for: `test%' OR '1'='1`
  - Should be sanitized and return no results

- [ ] **XSS attempts**
  - Try to inject `<script>alert('xss')</script>` in user input
  - Should be escaped or rejected

- [ ] **CSRF protection**
  - Test cross-origin requests from unauthorized domains
  - Should be blocked by CORS

- [ ] **File upload restrictions**
  - Try uploading `.exe`, `.php`, `.sh` files
  - Should be rejected
  - Try uploading with double extension: `file.jpg.php`
  - Should be rejected

### Functional Testing

- [ ] **Complete purchase flow**
  - Create order → Pay → Receive tickets → Validate
  - Verify no race conditions

- [ ] **Admin functions**
  - User management
  - Event moderation
  - Payment verification

- [ ] **File operations**
  - Upload image
  - List files
  - Delete file (verify path traversal protection)

---

## [ALERT] ROLLBACK PLAN

If issues are detected:

1. **Immediate rollback**
   ```bash
   sudo systemctl stop soundit
   # Restore previous version from backup
   git checkout previous-release-tag
   sudo systemctl start soundit
   ```

2. **Database rollback** (if needed)
   ```bash
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Notification**
   - [ ] Notify team of rollback
   - [ ] Document issues encountered
   - [ ] Schedule fix and redeploy

---

## [LIST] SIGN-OFF

**Deployment Approved By:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Security Lead | | | |
| DevOps Lead | | | |
| Product Owner | | | |

**Post-Deployment Verification:**

- [ ] All smoke tests passed
- [ ] Security tests passed
- [ ] Performance within acceptable limits
- [ ] No critical errors in logs
- [ ] Monitoring dashboards active

---

## [PHONE] EMERGENCY CONTACTS

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call Engineer | | | |
| Security Team | | | |
| Database Admin | | | |
| Infrastructure | | | |

---

## [NOTE] NOTES

- This deployment includes critical security fixes
- Do NOT skip credential rotation
- Monitor closely for first 24 hours
- Have rollback plan ready

---

*Deployment Checklist v2.0.0-secure*  
*Generated: 2026-04-08*
