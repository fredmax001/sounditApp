import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, LogOut, Share2, Ticket, Heart, Armchair, Users,
  Settings as SettingsIcon, UserPen, X,
} from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import UniversalShareModal from '@/components/ui/UniversalShareModal';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const Profile = () => {
  const { t } = useTranslation();
  const { profile, session, logout } = useAuthStore();
  const navigate = useNavigate();
  const [eventsAttended, setEventsAttended] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const fetchEventsAttended = async () => {
      if (!session?.access_token) {
        setIsLoadingStats(false);
        return;
      }

      const headers = { 'Authorization': `Bearer ${session.access_token}` };
      const eventIds = new Set<number>();

      try {
        const [ticketsRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/payments/tickets/user`, { headers }),
          fetch(`${API_BASE_URL}/tickets/my-orders`, { headers })
        ]);

        if (ticketsRes.ok) {
          const tickets = await ticketsRes.json() as Array<{
            event?: { id?: number };
            event_id?: number;
            ticket_tier?: { event?: { id?: number } };
          }>;
          tickets.forEach(tk => {
            const eid = tk.event?.id ?? tk.event_id ?? tk.ticket_tier?.event?.id;
            if (eid) eventIds.add(eid);
          });
        }

        if (ordersRes.ok) {
          const data = await ordersRes.json() as {
            orders?: Array<{ status?: string; event?: { id?: number } }>;
          };
          (data.orders || []).forEach(o => {
            if ((o.status === 'approved' || o.status === 'used') && o.event?.id) {
              eventIds.add(o.event.id);
            }
          });
        }

        setEventsAttended(eventIds.size);
      } catch (error) {
        console.error('Failed to fetch events attended:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchEventsAttended();
  }, [session]);

  const displayName = (profile?.first_name || profile?.last_name
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : profile?.email?.split('@')[0] || t('user.profile.user'));

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { icon: UserPen, label: t('kit.profile.editProfile'), path: '/profile/edit' },
    { icon: Ticket, label: t('kit.profile.myTickets'), path: '/tickets' },
    { icon: Heart, label: t('kit.profile.favorites'), path: '/favorites' },
    { icon: Armchair, label: t('kit.profile.tableBookings'), path: '/table-bookings' },
    { icon: Users, label: t('kit.profile.followers'), path: '/followers' },
    { icon: SettingsIcon, label: t('kit.profile.settings'), path: '/settings' },
  ];

  const stats = [
    { label: t('kit.profile.events'), value: isLoadingStats ? '…' : eventsAttended, path: '/tickets' },
    { label: t('kit.profile.followers'), value: profile?.followers_count || 0, path: '/followers' },
    { label: t('kit.profile.following'), value: profile?.following_count || 0, path: '/followers' },
  ];

  return (
    <div className="min-h-screen pb-28 pt-16 md:pt-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center mb-6"
        >
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden ring-2 ring-[#d3da0c] ring-offset-4 ring-offset-[#0A0A0A] bg-white/5">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
                  <span className="text-4xl font-bold text-black">{(displayName || '?')[0].toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            <button
              onClick={() => setIsShareModalOpen(true)}
              aria-label={t('kit.invite.title')}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-[#d3da0c] transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          {profile?.username && <p className="text-gray-500 text-sm mt-0.5">@{profile.username}</p>}
          {profile?.bio && <p className="text-gray-400 text-sm mt-2 max-w-xs">{profile.bio}</p>}

          {/* 3-stat row */}
          <div className="flex w-full max-w-sm mt-5 bg-[#111111] border border-white/5 rounded-2xl divide-x divide-white/5">
            {stats.map(stat => (
              <button
                key={stat.label}
                onClick={() => navigate(stat.path)}
                className="flex-1 py-3.5 flex flex-col items-center gap-0.5 active:bg-white/5 transition-colors"
              >
                <span className="text-lg font-bold text-white">{stat.value}</span>
                <span className="text-[11px] text-gray-500">{stat.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Menu list */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden"
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-4 min-h-[44px] text-left hover:bg-white/5 active:bg-white/10 transition-colors ${index > 0 ? 'border-t border-white/5' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#d3da0c]" />
                </div>
                <span className="text-sm font-medium text-white flex-1">{item.label}</span>
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            );
          })}
        </motion.div>

        {/* Log out */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full mt-4 flex items-center justify-center gap-2 py-4 min-h-[48px] rounded-2xl bg-[#111111] border border-red-500/15 text-red-400 font-medium text-sm hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {t('kit.profile.logOut')}
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
                <h3 className="text-lg font-bold text-white">{t('kit.profile.logOut')}</h3>
                <button onClick={() => setShowLogoutConfirm(false)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-5">{t('kit.profile.logOutConfirm')}</p>
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
                  {t('kit.profile.logOut')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* Universal Share Modal */}
      {isShareModalOpen && profile && (
        <UniversalShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          item={{
            type: profile.role_type === 'business' ? 'business' : profile.role_type === 'artist' ? 'artist' : profile.role_type === 'vendor' ? 'vendor' : 'user',
            id: profile.id,
            title: displayName,
            subtitle: (profile.role || 'User').toUpperCase(),
            image: profile.avatar_url || (profile as any).avatar || (profile as any).artist_profile?.avatar_url || (profile as any).vendor_profile?.logo_url,
            location: profile.city?.name,
            description: profile.bio
          }}
        />
      )}
    </div>
  );
};

export default Profile;
