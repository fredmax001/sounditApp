import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { getVendorVariant, getArtistVariant } from '@/lib/roleVariants';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { toast } from 'sonner';
import {
  Users, Building2, Music, Calendar, DollarSign,
  Loader2, AlertCircle, ChevronRight, Shield,
  Layers, CreditCard, Megaphone, Bell, MessageSquare,
  Flag, BookOpen, BarChart3, CheckCircle2, RefreshCw,
  ShoppingBag, Briefcase, MapPin, ArrowUpRight, Activity, Clock
} from 'lucide-react';

interface DailyPoint {
  date: string;
  label: string;
  visits: number;
  signups: number;
  orders: number;
  volume: number;
}

interface ActivityEntry {
  id: number;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  details?: string | null;
  created_at?: string | null;
}

interface PendingAction {
  id: string | number;
  type?: string;
  title?: string;
  description?: string;
  action_url?: string;
  created_at?: string | null;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  badge?: string | null;
  badgeTone?: 'positive' | 'negative' | 'warning' | 'neutral';
  loading: boolean;
  onClick?: () => void;
}

const KpiCard = ({
  label,
  value,
  subtext,
  icon: Icon,
  badge,
  badgeTone = 'neutral',
  loading,
  onClick,
}: KpiCardProps) => {
  const badgeClasses =
    badgeTone === 'positive'
      ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
      : badgeTone === 'negative'
      ? 'bg-red-500/12 text-red-400 border-red-500/20'
      : badgeTone === 'warning'
      ? 'bg-amber-500/12 text-amber-400 border-amber-500/20'
      : 'bg-white/[0.05] text-gray-400 border-white/[0.08]';

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5 flex flex-col justify-between min-w-0 transition-colors ${
        onClick ? 'cursor-pointer hover:border-[#d3da0c]/45' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 text-[#8a8f04] dark:text-[#d3da0c] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-2xl text-[#020b00] dark:text-white tabular-nums tracking-tight truncate">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#d3da0c]" /> : value}
        </p>
        {badge && !loading && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[0.6875rem] tabular-nums ${badgeClasses}`}>
            {badge}
          </span>
        )}
      </div>

      {subtext && !loading && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">{subtext}</p>
      )}
    </div>
  );
};

const DashboardOverview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [chartMetric, setChartMetric] = useState<'visits' | 'signups' | 'volume'>('visits');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const [roleInfo, setRoleInfo] = useState<{ role_name?: string; is_system?: boolean; permissions?: string[] }>({});

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalArtists: 0,
    totalBusinesses: 0,
    totalVendors: 0,
    totalEvents: 0,
    totalBookings: 0,
    totalCities: 0,
    totalTicketsSold: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    platformProcessedRevenue: 0,
    platformFeeRevenue: 0,
    subscriptionRevenue: 0,
    directQrReportedVolume: 0,
    availablePlatformCash: 0,
    pendingVerifications: 0,
    pendingPayouts: 0,
    pendingVendorApprovals: 0,
    pendingBusinessApprovals: 0,
    pendingEvents: 0,
    pendingReports: 0,
    totalVisits30d: 0,
    uniqueVisitors30d: 0,
    newUsers30d: 0,
    newEvents30d: 0,
    usersGrowthPct: null as number | null,
    eventsGrowthPct: null as number | null,
    visitsGrowthPct: null as number | null,
    vendorsByType: {} as Record<string, number>,
    artistsByType: {} as Record<string, number>,
    businessOwnedVendors: 0,
    dailySeries: [] as DailyPoint[],
    recentActivity: [] as ActivityEntry[],
  });

  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  const loadDashboardData = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error(t('admin.dashboardOverview.notAuthenticated'));
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const [roleRes, statsRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/admins/me/permissions`, { headers }).catch(() => null),
        fetch(`${API_BASE_URL}/admin/dashboard`, { headers }),
        fetch(`${API_BASE_URL}/admin/pending-actions`, { headers }),
      ]);

      if (roleRes && roleRes.ok) {
        const rdata = await roleRes.json();
        setRoleInfo(rdata);
        useAuthStore.setState({ permissions: rdata.permissions || [] });
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          totalUsers: data.total_users || 0,
          totalArtists: data.total_artists || 0,
          totalBusinesses: data.total_businesses || 0,
          totalVendors: data.total_vendors || 0,
          totalEvents: data.total_events || 0,
          totalBookings: data.total_bookings || 0,
          totalCities: data.total_cities || 0,
          totalTicketsSold: data.total_tickets_sold || 0,
          activeSubscriptions: data.active_subscriptions || 0,
          totalRevenue: data.total_revenue || 0,
          platformProcessedRevenue: data.platform_processed_revenue || 0,
          platformFeeRevenue: data.platform_fee_revenue || 0,
          subscriptionRevenue: data.subscription_revenue || 0,
          directQrReportedVolume: data.direct_qr_reported_volume || 0,
          availablePlatformCash: data.available_platform_cash || 0,
          pendingVerifications: data.pending_verifications || 0,
          pendingPayouts: data.pending_payouts || 0,
          pendingVendorApprovals: data.pending_vendor_approvals || 0,
          pendingBusinessApprovals: data.pending_business_approvals || 0,
          pendingEvents: data.pending_events || 0,
          pendingReports: data.pending_reports || 0,
          totalVisits30d: data.total_visits_30d || 0,
          uniqueVisitors30d: data.unique_visitors_30d || 0,
          newUsers30d: data.new_users_30d || 0,
          newEvents30d: data.new_events_30d || 0,
          usersGrowthPct: typeof data.users_growth_pct === 'number' ? data.users_growth_pct : null,
          eventsGrowthPct: typeof data.events_growth_pct === 'number' ? data.events_growth_pct : null,
          visitsGrowthPct: typeof data.visits_growth_pct === 'number' ? data.visits_growth_pct : null,
          vendorsByType: data.vendors_by_type || {},
          artistsByType: data.artists_by_type || {},
          businessOwnedVendors: data.business_owned_vendors || 0,
          dailySeries: Array.isArray(data.daily_series) ? data.daily_series : [],
          recentActivity: Array.isArray(data.recent_activity) ? data.recent_activity : [],
        });
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingActions(Array.isArray(data.actions) ? data.actions : []);
      }

      setLastSyncedAt(new Date());
    } catch {
      toast.error(t('admin.dashboardOverview.failedToLoadSomeDashboardData'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token, t]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCNY = (amount: number) =>
    `CN¥${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const formatGrowth = (pct: number | null) => {
    if (pct === null || Number.isNaN(pct)) return null;
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  };

  const chartMax = useMemo(() => {
    if (stats.dailySeries.length === 0) return 1;
    const maxVal = Math.max(
      ...stats.dailySeries.map(d => (chartMetric === 'visits' ? d.visits : chartMetric === 'signups' ? d.signups : d.volume))
    );
    return maxVal > 0 ? maxVal : 1;
  }, [stats.dailySeries, chartMetric]);

  const chartTotal = useMemo(() => {
    return stats.dailySeries.reduce(
      (sum, d) => sum + (chartMetric === 'visits' ? d.visits : chartMetric === 'signups' ? d.signups : d.volume),
      0
    );
  }, [stats.dailySeries, chartMetric]);

  const roleNameLower = (roleInfo.role_name || '').toLowerCase();
  const isFinance = roleNameLower.includes('finance');
  const isMarketing = roleNameLower.includes('market');
  const isModerator = roleNameLower.includes('moderator') || roleNameLower.includes('content');
  const isSupport = roleNameLower.includes('support');
  const isCustomRole = !roleInfo.is_system && Boolean(roleInfo.role_name);

  const directoryRows = [
    { label: 'Artists & DJs', count: stats.totalArtists, icon: Music, path: '/admin/artists' },
    { label: 'Businesses & Organizers', count: stats.totalBusinesses, icon: Building2, path: '/admin/businesses' },
    { label: 'Vendors', count: stats.totalVendors, icon: ShoppingBag, path: '/admin/vendors' },
    { label: 'Booking Requests', count: stats.totalBookings, icon: Briefcase, path: '/admin/bookings' },
    { label: 'Active Subscriptions', count: stats.activeSubscriptions, icon: Layers, path: '/admin/subscriptions' },
    { label: 'Active Cities', count: stats.totalCities, icon: MapPin, path: '/admin/analytics' },
  ];

  const financialRows = [
    { label: 'Sound It Processed (Yoopay)', value: formatCNY(stats.platformProcessedRevenue), tone: 'text-white' },
    { label: 'Platform Fee Revenue (4%)', value: formatCNY(stats.platformFeeRevenue), tone: 'text-[#d3da0c]' },
    { label: 'Subscription Revenue', value: formatCNY(stats.subscriptionRevenue), tone: 'text-emerald-400' },
    { label: 'Direct QR Reported Volume', value: formatCNY(stats.directQrReportedVolume), tone: 'text-gray-300' },
    { label: 'Available Platform Cash', value: formatCNY(stats.availablePlatformCash), tone: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Custom Role Banner */}
      {isCustomRole && (
        <div className="bg-white dark:bg-[#0D130D] border border-[#d3da0c]/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#d3da0c]/15 text-[#d3da0c] rounded-lg flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-[#020b00] dark:text-white truncate">
                {roleInfo.role_name} Workspace
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Signed in as {profile?.first_name || profile?.email}
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-md bg-[#d3da0c]/12 text-[#d3da0c] border border-[#d3da0c]/25 self-start sm:self-auto">
            Active Role
          </span>
        </div>
      )}

      {/* Editorial Page Header */}
      <AdminPageHeader
        chip="Overview"
        title="Platform Overview"
        subtitle={
          lastSyncedAt
            ? `Live metrics synchronized at ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Real-time platform operations, traffic, and canonical financial telemetry'
        }
        actions={
          <>
            {pendingActions.length > 0 && (
              <button
                onClick={() => navigate(pendingActions[0]?.action_url || '/admin/verification-center')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/12 border border-amber-500/25 text-amber-400 text-xs hover:bg-amber-500/18 transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{pendingActions.length} pending review</span>
              </button>
            )}
            <button
              onClick={loadDashboardData}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#d3da0c] text-black rounded-lg hover:bg-[#c0c70b] disabled:opacity-60 transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </>
        }
      />

      {/* Row 1 — 4-Column Executive KPI Strip */}
      {isFinance ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Platform Recognized Revenue"
            value={formatCNY(stats.totalRevenue)}
            subtext={`Fees ${formatCNY(stats.platformFeeRevenue)} + Subs ${formatCNY(stats.subscriptionRevenue)}`}
            icon={DollarSign}
            loading={loading}
            onClick={() => navigate('/admin/financial')}
          />
          <KpiCard
            label="Direct QR Reported Volume"
            value={formatCNY(stats.directQrReportedVolume)}
            subtext={`${stats.totalTicketsSold.toLocaleString()} approved tickets`}
            icon={Calendar}
            loading={loading}
            onClick={() => navigate('/admin/financial')}
          />
          <KpiCard
            label="Active Subscriptions"
            value={stats.activeSubscriptions.toLocaleString()}
            subtext={`Available cash ${formatCNY(stats.availablePlatformCash)}`}
            icon={Layers}
            loading={loading}
            onClick={() => navigate('/admin/subscriptions')}
          />
          <KpiCard
            label="Pending Withdrawals"
            value={stats.pendingPayouts}
            subtext={stats.pendingPayouts > 0 ? 'Awaiting finance approval' : 'No open payout requests'}
            icon={CreditCard}
            badge={stats.pendingPayouts > 0 ? 'Action needed' : 'Clear'}
            badgeTone={stats.pendingPayouts > 0 ? 'warning' : 'positive'}
            loading={loading}
            onClick={() => navigate('/admin/withdrawals')}
          />
        </div>
      ) : isMarketing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Active Users"
            value={stats.totalUsers.toLocaleString()}
            subtext={`+${stats.newUsers30d} new in last 30 days`}
            icon={Users}
            badge={formatGrowth(stats.usersGrowthPct)}
            badgeTone={(stats.usersGrowthPct ?? 0) >= 0 ? 'positive' : 'negative'}
            loading={loading}
            onClick={() => navigate('/admin/users')}
          />
          <KpiCard
            label="Page Visits (30d)"
            value={stats.totalVisits30d.toLocaleString()}
            subtext={`${stats.uniqueVisitors30d.toLocaleString()} unique visitors`}
            icon={BarChart3}
            badge={formatGrowth(stats.visitsGrowthPct)}
            badgeTone={(stats.visitsGrowthPct ?? 0) >= 0 ? 'positive' : 'negative'}
            loading={loading}
            onClick={() => navigate('/admin/analytics')}
          />
          <KpiCard
            label="Published Events"
            value={stats.totalEvents.toLocaleString()}
            subtext={`+${stats.newEvents30d} created in last 30 days`}
            icon={Calendar}
            loading={loading}
            onClick={() => navigate('/admin/events')}
          />
          <KpiCard
            label="Broadcasts & Ads"
            value={`${stats.totalArtists} Artists`}
            subtext="Open Ads Manager or Broadcasts"
            icon={Megaphone}
            loading={loading}
            onClick={() => navigate('/admin/notifications')}
          />
        </div>
      ) : isModerator || isSupport ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Pending Review Queue"
            value={pendingActions.length}
            subtext={`${stats.pendingVerifications} verifications · ${stats.pendingReports} reports`}
            icon={AlertCircle}
            badge={pendingActions.length > 0 ? 'Needs review' : 'Clear'}
            badgeTone={pendingActions.length > 0 ? 'warning' : 'positive'}
            loading={loading}
            onClick={() => navigate('/admin/verification-center')}
          />
          <KpiCard
            label="Open Reports"
            value={stats.pendingReports}
            subtext="Content & user moderation queue"
            icon={Flag}
            loading={loading}
            onClick={() => navigate('/admin/reports')}
          />
          <KpiCard
            label="Active Users"
            value={stats.totalUsers.toLocaleString()}
            subtext={`+${stats.newUsers30d} in last 30 days`}
            icon={Users}
            loading={loading}
            onClick={() => navigate('/admin/users')}
          />
          <KpiCard
            label="Community & Recaps"
            value={`${stats.totalEvents} Events`}
            subtext="Manage posts, sections & recaps"
            icon={MessageSquare}
            loading={loading}
            onClick={() => navigate('/admin/community')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Active Users"
            value={stats.totalUsers.toLocaleString()}
            subtext={`+${stats.newUsers30d} joined in last 30 days`}
            icon={Users}
            badge={formatGrowth(stats.usersGrowthPct)}
            badgeTone={(stats.usersGrowthPct ?? 0) >= 0 ? 'positive' : 'negative'}
            loading={loading}
            onClick={() => navigate('/admin/users')}
          />
          <KpiCard
            label="Platform Revenue"
            value={formatCNY(stats.totalRevenue)}
            subtext={`Direct QR reported: ${formatCNY(stats.directQrReportedVolume)}`}
            icon={DollarSign}
            badge={`${stats.activeSubscriptions} active subs`}
            badgeTone="neutral"
            loading={loading}
            onClick={() => navigate('/admin/financial')}
          />
          <KpiCard
            label="Events & Tickets"
            value={stats.totalEvents.toLocaleString()}
            subtext={`${stats.totalTicketsSold.toLocaleString()} tickets sold · ${stats.totalBookings} bookings`}
            icon={Calendar}
            badge={formatGrowth(stats.eventsGrowthPct)}
            badgeTone={(stats.eventsGrowthPct ?? 0) >= 0 ? 'positive' : 'negative'}
            loading={loading}
            onClick={() => navigate('/admin/events')}
          />
          <KpiCard
            label="Pending Actions"
            value={pendingActions.length}
            subtext={
              pendingActions.length > 0
                ? `${stats.pendingPayouts} payouts · ${stats.pendingVerifications} verifications · ${stats.pendingEvents} events`
                : 'All review queues are caught up'
            }
            icon={AlertCircle}
            badge={pendingActions.length > 0 ? 'Action needed' : 'All clear'}
            badgeTone={pendingActions.length > 0 ? 'warning' : 'positive'}
            loading={loading}
            onClick={() => navigate(pendingActions[0]?.action_url || '/admin/verification-center')}
          />
        </div>
      )}

      {/* Row 2 — 12-Column Primary Analytical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 8 Columns: Real 14-Day Platform Activity Chart */}
        <section className="lg:col-span-8 bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5 flex flex-col justify-between min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base text-[#020b00] dark:text-white">14-Day Platform Activity</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Live database telemetry —{' '}
                {chartMetric === 'visits'
                  ? `${chartTotal.toLocaleString()} page visits`
                  : chartMetric === 'signups'
                  ? `${chartTotal.toLocaleString()} new registrations`
                  : `${formatCNY(chartTotal)} approved ticket volume`}
              </p>
            </div>

            <div className="inline-flex items-center p-1 rounded-lg bg-black/5 dark:bg-white/[0.04] border border-black/8 dark:border-white/[0.07] self-start sm:self-auto">
              {(
                [
                  { id: 'visits', label: 'Visits' },
                  { id: 'signups', label: 'Signups' },
                  { id: 'volume', label: 'Volume' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartMetric(tab.id)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors ${
                    chartMetric === tab.id
                      ? 'bg-[#d3da0c] text-black'
                      : 'text-gray-500 dark:text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c]" />
            </div>
          ) : stats.dailySeries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-500">
              No activity recorded in the last 14 days.
            </div>
          ) : (
            <div className="relative">
              {/* Subtle horizontal gridlines */}
              <div className="absolute inset-x-0 top-0 h-44 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-black/8 dark:border-white/[0.06]" />
                <div className="border-b border-dashed border-black/8 dark:border-white/[0.06]" />
                <div className="border-b border-dashed border-black/8 dark:border-white/[0.06]" />
                <div className="border-b border-black/10 dark:border-white/[0.08]" />
              </div>

              {/* Real data bars */}
              <div className="relative z-10 flex items-end gap-2 h-44 pt-2 px-1">
                {stats.dailySeries.map((pt, idx) => {
                  const val =
                    chartMetric === 'visits'
                      ? pt.visits
                      : chartMetric === 'signups'
                      ? pt.signups
                      : pt.volume;
                  const pct = val > 0 ? Math.max(6, Math.round((val / chartMax) * 100)) : 2;
                  const isHovered = hoveredIdx === idx;

                  return (
                    <div
                      key={pt.date}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="flex-1 flex flex-col items-center justify-end h-full relative group"
                    >
                      {isHovered && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1 rounded-md bg-[#111811] border border-white/15 text-[0.6875rem] text-white shadow-lg z-20 pointer-events-none tabular-nums">
                          {pt.label}: {chartMetric === 'volume' ? formatCNY(val) : val.toLocaleString()}
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          val > 0
                            ? isHovered
                              ? 'bg-[#e6ee1e]'
                              : 'bg-[#d3da0c]/85'
                            : 'bg-white/[0.06]'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Real X-axis date ticks */}
              <div className="flex justify-between items-center text-[0.6875rem] text-gray-500 pt-2.5 px-1 tabular-nums">
                <span>{stats.dailySeries[0]?.label}</span>
                <span>{stats.dailySeries[Math.floor(stats.dailySeries.length / 3)]?.label}</span>
                <span>{stats.dailySeries[Math.floor((stats.dailySeries.length * 2) / 3)]?.label}</span>
                <span>{stats.dailySeries[stats.dailySeries.length - 1]?.label}</span>
              </div>
            </div>
          )}

          {/* 30-Day Traffic Summary Strip */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-black/8 dark:border-white/[0.07]">
            <div>
              <p className="text-[0.6875rem] text-gray-500">30d Page Visits</p>
              <p className="text-sm text-[#020b00] dark:text-white mt-0.5 tabular-nums">
                {stats.totalVisits30d.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] text-gray-500">30d Unique Visitors</p>
              <p className="text-sm text-[#020b00] dark:text-white mt-0.5 tabular-nums">
                {stats.uniqueVisitors30d.toLocaleString()}
              </p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[0.6875rem] text-gray-500">30d New Users</p>
                <p className="text-sm text-[#020b00] dark:text-white mt-0.5 tabular-nums">
                  {stats.newUsers30d.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/analytics')}
                className="text-xs text-[#d3da0c] hover:underline inline-flex items-center gap-0.5"
              >
                <span>Analytics</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Right 4 Columns: Priority Action Queue */}
        <section className="lg:col-span-4 bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl flex flex-col min-w-0">
          <div className="px-5 py-4 border-b border-black/8 dark:border-white/[0.07] flex items-center justify-between">
            <h2 className="text-base text-[#020b00] dark:text-white">Priority Queue</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-md tabular-nums ${
                pendingActions.length > 0
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {pendingActions.length}
            </span>
          </div>

          <div className="p-4 flex-1 space-y-2.5 overflow-y-auto max-h-[340px]">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin" />
              </div>
            ) : pendingActions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mb-2.5" />
                <p className="text-sm text-[#020b00] dark:text-white">Queue is clear</p>
                <p className="text-xs text-gray-500 mt-1">No pending approvals or payouts.</p>
              </div>
            ) : (
              pendingActions.slice(0, 8).map((action) => (
                <button
                  key={`${action.type}-${action.id}`}
                  onClick={() => navigate(action.action_url || '/admin/verification-center')}
                  className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/[0.06] hover:border-[#d3da0c]/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#020b00] dark:text-white truncate">{action.title}</p>
                    <p className="text-[0.6875rem] text-gray-500 truncate mt-0.5">{action.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Row 3 — 12-Column Directory, Financial Ledger Snapshot & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Directory Breakdown (4 cols) */}
        <section className="lg:col-span-4 bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm text-[#020b00] dark:text-white">Platform Directory</h2>
            <button
              onClick={() => navigate('/admin/users')}
              className="text-xs text-[#d3da0c] hover:underline"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-black/6 dark:divide-white/[0.06]">
            {directoryRows.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.label}
                  onClick={() => navigate(row.path)}
                  className="w-full flex items-center justify-between py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
                >
                  <span className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300 group-hover:text-white">
                    <Icon className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#d3da0c]" />
                    <span>{row.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[#020b00] dark:text-white tabular-nums">
                    <span>{loading ? '...' : row.count.toLocaleString()}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-type pills */}
          {!loading && (Object.keys(stats.artistsByType).length > 0 || Object.keys(stats.vendorsByType).length > 0) && (
            <div className="mt-4 pt-3 border-t border-black/6 dark:border-white/[0.06] flex flex-wrap gap-1.5">
              {Object.entries(stats.artistsByType).slice(0, 4).map(([type, count]) => (
                <span
                  key={`a-${type}`}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-[0.6875rem] text-gray-400"
                >
                  {getArtistVariant(type).label}: {count}
                </span>
              ))}
              {Object.entries(stats.vendorsByType).slice(0, 3).map(([type, count]) => (
                <span
                  key={`v-${type}`}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-[0.6875rem] text-gray-400"
                >
                  {getVendorVariant(type).label}: {count}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Canonical Financial Snapshot (4 cols) */}
        <section className="lg:col-span-4 bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[#020b00] dark:text-white">Financial Ledger Snapshot</h2>
              <button
                onClick={() => navigate('/admin/financial')}
                className="text-xs text-[#d3da0c] hover:underline inline-flex items-center gap-0.5"
              >
                <span>Open Ledger</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-black/6 dark:divide-white/[0.06]">
              {financialRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5 gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.label}</span>
                  <span className={`text-xs tabular-nums shrink-0 ${row.tone}`}>
                    {loading ? '...' : row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/6 dark:border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-gray-500">Pending Payout Requests</span>
            <button
              onClick={() => navigate('/admin/withdrawals')}
              className="text-xs text-[#d3da0c] hover:underline tabular-nums"
            >
              {stats.pendingPayouts} open
            </button>
          </div>
        </section>

        {/* Recent Admin Activity & Quick Actions (4 cols) */}
        <section className="lg:col-span-4 bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[#020b00] dark:text-white flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#d3da0c]" />
                <span>Recent Activity</span>
              </h2>
              <button
                onClick={() => navigate('/admin/logs')}
                className="text-xs text-[#d3da0c] hover:underline"
              >
                Security Logs
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#d3da0c]" />
              </div>
            ) : stats.recentActivity.length === 0 ? (
              <p className="text-xs text-gray-500 py-6 text-center">No recent admin audit entries.</p>
            ) : (
              <div className="space-y-2.5 max-h-[195px] overflow-y-auto pr-1">
                {stats.recentActivity.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 text-xs pb-2 border-b border-white/[0.05] last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-gray-200 truncate">
                        {item.action.replace(/_/g, ' ')}
                        {item.entity_type ? ` (${item.entity_type})` : ''}
                      </p>
                      {item.details && (
                        <p className="text-[0.6875rem] text-gray-500 truncate mt-0.5">{item.details}</p>
                      )}
                    </div>
                    {item.created_at && (
                      <span className="text-[0.6875rem] text-gray-500 shrink-0 inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compact Operational Shortcuts */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-black/6 dark:border-white/[0.06]">
            {[
              { label: 'Users', path: '/admin/users', icon: Users },
              { label: 'Events', path: '/admin/events', icon: Calendar },
              { label: 'Broadcasts', path: '/admin/notifications', icon: Bell },
              { label: 'CMS & Intro', path: '/admin/cms', icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] hover:border-[#d3da0c]/40 text-xs text-gray-300 hover:text-white transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardOverview;
