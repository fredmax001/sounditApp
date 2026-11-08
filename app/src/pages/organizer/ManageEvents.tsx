import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit2, Trash2, Eye, Calendar, Users, Loader2, RefreshCw,
  QrCode, X, Share2, Clock, Megaphone, Camera, ChevronLeft, Search,
  MapPin, Ticket, MoreHorizontal
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import type { Event } from '@/store/eventStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { WEB_ORIGIN } from '@/lib/appUrl';
import BroadcastAnnouncementModal from '@/components/BroadcastAnnouncementModal';
import { API_BASE_URL } from '@/config/api';

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'approved':
    case 'live':
      return 'bg-green-500/20 text-green-500';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-500';
    case 'draft':
      return 'bg-gray-500/20 text-gray-400';
    case 'rejected':
    case 'cancelled':
      return 'bg-red-500/20 text-red-500';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
};

const ManageEvents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { events, fetchMyEvents, deleteEvent, updateEvent, isLoading } = useEventStore();
  const [filterPill, setFilterPill] = useState<'all' | 'upcoming' | 'ongoing' | 'past'>(
    (searchParams.get('tab') as any) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null);
  const [broadcastModalEvent, setBroadcastModalEvent] = useState<Event | null>(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [actionMenuEvent, setActionMenuEvent] = useState<any | null>(null);

  const handleFilterChange = (pill: 'all' | 'upcoming' | 'ongoing' | 'past') => {
    setFilterPill(pill);
    if (pill === 'all') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', pill);
    }
    setSearchParams(searchParams);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
      case 'live':
        return t('organizer.manageEvents.statusActive');
      case 'pending':
        return t('organizer.manageEvents.statusPending');
      case 'draft':
        return t('organizer.manageEvents.statusDraft');
      case 'rejected':
        return t('organizer.manageEvents.statusRejected');
      case 'cancelled':
        return t('organizer.manageEvents.statusCancelled');
      default:
        return status;
    }
  };

  const loadEvents = useCallback(async () => {
    try {
      const apiTab = filterPill === 'past' ? 'past' : 'upcoming';
      await fetchMyEvents(apiTab);
    } catch {
      // Fallback handled seamlessly for preview
    }
  }, [fetchMyEvents, filterPill]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvents();
    setIsRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    if (String(id).startsWith('demo-')) {
      toast.success('Event removed from preview');
      setActionMenuEvent(null);
      return;
    }
    if (!confirm(t('organizer.manageEvents.deleteConfirm'))) return;

    setDeletingId(id);
    try {
      await deleteEvent(id);
      toast.success(t('organizer.manageEvents.deleteSuccess'));
      await loadEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('organizer.manageEvents.deleteError');
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setActionMenuEvent(null);
    }
  };

  const handleToggleTicketSales = async (event: Event) => {
    if (String(event.id).startsWith('demo-')) {
      toast.success('Ticket sales status updated');
      setActionMenuEvent(null);
      return;
    }
    const isClosed = Boolean((event as any).ticket_sales_closed);
    const confirmMsg = isClosed
      ? 'Re-open ticket sales for this event?'
      : 'Close ticket sales for this event? Customers will no longer be able to purchase tickets.';
    if (!confirm(confirmMsg)) return;

    try {
      const token = useAuthStore.getState().session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/tickets/events/${event.id}/toggle-sales?closed=${!isClosed}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Ticket sales status updated');
        await loadEvents();
      } else {
        toast.error(data.detail || 'Failed to update ticket sales status');
      }
    } catch {
      toast.error('Failed to update ticket sales status');
    } finally {
      setActionMenuEvent(null);
    }
  };

  const getEventLifecycle = (ev: any): 'upcoming' | 'ongoing' | 'past' => {
    if (ev.lifecycle) return ev.lifecycle;
    const now = Date.now();
    const start = new Date(ev.start_date).getTime();
    const end = ev.end_date ? new Date(ev.end_date).getTime() : start + 5 * 3600 * 1000;
    if (now > end) return 'past';
    if (now >= start && now <= end) return 'ongoing';
    return 'upcoming';
  };

  const rawEvents = events;

  const displayedEvents = rawEvents.filter((ev: any) => {
    const lifecycle = getEventLifecycle(ev);
    const matchesPill = filterPill === 'all' || lifecycle === filterPill;
    const matchesSearch =
      !searchQuery.trim() ||
      (ev.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ev.venue_name || ev.location || ev.city || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPill && matchesSearch;
  });

  const formatEventDate = (ev: any) => {
    if (ev.date_label) return ev.date_label;
    try {
      const d = new Date(ev.start_date);
      const datePart = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timePart = ev.start_time || d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${datePart} · ${timePart}`;
    } catch {
      return ev.start_date;
    }
  };

  return (
    <div className="min-h-screen bg-[#020b00] text-white pb-28">
      {/* Mobile Header matching reference Screen 2 (My Events) */}
      <div className="lg:hidden sticky top-0 z-30 bg-[#020b00]/95 backdrop-blur-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/5">
        <div className="flex items-center justify-between h-11">
          <button
            onClick={() => navigate('/dashboard/business')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[17px] font-bold text-white tracking-tight">My Events</h1>
          <button
            onClick={() => setShowSearch((prev) => !prev)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -mr-1"
            aria-label="Search events"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>

        {showSearch && (
          <div className="mt-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by title or venue..."
                className="w-full bg-[#11150E] border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Pills: All | Upcoming | Ongoing | Past */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'ongoing', label: 'Ongoing' },
              { id: 'past', label: 'Past' },
            ] as const
          ).map((pill) => {
            const active = filterPill === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => handleFilterChange(pill.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                  active
                    ? 'bg-[#d3da0c] text-black shadow-[0_0_12px_rgba(211,218,12,0.3)]'
                    : 'bg-[#11150E] text-gray-300 border border-white/10 hover:border-white/20'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-8 pt-8 mb-6">
        <div>
          <h1 className="text-3xl font-display text-white mb-1">
            My <span className="text-[#d3da0c]">Events</span>
          </h1>
          <p className="text-gray-400 text-sm">{t('organizer.manageEvents.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBroadcastModalEvent(null);
              setIsBroadcastOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium rounded-xl hover:bg-amber-500/20 transition-colors text-sm"
          >
            <Megaphone className="w-4 h-4" />
            <span>Send Broadcast</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t('organizer.manageEvents.refresh')}</span>
          </button>
          <Link
            to="/dashboard/business/create-event"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#d3da0c] text-black font-bold rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('organizer.manageEvents.createEvent')}
          </Link>
        </div>
      </div>

      {/* Desktop Filter Pills */}
      <div className="hidden lg:flex items-center gap-2 px-8 mb-6">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'ongoing', label: 'Ongoing' },
            { id: 'past', label: 'Past' },
          ] as const
        ).map((pill) => (
          <button
            key={pill.id}
            onClick={() => handleFilterChange(pill.id)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              filterPill === pill.id
                ? 'bg-[#d3da0c] text-black'
                : 'bg-[#11150E] text-gray-300 border border-white/10 hover:border-white/20'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Mobile Cards List matching reference Screen 2 */}
      <div className="lg:hidden px-4 pt-3 space-y-3.5">
        {isLoading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin mb-3" />
            <p className="text-gray-400 text-sm">Loading events...</p>
          </div>
        ) : displayedEvents.length === 0 ? (
          <div className="bg-[#11150E] border border-white/10 rounded-2xl p-8 text-center my-4">
            <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-white font-bold text-base mb-1">No events found</p>
            <p className="text-gray-400 text-xs mb-5">
              Create your next event to start selling tickets and growing your audience.
            </p>
            <Link
              to="/dashboard/business/create-event"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d3da0c] text-black font-bold text-xs rounded-xl"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </Link>
          </div>
        ) : (
          displayedEvents.map((event: any) => {
            const lifecycle = getEventLifecycle(event);
            const soldCount = event.tickets_sold ?? 0;
            const attendingCount = event.attending_count ?? Math.max(soldCount, (event.rsvp_count || 0) + soldCount);
            const badgeStyle =
              lifecycle === 'upcoming'
                ? 'bg-[#d3da0c] text-black'
                : lifecycle === 'ongoing'
                ? 'bg-[#80ed12] text-black'
                : 'bg-white/20 text-white';
            const badgeText =
              lifecycle === 'upcoming'
                ? 'Upcoming'
                : lifecycle === 'ongoing'
                ? 'Ongoing'
                : 'Past';

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden flex shadow-lg"
              >
                {/* Left Flyer Image */}
                <div
                  onClick={() =>
                    String(event.id).startsWith('demo-')
                      ? navigate('/events')
                      : navigate(`/events/${event.id}`)
                  }
                  className="w-32 sm:w-36 shrink-0 relative cursor-pointer bg-black/40"
                >
                  <img
                    src={event.flyer_image || '/event_placeholder.jpg'}
                    alt={event.title}
                    className="w-full h-full object-cover min-h-[136px]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                    }}
                  />
                </div>

                {/* Right Event Content */}
                <div className="flex-1 p-3.5 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-tight ${badgeStyle}`}>
                        {badgeText}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActionMenuEvent(event)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Event options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <h3
                      onClick={() =>
                        String(event.id).startsWith('demo-')
                          ? navigate('/events')
                          : navigate(`/events/${event.id}`)
                      }
                      className="text-[16px] font-bold text-white leading-tight truncate cursor-pointer mb-1.5"
                    >
                      {event.title}
                    </h3>

                    <div className="space-y-1 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
                        <span className="truncate">{formatEventDate(event)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
                        <span className="truncate">{event.venue_name || event.location || event.city || 'Shanghai'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Sold & Attending Stats */}
                  <div className="flex items-center gap-4 pt-2.5 mt-2.5 border-t border-white/8 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-[#d3da0c]" />
                      <span>
                        <strong className="text-white font-bold">{soldCount}</strong>{' '}
                        <span className="text-gray-400">Sold</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        <strong className="text-white font-bold">{attendingCount}</strong>{' '}
                        <span className="text-gray-400">{lifecycle === 'past' ? 'Attended' : 'Attending'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block px-8">
        <div className="bg-[#11150E] rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">{t('organizer.manageEvents.eventHeader')}</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">{t('organizer.manageEvents.dateHeader')}</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">{t('organizer.manageEvents.ticketsSoldHeader')}</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm">{t('organizer.manageEvents.statusHeader')}</th>
                <th className="text-right px-6 py-4 text-gray-400 font-medium text-sm">{t('organizer.manageEvents.actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayedEvents.map((event: any) => (
                <tr key={event.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={event.flyer_image || '/event_placeholder.jpg'}
                        alt={event.title}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                        }}
                      />
                      <div>
                        <p className="text-white font-semibold">{event.title}</p>
                        <p className="text-gray-400 text-xs">{event.venue_name || event.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#d3da0c]" />
                      {formatEventDate(event)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#d3da0c]" />
                      {event.tickets_sold || 0}/{event.capacity || t('organizer.manageEvents.unlimited')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 text-xs rounded-full ${getStatusBadgeClass(event.status)}`}>
                      {getStatusLabel(event.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setActionMenuEvent(event)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white font-medium"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Quick Actions Sheet */}
      <AnimatePresence>
        {actionMenuEvent && (
          <div
            className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setActionMenuEvent(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#11150E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] space-y-2"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white">{actionMenuEvent.title}</h3>
                  <p className="text-xs text-gray-400">{formatEventDate(actionMenuEvent)}</p>
                </div>
                <button
                  onClick={() => setActionMenuEvent(null)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    const id = actionMenuEvent.id;
                    setActionMenuEvent(null);
                    if (String(id).startsWith('demo-')) {
                      navigate('/dashboard/business/create-event');
                    } else {
                      navigate(`/dashboard/business/events/${id}/edit`);
                    }
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-[#d3da0c] text-black font-bold text-xs"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Event</span>
                </button>
                <button
                  onClick={() => {
                    const id = actionMenuEvent.id;
                    setActionMenuEvent(null);
                    if (String(id).startsWith('demo-')) {
                      navigate('/events');
                    } else {
                      navigate(`/events/${id}`);
                    }
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-xs"
                >
                  <Eye className="w-4 h-4 text-[#d3da0c]" />
                  <span>View Public Page</span>
                </button>
                <button
                  onClick={() => {
                    setActionMenuEvent(null);
                    navigate('/dashboard/business/gallery');
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-xs"
                >
                  <Camera className="w-4 h-4 text-[#d3da0c]" />
                  <span>Photos & Cloud</span>
                </button>
                <button
                  onClick={() => {
                    const ev = actionMenuEvent;
                    setActionMenuEvent(null);
                    setBroadcastModalEvent(ev);
                    setIsBroadcastOpen(true);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-xs"
                >
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Broadcast Update</span>
                </button>
                {!String(actionMenuEvent.id).startsWith('demo-') && (
                  <button
                    onClick={() => {
                      const id = actionMenuEvent.id;
                      setActionMenuEvent(null);
                      navigate(`/dashboard/business/events/${id}/promoters`);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-xs"
                  >
                    <Share2 className="w-4 h-4 text-[#d3da0c]" />
                    <span>Promoters</span>
                  </button>
                )}
                <button
                  onClick={() => handleToggleTicketSales(actionMenuEvent)}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium text-xs"
                >
                  <Clock className="w-4 h-4 text-[#d3da0c]" />
                  <span>{actionMenuEvent.ticket_sales_closed ? 'Reopen Sales' : 'Close Sales'}</span>
                </button>
              </div>

              {actionMenuEvent.status === 'draft' && !String(actionMenuEvent.id).startsWith('demo-') && (
                <button
                  onClick={async () => {
                    try {
                      await updateEvent(actionMenuEvent.id, { status: 'approved' });
                      toast.success(t('organizer.manageEvents.publishSuccess'));
                      setActionMenuEvent(null);
                      await loadEvents();
                    } catch {
                      toast.error('Failed to publish event');
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Publish Event Now
                </button>
              )}

              <button
                onClick={() => handleDelete(actionMenuEvent.id)}
                disabled={deletingId === actionMenuEvent.id}
                className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-2 mt-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Event</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      {qrModalEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setQrModalEvent(null)}
        >
          <div
            className="bg-[#11150E] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{qrModalEvent.title}</h3>
              <button
                onClick={() => setQrModalEvent(null)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white rounded-xl p-4">
                <img src={qrModalEvent.qr_code} alt="Event QR" className="w-48 h-48" />
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrModalEvent.share_url || `${WEB_ORIGIN}/events/${qrModalEvent.id}`);
                  toast.success('Link copied');
                }}
                className="w-full py-3 bg-[#d3da0c] text-black rounded-xl font-bold"
              >
                Copy Event Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Announcement Modal */}
      <BroadcastAnnouncementModal
        isOpen={isBroadcastOpen}
        onClose={() => {
          setIsBroadcastOpen(false);
          setBroadcastModalEvent(null);
        }}
        eventId={broadcastModalEvent?.id}
        eventTitle={broadcastModalEvent?.title}
      />
    </div>
  );
};

export default ManageEvents;
