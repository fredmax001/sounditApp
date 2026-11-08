/**
 * MobileListRow - Compact thumbnail + text row for "Popular" / list sections
 * Inspired by Eventix Popular section design
 */
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, MapPin, Ticket, Camera } from 'lucide-react';
import type { EventWithDetails } from '@/store/eventStore';
import { getMediaUrl } from '@/lib/appUrl';
import { useState } from 'react';
import { getEntitySlug } from '@/lib/slug';

interface MobileListRowProps {
  event: EventWithDetails;
  index?: number;
}

const MobileListRow = ({ event, index = 0 }: MobileListRowProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const ticketTier = event.ticket_tiers?.[0];
  const price = ticketTier?.price || 0;
  const currency = ticketTier?.currency || 'CNY';

  const now = new Date();
  const eventDate = new Date(event.start_date);
  const eventEndDate = event.end_date ? new Date(event.end_date) : new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);
  const isPast = event.status === 'completed' || (eventEndDate < now && event.status !== 'live');
  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const eventSlug = event.id;

  return (
    <Link to={`/events/${eventSlug}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 active:border-[#d3da0c]/30 transition-colors shadow-xs dark:shadow-none"
      >
        {/* Thumbnail */}
        <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={getMediaUrl(imageFailed ? '/placeholder.jpg' : event.flyer_image || '/placeholder.jpg')}
            alt={event.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => {
              if (!imageFailed) setImageFailed(true);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-[#020b00] dark:text-white font-semibold text-sm leading-tight line-clamp-2 mb-1">
            {event.title}
          </h4>
          {(event.business?.business_name || (event.djs && event.djs.length > 0)) && (
            <p className="text-gray-500 text-[11px] mb-1.5">
              {event.business?.business_name || event.djs?.[0]?.stage_name}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px]">
              <Clock className="w-2.5 h-2.5" />
              {dateStr} · {timeStr}
            </span>
            {event.city && (
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px]">
                <MapPin className="w-2.5 h-2.5" />
                {event.city.replace(/^\w/, (c) => c.toUpperCase())}
              </span>
            )}
          </div>
        </div>

        {/* Price or Ended badge */}
        <div className="flex-shrink-0 text-right">
          {isPast ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400">
              <Camera className="w-2.5 h-2.5 text-[#d3da0c]" />
              <span className="text-[10px] font-bold">Recap</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              price > 0 ? 'bg-[#d3da0c]/10 text-[#d3da0c]' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <Ticket className="w-2.5 h-2.5" />
              <span className="text-[10px] font-bold">
                {price > 0 ? `${currency === 'CNY' ? '¥' : '$'}${price}` : 'Free'}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
};

export default MobileListRow;
