/**
 * Centralized Notification Center (/notifications)
 * Filters: All, Unread, Social, Messages, Events, Business, System
 * Features: Grouped notifications, Pagination, Mark read / Mark all read,
 * Delete / Clear all (with confirmation), Deep links, Live sync, Inline alerts & Intelligent empty states.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import InlineNotificationAlert from '@/components/notifications/InlineNotificationAlert';
import IntelligentEmptyState from '@/components/ui/IntelligentEmptyState';
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
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';
const PAGE_SIZE = 40;

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

interface GroupedNotification {
  groupKey: string;
  primary: NotificationItem;
  items: NotificationItem[];
  unreadCount: number;
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
  { id: 'unread', label: 'Unread' },
  { id: 'social', label: 'Social' },
  { id: 'messages', label: 'Messages' },
  { id: 'events', label: 'Events' },
  { id: 'business', label: 'Business' },
  { id: 'system', label: 'System' },
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

const resolveDeepLink = (notif: NotificationItem): string => {
  const data = notif.data || {};
  if (typeof data.action_url === 'string' && data.action_url.startsWith('/')) {
    return data.action_url;
  }
  const t = (notif.type || '').toLowerCase();
  if (t.startsWith('message')) return '/dashboard/artist/messages';
  if (t.startsWith('booking')) return '/dashboard/artist/bookings';
  if (t.startsWith('verification')) return '/get-verified';
  if (t.startsWith('subscription')) return '/subscriptions';
  if (t.startsWith('ticket_order')) return '/dashboard/business/ticket-orders';
  if (t.startsWith('ticket')) return '/tickets';
  if (t.startsWith('table_')) return '/dashboard/business/tables';
  if (t.startsWith('event') && (data.event_id || notif.entity_id)) {
    return `/events/${data.event_id || notif.entity_id}`;
  }
  return `/notifications/${notif.id}`;
};

const Notifications = () => {
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState('all');
  const [groupEnabled, setGroupEnabled] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchNotifications = useCallback(
    async (nextOffset = 0, append = false) => {
      if (!session?.access_token) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
        });
        if (activeFilter === 'unread') {
          params.set('unread_only', 'true');
        } else if (activeFilter !== 'all') {
          params.set('category', activeFilter);
        }

        const [notifRes, inviteRes] = await Promise.all([
          fetch(`${API_BASE_URL}/notifications/?${params.toString()}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          !append && (activeFilter === 'all' || activeFilter === 'business' || activeFilter === 'system')
            ? fetch(`${API_BASE_URL}/business/staff/invitations`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
            : Promise.resolve(null),
        ]);

        if (notifRes.ok) {
          const data = await notifRes.json();
          const list: NotificationItem[] = data.notifications || [];
          setNotifications((prev) => (append ? [...prev, ...list] : list));
          setUnreadTotal(Number(data.unread_count || 0));
          setHasMore(Boolean(data.has_more));
          setOffset(nextOffset + list.length);
        }
        if (inviteRes && inviteRes.ok) {
          const data = await inviteRes.json();
          setInvitations(Array.isArray(data) ? data.filter((i: any) => i.status === 'Pending') : []);
        } else if (!append) {
          setInvitations([]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [session?.access_token, activeFilter]
  );

  useEffect(() => {
    fetchNotifications(0, false);
  }, [isAuthenticated, fetchNotifications]);

  // Multi-device & live foreground refresh
  useEffect(() => {
    const refresh = () => fetchNotifications(0, false);
    window.addEventListener('notifications-updated-local', refresh);
    window.addEventListener('native-push-received', refresh);
    window.addEventListener('web-push-received', refresh);
    return () => {
      window.removeEventListener('notifications-updated-local', refresh);
      window.removeEventListener('native-push-received', refresh);
      window.removeEventListener('web-push-received', refresh);
    };
  }, [fetchNotifications]);

  // Pattern #7: Smart notification grouping by (type + entity + calendar day)
  const groupedList = useMemo<GroupedNotification[]>(() => {
    if (!groupEnabled) {
      return notifications.map((n) => ({
        groupKey: `single-${n.id}`,
        primary: n,
        items: [n],
        unreadCount: n.is_read ? 0 : 1,
      }));
    }

    const groups = new Map<string, GroupedNotification>();
    const groupablePrefixes = ['community_', 'reel_', 'recap_', 'follow', 'new_follower', 'message'];

    for (const item of notifications) {
      const ntype = (item.type || '').toLowerCase();
      const canGroup = groupablePrefixes.some((p) => ntype.startsWith(p));
      const dayBucket = (item.created_at || '').slice(0, 10);
      const key = canGroup
        ? `${ntype}:${item.entity_type || 'none'}:${item.entity_id || 'none'}:${dayBucket}`
        : `single-${item.id}`;

      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
        if (!item.is_read) existing.unreadCount += 1;
      } else {
        groups.set(key, {
          groupKey: key,
          primary: item,
          items: [item],
          unreadCount: item.is_read ? 0 : 1,
        });
      }
    }
    return Array.from(groups.values());
  }, [notifications, groupEnabled]);

  const markReadSilently = async (ids: number[]) => {
    if (!session?.access_token || ids.length === 0) return;
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
    setUnreadTotal((prev) => Math.max(0, prev - ids.length));
    await Promise.all(
      ids.map((id) =>
        fetch(`${API_BASE_URL}/notifications/${id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {})
      )
    );
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const handleOpenNotification = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      markReadSilently([notif.id]).catch(() => {});
    }
    navigate(resolveDeepLink(notif));
  };

  const handleMarkAllRead = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadTotal(0);
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
        setUnreadTotal(0);
        setHasMore(false);
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
    if (t.includes('security') || t.includes('login_alert') || t.includes('password')) {
      return (
        <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>
      );
    }
    if (t.includes('like')) {
      return (
        <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-red-500 fill-red-500" />
        </div>
      );
    }
    if (t.includes('message') || t.includes('comment') || t.includes('reply') || t.includes('mention')) {
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
    if (t.includes('booking') || t.includes('business') || t.includes('enquiry') || t.includes('payout')) {
      return (
        <div className="w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5 text-emerald-400" />
        </div>
      );
    }
    if (t.includes('event')) {
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
    <div className="min-h-dvh bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white pb-28 transition-colors duration-200">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020B00]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 safe-area-pt">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#020b00] dark:text-white transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-extrabold tracking-tight truncate">Notifications</h1>
              {unreadTotal > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#d3da0c] text-black text-[0.6875rem] font-extrabold shrink-0">
                  {unreadTotal > 99 ? '99+' : unreadTotal}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setGroupEnabled((v) => !v)}
              title={groupEnabled ? 'Grouped view active' : 'Switch to grouped view'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                groupEnabled
                  ? 'bg-[#d3da0c]/20 text-[#8a8f04] dark:text-[#d3da0c] border border-[#d3da0c]/40'
                  : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300'
              }`}
              aria-label="Toggle grouped notifications"
            >
              <Layers className="w-4 h-4" />
            </button>
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

        {/* Filter Pills: All, Unread, Social, Messages, Events, Business, System */}
        <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto hide-scrollbar">
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
      <div className="max-w-2xl mx-auto px-4 pt-3 space-y-3">
        {/* Pattern #5: Platform-aware Inline Push Status Alert */}
        {isAuthenticated && <InlineNotificationAlert compact />}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 text-[#d3da0c] animate-spin" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Loading notifications...</p>
          </div>
        ) : invitations.length === 0 && groupedList.length === 0 ? (
          <IntelligentEmptyState
            icon={Bell}
            title={activeFilter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
            description={
              activeFilter === 'unread'
                ? 'Every notification in your inbox has been read.'
                : 'Updates on events, tickets, messages, social interactions, bookings, and account security will appear here.'
            }
            primaryLabel={activeFilter !== 'all' ? 'View All Notifications' : 'Explore Events'}
            onPrimaryClick={() =>
              activeFilter !== 'all' ? setActiveFilter('all') : navigate('/events')
            }
            secondaryLabel="Notification Preferences"
            onSecondaryClick={() => navigate('/settings/notifications')}
          />
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

            {/* Grouped & Individual Notification Rows */}
            {groupedList.map((group) => {
              const notif = group.primary;
              const isGrouped = group.items.length > 1;
              const isExpanded = Boolean(expandedGroups[group.groupKey]);
              const rawImg = notif.image_url || notif.data?.image_url;
              const thumbUrl = rawImg ? resolveImageUrl(rawImg) : null;
              const cleanTitle = stripEmojis(notif.title);
              const cleanMessage = stripEmojis(notif.message);

              return (
                <div key={group.groupKey}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      if (isGrouped) {
                        setExpandedGroups((prev) => ({ ...prev, [group.groupKey]: !prev[group.groupKey] }));
                        const unreadIds = group.items.filter((i) => !i.is_read).map((i) => i.id);
                        if (unreadIds.length > 0) markReadSilently(unreadIds).catch(() => {});
                      } else {
                        handleOpenNotification(notif);
                      }
                    }}
                    className={`py-4 flex items-center gap-3.5 cursor-pointer group transition-colors ${
                      group.unreadCount > 0 ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''
                    }`}
                  >
                    {renderIconForType(notif.type)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm leading-snug truncate ${
                            group.unreadCount > 0
                              ? 'font-bold text-[#020b00] dark:text-white'
                              : 'font-semibold text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {cleanTitle}
                        </p>
                        {isGrouped && (
                          <span className="px-2 py-0.5 rounded-full bg-[#d3da0c]/20 border border-[#d3da0c]/40 text-[#8a8f04] dark:text-[#d3da0c] text-[0.625rem] font-extrabold shrink-0">
                            {group.items.length} updates
                          </span>
                        )}
                        {group.unreadCount > 0 && (
                          <span className="w-2 h-2 rounded-full bg-[#d3da0c] shrink-0" />
                        )}
                      </div>
                      {cleanMessage && cleanMessage !== cleanTitle && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {cleanMessage}
                        </p>
                      )}
                      <p className="text-[0.6875rem] text-gray-500 mt-1">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {thumbUrl && (
                        <div className="w-14 h-12 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                          <img
                            src={thumbUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {isGrouped ? (
                        <span className="p-1.5 text-gray-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleDeleteOne(e, notif.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors opacity-70 group-hover:opacity-100"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>

                  {/* Expanded items inside a notification group */}
                  {isGrouped && isExpanded && (
                    <div className="pl-12 pb-3 space-y-2">
                      {group.items.map((child) => (
                        <div
                          key={child.id}
                          onClick={() => handleOpenNotification(child)}
                          className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/8 dark:border-white/10 flex items-center justify-between gap-2 cursor-pointer hover:border-[#d3da0c]/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#020b00] dark:text-white truncate">
                              {stripEmojis(child.title)}
                            </p>
                            <p className="text-[0.6875rem] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {stripEmojis(child.message)} · {formatRelativeTime(child.created_at)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => handleDeleteOne(e, child.id)}
                            className="p-1 text-gray-500 hover:text-red-400 shrink-0"
                            aria-label="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination: Load More */}
            {hasMore && (
              <div className="pt-5 pb-2 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchNotifications(offset, true)}
                  className="px-[1.5em] py-[0.65em] rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-xs font-bold text-[#020b00] dark:text-white hover:border-[#d3da0c]/50 flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d3da0c]" />}
                  Load More Notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal (Pattern #6) */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            data-modal-open="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
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
