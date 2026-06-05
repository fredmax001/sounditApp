import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, MapPin, Clock, Star, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">{t('artist.performances.title')}</h1>
        <p className="text-gray-400 mt-1 text-sm sm:text-base">{t('artist.performances.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">{t('artist.performances.totalPerformances')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{performances.length}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#d3da0c]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Music className="w-5 h-5 sm:w-6 sm:h-6 text-[#d3da0c]" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">{t('artist.performances.completed')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{completedPerformances.length}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6 col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs sm:text-sm">{t('artist.performances.totalEarnings')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-[#d3da0c] mt-1">¥{totalEarnings.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Upcoming Performances */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">{t('artist.performances.upcomingGigs')}</h2>
        {upcomingPerformances.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {upcomingPerformances.map((performance) => (
              <div key={performance.id} className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-bold text-sm sm:text-base">{performance.event_name}</h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-gray-400 text-xs sm:text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {new Date(performance.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {performance.venue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {t('artist.performances.hoursSet', { hours: performance.duration })}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 sm:px-3 sm:py-1 bg-[#d3da0c]/20 text-[#d3da0c] rounded-full text-xs sm:text-sm font-bold flex-shrink-0">
                    ¥{performance.earnings?.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">{t('artist.performances.noUpcoming')}</p>
        )}
      </div>

      {/* Past Performances */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">{t('artist.performances.pastPerformances')}</h2>
        {completedPerformances.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {completedPerformances.map((performance) => (
              <div key={performance.id} className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-bold text-sm sm:text-base">{performance.event_name}</h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-gray-400 text-xs sm:text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {new Date(performance.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {performance.venue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {t('artist.performances.hoursSet', { hours: performance.duration })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[#d3da0c] font-bold text-sm sm:text-base">¥{performance.earnings?.toLocaleString()}</span>
                    {performance.rating && (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-white text-xs sm:text-sm">{performance.rating}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8 text-sm">{t('artist.performances.noCompleted')}</p>
        )}
      </div>
    </div>
  );
};

export default Performances;
