import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Music, 
  DollarSign, 
  Star, 
  TrendingUp, 
  Calendar, 
  RefreshCw,
  BarChart3,
  Award,
  Layers,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useBookingStore } from '@/store/bookingStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';
import { Link } from 'react-router-dom';

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
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(session.access_token),
        fetchIncomingBookings(session.access_token)
      ]);
    } catch {
      toast.error(t('artist.analytics.loadError') || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [session, fetchStats, fetchIncomingBookings, t]);

  const handleRefresh = async () => {
    if (!session?.access_token || refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchStats(session.access_token),
        fetchIncomingBookings(session.access_token)
      ]);
      toast.success('Analytics updated');
    } catch {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const artistStats = dashboardStats?.artist_stats;
  const acceptedBookings = incomingBookings.filter((b: Booking) => b.status === 'accepted' || b.status === 'confirmed');
  const completedBookings = incomingBookings.filter((b: Booking) => b.status === 'completed');
  const totalEarnings = completedBookings.reduce((sum: number, b: Booking) => sum + (b.agreed_price || b.budget || 0), 0);

  // Calculate monthly data from completed bookings
  const monthlyMap = new Map<string, { bookings: number; earnings: number }>();
  completedBookings.forEach((b: Booking) => {
    const dateStr = b.proposed_date || b.event_date;
    if (!dateStr) return;
    const date = new Date(dateStr);
    const monthKey = date.toLocaleString('en-US', { month: 'short' });
    const existing = monthlyMap.get(monthKey) || { bookings: 0, earnings: 0 };
    existing.bookings += 1;
    existing.earnings += b.agreed_price || b.budget || 0;
    monthlyMap.set(monthKey, existing);
  });
  const monthlyData = Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data }));
  const maxMonthlyEarnings = Math.max(...monthlyData.map(d => d.earnings), 5000);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#020b00] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#020b00] text-white pb-[calc(6rem+env(safe-area-inset-bottom,24px))] pt-2 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header & Glowing 3D Analytics Vector Illustration */}
      <div className="flex items-start justify-between gap-4 pt-2 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Analytics
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-[17.5rem] sm:max-w-md leading-relaxed">
            Monitor fan audience growth, gig bookings conversion, and total artist earnings.
          </p>
        </div>

        {/* 3D Glowing Analytics Chart SVG */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 blur-xl rounded-full" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-[0_0_16px_rgba(16,185,129,0.55)]"
            viewBox="0 0 100 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Chart Background Grid */}
            <rect x="15" y="15" width="70" height="50" rx="8" fill="#0b140b" stroke="#34d399" strokeWidth="1.5" />
            {/* Bar 1 */}
            <rect x="25" y="44" width="8" height="15" rx="3" fill="url(#chartGrad)" opacity="0.6" />
            {/* Bar 2 */}
            <rect x="38" y="34" width="8" height="25" rx="3" fill="url(#chartGrad)" opacity="0.8" />
            {/* Bar 3 */}
            <rect x="51" y="24" width="8" height="35" rx="3" fill="url(#chartGrad)" />
            {/* Bar 4 (Peak) */}
            <rect x="64" y="20" width="8" height="39" rx="3" fill="#d3da0c" />
            {/* Trend line */}
            <path d="M29 42 L42 32 L55 22 L68 18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="68" cy="18" r="3" fill="#d3da0c" stroke="#ffffff" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Action Workspace Cards (3 Cards) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-6">
        <Link
          to="/dashboard/artist/performances"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <Music className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Performances
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              Gigs History
            </span>
          </div>
        </Link>

        <Link
          to="/dashboard/artist/bookings"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Bookings
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              All Requests
            </span>
          </div>
        </Link>

        {/* Neon-lime Refresh Action */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-[#d3da0c] hover:bg-[#c2c80b] text-black rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all shadow-[0_0_20px_rgba(211,218,12,0.25)] active:scale-[0.98] text-left cursor-pointer disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center mb-2 text-black">
            <RefreshCw className={`w-4 h-4 text-black stroke-[2.5] ${refreshing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-bold leading-tight">
              Refresh
            </span>
            <span className="text-[0.625rem] text-black/70 mt-0.5 block font-medium">
              Sync Real-Time
            </span>
          </div>
        </button>
      </div>

      {/* 2x2 Key Performance Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 mb-6">
        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold">Followers</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {artistStats?.followers?.toLocaleString() || (artistProfile?.follower_count ?? 0).toLocaleString()}
          </p>
          <span className="text-[0.625rem] text-emerald-400 mt-1 block font-medium">Audience fanbase</span>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Music className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold">Total Gigs</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {artistStats?.total_gigs || acceptedBookings.length + completedBookings.length}
          </p>
          <span className="text-[0.625rem] text-gray-400 mt-1 block font-medium">Booked performances</span>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-[#d3da0c]" />
            </div>
            <span className="text-xs font-semibold">Total Revenue</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#d3da0c] truncate">
            ¥{(artistStats?.earnings || totalEarnings).toLocaleString()}
          </p>
          <span className="text-[0.625rem] text-emerald-400 mt-1 block font-medium">Settled earnings</span>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
            <span className="text-xs font-semibold">Artist Rating</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {artistStats?.rating ? artistStats.rating.toFixed(1) : (artistProfile?.rating ? Number(artistProfile.rating).toFixed(1) : '5.0')}
          </p>
          <span className="text-[0.625rem] text-gray-400 mt-1 block font-medium">Organizer verified review</span>
        </div>
      </div>

      {/* Monthly Performance Revenue Overview */}
      <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Monthly Revenue Breakdown
          </h2>
          <span className="text-xs text-gray-400 font-medium">Past Months</span>
        </div>

        {monthlyData.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            Completed gig settlements will plot your monthly revenue trajectory here.
          </div>
        ) : (
          <div className="space-y-3">
            {monthlyData.map((data, index) => {
              const percentage = Math.min((data.earnings / maxMonthlyEarnings) * 100, 100);
              return (
                <div key={data.month} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-10 shrink-0">
                    {data.month}
                  </span>
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ delay: index * 0.1, duration: 0.6 }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#d3da0c] rounded-full"
                    />
                  </div>
                  <span className="text-xs font-extrabold text-white w-20 text-right shrink-0">
                    ¥{data.earnings.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Gig Settlements */}
      <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            Recent Gig Engagements
          </h2>
          <Link to="/dashboard/artist/bookings" className="text-xs text-[#d3da0c] hover:underline flex items-center gap-0.5 font-semibold">
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {acceptedBookings.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            No active engagements yet. Incoming gigs will be tracked here.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {acceptedBookings.slice(0, 5).map((booking: Booking) => (
              <div key={booking.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-white truncate">{booking.event_name || 'Event Booking'}</p>
                  <p className="text-[0.6875rem] text-gray-400">
                    {booking.proposed_date || booking.event_date ? new Date(booking.proposed_date || booking.event_date!).toLocaleDateString() : 'Scheduled'}
                  </p>
                </div>
                <span className="text-xs sm:text-sm font-extrabold text-[#d3da0c] shrink-0">
                  ¥{(booking.agreed_price || booking.budget || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Genre Categories */}
      {artistProfile?.genres && artistProfile.genres.length > 0 && (
        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Audience Musical Styles
          </h2>
          <div className="flex flex-wrap gap-2">
            {artistProfile.genres.map((genre: string) => (
              <span
                key={genre}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-gray-200"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
