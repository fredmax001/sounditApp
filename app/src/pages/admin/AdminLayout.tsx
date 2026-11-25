import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  BarChart3, Sun, Moon, Send, Search, Grid, Monitor
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
}

interface AdminMenuGroup {
  label: string;
  items: AdminMenuItem[];
}

// Grouped sidebar & mobile drawer menu structure - each item has a permission key
const menuGroups: AdminMenuGroup[] = [
  {
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin', permission: 'dashboard' },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics', permission: 'analytics_read' },
    ]
  },
  {
    label: 'Platform',
    items: [
      { id: 'users', label: 'Users', icon: Users, path: '/admin/users', permission: 'users_read' },
      { id: 'artists', label: 'Artists', icon: Music, path: '/admin/artists', permission: 'users_read' },
      { id: 'vendors', label: 'Vendors', icon: ShoppingBag, path: '/admin/vendors', permission: 'users_read' },
      { id: 'businesses', label: 'Businesses', icon: Building2, path: '/admin/businesses', permission: 'users_read' },
      { id: 'events', label: 'Events', icon: Calendar, path: '/admin/events', permission: 'events_read' },
      { id: 'bookings', label: 'Bookings', icon: Briefcase, path: '/admin/bookings', permission: 'events_read' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { id: 'financial', label: 'Financial', icon: DollarSign, path: '/admin/financial', permission: 'financials_read' },
      { id: 'subscriptions', label: 'Subscriptions', icon: Layers, path: '/admin/subscriptions', requiresSuperAdmin: true },
      { id: 'withdrawals', label: 'Withdrawals', icon: CreditCard, path: '/admin/withdrawals', permission: 'financials_read' },
    ]
  },
  {
    label: 'Content',
    items: [
      { id: 'reports', label: 'Moderation', icon: Flag, path: '/admin/reports', permission: 'support_read' },
      { id: 'community', label: 'Community', icon: MessageSquare, path: '/admin/community', permission: 'support_read' },
      { id: 'cms', label: 'CMS', icon: BookOpen, path: '/admin/cms', permission: 'content_read' },
      { id: 'intro-screen', label: 'Intro Screen', icon: Monitor, path: '/admin/intro-screen', permission: 'content_read' },
      { id: 'recaps', label: 'Recaps', icon: Calendar, path: '/admin/recaps', permission: 'content_read' },
      { id: 'ads', label: 'Ads Manager', icon: Megaphone, path: '/admin/ads', permission: 'marketing_read' },
    ]
  },
  {
    label: 'Security',
    items: [
      { id: 'verification', label: 'Verification', icon: ShieldCheck, path: '/admin/verification-center', permission: 'verifications_read' },
      { id: 'notifications', label: 'Broadcasts & Alerts', icon: Send, path: '/admin/notifications', permission: 'marketing_read' },
      { id: 'roles', label: 'Roles', icon: Shield, path: '/admin/roles', permission: 'admins_write' },
      { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', permission: 'settings_read' },
      { id: 'logs', label: 'Security Logs', icon: Lock, path: '/admin/logs', permission: 'settings_read' },
      { id: 'api', label: 'API & Integrations', icon: Globe, path: '/admin/api', permission: 'settings_read' },
    ]
  }
];

// Flat list for breadcrumb & title lookup
const allMenuItems = menuGroups.flatMap(g => g.items);

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
  const [drawerSearch, setDrawerSearch] = useState('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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
      setDrawerSearch('');
    }
  }, [location.pathname, isMobile]);

  // Lock background scroll while mobile admin drawer is open
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    return lockBodyScroll();
  }, [isMobile, isSidebarOpen]);

  const [myRoleInfo, setMyRoleInfo] = useState<{ role_name?: string; is_system?: boolean }>({});

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/admins/me/permissions`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyRoleInfo(data);
        useAuthStore.setState({ permissions: data.permissions || [] });
      }
    } catch (error) {
      console.error('Failed to fetch permissions', error);
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
    fetchPermissions();
  }, [fetchPermissions, isAdmin, navigate, t]);

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
    // Prefer longest matching path (e.g. /admin/community/posts over /admin/community)
    const matches = allMenuItems.filter(m => isActiveRoute(m.path));
    return matches.sort((a, b) => b.path.length - a.path.length)[0];
  }, [isActiveRoute]);

  const filteredMenuGroups = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
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
  }, [canAccessItem, drawerSearch]);

  // 4 core mobile bottom bar destinations + 5th "More" drawer trigger
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
      <div className="min-h-dvh bg-white dark:bg-[#020b00] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-dvh w-full max-w-full bg-neutral-50 dark:bg-[#020b00] flex overflow-x-clip">
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

      {/* Desktop Sidebar & Mobile Full-Height App Drawer */}
      <motion.aside
        initial={false}
        animate={
          isMobile
            ? {
                width: 'min(86vw, 320px)',
                x: isSidebarOpen ? 0 : -340,
              }
            : {
                width: isSidebarOpen ? 260 : 72,
                x: 0,
              }
        }
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed lg:sticky lg:top-0 lg:h-dvh lg:self-start inset-y-0 left-0 bg-white dark:bg-[#0b120a] border-r border-black/8 dark:border-white/[0.08] z-[70] lg:z-30 flex flex-col overflow-hidden shadow-2xl lg:shadow-none"
      >
        {/* Logo & Mobile Close Header */}
        <div className="flex items-center justify-between px-4 border-b border-black/8 dark:border-white/[0.06] shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:pt-0 lg:pb-0 lg:h-[64px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#d3da0c] rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-[#d3da0c]/20">
              <Zap className="w-5 h-5 text-black" fill="black" />
            </div>
            <AnimatePresence>
              {(isSidebarOpen || isMobile) && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="overflow-hidden min-w-0"
                >
                  <img
                    src={isDark ? '/logo-dark.png' : '/logo-light.png'}
                    alt="Sound It"
                    className="h-6 w-auto object-contain"
                  />
                  <p className="text-[#8a8f04] dark:text-[#d3da0c] text-[0.625rem] font-bold uppercase tracking-widest whitespace-nowrap mt-0.5">
                    Admin Console
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close admin menu"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white bg-black/5 dark:bg-white/5 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mobile Quick Search inside Drawer */}
        {isMobile && (
          <div className="px-3 pt-3 pb-2 border-b border-black/5 dark:border-white/[0.06] shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="Search admin modules…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/[0.06] border border-black/8 dark:border-white/10 text-sm text-[#020b00] dark:text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 scrollbar-thin">
          {filteredMenuGroups.map((group) => {
            const isCollapsed = !drawerSearch && collapsedGroups[group.label];
            const hasActiveItem = group.items.some(item => isActiveRoute(item.path));

            return (
              <div key={group.label} className="mb-1.5">
                {/* Group Header */}
                {(isSidebarOpen || isMobile) && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
                  >
                    <span className={`text-[0.625rem] font-bold uppercase tracking-widest transition-colors ${hasActiveItem ? 'text-[#020b00] dark:text-[#d3da0c]' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-900 dark:group-hover:text-gray-300'}`}>
                      {group.label}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                )}
                {!isSidebarOpen && !isMobile && <div className="h-2" />}

                {/* Group Items */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden space-y-0.5"
                    >
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isActiveRoute(item.path);

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              navigate(item.path);
                              if (isMobile) setIsSidebarOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-xl lg:rounded-lg transition-all relative group min-h-[44px] lg:min-h-0 active:scale-[0.99] ${
                              isActive
                                ? 'bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] font-semibold border border-[#d3da0c]/30 lg:border-transparent'
                                : 'text-gray-700 dark:text-gray-300 lg:text-gray-600 lg:dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.05]'
                            }`}
                            title={!isSidebarOpen && !isMobile ? item.label : undefined}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeBar"
                                className="absolute left-0 top-1.5 bottom-1.5 w-1 lg:w-0.5 bg-[#020b00] dark:bg-[#d3da0c] rounded-full"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            {Icon && <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#020b00] dark:text-[#d3da0c]' : ''}`} />}
                            {(isSidebarOpen || isMobile) && (
                              <span className="text-sm whitespace-nowrap overflow-hidden truncate">
                                {item.label}
                              </span>
                            )}
                            {isMobile && isActive && (
                              <ChevronRight className="w-4 h-4 ml-auto text-[#020b00] dark:text-[#d3da0c] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {isMobile && filteredMenuGroups.length === 0 && (
            <div className="py-10 text-center text-xs text-gray-500">
              No admin modules match "{drawerSearch}"
            </div>
          )}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-black/8 dark:border-white/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1.5 shrink-0">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${(isSidebarOpen || isMobile) ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-[#d3da0c] to-[#a8b009] rounded-full flex items-center justify-center text-black font-bold text-sm shrink-0">
              {profile?.first_name?.[0] || profile?.email?.[0] || 'A'}
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="overflow-hidden min-w-0">
                <p className="text-[#020b00] dark:text-white text-sm font-medium whitespace-nowrap truncate">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-gray-500 dark:text-[#d3da0c] text-[0.625rem] font-semibold uppercase tracking-wider whitespace-nowrap">
                  {myRoleInfo.role_name || (profile?.role === 'super_admin' ? 'Super Admin' : 'Admin')}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 lg:py-2 text-red-500 lg:text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl lg:rounded-lg transition-all ${!(isSidebarOpen || isMobile) ? 'justify-center' : ''}`}
            title={!isSidebarOpen && !isMobile ? 'Logout' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(isSidebarOpen || isMobile) && (
              <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                Logout
              </span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col w-full max-w-full min-w-0">
        {/* Mobile Native App Header (< lg) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-xl border-b border-black/8 dark:border-white/[0.08] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="h-14 flex items-center justify-between px-3.5 gap-2">
            {/* Left: Back button on sub-pages or Admin badge on root */}
            <div className="flex items-center gap-2 min-w-0">
              {!isOnRootAdmin ? (
                <button
                  onClick={() => {
                    if (window.history.length > 1) navigate(-1);
                    else navigate('/admin');
                  }}
                  aria-label="Go back"
                  className="w-10 h-10 -ml-1.5 rounded-xl flex items-center justify-center text-[#020b00] dark:text-[#d3da0c] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all shrink-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              ) : (
                <div className="w-9 h-9 bg-[#d3da0c] rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-[#d3da0c]/20">
                  <Zap className="w-4 h-4 text-black" fill="black" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[0.625rem] font-bold uppercase tracking-widest text-[#8a8f04] dark:text-[#d3da0c] leading-none">
                  Sound It Admin
                </p>
                <h1 className="text-sm font-bold text-[#020b00] dark:text-white truncate leading-tight mt-0.5">
                  {activeItem?.label || 'Dashboard'}
                </h1>
              </div>
            </div>

            {/* Right: Theme, Notifications, Full Menu */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/[0.07] border border-black/5 dark:border-white/10 text-gray-700 dark:text-gray-200 active:scale-95 transition-all"
              >
                {isDark ? <Sun className="w-4 h-4 text-[#d3da0c]" /> : <Moon className="w-4 h-4 text-[#020b00]" />}
              </button>

              <NotificationBell mobile />

              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open admin menu"
                className="h-9 pl-1.5 pr-2.5 rounded-xl bg-black/5 dark:bg-white/[0.07] border border-black/5 dark:border-white/10 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-[#d3da0c] flex items-center justify-center text-black font-extrabold text-xs">
                  {profile?.first_name?.[0] || 'A'}
                </div>
                <Menu className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
              </button>
            </div>
          </div>
        </header>

        {/* Desktop Header (>= lg) */}
        <header className="hidden lg:flex h-[64px] bg-white/90 dark:bg-[#111111]/80 backdrop-blur-md border-b border-black/8 dark:border-white/[0.06] items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Admin</span>
              <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-600" />
              <span className="text-[#020b00] dark:text-white font-medium">{activeItem?.label || 'Dashboard'}</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/[0.04] rounded-lg border border-black/8 dark:border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-gray-600 dark:text-gray-400 text-xs font-mono">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg transition-all"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-[#d3da0c]" /> : <Moon className="w-4 h-4 text-[#020b00]" />}
            </button>

            <div className="flex items-center">
              <NotificationBell />
            </div>

            <button
              onClick={() => navigate('/admin/settings')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            {myRoleInfo.role_name && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] rounded-full border border-[#d3da0c]/30 text-xs font-semibold">
                <Shield className="w-3 h-3 text-[#d3da0c]" />
                <span>{myRoleInfo.role_name}</span>
              </div>
            )}

            <div className="w-8 h-8 bg-gradient-to-br from-[#d3da0c] to-[#a8b009] rounded-full flex items-center justify-center text-black font-bold text-sm cursor-default shadow-xs">
              {profile?.first_name?.[0] || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-shell-main flex-1 w-full max-w-full min-w-0 overflow-x-clip px-3.5 sm:px-5 lg:px-6 pt-3.5 sm:pt-5 lg:pt-6 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <div className="w-full max-w-full min-w-0">
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Floating Native Mobile Admin Bottom Navigation Bar (< lg) */}
      {!isKeyboardOpen && !isSidebarOpen && (
        <nav
          aria-label="Admin mobile navigation"
          className="lg:hidden fixed left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-40 hide-on-keyboard"
        >
          <div className="mx-auto max-w-md bg-[#0F140D]/95 backdrop-blur-2xl border border-[#1F261E] rounded-full px-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-around gap-1">
            {mobileBottomTabs.map((tab) => {
              const Icon = tab.icon!;
              const active = isActiveRoute(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all active:scale-95 min-h-[48px] ${
                    active
                      ? 'bg-[#d3da0c] text-black font-extrabold shadow-[0_0_12px_rgba(211,218,12,0.35)]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-black stroke-[2.5]' : 'text-[#9CA3AF] stroke-[1.8]'}`} />
                  <span className={`text-[0.625rem] mt-0.5 leading-none truncate max-w-full ${active ? 'font-black text-black' : 'font-medium text-[#9CA3AF]'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all active:scale-95 min-h-[48px] ${
                isMoreTabActive
                  ? 'bg-[#d3da0c] text-black font-extrabold shadow-[0_0_12px_rgba(211,218,12,0.35)]'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <Grid className={`w-5 h-5 ${isMoreTabActive ? 'text-black stroke-[2.5]' : 'text-[#9CA3AF] stroke-[1.8]'}`} />
              <span className={`text-[0.625rem] mt-0.5 leading-none ${isMoreTabActive ? 'font-black text-black' : 'font-medium text-[#9CA3AF]'}`}>
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
