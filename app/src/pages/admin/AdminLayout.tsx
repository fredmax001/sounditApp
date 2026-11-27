import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import {
  LayoutDashboard, Users, Music, ShoppingBag, Building2, Calendar,
  Briefcase, DollarSign, Shield, ShieldCheck, Settings,
  LogOut, Menu, X, ChevronRight, ChevronLeft,
  BookOpen, Lock, Globe, Flag,
  CreditCard, Layers, Megaphone,
  MessageSquare, ChevronDown, Zap,
  BarChart3, Sun, Moon, Send, Search, Grid, Monitor, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import NotificationBell from '@/components/NotificationBell';
import { lockBodyScroll } from '@/lib/scrollLock';

interface AdminMenuItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  path: string;
  permission?: string;
  requiresSuperAdmin?: boolean;
  badgeKey?: keyof NavBadgeCounts;
}

interface AdminMenuGroup {
  label: string;
  items: AdminMenuItem[];
}

interface NavBadgeCounts {
  pendingEvents: number;
  pendingPayouts: number;
  pendingVerifications: number;
  pendingReports: number;
  pendingBusinesses: number;
  pendingVendors: number;
}

const menuGroups: AdminMenuGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin', permission: 'dashboard' },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics', permission: 'analytics_read' },
    ]
  },
  {
    label: 'Directory & Events',
    items: [
      { id: 'users', label: 'Users', icon: Users, path: '/admin/users', permission: 'users_read' },
      { id: 'artists', label: 'Artists', icon: Music, path: '/admin/artists', permission: 'users_read' },
      { id: 'businesses', label: 'Businesses', icon: Building2, path: '/admin/businesses', permission: 'users_read', badgeKey: 'pendingBusinesses' },
      { id: 'vendors', label: 'Vendors', icon: ShoppingBag, path: '/admin/vendors', permission: 'users_read', badgeKey: 'pendingVendors' },
      { id: 'events', label: 'Events', icon: Calendar, path: '/admin/events', permission: 'events_read', badgeKey: 'pendingEvents' },
      { id: 'bookings', label: 'Bookings', icon: Briefcase, path: '/admin/bookings', permission: 'events_read' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { id: 'financial', label: 'Financial Control', icon: DollarSign, path: '/admin/financial', permission: 'financials_read' },
      { id: 'subscriptions', label: 'Subscriptions', icon: Layers, path: '/admin/subscriptions', requiresSuperAdmin: true },
      { id: 'withdrawals', label: 'Withdrawals', icon: CreditCard, path: '/admin/withdrawals', permission: 'financials_read', badgeKey: 'pendingPayouts' },
    ]
  },
  {
    label: 'Content & Growth',
    items: [
      { id: 'reports', label: 'Moderation', icon: Flag, path: '/admin/reports', permission: 'support_read', badgeKey: 'pendingReports' },
      { id: 'community', label: 'Community', icon: MessageSquare, path: '/admin/community', permission: 'support_read' },
      { id: 'notifications', label: 'Broadcasts & Alerts', icon: Send, path: '/admin/notifications', permission: 'marketing_read' },
      { id: 'ads', label: 'Ads Manager', icon: Megaphone, path: '/admin/ads', permission: 'marketing_read' },
      { id: 'cms', label: 'CMS Pages', icon: BookOpen, path: '/admin/cms', permission: 'content_read' },
      { id: 'intro-screen', label: 'Intro Screen', icon: Monitor, path: '/admin/intro-screen', permission: 'content_read' },
      { id: 'recaps', label: 'Recaps', icon: Calendar, path: '/admin/recaps', permission: 'content_read' },
    ]
  },
  {
    label: 'System & Access',
    items: [
      { id: 'verification', label: 'Verification', icon: ShieldCheck, path: '/admin/verification-center', permission: 'verifications_read', badgeKey: 'pendingVerifications' },
      { id: 'roles', label: 'Roles & Access', icon: Shield, path: '/admin/roles', permission: 'admins_write' },
      { id: 'settings', label: 'System Settings', icon: Settings, path: '/admin/settings', permission: 'settings_read' },
      { id: 'logs', label: 'Security Logs', icon: Lock, path: '/admin/logs', permission: 'settings_read' },
      { id: 'api', label: 'API & Integrations', icon: Globe, path: '/admin/api', permission: 'settings_read' },
    ]
  }
];

const allMenuItems = menuGroups.flatMap(g => g.items.map(item => ({ ...item, groupLabel: g.label })));

const AdminLayout = ({ children }: { children?: React.ReactNode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin, isSuperAdmin, hasPermission, logout, session } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [navSearch, setNavSearch] = useState('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [badges, setBadges] = useState<NavBadgeCounts>({
    pendingEvents: 0,
    pendingPayouts: 0,
    pendingVerifications: 0,
    pendingReports: 0,
    pendingBusinesses: 0,
    pendingVendors: 0,
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const mobileNow = window.innerWidth < 1024;
      setIsMobile(mobileNow);
      if (mobileNow) {
        setIsSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcut "/" focuses module search on desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !isMobile &&
        isSidebarOpen &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, isSidebarOpen]);

  // Hide mobile bottom nav while software keyboard is open
  useEffect(() => {
    const syncKeyboardState = () => {
      setIsKeyboardOpen(document.documentElement.dataset.keyboardOpen === 'true');
    };
    syncKeyboardState();
    const observer = new MutationObserver(syncKeyboardState);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-keyboard-open'],
    });
    return () => observer.disconnect();
  }, []);

  // Force Sound It Dark Command Center on admin routes
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.style.colorScheme = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Close mobile drawer automatically on route change
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
      setNavSearch('');
    }
  }, [location.pathname, isMobile]);

  // Lock background scroll while mobile admin drawer is open
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    return lockBodyScroll();
  }, [isMobile, isSidebarOpen]);

  const [myRoleInfo, setMyRoleInfo] = useState<{ role_name?: string; is_system?: boolean }>({});

  const fetchShellData = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${session.access_token}` };
    try {
      const [permRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/admins/me/permissions`, { headers }),
        fetch(`${API_BASE_URL}/admin/dashboard`, { headers }).catch(() => null),
      ]);
      if (permRes.ok) {
        const data = await permRes.json();
        setMyRoleInfo(data);
        useAuthStore.setState({ permissions: data.permissions || [] });
      }
      if (statsRes && statsRes.ok) {
        const s = await statsRes.json();
        setBadges({
          pendingEvents: Number(s.pending_events || 0),
          pendingPayouts: Number(s.pending_payouts || 0),
          pendingVerifications: Number(s.pending_verifications || 0),
          pendingReports: Number(s.pending_reports || 0),
          pendingBusinesses: Number(s.pending_business_approvals || 0),
          pendingVendors: Number(s.pending_vendor_approvals || 0),
        });
      }
    } catch (error) {
      console.error('Failed to fetch admin shell data', error);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isAdmin()) {
      toast.error(t('admin.adminLayout.accessDenied'));
      navigate('/admin/login', { replace: true });
      return;
    }
    fetchShellData();
  }, [fetchShellData, isAdmin, navigate, t]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
    toast.success(t('admin.adminLayout.loggedOutSuccessfully'));
  };

  const canAccessItem = useCallback(
    (item: AdminMenuItem) => {
      if (item.requiresSuperAdmin) return isSuperAdmin();
      if (!item.permission) return true;
      return hasPermission(item.permission);
    },
    [hasPermission, isSuperAdmin]
  );

  const isActiveRoute = useCallback(
    (path: string) => {
      if (path === '/admin') {
        return location.pathname === '/admin' || location.pathname === '/admin/';
      }
      return location.pathname === path || location.pathname.startsWith(path + '/');
    },
    [location.pathname]
  );

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const activeItem = useMemo(() => {
    const matches = allMenuItems.filter(m => isActiveRoute(m.path));
    return matches.sort((a, b) => b.path.length - a.path.length)[0];
  }, [isActiveRoute]);

  const filteredMenuGroups = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    return menuGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          if (!canAccessItem(item)) return false;
          if (!q) return true;
          return (
            item.label.toLowerCase().includes(q) ||
            group.label.toLowerCase().includes(q)
          );
        }),
      }))
      .filter(group => group.items.length > 0);
  }, [canAccessItem, navSearch]);

  const mobileBottomTabs = useMemo(() => {
    const candidates: AdminMenuItem[] = [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, path: '/admin', permission: 'dashboard' },
      { id: 'users', label: 'Users', icon: Users, path: '/admin/users', permission: 'users_read' },
      { id: 'events', label: 'Events', icon: Calendar, path: '/admin/events', permission: 'events_read' },
      { id: 'financial', label: 'Finance', icon: DollarSign, path: '/admin/financial', permission: 'financials_read' },
    ];
    return candidates.filter(canAccessItem);
  }, [canAccessItem]);

  const isOnRootAdmin = location.pathname === '/admin' || location.pathname === '/admin/';
  const isMoreTabActive = useMemo(() => {
    if (isSidebarOpen) return true;
    return !mobileBottomTabs.some(tab => isActiveRoute(tab.path));
  }, [isSidebarOpen, mobileBottomTabs, isActiveRoute]);

  const { isDark, toggleTheme } = useThemeStore();

  if (loading) {
    return (
      <div className="min-h-dvh bg-white dark:bg-[#050805] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading admin console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-dvh w-full max-w-full bg-neutral-50 dark:bg-[#050805] flex overflow-x-clip">
      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop Left Rail & Mobile Drawer */}
      <motion.aside
        initial={false}
        animate={
          isMobile
            ? {
                width: 'min(86vw, 310px)',
                x: isSidebarOpen ? 0 : -330,
              }
            : {
                width: isSidebarOpen ? 256 : 68,
                x: 0,
              }
        }
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        className="fixed lg:sticky lg:top-0 lg:h-dvh lg:self-start inset-y-0 left-0 bg-white dark:bg-[#0A0F0A] border-r border-black/8 dark:border-white/[0.08] z-[70] lg:z-30 flex flex-col overflow-hidden shadow-2xl lg:shadow-none shrink-0"
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 border-b border-black/8 dark:border-white/[0.07] shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:pt-0 lg:pb-0 lg:h-16">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-3 min-w-0 text-left"
          >
            <div className="w-9 h-9 bg-[#d3da0c] rounded-lg flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-black" fill="black" />
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="overflow-hidden min-w-0">
                <img
                  src={isDark ? '/logo-dark.png' : '/logo-light.png'}
                  alt="Sound It"
                  className="h-5 w-auto object-contain"
                />
                <p className="text-[#8a8f04] dark:text-[#d3da0c] text-[0.625rem] uppercase tracking-[0.14em] whitespace-nowrap mt-0.5">
                  Admin Console
                </p>
              </div>
            )}
          </button>

          {isMobile ? (
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close admin menu"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white bg-black/5 dark:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : isSidebarOpen ? (
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Quick Module Search (Desktop Expanded & Mobile Drawer) */}
        {(isSidebarOpen || isMobile) && (
          <div className="px-3 pt-3 pb-2.5 border-b border-black/5 dark:border-white/[0.06] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Jump to module..."
                className="w-full pl-8 pr-7 py-2 rounded-lg bg-neutral-100 dark:bg-white/[0.04] border border-black/8 dark:border-white/[0.08] text-xs text-[#020b00] dark:text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]/60 transition-colors"
              />
              {!isMobile && !navSearch && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.625rem] text-gray-500 border border-white/10 rounded px-1 py-0.5 leading-none pointer-events-none">
                  /
                </span>
              )}
            </div>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-3 scrollbar-thin">
          {filteredMenuGroups.map((group) => {
            const isCollapsed = !navSearch && collapsedGroups[group.label];
            const hasActiveItem = group.items.some(item => isActiveRoute(item.path));

            return (
              <div key={group.label}>
                {(isSidebarOpen || isMobile) ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-2.5 py-1 mb-1 group"
                  >
                    <span
                      className={`text-[0.625rem] uppercase tracking-[0.14em] transition-colors ${
                        hasActiveItem
                          ? 'text-[#020b00] dark:text-[#d3da0c]'
                          : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-300'
                      }`}
                    >
                      {group.label}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                ) : (
                  <div className="h-px bg-white/[0.06] mx-2 my-2" />
                )}

                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isActiveRoute(item.path);
                      const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(item.path);
                            if (isMobile) setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors relative ${
                            isActive
                              ? 'bg-[#d3da0c]/12 text-[#020b00] dark:text-[#d3da0c]'
                              : 'text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.04]'
                          } ${!isSidebarOpen && !isMobile ? 'justify-center px-0' : ''}`}
                          title={!isSidebarOpen && !isMobile ? item.label : undefined}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#020b00] dark:bg-[#d3da0c] rounded-full" />
                          )}
                          {Icon && (
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-[#020b00] dark:text-[#d3da0c]' : 'text-gray-500 dark:text-gray-400'
                              }`}
                            />
                          )}
                          {(isSidebarOpen || isMobile) && (
                            <>
                              <span className="text-[0.8125rem] whitespace-nowrap overflow-hidden truncate flex-1 text-left">
                                {item.label}
                              </span>
                              {badgeCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[0.6875rem] leading-none tabular-nums">
                                  {badgeCount}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredMenuGroups.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-500">
              No modules match "{navSearch}"
            </div>
          )}
        </nav>

        {/* Bottom Admin Identity & Logout */}
        <div className="border-t border-black/8 dark:border-white/[0.07] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1.5 shrink-0">
          <div
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] ${
              isSidebarOpen || isMobile ? '' : 'justify-center px-0 bg-transparent'
            }`}
          >
            <div className="w-8 h-8 bg-[#d3da0c] rounded-lg flex items-center justify-center text-black text-xs shrink-0">
              {(profile?.first_name?.[0] || profile?.email?.[0] || 'A').toUpperCase()}
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="overflow-hidden min-w-0 flex-1">
                <p className="text-[#020b00] dark:text-white text-xs whitespace-nowrap truncate">
                  {`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email}
                </p>
                <p className="text-gray-500 dark:text-[#d3da0c] text-[0.625rem] uppercase tracking-wider whitespace-nowrap truncate">
                  {myRoleInfo.role_name || (profile?.role === 'super_admin' ? 'Super Admin' : 'Admin')}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-red-400/90 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${
              !(isSidebarOpen || isMobile) ? 'justify-center px-0' : ''
            }`}
            title={!isSidebarOpen && !isMobile ? 'Sign out' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(isSidebarOpen || isMobile) && (
              <span className="text-xs whitespace-nowrap overflow-hidden">Sign Out</span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col w-full max-w-full min-w-0">
        {/* Mobile Header (< lg) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-[#050805]/95 backdrop-blur-xl border-b border-black/8 dark:border-white/[0.08] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="h-14 flex items-center justify-between px-3.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {!isOnRootAdmin ? (
                <button
                  onClick={() => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate('/admin');
                  }}
                  aria-label="Go back"
                  className="w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-[#020b00] dark:text-[#d3da0c] hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-8 h-8 bg-[#d3da0c] rounded-lg flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-black" fill="black" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[0.625rem] uppercase tracking-widest text-[#8a8f04] dark:text-[#d3da0c] leading-none">
                  Sound It Admin
                </p>
                <h1 className="text-sm text-[#020b00] dark:text-white truncate leading-tight mt-0.5">
                  {activeItem?.label || 'Dashboard'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-black/5 dark:bg-white/[0.06] border border-black/5 dark:border-white/[0.08] text-gray-700 dark:text-gray-200 transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4 text-[#d3da0c]" /> : <Moon className="w-4 h-4 text-[#020b00]" />}
              </button>

              <NotificationBell mobile />

              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open admin menu"
                className="h-9 px-2.5 rounded-lg bg-black/5 dark:bg-white/[0.06] border border-black/5 dark:border-white/[0.08] flex items-center gap-1.5 transition-colors"
              >
                <Menu className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
              </button>
            </div>
          </div>
        </header>

        {/* Desktop Command Top Bar (>= lg) */}
        <header className="hidden lg:flex h-16 bg-white/95 dark:bg-[#0A0F0A]/90 backdrop-blur-md border-b border-black/8 dark:border-white/[0.07] items-center justify-between px-6 xl:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Structured Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs min-w-0">
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                Console
              </button>
              {activeItem?.groupLabel && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <span className="text-gray-500 truncate">{activeItem.groupLabel}</span>
                </>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <span className="text-[#020b00] dark:text-white truncate">
                {activeItem?.label || 'Dashboard'}
              </span>
            </nav>
          </div>

          {/* Right Status & Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/[0.04] rounded-lg border border-black/8 dark:border-white/[0.07]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-gray-500 dark:text-gray-400 text-xs tabular-nums">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-[#d3da0c]" /> : <Moon className="w-4 h-4 text-[#020b00]" />}
            </button>

            <div className="flex items-center">
              <NotificationBell />
            </div>

            <button
              onClick={() => navigate('/admin/settings')}
              className="w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
              title="System Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-black/10 dark:bg-white/[0.08] mx-0.5" />

            <div className="flex items-center gap-2.5 pl-1">
              {myRoleInfo.role_name && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#d3da0c]/10 text-[#020b00] dark:text-[#d3da0c] rounded-md border border-[#d3da0c]/25 text-xs">
                  <Shield className="w-3 h-3 text-[#d3da0c]" />
                  <span>{myRoleInfo.role_name}</span>
                </span>
              )}
              <div
                className="w-8 h-8 bg-[#d3da0c] rounded-lg flex items-center justify-center text-black text-xs shrink-0"
                title={profile?.email || 'Admin'}
              >
                {(profile?.first_name?.[0] || profile?.email?.[0] || 'A').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Centered Web Canvas */}
        <main className="app-shell-main flex-1 w-full max-w-full min-w-0 overflow-x-clip px-4 sm:px-6 lg:px-8 py-5 lg:py-7 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] lg:pb-10">
          <div className="w-full max-w-[1440px] mx-auto min-w-0">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< lg) */}
      {!isKeyboardOpen && !isSidebarOpen && (
        <nav
          aria-label="Admin mobile navigation"
          className="lg:hidden fixed left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 hide-on-keyboard"
        >
          <div className="mx-auto max-w-md bg-[#0A0F0A]/95 backdrop-blur-2xl border border-white/[0.09] rounded-full px-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-around gap-1">
            {mobileBottomTabs.map((tab) => {
              const Icon = tab.icon!;
              const active = isActiveRoute(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-colors min-h-[46px] ${
                    active
                      ? 'bg-[#d3da0c] text-black'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-black' : 'text-[#9CA3AF]'}`} />
                  <span className={`text-[0.625rem] mt-0.5 leading-none truncate max-w-full ${active ? 'text-black' : 'text-[#9CA3AF]'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-colors min-h-[46px] ${
                isMoreTabActive
                  ? 'bg-[#d3da0c] text-black'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <Grid className={`w-4 h-4 ${isMoreTabActive ? 'text-black' : 'text-[#9CA3AF]'}`} />
              <span className={`text-[0.625rem] mt-0.5 leading-none ${isMoreTabActive ? 'text-black' : 'text-[#9CA3AF]'}`}>
                More
              </span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default AdminLayout;
