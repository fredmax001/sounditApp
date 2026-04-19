import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Bell, Send, Loader2, Mail, Smartphone, Clock
} from 'lucide-react';

interface NotificationHistoryItem {
  id: number;
  type: string;
  title: string;
  message: string;
  target_role?: string;
  created_at: string;
  status?: string;
}

const NotificationCenter = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState({
    title: '',
    message: '',
    type: 'push',
    target_role: 'all',
    scheduled_at: ''
  });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/notifications`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.notifications || []);
      }
    } catch {
      toast.error(t('admin.notificationCenter.failedToLoadHistory'));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notification.title || !notification.message) {
      toast.error(t('admin.notificationCenter.titleAndMessageRequired'));
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/notifications/send`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notification)
      });

      if (res.ok) {
        toast.success(t('admin.notificationCenter.notificationSent'));
        setNotification({
          title: '',
          message: '',
          type: 'push',
          target_role: 'all',
          scheduled_at: ''
        });
        loadHistory();
      }
    } catch {
      toast.error(t('admin.notificationCenter.failedToSendNotification'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.notificationCenter.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.notificationCenter.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Notification Form */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Send className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('admin.notificationCenter.composeNotification')}</h2>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('admin.notificationCenter.notificationType')}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNotification({ ...notification, type: 'push' })}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    notification.type === 'push' 
                      ? 'border-[#d3da0c] bg-[#d3da0c]/10 text-[#d3da0c]' 
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <Bell className="w-4 h-4 mx-auto mb-1" />
                  {t('admin.notificationCenter.typePush')}
                </button>
                <button
                  type="button"
                  onClick={() => setNotification({ ...notification, type: 'email' })}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    notification.type === 'email' 
                      ? 'border-[#d3da0c] bg-[#d3da0c]/10 text-[#d3da0c]' 
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <Mail className="w-4 h-4 mx-auto mb-1" />
                  {t('admin.notificationCenter.typeEmail')}
                </button>
                <button
                  type="button"
                  onClick={() => setNotification({ ...notification, type: 'sms' })}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    notification.type === 'sms' 
                      ? 'border-[#d3da0c] bg-[#d3da0c]/10 text-[#d3da0c]' 
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1" />
                  {t('admin.notificationCenter.typeSms')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('admin.notificationCenter.targetAudience')}</label>
              <select
                value={notification.target_role}
                onChange={(e) => setNotification({ ...notification, target_role: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
              >
                <option value="all">{t('admin.notificationCenter.audienceAll')}</option>
                <option value="user">{t('admin.notificationCenter.audienceUser')}</option>
                <option value="business">{t('admin.notificationCenter.audienceBusiness')}</option>
                <option value="artist">{t('admin.notificationCenter.audienceArtist')}</option>
                <option value="vendor">{t('admin.notificationCenter.audienceVendor')}</option>
                <option value="admin">{t('admin.notificationCenter.audienceAdmin')}</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('admin.notificationCenter.titleLabel')}</label>
              <input
                type="text"
                value={notification.title}
                onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                placeholder={t('admin.notificationCenter.titlePlaceholder')}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('admin.notificationCenter.messageLabel')}</label>
              <textarea
                value={notification.message}
                onChange={(e) => setNotification({ ...notification, message: e.target.value })}
                placeholder={t('admin.notificationCenter.messagePlaceholder')}
                rows={4}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">{t('admin.notificationCenter.scheduleLabel')}</label>
              <input
                type="datetime-local"
                value={notification.scheduled_at}
                onChange={(e) => setNotification({ ...notification, scheduled_at: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {notification.scheduled_at ? t('admin.notificationCenter.scheduleNotification') : t('admin.notificationCenter.sendNow')}
            </button>
          </form>
        </div>

        {/* Notification History */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">{t('admin.notificationCenter.recentNotifications')}</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-auto">
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t('admin.notificationCenter.noNotifications') || 'No notifications yet'}</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.type === 'push' ? 'bg-[#d3da0c]/10 text-[#d3da0c]' :
                          item.type === 'email' ? 'bg-blue-500/10 text-blue-400' :
                          'bg-purple-500/10 text-purple-400'
                        }`}>
                          {item.type === 'push' ? <Bell className="w-4 h-4" /> :
                           item.type === 'email' ? <Mail className="w-4 h-4" /> :
                           <Smartphone className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-white font-medium text-sm">{item.title || t('admin.notificationCenter.untitled')}</h4>
                          <p className="text-gray-500 text-xs mt-0.5">{(item.message || '').substring(0, 60)}{item.message && item.message.length > 60 ? '...' : ''}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-gray-500 text-xs">{t('admin.notificationCenter.toLabel', { role: item.target_role || 'all' })}</span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-500 text-xs">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {item.status ? t(`admin.notificationCenter.status.${item.status}`) : t('admin.notificationCenter.status.sent')}
                      </span>
                    </div>
                    {item.status === 'scheduled' && (
                      <span className="mt-2 text-xs text-gray-500">
                        {t('admin.notificationCenter.scheduledLabel')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
