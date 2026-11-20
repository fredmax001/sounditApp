import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { pushManager } from '@/lib/pushNotifications';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

const NotificationBell = ({
  mobile = false,
  className,
}: {
  mobile?: boolean;
  className?: string;
}) => {
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasLivePulse, setHasLivePulse] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [notifRes, inviteRes] = await Promise.all([
        fetch(`${API_BASE_URL}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`${API_BASE_URL}/business/staff/invitations`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      let count = 0;
      if (notifRes.ok) {
        const data = await notifRes.json();
        count += Number(data.unread_count || 0);
      }
      if (inviteRes.ok) {
        const invites = await inviteRes.json();
        if (Array.isArray(invites)) {
          count += invites.filter((i: any) => i.status === 'Pending').length;
        }
      }
      setUnreadCount((prev) => {
        if (count > prev) {
          setHasLivePulse(true);
          window.setTimeout(() => setHasLivePulse(false), 3500);
        }
        return count;
      });
    } catch {
      // silent fail
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isAuthenticated) {
      pushManager.init().catch(() => {});
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 25000);
      const handleRefresh = () => fetchUnreadCount();
      const handleVisibility = () => {
        if (!document.hidden) fetchUnreadCount();
      };
      window.addEventListener('notifications-updated', handleRefresh);
      window.addEventListener('notifications-updated-local', handleRefresh);
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        clearInterval(interval);
        window.removeEventListener('notifications-updated', handleRefresh);
        window.removeEventListener('notifications-updated-local', handleRefresh);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [isAuthenticated, fetchUnreadCount]);

  useEffect(() => {
    if (isAuthenticated) {
      pushManager.setBadge(unreadCount);
    }
  }, [unreadCount, isAuthenticated]);

  const handleClick = () => {
    setHasLivePulse(false);
    navigate('/notifications');
  };

  return (
    <button
      onClick={handleClick}
      aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      title="View Notifications"
      className={
        className
          ? `relative ${className}`
          : `relative ${
              mobile
                ? 'w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/10 flex items-center justify-center text-[#020b00] dark:text-gray-200 hover:text-black dark:hover:text-white active:scale-90 transition-transform'
                : 'p-2 text-[#020b00] dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors'
            }`
      }
    >
      <Bell className={mobile ? 'w-[18px] h-[18px]' : 'w-4 h-4 sm:w-5 sm:h-5'} />
      {unreadCount > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[0.625rem] flex items-center justify-center text-white font-bold bg-red-500 rounded-full border border-[#020b00]/40 ${
            hasLivePulse ? 'ring-2 ring-[#d3da0c] animate-pulse' : ''
          }`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
