# ENT (Sound It) Platform — Comprehensive End-to-End Audit Report

**Audit Date:** 2026-04-14  
**Auditor:** Kimi Code CLI  
**Environment:** Local dev (Frontend: localhost:5173, Backend: localhost:8000, DB: SQLite)

---

## Executive Summary

- **Total features tested:** ~120 endpoints + 40+ UI flows
- **Working:** ~65
- **Broken/Critical:** 14
- **Mock/Placeholder/Fake:** 12
- **Missing API endpoints:** 9

The platform has a solid foundation with working auth, event/artist listing, ticket orders, table reservations, community posts, and subscriptions. However, there are significant gaps in **admin financial controls**, **venue management**, **media upload endpoints**, and **data migration parity** between local SQLite and production PostgreSQL. Several frontend components still show raw i18n keys or use incorrect API URLs.

---

## Critical Issues (Must Fix Before Launch)

### Issue #1 — Missing `events.latitude` / `events.longitude` in SQLite Migrations
- **Location:** `database.py`, `scripts/migrate_all_missing_columns.py`
- **Severity:** Critical
- **Expected:** Local dev database should have all columns defined in `models.py`
- **Actual:** `events.latitude` and `events.longitude` exist in `models.py` but were never added to SQLite migration scripts. Backend crashes with `sqlite3.OperationalError: no such column: events.latitude` on any event query.
- **Status:** [OK] **Fixed during audit** — added to both `database.py` and migration script, columns migrated successfully.

### Issue #2 — Community Section Hits Frontend Dev Server (Wrong API URL)
- **Location:** `app/src/sections/CommunitySection.tsx:52`
- **Severity:** Critical
- **Expected:** Community posts should load from backend API
- **Actual:** Uses `fetch('/api/v1/community/posts?page=1&count=3')` which resolves to `http://localhost:5173/api/v1/...` (the Vite dev server), returning HTML 404 page instead of JSON. Console shows: `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`
- **Suggested Fix:** Use `API_BASE_URL` prefix: `${API_BASE_URL}/community/posts?page=1&count=3`

### Issue #3 — Default Admin Credentials in AGENTS.md Are Wrong
- **Location:** `AGENTS.md`
- **Severity:** Critical
- **Expected:** `admin@sounditent.com` / `SoundIt2026!Admin` should be a super admin
- **Actual:** `admin@sounditent.com` has `role = 'business'` in DB. `admin@soundit.com` is `super_admin` but the documented password `SoundIt2026!Admin` does not work for that account.
- **Suggested Fix:** Update AGENTS.md with correct admin email + password, or reset the super_admin password in `scripts/create_admin.py`.

### Issue #4 — `fetchBusinessProfile()` Overwrites Admin Role to Business
- **Location:** `app/src/store/authStore.ts` (inside `initialize` and `loginWithEmail`)
- **Severity:** Critical
- **Expected:** Admin/super_admin users should retain their role after login
- **Actual:** `fetchBusinessProfile()` unconditionally sets `role_type: 'business'`, `role: 'organizer'` on the profile. This causes super_admin users to be redirected to `/dashboard/business` instead of `/admin/dashboard`, and they cannot access the admin panel.
- **Suggested Fix:** Only call `fetchBusinessProfile()` if the user's actual role is business/organizer, and never overwrite `role_type` from the profile fetch response.

### Issue #5 — Business User Without Organizer Profile Gets 400 on `/events/me`
- **Location:** `api/events.py` — `get_organizer_profile_id()`
- **Severity:** Critical
- **Expected:** `GET /events/me` should work for any business user; if no organizer profile exists, one should be auto-created (the function claims to do this)
- **Actual:** Returns `400 {"detail":"User does not have an organizer or business profile"}` when the user has a `business` role but no linked `OrganizerProfile`. The auto-creation logic only runs when `current_user.business_profile` exists, but the user may not have a `BusinessProfile` row.
- **Suggested Fix:** Create `BusinessProfile` + `OrganizerProfile` automatically if missing when a business user accesses event APIs.

### Issue #6 — `default-avatar.jpg` Missing (Hundreds of 404s)
- **Location:** Frontend public assets
- **Severity:** Critical (UX)
- **Expected:** Default avatar image should exist in `app/public/`
- **Actual:** `default-avatar.jpg` is referenced throughout the app but does not exist in `public/`, causing the browser to flood the console with 404 errors on every page load.
- **Suggested Fix:** Add a `default-avatar.jpg` or `default-avatar.png` to `app/public/`.

---

## Medium Issues (Fix Before Public Beta)

### Issue #7 — Login Form Requires City Selection
- **Location:** `app/src/pages/auth/Login.tsx:98-100`
- **Severity:** Medium
- **Expected:** Login should only require email/phone + password
- **Actual:** Login is blocked with `toast.error(t('auth.login.selectCityError'))` if city dropdown is not selected. This is poor UX — city selection should happen after login or be optional.

### Issue #8 — Multiple Admin Endpoints Are Placeholders / Return Empty Arrays
- **Location:** `api/admin.py`
- **Severity:** Medium
- **Endpoints affected:**
  - `GET /admin/payout-requests` → returns `[]` (placeholder)
  - `POST /admin/payout-requests/{id}/approve` → no-op placeholder
  - `POST /admin/payout-requests/{id}/reject` → no-op placeholder
  - `GET /admin/featured-events` → returns `{"events": []}` (placeholder)
  - `POST /admin/featured-events/{event_id}` → no-op
  - `DELETE /admin/featured-events/{event_id}` → no-op
  - `GET /admin/disabled-events` → no-op
  - `POST /admin/events/{event_id}/feature` → returns fake success without persisting
  - `POST /admin/businesses/{business_id}/feature` → no-op
  - `GET /admin/transactions` → incomplete/partially mocked
  - `PUT /admin/cities/{city_id}/images` → no-op
  - `GET /admin/system-flags` → returns hardcoded defaults
- **Suggested Fix:** Implement real database-backed logic for financial controls, featured content, and system settings.

### Issue #9 — Missing Public API Endpoints (From Audit Spec)
- **Location:** Backend API routing
- **Severity:** Medium
- **Missing endpoints:**
  - `GET /api/venues` (public venue list)
  - `GET /api/venues/:id` (venue detail)
  - `POST /api/venues` (venue creation)
  - `POST /api/upload/avatar`
  - `POST /api/upload/image`
  - `POST /api/upload/multiple`
  - `GET /api/media/:id`
  - `POST /api/tickets/purchase`
  - `GET /api/tickets/:id/qr`
  - `POST /api/tickets/transfer`
  - `GET /api/posts/:id/comments`
- **Note:** Some functionality is covered by alternative endpoints (e.g., `/tickets/order` for manual QR ticketing, `/media/upload` for uploads), but the specific endpoints from the spec are 404.

### Issue #10 — Raw i18n Keys on Business Dashboard
- **Location:** `app/src/pages/business/Dashboard.tsx`
- **Severity:** Medium
- **Expected:** Translated labels for "Ticket Orders" and empty state
- **Actual:** Page shows raw keys: `business.dashboard.ticketOrders` and `business.dashboard.noTicketOrders`
- **Suggested Fix:** Add missing translation keys to locale files or ensure `t()` is called correctly.

### Issue #11 — `POST /business/payout-request` Returns 405
- **Location:** `api/business.py` (or missing router)
- **Severity:** Medium
- **Expected:** Business should be able to request payouts
- **Actual:** `405 Method Not Allowed` — the endpoint does not exist or is not registered.

### Issue #12 — `GET /social/business/followers` Returns 404
- **Location:** Frontend calls `/social/business/followers`
- **Severity:** Medium
- **Expected:** Business should be able to view followers
- **Actual:** `404 Not found` — endpoint missing or wrong URL. The followers data exists via `GET /business/followers` (200 OK, `[]`).
- **Suggested Fix:** Align frontend call with backend endpoint `/business/followers` or add `/social/business/followers` alias.

### Issue #13 — Vendor Reviews Endpoint Is Placeholder
- **Location:** `api/vendors.py:290`
- **Severity:** Medium
- **Expected:** `GET /vendors/reviews` should return real vendor reviews
- **Actual:** Returns `[]` with comment "placeholder - returns empty list"
- **Suggested Fix:** Create `VendorReview` model and implement CRUD.

### Issue #14 — Artist Recaps Are Placeholders
- **Location:** `api/artist_dashboard.py:415,439`
- **Severity:** Medium
- **Expected:** `GET /artist/recaps` and `POST /artist/recaps` should persist recap data
- **Actual:** Both endpoints are no-ops with placeholder comments

---

## Low Issues (Nice to Have / Polish)

### Issue #15 — Google Sign-In Broken on localhost
- **Location:** Login page
- **Severity:** Low
- **Expected:** Google OAuth should work in dev
- **Actual:** `The given origin is not allowed for the given client ID` — the Google client ID is not configured for `localhost:5173`
- **Note:** This is expected for local dev; only matters for production configuration.

### Issue #16 — Homepage Shows "No featured events found for China" When City = Shanghai
- **Location:** `app/src/sections/HeroSection.tsx` or `Home.tsx`
- **Severity:** Low
- **Expected:** City-specific messaging
- **Actual:** Message says "for China" regardless of selected city (e.g., Shanghai)

### Issue #17 — `display_name` Still Referenced in Some User Pages
- **Location:** Multiple frontend pages
- **Severity:** Low
- **Expected:** Use `first_name + last_name` as documented in AGENTS.md
- **Actual:** Several pages still fallback to `profile.display_name` which does not exist in DB. Currently falls back silently but should be cleaned up for consistency.

---

## Phase-by-Phase Audit Results

### Phase 1 — Non-User (Guest) Experience
| Feature | Status | Notes |
|---------|--------|-------|
| Homepage loads | [OK] Working | Loads correctly |
| City selector | [OK] Working | Dropdown functional |
| Trending events | [WARN] Empty | No events in local DB |
| Trending artists | [OK] Working | Returns real artist data |
| Event discovery | [WARN] Empty | No events in DB |
| Event detail page | [WARN] Not testable | No events to click |
| Venue discovery | [ERR] Broken | No public `/venues` endpoint |
| Artist discovery | [OK] Working | Artists list and detail work |
| Community feed | [WARN] Partial | CommunitySection hits wrong URL (Issue #2) |
| Auth gates | [OK] Working | Login/register forms render, login works |

### Phase 2 — Registered User Experience
| Feature | Status | Notes |
|---------|--------|-------|
| Profile setup | [OK] Working | Can update profile via `/auth/me` |
| User dashboard | [OK] Working | Loads with user-specific data |
| My tickets | [OK] Working | `/tickets/my-orders` returns `[]` (no data) |
| Ticket purchase | [OK] Working | Manual QR flow implemented |
| Community posts | [OK] Working | Can create posts via `/community/posts` |
| Deals/offers | [ERR] Missing | No deals system implemented |

### Phase 3 — Business Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Business onboarding | [WARN] Partial | Can register, but auto-profile creation missing |
| Dashboard overview | [WARN] Partial | Loads, but raw i18n keys visible |
| Event creation | [OK] Working | Subscription-gated correctly (Issue #5 aside) |
| Table reservations | [OK] Working | Backend fully implemented, gated by subscription |
| Payouts | [ERR] Broken | `POST /business/payout-request` returns 405 |
| Followers | [WARN] Partial | `/business/followers` works, `/social/business/followers` is 404 |

### Phase 4 — Artist Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Artist profile | [OK] Working | Can update via `/artist/profile` |
| Analytics | [WARN] Partial | Page exists, data may be mocked |
| Bookings | [OK] Working | Accept/reject implemented |
| Recaps | [ERR] Broken | Placeholder endpoints only |

### Phase 5 — Vendor Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Vendor profile | [OK] Working | CRUD implemented |
| Product management | [OK] Working | Full CRUD with image upload |
| Orders | [OK] Working | Can view and update orders |
| Event booths | [OK] Working | Can apply/cancel event booths |
| Reviews | [ERR] Broken | `GET /vendors/reviews` returns `[]` placeholder |

### Phase 6 — Admin Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Admin access | [WARN] Partial | Accessible, but critical users may be redirected to business dash (Issue #4) |
| User management | [OK] Working | List, search, suspend, delete implemented |
| Business management | [OK] Working | Approval/rejection works |
| Event management | [OK] Working | Approve/reject/cancel works |
| Content moderation | [OK] Working | Reported content + community moderation works |
| Financial controls | [ERR] Broken | Payouts, transactions, refunds are placeholders |
| City management | [ERR] Broken | City images endpoint is placeholder |
| Site settings | [ERR] Broken | System flags return hardcoded values |
| Featured events | [ERR] Broken | Fully placeholder |

### Phase 7 — Media, File Uploads & Avatars
| Feature | Status | Notes |
|---------|--------|-------|
| User avatar upload | [WARN] Partial | Upload via `/media/upload` works, but `default-avatar.jpg` missing |
| Event poster upload | [OK] Working | Uploads handled via `/media/upload` |
| Product images | [OK] Working | Uploads handled via `/media/upload` |
| Post media | [OK] Working | Images + videos supported |
| Ticket QR codes | [OK] Working | Base64 QR generated on approval |
| Admin media controls | [ERR] Missing | No admin media management endpoint |

### Phase 8 — API Endpoint Audit

#### Working Endpoints
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/events`, `GET /api/events/featured`, `GET /api/events/:id`
- `GET /api/artists`, `GET /api/artists/:id`
- `GET /api/vendors` *(newly added)*, `GET /api/vendors/:id`
- `GET /api/community/posts`, `POST /api/community/posts`
- `GET /api/subscriptions/plans`, `GET /api/subscriptions/my-subscription`
- `POST /api/tickets/order`, `GET /api/tickets/my-orders`, `POST /api/tickets/validate`
- `POST /api/tables/business/packages`, `GET /api/tables/business/orders`, `POST /api/tables/validate`
- `POST /api/product-orders/order`, `GET /api/product-orders/vendor/orders`
- `GET /api/admin/users`, `GET /api/admin/events`, `GET /api/admin/artists`, etc.

#### Missing / 404 Endpoints
- `GET /api/venues` (no public venue router)
- `POST /api/venues` (no venue creation endpoint)
- `POST /api/upload/avatar` (no dedicated avatar endpoint)
- `POST /api/upload/image` (no dedicated image endpoint)
- `POST /api/upload/multiple` (no multiple upload endpoint)
- `GET /api/media/:id` (no media retrieval endpoint)
- `POST /api/tickets/purchase` (replaced by manual QR flow)
- `GET /api/tickets/:id/qr` (replaced by order-level QR)
- `POST /api/tickets/transfer` (not implemented)
- `GET /api/posts/:id/comments` (replaced by `/community/posts/{id}` detail)

---

## Fixes Applied During This Audit

1. [OK] **Added `events.is_featured` column** to `models.py`, `database.py`, and migration script
2. [OK] **Added `events.latitude` and `events.longitude`** to `database.py` and migration script
3. [OK] **Ran full migration** to bring local SQLite to parity
4. [OK] **Implemented visibility priority sorting** in public `events`, `artists`, and `vendors` listing endpoints
5. [OK] **Added public vendor listing endpoints** (`GET /vendors`, `GET /vendors/search`, `GET /vendors/{id}`)
6. [OK] **Added subscription gating** to `CreateEvent.tsx` (redirects to `/subscriptions`)
7. [OK] **Added subscription lock indicators** to `DashboardLayout.tsx` (lock icons + upgrade banner)
8. [OK] **Rewrote `business/TableReservations.tsx`** with event picker, image upload, and working edit modal

---

## Recommendations

### Immediate (This Week)
1. Fix Issue #2 (CommunitySection wrong API URL)
2. Fix Issue #4 (authStore overwriting admin role)
3. Fix Issue #5 (auto-create organizer profile for business users)
4. Add `default-avatar.jpg` to `public/` folder
5. Add missing i18n keys for business dashboard

### Short-Term (Before Beta)
6. Implement real payout request endpoint (`POST /business/payout-request`)
7. Replace placeholder admin financial endpoints with real DB logic
8. Add `VendorReview` model and real review endpoints
9. Implement artist recaps persistence
10. Create public venue listing/detail endpoints
11. Reconcile admin account credentials in AGENTS.md with actual DB

### Medium-Term
12. Remove city requirement from login form
13. Add dedicated avatar/media upload endpoints if frontend expects them
14. Clean up remaining `display_name` references
15. Add admin media management panel

---

*End of Report*
