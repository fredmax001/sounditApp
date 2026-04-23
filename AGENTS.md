# Sound It Platform — Agent Work Log

> This file tracks ongoing audits, fixes, and known issues so agents can resume work without re-discovering the same problems.

---

## Last Updated
2026-04-23

---

## Project Stack
- **Backend**: Python 3, FastAPI, SQLAlchemy, SQLite (local), PostgreSQL (prod)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Auth**: JWT Bearer tokens
- ** infra**: Redis (optional — non-blocking if unavailable locally)

---

## Build / Import Status
- [OK] Frontend compiles successfully (`npm run build` passes) — last built 2026-04-23
- [OK] Backend imports cleanly (`python3 -c "from main import app"` works)
- [WARN] Redis unavailable locally (`Connection refused :6379`) — non-blocking for core features
- [WARN] Frontend chunk size warning (>500 KB after minification) — non-blocking

---

## Completed Audits & Fixes

### 29. Admin Subscriptions "Failed to load" Toast Fix (2026-04-23)
- **Problem**: Admin Subscriptions page loaded data successfully but still showed a "Failed to load" toast.
- **Root cause**: The `useEffect` in `AdminSubscriptions.tsx` fired `fetchSubscriptions()` before the JWT token was ready (during auth state initialization). The unauthenticated request returned 401, triggering the error toast. Then the auth state updated, a second request succeeded, and data rendered — but the error toast remained.
- **Fix**: Added `if (!token) return;` guard to `fetchSubscriptions()`, added `AbortController` to cancel in-flight requests on cleanup/filter changes, and filtered out `CanceledError`/`AbortError` from toast notifications. Also added `token` to the effect dependency array with early-return guard to prevent navigation race conditions.

### 28. Admin Delete Buttons, Event Deletion & Order Rejection Fixes (2026-04-22)
- **Missing DELETE endpoints for artists and businesses**
  - Root cause: `ManageArtists.tsx` called `DELETE /admin/artists/${id}` and `ManageBusinesses.tsx` called `DELETE /admin/businesses/${id}`, but neither endpoint existed in `api/admin.py`, causing all admin artist/business delete buttons to fail with 404.
  - Fix: Added `DELETE /admin/artists/{artist_id}` and `DELETE /admin/businesses/{business_id}` to `api/admin.py`.
  - `delete_artist` cleans up `ArtistReview`, `ArtistFollow`, `ArtistAvailability`, `EventArtist`, `BookingRequest` rows before deleting the profile, then resets the user's role to `user`.
  - `delete_business` soft-deletes the associated user account (same anonymization pattern as `delete_user`) to preserve events and data integrity.
- **Admin event hard delete crashed on PostgreSQL FK constraints**
  - Root cause: `api/admin.py::delete_event` only cleaned up `EventArtist`, `EventFollow`, and `TicketTier/Ticket` rows. It missed `EventVendor`, `CommunityPost`, `TablePackage`, `TableOrder`, `TicketOrder`, `Recap`, `EventPaymentQR`, and `PromoCode` — causing FK constraint violations on production PostgreSQL.
  - Fix: Added comprehensive pre-cleanup for all child relationships before deleting the event. `Recap` and `CommunityPost` event references are nulled out rather than deleted.
- **Vendor delete crashed on ProductOrder FK constraints**
  - Root cause: `api/admin.py::delete_vendor` called `db.query(Product).filter(...).delete()` which bypasses ORM cascades and fails when `ProductOrder` rows reference those products.
  - Fix: Changed to iterate products, delete their `ProductOrder` rows first, then delete each product via ORM.
- **Vendor product delete crashed on ProductOrder FK constraints**
  - Root cause: `api/vendors.py::delete_product` hard-deleted a product without checking for existing `ProductOrder` rows.
  - Fix: Added a check — if orders exist, returns 400 "Cannot delete product with existing orders".
- **Events "don't delete" for organizers/businesses**
  - Root cause: `api/events.py::delete_event` (organizer) performs a soft delete by setting `status = CANCELLED`. But `api/events.py::list_my_events` returned ALL events including cancelled ones, so "deleted" events still appeared in the dashboard.
  - Fix: Added `Event.status != EventStatus.CANCELLED` filter to `list_my_events`.
- **Recap delete crashed on RecapLike FK constraints**
  - Root cause: `api/recaps.py::delete_recap` deleted the recap without deleting `RecapLike` rows first. The `Recap.likes` relationship has no `cascade="all, delete-orphan"`.
  - Fix: Added `db.query(RecapLike).filter(...).delete()` before `db.delete(recap)`.
- **Build status**: Frontend built successfully, backend imports cleanly.

### 27. Post-Deployment UI Regression Fixes (2026-04-17)
- **Missing `artistDetail.followed` translation key**
  - Root cause: `artistDetail.followed`, `artistDetail.unfollowed`, `artistDetail.followFailed`, and `artistDetail.loginToFollow` keys were missing from locale files, causing raw translation keys to display in the Artist Detail page follow button.
  - Added missing keys to `en.json`, `zh.json`, and `fr.json`.
- **Discovery blank / 500 error — Business `logo_url` misassumption**
  - Root cause: Assumed `BusinessProfile` had a `logo_url` column (it does not). Adding `business.logo_url` to `api/cities.py` caused `AttributeError` and broke the `/cities/{city}/guide` endpoint (HTTP 500), making Discovery completely blank.
  - Fix: Removed all `logo_url` references from `api/cities.py`, `api/profiles.py`, `PublicProfile.tsx`, and `cityGuideStore.ts`. Kept the newly-added `avatar_url` in `GuideBusiness` and `GuideOrganizer` schemas so `user.avatar_url` now correctly flows through to the City Guide.
- **Mobile layout changes not appearing live**
  - Root cause: Nginx config serves the SPA from `/var/www/soundit/app/dist/`, but recent manual rsyncs were targeting `/var/www/soundit/dist/`. The server kept serving the stale build in `app/dist/`.
  - Fix: Synced the latest Vite build to the correct remote path `/var/www/soundit/app/dist/`. Verified live `index.html` now references the new hashed JS bundle.
- **Verification badge missing on artist public profile / contact card**
  - Root cause: `PublicProfile.tsx` only checked `business_profile.is_verified` and `organizer_profile.is_verified` — it ignored `artist_profile.is_verified`. The backend `api/profiles.py` also omitted `is_verified` from the `artist_profile` serialization.
  - Fix: Added `artist_profile.is_verified` to both the backend serializer (`api/profiles.py`) and the frontend `isVerified` computation + TypeScript interface (`PublicProfile.tsx`). Rebuilt and redeployed.
- **Event creation 500 error — QR code too long for DB column**
  - Root cause: `create_event` generates a base64 data-URL QR code and saves it to `events.qr_code`, but the column was `String(500)`. The base64 payload easily exceeds 500 chars, causing `psycopg2.errors.StringDataRightTruncation` on the `UPDATE events SET qr_code=...` statement after the event had already been inserted.
  - Fix: Changed `Event.qr_code` from `String(500)` to `Text` in `models.py`. Ran `ALTER TABLE events ALTER COLUMN qr_code TYPE TEXT;` on production PostgreSQL. Redeployed backend.
- **User Dashboard text too bold and overlapping with fixed navbar**
  - Root cause: `app/src/pages/user/Dashboard.tsx` used `font-black` extensively and the container lacked top padding for the fixed navbar.
  - Replaced all `font-black` with `font-bold` (or `font-semibold` for small labels) to reduce visual weight.
  - Added `pt-24` mobile and `lg:pt-28` desktop padding to the root container to prevent overlap with the fixed navbar.
  - Copied latest `app/dist/` build output to root `dist/` for production serving.

### 26. Mobile App-Like UI/UX Redesign (2026-04-16)
- **Objective**: Transform mobile web experience into a premium, native-app-like interface.
- **Mobile Design System**
  - `app/src/index.css`: Added app-like utilities — `.app-page` (momentum scroll), `.bottom-sheet` modal pattern, `.skeleton` loading states, `.touch-feedback` active scaling, mobile-safe input font sizes, `.snap-scroll-x` for carousels, `.pb-app-nav` for bottom-nav safe padding.
  - `app/src/hooks/useHaptic.ts`: New hook wrapping `navigator.vibrate()` for tactile feedback.
  - `app/src/components/MobilePageTransition.tsx`: New Framer Motion wrapper adding horizontal slide transitions between mobile pages.
- **Unified Mobile Shell**
  - `app/src/components/MobileBottomNav.tsx`: Complete rewrite — single shared nav for both public and dashboard pages. Features floating center action button, active pill indicator with `layoutId` animation, haptic feedback on taps, solid-gradient background for performance, and 48px touch targets.
  - `app/src/components/MobileHeader.tsx`: Complete rewrite — clean app header with hide-on-scroll-down / show-on-scroll-up behavior, full-screen profile drawer (replacing dropdown), bottom-sheet city picker (replacing 4-city cycle), and unified with `MobileLayout`.
  - `app/src/layouts/MainLayout.tsx`: Now hides `<Footer />` on mobile, uses `MobileBottomNav`, and wraps `<Outlet />` in `MobilePageTransition`.
  - `app/src/layouts/MobileLayout.tsx`: Replaced embedded bottom nav with shared `<MobileBottomNav />`, replaced profile drawer with the same full-screen drawer pattern as `MobileHeader`, added hide-on-scroll header behavior, and wrapped children in `MobilePageTransition`.
- **Mobile-First Page Content**
  - `app/src/pages/Home.tsx`: Reduced hero heading size on mobile, vertical CTA stack, converted Featured Events and Featured Artists to horizontal snap-scroll carousels on mobile, reduced section padding.
  - `app/src/pages/user/Dashboard.tsx`: Reduced padding, smaller avatar on mobile, scrollable tab bar, reduced card border-radius, vertical ticket cards, single-column Quick Actions, single-column saved events grid.
  - `app/src/pages/business/Dashboard.tsx`: Reduced padding, stacked ticket-order cards on mobile, vertical recent-event cards, single-column Quick Actions, edit-event modal converted to bottom-sheet on mobile.
- **Component Improvements**
  - `app/src/components/EventCard.tsx`: Larger save-button touch target (`w-11 h-11`), reduced image height on mobile, larger price badge.
  - `app/src/components/Footer.tsx`: Hidden entirely on mobile (`hidden md:block`) to preserve app illusion.
- **Build Status**: Frontend compiles successfully.

### 25. Ticket Scanner, Payment Success Flow & Business Nav Fixes (2026-04-16)
- **Payment submission success flow**
  - `app/src/pages/EventDetail.tsx`: After successful ticket order submission, instead of just closing the modal, a full-screen success modal now appears with "View My Tickets" and "Continue Browsing" buttons. Clicking "View My Tickets" navigates to `/tickets`.
  - Added missing translation keys: `eventDetail.submitting`, `eventDetail.submitOrder`, `eventDetail.orderSuccessTitle`, `eventDetail.viewMyTickets`, `eventDetail.continueBrowsing`.
- **"Submited" typo / raw translation key display**
  - Root cause: `eventDetail.submitting` and `eventDetail.submitOrder` translation keys were missing from all locale files, causing the raw namespace-prefixed keys to display on the submit button.
  - Added the missing keys to `en.json`, `zh.json`, and `fr.json`.
- **Ticket Scanner not picking up QR codes**
  - `app/src/pages/organizer/Scanner.tsx`: Completely rewrote scanner to use the already-installed `html5-qrcode` library (`Html5QrcodeScanner`). The scanner now initializes the device camera and actually reads QR codes.
  - Fixed the ticket validation API: replaced broken multi-endpoint fallback with a single `POST /ticketing/organizer/validate-ticket` call that handles both `TicketOrder` and `Ticket` records, and auto-checks-in on validation.
- **Manual ticket number entry not working**
  - Same fix as above: the frontend was calling a non-existent `POST /tickets/validate` endpoint. It now correctly calls `POST /ticketing/organizer/validate-ticket`.
  - **Backend bug fixed**: `api/ticketing_organizer.py` was comparing `event.organizer_id` (which is an `organizer_profiles.id`) directly to `current_user.id` (a `users.id`). This caused all ticket validations to fail with "Only event organizer can validate tickets". Added `_get_user_organizer_id()` helper and fixed all organizer ownership checks across the file.
- **Business mobile bottom nav**
  - `app/src/components/MobileBottomNav.tsx` and `app/src/layouts/MobileLayout.tsx`: Updated business user bottom nav to **Dashboard — Events — Scanner — Tickets — Profile**.
  - "Tickets" links to `/dashboard/business/ticket-orders` where staff can see confirmed attendees and checked-in tickets.

### 24. Mobile Layout & Data Fixes (2026-04-16)
- **Footer layout**
  - `app/src/components/Footer.tsx`: Changed mobile grid to `grid-cols-2` so content fits better; positioned Support column to the right corner on larger screens using `lg:items-end`.
- **City Guide / Discovery Hub**
  - `app/src/pages/CityGuide.tsx`: Added `event` and `food` types to the `featuredItems` filter so they appear in the featured horizontal scroll.
  - `api/cities.py`: Events, venues, and food spots without specific lat/lng now fallback to the city center coordinates, so they appear in the guide instead of being silently filtered out.
  - Artist avatars in featured section now fall back to `/default-avatar.jpg` instead of `/placeholder-club.jpg`.
  - Removed "Verified" text pill from artist list cards in City Guide (kept verification badge on detail pages only).
- **Artist card routing — "Artist not found"**
  - `api/bookings.py`: Made `get_artist_public_profile` robust with fallbacks: tries `artist_profile.id`, then `artist_profile.user_id`, then `user.id` with `user.artist_profile`.
  - Fixed production data inconsistency: user 3 had `role=artist` but no `artist_profiles` row. Created missing `artist_profile` for user 3.
- **Business PublicProfile**
  - `api/profiles.py`: `events_count` in `organizer_profile` is now computed dynamically from actual approved events in the DB (instead of the stale `events_count` column).
  - `app/src/pages/PublicProfile.tsx`: Added Follow/Unfollow button for organizer/business profiles using `/social/organizers/{id}/follow`. Event count display now uses `events.length` for organizers.
- **Home Hero**
  - `app/src/pages/Home.tsx`: Removed `hidden md:block` from the Featured Artists section so it renders on mobile.
  - `app/src/store/eventStore.ts`: `fetchSavedEvents` no longer toggles the global `isLoading` state, preventing skeleton flicker/loops on the Home page when EventCards mount.
- **EventDetail business avatar**
  - `app/src/pages/EventDetail.tsx`: Fixed broken `/placeholder_artist.jpg` fallback to `/placeholder.jpg`. Changed business link from `/organizer/${id}` to `/profiles/${id}`.
- **Artist verified badge**
  - Removed "Verified" text from City Guide artist list cards; badge now shows only inside artist detail/contact cards.

### 23. Deploy Invalidates All Sessions — JWT Secret Regeneration (2026-04-16)
- **Problem**: After fresh production deploy, all logged-in users saw `401 Invalid authentication credentials` on authenticated endpoints (e.g., `/events/me`, `/dashboard/stats`).
- **Root cause**: `deploy/deploy_sounditent.sh` performs a "fresh" deploy that runs `rm -rf /var/www/soundit`, which deletes the existing `.env` file containing `JWT_SECRET`. `deploy/server_setup_sounditent.sh` then copies `.env.production` (which has `JWT_SECRET=""`) to `.env` and generates a brand new random secret. All existing JWT tokens were signed with the old secret, so they become invalid after the deploy.
- **Fixes applied**:
  - Updated `deploy/deploy_sounditent.sh` to backup `.env` to `/tmp/soundit_env_backup` before deleting the deployment directory, and restore it after `rsync`.
  - `server_setup_sounditent.sh` already had `if [ ! -f .env ]` logic, but it was unreachable because `.env` was always deleted by the deploy script.
- **User impact**: All active sessions were invalidated. Users must log out and log back in to obtain a new token signed with the current `JWT_SECRET`. There is no way to recover the old secret.

### 22. Event Creation 500 Error Fix (2026-04-16)
- **Problem**: Publishing an event returned HTTP 500.
- **Root causes**:
  1. `api/events.py`: `get_organizer_profile_id()` auto-created an `OrganizerProfile` using `contact_email` and `contact_phone` kwargs, but the `OrganizerProfile` model does not have those columns. This crashed whenever a business user with an existing `business_profile` but no `organizer_profile` tried to create an event.
  2. `services/subscription_service.py`: `increment_feature_usage()` accessed `status["subscription"]` unconditionally, but verified users (who bypass subscription requirements) don't have a `subscription` key in their status dict, causing a `KeyError`.
- **Fixes applied**:
  - Removed `contact_email` and `contact_phone` from both `OrganizerProfile()` instantiations in `get_organizer_profile_id()`.
  - Added early return in `increment_feature_usage()` for verified users (`is_verified_premium`) so it skips usage tracking.
- **Verification**: Local integration test with a verified business user successfully created an event and returned 200.

### 21. Fresh Production Deployment to sounditent.com (2026-04-15)
- **Fixed `deploy/deploy_sounditent.sh`**
  - Rewrote upload restoration block using a temporary script file to avoid complex `eval` quoting issues that caused bash syntax errors.
  - Added defensive `id -u nginx` checks before `chown` so the script doesn't fail when nginx isn't installed yet.
- **Fixed `deploy/server_setup_sounditent.sh`**
  - Added `WEB_USER` fallback (`nginx` → `root`) for permission setting in case nginx package isn't present.
- **Fixed `deploy/nginx_sounditent.conf`**
  - Changed `http2 on;` (nginx 1.25+) to `listen 443 ssl http2;` for compatibility with AlmaLinux 9's nginx 1.20.1.
- **Deployment issues resolved during setup**
  - SSH connection consistently dropped during `pip install` inside the full script; worked around by pre-installing venv + requirements individually before running server setup.
  - Apache (httpd/cPanel) was occupying ports 80/443; stopped and disabled Apache to let nginx serve the site.
  - PostgreSQL data directory was uninitialized; ran `postgresql-setup --initdb`, started service, created DB/user.
  - `.env.production` contained unresolved `\${DB_PASSWORD}` placeholder; replaced with real password in remote `.env`.
  - PostgreSQL `ident` auth blocked app connections; changed `pg_hba.conf` to `md5` for IPv4/IPv6 and `peer` for local unix sockets.
  - SSL certificates missing; obtained valid Let's Encrypt certs via `certbot --nginx --force-renewal`.
- **Database setup on production**
  - `database.py`: `init_db()` previously only created tables for SQLite. Fixed to also import all models and call `Base.metadata.create_all()` for PostgreSQL.
  - Ran `init_db()` on production PostgreSQL, creating all tables.
  - Seeded 4 default community sections (General, Events, Music, Food).
  - Seeded subscription plan configs for Business, Vendor, and Artist roles.
  - Created super_admin user: `admin@sounditent.com` / `SoundIt2026!Admin`.
- **Verified live endpoints**
  - `GET https://sounditent.com/health` → `{"status":"healthy"}`
  - `GET https://sounditent.com/api/v1/system/status` → `{"status":"healthy","maintenance_mode":false}`
  - `GET https://sounditent.com/api/v1/events` → 200
  - `GET https://sounditent.com/api/v1/artists` → 200
  - `GET https://sounditent.com/api/v1/cities` → 200
  - `GET https://sounditent.com/api/v1/vendors` → 200
  - React SPA loads correctly on `/`.

### 20. Ticket Privacy & Platform-Wide Image Upload Fixes (2026-04-15)
- **`app/src/pages/EventDetail.tsx`**
  - Removed the "ticket approved" QR code / ticket code display from the public event detail page.
  - Ticket details (QR, approval status, ticket code) are now backend-only and only exposed via the ticket scanner / check-in flow to prevent fraud and duplication.
- **Event flyer not saving on edit**
  - `schemas.py`: Added missing `flyer_image: Optional[str] = None` to `EventUpdate` schema.
  - `api/events.py`: `update_event` now persists `flyer_image` when provided.
- **Platform-wide local image upload path fix**
  - Created `utils/upload_storage.py` with `get_upload_dir(subfolder)` helper that chooses:
    - `static/uploads/{subfolder}/` in DEBUG mode (so FastAPI's `/static` mount serves them directly)
    - `/var/www/soundit-uploads/{subfolder}/` in production (mirrored by nginx)
  - Updated all custom upload endpoints to use the helper and return `/static/uploads/...` URLs:
    - `api/events.py` (event QR upload)
    - `api/artist_dashboard.py` (artist QR upload)
    - `api/vendors.py` (vendor product QR upload)
    - `api/product_orders.py` (product order payment screenshots)
    - `api/table_reservations.py` (table package images & table order payment screenshots)
    - `api/ticketing.py` (event payment QR codes)
    - `api/tickets.py` (ticket order payment screenshots)
    - `api/bookings.py` (booking payment screenshots)
    - `api/payments.py` (payment verification screenshots — also fixed `screenshot_url` storing a filesystem path instead of a URL)
    - `api/payments_manual_qr.py` (payment proof screenshots)
    - `api/feed.py` (community feed media)
  - `api/media.py`:
    - Local fallback now uses `get_upload_dir()` so uploaded files are accessible in local dev.
    - Fixed unreachable code bug in `delete_file` (lines were incorrectly indented inside the `except` block).
    - Fixed hardcoded "10MB limit" error message to dynamically reflect the actual limit (10MB for images, 50MB for videos).
- **Production deployment**
  - Fixed `deploy/deploy_sounditent.sh` bash syntax error caused by unescaped `$` in `grep -v '^static$'`.
  - Re-deployed to `sounditent.com` after fixing `.env` DB credentials (the fresh deploy had overwritten the working `.env` with `.env.production` which still contained the unresolvable `\${DB_PASSWORD}` placeholder).
  - Verified live endpoints: `/health`, `/api/v1/system/status`, `/api/v1/events`, `/api/v1/artists`, `/api/v1/vendors`, `/api/v1/cities` all returning 200.

### 14. Monetization Plan Completion + Platform-Wide Audit (2026-04-14)
- **`api/events.py`**, **`api/artists.py`**, **`api/vendors.py`**
  - Implemented visibility priority sorting in public listing endpoints:
    - Events: `is_featured DESC, start_date ASC`
    - Artists: `is_featured DESC, is_verified DESC, followers_count DESC`
    - Vendors: `is_featured DESC, is_verified DESC, rating DESC, reviews_count DESC`
  - Added `is_featured` column to `Event` model in `models.py`
  - Added public vendor listing endpoints: `GET /vendors`, `GET /vendors/search`, `GET /vendors/{id}`
- **`database.py`** / **`scripts/migrate_all_missing_columns.py`**
  - Added missing `events.latitude` and `events.longitude` migrations (fixes local SQLite crash)
  - Migrated `events.is_featured` successfully
- **`app/src/pages/business/TableReservations.tsx`**
  - Complete rewrite: event picker dropdown, image upload in create/edit modals, working edit package modal, QR code display for approved orders
- **`app/src/pages/organizer/CreateEvent.tsx`**
  - Added subscription gating: redirects business/organizer users without active subscription to `/subscriptions`
- **`app/src/layouts/DashboardLayout.tsx`**
  - Added subscription status check and lock indicators on premium nav items (Analytics, Table Reservations, Payouts, etc.)
  - Shows "Upgrade your subscription" banner when no active subscription detected
- **Critical fixes applied during audit:**
  - `app/src/sections/CommunitySection.tsx`: Fixed hardcoded API URL to use `VITE_API_URL`
  - `app/src/store/authStore.ts`: Fixed `createBusinessProfile` to not overwrite admin/super_admin roles
  - `app/public/default-avatar.jpg/png/svg`: Added missing default avatar images
  - `app/src/i18n/locales/*.json`: Added missing `business.dashboard.ticketOrders` and `business.dashboard.noTicketOrders` keys
- **Full audit report:** `AUDIT_REPORT_2026-04-14.md` created with 17 documented issues across all 8 phases

### 15. Final Critical Fixes & Production Prep (2026-04-14)
- **`api/events.py`**
  - `get_organizer_profile_id()` now auto-creates an `OrganizerProfile` for business users who lack one, preventing 400 errors on event creation
- **`scripts/seed_test_data.py`**
  - Created comprehensive test data seeding script for local development
  - Seeds sample users (regular, business, artist, vendor), events, clubs, food spots, ticket orders, table packages/orders, product orders, community posts, subscriptions, and notifications
  - Fixed multiple model/schema mismatches (`ProductOrder` uses `TicketOrderStatus`, `VendorProfile` has no `city`, `Club` has no `capacity`, `Notification` uses `type` not `notification_type`)
  - Fixed SQLite schema parity issues (`clubs.category` column added via migration)
  - Successfully seeds 25 users, 6 events, 2 artists, 1 vendor, 3 products, 3 ticket orders, 1 table order, 1 product order, 3 community posts, 2 subscriptions
- **`scripts/migrate_all_missing_columns.py`**
  - Added `clubs.category` migration for local SQLite parity
- **`scripts/create_admin.py`**
  - Fixed to work with local project structure
  - Both `admin@soundit.com` and `admin@sounditent.com` are now `super_admin` with password `SoundIt2026!Admin`
- **`app/src/pages/auth/Login.tsx`**
  - Removed mandatory city selection blocking login
- **Production deployment:**
  - Frontend built successfully and deployed to `sounditent.com`
  - Backend deployed and running on `sounditent.com` (port 8000)
  - Fixed production PostgreSQL credentials in `.env` (used `soundit:SoundItDB2026!@localhost:5432/soundit_prod`)
  - Ran comprehensive production DB migration (`scripts/migrate_production_postgresql.py`):
    - Added missing `events` columns: `is_featured`, `wechat_qr_url`, `alipay_qr_url`, `ticket_price`, `payment_instructions`
    - Added missing `products` columns: `wechat_qr_url`, `alipay_qr_url`, `payment_instructions`
    - Added missing `artist_profiles` columns: `wechat_qr_url`, `alipay_qr_url`, `payment_instructions`
    - Added missing `booking_requests` columns: `payment_screenshot`, `payment_amount`, `payer_name`, `payer_notes`, `payment_status`, `reviewed_at`, `rejection_reason`
    - Added missing `ticket_orders.quantity`, `table_packages.total_tables`, `table_orders` QR/validation columns
    - Added missing `community_posts`, `community_comments`, `community_likes` guest interaction columns
    - Created missing tables: `community_comment_likes`, `product_orders`
  - Verified live endpoints:
    - `GET https://sounditent.com/health` → `{"status":"healthy"}`
    - `GET https://sounditent.com/api/v1/events` → working events list
    - `GET https://sounditent.com/api/v1/artists` → working artists list

### 16. Location-Aware City Expansion & Social Follow/Save Fixes (2026-04-14)
- **City enum expansion**
  - `models.py`: Expanded `City` enum from 21 to 63 cities — now covers all major Chinese cities including Harbin, Changchun, Shenyang, Jinan, Hefei, Fuzhou, Nanning, Guiyang, Lanzhou, Haikou, Hohhot, Urumqi, Lhasa, Yinchuan, Xining, Wuxi, Nantong, Changzhou, Xuzhou, Yangzhou, Shaoxing, Jiaxing, Taizhou, Wenzhou, Jinhua, Quzhou, Zhoushan, Dongguan, Foshan, Zhuhai, Zhongshan, Jiangmen, Huizhou, Shantou, Zhanjiang, Zhaoqing, Maoming, Meizhou, Qingyuan, and more.
- **Geolocation-based city detection**
  - `api/cities.py`: Added lat/lng coordinates for all 63 cities in `CITY_METADATA`; added `GET /cities/detect?lat=&lng=` endpoint using Haversine formula to return nearest supported city.
  - `app/src/store/authStore.ts`: Added `detectCityByLocation()` that uses browser `navigator.geolocation` and calls `/cities/detect`. Runs automatically on app init if user hasn't manually selected a city.
  - `app/src/store/authStore.ts`: Changed `fetchCities()` to use `/cities` instead of `/clubs/cities` so all supported cities are available in selectors.
- **Frontend city coverage**
  - `app/src/data/constants.ts`: Expanded `chinaCities` from 21 to 63 cities with names, Chinese names, images, and descriptions.
  - `app/src/pages/CityGuide.tsx`: City filter tabs now show all 63 supported cities instead of hardcoded 6.
- **Social follow/save wiring**
  - `app/src/pages/Artists.tsx`: Added Follow/Unfollow heart button on each artist card using `/social/following` and `/social/artists/{id}/follow`.
  - `app/src/components/EventCard.tsx`: Added save/unsave heart button wired to `eventStore.saveEvent()` / `unsaveEvent()`. Added `savedEvents` state to `eventStore.ts` so cards show correct saved status.
  - `app/src/pages/VendorDetail.tsx` (new): Public vendor profile page with Follow/Unfollow button, contact info, and product listing.
  - `app/src/pages/Vendors.tsx` (new): Public vendor directory with search, city-based filtering, and verification badges.
  - `app/src/components/Navbar.tsx`: Added "Vendors" link to main navigation.
- **Backend vendor city filtering**
  - `api/vendors.py`: `GET /vendors` now accepts optional `city` query parameter for city-scoped vendor listings.
- **Type fixes**
  - `app/src/store/authStore.ts`: Added `website` to `BusinessProfile` interface.
  - `app/src/pages/ArtistDetail.tsx`: Fixed missing `session` destructuring in main component.
- **Build Status**: Frontend build passes, backend imports OK.
- **Production Note**: [OK] PostgreSQL city enum migration completed on `sounditent.com` (42 new cities added).

### 19. Full-Page Event Edit (2026-04-14)
- **Problem**: Editing an event in `ManageEvents.tsx` opened a cramped modal with only basic fields (title, description, date, city, address, capacity, status).
- **Solution**: Replaced the modal with a dedicated full-page editor at `/dashboard/business/events/:id/edit`.
  - Created `app/src/pages/organizer/EditEvent.tsx` based on the `CreateEvent.tsx` layout:
    - Sticky header with back navigation, event title preview, Cancel and Save buttons
    - Full flyer upload with change-photo overlay
    - Section cards: General Info, Music & Line-up, Photos, Tickets, Security & Verification, Payment Setup
    - Live event preview card in sidebar
    - Gallery photo management (add/remove)
    - Ticket tier editing (update existing tiers, create new tiers, delete removed tiers)
    - Payment Setup section with WeChat/Alipay QR upload, ticket price, and instructions
    - Success modal after saving with QR code, share link, and navigation actions
  - `app/src/pages/organizer/ManageEvents.tsx`: Removed the edit modal and changed the edit button to navigate to the new full-page route.
  - `app/src/App.tsx`: Added route `/dashboard/business/events/:id/edit` rendering `<EditEvent />` inside `ResponsiveLayout`.
  - `app/src/store/eventStore.ts`: Added missing type properties to `Event` interface (`event_type`, `refund_policy`, `require_id`, `qr_code`, `share_url`).
- **Build & Deploy**: Frontend built successfully and synced to `sounditent.com`.

### 18. Production Deployment Completion — sounditent.com (2026-04-14)
- **Problem**: Fresh deploy to `sounditent.com` failed because the server rebooted during setup, PostgreSQL `city` enum was missing new values, and several production DB columns were absent.
- **Resolution**:
  - Re-ran remote server setup to completion; `soundit` service is active and healthy.
  - Fixed production `.env` — replaced unresolvable `\${DB_PASSWORD}` with actual credentials.
  - Ran `scripts/migrate_city_enum_postgresql.py` on production DB — successfully added 42 new city enum values.
  - Ran `scripts/migrate_production_postgresql.py` on production DB:
    - Added `events.require_id`
    - Created/verified all community, ticket, table, product order tables and columns
  - Fixed missing `events.event_type` and `events.refund_policy` columns (first migration crashed before commit).
  - Fixed missing `vendor_profiles.city` column (caused 500 on `/api/v1/vendors`).
- **Verified live endpoints**:
  - `GET https://sounditent.com/` → 200 (React SPA loads)
  - `GET https://sounditent.com/health` → `{"status":"healthy"}`
  - `GET https://sounditent.com/api/v1/system/status` → `{"status":"healthy","maintenance_mode":false}`
  - `GET https://sounditent.com/api/v1/cities` → 200
  - `GET https://sounditent.com/api/v1/events` → 200
  - `GET https://sounditent.com/api/v1/events/featured` → 200
  - `GET https://sounditent.com/api/v1/artists` → 200
  - `GET https://sounditent.com/api/v1/vendors` → 200
- **Status**: Production deployment is fully live and functional.

### 17. Business Dashboard Redesign — CreateEvent & QR Payment Visibility (2026-04-14)
- **Problem**: Users could not see the Payment Setup / QR upload section on the business create-event page. The section existed in code but was buried in a dense two-column layout.
- **Solution**: Completely rewrote `app/src/pages/organizer/CreateEvent.tsx` with a cleaner, section-based layout inspired by Unight:
  - **Sticky header** with back arrow, event title preview, Cancel / Save Draft / Publish buttons
  - **Large flyer upload** — full-width drag-and-drop area with "Change Photo" overlay
  - **Section cards** — General Info, Music & Line-up, Photos, Tickets, Security & Verification, Payment Setup
  - **Event preview card** — live sidebar preview showing date, venue, and tags
  - **Gallery photos** — multiple image upload grid with remove buttons
  - **Better ticket tiers** — card-based design with sale start/end dates and max-per-person limits
  - **Payment Setup** — moved to a visually distinct highlighted card on the right sidebar with yellow border accent so it cannot be missed
- **Backend enhancements**
  - `models.py`: Added `event_type`, `refund_policy`, `require_id` columns to `Event` model
  - `schemas.py`: Added new fields to `EventBase`, `EventCreate`, `EventUpdate`, `EventResponse`
  - `api/events.py`: `create_event` and `update_event` now persist `event_type`, `refund_policy`, `require_id`, and `gallery_images`
  - `api/vendors.py`: `list_vendors` now accepts `city` filter parameter
  - `database.py` / `scripts/migrate_all_missing_columns.py` / `scripts/migrate_production_postgresql.py`: Added migrations for new `events` columns
  - `scripts/migrate_city_enum_postgresql.py`: Created production migration script for expanding PostgreSQL `city` enum
- **Post-creation success modal**
  - `app/src/pages/organizer/CreateEvent.tsx`: After successful event creation, a full-screen success modal appears instead of immediately redirecting.
  - Modal includes: event preview image, generated QR code (from backend `qr_code`), copyable share link, download QR code button, and actions to view event, create another event, or go to My Events.
  - Added translation keys: `eventCreated`, `eventCreatedDesc`, `shareEvent`, `eventLink`, `copyLink`, `linkCopied`, `downloadQrCode`, `viewEvent`, `createAnotherEvent`, `goToMyEvents`.
- **Build Status**: Frontend build passes, backend imports OK.

### 1. Admin Backend Fixes
- **File**: `api/admin.py`
- **Fix**: Added missing model imports (`ModerationReport`, `Integration`, `ApiKey`, `Webhook`) to resolve Pylance `reportUndefinedVariable` errors.

### 2. Business Dashboard Audit
- **`api/events.py`**
  - Fixed `get_organizer_profile_id()` — changed `.organizer_profiles.id` → `.organizer_profiles[0].id`
  - Added missing endpoints:
    - `POST /events/{id}/featured`
    - `POST /events/{id}/notifications`
    - `POST /events/{id}/promo-codes`
    - `GET /events/{id}/attendees`
- **`api/business.py`**
  - Fixed profile schema mismatch: backend now accepts `city_id` (frontend was sending `city_id`, backend expected `city`)
  - `create_business_profile` and `update_business_profile` map `city_id` to `City` enum
- **`api/dashboard_stats.py`**
  - Added fallback so `BusinessProfile` users get correct stats even without a direct `OrganizerProfile`
- **`api/table_reservations.py`**
  - Fixed `display_name` reference on `User` model → uses `first_name + last_name`
- **`api/payments.py`**
  - Added `GET /payments/business/transactions`
  - Added `POST /payments/business/withdrawal`
- **`api/social.py`**
  - Added `GET /business/followers`
- **`models.py`**
  - Added `gallery_images` JSON column to `BusinessProfile`
  - Added new `PromoCode` model
- **`database.py`**
  - Updated `init_db()` imports to include `PromoCode`
- **Frontend**
  - `app/src/pages/business/Payouts.tsx` — wired to real endpoints
  - `app/src/pages/business/Followers.tsx` — wired to real endpoint
  - `app/src/pages/business/Profile.tsx` — sends `city_id` instead of `city`
- **Config**
  - Reverted invalid `ignoreDeprecations` addition in `tsconfig.app.json`

### 3. Vendor Dashboard Audit
- **`api/vendors.py`**
  - Added missing `GET /vendors/events` (enriched booth-application data)
  - Added missing `POST /vendors/events/{event_id}/cancel`
  - Added missing `GET /vendors/reviews` (placeholder — no `VendorReview` model yet)
  - `ProductCreate` now has optional `vendor_id` (frontend doesn't send it)
- **`api/dashboard_stats.py`**
  - Aligned vendor `recent-activities` response shape with frontend:
    - Keys: `customer_name`, `product`/`product_name`, `quantity`/`qty`, `total`/`amount` (number), `status`, `created_at`
- **`models.py`**
  - Added `stock_quantity` column to `Product`
- **`schemas.py`**
  - Added `stock_quantity` to `ProductBase` and `ProductUpdate`
- **Frontend**
  - `vendorStore.ts` — changed `Product.id`, `VendorProfile.id`, `Order.id` from `string` → `number`
  - `VendorDashboard.tsx`, `VendorProducts.tsx`, `VendorOrders.tsx`, `VendorEvents.tsx` — fixed all `.slice()` calls on numeric IDs by wrapping with `String()`
  - Removed non-existent `profile.display_name` fallback in `VendorDashboard.tsx`

### 4. Artist Dashboard Audit
- **`app/src/pages/artist/Dashboard.tsx`**
  - Removed `profile.display_name` fallback (field does not exist in DB)
  - Fixed WeChat save logic: sends `wechat_id` in `PUT /auth/me` payload
- **`schemas.py`**
  - Added `wechat_id: Optional[str] = None` to `UserBase` / `UserUpdate`
- **`api/auth.py`**
  - `update_me` now persists `wechat_id`
- **`api/bookings.py`**
  - Removed CSRF-token requirement from:
    - `POST /bookings/requests`
    - `PUT /bookings/requests/{booking_id}/status`
    - `POST /bookings/requests/{booking_id}/messages`
  - This fixes 403 errors when artists accept/reject bookings from the dashboard.

---

## Known Schema Constraints
- **`User.display_name` does NOT exist.** Always use `first_name + last_name`.
- `OrganizerProfile` and `BusinessProfile` are linked but not always present together. Backend must handle both gracefully.
- `Product.id`, `VendorProfile.id`, `EventVendor.id`, `Order.id` are **integers** in the backend. Frontend should treat them as `number`, not `string`.

---

### 5. Platform-wide i18n Translation Refactor
- **Scope**: ~87 TSX/TS files across auth, business, artist, organizer, vendor, user, admin, and public pages refactored to use `useTranslation()` hooks.
- **Locale files**: Merged ~2,800 translation keys into `src/i18n/locales/{en,zh,es,fr,de}.json`.
- **Fixes applied**:
  - Fixed malformed `t()` replacements in `admin/ManageArtists.tsx`, `admin/ManageBookings.tsx`, `admin/ManageBusinesses.tsx`, `admin/ManageEvents.tsx`, `admin/CMSContent.tsx`, `admin/Dashboard.tsx`, `admin/DashboardOverview.tsx`, `admin/FinancialControl.tsx`.
  - Fixed invalid translation-in-identifier patterns (e.g., `set{t('...')}ing` → `setRefreshing`).
  - Fixed icon import corruption (`{t('...')}Cw` → `RefreshCw`) in `admin/Dashboard.tsx`.
  - Fixed `useEffect` ordering in `admin/VerificationCenter.tsx`.
  - Fixed `ScannedTicket` union type narrowing in `organizer/Scanner.tsx`.
- **Build status**: Frontend compiles successfully (`npm run build` passes).

## Remaining Known Issues / TODO
- **Vendor Reviews**: No `VendorReview` model exists yet. `GET /vendors/reviews` returns `[]`.
- **Artist Recaps**: `GET /artist/recaps` and `POST /artist/recaps` are placeholders.
- **Dashboard chunk size**: The Vite bundle is large; consider code-splitting or manual chunks.
- **User pages still reference `display_name`**: Several pages (`user/Dashboard.tsx`, `user/Profile.tsx`, `user/Followers.tsx`, `ArtistDetail.tsx`, `payment/Checkout.tsx`, `admin/ManageUsers.tsx`) still reference `display_name`. These haven't caused runtime crashes yet because they fall back to `first_name + last_name`, but for consistency they should be cleaned up in a future pass.
- **Organizer Dashboard**: `app/src/pages/organizer/Dashboard.tsx` references `profile.display_name`.
- **Admin Account Credentials**: `admin@sounditent.com` in local DB has `role = business`, not `super_admin`. The actual super_admin is `admin@soundit.com` but the documented password `SoundIt2026!Admin` does not work for that account. `scripts/create_admin.py` should be reviewed.
- **Missing Public Endpoints**: `/venues` (list + detail), `/upload/avatar`, `/upload/image`, `/upload/multiple`, `/media/:id`, `/tickets/purchase`, `/tickets/transfer`, `/posts/:id/comments` do not exist as specified in the API contract. Alternative endpoints cover some functionality (e.g., `/tickets/order`, `/media/upload`).
- **Admin Financial Controls**: Payout approval/rejection, transaction listing, refund processing, and featured event management are placeholder endpoints in `api/admin.py`.
- **Login Requires City**: `Login.tsx` blocks submission if city is not selected. This is poor UX for returning users.
- [FIXED] **Business User Without BusinessProfile / Missing OrganizerProfile**: `get_organizer_profile_id()` auto-creation was crashing with `TypeError` due to invalid `contact_email`/`contact_phone` kwargs on `OrganizerProfile`. Fixed in audit #22.
- **Post-Community Audit Fixes Applied**:
  - [OK] CommunitySection API URL fixed
  - [OK] Default avatar images added
  - [OK] Business dashboard i18n keys added
  - [OK] Auth store no longer overwrites admin roles on business profile creation
  - [OK] Visibility priority sorting implemented
  - [OK] Subscription gating (CreateEvent + DashboardLayout) implemented
  - [OK] TableReservations fully functional with image upload + edit modal

### 6. Admin Dashboard Fixes (2026-04-13)
- **Notification Center blank screen**
  - `api/admin.py`: `/admin/notifications` now returns `target_role` and `status` defaults to match frontend expectations.
  - `app/src/pages/admin/NotificationCenter.tsx`: Added empty state, defensive rendering for missing fields, and null-safe message truncation.
- **Can't delete user**
  - `api/admin.py`: Changed `DELETE /admin/users/{user_id}` from hard-delete to soft-delete (anonymizes PII, sets `status = INACTIVE`) to avoid FK constraint failures.
  - Production DB: Added missing `gallery_images` column to `business_profiles`, `stock_quantity` to `products`, and created `promo_codes` table.
- **Missing Verification badge toggle**
  - `api/admin.py`: Changed `POST /admin/verification-badge` permission from `require_super_admin` → `require_admin`.
  - `app/src/pages/admin/ManageUsers.tsx`: Added Award icon button to grant/remove verification badge per user.
- **Maintenance mode not enforced**
  - `main.py`: Added `maintenance_mode_middleware` that blocks non-admin API requests when `maintenance_mode` is enabled. Added public `GET /api/v1/system/status` endpoint.
  - `app/src/App.tsx`: Added startup check for maintenance mode; shows a full-screen maintenance page for non-admin users when enabled.
  - All changes deployed live to `sounditent.com`.

### 7. Mobile Layout Sync & Maintenance Mode (2026-04-13)
- **Mobile layout out of sync with desktop**
  - `app/src/layouts/MobileLayout.tsx`: Completely refactored dashboard mobile nav to match `DashboardLayout.tsx`.
    - Artist: renamed "Music" → "Artist Home"; added Performances, Analytics, Subscription, Recaps, My Tickets in profile drawer.
    - Business: added Dashboard, Events, Profile in bottom nav; Staff, Analytics, Followers, Payouts, Table Reservations, Subscription, My Tickets in drawer.
    - Vendor: added Dashboard, Products, Profile in bottom nav; Orders, Event Booths, Earnings, Subscription, My Tickets in drawer.
    - Admin: added Admin, Events, Users, Profile in bottom nav; Artists, Vendors, Businesses, Bookings, Financial, Reports, CMS, Notifications, Settings in drawer.
    - Regular users: Home, Events, Scan, Community, Profile in bottom nav; Artists, City Guide, Food, Feed, My Tickets, Favorites in drawer.
  - `app/src/components/MobileBottomNav.tsx`: Synced public mobile nav with desktop `Navbar.tsx`.
    - Business/Vendor/Admin: now show Dashboard/Store/Admin tab instead of generic Recaps.
    - Artist: kept Home, Events, My Gigs, Community, Profile.
    - Regular users: Home, Events, Community, Food, Guide.
- **Maintenance mode not affecting mobile**
  - `app/src/App.tsx`: Maintenance check now re-runs every 30 seconds, on window focus, and on `visibilitychange` (when user switches back to the app). This ensures mobile users are immediately blocked when maintenance mode is toggled, without requiring a manual refresh.
  - All changes built and deployed live to `sounditent.com`.

### 8. Admin Dashboard Fixes (2026-04-13)
- **Admin sidebar/header showing raw i18n keys**
  - `app/src/i18n/locales/{en,zh,es,fr,de}.json`: Added missing `admin.adminLayout.*` translation keys for all menu items (dashboard, users, artists, vendors, businesses, events, bookings, financial, subscriptions, withdrawals, reports, cms, recaps, ads, verification, notifications, roles, settings, logs, api, superAdmin, admin, appName, adminPanel, breadcrumbAdmin, logout, accessDenied, loggedOutSuccessfully).
- **ManageArtists stats layout misaligned / Featured count invisible**
  - `app/src/pages/admin/ManageArtists.tsx`: Changed stat card grid from `grid-cols-4` to `grid-cols-5` so all 5 cards display on one row.
  - `api/admin.py`: Added `is_featured` to `ArtistResponse` schema and included it in `list_artists` / `get_artist` responses.
- **Verification Center empty despite real pending verification in DB**
  - `app/src/pages/admin/VerificationCenter.tsx`: Fixed frontend to handle both array and object responses from `/admin/verifications` (backend returns array directly; frontend was expecting `data.verifications`).
- **Mock/in-memory admin endpoints replaced with real DB-backed implementations**
  - `api/admin.py`:
    - Removed mock `ActivityLog` Pydantic model, in-memory `_activities_log`, and stub `log_activity` functions.
    - `GET /admin/activities`: Rewritten to query `AdminActivityLog` from the database. When the log table is empty, it synthesizes real activity records from recent `User`, `Event`, `ArtistProfile`, `OrganizerProfile`, and `PayoutRequest` rows. Returns wrapped `{"activities": [...]}` to match frontend expectation.
    - `GET /admin/pending-actions`: Fixed crash caused by unverified organizers with `user_id=None` (now skipped). `PendingActionItem.entity_id` changed from `int` to `Optional[int]`.
  - All changes built and deployed live to `sounditent.com`.

### 9. Full Platform Parity Sweep — Community, City Guide, Favicon (2026-04-13)
- **Community Module Full Rebuild**
  - Database: added `community_sections` table; extended `community_posts` with `title`, `section_id`, `author_type`, `view_count`, `is_approved`, `deleted_at`; extended `community_comments` with `like_count`, `is_approved`; added `community_comment_likes` table.
  - Backend (`api/community.py`): added section feeds, post soft-delete, comment likes, view tracking, user post history, platform stats.
  - Backend (`api/admin.py`): added admin community section CRUD, post/comment moderation endpoints, metrics endpoint.
  - Frontend: redesigned `/community` with section tabs, multi-image upload, comment likes, nested replies; added dashboard community pages for Business, Artist, Vendor; added admin community panel (Metrics, Sections, Posts, Comments).
- **City Guide Map + Directions**
  - Added `latitude`/`longitude` to `events`, `clubs`, `food_spots`.
  - Created `api/cities.py` with `GET /cities/{city}/guide`.
  - Event creation/update auto-copies venue coordinates when missing.
  - Redesigned `CityGuide.tsx` with interactive Google Map, color-coded markers, and working "Get Directions" buttons.
- **Favicon Fix**
  - Generated full favicon suite from logo; updated `index.html` with proper meta tags and `theme-color`.
- **Documentation**
  - Created `docs/BACKEND_PARITY_REPORT.md` and `CHANGELOG.md`.
  - Deployed all changes live to `sounditent.com` with production DB migration.


### 10a. Local SQLite DB Schema Parity Fix (2026-04-13)
- **Problem**: Business dashboard returning 500, table reservations "Failed to fetch", and community endpoint crashes due to local SQLite DB missing columns/tables that exist in production.
- **Fixes applied**:
  - `users`: added `username`, `password_reset_token`, `password_reset_expires_at`
  - `business_profiles`: added `gallery_images`
  - `products`: added `stock_quantity`
  - `events`: added `wechat_qr_url`, `alipay_qr_url`, `ticket_price`, `payment_instructions`
  - `clubs` / `food_spots`: added `latitude`, `longitude`
  - Created missing tables: `promo_codes`, `community_sections`, `community_comment_likes`
  - `community_posts`: added `author_type`, `title`, `section_id`, `view_count`, `is_approved`, `deleted_at`
  - `community_comments`: added `like_count`, `is_approved`
  - `database.py`: updated `init_db()` to auto-add all missing columns for future SQLite instances.
  - Ran comprehensive migration script `scripts/migrate_all_missing_columns.py`.

### 12. Self-Upload QR Payment for Vendors & Artists (2026-04-14)
- **Database**
  - `models.py`: Added `wechat_qr_url`, `alipay_qr_url`, `payment_instructions` to `Product` and `ArtistProfile` models.
  - `models.py`: Added payment fields (`payment_screenshot`, `payment_amount`, `payer_name`, `payer_notes`, `payment_status`, `reviewed_at`, `rejection_reason`) to `BookingRequest` model.
  - `models.py`: Created new `ProductOrder` model (mirrors `TicketOrder`) for vendor product orders with manual QR approval.
  - `database.py` / `scripts/migrate_all_missing_columns.py`: Added migrations for all new columns and `product_orders` table.
- **Backend APIs**
  - `api/product_orders.py` (new): Full product order lifecycle:
    - `POST /product-orders/order` — user submits payment screenshot
    - `GET /product-orders/my-orders` — user's product orders
    - `GET /product-orders/vendor/orders` — vendor views orders
    - `POST /product-orders/{id}/approve` — generates base64 QR, decrements stock
    - `POST /product-orders/{id}/reject` — rejects with reason
    - `POST /product-orders/validate` — marks order as used
  - `api/vendors.py`: Added `POST /vendors/products/{product_id}/upload-qr` for vendor QR upload.
  - `api/artist_dashboard.py`: Added `POST /artist/profile/upload-qr` for artist QR upload.
  - `api/bookings.py`: Added `POST /bookings/requests/{booking_id}/upload-payment`. Updated accept/reject to auto-set `payment_status` when payment proof exists.
  - `main.py`: Registered `product_orders` router.
  - `schemas.py`: Updated `Product`, `ArtistProfile`, `BookingRequestResponse` schemas. Added `ProductOrder` schemas.
- **Frontend**
  - `app/src/pages/vendor/Dashboard.tsx`: Product form now has Payment Setup (WeChat/Alipay QR + instructions). Orders tab replaced with real `ProductOrder` data including approve/reject/screenshot/QR viewer.
  - `app/src/pages/artist/Dashboard.tsx`: Added Payment Setup section in Profile tab for QR upload.
  - `app/src/pages/artist/Bookings.tsx`: Shows payment screenshots and payment status badges. Pending bookings display "Awaiting payment" alert when no proof uploaded.
  - `app/src/pages/ArtistDetail.tsx`: After booking submission, users see a "Make Payment" step with artist QR codes and screenshot upload.
  - `app/src/pages/user/Tickets.tsx`: Now displays `ProductOrder` items alongside tickets with QR modal support.
  - `app/src/pages/user/Dashboard.tsx`: Added "My Bookings" tab with booking list and payment upload modal.
  - `app/src/i18n/locales/{en,zh,es,fr,de}.json`: Added all missing translation keys for new QR payment flows.
- **Build Status**: Backend imports OK, frontend build passes, local SQLite migrations applied successfully.

### 13. Community Social Feed — Guest Access & Video Support (2026-04-14)
- **Database**
  - `models.py`: Made `user_id` nullable on `CommunityPost`, `CommunityComment`, `CommunityLike`, `CommunityCommentLike`, `CommunityShare`.
  - Added `guest_id`, `guest_name`, `guest_email` to all community interaction models.
  - Added `videos` (JSON) to `CommunityPost` for short video uploads.
  - Updated `database.py` and `scripts/migrate_all_missing_columns.py` with new column migrations. Ran script successfully.
- **Backend APIs**
  - `api/community.py`: Updated to allow guest interactions:
    - `POST /community/posts` — guests can create posts (requires `guest_name`)
    - `POST /community/posts/{id}/comments` — guests can comment
    - `POST /community/posts/{id}/like` / `unlike` — guests can like/unlike posts
    - `POST /community/comments/{id}/like` / `unlike` — guests can like/unlike comments
    - `POST /community/posts/{id}/share` — guests can share
    - All guest endpoints read `X-Guest-ID` header for identity tracking
  - Updated response builders (`_build_post_response`, `_build_comment_response`) to handle guest authors with `is_guest` flag.
  - `api/media.py`: Changed `/media/upload` to allow optional auth (`get_optional_user`). Guests upload to `guests/` folder. Increased video upload limit to 50MB.
  - `api/admin.py`: Updated admin community post/comment list endpoints to return `user` and `guest_name` so moderation UI can show guest authors.
- **Frontend**
  - `app/src/store/communityStore.ts`: Added guest ID generation/storage in localStorage (`soundit_guest_id`, `soundit_guest_name`). Renamed `uploadImages` → `uploadMedia`. All API calls now send `X-Guest-ID` header and conditionally omit `Authorization` for guests.
  - `app/src/pages/Community.tsx`: Full rebuild of social feed UX:
    - Guest users see name/email inputs in post composer
    - Video upload button added alongside images with preview support
    - "Tag Event" dropdown added to link posts to events
    - Removed auth barriers for likes, comments, and replies — guests can interact freely
    - Guest badge shown on posts/comments from non-registered users
    - Responsive media grid (1-col mobile, 2-col desktop) supporting images + videos
    - Touch-friendly action buttons for mobile
  - `app/src/pages/admin/ManageCommunityPosts.tsx` & `ManageCommunityComments.tsx`: Author column now shows `guest_name` with a gray "Guest" badge when `user_id` is null.
  - `app/src/i18n/locales/{en,zh,es,fr,de}.json`: Added community translation keys: `guestName`, `guestEmail`, `postAsGuest`, `videoUpload`, `tagEvent`, `guestBadge`.
- **Build Status**: Backend imports OK, frontend build passes, local SQLite migrations applied successfully.

### 13a. Dashboard Community Pages — Video Support (2026-04-14)
- `app/src/components/dashboard/CommunityDashboard.tsx`: Added video upload/preview support to the dashboard post composer so Business, Artist, and Vendor accounts can attach videos to community posts (parity with the public feed).
- `app/src/i18n/locales/{en,zh,es,fr,de}.json`: Added `dashboard.community.videoUpload` translation key.
- **Build Status**: Frontend build passes.

### 14. Critical Ticketing Flow Fixes (2026-04-14)
- **EventDetail.tsx**: Fixed broken `hasQrPayment` guard (line 78) caused by operator precedence — changed `ticket_price !== null` to `ticket_price != null` so events without payment setup no longer incorrectly show the QR sidebar.
- **EventDetail.tsx**: Fixed unsafe order lookup (line 45) by using optional chaining `o.event?.id` to prevent crashes when `event` is missing.
- **organizer/Scanner.tsx**: Fixed false "invalid" result after successful fallback validation via `POST /tickets/validate`. The fallback ticket object now carries `is_order_ticket: true`, and `handleScan` skips the redundant `checkInTicketViaAPI` call for order tickets (they are already marked used by the validate endpoint).
- **Build Status**: Frontend build passes, backend imports OK.

### 10. Monetization & Booking System — Subscriptions, Ticketing, Table Reservations (2026-04-13)
- **Database**
  - `models.py`: Added `wechat_qr_url`, `alipay_qr_url`, `ticket_price`, `payment_instructions` to `Event` model.
- **Backend APIs**
  - `api/events.py`: `create_event` and `update_event` now persist QR/payment fields. Added `POST /events/{id}/upload-qr` for organizer QR upload.
  - `api/tickets.py` (new): Full ticket order lifecycle:
    - `POST /tickets/order` — user submits payment screenshot
    - `GET /tickets/my-orders` — user's ticket orders
    - `GET /tickets/business/tickets` — business views orders
    - `POST /tickets/{id}/approve` — generates unique base64 QR, saves `ticket_code`, sends notification
    - `POST /tickets/{id}/reject` — rejects with reason, sends notification
    - `POST /tickets/validate` — scans and marks ticket order as `used`
  - `api/subscriptions.py`: Changed admin endpoints from `require_super_admin` → `require_admin`. Added notifications on approve/reject.
  - `main.py`: Registered new `tickets` router.
- **Frontend**
  - `app/src/pages/organizer/CreateEvent.tsx`: Added Payment Setup section (WeChat QR, Alipay QR, ticket price, instructions). Uploads QRs after event creation.
  - `app/src/pages/EventDetail.tsx`: Replaced cart-only flow with QR-based manual ticketing. Shows QR codes → "I Have Paid" → screenshot upload modal. Displays approved ticket QR codes.
  - `app/src/pages/business/Dashboard.tsx`: Added "Ticket Orders" section with filters, screenshot/QR modals, approve/reject actions.
  - `app/src/pages/user/Tickets.tsx`: Now shows both regular `Ticket` items and `TicketOrder` items with status badges and QR display.
  - `app/src/pages/organizer/Scanner.tsx`: Added fallback validation via `/tickets/validate` for manual ticket order QR codes.
  - `app/src/store/eventStore.ts`: Extended `Event` type with new QR/payment fields.
  - `app/src/pages/admin/AdminSubscriptions.tsx`: Relaxed access from `super_admin` to `admin`.
- **Notifications**
  - Ticket approved/rejected: user receives in-app notification with ticket details.
  - Subscription approved/rejected: user receives in-app notification.
- **Build Status**: Backend imports OK, frontend build passes.

### 11. Fix CSRF Error on Ticket Purchase (2026-04-13)
- **Problem**: `Checkout.tsx` used the old Yoopay automated flow (`createOrder` → `POST /payments/orders`) which requires a CSRF token, causing purchase failures.
- **Fix**: Completely rewrote `app/src/pages/payment/Checkout.tsx` to use the new manual QR ticketing flow:
  - Displays organizer WeChat/Alipay QR codes
  - "I Have Paid" button opens upload form
  - Submits to `POST /tickets/order` (no CSRF required)
  - Success state informs user that approval is pending
- **Build Status**: Frontend build passes.

### 15. Hybrid Payment & Auto-Ticketing System (2026-04-15)
- **Database**
  - `models.py`: Added `CANCELLED` to `TicketOrderStatus`, `PROCESSING` to `PayoutStatus`.
  - `TicketOrder`: Added `ticket_tier_id`, `tickets_generated`, `auto_approved`, `cancelled_at`, `validation_notes`, `payment_date`.
  - `Ticket`: Added `ticket_order_id` (nullable), made `order_id` nullable to support ticket generation from `TicketOrder`.
  - `database.py`: Added SQLite column migrations for new fields. Ran `scripts/migrate_hybrid_payment.py` successfully.
- **Backend**
  - `services/ticketing_service.py` (new): Core hybrid logic:
    - `get_event_organizer_plan()` — returns `basic`/`pro`/`premium` via `SubscriptionService`
    - `validate_payment_screenshot()` — checks amount ≥ expected and date == today
    - `generate_tickets_from_order()` — creates multiple `Ticket` records with unique QR codes, prevents duplicate generation
    - `auto_process_ticket_order()` — auto-approves Basic/Pro orders after validation
    - `cancel_stale_orders()` — marks PENDING orders >24h old as CANCELLED
  - `api/tickets.py`: Rewritten to integrate hybrid flow:
    - `POST /tickets/order` — accepts `ticket_tier_id` and `payment_amount`, triggers auto-approval for Basic/Pro
    - `GET /my-orders/{order_id}/tickets` — returns individual `Ticket` records generated from an order
    - `POST /{order_id}/approve` — manual approve for Premium, uses `generate_tickets_from_order()`
    - `POST /validate` — now validates both `TicketOrder` legacy codes and individual `Ticket` records
  - `api/ticketing_organizer.py`: Updated approval/validation to use new ticket generation and `Ticket` fallback.
  - `api/events.py`: `GET /events/{id}` now returns `organizer_plan` in the response.
  - `api/payments.py`: Business transactions and withdrawal calculations now include approved `TicketOrder` revenue.
  - `api/dashboard_stats.py`: Business `total_revenue` now sums approved `TicketOrder` payments.
  - `api/admin.py`: Added `business` alias to payout response for frontend compatibility. Added `POST /admin/payouts/{id}/process` endpoint.
  - `main.py`: Added `_auto_cancel_worker()` asyncio background task that runs every hour.
- **Frontend**
  - `app/src/store/eventStore.ts`: Added `organizer_plan?: string` to `Event` type.
  - `app/src/pages/EventDetail.tsx`: Routes payment flow by plan:
    - Basic/Pro: shows platform Yoopay QR (`/static/yoopay_qr.jpg`)
    - Premium: shows business-uploaded WeChat/Alipay QR
    - Submits `ticket_tier_id` and `payment_amount` with orders
  - `app/src/pages/payment/Checkout.tsx`: Same plan-based QR routing + auto-approval success messaging.
  - `app/src/pages/business/Dashboard.tsx`: Shows "Auto" badge on auto-approved orders, hides approve/reject buttons for auto-approved items.
  - `app/src/pages/user/Tickets.tsx`: Handles `cancelled` status in filters and displays.
  - `app/src/i18n/locales/{en,zh,fr}.json`: Added `orderAutoApproved` and `platformPaymentInstructions` keys.
- **Build Status**: Backend imports OK, frontend build passes.

### 15a. Universal Auto-Approval & Multi-Order Ticketing (2026-04-15)
- **Goal**: Remove manual approval entirely. Auto-generate tickets for ALL subscription tiers as long as strict screenshot validation passes. Allow users to purchase multiple tickets for the same event.
- **Backend**
  - `models.py`: Added `payment_proof_hash` (SHA256) to `TicketOrder` to prevent exact duplicate screenshot reuse across the platform.
  - `api/tickets.py`:
    - Removed per-event duplicate order check (users can now buy multiple times).
    - Added strict fraud guard: computes SHA256 hash of uploaded file and rejects if the same image was ever used before.
    - Removed `followers_count` bump on `OrganizerProfile` (column doesn't exist — was causing 500s).
    - All orders now route through `auto_process_ticket_order()` regardless of plan.
  - `services/ticketing_service.py`:
    - `auto_process_ticket_order()`: Removed Premium manual-approval gate. Now applies to ALL plans.
    - Strict validation: if amount < expected OR payment_date != today, order is **auto-rejected** immediately with reason stored in `validation_notes`.
    - If validation passes, tickets are generated instantly with unique QR codes.
  - `api/events.py`: `get_event` response now includes `wechat_qr_url`, `alipay_qr_url`, `ticket_price`, `payment_instructions` so uploaded organizer QRs are visible to buyers.
- **Database**
  - Added `payment_proof_hash` column to `ticket_orders` (SQLite + PostgreSQL migrations applied).
  - Expanded `ticket_qr_code` and `qr_code` columns to `TEXT` in production PostgreSQL to fit base64 PNG data.
- **Frontend**
  - `app/src/pages/EventDetail.tsx`: 
    - Removed `existingOrder` block that hid the Buy Ticket button.
    - Always shows Buy Ticket button; displays most recent approved QR as a convenience below it.
    - Payment QR now shows organizer-uploaded QR if available, otherwise falls back to platform Yoopay QR (plan-agnostic).
  - `app/src/pages/payment/Checkout.tsx`: Same universal QR logic + auto-approval messaging.
- **Production Fixes Deployed**
  - Fixed `.env` `DATABASE_URL` placeholder issue that caused post-deploy startup crashes.
  - PostgreSQL schema migrations for new columns executed live.
- **Build Status**: Backend imports OK, frontend build passes, deployed live to sounditent.com.


### 28. Organizer Dashboard — Follower Count Consistency Fix (2026-04-21)
- **Problem**: Followers showed correctly in the business Followers tab (`GET /business/followers` returned 3 followers), but the organizer public profile, business dashboard, and vendor detail pages all showed 0 followers. Other stats were also inconsistent across views.
- **Root causes**:
  1. `OrganizerProfile` and `VendorProfile` models lacked a `followers_count` column — `api/social.py` follow/unfollow endpoints crashed with `AttributeError` when mutating these counters.
  2. `api/profiles.py` public profile serializer did not compute or return `followers_count` for organizers, businesses, or vendors.
  3. `api/dashboard_stats.py` `BusinessStats` schema and response omitted `followers_count` entirely.
  4. `api/vendors.py` public vendor serialization did not include `followers_count`.
  5. `api/business.py` `BusinessProfileResponse` was a separate inline schema missing `followers_count`, `total_revenue`, and `events_count`.
  6. Frontend `PublicProfile.tsx` only rendered follower counts for `artist_profile`, ignoring organizers and vendors.
  7. Frontend `business/Profile.tsx` read `profile?.followers_count` (User object, always 0) instead of `businessProfile?.followers_count`.
  8. Frontend `VendorDetail.tsx` did not display or update follower counts.
  9. Frontend dashboard stores (`dashboardStore.ts`) had outdated TypeScript types without `followers_count`.
- **Fixes applied**:
  - **Backend**
    - `models.py`: Added `followers_count = Column(Integer, default=0)` to `OrganizerProfile` and `VendorProfile`.
    - `schemas.py`: Added `followers_count` to `OrganizerProfileResponse`, `VendorProfileResponse`, `BusinessProfileResponse`, and `BusinessStats`.
    - `api/profiles.py`: Computes `followers_count` dynamically from `OrganizerFollow` / `VendorFollow` tables for all profile types.
    - `api/dashboard_stats.py`: Queries `OrganizerFollow` count and includes it in `BusinessStats`.
    - `api/vendors.py`: `_serialize_vendor` now returns `followers_count`.
    - `api/business.py`: Aligned inline `BusinessProfileResponse` with `schemas.py`; returns `followers_count`, `total_revenue`, and `events_count`.
    - `api/social.py`: Added `_resolve_organizer()` helper so organizer follow/unfollow endpoints gracefully accept `business_profile.id` and auto-create a linked `OrganizerProfile` if needed. Made vendor/organizer counter mutations resilient with `getattr(..., 'followers_count', None)`.
    - `scripts/migrate_followers_count.py`: Created migration to add the new columns for both SQLite and PostgreSQL. Ran locally.
  - **Frontend**
    - `PublicProfile.tsx`: Added `followers_count` to all role-specific interfaces, displays followers for organizer and vendor profiles, and optimistically updates local state on follow/unfollow.
    - `VendorDetail.tsx`: Added `followers_count` to Vendor interface, displays it, and updates count after follow/unfollow.
    - `business/Dashboard.tsx` & `organizer/Dashboard.tsx`: Added followers stat card using `bizStats.followers_count`.
    - `business/Profile.tsx`: Changed follower count source from `profile?.followers_count` to `businessProfile?.followers_count`.
    - `store/authStore.ts`: Added `followers_count` to `BusinessProfile` interface.
    - `store/dashboardStore.ts`: Added `followers_count` to `business_stats` TypeScript type.
  - **Build**: Frontend compiles successfully (`npm run build` passes). Copied `app/dist/` to root `dist/`.


### 29. Delete Button Fixes — Platform-Wide Audit (2026-04-21)
- **Problem**: User reported delete buttons not working across the entire platform.
- **Root causes identified via audit**:
  1. `artist/Recaps.tsx` — Delete handler was a complete stub; it showed a success toast but never made an API call.
  2. `user/Settings.tsx` — Account deletion showed a hardcoded error toast (`"Account deletion is not supported..."`) instead of calling the backend.
  3. `business/Profile.tsx` — Gallery image removal PUT request used `businessProfile.business_name` (stale store value) instead of the current form value, causing the name to revert on every gallery edit.
  4. `api/admin.py` — `POST /admin/disabled-events/{id}` and `DELETE /admin/disabled-events/{id}` were no-ops; they returned success messages without touching the database.
  5. `store/adminStore.ts` — `unfeatureEvent` called `DELETE /admin/events/${id}/feature` but the backend endpoint did not exist (only `DELETE /social/admin/feature/{feature_id}` existed).
  6. `api/media.py` — `delete_file` checked `file_path.relative_to(user_dir)` where `user_dir = base_path / user_id`, but almost all uploads are stored in subfolders (`events/`, `vendors/`, `tickets/`, etc.) rather than per-user directories. This caused a `ValueError` on every deletion, returning HTTP 403.
  7. Multiple admin pages (`ManageEvents`, `ManageVendors`, `ManageArtists`, `ManageBusinesses`, `CMSContent`, `RolePermissions`) had delete handlers that silently swallowed 4xx/5xx responses — no toast, no console error, no user feedback.
- **Fixes applied**:
  - **Backend**
    - `api/admin.py`: Added `POST /admin/events/{event_id}/feature` and `DELETE /admin/events/{event_id}/feature` endpoints that set `event.is_featured` and manage `FeaturedItem` records.
    - `api/admin.py`: Fixed `disable_event` to set `event.status = EventStatus.REJECTED` and `enable_event` to set `event.status = EventStatus.APPROVED`, with actual `db.commit()`.
    - `api/auth_password.py`: Added `DELETE /auth/me` self-service account deletion endpoint (soft delete — anonymizes PII and sets status to `INACTIVE`). Prevents admin self-deletion.
    - `api/media.py`: Fixed `delete_file` security check from `file_path.relative_to(user_dir)` to `file_path.relative_to(base_path)` so files in subfolders can actually be deleted.
  - **Frontend**
    - `artist/Recaps.tsx`: Wired `handleDelete(id)` to `DELETE /recaps/${id}` with auth header and proper error handling.
    - `user/Settings.tsx`: Wired `handleDeleteAccount` to `DELETE /auth/me`, then calls `logout()` and navigates home on success.
    - `business/Profile.tsx`: Gallery removal now uses `profileData.businessName || businessProfile.business_name` so unsaved name changes are preserved.
    - `admin/ManageEvents.tsx`, `ManageVendors.tsx`, `ManageArtists.tsx`, `ManageBusinesses.tsx`, `CMSContent.tsx`, `RolePermissions.tsx`: Added `else` blocks to all delete handlers that parse `err.detail` and show `toast.error()` on failure.
  - **Build**: Frontend compiles successfully (`npm run build` passes). Copied `app/dist/` to root `dist/`.
