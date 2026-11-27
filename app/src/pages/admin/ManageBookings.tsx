import { useState, useEffect, useCallback } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Ticket, Search, Check, Clock, Calendar, User,
  Loader2, MapPin, DollarSign, RefreshCw, X
} from 'lucide-react';

interface Booking {
  id: number;
  event_name?: string;
  requester_name?: string;
  artist_name?: string;
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
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/bookings`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error(t('admin.manageBookings.failedToLoadBookings') || 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token, t]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const updateStatus = async (id: number, status: string, reason?: string) => {
    setActionLoading(`${status.toLowerCase()}-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/bookings/${id}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status.toLowerCase(), reason }),
      });
      if (res.ok) {
        toast.success(`Booking ${status.toLowerCase()}`);
        loadBookings();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to update booking');
      }
    } catch {
      toast.error('Failed to update booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = (id: number) => updateStatus(id, 'accepted');
  const handleReject = (id: number) => {
    const reason = prompt(t('admin.manageBookings.enterRejectionReason') || 'Enter rejection reason:');
    if (!reason) return;
    updateStatus(id, 'rejected', reason);
  };
  const handleCancel = (id: number) => {
    if (!confirm(t('admin.manageBookings.confirmCancelBooking') || 'Cancel this booking?')) return;
    updateStatus(id, 'cancelled');
  };

  const norm = (s?: string) => (s || '').toLowerCase();

  const pendingCount = bookings.filter((b) => norm(b.status) === 'pending').length;
  const acceptedCount = bookings.filter((b) => ['accepted', 'confirmed', 'completed'].includes(norm(b.status))).length;
  const totalValue = bookings.reduce((acc, b) => acc + (b.agreed_price || b.budget || 0), 0);

  const filteredBookings = bookings.filter((booking) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (booking.event_name || '').toLowerCase().includes(q) ||
      (booking.requester_name || '').toLowerCase().includes(q) ||
      (booking.artist_name || '').toLowerCase().includes(q) ||
      (booking.event_city || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || norm(booking.status) === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const statusPill = (status: string) => {
    const s = norm(status);
    if (s === 'accepted' || s === 'confirmed' || s === 'completed') {
      return 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20';
    }
    if (s === 'pending') return 'bg-amber-500/12 text-amber-400 border-amber-500/20';
    if (s === 'rejected' || s === 'cancelled') return 'bg-red-500/12 text-red-400 border-red-500/20';
    return 'bg-white/[0.06] text-gray-300 border-white/[0.08]';
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Directory & Events"
        title="Bookings"
        subtitle="Review artist booking requests, status progression, and agreed fees"
        actions={
          <button
            onClick={loadBookings}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#d3da0c] text-black rounded-lg hover:bg-[#c0c70b] disabled:opacity-60 transition-colors text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Bookings</span>
            <Ticket className="w-4 h-4 text-[#d3da0c]" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{bookings.length}</p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Accepted / Confirmed</span>
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{acceptedCount}</p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Value</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">¥{totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by event, requester, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white placeholder-gray-500 focus:border-[#d3da0c]/60 focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c]/60 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Bookings Data Table */}
      <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">No bookings match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/8 dark:border-white/[0.08]">
                <tr>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Event</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Requester</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Date & City</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Fee / Budget</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Status</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/[0.06]">
                {filteredBookings.map((booking) => {
                  const s = norm(booking.status);
                  return (
                    <tr key={booking.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-[#020b00] dark:text-white">
                          {booking.event_name || 'Untitled Event'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[booking.duration_hours ? `${booking.duration_hours} hrs` : null, booking.event_type].filter(Boolean).join(' · ') || '-'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-300">
                          <User className="w-3.5 h-3.5 text-gray-500" />
                          <span>{booking.requester_name || 'Unknown'}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-500" />
                          <span className="tabular-nums">
                            {booking.event_date ? new Date(booking.event_date).toLocaleDateString() : 'TBD'}
                          </span>
                        </div>
                        {booking.event_city && (
                          <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span className="capitalize">{booking.event_city}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-[#020b00] dark:text-white tabular-nums">
                        ¥{(booking.agreed_price || booking.budget || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-md border text-xs capitalize ${statusPill(booking.status)}`}>
                          {s}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {s === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(booking.id)}
                                disabled={actionLoading === `accepted-${booking.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20 text-xs transition-colors"
                              >
                                {actionLoading === `accepted-${booking.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={() => handleReject(booking.id)}
                                disabled={actionLoading === `rejected-${booking.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/12 text-red-400 hover:bg-red-500/20 text-xs transition-colors"
                              >
                                {actionLoading === `rejected-${booking.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                          {(s === 'accepted' || s === 'confirmed') && (
                            <button
                              onClick={() => handleCancel(booking.id)}
                              disabled={actionLoading === `cancelled-${booking.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-xs transition-colors"
                            >
                              {actionLoading === `cancelled-${booking.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageBookings;
