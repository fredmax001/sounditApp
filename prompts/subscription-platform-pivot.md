# Subscription Platform Pivot - Full Specification

**Status**: Implementation Complete [OK]  
**Last Updated**: 2026-04-10  
**Priority**: HIGH

---

## Overview

Pivot Sound It from commission-based to SaaS subscription model. Users pay monthly for platform access, visibility, and features.

---

## 1. USER TYPES & TIERS

### 1.1 Business (Event Organizers)

**Basic Plan - ¥100/month**
- 5 events per month limit
- Basic event listing (no featured placement)
- Manual ticket approval system
- Basic dashboard

**Pro Plan - ¥200/month**
- Unlimited events
- Featured in category listings
- Basic analytics
- Medium visibility boost

**Premium Plan - ¥400/month**
- Homepage featured events
- Push notifications to users
- Advanced analytics
- Custom event branding
- Highest visibility ranking
- Verified badge

### 1.2 Vendors

**Basic Plan - ¥80/month**
- Create profile
- List services/products
- Low priority search

**Pro Plan - ¥150/month**
- Featured listings
- Priority search ranking
- Booking notifications

**Premium Plan - ¥300/month**
- Homepage spotlight
- Verified badge
- Unlimited portfolio
- Analytics

### 1.3 Artists

**Basic Plan - ¥50/month**
- Create profile
- Limited media uploads
- Low priority search

**Pro Plan - ¥100/month**
- Featured listings
- Booking request system
- Social links integration

**Premium Plan - ¥200/month**
- Homepage spotlight
- Verified badge
- Unlimited media
- Priority booking

---

## 2. DATABASE SCHEMA

### 2.1 subscription_tiers (Configuration)
```sql
CREATE TABLE subscription_tiers (
  id SERIAL PRIMARY KEY,
  user_type VARCHAR(20) NOT NULL, -- business, vendor, artist
  tier_name VARCHAR(20) NOT NULL, -- basic, pro, premium
  price_cny INTEGER NOT NULL,
  features JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 user_subscriptions (Active Subscriptions)
```sql
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tier_id INTEGER REFERENCES subscription_tiers(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, expired
  payment_reference VARCHAR(100),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  activated_by INTEGER REFERENCES users(id), -- admin who approved
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 verification_badges
```sql
CREATE TABLE verification_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  badge_type VARCHAR(20) DEFAULT 'premium',
  issued_by INTEGER REFERENCES users(id),
  issued_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

---

## 3. PAYMENT FLOW (YOOPAY)

### 3.1 User Flow
1. User selects plan
2. System provides YOOPAY mobile link: https://yoopay.cn/tc/603316601
3. System provides YOOPAY QR code: /static/yoopay_qr.jpg
4. User completes YOOPAY payment
5. User clicks "I've Paid"
6. Status = "pending"
7. Admin activates subscription
8. Status = "active", Start_date = now, End_date = +30 days

### 3.2 YOOPAY Integration (UPDATED)
```typescript
// Updated to use specific YOOPAY details
const paymentDetails = {
  mobile_link: "https://yoopay.cn/tc/603316601",
  qr_code_url: "/static/yoopay_qr.jpg",
  reference: `SUB-${subscriptionId}-${uuid}`,
  requires_admin_activation: true
};
```

---

## 4. FEATURE LOCK SYSTEM

### 4.1 Implementation Pattern
```typescript
// Check subscription before showing feature
const canAccess = await checkFeatureAccess(userId, featureName);

if (!canAccess) {
  return (
    <LockedFeature 
      icon="[LOCK]"
      message="This feature requires Pro or Premium"
      upgradeUrl="/subscribe"
    />
  );
}
```

### 4.2 Locked Features by Tier

**Basic Locks:**
- Create event > 5/month (show [LOCK] with upgrade)
- Featured listing
- Analytics
- Custom branding
- Homepage placement

**Pro/Premium Access:**
- All features unlocked based on tier

---

## 5. VERIFICATION BADGE

### 5.1 Display Rules
- Gold checkmark badge (similar to Twitter/Instagram)
- Show on: Profile, Event cards, Search results
- ONLY for Premium subscribers
- Badge removed when subscription expires

### 5.2 Component Structure
```typescript
interface VerificationBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Usage
<VerificationBadge size="md" />
```

---

## 6. TICKET VERIFICATION FLOW

### 6.1 Organizer Flow
1. Create event with "Enable Ticket Sales"
2. Upload WeChat Pay QR
3. Upload Alipay QR (optional)
4. Share event
5. Receive ticket orders
6. Verify payment screenshots
7. Approve/Reject orders
8. Approved orders get QR code

### 6.2 Attendee Flow
1. View event
2. Click "Buy Ticket"
3. See organizer's QR codes
4. Pay directly to organizer
5. Upload payment screenshot
6. Wait for approval
7. Receive entry QR code
8. Show QR at event entry

---

## 7. API ENDPOINTS

### 7.1 Subscriptions
```
GET  /api/subscriptions/plans              # List all plans
GET  /api/subscriptions/my                 # Get current subscription
POST /api/subscriptions/subscribe          # Create subscription
GET  /api/subscriptions/payment/:id        # Get YOOPAY QR
POST /api/subscriptions/payment/:id/confirm # Confirm payment

# Admin only
GET  /api/admin/subscriptions/pending      # List pending
POST /api/admin/subscriptions/:id/approve  # Approve subscription
POST /api/admin/subscriptions/:id/reject   # Reject subscription
```

### 7.2 Table Reservations (Pro/Premium Only)
```
GET    /api/tables/business/packages       # List my packages
POST   /api/tables/business/packages       # Create package
PUT    /api/tables/business/packages/:id   # Update package
DELETE /api/tables/business/packages/:id   # Delete package
GET    /api/tables/business/orders         # List orders
POST   /api/tables/business/orders/:id/approve
POST   /api/tables/business/orders/:id/reject

# Public
GET /api/tables/events/:id/packages        # List event packages
POST /api/tables/packages/:id/book         # Book table
```

### 7.3 Ticketing
```
POST /api/ticketing/events/:id/payment-qr  # Upload QR
GET  /api/ticketing/events/:id/buy         # Get payment info
POST /api/ticketing/events/:id/order       # Create order
GET  /api/ticketing/my-tickets             # My tickets

# Organizer
GET  /api/ticketing/organizer/orders
POST /api/ticketing/organizer/orders/:id/approve
POST /api/ticketing/organizer/orders/:id/reject
POST /api/ticketing/organizer/validate-ticket
```

---

## 8. FRONTEND ROUTES

### 8.1 Subscription
- `/subscriptions` - Plan selection
- `/admin/subscriptions` - Admin management

### 8.2 Business Dashboard
- `/dashboard/business/tables` - Table reservations

### 8.3 Event Pages
- Event detail shows table packages (if available)
- Ticket purchase flow

---

## 9. IMPLEMENTATION NOTES

### 9.1 Access Control
All subscription-locked features MUST:
1. Check subscription status on backend
2. Show [LOCK] icon with upgrade prompt on frontend
3. Never just hide - always explain why locked

### 9.2 Testing Checklist
- [ ] Basic user sees locks on Pro features
- [ ] Pro/Premium users can access all features
- [ ] Payment flow works end-to-end
- [ ] Admin approval activates subscription
- [ ] Badge appears for Premium, hides when expired
- [ ] Table reservations only for Pro/Premium Business

### 9.3 Security
- Validate all image uploads (file type, size)
- Prevent duplicate submissions
- Protect admin routes
- Role-based access control

---

## 10. NEXT STEPS (For Future Agents)

### 10.1 Pending Features
- [ ] Social Media Promotion Queue
- [ ] Email notifications for subscription events
- [ ] Push notifications for mobile
- [ ] Advanced analytics dashboard

### 10.2 Known Limitations
- YOOPAY integration uses specific company account (https://yoopay.cn/tc/603316601)
- All subscriptions require admin activation
- Email notifications not implemented
- No mobile app yet

---

**Created**: 2026-04-10  
**Last Agent**: AI Assistant  
**Status**: Core implementation complete, ready for testing
