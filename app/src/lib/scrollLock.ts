/**
 * Reference-counted cross-platform body scroll lock (iOS WKWebView, Android WebView,
 * Mobile Safari, Chrome, Desktop).
 *
 * Uses overflow clipping on <html> and <body> without writing `overflow: unset`
 * (which would clobber `overflow-x: clip`) and preserves exact scroll position
 * across open/close cycles and nested modals.
 */

let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.dataset.scrollLocked = 'true';
  document.documentElement.style.overflowY = 'hidden';
  document.body.style.overflowY = 'hidden';
  document.body.classList.add('modal-open');
}

function releaseLock(restorePosition = true) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  delete document.documentElement.dataset.scrollLocked;
  document.documentElement.style.overflowY = '';
  document.body.style.overflowY = '';
  document.body.classList.remove('modal-open');

  if (restorePosition && savedScrollY > 0) {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const targetY = Math.min(savedScrollY, maxScroll);
    if (Math.abs((window.scrollY || 0) - targetY) > 2) {
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }
}

export function lockBodyScroll(): () => void {
  lockCount += 1;
  if (lockCount === 1) {
    applyLock();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      releaseLock(true);
    }
  };
}

/**
 * Emergency/route-transition reset so navigating away while a modal or drawer
 * is open can never leave the destination page permanently frozen.
 */
export function forceUnlockBodyScroll(): void {
  lockCount = 0;
  savedScrollY = 0;
  releaseLock(false);
}
