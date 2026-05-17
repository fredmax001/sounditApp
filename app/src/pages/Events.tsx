import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, MapPin, Filter, ChevronDown, Ticket, Heart, Clock } from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { categories } from '@/data/constants';

export default function Events() {
  const { t } = useTranslation();
  const { events, fetchEvents } = useEventStore();
  const { selectedCity } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchEvents({ city: selectedCity });
  }, [fetchEvents, selectedCity]);

  const filteredEvents = useMemo(() => {
    return (events || []).filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.venue?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.category?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = !selectedCategory || event.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
    }),
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-28">
      {/* Hero Header */}
      <div className="relative px-5 pt-6 pb-6 overflow-hidden">
        <div className="absolute inset-0 mesh-gradient-premium opacity-50" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#d3da0c]/10 rounded-full blur-[80px]" />
        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block px-3 py-1 glass-pill-premium text-[#d3da0c] text-xs font-medium mb-3">
              {t('events.tagline') || 'Discover'}
            </span>
            <h1 className="text-3xl font-bold text-white mb-2">{t('events.title')}</h1>
            <p className="text-gray-400 text-sm max-w-md">{t('events.subtitle')}</p>
          </motion.div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-5 pb-4 sticky top-0 z-30 py-3 -mx-0" style={{
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder={t('events.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-input pl-12 pr-4 py-3 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2.5 glass-pill-premium text-gray-300 text-sm font-medium active:scale-95 transition-transform"
            >
              <Filter className="w-4 h-4" />
              <span>{t('events.filters')}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {!showFilters && (
              <div className="flex-1 overflow-x-auto hide-scrollbar">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      !selectedCategory ? 'bg-[#d3da0c] text-black' : 'glass-pill-premium text-gray-400'
                    }`}
                  >
                    All
                  </button>
                  {categories.slice(0, 4).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                        selectedCategory === cat.name ? 'bg-[#d3da0c] text-black' : 'glass-pill-premium text-gray-400'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${!selectedCategory ? 'bg-[#d3da0c] text-black' : 'glass-pill-premium text-gray-400'}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${selectedCategory === cat.name ? 'bg-[#d3da0c] text-black' : 'glass-pill-premium text-gray-400'}`}
                >
                  {cat.name}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Events List */}
      <div className="px-5 pt-4 space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 glass-card-premium rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-lg mb-2">No events found</p>
            <p className="text-gray-600 text-sm mb-4">Try adjusting your search or filters</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
              className="px-6 py-2.5 bg-[#d3da0c] text-black font-semibold rounded-full text-sm"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredEvents.map((event, index) => {
            const eventDate = new Date(event.start_date);
            return (
              <motion.div
                key={event.id}
                custom={index}
                initial="hidden"
                animate="visible"
                variants={sectionVariants}
              >
                <Link
                  to={`/events/${event.id}`}
                  className="group block glass-card-premium overflow-hidden active:scale-[0.98] transition-transform"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <img
                      src={event.flyer_image || '/placeholder_event.jpg'}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 glass-pill-premium text-[#d3da0c] text-xs font-semibold">
                        {event.category || 'Event'}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <div className="glass-strong px-3 py-1.5 rounded-xl text-center min-w-[3rem]">
                        <div className="text-[#d3da0c] text-xs font-bold leading-tight">
                          {eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </div>
                        <div className="text-white text-sm font-bold leading-tight">{eventDate.getDate()}</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-white mb-1.5 group-hover:text-[#d3da0c] transition-colors line-clamp-1">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-3 text-gray-400 text-xs mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {event.venue?.name || event.city}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {eventDate.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-[#d3da0c] font-bold text-sm flex items-center gap-1">
                        <Ticket className="w-3.5 h-3.5" />
                        {event.ticket_tiers?.[0]?.price
                          ? `${event.ticket_tiers[0].currency} ${event.ticket_tiers[0].price}`
                          : 'Free'}
                      </span>
                      {event.capacity && event.show_remaining_tickets !== false && (
                        <span className="text-gray-500 text-xs">{event.capacity - (event.tickets_sold || 0)} left</span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
