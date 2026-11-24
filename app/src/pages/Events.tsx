import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  X,
  SlidersHorizontal,
  Check,
  Camera,
  Heart,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { chinaCities } from '@/data/constants';
import type { DateFilter } from '@/components/ui/MobileFilterPills';
import { getEntitySlug } from '@/lib/slug';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { toast } from 'sonner';

export default function Events() {
  const navigate = useNavigate();
  const { events, fetchEvents, fetchPastEvents, savedEvents, fetchSavedEvents, saveEvent, unsaveEvent } = useEventStore();
  const { selectedCity, setSelectedCity, isAuthenticated } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [draftCity, setDraftCity] = useState(selectedCity || 'all');
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilter>('all');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftFreeOnly, setDraftFreeOnly] = useState(false);
  const [draftSortBy, setDraftSortBy] = useState<'relevance' | 'date'>('relevance');

  const isEventSaved = (eventId: string | number) =>
    savedEvents.some((e) => String(e.id) === String(eventId));

  const toggleSaveEvent = async (e: React.MouseEvent, eventId: string | number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentlySaved = isEventSaved(eventId);
    try {
      if (currentlySaved) {
        toast.success('Removed from Favorites');
        await unsaveEvent(String(eventId));
      } else {
        toast.success('Added to Favorites');
        await saveEvent(String(eventId));
      }
    } catch {
      toast.error('Please log in to save favorite events');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSavedEvents();
    }
  }, [isAuthenticated, fetchSavedEvents]);

  useEffect(() => {
    const cityParam = selectedCity && selectedCity !== 'all' ? selectedCity : undefined;
    if (dateFilter === 'past') {
      fetchPastEvents(cityParam);
    } else if (dateFilter === 'all') {
      fetchEvents({ city: cityParam, includePast: true });
    } else {
      fetchEvents({ city: cityParam });
    }
  }, [dateFilter, fetchEvents, fetchPastEvents, selectedCity]);

  const filteredEvents = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    let result = (events || []).filter((event) => {
      const matchesSearch =
        !q ||
        event.title.toLowerCase().includes(q) ||
        (event.venue?.name || '').toLowerCase().includes(q) ||
        (event.category?.toLowerCase().includes(q) ?? false);

      const matchesCategory =
        !selectedCategory ||
        (event.category || '').toLowerCase().includes(selectedCategory.toLowerCase());

      const now = new Date();
      const eventDate = new Date(event.start_date);
      const eventEnd = event.end_date ? new Date(event.end_date) : new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);

      // Exclude cancelled or rejected events
      if (event.status === 'cancelled' || event.status === 'rejected') {
        return false;
      }

      const isCompleted = event.status === 'completed' || (eventEnd < now && event.status !== 'live');

      let matchesDate = true;
      if (dateFilter === 'current') {
        const isToday = eventDate.toDateString() === now.toDateString();
        const isLiveNow = eventDate <= now && eventEnd >= now;
        matchesDate = (isToday || isLiveNow || event.status === 'live') && !isCompleted;
      } else if (dateFilter === 'upcoming') {
        const isToday = eventDate.toDateString() === now.toDateString();
        matchesDate = eventDate > now && !isToday && !isCompleted;
      } else if (dateFilter === 'past') {
        matchesDate = isCompleted;
      } else {
        // 'all' displays all non-cancelled events (active/upcoming sorted first, then past)
        matchesDate = true;
      }

      let matchesFree = true;
      if (freeOnly) {
        const price = event.ticket_tiers?.[0]?.price || 0;
        matchesFree = price === 0;
      }

      return matchesSearch && matchesCategory && matchesDate && matchesFree;
    });

    if (sortBy === 'date') {
      const nowMs = Date.now();
      result = [...result].sort((a, b) => {
        if (dateFilter === 'past') {
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        }
        if (dateFilter === 'all') {
          const aDone = a.status === 'completed' || new Date(a.end_date || a.start_date).getTime() < nowMs;
          const bDone = b.status === 'completed' || new Date(b.end_date || b.start_date).getTime() < nowMs;
          if (aDone !== bDone) return aDone ? 1 : -1;
          return aDone
            ? new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
            : new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        }
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });
    }

    return result;
  }, [events, debouncedSearch, selectedCategory, dateFilter, freeOnly, sortBy]);

  const formatEventDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Upcoming';
    const d = new Date(dateStr);
    const dayPart = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dayPart} • ${timePart}`;
  };

  const featuredEvent = filteredEvents[0];
  const moreEvents = filteredEvents.slice(1);

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-28 transition-colors duration-200">
      {/* Top Filter Pills & Search Controls */}
      <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/5 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 md:py-4">
          {/* Collapsible Search Input */}
          {(showSearchBar || searchQuery) && (
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex-1 flex items-center gap-2.5 h-10 px-3.5 bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 rounded-xl">
                <Search className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events, artists, venues..."
                  className="flex-1 bg-transparent text-[#020b00] dark:text-white placeholder-gray-500 text-sm focus:outline-none"
                  inputMode="search"
                  autoCorrect="off"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1">
                    <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Filter Pills Row matching Reference Visual: All Events | Current | Upcoming | Past */}
          <div className="flex items-center gap-2 w-full min-w-0">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
              {[
                { id: 'all', label: 'All Events' },
                { id: 'current', label: 'Current' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'past', label: 'Past' },
              ].map((pill) => {
                const active = dateFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setDateFilter(pill.id as DateFilter)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                      active
                        ? 'bg-[#d3da0c] text-black shadow-sm'
                        : 'bg-neutral-100 dark:bg-[#0d140a] text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSearchBar(!showSearchBar)}
                aria-label="Search events"
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                  showSearchBar || searchQuery
                    ? 'bg-[#d3da0c] text-black border-[#d3da0c]'
                    : 'bg-neutral-100 dark:bg-[#0d140a] text-gray-700 dark:text-gray-300 border-black/10 dark:border-white/10'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftCity(selectedCity || 'all');
                  setDraftDateFilter(dateFilter);
                  setDraftCategory(selectedCategory);
                  setDraftFreeOnly(freeOnly);
                  setDraftSortBy(sortBy);
                  setShowFilterModal(true);
                }}
                aria-label="Open filter options"
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                  selectedCategory || freeOnly || (selectedCity && selectedCity !== 'all')
                    ? 'bg-[#d3da0c] text-black border-[#d3da0c]'
                    : 'bg-neutral-100 dark:bg-[#0d140a] text-gray-700 dark:text-gray-300 border-black/10 dark:border-white/10'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Secondary Filter Chips */}
          {(selectedCategory || freeOnly || (selectedCity && selectedCity !== 'all')) && (
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-2">
              {selectedCity && selectedCity !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#d3da0c] text-black text-xs font-bold">
                  {chinaCities.find((c) => c.id === selectedCity)?.name || selectedCity}
                  <button onClick={() => setSelectedCity('all')} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#d3da0c]/20 text-[#d3da0c] border border-[#d3da0c]/30 text-xs font-bold">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory('')} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {freeOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  Free
                  <button onClick={() => setFreeOnly(false)} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Main Events Content matching Reference Visual */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
        {dateFilter === 'past' && (
          <Link
            to="/recaps"
            className="flex items-center justify-between p-3.5 mb-4 rounded-2xl bg-[#0d140a] border border-[#d3da0c]/30 hover:border-[#d3da0c] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#d3da0c] text-black flex items-center justify-center font-bold">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <div className="text-white font-bold text-sm">Event Photos & Videos</div>
                <p className="text-gray-400 text-xs">Browse highlights and recaps from past events</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#d3da0c]" />
          </Link>
        )}

        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-white font-semibold text-base mb-1">
              {dateFilter === 'past' ? 'No past events found' : 'No events found'}
            </p>
            <p className="text-gray-400 text-xs mb-4">
              {dateFilter === 'past'
                ? 'Check out our Recaps gallery for photos and highlights'
                : 'Try changing your date or category filters'}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('all');
                  setSelectedCategory('');
                  setFreeOnly(false);
                }}
                className="px-5 py-2 bg-[#d3da0c] text-black text-xs font-bold rounded-full"
              >
                Reset filters
              </button>
              {dateFilter === 'past' && (
                <Link
                  to="/recaps"
                  className="px-5 py-2 bg-white/10 text-white text-xs font-bold rounded-full flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  View Recaps
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Featured Event Hero Card (Matches Reference Visual) */}
            {featuredEvent && (
              <div
                onClick={() => navigate(`/events/${getEntitySlug(featuredEvent)}`)}
                className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0d140a] mb-5 cursor-pointer group shadow-xl active:scale-[0.99] transition-transform"
              >
                <div className="relative h-56 sm:h-72 overflow-hidden">
                  <img
                    src={
                      featuredEvent.flyer_image ||
                      featuredEvent.banner_url ||
                      featuredEvent.cover_image ||
                      '/web-hero/C48A0775.jpg'
                    }
                    alt={featuredEvent.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      if (!el.dataset.fallback) {
                        el.dataset.fallback = '1';
                        el.src = '/web-hero/C48A0775.jpg';
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d140a] via-black/45 to-black/20" />

                  {/* Top Left Featured Badge */}
                  <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-md">
                    {dateFilter === 'past' ? 'Past Event' : 'Featured'}
                  </span>

                  {/* Top Right Heart / Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleSaveEvent(e, featuredEvent.id)}
                    aria-label="Save event to favorites"
                    className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#d3da0c] active:scale-90 transition-transform"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isEventSaved(featuredEvent.id) ? 'fill-[#d3da0c] text-[#d3da0c]' : 'text-[#d3da0c]'
                      }`}
                    />
                  </button>

                  {/* Overlaid Event Title & Metadata */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h2 className="text-white font-display font-extrabold text-2xl sm:text-3xl uppercase tracking-tight leading-tight mb-2">
                      {featuredEvent.title}
                    </h2>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-gray-200 text-xs font-medium">
                        <Calendar className="w-3.5 h-3.5 text-[#d3da0c] flex-shrink-0" />
                        <span>{formatEventDateTime(featuredEvent.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300 text-xs font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[#d3da0c] flex-shrink-0" />
                        <span className="truncate">
                          {featuredEvent.venue?.name ||
                            featuredEvent.venue_name ||
                            featuredEvent.city_name ||
                            'Shanghai'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* More Events Horizontal Cards Section (Matches Reference Visual) */}
            {moreEvents.length > 0 && (
              <div>
                <h3 className="text-[#020b00] dark:text-white font-bold text-base tracking-tight mb-3">
                  More Events
                </h3>
                <div className="flex flex-col md:grid md:grid-cols-2 gap-3">
                  {moreEvents.map((event) => {
                    const slug = getEntitySlug(event);
                    const saved = isEventSaved(event.id);
                    const venueLabel =
                      event.venue?.name ||
                      event.venue_name ||
                      event.city_name ||
                      'Shanghai';
                    return (
                      <div
                        key={event.id}
                        onClick={() => navigate(`/events/${slug}`)}
                        className="flex items-center gap-3.5 p-2.5 rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 cursor-pointer active:scale-[0.99] transition-all"
                      >
                        <div className="w-24 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-200 dark:bg-[#151c12]">
                          <img
                            src={
                              event.flyer_image ||
                              event.banner_url ||
                              event.cover_image ||
                              '/web-hero/C48A0758.jpg'
                            }
                            alt={event.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              const el = e.currentTarget as HTMLImageElement;
                              if (!el.dataset.fallback) {
                                el.dataset.fallback = '1';
                                el.src = '/web-hero/C48A0758.jpg';
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[#020b00] dark:text-white font-bold text-sm truncate mb-1">
                            {event.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 text-[0.6875rem] mb-1">
                            <Calendar className="w-3 h-3 text-[#9fa505] dark:text-[#d3da0c] flex-shrink-0" />
                            <span className="truncate">{formatEventDateTime(event.start_date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[0.6875rem]">
                            <MapPin className="w-3 h-3 text-[#9fa505] dark:text-[#d3da0c] flex-shrink-0" />
                            <span className="truncate">{venueLabel}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleSaveEvent(e, event.id)}
                          aria-label="Save event to favorites"
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[#9fa505] dark:text-[#d3da0c] hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0 active:scale-90 transition-transform"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              saved ? 'fill-[#9fa505] dark:fill-[#d3da0c] text-[#9fa505] dark:text-[#d3da0c]' : 'text-[#9fa505] dark:text-[#d3da0c]'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Sheet Modal (Eventix-style) */}
      <AnimatePresence>
        {showFilterModal && (
          createPortal(<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md"
              onClick={() => setShowFilterModal(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-[#161616] text-[#020b00] dark:text-white rounded-t-2xl sm:rounded-2xl border border-black/10 dark:border-white/10 z-10 max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-3 border-b border-black/8 dark:border-white/8">
                <h3 className="text-[#020b00] dark:text-white font-bold text-lg">Filters</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Filters Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* TIMELINE section */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Timeline
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: 'All Events' },
                      { id: 'current', label: 'Current Events' },
                      { id: 'upcoming', label: 'Upcoming Events' },
                      { id: 'past', label: 'Past Events' },
                    ].map((pill) => (
                      <button
                        key={pill.id}
                        onClick={() => setDraftDateFilter(pill.id as DateFilter)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          draftDateFilter === pill.id
                            ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold shadow-xs'
                            : 'bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-400 border border-black/8 dark:border-white/8'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CITY section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      City
                    </label>
                    <span className="text-xs font-semibold text-[#020b00] dark:text-[#d3da0c]">
                      {chinaCities.find(c => c.id === draftCity)?.name || 'All Cities'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                    {chinaCities.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setDraftCity(c.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          draftCity === c.id
                            ? 'bg-[#d3da0c] text-black font-bold shadow-xs'
                            : 'bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-400 border border-black/8 dark:border-white/8'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CATEGORY section */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Music', 'Nightlife', 'Sports', 'Art', 'Food', 'Film', 'Business', 'Culture'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setDraftCategory(draftCategory === cat ? '' : cat)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          draftCategory === cat
                            ? 'bg-[#FF2D8F] text-white font-bold shadow-xs'
                            : 'bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-400 border border-black/8 dark:border-white/8'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRICE section */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Price
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/8">
                    <span className="text-sm font-medium text-[#020b00] dark:text-white">Free events only</span>
                    <button
                      type="button"
                      onClick={() => setDraftFreeOnly(!draftFreeOnly)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        draftFreeOnly ? 'bg-[#020b00] dark:bg-[#d3da0c]' : 'bg-gray-300 dark:bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white dark:bg-black absolute top-0.5 transition-transform ${
                          draftFreeOnly ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* SORT BY */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Sort By
                  </label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setDraftSortBy('relevance')}
                      className="flex items-center gap-2 text-sm text-[#020b00] dark:text-white"
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        draftSortBy === 'relevance' ? 'border-[#020b00] bg-[#020b00] dark:border-[#d3da0c] dark:bg-[#d3da0c]' : 'border-gray-400 dark:border-gray-500'
                      }`}>
                        {sortBy === 'relevance' && <Check className="w-3 h-3 text-[#d3da0c] dark:text-black" />}
                      </div>
                      Relevance
                    </button>
                    <button
                      onClick={() => setDraftSortBy('date')}
                      className="flex items-center gap-2 text-sm text-[#020b00] dark:text-white"
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        draftSortBy === 'date' ? 'border-[#020b00] bg-[#020b00] dark:border-[#d3da0c] dark:bg-[#d3da0c]' : 'border-gray-400 dark:border-gray-500'
                      }`}>
                        {sortBy === 'date' && <Check className="w-3 h-3 text-[#d3da0c] dark:text-black" />}
                      </div>
                      Date
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky Action buttons at bottom */}
              <div className="p-4 bg-white/95 dark:bg-[#161616]/95 backdrop-blur-md border-t border-black/8 dark:border-white/10 flex gap-3 safe-area-pb">
                <button
                  onClick={() => {
                    setDraftCity('all');
                    setSelectedCity('all');
                    setDraftDateFilter('all');
                    setDraftCategory('');
                    setDraftFreeOnly(false);
                    setDraftSortBy('relevance');
                  }}
                  className="flex-1 py-3.5 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white font-semibold text-sm rounded-2xl active:scale-95 transition-transform"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setSelectedCity(draftCity);
                    setDateFilter(draftDateFilter);
                    setSelectedCategory(draftCategory);
                    setFreeOnly(draftFreeOnly);
                    setSortBy(draftSortBy);
                    setShowFilterModal(false);
                  }}
                  className="flex-1 py-3.5 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold text-sm rounded-2xl active:scale-95 transition-transform shadow-md"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>, document.body)
        )}
      </AnimatePresence>
    </div>
  );
}
