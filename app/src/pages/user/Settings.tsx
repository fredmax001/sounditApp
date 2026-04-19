import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Bell, Lock, Globe, Moon, Trash2, Loader2, Eye, EyeOff, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { API_BASE_URL } from '@/config/api';

interface UserSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  eventReminders: boolean;
  marketingEmails: boolean;
  twoFactor: boolean;
}

const languages = [
  { code: 'en', name: 'English', flag: 'EN' },
  { code: 'fr', name: 'Français', flag: 'FR' },
  { code: 'zh', name: '中文', flag: 'ZH' },
];

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { session } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const isDeleting = false;

  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    pushNotifications: true,
    eventReminders: true,
    marketingEmails: false,
    twoFactor: false,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    useThemeStore.getState().initTheme();
  }, []);

  // Fetch user settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.access_token) return;

      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setSettings(prev => ({
            ...prev,
            emailNotifications: data.email_notifications ?? prev.emailNotifications,
            eventReminders: data.event_reminders ?? prev.eventReminders,
            pushNotifications: data.booking_updates ?? prev.pushNotifications,
            marketingEmails: prev.marketingEmails,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [session]);

  const saveSettingsToBackend = async (newSettings: UserSettings) => {
    if (!session?.access_token) {
      toast.error('Not authenticated');
      return false;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          emailNotifications: newSettings.emailNotifications,
          pushNotifications: newSettings.pushNotifications,
          eventReminders: newSettings.eventReminders,
          marketingEmails: newSettings.marketingEmails,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save settings');
      }

      return true;
    } catch {
      toast.error('Failed to save settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (key: keyof UserSettings) => {
    if (key === 'twoFactor') {
      toast.error('Two-factor authentication settings are not supported yet');
      return;
    }

    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };
    setSettings(newSettings);

    const success = await saveSettingsToBackend(newSettings);
    if (success) {
      toast.success('Setting saved');
    }
  };

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    toast.success('Language updated');
  };

  const handleThemeToggle = () => {
    toggleTheme();
    toast.success(isDark ? 'Light mode enabled' : 'Dark mode enabled');
  };

  const handleSave = async () => {
    const success = await saveSettingsToBackend(settings);
    if (success) {
      toast.success('Settings saved successfully');
    }
  };

  const handleChangePassword = async () => {
    if (!session?.access_token) {
      toast.error('Not authenticated');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      toast.error('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    if (!session?.access_token) {
      toast.error('Not authenticated');
      return;
    }

    toast.error('Account deletion is not supported by the current backend API');
  };

  const settingSections = [
    {
      title: 'Notifications',
      icon: Bell,
      settings: [
        { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive updates about your events' },
        { key: 'pushNotifications', label: 'Push Notifications', description: 'Get notified about new events' },
        { key: 'eventReminders', label: 'Event Reminders', description: 'Reminders before your booked events' },
        { key: 'marketingEmails', label: 'Marketing Emails', description: 'Promotions and special offers' },
      ],
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-6">
      {/* Header */}
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
        <p className="text-gray-500 text-sm">Manage your preferences and account</p>
      </div>

      {/* Settings Content */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 space-y-3">
        {/* Appearance / Theme */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-white/5 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
              <Moon className="w-4 h-4 text-[#d3da0c]" />
            </div>
            <h2 className="text-base font-semibold text-white">{t('settings.appearance')}</h2>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white text-sm font-medium">{t('settings.darkMode')}</p>
              <p className="text-gray-500 text-xs">Toggle between dark and light theme</p>
            </div>
            <button
              onClick={handleThemeToggle}
              className={`w-11 h-6 rounded-full transition-colors relative ${isDark ? 'bg-[#d3da0c]' : 'bg-white/20'}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </motion.div>

        {/* Language */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#111111] border border-white/5 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-[#d3da0c]" />
            </div>
            <h2 className="text-base font-semibold text-white">{t('settings.language')}</h2>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${i18n.language === lang.code
                    ? 'bg-[#d3da0c]/15 border border-[#d3da0c]/40'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className={`text-sm font-medium ${i18n.language === lang.code ? 'text-[#d3da0c]' : 'text-white'}`}>
                  {lang.name}
                </span>
                {i18n.language === lang.code && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#d3da0c]" />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Notification Settings */}
        {settingSections.map((section, sectionIndex) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + sectionIndex * 0.05 }}
              className="bg-[#111111] border border-white/5 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#d3da0c]" />
                </div>
                <h2 className="text-base font-semibold text-white">{section.title}</h2>
              </div>

              <div className="space-y-1">
                {section.settings.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
                  >
                    <div className="pr-4">
                      <p className="text-white text-sm font-medium">{setting.label}</p>
                      <p className="text-gray-500 text-xs">{setting.description}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(setting.key as keyof UserSettings)}
                      disabled={setting.key === 'twoFactor'}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${settings[setting.key as keyof UserSettings] ? 'bg-[#d3da0c]' : 'bg-white/20'}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings[setting.key as keyof UserSettings] ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* Password */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111111] border border-white/5 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-[#d3da0c]" />
            </div>
            <h2 className="text-base font-semibold text-white">Password</h2>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 border border-white/5 rounded-xl text-white text-sm hover:bg-white/10 transition-colors"
          >
            <span>Change Password</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111111] border border-red-500/15 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-white">Danger Zone</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Delete Account</p>
              <p className="text-gray-500 text-xs">This action cannot be undone</p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 bg-red-500/10 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          </div>
        </motion.div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowPasswordModal(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-[#111111] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md border-t sm:border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="Current Password"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none pr-10"
                />
                <button
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="New Password"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none pr-10"
                />
                <button
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm New Password"
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none pr-10"
                />
                <button
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className="flex-1 py-2.5 bg-[#d3da0c] text-black text-sm font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
              >
                {isChangingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Change Password'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="bg-[#111111] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md border-t sm:border border-red-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-1">Delete Account</h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-xs">
                Type <strong>DELETE</strong> to confirm
              </p>
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-red-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-white text-sm rounded-xl hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Settings;
