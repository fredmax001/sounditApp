# Sound It — Multi-Region Deployment Architecture

## Overview

| Server | Provider | IP | Domain | Role |
|--------|----------|-----|--------|------|
| Main | Hostinger VPS | 72.62.254.251 | sounditent.com | Primary API + Database + Global Frontend |
| China | Alibaba Cloud ECS | 47.100.211.43 | sounditent.cn | China Frontend + API Proxy + Media Cache |

**Core Principle:** Both domains share ONE backend API and ONE PostgreSQL database. The China server is a proxy/edge node — it does NOT run its own backend or database.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS / VISITORS                        │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────┐          ┌──────────────────────────┐
│  sounditent.com      │          │  sounditent.cn           │
│  (Global Users)      │          │  (China Users)           │
└──────────────────────┘          └──────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  MAIN SERVER (72.62.254.251)                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Nginx (443)     │  │ FastAPI (8000)  │  │ PostgreSQL      │ │
│  │ - SPA frontend  │  │ - Business logic│  │ - Single source │ │
│  │ - API routing   │  │ - Auth (JWT)    │  │   of truth      │ │
│  │ - Static files  │  │ - All endpoints │  │ - All data      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS (API Proxy)
         │
┌─────────────────────────────────────────────────────────────────┐
│  CHINA SERVER (47.100.211.43)                                   │
│  ┌─────────────────┐                                            │
│  │ Nginx (443)     │                                            │
│  │ - SPA frontend  │  ← Same React build as main server        │
│  │ - /api/v1/*     │  → Proxied to main server                 │
│  │ - /static/*     │  → Proxied + cached from main server      │
│  │ - Media cache   │  ← Local nginx cache for uploads          │
│  └─────────────────┘                                            │
│                                                                 │
│  NO backend  │  NO database  │  NO local user data            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

1. **Single Source of Truth**: One database means zero data consistency issues. Users, tickets, chats, and profiles are always in sync.

2. **Simplified Operations**: Only one backend to maintain, update, and monitor. China server is essentially a smart CDN + API gateway.

3. **JWT Cross-Domain Compatibility**: Stateless tokens mean a user logging in from `.com` can immediately use `.cn` with the same token.

4. **Easy Scaling**: Adding a third region (e.g., Europe) only requires another nginx proxy server — no backend deployment needed.

5. **China Compliance**: Alibaba Cloud server can be optimized for Chinese network conditions (ICP备案, CDN integration) without affecting the global deployment.

---

## Data Flow

### Login (from China)
```
User → sounditent.cn/login → POST sounditent.cn/api/v1/auth/login
  → nginx proxy → sounditent.com/api/v1/auth/login
  → FastAPI validates → PostgreSQL query
  → JWT token returned → stored in browser localStorage
```

### Ticket Purchase (from China)
```
User → sounditent.cn/events/123 → POST sounditent.cn/api/v1/tickets/order
  → nginx proxy → sounditent.com/api/v1/tickets/order
  → FastAPI creates TicketOrder in PostgreSQL
  → Response returned to user
```

### Media Upload (from China)
```
User → sounditent.cn → POST /api/v1/media/upload
  → nginx proxy → main server → saved to /var/www/soundit-uploads/
  → URL returned: https://sounditent.com/static/uploads/...
  → User accesses via: https://sounditent.cn/static/uploads/...
    → nginx cache → main server (first time)
    → nginx cache hit (subsequent requests)
```

---

## Security

### Cross-Region Communication
- All API proxy traffic uses **HTTPS** (TLS 1.2+)
- Nginx on China server verifies SSL certificates (or uses strict verification for internal certs)
- Rate limiting on both servers prevents abuse

### Authentication
- JWT tokens are **stateless** — no session storage needed
- Same `JWT_SECRET` on both domains
- Tokens stored in `localStorage` (or cookies with `SameSite=None; Secure` if needed)
- CORS headers configured to allow both domains

### Firewall
- China server: Only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open
- Main server: Same, plus PostgreSQL port restricted to localhost only
- Fail2ban protects against brute-force attacks

### Data Isolation
- China server has **zero database access**
- All data operations go through the authenticated API
- No direct file system sharing between servers

---

## Performance Optimization

### 1. Nginx Media Cache (China Server)
Uploads and static files are cached on the China server for 1 hour:
```nginx
proxy_cache_path /var/cache/nginx/soundit_media levels=1:2 keys_zone=soundit_media:100m max_size=5g;
proxy_cache soundit_media;
proxy_cache_valid 200 1h;
```

### 2. Connection Keepalive
Both nginx configs use `keepalive` to maintain persistent connections:
```nginx
upstream soundit_backend {
    keepalive 64;
    keepalive_requests 1000;
}
```

### 3. Gzip Compression
All text responses are compressed:
```nginx
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json ...;
```

### 4. Future: Redis Caching
Add Redis on the main server for:
- API response caching (frequently accessed data)
- Rate limiting counters
- Session management (if switching to server-side sessions)

### 5. Future: CDN
Replace media proxy with:
- **Alibaba Cloud CDN** (for China users)
- **CloudFlare** or **AWS CloudFront** (for global users)
- Upload files directly to OSS/S3 instead of local storage

---

## Scalability Roadmap

### Phase 1: Current (Dual-Region Proxy)
✅ Main server: Backend + DB + Frontend  
✅ China server: Frontend proxy + API proxy  
✅ Shared PostgreSQL database  
✅ JWT cross-domain auth  

### Phase 2: Database Read Replica (China)
- Add PostgreSQL read replica on China server
- China API proxy routes read queries to local replica
- Write queries still go to main server
- **Benefit**: Faster read operations for China users

### Phase 3: Redis + Caching
- Add Redis on main server
- Cache frequently accessed data (event listings, user profiles)
- Redis on China server as a replica for faster cache hits
- **Benefit**: Reduced database load, faster API responses

### Phase 4: Load Balancing
- Multiple backend instances behind a load balancer
- Health checks and auto-failover
- **Benefit**: Handle more concurrent users

### Phase 5: Multi-Region Storage
- Migrate uploads to Alibaba Cloud OSS (China) + AWS S3 (Global)
- CDN delivers media from nearest edge location
- **Benefit**: Faster media loading, infinite storage

---

## Backup Strategy

### Database
```bash
# Daily automated backup via cron
crontab -e
0 2 * * * pg_dump -h localhost -U soundit soundit_prod | gzip > /backups/soundit_$(date +\%Y\%m\%d).sql.gz
```

### Files
```bash
# Sync uploads to remote backup
rsync -avz /var/www/soundit-uploads/ backup-server:/backups/soundit-uploads/
```

### China Server
- Configuration is minimal (nginx only)
- Frontend build is identical to main server
- If China server fails: redeploy in < 10 minutes

---

## Monitoring

### Main Server
- Nginx access/error logs: `/var/log/nginx/soundit_*.log`
- Application logs: systemd journal
- Database: PostgreSQL logs

### China Server
- Nginx access/error logs: `/var/log/nginx/soundit_cn_*.log`
- Health check: `/usr/local/bin/soundit-health-check.sh` (runs every 5 min)
- Log file: `/var/log/soundit-health.log`

### Alerts (Future)
- Uptime monitoring (e.g., UptimeRobot, Pingdom)
- Log aggregation (e.g., ELK stack, Alibaba Cloud SLS)
- Database monitoring (slow queries, connection count)

---

## Deployment Workflow

### Main Server
```bash
# 1. Deploy backend
cd /var/www/soundit
systemctl restart soundit

# 2. Deploy frontend
cd /var/www/soundit/app/dist
# Extract new build
systemctl reload nginx
```

### China Server
```bash
# 1. Deploy frontend (same build as main)
rsync -avz root@72.62.254.251:/var/www/soundit/app/dist/ /var/www/soundit/app/dist/

# 2. Reload nginx
systemctl reload nginx
```

---

## Environment Variables

### Main Server `.env`
```
# CORS
ALLOWED_ORIGINS=https://sounditent.com,https://www.sounditent.com,https://sounditent.cn,https://www.sounditent.cn

# Database (local)
DATABASE_URL=postgresql://soundit_user:password@localhost:5432/soundit_prod

# JWT (same secret for both domains)
JWT_SECRET=your-secret-key
SECRET_KEY=your-secret-key

# Media
UPLOAD_DIR=/var/www/soundit-uploads
```

### China Server
No `.env` needed — it's just nginx. The frontend build uses the same API base URL pattern.

**Important**: The frontend must be built with a relative API path (`/api/v1`) or dynamically detect the current domain. This way `sounditent.cn/api/v1` is proxied locally, and `sounditent.com/api/v1` hits the main server directly.
