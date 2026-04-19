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
  MessageSquare
} from 'lucide-react';

// Sidebar menu structure
const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { id: 'users', label: 'Users Management', icon: Users, path: '/admin/users' },
  { id: 'artists', label: 'Artists Management', icon: Music, path: '/admin/artists' },
  { id: 'vendors', label: 'Vendors Management', icon: ShoppingBag, path: '/admin/vendors' },
  { id: 'businesses', label: 'Businesses Management', icon: Building2, path: '/admin/businesses' },
  { id: 'events', label: 'Events Management', icon: Calendar, path: '/admin/events' },
  { id: 'bookings', label: 'Booking Management', icon: Briefcase, path: '/admin/bookings' },
  { id: 'financial', label: 'Financial & Commission', icon: DollarSign, path: '/admin/financial' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Layers, path: '/admin/subscriptions', requiresSuperAdmin: true },
  { id: 'withdrawals', label: 'Withdrawal Requests', icon: CreditCard, path: '/admin/withdrawals' },
  { id: 'reports', label: 'Reports & Moderation', icon: Flag, path: '/admin/reports' },
  { id: 'community', label: 'Community', icon: MessageSquare, path: '/admin/community' },
  { id: 'cms', label: 'CMS / Content', icon: BookOpen, path: '/admin/cms' },
  { id: 'recaps', label: 'Recaps', icon: Calendar, path: '/admin/recaps' },
  { id: 'ads', label: 'Ads Manager', icon: Megaphone, path: '/admin/ads' },
  { id: 'verification', label: 'Verification Center', icon: ShieldCheck, path: '/admin/verification-center' },
  { id: 'notifications', label: 'Notification Center', icon: Bell, path: '/admin/notifications' },
  { id: 'roles', label: 'Role & Permissions', icon: Shield, path: '/admin/roles' },
  { id: 'settings', label: 'System Settings', icon: Settings, path: '/admin/settings' },
  { id: 'logs', label: 'Security Logs', icon: Lock, path: '/admin/logs' },
  { id: 'api', label: 'API & Integrations', icon: Globe, path: '/admin/api' },
];

const AdminLayout = ({ children }: { children?: React.ReactNode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, isAdmin, logout, session } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);

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

      if (!res.ok) {
        console.error('Failed to fetch permissions');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
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
            className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 280 : 80,
          x: isMobile && !isSidebarOpen ? -280 : 0
        }}
        className={`fixed lg:static inset-y-0 left-0 bg-[#111111] border-r border-white/10 z-50 flex flex-col ${isMobile && !isSidebarOpen ? '-translate-x-full' : ''
          }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#d3da0c] rounded-lg flex items-center justify-center shrink-0">
              <span className="text-black font-bold text-lg">S</span>
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <h1 className="text-white font-bold text-lg whitespace-nowrap">{t('admin.adminLayout.appName')}</h1>
                  <p className="text-gray-500 text-xs whitespace-nowrap">{t('admin.adminLayout.adminPanel')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuItems
            .filter((item) => !item.requiresSuperAdmin || profile?.role_type === 'super_admin' || profile?.role === 'super_admin')
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                    ? 'bg-[#d3da0c] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  title={!isSidebarOpen ? t(`admin.adminLayout.${item.id}`) : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence>
                    {isSidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {t(`admin.adminLayout.${item.id}`)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && isSidebarOpen && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="ml-auto w-1.5 h-1.5 bg-black rounded-full"
                    />
                  )}
                </button>
              );
            })}
        </nav>

        {/* User Info & Logout */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d3da0c] to-[#bbc10b] rounded-full flex items-center justify-center text-black font-bold shrink-0">
              {profile?.first_name?.[0] || profile?.email?.[0] || 'A'}
            </div>
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-white text-sm font-medium whitespace-nowrap">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-[#d3da0c] text-xs whitespace-nowrap">
                    {t(profile?.role === 'super_admin' ? 'admin.adminLayout.superAdmin' : 'admin.adminLayout.admin')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all ${!isSidebarOpen && 'justify-center'
              }`}
            title={!isSidebarOpen ? t('admin.adminLayout.logout') : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                >
                  {t('admin.adminLayout.logout')}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-[#111111] border-b border-white/10 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="text-gray-500">{t('admin.adminLayout.breadcrumbAdmin')}</span>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span className="text-white">
                {t(`admin.adminLayout.${menuItems.find(m => isActiveRoute(m.path))?.id || 'dashboard'}`)}
              </span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/notifications')}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            <button
              onClick={() => navigate('/admin/settings')}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
