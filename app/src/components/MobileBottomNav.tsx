/**
 * Floating Mobile Bottom Navigation for PWA, iOS, and Android
 * - Floating pill / dock design detached from screen edges
 * - Dynamically expands when scrolling down, decreases to normal size when scrolling up
 * - Supports regular users, staff scanners, and role dashboards
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useStaffStore } from '@/store/staffStore';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '@/hooks/useHaptic';
import { useThemeStore } from '@/store/themeStore';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Calendar,
  MessageCircle,
  Compass,
  PlaySquare,
  ScanLine,
  LayoutDashboard,
  Wallet,
  Store,
  ShoppingBag,
  BarChart3,
  Users,
  Settings,
  Menu,
} from 'lucide-react';
import MoreMenuSheet from './MoreMenuSheet';

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
  const { isDark } = useThemeStore();
  const { fetchMemberships, canScan } = useStaffStore();
  const { t } = useTranslation();
  const { trigger } = useHaptic();

  const role = profile?.role_type || profile?.role;
  const isBusiness = role === 'business' || role === 'organizer';
  const isArtist = role === 'artist' || role === 'dj';
  const isVendor = role === 'vendor';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isStaffScanner = canScan();

  const isDashboardRoute =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/admin') ||
    ((isBusiness || isArtist || isVendor) && location.pathname.startsWith('/settings'));

  // Dynamic scroll state: expands on scroll down, decreases on scroll up to normal size
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleOpenMore = () => setShowMoreMenu(true);
    window.addEventListener('open-more-menu', handleOpenMore);
    return () => window.removeEventListener('open-more-menu', handleOpenMore);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY.current;

      // Filter micro-jitters
      if (Math.abs(diff) > 4) {
        if (diff > 0 && currentScrollY > 40) {
          // Scrolling down: expand
          setIsExpanded(true);
        } else if (diff < -5 || currentScrollY < 20) {
          // Scrolling up or at top: decrease to normal size
          setIsExpanded(false);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (profile) {
      fetchMemberships();
    }
  }, [profile, fetchMemberships]);

  const navItems = useMemo<NavItem[]>(() => {
    const pathname = location.pathname;
    const onBusinessRoute = pathname.startsWith('/dashboard/business') || pathname.startsWith('/dashboard/organizer');
    const onVendorRoute = pathname.startsWith('/dashboard/vendor');
    const onArtistRoute = pathname.startsWith('/dashboard/artist');

    // Role operational workspace inside dashboard / admin routes
    if (isDashboardRoute) {
      if (onBusinessRoute || (isBusiness && !onVendorRoute && !onArtistRoute)) {
        return [
          { path: '/dashboard/business', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
          { path: '/dashboard/business/events', label: t('nav.events', 'Events'), icon: Calendar },
          { path: '/dashboard/business/ticket-orders', label: 'Orders', icon: Wallet },
          { path: '/dashboard/business/analytics', label: 'Analytics', icon: BarChart3 },
          { path: '/settings', label: t('nav.settings', 'Settings'), icon: Settings },
        ];
      }

      if (onVendorRoute || (isVendor && !onBusinessRoute && !onArtistRoute)) {
        return [
          { path: '/dashboard/vendor', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
          { path: '/dashboard/vendor/products', label: 'My Products', icon: Store },
          { path: '/scan', label: t('nav.scan', 'Scan'), icon: ScanLine },
          { path: '/dashboard/vendor/orders', label: t('vendor.orders.navLabel', 'Orders'), icon: ShoppingBag },
          { path: '/settings', label: t('nav.settings', 'Settings'), icon: Settings },
        ];
      }

      if (onArtistRoute || isArtist) {
        return [
          { path: '/dashboard/artist', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
          { path: '/dashboard/artist/bookings', label: t('artist.bookings.title', 'Bookings'), icon: Calendar },
          { path: '/dashboard/artist/messages', label: t('nav.message', 'Messages'), icon: MessageCircle },
          { path: '/dashboard/artist/performances', label: t('artist.performances.title', 'Gigs'), icon: BarChart3 },
          { path: '/settings', label: t('nav.settings', 'Settings'), icon: Settings },
        ];
      }

      if (isAdmin) {
        return [
          { path: '/admin', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
          { path: '/admin/events', label: t('nav.events', 'Events'), icon: Calendar },
          { path: '/scan', label: t('nav.scan', 'Scan'), icon: ScanLine },
          { path: '/dashboard/organizer/checkin', label: t('nav.checkIn', 'Check In'), icon: Users },
          { path: '/admin/settings', label: t('nav.settings', 'Settings'), icon: Settings },
        ];
      }
    }

    // Platform routes (EXACTLY FIVE destinations: Home, Discover, Events, Recaps, More)
    return [
      { path: '/', label: 'Home', icon: Home },
      { path: '/discovery', label: 'Discover', icon: Compass },
      { path: '/events', label: 'Events', icon: Calendar },
      { path: '/recaps', label: 'Recaps', icon: PlaySquare },
      { path: '#more', label: 'More', icon: Menu },
    ];
  }, [location.pathname, isDashboardRoute, isBusiness, isArtist, isVendor, isAdmin, t]);

  const isActive = (path: string) => {
    if (path === '#more') {
      return showMoreMenu;
    }
    if (path === '/recaps') {
      return (
        location.pathname.startsWith('/recaps') ||
        location.pathname.startsWith('/reels') ||
        location.pathname.startsWith('/community')
      );
    }
    if (
      path === '/' ||
      path === '/dashboard/business' ||
      path === '/dashboard/artist' ||
      path === '/dashboard/vendor' ||
      path === '/admin'
    ) {
      return location.pathname === path;
    }
    if (path === '/settings' && location.pathname === '/dashboard/business/profile') {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    trigger('light');
    if (path === '#more') {
      setShowMoreMenu(true);
      return;
    }
    setShowMoreMenu(false);
    navigate(path);
  };

  // Focused form, checkout, edit, and detail screens with primary bottom CTA bars — hide tab bar
  const hideOnFocusedRoute =
    /^\/events\/[^/]+/.test(location.pathname) ||
    /^\/artists\/[^/]+/.test(location.pathname) ||
    location.pathname.startsWith('/checkout/') ||
    location.pathname === '/cart' ||
    location.pathname === '/profile/edit' ||
    location.pathname === '/get-verified' ||
    location.pathname === '/dashboard/business/create-event' ||
    /^\/dashboard\/business\/events\/[^/]+\/edit/.test(location.pathname) ||
    location.pathname === '/dashboard/vendor/menu-import' ||
    location.pathname === '/dashboard/vendor/payment-settings';

  // Hide bottom nav when mobile software keyboard is open (works with both overlay & resizes-content engines)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.keyboardOpen === 'true'
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncKeyboard = () => {
      const attrOpen = document.documentElement.dataset.keyboardOpen === 'true';
      const vv = window.visualViewport;
      const vvDiff = vv ? window.innerHeight - (vv.height + vv.offsetTop) : 0;
      setIsKeyboardVisible(attrOpen || vvDiff > 140);
    };
    syncKeyboard();
    window.addEventListener('soundit-keyboard-change', syncKeyboard);
    window.visualViewport?.addEventListener('resize', syncKeyboard);
    return () => {
      window.removeEventListener('soundit-keyboard-change', syncKeyboard);
      window.visualViewport?.removeEventListener('resize', syncKeyboard);
    };
  }, []);

  // Hide bottom nav whenever any modal, dialog, drawer, or bottom sheet is open
  const [hasModalOpen, setHasModalOpen] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkModal = () => {
      const isModal =
        Boolean(document.body.classList.contains('modal-open')) ||
        Boolean(document.querySelector('[data-modal-open="true"]')) ||
        Boolean(document.querySelector('[role="dialog"][data-state="open"]')) ||
        Boolean(document.querySelector('[role="alertdialog"][data-state="open"]')) ||
        Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')) ||
        Boolean(document.querySelector('[data-slot="dialog-content"]')) ||
        Boolean(document.querySelector('[data-slot="drawer-content"]')) ||
        Boolean(document.querySelector('[data-slot="sheet-content"]')) ||
        Boolean(document.querySelector('.fixed.inset-0.z-\\[80\\]')) ||
        Boolean(document.querySelector('.fixed.inset-0.z-\\[100\\]')) ||
        Boolean(document.querySelector('.fixed.inset-0.z-\\[100000\\]')) ||
        Boolean(document.querySelector('.fixed.inset-0.z-\\[9999\\]'));
      setHasModalOpen(isModal);
    };

    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-modal-open', 'data-state'],
    });

    window.addEventListener('modal-state-change', checkModal);
    return () => {
      observer.disconnect();
      window.removeEventListener('modal-state-change', checkModal);
    };
  }, []);

  const isHidden = hideOnFocusedRoute || isKeyboardVisible || hasModalOpen;
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Publish live rendered height to --bottom-nav-height CSS variable so all pages & sticky CTAs stay aligned
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isHidden) {
      root.style.setProperty('--bottom-nav-height', '0px');
      return;
    }

    const updateHeight = () => {
      const el = navContainerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        // Rendered pill height + 10px floating offset + 8px breathing gap
        const total = Math.ceil(rect.height + 18);
        root.style.setProperty('--bottom-nav-height', `${total}px`);
      } else {
        root.style.setProperty('--bottom-nav-height', '5.25rem');
      }
    };

    updateHeight();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    if (ro && navContainerRef.current) {
      ro.observe(navContainerRef.current);
    }
    return () => {
      ro?.disconnect();
      root.style.setProperty('--bottom-nav-height', '0px');
    };
  }, [isHidden, isExpanded]);

  if (isHidden) {
    return (
      <MoreMenuSheet
        isOpen={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
      />
    );
  }

  return (
    <>
      {/* Floating Bottom Nav Container for PWA, iOS, and Android (z-40: strictly above sticky CTAs z-35, strictly below drawers/modals z-60+) */}
      <div
        ref={navContainerRef}
        className="fixed left-0 right-0 z-40 flex items-center justify-center pointer-events-none px-3 sm:px-4"
        style={{
          bottom: 'calc(0.625rem + max(0.25rem, env(safe-area-inset-bottom, 0px)))',
        }}
      >
        <motion.nav
          initial={false}
          animate={{
            maxWidth: isExpanded ? 'min(94vw, 27.5rem)' : 'min(92vw, 24rem)',
            height: isExpanded ? '4.125rem' : '3.625rem',
            scale: isExpanded ? 1.02 : 1.0,
            boxShadow: isDark
              ? isExpanded
                ? '0 20px 48px -4px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(211, 218, 12, 0.2), inset 0 1px 0 rgba(211, 218, 12, 0.3)'
                : '0 14px 34px -4px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
              : isExpanded
                ? '0 20px 48px -4px rgba(0, 0, 0, 0.20), 0 0 0 1px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
                : '0 14px 34px -4px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 32,
          }}
          className="pointer-events-auto relative w-full flex items-center justify-between rounded-full border overflow-hidden transition-colors"
          style={{
            background: isDark
              ? 'rgba(7, 14, 4, 0.88)'
              : 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* Subtle top hairline highlight */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#d3da0c]/35 to-transparent pointer-events-none" />

          {/* Navigation Items */}
          <div className="relative flex items-center justify-around w-full h-full px-1.5 sm:px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              if (item.isCenter) {
                return (
                  <button
                    key={item.path + '-center'}
                    onClick={() => handleNavClick(item.path)}
                    className="relative flex flex-col items-center justify-center group touch-feedback px-1 -my-1"
                    aria-label={item.label}
                  >
                    <div className="absolute inset-0 rounded-full bg-[#d3da0c]/25 blur-md animate-pulse-slow" />
                    <motion.div
                      animate={{
                        scale: isExpanded ? 1.08 : 1.0,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="relative w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-[#d3da0c] to-[#b8be09] rounded-full flex items-center justify-center shadow-md shadow-[#d3da0c]/30 border-2 border-[#020b00] dark:border-[#020b00]"
                    >
                      <Icon className="w-5 h-5 text-black" strokeWidth={2.5} />
                    </motion.div>
                    <span className="text-[0.5625rem] font-semibold text-gray-500 dark:text-gray-300 mt-0.5 leading-none">
                      {item.label}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.path}
                  data-tour-path={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className="relative flex-1 flex flex-col items-center justify-center h-full py-1 rounded-full touch-feedback group min-w-0"
                  aria-label={item.label}
                >
                  {/* Active highlight background capsule pill */}
                  {active && (
                    <motion.div
                      layoutId="floating-nav-active-pill"
                      className="absolute inset-x-1 inset-y-1 bg-[#d3da0c]/15 dark:bg-[#d3da0c]/20 rounded-full border border-[#d3da0c]/30 pointer-events-none"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}

                  {/* Icon */}
                  <motion.div
                    animate={
                      active
                        ? { scale: isExpanded ? 1.15 : 1.1, y: -1 }
                        : { scale: 1, y: 0 }
                    }
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="relative z-10"
                  >
                    <Icon
                      className={`transition-colors duration-150 ${
                        isExpanded ? 'w-5 h-5' : 'w-[1.1875rem] h-[1.1875rem]'
                      } ${
                        active
                          ? 'text-[#020b00] dark:text-[#d3da0c]'
                          : 'text-[#020b00]/60 dark:text-white/45 group-hover:text-black dark:group-hover:text-white'
                      }`}
                      strokeWidth={active ? 2.5 : 1.9}
                    />
                  </motion.div>

                  {/* Label */}
                  <span
                    className={`relative z-10 text-[0.625rem] tracking-tight mt-0.5 leading-none truncate max-w-full px-0.5 transition-colors duration-150 ${
                      active
                        ? 'text-[#020b00] dark:text-[#d3da0c] font-semibold'
                        : 'text-[#020b00]/60 dark:text-white/45 font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.nav>
      </div>

      {/* Dynamic spacer matching rendered floating nav + safe area */}
      <div
        aria-hidden="true"
        className="pointer-events-none shrink-0"
        style={{ height: 'calc(var(--bottom-nav-height, 5.25rem) + env(safe-area-inset-bottom, 0px))' }}
      />

      {/* More Menu Sheet */}
      <MoreMenuSheet
        isOpen={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
      />
    </>
  );
};

export default MobileBottomNav;
