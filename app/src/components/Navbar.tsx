import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import {
  Menu,
  X,
  User,
  Ticket,
  Heart,
  Settings,
  LogOut,
  ChevronDown,
  MapPin,
  Calendar,
  Users,
  Info,
  Mail,
  Utensils,
  Store,
  ShieldCheck,
  ShoppingCart,
  LayoutDashboard,
  Globe,
  MessageCircle,
} from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';
import VerificationBadge from '@/components/VerificationBadge';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, logout, selectedCity, setSelectedCity } = useAuthStore();
  const { getTotalItems } = useCartStore();

  const cartItemsCount = getTotalItems();

  const currentCity = chinaCities.find(c => c.id === selectedCity) || chinaCities[0];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  const prevPathname = useRef(location.pathname);
  useEffect(() => {
    if (prevPathname.current !== location.pathname) {
      prevPathname.current = location.pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobileMenuOpen(false);
      setIsUserMenuOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.success(t('nav.loggedOutSuccessfully') || 'Logged out successfully');
    navigate('/');
  };

  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const navLinks = [
    { path: '/events', label: t('nav.events'), icon: Calendar },
    { path: '/discovery', label: t('nav.discovery') || 'Discovery', icon: Users },
    { path: '/food', label: t('nav.food'), icon: Utensils },
    { path: '/community', label: t('nav.community'), icon: MessageCircle },
    { path: '/about', label: t('nav.about'), icon: Info },
    { path: '/contact', label: t('nav.contact'), icon: Mail },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? 'bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
          }`}
      >
        <div className="w-full">
          <div className="flex items-center justify-between h-16 lg:h-20 px-4 sm:px-6 lg:px-8 2xl:px-12">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="SOUND IT"
                className="h-20 lg:h-24 w-auto object-contain"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative text-sm font-medium transition-colors ${isActive(link.path)
                    ? 'text-[#d3da0c]'
                    : 'text-gray-300 hover:text-white'
                    }`}
                >
                  {link.label}
                  {isActive(link.path) && (
                    <motion.div
                      layoutId="navbarIndicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#d3da0c]"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              {/* City Selector */}
              <div className="hidden md:block relative group">
                <button className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  <MapPin className="w-4 h-4 text-[#d3da0c]" />
                  <span>{currentCity.name}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* City Dropdown */}
                <div className="absolute right-0 mt-2 w-48 bg-[#111111] border border-white/10 rounded-xl overflow-hidden shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                  <div className="p-2">
                    {chinaCities.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => setSelectedCity(city.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${selectedCity === city.id
                          ? 'bg-[#d3da0c]/10 text-[#d3da0c]'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <span className="text-sm">{city.name}</span>
                        {selectedCity === city.id && <div className="w-1.5 h-1.5 rounded-full bg-[#d3da0c] ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cart Button - Only show for authenticated users */}
              {isAuthenticated && (
                <Link
                  to="/cart"
                  className="relative p-2 text-gray-300 hover:text-[#d3da0c] transition-colors"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#d3da0c] text-black text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#111111]">
                      {cartItemsCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Language Selector */}
              <div className="hidden md:block relative group">
                <button className="flex items-center gap-1 p-2 text-gray-300 hover:text-[#d3da0c] transition-colors">
                  <Globe className="w-5 h-5" />
                  <span className="text-xs font-medium uppercase">{i18n.language?.split('-')[0] || 'en'}</span>
                </button>

                {/* Language Dropdown */}
                <div className="absolute right-0 mt-2 w-40 bg-[#111111] border border-white/10 rounded-xl overflow-hidden shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                  <div className="p-2">
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'fr', label: 'Français' },
                      { code: 'zh', label: '中文' },
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${i18n.language?.startsWith(lang.code)
                          ? 'bg-[#d3da0c]/10 text-[#d3da0c]'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <span className="text-sm">{lang.label}</span>
                        {i18n.language?.startsWith(lang.code) && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#d3da0c]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Auth Buttons */}
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('nav.user') || 'User'}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                        />
                      ) : (
                        <User className="w-4 h-4 text-black" />
                      )}
                    </div>
                    <span className="hidden sm:block text-sm">{profile?.first_name || t('nav.user') || 'User'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* User Dropdown */}
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-56 bg-[#111111] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
                      >
                        <div className="p-4 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'User'}</p>
                            {(profile?.verification_badge || user?.verification_badge) && (
                              <VerificationBadge size="sm" />
                            )}
                          </div>
                          <p className="text-gray-500 text-sm">{user?.email}</p>
                          {profile?.role_type === 'business' && (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-[#d3da0c]/20 text-[#d3da0c] text-xs rounded">
                              {t('nav.business') || 'Business'}
                            </span>
                          )}
                        </div>

                        <div className="p-2">
                          <Link
                            to="/profile"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            <User className="w-4 h-4" />
                            <span className="text-sm">{t('nav.profile')}</span>
                          </Link>
                          <Link
                            to="/tickets"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            <Ticket className="w-4 h-4" />
                            <span className="text-sm">{t('nav.myTickets') || 'My Tickets'}</span>
                          </Link>
                          <Link
                            to="/favorites"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            <Heart className="w-4 h-4" />
                            <span className="text-sm">{t('nav.favorites')}</span>
                          </Link>
                          <Link
                            to="/settings"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            <span className="text-sm">{t('nav.settings')}</span>
                          </Link>

                          <Link
                            to="/dashboard"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="text-sm">{t('nav.dashboard')}</span>
                          </Link>

                          {profile?.role_type === 'business' && (
                            <Link
                              to="/dashboard/business"
                              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#d3da0c] hover:bg-[#d3da0c]/10 transition-colors"
                            >
                              <User className="w-4 h-4" />
                              <span className="text-sm">{t('nav.businessDashboard') || 'Business Dashboard'}</span>
                            </Link>
                          )}

                          {profile?.role_type === 'admin' && (
                            <Link
                              to="/admin/dashboard"
                              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#d3da0c] hover:bg-[#d3da0c]/10 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span className="text-sm">{t('nav.adminDashboard') || 'Admin Dashboard'}</span>
                            </Link>
                          )}
                        </div>

                        <div className="p-2 border-t border-white/5">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm">{t('nav.logout')}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-3">
                  <Link
                    to="/login"
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {t('nav.signIn') || 'Sign In'}
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 btn-custom font-medium rounded-lg transition-colors text-sm"
                  >
                    {t('nav.getStarted') || 'Get Started'}
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-80 bg-[#111111] border-l border-white/5"
            >
              <div className="p-6 pt-20">
                {/* Mobile Nav Links */}
                <div className="space-y-2">
                  {navLinks.map((link, index) => {
                    const Icon = link.icon;
                    return (
                      <motion.div
                        key={link.path}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link
                          to={link.path}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive(link.path)
                            ? 'bg-[#d3da0c]/10 text-[#d3da0c]'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{link.label}</span>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Mobile Auth */}
                {!isAuthenticated && (
                  <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                    <Link
                      to="/login"
                      className="block w-full px-4 py-3 text-center text-gray-300 hover:text-white transition-colors"
                    >
                      {t('nav.signIn') || 'Sign In'}
                    </Link>
                    <Link
                      to="/register"
                      className="block w-full px-4 py-3 bg-[#d3da0c] text-black font-medium rounded-lg text-center hover:bg-[#bbc10b] transition-colors"
                    >
                      {t('nav.getStarted') || 'Get Started'}
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
