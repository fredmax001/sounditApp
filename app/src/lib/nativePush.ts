/**
 * Unified Native Push Manager for Capacitor iOS (APNs) & Android (FCM).
 *
 * Handles:
 * - Runtime platform detection (ios | android)
 * - Permission checks & gesture-triggered permission requests
 * - Device token registration & sync with /api/v1/notifications/native-token
 * - Clean token deactivation on disable/logout via DELETE /api/v1/notifications/native-token
 * - Foreground push banner events ('native-push-received')
 * - Background/terminated notification tap deep-link routing ('notification-click')
 */
// @ts-ignore
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL } from '@/config/api';
import { getNativePlatform } from '@/lib/platform';

let listenersReady = false;
let registrationWaiter: Promise<string> | null = null;
let lastRegisteredToken: string | null = null;

const LAST_TOKEN_KEY = 'soundit_native_push_token';
const DEVICE_ID_KEY = 'soundit_device_id';

function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `${getNativePlatform() || 'app'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'native-device';
  }
}

function authToken(): string | null {
  try {
    return (
      localStorage.getItem('auth-token') ||
      localStorage.getItem('token') ||
      JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.session?.access_token ||
      null
    );
  } catch {
    return null;
  }
}

async function syncTokenToBackend(pushToken: string, platform: 'ios' | 'android'): Promise<boolean> {
  const token = authToken();
  if (!token || !pushToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/native-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        token: pushToken,
        platform,
        device_id: getOrCreateDeviceId(),
        app_version: '2.0.0',
      }),
    });
    if (res.ok) {
      lastRegisteredToken = pushToken;
      try {
        localStorage.setItem(LAST_TOKEN_KEY, pushToken);
      } catch { /* ignore */ }
      return true;
    }
    return false;
  } catch (err) {
    console.error('[NativePush] Failed to sync device token', err);
    return false;
  }
}

function ensureListeners(platform: 'ios' | 'android') {
  if (listenersReady) return;
  listenersReady = true;

  PushNotifications.addListener('registration', async ({ value }) => {
    registrationWaiter = null;
    await syncTokenToBackend(value, platform);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error(`[NativePush] ${platform.toUpperCase()} registration failed`, error);
    registrationWaiter = null;
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    window.dispatchEvent(
      new CustomEvent('native-push-received', {
        detail: {
          title: notification.title || 'Sound It',
          body: notification.body || '',
          data: notification.data || {},
          id: notification.id,
        },
      })
    );
    window.dispatchEvent(new Event('notifications-updated'));
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data || {};
    const url = (data.action_url || data.url) as string | undefined;
    const notificationId = data.notification_id;
    const target = url || (notificationId ? `/notifications/${notificationId}` : '/notifications');
    window.dispatchEvent(new CustomEvent('notification-click', { detail: { url: target, data } }));
  });
}

export const NativePush = {
  getPlatform: () => getNativePlatform(),
  isNativeSupported: () => getNativePlatform() !== null,
  isNativeIOS: () => getNativePlatform() === 'ios',
  isNativeAndroid: () => getNativePlatform() === 'android',

  async checkPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    const platform = getNativePlatform();
    if (!platform) return 'unsupported';
    try {
      const res = await PushNotifications.checkPermissions();
      if (res.receive === 'granted') return 'granted';
      if (res.receive === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unsupported';
    }
  },

  /**
   * Silent sync on authenticated startup: only attaches listeners & registers
   * if permission is ALREADY granted (never prompts unasked).
   */
  async syncIfPermitted(): Promise<boolean> {
    const platform = getNativePlatform();
    if (!platform || !authToken()) return false;
    try {
      ensureListeners(platform);
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive !== 'granted') return false;
      await PushNotifications.register();
      const cached = lastRegisteredToken || localStorage.getItem(LAST_TOKEN_KEY);
      if (cached) {
        await syncTokenToBackend(cached, platform);
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Gesture-triggered enable flow for both iOS (APNs) and Android (FCM).
   */
  async enable(): Promise<boolean> {
    const platform = getNativePlatform();
    if (!platform) return false;

    ensureListeners(platform);

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return false;

    let registrationHandle: { remove: () => Promise<void> } | undefined;
    registrationWaiter = new Promise((resolve) => {
      const timeout = window.setTimeout(() => resolve(''), 15000);
      PushNotifications.addListener('registration', ({ value }) => {
        window.clearTimeout(timeout);
        resolve(value);
      }).then((handle) => {
        registrationHandle = handle;
      });
    });

    await PushNotifications.register();
    const token = await registrationWaiter;
    await registrationHandle?.remove();
    if (token) {
      await syncTokenToBackend(token, platform);
      return true;
    }
    return false;
  },

  /**
   * Deactivate the device token on the backend (when disabling push or logging out).
   */
  async disable(): Promise<boolean> {
    const platform = getNativePlatform();
    const jwt = authToken();
    if (!platform || !jwt) return false;
    try {
      const cached = lastRegisteredToken || localStorage.getItem(LAST_TOKEN_KEY) || '';
      const params = cached
        ? `?token=${encodeURIComponent(cached)}`
        : `?device_id=${encodeURIComponent(getOrCreateDeviceId())}`;
      const res = await fetch(`${API_BASE_URL}/notifications/native-token${params}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
