import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, DollarSign, Clock, CheckCircle, ArrowUpRight, Download,
  Loader2, X, ChevronRight, Ticket, AlertCircle, Building2, Smartphone
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

interface Transaction {
  id: string;
  type: 'sale' | 'payout' | 'refund';
  amount: number;
  status: string;
  description: string;
  payment_method?: string;
  order_id?: number;
  tickets_count?: number;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

const Payouts = () => {
  const { t } = useTranslation();
  useSubscriptionGuard('payouts');
  const { session } = useAuthStore();
  const { stats: dashboardStats, fetchStats } = useDashboardStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    payment_method: 'wechat_pay' as 'wechat_pay' | 'alipay' | 'bank_transfer',
    account_details: '',
    account_name: '',
    bank_name: '',
  });

  const token = session?.access_token;

  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/payments/business/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
      toast.error(t('business.payouts.loadError') || 'Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (token) {
      fetchTransactions();
      fetchStats(token);
    }
  }, [token, fetchTransactions, fetchStats]);

  const sales = useMemo(() => transactions.filter(t => t.type === 'sale'), [transactions]);
  const payouts = useMemo(() => transactions.filter(t => t.type === 'payout'), [transactions]);
  const pendingPayouts = useMemo(() => payouts.filter(p => p.status === 'pending' || p.status === 'processing'), [payouts]);
  const completedPayouts = useMemo(() => payouts.filter(p => p.status === 'completed'), [payouts]);

  // Accurate available balance reconciled with transactions & dashboard stats
  const totalSalesAmount = useMemo(() => sales.reduce((sum, t) => sum + (t.amount || 0), 0), [sales]);
  const pendingPayoutsAmount = useMemo(() => pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0), [pendingPayouts]);
  const completedPayoutsAmount = useMemo(() => completedPayouts.reduce((sum, p) => sum + (p.amount || 0), 0), [completedPayouts]);

  // Backend available net balance
  const serverNetEarnings = dashboardStats?.business_stats?.net_earnings;
  const availableBalance = typeof serverNetEarnings === 'number' && serverNetEarnings > 0
    ? serverNetEarnings
    : Math.max(0, totalSalesAmount - completedPayoutsAmount - pendingPayoutsAmount);

  const displayTotalEarnings = typeof dashboardStats?.business_stats?.total_revenue === 'number' && dashboardStats.business_stats.total_revenue > 0
    ? dashboardStats.business_stats.total_revenue
    : totalSalesAmount;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const amount = parseFloat(withdrawForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('business.payouts.pleaseEnterValidAmount') || 'Please enter a valid amount');
      return;
    }

    if (amount > availableBalance) {
      toast.error(`Amount exceeds available balance of ¥${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      return;
    }

    let finalDetails = withdrawForm.account_details.trim();
    if (withdrawForm.payment_method === 'bank_transfer') {
      if (!withdrawForm.account_name.trim() || !withdrawForm.bank_name.trim() || !finalDetails) {
        toast.error('Please enter Account Name, Bank Name, and Account Number');
        return;
      }
      finalDetails = `Account Name: ${withdrawForm.account_name.trim()} | Bank: ${withdrawForm.bank_name.trim()} | Account: ${finalDetails}`;
    } else {
      if (!finalDetails) {
        toast.error('Please enter your account ID or registered mobile');
        return;
      }
      if (withdrawForm.account_name.trim()) {
        finalDetails = `Name: ${withdrawForm.account_name.trim()} | ID: ${finalDetails}`;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `payout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await fetch(`${API_BASE_URL}/payments/business/withdrawal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          amount,
          payment_method: withdrawForm.payment_method,
          account_details: finalDetails,
          idempotency_key: idempotencyKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || t('business.payouts.withdrawalSubmitted') || 'Withdrawal request submitted successfully');
        setShowWithdrawModal(false);
        setWithdrawForm({
          amount: '',
          payment_method: 'wechat_pay',
          account_details: '',
          account_name: '',
          bank_name: '',
        });
        await Promise.all([fetchTransactions(), fetchStats(token)]);
      } else {
        const data = await res.json().catch(() => ({ detail: 'Failed to submit withdrawal' }));
        toast.error(data.detail || t('business.payouts.failedToSubmitWithdrawal') || 'Failed to submit withdrawal request');
      }
    } catch {
      toast.error(t('business.payouts.networkError') || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    const headers = ['ID', 'Type', 'Amount (CNY)', 'Status', 'Description', 'Date'];
    const rows = transactions.map(t => [
      `"${t.id}"`,
      `"${t.type}"`,
      t.amount.toFixed(2),
      `"${t.status}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${new Date(t.created_at).toLocaleDateString()}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SoundIt_Payouts_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Transaction history exported successfully');
  };

  const formatCurrency = (val: number) => {
    return `¥${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-dvh bg-[#020b00] text-white pb-28 pt-2 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Page Title & Glowing 3D Green Wallet Graphic */}
      <div className="flex items-start justify-between gap-4 pt-2 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Payouts
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-[17.5rem] sm:max-w-md leading-relaxed">
            Manage your earnings and withdrawal requests.
          </p>
        </div>

        {/* 3D Glowing Green Wallet Illustration matching reference */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-[0_0_18px_rgba(16,185,129,0.55)]"
            viewBox="0 0 100 85"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="walletGradFront" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="walletGradBack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#065f46" />
              </linearGradient>
            </defs>
            {/* Back Fold */}
            <rect x="18" y="14" width="64" height="42" rx="10" fill="url(#walletGradBack)" />
            {/* Money / Card Slip */}
            <rect x="26" y="8" width="48" height="14" rx="4" fill="#a7f3d0" opacity="0.9" />
            {/* Front Wallet Body */}
            <rect x="14" y="24" width="72" height="52" rx="12" fill="url(#walletGradFront)" />
            {/* Currency Symbol ¥ */}
            <text
              x="70"
              y="58"
              fill="#064e3b"
              fontSize="24"
              fontWeight="900"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              ¥
            </text>
          </svg>
        </div>
      </div>

      {/* Available Balance Hero Card (Glow wave background & Neon-Lime Request Payout Button) */}
      <div className="relative bg-gradient-to-b from-[#0e2113] via-[#09170e] to-[#060e08] border border-emerald-500/30 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl overflow-hidden">
        {/* Subtle green ambient bottom wave */}
        <div className="absolute -bottom-8 left-0 right-0 h-24 bg-gradient-to-t from-emerald-500/20 via-emerald-500/5 to-transparent blur-md pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-medium text-gray-300">
              Available Balance
            </span>
          </div>

          {/* Request Payout Button (Neon-Lime #d3da0c) */}
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="bg-[#d3da0c] hover:bg-[#c2c90b] text-black font-extrabold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#d3da0c]/20 transition-all active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4 text-black stroke-[2.5]" />
            Request Payout
          </button>
        </div>

        {/* Large Available Balance Display */}
        <div className="relative z-10 mt-3 sm:mt-4">
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {formatCurrency(availableBalance)}
          </p>
        </div>
      </div>

      {/* Stats Grid matching reference */}
      <div className="space-y-3 mb-8">
        <div className="grid grid-cols-2 gap-3">
          {/* Total Earnings */}
          <div className="bg-[#0a1209] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-gray-400">Total Earnings</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(displayTotalEarnings)}
            </p>
          </div>

          {/* Completed Payouts */}
          <div className="bg-[#0a1209] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1.5">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-gray-400">Completed</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(completedPayoutsAmount)}
            </p>
          </div>
        </div>

        {/* Pending Payouts Card (Full Width) */}
        <div className="bg-[#0a1209] border border-yellow-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-1.5">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium text-gray-400">Pending</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-white">
            {formatCurrency(pendingPayoutsAmount)}
          </p>
        </div>
      </div>

      {/* Pending Payouts Section */}
      <div className="space-y-3 mb-8">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Pending Payouts
            </h2>
          </div>
          {pendingPayouts.length > 0 && (
            <span className="text-[0.6875rem] font-medium text-yellow-400 bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-0.5 rounded-full">
              {pendingPayouts.length}
            </span>
          )}
        </div>

        {pendingPayouts.length === 0 ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-6 text-center">
            <p className="text-xs text-gray-400">No pending payout requests</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingPayouts.map((payout) => {
              const formattedDate = payout.created_at
                ? new Date(payout.created_at).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent';

              return (
                <div
                  key={payout.id}
                  className="bg-[#0f170c] border border-yellow-500/20 rounded-2xl p-4 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 shrink-0">
                      <Wallet className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-bold text-white">
                        {formatCurrency(payout.amount)}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {payout.description || `Withdrawal via ${payout.payment_method || 'transfer'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[0.6875rem] font-medium px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                      Pending
                    </span>
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {formattedDate}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Transaction History
          </h2>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        {loading ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] mx-auto mb-3 animate-spin" />
            <p className="text-xs text-gray-400">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-10 text-center">
            <Ticket className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-white font-medium text-sm">No transaction records found</p>
            <p className="text-gray-400 text-xs mt-1">Ticket sales and payouts will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const isSale = tx.type === 'sale';
              const isPayout = tx.type === 'payout';
              const formattedDate = tx.created_at
                ? new Date(tx.created_at).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '';

              return (
                <div
                  key={tx.id}
                  className="bg-[#0b140b] border border-white/8 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between shadow-xs transition-colors hover:bg-[#101c10]"
                >
                  {/* Left: Icon + Description */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSale
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : isPayout
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {isSale ? (
                        <Ticket className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Wallet className="w-4 h-4 text-blue-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white truncate">
                        {tx.description}
                      </p>
                      <p className="text-[0.6875rem] text-gray-400 truncate">
                        {isSale ? (
                          <>
                            {tx.tickets_count ? `(${tx.tickets_count} ticket(s)) ` : ''}
                            <span className="text-emerald-400 font-medium">+{formatCurrency(tx.amount)}</span> • Sale
                          </>
                        ) : (
                          <>
                            <span className="text-white font-medium">-{formatCurrency(tx.amount)}</span> • Payout
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status Pill + Date + Chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[0.6875rem] font-medium px-2.5 py-0.5 rounded-full capitalize border ${
                        tx.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : tx.status === 'pending' || tx.status === 'processing'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {tx.status}
                    </span>
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {formattedDate}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request Payout Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0e160d] rounded-2xl border border-white/10 shadow-2xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto text-white"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-xl font-bold text-white">Request Payout</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Submit earnings withdrawal to your verified account.
                  </p>
                </div>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Available Balance Banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[0.6875rem] font-medium text-emerald-400">Available to Withdraw</p>
                  <p className="text-xl font-extrabold text-white mt-0.5">
                    {formatCurrency(availableBalance)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWithdrawForm(prev => ({ ...prev, amount: String(Math.floor(availableBalance * 100) / 100) }))}
                  className="text-xs font-bold text-black bg-[#d3da0c] hover:bg-[#c2c90b] px-3 py-1.5 rounded-lg transition-colors"
                >
                  Max
                </button>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                {/* Withdrawal Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Withdrawal Amount (¥ CNY) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold text-gray-400">¥</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={availableBalance}
                      value={withdrawForm.amount}
                      onChange={(e) => setWithdrawForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      required
                      className="w-full bg-[#152014] border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                  {availableBalance <= 0 && (
                    <p className="text-[0.6875rem] text-amber-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      No available balance currently withdrawable.
                    </p>
                  )}
                </div>

                {/* Method Selection (WeChat Pay, Alipay, Bank Transfer) */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Withdrawal Method *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* WeChat Pay */}
                    <button
                      type="button"
                      onClick={() => setWithdrawForm(prev => ({ ...prev, payment_method: 'wechat_pay' }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        withdrawForm.payment_method === 'wechat_pay'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white'
                          : 'bg-[#152014] border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                      <span className="text-[0.6875rem] font-semibold block">WeChat</span>
                    </button>

                    {/* Alipay */}
                    <button
                      type="button"
                      onClick={() => setWithdrawForm(prev => ({ ...prev, payment_method: 'alipay' }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        withdrawForm.payment_method === 'alipay'
                          ? 'bg-blue-500/20 border-blue-500 text-white'
                          : 'bg-[#152014] border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                      <span className="text-[0.6875rem] font-semibold block">Alipay</span>
                    </button>

                    {/* Bank Transfer */}
                    <button
                      type="button"
                      onClick={() => setWithdrawForm(prev => ({ ...prev, payment_method: 'bank_transfer' }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        withdrawForm.payment_method === 'bank_transfer'
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-[#152014] border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                      <span className="text-[0.6875rem] font-semibold block">Bank</span>
                    </button>
                  </div>
                </div>

                {/* Account Details Inputs */}
                {withdrawForm.payment_method === 'bank_transfer' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Bank Account Name *
                      </label>
                      <input
                        type="text"
                        value={withdrawForm.account_name}
                        onChange={(e) => setWithdrawForm(prev => ({ ...prev, account_name: e.target.value }))}
                        placeholder="e.g. Shanghai Entertainment Co."
                        required
                        className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Bank Name & Branch *
                      </label>
                      <input
                        type="text"
                        value={withdrawForm.bank_name}
                        onChange={(e) => setWithdrawForm(prev => ({ ...prev, bank_name: e.target.value }))}
                        placeholder="e.g. China Merchants Bank, Jing'an Branch"
                        required
                        className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Bank Account / Card Number *
                      </label>
                      <input
                        type="text"
                        value={withdrawForm.account_details}
                        onChange={(e) => setWithdrawForm(prev => ({ ...prev, account_details: e.target.value }))}
                        placeholder="6222..."
                        required
                        className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Account Holder Real Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={withdrawForm.account_name}
                        onChange={(e) => setWithdrawForm(prev => ({ ...prev, account_name: e.target.value }))}
                        placeholder="e.g. John Doe"
                        className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        {withdrawForm.payment_method === 'wechat_pay' ? 'WeChat ID or Phone Number *' : 'Alipay Account / Phone *'}
                      </label>
                      <input
                        type="text"
                        value={withdrawForm.account_details}
                        onChange={(e) => setWithdrawForm(prev => ({ ...prev, account_details: e.target.value }))}
                        placeholder={withdrawForm.payment_method === 'wechat_pay' ? 'WeChat ID or +86...' : 'alipay@example.com or phone'}
                        required
                        className="w-full bg-[#152014] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                  </>
                )}

                <p className="text-[0.6875rem] text-gray-400 bg-black/30 p-2.5 rounded-xl border border-white/5">
                  Payout requests are reviewed and processed within 1-3 business days. Funds will be sent directly to your specified account.
                </p>

                {/* Submit Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || availableBalance <= 0}
                    className="px-5 py-2 bg-[#d3da0c] hover:bg-[#c2c90b] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-[#d3da0c]/20"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
                    Confirm Withdrawal
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Payouts;
