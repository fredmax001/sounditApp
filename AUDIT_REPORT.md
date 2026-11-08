# Sound It Platform — Full Audit & Security Hardening Report
**Date:** 2026-10-25 · **Scope:** full codebase, dependencies, config, tests, production server (72.62.254.251 / sounditent.com)

---

## 1. Executive Summary

| Area | Before | After |
|---|---|---|
| Frontend known vulnerabilities (npm audit) | **14** (3 critical, 9 high, 2 moderate) | **0** |
| Backend known vulnerabilities (pip-audit) | **220** in 11 packages | **0** |
| Test suite | 20/22 (1 import error blocked the file, 2 stale tests) | **22/22 passing** |
| JWT library | python-jose 3.3.0 (unmaintained, 6 unfixed CVEs, forced vulnerable pyasn1/ecdsa) | **PyJWT 2.15.1** (maintained) |
| Production health | healthy (old stack) | healthy (fully upgraded stack, verified) |

Everything found was **fixed and deployed live** the same day. Rollback safety: pre-upgrade venv package list saved on server at `/var/www/soundit/venv_freeze_backup_20261024_162715.txt`.

---

## 2. Dependency Security (the big win)

### Frontend (`app/package.json`)
Fixed via `npm audit fix` + one major bump. Notable: `@capacitor/android` + `@capacitor/ios` **critical** fixes (your APK wrapper), `react-router` high, `axios` high, `zod` high, `tar` **critical**, `ws` high. `sharp` required a major bump (0.34 → 0.35.5). Final: **0 vulnerabilities**. Frontend rebuilt and deployed.

### Backend (`requirements.txt`)
| Package | Old | New | Why |
|---|---|---|---|
| fastapi | 0.109.0 | 0.162.0 | CVE + pulls patched starlette |
| starlette | 0.35.1 | 1.10.0 | 14 vulns (DoS, parsing) |
| pydantic | 2.5.3 | 2.14.1 | bug/security fixes |
| python-jose | 3.3.0 | **removed** | unmaintained; migrated to **PyJWT 2.15.1** |
| pyasn1 / ecdsa | 0.4.8 / 0.19.2 | **removed** | only needed by jose; no fix versions existed |
| python-multipart | 0.0.6 | 0.0.32 | **DoS in form parsing** (16 CVEs) |
| pillow | 10.2.0 | 13.0.0 | 60 CVEs (image parsing) |
| requests | 2.31.0 | 2.34.2 | 6 CVEs |
| urllib3 | 2.0.7 | 2.8.0 | 14 CVEs |
| cryptography | 42.0.0 | 50.0.2 | 15 CVEs |
| aiohttp | 3.9.1 | 3.14.5 | **84 CVEs** |
| boto3/botocore | 1.34.0 | 1.35.99 | enables patched urllib3 |
| python-dotenv | 1.0.0 | 1.2.2 | 2 CVEs |

### Compatibility fixes required by the upgrade (done)
1. **`main.py` validation handler** — pydantic 2.14 error context can contain raw `ValueError` objects; new starlette no longer stringifies them → added `_json_safe()` sanitizer. Verified: 422 responses now return clean JSON with `request_id` instead of 500.
2. **PyJWT migration** — `auth.py`, `security/enhanced_auth.py`, `services/push_service.py`: `from jose import JWTError, jwt` → `import jwt` / `from jwt import InvalidTokenError`. API is drop-in (encode/decode/headers incl. APNs ES256). Verified: full register → login → `/auth/me` roundtrip.

---

## 3. Secrets & Configuration Audit

- **Git hygiene: clean.** No real `.env` in git history; only `.env.example` is tracked. No hardcoded API keys in project code (only false positives inside vendored `.venv-*` copies of library files — recommend deleting those folders, see §6).
- **`.env.example` was incomplete** — 19 config settings existed in code but not in the template. **Fixed:** added all of them (Alibaba SMS, VAPID web push, APNs, CN_BASE_URL). Now 67/67 settings documented.
- **Production env (presence check only, no secrets read):**

| Integration | Status |
|---|---|
| Google login (client ID + secret) | ✅ SET — verified live (`/auth/google/config` → enabled: true) |
| WeChat pay/app | ✅ SET |
| Web push (VAPID) | ✅ SET |
| Twilio SMS | ✅ SET |
| SMTP email (Hostinger) | ✅ SET |
| JWT_SECRET / SECRET_KEY | ✅ SET |
| RESET_TOKEN_SECRET | ⚠️ was falling back to JWT_SECRET → **generated & added a dedicated secret** |
| Sentry error tracking | ❌ not set (optional — add SENTRY_DSN to catch live errors) |
| OpenAI (SIA assistant) | ❌ not set (optional — rule-based SIA works without it) |
| APNs native iOS push | ❌ not set (optional; web push works) |

---

## 4. Bugs Found in Production Logs (fixed)

1. **`GET /api/v1/analytics/visits/devices` → 500.** `analytics_events.event_data` is TEXT but the query used JSONB `->>` operator. **Fixed** with dialect-aware SQL (`::jsonb` on Postgres, `json_extract` on SQLite). Verified against prod DB (returns real data, e.g. 1710×1107).
2. **`GET /api/v1/admin/bookings` → 500.** Response validation rejected fractional `duration_hours` (1.5). Prod code already declares `Optional[float]` — stale workers were running old code; resolved by the restart, and code re-verified.

---

## 5. Tests

- Fixed the pre-existing import error that blocked `tests/test_security_fixes.py` (root cause was the old jose dependency chain — resolved by the PyJWT migration).
- Fixed 2 stale tests: `test_ticket_race_condition_protection` (used a non-existent `location` field → `address`/`city`; model enforces NOT NULL), `test_subscriptions.py` (was written against production DB + old 9-plan seed → rewritten self-contained with in-memory DB, 10 monthly/yearly configs).
- **Result: 22/22 passing**, plus live smoke suite (health, frontend, docs, food directory, events, register/login/me) green on the new stack — both locally and on production.

---

## 6. Recommendations (not yet done — your call)

1. **Delete stale local venv copies** `.venv-1/` and `.venv-ui/` at the workspace root (7+ GB, contain outdated libraries; they pollute searches and scans).
2. **Add Sentry** (`SENTRY_DSN` in prod `.env`) — the code already supports it; you'd see live errors like the two above instantly instead of from logs.
3. **Backup cadence**: the Postgres DB is the platform's crown jewel — suggest a nightly `pg_dump` cron (I can set this up).
4. **Re-enable SIA for your users** — see §7.
5. HTTPS already enforced; CORS, rate limiting, security headers, HMAC reset tokens, and admin privilege separation were verified in place (entries 59–61 of the work log still hold on the new stack).

---

## 7. "How can you add yourself inside for my users?"

The **SIA (Sound It Assistant)** is already built into your backend — chat with live platform data (events, tickets, venues, artists), a 37-FAQ knowledge base, escalation queue, and admin FAQ management (`api/assistant.py`, `services/sia_service.py`). The floating chat UI was hidden pending review. To put it in users' hands:

- **Option A (fast):** re-enable the floating assistant button + drawer (public mode: discovery/FAQ/tickets help; dashboard mode: draft creation for organizers/vendors). ~1 deploy.
- **Option B:** also wire an `OPENAI_API_KEY` so SIA can answer free-text questions beyond the FAQ with the same guardrails (never auto-publishes, escalates honestly).
- **Option C (mobile-native feel):** dedicated "SIA" tab in the mobile bottom nav.

Say the word and I'll turn Option A on.
