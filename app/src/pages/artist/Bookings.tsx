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
  payment_status?: 'pending' | 'paid' | 'verified' | 'rejected';
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
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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

  const handleStatusChange = async (bookingId: number, newStatus: string) => {
    setActionLoading(bookingId);
    try {
      const res = await fetch(`${API_BASE_URL}/artist/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        toast.success(t('artist.bookings.statusUpdated', { status: newStatus }));
        loadBookings();
      } else {
        toast.error(t('artist.bookings.updateStatusFailed'));
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('artist.bookings.title')}</h1>
          <p className="text-gray-400 mt-1">
            {t('artist.bookings.subtitle')}
          </p>
        </div>
        
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#d3da0c] focus:outline-none"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('artist.bookings.stat.total'), value: bookings.length, color: 'text-white' },
          { label: t('artist.bookings.stat.pending'), value: bookings.filter(b => b.status === 'pending').length, color: 'text-yellow-400' },
          { label: t('artist.bookings.stat.accepted'), value: bookings.filter(b => b.status === 'accepted').length, color: 'text-green-400' },
          { label: t('artist.bookings.stat.completed'), value: bookings.filter(b => b.status === 'completed').length, color: 'text-blue-400' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#111111] rounded-xl p-4 border border-white/5"
          >
            <p className="text-gray-400 text-sm">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 bg-[#111111] rounded-xl border border-white/5">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">{t('artist.bookings.noBookings')}</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {t('artist.bookings.noBookingsDescription')}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden"
            >
              {/* Summary Row */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-semibold text-white">{booking.event_name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full border capitalize flex items-center gap-1 ${getStatusClass(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        {booking.status}
                      </span>
                      {booking.payment_status && (
                        <span className={`px-2 py-0.5 text-xs rounded-full border capitalize ${getPaymentStatusClass(booking.payment_status)}`}>
                          {booking.payment_status === 'pending' ? t('artist.bookings.paymentPending') : booking.payment_status}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(booking.event_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {booking.event_city}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ¥{booking.budget.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {booking.duration}h
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {expandedId === booking.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === booking.id && (
                <div className="px-4 pb-4 border-t border-white/5 pt-4">
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{t('artist.bookings.eventDetails')}</h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-white">
                          <span className="text-gray-400">{t('artist.bookings.type')}:</span> {booking.event_type}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">{t('artist.bookings.budget')}:</span> ¥{booking.budget.toLocaleString()}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">{t('artist.bookings.duration')}:</span> {booking.duration} {t('artist.bookings.hours')}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">{t('artist.bookings.location')}:</span> {booking.event_city}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">{t('artist.bookings.paymentStatus')}:</span>{' '}
                          <span className={`capitalize font-medium ${
                            booking.payment_status === 'verified' ? 'text-green-400' :
                            booking.payment_status === 'paid' ? 'text-blue-400' :
                            booking.payment_status === 'rejected' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {booking.payment_status || t('artist.bookings.paymentPending')}
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{t('artist.bookings.contactInfo')}</h4>
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-white">
                          <User className="w-4 h-4 text-gray-400" />
                          {booking.contact_name}
                        </p>
                        <p className="flex items-center gap-2 text-white">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {booking.contact_email}
                        </p>
                        {booking.contact_phone && (
                          <p className="flex items-center gap-2 text-white">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {booking.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {booking.message && (
                    <div className="bg-white/5 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-400 flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        {t('artist.bookings.messageFromOrganizer')}
                      </p>
                      <p className="text-white text-sm">{booking.message}</p>
                    </div>
                  )}

                  {/* Payment Screenshot */}
                  {booking.payment_screenshot_url && (booking.payment_status === 'paid' || booking.payment_status === 'verified') && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">{t('artist.bookings.paymentScreenshot')}</p>
                      <a href={booking.payment_screenshot_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={booking.payment_screenshot_url}
                          alt={t('artist.bookings.paymentScreenshot')}
                          className="max-h-48 rounded-lg border border-white/10 hover:border-[#d3da0c]/50 transition-colors"
                        />
                      </a>
                    </div>
                  )}

                  {/* Awaiting Payment Badge */}
                  {booking.status === 'pending' && booking.payment_status === 'pending' && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-yellow-400 flex items-center gap-2">
                        <Clock3 className="w-4 h-4" />
                        {t('artist.bookings.awaitingPayment')}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {booking.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStatusChange(booking.id, 'accepted')}
                        disabled={actionLoading === booking.id}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        {actionLoading === booking.id ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            {t('artist.bookings.accept')}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleStatusChange(booking.id, 'rejected')}
                        disabled={actionLoading === booking.id}
                        className="flex-1 bg-red-500/20 hover:bg-red-500/30 disabled:bg-red-500/10 text-red-400 border border-red-500/30 py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        {t('artist.bookings.decline')}
                      </button>
                    </div>
                  )}

                  {booking.status === 'accepted' && (
                    <button
                      onClick={() => handleStatusChange(booking.id, 'completed')}
                      disabled={actionLoading === booking.id}
                      className="w-full bg-[#d3da0c] hover:bg-[#d3da0c]/90 text-black py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
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
