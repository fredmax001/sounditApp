import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Ticket, Search, Check, Clock, Calendar, User,
  Loader2, MapPin, DollarSign
} from 'lucide-react';

interface Booking {
  id: number;
  event_name?: string;
  requester_name?: string;
  status: string;
  event_date?: string;
  agreed_price?: number;
  budget?: number;
  event_city?: string;
  duration_hours?: number;
  event_type?: string;
}

const ManageBookings = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/bookings`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      }
    } catch {
      toast.error(t('admin.manageBookings.failedToLoadBookings'));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string, reason?: string) => {
    setActionLoading(`${status.toLowerCase()}-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/bookings/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, reason })
      });
      if (res.ok) {
        toast.success(`${t('admin.manageBookings.booking')} ${status.toLowerCase()}`);
        loadBookings();
      } else {
        const err = await res.json();
        toast.error(err.detail || t('admin.manageBookings.failedToUpdateBooking'));
      }
    } catch {
      toast.error(t('admin.manageBookings.failedToUpdateBooking'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = (id: number) => updateStatus(id, 'ACCEPTED');

  const handleReject = (id: number) => {
    const reason = prompt(t('admin.manageBookings.enterRejectionReason'));
    if (!reason) return;
    updateStatus(id, 'REJECTED', reason);
  };

  const handleCancel = (id: number) => {
    if (!confirm(t('admin.manageBookings.confirmCancelBooking'))) return;
    updateStatus(id, 'CANCELLED');
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = !searchQuery ||
      booking.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.requester_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || booking.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageBookings.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageBookings.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Ticket className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBookings.totalBookings')}</p>
              <p className="text-white font-bold text-xl">{bookings.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBookings.pending')}</p>
              <p className="text-white font-bold text-xl">
                {bookings.filter(b => b.status === 'PENDING').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBookings.accepted')}</p>
              <p className="text-white font-bold text-xl">
                {bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'CONFIRMED').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBookings.totalValue')}</p>
              <p className="text-white font-bold text-xl">
                ¥{bookings.reduce((acc, b) => acc + (b.agreed_price || b.budget || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageBookings.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.manageBookings.allStatus')}</option>
          <option value="pending">{t('admin.manageBookings.statusPending')}</option>
          <option value="accepted">{t('admin.manageBookings.statusAccepted')}</option>
          <option value="confirmed">{t('admin.manageBookings.statusConfirmed')}</option>
          <option value="completed">{t('admin.manageBookings.statusCompleted')}</option>
          <option value="rejected">{t('admin.manageBookings.statusRejected')}</option>
          <option value="cancelled">{t('admin.manageBookings.statusCancelled')}</option>
        </select>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <AnimatePresence>
            {filteredBookings.map((booking) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#111111] border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#d3da0c] to-green-500 rounded-xl flex items-center justify-center">
                      <Ticket className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{booking.event_name || t('admin.manageBookings.untitledEvent')}</h3>
                      <div className="flex items-center gap-4 text-gray-400 text-sm mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" /> {booking.requester_name || t('admin.manageBookings.unknown')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> {booking.event_date ? new Date(booking.event_date).toLocaleDateString() : t('admin.manageBookings.tbd')}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" /> ¥{(booking.agreed_price || booking.budget || 0).toLocaleString()}
                        </span>
                        {booking.event_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {booking.event_city}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mt-2">
                        {booking.duration_hours ? `${booking.duration_hours} ${t('admin.manageBookings.hrs')}` : ''} {booking.event_type ? `• ${booking.event_type}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(booking.id)}
                          disabled={actionLoading === `accepted-${booking.id}`}
                          className="px-3 py-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 text-sm font-medium"
                        >
                          {actionLoading === `accepted-${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.manageBookings.approve')}
                        </button>
                        <button
                          onClick={() => handleReject(booking.id)}
                          disabled={actionLoading === `rejected-${booking.id}`}
                          className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 text-sm font-medium"
                        >
                          {actionLoading === `rejected-${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.manageBookings.reject')}
                        </button>
                      </>
                    )}
                    {(booking.status === 'ACCEPTED' || booking.status === 'CONFIRMED') && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        disabled={actionLoading === `cancelled-${booking.id}`}
                        className="px-3 py-2 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 text-sm font-medium"
                      >
                        {actionLoading === `cancelled-${booking.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.manageBookings.cancel')}
                      </button>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'ACCEPTED' || booking.status === 'CONFIRMED' ? 'bg-green-500/20 text-green-400' :
                      booking.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                      booking.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                      booking.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ManageBookings;
