import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_BASE_URL } from '@/config/api';

let listenersReady = false;
let registrationWaiter: Promise<string> | null = null;

function authToken(): string | null {
  return localStorage.getItem('auth-token') || localStorage.getItem('token') ||
    (() => { try { return JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.session?.access_token || null; } catch { return null; } })();
}

export const NativePush = {
  isNativeIOS: () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios',

  async enable(): Promise<boolean> {
    if (!this.isNativeIOS()) return false;
    if (!listenersReady) {
      listenersReady = true;
      PushNotifications.addListener('registration', async ({ value }) => {
        registrationWaiter = null;
        const token = authToken();
        if (!token) return;
        await fetch(`${API_BASE_URL}/notifications/native-token`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token: value, platform: 'ios' }),
        });
      });
      PushNotifications.addListener('registrationError', (error) => {
        console.error('[NativePush] APNs registration failed', error);
        registrationWaiter = null;
      });
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        window.dispatchEvent(new CustomEvent('native-push-received', { detail: notification }));
      });
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = (action.notification.data?.action_url || action.notification.data?.url) as string | undefined;
        if (url) window.dispatchEvent(new CustomEvent('notification-click', { detail: { url } }));
      });
    }

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return false;

    let registrationHandle: { remove: () => Promise<void> } | undefined;
    registrationWaiter = new Promise(resolve => {
      const timeout = window.setTimeout(() => resolve(''), 15000);
      PushNotifications.addListener('registration', ({ value }) => {
        window.clearTimeout(timeout);
        resolve(value);
      }).then(handle => { registrationHandle = handle; });
    });
    await PushNotifications.register();
    const token = await registrationWaiter;
    await registrationHandle?.remove();
    return !!token;
  },
};
