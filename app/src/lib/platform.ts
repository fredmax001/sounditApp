/**
 * Reliable runtime platform detection for Sound It.
 *
 * CRITICAL: Uses Capacitor runtime bridge ONLY — never screen width or UA guessing
 * for native-app gating — so native-only onboarding NEVER leaks to Web or PWA.
 */
import { Capacitor } from '@capacitor/core';

export type RuntimePlatform = 'ios' | 'android' | 'pwa' | 'web';

export function getNativePlatform(): 'ios' | 'android' | null {
  if (typeof window === 'undefined') return null;
  try {
    if (Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform();
      if (p === 'ios' || p === 'android') return p;
    }
    const winCap = (window as any).Capacitor || (window as any).__capacitor;
    if (winCap?.isNativePlatform?.() === true) {
      const p = winCap.getPlatform?.();
      if (p === 'ios' || p === 'android') return p;
    }
  } catch {
    // Non-native browser runtime
  }
  return null;
}

/**
 * True ONLY inside the installed native iOS or Android Capacitor app.
 * Guaranteed false on desktop website, mobile website, PWA, and all browsers.
 */
export function isNativeMobileApp(): boolean {
  return getNativePlatform() !== null;
}

export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined' || isNativeMobileApp()) return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function getRuntimePlatform(): RuntimePlatform {
  const native = getNativePlatform();
  if (native) return native;
  return isPWAInstalled() ? 'pwa' : 'web';
}

export interface WebPushCapability {
  supported: boolean;
  requiresPwaInstall: boolean;
  reason?: string;
}

/**
 * Accurately assesses Web Push support across desktop browsers, mobile browsers,
 * iOS Safari (requires Home Screen PWA on iOS 16.4+), and in-app webviews.
 */
export function getWebPushCapability(): WebPushCapability {
  if (typeof window === 'undefined') {
    return { supported: false, requiresPwaInstall: false, reason: 'Unavailable in server runtime' };
  }
  if (isNativeMobileApp()) {
    return { supported: false, requiresPwaInstall: false, reason: 'Uses native push (APNs/FCM)' };
  }
  const ua = navigator.userAgent || '';
  const isIOSBrowser = /iPhone|iPad|iPod/i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);

  if (isWeChat) {
    return {
      supported: false,
      requiresPwaInstall: false,
      reason: 'In-app browsers like WeChat do not support Web Push. In-app notifications still work.',
    };
  }

  if (isIOSBrowser && !isPWAInstalled()) {
    return {
      supported: false,
      requiresPwaInstall: true,
      reason: 'On iPhone/iPad, add Sound It to your Home Screen (Share → Add to Home Screen) to enable Web Push notifications.',
    };
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return {
      supported: false,
      requiresPwaInstall: false,
      reason: 'This browser does not support Web Push. You will still receive real-time in-app notifications.',
    };
  }

  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    return {
      supported: false,
      requiresPwaInstall: false,
      reason: 'Web Push requires HTTPS.',
    };
  }

  return { supported: true, requiresPwaInstall: false };
}
