import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Mail, Shield, X, Loader2, Phone, Lock, User, Eye, EyeOff,
  QrCode, ClipboardList, Check, Search, DollarSign, CreditCard, Wallet,
  Pencil, MoreVertical, Layers, Clock, ArrowLeft
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { Link, useNavigate } from 'react-router-dom';

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

const Staff = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  // Close active dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setActiveMenuId(null);
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
    setActiveMenuId(null);
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
    setActiveMenuId(null);
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

  const totalStaffCount = staff.length;
  const financeStaffCount = staff.filter(s => (s.role || '').toLowerCase() === 'finance' || s.permissions?.financials).length;
  const activeStaffCount = staff.filter(s => s.status === 'Active').length;
  const pendingStaffCount = staff.filter(s => s.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-[#020b00] text-white pb-28 pt-2 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Page Title & Glowing 3D Team Graphic */}
      <div className="flex items-start justify-between gap-4 pt-2 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Staff
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-[280px] sm:max-w-md leading-relaxed">
            Invite team members and assign roles to help manage your events.
          </p>
        </div>

        {/* 3D Glowing Green Team Illustration matching reference */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 blur-xl rounded-full" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-[0_0_16px_rgba(16,185,129,0.55)]"
            viewBox="0 0 100 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="teamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            {/* Left person */}
            <circle cx="28" cy="28" r="11" fill="url(#teamGrad)" opacity="0.8" />
            <path d="M12 60 C12 44, 44 44, 44 60 Z" fill="url(#teamGrad)" opacity="0.8" />
            {/* Right person */}
            <circle cx="72" cy="28" r="11" fill="url(#teamGrad)" opacity="0.8" />
            <path d="M56 60 C56 44, 88 44, 88 60 Z" fill="url(#teamGrad)" opacity="0.8" />
            {/* Center front person (prominent) */}
            <circle cx="50" cy="22" r="13" fill="url(#teamGrad)" />
            <path d="M30 64 C30 46, 70 46, 70 64 Z" fill="url(#teamGrad)" />
          </svg>
        </div>
      </div>

      {/* Action Workspace Cards Row (3 Cards) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-6">
        {/* Card 1: Finance Workspace */}
        <Link
          to="/dashboard/business/finance"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[11px] sm:text-xs font-semibold text-white/90 leading-tight">
              Finance
            </span>
            <span className="block text-[11px] sm:text-xs font-semibold text-white/90 leading-tight">
              Workspace
            </span>
          </div>
        </Link>

        {/* Card 2: Add Finance Staff */}
        <button
          type="button"
          onClick={() => openAddModalWithRole('Finance')}
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group text-left active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[11px] sm:text-xs font-semibold text-white/90 leading-tight">
              Add Finance
            </span>
            <span className="block text-[11px] sm:text-xs font-semibold text-white/90 leading-tight">
              Staff
            </span>
          </div>
        </button>

        {/* Card 3: Invite Staff (Hero Neon-Lime Button) */}
        <button
          type="button"
          onClick={() => openAddModalWithRole('Manager')}
          className="bg-[#d3da0c] hover:bg-[#c2c90b] rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all text-left shadow-lg shadow-[#d3da0c]/20 active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-black/15 flex items-center justify-center mb-2 text-black">
            <UserPlus className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <span className="block text-[11px] sm:text-xs font-extrabold text-black leading-tight">
              Invite
            </span>
            <span className="block text-[11px] sm:text-xs font-extrabold text-black leading-tight">
              Staff
            </span>
          </div>
        </button>
      </div>

      {/* Statistics 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {/* Total Staff */}
        <div className="bg-[#0a1209] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-400">Total Staff</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">{totalStaffCount}</p>
        </div>

        {/* Finance Staff */}
        <div className="bg-[#0a1209] border border-emerald-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-gray-400">Finance Staff</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">{financeStaffCount}</p>
        </div>

        {/* Active Staff */}
        <div className="bg-[#0a1209] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-gray-400">Active</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">{activeStaffCount}</p>
        </div>

        {/* Pending Staff */}
        <div className="bg-[#0a1209] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-400">Pending</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">{pendingStaffCount}</p>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Team Members</h2>
          <span className="text-[11px] font-medium text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
            {totalStaffCount} {totalStaffCount === 1 ? 'Member' : 'Members'}
          </span>
        </div>

        {loading ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] mx-auto mb-3 animate-spin" />
            <p className="text-xs text-gray-400">Loading team members...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-10 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-white font-medium text-sm mb-1">No staff members yet</p>
            <p className="text-gray-400 text-xs mb-4">Invite staff or cashiers to manage entry and finance.</p>
            <button
              onClick={() => openAddModalWithRole('Finance')}
              className="px-4 py-2 bg-[#d3da0c] text-black font-semibold rounded-xl text-xs"
            >
              Add First Staff Member
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((member) => {
              const isFinance = (member.role || '').toLowerCase() === 'finance';
              const initialLetter = (member.fullName || 'S').charAt(0).toUpperCase();

              return (
                <div
                  key={member.id}
                  className="bg-[#0b140b] border border-white/8 rounded-2xl p-4 sm:p-5 relative shadow-sm"
                >
                  {/* Top Row: Avatar + Name + Role Tag + Status Badge + 3-dots */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Signature Yellow Circle Avatar */}
                      <div className="w-9 h-9 rounded-full bg-[#d3da0c] flex items-center justify-center text-black font-bold text-sm shrink-0 shadow-xs">
                        {initialLetter}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold text-sm truncate">
                            {member.fullName}
                          </p>
                          {isFinance && (
                            <span className="text-gray-400 text-xs font-normal">Finance</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Status Badge + 3-dots Menu */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          member.status === 'Active'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}
                      >
                        {member.status}
                      </span>

                      {/* 3-dots Dropdown Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                          className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === member.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-8 z-30 w-44 bg-[#121c10] border border-white/10 rounded-xl shadow-2xl py-1 text-xs"
                          >
                            <button
                              onClick={() => openEditModal(member)}
                              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-white/10 flex items-center gap-2"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                              Edit Role & Permissions
                            </button>
                            <button
                              onClick={() => toggleStatus(member.id, member.status)}
                              className="w-full text-left px-3 py-2 text-gray-200 hover:bg-white/10 flex items-center gap-2"
                            >
                              <Shield className="w-3.5 h-3.5 text-gray-400" />
                              Set as {member.status === 'Active' ? 'Pending' : 'Active'}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remove Member
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info (Email and Phone) */}
                  <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                    {member.email && (
                      <p className="truncate text-gray-400 font-normal">{member.email}</p>
                    )}
                    {member.phone && (
                      <p className="text-gray-500 font-normal">{member.phone}</p>
                    )}
                  </div>

                  {/* Compact Permissions Pills matching exact reference */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    {/* Guest Check-In */}
                    {member.permissions.checkedInInfo && !member.permissions.financials && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0a1e30] text-[#38bdf8] border border-[#0284c7]/40">
                        <Users className="w-3 h-3 text-[#38bdf8]" />
                        Guest Check-In
                      </span>
                    )}

                    {/* QR Scanner */}
                    {member.permissions.qrScanner && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#2a1708] text-[#fb923c] border border-[#ea580c]/40">
                        <QrCode className="w-3 h-3 text-[#fb923c]" />
                        QR Scanner
                      </span>
                    )}

                    {/* $ Finance & Revenue */}
                    {member.permissions.financials && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#092617] text-[#34d399] border border-[#059669]/40">
                        <DollarSign className="w-3 h-3 text-[#34d399]" />
                        Finance & Revenue
                      </span>
                    )}

                    {/* Payment Approvals */}
                    {member.permissions.ordersApproval && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#2d1e05] text-[#fbbf24] border border-[#d97706]/40">
                        <CreditCard className="w-3 h-3 text-[#fbbf24]" />
                        Payment Approvals
                      </span>
                    )}

                    {/* Payouts */}
                    {member.permissions.payouts && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#07242a] text-[#22d3ee] border border-[#0891b2]/40">
                        <Wallet className="w-3 h-3 text-[#22d3ee]" />
                        Payouts
                      </span>
                    )}

                    {/* Checked-in Info (for finance or manager) */}
                    {member.permissions.checkedInInfo && member.permissions.financials && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0a1e30] text-[#38bdf8] border border-[#0284c7]/40">
                        <ClipboardList className="w-3 h-3 text-[#38bdf8]" />
                        Checked-in Info
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite / Edit Staff Member Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0e160d] rounded-2xl border border-white/10 shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto text-white"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {editingStaffId
                      ? 'Edit Staff Member'
                      : formData.role === 'Finance'
                      ? 'Add Finance Staff'
                      : 'Invite Staff Member'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure role permissions and login credentials.
                  </p>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle (only when creating new staff) */}
              {!editingStaffId && (
                <div className="flex rounded-xl bg-black/40 p-1 mb-5 border border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode('new');
                      clearSelectedUser();
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      addMode === 'new'
                        ? 'bg-[#d3da0c] text-black shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Create Credentials
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMode('existing');
                      clearSelectedUser();
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      addMode === 'existing'
                        ? 'bg-[#d3da0c] text-black shadow-xs'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Select Existing User
                  </button>
                </div>
              )}

              {/* Existing User Search */}
              {!editingStaffId && addMode === 'existing' && (
                <div className="mb-5 space-y-2">
                  <label className="block text-xs font-medium text-gray-300">
                    Search Registered User
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email or phone..."
                      className="w-full bg-[#152014] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                    />
                    {searching && (
                      <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-[#d3da0c]" />
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto bg-black/60 border border-white/10 rounded-xl p-1 divide-y divide-white/5">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => selectExistingUser(user)}
                          className="w-full text-left p-2 hover:bg-white/10 rounded-lg flex items-center justify-between transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{user.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{user.email || user.phone}</p>
                          </div>
                          <span className="text-[10px] text-[#d3da0c] font-semibold">Select</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedUser && (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">{selectedUser.name}</p>
                        <p className="text-[10px] text-emerald-400">{selectedUser.email || selectedUser.phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedUser}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                {/* Login Username */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Login Username *
                  </label>
                  <input
                    type="text"
                    name="login"
                    value={formData.login}
                    onChange={handleChange}
                    placeholder="e.g. jdoe_staff"
                    required
                    disabled={!!editingStaffId}
                    className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] disabled:opacity-50"
                  />
                </div>

                {/* Password (for new credentials) */}
                {(!editingStaffId && addMode === 'new') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Assign an initial password"
                        required
                        className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    required
                    className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+86..."
                    className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Staff Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d3da0c]"
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r} className="bg-[#111] text-white">
                        {r === 'Finance' ? 'Finance (Revenue & Payouts)' : r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Granular Permissions Section */}
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-200 mb-2">Granular Permissions</p>
                  <div className="space-y-2 bg-black/30 p-3 rounded-xl border border-white/5">
                    {/* Finance & Revenue */}
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="text-gray-300 flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        Finance & Revenue
                      </span>
                      <input
                        type="checkbox"
                        checked={permissions.financials}
                        onChange={() => togglePermission('financials')}
                        className="rounded accent-[#d3da0c] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* Payment Approvals */}
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="text-gray-300 flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        Payment Approvals
                      </span>
                      <input
                        type="checkbox"
                        checked={permissions.ordersApproval}
                        onChange={() => togglePermission('ordersApproval')}
                        className="rounded accent-[#d3da0c] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* Payouts */}
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="text-gray-300 flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                        Payouts & Withdrawals
                      </span>
                      <input
                        type="checkbox"
                        checked={permissions.payouts}
                        onChange={() => togglePermission('payouts')}
                        className="rounded accent-[#d3da0c] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* QR Scanner */}
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="text-gray-300 flex items-center gap-2">
                        <QrCode className="w-3.5 h-3.5 text-orange-400" />
                        Ticket QR Scanner
                      </span>
                      <input
                        type="checkbox"
                        checked={permissions.qrScanner}
                        onChange={() => togglePermission('qrScanner')}
                        className="rounded accent-[#d3da0c] w-4 h-4 cursor-pointer"
                      />
                    </label>

                    {/* Checked-In Info */}
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <span className="text-gray-300 flex items-center gap-2">
                        <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                        Guest Check-In Info
                      </span>
                      <input
                        type="checkbox"
                        checked={permissions.checkedInInfo}
                        onChange={() => togglePermission('checkedInInfo')}
                        className="rounded accent-[#d3da0c] w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-5 py-2 bg-[#d3da0c] hover:bg-[#c2c90b] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-[#d3da0c]/20"
                  >
                    {isInviting && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
                    {editingStaffId ? 'Save Changes' : 'Save & Assign'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Staff;
