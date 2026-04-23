import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, MapPin, Clock, Star, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import DashboardPageContainer, { DashboardPageHeader, DashboardCard } from '@/components/dashboard/DashboardPageContainer';

interface Booking {
  id: number;
  status: string;
  event_name?: string;
  venue?: string;
  event_location?: string;
  proposed_date?: string;
  event_date?: string;
  duration?: string;
  rating?: number;
  agreed_price?: number;
  budget?: number;
}

interface Performance {
  id: number;
  event_name: string;
  venue: string;
  date: string;
  duration: string;
  status: 'completed' | 'upcoming' | 'cancelled';
  rating?: number;
  earnings?: number;
}

const Performances = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const { incomingBookings, fetchIncomingBookings, isLoading } = useBookingStore();

  useEffect(() => {
    if (session?.access_token) {
      fetchIncomingBookings(session.access_token)
        .catch(() => toast.error(t('artist.performances.loadError')));
    }
  }, [session, fetchIncomingBookings]);

  const performances = useMemo((): Performance[] => {
    const acceptedBookings = incomingBookings.filter((b: Booking) => b.status === 'accepted' || b.status === 'completed');
    return acceptedBookings.map((booking: Booking) => ({
      id: booking.id,
      event_name: booking.event_name || t('artist.performances.fallbackEvent'),
      venue: booking.venue || booking.event_location || t('artist.performances.fallbackVenue'),
      date: booking.proposed_date || booking.event_date,
      duration: booking.duration || '2',
      status: new Date(booking.proposed_date || booking.event_date) < new Date() ? 'completed' : 'upcoming',
      rating: booking.rating,
      earnings: booking.agreed_price || booking.budget
    }));
  }, [incomingBookings]);

  const completedPerformances = performances.filter(p => p.status === 'completed');
  const upcomingPerformances = performances.filter(p => p.status === 'upcoming');
  const totalEarnings = completedPerformances.reduce((sum, p) => sum + (p.earnings || 0), 0);

  if (isLoading) {
    return (
      <DashboardPageContainer>
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardPageContainer>
    );
  }

  return (
    <DashboardPageContainer>
      <DashboardPageHeader
        title={t('artist.performances.title')}
        subtitle={t('artist.performances.subtitle')}
      />

      <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('artist.performances.totalPerformances')}</p>
              <p className="text-3xl font-bold text-white mt-1">{performances.length}</p>
            </div>
            <div className="w-12 h-12 bg-[#d3da0c]/10 rounded-xl flex items-center justify-center">
              <Music className="w-6 h-6 text-[#d3da0c]" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('artist.performances.completed')}</p>
              <p className="text-3xl font-bold text-white mt-1">{completedPerformances.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{t('artist.performances.totalEarnings')}</p>
              <p className="text-3xl font-bold text-[#d3da0c] mt-1">¥{totalEarnings.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upcoming Performances */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">{t('artist.performances.upcomingGigs')}</h2>
        {upcomingPerformances.length > 0 ? (
          <div className="space-y-4">
            {upcomingPerformances.map((performance) => (
              <div key={performance.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-bold">{performance.event_name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-gray-400 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(performance.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {performance.venue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {t('artist.performances.hoursSet', { hours: performance.duration })}
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-[#d3da0c]/20 text-[#d3da0c] rounded-full text-sm font-bold">
                    ¥{performance.earnings?.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">{t('artist.performances.noUpcoming')}</p>
        )}
      </div>

      {/* Past Performances */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">{t('artist.performances.pastPerformances')}</h2>
        {completedPerformances.length > 0 ? (
          <div className="space-y-4">
            {completedPerformances.map((performance) => (
              <div key={performance.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-bold">{performance.event_name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-gray-400 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(performance.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {performance.venue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {t('artist.performances.hoursSet', { hours: performance.duration })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[#d3da0c] font-bold">¥{performance.earnings?.toLocaleString()}</span>
                    {performance.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-white text-sm">{performance.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">{t('artist.performances.noCompleted')}</p>
        )}
      </div>
      </div>
    </DashboardPageContainer>
  );
};

export default Performances;
