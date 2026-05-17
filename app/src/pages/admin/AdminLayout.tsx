import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import {
  LayoutDashboard, Users, Music, ShoppingBag, Building2, Calendar,
  Briefcase, DollarSign, Bell, Shield, ShieldCheck, Settings,
  LogOut, Menu, X, ChevronRight,
  BookOpen, Lock, Globe, Flag,
  CreditCard, Layers, Megaphone,
  MessageSquare, ChevronDown, Zap,
  BarChart3
} from 'lucide-react';

// Grouped sidebar menu structure — each item has a permission key
const menuGroups = [
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
      { id: 'recaps', label: 'Recaps', icon: Calendar, path: '/admin/recaps', permission: 'content_read' },
      { id: 'ads', label: 'Ads Manager', icon: Megaphone, path: '/admin/ads', permission: 'marketing_read' },
    ]
  },
  {
    label: 'Security',
    items: [
      { id: 'verification', label: 'Verification', icon: ShieldCheck, path: '/admin/verification-center', permission: 'verifications_read' },
      { id: 'notifications', label: 'Notifications', icon: Bell, path: '/admin/notifications', permission: 'marketing_read' },
      { id: 'roles', label: 'Roles', icon: Shield, path: '/admin/roles', permission: 'admins_write' },
      { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', permission: 'settings_read' },
      { id: 'logs', label: 'Security Logs', icon: Lock, path: '/admin/logs', permission: 'settings_read' },
      { id: 'api', label: 'API & Integrations', icon: Globe, path: '/admin/api', permission: 'settings_read' },
    ]
  }
];

// Flat list for breadcrumb lookup
const allMenuItems = menuGroups.flatMap(g => g.items);

const AdminLayout = ({ children }: { children?: React.ReactNode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin, isSuperAdmin, hasPermission, logout, session } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/admins/me/permissions`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (!res.ok) console.error('Failed to fetch permissions');
    } catch (error) {
      console.error('Failed to fetch permissions', error);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isAdmin()) {
      toast.error(t('admin.adminLayout.accessDenied'));
      navigate('/');
      return;
    }
    fetchPermissions();
  }, [fetchPermissions, isAdmin, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success(t('admin.adminLayout.loggedOutSuccessfully'));
  };

  const isActiveRoute = (path: string) => {
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path !== '/admin' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const activeItem = allMenuItems.find(m => isActiveRoute(m.path));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 260 : 72,
          x: isMobile && !isSidebarOpen ? -260 : 0
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed lg:static inset-y-0 left-0 bg-[#111111] border-r border-white/[0.06] z-50 flex flex-col overflow-hidden`}
      >
        {/* Logo */}
        <div className="h-[64px] flex items-center px-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[#d3da0c] rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-[#d3da0c]/20">
              <Zap className="w-5 h-5 text-black" fill="black" />
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="overflow-hidden min-w-0"
                >
                  <h1 className="text-white font-bold text-base leading-tight whitespace-nowrap">Sound It</h1>
                  <p className="text-[#d3da0c] text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap">Admin Panel</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
          {menuGroups
            .filter(group => group.items.some(item => {
              if (item.requiresSuperAdmin) return isSuperAdmin();
              if (!item.permission) return true;
              return hasPermission(item.permission);
            }))
            .map((group) => {
              const isCollapsed = collapsedGroups[group.label];
              const hasActiveItem = group.items.some(item => isActiveRoute(item.path));

              return (
                <div key={group.label} className="mb-1">
                  {/* Group Header */}
                  {isSidebarOpen && (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${hasActiveItem ? 'text-[#d3da0c]' : 'text-gray-600 group-hover:text-gray-400'}`}>
                        {group.label}
                      </span>
                      <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  )}
                  {!isSidebarOpen && <div className="h-2" />}

                  {/* Group Items */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden space-y-0.5"
                      >
                        {group.items
                          .filter(item => {
                            if (item.requiresSuperAdmin) return isSuperAdmin();
                            if (!item.permission) return true;
                            return hasPermission(item.permission);
                          })
                          .map((item) => {
                            const Icon = item.icon;
                            const isActive = isActiveRoute(item.path);

                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  navigate(item.path);
                                  if (isMobile) setIsSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative group ${
                                  isActive
                                    ? 'bg-[#d3da0c]/10 text-[#d3da0c]'
                                    : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                                }`}
                                title={!isSidebarOpen ? item.label : undefined}
                              >
                                {isActive && (
                                  <motion.div
                                    layoutId="activeBar"
                                    className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#d3da0c] rounded-full"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                  />
                                )}
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#d3da0c]' : ''}`} />
                                <AnimatePresence>
                                  {isSidebarOpen && (
                                    <motion.span
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                                    >
                                      {item.label}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </button>
                            );
                          })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-white/[0.06] p-3 space-y-1 shrink-0">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-[#d3da0c] to-[#a8b009] rounded-full flex items-center justify-center text-black font-bold text-sm shrink-0">
              {profile?.first_name?.[0] || profile?.email?.[0] || 'A'}
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="overflow-hidden min-w-0"
                >
                  <p className="text-white text-sm font-medium whitespace-nowrap truncate">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-[#d3da0c] text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">
                    {profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all ${!isSidebarOpen ? 'justify-center' : ''}`}
            title={!isSidebarOpen ? 'Logout' : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[64px] bg-[#111111]/80 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 text-sm">
              <span className="text-gray-600">Admin</span>
              <ChevronRight className="w-3 h-3 text-gray-700" />
              <span className="text-white font-medium">{activeItem?.label || 'Dashboard'}</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Live Clock */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-400 text-xs font-mono">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => navigate('/admin/notifications')}
              className="relative p-2 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            <button
              onClick={() => navigate('/admin/settings')}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div className="w-8 h-8 bg-gradient-to-br from-[#d3da0c] to-[#a8b009] rounded-full flex items-center justify-center text-black font-bold text-sm cursor-default">
              {profile?.first_name?.[0] || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
