import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { ExternalLink, X } from 'lucide-react';
import { HolidayDecorations } from './intro/HolidayDecorations';

interface IntroSettings {
  enabled?: boolean;
  logo_url?: string;
  title?: string;
  tagline?: string;
  show_ad?: boolean;
  ad_image_url?: string;
  ad_title?: string;
  ad_link_url?: string;
  ad_badge?: string;
  duration_seconds?: number;
}

interface LoadingScreenProps {
  settings?: IntroSettings | null;
  onFinish?: () => void;
}

export const DEFAULT_SPLASH_TAGLINE = 'YOUR GATEWAY TO ENTERTAINMENT IN CHINA.';

/**
 * SCREEN 1: FLASH INTRO / SPLASH SCREEN
 * - Official Sound It animated logo in the centre (Drum emblem + SOUND IT wordmark)
 * - Original Sound It brand identity (#020b00 dark green/black + #d3da0c yellow accent)
 * - Tagline: "YOUR GATEWAY TO ENTERTAINMENT IN CHINA."
 * - Animated circular loading indicator at the bottom
 * - Text: "Loading Sound It…"
 * - Smooth logo appearance, subtle brand-colour glow, gentle fade-in, and smooth automatic transition to onboarding
 */
const LoadingScreen = ({ settings, onFinish }: LoadingScreenProps) => {
  const [showAdCard, setShowAdCard] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const hasAd = Boolean(settings?.show_ad && settings?.ad_image_url);
  const totalDuration = hasAd
    ? Math.max(Number(settings?.duration_seconds || 3.0) * 1000, 3000)
    : 1900;

  useEffect(() => {
    // Hide native OS launch screen smoothly once our animated splash is mounted
    if (Capacitor.isNativePlatform()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          SplashScreen.hide().catch(() => undefined);
        });
      });
    }

    let tAd: ReturnType<typeof setTimeout> | null = null;
    if (hasAd) {
      tAd = setTimeout(() => {
        setShowAdCard(true);
      }, 1000);
    }

    // Begin gentle fade-out transition before completing
    const tExit = setTimeout(() => {
      setIsExiting(true);
    }, totalDuration - 300);

    // Trigger completion to transition smoothly into Onboarding / App
    const tFinish = setTimeout(() => {
      onFinish?.();
    }, totalDuration);

    return () => {
      if (tAd) clearTimeout(tAd);
      clearTimeout(tExit);
      clearTimeout(tFinish);
    };
  }, [onFinish, hasAd, totalDuration]);

  const handleSkip = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onFinish?.();
    }, 200);
  };

  const handleAdClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (settings?.ad_link_url) {
      if (settings.ad_link_url.startsWith('http://') || settings.ad_link_url.startsWith('https://')) {
        window.open(settings.ad_link_url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = settings.ad_link_url;
      }
    }
    handleSkip();
  };

  const customLogo = settings?.logo_url;
  const customTitle = settings?.title;
  const rawTagline = settings?.tagline?.trim();
  const tagline =
    rawTagline &&
    rawTagline.toLowerCase() !== '5 years of excellence in entertainment'
      ? rawTagline
      : DEFAULT_SPLASH_TAGLINE;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1, scale: isExiting ? 1.015 : 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between text-white select-none overflow-hidden cursor-pointer ${
        isExiting ? 'pointer-events-none' : ''
      }`}
      style={{
        backgroundColor: '#020b00',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Holiday Seasonal Decorations (if active) */}
      <HolidayDecorations />

      {/* Top Right Skip Pill */}
      <div className="w-full flex justify-end px-6 pt-2 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 border border-white/10 backdrop-blur-md text-xs font-medium text-white/85 hover:text-white transition-all shadow-md cursor-pointer"
        >
          <span>Skip</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Subtle Brand-Colour Glow Layers Behind Centre Logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Soft wide ambient aura */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{
            scale: [0.95, 1.12, 0.95],
            opacity: [0.16, 0.28, 0.16],
          }}
          transition={{
            opacity: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
            scale: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-[#d3da0c] blur-[120px]"
        />
        {/* Focused warm core glow behind drum */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.22, 0.36, 0.22],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute w-44 h-44 rounded-full bg-[#d3da0c] blur-[75px] -translate-y-6"
        />
      </div>

      {/* Centre Animated Official Brand Lockup */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 max-w-md w-full text-center my-auto">
        {/* 1. Official Sound It Drum Emblem */}
        <motion.div
          initial={{ opacity: 0, scale: 0.86, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center mb-5"
        >
          <motion.img
            src={customLogo || '/intro_drum.png'}
            alt="Sound It Drum Emblem"
            animate={{
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="h-32 sm:h-36 w-auto object-contain drop-shadow-[0_0_32px_rgba(211,218,12,0.55)]"
          />
        </motion.div>

        {/* 2. Official "SOUND it" Wordmark Logo */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.55,
            delay: 0.15,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex flex-col items-center justify-center"
        >
          {customTitle ? (
            <h1 className="text-3xl sm:text-4xl font-black text-[#d3da0c] tracking-wider mb-3 drop-shadow-[0_0_24px_rgba(211,218,12,0.55)]">
              {customTitle}
            </h1>
          ) : (
            <img
              src="/intro_sound.png"
              alt="SOUND IT"
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-[0_0_26px_rgba(211,218,12,0.5)] mb-3.5"
            />
          )}
        </motion.div>

        {/* 3. Tagline: "YOUR GATEWAY TO ENTERTAINMENT IN CHINA." */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex flex-col items-center"
        >
          <p
            className="text-[11px] sm:text-xs font-extrabold tracking-[0.14em] uppercase text-[#d3da0c] px-3 leading-relaxed text-center"
            style={{
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.85), 0 0 18px rgba(211, 218, 12, 0.35)',
            }}
          >
            {tagline}
          </p>
        </motion.div>

        {/* Optional Sponsor / Intro Ad Banner (if enabled by Admin) */}
        <AnimatePresence>
          {hasAd && showAdCard && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={handleAdClick}
              className="mt-5 w-full bg-[#0a1605]/90 hover:bg-[#0e1f07]/95 border border-[#d3da0c]/40 hover:border-[#d3da0c] rounded-2xl p-3 shadow-2xl backdrop-blur-xl transition-all cursor-pointer group text-left relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#d3da0c]/15 text-[#d3da0c] text-[10px] font-bold uppercase tracking-wider">
                  {settings?.ad_badge || 'Featured Sponsor'}
                </span>
                {settings?.ad_link_url && (
                  <span className="text-gray-400 group-hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors">
                    <span>Visit</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="relative w-full h-28 rounded-xl overflow-hidden mb-2 bg-black/40">
                <img
                  src={settings?.ad_image_url}
                  alt={settings?.ad_title || 'Advertisement'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              {settings?.ad_title && (
                <p className="text-white text-sm font-bold line-clamp-1 group-hover:text-[#d3da0c] transition-colors">
                  {settings.ad_title}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Animated Circular Loading Indicator & "Loading Sound It…" */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="flex flex-col items-center gap-3 z-20 pointer-events-none pb-4"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="relative flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border-[2.5px] border-[#d3da0c]/20 border-t-[#d3da0c] animate-spin"
            style={{
              animationDuration: '0.85s',
              boxShadow: '0 0 14px rgba(211, 218, 12, 0.25)',
            }}
          />
        </div>
        <p className="text-white/75 text-xs font-medium tracking-wider m-0 whitespace-nowrap">
          Loading Sound It…
        </p>
      </motion.div>
    </motion.div>
  );
};

export default LoadingScreen;
