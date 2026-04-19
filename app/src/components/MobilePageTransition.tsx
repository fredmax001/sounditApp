import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MobilePageTransitionProps {
  children: ReactNode;
}

export const MobilePageTransition = ({ children }: MobilePageTransitionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

export default MobilePageTransition;
