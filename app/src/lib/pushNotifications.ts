// Sound It - Push Notification Manager
// Handles service worker registration, push subscription, and badge API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

class PushNotificationManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private initialized = false;
  public isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  async init(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('[Push] Push notifications not supported');
      return false;
    }

    // Guard against double init (NotificationBell is mounted in both Navbar and MobileHeader)
    if (this.initialized) {
      if (this.swRegistration) {
        this.subscription = await this.swRegistration.pushManager.getSubscription();
      }
      return true;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[Push] Service Worker registered');

      // Check for existing subscription
      this.subscription = await this.swRegistration.pushManager.getSubscription();

      if (this.subscription) {
        console.log('[Push] Existing push subscription found');
        await this.sendSubscriptionToServer(this.subscription);
      }

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          window.dispatchEvent(new CustomEvent('notification-click', {
            detail: event.data
          }));
        }
      });

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[Push] Init failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported) return 'unsupported';

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      await this.subscribe();
    }

    return permission;
  }

  async subscribe(): Promise<boolean> {
    if (!this.swRegistration) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/vapid-public-key`);
      const { public_key } = await response.json();

      if (!public_key) {
        console.warn('[Push] VAPID public key not configured');
        return false;
      }

      const applicationServerKey = this.urlBase64ToUint8Array(public_key);

      this.subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });

      console.log('[Push] Push subscription created');
      await this.sendSubscriptionToServer(this.subscription);
      this.dispatchStateChange('subscribed');
      return true;
    } catch (error) {
      console.error('[Push] Subscription failed:', error);
      this.dispatchStateChange('failed');
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) return false;

    try {
      await this.subscription.unsubscribe();

      await fetch(`${API_BASE_URL}/notifications/push-unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}`
        },
        body: JSON.stringify({ endpoint: this.subscription.endpoint })
      });

      this.subscription = null;
      this.dispatchStateChange('unsubscribed');
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error);
      return false;
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription) {
    const subJson = subscription.toJSON();
    const token = localStorage.getItem('auth-token');
    if (!token) return;

    await fetch(`${API_BASE_URL}/notifications/push-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        device_type: this.detectDeviceType(),
        browser: this.detectBrowser()
      })
    });
  }

  // ========== BADGE API ==========

  async setBadge(count: number): Promise<void> {
    if ('setAppBadge' in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (error) {
        // Badge API may fail silently
      }
    }
  }

  async clearBadge(): Promise<void> {
    if ('clearAppBadge' in navigator) {
      try {
        await (navigator as any).clearAppBadge();
      } catch {
        // ignore
      }
    }
  }

  // ========== PERMISSION STATUS ==========

  getPermissionState(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  isSubscribed(): boolean {
    return !!this.subscription;
  }

  // ========== HELPERS ==========

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private detectDeviceType(): string {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent;
    if (/Chrome/.test(ua) && !/Edge/.test(ua)) return 'chrome';
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
    if (/Firefox/.test(ua)) return 'firefox';
    if (/Edge/.test(ua)) return 'edge';
    return 'unknown';
  }

  private dispatchStateChange(state: string) {
    window.dispatchEvent(new CustomEvent('push-state-change', { detail: state }));
  }
}

export const pushManager = new PushNotificationManager();
