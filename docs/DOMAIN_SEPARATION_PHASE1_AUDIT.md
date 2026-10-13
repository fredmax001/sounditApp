# Sound It: Domain Separation, Phase 1 Audit and Plan

Date: 2026-10-10
Branch: `feature/domain-separation`
Status: Audit complete, awaiting owner approval before any local implementation or production change.

---

## 1. Audit of the Existing System

### 1.1 Current architecture (verified, not assumed)

| Layer | Reality |
|---|---|
| Backend | One FastAPI monolith (`main.py`, `api/*.py`), served by uvicorn on `127.0.0.1:8000`, 4 workers, systemd unit `soundit` |
| Frontend | One React 18 + TypeScript + Vite SPA (`app/`), output in `app/dist/`, containing public pages, user dashboards, role dashboards, and the admin dashboard in a single bundle |
| Serving | nginx on `72.62.254.251` serves the SPA for all hostnames, proxies `/api/`, `/health`, `/sitemap.xml`, `/robots.txt`, and SEO routes (`/events`, `/artists`, `/vendors`, `/profiles`, ...) to FastAPI; FastAPI injects dynamic OpenGraph meta tags via `api/meta_tags.py` |
| Domains | `sounditent.com`, `www.sounditent.com`, `app.sounditent.com`, `sounditent.cn`, `www.sounditent.cn` all resolve to the same server and are served by the **same** nginx server block and the **same** application. Verified from the server: `app.sounditent.com` is an alias of the root site today, not a separate deployment |
| Database | One database. PostgreSQL in production (`soundit_prod`), SQLite locally. One source of truth for users, events, orders, tickets |
| Auth | JWT bearer tokens (access + rotating refresh), stored client-side by the SPA. Roles: `user`, `business`, `artist`, `admin`, `super_admin`, `vendor`, `organizer` (`models.py:8`). Plus granular admin-role permissions (`/admin/admin-roles`, fetched into the auth store) |
| Payments | Alipay / WeChat Pay manual-QR flows (`api/payments_manual_qr.py`) plus existing payment endpoints (`api/payments.py`); organizer-side approval of reported payments |
| Mobile | Capacitor Android app (package now `app.sounditent.com`) bundling the same SPA; APK/AAB signed with the Sound It release keystore |
| Deploy | Versioned releases under `/var/www/soundit/releases/`, symlinked `current`; targeted rsync of changed files + `systemctl restart soundit`; rollback = repoint symlink + restart. All prior deploy patterns documented in `AGENTS.md` |

### 1.2 Admin Dashboard inventory (Section 11 compliance)

**Location:** the Admin Dashboard is part of the authenticated React SPA, not a separate app.

- **Routes:** 33 admin routes under `/admin/*` in `app/src/App.tsx` (lines 522-658), wrapped in `AdminLayout`, plus 3 redirect aliases (`/admin/dashboard`, `/admin/finance`, `/admin/payments`).
- **Pages (30 components in `app/src/pages/admin/`):** Dashboard (overview + stats + pending actions), Analytics, ManageUsers, ManageArtists, ManageVendors, ManageBusinesses, ManageEvents, ReviewEvents, ManageBookings, FinancialControl, Payments, WithdrawalRequests, ReportsModeration, ManageRecaps, CMSContent, IntroScreen, NotificationCenter, RolePermissions, SystemSettings, SecurityLogs, APIIntegrations, AdsManager, AdminSubscriptions, VerificationCenter, CommunityMetrics, ManageCommunitySections, ManageCommunityPosts, ManageCommunityComments, plus SimpleTest.
- **Client-side guard:** `AdminLayout.tsx` reads `isAdmin`/`isSuperAdmin`/`hasPermission` from the auth store and redirects non-admins to `/`.
- **Server-side enforcement (verified):** `api/admin.py` (7,180 lines, 173 route handlers) requires `Depends(require_admin)` / `require_super_admin` (imported from `auth.py`) on privileged endpoints. The role-based permission system (`admins_write`, etc.) filters sidebar items client-side and is re-checked server-side per endpoint group.
- **What admin controls that is public-facing:** CMS content, Intro/splash screen (`/api/v1/system/intro-screen`, read publicly by `main.py`), Ads, Recaps (public galleries), community moderation, event approval/verification (controls what appears on public event listings), notifications/broadcasts, system settings, feature flags. All of this continues to flow to the public site through the **same** API and database, so published changes appear regardless of which domain serves the public pages.
- **Legacy artifact:** `static/admin/dashboard.html` exists and FastAPI has a `GET /admin` endpoint, but nginx's SPA fallback serves the React app for `/admin`, so the static file is unreachable in production. No action needed; do not delete without owner sign-off.
- **Conclusion for Section 11:** the current dashboard is entirely inside the SPA at `app.sounditent.com` today and stays there. No admin functionality needs to move; nothing about the separation removes, renames, or duplicates any admin route, role, or permission.

### 1.3 URL inventory (what exists today)

- Public/marketing: `/`, `/about`, `/contact`, `/press`, `/careers`, `/help`, `/terms`, `/privacy`, `/refund-policy`, `/user-agreement`, `/organizer-agreement`, `/cross-border-consent`, `/verification-policy`, `/download` (new), plus SEO-proxied `/events`, `/artists`, `/vendors`, `/profiles`, `/city-guide`, `/food`, `/recaps`, `/community`.
- Application: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/cart`, `/checkout/:eventId`, `/tickets`, `/scan`, `/on-site-tools`, `/validate/:token`, `/profile`, `/dashboard*`, role dashboards, messaging, and all `/admin/*`.
- Shared event identifiers: numeric event IDs; canonical public link format `https://sounditent.com/events/{id}`, application link `https://app.sounditent.com/events/{id}` (same route, same data).

---

## 2. Proposed Target Architecture

Principle from the master prompt: smallest safe change. **One backend, one database, two frontends.**

- **app.sounditent.com:** the existing platform, exactly as it works today. The current SPA and all 173 admin API endpoints stay untouched. This satisfies Section 11 by construction: zero changes to admin routes, roles, or permissions.
- **sounditent.com:** a new, lightweight public entertainment website (separate small frontend, e.g. `web/` in this repo, static-buildable). It is read-only over the existing **public** APIs (events list/detail/featured/upcoming/past, recaps, artists, vendors), which already exist and require no auth (`api/events.py` public GETs verified).
- **Shared backend unchanged:** FastAPI continues to serve `/api/*`, SEO meta injection, sitemap, and everything else for both domains. nginx gets one new server block for the root domain serving the static public site, while `app.sounditent.com` keeps today's block.
- **Cross-domain links:** public site "Get Tickets" links to `https://app.sounditent.com/events/{id}`; "Join Sound it" to `https://app.sounditent.com/register`; portal links to the app domain. Existing `https://sounditent.com/events/{id}` links keep working (nginx proxies those paths to FastAPI meta injection as today, or redirects to the app domain per the redirect map below).

## 3. Files and Configurations Requiring Changes (planned, not yet executed)

| Area | Change | Risk |
|---|---|---|
| `web/` (new) | New public website frontend (homepage, about, events showcase, recaps, contact, Get Tickets / Join CTAs) | Isolated; does not touch the app |
| `deploy/nginx` conf | New root-domain server block serving `web/dist`; keep app block unchanged; proxy `/events|/artists|...` SEO routes and `/api` as today | Low; config-only, reversible |
| `app/` SPA | None for separation itself. Optional later: header links pointing to the public domain | Very low |
| Backend `main.py` / `api/*` | None required for Phase 2-3. Optional: CORS allow-list for the root domain if the public site calls the API cross-domain | Low |
| Database | Zero schema changes | None |
| Auth/cookies | No cross-subdomain session sharing introduced (per requirement). Each domain logs in independently on the app domain | None |
| DNS | No change needed; both names already point at the server | None |
| SSL | Existing cert must cover `app.sounditent.com` (verify at deploy time; certbot can extend if not) | Low |

## 4. URL Migration and Redirect Map

| Existing URL | Destination | Mechanism |
|---|---|---|
| `sounditent.com/` | New public homepage | nginx serves `web/dist` |
| `sounditent.com/events/:id` | Public event page on new site (same content, tickets button to app) | Keep proxying to FastAPI meta injection, or render on new site from public API; decide in Phase 2, either way link stays valid |
| `sounditent.com/artists, /vendors, /recaps, /community...` | Equivalent public pages on new site | 301 redirects preserving paths, or same-route rendering |
| `sounditent.com/login, /register, /tickets, /dashboard*, /admin*, /on-site-tools...` | `app.sounditent.com` equivalent path | 301 preserving full path + query |
| `app.sounditent.com/*` | Unchanged | No redirects |
| Deep links (`/checkout/:id`, `/validate/:token`) | `app.sounditent.com` same path | 301 preserving path + query |

Existing event IDs, order history, and ticket links are untouched because the database and the app routes do not change.

## 5. Security and Compatibility Risk Assessment

1. **Admin exposure (Section 11.5):** the public site is a separate static build with no admin code in its bundle. Privileged APIs remain server-enforced (`require_admin`/`require_super_admin`). Public site only consumes public GET endpoints. Residual risk: low.
2. **SEO/OpenGraph:** `sounditent.com/events/:id` rich previews must keep working. Mitigation: keep the existing FastAPI meta-injection proxy for SEO routes on the root domain during transition; new public pages add their own meta tags.
3. **Auth continuity:** no forced re-login, no password resets, no cookie scope changes. Users keep sessions on the app domain. Risk: low.
4. **Payments/ticketing:** no change to payment flows, webhooks, or return URLs in Phases 2-3. All stay on the app domain exactly as today. Risk: none for separation itself.
5. **China network:** the public site must be fast from mainland China; it will be static assets + public API reads, minimal blocking resources. Same hosting as today.
6. **Rollback:** nginx config change is one `reload` away from previous state; public site is additive (new directory), removing it restores today's behavior. App-side changes: zero.

## 6. Implementation Plan (phases, per master prompt Section 8)

- **Phase 1 (this document):** audit + backup verification + plan. Backup: nightly PG dumps exist on server (`/var/www/soundit/...` releases + `soundit-uploads`); before any production step, take a fresh `pg_dump` and copy of nginx conf. Rollback path documented in `AGENTS.md` deploy notes.
- **Phase 2 (local only):** build `web/` public site locally against the local backend; simulate `sounditent.local` / `app.sounditent.local` via `/etc/hosts`.
- **Phase 3 (local only):** prepare nginx conf for both server blocks; dry-run with `nginx -t` equivalent locally where possible; stage config on server only after approval.
- **Phase 4 (local only):** cross-domain navigation, redirect map, shared event data verification.
- **Phase 5 (local/staging testing):** full checklist from Section 9 of the master prompt, executed locally: login/logout, registration, password recovery, artist/organizer/vendor onboarding, event publish + discovery, ticket purchase flow (sandbox/safe procedures), order history, notifications, permissions, admin regression (all 33 routes render, guarded), mobile responsiveness, redirects.
- **Phase 6 (production, ONLY after explicit approval):** backup, deploy public site to `/var/www/soundit/web/`, switch root-domain nginx block, smoke tests, monitor.

## 7. Testing and Rollback Checklist (to be executed and recorded in Phase 5)

- [ ] Local backend boots clean; local DB is a sanitized copy, never production
- [ ] `npm run build` passes for both `app/` and `web/`
- [ ] Existing-user login/logout on app domain
- [ ] Registration + email verification, password recovery
- [ ] Artist, organizer, vendor onboarding flows
- [ ] Event creation, publish, discovery; public site shows the same event data
- [ ] Ticket purchase (safe/test mode) + order history retrieval
- [ ] Admin login; all 33 admin routes render; non-admin access is rejected client-side **and** server-side (401/403 on `/api/v1/admin/*`)
- [ ] Admin-published changes (CMS, intro screen, recaps, event approval) appear on the public site
- [ ] Redirects: old public paths, deep links, query parameters preserved, no loops
- [ ] SEO meta on public event pages (curl crawler check)
- [ ] Mobile + desktop rendering of both sites
- [ ] No admin assets or privileged API calls in the public site bundle

Rollback: restore previous nginx conf + `systemctl reload nginx`; public site directory removal; app deployment untouched throughout.

---

## Outstanding Questions for Owner

1. Public event pages on the root domain: render on the new public site from the API (cleaner long-term), or keep proxying `/events/:id` to the existing meta-injection (smallest change)? I recommend rendering on the new site with server-side meta tags.
2. Visual direction for the new public site: reuse the existing brand kit (black + `#d3da0c` lime + pink accent) with an entertainment/editorial feel, or do you want a distinct direction?
3. Language coverage on the public site: English only, or EN/ZH/FR from day one (app already has all three)?

---

## Phase 2 Results (Local Implementation and Testing, 2026-10-10)

**Status: complete locally. NOT deployed. Awaiting owner approval before any production change.**

### What was built

- `web/`: new public entertainment website (Vite + React 18 + TS + Tailwind, react-i18next EN/zh/fr).
  - Pages: Home (hero, Featured Events from `/api/v1/events/featured`, Upcoming strip, recaps teaser, artists strip, partner portals), Events (Upcoming/Past tabs), public Event Detail (info, lineup, gallery, min price, Get Tickets deep link to `app.sounditent.com/events/{id}`), Recaps, Artists, About (mission/vision/story/how it works), Contact + FAQ, 404.
  - Language selector with persisted choice; content fields use `title_cn` when present, French falls back to English source per project rules.
  - All data comes from existing public GET endpoints. No new backend endpoints were needed. The only API adjustment is client-side: the public site requests `/events/upcoming?days=90&limit=50` because the endpoint's default window is 7 days.
- `main.py`: host-aware frontend serving. `PUBLIC_SITE_HOSTS = {sounditent.com, www.sounditent.com, sounditent.cn, www.sounditent.cn}` get `web/dist` (with existing dynamic OpenGraph meta injection preserved); `app.sounditent.com`, localhost, and all other hosts keep the existing `app/dist` application. Guarded by `os.path.isdir("web/dist")` so production behavior is unchanged until `web/dist` exists on the server.
- `scripts/test_host_aware_serving.py`: 15-check host-routing test suite.

### Tests actually executed (local)

1. `npm run build` for `web/`: passes (383 KB JS, 122 KB gzip).
2. `python3 -m py_compile main.py`: passes.
3. `scripts/test_host_aware_serving.py` against local backend: **15/15 PASS** (public hosts get web build; app hosts get app SPA; www/CN variants; OG meta injection preserved on event paths for both host families; API identical on both hosts; static assets; health).
4. Browser verification (in-app browser, dev server proxying read-only public API):
   - Home renders with live data: featured card "AFTER 90's Halloween Party" (31 OCT, Shanghai, From CN¥1, Get Tickets), artists strip (Fred Max, GerryBeatz, C-Official, DJ ANONYMOUS), portals, footer with app link. Screenshots captured.
   - `/events` lists the event after the days=90 fix (was empty with the endpoint's 7-day default; root cause verified in `api/events.py`, no backend change made).
   - `/events/13`: document title "AFTER 90's Halloween Party | Sound It Entertainment"; Get Tickets links to `https://app.sounditent.com/events/13`.
   - Language switch to Chinese renders localized hero ("城市的 声音") and content.
5. Admin Dashboard regression: no admin routes, roles, permissions, or `api/admin.py` endpoints were touched. Host logic only changes which static index.html is served on public hostnames.

### Environment notes

- Local DB `soundit_local.db` schema was synced (14 missing columns added via ALTER TABLE, mirroring `models.py`; idempotent) and `scripts/migrate_indexes.py` run. Local dev DB only; production untouched.
- Test venv for backend smoke tests lives at `/tmp/sitestenv` (Python 3.12, minimal deps). The project's `.venv` (Python 3.9) cannot be executed through this tool's shell.

### Files changed in Phase 2

- Added: `web/` (entire public site), `scripts/test_host_aware_serving.py`, this documentation.
- Modified: `main.py` only (host-aware `root()` and `serve_frontend()`).

### Not done yet (requires approval)

- Production: upload `web/dist` to server, nginx root-domain server block serving it, SSL check for `app.sounditent.com`, sitemap/robots review, redirect map for app paths hitting the root domain, Phase 5 staging checklist, monitoring.
