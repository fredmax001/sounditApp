import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  LayoutDashboard, Globe, Users, Smartphone, Calendar, Clock,
  Loader2, Filter, Download, TrendingUp, TrendingDown, Activity,
  Zap, DollarSign, Ticket, ShoppingCart, MessageSquare, Heart,
  Eye, MousePointer, ArrowUpRight, ArrowDownRight, BarChart3,
  MapPin, Monitor, Tablet, Laptop, Sun, Moon, RefreshCw,
  ChevronDown, FileSpreadsheet, FileText, Sparkles, Target,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

const COLORS = [
  "#d3da0c", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444",
  "#a855f7", "#06b6d4", "#f97316", "#ec4899", "#84cc16",
];

const DAYS_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "365 Days", value: 365 },
];

// ── Types ───────────────────────────────────────────────────────────

interface SummaryData {
  total_visits: number;
  unique_visitors: number;
  unique_sessions: number;
  returning_visitors: number;
  bounce_rate: number;
  avg_session_duration: number;
  growth_percentage: number;
  live_active_users: number;
  top_pages: { path: string; count: number }[];
  entry_pages: { path: string; count: number }[];
  exit_pages: { path: string; count: number }[];
  daily: { date: string; visits: number; unique_ips: number }[];
}

interface GeoData {
  countries: { name: string; visits: number; unique_ips: number }[];
  cities: { name: string; country: string; visits: number; unique_ips: number }[];
  regions: { country: string; code: string; visits: number }[];
  focus_regions: { china: number; africa: number; united_states: number; europe: number };
}

interface DemoData {
  gender: { label: string; visits: number }[];
  age_buckets: { label: string; visits: number }[];
  languages: { code: string; count: number }[];
}

interface DeviceData {
  browsers: { name: string; visits: number }[];
  os: { name: string; visits: number }[];
  devices: { name: string; visits: number }[];
  screen_resolutions: { resolution: string; count: number }[];
}

interface TrendData {
  daily: { date: string; visits: number; unique_ips: number }[];
  hourly: { hour: number; visits: number }[];
  weekly: { day: number; visits: number }[];
}

interface EngagementData {
  overview: {
    new_users: number;
    active_users: number;
    bookings: number;
    ticket_orders: number;
    ticket_revenue: number;
    artist_follows: number;
    event_follows: number;
    posts: number;
    comments: number;
    likes: number;
    messages: number;
    new_subscriptions: number;
  };
  events: { type: string; count: number }[];
  by_role: { role: string; active_users: number; events: number }[];
  daily: { date: string; active_users: number; events: number }[];
}

interface RoleData {
  roles: { role: string; label: string; total: number; new: number; active: number; verified: number; premium: number }[];
  profiles: { artists: number; businesses: number; vendors: number; organizers: number };
}

interface EventAnalyticsData {
  overview: {
    total_events: number;
    approved_events: number;
    event_views: number;
    ticket_orders: number;
    tickets_sold: number;
    ticket_revenue: number;
    conversion_rate: number;
    checkins: number;
  };
  top_events_by_views: { id: string; title: string; views: number }[];
  top_events_by_revenue: { id: number; title: string; revenue: number; tickets_sold: number }[];
  daily_sales: { date: string; orders: number; revenue: number }[];
}

interface RealtimeData {
  live_visitors: number;
  live_sessions: number;
  today_registrations: number;
  today_bookings: number;
  today_tickets: number;
  today_revenue: number;
  active_countries: { country: string; visitors: number }[];
  active_pages: { path: string; views: number }[];
  timestamp: string;
}

interface Insight {
  type: string;
  severity: "positive" | "warning" | "info";
  message: string;
  value: number;
  icon: string;
}

interface InsightsData {
  insights: Insight[];
  generated_at: string;
}

// ── Helper Components ───────────────────────────────────────────────

function StatCard({
  title, value, change, icon: Icon, suffix = "", prefix = "",
}: {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  suffix?: string;
  prefix?: string;
}) {
  const isPositive = change === undefined ? undefined : change >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-white/5 rounded-xl p-5 hover:border-[#d3da0c]/20 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#d3da0c]" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center text-xs font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
      </div>
      <div className="text-sm text-gray-400">{title}</div>
    </motion.div>
  );
}

function SectionHeader({ title, icon: Icon, action }: { title: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#d3da0c]" />
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function ChartCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111111] border border-white/5 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      LIVE
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const token = localStorage.getItem("auth-token") || localStorage.getItem("token") || "";
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [roles, setRoles] = useState<RoleData | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalyticsData | null>(null);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);

  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [
        sRes, gRes, dRes, devRes, tRes, eRes, rRes, evRes, rtRes, iRes,
      ] = await Promise.all([
        fetch(`${API_URL}/analytics/visits/summary?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/visits/geography?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/visits/demographics?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/visits/devices?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/visits/trends?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/engagement?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/roles?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/events-performance?days=${days}`, { headers }),
        fetch(`${API_URL}/analytics/realtime`, { headers }),
        fetch(`${API_URL}/analytics/insights?days=${days}`, { headers }),
      ]);

      if (sRes.ok) setSummary(await sRes.json());
      if (gRes.ok) setGeo(await gRes.json());
      if (dRes.ok) setDemo(await dRes.json());
      if (devRes.ok) setDevice(await devRes.json());
      if (tRes.ok) setTrends(await tRes.json());
      if (eRes.ok) setEngagement(await eRes.json());
      if (rRes.ok) setRoles(await rRes.json());
      if (evRes.ok) setEventAnalytics(await evRes.json());
      if (rtRes.ok) setRealtime(await rtRes.json());
      if (iRes.ok) setInsights(await iRes.json());
    } catch (e) {
      console.error("Analytics fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, token]);

  const fetchRealtime = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_URL}/analytics/realtime`, { headers });
      if (res.ok) setRealtime(await res.json());
    } catch {
      // Silent fail for live polling
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live polling for real-time metrics
  useEffect(() => {
    liveIntervalRef.current = setInterval(fetchRealtime, 10000); // every 10s
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [fetchRealtime]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleExport = async (reportType: string, format: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(
        `${API_URL}/analytics/export/${reportType}?days=${days}&format=${format}`,
        { headers }
      );
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_${days}d.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "traffic", label: "Traffic", icon: Activity },
    { id: "engagement", label: "Engagement", icon: Heart },
    { id: "events", label: "Events", icon: Ticket },
    { id: "roles", label: "Roles", icon: Users },
    { id: "insights", label: "AI Insights", icon: Sparkles },
  ];

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-[#d3da0c]" />
              <div>
                <h1 className="text-xl font-bold text-white">Analytics Dashboard</h1>
                <p className="text-sm text-gray-400">Enterprise Insights for Soundit Platform</p>
              </div>
              <LivePill />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Period Selector */}
              <div className="relative">
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="appearance-none bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2 pr-10 text-sm text-white focus:outline-none focus:border-[#d3da0c]/50 cursor-pointer"
                >
                  {DAYS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>

              {/* Export */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-2 bg-[#d3da0c]/10 border border-[#d3da0c]/20 rounded-lg text-sm text-[#d3da0c] hover:bg-[#d3da0c]/20 transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all z-50">
                  <div className="p-2 space-y-1">
                    <button onClick={() => handleExport("visits", "csv")} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" /> Visits (CSV)
                    </button>
                    <button onClick={() => handleExport("events", "csv")} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" /> Events (CSV)
                    </button>
                    <button onClick={() => handleExport("visits", "json")} className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Visits (JSON)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[#d3da0c]/10 text-[#d3da0c] border border-[#d3da0c]/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Live Stats */}
              {realtime && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard title="Live Visitors" value={realtime.live_visitors} icon={Activity} />
                  <StatCard title="Live Sessions" value={realtime.live_sessions} icon={Zap} />
                  <StatCard title="Today's Signups" value={realtime.today_registrations} icon={Users} />
                  <StatCard title="Today's Bookings" value={realtime.today_bookings} icon={Calendar} />
                  <StatCard title="Today's Tickets" value={realtime.today_tickets} icon={Ticket} />
                  <StatCard title="Today's Revenue" value={realtime.today_revenue} icon={DollarSign} prefix="¥" />
                </div>
              )}

              {/* Summary Stats */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard title="Total Visits" value={summary.total_visits} change={summary.growth_percentage} icon={Eye} />
                  <StatCard title="Unique Visitors" value={summary.unique_visitors} icon={Users} />
                  <StatCard title="Sessions" value={summary.unique_sessions} icon={Activity} />
                  <StatCard title="Returning" value={summary.returning_visitors} icon={TrendingUp} />
                  <StatCard title="Bounce Rate" value={`${summary.bounce_rate}%`} icon={MousePointer} />
                  <StatCard title="Avg Duration" value={`${Math.round(summary.avg_session_duration / 60)}m`} icon={Clock} />
                </div>
              )}

              {/* Traffic Chart */}
              {summary && (
                <ChartCard>
                  <SectionHeader title="Traffic Overview" icon={Activity} />
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={summary.daily}>
                      <defs>
                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d3da0c" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#d3da0c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }}
                        labelStyle={{ color: "#999" }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="visits" stroke="#d3da0c" fill="url(#colorVisits)" strokeWidth={2} />
                      <Area type="monotone" dataKey="unique_ips" stroke="#3b82f6" fill="transparent" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* AI Insights */}
              {insights && insights.insights.length > 0 && (
                <ChartCard>
                  <SectionHeader title="AI Insights" icon={Sparkles} action={<span className="text-xs text-gray-500">Generated {new Date(insights.generated_at).toLocaleTimeString()}</span>} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {insights.insights.map((insight, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-4 rounded-lg border ${
                          insight.severity === "positive" ? "bg-green-500/5 border-green-500/20" :
                          insight.severity === "warning" ? "bg-red-500/5 border-red-500/20" :
                          "bg-[#d3da0c]/5 border-[#d3da0c]/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            insight.severity === "positive" ? "bg-green-500/10" :
                            insight.severity === "warning" ? "bg-red-500/10" :
                            "bg-[#d3da0c]/10"
                          }`}>
                            {insight.icon === "trending_up" && <TrendingUp className={`w-4 h-4 ${insight.severity === "positive" ? "text-green-400" : "text-[#d3da0c]"}`} />}
                            {insight.icon === "trending_down" && <TrendingDown className="w-4 h-4 text-red-400" />}
                            {insight.icon === "smartphone" && <Smartphone className="w-4 h-4 text-[#d3da0c]" />}
                            {insight.icon === "globe" && <Globe className="w-4 h-4 text-[#d3da0c]" />}
                            {insight.icon === "users" && <Users className="w-4 h-4 text-[#d3da0c]" />}
                            {insight.icon === "dollar" && <DollarSign className="w-4 h-4 text-[#d3da0c]" />}
                            {insight.icon === "star" && <Target className="w-4 h-4 text-[#d3da0c]" />}
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed">{insight.message}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ChartCard>
              )}
            </motion.div>
          )}

          {activeTab === "traffic" && (
            <motion.div
              key="traffic"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Top Pages, Entry, Exit */}
              {summary && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <ChartCard>
                    <SectionHeader title="Top Pages" icon={Eye} />
                    <div className="space-y-2">
                      {summary.top_pages.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <span className="text-sm text-gray-300 truncate max-w-[200px]">{p.path}</span>
                          <span className="text-sm font-medium text-[#d3da0c]">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Entry Pages" icon={ArrowUpRight} />
                    <div className="space-y-2">
                      {summary.entry_pages.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <span className="text-sm text-gray-300 truncate max-w-[200px]">{p.path}</span>
                          <span className="text-sm font-medium text-green-400">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Exit Pages" icon={ArrowDownRight} />
                    <div className="space-y-2">
                      {summary.exit_pages.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <span className="text-sm text-gray-300 truncate max-w-[200px]">{p.path}</span>
                          <span className="text-sm font-medium text-red-400">{p.count}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* Geography */}
              {geo && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard>
                    <SectionHeader title="Countries" icon={Globe} />
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={geo.countries.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" stroke="#666" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="#666" fontSize={11} width={100} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Bar dataKey="visits" fill="#d3da0c" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Cities" icon={MapPin} />
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={geo.cities.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis type="number" stroke="#666" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="#666" fontSize={11} width={100} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Bar dataKey="visits" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}

              {/* Focus Regions */}
              {geo && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard title="China" value={geo.focus_regions.china} icon={Globe} />
                  <StatCard title="Africa" value={geo.focus_regions.africa} icon={Globe} />
                  <StatCard title="United States" value={geo.focus_regions.united_states} icon={Globe} />
                  <StatCard title="Europe" value={geo.focus_regions.europe} icon={Globe} />
                </div>
              )}

              {/* Demographics */}
              {demo && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <ChartCard>
                    <SectionHeader title="Gender" icon={Users} />
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={demo.gender}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="visits"
                          nameKey="label"
                        >
                          {demo.gender.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Age Groups" icon={Users} />
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={demo.age_buckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="label" stroke="#666" fontSize={11} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Bar dataKey="visits" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Languages" icon={Globe} />
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={demo.languages}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="code" stroke="#666" fontSize={11} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}

              {/* Devices */}
              {device && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <ChartCard>
                    <SectionHeader title="Browsers" icon={Monitor} />
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={device.browsers} dataKey="visits" nameKey="name" outerRadius={70}>
                          {device.browsers.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Operating Systems" icon={Laptop} />
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={device.os} dataKey="visits" nameKey="name" outerRadius={70}>
                          {device.os.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Device Types" icon={Tablet} />
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={device.devices} dataKey="visits" nameKey="name" outerRadius={70}>
                          {device.devices.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Screen Resolutions" icon={Monitor} />
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {device.screen_resolutions.map((r, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-xs text-gray-400">{r.resolution}</span>
                          <span className="text-xs font-medium text-[#d3da0c]">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              )}

              {/* Trends */}
              {trends && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard>
                    <SectionHeader title="Hourly Traffic" icon={Clock} />
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={trends.hourly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="hour" stroke="#666" fontSize={11} tickFormatter={(v) => `${v}:00`} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Bar dataKey="visits" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader title="Weekly Pattern" icon={Calendar} />
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={trends.weekly.map((w) => ({ ...w, day_name: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w.day] }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="day_name" stroke="#666" fontSize={11} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px" }} />
                        <Bar dataKey="visits" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "engagement" && (
            <motion.div
              key="engagement"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {engagement && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard title="New Users" value={engagement.overview.new_users} icon={Users} />
                    <StatCard title="Active Users" value={engagement.overview.active_users} icon={Activity} />
                    <StatCard title="Bookings" value={engagement.overview.bookings} icon={Calendar} />
                    <StatCard title="Ticket Orders" value={engagement.overview.ticket_orders} icon={ShoppingCart} />
                    <StatCard title="Revenue" value={engagement.overview.ticket_revenue} icon={DollarSign} prefix="¥" />
                    <StatCard title="Subscriptions" value={engagement.overview.new_subscriptions} icon={Zap} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard title="Artist Follows" value={engagement.overview.artist_follows} icon={Heart} />
                    <StatCard title="Event Follows" value={engagement.overview.event_follows} icon={Heart} />
                    <StatCard title="Posts" value={engagement.overview.posts} icon={MessageSquare} />
                    <StatCard title="Comments" value={engagement.overview.comments} icon={MessageSquare} />
                    <StatCard title="Likes" value={engagement.overview.likes} icon={Heart} />
                    <StatCard title="Messages" value={engagement.overview.messages} icon={MessageSquare} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard>
                      <SectionHeader title="Event Types" icon={Target} />
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={engagement.events.slice(0, 15)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis type="number" stroke="#666" fontSize={12} />
                          <YAxis dataKey="type" type="category" stroke="#666" fontSize={10} width={120} />
                          <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                          <Bar dataKey="count" fill="#d3da0c" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                    <ChartCard>
                      <SectionHeader title="Engagement by Role" icon={Users} />
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={engagement.by_role}>
                          <PolarGrid stroke="#222" />
                          <PolarAngleAxis dataKey="role" stroke="#666" fontSize={11} />
                          <PolarRadiusAxis stroke="#666" fontSize={10} />
                          <Radar name="Active Users" dataKey="active_users" stroke="#d3da0c" fill="#d3da0c" fillOpacity={0.2} />
                          <Radar name="Events" dataKey="events" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                          <Legend />
                          <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <ChartCard>
                    <SectionHeader title="Daily Engagement" icon={Activity} />
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={engagement.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="date" stroke="#666" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                        <Legend />
                        <Line type="monotone" dataKey="active_users" stroke="#d3da0c" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="events" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "events" && (
            <motion.div
              key="events"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {eventAnalytics && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard title="Total Events" value={eventAnalytics.overview.total_events} icon={Calendar} />
                    <StatCard title="Approved Events" value={eventAnalytics.overview.approved_events} icon={Calendar} />
                    <StatCard title="Event Views" value={eventAnalytics.overview.event_views} icon={Eye} />
                    <StatCard title="Tickets Sold" value={eventAnalytics.overview.tickets_sold} icon={Ticket} />
                    <StatCard title="Revenue" value={eventAnalytics.overview.ticket_revenue} icon={DollarSign} prefix="¥" />
                    <StatCard title="Conversion" value={`${eventAnalytics.overview.conversion_rate}%`} icon={Target} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard>
                      <SectionHeader title="Top Events by Views" icon={Eye} />
                      <div className="space-y-2">
                        {eventAnalytics.top_events_by_views.map((e, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <span className="text-sm text-gray-300 truncate max-w-[250px]">{e.title}</span>
                            <span className="text-sm font-medium text-[#d3da0c]">{e.views} views</span>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                    <ChartCard>
                      <SectionHeader title="Top Events by Revenue" icon={DollarSign} />
                      <div className="space-y-2">
                        {eventAnalytics.top_events_by_revenue.map((e, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                            <span className="text-sm text-gray-300 truncate max-w-[200px]">{e.title}</span>
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-400">¥{e.revenue.toLocaleString()}</div>
                              <div className="text-xs text-gray-500">{e.tickets_sold} tickets</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard>
                    <SectionHeader title="Daily Ticket Sales" icon={ShoppingCart} />
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={eventAnalytics.daily_sales}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis dataKey="date" stroke="#666" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                        <YAxis stroke="#666" fontSize={12} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#colorRevenue)" strokeWidth={2} />
                        <Line type="monotone" dataKey="orders" stroke="#d3da0c" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "roles" && (
            <motion.div
              key="roles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {roles && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {roles.roles.map((r, i) => (
                      <StatCard
                        key={i}
                        title={r.label}
                        value={r.total}
                        change={r.new > 0 ? Math.round((r.new / Math.max(r.total, 1)) * 100) : undefined}
                        icon={Users}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard>
                      <SectionHeader title="Role Distribution" icon={Users} />
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={roles.roles}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="label" stroke="#666" fontSize={11} />
                          <YAxis stroke="#666" fontSize={12} />
                          <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }} />
                          <Legend />
                          <Bar dataKey="total" fill="#d3da0c" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="active" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="verified" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="premium" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                    <ChartCard>
                      <SectionHeader title="Profile Counts" icon={Target} />
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(roles.profiles).map(([key, value]) => (
                          <div key={key} className="bg-white/5 rounded-lg p-4">
                            <div className="text-2xl font-bold text-[#d3da0c]">{value}</div>
                            <div className="text-sm text-gray-400 capitalize">{key}</div>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === "insights" && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {insights && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {insights.insights.map((insight, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className={`p-5 rounded-xl border ${
                          insight.severity === "positive"
                            ? "bg-green-500/5 border-green-500/20"
                            : insight.severity === "warning"
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-[#d3da0c]/5 border-[#d3da0c]/20"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              insight.severity === "positive"
                                ? "bg-green-500/10"
                                : insight.severity === "warning"
                                ? "bg-red-500/10"
                                : "bg-[#d3da0c]/10"
                            }`}
                          >
                            {insight.icon === "trending_up" && (
                              <TrendingUp className={`w-6 h-6 ${insight.severity === "positive" ? "text-green-400" : "text-[#d3da0c]"}`} />
                            )}
                            {insight.icon === "trending_down" && <TrendingDown className="w-6 h-6 text-red-400" />}
                            {insight.icon === "smartphone" && <Smartphone className="w-6 h-6 text-[#d3da0c]" />}
                            {insight.icon === "globe" && <Globe className="w-6 h-6 text-[#d3da0c]" />}
                            {insight.icon === "users" && <Users className="w-6 h-6 text-[#d3da0c]" />}
                            {insight.icon === "dollar" && <DollarSign className="w-6 h-6 text-[#d3da0c]" />}
                            {insight.icon === "star" && <Target className="w-6 h-6 text-[#d3da0c]" />}
                          </div>
                          <div>
                            <p className="text-base text-white font-medium leading-relaxed mb-1">{insight.message}</p>
                            <p className="text-sm text-gray-500">
                              Value: <span className="text-[#d3da0c] font-medium">{insight.value.toLocaleString()}</span>
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Placeholder for more advanced insights */}
                  <ChartCard>
                    <SectionHeader title="Growth Forecast" icon={TrendingUp} />
                    <div className="flex items-center justify-center h-48 text-gray-500">
                      <div className="text-center">
                        <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#d3da0c]/50" />
                        <p className="text-sm">AI-powered growth forecasting coming in next update</p>
                        <p className="text-xs text-gray-600 mt-1">Based on historical trends and seasonal patterns</p>
                      </div>
                    </div>
                  </ChartCard>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
