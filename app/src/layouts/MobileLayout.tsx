/**
 * Mobile Layout - App-Style Dashboard Shell
 * Unified with MainLayout for a consistent native-app feel.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useState, type ReactNode, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useSubscriptionStore,
  canAccessFeature,
  getRequiredPlan,
  formatPlanName,
} from '@/store/subscriptionStore';
import UpgradeModal from '@/components/UpgradeModal';
import NotificationBell from '@/components/NotificationBell';
import MobileBottomNav from '@/components/MobileBottomNav';
import MobilePageTransition from '@/components/MobilePageTransition';
import {
  Bell,
  LogOut,
  Settings,
  Crown,
  Ticket,
  Heart,
  BarChart3,
  Wallet,
  Wine,
  MessageSquare,
  Share2,
  Users,
  User,
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  Video,
  Store,
  ShoppingBag,
  Music,
  BookOpen,
  Lock,
  X,
  DollarSign,
  Compass,
  Globe,
  Menu,
  ChevronLeft,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHaptic } from '@/hooks/useHaptic';

interface MobileLayoutProps {
  children?: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  locked?: boolean;
  feature?: string;
}

const MobileLayout = ({ children }: MobileLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, logout, isLoading, session } = useAuthStore();
  const token = session?.access_token;
  const { t } = useTranslation();
  const { trigger } = useHaptic();

  const { hasSubscription, planType, checkSubscription } = useSubscriptionStore();

  const [showDrawer, setShowDrawer] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | undefined>();
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const lastScrollY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (token) {
      checkSubscription(token);
    }
  }, [token, checkSubscription]);

  useEffect(() => {
    const handlePlanRestricted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setUpgradeFeature(detail?.featureName || 'premium');
      setUpgradeModalOpen(true);
    };
    window.addEventListener('plan-restricted', handlePlanRestricted);
    return () => window.removeEventListener('plan-restricted', handlePlanRestricted);
  }, []);

  // Header hide/show on scroll
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => {
      const currentScrollY = el.scrollTop;
      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        setIsHeaderHidden(true);
      } else {
        setIsHeaderHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const role = (profile?.role_type || profile?.role || '').toLowerCase();
  const isBusiness = role === 'business' || role === 'organizer';
  const isFinanceStaff = (profile?.staff_role || '').toLowerCase() === 'finance';
  const isArtist = role === 'artist' || role === 'dj';
  const isVendor = role === 'vendor';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const getPageTitle = useMemo(() => {
    const path = location.pathname;
    if (path === '/dashboard/business/finance') return 'Finance Workspace';
    if (path === '/dashboard/business/create-event') return t('organizer.createEvent.newEvent') || 'Create Event';
    if (path === '/dashboard/business/events') return t('nav.events') || 'My Events';
    if (path === '/dashboard/business/ticket-orders') return t('business.dashboard.ticketOrders') || 'Ticket Orders';
    if (path === '/dashboard/business/profile') return t('nav.profile') || 'Profile';
    if (path === '/dashboard/business/staff') return t('business.staff.title') || 'Staff';
    if (path === '/dashboard/business/promoters') return t('nav.promoters') || 'Promoters';
    if (path === '/dashboard/business/analytics') return t('upgrade.analytics') || 'Analytics';
    if (path === '/dashboard/business/followers') return t('nav.followers') || 'Followers';
    if (path === '/dashboard/business/payouts') return t('upgrade.payouts') || 'Payouts';
    if (path === '/dashboard/business/community') return t('upgrade.communityPosts') || 'Community';
    if (path === '/dashboard/business/tables') return t('upgrade.tableReservations') || 'Tables';
    if (path === '/dashboard/business/recaps') return t('artist.recaps.title') || 'Recaps';
    if (path.startsWith('/dashboard/business/events/') && path.endsWith('/edit')) return t('business.dashboard.editEvent') || 'Edit Event';
    if (path.startsWith('/dashboard/business/events/') && path.endsWith('/promoters')) return t('nav.promoters') || 'Promoters';
    if (path === '/dashboard/artist') return t('nav.dashboard') || 'Dashboard';
    if (path === '/dashboard/artist/bookings') return t('artist.bookings.title') || 'Bookings';
    if (path === '/dashboard/artist/performances') return t('artist.performances.title') || 'Gigs';
    if (path === '/dashboard/artist/analytics') return t('upgrade.analytics') || 'Analytics';
    if (path === '/dashboard/artist/community') return t('upgrade.fanFeed') || 'Fan Feed';
    if (path === '/dashboard/artist/recaps') return t('artist.recaps.title') || 'Recaps';
    if (path === '/dashboard/vendor') return t('nav.dashboard') || 'Dashboard';
    if (path === '/dashboard/vendor/products') return t('vendor.myProducts') || 'Products';
    if (path === '/dashboard/vendor/orders') return t('vendor.orders.navLabel') || 'Orders';
    if (path === '/dashboard/vendor/events') return t('upgrade.eventBooths') || 'Event Booths';
    if (path === '/dashboard/vendor/earnings') return t('upgrade.earnings') || 'Earnings';
    if (path === '/dashboard/vendor/community') return t('upgrade.communityPosts') || 'Community';
    if (path === '/admin') return t('nav.dashboard') || 'Dashboard';
    if (path.startsWith('/admin/')) return t('nav.admin') || 'Admin';
    if (path === '/scan') return t('nav.scan') || 'Scan';
    if (path === '/subscriptions') return t('nav.subscriptions') || 'Subscription';
    // Fallback to path-based parsing
    return location.pathname.split('/').pop()?.replace(/-/g, ' ') || t('nav.dashboard');
  }, [location.pathname, t]);

  const handleLockedClick = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();
    const feature = item.feature || item.path.split('/').pop()?.replace(/-/g, '_') || 'premium';
    setUpgradeFeature(feature);
    setUpgradeModalOpen(true);
    setShowDrawer(false);
  };

  const isReallyLocked = (item: NavItem) => {
    if (!item.locked) return false;
    if (profile?.is_verified) return false;
    if (hasSubscription === null) return false;
    if (!hasSubscription) return true;
    if (item.feature) {
      return !canAccessFeature(planType, item.feature);
    }
    return false;
  };

  const drawerNavItems = useMemo<NavItem[]>(() => {
    if (isFinanceStaff) {
      return [
        { path: '/dashboard/business/finance', label: 'Finance Workspace', icon: DollarSign },
        { path: '/dashboard/business/ticket-orders', label: t('business.dashboard.ticketOrders') || 'Ticket Orders', icon: Ticket },
        { path: '/dashboard/business/tables', label: t('upgrade.tableReservations') || 'Table Reservations', icon: Wine },
        { path: '/dashboard/business/payouts', label: t('upgrade.payouts') || 'Payouts', icon: Wallet },
        { path: '/dashboard/business/analytics', label: t('upgrade.analytics') || 'Analytics', icon: BarChart3 },
      ];
    }
    if (isBusiness) {
      return [
        { path: '/events', label: t('nav.events') || 'Explore Events', icon: Compass },
        { path: '/discovery', label: t('nav.discovery') || 'Discovery & Venues', icon: Globe },
        { path: '/tickets', label: t('nav.myTickets') || 'My Tickets', icon: Ticket },
        { path: '/recaps', label: t('nav.recaps') || 'Event Recaps', icon: Camera },
        { path: '/dashboard/business/finance', label: 'Finance Workspace', icon: DollarSign },
        { path: '/dashboard/business/ticket-orders', label: t('business.dashboard.ticketOrders') || 'Ticket Orders', icon: Ticket },
        { path: '/dashboard/business/promoters', label: t('nav.promoters') || 'Promoters', icon: Share2 },
        { path: '/dashboard/business/staff', label: t('business.staff.title') || 'Staff', icon: Users },
        { path: '/dashboard/business/analytics', label: t('upgrade.analytics') || 'Analytics', icon: BarChart3, locked: true, feature: 'analytics' },
        { path: '/dashboard/business/followers', label: t('nav.followers') || 'Followers', icon: Heart },
        { path: '/dashboard/business/payouts', label: t('upgrade.payouts') || 'Payouts', icon: Wallet, locked: true, feature: 'payouts' },
        { path: '/dashboard/business/community', label: t('upgrade.communityPosts') || 'Community Posts', icon: MessageSquare, locked: true, feature: 'community_posts' },
        { path: '/dashboard/business/tables', label: t('upgrade.tableReservations') || 'Table Reservations', icon: Wine, locked: true, feature: 'table_reservations' },
        { path: '/subscriptions', label: t('nav.subscriptions') || 'Subscription', icon: Crown },
      ];
    }
    if (isArtist) {
      return [
        { path: '/events', label: t('nav.events') || 'Explore Events', icon: Compass },
        { path: '/discovery', label: t('nav.discovery') || 'Discovery & Venues', icon: Globe },
        { path: '/tickets', label: t('nav.myTickets') || 'My Tickets', icon: Ticket },
        { path: '/recaps', label: t('nav.recaps') || 'Event Recaps', icon: Camera },
        { path: '/dashboard/artist/bookings', label: t('artist.bookings.title') || 'Bookings', icon: CalendarDays },
        { path: '/dashboard/artist/performances', label: t('artist.performances.title') || 'Gigs', icon: BarChart3 },
        { path: '/dashboard/artist/messages', label: t('nav.message') || 'Messages', icon: MessageSquare },
        { path: '/dashboard/artist/analytics', label: t('upgrade.analytics') || 'Analytics', icon: BarChart3, locked: true, feature: 'analytics' },
        { path: '/dashboard/artist/community', label: t('upgrade.fanFeed') || 'Fan Feed', icon: MessageSquare, locked: true, feature: 'fan_feed' },
        { path: '/dashboard/artist/recaps', label: t('artist.recaps.title') || 'My Portfolio Recaps', icon: Video },
        { path: '/subscriptions', label: t('nav.subscriptions') || 'Subscription', icon: Crown },
      ];
    }
    if (isVendor) {
      return [
        { path: '/events', label: t('nav.events') || 'Explore Events', icon: Compass },
        { path: '/discovery', label: t('nav.discovery') || 'Discovery & Venues', icon: Globe },
        { path: '/tickets', label: t('nav.myTickets') || 'My Tickets', icon: Ticket },
        { path: '/recaps', label: t('nav.recaps') || 'Event Recaps', icon: Camera },
        { path: '/dashboard/vendor/orders', label: t('vendor.orders.navLabel') || 'Orders', icon: ShoppingBag },
        { path: '/dashboard/vendor/products', label: t('vendor.myProducts') || 'My Products', icon: Store },
        { path: '/dashboard/vendor/events', label: t('upgrade.eventBooths') || 'Event Booths', icon: CalendarDays, locked: true, feature: 'event_booths' },
        { path: '/dashboard/vendor/earnings', label: t('upgrade.earnings') || 'Earnings', icon: Wallet, locked: true, feature: 'earnings' },
        { path: '/dashboard/vendor/community', label: t('upgrade.communityPosts') || 'Community', icon: MessageSquare, locked: true, feature: 'community_posts' },
        { path: '/subscriptions', label: t('nav.subscriptions') || 'Subscription', icon: Crown },
      ];
    }
    if (isAdmin) {
      return [
        { path: '/admin/artists', label: t('nav.artists') || 'Artists', icon: Music },
        { path: '/admin/vendors', label: t('nav.vendors') || 'Vendors', icon: ShoppingBag },
        { path: '/admin/businesses', label: t('nav.businesses') || 'Businesses', icon: Store },
        { path: '/admin/bookings', label: t('nav.bookings') || 'Bookings', icon: CalendarPlus },
        { path: '/admin/financial', label: t('nav.financial') || 'Financial', icon: Wallet },
        { path: '/admin/withdrawals', label: t('nav.withdrawals') || 'Withdrawals', icon: Wallet },
        { path: '/admin/reports', label: t('nav.reports') || 'Reports', icon: Users },
        { path: '/admin/cms', label: t('nav.cms') || 'CMS', icon: BookOpen },
        { path: '/admin/notifications', label: t('nav.notifications') || 'Notifications', icon: Bell },
        { path: '/admin/settings', label: t('nav.settings') || 'Settings', icon: Settings },
      ];
    }
    return [
      { path: '/discovery', label: t('nav.discovery') || 'Discovery', icon: Users },
      { path: '/recaps', label: t('nav.recaps') || 'Event Recaps', icon: Camera },
      { path: '/food', label: t('nav.food') || 'Food', icon: Wine },
      { path: '/feed', label: t('nav.feed') || 'Feed', icon: MessageSquare },
      { path: '/tickets', label: t('nav.myTickets') || 'My Tickets', icon: Ticket },
      { path: '/favorites', label: t('nav.favorites') || 'Favorites', icon: Heart },
    ];
  }, [isFinanceStaff, isBusiness, isArtist, isVendor, isAdmin, t]);

  const handleLogout = () => {
    trigger('medium');
    logout();
    toast.success(t('nav.loggedOutSuccessfully') || 'Logged out successfully');
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020b00]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-[#d3da0c] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white flex flex-col transition-colors duration-200">
      {/* App Header with Back button and Menu button */}
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHeaderHidden ? '-100%' : 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5 safe-area-pt"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="p-2 -ml-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white touch-feedback flex items-center"
            aria-label="Go back"
            title="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-[#020b00] dark:text-[#d3da0c]" />
          </button>

          <span className="text-[#020b00] dark:text-white font-semibold text-sm truncate max-w-[48vw] capitalize">
            {getPageTitle}
          </span>

          <div className="flex items-center gap-2">
            <NotificationBell mobile />
            <button
              onClick={() => setShowDrawer(true)}
              className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-200 hover:text-black dark:hover:text-white touch-feedback flex items-center gap-1.5 border border-black/5 dark:border-white/10"
              aria-label="Open menu"
              title="Menu"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden">
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
                  <User className="w-3.5 h-3.5 text-black" />
                )}
              </div>
              <Menu className="w-5 h-5 text-[#020b00] dark:text-[#d3da0c]" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 pt-[calc(4rem+max(0.75rem,env(safe-area-inset-top)))] pb-app-nav overflow-y-auto app-page">
        <AnimatePresence mode="wait">
          <MobilePageTransition key={location.pathname}>
            {children}
          </MobilePageTransition>
        </AnimatePresence>
      </main>

      {/* Shared Bottom Navigation */}
      <MobileBottomNav />

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
              className="fixed right-0 top-0 bottom-0 w-[80vw] max-w-xs bg-white dark:bg-[#111111] border-l border-black/8 dark:border-white/5 z-50 safe-area-pt text-[#020b00] dark:text-white"
            >
              <div className="flex flex-col h-full p-4 safe-area-pb">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[#020b00] dark:text-white font-semibold">{t('nav.menu') || 'Menu'}</span>
                  <button onClick={() => setShowDrawer(false)} className="p-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white touch-feedback">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-black/8 dark:border-white/5">
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
                  <div>
                    <p className="text-[#020b00] dark:text-white font-medium">
                      {(profile?.first_name && profile?.last_name)
                        ? `${profile.first_name} ${profile.last_name}`
                        : profile?.first_name || profile?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-gray-500 text-xs capitalize">{role}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {drawerNavItems.map((item) => {
                    const Icon = item.icon;
                    const locked = isReallyLocked(item);
                    return (
                      <button
                        key={item.path}
                        onClick={(e) => {
                          trigger('light');
                          if (locked) {
                            handleLockedClick(e, item);
                          } else {
                            navigate(item.path);
                            setShowDrawer(false);
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors touch-feedback ${
                          locked
                            ? 'text-gray-400 dark:text-gray-600'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${locked ? 'opacity-50' : ''}`} />
                        <span className={`text-sm font-medium ${locked ? 'line-through opacity-60' : ''}`}>{item.label}</span>
                        {locked && <Lock className="w-3.5 h-3.5 ml-auto text-gray-500" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-black/8 dark:border-white/5 space-y-1">
                  <button
                    onClick={() => {
                      trigger('light');
                      navigate('/settings');
                      setShowDrawer(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white transition-colors touch-feedback"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('nav.settings')}</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors touch-feedback"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('nav.logout')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentPlan={planType}
        requiredPlan={formatPlanName(getRequiredPlan(upgradeFeature || ''))}
        featureName={upgradeFeature}
      />
    </div>
  );
};

export default MobileLayout;
