import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, ChevronRight, Globe, HelpCircle, LogOut, Moon, Sun, Monitor,
  Shield, User as UserIcon, UserPlus, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
  fr: 'Français',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
  de: 'Deutsch',
  ja: '日本語',
  ko: '한국어',
};

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { profile, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, isDark, setTheme } = useThemeStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const displayName = (profile?.first_name || profile?.last_name
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : profile?.email?.split('@')[0] || '');

  const currentLanguage = LANGUAGE_NAMES[i18n.language?.split('-')[0]] || LANGUAGE_NAMES.en;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { icon: UserIcon, label: t('kit.settingsMenu.profile'), value: null as string | null, path: '/profile' },
    { icon: Bell, label: t('kit.settingsMenu.notifications'), value: null, path: '/settings/notifications' },
    { icon: Shield, label: t('kit.settingsMenu.security'), value: null, path: '/settings/security' },
    { icon: Globe, label: t('kit.settingsMenu.language'), value: currentLanguage, path: '/settings/language' },
    { icon: HelpCircle, label: t('kit.settingsMenu.helpCenter'), value: null, path: '/help' },
    { icon: UserPlus, label: t('kit.settingsMenu.inviteFriends'), value: null, path: '/settings/invite' },
  ];

  const themeOptions: { mode: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { mode: 'system', label: t('settings.themeSystem', 'System'), icon: Monitor },
    { mode: 'light', label: t('settings.themeLight', 'Light'), icon: Sun },
    { mode: 'dark', label: t('settings.themeDark', 'Dark'), icon: Moon },
  ];

  return (
    <div className="min-h-screen pb-12 pt-16 lg:pt-20 bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-2 pb-4">
          <h1 className="text-2xl font-bold text-[#020b00] dark:text-white">{t('kit.settingsMenu.title')}</h1>
        </div>

        {/* Profile header card */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-4 bg-neutral-50 dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-4 text-left active:border-[#d3da0c]/30 transition-colors mb-4 shadow-xs"
        >
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#d3da0c]/60 bg-black/5 dark:bg-white/5 shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
                <span className="text-xl font-bold text-black">{(displayName || '?')[0].toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[#020b00] dark:text-white truncate">{displayName}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {profile?.followers_count || 0} {t('kit.profile.followers')} · {profile?.following_count || 0} {t('kit.profile.following')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-600 shrink-0" />
        </motion.button>

        {/* Menu rows */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-neutral-50 dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden mb-4 shadow-xs"
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path!)}
                className={`w-full flex items-center gap-3 px-4 py-4 min-h-[44px] text-left hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors ${index > 0 ? 'border-t border-black/6 dark:border-white/5' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/15 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
                </div>
                <span className="text-sm font-medium text-[#020b00] dark:text-white flex-1">{item.label}</span>
                {item.value && <span className="text-xs text-gray-500 mr-1">{item.value}</span>}
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-600 shrink-0" />
              </button>
            );
          })}

          {/* Theme selector row: System / Light / Dark */}
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 min-h-[56px] border-t border-black/6 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/15 flex items-center justify-center shrink-0">
                {isDark ? (
                  <Moon className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
                ) : (
                  <Sun className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-[#020b00] dark:text-white">
                  {t('settings.appearance', 'Appearance')}
                </p>
                <p className="text-[11px] text-gray-500 capitalize">
                  {theme === 'system' ? `${t('settings.themeSystem', 'System')} (${isDark ? 'Dark' : 'Light'})` : theme}
                </p>
              </div>
            </div>

            {/* Segmented control */}
            <div className="flex items-center bg-black/6 dark:bg-white/6 p-1 rounded-xl gap-1 self-start sm:self-center border border-black/5 dark:border-white/5">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setTheme(opt.mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#d3da0c] text-black font-semibold shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                    }`}
                    aria-label={`Set theme to ${opt.label}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Log out */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 min-h-[48px] rounded-2xl bg-neutral-50 dark:bg-[#111111] border border-red-500/15 text-red-500 dark:text-red-400 font-medium text-sm hover:bg-red-500/5 transition-colors shadow-xs"
        >
          <LogOut className="w-5 h-5" />
          {t('kit.settingsMenu.logOut')}
        </motion.button>
      </div>

      {/* Logout confirmation dialog */}
      {createPortal(
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm text-[#020b00] dark:text-white shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#020b00] dark:text-white">{t('kit.settingsMenu.logOut')}</h3>
                <button onClick={() => setShowLogoutConfirm(false)} className="p-1.5 bg-black/5 dark:bg-white/5 rounded-full text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">{t('kit.settingsMenu.logOutConfirm')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 min-h-[44px] bg-black/5 dark:bg-white/5 text-gray-700 dark:text-white text-sm rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  {t('kit.common.cancel')}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 min-h-[44px] bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors"
                >
                  {t('kit.settingsMenu.logOut')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </div>
  );
};

export default Settings;
