import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] relative flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Animated Grid */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(211, 218, 12, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(211, 218, 12, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Gradient Orbs */}
        <motion.div 
          className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-[#d3da0c]/10 rounded-full blur-[150px]"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div 
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#FF2D8F]/10 rounded-full blur-[150px]"
          animate={{
            x: [0, -40, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo - hidden on mobile */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 hidden md:block"
        >
          <Link to="/" className="inline-block">
            <img src="/logo.png" alt="Sound It" className="h-36 w-auto mx-auto" />
          </Link>
          <p className="text-gray-500 text-sm mt-2 tracking-wider">
            5 YEARS OF EXCELLENCE IN ENTERTAINMENT
          </p>
        </motion.div>

        {/* Auth Form Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass rounded-2xl p-8"
        >
          <Outlet />
        </motion.div>

        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-6"
        >
          <Link 
            to="/" 
            className="text-gray-500 hover:text-[#d3da0c] transition-colors text-sm"
          >
            ← Back to Home
          </Link>
        </motion.div>
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-8 left-8 w-20 h-20 border-l-2 border-t-2 border-[#d3da0c]/20" />
      <div className="absolute top-8 right-8 w-20 h-20 border-r-2 border-t-2 border-[#d3da0c]/20" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-l-2 border-b-2 border-[#d3da0c]/20" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-r-2 border-b-2 border-[#d3da0c]/20" />
    </div>
  );
};

export default AuthLayout;
