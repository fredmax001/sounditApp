# Changelog

All notable changes to the Sound It platform will be documented in this file.

## [Unreleased] — 2026-04-16

### Logo Sizing Fix
- **Navbar.tsx**: Reduced main site header logo from `h-20 lg:h-24` to `h-10 lg:h-12` (~50% reduction).
- **MobileHeader.tsx**: Fixed invalid `h-30` class to `h-10` for mobile main site header.
- **DashboardLayout.tsx**: Increased desktop dashboard sidebar logo from `h-10` to `h-16`.
- **MobileLayout.tsx**: Increased mobile dashboard header logo from `h-6` to `h-12`.

### Discovery Hub — Artists Fix
- **Backend (`api/artists.py`)**: Changed `get_featured_artists` from inner `join(ArtistProfile)` to `outerjoin(ArtistProfile)` so artists appear even if profile join has issues.
- **Backend (`api/cities.py`)**: 
  - Changed artist query in `get_city_guide` from inner `join` to `outerjoin`.
  - Fixed timezone-aware event filtering (`datetime.now(timezone.utc)` instead of naive `utcnow()`).
  - Added `avatar_url` from joined `User` for businesses and organizers.
- **Frontend (`CityGuide.tsx`)**: Default city fetch now falls back to Shanghai when no city is selected.
- **Frontend (`cityGuideStore.ts`)**: Map `avatar_url` to `image` for businesses and organizers.
- **Frontend (`CityGuide.tsx`)**: Relaxed `featuredItems` filter so verified artists with 0 followers can appear.

### Avatar / Placeholder Image Fix
- Created `app/public/placeholder-club.jpg` and `placeholder.jpg` to fix broken image icons on discovery cards.
- Regenerated `default-avatar.jpg` and `default-avatar.png` as proper image files (were corrupted SVGs with wrong extension).
- Added `onError` fallback handlers to all discovery card images so broken URLs fall back to the placeholder.

## [Unreleased] — 2026-04-13

### Community Module — Full Rebuild

#### Backend
- Added `community_sections` table for post categories.
- Extended `community_posts` with `title`, `section_id`, `author_type`, `view_count`, `is_approved`, `deleted_at`.
- Extended `community_comments` with `like_count`, `is_approved`.
- Added `community_comment_likes` table.
- Enhanced `api/community.py` with section-based feeds, soft-delete posts, comment likes, view tracking, user post history, and platform stats.
- Added admin community endpoints in `api/admin.py` for section CRUD, post/comment moderation, and metrics.

#### Frontend
- Redesigned `/community` feed with section tabs, multi-image upload, comment likes, and nested replies.
- Added dashboard community pages for Business, Artist, and Vendor personas.
- Added admin community panel: Metrics, Sections, Posts Moderation, Comments Moderation.

### City Guide Map + Directions

#### Backend
- Added `latitude`/`longitude` to `events`, `clubs`, and `food_spots`.
- Created `api/cities.py` with `GET /cities/{city}/guide` returning events, venues, and food spots with coordinates.
- Event creation/update now auto-copies venue coordinates when lat/lng is missing.

#### Frontend
- Redesigned `CityGuide.tsx` with interactive Google Map and scrollable side list.
- Added color-coded markers (Events=blue, Venues=amber, Food=green).
- Added "Get Directions" buttons with mobile intent and desktop Google Maps fallback.

### Favicon Fix
- Generated full favicon suite from `logo.png`.
- Updated `index.html` with proper meta tags and `theme-color`.

### Platform Parity
- All visible community features are now backed by real database tables and APIs.
- No placeholder UI remains in the community or city guide modules.
