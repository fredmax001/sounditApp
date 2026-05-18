import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Ticket, DollarSign, Calendar, BarChart3,
  Loader2, RefreshCw, Download, Eye, Target, MapPin, Share2,
  ChevronDown, Activity, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const PERIOD_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: '1 Year', value: 365 },
];

const CHART_COLORS = ['#d3da0c', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

interface OverviewData {
  total_events: number;
  upcoming_events: number;
  past_events: number;
  total_revenue: number;
  all_time_revenue: number;
  total_tickets: number;
  all_time_tickets: number;
  total_views: number;
  followers_count: number;
  conversion_rate: number;
  avg_order_value: number;
  revenue_growth: number;
  ticket_growth: number;
  total_capacity: number;
}

interface SalesData {
  daily_sales: { date: string; revenue: number; tickets: number }[];
  tier_revenue: { name: string; revenue: number; tickets: number }[];
  status_breakdown: { status: string; count: number; revenue: number }[];
}

interface EventPerf {
  id: number;
  title: string;
  start_date: string;
  status: string;
  capacity: number;
  views: number;
  tickets_sold: number;
  revenue: number;
  period_revenue: number;
  period_tickets: number;
  fill_rate: number;
  checkins: number;
}

interface AudienceData {
  total_attendees: number;
  new_attendees: number;
  returning_attendees: number;
  cities: { city: string; count: number }[];
  demographics: { gender: Record<string, number>; age_groups: Record<string, number> };
}

interface PromoterData {
  total_promoters: number;
  total_clicks: number;
  total_sales: number;
  total_revenue: number;
  top_promoters: {
    id: number; name: string; event_id: number; referral_code: string;
    clicks: number; sales: number; revenue: number; commission: number;
  }[];
}

interface RealtimeData {
  today_revenue: number;
  today_tickets: number;
  today_checkins: number;
  pending_orders: number;
  live_events: number;
}

type TabKey = 'overview' | 'sales' | 'events' | 'audience' | 'promoters';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'sales', label: 'Sales', icon: BarChart3 },
  { key: 'events', label: 'Events', icon: Calendar },
  { key: 'audience', label: 'Audience', icon: Users },
  { key: 'promoters', label: 'Promoters', icon: Share2 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      {label && <p className="text-gray-400 text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-white text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export default function BusinessAnalytics() {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [sales, setSales] = useState<SalesData | null>(null);
  const [eventsPerf, setEventsPerf] = useState<EventPerf[]>([]);
  const [audience, setAudience] = useState<AudienceData | null>(null);
  const [promoters, setPromoters] = useState<PromoterData | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ov, sl, ev, au, pr, rt] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/organizer/analytics/overview?days=${period}`, { headers }),
        fetch(`${API_BASE_URL}/dashboard/organizer/analytics/sales?days=${period}`, { headers }),
        fetch(`${API_BASE_URL}/dashboard/organizer/analytics/events?days=${period}`, { headers }),
        fetch(`${API_BASE_URL}/dashboard/organizer/analytics/audience?days=${period}`, { headers }),
        fetch(`${API_BASE_URL}/dashboard/organizer/analytics/promoters?days=${period}`, { headers }),
        fetch(`${API_BASE_URL}/dashboard/organizer/analytics/realtime`, { headers }),
      ]);

      if (ov.ok) setOverview(await ov.json());
      if (sl.ok) setSales(await sl.json());
      if (ev.ok) setEventsPerf((await ev.json()).events || []);
      if (au.ok) setAudience(await au.json());
      if (pr.ok) setPromoters(await pr.json());
      if (rt.ok) setRealtime(await rt.json());
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const exportCSV = () => {
    if (!overview || !sales) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Events', overview.total_events],
      ['Total Revenue', overview.all_time_revenue],
      ['Total Tickets', overview.all_time_tickets],
      ['Conversion Rate %', overview.conversion_rate],
      ['Avg Order Value', overview.avg_order_value],
      ['Followers', overview.followers_count],
      ['Revenue Growth %', overview.revenue_growth],
      ['Ticket Growth %', overview.ticket_growth],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  const statCards = overview ? [
    { label: 'Total Revenue', value: `¥${overview.all_time_revenue.toLocaleString()}`, sub: `${overview.revenue_growth >= 0 ? '+' : ''}${overview.revenue_growth}% vs last period`, icon: DollarSign, up: overview.revenue_growth >= 0 },
    { label: 'Tickets Sold', value: overview.all_time_tickets.toLocaleString(), sub: `${overview.ticket_growth >= 0 ? '+' : ''}${overview.ticket_growth}% vs last period`, icon: Ticket, up: overview.ticket_growth >= 0 },
    { label: 'Events', value: `${overview.total_events}`, sub: `${overview.upcoming_events} upcoming`, icon: Calendar, up: true },
    { label: 'Conversion Rate', value: `${overview.conversion_rate}%`, sub: `of ${overview.total_capacity} capacity`, icon: Target, up: overview.conversion_rate > 50 },
    { label: 'Avg Order', value: `¥${overview.avg_order_value}`, sub: 'per ticket', icon: TrendingUp, up: true },
    { label: 'Followers', value: overview.followers_count.toLocaleString(), sub: 'total followers', icon: Users, up: true },
  ] : [];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Realtime stats */}
      {realtime && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Today's Revenue", value: `¥${realtime.today_revenue.toLocaleString()}`, icon: DollarSign },
            { label: "Today's Tickets", value: realtime.today_tickets, icon: Ticket },
            { label: 'Check-ins', value: realtime.today_checkins, icon: Users },
            { label: 'Pending Orders', value: realtime.pending_orders, icon: Activity },
            { label: 'Live Events', value: realtime.live_events, icon: Calendar },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-[#111111] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-3.5 h-3.5 text-[#d3da0c]" />
                <span className="text-gray-500 text-[10px]">{s.label}</span>
              </div>
              <p className="text-white font-bold text-sm lg:text-base">{s.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-[#111111] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
                <s.icon className="w-4 h-4 text-[#d3da0c]" />
              </div>
              {s.up ? <ArrowUpRight className="w-4 h-4 text-green-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
            </div>
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-white font-bold text-lg">{s.value}</p>
            <p className="text-gray-500 text-[10px]">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Daily Sales Chart */}
      {sales && sales.daily_sales.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
          <h3 className="text-white font-bold mb-4">Daily Revenue & Tickets</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales.daily_sales}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d3da0c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#d3da0c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis yAxisId="left" tick={{ fill: '#666', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#666', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#999' }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue (¥)" stroke="#d3da0c" fill="url(#revGrad)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="tickets" name="Tickets" stroke="#8b5cf6" fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderSales = () => (
    <div className="space-y-6">
      {!sales ? (
        <div className="text-center py-20 text-gray-500">No sales data available</div>
      ) : (
        <>
          {/* Daily Sales Bar Chart */}
          {sales.daily_sales.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
              <h3 className="text-white font-bold mb-4">Daily Sales</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales.daily_sales}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue (¥)" fill="#d3da0c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tickets" name="Tickets" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ) : (
            <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center">
              <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No sales in this period</p>
            </div>
          )}

          {/* Tier Revenue & Status Breakdown */}
          <div className="grid lg:grid-cols-2 gap-4">
            {sales.tier_revenue.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
                <h3 className="text-white font-bold mb-4">Revenue by Ticket Tier</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sales.tier_revenue} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {sales.tier_revenue.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            ) : (
              <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center">
                <PieChartIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No tier data</p>
              </div>
            )}

            {sales.status_breakdown.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
                <h3 className="text-white font-bold mb-4">Orders by Status</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sales.status_breakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                        {sales.status_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            ) : (
              <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center">
                <PieChartIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">No order status data</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderEvents = () => (
    <div className="space-y-6">
      {eventsPerf.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl overflow-hidden">
          <div className="p-4 lg:p-6 border-b border-white/5">
            <h3 className="text-white font-bold">Event Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase border-b border-white/5">
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Views</th>
                  <th className="py-3 px-4 text-right">Sold</th>
                  <th className="py-3 px-4 text-right">Capacity</th>
                  <th className="py-3 px-4 text-right">Fill %</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {eventsPerf.map((ev) => (
                  <tr key={ev.id} className="border-b border-white/5 text-xs hover:bg-white/5">
                    <td className="py-3 px-4">
                      <p className="text-white font-medium truncate max-w-[120px] lg:max-w-[200px]">{ev.title}</p>
                      <p className="text-gray-500 text-[10px]">{ev.start_date ? new Date(ev.start_date).toLocaleDateString() : ''}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ev.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        ev.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        ev.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>{ev.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400">{ev.views.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-white">{ev.tickets_sold}</td>
                    <td className="py-3 px-4 text-right text-gray-400">{ev.capacity || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#d3da0c] rounded-full" style={{ width: `${Math.min(ev.fill_rate, 100)}%` }} />
                        </div>
                        <span className="text-[#d3da0c] font-medium">{ev.fill_rate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-medium">¥{ev.revenue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-400">{ev.checkins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Event Views Bar Chart */}
      {eventsPerf.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
          <h3 className="text-white font-bold mb-4">Event Views vs Tickets Sold</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventsPerf.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="title" tick={{ fill: '#666', fontSize: 10 }} tickFormatter={(v) => v.slice(0, 12)} />
                <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="views" name="Views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tickets_sold" name="Tickets Sold" fill="#d3da0c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderAudience = () => (
    <div className="space-y-6">
      {audience && (
        <>
          {/* Audience stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Attendees', value: audience.total_attendees, icon: Users },
              { label: 'New', value: audience.new_attendees, icon: TrendingUp },
              { label: 'Returning', value: audience.returning_attendees, icon: RefreshCw },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-[#111111] border border-white/5 rounded-xl p-4 text-center">
                <s.icon className="w-5 h-5 text-[#d3da0c] mx-auto mb-2" />
                <p className="text-white font-bold text-xl">{s.value}</p>
                <p className="text-gray-500 text-xs">{s.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Cities */}
            {audience.cities.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#d3da0c]" /> Attendees by City</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={audience.cities.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis type="number" tick={{ fill: '#666', fontSize: 11 }} />
                      <YAxis dataKey="city" type="category" tick={{ fill: '#666', fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Attendees" fill="#d3da0c" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Gender */}
            {Object.keys(audience.demographics.gender).length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-[#d3da0c]" /> Gender Distribution</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(audience.demographics.gender).map(([k, v]) => ({ name: k, value: v }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {Object.entries(audience.demographics.gender).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </div>

          {/* Age Groups */}
          {Object.keys(audience.demographics.age_groups).length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl p-4 lg:p-6">
              <h3 className="text-white font-bold mb-4">Age Groups</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.entries(audience.demographics.age_groups).map(([k, v]) => ({ name: k.replace(/_/g, '-'), value: v }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Attendees" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );

  const renderPromoters = () => (
    <div className="space-y-6">
      {!promoters ? (
        <div className="text-center py-20 text-gray-500">No promoter data available</div>
      ) : (
        <>
          {/* Promoter stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Promoters', value: promoters.total_promoters, icon: Users },
              { label: 'Total Clicks', value: promoters.total_clicks.toLocaleString(), icon: Eye },
              { label: 'Promoter Sales', value: promoters.total_sales, icon: Ticket },
              { label: 'Promoter Revenue', value: `¥${promoters.total_revenue.toLocaleString()}`, icon: DollarSign },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-[#111111] border border-white/5 rounded-xl p-4">
                <s.icon className="w-5 h-5 text-[#d3da0c] mb-2" />
                <p className="text-white font-bold text-lg">{s.value}</p>
                <p className="text-gray-500 text-xs">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Top Promoters Table */}
          {promoters.top_promoters.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111111] border border-white/5 rounded-xl overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-white/5">
                <h3 className="text-white font-bold">Top Promoters</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500 text-[10px] uppercase border-b border-white/5">
                      <th className="py-3 px-4">Promoter</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4 text-right">Clicks</th>
                      <th className="py-3 px-4 text-right">Sales</th>
                      <th className="py-3 px-4 text-right">Revenue</th>
                      <th className="py-3 px-4 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoters.top_promoters.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 text-xs hover:bg-white/5">
                        <td className="py-3 px-4 text-white font-medium">{p.name}</td>
                        <td className="py-3 px-4"><code className="text-[#d3da0c] text-[10px]">{p.referral_code}</code></td>
                        <td className="py-3 px-4 text-right text-gray-400">{p.clicks}</td>
                        <td className="py-3 px-4 text-right text-white">{p.sales}</td>
                        <td className="py-3 px-4 text-right text-white font-medium">¥{p.revenue.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-green-400">¥{p.commission.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <div className="bg-[#111111] border border-white/5 rounded-xl p-8 text-center">
              <Share2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No promoters assigned yet</p>
              <p className="text-gray-600 text-sm mt-1">Assign promoters to your events to see their performance here</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-6 pb-4 px-4 lg:p-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-display text-white">Business <span className="text-[#d3da0c]">Analytics</span></h1>
          <p className="text-gray-400 text-xs lg:text-sm">Deep insights into your events, sales, and audience</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="appearance-none bg-[#111111] border border-white/10 text-white text-sm rounded-lg px-3 py-2 pr-8 focus:border-[#d3da0c] focus:outline-none"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={fetchAll}
            disabled={refreshing}
            className="p-2 bg-[#111111] border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-2 bg-[#111111] border border-white/10 text-white text-sm rounded-lg hover:bg-white/5 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111111] border border-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'sales' && renderSales()}
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'audience' && renderAudience()}
          {activeTab === 'promoters' && renderPromoters()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
