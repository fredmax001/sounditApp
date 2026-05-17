import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useAdminStore } from '@/store/adminStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Shield, Check, X, Loader2, UserCog, Crown, AlertTriangle,
  Plus, Trash2, Save, ChevronDown, ChevronUp
} from 'lucide-react';

interface PermissionDef {
  key: string;
  label: string;
  category: string;
}

interface Admin {
  id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  admin_role_id?: number | null;
}

const AVAILABLE_PERMISSIONS: PermissionDef[] = [
  { key: 'dashboard', label: 'Dashboard', category: 'Core' },
  { key: 'analytics_read', label: 'View Analytics', category: 'Core' },
  { key: 'users_read', label: 'View Users & Profiles', category: 'Platform' },
  { key: 'events_read', label: 'View Events & Bookings', category: 'Platform' },
  { key: 'financials_read', label: 'View Financials', category: 'Finance' },
  { key: 'subscriptions_read', label: 'View Subscriptions', category: 'Finance' },
  { key: 'content_read', label: 'View Content', category: 'Content' },
  { key: 'marketing_read', label: 'View Marketing', category: 'Marketing' },
  { key: 'support_read', label: 'View Support & Community', category: 'Support' },
  { key: 'verifications_read', label: 'View Verifications', category: 'Verification' },
  { key: 'settings_read', label: 'View Settings & Logs', category: 'System' },
  { key: 'admins_write', label: 'Manage Admin Roles', category: 'System' },
];

const CATEGORY_COLORS: Record<string, string> = {
  Core: 'text-blue-400',
  Platform: 'text-purple-400',
  Finance: 'text-green-400',
  Content: 'text-orange-400',
  Marketing: 'text-pink-400',
  Support: 'text-cyan-400',
  Verification: 'text-yellow-400',
  System: 'text-red-400',
};

const RolePermissions = () => {
  const { t } = useTranslation();
  const { session, isSuperAdmin } = useAuthStore();
  const { adminRoles, fetchAdminRoles, createAdminRole, updateAdminRole, deleteAdminRole, assignAdminRole } = useAdminStore();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Role editor state
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', permissions: [] as string[] });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', permissions: [] as string[] });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAdminRoles(session?.access_token || ''),
        loadAdmins(),
        loadPermissions(),
      ]);
    } catch {
      toast.error('Failed to load roles data');
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/admins`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (res.ok) setAdmins(await res.json());
  };

  const loadPermissions = async () => {
    const res = await fetch(`${API_BASE_URL}/admin/permissions`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setPermissions(data);
    }
  };

  const selectedRole = adminRoles.find(r => r.id === selectedRoleId);

  const handleSelectRole = (roleId: number) => {
    setSelectedRoleId(roleId);
    const role = adminRoles.find(r => r.id === roleId);
    if (role) {
      setEditForm({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || [],
      });
      setIsEditing(false);
    }
  };

  const handleTogglePermission = (key: string, formType: 'edit' | 'create') => {
    const target = formType === 'edit' ? editForm : createForm;
    const setter = formType === 'edit' ? setEditForm : setCreateForm;
    const has = target.permissions.includes(key);
    setter({
      ...target,
      permissions: has ? target.permissions.filter(p => p !== key) : [...target.permissions, key],
    });
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setActionLoading('save-role');
    try {
      await updateAdminRole(session?.access_token || '', selectedRole.id, {
        name: editForm.name,
        description: editForm.description,
        permissions: editForm.permissions,
      });
      toast.success('Role updated');
      setIsEditing(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to update role';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    setActionLoading('create-role');
    try {
      await createAdminRole(session?.access_token || '', {
        name: createForm.name,
        description: createForm.description,
        permissions: createForm.permissions,
      });
      toast.success('Role created');
      setShowCreateForm(false);
      setCreateForm({ name: '', description: '', permissions: [] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create role';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    setActionLoading(`delete-${id}`);
    try {
      await deleteAdminRole(session?.access_token || '', id);
      toast.success('Role deleted');
      if (selectedRoleId === id) {
        setSelectedRoleId(null);
        setIsEditing(false);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to delete role';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignRole = async (userId: number, roleId: number | null) => {
    setActionLoading(`assign-${userId}`);
    try {
      await assignAdminRole(session?.access_token || '', String(userId), roleId);
      toast.success(roleId ? 'Role assigned' : 'Role unassigned');
      await loadAdmins();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to assign role';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const groupedPermissions = permissions.length > 0 ? permissions : AVAILABLE_PERMISSIONS;
  const categories = [...new Set(groupedPermissions.map(p => p.category))];

  const renderPermissionToggles = (formType: 'edit' | 'create') => {
    const target = formType === 'edit' ? editForm : createForm;
    return (
      <div className="space-y-4">
        {categories.map(category => {
          const catPerms = groupedPermissions.filter(p => p.category === category);
          const isExpanded = expandedCategories[category] !== false;
          return (
            <div key={category} className="border border-white/10 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCategories(prev => ({ ...prev, [category]: !isExpanded }))}
                className="w-full flex items-center justify-between px-4 py-2 bg-white/5 hover:bg-white/[0.07] transition-colors"
              >
                <span className={`text-xs font-bold uppercase tracking-wider ${CATEGORY_COLORS[category] || 'text-gray-400'}`}>{category}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
              </button>
              {isExpanded && (
                <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {catPerms.map(perm => {
                    const has = target.permissions.includes(perm.key);
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() => handleTogglePermission(perm.key, formType)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                          has ? 'border-[#d3da0c]/30 bg-[#d3da0c]/5 text-white' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/[0.07]'
                        }`}
                      >
                        {has ? <Check className="w-3 h-3 text-[#d3da0c] shrink-0" /> : <div className="w-3 h-3 rounded-sm border border-gray-600 shrink-0" />}
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Roles & Permissions</h1>
          <p className="text-gray-400 mt-1">Create custom roles and assign permissions to admin users</p>
        </div>
        {isSuperAdmin() && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </button>
        )}
      </div>

      {/* Current Admins */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#d3da0c]" />
          Platform Administrators
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map((admin) => (
            <div key={admin.id} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-br from-[#d3da0c] to-green-500 rounded-full flex items-center justify-center text-black font-bold shrink-0">
                  {(admin.first_name || admin.last_name || 'A')[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{`${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Unknown'}</p>
                  <p className="text-gray-500 text-xs truncate">{admin.email}</p>
                  <span className="text-[#d3da0c] text-xs">{admin.role}</span>
                </div>
              </div>
              {isSuperAdmin() && admin.role !== 'super_admin' && (
                <select
                  value={admin.admin_role_id || ''}
                  onChange={(e) => handleAssignRole(admin.id, e.target.value ? parseInt(e.target.value) : null)}
                  disabled={actionLoading === `assign-${admin.id}`}
                  className="ml-2 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-[#d3da0c] focus:outline-none disabled:opacity-50 shrink-0"
                >
                  <option value="">Full Admin</option>
                  {adminRoles.filter(r => !r.is_system).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role List */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-2">
          <h3 className="text-white font-semibold mb-3">Roles</h3>
          {adminRoles.map(role => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                selectedRoleId === role.id ? 'bg-[#d3da0c]/10 border border-[#d3da0c]/20' : 'bg-white/5 border border-transparent hover:bg-white/[0.07]'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium text-sm">{role.name}</p>
                  {role.is_system && (
                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase rounded">System</span>
                  )}
                </div>
                <p className="text-gray-500 text-xs">{role.user_count} user{role.user_count !== 1 ? 's' : ''}</p>
              </div>
              {!role.is_system && isSuperAdmin() && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                  disabled={actionLoading === `delete-${role.id}`}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                >
                  {actionLoading === `delete-${role.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </button>
          ))}
        </div>

        {/* Role Editor */}
        <div className="lg:col-span-2 bg-[#111111] border border-white/10 rounded-xl p-6">
          {selectedRole ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedRole.is_system ? 'bg-purple-500/10 text-purple-400' : 'bg-[#d3da0c]/10 text-[#d3da0c]'
                  }`}>
                    {selectedRole.is_system ? <Crown className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{selectedRole.name}</h3>
                    <p className="text-gray-500 text-xs">{selectedRole.description || 'No description'}</p>
                  </div>
                </div>
                {!selectedRole.is_system && isSuperAdmin() && (
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => { setIsEditing(false); handleSelectRole(selectedRole.id); }}
                          className="px-3 py-1.5 border border-white/10 text-gray-400 rounded-lg text-xs hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveRole}
                          disabled={actionLoading === 'save-role'}
                          className="px-3 py-1.5 bg-[#d3da0c] text-black font-bold rounded-lg text-xs hover:bg-white disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionLoading === 'save-role' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 text-white rounded-lg text-xs hover:bg-white/10"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isEditing && !selectedRole.is_system ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Role Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Permissions</label>
                    {renderPermissionToggles('edit')}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 text-sm mb-3">Permissions ({selectedRole.permissions?.length || 0})</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedRole.permissions || []).map(perm => {
                      const def = groupedPermissions.find(p => p.key === perm);
                      return (
                        <span key={perm} className="px-2.5 py-1 bg-[#d3da0c]/10 text-[#d3da0c] text-xs font-medium rounded-lg border border-[#d3da0c]/20">
                          {def?.label || perm}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-3 text-gray-700" />
              <p>Select a role to view or edit its permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Create New Role</h2>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Role Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Permissions</label>
                {renderPermissionToggles('create')}
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-400 text-xs">
                  New roles will restrict admins to only the selected permissions. Dashboard is always included.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-white/10 text-white rounded-lg hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-role'}
                  className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === 'create-role' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Role
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
