/**
 * Soundit Analytics SDK
 * Enterprise-grade event tracking for both sounditent.com and sounditent.cn
 * Respects GDPR/PIPL cookie consent preferences.
 */

import { hasAnalyticsConsent } from "@/components/CookieConsent";

const API_URL = import.meta.env.VITE_API_URL || "https://sounditent.com/api/v1";

// ── Types ───────────────────────────────────────────────────────────

export type EventType =
  | "page_view"
  | "signup"
  | "login"
  | "logout"
  | "booking_created"
  | "ticket_purchased"
  | "ticket_viewed"
  | "event_view"
  | "event_saved"
  | "event_shared"
  | "profile_view"
  | "profile_follow"
  | "search_performed"
  | "media_played"
  | "message_sent"
  | "payment_completed"
  | "payment_failed"
  | "subscription_started"
  | "subscription_cancelled"
  | "comment_posted"
  | "like_given"
  | "share_clicked"
  | "cta_clicked"
  | "scroll_depth"
  | "time_on_page"
  | "form_submitted"
  | "error_occurred";

export type EventCategory =
  | "traffic"
  | "engagement"
  | "conversion"
  | "revenue"
  | "social"
  | "search"
  | "media"
  | "messaging"
  | "error";

export interface TrackEventPayload {
  event_type: EventType;
  event_category?: EventCategory;
  event_data?: Record<string, any>;
  path?: string;
  session_id?: string;
}

// ── Session Management ──────────────────────────────────────────────

function getSessionId(): string {
  let sid = sessionStorage.getItem("soundit_session_id");
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${Math.random().toString(36).slice(2, 5)}`;
    sessionStorage.setItem("soundit_session_id", sid);
  }
  return sid;
}

function getAuthToken(): string | null {
  return (
    localStorage.getItem("auth-token") ||
    localStorage.getItem("token") ||
    null
  );
}

function getDomain(): string {
  if (typeof window === "undefined") return "sounditent.com";
  const host = window.location.hostname;
  return host.includes("cn") ? "sounditent.cn" : "sounditent.com";
}

function getScreenInfo(): Record<string, any> {
  if (typeof window === "undefined") return {};
  return {
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ── Event Queue ─────────────────────────────────────────────────────

const EVENT_QUEUE: TrackEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

async function flushQueue() {
  if (EVENT_QUEUE.length === 0) return;

  const batch = EVENT_QUEUE.splice(0, BATCH_SIZE);
  const token = getAuthToken();
  const sessionId = getSessionId();

  try {
    await fetch(`${API_URL}/analytics/events/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        events: batch,
        session_id: sessionId,
        domain: getDomain(),
      }),
      keepalive: true,
    });
  } catch {
    // Silent fail - analytics should never block user experience
  }

  // If more events queued, flush again
  if (EVENT_QUEUE.length > 0) {
    flushTimer = setTimeout(flushQueue, 100);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushQueue();
    flushTimer = null;
  }, FLUSH_INTERVAL);
}

// ── Core Tracking Functions ─────────────────────────────────────────

/**
 * Track a custom event.
 * Events are batched and sent asynchronously.
 */
export function trackEvent(
  event_type: EventType,
  event_category?: EventCategory,
  event_data?: Record<string, any>
): void {
  // Always allow page_view and error tracking (necessary functionality)
  const isNecessary = event_type === "page_view" || event_type === "error_occurred";
  if (!isNecessary && !hasAnalyticsConsent()) return;
  const payload: TrackEventPayload = {
    event_type,
    event_category,
    event_data: {
      ...event_data,
      ...getScreenInfo(),
      timestamp: Date.now(),
    },
    path: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
    session_id: getSessionId(),
  };

  EVENT_QUEUE.push(payload);
  scheduleFlush();

  // Immediately flush critical events
  if (
    event_type === "payment_completed" ||
    event_type === "ticket_purchased" ||
    event_type === "signup"
  ) {
    flushQueue();
  }
}

/**
 * Track a page view.
 */
export function trackPageView(path?: string, referrer?: string): void {
  const token = getAuthToken();
  const sessionId = getSessionId();
  const payload = {
    path: path || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"),
    session_id: sessionId,
    referrer: referrer || (typeof document !== "undefined" ? document.referrer : undefined),
    domain: getDomain(),
  };

  const url = `${API_URL}/analytics/track`;

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * Track scroll depth on a page.
 */
export function trackScrollDepth(thresholds: number[] = [25, 50, 75, 90, 100]): void {
  if (typeof window === "undefined") return;

  const tracked = new Set<number>();

  const checkScroll = () => {
    const scrollPercent = Math.round(
      ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
    );

    for (const threshold of thresholds) {
      if (scrollPercent >= threshold && !tracked.has(threshold)) {
        tracked.add(threshold);
        trackEvent("scroll_depth", "engagement", { depth_percent: threshold });
      }
    }
  };

  window.addEventListener("scroll", checkScroll, { passive: true });
}

/**
 * Track time spent on page.
 */
export function trackTimeOnPage(intervalSeconds: number = 30): () => void {
  if (typeof window === "undefined") return () => {};

  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += intervalSeconds;
    trackEvent("time_on_page", "engagement", { seconds: elapsed });
  }, intervalSeconds * 1000);

  // Cleanup on page unload
  const cleanup = () => {
    clearInterval(timer);
    trackEvent("time_on_page", "engagement", {
      seconds: elapsed,
      total: true,
    });
  };

  window.addEventListener("beforeunload", cleanup);
  return cleanup;
}

/**
 * Track clicks on specific elements.
 */
export function trackClicks(selector: string, eventData?: Record<string, any>): () => void {
  if (typeof document === "undefined") return () => {};

  const handler = (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest(selector);
    if (target) {
      trackEvent("cta_clicked", "engagement", {
        element: selector,
        text: (target as HTMLElement).textContent?.trim(),
        ...eventData,
      });
    }
  };

  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}

/**
 * Track form submissions.
 */
export function trackForm(formSelector: string, formName?: string): () => void {
  if (typeof document === "undefined") return () => {};

  const handler = (e: SubmitEvent) => {
    const form = e.target as HTMLFormElement;
    if (form.matches(formSelector) || form.closest(formSelector)) {
      trackEvent("form_submitted", "engagement", {
        form_name: formName || form.name || form.id || "unknown",
        form_action: form.action,
      });
    }
  };

  document.addEventListener("submit", handler);
  return () => document.removeEventListener("submit", handler);
}

/**
 * Track JavaScript errors.
 */
export function trackErrors(): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: ErrorEvent) => {
    trackEvent("error_occurred", "error", {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  };

  window.addEventListener("error", handler);
  return () => window.removeEventListener("error", handler);
}

/**
 * Initialize comprehensive analytics tracking.
 * Call once at app startup.
 */
export function initAnalytics(): () => void {
  const cleanups: (() => void)[] = [];

  // Track scroll depth
  trackScrollDepth();

  // Track time on page
  cleanups.push(trackTimeOnPage(30));

  // Track errors
  cleanups.push(trackErrors());

  // Flush any remaining events on unload
  const flushOnUnload = () => {
    flushQueue();
  };
  window.addEventListener("beforeunload", flushOnUnload);
  cleanups.push(() => window.removeEventListener("beforeunload", flushOnUnload));

  // Visibility change tracking
  const handleVisibility = () => {
    if (document.hidden) {
      trackEvent("time_on_page", "engagement", { action: "tab_hidden" });
    } else {
      trackEvent("time_on_page", "engagement", { action: "tab_visible" });
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", handleVisibility));

  return () => cleanups.forEach((fn) => fn());
}

// ── Convenience Exports ─────────────────────────────────────────────

export const Analytics = {
  trackEvent,
  trackPageView,
  trackScrollDepth,
  trackTimeOnPage,
  trackClicks,
  trackForm,
  trackErrors,
  initAnalytics,
  getSessionId,
};

export default Analytics;
