import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Calendar, Filter, X, SlidersHorizontal, Check } from 'lucide-react';
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
  const { events, fetchEvents } = useEventStore();
  const { selectedCity } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');

  useEffect(() => {
    fetchEvents({ city: selectedCity });
  }, [fetchEvents, selectedCity]);

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
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = eventDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        matchesDate = eventDate.toDateString() === tomorrow.toDateString();
      } else if (dateFilter === 'this_week') {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        matchesDate = eventDate >= now && eventDate <= weekEnd;
      } else if (dateFilter === 'this_weekend') {
        const day = eventDate.getDay();
        matchesDate = day === 0 || day === 6;
      }

      let matchesFree = true;
      if (freeOnly) {
        const price = event.ticket_tiers?.[0]?.price || 0;
        matchesFree = price === 0;
      }

      return matchesSearch && matchesCategory && matchesDate && matchesFree;
    });

    if (sortBy === 'date') {
      result = [...result].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
    }

    return result;
  }, [events, searchQuery, selectedCategory, dateFilter, freeOnly, sortBy]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-28">
      {/* Search Header */}
      <div className="px-4 pt-4 pb-2 sticky top-14 z-30 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/5">
        <h1 className="text-2xl font-bold text-white mb-3">Search</h1>

        {/* Input + Filter button */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex items-center gap-2.5 h-11 px-3.5 bg-[#1A1A1A] border border-white/8 rounded-2xl">
            <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Discover an event..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border active:scale-95 transition-all ${
              selectedCategory || dateFilter !== 'all' || freeOnly
                ? 'bg-[#d3da0c] text-black border-[#d3da0c]'
                : 'bg-[#1A1A1A] text-gray-400 border-white/8'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Date Filter Pills */}
        <MobileFilterPills
          activeDate={dateFilter}
          onDateChange={setDateFilter}
          activeCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          showCategoryRow={true}
        />
      </div>

      {/* Count & View Toggle */}
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">
          {filteredEvents.length} events found
        </span>
        <div className="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setViewMode('card')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'card' ? 'bg-[#d3da0c] text-black' : 'text-gray-400'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'list' ? 'bg-[#d3da0c] text-black' : 'text-gray-400'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Mobile Grid/List View */}
      <div className="px-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-gray-500" />
            </div>
            <p className="text-white font-semibold text-base mb-1">No events found</p>
            <p className="text-gray-500 text-xs mb-4">Try changing your date or category filters</p>
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowFilterModal(false)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#161616] rounded-t-3xl sm:rounded-3xl p-5 border border-white/10 z-10 max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">Filters</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* DATE section */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Date
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'today', 'tomorrow', 'this_week', 'this_weekend'] as DateFilter[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDateFilter(d)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        dateFilter === d
                          ? 'bg-[#d3da0c] text-black'
                          : 'bg-white/5 text-gray-400 border border-white/8'
                      }`}
                    >
                      {d === 'all' ? 'Anytime' : d.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* CATEGORY section */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Music', 'Nightlife', 'Sports', 'Art', 'Food', 'Film', 'Business', 'Culture'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        selectedCategory === cat
                          ? 'bg-[#FF2D8F] text-white'
                          : 'bg-white/5 text-gray-400 border border-white/8'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* PRICE section */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Price
                </label>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/8">
                  <span className="text-sm font-medium text-white">Free events only</span>
                  <button
                    type="button"
                    onClick={() => setFreeOnly(!freeOnly)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      freeOnly ? 'bg-[#d3da0c]' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-black absolute top-0.5 transition-transform ${
                        freeOnly ? 'translate-x-5.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* SORT BY */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Sort By
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setSortBy('relevance')}
                    className="flex items-center gap-2 text-sm text-white"
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      sortBy === 'relevance' ? 'border-[#d3da0c] bg-[#d3da0c]' : 'border-gray-500'
                    }`}>
                      {sortBy === 'relevance' && <Check className="w-3 h-3 text-black" />}
                    </div>
                    Relevance
                  </button>
                  <button
                    onClick={() => setSortBy('date')}
                    className="flex items-center gap-2 text-sm text-white"
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      sortBy === 'date' ? 'border-[#d3da0c] bg-[#d3da0c]' : 'border-gray-500'
                    }`}>
                      {sortBy === 'date' && <Check className="w-3 h-3 text-black" />}
                    </div>
                    Date
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setDateFilter('all');
                    setSelectedCategory('');
                    setFreeOnly(false);
                    setSortBy('relevance');
                  }}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-semibold text-sm rounded-2xl active:scale-95 transition-transform"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 py-3 bg-[#d3da0c] text-black font-bold text-sm rounded-2xl active:scale-95 transition-transform"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
