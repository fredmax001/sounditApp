import { Link } from 'react-router-dom';
import { Calendar, MapPin, Clock } from 'lucide-react';
interface CompactEventCardProps {
  event: any;
}

const CompactEventCard = ({ event }: CompactEventCardProps) => {
  return (
    <Link
      to={`/events/${event.id}`}
      className="flex gap-3 p-2 bg-[#1A1A1A] border border-white/5 rounded-xl hover:bg-[#222] transition-colors active:scale-[0.98] touch-feedback mb-2"
    >
      <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0">
        <img
          src={event.flyer_url || event.flyer_image || '/placeholder-event.jpg'}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        {event.ticket_tiers?.[0]?.price && (
          <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#d3da0c]">
            {event.ticket_tiers[0].currency} {event.ticket_tiers[0].price}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center flex-1 min-w-0 py-1">
        <h3 className="text-sm font-bold text-white leading-tight mb-1.5 truncate">
          {event.title}
        </h3>
        
        <div className="space-y-1">
          <div className="flex items-center text-gray-400 text-[11px]">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-[#d3da0c]/70 shrink-0" />
            <span className="truncate">{new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          
          <div className="flex items-center text-gray-400 text-[11px]">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-[#d3da0c]/70 shrink-0" />
            <span className="truncate">{new Date(event.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="flex items-center text-gray-400 text-[11px]">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#d3da0c]/70 shrink-0" />
            <span className="truncate">{event.venue?.name || event.city || 'TBA'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CompactEventCard;
