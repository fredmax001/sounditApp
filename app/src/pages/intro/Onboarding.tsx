import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  User,
  Store,
  Bell,
  Music2,
  MapPin,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Check,
  Loader2,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { chinaCities } from '@/data/constants';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { NativePush } from '@/lib/nativePush';
import { isNativeMobileApp } from '@/lib/platform';
import { toast } from 'sonner';

export const ONBOARDING_COMPLETED_KEY = 'soundit_onboarding_completed';

const INTEREST_OPTIONS = [
  { id: 'afrobeats', label: 'Afrobeats' },
  { id: 'hip_hop', label: 'Hip-Hop' },
  { id: 'amapiano', label: 'Amapiano' },
  { id: 'rnb', label: 'R&B & Soul' },
  { id: 'djs', label: 'DJs & Sets' },
  { id: 'live_music', label: 'Live Music' },
  { id: 'nightlife', label: 'Nightlife & Clubs' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'restaurants', label: 'Food & Restaurants' },
  { id: 'venues', label: 'Lounges & Venues' },
  { id: 'artists', label: 'Artists & Performers' },
  { id: 'culture', label: 'Culture & Community' },
];

interface OnboardingProps {
  onComplete?: () => void;
}

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'setup' ? 'setup' : 'carousel';
  const stepParam = parseInt(searchParams.get('step') || '0', 10);

  const { profile, isAuthenticated } = useAuthStore();
  const { data: obData, fetchState, saveProgress, completeOnboarding, startTour, isSaving } = useOnboardingStore();

  const maxCarouselStep = 3; // 4-slide welcome carousel (0..3)
  const maxWizardStep = 2; // 3-step setup wizard (0: City, 1: Interests, 2: Permissions)

  const initialStep =
    !isNaN(stepParam) && stepParam >= 0 && stepParam <= (mode === 'setup' ? maxWizardStep : maxCarouselStep)
      ? stepParam
      : mode === 'setup'
      ? Math.min(maxWizardStep, obData.current_step || 0)
      : 0;

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'user' | 'business' | 'vendor' | 'artist' | null>(null);

  // Setup Wizard State (auto-saved & resumable)
  const [selectedCity, setSelectedCity] = useState<string>(
    obData.preferred_city || (profile?.city?.name ? profile.city.name : '')
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(obData.selected_interests || []);
  const [permBusy, setPermBusy] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Preload existing artwork for instantaneous transitions
  useEffect(() => {
    const img1 = new Image();
    img1.src = '/onboarding/screen2-woman.png';
    const img2 = new Image();
    img2.src = '/onboarding/screen3-event.png';
  }, []);

  // Hydrate persisted backend state when in setup mode
  useEffect(() => {
    if (mode === 'setup' && isAuthenticated && isNativeMobileApp()) {
      fetchState(profile?.id).then((state) => {
        if (!state) return;
        if (state.completed && !searchParams.get('step')) {
          navigate(getRoleHomePath(), { replace: true });
          return;
        }
        if (state.preferred_city) setSelectedCity(state.preferred_city);
        if (state.selected_interests?.length) setSelectedInterests(state.selected_interests);
        if (!searchParams.get('step') && state.current_step > 0 && state.current_step <= maxWizardStep) {
          setCurrentStep(state.current_step);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isAuthenticated]);

  const getRoleHomePath = () => {
    const role = String(profile?.role_type || profile?.role || 'user').toLowerCase();
    if (role === 'business' || role === 'organizer') return '/dashboard/business';
    if (role === 'artist' || role === 'dj') return '/dashboard/artist';
    if (role === 'vendor') return '/dashboard/vendor';
    return '/';
  };

  const handleFinishCarousel = (targetPath: string = '/login') => {
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (e) {
      console.warn('Failed to save onboarding completion state:', e);
    }
    if (onComplete) {
      onComplete();
    } else {
      navigate(targetPath);
    }
  };

  const handleNext = () => {
    if (currentStep < maxCarouselStep) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    } else {
      if (selectedRole) {
        handleFinishCarousel(`/register?role=${selectedRole}`);
      } else {
        handleFinishCarousel('/register');
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleDotClick = (index: number) => {
    setDirection(index > currentStep ? 1 : -1);
    setCurrentStep(index);
  };

  const handleSelectRoleAndProceed = (role: 'user' | 'business' | 'vendor' | 'artist') => {
    setSelectedRole(role);
    handleFinishCarousel(`/register?role=${role}`);
  };

  // ==================== SETUP WIZARD HANDLERS ====================

  const toggleInterest = (id: string) => {
    setValidationError(null);
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleWizardNext = async () => {
    setValidationError(null);

    if (currentStep === 0) {
      if (!selectedCity.trim()) {
        setValidationError('Please select your primary city to tailor nearby events.');
        return;
      }
      await saveProgress({ preferred_city: selectedCity.trim(), current_step: 1 });
      setDirection(1);
      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      if (selectedInterests.length === 0) {
        setValidationError('Pick at least one interest so we can personalize your discovery feed.');
        return;
      }
      await saveProgress({ selected_interests: selectedInterests, current_step: 2 });
      setDirection(1);
      setCurrentStep(2);
      return;
    }

    // Final step -> complete onboarding persistently in backend
    await completeOnboarding({
      selected_interests: selectedInterests,
      preferred_city: selectedCity.trim() || undefined,
      skipped: false,
    });
    toast.success('Welcome to Sound It! Your experience is personalized.');
    const target = getRoleHomePath();
    navigate(target, { replace: true });
    // Offer contextual interactive coach marks tour on real screens
    if (!obData.tour_completed) {
      window.setTimeout(() => startTour(), 650);
    }
  };

  const handleWizardBack = async () => {
    setValidationError(null);
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setDirection(-1);
      setCurrentStep(prevStep);
      saveProgress({ current_step: prevStep }).catch(() => {});
    }
  };

  const handleSkipWizard = async () => {
    await completeOnboarding({
      selected_interests: selectedInterests.length ? selectedInterests : undefined,
      preferred_city: selectedCity.trim() || undefined,
      skipped: true,
    });
    navigate(getRoleHomePath(), { replace: true });
  };

  // Permission Priming (never re-prompts after decline)
  const requestPrimedPermission = async (perm: 'notifications' | 'location' | 'camera' | 'photos') => {
    if (obData.permissions_prompted[perm] === 'denied') {
      toast.info('You previously declined this permission. You can enable it anytime in your device Settings.');
      return;
    }
    setPermBusy(perm);
    try {
      let result: 'granted' | 'denied' | 'unsupported' = 'denied';

      if (perm === 'notifications') {
        const ok = await NativePush.enable();
        result = ok ? 'granted' : 'denied';
      } else if (perm === 'location') {
        if ('geolocation' in navigator) {
          result = await new Promise<'granted' | 'denied'>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve('granted'),
              () => resolve('denied'),
              { timeout: 8000 }
            );
          });
        } else {
          result = 'unsupported';
        }
      } else if (perm === 'camera' || perm === 'photos') {
        try {
          const status = await CapacitorCamera.requestPermissions({
            permissions: [perm === 'camera' ? 'camera' : 'photos'],
          });
          const val = perm === 'camera' ? status.camera : status.photos;
          result = val === 'granted' || val === 'limited' ? 'granted' : 'denied';
        } catch {
          result = 'denied';
        }
      }

      await saveProgress({ permissions_prompted: { [perm]: result } });
      if (result === 'granted') {
        toast.success(`${perm.charAt(0).toUpperCase() + perm.slice(1)} access enabled`);
      } else {
        toast.info('No problem — you can change permissions anytime in device Settings.');
      }
    } finally {
      setPermBusy(null);
    }
  };

  // Touch Swipe Gesture detection (Welcome Carousel mode)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (mode === 'setup') return;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (mode === 'setup') return;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (mode === 'setup' || !touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance && currentStep < maxCarouselStep) {
      handleNext();
    } else if (distance < -minSwipeDistance && currentStep > 0) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 320, damping: 32 },
        opacity: { duration: 0.25 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: {
        x: { type: 'spring' as const, stiffness: 320, damping: 32 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  // ==================== RENDER SETUP WIZARD MODE (POST-REGISTRATION NATIVE ONLY) ====================
  if (mode === 'setup') {
    const progressPercent = Math.round(((currentStep + 1) / (maxWizardStep + 1)) * 100);
    const permsConfig: {
      id: 'notifications' | 'location' | 'camera' | 'photos';
      title: string;
      reason: string;
      icon: typeof Bell;
    }[] = [
      {
        id: 'notifications',
        title: 'Notifications',
        reason: 'Instant alerts for ticket approvals, event invitations, messages, and artist drops.',
        icon: Bell,
      },
      {
        id: 'location',
        title: 'Location',
        reason: 'Discover nearby nightlife, live events, clubs, and African & international restaurants.',
        icon: MapPin,
      },
      {
        id: 'camera',
        title: 'Camera',
        reason: 'Capture live event moments, reels, and scan QR tickets effortlessly.',
        icon: Camera,
      },
      {
        id: 'photos',
        title: 'Photos & Media',
        reason: 'Upload flyers, profile photos, recaps, and portfolio highlights.',
        icon: ImageIcon,
      },
    ];

    return (
      <div
        className="fixed inset-0 z-[80] flex flex-col justify-between bg-[#020b00] text-white overflow-y-auto font-['Inter',sans-serif]"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Top Bar with Progress */}
        <header className="px-5 pt-2 pb-3 space-y-3 shrink-0 max-w-md w-full mx-auto">
          <div className="flex items-center justify-between">
            <img
              src="/intro_sound.png"
              alt="Sound It"
              className="h-5 w-auto object-contain drop-shadow-[0_0_12px_rgba(211,218,12,0.5)]"
            />
            <button
              type="button"
              onClick={handleSkipWizard}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/80"
            >
              Skip for now
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[0.6875rem] font-bold text-neutral-400">
              <span>Step {currentStep + 1} of {maxWizardStep + 1}</span>
              <span className="text-[#d3da0c]">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#d3da0c] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </header>

        {/* Main Wizard Step Area */}
        <div className="flex-1 overflow-y-auto px-5 py-2 max-w-md w-full mx-auto">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {currentStep === 0 && (
              <motion.div
                key="wiz-city"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#d3da0c]/40 bg-[#d3da0c]/10 text-[#d3da0c] text-[0.6875rem] font-bold uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" /> Your City
                  </span>
                  <h1 className="text-2xl font-extrabold tracking-tight">Where are you exploring?</h1>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Choose your main city so we surface local events, DJs, venues, and food spots first.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {chinaCities.map((city) => {
                    const active = selectedCity.toLowerCase() === city.name.toLowerCase();
                    return (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          setSelectedCity(city.name);
                          setValidationError(null);
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                          active
                            ? 'bg-[#d3da0c] text-black border-[#d3da0c] font-extrabold shadow-md shadow-[#d3da0c]/25'
                            : 'bg-[#081304] text-white border-white/10 hover:border-[#d3da0c]/40 font-semibold'
                        }`}
                      >
                        <span className="text-sm truncate">{city.name}</span>
                        {active && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="wiz-interests"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#d3da0c]/40 bg-[#d3da0c]/10 text-[#d3da0c] text-[0.6875rem] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> Personalize Feed
                  </span>
                  <h1 className="text-2xl font-extrabold tracking-tight">What vibes do you love?</h1>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Pick your favorite genres and categories to power personalized recommendations.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {INTEREST_OPTIONS.map((item) => {
                    const active = selectedInterests.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleInterest(item.id)}
                        className={`px-[1.1em] py-[0.65em] rounded-full text-xs sm:text-sm font-bold border transition-all flex items-center gap-1.5 ${
                          active
                            ? 'bg-[#d3da0c] text-black border-[#d3da0c] shadow-sm shadow-[#d3da0c]/30'
                            : 'bg-[#081304] text-neutral-200 border-white/15 hover:border-[#d3da0c]/50'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="wiz-perms"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#d3da0c]/40 bg-[#d3da0c]/10 text-[#d3da0c] text-[0.6875rem] font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" /> App Permissions
                  </span>
                  <h1 className="text-2xl font-extrabold tracking-tight">Get the full experience</h1>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    Choose which optional permissions to enable now. We never ask again if you decline.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {permsConfig.map((p) => {
                    const Icon = p.icon;
                    const status = obData.permissions_prompted[p.id];
                    const granted = status === 'granted';
                    const declined = status === 'denied';
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-2xl bg-[#081304] border border-white/10 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{p.title}</p>
                          <p className="text-[0.6875rem] text-neutral-400 leading-snug mt-0.5">{p.reason}</p>
                        </div>
                        <button
                          type="button"
                          disabled={granted || declined || permBusy === p.id}
                          onClick={() => requestPrimedPermission(p.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 transition-all ${
                            granted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : declined
                              ? 'bg-white/5 text-neutral-500 border border-white/10'
                              : 'bg-[#d3da0c] text-black hover:brightness-105'
                          }`}
                        >
                          {permBusy === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : granted ? (
                            'Enabled'
                          ) : declined ? (
                            'Declined'
                          ) : (
                            'Allow'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {validationError && (
            <p className="mt-4 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5">
              {validationError}
            </p>
          )}
        </div>

        {/* Sticky Wizard Footer: Back & Continue */}
        <footer className="px-5 pt-3 max-w-md w-full mx-auto shrink-0">
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleWizardBack}
                disabled={isSaving}
                className="h-[3.25rem] px-5 rounded-full bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-1.5 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleWizardNext}
              disabled={isSaving}
              className="flex-1 h-[3.25rem] rounded-full bg-[#d3da0c] text-black font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{currentStep === maxWizardStep ? 'Start Exploring' : 'Continue'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // ==================== RENDER ENHANCED 4-SLIDE WELCOME CAROUSEL (EXISTING DESIGN PRESERVED) ====================
  const renderDots = () => (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3].map((idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => handleDotClick(idx)}
          aria-label={`Go to slide ${idx + 1}`}
          className={`h-2 rounded-full transition-all cursor-pointer ${
            currentStep === idx
              ? 'w-6 bg-[#d3da0c] shadow-[0_0_8px_rgba(211,218,12,0.8)]'
              : 'w-2 bg-neutral-600'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-between bg-[#020b00] text-white select-none overflow-hidden font-['Inter',sans-serif]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Top Header Bar: Sound It Wordmark + Skip Button */}
      <header className="relative z-20 flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-2">
          <img
            src="/intro_sound.png"
            alt="Sound It"
            className="h-6 w-auto object-contain drop-shadow-[0_0_12px_rgba(211,218,12,0.5)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleFinishCarousel('/')}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 backdrop-blur-md text-xs font-semibold text-white/80 hover:text-white transition-all shadow-md cursor-pointer"
          >
            <span>Skip</span>
          </button>
        </div>
      </header>

      {/* Main Slide Carousel Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          {/* ==================== SLIDE 1: DISCOVER & CONNECT (EXISTING) ==================== */}
          {currentStep === 0 && (
            <motion.div
              key="screen-1"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md mx-auto flex flex-col justify-between h-full px-5 pb-3"
            >
              <div className="relative w-full h-[50dvh] max-h-[26.25rem] rounded-3xl overflow-hidden bg-black/60 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
                <img
                  src="/onboarding/screen2-woman.png"
                  alt="Discover & Connect on Sound It"
                  className="w-full h-full object-cover object-top"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(2,11,0,0.3) 0%, rgba(2,11,0,0) 30%, rgba(2,11,0,0.4) 70%, #020b00 100%)',
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, transparent 65%, rgba(2,11,0,0.6) 100%)',
                  }}
                />
              </div>

              <div className="flex-1 flex flex-col justify-center text-center px-2 py-3">
                <h1 className="font-['Inter',sans-serif] text-2xl sm:text-[1.75rem] font-extrabold leading-tight tracking-tight text-white uppercase">
                  DISCOVER. <span className="text-[#d3da0c]">CONNECT.</span>
                  <br />
                  EXPERIENCE.
                </h1>
                <p className="mt-2.5 text-xs sm:text-sm font-light text-neutral-300 leading-relaxed max-w-[20rem] mx-auto">
                  Explore events, discover DJs and artists, connect with entertainment businesses
                  and find exciting experiences around you.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                {renderDots()}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-[3.25rem] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ==================== SLIDE 2: EVENTS & COMMUNITY (EXISTING) ==================== */}
          {currentStep === 1 && (
            <motion.div
              key="screen-2"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md mx-auto flex flex-col justify-between h-full px-5 pb-3"
            >
              <div className="relative w-full h-[50dvh] max-h-[26.25rem] rounded-3xl overflow-hidden bg-black/60 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
                <img
                  src="/onboarding/screen3-event.png"
                  alt="African events and community in China"
                  className="w-full h-full object-cover object-top"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(2,11,0,0.3) 0%, rgba(2,11,0,0) 30%, rgba(2,11,0,0.4) 70%, #020b00 100%)',
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse at center, transparent 65%, rgba(2,11,0,0.6) 100%)',
                  }}
                />
              </div>

              <div className="flex-1 flex flex-col justify-center text-center px-2 py-3">
                <h1 className="font-['Inter',sans-serif] text-2xl sm:text-[1.75rem] font-extrabold leading-tight tracking-tight text-white uppercase">
                  YOUR EXPERIENCE
                  <br />
                  <span className="text-[#d3da0c]">STARTS HERE.</span>
                </h1>
                <p className="mt-2.5 text-xs sm:text-sm font-light text-neutral-300 leading-relaxed max-w-[20rem] mx-auto">
                  Discover African events in China, connect with the community, enjoy unforgettable
                  experiences and become part of the Sound It movement.
                </p>
              </div>

              <div className="space-y-4 pt-1">
                {renderDots()}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="h-[3.25rem] px-5 rounded-full bg-white/10 text-white font-bold text-sm flex items-center justify-center"
                    aria-label="Previous slide"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 h-[3.25rem] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== SLIDE 3: LIVE RECAPS, TICKETS & SMART ALERTS (NEW VALUE SLIDE) ==================== */}
          {currentStep === 2 && (
            <motion.div
              key="screen-3-value"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md mx-auto flex flex-col justify-between h-full px-5 pb-3"
            >
              <div className="flex-1 flex flex-col justify-center space-y-3 py-4">
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#d3da0c] text-[#d3da0c] text-[0.6875rem] font-bold tracking-wider uppercase mx-auto mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>BUILT FOR THE CULTURE</span>
                  </div>
                  <h1 className="font-['Inter',sans-serif] text-2xl sm:text-[1.75rem] font-extrabold leading-tight tracking-tight text-white uppercase">
                    NEVER MISS A <span className="text-[#d3da0c]">BEAT.</span>
                  </h1>
                </div>

                {[
                  {
                    icon: Compass,
                    title: 'Tailored Discovery',
                    desc: 'Events, clubs, DJs, and restaurants personalized to your city and music taste.',
                  },
                  {
                    icon: Bell,
                    title: 'Smart Real-Time Alerts',
                    desc: 'Instant updates on ticket approvals, artist bookings, messages, and event drops.',
                  },
                  {
                    icon: Music2,
                    title: 'Live Recaps & Direct Bookings',
                    desc: 'Relive the night through reels, book top DJs, or grow your own event brand.',
                  },
                ].map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="p-4 rounded-2xl bg-[#081304]/90 border border-white/10 flex items-start gap-3.5"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#d3da0c]/15 border border-[#d3da0c]/40 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-[#d3da0c]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-white">{feature.title}</h3>
                        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4 pt-1">
                {renderDots()}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="h-[3.25rem] px-5 rounded-full bg-white/10 text-white font-bold text-sm flex items-center justify-center"
                    aria-label="Previous slide"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 h-[3.25rem] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== SLIDE 4: CHOOSE YOUR ROLE (EXISTING) ==================== */}
          {currentStep === 3 && (
            <motion.div
              key="screen-4"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md mx-auto flex flex-col justify-between h-full px-5 pb-3"
            >
              <div className="text-center pt-1">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#d3da0c] text-[#d3da0c] text-[0.6875rem] font-bold tracking-wider uppercase mx-auto mb-2.5">
                  <User className="w-3.5 h-3.5" />
                  <span>CHOOSE YOUR ROLE</span>
                </div>
                <h1 className="font-['Inter',sans-serif] text-2xl sm:text-[1.625rem] font-extrabold leading-tight tracking-tight text-white uppercase">
                  JOIN THE SOUND IT
                  <br />
                  <span className="text-[#d3da0c]">COMMUNITY</span>
                </h1>
                <p className="mt-1.5 text-xs font-light text-neutral-300 leading-relaxed max-w-[20rem] mx-auto">
                  Whatever your role in the entertainment space, Sound It has a place for you.
                </p>
              </div>

              <div className="space-y-2.5 my-auto py-2">
                {[
                  { id: 'user' as const, title: 'User', desc: 'Discover events and buy tickets', icon: User, accent: 'border-[#d3da0c] text-[#d3da0c] bg-transparent' },
                  { id: 'business' as const, title: 'Business', desc: 'Bar, Club, or Event Organizer', icon: Store, accent: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
                  { id: 'vendor' as const, title: 'Vendor', desc: 'Food, drink & service providers', icon: Bell, accent: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' },
                  { id: 'artist' as const, title: 'Artist / DJ', desc: 'Performers & creators', icon: Music2, accent: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
                ].map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRoleAndProceed(r.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#081304]/90 border transition-all text-left group cursor-pointer ${
                        selectedRole === r.id
                          ? 'border-[#d3da0c] shadow-[0_0_18px_rgba(211,218,12,0.35)]'
                          : 'border-white/10 hover:border-[#d3da0c]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${r.accent}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-['Inter',sans-serif] font-bold text-sm sm:text-base text-white">
                            {r.title}
                          </h3>
                          <p className="font-['Inter',sans-serif] font-light text-xs text-neutral-400 mt-0.5 truncate">
                            {r.desc}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4 pt-1">
                {renderDots()}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-[3.25rem] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>

                <div className="flex items-center justify-center gap-4 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleFinishCarousel('/')}
                    className="text-neutral-300 hover:text-[#d3da0c] font-semibold transition-colors cursor-pointer"
                  >
                    Explore Platform First
                  </button>
                  <span className="text-neutral-600">•</span>
                  <button
                    type="button"
                    onClick={() => handleFinishCarousel('/login')}
                    className="text-[#d3da0c] font-bold hover:underline transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
