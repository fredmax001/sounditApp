import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Music, DollarSign, Star } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useBookingStore } from '@/store/bookingStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';

interface Booking {
  id: number | string;
  status: string;
  agreed_price?: number;
  budget?: number;
  event_name?: string;
  proposed_date?: string;
  event_date?: string;
}

const Analytics = () => {
  const { t } = useTranslation();
  useSubscriptionGuard('analytics');
  const { session, artistProfile } = useAuthStore();
  const { stats: dashboardStats, fetchStats } = useDashboardStore();
  const { incomingBookings, fetchIncomingBookings } = useBookingStore();
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(session!.access_token),
        fetchIncomingBookings(session!.access_token)
      ]);
    } catch {
      toast.error(t('artist.analytics.loadError'));
    } finally {
      setLoading(false);
    }
  }, [session, fetchStats, fetchIncomingBookings]);

  useEffect(() => {
    if (session?.access_token) {
      loadAnalytics();
    }
  }, [session, loadAnalytics]);

  const artistStats = dashboardStats?.artist_stats;
  const acceptedBookings = incomingBookings.filter((b: Booking) => b.status === 'accepted');
  const completedBookings = incomingBookings.filter((b: Booking) => b.status === 'completed');
  const totalEarnings = completedBookings.reduce((sum: number, b: Booking) => sum + (b.agreed_price || b.budget || 0), 0);

  // Calculate monthly data from completed bookings
  const monthlyMap = new Map<string, { bookings: number; earnings: number }>();
  completedBookings.forEach((b: Booking) => {
    const dateStr = b.proposed_date || b.event_date;
    if (!dateStr) return;
    const date = new Date(dateStr);
    const monthKey = date.toLocaleString('default', { month: 'short' });
    const existing = monthlyMap.get(monthKey) || { bookings: 0, earnings: 0 };
    existing.bookings += 1;
    existing.earnings += b.agreed_price || b.budget || 0;
    monthlyMap.set(monthKey, existing);
  });
  const monthlyData = Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{t('artist.analytics.title')}</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">{t('artist.analytics.subtitle')}</p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-3 py-2 sm:px-4 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-white transition-colors text-sm sm:text-base flex-shrink-0"
        >
          {t('artist.analytics.refresh')}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#d3da0c]" />
            <span className="text-gray-400 text-xs sm:text-sm">{t('artist.analytics.followers')}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{artistStats?.followers || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Music className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <span className="text-gray-400 text-xs sm:text-sm">{t('artist.analytics.totalGigs')}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{artistStats?.total_gigs || acceptedBookings.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            <span className="text-gray-400 text-xs sm:text-sm">{t('artist.analytics.earnings')}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">¥{(artistStats?.earnings || totalEarnings).toLocaleString()}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            <span className="text-gray-400 text-xs sm:text-sm">{t('artist.analytics.rating')}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white">{artistStats?.rating?.toFixed(1) || '0.0'}</p>
        </motion.div>
      </div>

      {/* Monthly Overview */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-6">{t('artist.analytics.monthlyOverview')}</h2>
        <div className="space-y-3 sm:space-y-4">
          {monthlyData.map((data, index) => (
            <div key={data.month} className="flex items-center gap-2 sm:gap-4">
              <span className="text-gray-400 text-xs sm:text-sm w-10 sm:w-12 flex-shrink-0">{data.month}</span>
              <div className="flex-1 h-6 sm:h-8 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.earnings / 8000) * 100}%` }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-[#d3da0c] to-[#d3da0c]/50 rounded-full"
                />
              </div>
              <span className="text-white font-bold text-xs sm:text-sm w-16 sm:w-20 text-right flex-shrink-0">¥{data.earnings.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">{t('artist.analytics.recentBookings')}</h2>
        {acceptedBookings.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {acceptedBookings.slice(0, 5).map((booking: Booking) => (
              <div key={booking.id} className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-xl gap-3">
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm sm:text-base truncate">{booking.event_name}</p>
                  <p className="text-gray-400 text-xs sm:text-sm">
                    {new Date(booking.proposed_date || booking.event_date).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[#d3da0c] font-bold text-sm sm:text-base flex-shrink-0">¥{(booking.agreed_price || booking.budget || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">{t('artist.analytics.noBookings')}</p>
        )}
      </div>

      {/* Genre Performance */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">{t('artist.analytics.genrePerformance')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {(artistProfile?.genres || []).map((genre: string) => {
            const genreGigs = completedBookings.filter((b: Booking) => b.event_name?.toLowerCase().includes(genre.toLowerCase())).length;
            return (
              <div key={genre} className="bg-white/5 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-white font-bold text-sm sm:text-base">{genre}</p>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">{t('artist.analytics.gigCount', { count: genreGigs })}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
