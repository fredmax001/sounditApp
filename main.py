import os
import asyncio
import logging
import uuid
import traceback
import time
from importlib import import_module
from contextvars import ContextVar
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager

from config import get_settings
from database import init_db, SessionLocal
from models import SystemSetting, User, UserRole
from auth import decode_REDACTED_PLACEHOLDER as decode_token
from utils.logging_config import setup_logging
from api import auth, auth_password, events, payments, admin, admin_payment_verification, clubs, foodspots, vendors, dashboard_stats, bookings, media, contact, artists, profiles, social, notifications, business, sitemap, recaps, artist_dashboard, payments_manual_qr, community, subscriptions, ticketing, ticketing_organizer, table_reservations, cities, tickets, product_orders, promoters, ads, analytics, vendor_orders
import api.reviews as reviews
import api.messaging as messaging
import api.verification as verification
import api.sms_test as sms_test
import api.monitoring as monitoring

settings = get_settings()

# ─── Structured Logging ─────────────────────────────────────────────────────
setup_logging(settings.LOG_LEVEL, settings.LOG_FILE)
logger = logging.getLogger(__name__)

# Request ID context var for correlation
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

# ─── Sentry Error Tracking (Optional) ───────────────────────────────────────
if settings.SENTRY_DSN:
    try:
        sentry_sdk = import_module("sentry_sdk")
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=0.2,
            profiles_sample_rate=0.1,
        )
        logger.info("Sentry error tracking initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize Sentry: {e}")

# ─── Security: Strong Secret Validation ─────────────────────────────────────
_WEAK_SECRETS = {
    "", "dev-secret-key-change-in-production", "dev-jwt-secret-change-in-production",
    "secret", "password", "123456", "changeme", "admin", "default"
}

def _validate_secrets():
    """Fail fast if weak secrets are detected in production."""
    if settings.DEBUG:
        return
    
    warnings = []
    if settings.SECRET_KEY in _WEAK_SECRETS or len(settings.SECRET_KEY) < 32:
        warnings.append("SECRET_KEY is weak or using default value. Set a strong random secret.")
    if settings.JWT_SECRET in _WEAK_SECRETS or len(settings.JWT_SECRET) < 32:
        warnings.append("JWT_SECRET is weak or using default value. Set a strong random secret.")
    
    if warnings:
        logger.warning("=" * 60)
        logger.warning("SECURITY WARNING — Production secrets are weak!")
        logger.warning("=" * 60)
        for w in warnings:
            logger.warning(f"  • {w}")
        logger.warning("=" * 60)
        # Don't crash, but warn loudly. In a future version, raise RuntimeError.

_validate_secrets()

# ─── Maintenance Mode (cached — avoids DB hit on every request) ──────────────────
_maintenance_cache: dict = {"value": False, "expires": 0.0}
_MAINTENANCE_CACHE_TTL = 30  # seconds


def _is_maintenance_mode() -> bool:
    now = time.monotonic()
    if now < _maintenance_cache["expires"]:
        return _maintenance_cache["value"]
    db = SessionLocal()
    try:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "maintenance_mode").first()
        result = setting.value == "true" if setting and setting.value else False
        _maintenance_cache["value"] = result
        _maintenance_cache["expires"] = now + _MAINTENANCE_CACHE_TTL
        return result
    except Exception:
        return False
    finally:
        db.close()


async def _auto_cancel_worker():
    """Background worker that cancels stale pending ticket orders every hour."""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            db = SessionLocal()
            try:
                from services.ticketing_service import cancel_stale_orders
                count = cancel_stale_orders(db, hours=24)
                if count > 0:
                    logger.info(f"[auto-cancel] Cancelled {count} stale ticket order(s)")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[auto-cancel] Error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    
    # Ensure static directories exist
    import os
    os.makedirs("static/uploads", exist_ok=True)
    if not settings.DEBUG:
        try:
            os.makedirs("/var/www/soundit-uploads", exist_ok=True)
        except PermissionError:
            logger.warning("[warn] Cannot create /var/www/soundit-uploads — ensure the directory exists in production")
    
    # Start background auto-cancel worker
    task = asyncio.create_task(_auto_cancel_worker())
    
    yield
    
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    description="Sound It - Music Events & Nightlife Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# ─── Global Exception Handlers ──────────────────────────────────────────────
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


def _error_response(request: Request, status_code: int, message: str, code: str = None) -> JSONResponse:
    request_id = request_id_var.get() or str(uuid.uuid4())
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code or "error",
                "message": message,
                "request_id": request_id,
                "path": request.url.path,
            }
        }
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(
        f"HTTP {exc.status_code} at {request.url.path}: {exc.detail}",
        extra={"request_id": request_id_var.get(), "status_code": exc.status_code}
    )
    return _error_response(request, exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        f"Validation error at {request.url.path}: {exc.errors()}",
        extra={"request_id": request_id_var.get()}
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request validation failed",
                "details": exc.errors(),
                "request_id": request_id_var.get() or str(uuid.uuid4()),
                "path": request.url.path,
            }
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = request_id_var.get() or str(uuid.uuid4())
    logger.error(
        f"Unhandled exception at {request.url.path}: {exc}",
        exc_info=True,
        extra={"request_id": request_id}
    )
    return _error_response(
        request, 500,
        "An unexpected error occurred. Please try again later.",
        code="internal_error"
    )


# ─── Security Headers (OWASP) ───────────────────────────────────────────────
from security.security_headers import setup_security_headers
setup_security_headers(app, debug=settings.DEBUG)

# ─── Rate Limiting Middleware ───────────────────────────────────────────────
from security.rate_limiter import setup_rate_limiting
setup_rate_limiting(app)

# CORS - Allow production domains + Capacitor mobile apps (iOS & Android)
# Localhost origins are only allowed in development (DEBUG=True).
ALLOWED_ORIGINS = [
    "https://sounditent.com",
    "https://www.sounditent.com",
    "https://app.sounditent.com",
    "https://sounditent.cn",
    "https://www.sounditent.cn",
    "capacitor://localhost",
]

if settings.DEBUG:
    ALLOWED_ORIGINS.extend([
        "http://localhost",
        "https://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "file://",
    ])

# Capacitor scheme stays always-on (mobile app); localhost/file origins only in DEBUG.
ORIGIN_REGEX = r"capacitor://.*"
if settings.DEBUG:
    ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|capacitor://.*|file://.*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-RateLimit-Remaining", "X-Request-ID"]
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Attach a request ID for logging correlation."""
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = request_id_var.set(request_id)
    request.state.request_id = request_id
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        request_id_var.reset(token)


@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next):
    """Block non-admin requests when maintenance mode is enabled."""
    path = request.url.path

    # Always allow these paths
    if path in ["/health", "/admin"]:
        return await call_next(request)
    if path.startswith(("/static/", "/assets/", "/api/v1/auth/")):
        return await call_next(request)
    if path == "/api/v1/system/status":
        return await call_next(request)

    if not _is_maintenance_mode():
        return await call_next(request)

    # Check if request is from an admin
    is_admin = False
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")
        payload = decode_token(token)
        if payload and payload.get("sub"):
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == int(payload["sub"])).first()
                if user and user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
                    is_admin = True
            except Exception:
                pass
            finally:
                db.close()

    if is_admin:
        return await call_next(request)

    # Block API requests
    if path.startswith("/api/"):
        return JSONResponse(
            status_code=503,
            content={"detail": "Maintenance mode is enabled. Please try again later.", "maintenance": True}
        )

    # Allow frontend to load so it can display maintenance screen
    return await call_next(request)

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Frontend static files (assets, etc.)
# Production build lives in app/dist/; fallback to dist/ for backward compatibility
app.mount("/assets", StaticFiles(directory="app/dist/assets"), name="assets")

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(auth_password.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(payments_manual_qr.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(admin_payment_verification.router, prefix="/api/v1")
app.include_router(clubs.router, prefix="/api/v1")
app.include_router(foodspots.router, prefix="/api/v1")
# OTP router removed — registration and login use direct password flow
# app.include_router(otp.router, prefix="/api/v1")

app.include_router(vendors.router, prefix="/api/v1")
app.include_router(dashboard_stats.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(contact.router, prefix="/api/v1")

app.include_router(artists.router, prefix="/api/v1")
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(social.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(business.router, prefix="/api/v1")
app.include_router(recaps.router, prefix="/api/v1")
app.include_router(artist_dashboard.router, prefix="/api/v1")
app.include_router(ads.router, prefix="/api/v1")
app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(community.router, prefix="/api/v1")
app.include_router(subscriptions.router, prefix="/api/v1")
app.include_router(ticketing.router, prefix="/api/v1")
app.include_router(ticketing_organizer.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(product_orders.router, prefix="/api/v1")
app.include_router(vendor_orders.router, prefix="/api/v1")
app.include_router(table_reservations.router, prefix="/api/v1")
app.include_router(cities.router, prefix="/api/v1")
app.include_router(promoters.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(messaging.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(sms_test.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(sitemap.router)


@app.get("/")
def root():
    # Serve frontend index.html from production build
    for dist_dir in ("app/dist", "dist"):
        index_path = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_path):
            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    index_content = f.read()
                dynamic_html = get_dynamic_meta_html("", index_content)
                return HTMLResponse(content=dynamic_html, status_code=200)
            except Exception:
                return FileResponse(index_path)
    # Fallback to API info if frontend not built
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/v1/system/status")
def system_status():
    """Public endpoint to check system status including maintenance mode."""
    return {
        "status": "healthy",
        "maintenance_mode": _is_maintenance_mode()
    }


@app.get("/admin")
def serve_admin_dashboard():
    """Serve the admin dashboard"""
    admin_path = os.path.join("static", "admin", "dashboard.html")
    if os.path.exists(admin_path):
        return FileResponse(admin_path)
    raise HTTPException(status_code=404, detail="Admin dashboard not found")


from api.meta_tags import get_dynamic_meta_html
from fastapi.responses import HTMLResponse, FileResponse

# Serve frontend for all non-API routes (SPA support)
@app.get("/{path:path}")
def serve_frontend(path: str):
    # Skip API, static, assets, admin, sitemap.xml, and robots.txt routes
    if (path.startswith("api/") or path.startswith("static/") or 
        path.startswith("assets/") or path in ("admin", "sitemap.xml", "robots.txt")):
        raise HTTPException(status_code=404, detail="Not found")
    
    # Production build lives in app/dist/; fallback to dist/ for backward compatibility
    for dist_dir in ("app/dist", "dist"):
        # Serve actual files from dist (images, logos, js/css, etc.)
        file_path = os.path.join(dist_dir, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Serve index.html for all other routes (SPA routing) with dynamic OpenGraph meta tags
        index_path = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_path):
            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    index_content = f.read()
                dynamic_html = get_dynamic_meta_html(path, index_content)
                return HTMLResponse(content=dynamic_html, status_code=200)
            except Exception:
                return FileResponse(index_path)
    
    raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
