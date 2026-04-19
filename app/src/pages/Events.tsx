import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, Filter, ChevronDown } from 'lucide-react';
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

      const matchesCategory =
        !selectedCategory || event.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20 lg:pt-24">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('events.title')}
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            {t('events.subtitle')}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8 sticky top-16 lg:top-20 bg-[#0A0A0A]/95 backdrop-blur-md z-30 border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder={t('events.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#d3da0c]/50"
              />
            </div>

            {/* Category Filter */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-[#141414] border border-white/10 rounded-xl text-white hover:border-white/20 transition-colors"
            >
              <Filter className="w-5 h-5" />
              <span>{t('events.filters')}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''
                  }`}
              />
            </button>
          </div>

          {/* Category Pills */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!selectedCategory
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-[#141414] text-white/70 hover:text-white border border-white/10'
                  }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat.name
                    ? 'bg-[#d3da0c] text-black'
                    : 'bg-[#141414] text-white/70 hover:text-white border border-white/10'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-white/50 text-lg">
                No events found matching your criteria
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                }}
                className="mt-4 text-[#d3da0c] hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="group bg-[#141414] rounded-2xl overflow-hidden border border-white/5 hover:border-[#d3da0c]/30 transition-all"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={event.flyer_image || '/placeholder_event.jpg'}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-[#d3da0c] text-black text-xs font-semibold rounded-full">
                        {event.category || 'Event'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#d3da0c] transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-white/50 text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-4 text-white/50 text-sm mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(event.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {event.venue?.name || event.city}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <span className="text-[#d3da0c] font-semibold text-lg">
                        {/* We use the first ticket tier price if available */}
                        {event.ticket_tiers && event.ticket_tiers.length > 0
                          ? `${event.ticket_tiers[0].currency} ${event.ticket_tiers[0].price}`
                          : 'Free'}
                      </span>
                      {event.capacity && (
                        <span className="text-white/40 text-sm">
                          {event.capacity - (event.tickets_sold || 0)} tickets left
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
