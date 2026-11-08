import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Mail, Shield, X, Loader2, Phone, Lock, User, Eye, EyeOff,
  QrCode, ClipboardList, Check, Search, UserCheck, DollarSign, CreditCard, Wallet, Pencil
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

type StaffRole = 'Manager' | 'Finance' | 'Cashier' | 'Guest Check-In' | 'Scanner';

interface StaffPermissions {
  qrScanner: boolean;
  checkedInInfo: boolean;
  financials: boolean;
  ordersApproval: boolean;
  payouts: boolean;
}

interface StaffMember {
  id: string;
  fullName: string;
  login: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: 'Active' | 'Pending';
  permissions: StaffPermissions;
}

interface ExistingUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const STAFF_ROLES: StaffRole[] = ['Manager', 'Finance', 'Cashier', 'Guest Check-In', 'Scanner'];

const getDefaultPermissionsForRole = (role: StaffRole): StaffPermissions => {
  switch (role) {
    case 'Manager':
      return {
        qrScanner: true,
        checkedInInfo: true,
        financials: true,
        ordersApproval: true,
        payouts: true,
      };
    case 'Finance':
      return {
        qrScanner: false,
        checkedInInfo: false,
        financials: true,
        ordersApproval: true,
        payouts: true,
      };
    case 'Cashier':
      return {
        qrScanner: false,
        checkedInInfo: true,
        financials: false,
        ordersApproval: true,
        payouts: false,
      };
    case 'Guest Check-In':
      return {
        qrScanner: true,
        checkedInInfo: true,
        financials: false,
        ordersApproval: false,
        payouts: false,
      };
    case 'Scanner':
    default:
      return {
        qrScanner: true,
        checkedInInfo: false,
        financials: false,
        ordersApproval: false,
        payouts: false,
      };
  }
};

const getRoleBadgeClass = (role: StaffRole) => {
  switch (role) {
    case 'Manager':
      return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'Finance':
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'Cashier':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'Guest Check-In':
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'Scanner':
      return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};

const Staff = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [addMode, setAddMode] = useState<'new' | 'existing'>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExistingUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ExistingUser | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    login: '',
    password: '',
    email: '',
    phone: '',
    role: 'Finance' as StaffRole,
  });

  const [permissions, setPermissions] = useState<StaffPermissions>(
    getDefaultPermissionsForRole('Finance')
  );

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token || ''}`,
  });

  const fetchStaff = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load staff');
      const data = await res.json();
      const mapped: StaffMember[] = data.map((s: any) => {
        const isFinance = (s.role || '').toLowerCase() === 'finance';
        const isManager = (s.role || '').toLowerCase() === 'manager';
        return {
          id: String(s.id),
          fullName: s.full_name,
          login: s.login,
          email: s.email,
          phone: s.phone || '',
          role: s.role,
          status: s.status,
          permissions: {
            qrScanner: s.permissions?.qrScanner ?? isManager,
            checkedInInfo: s.permissions?.checkedInInfo ?? isManager,
            financials: s.permissions?.financials ?? (isFinance || isManager),
            ordersApproval: s.permissions?.ordersApproval ?? (isFinance || isManager),
            payouts: s.permissions?.payouts ?? (isFinance || isManager),
          },
        };
      });
      setStaff(mapped);
    } catch {
      toast.error(t('business.staff.failedToLoadStaff') || 'Failed to load staff members');
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const searchUsers = useCallback(async () => {
    if (!session?.access_token || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/search-users?q=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, session]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchUsers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'role') {
      setPermissions(getDefaultPermissionsForRole(value as StaffRole));
    }
  };

  const togglePermission = (key: keyof StaffPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectExistingUser = (user: ExistingUser) => {
    setSelectedUser(user);
    setFormData(prev => ({
      ...prev,
      fullName: user.name,
      email: user.email || prev.email,
      phone: user.phone || prev.phone,
      login: user.email ? user.email.split('@')[0] : `user${user.id}`,
      password: '',
    }));
    setSearchResults([]);
    setSearchQuery('');
  };

  const clearSelectedUser = () => {
    setSelectedUser(null);
    setFormData(prev => ({
      fullName: '',
      login: '',
      password: '',
      email: '',
      phone: '',
      role: prev.role,
    }));
  };

  const openAddModalWithRole = (defaultRole: StaffRole) => {
    setEditingStaffId(null);
    setSelectedUser(null);
    setAddMode('new');
    setFormData({
      fullName: '',
      login: '',
      password: '',
      email: '',
      phone: '',
      role: defaultRole,
    });
    setPermissions(getDefaultPermissionsForRole(defaultRole));
    setShowInviteModal(true);
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setSelectedUser(null);
    setAddMode('new');
    setFormData({
      fullName: member.fullName,
      login: member.login,
      password: '',
      email: member.email,
      phone: member.phone || '',
      role: member.role,
    });
    setPermissions({ ...member.permissions });
    setShowInviteModal(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      toast.error(t('business.staff.pleaseEnterFullName') || 'Please enter full name');
      return;
    }
    if (!formData.login.trim()) {
      toast.error(t('business.staff.pleaseEnterLogin') || 'Please enter login');
      return;
    }
    if (!editingStaffId && !selectedUser && !formData.password.trim()) {
      toast.error(t('business.staff.pleaseEnterPassword') || 'Please enter password');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error(t('business.staff.pleaseEnterValidEmail') || 'Please enter a valid email');
      return;
    }

    setIsInviting(true);

    try {
      const endpoint = editingStaffId
        ? `${API_BASE_URL}/business/staff/${editingStaffId}`
        : `${API_BASE_URL}/business/staff`;
      const method = editingStaffId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          full_name: formData.fullName.trim(),
          login: formData.login.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          user_id: selectedUser?.id || null,
          password: formData.password.trim() || null,
          permissions: {
            qrScanner: permissions.qrScanner,
            checkedInInfo: permissions.checkedInInfo,
            financials: permissions.financials,
            ordersApproval: permissions.ordersApproval,
            payouts: permissions.payouts,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to save staff' }));
        throw new Error(err.detail || 'Failed to save staff');
      }

      await fetchStaff();
      toast.success(
        editingStaffId
          ? 'Staff member updated successfully'
          : (t('business.staff.staffAdded') || 'Staff member saved successfully')
      );
      setShowInviteModal(false);
      setEditingStaffId(null);
      setFormData({
        fullName: '',
        login: '',
        password: '',
        email: '',
        phone: '',
        role: 'Finance',
      });
      setPermissions(getDefaultPermissionsForRole('Finance'));
      setSelectedUser(null);
      setAddMode('new');
    } catch (err: any) {
      toast.error(err.message || t('business.staff.failedToAddStaff') || 'Failed to save staff member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to remove');
      setStaff(prev => prev.filter(s => s.id !== id));
      toast.success(t('business.staff.staffMemberRemoved'));
    } catch {
      toast.error(t('business.staff.failedToRemoveStaff') || 'Failed to remove staff member');
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Pending' : 'Active';
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/${id}/status?status=${newStatus}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to update status');
      setStaff(prev => prev.map(s => s.id === id ? { ...s, status: newStatus as 'Active' | 'Pending' } : s));
      toast.success(t('business.staff.statusUpdated') || 'Status updated');
    } catch {
      toast.error(t('business.staff.failedToAddStaff') || 'Failed to update status');
    }
  };

  const financeStaffCount = staff.filter(s => s.role === 'Finance' || s.permissions.financials).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 p-6 lg:p-10"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#020b00] dark:text-white mb-2">{t('business.staff.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t('business.staff.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/business/finance"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Finance Workspace
          </Link>
          <button
            onClick={() => openAddModalWithRole('Finance')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl font-semibold hover:bg-emerald-400 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Add Finance Staff
          </button>
          <button
            onClick={() => openAddModalWithRole('Manager')}
            className="flex items-center gap-2 px-4 py-2 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-5 h-5" />
            {t('business.staff.inviteStaff')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-[#d3da0c]" />
            <span className="text-gray-600 dark:text-gray-400">{t('business.staff.totalStaff')}</span>
          </div>
          <p className="text-3xl font-bold text-[#020b00] dark:text-white">{staff.length}</p>
        </div>
        <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-emerald-500/20 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <span className="text-gray-600 dark:text-gray-400">Finance Staff</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{financeStaffCount}</p>
        </div>
        <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-green-500 dark:text-green-400" />
            <span className="text-gray-600 dark:text-gray-400">{t('business.staff.active')}</span>
          </div>
          <p className="text-3xl font-bold text-[#020b00] dark:text-white">{staff.filter(s => s.status === 'Active').length}</p>
        </div>
        <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
            <span className="text-gray-600 dark:text-gray-400">{t('business.staff.pending')}</span>
          </div>
          <p className="text-3xl font-bold text-[#020b00] dark:text-white">{staff.filter(s => s.status === 'Pending').length}</p>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none overflow-hidden">
        <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#020b00] dark:text-white">{t('business.staff.teamMembers')}</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">Finance staff can log in at /login to access the Business Finance Portal</span>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-10 h-10 text-[#d3da0c] mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">{t('common.loading') || 'Loading...'}</p>
          </div>
        ) : staff.length > 0 ? (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {staff.map((member) => (
              <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-black/5 dark:hover:bg-white/5 transition-colors gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#d3da0c] flex items-center justify-center text-black font-bold shrink-0">
                    {member.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[#020b00] dark:text-white font-medium">{member.fullName}</p>
                      <span className="text-xs text-gray-500 font-mono">@{member.login}</span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{member.email}{member.phone ? ` • ${member.phone}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {member.permissions.financials && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" title="Revenue & Analytics">
                        <DollarSign className="w-3 h-3" />
                        Finance & Revenue
                      </span>
                    )}
                    {member.permissions.ordersApproval && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400" title="Approve Ticket & Table Payments">
                        <CreditCard className="w-3 h-3" />
                        Payment Approvals
                      </span>
                    )}
                    {member.permissions.payouts && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" title="Payouts & Withdrawals">
                        <Wallet className="w-3 h-3" />
                        Payouts
                      </span>
                    )}
                    {member.permissions.qrScanner && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-500/20 text-orange-600 dark:text-orange-400" title="QR Scanner">
                        <QrCode className="w-3 h-3" />
                        {t('business.staff.qrScanner') || 'QR Scanner'}
                      </span>
                    )}
                    {member.permissions.checkedInInfo && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400" title="Checked-in Info">
                        <ClipboardList className="w-3 h-3" />
                        {t('business.staff.checkedInInfo') || 'Checked-in Info'}
                      </span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(member.role)}`}>
                    {member.role}
                  </span>
                  <button
                    onClick={() => toggleStatus(member.id, member.status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      member.status === 'Active' ? 'bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30' :
                      'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                    title={t('business.staff.statusUpdated') || 'Click to toggle status'}
                  >
                    {member.status}
                  </button>
                  <button
                    onClick={() => openEditModal(member)}
                    className="p-2 text-gray-500 hover:text-[#020b00] dark:text-gray-400 dark:hover:text-[#d3da0c] transition-colors"
                    title="Edit Staff Role & Permissions"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                    title={t('business.staff.removeMember')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-[#020b00] dark:text-gray-400 text-lg mb-2">{t('business.staff.noStaffMembers')}</p>
            <p className="text-gray-500 text-sm mb-6">{t('business.staff.noStaffMembersHint')}</p>
          </div>
        )}
      </div>

      {/* Invite / Edit Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#111111] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#020b00] dark:text-white">
                    {editingStaffId
                      ? 'Edit Staff Member'
                      : formData.role === 'Finance'
                        ? 'Add Finance Staff Member'
                        : (t('business.staff.inviteModalTitle') || 'Add Staff Member')}
                  </h3>
                  {formData.role === 'Finance' && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      Finance staff get dedicated access to the Business Finance & Revenue Portal
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 text-gray-400 hover:text-black dark:text-gray-500 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle (only when creating new staff) */}
              {!editingStaffId && (
                <div className="flex bg-neutral-100 dark:bg-white/5 rounded-xl p-1 mb-6 border border-black/5 dark:border-transparent">
                  <button
                    type="button"
                    onClick={() => { setAddMode('new'); clearSelectedUser(); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      addMode === 'new' ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {t('business.staff.createNewStaff') || 'Create New'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddMode('existing'); clearSelectedUser(); }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      addMode === 'existing' ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {t('business.staff.addFromPlatform') || 'From Platform'}
                  </button>
                </div>
              )}

              {/* Existing User Search */}
              <AnimatePresence>
                {!editingStaffId && addMode === 'existing' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    {!selectedUser ? (
                      <div className="space-y-2">
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium">{t('business.staff.selectUser') || 'Select User'}</label>
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('business.staff.searchUsersPlaceholder') || 'Search users by name or email...'}
                            className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                          />
                          {searching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                          )}
                        </div>
                        {searchResults.length > 0 && (
                          <div className="bg-neutral-50 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 max-h-48 overflow-y-auto">
                            {searchResults.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => selectExistingUser(user)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left border-b border-black/5 dark:border-white/5 last:border-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-[#d3da0c] flex items-center justify-center text-black text-xs font-bold shrink-0">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[#020b00] dark:text-white text-sm font-medium truncate">{user.name}</p>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs truncate">{user.email}{user.phone ? ` • ${user.phone}` : ''}</p>
                                </div>
                                <UserCheck className="w-4 h-4 text-gray-400 ml-auto shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                        {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('business.staff.noUsersFound') || 'No users found'}</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#d3da0c]/10 border border-[#d3da0c]/30 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#d3da0c] flex items-center justify-center text-black font-bold shrink-0">
                            {selectedUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[#020b00] dark:text-white font-semibold">{selectedUser.name}</p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">{selectedUser.email}{selectedUser.phone ? ` • ${selectedUser.phone}` : ''}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSelectedUser}
                          className="p-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">{t('business.staff.fullNameLabel') || 'Full Name'}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder={t('business.staff.fullNamePlaceholder') || 'Enter full name'}
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">{t('business.staff.systemRoleLabel') || 'System Role'}</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        {STAFF_ROLES.map(role => (
                          <option key={role} value={role} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">
                            {role === 'Finance' ? 'Finance (Revenue & Payouts)' : role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">{t('business.staff.loginLabel') || 'Login'}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        name="login"
                        value={formData.login}
                        onChange={handleChange}
                        placeholder={t('business.staff.loginPlaceholder') || 'Enter login'}
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                      {editingStaffId ? 'New Password (optional)' : (t('business.staff.passwordLabel') || 'Password')}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={editingStaffId ? 'Leave blank to keep current' : (t('business.staff.passwordPlaceholder') || 'Enter password')}
                        className="w-full pl-12 pr-12 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors disabled:opacity-50"
                        required={!editingStaffId && !selectedUser}
                        disabled={!!selectedUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:text-gray-500 dark:hover:text-white transition-colors"
                        disabled={!!selectedUser}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {selectedUser && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('business.staff.existingUserSelected') || 'Existing user, password not required'}</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">{t('business.staff.emailAddress')}</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={t('business.staff.emailPlaceholder')}
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">{t('business.staff.phoneLabel') || 'Phone Number'}</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder={t('business.staff.phonePlaceholder') || 'Enter phone number'}
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="bg-neutral-50 dark:bg-white/5 rounded-2xl p-4 space-y-3 border border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#020b00] dark:text-gray-300 font-semibold">{t('business.staff.permissions') || 'Workspace Permissions'}</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Role preset applied ({formData.role})</span>
                  </div>

                  {/* Finance & Revenue Workspace */}
                  <label className="flex items-center justify-between cursor-pointer group pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white text-sm font-medium">Finance & Revenue Analytics</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">View gross/net revenue, ticket sales, table sales & export CSV reports</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('financials')}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${permissions.financials ? 'bg-emerald-500' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.financials ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>

                  {/* Payment & Order Approvals */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white text-sm font-medium">Ticket & Table Payment Approvals</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Verify WeChat/Alipay payments and approve or reject ticket & VIP table orders</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('ordersApproval')}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${permissions.ordersApproval ? 'bg-emerald-500' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.ordersApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>

                  {/* Payouts & Withdrawals */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white text-sm font-medium">Payouts & Withdrawals</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Manage payout methods, request withdrawals, and track settlement history</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('payouts')}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${permissions.payouts ? 'bg-emerald-500' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.payouts ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>

                  <div className="border-t border-black/5 dark:border-white/10 my-2 pt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">On-Site Event Operations</p>
                  </div>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <QrCode className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white text-sm font-medium">{t('business.staff.qrScanner') || 'QR Scanner'}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{t('business.staff.qrScannerDesc') || 'Allow staff to scan tickets and check-ins'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('qrScanner')}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${permissions.qrScanner ? 'bg-[#020b00] dark:bg-[#d3da0c]' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white dark:bg-black transition-transform ${permissions.qrScanner ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white text-sm font-medium">{t('business.staff.checkedInInfo') || 'Checked-in Info'}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{t('business.staff.checkedInInfoDesc') || 'Allow staff to view checked-in guest details'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('checkedInInfo')}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${permissions.checkedInInfo ? 'bg-[#020b00] dark:bg-[#d3da0c]' : 'bg-black/10 dark:bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white dark:bg-black transition-transform ${permissions.checkedInInfo ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-3 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-700 dark:text-white rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 font-medium transition-colors"
                  >
                    {t('business.staff.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting || !formData.fullName.trim() || !formData.login.trim() || (!editingStaffId && !selectedUser && !formData.password.trim()) || !formData.email.trim()}
                    className="flex-1 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('business.staff.saving') || 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        {editingStaffId ? 'Update Staff' : (t('business.staff.saveStaff') || 'Save Staff')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Staff;
