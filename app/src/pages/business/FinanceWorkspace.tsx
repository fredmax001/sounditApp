import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Ticket,
  Wine,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Wallet,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  Loader2,
  Building2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface FinanceOverviewData {
  business_id: number;
  business_name: string;
  staff_role: string;
  staff_name: string;
  kpis: {
    gross_revenue: number;
    net_earnings: number;
    available_balance: number;
    ticket_revenue: number;
    tickets_sold: number;
    table_revenue: number;
    tables_booked: number;
    pending_approvals_count: number;
    pending_approvals_amount: number;
    pending_ticket_orders_count: number;
    pending_table_orders_count: number;
    promoter_revenue: number;
    promoter_sales_count: number;
    promoter_commissions: number;
    completed_payouts: number;
    pending_payouts: number;
    pending_payouts_count: number;
  };
  revenue_by_category: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
  revenue_by_event: Array<{
    event_id: number;
    title: string;
    date: string | null;
    status: string;
    tickets_sold: number;
    ticket_revenue: number;
    tables_booked: number;
    table_revenue: number;
    total_revenue: number;
    pending_approvals: number;
  }>;
}

const FinanceWorkspace = () => {
  const { session, profile } = useAuthStore();
  const [overview, setOverview] = useState<FinanceOverviewData | null>(null);
  const [ticketOrders, setTicketOrders] = useState<any[]>([]);
  const [tableOrders, setTableOrders] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'payouts'>('overview');

  const canApproveOrders =
    !profile?.staff_role ||
    profile.staff_role.toLowerCase() === 'finance' ||
    profile.staff_role.toLowerCase() === 'manager' ||
    !!profile.staff_permissions?.ordersApproval;

  const canManagePayouts =
    !profile?.staff_role ||
    profile.staff_role.toLowerCase() === 'finance' ||
    profile.staff_role.toLowerCase() === 'manager' ||
    !!profile.staff_permissions?.payouts;

  const fetchFinanceData = useCallback(async () => {
    const token = session?.access_token || localStorage.getItem('auth-token');
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [overviewRes, ticketsRes, tablesRes, payoutsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/business/finance/overview`, { headers }),
        fetch(`${API_BASE_URL}/tickets/business/tickets`, { headers }),
        fetch(`${API_BASE_URL}/tables/business/orders`, { headers }),
        fetch(`${API_BASE_URL}/payments/business/transactions`, { headers }),
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setOverview(data);
      }
      if (ticketsRes.ok) {
        const tData = await ticketsRes.json();
        setTicketOrders(Array.isArray(tData) ? tData : tData.tickets || []);
      }
      if (tablesRes.ok) {
        const tbData = await tablesRes.json();
        setTableOrders(Array.isArray(tbData) ? tbData : tbData.orders || []);
      }
      if (payoutsRes.ok) {
        const pData = await payoutsRes.json();
        setPayouts(Array.isArray(pData) ? pData : pData.transactions || pData.payouts || []);
      }
    } catch (err) {
      console.error('Error loading finance workspace:', err);
      toast.error('Failed to sync finance data');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const handleApproveTicket = async (ticketId: number) => {
    const token = session?.access_token || localStorage.getItem('auth-token');
    if (!token) return;
    setProcessingId(`ticket-${ticketId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to approve ticket order');
      }
      toast.success('Ticket payment approved & QR ticket issued');
      await fetchFinanceData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve ticket order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTicket = async (ticketId: number) => {
    const token = session?.access_token || localStorage.getItem('auth-token');
    if (!token) return;
    setProcessingId(`ticket-${ticketId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to reject ticket order');
      }
      toast.success('Ticket order rejected');
      await fetchFinanceData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject ticket order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleTableStatus = async (orderId: number, action: 'approve' | 'reject') => {
    const token = session?.access_token || localStorage.getItem('auth-token');
    if (!token) return;
    setProcessingId(`table-${orderId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/tables/business/orders/${orderId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to ${action} table booking`);
      }
      toast.success(action === 'approve' ? 'VIP Table booking approved' : 'VIP Table booking rejected');
      await fetchFinanceData();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} table booking`);
    } finally {
      setProcessingId(null);
    }
  };

  const exportFinanceCSV = () => {
    if (!overview) return;
    const rows: string[][] = [
      ['Metric / Event', 'Category', 'Tickets Sold', 'Ticket Revenue (CNY)', 'Tables Booked', 'Table Revenue (CNY)', 'Total Revenue (CNY)'],
      ['SUMMARY: Gross Revenue', 'All', String(overview.kpis.tickets_sold), String(overview.kpis.ticket_revenue), String(overview.kpis.tables_booked), String(overview.kpis.table_revenue), String(overview.kpis.gross_revenue)],
      ['SUMMARY: Net Earnings', 'Net', '-', '-', '-', '-', String(overview.kpis.net_earnings)],
      ['SUMMARY: Available Balance', 'Balance', '-', '-', '-', '-', String(overview.kpis.available_balance)],
      ...overview.revenue_by_event.map(ev => [
        `"${(ev.title || '').replace(/"/g, '""')}"`,
        ev.status,
        String(ev.tickets_sold),
        String(ev.ticket_revenue),
        String(ev.tables_booked),
        String(ev.table_revenue),
        String(ev.total_revenue),
      ]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `soundit_business_finance_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial report exported to CSV');
  };

  const pendingTicketOrders = ticketOrders.filter(
    t => (t.status || '').toLowerCase() === 'pending' || (t.status || '').toLowerCase() === 'awaiting_approval'
  );
  const pendingTableOrders = tableOrders.filter(
    o => (o.status || '').toLowerCase() === 'pending'
  );
  const totalPendingCount = pendingTicketOrders.length + pendingTableOrders.length;

  const kpis = overview?.kpis || {
    gross_revenue: 0,
    net_earnings: 0,
    available_balance: 0,
    ticket_revenue: 0,
    tickets_sold: 0,
    table_revenue: 0,
    tables_booked: 0,
    pending_approvals_count: 0,
    pending_approvals_amount: 0,
    pending_ticket_orders_count: 0,
    pending_table_orders_count: 0,
    promoter_revenue: 0,
    promoter_sales_count: 0,
    promoter_commissions: 0,
    completed_payouts: 0,
    pending_payouts: 0,
    pending_payouts_count: 0,
  };

  const kpiCards = [
    {
      label: 'Gross Revenue',
      value: `¥${kpis.gross_revenue.toLocaleString()}`,
      sub: `${kpis.tickets_sold} tickets + ${kpis.tables_booked} VIP tables`,
      icon: DollarSign,
      color: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Net Earnings',
      value: `¥${kpis.net_earnings.toLocaleString()}`,
      sub: kpis.promoter_commissions > 0 ? `After ¥${kpis.promoter_commissions.toLocaleString()} promoter commission` : '0% platform commission',
      icon: TrendingUp,
      color: 'from-[#d3da0c]/20 to-[#d3da0c]/5 border-[#d3da0c]/30',
      iconColor: 'text-[#d3da0c]',
    },
    {
      label: 'Available Balance',
      value: `¥${kpis.available_balance.toLocaleString()}`,
      sub: `¥${kpis.completed_payouts.toLocaleString()} settled to date`,
      icon: Wallet,
      color: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
      iconColor: 'text-cyan-400',
    },
    {
      label: 'Event Ticket Sales',
      value: `¥${kpis.ticket_revenue.toLocaleString()}`,
      sub: `${kpis.tickets_sold} confirmed tickets`,
      icon: Ticket,
      color: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
      iconColor: 'text-purple-400',
    },
    {
      label: 'VIP Table Revenue',
      value: `¥${kpis.table_revenue.toLocaleString()}`,
      sub: `${kpis.tables_booked} approved tables`,
      icon: Wine,
      color: 'from-pink-500/20 to-pink-600/5 border-pink-500/30',
      iconColor: 'text-pink-400',
    },
    {
      label: 'Pending Approvals',
      value: String(totalPendingCount || kpis.pending_approvals_count),
      sub: `¥${kpis.pending_approvals_amount.toLocaleString()} awaiting verification`,
      icon: Clock,
      color: 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
      iconColor: 'text-amber-400',
    },
  ];

  const maxCategoryRevenue = Math.max(
    ...(overview?.revenue_by_category.map(c => c.amount) || [1]),
    1
  );

  return (
    <div className="space-y-6 p-6 lg:p-10">
      {/* Role Workspace Banner (modeled after Sound It Platform Finance Role) */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-neutral-50 to-white dark:from-emerald-500/15 dark:via-[#111111] dark:to-[#111111] rounded-2xl p-6 border border-emerald-500/30 shadow-xs dark:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {profile?.staff_role ? `${profile.staff_role} Role` : 'Finance & Revenue Role'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#d3da0c]" />
                {overview?.business_name || profile?.business_name || profile?.display_name || 'Business Portal'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#020b00] dark:text-white">
              Finance & Revenue Workspace
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Track ticket & VIP table revenue, verify customer payments, export financial reports, and manage settlements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportFinanceCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-800 dark:text-gray-200 text-sm font-medium border border-black/10 dark:border-white/10 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Export CSV
            </button>
            <button
              onClick={fetchFinanceData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-emerald-500 dark:text-black text-sm font-semibold hover:opacity-90 dark:hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Data
            </button>
          </div>
        </div>
      </div>

      {/* 6 Finance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white dark:bg-gradient-to-br ${card.color} rounded-2xl p-5 border shadow-xs dark:shadow-none`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center">
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              {card.label === 'Pending Approvals' && totalPendingCount > 0 && (
                <button
                  onClick={() => setActiveTab('approvals')}
                  className="text-xs font-semibold text-amber-500 dark:text-amber-400 hover:underline flex items-center gap-1"
                >
                  Review Now <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-2xl font-bold text-[#020b00] dark:text-white">{loading ? '—' : card.value}</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">{card.label}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 dark:border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-[#020b00] text-[#d3da0c] dark:bg-emerald-500 dark:text-black font-semibold'
              : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'
          }`}
        >
          Revenue Breakdown & Events
        </button>
        {canApproveOrders && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'approvals'
                ? 'bg-[#020b00] text-[#d3da0c] dark:bg-emerald-500 dark:text-black font-semibold'
                : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'
            }`}
          >
            Payment Approvals Queue
            {totalPendingCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'approvals' ? 'bg-[#d3da0c]/20 text-[#d3da0c] dark:bg-black/20 dark:text-black' : 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
              }`}>
                {totalPendingCount}
              </span>
            )}
          </button>
        )}
        {canManagePayouts && (
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'payouts'
                ? 'bg-[#020b00] text-[#d3da0c] dark:bg-emerald-500 dark:text-black font-semibold'
                : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'
            }`}
          >
            Payouts & Withdrawals
          </button>
        )}
      </div>

      {/* TAB 1: Revenue Breakdown & Event Performance */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue by Category (matches Platform Finance Role) */}
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 p-6 space-y-5 shadow-xs dark:shadow-none">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#020b00] dark:text-white">Revenue by Category</h2>
              <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="space-y-4">
              {(overview?.revenue_by_category || []).map((cat) => {
                const pct = Math.min(100, Math.round((cat.amount / maxCategoryRevenue) * 100));
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{cat.category}</span>
                      <span className="text-[#020b00] dark:text-white font-semibold">¥{cat.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-[#d3da0c] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, cat.amount > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{cat.count} confirmed orders</p>
                  </div>
                );
              })}
            </div>

            {/* Quick Links for Finance Staff */}
            <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Finance Shortcuts</p>
              <div className="grid grid-cols-1 gap-2">
                <Link
                  to="/dashboard/business/ticket-orders"
                  className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm text-gray-800 dark:text-gray-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    All Ticket Orders
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-gray-500" />
                </Link>
                <Link
                  to="/dashboard/business/tables"
                  className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm text-gray-800 dark:text-gray-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Wine className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                    VIP Table Reservations & PDF
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-gray-500" />
                </Link>
                {canManagePayouts && (
                  <Link
                    to="/dashboard/business/payouts"
                    className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                      Manage Payout Methods & Withdraw
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-gray-500" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Revenue by Event Table */}
          <div className="lg:col-span-2 bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 overflow-hidden shadow-xs dark:shadow-none">
            <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#020b00] dark:text-white">Event Financial Breakdown</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ticket & VIP Table revenue per event</p>
              </div>
              <Calendar className="w-5 h-5 text-[#d3da0c]" />
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">Loading financial breakdown...</p>
              </div>
            ) : (overview?.revenue_by_event || []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/5 text-xs uppercase text-gray-500">
                      <th className="p-4">Event</th>
                      <th className="p-4">Tickets</th>
                      <th className="p-4">VIP Tables</th>
                      <th className="p-4">Pending</th>
                      <th className="p-4 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm">
                    {overview?.revenue_by_event.map((ev) => (
                      <tr key={ev.event_id} className="hover:bg-black/[0.02] dark:hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <p className="text-[#020b00] dark:text-white font-medium">{ev.title}</p>
                          <p className="text-xs text-gray-500">
                            {ev.date ? new Date(ev.date).toLocaleDateString() : 'TBA'} •{' '}
                            <span className="uppercase">{ev.status}</span>
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-[#020b00] dark:text-white font-medium">¥{ev.ticket_revenue.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{ev.tickets_sold} sold</p>
                        </td>
                        <td className="p-4">
                          <p className="text-[#020b00] dark:text-white font-medium">¥{ev.table_revenue.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{ev.tables_booked} booked</p>
                        </td>
                        <td className="p-4">
                          {ev.pending_approvals > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                              <AlertCircle className="w-3 h-3" />
                              {ev.pending_approvals} pending
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">All clear</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
                            ¥{ev.total_revenue.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No events or revenue recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Pending Payment Approvals Queue */}
      {activeTab === 'approvals' && canApproveOrders && (
        <div className="space-y-6">
          {/* Pending Ticket Orders */}
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 overflow-hidden shadow-xs dark:shadow-none">
            <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#020b00] dark:text-white">
                  Pending Ticket Payment Approvals ({pendingTicketOrders.length})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Verify customer WeChat / Alipay payment before issuing QR tickets
                </p>
              </div>
              <Link
                to="/dashboard/business/ticket-orders"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Open Full Ticket Orders <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {pendingTicketOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
                No pending ticket orders waiting for payment approval.
              </div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {pendingTicketOrders.map((t) => (
                  <div key={t.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/[0.02] dark:hover:bg-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#020b00] dark:text-white font-semibold">{t.buyer_name || t.user_name || t.buyer_email || `Order #${t.id}`}</span>
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                          {t.ticket_type_name || 'Ticket'} × {t.quantity || 1}
                        </span>
                        {t.buyer_confirmed_payment && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            Buyer Marked Paid
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Event: <span className="text-[#020b00] dark:text-gray-200">{t.event_title || `Event #${t.event_id}`}</span>
                        {t.buyer_phone ? ` • Phone: ${t.buyer_phone}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ¥{Number(t.total_price ?? t.price ?? 0).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleApproveTicket(t.id)}
                        disabled={processingId === `ticket-${t.id}`}
                        className="px-3.5 py-2 rounded-lg bg-[#020b00] text-[#d3da0c] dark:bg-emerald-500 dark:text-black text-xs font-bold hover:opacity-90 dark:hover:bg-emerald-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectTicket(t.id)}
                        disabled={processingId === `ticket-${t.id}`}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending VIP Table Bookings */}
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 overflow-hidden shadow-xs dark:shadow-none">
            <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#020b00] dark:text-white">
                  Pending VIP Table Bookings ({pendingTableOrders.length})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Approve or reject VIP table reservations after confirming payment
                </p>
              </div>
              <Link
                to="/dashboard/business/tables"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Open Table Reservations <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {pendingTableOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
                No pending VIP table bookings waiting for payment approval.
              </div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {pendingTableOrders.map((o) => (
                  <div key={o.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/[0.02] dark:hover:bg-white/5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#020b00] dark:text-white font-semibold">{o.contact_name || o.user_name || `Table Booking #${o.id}`}</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-pink-500/20 text-pink-600 dark:text-pink-400 font-medium">
                          {o.package_name || 'VIP Table'}
                        </span>
                        {o.buyer_confirmed_payment && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            Buyer Marked Paid
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Event: <span className="text-[#020b00] dark:text-gray-200">{o.event_title || `Event #${o.event_id}`}</span>
                        {o.contact_phone ? ` • Phone: ${o.contact_phone}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ¥{Number(o.total_price || 0).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleTableStatus(o.id, 'approve')}
                        disabled={processingId === `table-${o.id}`}
                        className="px-3.5 py-2 rounded-lg bg-[#020b00] text-[#d3da0c] dark:bg-emerald-500 dark:text-black text-xs font-bold hover:opacity-90 dark:hover:bg-emerald-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleTableStatus(o.id, 'reject')}
                        disabled={processingId === `table-${o.id}`}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Payouts & Withdrawals */}
      {activeTab === 'payouts' && canManagePayouts && (
        <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 overflow-hidden shadow-xs dark:shadow-none">
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#020b00] dark:text-white">Payouts & Settlement History</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Available Balance: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">¥{kpis.available_balance.toLocaleString()}</span> • Completed Payouts: <span className="text-[#020b00] dark:text-white font-semibold">¥{kpis.completed_payouts.toLocaleString()}</span>
              </p>
            </div>
            <Link
              to="/dashboard/business/payouts"
              className="px-4 py-2.5 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-sm font-semibold hover:opacity-90 transition-colors inline-flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Request Withdrawal / Payment Methods
            </Link>
          </div>

          {payouts.length === 0 ? (
            <div className="p-10 text-center text-gray-500 dark:text-gray-400 text-sm">
              <Wallet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              No payout transactions recorded yet. Use the button above to configure Alipay/WeChat/Bank payout methods or request a withdrawal.
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {payouts.slice(0, 15).map((p: any, idx: number) => (
                <div key={p.id || idx} className="p-4 flex items-center justify-between hover:bg-black/[0.02] dark:hover:bg-white/5">
                  <div>
                    <p className="text-[#020b00] dark:text-white font-medium text-sm">{p.description || p.type || `Transaction #${p.id || idx + 1}`}</p>
                    <p className="text-xs text-gray-500">
                      {p.created_at || p.date ? new Date(p.created_at || p.date).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#020b00] dark:text-white font-bold">¥{Number(p.amount || 0).toLocaleString()}</span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 capitalize">
                      {p.status || 'completed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinanceWorkspace;
