/**
 * Mobile Bottom Navigation — Eventix-inspired 5-tab dock
 * Clean flat bar: Home | Discover | Ticket | Saved | Profile
 * Dashboard roles retain their own nav sets.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useStaffStore } from '@/store/staffStore';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '@/hooks/useHaptic';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Calendar,
  MessageCircle,
  Compass,
  User,
  ScanLine,
  LayoutDashboard,
  Ticket,
  Store,
  ShoppingBag,
  BarChart3,
  Bookmark,
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
        { path: '/dashboard/artist/messages', label: t('nav.message') || 'Messages', icon: MessageCircle },
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

    if (isStaffScanner) {
      return [
        { path: '/', label: t('nav.home') || 'Home', icon: Home },
        { path: '/events', label: t('nav.events') || 'Events', icon: Calendar },
        { path: '/scan', label: t('nav.scan') || 'Scan', icon: ScanLine, isCenter: true },
        { path: '/community', label: t('nav.community') || 'Community', icon: MessageCircle },
        { path: '/profile', label: t('nav.profile') || 'Profile', icon: User },
      ];
    }

    // Regular users — Eventix-style: Home | Discover | Tickets | Saved | Profile
    return [
      { path: '/', label: t('nav.home') || 'Home', icon: Home },
      { path: '/discovery', label: t('nav.discovery') || 'Discover', icon: Compass },
      { path: '/tickets', label: t('nav.myTickets') || 'Ticket', icon: Ticket },
      { path: '/favorites', label: t('nav.favorites') || 'Saved', icon: Bookmark },
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

  const isDashboardRole = isBusiness || isArtist || isVendor || isAdmin;

  /* ── Dashboard roles: anchored bottom bar ── */
  if (isDashboardRole) {
    return (
      <>
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#111111] to-[#111111]/95 border-t border-white/10" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d3da0c]/30 to-transparent" />
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
                    active ? 'text-[#d3da0c]' : 'text-gray-500'
                  }`}
                  aria-label={item.label}
                >
                  <Icon className={`w-5 h-5 relative z-10 transition-all ${active ? 'scale-110 mb-0.5' : ''}`} strokeWidth={active ? 2.5 : 2} />
                  {active && (
                    <span className="text-[10px] font-medium mt-0.5 relative z-10 text-[#d3da0c]">
                      {item.label}
                    </span>
                  )}
                  {active && <div className="absolute -bottom-1.5 w-1 h-1 bg-[#d3da0c] rounded-full" />}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="h-20" />
      </>
    );
  }

  /* ── Regular users — Eventix-style flat bottom bar ── */
  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        />
        {/* Lime accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d3da0c]/25 to-transparent" />

        <div className="relative flex items-center justify-around max-w-lg mx-auto pb-safe">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className="relative flex flex-col items-center justify-center flex-1 py-3 min-h-[56px] touch-feedback"
                aria-label={item.label}
              >
                {/* Active indicator pill behind icon */}
                {active && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-8 rounded-xl bg-[#d3da0c]/12"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Icon */}
                <motion.div
                  animate={active ? { scale: 1.1, y: -1 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors duration-150 ${
                      active ? 'text-[#d3da0c]' : 'text-white/35'
                    }`}
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                </motion.div>

                {/* Label — always visible */}
                <span
                  className={`text-[10px] font-medium mt-1 transition-colors duration-150 ${
                    active ? 'text-[#d3da0c]' : 'text-white/35'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Spacer */}
      <div className="h-20" />
    </>
  );
};

export default MobileBottomNav;
