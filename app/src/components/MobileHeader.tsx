/**
 * Mobile Header — Premium Floating Glass Top Bar (2025)
 * Glassmorphism, animated logo, pulsing location, gradient avatar ring
 */
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import {
  Bell,
  ShoppingCart,
  MapPin,
  User,
  Settings,
  LogOut,
  Ticket,
  Heart,
  ChevronDown,
  LayoutDashboard,
  X,
  ScanLine,
  Share2,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';
import { useState, useRef, useEffect } from 'react';
import { useHaptic } from '@/hooks/useHaptic';
import { useTranslation } from 'react-i18next';

const MobileHeader = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, profile, selectedCity, setSelectedCity, logout } = useAuthStore();
  const { getTotalItems } = useCartStore();
  const cartItemsCount = getTotalItems();
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCitySheet, setShowCitySheet] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);
  const lastScrollY = useRef(0);
  const { trigger } = useHaptic();
  const { t } = useTranslation();

  const currentCity = chinaCities.find((c) => c.id === selectedCity) || chinaCities[0];
  const role = profile?.role_type || profile?.role;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollDepth(currentScrollY);
      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
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

  const menuItems = isAuthenticated
    ? [
        { icon: User, label: t('nav.profile') || 'Profile', onClick: () => navigate('/profile') },
        { icon: Ticket, label: t('nav.myTickets') || 'My Tickets', onClick: () => navigate('/tickets') },
        { icon: Heart, label: t('nav.favorites') || 'Favorites', onClick: () => navigate('/favorites') },
        { icon: LayoutDashboard, label: t('nav.dashboard') || 'Dashboard', onClick: () => navigate('/dashboard') },
        { icon: Crown, label: t('nav.subscriptions') || 'Subscriptions', onClick: () => navigate('/subscriptions') },
        { icon: Share2, label: t('nav.promoter') || 'Promoter', onClick: () => navigate('/promoter') },
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
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-40 safe-area-pt"
        style={{
          background: `rgba(10, 10, 15, ${0.3 + headerOpacity * 0.5})`,
          backdropFilter: scrollDepth > 20 ? 'blur(24px) saturate(180%)' : 'blur(12px) saturate(150%)',
          WebkitBackdropFilter: scrollDepth > 20 ? 'blur(24px) saturate(180%)' : 'blur(12px) saturate(150%)',
          borderBottom: `1px solid rgba(255,255,255,${0.05 + headerOpacity * 0.05})`,
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <motion.img
              src="/logo.png"
              alt="SOUND IT"
              className="h-7 w-auto object-contain"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: 'drop-shadow(0 0 8px rgba(211,218,12,0.3))' }}
            />
          </Link>

          {/* Center — Location Pill */}
          <button
            onClick={() => setShowCitySheet(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill-premium text-xs font-medium text-gray-300 active:scale-95 transition-transform"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <MapPin className="w-3 h-3 text-[#d3da0c]" />
            </motion.span>
            <span className="max-w-[5rem] truncate">{currentCity.name.split(' ')[0]}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                {/* Cart */}
                <Link
                  to="/cart"
                  className="relative w-9 h-9 rounded-full glass-pill-premium flex items-center justify-center text-gray-300 hover:text-white active:scale-90 transition-transform"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {cartItemsCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#d3da0c] text-black text-[9px] font-bold rounded-full flex items-center justify-center"
                    >
                      {cartItemsCount > 9 ? '9+' : cartItemsCount}
                    </motion.span>
                  )}
                </Link>

                {/* Notifications */}
                <button
                  onClick={() => toast.info('No new notifications')}
                  className="relative w-9 h-9 rounded-full glass-pill-premium flex items-center justify-center text-gray-300 hover:text-white active:scale-90 transition-transform"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#FF2D8F] rounded-full animate-badge-bounce" />
                </button>
              </>
            )}

            {/* Avatar with gradient ring */}
            <button
              onClick={() => setShowDrawer(true)}
              className="relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden active:scale-90 transition-transform"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] p-[2px]">
                <div className="w-full h-full rounded-full bg-[#0A0A0F] p-[2px]">
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
                      <User className="w-4 h-4 text-black" />
                    </div>
                  )}
                </div>
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00E676] rounded-full border-2 border-[#0A0A0F]" />
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
              className="fixed right-0 top-0 bottom-0 w-[80vw] max-w-xs glass-panel-dark border-l border-white/10 z-50 safe-area-pt"
            >
              <div className="flex flex-col h-full p-4 safe-area-pb">
                {/* Drawer Header */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-white font-semibold">{t('nav.menu') || 'Menu'}</span>
                  <button onClick={() => setShowDrawer(false)} className="p-2 text-gray-400 hover:text-white touch-feedback">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] p-[2px]">
                      <div className="w-full h-full rounded-full bg-[#0A0A0F] p-[2px]">
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
                    <p className="text-white font-medium truncate">
                      {`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User'}
                    </p>
                    <p className="text-gray-500 text-xs truncate">{user?.email}</p>
                    {role && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#d3da0c]/10 text-[#d3da0c] text-[10px] rounded-full capitalize">
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
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        trigger('light');
                        item.onClick();
                        setShowDrawer(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition-colors touch-feedback"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-white/5 space-y-1">
                  {isAuthenticated && (
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors touch-feedback"
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
              className="bottom-sheet-content"
            >
              <div className="bottom-sheet-handle" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{t('nav.selectCity') || 'Select City'}</h3>
                <button onClick={() => setShowCitySheet(false)} className="p-2 text-gray-400 hover:text-white touch-feedback">
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
                        ? 'bg-[#d3da0c] text-black'
                        : 'glass-pill-premium text-gray-300 hover:bg-white/10'
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
