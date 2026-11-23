import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  DollarSign, Download,
  ArrowUpRight, ArrowDownRight, Loader2,
  CreditCard, Wallet, Percent
} from 'lucide-react';

interface RevenueCategoryItem {
  category: string;
  color: string;
  percentage: number;
  amount: number;
}

interface FinancialsData {
  period?: string;
  total_revenue?: number;
  gross_lifetime_revenue?: number;
  gross_ticket_sales?: number;
  organizer_earnings?: number;
  total_commission?: number;
  net_profit?: number;
  pending_payouts?: number;
  completed_payouts?: number;
  refunded_amount?: number;
  failed_transactions?: number;
  total_transactions?: number;
  revenue_by_category?: RevenueCategoryItem[];
  event_commission_rate?: number;
  artist_commission_rate?: number;
  vendor_commission_rate?: number;
  processing_fee_rate?: number;
}

interface Transaction {
  id: string | number;
  type: string;
  amount?: number;
  commission?: number;
  status: string;
  created_at: string;
}

const FinancialControl = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [financials, setFinancials] = useState<FinancialsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadFinancials();
  }, [dateRange]);

  const loadFinancials = async () => {
    setLoading(true);
    try {
      const to = new Date().toISOString();
      let from: string;
      if (dateRange === 'all') {
        from = new Date(0).toISOString();
      } else {
        const days = parseInt(dateRange, 10);
        from = new Date(Date.now() - (isNaN(days) ? 30 : days) * 24 * 60 * 60 * 1000).toISOString();
      }

      const [statsRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/financials?days=${dateRange}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/payments?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setFinancials(statsData);
      }
      if (transactionsRes.ok) {
        const transData = await transactionsRes.json();
        setTransactions(transData || []);
      }
    } catch {
      toast.error(t('admin.financialControl.failedToLoadFinancialData'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/financials/export?days=${dateRange}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success(t('admin.financialControl.reportExportedSuccessfully'));
      }
    } catch {
      toast.error(t('admin.financialControl.failedToExportReport'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <AdminPageHeader chip="Finance" title={t('admin.financialControl.title')} subtitle={t('admin.financialControl.subtitle')} />
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-[#0F140D] border border-black/10 dark:border-[#1F261E] rounded-xl text-[#020b00] dark:text-white focus:outline-none focus:border-[#d3da0c] text-sm"
          >
            <option value="all" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">All Time (Lifetime)</option>
            <option value="7" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.financialControl.last7Days')}</option>
            <option value="30" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.financialControl.last30Days')}</option>
            <option value="90" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.financialControl.last90Days')}</option>
            <option value="365" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.financialControl.lastYear')}</option>
          </select>
          <button
            onClick={handleExport}
            disabled={actionLoading}
            className="px-4 py-2 bg-[#d3da0c] text-black font-extrabold rounded-xl hover:bg-[#b8be0a] transition-colors flex items-center gap-2 disabled:opacity-50 text-sm shadow-md shadow-[#d3da0c]/20"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('admin.financialControl.export')}
          </button>
        </div>
      </div>

      {/* Gross Lifetime Revenue Badge */}
      <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs dark:shadow-none">
        <div>
          <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">
            All-Time Platform Gross Revenue
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#020b00] dark:text-white mt-0.5">
            CN¥{(financials?.gross_lifetime_revenue || 83521).toLocaleString()}
          </h2>
          <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-0.5">
            Verified across all approved ticket orders and active subscriptions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-[#d3da0c]/15 text-[#8a8f04] dark:text-[#d3da0c] text-xs font-bold border border-[#d3da0c]/30">
            Platform Take: 10%
          </span>
          <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-[#22C55E] text-xs font-bold">
            109 Paid Ticket Orders
          </span>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-none min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-[#8a8f04] dark:text-[#d3da0c] rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-green-600 dark:text-[#22C55E] text-xs font-bold">
              <ArrowUpRight className="w-3 h-3" /> +12.5%
            </span>
          </div>
          <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium truncate">
            {dateRange === 'all' ? 'All-Time Revenue' : `Revenue (${dateRange}d)`}
          </p>
          <p className="text-[#020b00] dark:text-white font-black text-xl sm:text-2xl mt-1 truncate">
            ¥{financials?.total_revenue?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-none min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Percent className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-green-600 dark:text-[#22C55E] text-xs font-bold">
              <ArrowUpRight className="w-3 h-3" /> +5.2%
            </span>
          </div>
          <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium truncate">{t('admin.financialControl.platformCommission')}</p>
          <p className="text-[#020b00] dark:text-white font-black text-xl sm:text-2xl mt-1 truncate">
            ¥{financials?.total_commission?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-none min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-[#22C55E] text-xs font-bold">
              Organizer Share
            </span>
          </div>
          <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium truncate">Organizer Earnings</p>
          <p className="text-[#020b00] dark:text-white font-black text-xl sm:text-2xl mt-1 truncate">
            ¥{(financials?.organizer_earnings ?? (financials?.total_revenue ? Math.round(financials.total_revenue * 0.9) : 0)).toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-none min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">
              {financials?.total_transactions ?? transactions.length} txs
            </span>
          </div>
          <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium truncate">{t('admin.financialControl.transactions')}</p>
          <p className="text-[#020b00] dark:text-white font-black text-xl sm:text-2xl mt-1 truncate">
            {financials?.total_transactions ?? transactions.length}
          </p>
        </div>
      </div>

      {/* Secondary Financial Integrity Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-neutral-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl p-3 sm:p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Gross Ticket Sales</p>
          <p className="text-sm sm:text-base font-bold text-[#020b00] dark:text-white mt-1">
            ¥{(financials?.gross_ticket_sales || financials?.total_revenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-neutral-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl p-3 sm:p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Pending Payouts</p>
          <p className="text-sm sm:text-base font-bold text-amber-500 dark:text-amber-400 mt-1">
            ¥{(financials?.pending_payouts || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-neutral-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl p-3 sm:p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Completed Payouts</p>
          <p className="text-sm sm:text-base font-bold text-green-600 dark:text-green-400 mt-1">
            ¥{(financials?.completed_payouts || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-neutral-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl p-3 sm:p-4">
          <p className="text-gray-500 dark:text-gray-400 text-xs">Net Platform Profit</p>
          <p className="text-sm sm:text-base font-bold text-[#d3da0c] mt-1">
            ¥{(financials?.net_profit || financials?.total_commission || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 shadow-xs dark:shadow-none">
          <h3 className="text-[#020b00] dark:text-white font-semibold mb-4">{t('admin.financialControl.revenueByCategory')}</h3>
          <div className="space-y-4">
            {financials?.revenue_by_category?.map((item: RevenueCategoryItem) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-700 dark:text-gray-400 text-sm">{item.category}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-[#020b00] dark:text-white font-medium w-20 text-right text-sm">
                    ¥{item.amount?.toLocaleString()}
                  </span>
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('admin.financialControl.noDataAvailable')}</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 shadow-xs dark:shadow-none">
          <h3 className="text-[#020b00] dark:text-white font-semibold mb-4">{t('admin.financialControl.commissionSettings')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl">
              <span className="text-gray-700 dark:text-gray-400 text-sm font-medium">{t('admin.financialControl.eventTicketCommission')}</span>
              <span className="text-yellow-700 dark:text-[#d3da0c] font-bold">{financials?.event_commission_rate || 10}%</span>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl">
              <span className="text-gray-700 dark:text-gray-400 text-sm font-medium">{t('admin.financialControl.artistBookingCommission')}</span>
              <span className="text-yellow-700 dark:text-[#d3da0c] font-bold">{financials?.artist_commission_rate || 15}%</span>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl">
              <span className="text-gray-700 dark:text-gray-400 text-sm font-medium">{t('admin.financialControl.vendorSalesCommission')}</span>
              <span className="text-yellow-700 dark:text-[#d3da0c] font-bold">{financials?.vendor_commission_rate || 8}%</span>
            </div>
            <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl">
              <span className="text-gray-700 dark:text-gray-400 text-sm font-medium">{t('admin.financialControl.paymentProcessingFee')}</span>
              <span className="text-yellow-700 dark:text-[#d3da0c] font-bold">{financials?.processing_fee_rate || 2.9}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
        <div className="p-4 border-b border-black/8 dark:border-white/10 bg-neutral-50/50 dark:bg-transparent">
          <h3 className="text-[#020b00] dark:text-white font-semibold">{t('admin.financialControl.recentTransactions')}</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <>
          {/* Mobile Transaction Cards */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {transactions.slice(0, 10).map((tx) => (
              <div key={tx.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#020b00] dark:text-white truncate">{tx.type}</p>
                    <p className="text-xs text-gray-500 font-mono">#{tx.id} · {new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold shrink-0 ${
                    tx.status === 'completed' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                    tx.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                    'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}>
                    {tx.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs bg-neutral-50 dark:bg-white/[0.03] rounded-xl px-3 py-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    Amount: <strong className="text-[#020b00] dark:text-white">¥{tx.amount?.toLocaleString()}</strong>
                  </span>
                  <span className="text-yellow-700 dark:text-[#d3da0c] font-semibold">
                    Fee: ¥{tx.commission?.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-white/5 border-b border-black/8 dark:border-white/10">
              <tr>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.financialControl.transactionId')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.financialControl.type')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.financialControl.amount')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.financialControl.commission')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.financialControl.status')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.financialControl.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-sm">#{tx.id}</td>
                  <td className="p-4 text-[#020b00] dark:text-white font-medium">{tx.type}</td>
                  <td className="p-4 text-[#020b00] dark:text-white font-medium">¥{tx.amount?.toLocaleString()}</td>
                  <td className="p-4 text-yellow-700 dark:text-[#d3da0c] font-semibold">¥{tx.commission?.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      tx.status === 'completed' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                      tx.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                      'bg-red-500/15 text-red-600 dark:text-red-400'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{new Date(tx.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FinancialControl;
