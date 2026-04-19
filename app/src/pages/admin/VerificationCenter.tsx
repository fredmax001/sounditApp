import { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck,
    FileText,
    Search,
    ExternalLink,
    ShieldAlert,
    Clock,
    UserCheck,
    Loader2,
    X,
    XCircle,
    Award,
    User
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// Helper component - must be defined before use
const ArrowRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);

interface VerificationRequest {
    id: string;
    user_id: string;
    name: string;
    type: 'business' | 'artist' | 'vendor' | 'venue';
    status: 'pending' | 'approved' | 'rejected';
    submitted_at: string;
    documents: Array<{
        title: string;
        url: string;
        type: string;
    }>;
    notes?: string;
    email?: string;
    phone?: string;
}

interface BadgeUser {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    role: string;
    verification_badge?: boolean;
    issued_at?: string;
    issued_by?: string | null;
}

const VerificationCenter = () => {
    const { t } = useTranslation();
    const { session } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'documents' | 'badges'>('documents');

    // Document verification state
    const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Badge management state
    const [verifiedUsers, setVerifiedUsers] = useState<BadgeUser[]>([]);
    const [badgeSearchQuery, setBadgeSearchQuery] = useState('');
    const [badgeSearchResults, setBadgeSearchResults] = useState<BadgeUser[]>([]);
    const [isLoadingVerified, setIsLoadingVerified] = useState(false);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [badgeActionLoading, setBadgeActionLoading] = useState<number | null>(null);

    const loadVerificationRequests = useCallback(async () => {
        setIsLoadingRequests(true);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/verifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                // Backend may return array directly or wrapped object
                const requests = Array.isArray(data) ? data : (data.verifications || []);
                setVerificationRequests(requests);
            } else {
                toast.error(t('admin.verificationCenter.failedToLoadVerificationRequests'));
            }
        } catch {
            toast.error(t('admin.verificationCenter.networkError'));
        } finally {
            setIsLoadingRequests(false);
        }
    }, [session?.access_token]);

    const loadVerifiedUsers = useCallback(async () => {
        setIsLoadingVerified(true);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/verification-badge/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setVerifiedUsers(data || []);
            } else {
                toast.error(t('admin.verificationCenter.failedToLoadVerifiedUsers'));
            }
        } catch {
            toast.error(t('admin.verificationCenter.networkErrorLoadingVerifiedUsers'));
        } finally {
            setIsLoadingVerified(false);
        }
    }, [session?.access_token]);

    useEffect(() => {
        loadVerificationRequests();
    }, [loadVerificationRequests]);

    useEffect(() => {
        if (activeTab === 'badges') {
            loadVerifiedUsers();
        }
    }, [activeTab, loadVerifiedUsers]);

    const searchUsers = useCallback(async () => {
        if (!badgeSearchQuery.trim()) {
            setBadgeSearchResults([]);
            return;
        }
        setIsSearchingUsers(true);
        try {
            const token = session?.access_token;
            const res = await fetch(
                `${API_BASE_URL}/admin/users?search=${encodeURIComponent(badgeSearchQuery)}&limit=20`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (res.ok) {
                const data = await res.json();
                // The list_users endpoint returns a plain array of user objects
                const users = Array.isArray(data) ? data : (data.users || []);
                setBadgeSearchResults(users);
            } else {
                toast.error(t('admin.verificationCenter.failedToSearchUsers'));
            }
        } catch {
            toast.error(t('admin.verificationCenter.networkErrorSearchingUsers'));
        } finally {
            setIsSearchingUsers(false);
        }
    }, [badgeSearchQuery, session?.access_token]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (badgeSearchQuery.trim()) {
                searchUsers();
            } else {
                setBadgeSearchResults([]);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [badgeSearchQuery, searchUsers]);

    const toggleBadge = async (userId: number, currentStatus: boolean) => {
        setBadgeActionLoading(userId);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/verification-badge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId, badge_status: !currentStatus })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || (!currentStatus ? t('admin.verificationCenter.badgeAssigned') : t('admin.verificationCenter.badgeRemoved')));
                // Update local state
                setVerifiedUsers(prev =>
                    !currentStatus
                        ? [...prev, { ...data, id: userId, verification_badge: true }]
                        : prev.filter(u => u.id !== userId)
                );
                setBadgeSearchResults(prev =>
                    prev.map(u => u.id === userId ? { ...u, verification_badge: !currentStatus } : u)
                );
                loadVerifiedUsers();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.verificationCenter.failedToUpdateBadge'));
            }
        } catch {
            toast.error(t('admin.verificationCenter.networkError'));
        } finally {
            setBadgeActionLoading(null);
        }
    };

    const filteredRequests = verificationRequests.filter(req => {
        const matchesFilter = filter === 'all' || req.status === filter;
        const matchesSearch = !searchQuery ||
            req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.type.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'business': return 'text-purple-400 bg-purple-400/10';
            case 'artist': return 'text-[#d3da0c] bg-[#d3da0c]/10';
            case 'vendor': return 'text-blue-400 bg-blue-400/10';
            case 'venue': return 'text-orange-400 bg-orange-400/10';
            default: return 'text-gray-400 bg-white/5';
        }
    };

    const handleApprove = async (requestId: string) => {
        setActionLoading(`approve-${requestId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/verifications/${requestId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success(t('admin.verificationCenter.verificationApproved'));
                setSelectedRequest(prev => prev ? { ...prev, status: 'approved' } : null);
                loadVerificationRequests();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.verificationCenter.failedToApproveVerification'));
            }
        } catch {
            toast.error(t('admin.verificationCenter.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;

        setActionLoading(`reject-${selectedRequest.id}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/verifications/${selectedRequest.id}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: rejectReason })
            });

            if (res.ok) {
                toast.success(t('admin.verificationCenter.verificationRejected'));
                setSelectedRequest(prev => prev ? { ...prev, status: 'rejected', notes: rejectReason } : null);
                setShowRejectModal(false);
                setRejectReason('');
                loadVerificationRequests();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.verificationCenter.failedToRejectVerification'));
            }
        } catch {
            toast.error(t('admin.verificationCenter.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const openRejectModal = () => {
        setRejectReason('');
        setShowRejectModal(true);
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHrs / 24);

        if (diffDays > 0) return t('admin.verificationCenter.timeAgo.days', { count: diffDays });
        if (diffHrs > 0) return t('admin.verificationCenter.timeAgo.hours', { count: diffHrs });
        return t('admin.verificationCenter.timeAgo.justNow');
    };

    const openDocument = (url: string) => {
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            toast.error(t('admin.verificationCenter.documentUrlNotAvailable'));
        }
    };

    const renderBadgeManagement = () => (
        <div className="space-y-8">
            {/* Search Section */}
            <div className="glass rounded-3xl p-8 border border-white/10">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Search className="w-5 h-5 text-[#d3da0c]" />
                    Find User & Manage Badge
                </h2>
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder={t('admin.verificationCenter.searchPlaceholder')}
                        value={badgeSearchQuery}
                        onChange={(e) => setBadgeSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                    />
                </div>

                {isSearchingUsers ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
                    </div>
                ) : badgeSearchResults.length > 0 ? (
                    <div className="space-y-3">
                        {badgeSearchResults.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl"
                            >
                                <div className="flex items-center gap-3">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                            <User className="w-5 h-5 text-gray-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-white font-medium">
                                            {user.first_name || user.last_name
                                                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                                : user.email}
                                        </p>
                                        <p className="text-gray-500 text-xs capitalize">{user.role} • {user.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleBadge(user.id, !!user.verification_badge)}
                                    disabled={badgeActionLoading === user.id}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${
                                        user.verification_badge
                                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                            : 'bg-[#d3da0c] text-black hover:bg-white'
                                    } disabled:opacity-50`}
                                >
                                    {badgeActionLoading === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : user.verification_badge ? (
                                        <>
                                            <XCircle className="w-4 h-4" />
                                            {t('admin.verificationCenter.removeBadge')}
                                        </>
                                    ) : (
                                        <>
                                            <Award className="w-4 h-4" />
                                            {t('admin.verificationCenter.assignBadge')}
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : badgeSearchQuery.trim() ? (
                    <p className="text-gray-500 text-sm text-center py-4">{t('admin.verificationCenter.noUsersFound')}</p>
                ) : null}
            </div>

            {/* Verified Users List */}
            <div className="glass rounded-3xl p-8 border border-white/10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-[#d3da0c]" />
                        {t('admin.verificationCenter.verifiedUsers')}
                        <span className="text-sm text-gray-500 font-normal">({verifiedUsers.length})</span>
                    </h2>
                </div>

                {isLoadingVerified ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    </div>
                ) : verifiedUsers.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                        {verifiedUsers.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl"
                            >
                                <div className="flex items-center gap-3">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#d3da0c] to-blue-500 flex items-center justify-center text-black font-bold">
                                            {(user.first_name || user.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-white font-medium flex items-center gap-2">
                                            {user.first_name || user.last_name
                                                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                                : user.email}
                                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#d3da0c]">
                                                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        </p>
                                        <p className="text-gray-500 text-xs">
                                            {user.email} • {user.issued_at ? t('admin.verificationCenter.issuedAgo', { time: formatTimeAgo(user.issued_at) }) : t('admin.verificationCenter.badgeActive')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleBadge(user.id, true)}
                                    disabled={badgeActionLoading === user.id}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                >
                                    {badgeActionLoading === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        t('admin.verificationCenter.removeButton')
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Award className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm">{t('admin.verificationCenter.noVerifiedUsersYet')}</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display text-white mb-2">{t('admin.verificationCenter.title')}</h1>
                    <p className="text-gray-400">{t('admin.verificationCenter.subtitle')}</p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl">
                    {(['documents', 'badges'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                                activeTab === tab ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {tab === 'documents' ? t('admin.verificationCenter.tabDocuments') : t('admin.verificationCenter.tabBadges')}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'badges' ? (
                renderBadgeManagement()
            ) : (
                <>
                    <div className="flex bg-white/5 p-1 rounded-xl w-fit">
                        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {t(`admin.verificationCenter.filter.${f}`)}
                            </button>
                        ))}
                    </div>

                    {isLoadingRequests && verificationRequests.length === 0 ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                        </div>
                    ) : (
                        <div className="grid lg:grid-cols-3 gap-8">
                            {/* Requests List */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="relative mb-6">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder={t('admin.verificationCenter.searchEntitiesPlaceholder')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-3">
                                    {filteredRequests.map((req) => (
                                        <motion.div
                                            key={req.id}
                                            layout
                                            onClick={() => setSelectedRequest(req)}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedRequest?.id === req.id
                                                ? 'bg-[#d3da0c]/10 border-[#d3da0c]/30'
                                                : 'bg-white/5 border-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTypeColor(req.type)}`}>
                                                    {t(`admin.verificationCenter.entityType.${req.type}`)}
                                                </span>
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTimeAgo(req.submitted_at)}
                                                </span>
                                            </div>
                                            <h3 className="text-white font-medium">{req.name}</h3>
                                            <div className="mt-3 flex items-center justify-between">
                                                <span className="text-xs text-gray-500">{t('admin.verificationCenter.documentsCount', { count: req.documents?.length || 0 })}</span>
                                                <ArrowRight className={`w-4 h-4 transition-transform ${selectedRequest?.id === req.id ? 'translate-x-1 text-[#d3da0c]' : 'text-gray-600'}`} />
                                            </div>
                                        </motion.div>
                                    ))}
                                    {filteredRequests.length === 0 && (
                                        <div className="text-center py-12 glass rounded-2xl">
                                            <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                            <p className="text-gray-500 text-sm">{t('admin.verificationCenter.noVerificationRequestsFound')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Review Panel */}
                            <div className="lg:col-span-2">
                                {selectedRequest ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        key={selectedRequest.id}
                                        className="glass rounded-3xl p-8 sticky top-24 border border-white/10"
                                    >
                                        <div className="flex items-start justify-between mb-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d3da0c] to-blue-500 flex items-center justify-center text-black font-display text-2xl">
                                                    {selectedRequest.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-display text-white">{selectedRequest.name}</h2>
                                                    <p className="text-gray-400 flex items-center gap-2">
                                                        <span className="capitalize">{selectedRequest.type}</span>
                                                        {selectedRequest.email && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-xs">{selectedRequest.email}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 ${
                                                selectedRequest.status === 'pending' ? 'bg-orange-500/10 text-orange-500' :
                                                selectedRequest.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                                'bg-red-500/10 text-red-500'
                                            }`}>
                                                <Clock className="w-4 h-4" />
                                                {t(`admin.verificationCenter.status.${selectedRequest.status}`)}
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <h3 className="text-white font-semibold flex items-center gap-2">
                                                    <FileText className="w-5 h-5 text-blue-400" />
                                                    {t('admin.verificationCenter.submittedDocuments')}
                                                </h3>
                                                <div className="space-y-3">
                                                    {selectedRequest.documents?.map((doc, idx) => (
                                                        <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                                                                    <FileText className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-white text-sm block">{doc.title}</span>
                                                                    <span className="text-gray-500 text-xs uppercase">{doc.type}</span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => openDocument(doc.url)}
                                                                className="text-gray-500 group-hover:text-[#d3da0c] transition-colors"
                                                                title={t('admin.verificationCenter.viewDocumentTitle')}
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(!selectedRequest.documents || selectedRequest.documents.length === 0) && (
                                                        <p className="text-gray-500 text-sm">{t('admin.verificationCenter.noDocumentsSubmitted')}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <h3 className="text-white font-semibold flex items-center gap-2">
                                                    <ShieldAlert className="w-5 h-5 text-orange-400" />
                                                    {t('admin.verificationCenter.verificationActions')}
                                                </h3>
                                                <div className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                                                    <p className="text-gray-400 text-sm leading-relaxed">
                                                        {t('admin.verificationCenter.approvalHintPrefix')} <span className="text-[#d3da0c] font-bold">{t('admin.verificationCenter.verifiedCheckmark')}</span> {t('admin.verificationCenter.approvalHintSuffix')}
                                                    </p>
                                                    <div className="pt-4 flex flex-col gap-3">
                                                        <button
                                                            onClick={() => handleApprove(selectedRequest.id)}
                                                            disabled={selectedRequest.status === 'approved' || actionLoading === `approve-${selectedRequest.id}`}
                                                            className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            {actionLoading === `approve-${selectedRequest.id}` ? (
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                            ) : (
                                                                <UserCheck className="w-5 h-5" />
                                                            )}
                                                            {selectedRequest.status === 'approved' ? t('admin.verificationCenter.alreadyApproved') : t('admin.verificationCenter.approveAndBadgeEntity')}
                                                        </button>
                                                        <button
                                                            onClick={openRejectModal}
                                                            disabled={selectedRequest.status === 'rejected'}
                                                            className="w-full py-3 bg-red-500/10 text-red-500 font-bold border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                            {selectedRequest.status === 'rejected' ? t('admin.verificationCenter.alreadyRejected') : t('admin.verificationCenter.rejectVerification')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedRequest.notes && (
                                            <div className="mt-8 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                                <p className="text-red-400 text-xs font-bold uppercase mb-1">{t('admin.verificationCenter.rejectionReasonLabel')}</p>
                                                <p className="text-gray-400 text-sm">{selectedRequest.notes}</p>
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <div className="h-full min-h-[400px] glass rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center p-12">
                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                            <ShieldCheck className="w-10 h-10 text-gray-500" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-white mb-2">{t('admin.verificationCenter.selectRequestToReview')}</h2>
                                        <p className="text-gray-500 max-w-sm">
                                            {t('admin.verificationCenter.selectRequestHint')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Reject Modal */}
                    {showRejectModal && selectedRequest && (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                            <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-md">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-semibold text-white">{t('admin.verificationCenter.rejectVerificationModalTitle')}</h3>
                                    <button
                                        onClick={() => setShowRejectModal(false)}
                                        className="p-2 hover:bg-white/10 rounded-lg"
                                    >
                                        <X className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">{t('admin.verificationCenter.rejectionReasonLabel')}</label>
                                        <textarea
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none resize-none"
                                            placeholder={t('admin.verificationCenter.rejectionReasonPlaceholder')}
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowRejectModal(false)}
                                            className="flex-1 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-colors"
                                        >
                                            {t('admin.verificationCenter.cancelButton')}
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            disabled={actionLoading === `reject-${selectedRequest.id}`}
                                            className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {actionLoading === `reject-${selectedRequest.id}` ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : null}
                                            {t('admin.verificationCenter.rejectButton')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default VerificationCenter;
