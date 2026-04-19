import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Pre-defined orb configurations to avoid Math.random during render
const ORB_CONFIGS = [
  { width: 180, height: 220, left: '15%', top: '20%', duration: 6, xOffset: -30, yOffset: 40 },
  { width: 150, height: 180, left: '75%', top: '15%', duration: 7, xOffset: 40, yOffset: -20 },
  { width: 200, height: 250, left: '60%', top: '65%', duration: 8, xOffset: -50, yOffset: 30 },
  { width: 120, height: 150, left: '25%', top: '70%', duration: 5, xOffset: 30, yOffset: -40 },
  { width: 170, height: 200, left: '80%', top: '50%', duration: 6.5, xOffset: -20, yOffset: 50 },
];

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated Grid */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(211, 218, 12, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(211, 218, 12, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'gridMove 20s linear infinite',
          }}
        />
        
        {/* Floating Orbs */}
        {ORB_CONFIGS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: orb.width,
              height: orb.height,
              background: i % 2 === 0 
                ? 'radial-gradient(circle, rgba(211, 218, 12, 0.15) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(211, 218, 12, 0.1) 0%, transparent 70%)',
              left: orb.left,
              top: orb.top,
            }}
            animate={{
              x: [0, orb.xOffset, 0],
              y: [0, orb.yOffset, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: orb.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Animation */}
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="relative">
              {/* Glow Effect Behind Logo */}
              <div className="absolute inset-0 blur-3xl scale-110">
                <img 
                  src="/logo.png" 
                  alt=""
                  className="w-64 h-auto opacity-50"
                  style={{ filter: 'brightness(1.5)' }}
                />
              </div>
              
              {/* Logo Image */}
              <motion.img 
                src="/logo.png"
                alt="Sound It"
                className="relative w-64 h-auto"
                animate={{
                  filter: [
                    'drop-shadow(0 0 20px rgba(211, 218, 12, 0.5))',
                    'drop-shadow(0 0 40px rgba(211, 218, 12, 0.8))',
                    'drop-shadow(0 0 20px rgba(211, 218, 12, 0.5))',
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-[#d3da0c] text-sm tracking-[0.3em] uppercase mb-12 font-medium text-center px-4"
        >
          5 years of Excellence in Entertainment
        </motion.p>

        {/* Progress Bar */}
        <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#d3da0c]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Progress Text */}
        <motion.p
          className="mt-4 text-[#d3da0c] font-mono text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {Math.min(Math.round(progress), 100)}%
        </motion.p>

        {/* Loading Dots */}
        <div className="flex gap-2 mt-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-[#d3da0c]"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-[#d3da0c]/30" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-[#d3da0c]/30" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-[#d3da0c]/30" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-[#d3da0c]/30" />

      <style>{`
        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
