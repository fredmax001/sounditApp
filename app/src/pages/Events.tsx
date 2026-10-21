import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Calendar, Filter, X, SlidersHorizontal, Check, Camera, Sparkles, ChevronLeft } from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import MobileEventCard from '@/components/ui/MobileEventCard';
import MobileListRow from '@/components/ui/MobileListRow';
import MobileFilterPills from '@/components/ui/MobileFilterPills';
import type { DateFilter } from '@/components/ui/MobileFilterPills';
import CompactEventCard from '@/components/ui/CompactEventCard';

export default function Events() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { events, fetchEvents, fetchPastEvents } = useEventStore();
  const { selectedCity } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilter>('all');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftFreeOnly, setDraftFreeOnly] = useState(false);
  const [draftSortBy, setDraftSortBy] = useState<'relevance' | 'date'>('relevance');

  useEffect(() => {
    if (dateFilter === 'past') {
      fetchPastEvents(selectedCity || undefined);
    } else {
      fetchEvents({ city: selectedCity });
    }
  }, [dateFilter, fetchEvents, fetchPastEvents, selectedCity]);

  const filteredEvents = useMemo(() => {
    let result = (events || []).filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.venue?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.category?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

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
        // 'all' shows active events (current + upcoming)
        matchesDate = !isCompleted;
      }

      let matchesFree = true;
      if (freeOnly) {
        const price = event.ticket_tiers?.[0]?.price || 0;
        matchesFree = price === 0;
      }

      return matchesSearch && matchesCategory && matchesDate && matchesFree;
    });

    if (sortBy === 'date') {
      result = [...result].sort((a, b) => {
        if (dateFilter === 'past') {
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        }
        return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      });
    }

    return result;
  }, [events, searchQuery, selectedCategory, dateFilter, freeOnly, sortBy]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-28 transition-colors duration-200">
      {/* Header */}
      <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              aria-label="Go back"
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-gray-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold font-display text-[#020b00] dark:text-white flex-1">Search</h1>
          </div>

          {/* Input + Filter button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2.5 h-11 px-3.5 bg-neutral-100 dark:bg-[#1A1A1A] border border-black/10 dark:border-white/8 rounded-2xl">
              <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Discover an event..."
                className="flex-1 bg-transparent text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base focus:outline-none"
                inputMode="search"
                autoCorrect="off"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1">
                  <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setDraftDateFilter(dateFilter);
                setDraftCategory(selectedCategory);
                setDraftFreeOnly(freeOnly);
                setDraftSortBy(sortBy);
                setShowFilterModal(true);
              }}
              aria-label="Open filter options"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border active:scale-95 transition-all ${
                selectedCategory || dateFilter !== 'all' || freeOnly
                  ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black border-[#020b00] dark:border-[#d3da0c] shadow-md shadow-[#d3da0c]/20'
                  : 'bg-neutral-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 border-black/10 dark:border-white/8'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Active Filter Chips (shown only when a filter is actually applied) */}
          {(dateFilter !== 'all' || selectedCategory || freeOnly) && (
            <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-2.5">
              {dateFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold shadow-xs">
                  {dateFilter === 'current' ? 'Current Events' : dateFilter === 'upcoming' ? 'Upcoming Events' : 'Past Events'}
                  <button onClick={() => setDateFilter('all')} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FF2D8F] text-white text-xs font-bold shadow-xs">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory('')} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {freeOnly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-xs">
                  Free
                  <button onClick={() => setFreeOnly(false)} className="hover:opacity-75">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setDateFilter('all');
                  setSelectedCategory('');
                  setFreeOnly(false);
                }}
                className="text-[11px] text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white underline ml-1 whitespace-nowrap"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Count & View Toggle */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          {filteredEvents.length} events found
        </span>
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1A1A1A] p-1 rounded-xl border border-black/8 dark:border-white/5">
          <button
            onClick={() => setViewMode('card')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'card' ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-sm' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'list' ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-sm' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Mobile Grid/List View */}
      <div className="px-4">
        {dateFilter === 'past' && (
          <Link
            to="/recaps"
            className="flex items-center justify-between p-4 mb-4 rounded-2xl bg-gradient-to-r from-[#d3da0c]/15 via-black/40 to-[#FF2D8F]/15 border border-[#d3da0c]/30 hover:border-[#d3da0c] transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#d3da0c] text-black flex items-center justify-center font-bold">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[#020b00] dark:text-white font-bold text-sm flex items-center gap-1.5">
                  Looking for event photos & videos?
                  <Sparkles className="w-3.5 h-3.5 text-[#d3da0c]" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">
                  Explore moments, crowd pictures, and live recaps from past events
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex text-xs font-bold text-[#d3da0c] group-hover:translate-x-1 transition-transform">
              Open Recaps →
            </span>
          </Link>
        )}

        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-[#020b00] dark:text-white font-semibold text-base mb-1">
              {dateFilter === 'past' ? 'No past events found' : 'No events found'}
            </p>
            <p className="text-gray-500 text-xs mb-4">
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
                className="px-5 py-2 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold rounded-full"
              >
                Reset filters
              </button>
              {dateFilter === 'past' && (
                <Link
                  to="/recaps"
                  className="px-5 py-2 bg-[#FF2D8F] text-white text-xs font-bold rounded-full flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  View Recaps
                </Link>
              )}
            </div>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredEvents.map((event) => (
              <MobileEventCard key={event.id} event={event} variant="featured" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredEvents.map((event, index) => (
              <MobileListRow key={event.id} event={event} index={index} />
            ))}
          </div>
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
              className="relative w-full max-w-md bg-white dark:bg-[#161616] text-[#020b00] dark:text-white rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 z-10 max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
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
