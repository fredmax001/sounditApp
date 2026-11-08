"""
IP Geolocation and User-Agent parsing for analytics.
Uses ip-api.com (free, no key needed, 45 requests/minute).
"""
import re
import requests
import logging
from typing import Optional, Dict
from functools import lru_cache

logger = logging.getLogger(__name__)

# Simple UA parsing regexes
UA_PATTERNS = {
    "browser": [
        (r"Edg/([0-9.]+)", "Edge"),
        (r"OPR/([0-9.]+)", "Opera"),
        (r"Chrome/([0-9.]+)", "Chrome"),
        (r"Safari/([0-9.]+)", "Safari"),
        (r"Firefox/([0-9.]+)", "Firefox"),
        (r"MSIE ([0-9.]+)", "IE"),
        (r"Trident/.*rv:([0-9.]+)", "IE"),
    ],
    "os": [
        (r"Windows NT ([0-9.]+)", "Windows"),
        (r"Mac OS X ([0-9_.]+)", "macOS"),
        (r"Android ([0-9.]+)", "Android"),
        (r"iPhone OS ([0-9_]+)", "iOS"),
        (r"iPad;.*OS ([0-9_]+)", "iOS"),
        (r"Linux", "Linux"),
    ],
    "device": [
        (r"iPhone", "mobile"),
        (r"iPad", "tablet"),
        (r"Android.*Mobile", "mobile"),
        (r"Android", "tablet"),
    ],
}


def parse_user_agent(ua: Optional[str]) -> Dict[str, Optional[str]]:
    """Parse browser, OS, and device type from User-Agent string."""
    result = {
        "browser": None,
        "browser_version": None,
        "os": None,
        "os_version": None,
        "device_type": "desktop",
    }
    if not ua:
        return result
    
    # Browser
    for pattern, name in UA_PATTERNS["browser"]:
        match = re.search(pattern, ua)
        if match:
            result["browser"] = name
            result["browser_version"] = match.group(1).replace("_", ".")
            break
    
    # OS
    for pattern, name in UA_PATTERNS["os"]:
        match = re.search(pattern, ua)
        if match:
            result["os"] = name
            result["os_version"] = match.group(1).replace("_", ".") if match.groups() else None
            break
    
    # Device type
    for pattern, dtype in UA_PATTERNS["device"]:
        if re.search(pattern, ua):
            result["device_type"] = dtype
            break
    
    return result


@lru_cache(maxsize=1024)
def geolocate_ip(ip: str) -> Dict[str, Optional[str]]:
    """
    Get geo data for an IP via ip-api.com (free, 45 req/min).
    Returns empty dict on failure so we never block requests.
    """
    if not ip or ip in ("127.0.0.1", "localhost", "::1"):
        return {}
    
    # Skip private/local IPs
    if ip.startswith(("10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.")):
        return {}
    
    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,lat,lon,message",
            timeout=3,
        )
        data = resp.json()
        if data.get("status") == "success":
            return {
                "country": data.get("country"),
                "country_code": data.get("countryCode"),
                "city": data.get("city"),
                "region": data.get("regionName"),
                "latitude": data.get("lat"),
                "longitude": data.get("lon"),
            }
    except Exception as e:
        logger.warning(f"IP geolocation failed for {ip}: {e}")
    
    return {}
