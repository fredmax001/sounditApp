/**
 * Mobile Bottom Navigation — Premium Floating Glass Dock (2025)
 * Detached pill shape with glassmorphism, spring animations, brand accents.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useStaffStore } from '@/store/staffStore';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '@/hooks/useHaptic';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Calendar,
  MessageCircle,
  MapPin,
  User,
  ScanLine,
  LayoutDashboard,
  Ticket,
  Store,
  ShoppingBag,
  BarChart3,
  Users,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  isCenter?: boolean;
}

const MobileBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { memberships, canScan, fetchMemberships } = useStaffStore();
  const { t } = useTranslation();
  const { trigger } = useHaptic();

  const role = profile?.role_type || profile?.role;
  const isBusiness = role === 'business' || role === 'organizer';
  const isArtist = role === 'artist' || role === 'dj';
  const isVendor = role === 'vendor';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isStaffScanner = canScan();

  React.useEffect(() => {
    if (profile) {
      fetchMemberships();
    }
  }, [profile, fetchMemberships]);

  const navItems = React.useMemo<NavItem[]>(() => {
    if (isBusiness) {
      return [
        { path: '/dashboard/business', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
        { path: '/dashboard/business/events', label: t('nav.events') || 'Events', icon: Calendar },
        { path: '/scan', label: t('nav.scan') || 'Scan', icon: ScanLine, isCenter: true },
        { path: '/dashboard/business/ticket-orders', label: t('business.dashboard.ticketOrders') || 'Tickets', icon: Ticket },
        { path: '/dashboard/business/profile', label: t('nav.profile') || 'Profile', icon: User },
      ];
    }

    if (isArtist) {
      return [
        { path: '/dashboard/artist', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
        { path: '/dashboard/artist/bookings', label: t('artist.bookings.title') || 'Bookings', icon: Calendar },
        { path: '/dashboard/artist', label: t('nav.myGigs') || 'My Gigs', icon: Ticket },
        { path: '/dashboard/artist/performances', label: t('artist.performances.title') || 'Gigs', icon: BarChart3 },
        { path: '/profile', label: t('nav.profile') || 'Profile', icon: User },
      ];
    }

    if (isVendor) {
      return [
        { path: '/dashboard/vendor', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
        { path: '/dashboard/vendor/products', label: t('vendor.myProducts') || 'Products', icon: Store },
        { path: '/scan', label: t('nav.scan') || 'Scan', icon: ScanLine },
        { path: '/dashboard/vendor/orders', label: t('vendor.orders.navLabel') || 'Orders', icon: ShoppingBag },
        { path: '/dashboard/vendor/profile', label: t('nav.profile') || 'Profile', icon: User },
      ];
    }

    if (isAdmin) {
      return [
        { path: '/admin', label: t('nav.dashboard') || 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/events', label: t('nav.events') || 'Events', icon: Calendar },
        { path: '/scan', label: t('nav.scan') || 'Scan', icon: ScanLine },
        { path: '/dashboard/organizer/checkin', label: t('nav.checkIn') || 'Check In', icon: Users },
        { path: '/profile', label: t('nav.profile') || 'Profile', icon: User },
      ];
    }

    // Regular users — floating glass dock layout
    if (isStaffScanner) {
      return [
        { path: '/', label: t('nav.home') || 'Home', icon: Home },
        { path: '/events', label: t('nav.events') || 'Events', icon: Calendar },
        { path: '/scan', label: t('nav.scan') || 'Scan', icon: ScanLine, isCenter: true },
        { path: '/community', label: t('nav.community') || 'Community', icon: MessageCircle },
        { path: '/profile', label: t('nav.profile') || 'Profile', icon: User },
      ];
    }

    return [
      { path: '/', label: t('nav.home') || 'Home', icon: Home },
      { path: '/events', label: t('nav.events') || 'Events', icon: Calendar },
      { path: '/community', label: t('nav.community') || 'Community', icon: MessageCircle },
      { path: '/discovery', label: t('nav.discovery') || 'Discovery', icon: MapPin },
      { path: '/profile', label: t('nav.profile') || 'Profile', icon: User },
    ];
  }, [isBusiness, isArtist, isVendor, isAdmin, isStaffScanner, t]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    trigger('light');
    navigate(path);
  };

  // Dashboard roles use the existing anchored nav style
  const isDashboardRole = isBusiness || isArtist || isVendor || isAdmin;

  if (isDashboardRole) {
    return (
      <>
        <nav className="fixed bottom-0 left-0 right-0 z-50 mobile-bottom-nav">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#111111] to-[#111111]/95 border-t border-white/10" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d3da0c]/40 to-transparent" />
          <div className="relative flex items-end justify-around max-w-lg mx-auto px-2 pt-2 pb-safe">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              if (item.isCenter) {
                return (
                  <button
                    key={item.path + '-center'}
                    onClick={() => handleNavClick(item.path)}
                    className="relative -top-3 flex flex-col items-center group touch-feedback"
                    aria-label={item.label}
                  >
                    <div className="absolute inset-0 rounded-full bg-[#d3da0c]/20 blur-xl animate-pulse-slow" />
                    <div className="relative w-14 h-14 bg-gradient-to-br from-[#d3da0c] to-[#bbc10b] rounded-full flex items-center justify-center shadow-lg shadow-[#d3da0c]/20 border-4 border-[#0A0A0A]">
                      <Icon className="w-6 h-6 text-black" />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 mt-1">{item.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] rounded-xl touch-feedback ${
                    active ? 'text-[#d3da0c]' : 'text-gray-400'
                  }`}
                  aria-label={item.label}
                >
                  {active && (
                    <motion.div
                      layoutId="bottomNavPillDash"
                      className="absolute inset-0 bg-[#d3da0c]/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={`w-5 h-5 relative z-10 ${active ? 'scale-110' : ''}`} strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium mt-0.5 relative z-10 ${active ? 'text-[#d3da0c]' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                  {active && <div className="absolute -bottom-0.5 w-1 h-1 bg-[#d3da0c] rounded-full" />}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="h-20" />
      </>
    );
  }

  // Regular users — Floating Glass Dock
  return (
    <>
      <nav className="floating-nav">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className="relative flex flex-col items-center justify-center py-1 px-2 min-w-[52px]"
                aria-label={item.label}
              >
                {/* Active background */}
                {active && (
                  <motion.div
                    layoutId="floatingNavIndicator"
                    className="absolute inset-0 bg-[#d3da0c]/15 rounded-2xl border border-[#d3da0c]/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  />
                )}

                {/* Icon */}
                <motion.div
                  animate={active ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <Icon
                    className={`w-5 h-5 relative z-10 transition-colors duration-200 ${
                      active ? 'text-[#d3da0c]' : 'text-white/50'
                    }`}
                    strokeWidth={active ? 2.5 : 1.5}
                  />
                </motion.div>

                {/* Label */}
                <span
                  className={`text-[9px] font-medium mt-0.5 relative z-10 transition-colors duration-200 ${
                    active ? 'text-[#d3da0c]' : 'text-white/40'
                  }`}
                >
                  {item.label}
                </span>

                {/* Active dot */}
                {active && (
                  <motion.div
                    layoutId="floatingNavDot"
                    className="absolute -bottom-0.5 w-1 h-1 bg-[#d3da0c] rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Spacer for floating nav */}
      <div className="h-24" />
    </>
  );
};

export default MobileBottomNav;
