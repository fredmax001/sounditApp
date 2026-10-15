import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, ChevronRight, Globe, HelpCircle, LogOut, Moon,
  Shield, User as UserIcon, UserPlus, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/store/themeStore';
import { Switch } from '@/components/ui/switch';

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
  const { isDark, toggleTheme } = useThemeStore();
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

  return (
    <div className="min-h-screen pb-12 pt-16 lg:pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-2 pb-4">
          <h1 className="text-2xl font-bold text-white">{t('kit.settingsMenu.title')}</h1>
        </div>

        {/* Profile header card */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-4 bg-[#111111] border border-white/5 rounded-2xl p-4 text-left active:border-[#d3da0c]/30 transition-colors mb-4"
        >
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#d3da0c]/60 bg-white/5 shrink-0">
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
            <p className="text-base font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {profile?.followers_count || 0} {t('kit.profile.followers')} · {profile?.following_count || 0} {t('kit.profile.following')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600 shrink-0" />
        </motion.button>

        {/* Menu rows */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden mb-4"
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path!)}
                className={`w-full flex items-center gap-3 px-4 py-4 min-h-[44px] text-left hover:bg-white/5 active:bg-white/10 transition-colors ${index > 0 ? 'border-t border-white/5' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#d3da0c]" />
                </div>
                <span className="text-sm font-medium text-white flex-1">{item.label}</span>
                {item.value && <span className="text-xs text-gray-500 mr-1">{item.value}</span>}
                <ChevronRight className="w-5 h-5 text-gray-600 shrink-0" />
              </button>
            );
          })}

          {/* Dark mode toggle row */}
          <div className="w-full flex items-center gap-3 px-4 py-4 min-h-[44px] border-t border-white/5">
            <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <span className="text-sm font-medium text-white flex-1">{t('kit.settingsMenu.darkMode')}</span>
            <Switch
              checked={isDark}
              onCheckedChange={() => toggleTheme()}
              className="data-[state=checked]:bg-[#d3da0c]"
              aria-label={t('kit.settingsMenu.darkMode')}
            />
          </div>
        </motion.div>

        {/* Log out */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 min-h-[48px] rounded-2xl bg-[#111111] border border-red-500/15 text-red-400 font-medium text-sm hover:bg-red-500/5 transition-colors"
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
              className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white">{t('kit.settingsMenu.logOut')}</h3>
                <button onClick={() => setShowLogoutConfirm(false)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-5">{t('kit.settingsMenu.logOutConfirm')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 min-h-[44px] bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors"
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
