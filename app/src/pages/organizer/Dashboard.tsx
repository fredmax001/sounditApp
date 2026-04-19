import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, Ticket, TrendingUp, Plus, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const OrganizerDashboard = () => {
  const { t } = useTranslation();
  const { events, fetchMyEvents, isLoading: isEventsLoading, error: eventsError } = useEventStore();
  const { profile } = useAuthStore();
  const { stats: dashboardStats, fetchStats, isLoading: isStatsLoading, error: statsError } = useDashboardStore();
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      const token = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (token && !hasFetched) {
        setHasFetched(true);
        try {
          await Promise.all([
            fetchStats(token),
            fetchMyEvents()
          ]);
        } catch (error) {
          console.error('Failed to load dashboard data:', error);
          toast.error(t('organizer.dashboard.loadErrorToast'));
        }
      }
    };
    loadDashboardData();
  }, [fetchStats, fetchMyEvents, hasFetched, t]);

  const businessStats = dashboardStats?.business_stats;

  // Stats - using real data from backend
  const stats = [
    {
      label: t('organizer.dashboard.totalEventsLabel'),
      value: businessStats?.total_events || 0,
      icon: Calendar,
      change: businessStats?.total_events === 0 ? t('organizer.dashboard.startCreatingEvents') : t('organizer.dashboard.activeEvents')
    },
    {
      label: t('organizer.dashboard.totalAttendeesLabel'),
      value: businessStats?.tickets_sold || 0,
      icon: Users,
      change: t('organizer.dashboard.checkInData')
    },
    {
      label: t('organizer.dashboard.ticketsSoldLabel'),
      value: businessStats?.tickets_sold || 0,
      icon: Ticket,
      change: t('organizer.dashboard.totalSales')
    },
    {
      label: t('organizer.dashboard.revenueLabel'),
      value: `¥${businessStats?.total_revenue?.toLocaleString() || '0'}`,
      icon: TrendingUp,
      change: t('organizer.dashboard.earnings')
    },
  ];

  const recentEvents = events.slice(0, 3);

  const isLoading = isStatsLoading || isEventsLoading;
  const hasError = statsError || eventsError;

  // Loading state
  if (isLoading && !hasFetched) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-4" />
        <p className="text-gray-400">{t('organizer.dashboard.loading')}</p>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-400 mb-2">{t('organizer.dashboard.loadError')}</p>
        <p className="text-gray-500 text-sm mb-4">{statsError || eventsError}</p>
        <button
          onClick={() => {
            setHasFetched(false);
            const token = localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
            if (token) {
              fetchStats(token);
              fetchMyEvents();
            }
          }}
          className="px-4 py-2 bg-[#d3da0c] text-black rounded-lg hover:bg-[#bbc10b] transition-colors"
        >
          {t('organizer.dashboard.retry')}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-display text-white mb-2">
          {t('organizer.dashboard.welcomeBack')} <span className="text-[#d3da0c]">{profile?.first_name || t('organizer.dashboard.organizerFallback')}</span>
        </h1>
        <p className="text-gray-400">{t('organizer.dashboard.subtitle')}</p>
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
                <span className="text-green-500 text-sm">{stat.change}</span>
              </div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-display text-white">{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-semibold text-white mb-4">{t('organizer.dashboard.quickActionsTitle')}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            to="/organizer/create-event"
            className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#d3da0c] flex items-center justify-center">
              <Plus className="w-6 h-6 text-black" />
            </div>
            <div>
              <p className="text-white font-medium">{t('organizer.dashboard.createEventAction')}</p>
              <p className="text-gray-500 text-sm">{t('organizer.dashboard.createEventDescription')}</p>
            </div>
          </Link>
          <Link
            to="/organizer/scanner"
            className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FF2D8F] flex items-center justify-center">
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">{t('organizer.dashboard.scanTicketsAction')}</p>
              <p className="text-gray-500 text-sm">{t('organizer.dashboard.scanTicketsDescription')}</p>
            </div>
          </Link>
          <Link
            to="/organizer/analytics"
            className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">{t('organizer.dashboard.analyticsAction')}</p>
              <p className="text-gray-500 text-sm">{t('organizer.dashboard.analyticsDescription')}</p>
            </div>
          </Link>
        </div>
      </motion.div>

      {/* Recent Events */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">{t('organizer.dashboard.recentEventsTitle')}</h2>
          <Link
            to="/organizer/events"
            className="text-[#d3da0c] text-sm flex items-center gap-1 hover:gap-2 transition-all"
          >
            {t('organizer.dashboard.viewAll')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="space-y-4">
          {recentEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-xl"
            >
              <img
                src={event.flyer_image}
                alt={event.title}
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                }}
              />
              <div className="flex-1">
                <p className="text-white font-medium">{event.title}</p>
                <p className="text-gray-500 text-sm">
                  {new Date(event.start_date).toLocaleDateString()} • {event.city}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#d3da0c] font-medium">{event.tickets_sold || 0}/{event.capacity || '∞'}</p>
                <p className="text-gray-500 text-sm">{t('organizer.dashboard.sold')}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {recentEvents.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">{t('organizer.dashboard.noEvents')}</p>
            <p className="text-gray-500 text-sm mb-4">{t('organizer.dashboard.noEventsDescription')}</p>
            <Link
              to="/organizer/create-event"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('organizer.dashboard.createEventButton')}
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OrganizerDashboard;
