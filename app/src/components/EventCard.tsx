import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, ArrowRight, Heart, Loader2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EventWithDetails } from '@/store/eventStore';
import { useEventStore } from '@/store/eventStore';

import { toast } from 'sonner';

interface EventCardProps {
  event: EventWithDetails;
  variant?: 'default' | 'compact' | 'trending';
}

const EventCard = ({ event, variant = 'default' }: EventCardProps) => {
  const { t } = useTranslation();
  const isCompact = variant === 'compact';
  const isTrending = variant === 'trending';
  const { savedEvents, saveEvent, unsaveEvent, fetchSavedEvents } = useEventStore();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSavedEvents();
  }, [fetchSavedEvents]);

  useEffect(() => {
    setIsSaved(savedEvents.some((e) => String(e.id) === String(event.id)));
  }, [savedEvents, event.id]);

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    try {
      if (isSaved) {
        await unsaveEvent(String(event.id));
        setIsSaved(false);
      } else {
        await saveEvent(String(event.id));
        setIsSaved(true);
      }
    } catch {
      toast.error(t('eventCard.saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const ticketTier = event.ticket_tiers?.[0];
  const price = ticketTier?.price || 0;
  const currency = ticketTier?.currency || 'CNY';
  const capacity = event.capacity || 0;
  const ticketsSold = event.tickets_sold || 0;
  const isSoldOut = ticketsSold >= capacity && capacity > 0;

  const eventDate = new Date(event.start_date);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Trending variant — tall cinematic card
  if (isTrending) {
    return (
      <Link to={`/events/${event.id}`}>
        <motion.div
          whileHover={{ y: -4 }}
          className="group relative h-[360px] rounded-2xl overflow-hidden glass-card-premium"
        >
          <img
            src={event.flyer_image || '/placeholder_event.jpg'}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {event.is_featured && (
              <span className="px-2.5 py-1 bg-[#d3da0c] text-black text-[10px] font-bold rounded-full">
                {t('eventCard.featured')}
              </span>
            )}
            {isSoldOut && (
              <span className="px-2.5 py-1 bg-[#FF2D8F] text-white text-[10px] font-bold rounded-full">
                {t('eventCard.soldOut')}
              </span>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSaveToggle}
            disabled={isLoading}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-10 ${
              isSaved ? 'bg-[#FF2D8F] text-white' : 'bg-black/40 text-white hover:bg-[#FF2D8F]/80'
            } disabled:opacity-50`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />}
          </button>

          {/* Date pill */}
          <div className="absolute top-3 right-14 glass-strong px-2.5 py-1 rounded-lg text-center">
            <div className="text-[#d3da0c] text-[10px] font-bold leading-tight">
              {eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
            </div>
            <div className="text-white text-sm font-bold leading-tight">{eventDate.getDate()}</div>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-base mb-1.5 line-clamp-1 group-hover:text-[#d3da0c] transition-colors">
              {event.title}
            </h3>
            <div className="flex items-center gap-3 text-gray-300 text-xs mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeStr}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {event.city}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#d3da0c] font-bold text-sm">
                {price > 0 ? `${currency === 'CNY' ? '¥' : '$'}${price}` : 'Free'}
              </span>
              {capacity > 0 && (
                <span className="text-gray-400 text-[10px]">{capacity - ticketsSold} left</span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    );
  }

  // Default / Compact variant
  return (
    <Link to={`/events/${event.id}`}>
      <motion.div
        whileHover={{ y: -5 }}
        className={`group relative bg-[#111111] rounded-2xl overflow-hidden border border-white/5 hover:border-[#d3da0c]/30 transition-all duration-300 ${isCompact ? 'h-full' : ''}`}
      >
        <div className={`relative overflow-hidden ${isCompact ? 'h-36 md:h-40' : 'h-44 md:h-56'}`}>
          <img
            src={event.flyer_image || '/placeholder_event.jpg'}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent" />

          {event.is_featured && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-[#d3da0c] text-black text-xs font-semibold rounded-full">
              {t('eventCard.featured')}
            </div>
          )}

          <button
            onClick={handleSaveToggle}
            disabled={isLoading}
            className={`absolute top-3 right-3 md:top-4 md:right-4 w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-10 ${
              isSaved ? 'bg-pink-500 text-white' : 'bg-black/40 text-white hover:bg-pink-500/80'
            } disabled:opacity-50`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />}
          </button>

          {isSoldOut && (
            <div className="absolute top-3 right-16 md:top-4 md:right-16 px-3 py-1.5 bg-[#FF2D8F] text-white text-xs font-semibold rounded-full">
              {t('eventCard.soldOut')}
            </div>
          )}

          <div className="absolute bottom-3 right-3 md:bottom-4 md:right-4 px-3 md:px-4 py-1.5 md:py-2 glass rounded-lg">
            <span className="text-[#d3da0c] font-bold">{currency === 'CNY' ? '¥' : '$'}{price}</span>
            <span className="text-gray-400 text-sm ml-1">{currency}</span>
          </div>
        </div>

        <div className={`p-5 ${isCompact ? 'p-4' : ''}`}>
          <h3 className={`font-semibold text-white group-hover:text-[#d3da0c] transition-colors mb-3 ${isCompact ? 'text-lg' : 'text-xl'}`}>
            {event.title}
          </h3>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Calendar className="w-4 h-4 text-[#d3da0c]" />
              <span>{dateStr}</span>
              <span className="text-gray-600">•</span>
              <span>{timeStr}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <MapPin className="w-4 h-4 text-[#d3da0c]" />
              <span>{event.address || event.venue?.name || 'TBA'}</span>
              <span className="text-gray-600">•</span>
              <span>{event.city}</span>
            </div>
            {!isCompact && capacity > 0 && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users className="w-4 h-4 text-[#d3da0c]" />
                <span>{ticketsSold} / {capacity} {t('eventCard.attending')}</span>
              </div>
            )}
          </div>

          {!isCompact && event.djs && event.djs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {event.djs.slice(0, 3).map((dj) => (
                <span key={dj.id} className="px-2 py-1 bg-white/5 text-gray-400 text-xs rounded">
                  {dj.stage_name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[#d3da0c] text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              {t('eventCard.getTickets')} <ArrowRight className="w-4 h-4" />
            </span>
            {!isCompact && event.djs && event.djs.length > 0 && (
              <div className="flex -space-x-2">
                {event.djs.slice(0, 3).map((dj) => (
                  <img
                    key={dj.id}
                    src={dj.avatar_url || '/default-avatar.png'}
                    alt={dj.stage_name}
                    className="w-8 h-8 rounded-full border-2 border-[#111111] object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default EventCard;
