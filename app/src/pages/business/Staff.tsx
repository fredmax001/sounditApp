import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Mail, Shield, X, Loader2, Phone, Lock, User, Eye, EyeOff, QrCode, ClipboardList, Check, Search, UserCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

type StaffRole = 'Manager' | 'Cashier' | 'Guest Check-In' | 'Scanner';

interface StaffMember {
  id: string;
  fullName: string;
  login: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: 'Active' | 'Pending';
  permissions: {
    qrScanner: boolean;
    checkedInInfo: boolean;
  };
}

interface ExistingUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

const STAFF_ROLES: StaffRole[] = ['Manager', 'Cashier', 'Guest Check-In', 'Scanner'];

const getRoleBadgeClass = (role: StaffRole) => {
  switch (role) {
    case 'Manager':
      return 'bg-purple-500/20 text-purple-400';
    case 'Cashier':
      return 'bg-green-500/20 text-green-400';
    case 'Guest Check-In':
      return 'bg-blue-500/20 text-blue-400';
    case 'Scanner':
      return 'bg-orange-500/20 text-orange-400';
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
  const [isInviting, setIsInviting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
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
    role: 'Manager' as StaffRole,
  });

  const [permissions, setPermissions] = useState({
    qrScanner: false,
    checkedInInfo: false,
  });

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
      const mapped: StaffMember[] = data.map((s: any) => ({
        id: String(s.id),
        fullName: s.full_name,
        login: s.login,
        email: s.email,
        phone: s.phone || '',
        role: s.role,
        status: s.status,
        permissions: {
          qrScanner: s.permissions?.qrScanner || false,
          checkedInInfo: s.permissions?.checkedInInfo || false,
        },
      }));
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
  };

  const togglePermission = (key: keyof typeof permissions) => {
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
    setFormData({
      fullName: '',
      login: '',
      password: '',
      email: '',
      phone: '',
      role: 'Manager',
    });
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
    if (!selectedUser && !formData.password.trim()) {
      toast.error(t('business.staff.pleaseEnterPassword') || 'Please enter password');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error(t('business.staff.pleaseEnterValidEmail') || 'Please enter a valid email');
      return;
    }

    setIsInviting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/business/staff`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          full_name: formData.fullName.trim(),
          login: formData.login.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          role: formData.role,
          user_id: selectedUser?.id || null,
          permissions: {
            qrScanner: permissions.qrScanner,
            checkedInInfo: permissions.checkedInInfo,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to add staff' }));
        throw new Error(err.detail || 'Failed to add staff');
      }

      await fetchStaff();
      toast.success(t('business.staff.staffAdded') || 'Staff member added successfully');
      setShowInviteModal(false);
      setFormData({
        fullName: '',
        login: '',
        password: '',
        email: '',
        phone: '',
        role: 'Manager',
      });
      setPermissions({ qrScanner: false, checkedInInfo: false });
      setSendEmail(false);
      setSelectedUser(null);
      setAddMode('new');
    } catch (err: any) {
      toast.error(t('business.staff.failedToAddStaff') || err.message || 'Failed to add staff member');
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 p-6 lg:p-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t('business.staff.title')}</h2>
          <p className="text-gray-400">{t('business.staff.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#d3da0c]/90 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          {t('business.staff.inviteStaff')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-[#d3da0c]" />
            <span className="text-gray-400">{t('business.staff.totalStaff')}</span>
          </div>
          <p className="text-3xl font-bold text-white">{staff.length}</p>
        </div>
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-green-400" />
            <span className="text-gray-400">{t('business.staff.active')}</span>
          </div>
          <p className="text-3xl font-bold text-white">{staff.filter(s => s.status === 'Active').length}</p>
        </div>
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400">{t('business.staff.pending')}</span>
          </div>
          <p className="text-3xl font-bold text-white">{staff.filter(s => s.status === 'Pending').length}</p>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">{t('business.staff.teamMembers')}</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-10 h-10 text-[#d3da0c] mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">{t('common.loading') || 'Loading...'}</p>
          </div>
        ) : staff.length > 0 ? (
          <div className="divide-y divide-white/5">
            {staff.map((member) => (
              <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-white/5 transition-colors gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black font-bold shrink-0">
                    {member.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{member.fullName}</p>
                    <p className="text-gray-500 text-sm">{member.email}{member.phone ? ` • ${member.phone}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    {member.permissions.qrScanner && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-500/20 text-orange-400" title="QR Scanner">
                        <QrCode className="w-3 h-3" />
                        {t('business.staff.qrScanner') || 'QR Scanner'}
                      </span>
                    )}
                    {member.permissions.checkedInInfo && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400" title="Checked-in Info">
                        <ClipboardList className="w-3 h-3" />
                        {t('business.staff.checkedInInfo') || 'Checked-in Info'}
                      </span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(member.role)}`}>
                    {member.role}
                  </span>
                  <button
                    onClick={() => toggleStatus(member.id, member.status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      member.status === 'Active' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' :
                      'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                    }`}
                    title={t('business.staff.statusUpdated') || 'Click to toggle status'}
                  >
                    {member.status}
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
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
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">{t('business.staff.noStaffMembers')}</p>
            <p className="text-gray-500 text-sm mb-6">{t('business.staff.noStaffMembersHint')}</p>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111111] rounded-2xl border border-white/10 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{t('business.staff.inviteModalTitle') || 'Add new Member'}</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-white/5 rounded-lg p-1 mb-6">
                <button
                  type="button"
                  onClick={() => { setAddMode('new'); clearSelectedUser(); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    addMode === 'new' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('business.staff.createNewStaff') || 'Create New'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddMode('existing'); clearSelectedUser(); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    addMode === 'existing' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t('business.staff.addFromPlatform') || 'From Platform'}
                </button>
              </div>

              {/* Existing User Search */}
              <AnimatePresence>
                {addMode === 'existing' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    {!selectedUser ? (
                      <div className="space-y-2">
                        <label className="block text-gray-400 text-sm">{t('business.staff.selectUser') || 'Select User'}</label>
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('business.staff.searchUsersPlaceholder') || 'Search users by name or email...'}
                            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                          />
                          {searching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 animate-spin" />
                          )}
                        </div>
                        {searchResults.length > 0 && (
                          <div className="bg-white/5 rounded-lg border border-white/10 max-h-48 overflow-y-auto">
                            {searchResults.map((user) => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => selectExistingUser(user)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black text-xs font-bold shrink-0">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white text-sm truncate">{user.name}</p>
                                  <p className="text-gray-500 text-xs truncate">{user.email}{user.phone ? ` • ${user.phone}` : ''}</p>
                                </div>
                                <UserCheck className="w-4 h-4 text-gray-500 ml-auto shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                        {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                          <p className="text-gray-500 text-sm">{t('business.staff.noUsersFound') || 'No users found'}</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#d3da0c]/10 border border-[#d3da0c]/30 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black font-bold shrink-0">
                            {selectedUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{selectedUser.name}</p>
                            <p className="text-gray-400 text-sm">{selectedUser.email}{selectedUser.phone ? ` • ${selectedUser.phone}` : ''}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSelectedUser}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
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
                    <label className="block text-gray-400 text-sm mb-2">{t('business.staff.fullNameLabel') || 'Full Name'}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder={t('business.staff.fullNamePlaceholder') || 'Enter full name'}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('business.staff.systemRoleLabel') || 'System Role'}</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        {STAFF_ROLES.map(role => (
                          <option key={role} value={role} className="bg-[#111111]">{role}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('business.staff.loginLabel') || 'Login'}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        name="login"
                        value={formData.login}
                        onChange={handleChange}
                        placeholder={t('business.staff.loginPlaceholder') || 'Enter login'}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('business.staff.passwordLabel') || 'Password'}</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={t('business.staff.passwordPlaceholder') || 'Enter password'}
                        className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors disabled:opacity-50"
                        required={!selectedUser}
                        disabled={!!selectedUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        disabled={!!selectedUser}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {selectedUser && (
                      <p className="text-xs text-gray-500 mt-1">{t('business.staff.existingUserSelected') || 'Existing user — password not required'}</p>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('business.staff.emailAddress')}</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={t('business.staff.emailPlaceholder')}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('business.staff.phoneLabel') || 'Phone Number'}</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder={t('business.staff.phonePlaceholder') || 'Enter phone number'}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-gray-300 font-medium">{t('business.staff.permissions') || 'Permissions'}</p>
                  
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <QrCode className="w-4 h-4 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm">{t('business.staff.qrScanner') || 'QR Scanner'}</p>
                        <p className="text-gray-500 text-xs">{t('business.staff.qrScannerDesc') || 'Allow staff to scan tickets and check-ins'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('qrScanner')}
                      className={`w-11 h-6 rounded-full transition-colors relative ${permissions.qrScanner ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.qrScanner ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm">{t('business.staff.checkedInInfo') || 'Checked-in Info'}</p>
                        <p className="text-gray-500 text-xs">{t('business.staff.checkedInInfoDesc') || 'Allow staff to view checked-in guest details'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePermission('checkedInInfo')}
                      className={`w-11 h-6 rounded-full transition-colors relative ${permissions.checkedInInfo ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.checkedInInfo ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </label>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-[#d3da0c] focus:ring-[#d3da0c]"
                  />
                  <span className="text-gray-400 text-sm">{t('business.staff.sendDataToEmail') || 'I want to send data to user email'}</span>
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {t('business.staff.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting || !formData.fullName.trim() || !formData.login.trim() || (!selectedUser && !formData.password.trim()) || !formData.email.trim()}
                    className="flex-1 py-3 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#d3da0c]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('business.staff.sending')}
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        {t('business.staff.sendInvite') || 'Create'}
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
