import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';

const ProtectedRoute = () => {
  // Removed console.log for production
  const { isAuthenticated, isLoading, profile, isAdmin } = useAuthStore();
  const location = useLocation();

  // Removed console.log for production

  if (isLoading) {
    // Removed console.log for production
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Removed console.log for production
    // Redirect to login with return URL
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Wait for profile to load before making role checks
  if (!profile) {
    // Removed console.log for production
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const role = profile?.role_type || profile?.role;
  const isAdminUser = isAdmin ? isAdmin() : false;
  const path = location.pathname;

  // Removed console.log for production

  // Admin routes - only admins can access
  const isAdminPath = path.startsWith('/admin');
  if (isAdminPath && !isAdminUser) {
    // Removed console.log for production
    return <Navigate to="/" replace />;
  }

  // If admin tries to access user pages, redirect to admin dashboard
  if (isAdminUser && (path === '/dashboard' || path === '/dashboard/user')) {
    return <Navigate to="/admin" replace />;
  }

  // Business routes (includes legacy ORGANIZER role - treated as BUSINESS)
  const isBusinessPath = path.startsWith('/dashboard/business');
  if (isBusinessPath && role !== 'business' && role !== 'organizer' && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  // If business user tries to access user pages, redirect to business dashboard
  if ((role === 'business' || role === 'organizer') && (path === '/dashboard' || path === '/dashboard/user')) {
    return <Navigate to="/dashboard/business" replace />;
  }

  // Artist routes (includes legacy DJ role - treated as ARTIST)
  const isArtistPath = path.startsWith('/dashboard/artist');
  if (isArtistPath && role !== 'artist' && role !== 'dj' && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  // If artist tries to access user pages, redirect to artist dashboard
  if ((role === 'artist' || role === 'dj') && (path === '/dashboard' || path === '/dashboard/user')) {
    return <Navigate to="/dashboard/artist" replace />;
  }

  // Vendor routes
  const isVendorPath = path.startsWith('/dashboard/vendor');
  if (isVendorPath && role !== 'vendor' && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  // If vendor tries to access user pages, redirect to vendor dashboard
  if (role === 'vendor' && (path === '/dashboard' || path === '/dashboard/user')) {
    return <Navigate to="/dashboard/vendor" replace />;
  }

  // Removed console.log for production
  return <Outlet />;
};

export default ProtectedRoute;
