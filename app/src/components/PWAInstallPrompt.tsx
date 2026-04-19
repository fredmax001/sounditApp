import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, PlusSquare, Check } from 'lucide-react';

const STORAGE_KEY = 'soundit_pwa_prompt_dismissed_v2';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isWebkit = /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua);
  return isIOS() && isWebkit;
}

function isIOSChrome() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && /CriOS/i.test(navigator.userAgent);
}

// Visual step data with animated icons
const IOS_STEPS = [
  {
    icon: 'share',
    labelKey: 'pwa.step1Text',
    labelFallback: 'Tap the Share button',
  },
  {
    icon: 'addToHome',
    labelKey: 'pwa.step2Text',
    labelFallback: "Select 'Add to Home Screen'",
  },
  {
    icon: 'add',
    labelKey: 'pwa.step3Text',
    labelFallback: "Tap 'Add' to install",
  },
];

// Safari Share Icon SVG
function SafariShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

// Add to Home Screen Icon SVG (plus inside square)
function AddToHomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

// Add button icon (checkmark)
function AddConfirmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PWAInstallPrompt() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Only show on iOS, not in standalone mode, and if not previously dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed && isIOS() && !isStandalone()) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Animate through steps when visible
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % IOS_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  const handleContinue = () => {
    if (isIOSSafari()) {
      // On Safari, keep the prompt open so they can follow the steps
      // or just dismiss and they know what to do
      handleDismiss();
    } else {
      // Not in Safari — they should open in Safari
      // We already show the warning, so just dismiss
      handleDismiss();
    }
  };

  const inSafari = isIOSSafari();
  const inChrome = isIOSChrome();

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
            onClick={handleDismiss}
            aria-hidden="true"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[70] bg-[#0f0f0f] rounded-t-[2rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            <div className="px-6 pt-4 pb-10 max-w-md mx-auto">
              {/* App Icon + Title */}
              <div className="flex flex-col items-center text-center mb-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center shadow-lg shadow-[#d3da0c]/20 mb-5"
                >
                  <svg className="w-10 h-10 text-black" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21 5,3" />
                  </svg>
                </motion.div>
                <motion.h2
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold text-white mb-1"
                >
                  {t('pwa.installTitle') || 'Install Sound It'}
                </motion.h2>
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="text-gray-400 text-sm"
                >
                  {t('pwa.installSubtitle') || 'Get the full app experience'}
                </motion.p>
              </div>

              {/* Safari Warning (if not in Safari) */}
              <AnimatePresence mode="wait">
                {!inSafari && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3"
                  >
                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
                    <p className="text-amber-100 text-sm leading-relaxed">
                      {inChrome
                        ? t('pwa.openInChromeSafari') || 'Please open this page in Safari to install the app.'
                        : t('pwa.openInSafari') || 'Please open in Safari to install'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step-by-step visual guide */}
              <div className="space-y-4 mb-8">
                {IOS_STEPS.map((step, index) => {
                  const isActive = activeStep === index;
                  return (
                    <motion.div
                      key={step.icon}
                      animate={{
                        backgroundColor: isActive ? 'rgba(211, 218, 12, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        borderColor: isActive ? 'rgba(211, 218, 12, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                        scale: isActive ? 1.02 : 1,
                      }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center gap-4 p-4 rounded-2xl border"
                    >
                      <motion.div
                        animate={{
                          backgroundColor: isActive ? 'rgba(211, 218, 12, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                          color: isActive ? '#d3da0c' : '#9ca3af',
                        }}
                        transition={{ duration: 0.35 }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      >
                        {step.icon === 'share' && <SafariShareIcon className="w-6 h-6" />}
                        {step.icon === 'addToHome' && <AddToHomeIcon className="w-6 h-6" />}
                        {step.icon === 'add' && <AddConfirmIcon className="w-6 h-6" />}
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-300'}`}>
                          {t(step.labelKey) || step.labelFallback}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {t('pwa.stepLabel', { number: index + 1 }) || `Step ${index + 1}`}
                        </p>
                      </div>
                      <motion.div
                        initial={false}
                        animate={{
                          opacity: isActive ? 1 : 0,
                          scale: isActive ? 1 : 0.5,
                        }}
                        transition={{ duration: 0.25 }}
                        className="w-6 h-6 rounded-full bg-[#d3da0c] flex items-center justify-center flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleContinue}
                  className="w-full py-4 bg-[#d3da0c] text-black font-semibold rounded-2xl hover:bg-[#bbc10b] active:bg-[#a8ad0a] transition-colors shadow-lg shadow-[#d3da0c]/10"
                >
                  {inSafari
                    ? t('pwa.continueInSafari') || 'Continue in Safari'
                    : t('pwa.gotIt') || 'Got it'}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDismiss}
                  className="w-full py-4 bg-white/5 text-white font-medium rounded-2xl hover:bg-white/10 active:bg-white/15 transition-colors"
                >
                  {t('pwa.maybeLater') || 'Maybe Later'}
                </motion.button>

                {/* Don't show again */}
                <label className="flex items-center justify-center gap-2 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#d3da0c] focus:ring-[#d3da0c] cursor-pointer"
                  />
                  <span className="text-gray-400 text-sm">
                    {t('pwa.dontShowAgain') || "Don't show again"}
                  </span>
                </label>
              </div>

              {/* Close X (top right) */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label={t('pwa.close') || 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
