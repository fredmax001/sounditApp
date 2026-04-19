import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Wrapper component that redirects role-based users to their respective dashboards
 * Admin → /admin
 * Business (includes legacy Organizer) → /dashboard/business
 * Artist/DJ → /dashboard/artist
 * Vendor → /dashboard/vendor
 * Regular User → stays on home page
 */
export const HomeRedirect = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, profile, isAdmin } = useAuthStore();
  
  if (!isAuthenticated || !profile) {
    return <>{children}</>;
  }
  
  const role = profile.role_type || profile.role;
  const isAdminUser = isAdmin && isAdmin();
  
  // Admin users → Admin Dashboard
  if (isAdminUser) {
    return <Navigate to="/admin" replace />;
  }
  
  // Business (includes legacy Organizer role) → Business Dashboard
  if (role === 'business' || role === 'organizer') {
    return <Navigate to="/dashboard/business" replace />;
  }
  
  // Artist/DJ → Artist Dashboard
  if (role === 'artist' || role === 'dj') {
    return <Navigate to="/dashboard/artist" replace />;
  }
  
  // Vendor → Vendor Dashboard
  if (role === 'vendor') {
    return <Navigate to="/dashboard/vendor" replace />;
  }
  
  // Regular users stay on home page
  return <>{children}</>;
};

export default HomeRedirect;
