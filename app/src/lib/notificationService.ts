/**
 * NotificationService — unified PWA notification API (per notification spec §D).
 *
 * Covers: permission flow (gesture-triggered, settings deep-link when denied),
 * Web Push subscribe/unsubscribe (VAPID), Badging API helpers, and helpers the
 * service worker relies on for deep-link routing.
 *
 * iOS (APNs) and Android (FCM) native bridges are documented in
 * docs/NOTIFICATIONS.md — this module is the PWA/web layer both rely on.
 */

import { API_BASE_URL } from '@/config/api';

const VAPID_URL = `${API_BASE_URL}/notifications/vapid-public-key`;
const SUBSCRIBE_URL = `${API_BASE_URL}/notifications/push-subscribe`;
const UNSUBSCRIBE_URL = `${API_BASE_URL}/notifications/push-unsubscribe`;

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth-token') || localStorage.getItem('token')
    || (() => { try { return JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.session?.access_token; } catch { return null; } })();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Convert a base64 VAPID key to a Uint8Array for pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export const NotificationService = {
  /** Current Notification.permission: 'default' | 'granted' | 'denied' */
  getPermission(): NotificationPermission | 'unsupported' {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  },

  /**
   * Request browser notification permission. Must be called from a user gesture.
   * Returns the resulting permission. 'denied' means the user must re-enable via
   * browser/OS settings — surface openSettingsHint() in the UI in that case.
   */
  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  },

  /** True if an active push subscription exists for this device. */
  async isSubscribed(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  },

  /** Subscribe this device to Web Push (call after permission is granted). */
  async subscribe(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch(VAPID_URL);
      if (!keyRes.ok) return false;
      const { public_key } = await keyRes.json();
      if (!public_key) return false;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
      });

      const res = await fetch(SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(subscription.toJSON()),
      });
      return res.ok;
    } catch (e) {
      console.warn('[Notifications] subscribe failed:', e);
      return false;
    }
  },

  /** Unsubscribe this device and tell the backend to deactivate it. */
  async unsubscribe(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch(UNSUBSCRIBE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      return true;
    } catch (e) {
      console.warn('[Notifications] unsubscribe failed:', e);
      return false;
    }
  },

  /**
   * Full enable flow for the settings toggle: request permission (gesture),
   * then subscribe. Returns a status string for UI feedback.
   */
  async enablePush(): Promise<'enabled' | 'denied' | 'failed'> {
    const permission = await this.requestPermission();
    if (permission === 'denied') return 'denied';
    if (permission !== 'granted') return 'failed';
    return (await this.subscribe()) ? 'enabled' : 'failed';
  },

  /** Show a local notification while the app is open (uses the SW so it also works when the tab loses focus). */
  async showLocal(title: string, options: { body?: string; tag?: string; url?: string; image?: string } = {}): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body: options.body || '',
        tag: options.tag || 'soundit-local',
        renotify: true,
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        data: { url: options.url || '/', ...(options.image ? { image: options.image } : {}) },
        ...(options.image ? { image: options.image } : {}),
      } as NotificationOptions);
    } else {
      new Notification(title, { body: options.body || '' });
    }
  },

  /** Badge count on the installed PWA icon (Badging API; no-op where unsupported). */
  async setBadge(count: number): Promise<void> {
    try {
      if ('setAppBadge' in navigator) await (navigator as any).setAppBadge(count);
    } catch { /* unsupported */ }
  },

  async clearBadge(): Promise<void> {
    try {
      if ('clearAppBadge' in navigator) await (navigator as any).clearAppBadge();
    } catch { /* unsupported */ }
  },

  /** Human hint to show when permission === 'denied'. */
  openSettingsHint(): { message: string } {
    return {
      message: 'Notifications are blocked. Enable them in your browser/site settings, then try again.',
    };
  },

  /** Call when the notifications screen is viewed — clears the app badge. */
  async markSeen(): Promise<void> {
    await this.clearBadge();
  },
};

export default NotificationService;
