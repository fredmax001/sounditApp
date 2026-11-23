import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Calendar, Search, Check, X, Star, Trash2, MapPin,
  Loader2, Clock, Users
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data || []);
      }
    } catch {
      toast.error(t('admin.manageEvents.failedToLoadEvents'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageEvents.eventApproved'));
        loadEvents();
      }
    } catch {
      toast.error(t('admin.manageEvents.failedToApproveEvent'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t('admin.manageEvents.enterRejectionReason'));
    if (!reason) return;
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        toast.success(t('admin.manageEvents.eventRejected'));
        loadEvents();
      }
    } catch {
      toast.error(t('admin.manageEvents.failedToRejectEvent'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFeature = async (event: EventItem) => {
    setActionLoading(`feature-${event.id}`);
    try {
      const isFeatured = event.is_featured;
      const url = `${API_BASE_URL}/admin/events/${event.id}/feature`;
      const res = await fetch(url, {
        method: isFeatured ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        toast.success(isFeatured
          ? (t('admin.manageEvents.eventUnfeatured') || 'Event unfeatured')
          : (t('admin.manageEvents.eventFeatured') || 'Event featured')
        );
        loadEvents();
      } else {
        const err = await res.json();
        toast.error(err.detail || t('admin.manageEvents.failedToUpdateFeatureStatus'));
      }
    } catch {
      toast.error(t('admin.manageEvents.failedToUpdateFeatureStatus'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.manageEvents.confirmDelete'))) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageEvents.eventDeleted'));
        loadEvents();
      }
    } catch {
      toast.error(t('admin.manageEvents.failedToDeleteEvent'));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || 
      event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.city?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader chip="Management" title={t('admin.manageEvents.title')} subtitle={t('admin.manageEvents.subtitle')} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c] rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageEvents.totalEvents')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">{events.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageEvents.pending')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {events.filter(e => e.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">{t('admin.manageEvents.approved')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {events.filter(e => e.status === 'approved' || e.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageEvents.featured')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {events.filter(e => e.is_featured).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageEvents.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-[#0F140D] border border-black/10 dark:border-[#1F261E] rounded-xl text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
        >
          <option value="" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.manageEvents.allStatus')}</option>
          <option value="pending" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.manageEvents.statusPending')}</option>
          <option value="approved" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.manageEvents.statusApproved')}</option>
          <option value="completed" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">Completed</option>
          <option value="rejected" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.manageEvents.statusRejected')}</option>
          <option value="draft" className="bg-white dark:bg-[#0F140D] text-[#020b00] dark:text-white">{t('admin.manageEvents.statusDraft')}</option>
        </select>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <AnimatePresence>
            {filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <img
                    src={event.flyer_image || '/placeholder-event.jpg'}
                    alt={event.title}
                    className="w-full sm:w-24 h-48 sm:h-24 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[#020b00] dark:text-white font-bold text-base truncate">{event.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600 dark:text-[#9CA3AF] text-xs sm:text-sm mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-[#d3da0c]" /> {event.city}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {new Date(event.start_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-[#d3da0c]" /> {event.attendees_count ?? (event as any).tickets_sold ?? 0} {t('admin.manageEvents.attendees')}
                          </span>
                        </div>
                        <p className="text-gray-500 dark:text-[#9CA3AF] text-xs sm:text-sm mt-2 font-medium truncate">
                          {t('admin.manageEvents.by')} {event.business_name || (event as any).organizer_name || 'Sound It Partner'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {event.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(event.id)}
                              disabled={actionLoading === `approve-${event.id}`}
                              className="p-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl hover:bg-green-500/20 transition-colors"
                            >
                              {actionLoading === `approve-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleReject(event.id)}
                              disabled={actionLoading === `reject-${event.id}`}
                              className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                            >
                              {actionLoading === `reject-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleFeature(event)}
                          disabled={actionLoading === `feature-${event.id}`}
                          className={`p-2 rounded-xl transition-colors ${event.is_featured ? 'bg-[#d3da0c]/20 text-yellow-700 dark:text-[#d3da0c]' : 'bg-neutral-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-neutral-200 dark:hover:bg-white/10'}`}
                        >
                          {actionLoading === `feature-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${event.is_featured ? 'fill-current' : ''}`} />}
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          disabled={actionLoading === `delete-${event.id}`}
                          className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                        >
                          {actionLoading === `delete-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        event.status === 'approved' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                        event.status === 'completed' ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#22C55E]' :
                        event.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                        event.status === 'rejected' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                        'bg-black/5 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400'
                      }`}>
                        {event.status}
                      </span>
                      {event.is_featured && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-400">
                          {t('admin.manageEvents.featuredBadge')}
                        </span>
                      )}
                    </div>
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

export default ManageEvents;
