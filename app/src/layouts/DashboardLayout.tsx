/**
 * Desktop Dashboard Layout - Full Sidebar Navigation
 * Advanced analytics, reporting tools, admin controls
 * Optimized for desktop/large screens
 */
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { API_BASE_URL } from '@/config/api';
import { useSubscriptionStore, canAccessFeature, getRequiredPlan, formatPlanName } from '@/store/subscriptionStore';
import UpgradeModal from '@/components/UpgradeModal';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  User,
  Ticket,
  Wallet,
  ShieldCheck,
  Globe,
  Users,
  Store,
  ShoppingBag,
  Heart,
  Music,
  Building2,
  Bell,
  Flag,
  Wine,
  BookOpen,
  Lock,
  CreditCard,
  ScanLine,
  Crown,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface DashboardLayoutProps {
  children?: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  locked: boolean;
  feature?: string;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout, isLoading, session } = useAuthStore();
  const token = session?.access_token;
  const { t } = useTranslation();

  const {
    hasSubscription,
    planType,
    checkSubscription,
  } = useSubscriptionStore();

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | undefined>();

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard-sidebar-width');
      return saved ? parseInt(saved, 10) : 192; // default 12rem (w-48)
    }
    return 192;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const newWidth = Math.max(160, Math.min(400, clientX));
    setSidebarWidth(newWidth);
    localStorage.setItem('dashboard-sidebar-width', String(newWidth));
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', resize);
    window.addEventListener('touchend', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [resize, stopResizing]);

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

  const handleLogout = () => {
    logout();
    toast.success(t('nav.loggedOutSuccessfully') || 'Logged out successfully');
    navigate('/');
  };

  const handleLockedClick = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();
    const feature = item.feature || item.path.split('/').pop()?.replace(/-/g, '_') || 'premium';
    setUpgradeFeature(feature);
    setUpgradeModalOpen(true);
  };

  const userNavItems: NavItem[] = [
    { path: '/profile', label: t('nav.profile') || 'My Profile', icon: User, locked: false },
    { path: '/tickets', label: t('nav.myTickets') || 'My Tickets', icon: Ticket, locked: false },
    { path: '/favorites', label: t('nav.favorites') || 'Favorites', icon: CalendarDays, locked: false },
    { path: '/settings', label: t('nav.settings') || 'Settings', icon: Settings, locked: false },
  ];

  const businessNavItems: NavItem[] = [
    { path: '/dashboard/business', label: t('nav.dashboard') || 'Dashboard Overview', icon: LayoutDashboard, locked: false },
    { path: '/dashboard/business/events', label: t('nav.events') || 'Events', icon: CalendarDays, locked: false },
    { path: '/dashboard/business/ticket-orders', label: t('business.dashboard.ticketOrders') || 'Ticket Orders', icon: Ticket, locked: false },
    { path: '/dashboard/business/staff', label: t('business.staff.title') || 'Staff', icon: Users, locked: false },
    { path: '/dashboard/business/analytics', label: t('upgrade.analytics') || 'Analytics', icon: BarChart3, locked: true, feature: 'analytics' },
    { path: '/dashboard/business/followers', label: t('nav.followers') || 'Followers', icon: Heart, locked: false },
    { path: '/dashboard/business/payouts', label: t('upgrade.payouts') || 'Payouts', icon: Wallet, locked: true, feature: 'payouts' },
    { path: '/dashboard/business/community', label: t('upgrade.communityPosts') || 'Community Posts', icon: MessageSquare, locked: true, feature: 'community_posts' },
    { path: '/dashboard/business/profile', label: t('nav.profile') || 'Community Profile', icon: Store, locked: false },
    { path: '/dashboard/business/tables', label: t('upgrade.tableReservations') || 'Table Reservations', icon: Wine, locked: true, feature: 'table_reservations' },
    { path: '/subscriptions', label: t('nav.subscriptions') || 'Subscription', icon: Crown, locked: false },
  ];

  const vendorNavItems: NavItem[] = [
    { path: '/dashboard/vendor', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard, locked: false },
    { path: '/dashboard/vendor/products', label: t('vendor.myProducts') || 'My Products', icon: Store, locked: false },
    { path: '/dashboard/vendor/orders', label: t('vendor.orders') || 'Orders', icon: ShoppingBag, locked: false },
    { path: '/dashboard/vendor/events', label: t('upgrade.eventBooths') || 'Event Booths', icon: CalendarDays, locked: true, feature: 'event_booths' },
    { path: '/dashboard/vendor/earnings', label: t('upgrade.earnings') || 'Earnings', icon: Wallet, locked: true, feature: 'earnings' },
    { path: '/dashboard/vendor/community', label: t('upgrade.communityPosts') || 'Community', icon: MessageSquare, locked: true, feature: 'community_posts' },
    { path: '/dashboard/vendor/profile', label: t('nav.profile') || 'Profile', icon: User, locked: false },
    { path: '/subscriptions', label: t('nav.subscriptions') || 'Subscription', icon: Crown, locked: false },
  ];

  const artistNavItems: NavItem[] = [
    { path: '/dashboard/artist', label: t('nav.artistHome') || 'Artist Home', icon: LayoutDashboard, locked: false },
    { path: '/dashboard/artist/bookings', label: t('artist.bookings.title') || 'Bookings', icon: CalendarPlus, locked: false },
    { path: '/dashboard/artist/performances', label: t('artist.performances.title') || 'Performances', icon: CalendarDays, locked: false },
    { path: '/dashboard/artist/analytics', label: t('upgrade.analytics') || 'Analytics', icon: BarChart3, locked: true, feature: 'analytics' },
    { path: '/dashboard/artist/community', label: t('upgrade.fanFeed') || 'Fan Feed', icon: MessageSquare, locked: true, feature: 'fan_feed' },
    { path: '/subscriptions', label: t('nav.subscriptions') || 'Subscription', icon: Crown, locked: false },
  ];

  const adminNavItems: NavItem[] = [
    { path: '/admin', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard, locked: false },
    { path: '/admin/users', label: t('nav.users') || 'Users', icon: Users, locked: false },
    { path: '/admin/artists', label: t('nav.artists') || 'Artists', icon: Music, locked: false },
    { path: '/admin/vendors', label: t('nav.vendors') || 'Vendors', icon: ShoppingBag, locked: false },
    { path: '/admin/businesses', label: t('nav.businesses') || 'Businesses', icon: Building2, locked: false },
    { path: '/admin/events', label: t('nav.events') || 'Events', icon: CalendarDays, locked: false },
    { path: '/admin/bookings', label: t('nav.bookings') || 'Bookings', icon: CalendarPlus, locked: false },
    { path: '/admin/financial', label: t('nav.financial') || 'Financial', icon: Wallet, locked: false },
    { path: '/admin/withdrawals', label: t('nav.withdrawals') || 'Withdrawals', icon: CreditCard, locked: false },
    { path: '/admin/reports', label: t('nav.reports') || 'Reports', icon: Flag, locked: false },
    { path: '/admin/cms', label: t('nav.cms') || 'CMS', icon: BookOpen, locked: false },
    { path: '/admin/notifications', label: t('nav.notifications') || 'Notifications', icon: Bell, locked: false },
    { path: '/admin/roles', label: t('nav.roles') || 'Roles', icon: ShieldCheck, locked: false },
    { path: '/admin/settings', label: t('nav.settings') || 'Settings', icon: Settings, locked: false },
    { path: '/admin/logs', label: t('nav.logs') || 'Logs', icon: Lock, locked: false },
    { path: '/admin/api', label: t('nav.api') || 'API', icon: Globe, locked: false },
  ];

  const getNavItems = (): NavItem[] => {
    const role = profile?.role_type || profile?.role;
    switch (role) {
      case 'admin':
      case 'super_admin': return adminNavItems;
      case 'business':
      case 'organizer': return businessNavItems;
      case 'artist':
      case 'dj': return artistNavItems;
      case 'vendor': return vendorNavItems;
      default: return userNavItems;
    }
  };

  const navItems = getNavItems();
  const role = (profile?.role_type || profile?.role || '').toLowerCase();
  const portalName =
    (role === 'admin' || role === 'super_admin') ? 'ADMIN PORTAL' :
      (role === 'business' || role === 'organizer') ? 'BUSINESS PORTAL' :
        (role === 'artist' || role === 'dj') ? 'ARTIST PORTAL' :
          role === 'vendor' ? 'VENDOR PORTAL' : 'USER PORTAL';

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isReallyLocked = (item: NavItem) => {
    if (!item.locked) return false;
    // Verified users get unlimited access without subscription
    if (profile?.is_verified) return false;
    if (hasSubscription === null) return false; // still loading
    if (!hasSubscription) return true;
    if (item.feature) {
      return !canAccessFeature(planType, item.feature);
    }
    return false;
  };

  // Show loading state while profile is loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // If no profile after loading, show error
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load profile</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#d3da0c] text-black rounded-lg"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Sidebar */}
      <aside
        className="bg-[#111111] border-r border-white/5 flex flex-col fixed h-full overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <Link to="/" className="inline-block max-w-full">
            <img
              src="/logo.png"
              alt="Sound It"
              className="h-16 w-auto max-w-full"
            />
          </Link>
          <p className="text-gray-500 text-[10px] mt-1 truncate">
            {portalName}
          </p>
        </div>

        {/* Subscription warning banner */}
        {hasSubscription === false && !profile?.is_verified && (role === 'business' || role === 'organizer' || role === 'vendor' || role === 'artist') && (
          <div className="px-4 pt-3 pb-1">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <p className="text-yellow-500 text-xs">
                {t('upgrade.upgradeBanner') || 'Upgrade your subscription to unlock premium features.'}
              </p>
            </div>
          </div>
        )}

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const locked = isReallyLocked(item);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={(e) => locked && handleLockedClick(e, item)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${active
                  ? 'bg-[#d3da0c]/10 text-[#d3da0c] border border-[#d3da0c]/30'
                  : locked
                    ? 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-[#d3da0c]' : ''} ${locked ? 'opacity-50' : ''}`} />
                <span className={`font-medium ${locked ? 'line-through opacity-60' : ''}`}>{item.label}</span>
                {locked && (
                  <>
                    <Lock className="w-3.5 h-3.5 ml-auto text-gray-500" />
                    <span className="ml-1 text-[10px] uppercase tracking-wider text-gray-500">
                      {formatPlanName(getRequiredPlan(item.feature || ''))}
                    </span>
                  </>
                )}
                {!locked && active && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || 'User'}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                />
              ) : (
                <User className="w-5 h-5 text-black" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{profile?.display_name || profile?.first_name || 'User'}</p>
              <p className="text-gray-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-1">
            <Link
              to="/settings"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">{t('nav.settings')}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
        {/* Resize Handle */}
        <div
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-[#d3da0c]/20 transition-colors z-10"
          onMouseDown={startResizing}
          onTouchStart={startResizing}
          title="Drag to resize sidebar"
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen" style={{ marginLeft: sidebarWidth }}>
        {children || <Outlet />}
      </main>

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

export default DashboardLayout;
