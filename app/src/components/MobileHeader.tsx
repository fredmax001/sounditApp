/**
 * Mobile Header - App-Style Header
 * Clean, hides on scroll down, reappears on scroll up.
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
  Globe,
  X,
  ScanLine,
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
  const lastScrollY = useRef(0);
  const { trigger } = useHaptic();
  const { t } = useTranslation();

  const currentCity = chinaCities.find((c) => c.id === selectedCity) || chinaCities[0];
  const role = profile?.role_type || profile?.role;

  // Hide header on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
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
        { icon: Settings, label: t('nav.settings') || 'Settings', onClick: () => navigate('/settings') },
      ]
    : [
        { icon: User, label: t('nav.signIn') || 'Sign In', onClick: () => navigate('/login') },
        { icon: User, label: t('nav.getStarted') || 'Register', onClick: () => navigate('/register') },
      ];

  return (
    <>
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHidden ? '-100%' : 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5 safe-area-pt"
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="SOUND IT" className="h-16 w-auto object-contain" />
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                {/* City Selector */}
                <button
                  onClick={() => setShowCitySheet(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 text-xs font-medium text-gray-300 touch-feedback"
                >
                  <MapPin className="w-3 h-3 text-[#d3da0c]" />
                  <span className="max-w-[4rem] truncate">{currentCity.name.split(' ')[0]}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Cart */}
                <Link to="/cart" className="relative p-2 text-gray-300 hover:text-white touch-feedback">
                  <ShoppingCart className="w-5 h-5" />
                  {cartItemsCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#d3da0c] text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                      {cartItemsCount > 9 ? '9+' : cartItemsCount}
                    </span>
                  )}
                </Link>

                {/* Notifications */}
                <button
                  onClick={() => toast.info('No new notifications')}
                  className="p-2 text-gray-300 hover:text-white touch-feedback relative"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF2D8F] rounded-full" />
                </button>
              </>
            )}

            {/* Profile Avatar */}
            <button
              onClick={() => setShowDrawer(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden touch-feedback"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-avatar.png';
                  }}
                />
              ) : (
                <User className="w-4 h-4 text-black" />
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
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => setShowDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[80vw] max-w-xs bg-[#111111] border-l border-white/5 z-50 safe-area-pt"
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
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-avatar.png';
                        }}
                      />
                    ) : (
                      <User className="w-7 h-7 text-black" />
                    )}
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
                  {menuItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        trigger('light');
                        item.onClick();
                        setShowDrawer(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-300 hover:bg-white/5 hover:text-white transition-colors touch-feedback"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
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
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
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
