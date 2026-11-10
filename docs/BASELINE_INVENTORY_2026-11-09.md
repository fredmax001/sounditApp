# Sound It application inventory and baseline

**Captured:** 2026-11-09 (Asia/Shanghai)

**Scope:** Baseline and inventory only. No application code, database, deployment, or live integration was changed.
**Audit status:** The full engineering audit in the supplied brief has not started.

## Current workspace state

- Branch: `main`, reported as 12 commits ahead of `upstream/main`; HEAD `7de0507` (`fix(api): use require_admin dependency in smart_notifications`).
- The checkout was already dirty at inspection. It includes modifications to `AGENTS.md`, application source, `models.py`, `schemas.py`, Android build files, and several untracked Android packages and a source file. These were left untouched.
- `git status` also reported a Git fsmonitor IPC error; status output still identified the branch and dirty paths.
- No test, build, migration, seed, or deployment command was run.

## Repository and application inventory

- **Backend:** Python 3.11-style application using FastAPI, SQLAlchemy 2, Pydantic settings, Uvicorn, PostgreSQL (`psycopg2`), with SQLite support for local/test operation. Application entry point is `main.py`; configuration is in `config.py`; DB engine/session/init logic is in `database.py`; ORM definitions are in `models.py`; request/response schemas are in `schemas.py`.
- **Frontend:** React 19, TypeScript, Vite 7, Zustand, Axios/fetch, Tailwind CSS. Main source is `app/src`; package manifest is `app/package.json`.
- **Native clients:** Capacitor 8 Android and iOS projects under `app/android` and `app/ios`; separate Electron client under `electron`.
- **API surface:** 52 Python files under `api/`; 689 decorator matches for HTTP route declarations under `api/`. These are source counts, not proof all routes are mounted, reachable, secure, or functional. `main.py` mounts the major feature routers with `/api/v1` and mounts the sitemap router separately.
- **Frontend inventory size:** 137 page files under `app/src/pages`, 119 component files under `app/src/components`, and 4 files under `tests/` (counts include nested paths).
- **Feature areas visible from router/store/file names:** authentication and password flows; users/profiles; artists; businesses/vendors; events/discovery/cities/venues; ticketing/orders/payments; bookings/table reservations/drinks; community/reels/recaps; notifications and messaging; subscriptions; promotions/promoters; reviews; analytics/admin; media; points; newsletter; and assistant/SIA.
- **Deployment artifacts:** `deploy/sounditent.service`, `deploy/` scripts and multi-region folder, plus local `dist/`, `app/dist/`, Android and iOS packaged assets. The service unit runs Uvicorn from `/var/www/soundit/current`, reads `/var/www/soundit/current/.env`, and binds to `127.0.0.1:8000`; this is repository configuration, not confirmation of the active host's current unit or process.

## Data sources and environment wiring

| Layer | Evidence found | Baseline conclusion |
|---|---|---|
| Backend local `.env` / `.env.local` | SQLite URL (`soundit_local.db`) and local Redis URL | Backend local settings appear intended for isolated development. |
| Backend `.env.production` in this checkout | PostgreSQL URL on localhost naming database `soundit_prod` | Production-shaped local file exists but is ignored by Git. Its presence does not show that production uses it. |
| Production service unit | External host `.env` at `/var/www/soundit/current/.env` | The production process should get settings from the deployed host file; that host file and active process were not accessible here. |
| Work log | Repeatedly names live PostgreSQL database `soundit_prod` and `soundit.service` | This is consistent with the intended production data source, but is historical documentation, not a live DB connection check. |
| Frontend env | `app/.env`, `app/.env.local`, and `app/.env.production` set `VITE_API_URL` to `https://sounditent.com/api/v1`; app production env also defines the production WebSocket URL. | **Environment separation is not established:** local Vite development config points at the production API, even though the local backend `.env` points at SQLite. Local UI actions can therefore reach production API/data. No distinct staging API target was found in these inspected env files. |
| Frontend fallback | Several stores default `VITE_API_URL` to `https://sounditent.com/api/v1`; `app/src/lib/appUrl.ts` defaults native share/media URLs to the production domain. | Missing frontend API configuration can silently direct requests to production. This is a material safety gap for development isolation. |
| Direct DB initialization | `database.py` creates an engine from `DATABASE_URL`; production uses connection pooling for non-SQLite DBs. `main.py` invokes `init_db()` during app lifespan; `init_db()` has SQLite `create_all` and compatibility alterations. | No data/schema change was invoked during this baseline. Startup behavior and any production-side schema operations need careful review during the later audit. |
| Supabase | `app/src/lib/supabase.ts` labels itself deprecated and exports `null`; stores say data flows through backend API. Supabase remains a frontend dependency. | Supabase is not evidenced as the current primary app-record source; investigate any residual usage during audit. |

**Production data source conclusion:** The strongest available evidence says production records are served by the FastAPI backend connected to PostgreSQL `soundit_prod`, with the production process configured from the deployed host `.env`. The production database itself and its runtime connection were not directly inspected, so the exact active host/database identity remains **not independently verified**.

## Live baseline checks

- A single explicitly escalated, read-only GET to `https://sounditent.com/api/v1/events` returned HTTP 200.
- Follow-up requests for events, artists, and businesses failed DNS resolution in the restricted execution environment (`Could not resolve host`). The browser search/open tool also could not access those API URLs.
- Therefore API availability is **intermittently observed, not established**. No response body, record counts, names, emails, or other user data was retained or reported. The live population of users, artists, businesses, and events remains unverified. Do not interpret HTTP 200 alone as confirmation that expected real records are present.
- The repo work log (entries 161 and 168, dated 2026-11-09) records previous HTTP 200 checks for `/api/v1/events`, `/api/v1/artists`, `/api/v1/businesses`, `/api/v1/reels`, and `/api/v1/community/posts`; those are historical claims and were not reproduced here except for the one events request.

## Integrations identified from settings/dependencies

Configured or represented in `config.py`, `.env.example`, backend modules, or dependencies: PostgreSQL/SQLite; Redis; SMTP/SendGrid/Hostinger; Twilio and Alibaba SMS; Google OAuth; Stripe; YooPay; WeChat; AWS S3; VAPID web push and APNs; OpenAI for optional SIA; HearThis/RapidAPI; Supabase client dependency; Google Maps (frontend env); and native Capacitor social login/share/push. This is a discovered integration inventory, not proof that credentials are valid or integrations are currently operational. Webhooks, callback signatures, timeout/retry behavior, and actual credential scope remain unaudited.

## Data-safety baseline and immediate observations

1. **Development can target production:** local frontend env files point to the production API. This directly weakens environment isolation and is the primary control gap to address before any broader audit activity that might exercise write paths.
2. **No staging environment is evidenced** by the inspected environment files or deployment unit. A distinct staging API/database and its protections remain unverified.
3. **Mock/demo risk markers exist:** source search found demo-prefixed event IDs in organizer UI code. Their origin, visibility, write behavior, and relationship to the reported real-data disappearance incident have not been traced; this baseline does not claim they are currently served to users.
4. **Ignored local environment files contain credential-like populated values.** Their values are intentionally omitted from this report. Keep these files out of version control; if any populated value is valid and has been exposed outside its intended secret store, rotate it. No credentials were used to access a service.
5. **Do not use `.env.production` from this workstation as proof or as a connection target.** No SQL query, schema inspection, or row-level production access was attempted.

## Baseline verdict

The repository and intended production architecture are identifiable, and the intended primary record source is PostgreSQL behind the FastAPI service. **Environment separation currently fails the baseline check** because local frontend configuration targets the live production API. The active production DB connection and record population could not be independently verified from this workspace. Production readiness, data integrity, integrations, and feature health are **not assessed yet**; completing those requires a controlled audit plan that first prevents accidental production writes and then uses explicit read-only live checks plus isolated development/staging systems.

## Next safe audit gate

Before running functional tests or exercising write-capable flows, establish an isolated development API/database and a staging environment, remove the implicit production API fallback from development configuration, and verify that test data cannot reach the production service. Then obtain an approved, read-only production verification path for endpoint health and aggregate counts (no personal data), and continue with static source tracing. This baseline report itself makes no code or infrastructure changes.
