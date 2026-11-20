import { useEffect } from 'react';

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isTextEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return !(el as HTMLTextAreaElement).readOnly && !(el as HTMLTextAreaElement).disabled;
  if (tag === 'INPUT') {
    const input = el as HTMLInputElement;
    if (input.readOnly || input.disabled) return false;
    const type = (input.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

function isMobileOrTouchViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth < 1024 ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window
  );
}

/**
 * Scroll a focused input into the center of the visible viewport
 * (accounting for visualViewport height when the mobile keyboard is open).
 */
function ensureInputVisible(target: HTMLElement) {
  if (!target || !document.contains(target)) return;
  try {
    const vv = window.visualViewport;
    const visibleTop = vv ? vv.offsetTop + 56 : 56;
    const visibleBottom = vv ? vv.offsetTop + vv.height - 24 : window.innerHeight - 24;
    const rect = target.getBoundingClientRect();

    // Only scroll if input is obscured or very close to the keyboard / top header
    if (rect.bottom > visibleBottom || rect.top < visibleTop) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  } catch {
    // fallback for older engines
    try {
      target.scrollIntoView(false);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Global mobile viewport, keyboard, and safe-area controller.
 * Mount once at the root of App.tsx.
 *
 * Publishes CSS variables on :root:
 *   --vvh              : live visualViewport height (px)
 *   --keyboard-height  : estimated keyboard height (px)
 *   --keyboard-offset  : bottom offset for fixed elements (non-zero only when
 *                        the browser overlays the keyboard instead of resizing layout)
 *
 * Sets <html data-keyboard-open="true|false"> and dispatches
 * 'soundit-keyboard-change' custom events.
 */
export function useMobileViewport() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;
    let baselineHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);
    let lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    let rafId: number | null = null;
    let blurTimer: number | null = null;
    let scrollTimer1: number | null = null;
    let scrollTimer2: number | null = null;
    let hasEditableFocus = false;
    let lastKeyboardOpen = false;

    const applyMetrics = () => {
      rafId = null;
      const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      if (orientation !== lastOrientation) {
        lastOrientation = orientation;
        baselineHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);
      }

      const vv = window.visualViewport;
      const vvHeight = vv ? vv.height : window.innerHeight;
      const vvOffsetTop = vv ? vv.offsetTop : 0;

      // Update baseline when viewport grows (e.g. URL bar collapses or keyboard closes)
      if (!hasEditableFocus && vvHeight > baselineHeight) {
        baselineHeight = vvHeight;
      }
      if (!hasEditableFocus && window.innerHeight > baselineHeight) {
        baselineHeight = window.innerHeight;
      }

      // Difference between layout viewport and visual viewport (iOS overlay keyboard)
      const layoutDelta = Math.max(0, window.innerHeight - (vvHeight + vvOffsetTop));
      // Difference between baseline viewport and current visual viewport (catches resizes-content too)
      const baselineDelta = Math.max(0, baselineHeight - vvHeight);

      const estimatedKeyboardHeight = Math.round(Math.max(layoutDelta, baselineDelta));
      const isViewportShrunk = estimatedKeyboardHeight > 120;
      const isMobile = isMobileOrTouchViewport();

      // Keyboard is considered open if viewport shrunk significantly OR a text input is focused on mobile
      const isOpen = isMobile && (isViewportShrunk || hasEditableFocus);

      // Fixed-element bottom offset:
      // - On iOS Safari / WKWebView, window.innerHeight does NOT shrink, so layoutDelta > 0 -> shift fixed elements up by layoutDelta
      // - On Android Chrome / resizes-content, window.innerHeight DOES shrink, so layoutDelta ~ 0 -> 0px (no double shift!)
      const keyboardOffset = layoutDelta > 60 ? Math.round(layoutDelta) : 0;

      root.style.setProperty('--vvh', `${Math.round(vvHeight)}px`);
      root.style.setProperty('--keyboard-height', `${isOpen ? estimatedKeyboardHeight : 0}px`);
      root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
      root.dataset.keyboardOpen = isOpen ? 'true' : 'false';
      document.body.classList.toggle('keyboard-open', isOpen);

      if (isOpen !== lastKeyboardOpen) {
        lastKeyboardOpen = isOpen;
        window.dispatchEvent(
          new CustomEvent('soundit-keyboard-change', {
            detail: { isOpen, keyboardHeight: estimatedKeyboardHeight, keyboardOffset },
          })
        );
      }

      // If keyboard just resized while an input is focused, ensure it remains centered and unobstructed
      if (isOpen && document.activeElement && isTextEditableElement(document.activeElement)) {
        ensureInputVisible(document.activeElement);
      }
    };

    const scheduleApply = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(applyMetrics);
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (blurTimer !== null) {
        window.clearTimeout(blurTimer);
        blurTimer = null;
      }

      if (isTextEditableElement(target)) {
        hasEditableFocus = true;
        scheduleApply();

        if (isMobileOrTouchViewport()) {
          if (scrollTimer1 !== null) window.clearTimeout(scrollTimer1);
          if (scrollTimer2 !== null) window.clearTimeout(scrollTimer2);
          scrollTimer1 = window.setTimeout(() => ensureInputVisible(target), 120);
          scrollTimer2 = window.setTimeout(() => ensureInputVisible(target), 350);
        }
      }
    };

    const handleFocusOut = () => {
      if (blurTimer !== null) window.clearTimeout(blurTimer);
      // Small delay so switching directly from one input to another does not flicker the bottom nav
      blurTimer = window.setTimeout(() => {
        hasEditableFocus = isTextEditableElement(document.activeElement);
        scheduleApply();
      }, 120);
    };

    const handleOrientationChange = () => {
      window.setTimeout(() => {
        baselineHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);
        scheduleApply();
      }, 250);
    };

    applyMetrics();

    window.visualViewport?.addEventListener('resize', scheduleApply);
    window.visualViewport?.addEventListener('scroll', scheduleApply);
    window.addEventListener('resize', scheduleApply);
    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (blurTimer !== null) window.clearTimeout(blurTimer);
      if (scrollTimer1 !== null) window.clearTimeout(scrollTimer1);
      if (scrollTimer2 !== null) window.clearTimeout(scrollTimer2);
      window.visualViewport?.removeEventListener('resize', scheduleApply);
      window.visualViewport?.removeEventListener('scroll', scheduleApply);
      window.removeEventListener('resize', scheduleApply);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
    };
  }, []);
}

export function MobileViewportManager() {
  useMobileViewport();
  return null;
}
