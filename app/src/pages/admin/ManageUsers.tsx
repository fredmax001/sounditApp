import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    UserPlus,
    User,
    ShieldAlert,
    Lock,
    Unlock,
    Mail,
    Loader2,
    X,
    Trash2,
    Award
} from 'lucide-react';
import { toast } from 'sonner';
import { useAdminStore } from '@/store/adminStore';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import type { AdminUser } from '@/store/adminStore';

const ManageUsers = () => {
    const { t } = useTranslation();
    const { users, fetchUsers, frozenUserIds, freezeUser, unfreezeUser } = useAdminStore();
    const { session } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [roleFilter, setRoleFilter] = useState('');

    // Invite form state
    const [inviteForm, setInviteForm] = useState({
        email: '',
        first_name: '',
        last_name: '',
        role: 'user'
    });
    const [sendingInvite, setSendingInvite] = useState(false);

    // Broadcast form state
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    // Reload users when component becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                loadUsers();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            await fetchUsers(session?.access_token || '');
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error(t('admin.manageUsers.failedToLoadUsers'));
        } finally {
            setIsLoading(false);
        }
    };

    const isFrozen = (userId: string) => frozenUserIds.includes(userId);

    const filteredUsers = users.filter((user: AdminUser) => {
        if (!searchQuery && !roleFilter) return true;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || (
            user.email?.toLowerCase().includes(q) ||
            user.role?.toLowerCase().includes(q) ||
            user.first_name?.toLowerCase().includes(q) ||
            user.last_name?.toLowerCase().includes(q) ||
            `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase().includes(q)
        );
        const matchesRole = !roleFilter || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return 'text-red-500 bg-red-500/10';
            case 'business':
            case 'organizer': return 'text-purple-400 bg-purple-400/10';
            case 'dj':
            case 'artist': return 'text-[#d3da0c] bg-[#d3da0c]/10';
            case 'vendor': return 'text-blue-400 bg-blue-400/10';
            default: return 'text-blue-400 bg-blue-400/10';
        }
    };

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteForm.email) {
            toast.error(t('admin.manageUsers.emailRequired'));
            return;
        }

        setSendingInvite(true);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/users/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(inviteForm)
            });

            if (res.ok) {
                toast.success(t('admin.manageUsers.invitationSent', { email: inviteForm.email }));
                setShowInviteModal(false);
                setInviteForm({ email: '', first_name: '', last_name: '', role: 'user' });
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.manageUsers.failedToSendInvitation'));
            }
        } catch {
            toast.error(t('admin.manageUsers.networkError'));
        } finally {
            setSendingInvite(false);
        }
    };

    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastMessage.trim()) {
            toast.error(t('admin.manageUsers.messageRequired'));
            return;
        }

        setSendingBroadcast(true);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/broadcast`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: broadcastMessage })
            });

            if (res.ok) {
                toast.success(t('admin.manageUsers.broadcastSent'));
                setShowBroadcastModal(false);
                setBroadcastMessage('');
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.manageUsers.failedToSendBroadcast'));
            }
        } catch {
            toast.error(t('admin.manageUsers.networkError'));
        } finally {
            setSendingBroadcast(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm(t('admin.manageUsers.confirmDeleteUser'))) return;

        setActionLoading(`delete-${userId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success(t('admin.manageUsers.userDeleted'));
                loadUsers();
            } else {
                const err = await res.json().catch(() => ({ detail: 'Failed to delete user' }));
                toast.error(err.detail || t('admin.manageUsers.failedToDeleteUser'));
            }
        } catch {
            toast.error(t('admin.manageUsers.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
        setActionLoading(`verify-${userId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/verification-badge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: parseInt(userId), badge_status: !currentStatus })
            });

            if (res.ok) {
                toast.success(currentStatus ? t('admin.manageUsers.verificationRemoved') || 'Verification badge removed' : t('admin.manageUsers.verificationGranted') || 'Verification badge granted');
                loadUsers();
            } else {
                const err = await res.json().catch(() => ({ detail: 'Failed to update verification' }));
                toast.error(err.detail || t('admin.manageUsers.failedToUpdateVerification') || 'Failed to update verification');
            }
        } catch {
            toast.error(t('admin.manageUsers.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleEditRole = async (userId: string, newRole: string) => {
        setActionLoading(`edit-${userId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                toast.success(t('admin.manageUsers.userRoleUpdated'));
                loadUsers();
            } else {
                const err = await res.json().catch(() => ({ detail: 'Failed to update role' }));
                toast.error(err.detail || t('admin.manageUsers.failedToUpdateRole'));
            }
        } catch {
            toast.error(t('admin.manageUsers.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display text-white mb-2">{t('admin.manageUsers.title')}</h1>
                    <p className="text-gray-400">{t('admin.manageUsers.subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-white transition-colors flex items-center gap-2"
                >
                    <UserPlus className="w-4 h-4" />
                    {t('admin.manageUsers.inviteUser')}
                </button>
            </div>

            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder={t('admin.manageUsers.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                >
                    <option value="">{t('admin.manageUsers.allRoles')}</option>
                    <option value="user">User</option>
                    <option value="business">Business</option>
                    <option value="artist">Artist</option>
                    <option value="admin">Admin</option>
                </select>
                <button
                    onClick={loadUsers}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('admin.manageUsers.refresh')}
                </button>
            </div>

            <div className="glass rounded-3xl overflow-hidden border border-white/5">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-20">
                        <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-white font-semibold text-lg mb-2">
                            {searchQuery || roleFilter ? t('admin.manageUsers.noMatchingUsers') : t('admin.manageUsers.noUsersFound')}
                        </h3>
                        <p className="text-gray-500">
                            {searchQuery || roleFilter ? t('admin.manageUsers.tryAdjustingFilters') : t('admin.manageUsers.usersWillAppearHere')}
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.manageUsers.identityHeader')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.manageUsers.accessLevelHeader')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.manageUsers.joinDateHeader')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.manageUsers.securityStateHeader')}</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">{t('admin.manageUsers.overridesHeader')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user: AdminUser) => (
                                <tr key={user.id} className={`hover:bg-white/5 transition-colors ${isFrozen(user.id) ? 'opacity-50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 relative overflow-hidden">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-5 h-5" />
                                                )}
                                                {isFrozen(user.id) && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#111111]">
                                                        <Lock className="w-2 h-2 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown'}</p>
                                                <p className="text-gray-500 text-xs">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleEditRole(user.id, e.target.value)}
                                            disabled={actionLoading === `edit-${user.id}` || user.role === 'admin'}
                                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border-0 cursor-pointer ${getRoleColor(user.role)} disabled:opacity-50`}
                                        >
                                            <option value="user" className="bg-[#111111]">User</option>
                                            <option value="business" className="bg-[#111111]">Business</option>
                                            <option value="artist" className="bg-[#111111]">Artist</option>
                                            <option value="admin" className="bg-[#111111]">Admin</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-400">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : t('admin.manageUsers.notApplicable')}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.status === 'suspended' || isFrozen(user.id) ? (
                                            <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-bold uppercase">
                                                <ShieldAlert className="w-3.5 h-3.5" />
                                                {user.status === 'suspended' ? t('admin.manageUsers.statusSuspended') : t('admin.manageUsers.statusFrozen')}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-green-500 text-xs font-bold uppercase">
                                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                {t('admin.manageUsers.statusActive')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={actionLoading === `delete-${user.id}` || user.role === 'admin'}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                                title={t('admin.manageUsers.deleteUserTitle')}
                                            >
                                                {actionLoading === `delete-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleToggleVerification(user.id, !!user.is_verified)}
                                                disabled={actionLoading === `verify-${user.id}` || user.role === 'admin'}
                                                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${user.is_verified ? 'bg-[#d3da0c]/20 text-[#d3da0c] hover:bg-[#d3da0c]/30' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                                title={user.is_verified ? (t('admin.manageUsers.removeVerificationTitle') || 'Remove verification badge') : (t('admin.manageUsers.grantVerificationTitle') || 'Grant verification badge')}
                                            >
                                                {actionLoading === `verify-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                                            </button>
                                            {isFrozen(user.id) || user.status === 'suspended' ? (
                                                <button
                                                    onClick={async () => {
                                                        unfreezeUser(session?.access_token || '', user.id);
                                                        try {
                                                            const token = session?.access_token;
                                                            await fetch(`${API_BASE_URL}/admin/users/${user.id}/activate`, {
                                                                method: 'POST',
                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                            });
                                                            toast.success(t('admin.manageUsers.accountRestored'));
                                                            loadUsers();
                                                        } catch {
                                                            toast.error(t('admin.manageUsers.failedToRestoreAccount'));
                                                        }
                                                    }}
                                                    disabled={actionLoading === `activate-${user.id}`}
                                                    className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                                    title={t('admin.manageUsers.restoreAccessTitle')}
                                                >
                                                    <Unlock className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        if (user.role === 'admin') return toast.error('Cannot freeze another admin');
                                                        freezeUser(session?.access_token || '', user.id);
                                                        try {
                                                            const token = session?.access_token;
                                                            await fetch(`${API_BASE_URL}/admin/users/${user.id}/suspend`, {
                                                                method: 'POST',
                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                            });
                                                            toast.error(t('admin.manageUsers.accountLocked'));
                                                            loadUsers();
                                                        } catch {
                                                            toast.error(t('admin.manageUsers.failedToLockAccount'));
                                                        }
                                                    }}
                                                    disabled={user.role === 'admin'}
                                                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                    title={t('admin.manageUsers.freezeAccountTitle')}
                                                >
                                                    <Lock className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex items-center justify-between p-6 glass rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                        <Mail className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-medium">{t('admin.manageUsers.broadcastTitle')}</p>
                        <p className="text-gray-500 text-xs">{t('admin.manageUsers.broadcastSubtitle')}</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowBroadcastModal(true)}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    {t('admin.manageUsers.draftMessage')}
                </button>
            </div>

            {/* Invite User Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">{t('admin.manageUsers.inviteNewUser')}</h3>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleInviteUser} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">{t('admin.manageUsers.emailLabel')}</label>
                                <input
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">{t('admin.manageUsers.firstNameLabel')}</label>
                                    <input
                                        type="text"
                                        value={inviteForm.first_name}
                                        onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">{t('admin.manageUsers.lastNameLabel')}</label>
                                    <input
                                        type="text"
                                        value={inviteForm.last_name}
                                        onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">{t('admin.manageUsers.roleLabel')}</label>
                                <select
                                    value={inviteForm.role}
                                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                                >
                                    <option value="user" className="bg-[#111111]">User</option>
                                    <option value="business" className="bg-[#111111]">Business</option>
                                    <option value="artist" className="bg-[#111111]">Artist</option>
                                    <option value="admin" className="bg-[#111111]">Admin</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={sendingInvite}
                                className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {sendingInvite ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                {t('admin.manageUsers.sendInvitation')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Broadcast Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-lg">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">{t('admin.manageUsers.broadcastMessageTitle')}</h3>
                            <button
                                onClick={() => setShowBroadcastModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSendBroadcast} className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">{t('admin.manageUsers.messageLabel')}</label>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none resize-none"
                                    placeholder={t('admin.manageUsers.broadcastPlaceholder')}
                                    required
                                />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                <Mail className="w-4 h-4" />
                                <span>{t('admin.manageUsers.broadcastHint')}</span>
                            </div>
                            <button
                                type="submit"
                                disabled={sendingBroadcast}
                                className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {sendingBroadcast ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                {t('admin.manageUsers.sendBroadcast')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageUsers;
