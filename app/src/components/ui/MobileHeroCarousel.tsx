/**
 * MobileHeroCarousel — Full-width swipeable hero event cards
 * Auto-advancing with pagination dots, inspired by Eventix recommended section
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Clock, MapPin, Loader2 } from 'lucide-react';
import type { EventWithDetails } from '@/store/eventStore';
import { useEventStore } from '@/store/eventStore';
import { toast } from 'sonner';

interface MobileHeroCarouselProps {
  events: EventWithDetails[];
  autoAdvanceMs?: number;
}

const MobileHeroCarousel = ({ events, autoAdvanceMs = 4500 }: MobileHeroCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const { savedEvents, saveEvent, unsaveEvent } = useEventStore();
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visibleEvents = events.slice(0, 5);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % visibleEvents.length);
  }, [visibleEvents.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + visibleEvents.length) % visibleEvents.length);
  }, [visibleEvents.length]);

  useEffect(() => {
    if (visibleEvents.length <= 1) return;
    timerRef.current = setInterval(goNext, autoAdvanceMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goNext, autoAdvanceMs, visibleEvents.length]);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (visibleEvents.length > 1) {
      timerRef.current = setInterval(goNext, autoAdvanceMs);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = (touchStartX.current || 0) - (touchEndX.current || 0);
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }
      resetTimer();
    }
  };

  const handleSave = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(eventId);
    const isSaved = savedEvents.some((ev) => String(ev.id) === eventId);
    try {
      if (isSaved) {
        await unsaveEvent(eventId);
      } else {
        await saveEvent(eventId);
      }
    } catch {
      toast.error('Failed to save event');
    } finally {
      setSaving(null);
    }
  };

  if (!visibleEvents.length) return null;

  const event = visibleEvents[currentIndex];
  const ticketTier = event.ticket_tiers?.[0];
  const price = ticketTier?.price || 0;
  const currency = ticketTier?.currency || 'CNY';
  const eventDate = new Date(event.start_date);
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const isSaved = savedEvents.some((ev) => String(ev.id) === String(event.id));
  const isSavingCurrent = saving === String(event.id);

  return (
    <div className="relative">
      <Link to={`/events/${event.id}`}>
        <div
          className="relative h-[240px] w-full overflow-hidden rounded-2xl mx-4"
          style={{ width: 'calc(100% - 2rem)' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Background image with cross-fade */}
          <AnimatePresence mode="popLayout">
            <motion.img
              key={event.id}
              src={event.flyer_image || '/hero-event.jpg'}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.5 }}
              loading="lazy"
            />
          </AnimatePresence>

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />

          {/* Top row */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
            {/* Organizer pill */}
            {(event.business?.business_name || (event.djs && event.djs.length > 0)) && (
              <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 border border-white/10">
                <div className="w-4 h-4 rounded-full bg-[#d3da0c] flex items-center justify-center">
                  <span className="text-[6px] text-black font-bold">DJ</span>
                </div>
                <span className="text-white text-[10px] font-medium truncate max-w-[100px]">
                  {event.business?.business_name || event.djs?.[0]?.stage_name}
                </span>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={(e) => handleSave(e, String(event.id))}
              disabled={!!saving}
              className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${
                isSaved
                  ? 'bg-[#FF2D8F] border-[#FF2D8F]/50 text-white'
                  : 'bg-black/50 border-white/20 text-white/80'
              }`}
            >
              {isSavingCurrent ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              )}
            </button>
          </div>

          {/* Featured badge */}
          {event.is_featured && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
              <span className="px-2.5 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold rounded-full uppercase tracking-wide">Featured</span>
            </div>
          )}

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="text-white font-bold text-base leading-snug line-clamp-2 mb-2">
                  {event.title}
                </h3>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-gray-300 text-[11px]">
                    <Clock className="w-3 h-3 text-[#d3da0c]" />
                    {dateStr} · {timeStr}
                  </span>
                  {event.city && (
                    <span className="flex items-center gap-1 text-gray-300 text-[11px]">
                      <MapPin className="w-3 h-3 text-[#d3da0c]" />
                      {event.city}
                    </span>
                  )}
                  <span className={`ml-auto font-bold text-[11px] ${price > 0 ? 'text-[#d3da0c]' : 'text-emerald-400'}`}>
                    {price > 0 ? `${currency === 'CNY' ? '¥' : '$'}${price}` : 'Free'}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Link>

      {/* Pagination dots */}
      {visibleEvents.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {visibleEvents.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentIndex(i);
                resetTimer();
              }}
              className={`transition-all duration-300 rounded-full ${
                i === currentIndex
                  ? 'w-5 h-1.5 bg-[#d3da0c]'
                  : 'w-1.5 h-1.5 bg-white/25'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileHeroCarousel;
