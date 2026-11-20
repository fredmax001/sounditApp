/**
 * LiveNotificationBridge — Cross-platform real-time notification coordinator.
 *
 * Mounted once inside <Router> in App.tsx:
 * 1. Renders foreground Push Notification Banners (iOS APNs, Android FCM, Web/PWA).
 * 2. Handles deep-link navigation when tapping any push notification ('notification-click').
 * 3. Synchronizes unread state & read actions across browser tabs via BroadcastChannel.
 * 4. Silently registers/refreshes iOS/Android native push tokens when already permitted.
 * 5. Fetches native-only onboarding eligibility state on login (strictly no-op on Web/PWA).
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { NativePush } from '@/lib/nativePush';
import { pushManager } from '@/lib/pushNotifications';
import { isNativeMobileApp } from '@/lib/platform';
import { useOnboardingStore } from '@/store/onboardingStore';

interface PushBannerItem {
  id: string;
  title: string;
  body: string;
  actionUrl?: string;
}

export default function LiveNotificationBridge() {
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuthStore();
  const { fetchState, resetLocalSession } = useOnboardingStore();
  const [banner, setBanner] = useState<PushBannerItem | null>(null);
  const dismissTimer = useRef<number | null>(null);

  // Sync native push & native onboarding state when auth status changes
  useEffect(() => {
    if (!isAuthenticated) {
      resetLocalSession();
      return;
    }

    if (isNativeMobileApp()) {
      NativePush.syncIfPermitted().catch(() => {});
      fetchState(profile?.id).catch(() => {});
    } else {
      pushManager.init().catch(() => {});
    }
  }, [isAuthenticated, profile?.id, fetchState, resetLocalSession]);

  // Listen for foreground push arrivals, deep-link clicks, and cross-tab sync
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('soundit_notifications');
        channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_UNREAD') {
            window.dispatchEvent(new Event('notifications-updated-local'));
          }
        };
      }
    } catch { /* unsupported */ }

    const showBanner = (detail: any) => {
      if (!detail) return;
      const title = String(detail.title || 'Sound It');
      const body = String(detail.body || detail.message || '');
      const data = detail.data || {};
      const actionUrl =
        data.action_url ||
        data.url ||
        (data.notification_id ? `/notifications/${data.notification_id}` : '/notifications');

      setBanner({
        id: `${Date.now()}`,
        title,
        body,
        actionUrl,
      });

      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      dismissTimer.current = window.setTimeout(() => {
        setBanner(null);
      }, 5500);
    };

    const handleNativePush = (e: Event) => showBanner((e as CustomEvent).detail);
    const handleWebPush = (e: Event) => showBanner((e as CustomEvent).detail);
    const handleNotifClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const target = detail?.url || detail?.data?.action_url || '/notifications';
      if (typeof target === 'string' && target.startsWith('/')) {
        navigate(target);
      } else if (typeof target === 'string' && target.startsWith('http')) {
        try {
          const parsed = new URL(target);
          if (parsed.origin === window.location.origin) {
            navigate(parsed.pathname + parsed.search + parsed.hash);
          }
        } catch {
          navigate('/notifications');
        }
      }
    };

    const handleNotifUpdated = () => {
      try {
        channel?.postMessage({ type: 'SYNC_UNREAD' });
      } catch { /* ignore */ }
    };

    window.addEventListener('native-push-received', handleNativePush);
    window.addEventListener('web-push-received', handleWebPush);
    window.addEventListener('notification-click', handleNotifClick);
    window.addEventListener('notifications-updated', handleNotifUpdated);

    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      window.removeEventListener('native-push-received', handleNativePush);
      window.removeEventListener('web-push-received', handleWebPush);
      window.removeEventListener('notification-click', handleNotifClick);
      window.removeEventListener('notifications-updated', handleNotifUpdated);
      channel?.close();
    };
  }, [navigate]);

  const handleOpenBanner = () => {
    const target = banner?.actionUrl || '/notifications';
    setBanner(null);
    navigate(target);
  };

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.id}
          initial={{ y: -110, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -110, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="fixed inset-x-3 sm:left-auto sm:right-4 sm:w-[min(92vw,24rem)] z-[115] pointer-events-auto"
          style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
          role="status"
          aria-live="polite"
        >
          <div
            onClick={handleOpenBanner}
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#071204]/95 backdrop-blur-xl border border-[#d3da0c]/40 shadow-[0_14px_40px_rgba(0,0,0,0.65)] cursor-pointer text-white"
          >
            <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/15 border border-[#d3da0c]/40 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d3da0c] animate-pulse shrink-0" />
                <p className="text-xs font-extrabold text-white truncate">{banner.title}</p>
              </div>
              {banner.body && (
                <p className="text-xs text-gray-300 line-clamp-2 mt-0.5 leading-snug">{banner.body}</p>
              )}
              <span className="inline-flex items-center gap-0.5 text-[0.6875rem] font-bold text-[#d3da0c] mt-1">
                Open <ChevronRight className="w-3 h-3" />
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBanner(null);
              }}
              aria-label="Dismiss notification"
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
