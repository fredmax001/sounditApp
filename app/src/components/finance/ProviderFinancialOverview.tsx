import React, { useCallback, useEffect, useState } from 'react';
import {
  Wallet,
  QrCode,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle2,
  Percent,
  RotateCcw,
  RefreshCw,
  ArrowUpRight,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { useAuthStore } from '@/store/authStore';

interface ProviderFinancialSummary {
  provider_user_id: number;
  currency: string;
  currencies: string[];
  fee_policy: {
    platform_yoopay_fee_percent: number;
    direct_qr_fee_percent: number;
    note: string;
  };
  total_reported_earnings: number;
  direct_qr_earnings: number;
  soundit_processed_earnings: number;
  soundit_unsettled_earnings: number;
  withdrawable_balance: number;
  pending_payout: number;
  pending_payout_count: number;
  completed_payouts: number;
  total_fees: number;
  gross_fees_charged: number;
  fees_refunded: number;
  refunds: {
    total: number;
    platform_yoopay: number;
    direct_qr: number;
    count: number;
  };
  counts: {
    total_transactions: number;
    direct_qr_transactions: number;
    platform_yoopay_transactions: number;
    ambiguous_transactions: number;
  };
  earnings_by_event: Array<{
    key: string;
    label: string;
    total_reported: number;
    direct_qr: number;
    platform_yoopay: number;
    fees: number;
    transactions_count: number;
  }>;
}

interface FinancialTx {
  id: number;
  transaction_uid: string;
  payment_channel: string;
  payment_method: string;
  source_type: string;
  gross_amount: number;
  platform_fee_amount: number;
  net_provider_entitlement: number;
  currency: string;
  payment_status: string;
  settlement_status: string;
  verification_status: string;
  needs_review: boolean;
  created_at: string | null;
}

interface ProviderFinancialOverviewProps {
  title?: string;
  subtitle?: string;
  allowWithdrawal?: boolean;
}

const fmt = (n: number, currency = 'CNY') => {
  const sym = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `;
  return `${sym}${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const ProviderFinancialOverview: React.FC<ProviderFinancialOverviewProps> = ({
  title = 'Financial Summary & Channel Breakdown',
  subtitle = 'Direct QR payments go straight to your own account (0% fee, not withdrawable). Only confirmed Sound It Yoopay payments (4% fee) enter your withdrawable balance.',
  allowWithdrawal = true,
}) => {
  const { session } = useAuthStore();
  const [summary, setSummary] = useState<ProviderFinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<FinancialTx[]>([]);
  const [currency, setCurrency] = useState('CNY');
  const [channelFilter, setChannelFilter] = useState<'all' | 'platform_yoopay' | 'direct_qr'>('all');
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('wechat_pay');
  const [accountDetails, setAccountDetails] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const chParam = channelFilter === 'all' ? '' : `&payment_channel=${channelFilter}`;
      const [sumRes, txRes] = await Promise.all([
        fetch(`${API_BASE_URL}/finance/provider/summary?currency=${currency}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/finance/provider/transactions?currency=${currency}${chParam}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions || []);
      }
    } catch {
      toast.error('Failed to load financial breakdown');
    } finally {
      setLoading(false);
    }
  }, [token, currency, channelFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }
    if (!accountDetails.trim()) {
      toast.error('Enter your payout account details');
      return;
    }
    setSubmitting(true);
    try {
      const idemKey = `payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch(`${API_BASE_URL}/finance/provider/payouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amt,
          currency,
          payment_method: withdrawMethod,
          account_details: accountDetails.trim(),
          recipient_name: recipientName.trim() || undefined,
          idempotency_key: idemKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error?.message || 'Withdrawal request failed');
      }
      toast.success(`Payout request #${data.payout_id} submitted for admin settlement`);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Withdrawal request failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#D3DA0C] animate-spin" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">{title}</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {summary.currencies.length > 1 && (
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs font-bold text-white"
              >
                {summary.currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white"
              aria-label="Refresh financial summary"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {allowWithdrawal && (
              <button
                type="button"
                onClick={() => setShowWithdrawModal(true)}
                disabled={summary.withdrawable_balance <= 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#D3DA0C] text-black hover:bg-[#c4cf0a] disabled:opacity-45 disabled:cursor-not-allowed transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                Request Payout
              </button>
            )}
          </div>
        </div>

        {/* 8 Separated Financial KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {/* A. Total Reported Earnings */}
          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center justify-between text-gray-400 text-[11px] font-semibold">
              <span>Total Reported Earnings</span>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-lg sm:text-xl font-black text-white mt-1.5">{fmt(summary.total_reported_earnings, currency)}</p>
            <p className="text-[10px] text-gray-500 mt-1">All recorded channels combined</p>
          </div>

          {/* B. Direct QR Earnings */}
          <div className="rounded-xl bg-sky-500/5 border border-sky-500/25 p-3.5">
            <div className="flex items-center justify-between text-sky-300 text-[11px] font-semibold">
              <span>Direct QR Earnings</span>
              <QrCode className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <p className="text-lg sm:text-xl font-black text-white mt-1.5">{fmt(summary.direct_qr_earnings, currency)}</p>
            <p className="text-[10px] text-sky-300/80 mt-1">Paid directly to you • 0% fee • Not withdrawable</p>
          </div>

          {/* C. Sound It Processed Earnings (Yoopay) */}
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/25 p-3.5">
            <div className="flex items-center justify-between text-purple-300 text-[11px] font-semibold">
              <span>Sound It Processed (Yoopay)</span>
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-lg sm:text-xl font-black text-white mt-1.5">{fmt(summary.soundit_processed_earnings, currency)}</p>
            <p className="text-[10px] text-purple-300/80 mt-1">4% fee applies once on confirmed Yoopay</p>
          </div>

          {/* D. Withdrawable Balance */}
          <div className="rounded-xl bg-[#D3DA0C]/10 border border-[#D3DA0C]/40 p-3.5">
            <div className="flex items-center justify-between text-[#D3DA0C] text-[11px] font-bold">
              <span>Withdrawable Balance</span>
              <Wallet className="w-3.5 h-3.5 text-[#D3DA0C]" />
            </div>
            <p className="text-lg sm:text-xl font-black text-[#D3DA0C] mt-1.5">{fmt(summary.withdrawable_balance, currency)}</p>
            <p className="text-[10px] text-gray-300 mt-1">Eligible Sound It Yoopay funds only</p>
          </div>

          {/* E. Pending Payout */}
          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center justify-between text-amber-300 text-[11px] font-semibold">
              <span>Pending Payout</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-white mt-1.5">{fmt(summary.pending_payout, currency)}</p>
            <p className="text-[10px] text-gray-500 mt-1">{summary.pending_payout_count} awaiting settlement</p>
          </div>

          {/* F. Completed Payouts */}
          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center justify-between text-emerald-300 text-[11px] font-semibold">
              <span>Completed Payouts</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-white mt-1.5">{fmt(summary.completed_payouts, currency)}</p>
            <p className="text-[10px] text-gray-500 mt-1">Transferred to your account</p>
          </div>

          {/* G. Total Sound It Fees */}
          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center justify-between text-gray-300 text-[11px] font-semibold">
              <span>Sound It Fees (4% Yoopay)</span>
              <Percent className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-white mt-1.5">{fmt(summary.total_fees, currency)}</p>
            <p className="text-[10px] text-gray-500 mt-1">0% charged on Direct QR sales</p>
          </div>

          {/* H. Refunds & Reversals */}
          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center justify-between text-red-300 text-[11px] font-semibold">
              <span>Refunds & Reversals</span>
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-base sm:text-lg font-extrabold text-white mt-1.5">{fmt(summary.refunds.total, currency)}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              Yoopay {fmt(summary.refunds.platform_yoopay, currency)} • Direct {fmt(summary.refunds.direct_qr, currency)}
            </p>
          </div>
        </div>

        {summary.counts.ambiguous_transactions > 0 && (
          <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              {summary.counts.ambiguous_transactions} historical transaction(s) are pending admin Yoopay statement reconciliation. They appear in reported earnings and will only enter withdrawable balance once verified as Sound It Yoopay settled funds.
            </span>
          </div>
        )}
      </div>

      {/* Filterable Transaction History */}
      <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-white">Channel-Separated Transaction Ledger</h3>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {([
              { id: 'all', label: 'All Channels' },
              { id: 'platform_yoopay', label: 'Sound It (Yoopay)' },
              { id: 'direct_qr', label: 'Direct QR' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChannelFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  channelFilter === tab.id
                    ? 'bg-[#D3DA0C] text-black'
                    : 'bg-white/5 text-gray-300 border border-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No recorded transactions for this channel filter yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2 pr-3 font-semibold">Ref / Date</th>
                  <th className="py-2 pr-3 font-semibold">Channel</th>
                  <th className="py-2 pr-3 font-semibold text-right">Gross</th>
                  <th className="py-2 pr-3 font-semibold text-right">Fee (4%)</th>
                  <th className="py-2 pr-3 font-semibold text-right">Withdrawable</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="text-gray-200">
                    <td className="py-2.5 pr-3">
                      <div className="font-mono text-[11px] text-white">{tx.transaction_uid}</div>
                      <div className="text-[10px] text-gray-500">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'} • {tx.source_type.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.payment_channel === 'platform_yoopay'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-sky-500/20 text-sky-300'
                      }`}>
                        {tx.payment_channel === 'platform_yoopay' ? 'Sound It Yoopay' : 'Direct QR'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold">{fmt(tx.gross_amount, tx.currency)}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-400">{fmt(tx.platform_fee_amount, tx.currency)}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-[#D3DA0C]">
                      {tx.payment_channel === 'platform_yoopay' ? fmt(tx.net_provider_entitlement, tx.currency) : '— (Direct)'}
                    </td>
                    <td className="py-2.5">
                      <span className="capitalize text-[11px] text-gray-300">{tx.payment_status}</span>
                      {tx.needs_review && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                          Review
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#0F140D] border border-white/15 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,16px))] sm:pb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-white">Request Sound It Payout</h3>
              <button type="button" onClick={() => setShowWithdrawModal(false)} className="p-1.5 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl bg-[#D3DA0C]/10 border border-[#D3DA0C]/30 p-3 mb-4 text-xs">
              <div className="text-gray-300">Eligible Withdrawable Balance (Yoopay Only):</div>
              <div className="text-lg font-black text-[#D3DA0C] mt-0.5">{fmt(summary.withdrawable_balance, currency)}</div>
              <div className="text-[11px] text-gray-400 mt-1">Direct QR earnings ({fmt(summary.direct_qr_earnings, currency)}) are excluded.</div>
            </div>
            <form onSubmit={handleRequestWithdrawal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  max={summary.withdrawable_balance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Up to ${summary.withdrawable_balance.toFixed(2)}`}
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2.5 text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Payout Method</label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2.5 text-sm text-white"
                >
                  <option value="wechat_pay">WeChat Pay</option>
                  <option value="alipay">Alipay</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Account ID / Number</label>
                <input
                  type="text"
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  placeholder="WeChat / Alipay ID or Bank Account"
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2.5 text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Recipient Full Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2.5 text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-[#D3DA0C] text-black text-sm font-extrabold hover:bg-[#c4cf0a] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Payout Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderFinancialOverview;
