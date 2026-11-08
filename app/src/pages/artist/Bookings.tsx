/**
 * Artist Bookings Page
 * Manage booking requests from event organizers
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  User, 
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
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next';

interface Booking {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  event_city: string;
  budget: number;
  duration: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  message: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  created_at: string;
  payment_status?: 'pending' | 'submitted' | 'paid' | 'verified' | 'rejected';
  payment_amount?: number;
  payment_screenshot_url?: string;
  payment_instructions?: string;
  wechat_qr_url?: string;
  alipay_qr_url?: string;
}

export default function ArtistBookings() {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const reviewPayment = async (bookingId: number, decision: 'verified' | 'rejected') => {
    if (!session?.access_token) return;
    try {
      const body = new FormData(); body.append('decision', decision);
      const response = await fetch(`${API_BASE_URL}/bookings/requests/${bookingId}/payment-status`, { method: 'PUT', headers: { Authorization: `Bearer ${session.access_token}` }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not review payment');
      setBookings(current => current.map(item => item.id === bookingId ? { ...item, payment_status: decision } : item));
      toast.success(decision === 'verified' ? 'Deposit marked verified' : 'Payment proof rejected');
    } catch (error: any) { toast.error(error.message || 'Could not review payment'); }
  };
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/artist/bookings`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      } else {
        toast.error(t('artist.bookings.loadFailed'));
      }
    } catch {
      toast.error(t('artist.bookings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleStatusChange = async (bookingId: number, newStatus: string, reason?: string) => {
    setActionLoading(bookingId);
    try {
      const body: Record<string, string> = { status: newStatus };
      if (reason) body.rejection_reason = reason;

      const res = await fetch(`${API_BASE_URL}/artist/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success(t('artist.bookings.statusUpdated', { status: newStatus }));
        setDecliningId(null);
        setRejectionReason('');
        loadBookings();
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.detail || t('artist.bookings.updateStatusFailed'));
      }
    } catch {
      toast.error(t('artist.bookings.updateError'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === filter);

  const formatBudget = (budget?: number | null) => {
    if (budget == null || Number.isNaN(budget)) return ', ';
    return `¥${budget.toLocaleString()}`;
  };

  const formatDuration = (duration?: number | null) => {
    if (duration == null || Number.isNaN(duration)) return ', ';
    return `${duration}h`;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return ', ';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return ', ';
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <Clock3 className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  const getPaymentStatusClass = (paymentStatus?: string) => {
    switch (paymentStatus) {
      case 'verified':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paid':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d3da0c]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 pt-6 sm:pt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#020b00] dark:text-white">{t('artist.bookings.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            {t('artist.bookings.subtitle')}
          </p>
        </div>
        
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-[#020b00] dark:text-white focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none shadow-xs dark:shadow-none"
          >
            <option value="all">{t('artist.bookings.filter.all')}</option>
            <option value="pending">{t('artist.bookings.filter.pending')}</option>
            <option value="accepted">{t('artist.bookings.filter.accepted')}</option>
            <option value="completed">{t('artist.bookings.filter.completed')}</option>
            <option value="rejected">{t('artist.bookings.filter.rejected')}</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[
          { label: t('artist.bookings.stat.total'), value: bookings.length, color: 'text-[#020b00] dark:text-white' },
          { label: t('artist.bookings.stat.pending'), value: bookings.filter(b => b.status === 'pending').length, color: 'text-amber-500 dark:text-yellow-400' },
          { label: t('artist.bookings.stat.accepted'), value: bookings.filter(b => b.status === 'accepted').length, color: 'text-emerald-600 dark:text-green-400' },
          { label: t('artist.bookings.stat.completed'), value: bookings.filter(b => b.status === 'completed').length, color: 'text-blue-600 dark:text-blue-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-[#111111] rounded-xl p-3 sm:p-4 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none"
          >
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">{stat.label}</p>
            <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#111111] rounded-xl border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
            <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#020b00] dark:text-white mb-2">{t('artist.bookings.noBookings')}</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              {t('artist.bookings.noBookingsDescription')}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-[#111111] rounded-xl border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none overflow-hidden"
            >
              {/* Summary Row */}
              <div 
                className="p-3 sm:p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-[#020b00] dark:text-white text-sm sm:text-base">{booking.event_name}</h3>
                      <span className={`px-2 py-0.5 text-[10px] sm:text-xs rounded-full border capitalize flex items-center gap-1 ${getStatusClass(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </span>
                      {booking.payment_status && (
                        <span className={`px-2 py-0.5 text-[10px] sm:text-xs rounded-full border capitalize ${getPaymentStatusClass(booking.payment_status)}`}>
                          {booking.payment_status === 'pending' ? t('artist.bookings.paymentPending') : booking.payment_status}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                        {formatDate(booking.event_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                        {booking.event_city || ', '}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                        {formatBudget(booking.budget)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                        {formatDuration(booking.duration)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {expandedId === booking.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === booking.id && (
                <div className="px-4 pb-4 border-t border-black/8 dark:border-white/5 pt-4">
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('artist.bookings.eventDetails')}</h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-[#020b00] dark:text-white">
                          <span className="text-gray-500 dark:text-gray-400">{t('artist.bookings.type')}:</span> {booking.event_type || ', '}
                        </p>
                        <p className="text-[#020b00] dark:text-white">
                          <span className="text-gray-500 dark:text-gray-400">{t('artist.bookings.budget')}:</span> {formatBudget(booking.budget)}
                        </p>
                        <p className="text-[#020b00] dark:text-white">
                          <span className="text-gray-500 dark:text-gray-400">{t('artist.bookings.duration')}:</span> {formatDuration(booking.duration)}
                        </p>
                        <p className="text-[#020b00] dark:text-white">
                          <span className="text-gray-500 dark:text-gray-400">{t('artist.bookings.location')}:</span> {booking.event_city || ', '}
                        </p>
                        <p className="text-[#020b00] dark:text-white">
                          <span className="text-gray-500 dark:text-gray-400">{t('artist.bookings.paymentStatus')}:</span>{' '}
                          <span className={`capitalize font-medium ${
                            booking.payment_status === 'verified' ? 'text-emerald-600 dark:text-green-400' :
                            booking.payment_status === 'paid' ? 'text-blue-600 dark:text-blue-400' :
                            booking.payment_status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                            'text-amber-600 dark:text-yellow-400'
                          }`}>
                            {booking.payment_status || t('artist.bookings.paymentPending')}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('artist.bookings.contactInfo')}</h4>
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-[#020b00] dark:text-white">
                          <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          {booking.contact_name || ', '}
                        </p>
                        <p className="flex items-center gap-2 text-[#020b00] dark:text-white">
                          <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          {booking.contact_email || ', '}
                        </p>
                        {booking.contact_phone && (
                          <p className="flex items-center gap-2 text-[#020b00] dark:text-white">
                            <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            {booking.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {booking.message && (
                    <div className="bg-neutral-50 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        {t('artist.bookings.messageFromOrganizer')}
                      </p>
                      <p className="text-[#020b00] dark:text-white text-sm">{booking.message}</p>
                    </div>
                  )}

                  {/* Payment Screenshot */}
                  {booking.payment_screenshot_url && ['submitted', 'paid', 'verified', 'rejected'].includes(booking.payment_status || '') && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('artist.bookings.paymentScreenshot')}</p>
                      <a href={booking.payment_screenshot_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={booking.payment_screenshot_url}
                          alt={t('artist.bookings.paymentScreenshot')}
                          className="max-h-48 rounded-lg border border-black/10 dark:border-white/10 hover:border-[#020b00] dark:hover:border-[#d3da0c]/50 transition-colors"
                        />
                      </a>
                    </div>
                  )}

                  {booking.payment_status === 'submitted' && (
                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">Deposit proof submitted{booking.payment_amount ? ` · ¥${booking.payment_amount}` : ''}. Verify the transfer in your payment app before confirming.</p>
                      <div className="flex gap-2"><button onClick={() => void reviewPayment(booking.id, 'verified')} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold">Verify deposit</button><button onClick={() => void reviewPayment(booking.id, 'rejected')} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">Reject proof</button></div>
                    </div>
                  )}

                  {/* Awaiting Payment Badge */}
                  {booking.status === 'pending' && booking.payment_status === 'pending' && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-amber-600 dark:text-yellow-400 flex items-center gap-2 font-medium">
                        <Clock3 className="w-4 h-4" />
                        {t('artist.bookings.awaitingPayment')}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {booking.status === 'pending' && (
                    <div className="space-y-3">
                      {decliningId === booking.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder={t('artist.bookings.rejectionReasonPlaceholder')}
                            className="w-full bg-neutral-50 dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-red-500/50 focus:outline-none resize-none"
                            rows={3}
                          />
                          <div className="flex gap-2 sm:gap-3">
                            <button
                              onClick={() => handleStatusChange(booking.id, 'rejected', rejectionReason)}
                              disabled={actionLoading === booking.id}
                              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white py-2 px-3 sm:px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm sm:text-base cursor-pointer"
                            >
                              {actionLoading === booking.id ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4" />
                                  {t('artist.bookings.confirmDecline')}
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => { setDecliningId(null); setRejectionReason(''); }}
                              disabled={actionLoading === booking.id}
                              className="flex-1 bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-[#020b00] dark:text-white border border-black/10 dark:border-white/10 py-2 px-3 sm:px-4 rounded-lg font-medium text-sm sm:text-base cursor-pointer"
                            >
                              {t('artist.bookings.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 sm:gap-3">
                          <button
                            onClick={() => handleStatusChange(booking.id, 'accepted')}
                            disabled={actionLoading === booking.id}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white py-2 px-3 sm:px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm sm:text-base cursor-pointer"
                          >
                            {actionLoading === booking.id ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('artist.bookings.accept')}</span>
                                <span className="sm:hidden">Accept</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setDecliningId(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 disabled:bg-red-500/5 text-red-600 dark:text-red-400 border border-red-500/30 py-2 px-3 sm:px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm sm:text-base cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('artist.bookings.decline')}</span>
                            <span className="sm:hidden">Decline</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {booking.status === 'accepted' && (
                    <button
                      onClick={() => handleStatusChange(booking.id, 'completed')}
                      disabled={actionLoading === booking.id}
                      className="w-full bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black py-2.5 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-xs dark:shadow-none cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('artist.bookings.markCompleted')}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
