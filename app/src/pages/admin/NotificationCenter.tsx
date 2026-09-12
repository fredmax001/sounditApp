import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Bell, Send, Loader2, Mail, Smartphone, Clock, Layers,
  Image as ImageIcon, Trash2, Eye, X, RotateCcw
} from 'lucide-react';

interface NotificationHistoryItem {
  id: number;
  source?: string;
  type: string;
  title: string;
  message: string;
  image_url?: string | null;
  target_role?: string;
  created_at: string;
  status?: string;
  channels?: string[];
  total_recipients?: number;
  in_app_sent?: number;
  push_sent?: number;
  email_sent?: number;
  email_failed?: number;
}

const resolveImageUrl = (url?: string | null): string => {
  if (!url) return '';
  let cleanUrl = String(url).trim();
  if (!cleanUrl) return '';
  if (cleanUrl.startsWith('/var/www/soundit-uploads/')) {
    cleanUrl = cleanUrl.replace('/var/www/soundit-uploads/', '/static/uploads/');
  }
  if (cleanUrl.startsWith('http://sounditent.com') || cleanUrl.startsWith('http://sounditent.cn')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }
  if (cleanUrl.startsWith('/')) {
    const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    return `${base}${cleanUrl}`;
  }
  return cleanUrl;
};

const NotificationCenter = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<NotificationHistoryItem | null>(null);
  const [notification, setNotification] = useState({
    title: '',
    message: '',
    type: 'both',
    target_role: 'all',
    image_url: '',
  });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    let loaded = false;
    try {
      // Dedicated log endpoint — covers ALL channel types (incl. email-only sends)
      const res = await fetch(`${API_BASE_URL}/admin/notifications/log`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.notifications || []);
        loaded = true;
      }
    } catch { /* fall through to legacy endpoint */ }
    if (!loaded) {
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
      }
    }
    setLoading(false);
  };

  const handleResend = (item: NotificationHistoryItem) => {
    const ch = item.channels || [];
    setNotification({
      title: item.title || '',
      message: item.message || '',
      type: ch.includes('push') && ch.includes('email') ? 'both'
        : ch.includes('email') ? 'email'
        : 'push',
      target_role: item.target_role || 'all',
      image_url: item.image_url || '',
    });
    setViewing(null);
    toast.success(t('admin.notificationCenter.loadedForResend') || 'Loaded into the compose form — review and press Send Now');
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('admin.notificationCenter.onlyImagesAllowed') || 'Please select a valid image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('admin.notificationCenter.imageTooLarge') || 'Image size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Upload failed');
      }

      const data = await res.json();
      const rawUrl = data.url || data.file_url;
      if (rawUrl) {
        const uploadedUrl = resolveImageUrl(rawUrl);
        setNotification(prev => ({ ...prev, image_url: uploadedUrl }));
        toast.success(t('admin.notificationCenter.imageUploaded') || 'Image attached successfully');
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (err: any) {
      toast.error(err.message || t('admin.notificationCenter.failedToUploadImage') || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
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
          type: 'both',
          target_role: 'all',
          image_url: '',
        });
        loadHistory();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || 'Failed to send notification');
      }
    } catch (err: any) {
      toast.error(err.message || t('admin.notificationCenter.failedToSendNotification'));
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNotification({ ...notification, type: 'both' })}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    notification.type === 'both'
                      ? 'border-[#d3da0c] bg-[#d3da0c]/10 text-[#d3da0c]'
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <Layers className="w-4 h-4 mx-auto mb-1" />
                  {t('admin.notificationCenter.typeBoth') || 'Both'}
                </button>
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

            {/* Image Attachment */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                {t('admin.notificationCenter.imageAttachment') || 'Image Attachment (Optional)'}
              </label>

              {notification.image_url ? (
                <div className="relative border border-white/10 rounded-lg p-3 bg-white/5 flex items-center gap-4">
                  <img
                    src={resolveImageUrl(notification.image_url)}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewImage(resolveImageUrl(notification.image_url))}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {notification.image_url.split('/').pop() || 'image.png'}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      {notification.image_url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewImage(resolveImageUrl(notification.image_url))}
                      className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      title={t('common.preview') || 'Preview'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotification(prev => ({ ...prev, image_url: '' }))}
                      className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                      title={t('common.remove') || 'Remove'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="border-2 border-dashed border-white/10 hover:border-[#d3da0c]/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.04]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                    {uploadingImage ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                        <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin" />
                        <span>{t('admin.notificationCenter.uploadingImage') || 'Uploading image...'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="p-2 bg-white/5 rounded-full mb-2">
                          <ImageIcon className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <span className="text-sm text-gray-300 font-medium">
                          {t('admin.notificationCenter.clickToUploadImage') || 'Click or drag image to upload'}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          PNG, JPG, WEBP, GIF up to 10MB
                        </span>
                      </div>
                    )}
                  </label>

                  {/* Or direct URL input */}
                  <div className="relative">
                    <input
                      type="url"
                      value={notification.image_url}
                      onChange={(e) => setNotification(prev => ({ ...prev, image_url: e.target.value }))}
                      placeholder={t('admin.notificationCenter.imageUrlPlaceholder') || 'Or paste external image URL (https://...)'}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={actionLoading || uploadingImage}
              className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {t('admin.notificationCenter.sendNow')}
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
                history.map((item) => {
                  const itemImg = resolveImageUrl(item.image_url);
                  return (
                    <div
                      key={`${item.source || 'legacy'}-${item.id}`}
                      onClick={() => setViewing(item)}
                      className="p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/[0.08] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            item.type === 'push' ? 'bg-[#d3da0c]/10 text-[#d3da0c]' :
                            item.type === 'email' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-purple-500/10 text-purple-400'
                          }`}>
                            {item.type === 'push' ? <Bell className="w-4 h-4" /> :
                             item.type === 'email' ? <Mail className="w-4 h-4" /> :
                             <Smartphone className="w-4 h-4" />}
                          </div>
                          {itemImg && (
                            <img
                              src={itemImg}
                              alt=""
                              className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setPreviewImage(itemImg)}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-white font-medium text-sm truncate">{item.title || t('admin.notificationCenter.untitled')}</h4>
                            <p className="text-gray-500 text-xs mt-0.5 truncate">{(item.message || '')}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-gray-500 text-xs">
                                {t('admin.notificationCenter.toLabel', {
                                  role: item.target_role === 'all' || !item.target_role
                                    ? t('admin.notificationCenter.audienceAll')
                                    : item.target_role === 'artist'
                                    ? t('admin.notificationCenter.audienceArtist')
                                    : item.target_role === 'business'
                                    ? t('admin.notificationCenter.audienceBusiness')
                                    : item.target_role === 'vendor'
                                    ? t('admin.notificationCenter.audienceVendor')
                                    : item.target_role === 'admin'
                                    ? t('admin.notificationCenter.audienceAdmin')
                                    : t('admin.notificationCenter.audienceUser'),
                                  defaultValue: `To: ${item.target_role || 'All'}`
                                })}
                              </span>
                              <span className="text-gray-600">•</span>
                              <span className="text-gray-500 text-xs">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
                          item.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                          item.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {item.status ? t(`admin.notificationCenter.status.${item.status}`) : t('admin.notificationCenter.status.sent')}
                        </span>
                      </div>
                      {item.status === 'scheduled' && (
                        <span className="mt-2 text-xs text-gray-500 block">
                          {t('admin.notificationCenter.scheduledLabel')}
                        </span>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">
                          {t('admin.notificationCenter.tapToView') || 'Click to view details'}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResend(item); }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#d3da0c] bg-[#d3da0c]/10 rounded-md hover:bg-[#d3da0c]/20 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t('admin.notificationCenter.resend') || 'Resend'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification Detail Modal */}
      {viewing && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="relative max-w-lg w-full bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                {t('admin.notificationCenter.details') || 'Notification Details'}
              </h3>
              <button
                onClick={() => setViewing(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                  viewing.type === 'push' ? 'bg-[#d3da0c]/10 text-[#d3da0c]' :
                  viewing.type === 'email' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-purple-500/10 text-purple-400'
                }`}>
                  {viewing.type === 'push' ? <Bell className="w-3 h-3" /> :
                   viewing.type === 'email' ? <Mail className="w-3 h-3" /> :
                   <Layers className="w-3 h-3" />}
                  {viewing.type === 'both'
                    ? (t('admin.notificationCenter.typeBoth') || 'Both')
                    : viewing.type === 'email'
                    ? (t('admin.notificationCenter.typeEmail') || 'Email')
                    : (t('admin.notificationCenter.typePush') || 'Push')}
                </span>
                <span className="text-gray-500 text-xs">
                  {viewing.created_at ? new Date(viewing.created_at).toLocaleString() : '-'}
                </span>
              </div>

              <h4 className="text-white font-semibold">{viewing.title || t('admin.notificationCenter.untitled')}</h4>
              <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{viewing.message || ''}</p>

              {(() => {
                const img = resolveImageUrl(viewing.image_url);
                return img ? (
                  <img
                    src={img}
                    alt=""
                    className="w-full max-h-56 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewImage(img)}
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                <div className="text-gray-500">{t('admin.notificationCenter.targetAudience')}</div>
                <div className="text-gray-300 text-right">{viewing.target_role || 'all'}</div>
                {typeof viewing.total_recipients === 'number' && (
                  <>
                    <div className="text-gray-500">{t('admin.notificationCenter.recipients') || 'Recipients'}</div>
                    <div className="text-gray-300 text-right">{viewing.total_recipients}</div>
                  </>
                )}
                {typeof viewing.in_app_sent === 'number' && viewing.in_app_sent > 0 && (
                  <>
                    <div className="text-gray-500">{t('admin.notificationCenter.inAppDelivered') || 'In-app delivered'}</div>
                    <div className="text-gray-300 text-right">{viewing.in_app_sent}</div>
                  </>
                )}
                {typeof viewing.push_sent === 'number' && viewing.push_sent > 0 && (
                  <>
                    <div className="text-gray-500">{t('admin.notificationCenter.pushDelivered') || 'Push delivered'}</div>
                    <div className="text-gray-300 text-right">{viewing.push_sent}</div>
                  </>
                )}
                {typeof viewing.email_sent === 'number' && (viewing.email_sent > 0 || typeof viewing.email_failed === 'number') && (
                  <>
                    <div className="text-gray-500">{t('admin.notificationCenter.emailsDelivered') || 'Emails delivered / failed'}</div>
                    <div className="text-gray-300 text-right">{viewing.email_sent} / {viewing.email_failed || 0}</div>
                  </>
                )}
              </div>
            </div>
            <div className="p-3 bg-white/5 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setViewing(null)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('common.close') || 'Close'}
              </button>
              <button
                onClick={() => handleResend(viewing)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-[#d3da0c] rounded-lg hover:bg-[#bbc10b] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('admin.notificationCenter.resend') || 'Resend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-3xl w-full bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                {t('admin.notificationCenter.imagePreview') || 'Image Preview'}
              </h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewImage}
                alt="Full preview"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-white/5 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
              <span className="truncate max-w-md">{previewImage}</span>
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d3da0c] hover:underline"
              >
                {t('common.openOriginal') || 'Open Original'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
