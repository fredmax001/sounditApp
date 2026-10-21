/**
 * Mobile Header - Eventix-inspired compact top bar
 * Left: Logo | Center: Date + Location pill | Right: Notifications + Avatar
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import {
  ShoppingCart,
  MapPin,
  User,
  Settings,
  LogOut,
  Ticket,
  Heart,
  LayoutDashboard,
  X,
  ScanLine,
  Crown,
  ChevronDown,
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { useStaffStore } from '@/store/staffStore';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';
import { useHaptic } from '@/hooks/useHaptic';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/themeStore';

const MobileHeader = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, profile, selectedCity, setSelectedCity, logout } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const { isDark } = useThemeStore();
  const cartItemsCount = getTotalItems();
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);
  const lastScrollY = useRef(0);
  const { trigger } = useHaptic();
  const { t } = useTranslation();

  const currentCity = chinaCities.find((c) => c.id === selectedCity) || chinaCities[0];
  const role = (profile?.role_type || profile?.role || '').toLowerCase();
  const isBusiness = role === 'business' || role === 'organizer';
  const isArtist = role === 'artist' || role === 'dj';
  const isVendor = role === 'vendor';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const dashboardPath = isBusiness ? '/dashboard/business' :
    isArtist ? '/dashboard/artist' :
    isVendor ? '/dashboard/vendor' :
    isAdmin ? '/admin' : '/dashboard';

  const dashboardLabel = isArtist ? 'DJ Dashboard' :
    isBusiness ? 'Business Workspace' :
    isVendor ? 'Vendor Portal' :
    isAdmin ? 'Admin Panel' : (t('nav.dashboard') || 'Dashboard');

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

  const { canScan, fetchMemberships } = useStaffStore();
  const isStaffScanner = canScan();

  useEffect(() => {
    if (isAuthenticated) {
      fetchMemberships();
    }
  }, [isAuthenticated, fetchMemberships]);

  const menuItems = isAuthenticated
    ? [
        ...((isArtist || isBusiness || isVendor || isAdmin) ? [
          { icon: LayoutDashboard, label: dashboardLabel, onClick: () => navigate(dashboardPath) },
        ] : []),
        { icon: User, label: t('nav.profile') || 'Profile', onClick: () => navigate('/profile') },
        { icon: Ticket, label: t('nav.myTickets') || 'My Tickets', onClick: () => navigate('/tickets') },
        { icon: Heart, label: t('nav.favorites') || 'Favorites', onClick: () => navigate('/favorites') },
        ...(isStaffScanner ? [{ icon: ScanLine, label: t('nav.scan') || 'Scan Tickets', onClick: () => navigate('/scan') }] : []),
        ...(!(isArtist || isBusiness || isVendor || isAdmin) ? [
          { icon: LayoutDashboard, label: t('nav.dashboard') || 'Dashboard', onClick: () => navigate('/dashboard') },
        ] : []),
        { icon: Crown, label: t('nav.subscriptions') || 'Subscriptions', onClick: () => navigate('/subscriptions') },
        { icon: Settings, label: t('nav.settings') || 'Settings', onClick: () => navigate('/settings') },
      ]
    : [
        { icon: User, label: t('nav.signIn') || 'Sign In', onClick: () => navigate('/login') },
        { icon: User, label: t('nav.getStarted') || 'Register', onClick: () => navigate('/register') },
      ];

  const headerOpacity = Math.min(scrollDepth / 80, 1);

  return (
    <>
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHidden ? '-100%' : 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-40 safe-area-pt transition-colors"
        style={{
          background: isDark
            ? `rgba(2, 11, 0, ${0.85 + headerOpacity * 0.12})`
            : `rgba(255, 255, 255, ${0.9 + headerOpacity * 0.08})`,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderBottom: isDark
            ? `1px solid rgba(255,255,255,${0.05 + headerOpacity * 0.05})`
            : `1px solid rgba(0,0,0,${0.06 + headerOpacity * 0.04})`,
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* Left: Logo (Mobile/App uses Logo Icon) */}
          <Link to="/" className="flex items-center flex-shrink-0">
            <motion.img
              src={isDark ? "/logo-icon-dark.png" : "/logo-icon-light.png"}
              alt="SOUND IT"
              className="h-10 w-auto object-contain"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: isDark ? 'drop-shadow(0 0 6px rgba(211,218,12,0.35))' : 'none' }}
            />
          </Link>

          {/* Center: Date + Location */}
          <button
            onClick={() => setShowCitySheet(true)}
            className="flex flex-col items-start active:scale-95 transition-transform min-w-0"
          >
            <span className="text-[10px] text-gray-500 font-medium leading-none mb-0.5">
              {dayStr}, {dateStr}
            </span>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#d3da0c]" />
              <span className="text-[#020b00] dark:text-white text-[13px] font-semibold leading-none">{currentCity.name.split(' ')[0]}</span>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </div>
          </button>

          {/* Right: Cart + Notifications + Avatar */}
          <div className="ml-auto flex items-center gap-1.5">
            {isAuthenticated && (
              <>
                {/* Cart */}
                <Link
                  to="/cart"
                  className="relative w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8 flex items-center justify-center text-[#020b00] dark:text-gray-400 active:scale-90 transition-transform"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {cartItemsCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-[#d3da0c] text-black text-[8px] font-bold rounded-full flex items-center justify-center"
                    >
                      {cartItemsCount > 9 ? '9+' : cartItemsCount}
                    </motion.span>
                  )}
                </Link>

                {/* Notifications */}
                <NotificationBell mobile />
              </>
            )}

            {/* Avatar */}
            <button
              onClick={() => setShowDrawer(true)}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden active:scale-90 transition-transform"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] p-[1.5px]">
                <div className="w-full h-full rounded-xl bg-[#020b00] p-[1.5px]">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-full h-full rounded-xl object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/default-avatar.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#d3da0c]/20 to-[#FF2D8F]/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-[#d3da0c]" />
                    </div>
                  )}
                </div>
              </div>
              {isAuthenticated && (
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#00E676] rounded-full border-[1.5px] border-[#020b00]" />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Profile Drawer */}
      <AnimatePresence>
        {showDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[80vw] max-w-xs bg-white dark:bg-[#020b00] border-l border-black/8 dark:border-white/10 z-50 safe-area-pt shadow-2xl text-[#020b00] dark:text-white"
            >
              <div className="flex flex-col h-full p-4 safe-area-pb">
                {/* Drawer Header */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[#020b00] dark:text-white font-semibold">{t('nav.menu') || 'Menu'}</span>
                  <button onClick={() => setShowDrawer(false)} className="p-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white touch-feedback" aria-label="Close menu">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-black/8 dark:border-white/5">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] p-[2px]">
                      <div className="w-full h-full rounded-full bg-black/5 dark:bg-[#0A0A0F] p-[2px]">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/default-avatar.png';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
                            <User className="w-6 h-6 text-black" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#020b00] dark:text-white font-medium truncate">
                      {`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User'}
                    </p>
                    <p className="text-gray-500 text-xs truncate">{user?.email}</p>
                    {role && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] text-[10px] rounded-full capitalize font-medium">
                        {role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="flex-1 overflow-y-auto space-y-1">
                  {menuItems.map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => {
                        trigger('light');
                        item.onClick();
                        setShowDrawer(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 hover:bg-black/5 hover:text-black dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white transition-colors touch-feedback"
                    >
                      <item.icon className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-black/8 dark:border-white/5 space-y-1">
                  {isAuthenticated && (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors touch-feedback"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">{t('nav.logout') || 'Logout'}</span>
                    </button>
                  )}
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
                <h3 className="text-[#020b00] dark:text-white font-semibold">{t('nav.selectCity') || 'Select City'}</h3>
                <button onClick={() => setShowCitySheet(false)} className="p-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white touch-feedback" aria-label="Close city picker">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pb-4">
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
                    {city.name.split(' ')[0]}
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
