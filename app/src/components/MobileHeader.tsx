/**
 * Mobile Header - Consistent across Home, Discover, Events, Community, and Reels
 * Left: Sound It Logo + City/Date or Page Title
 * Right: Search + Notification Bell + Profile Avatar (opens full-height Profile Menu Drawer)
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import {
  MapPin,
  User,
  Settings,
  LogOut,
  Ticket,
  Heart,
  LayoutDashboard,
  X,
  ScanLine,
  ChevronDown,
  ChevronRight,
  Search,
  Edit3,
  Calendar,
  FileText,
  PlaySquare,
  Coins,
  ShieldCheck,
  BadgeCheck,
  Headphones,
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { useStaffStore } from '@/store/staffStore';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';
import { useHaptic } from '@/hooks/useHaptic';
import { useTranslation } from 'react-i18next';
import VerificationBadge from '@/components/VerificationBadge';
import { useThemeStore } from '@/store/themeStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

const MobileHeader = ({ hideBar = false }: { hideBar?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, profile, session, selectedCity, setSelectedCity, logout } = useAuthStore();
  const { isDark } = useThemeStore();
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHidden, setIsHidden] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [pointsBalance, setPointsBalance] = useState<number>((profile as any)?.points_balance || 0);
  const lastScrollY = useRef(0);
  const { trigger } = useHaptic();
  const { t } = useTranslation();

  const currentCity = chinaCities.find((c) => c.id === selectedCity) || chinaCities[0];
  const role = (profile?.role_type || profile?.role || 'user').toLowerCase();
  const isBusiness = role === 'business' || role === 'organizer';
  const isArtist = role === 'artist' || role === 'dj';
  const isVendor = role === 'vendor';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isVerified = Boolean(profile?.is_verified || (profile as any)?.verification_badge);

  const dashboardPath = isBusiness
    ? '/dashboard/business'
    : isArtist
    ? '/dashboard/artist'
    : isVendor
    ? '/dashboard/vendor'
    : isAdmin
    ? '/admin'
    : '/dashboard';

  const dashboardLabel = isArtist
    ? 'DJ / Artist Studio'
    : isBusiness
    ? 'Business Workspace'
    : isVendor
    ? 'Vendor Portal'
    : isAdmin
    ? 'Admin Panel'
    : t('nav.dashboard', 'Dashboard');

  const roleSubtitle = isArtist
    ? 'Artist / DJ'
    : isBusiness
    ? 'Event Curator & Organizer'
    : isVendor
    ? 'Official Vendor'
    : isAdmin
    ? 'Platform Administrator'
    : (profile as any)?.profile_data?.occupation || 'Event Curator';

  // Today's date for header display
  const today = new Date();
  const dayStr = today.toLocaleDateString('en-US', { weekday: 'short' });
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollDepth(currentScrollY);
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsHidden(true);
      } else {
        setIsHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch live points balance when drawer opens or user authenticates
  useEffect(() => {
    if (isAuthenticated && session?.access_token) {
      fetch(`${API_BASE_URL}/points/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.balance === 'number') {
            setPointsBalance(data.balance);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, session?.access_token, showDrawer]);

  useEffect(() => {
    const openMenuHandler = () => setShowDrawer(true);
    window.addEventListener('open-profile-drawer', openMenuHandler);
    const openCityHandler = () => setShowCitySheet(true);
    window.addEventListener('open-city-picker', openCityHandler);
    return () => {
      window.removeEventListener('open-profile-drawer', openMenuHandler);
      window.removeEventListener('open-city-picker', openCityHandler);
    };
  }, []);

  const handleLogout = () => {
    trigger('medium');
    logout();
    toast.success(t('nav.loggedOutSuccessfully') || 'Logged out successfully');
    navigate('/');
    setShowDrawer(false);
  };

  const handleCitySelect = (cityId: string) => {
    trigger('light');
    setSelectedCity(cityId);
    setShowCitySheet(false);
    toast.success(`${chinaCities.find((c) => c.id === cityId)?.name}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setShowSearchModal(false);
    if (q) {
      navigate(`/events?search=${encodeURIComponent(q)}`);
      setSearchQuery('');
    } else {
      navigate('/discovery');
    }
  };

  const { canScan, fetchMemberships } = useStaffStore();
  const isStaffScanner = canScan();

  useEffect(() => {
    if (isAuthenticated) {
      fetchMemberships();
    }
  }, [isAuthenticated, fetchMemberships]);

  // Determine contextual page title if on Discover / Events / Community
  const getPageTitle = () => {
    if (location.pathname === '/discovery') return 'Discover';
    if (location.pathname === '/events') return 'Events';
    if (location.pathname === '/recaps' || location.pathname === '/community') return 'Recaps';
    return null;
  };
  const pageTitle = getPageTitle();

  // Required Profile Menu Options (Section 3 of Specification)
  const profileMenuItems = isAuthenticated
    ? [
        {
          icon: User,
          label: 'My Profile',
          onClick: () => navigate('/profile'),
        },
        {
          icon: Edit3,
          label: 'Edit Profile',
          onClick: () => navigate('/profile/edit'),
        },
        {
          icon: Ticket,
          label: 'My Tickets',
          onClick: () => navigate('/tickets'),
        },
        {
          icon: Heart,
          label: 'Favorites',
          onClick: () => navigate('/favorites'),
        },
        {
          icon: Calendar,
          label: 'My Events',
          onClick: () => navigate(isBusiness ? '/dashboard/business/events' : '/events?my=true'),
        },
        {
          icon: FileText,
          label: 'My Posts',
          onClick: () => navigate('/community?filter=my_posts'),
        },
        {
          icon: PlaySquare,
          label: 'My Reels',
          onClick: () => navigate('/reels?filter=my_reels'),
        },
        {
          icon: Coins,
          label: 'Points',
          badge: `${pointsBalance.toLocaleString()} pts`,
          onClick: () => navigate('/points'),
        },
        {
          icon: ShieldCheck,
          label: 'Get Verified',
          badge: isVerified ? 'Verified' : undefined,
          onClick: () => navigate('/get-verified'),
        },
        ...((isArtist || isBusiness || isVendor || isAdmin)
          ? [
              {
                icon: LayoutDashboard,
                label: dashboardLabel,
                onClick: () => navigate(dashboardPath),
              },
            ]
          : []),
        ...(isStaffScanner
          ? [
              {
                icon: ScanLine,
                label: 'Ticket Scanner',
                onClick: () => navigate('/scan'),
              },
            ]
          : []),
        {
          icon: Settings,
          label: 'Settings',
          onClick: () => navigate('/settings'),
        },
      ]
    : [
        { icon: User, label: 'Sign In / Register', onClick: () => navigate('/login') },
        { icon: Settings, label: 'Settings', onClick: () => navigate('/settings') },
      ];

  const headerOpacity = Math.min(scrollDepth / 80, 1);
  const fullName =
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    profile?.username ||
    user?.email?.split('@')[0] ||
    'Sound It Member';
  const usernameHandle = profile?.username
    ? `@${profile.username.replace(/^@/, '')}`
    : `@${(profile?.first_name || user?.email?.split('@')[0] || 'soundit').toLowerCase().replace(/\s+/g, '')}_`;

  return (
    <>
      {!hideBar && (
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHidden ? '-100%' : 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-40 safe-area-pt transition-colors"
        style={{
          background: isDark
            ? `rgba(2, 11, 0, ${0.88 + headerOpacity * 0.1})`
            : `rgba(255, 255, 255, ${0.92 + headerOpacity * 0.06})`,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderBottom: isDark
            ? `1px solid rgba(255,255,255,${0.06 + headerOpacity * 0.05})`
            : `1px solid rgba(0,0,0,${0.06 + headerOpacity * 0.04})`,
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2">
          {/* Left: Official Full Sound It Logo (as used on web layout) */}
          <Link to="/" className="flex items-center flex-shrink-0">
            <motion.img
              src={isDark ? '/logo-dark.png' : '/logo-light.png'}
              alt="SOUND IT"
              className="h-8 sm:h-9 w-auto object-contain"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            />
          </Link>

          {/* Right: 1. Search icon, 2. Notification bell, 3. User profile avatar */}
          <div className="ml-auto flex items-center gap-2">
            {/* 1. Search Icon */}
            <button
              onClick={() => setShowSearchModal(true)}
              aria-label="Search"
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/10 flex items-center justify-center text-[#020b00] dark:text-gray-200 hover:text-black dark:hover:text-white active:scale-90 transition-transform"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            {/* 2. Notification Bell (Full Page Navigation) */}
            <NotificationBell mobile />

            {/* 3. User Profile Avatar (Opens Full-Height Account Menu) */}
            <button
              onClick={() => {
                trigger('light');
                setShowDrawer(true);
              }}
              aria-label="Account Menu"
              className="relative shrink-0 rounded-full flex items-center justify-center overflow-hidden active:scale-90 transition-transform"
              style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', maxWidth: '36px', maxHeight: '36px' }}
            >
              <div
                className="w-full h-full rounded-full border-[1.5px] border-[#d3da0c] p-[1.5px] bg-[#020b00] overflow-hidden flex items-center justify-center"
                style={{ width: '36px', height: '36px', boxSizing: 'border-box' }}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={fullName}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                    style={{
                      width: '32px',
                      height: '32px',
                      minWidth: '32px',
                      minHeight: '32px',
                      maxWidth: '32px',
                      maxHeight: '32px',
                      objectFit: 'cover',
                      borderRadius: '9999px',
                      display: 'block',
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-avatar.png';
                    }}
                  />
                ) : (
                  <img
                    src="/default-avatar.png"
                    alt={fullName || 'User'}
                    className="w-full h-full rounded-full object-cover"
                  />
                )}
              </div>
            </button>
          </div>
        </div>
      </motion.header>
      )}

      {/* Quick Search Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md p-4 safe-area-pt"
            onClick={() => setShowSearchModal(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a1408] border border-white/15 rounded-2xl p-4 shadow-2xl mt-2"
            >
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search events, artists, venues, businesses..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowSearchModal(false)}
                  className="p-2.5 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Afrobeats', 'Amapiano', 'DJs', 'Venues', 'Vendors', 'This Weekend'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setShowSearchModal(false);
                      navigate(`/events?search=${encodeURIComponent(tag)}`);
                    }}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-[#d3da0c]/20 border border-white/10 text-xs text-gray-300 hover:text-[#d3da0c] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-Right Profile Menu (Full-Height Account Menu Drawer matching reference UI) */}
      <AnimatePresence>
        {showDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[110]"
              onClick={() => setShowDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 bottom-0 w-[86vw] max-w-[21.25rem] bg-white dark:bg-[#070e05] border-l border-black/10 dark:border-white/10 z-[120] safe-area-pt shadow-2xl text-[#020b00] dark:text-white flex flex-col"
            >
              <div className="flex flex-col h-full px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                {/* Close button at top right of card */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setShowDrawer(false)}
                    className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    aria-label="Close profile menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* User Identity Header */}
                <div
                  onClick={() => {
                    setShowDrawer(false);
                    if (isAuthenticated) {
                      navigate('/profile');
                    } else {
                      navigate('/login');
                    }
                  }}
                  className="flex items-center gap-3.5 mt-1 mb-4 pb-4 border-b border-black/10 dark:border-white/10 cursor-pointer group"
                >
                  <div
                    className="relative shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                    style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px' }}
                  >
                    <div
                      className="rounded-full border-2 border-[#d3da0c] p-[2px] bg-[#020b00] overflow-hidden flex items-center justify-center"
                      style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px', boxSizing: 'border-box' }}
                    >
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={fullName}
                          width={52}
                          height={52}
                          className="rounded-full object-cover"
                          style={{
                            width: '52px',
                            height: '52px',
                            minWidth: '52px',
                            minHeight: '52px',
                            maxWidth: '52px',
                            maxHeight: '52px',
                            objectFit: 'cover',
                            borderRadius: '9999px',
                            display: 'block',
                            flexShrink: 0,
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/default-avatar.png';
                          }}
                        />
                      ) : (
                        <img
                          src="/default-avatar.png"
                          alt={fullName || 'User'}
                          className="w-full h-full rounded-full object-cover"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[#020b00] dark:text-white font-bold text-base truncate group-hover:text-[#9fa505] dark:group-hover:text-[#d3da0c] transition-colors">
                        {isAuthenticated ? fullName : 'Guest User'}
                      </p>
                      {isAuthenticated && isVerified && (
                        <VerificationBadge size="sm" className="shrink-0" />
                      )}
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs truncate mt-0.5">
                      {isAuthenticated ? usernameHandle : 'Tap to sign in or create account'}
                    </p>
                    {isAuthenticated && (
                      <div className="flex items-center gap-1.5 mt-1 text-[0.6875rem] text-gray-600 dark:text-gray-300 font-medium">
                        <span>{roleSubtitle}</span>
                        <Headphones className="w-3.5 h-3.5 text-[#9fa505] dark:text-[#d3da0c]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu Items List */}
                <div className="flex-1 overflow-y-auto -mx-2 px-2 divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {profileMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          trigger('light');
                          item.onClick();
                          setShowDrawer(false);
                        }}
                        className="w-full flex items-center justify-between py-3 px-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors group text-left"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Icon className="w-[18px] h-[18px] text-[#8a8f04] dark:text-[#d3da0c] shrink-0" />
                          <span className="text-sm font-medium text-[#020b00] dark:text-gray-100 group-hover:text-black dark:group-hover:text-white truncate">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(item as any).badge && (
                            <span className="text-xs font-bold text-[#8a8f04] dark:text-[#d3da0c]">
                              {(item as any).badge}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Log Out Footer (Always visible in Profile Menu) */}
                <div className="pt-3 mt-2 border-t border-black/10 dark:border-white/10 space-y-2">
                  {!isAuthenticated && (
                    <button
                      onClick={() => {
                        setShowDrawer(false);
                        navigate('/login');
                      }}
                      className="w-full flex items-center justify-center py-2.5 px-3 rounded-xl bg-[#d3da0c] text-black text-xs font-extrabold transition-opacity hover:opacity-90"
                    >
                      Sign In / Switch Account
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (isAuthenticated) {
                        handleLogout();
                      } else {
                        setShowDrawer(false);
                        navigate('/login');
                      }
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-semibold">{t('nav.logout') || 'Log Out'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* City Picker Bottom Sheet */}
      <AnimatePresence>
        {showCitySheet && (
          <div className="bottom-sheet">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bottom-sheet-backdrop"
              onClick={() => setShowCitySheet(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bottom-sheet-content bg-white dark:bg-[#111111] text-[#020b00] dark:text-white border-t border-black/8 dark:border-white/10"
            >
              <div className="bottom-sheet-handle bg-black/20 dark:bg-white/20" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#020b00] dark:text-white font-semibold">
                  {t('nav.selectCity') || 'Select City'}
                </h3>
                <button
                  onClick={() => setShowCitySheet(false)}
                  className="p-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white touch-feedback"
                  aria-label="Close city picker"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-[50dvh] overflow-y-auto pb-4">
                {chinaCities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleCitySelect(city.id)}
                    className={`px-3 py-3 rounded-xl text-sm font-medium transition-colors touch-feedback ${
                      selectedCity === city.id
                        ? 'bg-[#d3da0c] text-black font-semibold'
                        : 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'
                    }`}
                  >
                    {city.id === 'all' ? 'All Cities' : city.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileHeader;
