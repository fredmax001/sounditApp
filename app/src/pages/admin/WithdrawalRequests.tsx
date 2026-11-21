import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Banknote, Search, Check, X, Clock, Loader2,
  Wallet, User, Building2, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';

interface Withdrawal {
  id: number;
  business_id?: number;
  business_name?: string;
  user_id?: number;
  user_name: string;
  user_email?: string;
  amount: number;
  payment_method: string;
  account_details?: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
}

interface WithdrawalStats {
  pending_count?: number;
  pending_amount?: number;
  processed_today?: number;
  total_processed_30d?: number;
}

const WithdrawalRequests = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<WithdrawalStats>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reject Modal state
  const [rejectingItem, setRejectingItem] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      const [withdrawalsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/withdrawals`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/withdrawals/stats`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (withdrawalsRes.ok) {
        const data = await withdrawalsRes.json();
        setWithdrawals(data.withdrawals || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch {
      toast.error(t('admin.withdrawalRequests.failedToLoadWithdrawalRequests') || 'Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.withdrawalRequests.withdrawalApproved') || 'Withdrawal approved successfully');
        await loadWithdrawals();
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to approve' }));
        toast.error(err.detail || 'Failed to approve withdrawal');
      }
    } catch {
      toast.error(t('admin.withdrawalRequests.failedToApproveWithdrawal') || 'Network error approving withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    const id = rejectingItem.id;
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      if (res.ok) {
        toast.success(t('admin.withdrawalRequests.withdrawalRejected') || 'Withdrawal rejected successfully');
        setRejectingItem(null);
        setRejectReason('');
        await loadWithdrawals();
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to reject' }));
        toast.error(err.detail || 'Failed to reject withdrawal');
      }
    } catch {
      toast.error(t('admin.withdrawalRequests.failedToRejectWithdrawal') || 'Network error rejecting withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      w.user_name?.toLowerCase().includes(query) ||
      w.business_name?.toLowerCase().includes(query) ||
      w.user_email?.toLowerCase().includes(query) ||
      w.account_details?.toLowerCase().includes(query) ||
      w.id?.toString().includes(query);
    const matchesStatus = !statusFilter || w.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader chip="Finance" title={t('admin.withdrawalRequests.title') || 'Withdrawal Requests'} subtitle={t('admin.withdrawalRequests.subtitle') || 'Review, approve, or reject business organizer payout requests.'} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c] rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.pendingRequests') || 'Pending Requests'}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">{stats.pending_count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.pendingAmount') || 'Pending Amount'}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                ¥{(stats.pending_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.processedToday') || 'Processed Today'}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">{stats.processed_today || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.totalProcessed30d') || 'Total 30d Processed'}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                ¥{(stats.total_processed_30d || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.withdrawalRequests.searchPlaceholder') || 'Search by business, user name, email, or account...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] focus:outline-none"
        >
          <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">All Statuses</option>
          <option value="pending" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Pending</option>
          <option value="approved" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Approved</option>
          <option value="completed" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Completed</option>
          <option value="rejected" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Rejected</option>
        </select>
      </div>

      {/* Withdrawals Table / Mobile Cards */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No payout requests found.</p>
          </div>
        ) : (
          <>
          {/* Mobile Payout Cards */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {filteredWithdrawals.map((w) => (
              <div key={w.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-neutral-100 dark:bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                      {w.business_name ? (
                        <Building2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#020b00] dark:text-white font-semibold text-sm truncate">
                        {w.business_name || w.user_name}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                        #{w.id} · {w.created_at ? new Date(w.created_at).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold capitalize shrink-0 ${
                    w.status === 'completed' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                    w.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                    w.status === 'approved' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' :
                    'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}>
                    {w.status}
                  </span>
                </div>

                <div className="flex items-center justify-between bg-neutral-50 dark:bg-white/[0.03] rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#020b00] dark:text-white capitalize">
                      {(w.payment_method || '').replace(/_/g, ' ')}
                    </p>
                    {w.account_details && (
                      <p className="text-[0.6875rem] text-gray-500 dark:text-gray-400 truncate max-w-[11rem]">
                        {w.account_details}
                      </p>
                    )}
                  </div>
                  <p className="text-base font-extrabold text-[#020b00] dark:text-[#d3da0c] shrink-0">
                    ¥{(w.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {w.rejection_reason && (
                  <p className="text-red-400 text-xs italic">Reason: {w.rejection_reason}</p>
                )}

                {w.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      onClick={() => handleApprove(w.id)}
                      disabled={actionLoading === `approve-${w.id}`}
                      className="py-2.5 px-3 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      {actionLoading === `approve-${w.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingItem(w)}
                      disabled={actionLoading === `reject-${w.id}`}
                      className="py-2.5 px-3 bg-red-500/15 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-white/5 border-b border-black/8 dark:border-white/10">
                <tr>
                  <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">ID</th>
                  <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Business & User</th>
                  <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Amount</th>
                  <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Method & Account</th>
                  <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Status</th>
                  <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Requested Date</th>
                  <th className="text-right text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">#{w.id}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-neutral-100 dark:bg-white/10 rounded-full flex items-center justify-center shrink-0">
                          {w.business_name ? (
                            <Building2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-[#020b00] dark:text-white font-semibold text-xs sm:text-sm">
                            {w.business_name || w.user_name}
                          </p>
                          {w.business_name && w.user_name && w.business_name !== w.user_name && (
                            <p className="text-gray-500 text-[0.6875rem]">Requested by: {w.user_name}</p>
                          )}
                          {w.user_email && (
                            <p className="text-gray-400 text-[0.6875rem] truncate max-w-[12.5rem]">{w.user_email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[#020b00] dark:text-white font-bold text-sm">
                        ¥{(w.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-[#020b00] dark:text-white font-medium text-xs capitalize">
                        {(w.payment_method || '').replace(/_/g, ' ')}
                      </p>
                      {w.account_details && (
                        <p className="text-gray-500 dark:text-gray-400 text-[0.6875rem] truncate max-w-[13.75rem]">
                          {w.account_details}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        w.status === 'completed' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                        w.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                        w.status === 'approved' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' :
                        'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}>
                        {w.status}
                      </span>
                      {w.rejection_reason && (
                        <p className="text-red-400 text-[0.625rem] mt-1 italic max-w-[9.375rem] truncate" title={w.rejection_reason}>
                          {w.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 text-xs">
                      {w.created_at ? new Date(w.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {w.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(w.id)}
                              disabled={actionLoading === `approve-${w.id}`}
                              className="px-3 py-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 rounded-xl font-medium text-xs flex items-center gap-1 transition-colors"
                              title="Approve Withdrawal"
                            >
                              {actionLoading === `approve-${w.id}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingItem(w)}
                              disabled={actionLoading === `reject-${w.id}`}
                              className="px-3 py-1.5 bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 rounded-xl font-medium text-xs flex items-center gap-1 transition-colors"
                              title="Reject Withdrawal"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                        {w.status === 'approved' && (
                          <span className="text-xs text-blue-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                        )}
                        {w.status === 'completed' && (
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                          </span>
                        )}
                        {w.status === 'rejected' && (
                          <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl p-6 w-full max-w-md text-[#020b00] dark:text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Reject Payout Request #{rejectingItem.id}</h3>
              <button
                onClick={() => {
                  setRejectingItem(null);
                  setRejectReason('');
                }}
                className="p-1 text-gray-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Rejecting withdrawal of <span className="font-bold text-[#020b00] dark:text-white">¥{rejectingItem.amount?.toLocaleString()}</span> for <span className="font-semibold">{rejectingItem.business_name || rejectingItem.user_name}</span>. Please specify the reason.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid WeChat ID, account name mismatch, or requires banking verification..."
              rows={3}
              className="w-full bg-neutral-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl p-3 text-xs text-[#020b00] dark:text-white placeholder-gray-400 focus:outline-none focus:border-red-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  setRejectingItem(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 bg-neutral-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={actionLoading === `reject-${rejectingItem.id}` || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading === `reject-${rejectingItem.id}` && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WithdrawalRequests;
