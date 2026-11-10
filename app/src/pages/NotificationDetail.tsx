/**
 * Full Notification Detail Page (/notifications/:id)
 * Matches reference screen "Notification Detail (Full View, Take Action, Mark Read & Clear)"
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  MapPin,
  Ticket,
  Coins,
  ShieldCheck,
  User,
  Bell,
  Loader2,
  Check,
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

const stripEmojis = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const NotificationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !session?.access_token) {
      setDetail(null);
      setLoading(false);
      navigate('/login');
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/detail/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        } else {
          toast.error('Notification not found');
          navigate('/notifications');
        }
      } catch {
        navigate('/notifications');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [id, isAuthenticated, session?.access_token, navigate]);

  const handleMarkAsRead = async () => {
    if (!session?.access_token || !detail) return;
    setMarkingRead(true);
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/${detail.id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setDetail((prev: any) => ({ ...prev, is_read: true }));
        window.dispatchEvent(new Event('notifications-updated'));
        toast.success('Notification marked as read');
      }
    } catch {
      toast.error('Failed to mark as read');
    } finally {
      setMarkingRead(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.access_token || !detail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/${detail.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        window.dispatchEvent(new Event('notifications-updated'));
        toast.success('Notification deleted');
        navigate('/notifications');
      }
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  const nType = (detail.type || '').toLowerCase();
  const eventInfo = detail.event;
  const actorInfo = detail.actor;
  const heroImage =
    resolveImageUrl(detail.image_url) ||
    resolveImageUrl(eventInfo?.banner_url) ||
    resolveImageUrl(eventInfo?.flyer_url) ||
    null;

  const getPrimaryAction = () => {
    if (eventInfo?.id || detail.data?.event_id) {
      const eid = eventInfo?.id || detail.data?.event_id;
      return {
        label: 'Get Tickets',
        onClick: () => navigate(`/events/${eid}`),
      };
    }
    if (nType.includes('ticket')) {
      return {
        label: 'View My Tickets',
        onClick: () => navigate('/tickets'),
      };
    }
    if (nType.includes('point')) {
      return {
        label: 'View My Points',
        onClick: () => navigate('/points'),
      };
    }
    if (nType.includes('verif')) {
      return {
        label: 'View Verification Status',
        onClick: () => navigate('/get-verified'),
      };
    }
    if (actorInfo?.id || nType.includes('follow')) {
      return {
        label: 'View Profile',
        onClick: () => navigate(actorInfo?.id ? `/profiles/${actorInfo.id}` : '/profile'),
      };
    }
    if (detail.data?.reel_id || nType.includes('reel')) {
      return {
        label: 'Watch Reel',
        onClick: () => navigate(`/reels?id=${detail.data?.reel_id || ''}`),
      };
    }
    if (nType.includes('community') || nType.includes('like') || nType.includes('comment')) {
      return {
        label: 'Open Community',
        onClick: () => navigate('/community'),
      };
    }
    return {
      label: 'Explore Events',
      onClick: () => navigate('/events'),
    };
  };

  const primaryAction = getPrimaryAction();

  const getCategoryHeading = () => {
    if (nType.includes('event') || eventInfo) return 'Event Reminder';
    if (nType.includes('point')) return 'Points Update';
    if (nType.includes('verif')) return 'Verification Update';
    if (nType.includes('ticket')) return 'Ticket Confirmation';
    if (nType.includes('follow')) return 'New Follower';
    if (nType.includes('like') || nType.includes('comment')) return 'Community Activity';
    return 'Notification';
  };

  const renderCategoryIcon = () => {
    if (nType.includes('point')) return <Coins className="w-5 h-5 text-[#d3da0c]" />;
    if (nType.includes('verif')) return <ShieldCheck className="w-5 h-5 text-[#d3da0c]" />;
    if (nType.includes('ticket')) return <Ticket className="w-5 h-5 text-[#d3da0c]" />;
    if (nType.includes('follow')) return <User className="w-5 h-5 text-[#d3da0c]" />;
    if (nType.includes('event') || eventInfo) return <Calendar className="w-5 h-5 text-[#d3da0c]" />;
    return <Bell className="w-5 h-5 text-[#d3da0c]" />;
  };

  const formattedEventDate = eventInfo?.start_date
    ? new Date(eventInfo.start_date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' • ' +
      new Date(eventInfo.start_date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : 'Sat, Nov 18, 2026 • 21:00';

  return (
    <div className="min-h-screen bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white pb-28 transition-colors duration-200">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020B00]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 safe-area-pt">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/notifications')}
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#020b00] dark:text-white transition-colors"
              aria-label="Back to notifications"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-extrabold tracking-tight">Notification</h1>
          </div>

          <button
            onClick={handleDelete}
            className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            aria-label="Delete notification"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="max-w-xl mx-auto px-4 pt-5 space-y-5">
        {/* Hero Visual Banner Card */}
        {heroImage && (
          <div className="relative rounded-3xl overflow-hidden border border-black/10 dark:border-white/15 bg-[#0a1408] shadow-2xl">
            <div className="relative h-52 sm:h-64 w-full">
              <img
                src={heroImage}
                alt={eventInfo?.title || detail.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {eventInfo?.title || stripEmojis(detail.title)}
                </h2>
              </div>
            </div>
          </div>
        )}

        {/* Category Header + Full Message */}
        <div className="space-y-3 px-1">
          <div className="flex items-center gap-2.5">
            {renderCategoryIcon()}
            <h3 className="text-lg font-extrabold text-[#020b00] dark:text-white">{getCategoryHeading()}</h3>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            {stripEmojis(detail.message) || stripEmojis(detail.title)}
          </p>

          {/* Event Date/Time/Venue Details Box */}
          {(eventInfo || nType.includes('event')) && (
            <div className="pt-2 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c] shrink-0" />
                <span>{formattedEventDate}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c] shrink-0" />
                <span>{eventInfo?.venue_name || 'The Loft Shanghai'}</span>
              </div>
            </div>
          )}

          {/* Points Balance Highlight if Points Notification */}
          {nType.includes('point') && (
            <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-white/5 border border-[#d3da0c]/30 flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Current Points Balance</span>
              <span className="text-base font-extrabold text-[#8a8f04] dark:text-[#d3da0c]">
                {(detail.points_balance || 0).toLocaleString()} pts
              </span>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-300 pt-1">
            {eventInfo
              ? "Don't miss out — secure your ticket now!"
              : 'Stay connected with the latest experiences on Sound It.'}
          </p>
        </div>

        {/* Primary & Secondary Action Buttons */}
        <div className="pt-2 space-y-3">
          <button
            onClick={primaryAction.onClick}
            className="w-full py-3.5 rounded-full bg-[#d3da0c] hover:bg-[#e0e714] text-black font-extrabold text-sm tracking-wide shadow-lg shadow-[#d3da0c]/25 transition-all active:scale-[0.98]"
          >
            {primaryAction.label}
          </button>

          <button
            onClick={handleMarkAsRead}
            disabled={detail.is_read || markingRead}
            className="w-full py-3.5 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {detail.is_read ? (
              <>
                <Check className="w-4 h-4 text-[#d3da0c]" />
                <span>Marked as Read</span>
              </>
            ) : (
              <span>{markingRead ? 'Updating...' : 'Mark as Read'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetail;
