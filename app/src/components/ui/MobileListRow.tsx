/**
 * MobileListRow — Compact thumbnail + text row for "Popular" / list sections
 * Inspired by Eventix Popular section design
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, MapPin, Ticket } from 'lucide-react';
import type { EventWithDetails } from '@/store/eventStore';

interface MobileListRowProps {
  event: EventWithDetails;
  index?: number;
}

const MobileListRow = ({ event, index = 0 }: MobileListRowProps) => {
  const ticketTier = event.ticket_tiers?.[0];
  const price = ticketTier?.price || 0;
  const currency = ticketTier?.currency || 'CNY';

  const eventDate = new Date(event.start_date);
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Link to={`/events/${event.id}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 p-3 rounded-2xl bg-[#111111] border border-white/5 active:border-[#d3da0c]/30 transition-colors"
      >
        {/* Thumbnail */}
        <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={event.flyer_image || '/hero-event.jpg'}
            alt={event.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm leading-tight line-clamp-2 mb-1">
            {event.title}
          </h4>
          {(event.business?.business_name || (event.djs && event.djs.length > 0)) && (
            <p className="text-gray-500 text-[11px] mb-1.5">
              {event.business?.business_name || event.djs?.[0]?.stage_name}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-gray-400 text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {dateStr} · {timeStr}
            </span>
            {event.city && (
              <span className="flex items-center gap-1 text-gray-400 text-[10px]">
                <MapPin className="w-2.5 h-2.5" />
                {event.city}
              </span>
            )}
          </div>
        </div>

        {/* Price badge */}
        <div className="flex-shrink-0 text-right">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
            price > 0 ? 'bg-[#d3da0c]/10 text-[#d3da0c]' : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            <Ticket className="w-2.5 h-2.5" />
            <span className="text-[10px] font-bold">
              {price > 0 ? `${currency === 'CNY' ? '¥' : '$'}${price}` : 'Free'}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default MobileListRow;
