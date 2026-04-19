import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Shield, Check, X, Loader2,
  UserCog, Crown, AlertTriangle
} from 'lucide-react';

interface Role {
  name: string;
  description: string;
  user_count: number;
}

interface Admin {
  id: number;
  name: string;
  email: string;
  role: string;
}

const RolePermissions = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', first_name: '', last_name: '' });

  const availablePermissions = [
    { key: 'users_read', label: 'View Users', category: 'Users' },
    { key: 'users_write', label: 'Manage Users', category: 'Users' },
    { key: 'events_read', label: 'View Events', category: 'Events' },
    { key: 'events_write', label: 'Manage Events', category: 'Events' },
    { key: 'content_read', label: 'View Content', category: 'Content' },
    { key: 'content_write', label: 'Moderate Content', category: 'Content' },
    { key: 'financials_read', label: 'View Financials', category: 'Financials' },
    { key: 'financials_write', label: 'Manage Payouts', category: 'Financials' },
    { key: 'settings_read', label: 'View Settings', category: 'Settings' },
    { key: 'settings_write', label: 'Edit Settings', category: 'Settings' },
  ];

  useEffect(() => {
    loadRolesAndPermissions();
  }, []);

  const loadRolesAndPermissions = async () => {
    try {
      const [rolesRes, adminsRes, permsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/roles`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/admins`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/permissions`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (rolesRes.ok) setRoles(await rolesRes.json() as Role[]);
      if (adminsRes.ok) setAdmins(await adminsRes.json() as Admin[]);
      if (permsRes.ok) setPermissions(await permsRes.json() as Record<string, string[]>);
    } catch {
      toast.error(t('admin.rolePermissions.failedToLoadRolesData'));
    }
  };

  const handleTogglePermission = async (role: string, permission: string) => {
    setActionLoading(`${role}-${permission}`);
    try {
      const currentPerms = permissions[role] || [];
      const hasPermission = currentPerms.includes(permission);
      const newPerms = hasPermission
        ? currentPerms.filter((p: string) => p !== permission)
        : [...currentPerms, permission];

      const res = await fetch(`${API_BASE_URL}/admin/roles/${role}/permissions`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permissions: newPerms })
      });

      if (res.ok) {
        setPermissions({ ...permissions, [role]: newPerms });
        toast.success(t('admin.rolePermissions.permissionsUpdated'));
      }
    } catch {
      toast.error(t('admin.rolePermissions.failedToUpdatePermissions'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('add-admin');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/admins`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAdmin)
      });

      if (res.ok) {
        toast.success(t('admin.rolePermissions.adminAdded'));
        setShowAddAdmin(false);
        setNewAdmin({ email: '', password: '', first_name: '', last_name: '' });
        loadRolesAndPermissions();
      }
    } catch {
      toast.error(t('admin.rolePermissions.failedToAddAdmin'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAdmin = async (id: number) => {
    if (!confirm(t('admin.rolePermissions.confirmRemoveAdmin'))) return;
    setActionLoading(`remove-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/admins/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        toast.success(t('admin.rolePermissions.adminRemoved'));
        loadRolesAndPermissions();
      }
    } catch {
      toast.error(t('admin.rolePermissions.failedToRemoveAdmin'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.rolePermissions.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.rolePermissions.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddAdmin(true)}
          className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-2"
        >
          <UserCog className="w-4 h-4" />
          {t('admin.rolePermissions.addAdminButton')}
        </button>
      </div>

      {/* Current Admins */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#d3da0c]" />
          {t('admin.rolePermissions.platformAdministrators')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map((admin) => (
            <div key={admin.id} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#d3da0c] to-green-500 rounded-full flex items-center justify-center text-black font-bold">
                  {admin.name?.[0] || 'A'}
                </div>
                <div>
                  <p className="text-white font-medium">{admin.name}</p>
                  <p className="text-gray-500 text-xs">{admin.email}</p>
                  <span className="text-[#d3da0c] text-xs">{admin.role}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveAdmin(admin.id)}
                disabled={actionLoading === `remove-${admin.id}`}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
              >
                {actionLoading === `remove-${admin.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Role Permissions */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#d3da0c]" />
          {t('admin.rolePermissions.rolePermissions')}
        </h2>
        
        <div className="space-y-6">
          {roles.map((role) => (
            <div key={role.name} className="border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    role.name === 'super_admin' ? 'bg-purple-500/10 text-purple-400' :
                    role.name === 'admin' ? 'bg-[#d3da0c]/10 text-[#d3da0c]' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {role.name === 'super_admin' ? <Crown className="w-5 h-5" /> :
                     role.name === 'admin' ? <Shield className="w-5 h-5" /> :
                     <UserCog className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-white font-medium capitalize">{role.name.replace('_', ' ')}</h3>
                    <p className="text-gray-500 text-xs">{role.description}</p>
                  </div>
                </div>
                <span className="text-gray-500 text-xs">{t('admin.rolePermissions.userCount', { count: role.user_count })}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {availablePermissions.map((perm) => {
                  const hasPermission = permissions[role.name]?.includes(perm.key);
                  const isLoading = actionLoading === `${role.name}-${perm.key}`;
                  
                  return (
                    <button
                      key={perm.key}
                      onClick={() => handleTogglePermission(role.name, perm.key)}
                      disabled={isLoading || role.name === 'super_admin'}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        hasPermission 
                          ? 'border-[#d3da0c]/30 bg-[#d3da0c]/5' 
                          : 'border-white/10 bg-white/5'
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                        ) : hasPermission ? (
                          <Check className="w-3 h-3 text-[#d3da0c]" />
                        ) : (
                          <X className="w-3 h-3 text-gray-600" />
                        )}
                      </div>
                      <p className={`text-xs ${hasPermission ? 'text-white' : 'text-gray-400'}`}>
                        {t(`admin.rolePermissions.permission.${perm.key}`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">{t('admin.rolePermissions.addNewAdmin')}</h2>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.rolePermissions.emailLabel')}</label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  placeholder={t('admin.rolePermissions.emailPlaceholder')}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.rolePermissions.passwordLabel')}</label>
                <input
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  placeholder={t('admin.rolePermissions.passwordPlaceholder')}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.rolePermissions.firstNameLabel')}</label>
                  <input
                    type="text"
                    value={newAdmin.first_name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, first_name: e.target.value })}
                    placeholder={t('admin.rolePermissions.firstNamePlaceholder')}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.rolePermissions.lastNameLabel')}</label>
                  <input
                    type="text"
                    value={newAdmin.last_name}
                    onChange={(e) => setNewAdmin({ ...newAdmin, last_name: e.target.value })}
                    placeholder={t('admin.rolePermissions.lastNamePlaceholder')}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-400 text-xs">
                  {t('admin.rolePermissions.adminWarning')}
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(false)}
                  className="px-4 py-2 border border-white/10 text-white rounded-lg hover:bg-white/5"
                >
                  {t('admin.rolePermissions.cancelButton')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'add-admin'}
                  className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white disabled:opacity-50"
                >
                  {actionLoading === 'add-admin' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.rolePermissions.addAdminSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RolePermissions;
