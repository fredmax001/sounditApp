/**
 * MobileEventCard — Cinematic full-bleed card for mobile home/discover
 * Inspired by Eventix design: large image, gradient overlay, bold text
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Clock, MapPin, Loader2, Users } from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import type { EventWithDetails } from '@/store/eventStore';
import { toast } from 'sonner';

interface MobileEventCardProps {
  event: EventWithDetails;
  /** 'featured' = tall hero-style card | 'standard' = medium card for horizontal scroll */
  variant?: 'featured' | 'standard';
  className?: string;
}

const MobileEventCard = ({ event, variant = 'standard', className = '' }: MobileEventCardProps) => {
  const { savedEvents, saveEvent, unsaveEvent } = useEventStore();
  const [isSaving, setIsSaving] = useState(false);
  const isSaved = savedEvents.some((e) => String(e.id) === String(event.id));

  const ticketTier = event.ticket_tiers?.[0];
  const price = ticketTier?.price || 0;
  const currency = ticketTier?.currency || 'CNY';
  const allTiersSoldOut =
    event.ticket_tiers && event.ticket_tiers.length > 0
      ? event.ticket_tiers.every((t) => t.status === 'sold_out' || (t.quantity_sold || 0) >= (t.quantity || 0))
      : false;
  const isSoldOut = ((event.tickets_sold || 0) >= (event.capacity || 1) && (event.capacity || 0) > 0) || allTiersSoldOut;

  const eventDate = new Date(event.start_date);
  const dayStr = eventDate.toLocaleDateString('en-US', { weekday: 'short' });
  const monthStr = eventDate.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = eventDate.getDate();
  const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaving(true);
    try {
      if (isSaved) {
        await unsaveEvent(String(event.id));
      } else {
        await saveEvent(String(event.id));
      }
    } catch {
      toast.error('Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const isFeatured = variant === 'featured';

  return (
    <Link to={`/events/${event.id}`} className={`block ${className}`}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className={`relative overflow-hidden rounded-2xl ${
          isFeatured ? 'h-[240px] w-full' : 'h-[200px] w-[220px] flex-shrink-0'
        }`}
      >
        {/* Background image */}
        <img
          src={event.flyer_image || '/hero-event.jpg'}
          alt={event.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />

        {/* Top row: Date pill + Save button */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
          {/* Date badge */}
          <div className="bg-black/60 backdrop-blur-md rounded-xl px-2.5 py-1.5 text-center border border-white/10">
            <div className="text-[#d3da0c] text-[9px] font-bold uppercase tracking-wider leading-none">{dayStr} · {monthStr}</div>
            <div className="text-white text-sm font-bold leading-tight">{dayNum}</div>
          </div>

          {/* Save / heart */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all active:scale-90 ${
              isSaved
                ? 'bg-[#FF2D8F] border-[#FF2D8F]/60 text-white'
                : 'bg-black/50 border-white/20 text-white/80'
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            )}
          </button>
        </div>

        {/* Badges */}
        {(event.is_featured || isSoldOut) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {event.is_featured && !isSoldOut && (
              <span className="px-2 py-0.5 bg-[#d3da0c] text-black text-[9px] font-bold rounded-full">FEATURED</span>
            )}
            {isSoldOut && (
              <span className="px-2 py-0.5 bg-[#FF2D8F] text-white text-[9px] font-bold rounded-full">SOLD OUT</span>
            )}
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          {/* Organizer */}
          {(event.business?.business_name || (event.djs && event.djs.length > 0)) && (
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded-full bg-[#d3da0c]/20 border border-[#d3da0c]/40 flex items-center justify-center">
                <Users className="w-2.5 h-2.5 text-[#d3da0c]" />
              </div>
              <span className="text-gray-300 text-[10px] font-medium">
                {event.business?.business_name || event.djs?.[0]?.stage_name}
              </span>
            </div>
          )}

          {/* Title */}
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 mb-1.5">
            {event.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-gray-300/80 text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {timeStr}
            </span>
            {event.city && (
              <span className="flex items-center gap-1 text-gray-300/80 text-[10px]">
                <MapPin className="w-2.5 h-2.5" />
                {event.city}
              </span>
            )}
            <span className={`ml-auto text-[10px] font-semibold ${price > 0 ? 'text-[#d3da0c]' : 'text-emerald-400'}`}>
              {price > 0 ? `${currency === 'CNY' ? '¥' : '$'}${price}` : 'Free'}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default MobileEventCard;
