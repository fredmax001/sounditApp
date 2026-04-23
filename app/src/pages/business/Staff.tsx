import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Mail, Shield, X, Loader2, Phone, Lock, User, Eye, EyeOff, QrCode, ClipboardList, Check } from 'lucide-react';
import DashboardPageContainer, { DashboardPageHeader } from '@/components/dashboard/DashboardPageContainer';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type StaffRole = 'Manager' | 'Cashier' | 'Guest Check-In' | 'Promoter' | 'Scanner';

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
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newMember: StaffMember = {
        id: Date.now().toString(),
        fullName: formData.fullName.trim(),
        login: formData.login.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        status: 'Pending',
        permissions: { ...permissions }
      };

      setStaff([...staff, newMember]);
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
    } catch {
      toast.error(t('business.staff.failedToSendInvitation'));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
    toast.success(t('business.staff.staffMemberRemoved'));
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
        {staff.length > 0 ? (
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
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.status === 'Active' ? 'bg-green-500/20 text-green-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {member.status}
                  </span>
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
                        className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
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
                    disabled={isInviting || !formData.fullName.trim() || !formData.login.trim() || !formData.password.trim() || !formData.email.trim()}
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
    </DashboardPageContainer>
  );
};

export default Staff;
