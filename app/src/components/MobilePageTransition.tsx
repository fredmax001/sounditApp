import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MobilePageTransitionProps {
  children: ReactNode;
}

/**
 * Lightweight opacity-only route transition.
 * Deliberately avoids CSS transforms (`x`, `y`, `scale`) and `overflow-x-clip`
 * on the wrapper because any transformed ancestor hijacks `position: fixed`
 * modals/bottom sheets and breaks `position: sticky` headers on mobile.
 */
export const MobilePageTransition = ({ children }: MobilePageTransitionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className="app-page-outlet w-full max-w-full min-w-0 flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
};

export default MobilePageTransition;
