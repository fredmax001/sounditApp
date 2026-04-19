import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Eye, Calendar, Users, Loader2, AlertCircle, RefreshCw, ArrowRight, Building2, QrCode, X } from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import type { Event } from '@/store/eventStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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
  const { events, fetchMyEvents, deleteEvent, updateEvent, isLoading, error } = useEventStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null);

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
      await fetchMyEvents();
    } catch {
      console.error('Failed to load events');
      toast.error(t('organizer.manageEvents.loadErrorToast'));
    }
  }, [fetchMyEvents, t]);

  // Fetch events on mount
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvents();
    setIsRefreshing(false);
  };

  const handleEdit = (event: Event) => {
    navigate(`/dashboard/business/events/${event.id}/edit`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('organizer.manageEvents.deleteConfirm'))) return;

    setDeletingId(id);
    try {
      await deleteEvent(id);
      toast.success(t('organizer.manageEvents.deleteSuccess'));
      // Refresh the events list after deletion
      await loadEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
      const msg = error instanceof Error ? error.message : t('organizer.manageEvents.deleteError');
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Check if error is related to organizer/business profile requirement
  const isOrganizerError = error && (
    error.toLowerCase().includes('organizer access required') ||
    error.toLowerCase().includes('business profile') ||
    error.toLowerCase().includes('organizer profile') ||
    error.toLowerCase().includes('not an organizer')
  );

  // Loading state
  if (isLoading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin mb-4" />
        <p className="text-gray-400">{t('organizer.manageEvents.loading')}</p>
      </div>
    );
  }

  // Error state - Organizer access required
  if (error && isOrganizerError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <Building2 className="w-16 h-16 text-yellow-500 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2 text-center">{t('organizer.manageEvents.businessProfileRequiredTitle')}</h3>
        <p className="text-gray-400 mb-2 text-center max-w-md">
          {t('organizer.manageEvents.businessProfileRequiredDesc')}
        </p>
        {error && (
          <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 mb-6 mt-2">
            <p className="text-gray-500 text-sm">{t('organizer.manageEvents.errorDetail', { error })}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard/business"
            className="flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black rounded-lg font-semibold hover:bg-[#bbc10b] transition-colors"
          >
            {t('organizer.manageEvents.setupBusinessProfile')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={loadEvents}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('organizer.manageEvents.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Error state - General error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2 text-center">{t('organizer.manageEvents.loadErrorTitle')}</h3>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 mt-2 max-w-md">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={loadEvents}
            className="flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black rounded-lg font-semibold hover:bg-[#bbc10b] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('organizer.manageEvents.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-display text-white mb-2">
            {t('organizer.manageEvents.titlePrefix')} <span className="text-[#d3da0c]">{t('organizer.manageEvents.titleHighlight')}</span>
          </h1>
          <p className="text-gray-400">{t('organizer.manageEvents.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('organizer.manageEvents.refresh')}</span>
          </button>
          <Link
            to="/dashboard/business/create-event"
            className="flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('organizer.manageEvents.createEvent')}
          </Link>
        </div>
      </motion.div>

      {/* Events Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">{t('organizer.manageEvents.eventHeader')}</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">{t('organizer.manageEvents.dateHeader')}</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">{t('organizer.manageEvents.ticketsSoldHeader')}</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">{t('organizer.manageEvents.statusHeader')}</th>
                <th className="text-right px-6 py-4 text-gray-400 font-medium">{t('organizer.manageEvents.actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => (
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
                        <p className="text-white font-medium">{event.title}</p>
                        <p className="text-gray-500 text-sm capitalize">{event.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-4 h-4 text-[#d3da0c]" />
                      {new Date(event.start_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-400">
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
                      <Link
                        to={`/events/${event.id}`}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        title={t('organizer.manageEvents.viewEventTooltip')}
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {event.status === 'draft' && (
                        <button
                          onClick={async () => {
                            if (confirm(t('organizer.manageEvents.publishConfirm'))) {
                              try {
                                await updateEvent(event.id, { status: 'approved' });
                                toast.success(t('organizer.manageEvents.publishSuccess'));
                                await loadEvents();
                              } catch (error) {
                                const msg = error instanceof Error ? error.message : t('organizer.manageEvents.publishError');
                                toast.error(msg);
                              }
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center text-[#d3da0c] hover:bg-[#d3da0c]/20 transition-colors"
                          title={t('organizer.manageEvents.publishEventTooltip')}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      {event.qr_code && (
                        <button
                          onClick={() => setQrModalEvent(event)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-[#d3da0c] hover:bg-white/10 transition-colors"
                          title="View QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        to={`/dashboard/business/events/${event.id}/edit`}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        title={t('organizer.manageEvents.editEventTooltip')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={deletingId === event.id}
                        className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        title={t('organizer.manageEvents.deleteEventTooltip')}
                      >
                        {deletingId === event.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State */}
          {events.length === 0 && (
            <div className="text-center py-16">
              <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">{t('organizer.manageEvents.noEvents')}</p>
              <p className="text-gray-500 text-sm mb-6">{t('organizer.manageEvents.noEventsDesc')}</p>
              <Link
                to="/organizer/create-event"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
              >
                <Plus className="w-5 h-5" />
                {t('organizer.manageEvents.createEvent')}
              </Link>
            </div>
          )}
        </div>
      </motion.div>


      {/* QR Code Modal */}
      {qrModalEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setQrModalEvent(null)}
        >
          <div
            className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{qrModalEvent.title}</h3>
              <button
                onClick={() => setQrModalEvent(null)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white rounded-xl p-4">
                <img src={qrModalEvent.qr_code} alt="Event QR" className="w-48 h-48" />
              </div>
              <a
                href={qrModalEvent.qr_code}
                download={`event-${qrModalEvent.id}-qr.png`}
                className="w-full py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors text-center"
              >
                Download QR Code
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrModalEvent.share_url || `${window.location.origin}/events/${qrModalEvent.id}`);
                  toast.success('Link copied');
                }}
                className="w-full py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Copy Event Link
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManageEvents;
