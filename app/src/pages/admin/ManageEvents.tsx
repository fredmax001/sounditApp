import { useState, useEffect } from 'react';
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

  const handleFeature = async (id: number) => {
    setActionLoading(`feature-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${id}/feature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_featured: true })
      });
      if (res.ok) {
        toast.success(t('admin.manageEvents.eventFeaturedStatusUpdated'));
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
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Delete failed');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageEvents.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageEvents.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Calendar className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageEvents.totalEvents')}</p>
              <p className="text-white font-bold text-xl">{events.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageEvents.pending')}</p>
              <p className="text-white font-bold text-xl">
                {events.filter(e => e.status === 'pending').length}
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
              <p className="text-gray-400 text-xs">{t('admin.manageEvents.approved')}</p>
              <p className="text-white font-bold text-xl">
                {events.filter(e => e.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Star className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageEvents.featured')}</p>
              <p className="text-white font-bold text-xl">
                {events.filter(e => e.is_featured).length}
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
            placeholder={t('admin.manageEvents.searchPlaceholder')}
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
          <option value="">{t('admin.manageEvents.allStatus')}</option>
          <option value="pending">{t('admin.manageEvents.statusPending')}</option>
          <option value="approved">{t('admin.manageEvents.statusApproved')}</option>
          <option value="rejected">{t('admin.manageEvents.statusRejected')}</option>
          <option value="draft">{t('admin.manageEvents.statusDraft')}</option>
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
                className="bg-[#111111] border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={event.flyer_image || '/placeholder-event.jpg'}
                    alt={event.title}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-semibold">{event.title}</h3>
                        <div className="flex items-center gap-4 text-gray-400 text-sm mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {event.city}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {new Date(event.start_date).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" /> {event.attendees_count || 0} {t('admin.manageEvents.attendees')}
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm mt-2">{t('admin.manageEvents.by')} {event.business_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(event.id)}
                              disabled={actionLoading === `approve-${event.id}`}
                              className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20"
                            >
                              {actionLoading === `approve-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleReject(event.id)}
                              disabled={actionLoading === `reject-${event.id}`}
                              className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                            >
                              {actionLoading === `reject-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleFeature(event.id)}
                          disabled={actionLoading === `feature-${event.id}`}
                          className={`p-2 rounded-lg ${event.is_featured ? 'bg-[#d3da0c]/20 text-[#d3da0c]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                          {actionLoading === `feature-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${event.is_featured ? 'fill-current' : ''}`} />}
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          disabled={actionLoading === `delete-${event.id}`}
                          className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                        >
                          {actionLoading === `delete-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        event.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        event.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {event.status}
                      </span>
                      {event.is_featured && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
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
