import { useState, useEffect } from 'react';
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
      const [statsRes, transactionsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/financials?days=${dateRange}`, {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }),
        fetch(`${API_BASE_URL}/admin/payments?days=${dateRange}`, {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.financialControl.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.financialControl.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
          >
            <option value="7">{t('admin.financialControl.last7Days')}</option>
            <option value="30">{t('admin.financialControl.last30Days')}</option>
            <option value="90">{t('admin.financialControl.last90Days')}</option>
            <option value="365">{t('admin.financialControl.lastYear')}</option>
          </select>
          <button
            onClick={handleExport}
            disabled={actionLoading}
            className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('admin.financialControl.export')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <ArrowUpRight className="w-3 h-3" /> +12.5%
            </span>
          </div>
          <p className="text-gray-400 text-xs">{t('admin.financialControl.totalRevenue')}</p>
          <p className="text-white font-bold text-2xl">
            ¥{financials?.total_revenue?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Percent className="w-5 h-5 text-blue-400" />
            </div>
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <ArrowUpRight className="w-3 h-3" /> +5.2%
            </span>
          </div>
          <p className="text-gray-400 text-xs">{t('admin.financialControl.platformCommission')}</p>
          <p className="text-white font-bold text-2xl">
            ¥{financials?.total_commission?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <span className="flex items-center gap-1 text-red-400 text-xs">
              <ArrowDownRight className="w-3 h-3" /> -2.1%
            </span>
          </div>
          <p className="text-gray-400 text-xs">{t('admin.financialControl.netProfit')}</p>
          <p className="text-white font-bold text-2xl">
            ¥{financials?.net_profit?.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-gray-500 text-xs">{transactions.length} txs</span>
          </div>
          <p className="text-gray-400 text-xs">{t('admin.financialControl.transactions')}</p>
          <p className="text-white font-bold text-2xl">{transactions.length}</p>
        </div>
      </div>

      {/* Commission Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">{t('admin.financialControl.revenueByCategory')}</h3>
          <div className="space-y-4">
            {financials?.revenue_by_category?.map((item: RevenueCategoryItem) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-400 text-sm">{item.category}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-white font-medium w-20 text-right">
                    ¥{item.amount?.toLocaleString()}
                  </span>
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-gray-500">{t('admin.financialControl.noDataAvailable')}</div>
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">{t('admin.financialControl.commissionSettings')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 text-sm">{t('admin.financialControl.eventTicketCommission')}</span>
              <span className="text-[#d3da0c] font-bold">{financials?.event_commission_rate || 10}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 text-sm">{t('admin.financialControl.artistBookingCommission')}</span>
              <span className="text-[#d3da0c] font-bold">{financials?.artist_commission_rate || 15}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 text-sm">{t('admin.financialControl.vendorSalesCommission')}</span>
              <span className="text-[#d3da0c] font-bold">{financials?.vendor_commission_rate || 8}%</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <span className="text-gray-400 text-sm">{t('admin.financialControl.paymentProcessingFee')}</span>
              <span className="text-[#d3da0c] font-bold">{financials?.processing_fee_rate || 2.9}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-semibold">{t('admin.financialControl.recentTransactions')}</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.financialControl.transactionId')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.financialControl.type')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.financialControl.amount')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.financialControl.commission')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.financialControl.status')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.financialControl.date')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4 text-gray-400 font-mono text-sm">#{tx.id}</td>
                  <td className="p-4 text-white">{tx.type}</td>
                  <td className="p-4 text-white">¥{tx.amount?.toLocaleString()}</td>
                  <td className="p-4 text-[#d3da0c]">¥{tx.commission?.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</td>
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
