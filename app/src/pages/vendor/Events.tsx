import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';
import { useTranslation } from 'react-i18next';
import {
  Calendar, ArrowLeft, Loader2, MapPin, Plus, X
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface VendorEvent {
  id: number;
  name?: string;
  event_name?: string;
  date?: string;
  event_date?: string;
  booth?: string;
  booth_number?: string;
  capacity?: number;
  status?: string;
  description?: string;
}

const VendorEvents = () => {
  useSubscriptionGuard('event_booths');
  const { session } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [events, setEvents] = useState<VendorEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendorEvents = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/vendors/events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data || []);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || t('vendor.events.loadError'));
        setEvents([]);
      }
    } catch {
      setError(t('vendor.events.loadNetworkError'));
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (session?.access_token) {
      fetchVendorEvents(session.access_token);
    }
  }, [session, fetchVendorEvents]);

  const handleCancelApplication = async (eventId: number) => {
    if (!session?.access_token) {
      toast.error(t('vendor.events.notAuthenticated'));
      return;
    }

    if (!confirm(t('vendor.events.cancelConfirm'))) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/vendors/events/${eventId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success(t('vendor.events.cancelSuccess'));
        fetchVendorEvents(session.access_token);
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || t('vendor.events.cancelError'));
      }
    } catch {
      toast.error(t('vendor.events.networkError'));
    }
  };

  const handleApplyForBooth = () => {
    navigate('/events');
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'approved': return t('vendor.events.statusApproved');
      case 'rejected': return t('vendor.events.statusRejected');
      default: return t('vendor.events.statusPending');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">{t('vendor.events.title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('vendor.events.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={handleApplyForBooth}
          className="flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black rounded-lg font-bold hover:bg-[#bbc10b] transition-all"
        >
          <Plus className="w-4 h-4" />
          {t('vendor.events.applyForBooth')}
        </button>
      </div>

      {/* Events List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#111111] border border-white/10 rounded-2xl p-6"
      >
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : events.length > 0 ? (
          <div className="grid gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white/[0.02] border border-white/5 rounded-xl p-6 hover:border-[#d3da0c]/30 transition-all"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h4 className="text-white font-bold text-lg mb-2">
                      {event.name || event.event_name || t('vendor.events.unnamedEvent')}
                    </h4>
                    <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-[#d3da0c]" />
                        {event.date || event.event_date || t('vendor.events.tbd')}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-[#d3da0c]" />
                        {t('vendor.events.boothLabel', { booth: event.booth || event.booth_number || t('vendor.events.tbd') })}
                      </span>
                      {event.capacity && (
                        <span>{t('vendor.events.capacityLabel', { capacity: event.capacity })}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${event.status === 'approved'
                        ? 'bg-green-500/20 text-green-400'
                        : event.status === 'rejected'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}
                  >
                    {getStatusLabel(event.status)}
                  </span>
                </div>

                {event.description && (
                  <p className="text-gray-400 text-sm mb-4">{event.description}</p>
                )}

                {event.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleCancelApplication(event.id)}
                      className="px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all text-sm"
                    >
                      <X className="w-3 h-3 inline mr-2" />
                      {t('vendor.events.cancelApplication')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Calendar className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t('vendor.events.noEventsTitle')}</h3>
            <p className="text-gray-400 max-w-md mb-6">
              {t('vendor.events.noEventsDescription')}
            </p>
            <button
              onClick={handleApplyForBooth}
              className="flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black rounded-lg font-bold hover:bg-[#bbc10b] transition-all"
            >
              <Plus className="w-4 h-4" />
              {t('vendor.events.browseEvents')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default VendorEvents;
