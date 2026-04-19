import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Ticket, DollarSign, Calendar, BarChart3, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface AnalyticsData {
  totalRevenue: number;
  totalTickets: number;
  totalAttendees: number;
  avgRating: number;
  monthlyRevenue: { month: string; revenue: number }[];
  topEvents: { name: string; tickets: number; revenue: number }[];
}

interface OrganizerStats {
  total_events: number;
  tickets_sold: number;
  total_revenue: number;
  monthly_revenue?: { month: string; revenue: number }[];
}

const Analytics = () => {
  const { t } = useTranslation();
  useSubscriptionGuard('analytics');
  const { events, fetchMyEvents } = useEventStore();
  const { token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizerStats, setOrganizerStats] = useState<OrganizerStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalTickets: 0,
    totalAttendees: 0,
    avgRating: 0,
    monthlyRevenue: [],
    topEvents: [],
  });

  // Fetch organizer stats from API
  const fetchOrganizerStats = useCallback(async () => {
    const authToken = token || localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!authToken) {
      console.warn('No auth token available for stats fetch');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/organizer/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If endpoint doesn't exist, we'll fall back to computed stats
        if (response.status === 404) {
          // Removed console.log for production
          return;
        }
        throw new Error(t('organizer.analytics.fetchStatsError'));
      }

      const data = await response.json();
      setOrganizerStats(data || null);
    } catch (err) {
      console.error('Failed to fetch organizer stats:', err);
      // Don't show error toast here, we'll compute from events as fallback
    }
  }, [token, t]);

  // Compute analytics from events data
  const computeAnalytics = useCallback(() => {
    if (!events || events.length === 0) {
      setAnalytics({
        totalRevenue: 0,
        totalTickets: 0,
        totalAttendees: 0,
        avgRating: 0,
        monthlyRevenue: [],
        topEvents: [],
      });
      return;
    }

    // Calculate totals
    const totalTickets = events.reduce((sum, e) => sum + (e.tickets_sold || 0), 0);

    // Calculate revenue more accurately using ticket tiers
    const totalRevenue = events.reduce((sum, e) => {
      if (e.ticket_tiers && e.ticket_tiers.length > 0) {
        // Sum up revenue from all ticket tiers
        return sum + e.ticket_tiers.reduce((tierSum, tier) => {
          return tierSum + (tier.price * (tier.quantity_sold || 0));
        }, 0);
      }
      return sum;
    }, 0);

    // Group events by month for revenue chart
    const monthMap = new Map<string, number>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize all months with 0
    months.forEach(m => monthMap.set(m, 0));

    events.forEach(e => {
      const date = new Date(e.start_date);
      const monthKey = months[date.getMonth()];

      let eventRevenue = 0;
      if (e.ticket_tiers && e.ticket_tiers.length > 0) {
        eventRevenue = e.ticket_tiers.reduce((tierSum, tier) => {
          return tierSum + (tier.price * (tier.quantity_sold || 0));
        }, 0);
      }

      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + eventRevenue);
    });

    // Convert to array, filtering out months with no revenue
    const monthlyRevenue = months
      .map(month => ({ month, revenue: monthMap.get(month) || 0 }))
      .filter(m => m.revenue > 0);

    // Top events by tickets sold
    const topEvents = [...events]
      .sort((a, b) => (b.tickets_sold || 0) - (a.tickets_sold || 0))
      .slice(0, 5)
      .map(e => {
        let eventRevenue = 0;
        if (e.ticket_tiers && e.ticket_tiers.length > 0) {
          eventRevenue = e.ticket_tiers.reduce((sum, tier) => {
            return sum + (tier.price * (tier.quantity_sold || 0));
          }, 0);
        }
        return {
          name: e.title,
          tickets: e.tickets_sold || 0,
          revenue: eventRevenue,
        };
      });

    setAnalytics({
      totalRevenue: organizerStats?.total_revenue || totalRevenue,
      totalTickets: organizerStats?.tickets_sold || totalTickets,
      totalAttendees: organizerStats?.tickets_sold || totalTickets,
      avgRating: 0,
      monthlyRevenue: monthlyRevenue.length > 0 ? monthlyRevenue :
        (organizerStats?.monthly_revenue || []),
      topEvents,
    });
  }, [events, organizerStats]);

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchMyEvents(),
        fetchOrganizerStats(),
      ]);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      const msg = err instanceof Error ? err.message : t('organizer.analytics.loadError');
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [fetchMyEvents, fetchOrganizerStats, t]);

  // Initial load
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Recompute when events or organizer stats change
  useEffect(() => {
    if (!isLoading) {
      computeAnalytics();
    }
  }, [events, organizerStats, isLoading, computeAnalytics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalytics();
    setIsRefreshing(false);
    toast.success(t('organizer.analytics.refreshSuccess'));
  };

  const stats = [
    { label: t('organizer.analytics.totalRevenueLabel'), value: `¥${analytics.totalRevenue.toLocaleString()}`, icon: DollarSign },
    { label: t('organizer.analytics.totalTicketsLabel'), value: analytics.totalTickets.toLocaleString(), icon: Ticket },
    { label: t('organizer.analytics.totalAttendeesLabel'), value: analytics.totalAttendees.toLocaleString(), icon: Users },
    { label: t('organizer.analytics.eventsLabel'), value: events.length.toString(), icon: TrendingUp },
  ];

  const maxRevenue = analytics.monthlyRevenue.length > 0
    ? Math.max(...analytics.monthlyRevenue.map(m => m.revenue))
    : 1;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-4" />
        <p className="text-gray-400">{t('organizer.analytics.loading')}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-400 mb-2">{t('organizer.analytics.loadErrorTitle')}</p>
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-[#d3da0c] text-black rounded-lg hover:bg-[#bbc10b] transition-colors"
        >
          {t('organizer.analytics.retry')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-display text-white mb-2">
            <span className="text-[#d3da0c]">{t('organizer.analytics.titleHighlight')}</span> {t('organizer.analytics.titleSuffix')}
          </h1>
          <p className="text-gray-400">{t('organizer.analytics.subtitle')}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('organizer.analytics.refresh')}
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-[#d3da0c]" />
                </div>
              </div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-display text-white">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">{t('organizer.analytics.monthlyRevenueTitle')}</h2>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          {analytics.monthlyRevenue.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center">
              <BarChart3 className="w-12 h-12 text-gray-600 mb-2" />
              <p className="text-gray-500">{t('organizer.analytics.noRevenueData')}</p>
              <p className="text-gray-600 text-sm">{t('organizer.analytics.noRevenueDesc')}</p>
            </div>
          ) : (
            <div className="h-48 flex items-end gap-4">
              {analytics.monthlyRevenue.map((month) => (
                <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-[#d3da0c]/20 rounded-t-lg relative group cursor-pointer"
                    style={{ height: `${(month.revenue / maxRevenue) * 100}%`, minHeight: '4px' }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 bg-[#d3da0c] rounded-t-lg transition-all group-hover:opacity-80" style={{ height: '100%' }} />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      ¥{month.revenue.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-gray-500 text-sm">{month.month}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Top Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">{t('organizer.analytics.topEventsTitle')}</h2>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          {analytics.topEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <Calendar className="w-12 h-12 text-gray-600 mb-2" />
              <p className="text-gray-500">{t('organizer.analytics.noEventData')}</p>
              <p className="text-gray-600 text-sm">{t('organizer.analytics.noEventDataDesc')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.topEvents.map((event, index) => (
                <div key={event.name} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center text-[#d3da0c] font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{event.name}</p>
                    <p className="text-gray-500 text-sm">{t('organizer.analytics.ticketsSold', { count: event.tickets })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#d3da0c] font-medium">¥{event.revenue.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
