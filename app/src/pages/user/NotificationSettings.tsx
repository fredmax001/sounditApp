import MobilePageHeader from '@/components/MobilePageHeader';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, Globe, Moon, Clock, Sparkles, Check, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { Switch } from '@/components/ui/switch';
import { NotificationService } from '@/lib/notificationService';
import { NativePush } from '@/lib/nativePush';

interface Prefs {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  bookings: boolean;
  booking_updates: boolean;
  payments: boolean;
  events: boolean;
  messages: boolean;
  signup_alerts: boolean;
  verifications: boolean;
  subscriptions: boolean;
  marketing: boolean;
}

interface SmartSettings {
  timezone: string;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  preferred_delivery_hour: number | null;
  recommendations: boolean;
  artist_updates: boolean;
  social: boolean;
  reengagement: boolean;
}

const DEFAULT_PREFS: Prefs = {
  push_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  bookings: true,
  booking_updates: true,
  payments: true,
  events: true,
  messages: true,
  signup_alerts: true,
  verifications: true,
  subscriptions: true,
  marketing: false,
};

const DEFAULT_SMART: SmartSettings = {
  timezone: 'Asia/Shanghai',
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  preferred_delivery_hour: 19,
  recommendations: true,
  artist_updates: true,
  social: true,
  reengagement: true,
};

const COMMON_TIMEZONES = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST, UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (HKT, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT, UTC+1)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (GMT, UTC+0)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT, UTC+3)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST, UTC+2)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET, UTC+1)' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT, UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT, UTC-8/-7)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

const NotificationSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [smart, setSmart] = useState<SmartSettings>(DEFAULT_SMART);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingSmart, setSavingSmart] = useState(false);

  // Device auto-detected timezone
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';

  const fetchData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const [prefsRes, smartRes] = await Promise.all([
        fetch(`${API_BASE_URL}/notifications/preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/notifications/smart-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (prefsRes.ok) {
        const data = await prefsRes.json();
        setPrefs((prev) => ({ ...prev, ...data }));
      }
      if (smartRes.ok) {
        const smartData = await smartRes.json();
        setSmart((prev) => ({ ...prev, ...smartData }));
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTogglePref = async (key: keyof Prefs) => {
    if (!token) {
      toast.error(t('user.favorites.youMustBeLoggedIn'));
      return;
    }
    const previous = prefs[key];
    const next = !previous;

    if (key === 'push_enabled' && next) {
      setSavingKey(key);
      const nativeIOS = NativePush.isNativeIOS();
      const enabled = nativeIOS ? await NativePush.enable() : (await NotificationService.enablePush()) === 'enabled';
      if (!enabled) {
        setSavingKey(null);
        if (nativeIOS) {
          toast.error('Allow notifications for Sound It in iPhone Settings, then try again.');
        } else if (NotificationService.getPermission() === 'denied') {
          toast.error(NotificationService.openSettingsHint().message);
        } else {
          toast.error(t('settings.saveFailed', 'Failed to save settings'));
        }
        return;
      }
    } else if (key === 'push_enabled' && !next) {
      await NotificationService.unsubscribe();
    }

    setPrefs((prev) => ({ ...prev, [key]: next }));
    setSavingKey(key);
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: previous }));
      toast.error(t('settings.saveFailed', 'Failed to save settings'));
    } finally {
      setSavingKey(null);
    }
  };

  const updateSmartSetting = async (updates: Partial<SmartSettings>) => {
    if (!token) return;
    const previous = { ...smart };
    setSmart((prev) => ({ ...prev, ...updates }));
    setSavingSmart(true);

    try {
      const res = await fetch(`${API_BASE_URL}/notifications/smart-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        throw new Error('Failed to save smart settings');
      }
      toast.success('Preferences updated');
    } catch {
      setSmart(previous);
      toast.error('Failed to save preferences');
    } finally {
      setSavingSmart(false);
    }
  };

  const channels: { key: keyof Prefs; label: string; desc: string }[] = [
    { key: 'push_enabled', label: t('kit.notifications.push'), desc: t('kit.notifications.pushDesc') },
    { key: 'email_enabled', label: t('kit.notifications.email'), desc: t('kit.notifications.emailDesc') },
    { key: 'sms_enabled', label: t('kit.notifications.sms'), desc: t('kit.notifications.smsDesc') },
  ];

  const smartCategories = [
    {
      key: 'recommendations' as const,
      label: 'Personalized Event Recommendations',
      desc: 'Smart recommendations tailored to your music taste, attended events, and venue visits.',
    },
    {
      key: 'artist_updates' as const,
      label: 'Followed Artists & DJ Updates',
      desc: 'New performances, recaps, and tour dates from creators and artists you follow.',
    },
    {
      key: 'social' as const,
      label: 'Social & Community Notifications',
      desc: 'Likes, comments, shares, and mentions on your community posts and videos.',
    },
    {
      key: 'reengagement' as const,
      label: 'Special Perks & Event Reminders',
      desc: 'Exclusive ticket presales, countdown alerts, and weekend event line-ups.',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-12 transition-colors">
      <MobilePageHeader title={t('kit.notifications.title')} onBack={() => navigate('/settings')} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-4 space-y-3 animate-pulse shadow-xs"
              >
                <div className="h-3 bg-black/5 dark:bg-white/5 rounded w-1/4" />
                <div className="h-8 bg-black/5 dark:bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && loadError && (
          <div className="text-center py-20">
            <p className="text-gray-600 dark:text-gray-400 mb-4">{t('kit.common.loadFailed')}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 transition-all min-h-[44px]"
            >
              {t('kit.common.tryAgain')}
            </button>
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            {/* 1. Time Zone & Quiet Hours Section (Phases 4 & 9) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#071205] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-[#d3da0c]" />
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Time Zone & Local Delivery
                  </h2>
                </div>
                {savingSmart && <Loader2 className="w-3.5 h-3.5 text-[#d3da0c] animate-spin" />}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Your Primary Time Zone
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={smart.timezone}
                    onChange={(e) => updateSmartSetting({ timezone: e.target.value })}
                    className="flex-1 bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#020b00] dark:text-white focus:outline-none focus:border-[#d3da0c]"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-black text-white">
                        {tz.label}
                      </option>
                    ))}
                    {!COMMON_TIMEZONES.some((tz) => tz.value === smart.timezone) && (
                      <option value={smart.timezone} className="bg-black text-white">
                        {smart.timezone}
                      </option>
                    )}
                  </select>

                  {smart.timezone !== detectedTz && (
                    <button
                      type="button"
                      onClick={() => updateSmartSetting({ timezone: detectedTz })}
                      className="px-2.5 py-2 rounded-xl bg-[#d3da0c]/20 hover:bg-[#d3da0c]/30 text-[#d3da0c] text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                      title={`Match device timezone: ${detectedTz}`}
                    >
                      <Wand2 className="w-3 h-3" />
                      Auto-Detect
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Notifications are scheduled to match your active wake hours in this time zone.
                </p>
              </div>

              {/* Quiet Hours */}
              <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-[#d3da0c]" />
                    <div>
                      <p className="text-sm font-semibold text-[#020b00] dark:text-white">Quiet Hours</p>
                      <p className="text-xs text-gray-500">Mute non-urgent notifications while sleeping</p>
                    </div>
                  </div>
                  <Switch
                    checked={smart.quiet_hours_enabled}
                    onCheckedChange={(c) => updateSmartSetting({ quiet_hours_enabled: c })}
                    className="data-[state=checked]:bg-[#020b00] dark:data-[state=checked]:bg-[#d3da0c]"
                  />
                </div>

                {smart.quiet_hours_enabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Starts At</label>
                      <input
                        type="time"
                        value={smart.quiet_hours_start}
                        onChange={(e) => updateSmartSetting({ quiet_hours_start: e.target.value })}
                        className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#020b00] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Ends At</label>
                      <input
                        type="time"
                        value={smart.quiet_hours_end}
                        onChange={(e) => updateSmartSetting({ quiet_hours_end: e.target.value })}
                        className="w-full bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-[#020b00] dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* 2. Smart Notification Categories */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-[#071205] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
            >
              <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#d3da0c]" />
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Smart Interest Personalization
                </h2>
              </div>
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {smartCategories.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#020b00] dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    <Switch
                      checked={smart[item.key]}
                      onCheckedChange={(c) => updateSmartSetting({ [item.key]: c })}
                      className="data-[state=checked]:bg-[#020b00] dark:data-[state=checked]:bg-[#d3da0c] shrink-0"
                    />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 3. Notification Delivery Channels */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
            >
              <h2 className="px-4 pt-4 pb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                {t('kit.notifications.channels')}
              </h2>
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {channels.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#020b00] dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    {savingKey === item.key ? (
                      <Loader2 className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c] animate-spin shrink-0" />
                    ) : (
                      <Switch
                        checked={prefs[item.key]}
                        onCheckedChange={() => handleTogglePref(item.key)}
                        className="data-[state=checked]:bg-[#020b00] dark:data-[state=checked]:bg-[#d3da0c] shrink-0"
                        aria-label={item.label}
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
