"""
Thread-safe, namespace-isolated TTL + LRU cache for read-heavy public data.

Security & Data Integrity Guarantees:
- Strictly scoped by namespace and normalized cache keys (e.g., city, filter params).
- Never used for private, financial, payout, order, or user-authenticated endpoints.
- Supports targeted namespace invalidation whenever underlying entities are created, updated, or deleted.
"""
import time
import copy
import threading
from collections import OrderedDict
from typing import Any, Callable, Optional, Tuple


class NamespaceTTLCache:
    def __init__(self, max_entries_per_namespace: int = 256):
        self._lock = threading.RLock()
        self._max_entries = max_entries_per_namespace
        # namespace -> OrderedDict[key, (expires_at_monotonic, value)]
        self._store: dict[str, OrderedDict[str, Tuple[float, Any]]] = {}
        self._hits = 0
        self._misses = 0

    def get(self, namespace: str, key: str) -> Optional[Any]:
        now = time.monotonic()
        with self._lock:
            ns_map = self._store.get(namespace)
            if not ns_map or key not in ns_map:
                self._misses += 1
                return None
            expires_at, val = ns_map[key]
            if now >= expires_at:
                del ns_map[key]
                self._misses += 1
                return None
            ns_map.move_to_end(key)
            self._hits += 1
            return copy.deepcopy(val)

    def set(self, namespace: str, key: str, value: Any, ttl_seconds: float = 45.0) -> None:
        now = time.monotonic()
        with self._lock:
            ns_map = self._store.setdefault(namespace, OrderedDict())
            if key in ns_map:
                ns_map.move_to_end(key)
            ns_map[key] = (now + ttl_seconds, copy.deepcopy(value))
            while len(ns_map) > self._max_entries:
                ns_map.popitem(last=False)

    def get_or_set(
        self,
        namespace: str,
        key: str,
        loader: Callable[[], Any],
        ttl_seconds: float = 45.0,
    ) -> Any:
        cached = self.get(namespace, key)
        if cached is not None:
            return cached
        val = loader()
        self.set(namespace, key, val, ttl_seconds=ttl_seconds)
        return val

    def invalidate_namespace(self, *namespaces: str) -> None:
        with self._lock:
            for ns in namespaces:
                if ns in self._store:
                    self._store[ns].clear()

    def invalidate_key(self, namespace: str, key: str) -> None:
        with self._lock:
            ns_map = self._store.get(namespace)
            if ns_map and key in ns_map:
                del ns_map[key]

    def clear_all(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> dict:
        with self._lock:
            return {
                "hits": self._hits,
                "misses": self._misses,
                "namespaces": {ns: len(entries) for ns, entries in self._store.items()},
            }


app_cache = NamespaceTTLCache(max_entries_per_namespace=256)


def normalize_city_key(city: Optional[str]) -> str:
    if not city:
        return "all"
    c = city.strip().lower()
    if c in ("all", "all-cities", "all cities", "china", ""):
        return "all"
    return c


def invalidate_event_caches() -> None:
    app_cache.invalidate_namespace(
        "events_public",
        "city_counts",
        "city_guide",
        "businesses_public",
        "platform_stats",
    )


def invalidate_artist_caches() -> None:
    app_cache.invalidate_namespace(
        "artists_public",
        "city_counts",
        "city_guide",
        "platform_stats",
    )


def invalidate_vendor_caches() -> None:
    app_cache.invalidate_namespace(
        "vendors_public",
        "city_counts",
        "city_guide",
        "platform_stats",
    )


def invalidate_business_caches() -> None:
    app_cache.invalidate_namespace(
        "businesses_public",
        "city_counts",
        "city_guide",
        "platform_stats",
    )
