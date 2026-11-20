/**
 * Client-side Request Cancellation, In-Flight Deduplication & City-Isolated TTL Cache
 *
 * Guarantees:
 * 1. Repeated city switches or rapid filter changes abort stale in-flight requests via AbortController.
 * 2. Identical concurrent requests share a single in-flight Promise (zero duplicate network calls).
 * 3. City-scoped cache keys (`city:${normalizedCity}:...`) prevent cross-city data leakage and
 *    provide 0ms synchronous cache hits when switching between recently visited cities.
 */
import axios, { type AxiosRequestConfig } from 'axios';

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class ClientQueryCache {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<unknown>>();
  private abortControllers = new Map<string, AbortController>();
  private maxEntries = 200;

  normalizeCity(city?: string | null): string {
    if (!city) return 'all';
    const c = city.trim().toLowerCase();
    if (c === '' || c === 'all' || c === 'all-cities' || c === 'all cities' || c === 'china') {
      return 'all';
    }
    return c;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs = 45_000): void {
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Abort an active request scope (e.g. "events-list", "city-guide", "artists-list").
   */
  abortScope(scope: string): void {
    const ctrl = this.abortControllers.get(scope);
    if (ctrl) {
      ctrl.abort();
      this.abortControllers.delete(scope);
    }
  }

  /**
   * Abort all city-switch scopes when the user changes cities.
   */
  abortAllCityScopes(): void {
    for (const [scope, ctrl] of this.abortControllers.entries()) {
      if (scope.startsWith('city:')) {
        ctrl.abort();
        this.abortControllers.delete(scope);
      }
    }
  }

  /**
   * Create a fresh AbortController for a given scope, automatically aborting any prior request in that scope.
   */
  createScopeController(scope: string): AbortController {
    this.abortScope(scope);
    const controller = new AbortController();
    this.abortControllers.set(scope, controller);
    return controller;
  }

  /**
   * Deduplicated, cached, and cancellable GET request.
   */
  async fetchJson<T>(
    key: string,
    url: string,
    options?: {
      params?: Record<string, unknown>;
      headers?: Record<string, string>;
      ttlMs?: number;
      scope?: string;
      forceRefresh?: boolean;
    }
  ): Promise<T> {
    const ttlMs = options?.ttlMs ?? 45_000;

    if (!options?.forceRefresh) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // If a new scope controller is requested, abort any previous request in that scope
    let signal: AbortSignal | undefined;
    if (options?.scope) {
      const prevKeyInFlight = `${options.scope}::activeKey`;
      const prevKey = (this as unknown as Record<string, string>)[prevKeyInFlight];
      if (prevKey && prevKey !== key) {
        this.abortScope(options.scope);
        this.inFlight.delete(prevKey);
      }
      (this as unknown as Record<string, string>)[prevKeyInFlight] = key;
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }

    if (options?.scope) {
      const ctrl = this.createScopeController(options.scope);
      signal = ctrl.signal;
    }

    const reqConfig: AxiosRequestConfig = {
      params: options?.params,
      headers: options?.headers,
      signal,
    };

    const promise = axios
      .get<T>(url, reqConfig)
      .then((res) => {
        if (ttlMs > 0) {
          this.set(key, res.data, ttlMs);
        }
        return res.data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidatePrefix(prefix: string): void {
    for (const k of Array.from(this.cache.keys())) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const queryCache = new ClientQueryCache();

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string; message?: string };
  return (
    e.name === 'CanceledError' ||
    e.name === 'AbortError' ||
    e.code === 'ERR_CANCELED' ||
    e.message === 'canceled'
  );
}
