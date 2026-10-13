import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Download } from 'lucide-react';

const STORAGE_KEY = 'soundit_android_prompt_dismissed_v1';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

export default function AndroidAppPrompt() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on Android browsers, not inside the installed app, and if not dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed && isAndroid() && !isStandalone()) {
      const timer = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            onClick={handleDismiss}
            aria-hidden="true"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[70] bg-[#0f0f0f] rounded-t-[2rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3" />

            <div className="px-6 pt-5 pb-9 max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-black" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1.5">
                {t('androidPrompt.title') || 'Get the Sound It Android App'}
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                {t('androidPrompt.subtitle') || 'Faster experience with push notifications and instant checkout.'}
              </p>

              <div className="space-y-3">
                <motion.a
                  whileTap={{ scale: 0.97 }}
                  href="/download/android"
                  download
                  onClick={handleDismiss}
                  className="w-full py-4 bg-[#d3da0c] text-black font-semibold rounded-2xl hover:bg-[#bbc10b] transition-colors shadow-lg shadow-[#d3da0c]/10 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  {t('androidPrompt.download') || 'Download the App (APK)'}
                </motion.a>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDismiss}
                  className="w-full py-4 bg-white/5 text-white font-medium rounded-2xl hover:bg-white/10 transition-colors"
                >
                  {t('androidPrompt.maybeLater') || 'Maybe Later'}
                </motion.button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              aria-label={t('androidPrompt.close') || 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
