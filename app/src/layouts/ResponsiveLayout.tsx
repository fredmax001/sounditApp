/**
 * Responsive Layout - Unified System
 * Automatically switches between Mobile (Mini Program style) and Desktop (Full Dashboard) layouts
 * based on device detection AND user role
 * 
 * Rules:
 * - Admin users: ALWAYS desktop layout (full access to all features)
 * - Other roles (User, Artist, Vendor, Business): Mobile layout on mobile devices
 */
import { useRoleBasedLayout } from '@/hooks/useDeviceDetection';
import MobileLayout from './MobileLayout';
import DashboardLayout from './DashboardLayout';
import { useAuthStore } from '@/store/authStore';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { ReactNode } from 'react';

interface ResponsiveLayoutProps {
  children?: ReactNode;
}

/**
 * Responsive Layout Component
 * Uses device detection + user role to show appropriate layout
 */
export const ResponsiveLayout = ({ children }: ResponsiveLayoutProps) => {
  const { profile } = useAuthStore();
  const userRole = profile?.role_type || profile?.role;
  const { isMobileLayout } = useRoleBasedLayout(userRole);
  
  const layout = isMobileLayout ? (
    <MobileLayout>{children}</MobileLayout>
  ) : (
    <DashboardLayout>{children}</DashboardLayout>
  );

  return <ErrorBoundary>{layout}</ErrorBoundary>;
};

/**
 * HOC to wrap components with responsive behavior
 */
// eslint-disable-next-line react-refresh/only-export-components
export function withResponsiveLayout<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return (props: P) => {
    const { profile } = useAuthStore();
    const userRole = profile?.role_type || profile?.role;
    const { layoutMode } = useRoleBasedLayout(userRole);
    
    return (
      <div data-layout-mode={layoutMode}>
        <Component {...props} />
      </div>
    );
  };
}

export default ResponsiveLayout;
