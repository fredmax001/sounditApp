/**
 * InlineNotificationAlert — Pattern #5: Platform-aware inline status alert
 * clearly distinguishing in-app notifications from OS/browser push delivery.
 */
import { useEffect, useState } from 'react';
import { BellOff, BellRing, Info, Loader2, Smartphone } from 'lucide-react';
import { getNativePlatform, getWebPushCapability } from '@/lib/platform';
import { NativePush } from '@/lib/nativePush';
import { NotificationService } from '@/lib/notificationService';
import { toast } from 'sonner';

interface InlineNotificationAlertProps {
  onEnabled?: () => void;
  compact?: boolean;
}

export default function InlineNotificationAlert({ onEnabled, compact = false }: InlineNotificationAlertProps) {
  const nativePlatform = getNativePlatform();
  const webCap = getWebPushCapability();

  const [permState, setPermState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (nativePlatform) {
        const st = await NativePush.checkPermission();
        if (mounted) setPermState(st);
      } else if (!webCap.supported) {
        if (mounted) setPermState('unsupported');
      } else {
        const p = NotificationService.getPermission();
        if (mounted) setPermState(p === 'default' ? 'prompt' : p);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [nativePlatform, webCap.supported]);

  if (permState === 'granted') return null;

  const handleEnable = async () => {
    setEnabling(true);
    try {
      if (nativePlatform) {
        const ok = await NativePush.enable();
        if (ok) {
          setPermState('granted');
          toast.success('Push notifications enabled');
          onEnabled?.();
        } else {
          setPermState('denied');
          toast.error(
            nativePlatform === 'ios'
              ? 'Allow Sound It notifications in iOS Settings → Notifications.'
              : 'Allow Sound It notifications in Android App Settings.'
          );
        }
      } else {
        const res = await NotificationService.enablePush();
        if (res === 'enabled') {
          setPermState('granted');
          toast.success('Browser push notifications enabled');
          onEnabled?.();
        } else if (res === 'denied') {
          setPermState('denied');
          toast.error(NotificationService.openSettingsHint().message);
        } else {
          toast.error('Could not enable push notifications right now.');
        }
      }
    } finally {
      setEnabling(false);
    }
  };

  if (permState === 'unsupported') {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 flex items-start gap-3">
        {webCap.requiresPwaInstall ? (
          <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#020b00] dark:text-white">
            {webCap.requiresPwaInstall ? 'Install Sound It for Push Alerts' : 'In-App Notifications Active'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
            {webCap.reason}
          </p>
        </div>
      </div>
    );
  }

  if (permState === 'denied') {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-3.5 flex items-start gap-3">
        <BellOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#020b00] dark:text-white">Push Notifications Blocked</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
            {nativePlatform === 'ios'
              ? 'Open iPhone Settings → Sound It → Notifications to turn alerts back on. In-app notifications still appear here.'
              : nativePlatform === 'android'
              ? 'Open Android Settings → Apps → Sound It → Notifications to allow alerts. In-app notifications still appear here.'
              : 'Notifications are blocked in your browser site settings. Re-enable permission there to receive background alerts.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[#d3da0c]/30 bg-[#d3da0c]/10 ${compact ? 'p-3' : 'p-4'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#d3da0c]/20 border border-[#d3da0c]/40 flex items-center justify-center shrink-0">
          <BellRing className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#020b00] dark:text-white">
            Turn on Push Notifications
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
            Get instant alerts for ticket approvals, bookings, messages, and events you care about.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={enabling}
        className="px-[1.15em] py-[0.55em] rounded-full bg-[#d3da0c] text-black text-xs font-extrabold shrink-0 flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
      >
        {enabling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Enable Push
      </button>
    </div>
  );
}
