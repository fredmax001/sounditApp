import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, X, Loader2, UserCheck, UserX, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { pushManager } from '@/lib/pushNotifications';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  entity_type?: string;
  entity_id?: number;
  data?: Record<string, any>;
}

interface StaffInvitation {
  id: number;
  business_id: number;
  business_name: string;
  role: string;
  status: string;
  created_at: string;
}

const NotificationBell = ({ mobile = false }: { mobile?: boolean }) => {
  const { t } = useTranslation();
  const { session, isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [pushState, setPushState] = useState<'unknown' | 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported'>('unknown');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length + invitations.filter(i => i.status === 'Pending').length;

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const [notifRes, inviteRes] = await Promise.all([
        fetch(`${API_BASE_URL}/notifications?unread_only=true`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_BASE_URL}/business/staff/invitations`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications || []);
      }
      if (inviteRes.ok) {
        const data = await inviteRes.json();
        setInvitations(data || []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initialize push manager and polling
  useEffect(() => {
    if (isAuthenticated) {
      // Init push
      pushManager.init().then(() => {
        const perm = pushManager.getPermissionState();
        if (perm === 'granted' && pushManager.isSubscribed()) {
          setPushState('subscribed');
        } else if (perm === 'denied') {
          setPushState('denied');
        } else {
          setPushState('unsubscribed');
        }
      });

      // Polling for in-app notifications
      fetchData();
      const interval = setInterval(() => {
        fetchData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchData]);

  // Update badge when unread count changes
  useEffect(() => {
    if (isAuthenticated) {
      pushManager.setBadge(unreadCount);
    }
  }, [unreadCount, isAuthenticated]);

  // Listen for push state changes
  useEffect(() => {
    const handler = (e: Event) => {
      const state = (e as CustomEvent).detail;
      if (state === 'subscribed') setPushState('subscribed');
      if (state === 'unsubscribed') setPushState('unsubscribed');
      if (state === 'failed') setPushState('denied');
    };
    window.addEventListener('push-state-change', handler);
    return () => window.removeEventListener('push-state-change', handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: number) => {
    if (!session?.access_token) return;
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      // silent
    }
  };

  const handleAccept = async (invitationId: number) => {
    if (!session?.access_token) return;
    setActionId(invitationId);
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to accept');
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      toast.success(t('business.staff.invitationAccepted') || 'Invitation accepted');
    } catch {
      toast.error(t('business.staff.failedToAccept') || 'Failed to accept invitation');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (invitationId: number) => {
    if (!session?.access_token) return;
    setActionId(invitationId);
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/invitations/${invitationId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to reject');
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      toast.success(t('business.staff.invitationRejected') || 'Invitation rejected');
    } catch {
      toast.error(t('business.staff.failedToReject') || 'Failed to reject invitation');
    } finally {
      setActionId(null);
    }
  };

  const requestPushPermission = async () => {
    const result = await pushManager.requestPermission();
    if (result === 'granted') {
      setPushState('subscribed');
      toast.success(t('notifications.pushEnabled') || 'Push notifications enabled!');
    } else if (result === 'denied') {
      setPushState('denied');
      toast.error(t('notifications.pushDenied') || 'Please enable notifications in browser settings.');
    }
  };

  const getCategoryIcon = (type: string) => {
    const icons: Record<string, string> = {
      signup: '🎉',
      message: '💬',
      booking: '📅',
      booking_accepted: '✅',
      booking_declined: '❌',
      payment: '💰',
      verification: '✓',
      subscription: '🔄',
      event: '🎵',
      system: '⚙️',
      marketing: '📢',
      staff_invite: '👥',
      ticket_order: '🎫',
      follower: '⭐',
      artist_update: '🎤',
      organizer_update: '🏢',
      vendor_update: '🛍️',
    };
    return icons[type] || '🔔';
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchData(); }}
        className={`relative ${mobile ? 'w-9 h-9 rounded-full glass-pill-premium flex items-center justify-center text-gray-300 hover:text-white active:scale-90 transition-transform' : 'p-2 text-gray-400 hover:text-white transition-colors'}`}
      >
        <Bell className={`${mobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
        {unreadCount > 0 && (
          <span className={`absolute ${mobile ? 'top-0.5 right-0.5 w-2 h-2' : '-top-0.5 -right-0.5 w-4 h-4 text-[10px]'} bg-[#FF2D8F] rounded-full ${mobile ? 'animate-badge-bounce' : 'flex items-center justify-center text-white font-bold'}`}>
            {!mobile && (unreadCount > 9 ? '9+' : unreadCount)}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 ${mobile ? 'top-12 w-80' : 'top-10 w-96'} bg-[#111111] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden`}
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-semibold">{t('notifications.title') || 'Notifications'}</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-[#d3da0c] font-medium">{unreadCount} {t('notifications.unread') || 'unread'}</span>
              )}
            </div>

            {/* Push Enable Banner */}
            {pushState === 'unsubscribed' && (
              <div className="px-4 py-2.5 bg-[#d3da0c]/10 border-b border-[#d3da0c]/20">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[#d3da0c] flex-1">
                    {t('notifications.enablePush') || 'Enable push notifications for real-time alerts'}
                  </p>
                  <button
                    onClick={requestPushPermission}
                    className="px-3 py-1 bg-[#d3da0c] text-black text-xs font-medium rounded-lg hover:bg-[#d3da0c]/90 transition-colors shrink-0"
                  >
                    {t('common.enable') || 'Enable'}
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="p-6 text-center">
                  <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin mx-auto" />
                </div>
              )}

              {!loading && invitations.length === 0 && notifications.length === 0 && (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">{t('notifications.empty') || 'No new notifications'}</p>
                </div>
              )}

              {/* Staff Invitations */}
              {invitations.map(invite => (
                <div key={`invite-${invite.id}`} className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#d3da0c]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <UserCheck className="w-4 h-4 text-[#d3da0c]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{t('notifications.staffInviteTitle') || 'Staff Invitation'}</p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {invite.business_name} invited you as <span className="text-[#d3da0c]">{invite.role}</span>
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleAccept(invite.id)}
                          disabled={actionId === invite.id}
                          className="flex-1 py-1.5 bg-[#d3da0c] text-black text-xs font-medium rounded-lg hover:bg-[#d3da0c]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {actionId === invite.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {t('common.accept') || 'Accept'}
                        </button>
                        <button
                          onClick={() => handleReject(invite.id)}
                          disabled={actionId === invite.id}
                          className="flex-1 py-1.5 bg-white/5 border border-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {actionId === invite.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          {t('common.reject') || 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Regular Notifications */}
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!notif.is_read ? 'bg-white/[0.02]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-sm">
                      {getCategoryIcon(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium">{notif.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-gray-600 text-[10px] mt-1">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!notif.is_read && <div className="w-2 h-2 rounded-full bg-[#d3da0c] mt-1.5 shrink-0" />}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={async () => {
                    if (!session?.access_token) return;
                    await fetch(`${API_BASE_URL}/notifications/read-all`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                  }}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {t('notifications.markAllRead') || 'Mark all as read'}
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    window.location.href = '/settings/notifications';
                  }}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  title={t('notifications.settings') || 'Notification settings'}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
