import { useState, useEffect, useCallback } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  DollarSign,
  Download,
  Loader2,
  CreditCard,
  Wallet,
  Percent,
  QrCode,
  Repeat,
  RotateCcw,
  ShieldAlert,
  BookOpen,
  Scale,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface AdminOverview {
  period_days: string;
  currency: string;
  currencies: string[];
  platform_payment_volume: number;
  platform_payment_count: number;
  platform_unsettled_volume: number;
  direct_qr_transaction_volume: number;
  direct_qr_transaction_count: number;
  subscription_revenue: number;
  subscription_payments_count: number;
  transaction_fee_revenue: number;
  total_platform_revenue: number;
  lifetime_platform_revenue: number;
  lifetime_subscription_revenue: number;
  lifetime_fee_revenue: number;
  outstanding_payout_liabilities: number;
  provider_withdrawable_liability: number;
  provider_pending_payout_liability: number;
  available_platform_cash: number;
  net_platform_owned_cash: number;
  completed_payouts: number;
  completed_payouts_count: number;
  pending_payout_requests_amount: number;
  pending_payout_requests_count: number;
  refunds: {
    total: number;
    platform_yoopay: number;
    direct_qr: number;
    subscriptions: number;
    fees_reversed: number;
    count: number;
  };
  audit_flags: {
    ambiguous_records_in_period: number;
    ambiguous_volume_in_period: number;
    ambiguous_records_total: number;
    failed_transactions: number;
    fee_policy_rate_percent: number;
  };
  monthly_breakdown: Array<{
    month: string;
    platform_volume: number;
    direct_qr_volume: number;
    subscription_revenue: number;
    fee_revenue: number;
    total_platform_revenue: number;
  }>;
  subscription_report?: SubscriptionReport;
}

interface SubscriptionReport {
  currency: string;
  counts: {
    active: number;
    active_paid: number;
    active_free_or_trial: number;
    expired: number;
    cancelled: number;
    pending_payments: number;
    successful_payments: number;
    failed_or_rejected: number;
  };
  total_recognized_subscription_revenue: number;
  pending_subscription_revenue: number;
  monthly_recurring_revenue: number;
  revenue_by_category: Array<{ category: string; revenue: number; paid_count: number; active_count: number }>;
  revenue_by_city: Array<{ city: string; revenue: number; paid_count: number }>;
  expiring_within_14_days: Array<{ subscription_id: number; email?: string; role: string; plan_type: string; price: number; end_date: string }>;
}

const fmt = (n?: number, cur = 'CNY') => {
  const sym = cur === 'CNY' ? '¥' : cur === 'USD' ? '$' : `${cur} `;
  return `${sym}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const FinancialControl = () => {
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'reconciliation' | 'ledger'>('overview');
  const [dateRange, setDateRange] = useState('all');
  const [currency, setCurrency] = useState('CNY');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [subReport, setSubReport] = useState<SubscriptionReport | null>(null);
  const [ambiguousTxs, setAmbiguousTxs] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [gwSettledCashInput, setGwSettledCashInput] = useState('');
  const [runningRecon, setRunningRecon] = useState(false);
  const [classifyingId, setClassifyingId] = useState<number | null>(null);

  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ovRes, subRes, ambRes, ledRes, recRes] = await Promise.all([
        fetch(`${API_BASE_URL}/finance/admin/overview?days=${dateRange}&currency=${currency}`, { headers }),
        fetch(`${API_BASE_URL}/finance/admin/subscriptions-report?currency=${currency}`, { headers }),
        fetch(`${API_BASE_URL}/finance/admin/transactions?currency=${currency}&needs_review=true&limit=100`, { headers }),
        fetch(`${API_BASE_URL}/finance/admin/ledger?currency=${currency}&limit=100`, { headers }),
        fetch(`${API_BASE_URL}/finance/admin/reconciliation`, { headers }),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (subRes.ok) setSubReport(await subRes.json());
      if (ambRes.ok) setAmbiguousTxs((await ambRes.json()).transactions || []);
      if (ledRes.ok) setLedgerEntries((await ledRes.json()).entries || []);
      if (recRes.ok) setReconciliations((await recRes.json()).reconciliations || []);
    } catch {
      toast.error('Failed to load reconciled financial data');
    } finally {
      setLoading(false);
    }
  }, [token, dateRange, currency]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/finance/admin/export?currency=${currency}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soundit-finance-${currency.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Separated financial ledger CSV exported');
    } catch {
      toast.error('Failed to export financial CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleClassifyTx = async (txId: number, targetChannel: 'direct_qr' | 'platform_yoopay') => {
    setClassifyingId(txId);
    try {
      const res = await fetch(`${API_BASE_URL}/finance/admin/transactions/${txId}/classify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_channel: targetChannel,
          notes: `Classified via Admin Financial Control as ${targetChannel}`,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.detail || 'Classification failed');
      toast.success(`Transaction #${txId} classified as ${targetChannel === 'platform_yoopay' ? 'Sound It Yoopay (4% fee applied)' : 'Direct QR (0% fee)'}`);
      loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Classification failed');
    } finally {
      setClassifyingId(null);
    }
  };

  const handleRunReconciliation = async () => {
    setRunningRecon(true);
    try {
      const settledVal = gwSettledCashInput.trim() ? parseFloat(gwSettledCashInput) : undefined;
      const res = await fetch(`${API_BASE_URL}/finance/admin/reconciliation/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency,
          gateway_records: [],
          gateway_settled_cash: settledVal,
          notes: 'Manual Yoopay statement reconciliation check',
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.detail || 'Reconciliation failed');
      toast.success(`Reconciliation ${d.reconciliation_uid}: ${d.status.toUpperCase()} (discrepancy ${fmt(d.discrepancy_amount, currency)})`);
      loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Reconciliation failed');
    } finally {
      setRunningRecon(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Financial Control & Ledger"
        subtitle="Reconciled Sound It Yoopay Platform Cash vs Direct QR Volume vs Subscription Revenue"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0F140D] border border-[#1F261E] text-xs font-bold text-white"
            >
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last 12 Months</option>
            </select>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0F140D] border border-[#1F261E] text-xs font-bold text-white"
            >
              {(overview?.currencies || ['CNY']).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadAll}
              className="p-2 rounded-xl bg-[#0F140D] border border-[#1F261E] text-gray-300 hover:text-white"
              aria-label="Refresh financials"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D3DA0C] text-black text-xs font-extrabold hover:bg-[#c4cf0a] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Section Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {([
          { id: 'overview', label: '8-Category Overview', icon: DollarSign },
          { id: 'subscriptions', label: 'Subscription Revenue', icon: Repeat },
          { id: 'reconciliation', label: `Yoopay Reconciliation${overview?.audit_flags.ambiguous_records_total ? ` (${overview.audit_flags.ambiguous_records_total})` : ''}`, icon: Scale },
          { id: 'ledger', label: 'Immutable Ledger', icon: BookOpen },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? 'bg-[#D3DA0C] text-black shadow-[0_0_16px_rgba(211,218,12,0.25)]'
                  : 'bg-[#0F140D] border border-[#1F261E] text-gray-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && !overview ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 text-[#D3DA0C] animate-spin" />
        </div>
      ) : activeTab === 'overview' && overview ? (
        <div className="space-y-5">
          {/* Accounting Separation Banner */}
          <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-gray-300 leading-relaxed">
              <span className="font-extrabold text-[#D3DA0C]">Strict Channel Separation Enforced:</span>{' '}
              Direct QR transactions go directly to providers (0% fee) and are <strong className="text-white">strictly excluded</strong> from Sound It Revenue, Available Platform Cash, and Provider Payout Liabilities.
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-bold shrink-0">
              Yoopay Fee: 4% Once • Direct QR: 0%
            </span>
          </div>

          {/* 8 Independent Admin Financial Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* A. Platform Payment Volume (Yoopay) */}
            <div className="rounded-2xl bg-[#0F140D] border border-purple-500/30 p-4">
              <div className="flex items-center justify-between text-purple-300 text-xs font-bold">
                <span>A. Platform Volume (Yoopay)</span>
                <CreditCard className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{fmt(overview.platform_payment_volume, currency)}</p>
              <p className="text-[11px] text-gray-400 mt-1">{overview.platform_payment_count} confirmed Yoopay txns</p>
            </div>

            {/* B. Direct QR Transaction Volume (Operational Metric Only) */}
            <div className="rounded-2xl bg-[#0F140D] border border-sky-500/30 p-4">
              <div className="flex items-center justify-between text-sky-300 text-xs font-bold">
                <span>B. Direct QR Volume</span>
                <QrCode className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{fmt(overview.direct_qr_transaction_volume, currency)}</p>
              <p className="text-[11px] text-sky-300/80 mt-1">
                {overview.direct_qr_transaction_count} txns • Operational metric ONLY (Not Sound It revenue)
              </p>
            </div>

            {/* C. Subscription Revenue */}
            <div className="rounded-2xl bg-[#0F140D] border border-emerald-500/30 p-4">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
                <span>C. Subscription Revenue</span>
                <Repeat className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-2">{fmt(overview.subscription_revenue, currency)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Primary revenue • {overview.subscription_payments_count} recognized paid plans
              </p>
            </div>

            {/* D. Transaction Fee Revenue (4%) */}
            <div className="rounded-2xl bg-[#0F140D] border border-[#D3DA0C]/30 p-4">
              <div className="flex items-center justify-between text-[#D3DA0C] text-xs font-bold">
                <span>D. 4% Fee Revenue</span>
                <Percent className="w-4 h-4 text-[#D3DA0C]" />
              </div>
              <p className="text-2xl font-black text-[#D3DA0C] mt-2">{fmt(overview.transaction_fee_revenue, currency)}</p>
              <p className="text-[11px] text-gray-400 mt-1">Recognized 4% Yoopay fees net of reversals</p>
            </div>

            {/* E. Total Platform Revenue */}
            <div className="rounded-2xl bg-[#D3DA0C]/10 border border-[#D3DA0C]/45 p-4">
              <div className="flex items-center justify-between text-[#D3DA0C] text-xs font-extrabold">
                <span>E. Total Platform Revenue</span>
                <DollarSign className="w-4 h-4 text-[#D3DA0C]" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{fmt(overview.total_platform_revenue, currency)}</p>
              <p className="text-[11px] text-gray-300 mt-1">
                Subscriptions + 4% Yoopay Fees (Lifetime: {fmt(overview.lifetime_platform_revenue, currency)})
              </p>
            </div>

            {/* F. Outstanding Payout Liabilities */}
            <div className="rounded-2xl bg-[#0F140D] border border-amber-500/30 p-4">
              <div className="flex items-center justify-between text-amber-300 text-xs font-bold">
                <span>F. Payout Liabilities</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{fmt(overview.outstanding_payout_liabilities, currency)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Payable {fmt(overview.provider_withdrawable_liability, currency)} + Pending {fmt(overview.provider_pending_payout_liability, currency)}
              </p>
            </div>

            {/* G. Available Platform Cash */}
            <div className="rounded-2xl bg-[#0F140D] border border-emerald-500/30 p-4">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
                <span>G. Available Platform Cash</span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{fmt(overview.available_platform_cash, currency)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Net Sound It Owned Cash: {fmt(overview.net_platform_owned_cash, currency)}
              </p>
            </div>

            {/* H. Refunds & Reversals */}
            <div className="rounded-2xl bg-[#0F140D] border border-red-500/30 p-4">
              <div className="flex items-center justify-between text-red-300 text-xs font-bold">
                <span>H. Refunds & Reversals</span>
                <RotateCcw className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-2xl font-black text-white mt-2">{fmt(overview.refunds.total, currency)}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Yoopay {fmt(overview.refunds.platform_yoopay, currency)} • Direct {fmt(overview.refunds.direct_qr, currency)} • Sub {fmt(overview.refunds.subscriptions, currency)}
              </p>
            </div>
          </div>

          {/* Payout Settlement Summary + Ambiguous Audit Warning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
              <h3 className="text-sm font-bold text-white mb-3">Payout Requests & Settlements</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <div className="text-gray-400">Pending Requests ({overview.pending_payout_requests_count})</div>
                  <div className="text-lg font-black text-amber-300 mt-1">{fmt(overview.pending_payout_requests_amount, currency)}</div>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <div className="text-gray-400">Completed Payouts ({overview.completed_payouts_count})</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">{fmt(overview.completed_payouts, currency)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
              <h3 className="text-sm font-bold text-white mb-2">Historical Audit & Reconciliation Status</h3>
              {overview.audit_flags.ambiguous_records_total > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-300">
                    {overview.audit_flags.ambiguous_records_total} historical record(s) ({fmt(overview.audit_flags.ambiguous_volume_in_period, currency)}) are flagged for Yoopay vs Direct QR review. They are excluded from Sound It cash & withdrawable liabilities until verified.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reconciliation')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold shrink-0 hover:bg-amber-500/30"
                  >
                    Review
                  </button>
                </div>
              ) : (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> All financial transactions are cleanly classified and reconciled.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'subscriptions' && subReport ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-[#0F140D] border border-emerald-500/30 p-4">
              <div className="text-xs text-emerald-300 font-bold">Recognized Subscription Revenue</div>
              <div className="text-2xl font-black text-white mt-1.5">{fmt(subReport.total_recognized_subscription_revenue, currency)}</div>
              <div className="text-[11px] text-gray-400 mt-1">{subReport.counts.successful_payments} successful paid subscriptions</div>
            </div>
            <div className="rounded-2xl bg-[#0F140D] border border-[#D3DA0C]/30 p-4">
              <div className="text-xs text-[#D3DA0C] font-bold">Monthly Recurring Revenue (MRR)</div>
              <div className="text-2xl font-black text-[#D3DA0C] mt-1.5">{fmt(subReport.monthly_recurring_revenue, currency)}</div>
              <div className="text-[11px] text-gray-400 mt-1">{subReport.counts.active_paid} active paid • {subReport.counts.active_free_or_trial} free/trial</div>
            </div>
            <div className="rounded-2xl bg-[#0F140D] border border-white/10 p-4">
              <div className="text-xs text-gray-300 font-bold">Pending Payments</div>
              <div className="text-2xl font-black text-amber-300 mt-1.5">{fmt(subReport.pending_subscription_revenue, currency)}</div>
              <div className="text-[11px] text-gray-400 mt-1">{subReport.counts.pending_payments} awaiting verification</div>
            </div>
            <div className="rounded-2xl bg-[#0F140D] border border-white/10 p-4">
              <div className="text-xs text-gray-300 font-bold">Lifecycle Counts</div>
              <div className="text-sm font-bold text-white mt-2 space-y-0.5">
                <div>Active: {subReport.counts.active} • Expired: {subReport.counts.expired}</div>
                <div>Cancelled: {subReport.counts.cancelled} • Failed: {subReport.counts.failed_or_rejected}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
              <h3 className="text-sm font-bold text-white mb-3">Subscription Revenue by Provider Category</h3>
              {subReport.revenue_by_category.length === 0 ? (
                <p className="text-xs text-gray-400">No paid subscription revenue yet.</p>
              ) : (
                <div className="space-y-2">
                  {subReport.revenue_by_category.map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-black/40 border border-white/5">
                      <span className="capitalize font-bold text-white">{c.category} ({c.paid_count} paid)</span>
                      <span className="font-black text-emerald-400">{fmt(c.revenue, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
              <h3 className="text-sm font-bold text-white mb-3">Subscription Revenue by City</h3>
              {subReport.revenue_by_city.length === 0 ? (
                <p className="text-xs text-gray-400">No city breakdown available yet.</p>
              ) : (
                <div className="space-y-2">
                  {subReport.revenue_by_city.map((c) => (
                    <div key={c.city} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-black/40 border border-white/5">
                      <span className="capitalize font-bold text-white">{c.city} ({c.paid_count})</span>
                      <span className="font-black text-[#D3DA0C]">{fmt(c.revenue, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'reconciliation' ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
            <h3 className="text-sm font-bold text-white mb-2">Run Yoopay Settlement Reconciliation</h3>
            <p className="text-xs text-gray-400 mb-3">
              Compare internal confirmed Yoopay volume (including Yoopay subscriptions, strictly excluding Direct QR) against your actual Yoopay settlement statement balance.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="number"
                step="0.01"
                value={gwSettledCashInput}
                onChange={(e) => setGwSettledCashInput(e.target.value)}
                placeholder={`Actual Yoopay Settled Cash (${currency})`}
                className="flex-1 rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                disabled={runningRecon}
                onClick={handleRunReconciliation}
                className="px-4 py-2 rounded-xl bg-[#D3DA0C] text-black text-xs font-extrabold hover:bg-[#c4cf0a] disabled:opacity-50"
              >
                {runningRecon ? 'Running...' : 'Run Reconciliation'}
              </button>
            </div>
            {reconciliations.length > 0 && (
              <div className="mt-4 space-y-2">
                {reconciliations.slice(0, 5).map((r) => (
                  <div key={r.id} className="rounded-xl bg-black/40 border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono text-white font-bold">{r.reconciliation_uid}</span>
                      <span className="text-gray-400 ml-2">Internal Yoopay: {fmt(r.internal_confirmed_volume + r.internal_subscription_volume, r.currency)} • Settled: {fmt(r.gateway_settled_cash, r.currency)}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'matched' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {r.status} (Diff {fmt(r.discrepancy_amount, r.currency)})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
            <h3 className="text-sm font-bold text-white mb-3">Ambiguous Historical Records Requiring Manual Classification ({ambiguousTxs.length})</h3>
            {ambiguousTxs.length === 0 ? (
              <p className="text-xs text-emerald-400">No ambiguous historical records remaining.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400">
                      <th className="py-2 pr-3">TX UID</th>
                      <th className="py-2 pr-3">Source / Ref</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2 text-right">Classify</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ambiguousTxs.slice(0, 50).map((tx) => (
                      <tr key={tx.id} className="text-gray-200">
                        <td className="py-2 pr-3 font-mono text-[11px]">{tx.transaction_uid}</td>
                        <td className="py-2 pr-3">
                          <div>{tx.source_type} #{tx.source_id}</div>
                          <div className="text-[10px] text-gray-500">{tx.gateway_reference || 'No ref'}</div>
                        </td>
                        <td className="py-2 pr-3 text-right font-bold">{fmt(tx.gross_amount, tx.currency)}</td>
                        <td className="py-2 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={classifyingId === tx.id}
                            onClick={() => handleClassifyTx(tx.id, 'direct_qr')}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-[11px] font-bold hover:bg-sky-500/30"
                          >
                            Confirm Direct QR
                          </button>
                          <button
                            type="button"
                            disabled={classifyingId === tx.id}
                            onClick={() => handleClassifyTx(tx.id, 'platform_yoopay')}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-[11px] font-bold hover:bg-purple-500/30"
                          >
                            Verify Yoopay (4%)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0F140D] border border-[#1F261E] p-4">
          <h3 className="text-sm font-bold text-white mb-3">Immutable Double-Entry Financial Ledger ({ledgerEntries.length} recent entries)</h3>
          {ledgerEntries.length === 0 ? (
            <p className="text-xs text-gray-400">No ledger entries recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-2 pr-3">Journal</th>
                    <th className="py-2 pr-3">Account</th>
                    <th className="py-2 pr-3">Side</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ledgerEntries.map((e) => (
                    <tr key={e.id} className="text-gray-200">
                      <td className="py-2 pr-3 font-mono text-[10px] text-gray-400">{e.journal_id}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-white">{e.account_code}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${e.entry_type === 'debit' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {e.entry_type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-bold">{fmt(e.amount, e.currency)}</td>
                      <td className="py-2 text-gray-300">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialControl;
