import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Banknote, Search, Check, X, Clock, Loader2,
  Wallet, User
} from 'lucide-react';

interface Withdrawal {
  id: number;
  user_name: string;
  amount: number;
  payment_method: string;
  status: string;
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
      toast.error(t('admin.withdrawalRequests.failedToLoadWithdrawalRequests'));
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
        toast.success(t('admin.withdrawalRequests.withdrawalApproved'));
        loadWithdrawals();
      }
    } catch {
      toast.error(t('admin.withdrawalRequests.failedToApproveWithdrawal'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t('admin.withdrawalRequests.rejectionReasonPrompt'));
    if (!reason) return;
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        toast.success(t('admin.withdrawalRequests.withdrawalRejected'));
        loadWithdrawals();
      }
    } catch {
      toast.error(t('admin.withdrawalRequests.failedToRejectWithdrawal'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesSearch = !searchQuery || 
      w.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.id?.toString().includes(searchQuery);
    const matchesStatus = !statusFilter || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader chip="Finance" title={t('admin.withdrawalRequests.title')} subtitle={t('admin.withdrawalRequests.subtitle')} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c] rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.pendingRequests')}</p>
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
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.pendingAmount')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                ¥{stats.pending_amount?.toLocaleString() || 0}
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
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.processedToday')}</p>
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
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.withdrawalRequests.totalProcessed30d')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                ¥{stats.total_processed_30d?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.withdrawalRequests.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] focus:outline-none"
        >
          <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.withdrawalRequests.allStatus')}</option>
          <option value="pending" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.withdrawalRequests.statusPending')}</option>
          <option value="approved" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.withdrawalRequests.statusApproved')}</option>
          <option value="rejected" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.withdrawalRequests.statusRejected')}</option>
          <option value="completed" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.withdrawalRequests.statusCompleted')}</option>
        </select>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-white/5 border-b border-black/8 dark:border-white/10">
              <tr>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.requestIdHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.userHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.amountHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.methodHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.statusHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.requestedHeader')}</th>
                <th className="text-right text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.withdrawalRequests.actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredWithdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-sm">#{w.id}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-100 dark:bg-white/10 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <span className="text-[#020b00] dark:text-white font-medium">{w.user_name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-[#020b00] dark:text-white font-medium">¥{w.amount?.toLocaleString()}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{w.payment_method}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      w.status === 'completed' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                      w.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                      w.status === 'approved' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' :
                      'bg-red-500/15 text-red-600 dark:text-red-400'
                    }`}>
                      {t(`admin.withdrawalRequests.status.${w.status}`)}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{new Date(w.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {w.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(w.id)}
                            disabled={actionLoading === `approve-${w.id}`}
                            className="p-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl hover:bg-green-500/20 transition-colors"
                          >
                            {actionLoading === `approve-${w.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={actionLoading === `reject-${w.id}`}
                            className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                          >
                            {actionLoading === `reject-${w.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WithdrawalRequests;
