import { useState, useEffect, useCallback } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Calendar, Search, Check, X, Star, Trash2, MapPin,
  Loader2, Clock, Users, RefreshCw
} from 'lucide-react';

interface EventItem {
  id: number;
  title: string;
  city?: string;
  status: string;
  is_featured?: boolean;
  flyer_image?: string;
  start_date: string;
  attendees_count?: number;
  business_name?: string;
}

const ManageEvents = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error(t('admin.manageEvents.failedToLoadEvents') || 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token, t]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        toast.success('Event approved');
        loadEvents();
      }
    } catch {
      toast.error('Failed to approve event');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t('admin.manageEvents.enterRejectionReason') || 'Enter rejection reason:');
    if (!reason) return;
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        toast.success('Event rejected');
        loadEvents();
      }
    } catch {
      toast.error('Failed to reject event');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFeature = async (event: EventItem) => {
    setActionLoading(`feature-${event.id}`);
    try {
      const isFeatured = Boolean(event.is_featured);
      const res = await fetch(`${API_BASE_URL}/admin/events/${event.id}/feature`, {
        method: isFeatured ? 'DELETE' : 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        toast.success(isFeatured ? 'Event unfeatured' : 'Event featured');
        loadEvents();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to update featured status');
      }
    } catch {
      toast.error('Failed to update featured status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.manageEvents.confirmDelete') || 'Delete this event?')) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        toast.success('Event deleted');
        loadEvents();
      }
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setActionLoading(null);
    }
  };

  const norm = (s?: string) => (s || '').toLowerCase();

  const filteredEvents = events.filter((event) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (event.title || '').toLowerCase().includes(q) ||
      (event.city || '').toLowerCase().includes(q) ||
      (event.business_name || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || norm(event.status) === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const statusPill = (status: string) => {
    const s = norm(status);
    if (s === 'approved' || s === 'completed') return 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20';
    if (s === 'pending') return 'bg-amber-500/12 text-amber-400 border-amber-500/20';
    if (s === 'rejected' || s === 'cancelled') return 'bg-red-500/12 text-red-400 border-red-500/20';
    return 'bg-white/[0.06] text-gray-300 border-white/[0.08]';
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        chip="Directory & Events"
        title="Events"
        subtitle="Approve, feature, and manage published events across all cities"
        actions={
          <button
            onClick={loadEvents}
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
            <span className="text-xs text-gray-500 dark:text-gray-400">Total Events</span>
            <Calendar className="w-4 h-4 text-[#d3da0c]" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">{events.length}</p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">
            {events.filter((e) => norm(e.status) === 'pending').length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Approved / Completed</span>
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">
            {events.filter((e) => ['approved', 'completed'].includes(norm(e.status))).length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Featured</span>
            <Star className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl text-[#020b00] dark:text-white tabular-nums">
            {events.filter((e) => e.is_featured).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search events by title, city, or organizer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white placeholder-gray-500 focus:border-[#d3da0c]/60 focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-white dark:bg-[#0D130D] border border-black/10 dark:border-white/[0.08] rounded-xl text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]/60"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Events Data Table */}
      <div className="bg-white dark:bg-[#0D130D] border border-black/8 dark:border-white/[0.08] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">No events match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/8 dark:border-white/[0.08]">
                <tr>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Event</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Organizer</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">City & Date</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Attendees</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5">Status</th>
                  <th className="text-gray-500 text-[0.6875rem] uppercase tracking-wider px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 dark:divide-white/[0.06]">
                {filteredEvents.map((event) => {
                  const s = norm(event.status);
                  return (
                    <tr key={event.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={event.flyer_image || '/placeholder-event.jpg'}
                            alt={event.title}
                            className="w-11 h-11 rounded-lg object-cover shrink-0 bg-white/5"
                          />
                          <div className="min-w-0">
                            <p className="text-sm text-[#020b00] dark:text-white truncate max-w-xs">{event.title}</p>
                            {event.is_featured && (
                              <span className="inline-block text-[0.6875rem] text-[#d3da0c] mt-0.5">Featured</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-300 whitespace-nowrap">
                        {event.business_name || '-'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-500" />
                          <span className="tabular-nums">
                            {event.start_date ? new Date(event.start_date).toLocaleDateString() : '-'}
                          </span>
                        </div>
                        {event.city && (
                          <div className="flex items-center gap-1.5 text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span className="capitalize">{event.city}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-300 tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-gray-500" />
                          {event.attendees_count || 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-md border text-xs capitalize ${statusPill(event.status)}`}>
                          {s}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {s === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(event.id)}
                                disabled={actionLoading === `approve-${event.id}`}
                                className="p-2 rounded-lg bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                title="Approve"
                              >
                                {actionLoading === `approve-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleReject(event.id)}
                                disabled={actionLoading === `reject-${event.id}`}
                                className="p-2 rounded-lg bg-red-500/12 text-red-400 hover:bg-red-500/20 transition-colors"
                                title="Reject"
                              >
                                {actionLoading === `reject-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleFeature(event)}
                            disabled={actionLoading === `feature-${event.id}`}
                            className={`p-2 rounded-lg transition-colors ${
                              event.is_featured
                                ? 'bg-[#d3da0c]/15 text-[#d3da0c]'
                                : 'bg-white/[0.04] text-gray-400 hover:text-[#d3da0c]'
                            }`}
                            title={event.is_featured ? 'Unfeature' : 'Feature'}
                          >
                            {actionLoading === `feature-${event.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Star className="w-4 h-4" fill={event.is_featured ? 'currentColor' : 'none'} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            disabled={actionLoading === `delete-${event.id}`}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            title="Delete"
                          >
                            {actionLoading === `delete-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
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

export default ManageEvents;
