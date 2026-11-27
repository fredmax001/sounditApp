import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  DollarSign, 
  Clock,
  CheckCircle, 
  XCircle, 
  Clock3, 
  ChevronDown, 
  ChevronUp, 
  Phone, 
  Mail, 
  MessageSquare, 
  Check, 
  X, 
  Loader2,
  CalendarDays,
  QrCode,
  ShieldCheck,
  ExternalLink,
  Eye,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface Booking {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  event_time?: string;
  event_city: string;
  event_location?: string;
  creative_role?: string;
  budget: number;
  duration: number;
  status: 'pending' | 'accepted' | 'confirmed' | 'completed' | 'rejected' | 'cancelled';
  message: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  payment_status?: 'pending' | 'submitted' | 'paid' | 'verified' | 'rejected';
  payment_amount?: number;
  deposit_amount?: number;
  payment_currency?: string;
  payment_submitted_at?: string;
  payment_verified_at?: string;
  payment_reviewed_at?: string;
  payment_screenshot_url?: string;
  rejection_reason?: string;
  payment_instructions?: string;
  wechat_qr_url?: string;
  alipay_qr_url?: string;
  created_at: string;
}

export default function ArtistBookings() {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/artist/bookings`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || t('artist.bookings.loadFailed') || 'Failed to load bookings');
      }
    } catch {
      toast.error(t('artist.bookings.loadError') || 'Error loading bookings');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, t]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleStatusChange = async (bookingId: number, newStatus: string, reason?: string) => {
    if (!session?.access_token) return;
    setActionLoading(bookingId);
    try {
      const body: Record<string, string> = { status: newStatus };
      if (reason) body.rejection_reason = reason;

      const res = await fetch(`${API_BASE_URL}/artist/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success(
          newStatus === 'accepted'
            ? 'Booking accepted! Organizer notified.'
            : newStatus === 'rejected'
            ? 'Booking declined.'
            : `Booking marked as ${newStatus}`
        );
        setDecliningId(null);
        setRejectionReason('');
        loadBookings();
      } else {
        const error = await res.json().catch(() => ({}));
        const errMsg =
          typeof error?.detail === 'string'
            ? error.detail
            : error?.detail?.message || error?.message || t('artist.bookings.updateStatusFailed') || 'Failed to update booking status';
        toast.error(errMsg);
      }
    } catch {
      toast.error(t('artist.bookings.updateError') || 'Network error updating booking');
    } finally {
      setActionLoading(null);
    }
  };

  const reviewPayment = async (bookingId: number, decision: 'verified' | 'rejected') => {
    if (!session?.access_token) return;
    setActionLoading(bookingId);
    try {
      const body = new FormData();
      body.append('decision', decision);

      const response = await fetch(`${API_BASE_URL}/bookings/requests/${bookingId}/payment-status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not review payment');
      
      setBookings(current => current.map(item => item.id === bookingId ? { ...item, payment_status: decision } : item));
      toast.success(decision === 'verified' ? 'Deposit payment marked as verified!' : 'Payment proof rejected');
    } catch (error: any) {
      toast.error(error.message || 'Could not review payment proof');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === filter);

  const formatBudget = (budget?: number | null) => {
    if (budget == null || Number.isNaN(budget)) return '–';
    return `¥${Number(budget).toLocaleString()}`;
  };

  const formatDuration = (duration?: number | null) => {
    if (duration == null || Number.isNaN(duration)) return '–';
    return `${duration}h`;
  };

  const formatDate = (dateString?: string | null) => {
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

  const totalCount = bookings.length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const acceptedCount = bookings.filter(b => b.status === 'accepted' || b.status === 'confirmed').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="min-h-dvh w-full max-w-4xl min-w-0 overflow-x-hidden bg-[#020b00] text-white pb-[calc(6rem+env(safe-area-inset-bottom,24px))] pt-2 px-4 sm:px-6 lg:px-8 mx-auto">
      {/* Header & 3D Glowing Ticket Vector */}
      <div className="flex items-start justify-between gap-4 pt-2 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Bookings
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1.5 max-w-[17.5rem] sm:max-w-md leading-relaxed">
            Review incoming gig requests, manage contracts, and confirm performance deposits.
          </p>
        </div>

        {/* 3D Glowing Ticket/Pass Illustration matching reference style */}
        <div className="relative shrink-0 w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-emerald-500/25 blur-xl rounded-full" />
          <svg
            className="w-16 h-16 sm:w-20 sm:h-20 relative z-10 drop-shadow-[0_0_16px_rgba(16,185,129,0.55)]"
            viewBox="0 0 100 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="ticketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            {/* Background pass card */}
            <rect x="15" y="10" width="70" height="54" rx="10" fill="url(#ticketGrad)" opacity="0.35" transform="rotate(-6 50 37)" />
            {/* Foreground VIP pass card */}
            <rect x="18" y="14" width="64" height="50" rx="9" fill="url(#ticketGrad)" stroke="#34d399" strokeWidth="1.5" />
            {/* Notch cutouts */}
            <circle cx="18" cy="39" r="6" fill="#020b00" />
            <circle cx="82" cy="39" r="6" fill="#020b00" />
            {/* Star emblem inside ticket */}
            <path d="M50 25 L53 33 L61 33 L55 38 L57 46 L50 41 L43 46 L45 38 L39 33 L47 33 Z" fill="#d3da0c" />
            <circle cx="50" cy="54" r="2.5" fill="#ffffff" opacity="0.9" />
          </svg>
        </div>
      </div>

      {/* Action Workspace Cards (3 Cards matching Staff/Payouts pattern) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-6">
        {/* Card 1: Availability Calendar */}
        <Link
          to="/dashboard/artist"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <CalendarDays className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Availability
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              Manage Calendar
            </span>
          </div>
        </Link>

        {/* Card 2: Messages */}
        <Link
          to="/dashboard/artist/messages"
          className="bg-[#0b140b] hover:bg-[#111e11] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all group active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2 text-emerald-400 group-hover:scale-105 transition-transform">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-semibold text-white/90 leading-tight">
              Messages
            </span>
            <span className="text-[0.625rem] text-gray-500 mt-0.5 block">
              Direct Inquiries
            </span>
          </div>
        </Link>

        {/* Card 3: Neon-Lime Primary Action (Payment Settings) */}
        <Link
          to="/dashboard/artist"
          className="bg-[#d3da0c] hover:bg-[#c2c80b] text-black rounded-2xl p-3 sm:p-4 flex flex-col justify-between transition-all shadow-[0_0_20px_rgba(211,218,12,0.25)] active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-xl bg-black/10 flex items-center justify-center mb-2 text-black">
            <QrCode className="w-4 h-4 text-black stroke-[2.5]" />
          </div>
          <div>
            <span className="block text-[0.6875rem] sm:text-xs font-bold leading-tight">
              Payment QR
            </span>
            <span className="text-[0.625rem] text-black/70 mt-0.5 block font-medium">
              WeChat / Alipay
            </span>
          </div>
        </Link>
      </div>

      {/* 2x2 Real-Time Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mb-6">
        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Total Bookings</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {totalCount}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1.5">
            <Clock3 className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-medium">Pending</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-yellow-400">
            {pendingCount}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Confirmed</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {acceptedCount}
          </p>
        </div>

        <div className="bg-[#0b140b] border border-white/5 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1.5">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium">Completed</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-blue-400">
            {completedCount}
          </p>
        </div>
      </div>

      {/* Pill Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 hide-scrollbar">
        {[
          { id: 'all', label: 'All Requests' },
          { id: 'pending', label: 'Pending' },
          { id: 'accepted', label: 'Confirmed' },
          { id: 'completed', label: 'Completed' },
          { id: 'rejected', label: 'Declined' },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
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

      {/* Bookings List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Booking Requests
          </h2>
          <span className="text-xs text-gray-400">
            {filteredBookings.length} {filteredBookings.length === 1 ? 'Booking' : 'Bookings'}
          </span>
        </div>

        {loading ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] mx-auto mb-3 animate-spin" />
            <p className="text-xs text-gray-400">Loading booking requests...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-[#0a1209] rounded-2xl border border-white/5 p-10 text-center">
            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-white font-medium text-sm">No booking requests found</p>
            <p className="text-gray-400 text-xs mt-1">
              {filter === 'all'
                ? 'When organizers submit booking requests for your performances, they will appear here.'
                : `No bookings match the "${filter}" filter.`}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const isExpanded = expandedId === booking.id;
            const isActionBusy = actionLoading === booking.id;
            const hasDepositSubmitted = booking.payment_status === 'submitted';
            const isDepositVerified = booking.payment_status === 'verified';

            return (
              <motion.div
                key={booking.id}
                layout
                className="bg-[#0b140b] border border-white/8 hover:border-emerald-500/30 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                {/* Header Summary Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                  className="p-3.5 sm:p-4 cursor-pointer flex items-start justify-between gap-3"
                >
                  {/* Left: Avatar with Initial + Event Name */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[#d3da0c] text-black font-extrabold flex items-center justify-center shrink-0 text-base shadow-[0_0_12px_rgba(211,218,12,0.2)]">
                      {(booking.contact_name || booking.event_name || 'E').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate">
                          {booking.event_name || 'Event Booking'}
                        </h3>
                        {/* Status Badge */}
                        <span
                          className={`text-[0.625rem] sm:text-[0.6875rem] font-bold px-2 py-0.5 rounded-full capitalize border flex items-center gap-1 ${
                            booking.status === 'accepted' || booking.status === 'confirmed'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : booking.status === 'completed'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : booking.status === 'rejected' || booking.status === 'cancelled'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          {booking.status}
                        </span>

                        {/* Deposit Status Badge */}
                        {booking.payment_status && (
                          <span
                            className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-full border ${
                              isDepositVerified
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : hasDepositSubmitted
                                ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30 animate-pulse'
                                : 'bg-white/5 text-gray-400 border-white/10'
                            }`}
                          >
                            Deposit: {booking.payment_status}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 truncate mb-2">
                        {booking.contact_name || 'Client'} • {booking.event_type || 'Performance'}
                      </p>

                      {/* Chips / Pills */}
                      <div className="flex flex-wrap gap-2 text-[0.6875rem] text-gray-300">
                        <span className="inline-flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          {formatDate(booking.event_date)}
                        </span>

                        <span className="inline-flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          {booking.event_city || 'Shanghai'}
                        </span>

                        <span className="inline-flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg font-bold text-[#d3da0c]">
                          <DollarSign className="w-3 h-3 text-[#d3da0c]" />
                          {formatBudget(booking.budget)}
                        </span>

                        <span className="inline-flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatDuration(booking.duration)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Expand Chevron */}
                  <div className="shrink-0 pt-1 text-gray-400 hover:text-white">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 pt-2 border-t border-white/5 bg-[#081007]"
                    >
                      <div className="grid sm:grid-cols-2 gap-4 py-3">
                        {/* Event Details */}
                        <div className="space-y-2 text-xs">
                          <h4 className="text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Event Information
                          </h4>
                          <div className="bg-white/5 rounded-xl p-3 space-y-1.5">
                            <p className="flex justify-between">
                              <span className="text-gray-400">Date & Time:</span>
                              <span className="font-semibold text-white">{formatDate(booking.event_date)} {booking.event_time || ''}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-gray-400">Location:</span>
                              <span className="font-semibold text-white">{booking.event_location || booking.event_city || '–'}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-gray-400">Offer Budget:</span>
                              <span className="font-bold text-[#d3da0c]">{formatBudget(booking.budget)}</span>
                            </p>
                            {booking.deposit_amount && (
                              <p className="flex justify-between">
                                <span className="text-gray-400">Required Deposit:</span>
                                <span className="font-bold text-emerald-400">{formatBudget(booking.deposit_amount)}</span>
                              </p>
                            )}
                            {booking.creative_role && (
                              <p className="flex justify-between">
                                <span className="text-gray-400">Role:</span>
                                <span className="font-semibold text-white">{booking.creative_role}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Contact Information & Actions */}
                        <div className="space-y-2 text-xs">
                          <h4 className="text-[0.6875rem] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Organizer Contact
                          </h4>
                          <div className="bg-white/5 rounded-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Organizer Name:</span>
                              <span className="font-semibold text-white">{booking.contact_name || 'Client'}</span>
                            </div>
                            {booking.contact_email && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">Email:</span>
                                <a href={`mailto:${booking.contact_email}`} className="text-emerald-400 hover:underline flex items-center gap-1 font-medium">
                                  <Mail className="w-3 h-3" />
                                  {booking.contact_email}
                                </a>
                              </div>
                            )}
                            {booking.contact_phone && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">Phone:</span>
                                <a href={`tel:${booking.contact_phone}`} className="text-emerald-400 hover:underline flex items-center gap-1 font-medium">
                                  <Phone className="w-3 h-3" />
                                  {booking.contact_phone}
                                </a>
                              </div>
                            )}

                            <div className="pt-2 flex gap-2">
                              {booking.contact_phone && (
                                <a
                                  href={`tel:${booking.contact_phone}`}
                                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-center font-bold text-white flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5" /> Call
                                </a>
                              )}
                              <Link
                                to="/dashboard/artist/messages"
                                className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-center font-bold text-white flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> Message
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Organizer Notes / Message */}
                      {booking.message && (
                        <div className="mb-4 bg-white/5 rounded-xl p-3 text-xs">
                          <span className="text-gray-400 font-semibold block mb-1">Message from Organizer:</span>
                          <p className="text-gray-200 leading-relaxed italic">"{booking.message}"</p>
                        </div>
                      )}

                      {/* Deposit Proof Review Card (if submitted) */}
                      {booking.payment_screenshot_url && (
                        <div className="mb-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 text-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              Payment Proof Submitted
                            </span>
                            <button
                              onClick={() => setPreviewScreenshotUrl(booking.payment_screenshot_url || null)}
                              className="text-xs text-emerald-300 hover:text-white flex items-center gap-1 underline cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Full Screenshot
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <img
                              src={booking.payment_screenshot_url}
                              alt="Payment Proof"
                              onClick={() => setPreviewScreenshotUrl(booking.payment_screenshot_url || null)}
                              className="w-16 h-16 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-90"
                            />
                            <div className="flex-1">
                              <p className="text-gray-300">
                                Deposit Amount: <strong className="text-white">{formatBudget(booking.deposit_amount || booking.payment_amount)}</strong>
                              </p>
                              <p className="text-gray-400 text-[0.6875rem] mt-0.5">
                                Status: <span className="capitalize font-semibold text-white">{booking.payment_status}</span>
                              </p>
                            </div>

                            {/* Verify or Reject Deposit Proof */}
                            {booking.payment_status === 'submitted' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => reviewPayment(booking.id, 'verified')}
                                  disabled={isActionBusy}
                                  className="px-3 py-1.5 bg-[#d3da0c] hover:bg-[#c2c80b] text-black font-bold rounded-lg transition-all text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  Verify
                                </button>
                                <button
                                  onClick={() => reviewPayment(booking.id, 'rejected')}
                                  disabled={isActionBusy}
                                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg transition-all text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rejection reason displayed if rejected */}
                      {booking.rejection_reason && (
                        <div className="mb-4 bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Decline Reason:</span>
                            <p className="mt-0.5 text-gray-300">{booking.rejection_reason}</p>
                          </div>
                        </div>
                      )}

                      {/* Primary Actions Bar */}
                      <div className="pt-2 flex items-center justify-end gap-2.5">
                        {booking.status === 'pending' && (
                          <>
                            <button
                              onClick={() => setDecliningId(booking.id)}
                              disabled={isActionBusy}
                              className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleStatusChange(booking.id, 'accepted')}
                              disabled={isActionBusy}
                              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#d3da0c] hover:bg-[#c2c80b] text-black transition-all shadow-[0_0_12px_rgba(211,218,12,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isActionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                              Accept Booking
                            </button>
                          </>
                        )}

                        {booking.status === 'accepted' && (
                          <button
                            onClick={() => handleStatusChange(booking.id, 'completed')}
                            disabled={isActionBusy}
                            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-500 hover:bg-blue-600 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isActionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Mark as Completed
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Decline Booking Reason Modal */}
      <AnimatePresence>
        {decliningId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setDecliningId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0e160d] rounded-2xl border border-white/10 shadow-2xl p-6 w-full max-w-md text-white"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Decline Booking Request</h3>
                <button
                  onClick={() => setDecliningId(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-400 mb-4">
                Please provide a brief reason for declining so the organizer understands (e.g., schedule conflict, travel constraints).
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for declining this booking..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c] mb-5"
              />

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDecliningId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusChange(decliningId, 'rejected', rejectionReason)}
                  disabled={actionLoading === decliningId}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
                >
                  {actionLoading === decliningId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirm Decline
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Screenshot Zoom Modal */}
      <AnimatePresence>
        {previewScreenshotUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[10000] flex items-center justify-center p-4"
            onClick={() => setPreviewScreenshotUrl(null)}
          >
            <div className="relative max-w-2xl w-full max-h-[85dvh] flex flex-col items-center">
              <button
                onClick={() => setPreviewScreenshotUrl(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewScreenshotUrl}
                alt="Payment proof full"
                className="max-h-[80dvh] w-auto object-contain rounded-xl border border-white/10 shadow-2xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
