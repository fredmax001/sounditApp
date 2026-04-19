import os
import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager

from config import get_settings
from database import init_db, SessionLocal
from models import SystemSetting, User, UserRole
from auth import decode_REDACTED_PLACEHOLDER as decode_token
from api import auth, auth_password, events, payments, admin, admin_payment_verification, clubs, foodspots, otp, vendors, dashboard_stats, bookings, media, contact, artists, profiles, social, notifications, business, sitemap, recaps, artist_dashboard, payments_manual_qr, community, subscriptions, ticketing, ticketing_organizer, table_reservations, cities, tickets, product_orders
# monitoring module temporarily disabled

settings = get_settings()

def _is_maintenance_mode() -> bool:
    db = SessionLocal()
    try:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "maintenance_mode").first()
        return setting.value == "true" if setting and setting.value else False
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
                    print(f"[auto-cancel] Cancelled {count} stale ticket order(s)")
            finally:
                db.close()
        except Exception as e:
            print(f"[auto-cancel] Error: {e}")


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
            print("[warn] Cannot create /var/www/soundit-uploads — ensure the directory exists in production")
    
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

# CORS - Environment-specific configuration
# Security: Development origins only allowed in DEBUG mode
from config import get_settings
_settings = get_settings()

if _settings.DEBUG:
    ALLOWED_ORIGINS = [
        "https://sounditent.com",
        "https://www.sounditent.com",
        "https://app.sounditent.com",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
else:
    # Production: Only allow production domains
    ALLOWED_ORIGINS = [
        "https://sounditent.com",
        "https://www.sounditent.com",
        "https://app.sounditent.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-Total-Count"]
)


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
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

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
app.include_router(otp.router, prefix="/api/v1")

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
# app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(community.router, prefix="/api/v1")
app.include_router(subscriptions.router, prefix="/api/v1")
app.include_router(ticketing.router, prefix="/api/v1")
app.include_router(ticketing_organizer.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(product_orders.router, prefix="/api/v1")
app.include_router(table_reservations.router, prefix="/api/v1")
app.include_router(cities.router, prefix="/api/v1")


@app.get("/")
def root():
    # Serve frontend index.html
    index_path = os.path.join("dist", "index.html")
    if os.path.exists(index_path):
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


# Serve frontend for all non-API routes (SPA support)
@app.get("/{path:path}")
def serve_frontend(path: str):
    # Skip API, static, assets, and admin routes
    if (path.startswith("api/") or path.startswith("static/") or 
        path.startswith("assets/") or path == "admin"):
        raise HTTPException(status_code=404, detail="Not found")
    
    # Serve actual files from dist (images, etc.)
    file_path = os.path.join("dist", path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Serve index.html for all other routes (SPA routing)
    index_path = os.path.join("dist", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
