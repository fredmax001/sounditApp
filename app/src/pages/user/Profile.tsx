import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, ChevronRight, LogOut, Share2, Ticket, Heart, Armchair, Users,
  Settings as SettingsIcon, UserPen, X, CalendarCheck, Mic, BarChart3,
  MessageCircle, ShoppingBag, UtensilsCrossed, Wallet, CalendarDays,
  UserCog, LayoutDashboard, Banknote, Camera, Loader2, Images,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import UniversalShareModal from '@/components/ui/UniversalShareModal';
import VerificationBadge from '@/components/VerificationBadge';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

type RoleKey = 'user' | 'artist' | 'vendor' | 'business' | 'admin';

const getRoleKey = (profile: any): RoleKey => {
  const rt = (profile?.role_type || '').toString().toLowerCase();
  const r = (profile?.role || '').toString().toLowerCase();
  if (rt === 'admin' || rt === 'super_admin' || r === 'admin' || r === 'super_admin') return 'admin';
  if (rt === 'artist' || rt === 'artist_dj' || r === 'dj') return 'artist';
  if (rt === 'vendor' || r === 'vendor') return 'vendor';
  if (rt === 'business' || rt === 'organizer' || r === 'organizer') return 'business';
  return 'user';
};

const Profile = () => {
  const { t } = useTranslation();
  const { profile, businessProfile, artistProfile, session, logout, uploadBanner, uploadAvatar } = useAuthStore();
  const navigate = useNavigate();
  const roleKey = getRoleKey(profile);
  const [primaryStat, setPrimaryStat] = useState<number>(0);
  const [secondaryStat, setSecondaryStat] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchRoleStats = async () => {
      if (!session?.access_token) {
        setIsLoadingStats(false);
        return;
      }

      const headers = { 'Authorization': `Bearer ${session.access_token}` };

      try {
        if (roleKey === 'user') {
          const eventIds = new Set<number>();
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

          setPrimaryStat(eventIds.size);
        } else if (roleKey === 'artist') {
          const res = await fetch(`${API_BASE_URL}/artist/bookings`, { headers });
          if (res.ok) {
            const data = await res.json();
            setPrimaryStat(Array.isArray(data) ? data.length : (data.bookings || []).length);
          }
        } else if (roleKey === 'vendor') {
          const res = await fetch(`${API_BASE_URL}/vendor-orders/vendor/orders`, { headers });
          if (res.ok) {
            const data = await res.json();
            setPrimaryStat(Array.isArray(data) ? data.length : (data.orders || []).length);
          }
        } else if (roleKey === 'business') {
          const [eventsRes, ticketsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/events/me`, { headers }),
            fetch(`${API_BASE_URL}/tickets/business/tickets`, { headers })
          ]);
          if (eventsRes.ok) {
            const data = await eventsRes.json();
            setPrimaryStat(Array.isArray(data) ? data.length : (data.events || []).length);
          }
          if (ticketsRes.ok) {
            const data = await ticketsRes.json();
            const list = Array.isArray(data) ? data : (data.tickets || data.orders || []);
            setSecondaryStat(list.length);
          }
        } else if (roleKey === 'admin') {
          const res = await fetch(`${API_BASE_URL}/admin/dashboard`, { headers });
          if (res.ok) {
            const data = await res.json();
            setPrimaryStat(data.total_users ?? 0);
            setSecondaryStat(data.total_events ?? 0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchRoleStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, roleKey]);

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const displayName =
    (roleKey === 'business'
      ? businessProfile?.business_name ||
        (profile as any)?.business_name ||
        (profile as any)?.business_profile?.business_name ||
        (profile as any)?.organizer_profile?.organization_name ||
        fullName
      : roleKey === 'artist'
      ? artistProfile?.stage_name ||
        (profile as any)?.artist_profile?.stage_name ||
        fullName
      : roleKey === 'vendor'
      ? (profile as any)?.vendor_profile?.business_name || fullName
      : fullName) ||
    profile?.username ||
    profile?.email?.split('@')[0] ||
    t('user.profile.user');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const editItem = { icon: UserPen, label: t('kit.profile.editProfile'), path: '/profile/edit' };
  const settingsItem = { icon: SettingsIcon, label: t('kit.profile.settings'), path: '/settings' };

  const menuItemsByRole: Record<RoleKey, Array<{ icon: any; label: string; path: string }>> = {
    user: [
      editItem,
      { icon: Ticket, label: t('kit.profile.myTickets'), path: '/tickets' },
      { icon: Heart, label: t('kit.profile.favorites'), path: '/favorites' },
      { icon: Armchair, label: t('kit.profile.tableBookings'), path: '/table-bookings' },
      { icon: Users, label: t('kit.profile.followers'), path: '/followers' },
      settingsItem,
    ],
    artist: [
      editItem,
      { icon: LayoutDashboard, label: 'DJ Dashboard', path: '/dashboard/artist' },
      { icon: Ticket, label: t('kit.profile.myTickets') || 'My Bought Tickets', path: '/tickets' },
      { icon: Heart, label: t('kit.profile.favorites') || 'Favorites', path: '/favorites' },
      { icon: CalendarCheck, label: t('kit.profile.myBookings'), path: '/dashboard/artist/bookings' },
      { icon: Mic, label: t('kit.profile.performances'), path: '/dashboard/artist/performances' },
      { icon: BarChart3, label: t('kit.profile.analytics'), path: '/dashboard/artist/analytics' },
      { icon: MessageCircle, label: t('kit.profile.messages'), path: '/dashboard/artist/messages' },
      { icon: Armchair, label: t('kit.profile.tableBookings') || 'Table Bookings', path: '/table-bookings' },
      { icon: Users, label: t('kit.profile.followers'), path: '/followers' },
      settingsItem,
    ],
    vendor: [
      editItem,
      { icon: LayoutDashboard, label: 'Vendor Dashboard', path: '/dashboard/vendor' },
      { icon: Ticket, label: t('kit.profile.myTickets') || 'My Bought Tickets', path: '/tickets' },
      { icon: Heart, label: t('kit.profile.favorites') || 'Favorites', path: '/favorites' },
      { icon: ShoppingBag, label: t('kit.profile.myOrders'), path: '/dashboard/vendor/orders' },
      { icon: UtensilsCrossed, label: t('kit.profile.productsMenu'), path: '/dashboard/vendor/products' },
      { icon: Wallet, label: t('kit.profile.earnings'), path: '/dashboard/vendor/earnings' },
      { icon: BarChart3, label: t('kit.profile.analytics'), path: '/dashboard/vendor/analytics' },
      { icon: MessageCircle, label: t('kit.profile.messages'), path: '/dashboard/vendor/messages' },
      { icon: Armchair, label: t('kit.profile.tableBookings') || 'Table Bookings', path: '/table-bookings' },
      settingsItem,
    ],
    business: [
      editItem,
      { icon: UserPen, label: t('business.profile.title', 'Business Profile'), path: '/dashboard/business/profile' },
      { icon: LayoutDashboard, label: 'Business Dashboard', path: '/dashboard/business' },
      { icon: CalendarDays, label: t('kit.profile.myEvents'), path: '/dashboard/business/events' },
      { icon: Images, label: 'Photo Gallery & Media', path: '/dashboard/business/gallery' },
      { icon: Camera, label: 'Event Photos & Recaps', path: '/dashboard/business/recaps' },
      { icon: Ticket, label: t('kit.profile.ticketOrders'), path: '/dashboard/business/ticket-orders' },
      { icon: UserCog, label: t('kit.profile.staff'), path: '/dashboard/business/staff' },
      { icon: Armchair, label: t('kit.profile.tableReservations'), path: '/dashboard/business/tables' },
      { icon: Wallet, label: t('kit.profile.payouts'), path: '/dashboard/business/payouts' },
      { icon: BarChart3, label: t('kit.profile.analytics'), path: '/dashboard/business/analytics' },
      { icon: Ticket, label: t('kit.profile.myTickets') || 'My Bought Tickets', path: '/tickets' },
      { icon: Heart, label: t('kit.profile.favorites') || 'Favorites', path: '/favorites' },
      settingsItem,
    ],
    admin: [
      editItem,
      { icon: LayoutDashboard, label: t('kit.profile.adminDashboard'), path: '/admin' },
      { icon: Ticket, label: t('kit.profile.myTickets') || 'My Bought Tickets', path: '/tickets' },
      { icon: Heart, label: t('kit.profile.favorites') || 'Favorites', path: '/favorites' },
      { icon: Users, label: t('kit.profile.manageUsers'), path: '/admin/users' },
      { icon: CalendarDays, label: t('kit.profile.manageEvents'), path: '/admin/events' },
      { icon: Banknote, label: t('kit.profile.financials'), path: '/admin/financial' },
      settingsItem,
    ],
  };

  const menuItems = menuItemsByRole[roleKey];

  const statsByRole: Record<RoleKey, Array<{ label: string; value: string | number; path: string }>> = {
    user: [
      { label: t('kit.profile.events'), value: isLoadingStats ? '…' : primaryStat, path: '/tickets' },
      { label: t('kit.profile.followers'), value: profile?.followers_count || 0, path: '/followers' },
      { label: t('kit.profile.following'), value: profile?.following_count || 0, path: '/followers' },
    ],
    artist: [
      { label: t('kit.profile.statBookings'), value: isLoadingStats ? '…' : primaryStat, path: '/dashboard/artist/bookings' },
      { label: t('kit.profile.followers'), value: profile?.followers_count || 0, path: '/followers' },
      { label: t('kit.profile.following'), value: profile?.following_count || 0, path: '/followers' },
    ],
    vendor: [
      { label: t('kit.profile.statOrders'), value: isLoadingStats ? '…' : primaryStat, path: '/dashboard/vendor/orders' },
      { label: t('kit.profile.followers'), value: profile?.followers_count || 0, path: '/followers' },
      { label: t('kit.profile.following'), value: profile?.following_count || 0, path: '/followers' },
    ],
    business: [
      { label: t('kit.profile.events'), value: isLoadingStats ? '…' : primaryStat, path: '/dashboard/business/events' },
      { label: t('kit.profile.statTickets'), value: isLoadingStats ? '…' : (secondaryStat ?? 0), path: '/dashboard/business/ticket-orders' },
      { label: t('kit.profile.followers'), value: profile?.followers_count || 0, path: '/dashboard/business/followers' },
    ],
    admin: [
      { label: t('kit.profile.statUsers'), value: isLoadingStats ? '…' : primaryStat, path: '/admin/users' },
      { label: t('kit.profile.events'), value: isLoadingStats ? '…' : (secondaryStat ?? 0), path: '/admin/events' },
      { label: t('kit.profile.followers'), value: profile?.followers_count || 0, path: '/followers' },
    ],
  };

  const stats = statsByRole[roleKey];
  const bgImage = profile?.background_url || profile?.banner_url || (profile as any)?.vendor_profile?.banner_url || null;
  const avatarImage = profile?.avatar_url || (profile as any)?.vendor_profile?.logo_url || null;

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      await uploadBanner(file);
      toast.success(t('business.profile.coverImageUpdated', 'Background image updated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('business.profile.failedToUploadCoverImage', 'Failed to upload background image'));
    } finally {
      setIsUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast.success(t('user.profile.avatarUpdated', 'Profile photo updated!'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('user.profile.avatarUploadFailed', 'Failed to upload photo'));
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-28 pt-3 md:pt-6 transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2 md:py-4">
        {/* Top bar with back button & title */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            aria-label="Go back"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-gray-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold font-display text-[#020b00] dark:text-white flex-1">
            {t('kit.profile.title', { defaultValue: 'Profile' })}
          </h1>
        </div>

        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center mb-6"
        >
          {/* Marked hero space with background image or blurred profile image fallback */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 pt-8 pb-6 px-4 flex flex-col items-center">
            {/* Background Layer */}
            {bgImage ? (
              <img
                src={bgImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : avatarImage ? (
              <img
                src={avatarImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#d3da0c]/15 via-transparent to-transparent dark:to-[#020b00]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/80" />

            {/* Add / Edit Background Image button */}
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerChange}
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
              title={t('business.profile.coverImageUpdated', 'Change background image')}
              className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              {isUploadingBanner ? (
                <Loader2 className="w-3.5 h-3.5 text-[#d3da0c] animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-[#d3da0c]" />
              )}
              <span className="hidden sm:inline">{bgImage ? 'Edit Cover' : 'Add Cover'}</span>
            </button>

            {/* Foreground Profile Content */}
            <div className="relative z-10 flex flex-col items-center">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="relative group cursor-pointer focus:outline-none"
                aria-label="Change profile photo"
              >
                <div className="w-28 h-28 rounded-full overflow-hidden ring-2 ring-[#d3da0c] ring-offset-4 ring-offset-black bg-white/5 shadow-2xl relative">
                  <img
                    src={avatarImage || '/default-avatar.png'}
                    alt={displayName}
                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    onError={e => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-[#d3da0c] animate-spin" />
                    </div>
                  )}
                </div>
                <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#d3da0c] text-black border-2 border-black flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform">
                  <Camera className="w-4 h-4 stroke-[2.5]" />
                </span>
              </button>

              <div className="flex items-center gap-2 mt-4">
                <h1 className="text-2xl font-bold text-white drop-shadow">{displayName}</h1>
                {(profile?.is_verified || (profile as any)?.verification_badge) && (
                  <VerificationBadge size="md" className="shrink-0" />
                )}
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  aria-label={t('kit.invite.title')}
                  className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/15 flex items-center justify-center text-gray-300 hover:text-[#d3da0c] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
              {profile?.username && <p className="text-gray-300/90 text-sm mt-0.5 drop-shadow">@{profile.username}</p>}
              <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-black/50 backdrop-blur-sm text-[#d3da0c] border border-[#d3da0c]/30">
                {roleKey === 'user' ? t('user.profile.user') : t(`kit.profile.role.${roleKey}`, roleKey)}
              </span>
              {profile?.bio && <p className="text-gray-200 text-sm mt-2 max-w-xs drop-shadow">{profile.bio}</p>}
            </div>
          </div>

          {/* 3-stat row */}
          <div className="flex w-full max-w-sm mt-4 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl divide-x divide-black/8 dark:divide-white/5 shadow-xs">
            {stats.map(stat => (
              <button
                key={stat.label}
                onClick={() => navigate(stat.path)}
                className="flex-1 py-3.5 flex flex-col items-center gap-0.5 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors"
              >
                <span className="text-lg font-bold text-[#020b00] dark:text-white">{stat.value}</span>
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
          className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs"
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-4 min-h-[44px] text-left hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors ${index > 0 ? 'border-t border-black/5 dark:border-white/5' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/15 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
                </div>
                <span className="text-sm font-medium text-[#020b00] dark:text-white flex-1">{item.label}</span>
                <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-600" />
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
          className="w-full mt-4 flex items-center justify-center gap-2 py-4 min-h-[48px] rounded-2xl bg-white dark:bg-[#111111] border border-red-500/20 text-red-500 font-medium text-sm hover:bg-red-500/5 transition-colors shadow-xs"
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
              className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-[#020b00] dark:text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#020b00] dark:text-white">{t('kit.profile.logOut')}</h3>
                <button onClick={() => setShowLogoutConfirm(false)} className="p-1.5 bg-neutral-100 dark:bg-white/5 rounded-full text-gray-500 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">{t('kit.profile.logOutConfirm')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 min-h-[44px] bg-neutral-100 dark:bg-white/5 text-[#020b00] dark:text-white text-sm rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors font-medium"
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
