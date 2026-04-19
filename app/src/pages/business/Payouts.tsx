import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, DollarSign, Clock, CheckCircle, ArrowUpRight, Download, Loader2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
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
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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
    payment_method: 'bank_transfer',
    account_details: ''
  });

  const token = session?.access_token;

  useEffect(() => {
    if (token) {
      fetchTransactions();
      fetchStats(token);
    }
  }, [token]);

  const fetchTransactions = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/payments/business/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data || []);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const amount = parseFloat(withdrawForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('business.payouts.pleaseEnterValidAmount'));
      return;
    }

    const maxWithdrawable = dashboardStats?.business_stats?.net_earnings || 0;
    if (amount > maxWithdrawable) {
      toast.error(t('business.payouts.maximumWithdrawal', { amount: maxWithdrawable.toLocaleString() }));
      return;
    }

    if (!withdrawForm.account_details.trim()) {
      toast.error(t('business.payouts.pleaseEnterAccountDetails'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/payments/business/withdrawal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          payment_method: withdrawForm.payment_method,
          account_details: withdrawForm.account_details
        })
      });

      if (res.ok) {
        toast.success(t('business.payouts.withdrawalSubmitted'));
        setShowWithdrawModal(false);
        setWithdrawForm({ amount: '', payment_method: 'bank_transfer', account_details: '' });
        fetchTransactions();
        fetchStats(token);
      } else {
        const data = await res.json();
        toast.error(data.detail || t('business.payouts.failedToSubmitWithdrawal'));
      }
    } catch {
      toast.error(t('business.payouts.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const sales = transactions.filter(t => t.type === 'sale');
  const payouts = transactions.filter(t => t.type === 'payout');
  const pendingPayouts = payouts.filter(p => p.status === 'pending' || p.status === 'processing');
  const completedPayouts = payouts.filter(p => p.status === 'completed');

  const availableBalance = dashboardStats?.business_stats?.net_earnings || 0;
  const totalEarnings = sales.reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingAmount = pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const completedAmount = completedPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t('business.payouts.title')}</h2>
          <p className="text-gray-400">{t('business.payouts.subtitle')}</p>
        </div>
        <button 
          onClick={() => setShowWithdrawModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#d3da0c]/90 transition-colors"
        >
          <ArrowUpRight className="w-5 h-5" />
          {t('business.payouts.requestPayout')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-[#d3da0c]" />
            <span className="text-gray-400">{t('business.payouts.availableBalance')}</span>
          </div>
          <p className="text-3xl font-bold text-white">¥{availableBalance.toLocaleString()}</p>
        </div>
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-green-400" />
            <span className="text-gray-400">{t('business.payouts.totalEarnings')}</span>
          </div>
          <p className="text-3xl font-bold text-white">¥{totalEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-400">{t('business.payouts.pending')}</span>
          </div>
          <p className="text-3xl font-bold text-white">¥{pendingAmount.toLocaleString()}</p>
        </div>
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-400" />
            <span className="text-gray-400">{t('business.payouts.completed')}</span>
          </div>
          <p className="text-3xl font-bold text-white">¥{completedAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Pending Payouts */}
      {pendingPayouts.length > 0 && (
        <div className="bg-[#111111] rounded-xl border border-yellow-500/30 overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              {t('business.payouts.pendingPayouts')}
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {pendingPayouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">¥{payout.amount.toLocaleString()}</p>
                    <p className="text-gray-500 text-sm">{payout.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 capitalize">
                    {payout.status}
                  </span>
                  <p className="text-gray-500 text-sm">{payout.created_at ? new Date(payout.created_at).toLocaleDateString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('business.payouts.transactionHistory')}</h3>
          <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <Download className="w-4 h-4" />
            {t('business.payouts.export')}
          </button>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{t('business.payouts.loadingTransactions')}</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === 'sale' ? 'bg-green-500/20' : 
                    tx.type === 'payout' ? 'bg-blue-500/20' : 'bg-red-500/20'
                  }`}>
                    {tx.type === 'sale' ? <DollarSign className="w-5 h-5 text-green-400" /> : 
                     tx.type === 'payout' ? <Wallet className="w-5 h-5 text-blue-400" /> : 
                     <ArrowUpRight className="w-5 h-5 text-red-400" />}
                  </div>
                  <div>
                    <p className="text-white font-medium">{tx.description}</p>
                    <p className="text-gray-500 text-sm capitalize">{tx.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className={`font-medium ${tx.type === 'payout' ? 'text-white' : 'text-green-400'}`}>
                    {tx.type === 'payout' ? '-' : '+'}¥{tx.amount.toLocaleString()}
                  </p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                    tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                    tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {tx.status}
                  </span>
                  <p className="text-gray-500 text-sm">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">{t('business.payouts.noTransactions')}</p>
            <p className="text-gray-500 text-sm">{t('business.payouts.noTransactionsHint')}</p>
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111111] rounded-2xl border border-white/10 p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{t('business.payouts.requestPayoutModalTitle')}</h3>
                <button 
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('business.payouts.amountLabel')}</label>
                  <input
                    type="number"
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({...withdrawForm, amount: e.target.value})}
                    placeholder={t('business.payouts.amountPlaceholder', { max: availableBalance.toLocaleString() })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('business.payouts.paymentMethod')}</label>
                  <select
                    value={withdrawForm.payment_method}
                    onChange={(e) => setWithdrawForm({...withdrawForm, payment_method: e.target.value})}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value="bank_transfer" className="bg-[#111111]">{t('business.payouts.bankTransfer')}</option>
                    <option value="alipay" className="bg-[#111111]">{t('business.payouts.alipay')}</option>
                    <option value="wechat_pay" className="bg-[#111111]">{t('business.payouts.wechatPay')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('business.payouts.accountDetails')}</label>
                  <textarea
                    value={withdrawForm.account_details}
                    onChange={(e) => setWithdrawForm({...withdrawForm, account_details: e.target.value})}
                    placeholder={t('business.payouts.accountDetailsPlaceholder')}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
                    rows={3}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {t('business.payouts.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#d3da0c]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('business.payouts.submitting')}
                      </>
                    ) : (
                      t('business.payouts.submitRequest')
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Payouts;
