import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import MobileHeader from '@/components/MobileHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import MobilePageTransition from '@/components/MobilePageTransition';

const MainLayout = () => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative">
      {/* Global Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Subtle Noise Texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#d3da0c]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-[#FF2D8F]/5 rounded-full blur-[150px]" />
      </div>

      {/* Desktop Navigation */}
      {!isMobile && <Navbar />}

      {/* Mobile Header */}
      {isMobile && <MobileHeader />}

      {/* Main Content */}
      <main className={`relative z-10 ${isMobile ? 'pt-14 pb-app-nav' : ''}`}>
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

      {/* Footer - Desktop only */}
      {!isMobile && <Footer />}

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};

export default MainLayout;
