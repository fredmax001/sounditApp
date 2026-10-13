"""Local host-aware serving smoke test (Phase 2, local only).

Meta injection rewrites <title>, so identity is asserted via the hashed JS
bundle each dist build references.
"""
import os
import re
import sys

from starlette.testclient import TestClient

from database import Base, engine

Base.metadata.create_all(bind=engine)

from main import app

c = TestClient(app)
failures = []


def check(name, cond):
    print(("PASS" if cond else "FAIL"), "-", name)
    if not cond:
        failures.append(name)


def js_bundle(html):
    m = re.search(r'src="/assets/([^"]+\.js)"', html)
    return m.group(1) if m else None


def bundle_in(dist_dir, name):
    return bool(name) and os.path.exists(os.path.join(dist_dir, "assets", name))


def served_dist(html):
    name = js_bundle(html)
    if bundle_in("web/dist", name):
        return "web"
    if bundle_in("app/dist", name):
        return "app"
    return "unknown"


# 1. Public hosts serve the new public website
for host in ("sounditent.com", "www.sounditent.com", "sounditent.cn"):
    r = c.get("/", headers={"Host": host})
    check(f"{host} / serves public site", r.status_code == 200 and served_dist(r.text) == "web")

# 2. App host and localhost keep the application SPA
for host in ("app.sounditent.com", "localhost", "127.0.0.1"):
    r = c.get("/", headers={"Host": host})
    check(f"{host} / serves app SPA", r.status_code == 200 and served_dist(r.text) == "app")

# 3. SPA sub-routes on public host serve the public build (not the app)
r = c.get("/about", headers={"Host": "sounditent.com"})
check("sounditent.com /about serves public site", r.status_code == 200 and served_dist(r.text) == "web")
r = c.get("/events", headers={"Host": "app.sounditent.com"})
check("app host /events serves app SPA", r.status_code == 200 and served_dist(r.text) == "app")

# 4. Dynamic meta injection still works for event paths on both hosts
for host in ("sounditent.com", "app.sounditent.com"):
    r = c.get("/events/1", headers={"Host": host})
    check(f"{host} /events/1 has og meta", r.status_code == 200 and "og:" in r.text)

# 5. API works identically on both hosts
for host in ("sounditent.com", "app.sounditent.com"):
    r = c.get("/api/v1/events/featured", headers={"Host": host})
    check(f"api featured on {host}: {r.status_code}", r.status_code == 200)

# 6. Static public assets from the web build are served on public host
r = c.get("/logo.png", headers={"Host": "sounditent.com"})
check("public host /logo.png served", r.status_code == 200)
r = c.get("/logo.png", headers={"Host": "app.sounditent.com"})
check("app host /logo.png served", r.status_code == 200)

# 7. Health
r = c.get("/health")
check("health endpoint", r.status_code == 200 and r.json().get("status") == "healthy")

print()
if failures:
    print("FAILURES:", failures)
    sys.exit(1)
print("ALL CHECKS PASSED")
