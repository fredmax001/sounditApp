import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import MobileHeader from '@/components/MobileHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import MobilePageTransition from '@/components/MobilePageTransition';
import { useAnalytics } from '@/hooks/useAnalytics';


const MainLayout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  useAnalytics();

  // Pages that render their own top bar (full-screen / detail views)
  const isRecapsFeed = location.pathname === '/reels' || location.pathname === '/recaps';
  const immersive =
    isRecapsFeed ||
    location.pathname.startsWith('/notifications') ||
    location.pathname === '/points' ||
    location.pathname === '/get-verified' ||
    location.pathname === '/profile/edit';

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white relative overflow-x-clip transition-colors duration-200">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Subtle Noise Texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-[min(85vw,37.5rem)] h-[min(85vw,37.5rem)] bg-[#d3da0c]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-0 w-[min(80vw,31.25rem)] h-[min(80vw,31.25rem)] bg-[#FF2D8F]/5 rounded-full blur-[150px]" />
      </div>

      {/* Desktop Navigation */}
      {!isMobile && <Navbar />}

      {/* Mobile Header */}
      {isMobile && <MobileHeader hideBar={immersive} />}

      {/* Main Content */}
      <main className={`relative z-10 ${isMobile ? (immersive ? 'pb-app-nav' : 'pt-[calc(3.5rem+max(0.75rem,env(safe-area-inset-top)))] pb-app-nav') : (isRecapsFeed ? '' : 'pt-24')}`}>
        <AnimatePresence mode="wait">
          {isMobile ? (
            <MobilePageTransition key="mobile-outlet">
              <Outlet />
            </MobilePageTransition>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer - Displayed on both Desktop and Mobile / PWA */}
      {!immersive && <Footer isMobile={isMobile} />}

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* SIA Assistant temporarily removed */}
    </div>
  );
};

export default MainLayout;
