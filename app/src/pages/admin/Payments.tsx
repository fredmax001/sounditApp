import { useState, useEffect } from 'react';
import {
    CreditCard,
    Wallet,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Check,
    Loader2,
    Eye,
    Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface Payout {
    id: string;
    targetName: string;
    targetType: string;
    eventName: string;
    city: string;
    amount: number;
    commission: number;
    status: 'pending' | 'approved' | 'released' | 'rejected';
    created_at: string;
    bankAccount?: string;
    transactionId?: string;
}

const Payments = () => {
    const { t } = useTranslation();
    const { session } = useAuthStore();
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [escrowBalance, setEscrowBalance] = useState(0);
    const [releasedTotal, setReleasedTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'released' | 'rejected'>('all');
    const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

    useEffect(() => {
        loadPayouts();
    }, []);

    const loadPayouts = async () => {
        setIsLoading(true);
        try {
            const token = session?.access_token;
            
            // Fetch payouts
            const payoutsRes = await fetch(`${API_BASE_URL}/admin/payouts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (payoutsRes.ok) {
                const data = await payoutsRes.json();
                setPayouts(data.payouts || []);
                setEscrowBalance(data.escrow_balance || 0);
                setReleasedTotal(data.released_total || 0);
            } else {
                toast.error(t('admin.payments.failedToLoadPayouts'));
            }
        } catch {
            toast.error(t('admin.payments.networkError'));
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPayouts = payouts.filter(p => filter === 'all' || p.status === filter);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'text-orange-500 bg-orange-500/10';
            case 'approved': return 'text-blue-500 bg-blue-500/10';
            case 'released': return 'text-green-500 bg-green-500/10';
            case 'rejected': return 'text-red-500 bg-red-500/10';
            default: return 'text-gray-500 bg-white/5';
        }
    };

    const handleApprovePayout = async (payoutId: string) => {
        setActionLoading(`approve-${payoutId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success(t('admin.payments.payoutApprovedForRelease'));
                loadPayouts();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.payments.failedToApprovePayout'));
            }
        } catch {
            toast.error(t('admin.payments.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectPayout = async (payoutId: string) => {
        const reason = prompt(t('admin.payments.rejectionReasonPrompt'));
        if (reason === null) return;

        setActionLoading(`reject-${payoutId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: reason || undefined })
            });

            if (res.ok) {
                toast.success(t('admin.payments.payoutRejected'));
                loadPayouts();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.payments.failedToRejectPayout'));
            }
        } catch {
            toast.error(t('admin.payments.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleReleasePayout = async (payoutId: string) => {
        if (!confirm(t('admin.payments.confirmReleaseFunds'))) {
            return;
        }

        setActionLoading(`release-${payoutId}`);
        try {
            const token = session?.access_token;
            const res = await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}/release`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success(t('admin.payments.fundsReleased'));
                loadPayouts();
            } else {
                const err = await res.json();
                toast.error(err.detail || t('admin.payments.failedToReleaseFunds'));
            }
        } catch {
            toast.error(t('admin.payments.networkError'));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display text-white mb-2">{t('admin.payments.title')}</h1>
                    <p className="text-gray-400">{t('admin.payments.subtitle')}</p>
                </div>
                <button
                    onClick={() => toast.info(t('admin.payments.exportNotImplemented'))}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm hover:bg-white/10 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    {t('admin.payments.export')}
                </button>
            </div>

            {/* Financial Overview */}
            <div className="grid sm:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-6 border-l-4 border-[#d3da0c]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-[#d3da0c]/10 text-[#d3da0c]">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <p className="text-gray-400 text-xs uppercase tracking-wider">{t('admin.payments.escrowBalanceLabel')}</p>
                    </div>
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    ) : (
                        <p className="text-3xl font-display text-white">¥{escrowBalance.toLocaleString()}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500">
                        <Clock className="w-3 h-3" />
                        {t('admin.payments.escrowBalanceHint')}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                            <ArrowUpRight className="w-5 h-5" />
                        </div>
                        <p className="text-gray-400 text-xs uppercase tracking-wider">{t('admin.payments.lifetimeReleasedLabel')}</p>
                    </div>
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                    ) : (
                        <p className="text-3xl font-display text-white">¥{releasedTotal.toLocaleString()}</p>
                    )}
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                            <Clock className="w-5 h-5" />
                        </div>
                        <p className="text-gray-400 text-xs uppercase tracking-wider">{t('admin.payments.awaitingActionLabel')}</p>
                    </div>
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    ) : (
                        <p className="text-3xl font-display text-white">
                            {payouts.filter(p => p.status === 'pending').length} {t('admin.payments.payoutsCount')}
                        </p>
                    )}
                </div>
            </div>

            {/* Payout Approval Dashboard */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold text-white">{t('admin.payments.payoutApprovalDashboard')}</h2>
                    <div className="flex items-center gap-3">
                        <div className="flex rounded-lg bg-white/5 p-1">
                            {(['all', 'pending', 'approved', 'released', 'rejected'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {t(`admin.payments.filter.${f}`)}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={loadPayouts}
                            disabled={isLoading}
                            className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {isLoading && payouts.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/5">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.payments.entityEventHeader')}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.payments.cityHeader')}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.payments.financialBreakdownHeader')}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('admin.payments.statusHeader')}</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">{t('admin.payments.actionsHeader')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <AnimatePresence mode="popLayout">
                                    {filteredPayouts.map((payout) => (
                                        <motion.tr
                                            key={payout.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="hover:bg-white/5 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-white font-medium text-sm">{payout.targetName}</p>
                                                    <p className="text-[#d3da0c] text-xs uppercase tracking-tight font-bold">{payout.targetType}</p>
                                                    <p className="text-gray-500 text-xs mt-1">{payout.eventName}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-400 text-sm capitalize">{payout.city}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-white font-display text-lg">¥{payout.amount.toLocaleString()}</p>
                                                    <p className="text-gray-500 text-[10px] uppercase">{t('admin.payments.commissionLabel', { amount: payout.commission.toLocaleString() })}</p>
                                                    <p className="text-gray-500 text-[10px] uppercase">{t('admin.payments.netLabel', { amount: (payout.amount - payout.commission).toLocaleString() })}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(payout.status)}`}>
                                                    {t(`admin.payments.status.${payout.status}`)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedPayout(payout)}
                                                        className="p-2 text-gray-500 hover:text-white transition-colors"
                                                        title={t('admin.payments.viewDetailsTitle')}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {payout.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprovePayout(payout.id)}
                                                                disabled={actionLoading === `approve-${payout.id}`}
                                                                className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                                                                title={t('admin.payments.approveForReleaseTitle')}
                                                            >
                                                                {actionLoading === `approve-${payout.id}` ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectPayout(payout.id)}
                                                                disabled={actionLoading === `reject-${payout.id}`}
                                                                className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                                title={t('admin.payments.rejectHoldTitle')}
                                                            >
                                                                {actionLoading === `reject-${payout.id}` ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <XCircle className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </>
                                                    )}
                                                    {payout.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleReleasePayout(payout.id)}
                                                            disabled={actionLoading === `release-${payout.id}`}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-[#d3da0c] text-black text-[10px] font-bold rounded uppercase hover:bg-white transition-colors disabled:opacity-50"
                                                        >
                                                            {actionLoading === `release-${payout.id}` ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Check className="w-3 h-3" />
                                                            )}
                                                            {t('admin.payments.releaseFunds')}
                                                        </button>
                                                    )}
                                                    {payout.status === 'released' && (
                                                        <span className="text-green-500 p-2">
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                        {filteredPayouts.length === 0 && (
                            <div className="p-12 text-center">
                                <CreditCard className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500">{t('admin.payments.noPayoutsFound')}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Payout Detail Modal */}
            {selectedPayout && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111111] border border-white/10 rounded-xl p-6 w-full max-w-lg">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">{t('admin.payments.payoutDetailsTitle')}</h3>
                            <button 
                                onClick={() => setSelectedPayout(null)}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <XCircle className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">{t('admin.payments.entityLabel')}</p>
                                    <p className="text-white font-medium">{selectedPayout.targetName}</p>
                                    <p className="text-[#d3da0c] text-xs">{selectedPayout.targetType}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">{t('admin.payments.eventLabel')}</p>
                                    <p className="text-white font-medium">{selectedPayout.eventName}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">{t('admin.payments.amountLabel')}</p>
                                    <p className="text-white font-display text-xl">¥{selectedPayout.amount.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">{t('admin.payments.commissionDetailLabel')}</p>
                                    <p className="text-gray-400">¥{selectedPayout.commission.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">{t('admin.payments.netPayoutLabel')}</span>
                                    <span className="text-[#d3da0c] font-display text-xl">
                                        ¥{(selectedPayout.amount - selectedPayout.commission).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase">{t('admin.payments.statusLabel')}</p>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(selectedPayout.status)}`}>
                                    {t(`admin.payments.status.${selectedPayout.status}`)}
                                </span>
                            </div>
                            {selectedPayout.bankAccount && (
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">{t('admin.payments.bankAccountLabel')}</p>
                                    <p className="text-white text-sm">{selectedPayout.bankAccount}</p>
                                </div>
                            )}
                            {selectedPayout.transactionId && (
                                <div>
                                    <p className="text-gray-500 text-xs uppercase">{t('admin.payments.transactionIdLabel')}</p>
                                    <p className="text-white text-sm font-mono">{selectedPayout.transactionId}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-gray-500 text-xs uppercase">{t('admin.payments.createdLabel')}</p>
                                <p className="text-gray-400 text-sm">
                                    {new Date(selectedPayout.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payments;
