/**
 * Full Notifications Page (/notifications)
 * Filters: All, Activity, Events, Points, Account
 * Actions: Mark all read, Clear all (with confirmation), Settings, Tap row -> Full Notification Detail
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCheck,
  Settings,
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Calendar,
  Ticket,
  Coins,
  ShieldCheck,
  Megaphone,
  UserCheck,
  Trash2,
  Loader2,
  Repeat2,
  Check,
  X,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

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

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  image_url?: string | null;
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

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activity' },
  { id: 'events', label: 'Events' },
  { id: 'points', label: 'Points' },
  { id: 'account', label: 'Account' },
];

const formatRelativeTime = (isoDate: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const diffSec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const stripEmojis = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const Notifications = () => {
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!session?.access_token) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const categoryQuery = activeFilter !== 'all' ? `?category=${activeFilter}&limit=80` : '?limit=80';
      const [notifRes, inviteRes] = await Promise.all([
        fetch(`${API_BASE_URL}/notifications/${categoryQuery}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        activeFilter === 'all' || activeFilter === 'account'
          ? fetch(`${API_BASE_URL}/business/staff/invitations`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          : Promise.resolve(null),
      ]);

      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.notifications || []);
      }
      if (inviteRes && inviteRes.ok) {
        const data = await inviteRes.json();
        setInvitations(Array.isArray(data) ? data.filter((i: any) => i.status === 'Pending') : []);
      } else {
        setInvitations([]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, activeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [isAuthenticated, fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        window.dispatchEvent(new Event('notifications-updated'));
        toast.success('All notifications marked as read');
      }
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleClearAll = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/clear-all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setNotifications([]);
        setShowClearConfirm(false);
        window.dispatchEvent(new Event('notifications-updated'));
        toast.success('All notifications cleared');
      }
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const handleDeleteOne = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        window.dispatchEvent(new Event('notifications-updated'));
      }
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleAcceptInvite = async (invitationId: number) => {
    if (!session?.access_token) return;
    setActionId(invitationId);
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed');
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      window.dispatchEvent(new Event('notifications-updated'));
      toast.success('Staff invitation accepted');
    } catch {
      toast.error('Failed to accept invitation');
    } finally {
      setActionId(null);
    }
  };

  const handleRejectInvite = async (invitationId: number) => {
    if (!session?.access_token) return;
    setActionId(invitationId);
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/invitations/${invitationId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed');
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      window.dispatchEvent(new Event('notifications-updated'));
      toast.success('Invitation declined');
    } catch {
      toast.error('Failed to decline invitation');
    } finally {
      setActionId(null);
    }
  };

  const renderIconForType = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('like')) {
      return (
        <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
        </div>
      );
    }
    if (t.includes('comment') || t.includes('reply') || t.includes('mention')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    if (t.includes('repost') || t.includes('share')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <Repeat2 className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    if (t.includes('follow')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <UserPlus className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    if (t.includes('point')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <Coins className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    if (t.includes('verif')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    if (t.includes('ticket')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <Ticket className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    if (t.includes('event') || t.includes('booking')) {
      return (
        <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-[#d3da0c]" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
        <Megaphone className="w-5 h-5 text-[#d3da0c]" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white pb-28 transition-colors duration-200">
      {/* Sticky Top Header matching reference screenshot */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020B00]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 safe-area-pt">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#020b00] dark:text-white transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-extrabold tracking-tight">Notifications</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              title="Mark all as read"
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-[#8a8f04] dark:hover:text-[#d3da0c] transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            {notifications.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                title="Clear all notifications"
                className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => navigate('/settings/notifications')}
              title="Notification Settings"
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills: All, Activity, Events, Points, Account */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-[#d3da0c] text-black shadow-sm shadow-[#d3da0c]/30'
                    : 'bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 hover:bg-neutral-200 dark:hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 pt-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 text-[#d3da0c] animate-spin" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Loading notifications...</p>
          </div>
        ) : invitations.length === 0 && notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-gray-500" />
            </div>
            <h3 className="text-base font-bold text-[#020b00] dark:text-white">No notifications yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
              Updates on events, tickets, community activity, points, and verification will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.08] dark:divide-white/[0.08]">
            {/* Pending Staff Invitations */}
            {invitations.map((invite) => (
              <div key={`invite-${invite.id}`} className="py-4 flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#020b00] dark:text-white">Team Invitation</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                    {invite.business_name} invited you to join as{' '}
                    <span className="text-[#8a8f04] dark:text-[#d3da0c] font-semibold">{invite.role}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleAcceptInvite(invite.id)}
                      disabled={actionId === invite.id}
                      className="px-4 py-1.5 rounded-full bg-[#d3da0c] text-black text-xs font-bold flex items-center gap-1.5"
                    >
                      {actionId === invite.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectInvite(invite.id)}
                      disabled={actionId === invite.id}
                      className="px-4 py-1.5 rounded-full bg-black/10 dark:bg-white/10 text-[#020b00] dark:text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Notification Rows */}
            {notifications.map((notif) => {
              const rawImg = notif.image_url || notif.data?.image_url;
              const thumbUrl = resolveImageUrl(rawImg) || '/onboarding/screen3-event.png';
              const cleanTitle = stripEmojis(notif.title);
              const cleanMessage = stripEmojis(notif.message);

              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/notifications/${notif.id}`)}
                  className={`py-4 flex items-center gap-3.5 cursor-pointer group transition-colors ${
                    !notif.is_read ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''
                  }`}
                >
                  {/* Category Icon */}
                  {renderIconForType(notif.type)}

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm leading-snug truncate ${
                          !notif.is_read ? 'font-bold text-[#020b00] dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {cleanTitle}
                      </p>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#d3da0c] shrink-0" />
                      )}
                    </div>
                    {cleanMessage && cleanMessage !== cleanTitle && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">{cleanMessage}</p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">
                      {formatRelativeTime(notif.created_at)}
                    </p>
                  </div>

                  {/* Right Thumbnail + Delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-14 h-12 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/onboarding/screen3-event.png';
                        }}
                      />
                    </div>
                    <button
                      onClick={(e) => handleDeleteOne(e, notif.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition-colors opacity-70 group-hover:opacity-100"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0c1609] border border-white/15 rounded-2xl p-5 text-white shadow-2xl"
            >
              <h3 className="text-base font-bold">Clear All Notifications?</h3>
              <p className="text-xs text-gray-400 mt-1.5">
                This will permanently remove all notifications from your inbox.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-full bg-white/10 text-xs font-bold text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 rounded-full bg-red-500 text-xs font-bold text-white"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;
