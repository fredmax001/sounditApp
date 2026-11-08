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
  total_revenue?: number;
  total_commission?: number;
  net_profit?: number;
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
    try {
      const days = parseInt(dateRange, 10);
      const to = new Date().toISOString();
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

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
            className="px-4 py-2 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white focus:outline-none focus:border-[#d3da0c] text-sm"
          >
            <option value="7" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.financialControl.last7Days')}</option>
            <option value="30" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.financialControl.last30Days')}</option>
            <option value="90" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.financialControl.last90Days')}</option>
            <option value="365" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.financialControl.lastYear')}</option>
          </select>
          <button
            onClick={handleExport}
            disabled={actionLoading}
            className="px-4 py-2 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:bg-neutral-800 dark:hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('admin.financialControl.export')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c] rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
              <ArrowUpRight className="w-3 h-3" /> +12.5%
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.financialControl.totalRevenue')}</p>
          <p className="text-[#020b00] dark:text-white font-bold text-2xl mt-1">
            ¥{financials?.total_revenue?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Percent className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-semibold">
              <ArrowUpRight className="w-3 h-3" /> +5.2%
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.financialControl.platformCommission')}</p>
          <p className="text-[#020b00] dark:text-white font-bold text-2xl mt-1">
            ¥{financials?.total_commission?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-red-500 text-xs font-semibold">
              <ArrowDownRight className="w-3 h-3" /> -2.1%
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.financialControl.netProfit')}</p>
          <p className="text-[#020b00] dark:text-white font-bold text-2xl mt-1">
            ¥{financials?.net_profit?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-5 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">{transactions.length} txs</span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.financialControl.transactions')}</p>
          <p className="text-[#020b00] dark:text-white font-bold text-2xl mt-1">{transactions.length}</p>
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
        )}
      </div>
    </div>
  );
};

export default FinancialControl;
