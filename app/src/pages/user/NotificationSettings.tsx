import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { Switch } from '@/components/ui/switch';
import { NotificationService } from '@/lib/notificationService';

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

const NotificationSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof Prefs | null>(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setPrefs(prev => ({ ...prev, ...data }));
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrefs();
  }, [session?.access_token]);

  const handleToggle = async (key: keyof Prefs) => {
    const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      toast.error(t('user.favorites.youMustBeLoggedIn'));
      return;
    }
    const previous = prefs[key];
    const next = !previous;

    // Push toggle = real browser permission + Web Push subscribe/unsubscribe
    if (key === 'push_enabled' && next) {
      setSavingKey(key);
      const status = await NotificationService.enablePush();
      if (status !== 'enabled') {
        setSavingKey(null);
        if (status === 'denied') {
          toast.error(NotificationService.openSettingsHint().message);
        } else {
          toast.error(t('settings.saveFailed', 'Failed to save settings'));
        }
        return;
      }
    } else if (key === 'push_enabled' && !next) {
      await NotificationService.unsubscribe();
    }

    setPrefs(prev => ({ ...prev, [key]: next }));
    setSavingKey(key);
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: next })
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      setPrefs(prev => ({ ...prev, [key]: previous }));
      toast.error(t('settings.saveFailed', 'Failed to save settings'));
    } finally {
      setSavingKey(null);
    }
  };

  const channels: { key: keyof Prefs; label: string; desc: string }[] = [
    { key: 'push_enabled', label: t('kit.notifications.push'), desc: t('kit.notifications.pushDesc') },
    { key: 'email_enabled', label: t('kit.notifications.email'), desc: t('kit.notifications.emailDesc') },
    { key: 'sms_enabled', label: t('kit.notifications.sms'), desc: t('kit.notifications.smsDesc') },
  ];

  const activity: { key: keyof Prefs; label: string; desc: string }[] = [
    { key: 'bookings', label: t('kit.notifications.bookings'), desc: t('kit.notifications.bookingsDesc') },
    { key: 'booking_updates', label: t('kit.notifications.booking_updates'), desc: t('kit.notifications.bookingUpdatesDesc') },
    { key: 'payments', label: t('kit.notifications.payments'), desc: t('kit.notifications.paymentsDesc') },
    { key: 'events', label: t('kit.notifications.events'), desc: t('kit.notifications.eventsDesc') },
    { key: 'messages', label: t('kit.notifications.messages'), desc: t('kit.notifications.messagesDesc') },
    { key: 'signup_alerts', label: t('kit.notifications.signup_alerts'), desc: t('kit.notifications.signupAlertsDesc') },
    { key: 'verifications', label: t('kit.notifications.verifications'), desc: t('kit.notifications.verificationsDesc') },
    { key: 'subscriptions', label: t('kit.notifications.subscriptions'), desc: t('kit.notifications.subscriptionsDesc') },
    { key: 'marketing', label: t('kit.notifications.marketing'), desc: t('kit.notifications.marketingDesc') },
  ];

  const renderGroup = (title: string, items: typeof channels, delay: number) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden"
    >
      <h2 className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
      <div className="divide-y divide-white/5">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            {savingKey === item.key ? (
              <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin shrink-0" />
            ) : (
              <Switch
                checked={prefs[item.key]}
                onCheckedChange={() => handleToggle(item.key)}
                className="data-[state=checked]:bg-[#d3da0c] shrink-0"
                aria-label={item.label}
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen pb-12">
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            aria-label={t('kit.common.back')}
            className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display text-white">{t('kit.notifications.title')}</h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-3 animate-pulse">
                <div className="h-3 bg-white/5 rounded w-1/4" />
                <div className="h-8 bg-white/5 rounded" />
                <div className="h-8 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && loadError && (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">{t('kit.common.loadFailed')}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors min-h-[44px]"
            >
              {t('kit.common.tryAgain')}
            </button>
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            {renderGroup(t('kit.notifications.channels'), channels, 0)}
            {renderGroup(t('kit.notifications.activity'), activity, 0.05)}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
