import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: string;
}

const PermissionGuard = ({ children, permission }: PermissionGuardProps) => {
  const { hasPermission, isAdmin, permissions } = useAuthStore();

  // Wait until permissions are loaded
  if (isAdmin() && permissions.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#111111]">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default PermissionGuard;
