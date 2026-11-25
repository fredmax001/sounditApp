import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { forceUnlockBodyScroll } from '@/lib/scrollLock';
import { isTextEditableElement } from '@/hooks/useMobileViewport';

/**
 * Routes where preserving scroll position on browser Back (POP) navigation
 * improves browsing ergonomics (long discovery/catalog lists).
 * Settings, forms, details, dashboards, and sub-pages always open at (0, 0).
 */
const RESTORABLE_LIST_ROUTES = new Set([
  '/',
  '/events',
  '/discovery',
  '/city-guide',
  '/artists',
  '/vendors',
  '/food',
  '/recaps',
  '/community',
]);

const MAX_SAVED_ENTRIES = 40;
const savedPositions = new Map<string, number>();

function setSavedScroll(key: string, y: number) {
  if (savedPositions.size >= MAX_SAVED_ENTRIES) {
    const oldest = savedPositions.keys().next().value;
    if (oldest !== undefined) savedPositions.delete(oldest);
  }
  savedPositions.set(key, y);
}

/**
 * Atomically resets every possible scroll container to (0, 0) without smooth
 * animation so iOS WKWebView, Android WebView, and mobile browsers never retain
 * a previous page's scroll offset or momentum drift.
 */
export function resetAllScrollContainers(targetTop = 0) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    window.scrollTo({ top: targetTop, left: 0, behavior: 'instant' as ScrollBehavior });
  } catch {
    window.scrollTo(0, targetTop);
  }

  document.documentElement.scrollTop = targetTop;
  document.documentElement.scrollLeft = 0;
  document.body.scrollTop = targetTop;
  document.body.scrollLeft = 0;

  // Reset any nested layout scroll containers that might exist on dashboards or drawers
  const containers = document.querySelectorAll<HTMLElement>(
    'main, [data-scroll-container="true"], .app-page'
  );
  containers.forEach((el) => {
    if (el.scrollTop !== targetTop) el.scrollTop = targetTop;
    if (el.scrollLeft !== 0) el.scrollLeft = 0;
  });
}

/**
 * Global Navigation, Scroll Restoration & Mobile Layout Reset Controller.
 * Mount once directly inside <BrowserRouter> in App.tsx.
 */
export function NavigationScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevKeyRef = useRef<string>(location.key);
  const prevPathRef = useRef<string>(location.pathname);

  // Take deterministic control over history scroll restoration so the browser
  // never fights React Router + lazy Suspense chunks with stale scroll offsets.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Continuously record current scroll offset for the active history entry
  // so Back navigation to catalog feeds can restore cleanly when valid.
  useEffect(() => {
    const key = location.key;
    const path = location.pathname;
    const onScroll = () => {
      if (RESTORABLE_LIST_ROUTES.has(path)) {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        setSavedScroll(key, y);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      onScroll();
      window.removeEventListener('scroll', onScroll);
    };
  }, [location.key, location.pathname]);

  // Synchronously run before browser paint on every route transition
  useLayoutEffect(() => {
    const routeChanged =
      prevKeyRef.current !== location.key || prevPathRef.current !== location.pathname;

    prevKeyRef.current = location.key;
    prevPathRef.current = location.pathname;

    // 1. Dismiss any lingering mobile keyboard from the previous route
    if (document.activeElement && isTextEditableElement(document.activeElement)) {
      try {
        document.activeElement.blur();
      } catch {
        /* ignore */
      }
    }

    // 2. Release any orphaned modal/drawer scroll locks from the previous route
    forceUnlockBodyScroll();

    // 3. Notify headers, bottom nav, and viewport manager to reset transient state
    if (routeChanged) {
      window.dispatchEvent(
        new CustomEvent('soundit-route-change', {
          detail: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            navigationType,
          },
        })
      );
    }

    // 4. Hash navigation (e.g. /events/123#ticket-selector)
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const scrollToHash = () => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
          return true;
        }
        return false;
      };
      if (!scrollToHash()) {
        resetAllScrollContainers(0);
        const t = window.setTimeout(scrollToHash, 150);
        return () => window.clearTimeout(t);
      }
      return;
    }

    // 5. Deliberate Back (POP) restoration ONLY for long catalog feeds with valid bounds
    if (
      navigationType === 'POP' &&
      RESTORABLE_LIST_ROUTES.has(location.pathname) &&
      savedPositions.has(location.key)
    ) {
      const savedY = savedPositions.get(location.key) || 0;
      if (savedY > 0) {
        const applySaved = () => {
          const maxScroll = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
          );
          resetAllScrollContainers(Math.min(savedY, maxScroll));
        };
        applySaved();
        const raf = window.requestAnimationFrame(applySaved);
        return () => window.cancelAnimationFrame(raf);
      }
    }

    // 6. Standard forward / tab / sub-page / settings navigation: snap strictly to top (0, 0)
    resetAllScrollContainers(0);

    // Re-assert top alignment after layout paint & after lazy Suspense chunk mount
    // (guards against iOS WKWebView inertia or async chunk height swaps shifting scrollY)
    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      resetAllScrollContainers(0);
      raf2 = window.requestAnimationFrame(() => {
        if ((window.scrollY || 0) > 0 && !location.hash) {
          resetAllScrollContainers(0);
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
    };
  }, [location.key, location.pathname, location.search, location.hash, navigationType]);

  return null;
}

export default NavigationScrollManager;
