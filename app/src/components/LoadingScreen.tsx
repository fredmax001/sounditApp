import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

interface IntroSettings {
  enabled?: boolean;
  logo_url?: string;
  title?: string;
  tagline?: string;
}

interface LoadingScreenProps {
  settings?: IntroSettings | null;
  onFinish?: () => void;
}

const LoadingScreen = ({ settings: _settings, onFinish }: LoadingScreenProps) => {
  const [phase, setPhase] = useState<'drum' | 'full' | 'exit'>('drum');

  useEffect(() => {
    // Keep iOS's static launch screen up until this animated intro is ready.
    // The launch artwork matches the intro's opening frame to avoid a second splash.
    if (Capacitor.isNativePlatform()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          SplashScreen.hide().catch(() => undefined);
        });
      });
    }

    // Phase 1: Drum appears and pulses with musical energy
    // Phase 2: At 650ms, "SOUND It" drops in with neon energy
    const t1 = setTimeout(() => {
      setPhase('full');
    }, 650);

    // Phase 3: At 2200ms, initiate smooth fadeout into the app
    const t2 = setTimeout(() => {
      setPhase('exit');
    }, 2200);

    // Phase 4: At 2500ms, invoke onFinish
    const t3 = setTimeout(() => {
      onFinish?.();
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  const handleSkip = () => {
    setPhase('exit');
    setTimeout(() => {
      onFinish?.();
    }, 180);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020b00] select-none overflow-hidden transition-opacity duration-300 cursor-pointer ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient background pulse */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{
            scale: [0.9, 1.25, 0.9],
            opacity: [0.1, 0.22, 0.1],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-[#d3da0c] blur-[100px]"
        />
      </div>

      {/* Center Animated Logo Lockup */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6">
        {/* Animated Drum Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.65, y: -15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center mb-5"
        >
          {/* Subtle neon glow ring */}
          <motion.div
            animate={{
              boxShadow: [
                '0 0 0px rgba(211,218,12,0)',
                '0 0 35px rgba(211,218,12,0.45)',
                '0 0 15px rgba(211,218,12,0.2)',
              ],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full"
          />

          <motion.img
            src="/intro_drum.png"
            alt="Sound It Drum"
            animate={{
              scale: [1, 1.04, 1],
            }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="h-28 sm:h-32 w-auto object-contain drop-shadow-[0_0_18px_rgba(211,218,12,0.4)]"
          />
        </motion.div>

        {/* Animated "SOUND It" Typography */}
        <AnimatePresence>
          {phase !== 'drum' && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center justify-center"
            >
              <img
                src="/intro_sound.png"
                alt="Sound It"
                className="h-14 sm:h-16 w-auto object-contain drop-shadow-[0_0_22px_rgba(211,218,12,0.45)]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading Circle at the Bottom (Preserved as requested) */}
      <div
        className="flex flex-col items-center gap-3 absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div
          className="w-9 h-9 rounded-full border-[3px] border-[#222222] border-t-[#d3da0c] animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        <p className="text-[#555555] text-sm font-sans m-0 whitespace-nowrap tracking-wide">
          Loading Sound It...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
