import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useTranslation } from 'react-i18next';
import {
  Wallet, ArrowLeft, TrendingUp, DollarSign, Calendar,
  Download, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

const VendorEarnings = () => {
  useSubscriptionGuard('earnings');
  const { session } = useAuthStore();
  const { stats, fetchStats, isLoading } = useDashboardStore();
  const { t } = useTranslation();
  interface EarningsData {
    totalEarnings: number;
    thisMonth: number;
    lastMonth: number;
    pendingPayout: number;
    transactions: Record<string, unknown>[];
  }

  const earningsData = useMemo<EarningsData>(() => {
    if (stats?.vendor_stats) {
      const vendorStats = stats.vendor_stats;
      return {
        totalEarnings: vendorStats.total_sales || 0,
        thisMonth: (vendorStats as Record<string, number>).monthly_sales || 0,
        lastMonth: (vendorStats as Record<string, number>).last_month_sales || 0,
        pendingPayout: (vendorStats as Record<string, number>).pending_payout || 0,
        transactions: ((stats as unknown as Record<string, unknown>).activities as Record<string, unknown>[]) || []
      };
    }
    return {
      totalEarnings: 0,
      thisMonth: 0,
      lastMonth: 0,
      pendingPayout: 0,
      transactions: []
    };
  }, [stats]);

  useEffect(() => {
    if (session?.access_token) {
      fetchStats(session.access_token);
    }
  }, [session, fetchStats]);

  const handleExportReport = () => {
    try {
      // Create CSV content
      const csvHeaders = [t('vendor.earnings.csvDate'), t('vendor.earnings.csvType'), t('vendor.earnings.csvAmount'), t('vendor.earnings.csvStatus'), t('vendor.earnings.csvDescription')];
      const csvRows = [
        csvHeaders.join(','),
        ...earningsData.transactions.map((transaction) => [
          transaction.created_at || new Date().toISOString().split('T')[0],
          transaction.type || t('vendor.earnings.saleType'),
          transaction.amount || 0,
          transaction.status || t('vendor.earnings.statusCompleted'),
          transaction.description || t('vendor.earnings.defaultDescription')
        ].join(','))
      ];

      // Add summary data
      csvRows.push('');
      csvRows.push(t('vendor.earnings.csvSummary') + ',,,');
      csvRows.push(`Total Earnings,,¥${earningsData.totalEarnings},,`);
      csvRows.push(`This Month,,¥${earningsData.thisMonth},,`);
      csvRows.push(`Pending Payout,,¥${earningsData.pendingPayout},,`);

      const csvContent = csvRows.join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `vendor-earnings-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t('vendor.earnings.exportSuccess'));
    } catch (error) {
      toast.error(t('vendor.earnings.exportError'));
      console.error('Export error:', error);
    }
  };

  const statsCards = [
    {
      label: t('vendor.earnings.totalEarningsLabel'),
      value: `¥${earningsData.totalEarnings.toLocaleString()}`,
      icon: Wallet,
      color: 'text-[#d3da0c]',
      bgColor: 'bg-[#d3da0c]/10'
    },
    {
      label: t('vendor.earnings.thisMonthLabel'),
      value: `¥${earningsData.thisMonth.toLocaleString()}`,
      icon: Calendar,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: t('vendor.earnings.pendingPayoutLabel'),
      value: `¥${earningsData.pendingPayout.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10'
    },
    {
      label: t('vendor.earnings.growthLabel'),
      value: earningsData.lastMonth > 0
        ? `${Math.round(((earningsData.thisMonth - earningsData.lastMonth) / earningsData.lastMonth) * 100)}%`
        : t('vendor.earnings.na'),
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    }
  ];

  const [nextPayoutDate] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString());

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">{t('vendor.earnings.title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('vendor.earnings.subtitle')}</p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          onClick={handleExportReport}
        >
          <Download className="w-4 h-4" />
          {t('vendor.earnings.exportReport')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#111111] border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className="text-gray-400 text-sm font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-black text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Transactions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="bg-[#111111] border border-white/10 rounded-2xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-6">{t('vendor.earnings.recentTransactions')}</h3>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : earningsData.transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr className="text-gray-400 text-xs uppercase font-bold">
                  <th className="text-left py-4 px-4">{t('vendor.earnings.dateHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.earnings.descriptionHeader')}</th>
                  <th className="text-left py-4 px-4">{t('vendor.earnings.typeHeader')}</th>
                  <th className="text-right py-4 px-4">{t('vendor.earnings.amountHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {earningsData.transactions.slice(0, 10).map((transaction, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-4 text-gray-400 text-xs">
                      {transaction.created_at
                        ? new Date(transaction.created_at as string).toLocaleDateString()
                        : t('vendor.earnings.na')}
                    </td>
                    <td className="py-4 px-4 text-white">
                      {transaction.product as string || transaction.product_name as string || t('vendor.earnings.saleType')}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold">
                        {t('vendor.earnings.saleType')}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-[#d3da0c] font-bold">
                      +¥{transaction.total as number || transaction.amount as number || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Wallet className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t('vendor.earnings.noTransactionsTitle')}</h3>
            <p className="text-gray-400 max-w-md">
              {t('vendor.earnings.noTransactionsDescription')}
            </p>
          </div>
        )}
      </motion.div>

      {/* Payout Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-8 bg-gradient-to-r from-[#d3da0c]/10 to-transparent border border-[#d3da0c]/20 rounded-xl p-6"
      >
        <h4 className="text-white font-bold mb-2">{t('vendor.earnings.payoutInformation')}</h4>
        <p className="text-gray-400 text-sm mb-4">
          {t('vendor.earnings.payoutDescription')}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">{t('vendor.earnings.nextPayoutDate')}</span>
          <span className="text-[#d3da0c] font-bold">
            {nextPayoutDate}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default VendorEarnings;
