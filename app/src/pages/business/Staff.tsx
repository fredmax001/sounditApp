import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Mail, Shield, X, Loader2, Phone, Lock, User, Eye, EyeOff, QrCode, ClipboardList, Check } from 'lucide-react';
import DashboardPageContainer, { DashboardPageHeader } from '@/components/dashboard/DashboardPageContainer';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '@/config/api';

type StaffRole = 'Manager' | 'Cashier' | 'Guest Check-In' | 'Promoter' | 'Scanner';

interface StaffMember {
  id: number;
  full_name: string;
  login: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: 'Active' | 'Pending';
  permissions: {
    qrScanner: boolean;
    checkedInInfo: boolean;
  };
  created_at?: string;
}

const STAFF_ROLES: StaffRole[] = ['Manager', 'Cashier', 'Guest Check-In', 'Promoter', 'Scanner'];

const getRoleBadgeClass = (role: StaffRole) => {
  switch (role) {
    case 'Manager':
      return 'bg-purple-500/20 text-purple-400';
    case 'Cashier':
      return 'bg-green-500/20 text-green-400';
    case 'Guest Check-In':
      return 'bg-blue-500/20 text-blue-400';
    case 'Promoter':
      return 'bg-pink-500/20 text-pink-400';
    case 'Scanner':
      return 'bg-orange-500/20 text-orange-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};

const Staff = () => {
  const { t } = useTranslation();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

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

  const token = localStorage.getItem('auth-token') || localStorage.getItem('token');

  /* ── Fetch staff on mount ── */
  useEffect(() => {
    if (!token) return;
    const fetchStaff = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/business/staff`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStaff(data.map((s: any) => ({
            ...s,
            full_name: s.full_name,
            permissions: {
              qrScanner: s.permissions?.qrScanner ?? false,
              checkedInInfo: s.permissions?.checkedInInfo ?? false,
            },
          })));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
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
    if (!formData.password.trim()) {
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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.fullName.trim(),
          login: formData.login.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          permissions,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to add staff member');
      }

      const newRes = await fetch(`${API_BASE_URL}/business/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (newRes.ok) {
        const data = await newRes.json();
        setStaff(data.map((s: any) => ({
          ...s,
          full_name: s.full_name,
          permissions: {
            qrScanner: s.permissions?.qrScanner ?? false,
            checkedInInfo: s.permissions?.checkedInInfo ?? false,
          },
        })));
      }

      toast.success(t('business.staff.invitationSent', { email: formData.email }));
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
    } catch (err: any) {
      toast.error(err?.message || t('business.staff.failedToSendInvitation'));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove');
      setStaff(prev => prev.filter(s => s.id !== id));
      toast.success(t('business.staff.staffMemberRemoved'));
    } catch {
      toast.error('Failed to remove staff member');
    }
  };

  const handleToggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === 'Active' ? 'Pending' : 'Active';
    try {
      const res = await fetch(`${API_BASE_URL}/business/staff/${member.id}/status?status=${newStatus}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to update status');
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, status: newStatus } : s));
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <DashboardPageContainer>
      <DashboardPageHeader
        title={t('business.staff.title')}
        subtitle={t('business.staff.subtitle')}
        action={
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#d3da0c]/90 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            {t('business.staff.inviteStaff')}
          </button>
        }
      />

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
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading staff...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">{t('business.staff.noStaffYet')}</p>
            <p className="text-gray-500 text-sm">{t('business.staff.inviteToStart')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {staff.map((member) => (
              <div key={member.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{member.full_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(member.role)}`}>
                        {member.role}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(member)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          member.status === 'Active'
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        }`}
                      >
                        {member.status}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {member.email}
                      </span>
                      {member.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {member.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {member.permissions.qrScanner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/20 text-orange-400" title="QR Scanner">
                          <QrCode className="w-3 h-3" />
                          QR Scanner
                        </span>
                      )}
                      {member.permissions.checkedInInfo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400" title="Checked-in Info">
                          <ClipboardList className="w-3 h-3" />
                          Check-ins
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  title={t('business.staff.remove')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">{t('business.staff.inviteStaff')}</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('business.staff.fullName')} *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('business.staff.enterFullName')}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('business.staff.login')} *</label>
                  <input
                    type="text"
                    name="login"
                    value={formData.login}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('business.staff.enterLogin')}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('business.staff.password')} *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none pr-12"
                      placeholder={t('business.staff.enterPassword')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('business.staff.email')} *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('business.staff.enterEmail')}
                    required
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('business.staff.phone')}</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('business.staff.enterPhone')}
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('business.staff.role')} *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  >
                    {STAFF_ROLES.map(role => (
                      <option key={role} value={role} className="bg-[#141414]">{role}</option>
                    ))}
                  </select>
                </div>

                {/* Permissions */}
                <div>
                  <label className="text-white/60 text-sm block mb-3">{t('business.staff.permissions')}</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                          <QrCode className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-white text-sm">{t('business.staff.qrScanner')}</p>
                          <p className="text-gray-500 text-xs">{t('business.staff.qrScannerDesc')}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePermission('qrScanner')}
                        className={`w-11 h-6 rounded-full transition-colors relative ${permissions.qrScanner ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.qrScanner ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white text-sm">{t('business.staff.checkedInInfo')}</p>
                          <p className="text-gray-500 text-xs">{t('business.staff.checkedInInfoDesc')}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePermission('checkedInInfo')}
                        className={`w-11 h-6 rounded-full transition-colors relative ${permissions.checkedInInfo ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${permissions.checkedInInfo ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Send Email Toggle */}
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSendEmail(!sendEmail)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${sendEmail ? 'bg-[#d3da0c]' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${sendEmail ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <div>
                    <p className="text-white text-sm">{t('business.staff.sendInvitationEmail')}</p>
                    <p className="text-gray-500 text-xs">{t('business.staff.sendEmailDesc')}</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isInviting}
                  className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isInviting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('business.staff.sending')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      {t('business.staff.addStaffMember')}
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardPageContainer>
  );
};

export default Staff;
