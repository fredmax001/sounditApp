import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Music, 
  MapPin, 
  Clock, 
  Star, 
  TrendingUp, 
  Disc3, 
  CalendarDays, 
  CheckCircle, 
  DollarSign,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

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
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    if (session?.access_token) {
      fetchIncomingBookings(session.access_token)
        .catch(() => toast.error(t('artist.performances.loadError') || 'Failed to load performances'));
    }
  }, [session, fetchIncomingBookings, t]);

  const performances = useMemo((): Performance[] => {
    const acceptedBookings = incomingBookings.filter((b: Booking) => b.status === 'accepted' || b.status === 'confirmed' || b.status === 'completed');
    return acceptedBookings.map((booking: Booking) => {
      const rawDate = booking.proposed_date || booking.event_date || '';
      const isPast = rawDate ? new Date(rawDate) < new Date() : false;
      return {
        id: booking.id,
        event_name: booking.event_name || 'Live Performance',
        venue: booking.venue || booking.event_location || 'Venue Stage',
        date: rawDate,
        duration: booking.duration || '2',
        status: booking.status === 'completed' || isPast ? 'completed' : 'upcoming',
        rating: booking.rating,
        earnings: booking.agreed_price || booking.budget || 0
      };
    });
  }, [incomingBookings]);

  const completedPerformances = performances.filter(p => p.status === 'completed');
  const upcomingPerformances = performances.filter(p => p.status === 'upcoming');
  const totalEarnings = completedPerformances.reduce((sum, p) => sum + (p.earnings || 0), 0);

  const displayedPerformances = activeTab === 'all' 
    ? performances 
    : activeTab === 'upcoming' 
    ? upcomingPerformances 
    : completedPerformances;

  const formatDate = (dateString: string) => {
    if (!dateString) return '–';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#020b00] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#020b00] text-white pb-[calc(6rem+env(safe-area-inset-bottom,24px))] pt-2 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header & Glowing 3D Turntable / Stage Graphic */}
      <div className="flex items-start justify-between gap-4 pt-2 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Performances
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-[17.5rem] sm:max-w-md leading-relaxed">
            Track your scheduled gigs, DJ sets, stage history, and performance revenue.
          </p>
        </div>

        {/* 3D Glowing Turntable / Vinyl SVG */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 blur-xl rounded-full" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-[0_0_16px_rgba(16,185,129,0.55)]"
            viewBox="0 0 100 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="discGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            {/* Turntable Base */}
            <rect x="15" y="15" width="70" height="50" rx="8" fill="#0b140b" stroke="#34d399" strokeWidth="1.5" />
            {/* Vinyl Record */}
            <circle cx="48" cy="40" r="18" fill="url(#discGrad)" opacity="0.9" />
            <circle cx="48" cy="40" r="12" stroke="#020b00" strokeWidth="1" opacity="0.4" />
            <circle cx="48" cy="40" r="6" fill="#d3da0c" />
            <circle cx="48" cy="40" r="2" fill="#020b00" />
            {/* Tonearm */}
            <path d="M72 25 L62 42 L55 42" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="72" cy="25" r="3" fill="#d3da0c" />
          </svg>
        </div>
      </div>

      {/* Action Workspace Cards (3 Cards) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-6">
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
              Manage Requests
            </span>
          </div>
        </Link>

        <Link
          to="/dashboard/artist/analytics"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Analytics
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              Growth Stats
            </span>
          </div>
        </Link>

        <Link
          to="/dashboard/artist"
          className="bg-[#d3da0c] hover:bg-[#c2c80b] text-black rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all shadow-[0_0_20px_rgba(211,218,12,0.25)] active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center mb-2 text-black">
            <Music className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-bold leading-tight">
              Live Sets
            </span>
            <span className="text-[0.625rem] text-black/70 mt-0.5 block font-medium">
              Mixes & Profile
            </span>
          </div>
        </Link>
      </div>

      {/* 3-Column Stats Row */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-6">
        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Music className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium">Total Gigs</span>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-white">
            {performances.length}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium">Completed</span>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-emerald-400">
            {completedPerformances.length}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-[#d3da0c]" />
            <span className="text-xs font-medium">Gig Revenue</span>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-[#d3da0c] truncate">
            ¥{totalEarnings.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pb-2 mb-4">
        {[
          { id: 'all', label: `All Gigs (${performances.length})` },
          { id: 'upcoming', label: `Upcoming (${upcomingPerformances.length})` },
          { id: 'completed', label: `Completed (${completedPerformances.length})` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#d3da0c] text-black shadow-[0_0_12px_rgba(211,218,12,0.3)]'
                  : 'bg-[#0a1506] border border-white/10 text-gray-300 hover:text-white hover:border-white/20'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Performance Cards List */}
      <div className="space-y-3">
        {displayedPerformances.length === 0 ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-12 text-center">
            <Disc3 className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-white font-medium text-sm">No performances found</p>
            <p className="text-gray-400 text-xs mt-1">
              Accepted bookings will automatically appear here as scheduled performances.
            </p>
          </div>
        ) : (
          displayedPerformances.map((performance) => {
            const isCompleted = performance.status === 'completed';

            return (
              <motion.div
                key={performance.id}
                layout
                className="bg-[#0b140b] border border-white/8 hover:border-emerald-500/30 rounded-2xl p-4 transition-all shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Gig Icon Badge */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    }`}
                  >
                    <Music className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">
                        {performance.event_name}
                      </h3>
                      <span
                        className={`text-[0.625rem] font-bold px-2 py-0.5 rounded-full capitalize border ${
                          isCompleted
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {performance.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1 text-gray-300">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        {formatDate(performance.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        {performance.venue}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        {performance.duration}h Set
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Fee and Rating */}
                <div className="text-right shrink-0">
                  <span className="text-sm sm:text-base font-extrabold text-[#d3da0c] block">
                    ¥{performance.earnings?.toLocaleString()}
                  </span>
                  {performance.rating ? (
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-semibold text-white">{performance.rating}</span>
                    </div>
                  ) : (
                    <span className="text-[0.625rem] text-gray-500 block mt-0.5">Confirmed</span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Performances;
