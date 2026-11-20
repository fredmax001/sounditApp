import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  User,
  Store,
  Bell,
  Music2,
} from 'lucide-react';

export const ONBOARDING_COMPLETED_KEY = 'soundit_onboarding_completed';

interface OnboardingProps {
  onComplete?: () => void;
}

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stepParam = parseInt(searchParams.get('step') || '0', 10);
  const initialStep = !isNaN(stepParam) && stepParam >= 0 && stepParam <= 2 ? stepParam : 0;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'user' | 'business' | 'vendor' | 'artist' | null>(null);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Preload images for instantaneous transitions
  useEffect(() => {
    const img1 = new Image();
    img1.src = '/onboarding/screen2-woman.png';
    const img2 = new Image();
    img2.src = '/onboarding/screen3-event.png';
  }, []);

  const handleFinish = (targetPath: string = '/login') => {
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
    if (currentStep < 2) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    } else {
      // Step 2 (Choose your role) -> go to register with selected role, or login
      if (selectedRole) {
        handleFinish(`/register?role=${selectedRole}`);
      } else {
        handleFinish('/register');
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
    handleFinish(`/register?role=${role}`);
  };

  // Touch Swipe Gesture detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance && currentStep < 2) {
      handleNext();
    } else if (distance < -minSwipeDistance && currentStep > 0) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Slide Animation Variants
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
        opacity: { duration: 0.28 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: {
        x: { type: 'spring' as const, stiffness: 320, damping: 32 },
        opacity: { duration: 0.22 },
      },
    }),
  };

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
            onClick={() => handleFinish('/')}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 backdrop-blur-md text-xs font-semibold text-white/80 hover:text-white transition-all shadow-md cursor-pointer"
          >
            <span>Skip</span>
          </button>
        </div>
      </header>

      {/* Main Slide Carousel Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          {/* ==================== ONBOARD ONE: DISCOVER & CONNECT ==================== */}
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
              {/* Upper Hero Image: African Woman Browsing Smartphone */}
              <div className="relative w-full h-[50dvh] max-h-[420px] rounded-3xl overflow-hidden bg-black/60 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
                <img
                  src="/onboarding/screen2-woman.png"
                  alt="Discover & Connect on Sound It"
                  className="w-full h-full object-cover object-top"
                />
                {/* Smooth top and bottom vignettes */}
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

              {/* Text & Headlines */}
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

              {/* Bottom Pagination & Next Button */}
              <div className="space-y-4 pt-1">
                {/* 3 Pagination Dots */}
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#d3da0c] shadow-[0_0_8px_rgba(211,218,12,0.8)]" />
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-[52px] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ==================== ONBOARD TWO: EVENTS & COMMUNITY ==================== */}
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
              {/* Upper Hero Image: African Events in China Nightclub */}
              <div className="relative w-full h-[50dvh] max-h-[420px] rounded-3xl overflow-hidden bg-black/60 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
                <img
                  src="/onboarding/screen3-event.png"
                  alt="African events and community in China"
                  className="w-full h-full object-cover object-top"
                />
                {/* Smooth top and bottom vignettes */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(2,11,0,0.3) 0%, rgba(2,11,0) 30%, rgba(2,11,0,0.4) 70%, #020b00 100%)',
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

              {/* Text & Headlines */}
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

              {/* Bottom Pagination & Next Button */}
              <div className="space-y-4 pt-1">
                {/* 3 Pagination Dots */}
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                  <span className="w-2 h-2 rounded-full bg-[#d3da0c] shadow-[0_0_8px_rgba(211,218,12,0.8)]" />
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                </div>

                {/* Next Button */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-[52px] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ==================== ONBOARD THREE: CHOOSE YOUR ROLE ==================== */}
          {currentStep === 2 && (
            <motion.div
              key="screen-3"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full max-w-md mx-auto flex flex-col justify-between h-full px-5 pb-3"
            >
              {/* Header Title Section */}
              <div className="text-center pt-1">
                {/* Pill Badge: CHOOSE YOUR ROLE */}
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

              {/* 4 Role Selection Cards */}
              <div className="space-y-2.5 my-auto py-2">
                {/* 1. User */}
                <button
                  type="button"
                  onClick={() => handleSelectRoleAndProceed('user')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#081304]/90 border transition-all text-left group cursor-pointer ${
                    selectedRole === 'user'
                      ? 'border-[#d3da0c] shadow-[0_0_18px_rgba(211,218,12,0.35)]'
                      : 'border-white/10 hover:border-[#d3da0c]/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-transparent border border-[#d3da0c] flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-['Inter',sans-serif] font-bold text-sm sm:text-base text-white">
                        User
                      </h3>
                      <p className="font-['Inter',sans-serif] font-light text-xs text-neutral-400 mt-0.5 truncate">
                        Discover events and buy tickets
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* 2. Business */}
                <button
                  type="button"
                  onClick={() => handleSelectRoleAndProceed('business')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#081304]/90 border transition-all text-left group cursor-pointer ${
                    selectedRole === 'business'
                      ? 'border-[#d3da0c] shadow-[0_0_18px_rgba(211,218,12,0.35)]'
                      : 'border-white/10 hover:border-[#d3da0c]/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-rose-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-['Inter',sans-serif] font-bold text-sm sm:text-base text-white">
                        Business
                      </h3>
                      <p className="font-['Inter',sans-serif] font-light text-xs text-neutral-400 mt-0.5 truncate">
                        Bar, Club, or Event Organizer
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* 3. Vendor */}
                <button
                  type="button"
                  onClick={() => handleSelectRoleAndProceed('vendor')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#081304]/90 border transition-all text-left group cursor-pointer ${
                    selectedRole === 'vendor'
                      ? 'border-[#d3da0c] shadow-[0_0_18px_rgba(211,218,12,0.35)]'
                      : 'border-white/10 hover:border-[#d3da0c]/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-['Inter',sans-serif] font-bold text-sm sm:text-base text-white">
                        Vendor
                      </h3>
                      <p className="font-['Inter',sans-serif] font-light text-xs text-neutral-400 mt-0.5 truncate">
                        Food, drink &amp; service providers
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>

                {/* 4. Artist / DJ */}
                <button
                  type="button"
                  onClick={() => handleSelectRoleAndProceed('artist')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#081304]/90 border transition-all text-left group cursor-pointer ${
                    selectedRole === 'artist'
                      ? 'border-[#d3da0c] shadow-[0_0_18px_rgba(211,218,12,0.35)]'
                      : 'border-white/10 hover:border-[#d3da0c]/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/40 flex items-center justify-center shrink-0">
                      <Music2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-['Inter',sans-serif] font-bold text-sm sm:text-base text-white">
                        Artist / DJ
                      </h3>
                      <p className="font-['Inter',sans-serif] font-light text-xs text-neutral-400 mt-0.5 truncate">
                        Performers &amp; creators
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              </div>

              {/* Bottom Pagination & Get Started Button */}
              <div className="space-y-4 pt-1">
                {/* 3 Pagination Dots */}
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                  <span className="w-2 h-2 rounded-full bg-neutral-600" />
                  <span className="w-2 h-2 rounded-full bg-[#d3da0c] shadow-[0_0_8px_rgba(211,218,12,0.8)]" />
                </div>

                  {/*Get Started Button*/}
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full h-[52px] rounded-full bg-[#d3da0c] text-black font-extrabold text-base hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_24px_rgba(211,218,12,0.3)] cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  {/* Explore as Guest / Sign In Links */}
                  <div className="flex items-center justify-center gap-4 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleFinish('/')}
                      className="text-neutral-300 hover:text-[#d3da0c] font-semibold transition-colors cursor-pointer"
                    >
                      Explore Platform First
                    </button>
                    <span className="text-neutral-600">•</span>
                    <button
                      type="button"
                      onClick={() => handleFinish('/login')}
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
