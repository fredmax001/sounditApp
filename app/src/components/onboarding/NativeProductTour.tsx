/**
 * NativeProductTour — Patterns #2 (Interactive Coach Marks) & #4 (Product Tour).
 *
 * STRICT PLATFORM GUARD: Runs ONLY inside native iOS / Android apps for first-time
 * eligible users (or when explicitly launched from the Getting Started Checklist).
 * Uses REAL screens, REAL navigation, and ONLY introduces features relevant to
 * the authenticated user's server-verified role & permissions.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import { isNativeMobileApp } from '@/lib/platform';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';

interface TourStep {
  id: string;
  targetPath: string;
  title: string;
  description: string;
  badge: string;
  navigateTo?: string;
}

export default function NativeProductTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, profile } = useAuthStore();
  const { data, tourActive, stopTour, saveProgress } = useOnboardingStore();
  const [stepIdx, setStepIdx] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const isNative = isNativeMobileApp();
  const role = String(profile?.role_type || profile?.role || 'user').toLowerCase();

  // Role-filtered real application features
  const steps = useMemo<TourStep[]>(() => {
    if (role === 'business' || role === 'organizer') {
      return [
        {
          id: 'coach_business_dashboard',
          targetPath: '/dashboard/business',
          badge: 'Organizer Hub',
          title: 'Your Command Center',
          description: 'Track ticket sales, live revenue, table reservations, and event status at a glance.',
          navigateTo: '/dashboard/business',
        },
        {
          id: 'coach_business_events',
          targetPath: '/dashboard/business/events',
          badge: 'Events',
          title: 'Create & Manage Events',
          description: 'Publish flyers, set up ticket tiers, manage promoters, and upload WeChat/Alipay QR codes.',
          navigateTo: '/dashboard/business/events',
        },
        {
          id: 'coach_business_orders',
          targetPath: '/dashboard/business/ticket-orders',
          badge: 'Orders',
          title: 'Verify Ticket Orders',
          description: 'Approve attendee payment proofs and issue instant QR tickets right from your phone.',
          navigateTo: '/dashboard/business/ticket-orders',
        },
        {
          id: 'coach_business_settings',
          targetPath: '/settings',
          badge: 'Profile & Settings',
          title: 'Brand Profile & Notifications',
          description: 'Customize your organizer profile, notification preferences, and staff permissions.',
        },
      ];
    }

    if (role === 'artist' || role === 'dj') {
      return [
        {
          id: 'coach_artist_dashboard',
          targetPath: '/dashboard/artist',
          badge: 'Artist Hub',
          title: 'Your Artist Studio',
          description: 'See upcoming bookings, fan engagement, and portfolio metrics in one view.',
          navigateTo: '/dashboard/artist',
        },
        {
          id: 'coach_artist_bookings',
          targetPath: '/dashboard/artist/bookings',
          badge: 'Bookings',
          title: 'Manage Gig Requests',
          description: 'Accept or decline event inquiries, verify deposits, and track confirmed gigs.',
          navigateTo: '/dashboard/artist/bookings',
        },
        {
          id: 'coach_artist_messages',
          targetPath: '/dashboard/artist/messages',
          badge: 'Messages',
          title: 'Direct Organizer Chat',
          description: 'Coordinate set times, riders, and event details directly with organizers.',
          navigateTo: '/dashboard/artist/messages',
        },
        {
          id: 'coach_artist_gigs',
          targetPath: '/dashboard/artist/performances',
          badge: 'Performances',
          title: 'Performance Schedule & Media',
          description: 'Keep your upcoming gig calendar and recap clips up to date for fans.',
        },
      ];
    }

    if (role === 'vendor') {
      return [
        {
          id: 'coach_vendor_dashboard',
          targetPath: '/dashboard/vendor',
          badge: 'Vendor Hub',
          title: 'Storefront Overview',
          description: 'Monitor incoming customer orders, booth bookings, and daily revenue.',
          navigateTo: '/dashboard/vendor',
        },
        {
          id: 'coach_vendor_products',
          targetPath: '/dashboard/vendor/products',
          badge: 'My Products',
          title: 'Catalog & Services',
          description: 'Add your menu items, photos, and pricing so event-goers can order anytime.',
          navigateTo: '/dashboard/vendor/products',
        },
        {
          id: 'coach_vendor_orders',
          targetPath: '/dashboard/vendor/orders',
          badge: 'Orders',
          title: 'Live Order Fulfillment',
          description: 'Confirm payments and track order status in real time.',
          navigateTo: '/dashboard/vendor/orders',
        },
      ];
    }

    // Regular user features
    return [
      {
        id: 'coach_discover',
        targetPath: '/discovery',
        badge: 'Discover',
        title: 'Explore Your City',
        description: 'Find clubs, lounges, African & international restaurants, DJs, and curated city guides.',
        navigateTo: '/discovery',
      },
      {
        id: 'coach_events',
        targetPath: '/events',
        badge: 'Events',
        title: 'Tickets & Nightlife',
        description: 'Browse upcoming parties, concerts, and festivals—then grab instant QR tickets.',
        navigateTo: '/events',
      },
      {
        id: 'coach_recaps',
        targetPath: '/recaps',
        badge: 'Recaps & Feed',
        title: 'Community & Event Recaps',
        description: 'Watch vertical highlight reels, share event memories, and interact with the crowd.',
        navigateTo: '/recaps',
      },
      {
        id: 'coach_home',
        targetPath: '/',
        badge: 'Home & Profile',
        title: 'Personalized For You',
        description: 'Your feed adapts to your selected interests—tap your avatar anytime to manage tickets & alerts.',
        navigateTo: '/',
      },
    ];
  }, [role]);

  const activeStep = steps[stepIdx];

  // Locate the real DOM button in MobileBottomNav matching activeStep.targetPath
  useEffect(() => {
    if (!isNative || !tourActive || !activeStep) {
      setHighlightRect(null);
      return;
    }

    const measure = () => {
      const el = document.querySelector(`[data-tour-path="${activeStep.targetPath}"]`);
      if (el) {
        setHighlightRect(el.getBoundingClientRect());
      } else {
        setHighlightRect(null);
      }
    };

    const t = window.setTimeout(measure, 180);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [isNative, tourActive, activeStep, location.pathname]);

  if (!isNative || !isAuthenticated || !tourActive || !activeStep) return null;

  const finishTour = async () => {
    const allIds = steps.map((s) => s.id);
    stopTour();
    setStepIdx(0);
    await saveProgress({ coach_marks_seen: allIds, tour_completed: true });
  };

  const handleNext = async () => {
    await saveProgress({ coach_marks_seen: [activeStep.id] });
    if (stepIdx < steps.length - 1) {
      const nextStep = steps[stepIdx + 1];
      setStepIdx(stepIdx + 1);
      if (nextStep.navigateTo && location.pathname !== nextStep.navigateTo) {
        navigate(nextStep.navigateTo);
      }
    } else {
      await finishTour();
    }
  };

  const handlePrev = () => {
    if (stepIdx > 0) {
      const prevStep = steps[stepIdx - 1];
      setStepIdx(stepIdx - 1);
      if (prevStep.navigateTo && location.pathname !== prevStep.navigateTo) {
        navigate(prevStep.navigateTo);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[92] pointer-events-auto">
        {/* Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={finishTour}
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        />

        {/* Real-Element Spotlight Ring */}
        {highlightRect && (
          <motion.div
            layout
            className="fixed rounded-full border-2 border-[#d3da0c] shadow-[0_0_0_6px_rgba(211,218,12,0.22),0_0_30px_rgba(211,218,12,0.5)] pointer-events-none"
            style={{
              left: highlightRect.left - 4,
              top: highlightRect.top - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
            }}
          />
        )}

        {/* Contextual Coach Mark Card positioned cleanly above the bottom nav */}
        <motion.div
          key={activeStep.id}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          className="fixed inset-x-4 max-w-md mx-auto rounded-3xl bg-[#071305] border border-[#d3da0c]/50 p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
          style={{
            bottom: 'calc(var(--bottom-nav-height, 5.25rem) + env(safe-area-inset-bottom, 0px) + 1.25rem)',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 text-[#d3da0c] text-[0.6875rem] font-extrabold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              {activeStep.badge} · {stepIdx + 1}/{steps.length}
            </span>
            <button
              type="button"
              onClick={finishTour}
              aria-label="Skip tour"
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base font-extrabold text-white">{activeStep.title}</h3>
          <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">{activeStep.description}</p>

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={stepIdx === 0 ? finishTour : handlePrev}
              className="px-[1em] py-[0.55em] rounded-full bg-white/10 text-xs font-bold text-gray-200 flex items-center gap-1"
            >
              {stepIdx === 0 ? (
                'Skip'
              ) : (
                <>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === stepIdx ? 'w-5 bg-[#d3da0c]' : 'w-1.5 bg-white/25'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="px-[1.15em] py-[0.55em] rounded-full bg-[#d3da0c] text-black text-xs font-extrabold flex items-center gap-1 shadow-md shadow-[#d3da0c]/25"
            >
              {stepIdx === steps.length - 1 ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
