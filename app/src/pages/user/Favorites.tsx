import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Heart, MapPin, ChevronLeft, ChevronRight, Loader2, Users,
  Search, SlidersHorizontal, LayoutGrid, List, Calendar, X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface FavoriteEvent {
  id: string;
  title: string;
  start_date: string;
  city: string;
  flyer_image: string;
  tags?: string[];
  venue?: string;
}

interface FavoriteArtist {
  id: string;
  stage_name: string;
  avatar_url?: string;
  genre?: string;
  genres?: string[];
  city?: string;
  follower_count?: number;
}

type FavType = 'event' | 'artist';

interface FavItem {
  key: string;
  type: FavType;
  name: string;
  image?: string;
  tags: string[];
  location?: string;
  date?: string;
}

type Tab = 'all' | 'events' | 'artists';

const Favorites = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEvent[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>([]);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<FavItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchFavorites = async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(false);
    try {
      const [eventsResponse, artistsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/events/saved`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch(`${API_BASE_URL}/social/following`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
      ]);

      if (!eventsResponse.ok || !artistsResponse.ok) {
        throw new Error('Failed to load favorites');
      }

      const eventsData = await eventsResponse.json();
      const artistsData = await artistsResponse.json();
      setFavoriteEvents(eventsData || []);
      setFavoriteArtists(artistsData.artists || []);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const eventItems: FavItem[] = useMemo(() => favoriteEvents.map(e => ({
    key: `event-${e.id}`,
    type: 'event',
    name: e.title,
    image: e.flyer_image,
    tags: e.tags || [],
    location: e.city,
    date: e.start_date,
  })), [favoriteEvents]);

  const artistItems: FavItem[] = useMemo(() => favoriteArtists.map(a => ({
    key: `artist-${a.id}`,
    type: 'artist',
    name: a.stage_name,
    image: a.avatar_url,
    tags: a.genres && a.genres.length > 0 ? a.genres : (a.genre ? [a.genre] : []),
    location: a.city,
  })), [favoriteArtists]);

  const allFilters = useMemo(() => {
    const set = new Set<string>();
    [...eventItems, ...artistItems].forEach(i => i.tags.forEach(tag => set.add(tag)));
    return Array.from(set).slice(0, 8);
  }, [eventItems, artistItems]);

  const visibleItems = useMemo(() => {
    const base = activeTab === 'events' ? eventItems : activeTab === 'artists' ? artistItems : [...eventItems, ...artistItems];
    let items = base;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q) ||
        i.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    if (activeFilter) {
      items = items.filter(i => i.tags.includes(activeFilter));
    }
    return items;
  }, [activeTab, eventItems, artistItems, searchQuery, activeFilter]);

  const totalCount = eventItems.length + artistItems.length;

  const confirmRemove = async () => {
    if (!pendingRemove || !session?.access_token) return;
    const item = pendingRemove;
    setRemovingKey(item.key);

    const removeFromState = () => {
      if (item.type === 'event') {
        setFavoriteEvents(prev => prev.filter(e => `event-${e.id}` !== item.key));
      } else {
        setFavoriteArtists(prev => prev.filter(a => `artist-${a.id}` !== item.key));
      }
    };

    const url = item.type === 'event'
      ? `${API_BASE_URL}/events/${item.key.replace('event-', '')}/save`
      : `${API_BASE_URL}/social/artists/${item.key.replace('artist-', '')}/follow`;

    // Optimistic update; roll back on failure
    removeFromState();
    setPendingRemove(null);
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!response.ok) throw new Error('Failed to remove');
      toast.success(item.type === 'event' ? t('user.favorites.eventRemoved') : t('user.favorites.artistRemoved'));
    } catch {
      toast.error(t('user.favorites.failedToRemove'));
      fetchFavorites();
    } finally {
      setRemovingKey(null);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const itemLink = (item: FavItem) =>
    item.type === 'event' ? `/events/${item.key.replace('event-', '')}` : `/artists/${item.key.replace('artist-', '')}`;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: t('kit.favorites.all') },
    { id: 'events', label: t('kit.favorites.events') },
    { id: 'artists', label: t('kit.favorites.artists') },
  ];

  const showEmpty = !isLoading && !loadError && visibleItems.length === 0;

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              aria-label={t('kit.common.back')}
              className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-display text-white flex-1">{t('kit.favorites.title')}</h1>
            <button
              onClick={() => { setSearchOpen(o => !o); setFilterOpen(false); }}
              aria-label={t('kit.favorites.searchPlaceholder')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${searchOpen ? 'text-[#d3da0c] bg-[#d3da0c]/10' : 'text-white hover:bg-white/5'}`}
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setFilterOpen(o => !o); setSearchOpen(false); }}
              aria-label={t('kit.favorites.filter')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${filterOpen ? 'text-[#d3da0c] bg-[#d3da0c]/10' : 'text-white hover:bg-white/5'}`}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 relative"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('kit.favorites.searchPlaceholder')}
                className="w-full h-11 pl-11 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 outline-none focus:border-[#d3da0c]/50 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label={t('kit.common.cancel')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}

          {filterOpen && allFilters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                onClick={() => setActiveFilter(null)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors ${!activeFilter ? 'bg-[#d3da0c] text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
              >
                {t('kit.favorites.all')}
              </button>
              {allFilters.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors ${activeFilter === tag ? 'bg-[#d3da0c] text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                >
                  {tag}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      <section className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Segmented tabs */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Count + view toggle */}
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-gray-400 text-sm">
              {totalCount === 1 ? t('kit.favorites.countOne') : t('kit.favorites.count', { count: totalCount })}
            </p>
            <div className="flex bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                aria-label={t('kit.favorites.gridView')}
                className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label={t('kit.favorites.listView')}
                className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Loading skeletons */}
          {isLoading && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden animate-pulse">
                  <div className={viewMode === 'grid' ? 'h-36 bg-white/5' : 'hidden'} />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!isLoading && loadError && (
            <div className="text-center py-24">
              <p className="text-gray-400 mb-4">{t('kit.common.loadFailed')}</p>
              <button
                onClick={fetchFavorites}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors min-h-[44px]"
              >
                {t('kit.common.tryAgain')}
              </button>
            </div>
          )}

          {/* Empty states */}
          {showEmpty && (
            <div className="text-center py-20 px-6">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#111111] border border-white/10 flex items-center justify-center">
                <Heart className="w-10 h-10 text-[#d3da0c]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {activeTab === 'artists' ? t('kit.favorites.emptyArtists') : activeTab === 'events' ? t('kit.favorites.emptyEvents') : t('kit.favorites.emptyAll')}
              </h3>
              <p className="text-gray-400 mb-6 text-sm">
                {activeTab === 'artists' ? t('kit.favorites.emptyArtistsDesc') : activeTab === 'events' ? t('kit.favorites.emptyEventsDesc') : t('kit.favorites.emptyAllDesc')}
              </p>
              <Link
                to={activeTab === 'artists' ? '/artists' : '/events'}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors min-h-[44px]"
              >
                {activeTab === 'artists' ? t('kit.favorites.discoverArtists') : t('kit.favorites.findEvents')}
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          )}

          {/* Grid view */}
          {!isLoading && !loadError && visibleItems.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visibleItems.map((item, index) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.3) }}
                  className="group relative bg-[#111111] rounded-2xl overflow-hidden border border-white/5 hover:border-[#d3da0c]/30 transition-all"
                >
                  <Link to={itemLink(item)} className="block">
                    <div className="aspect-[4/5] overflow-hidden relative bg-white/5">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="w-10 h-10 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/20 to-transparent" />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/60 backdrop-blur-sm text-[#d3da0c] border border-[#d3da0c]/30">
                        {item.type === 'event' ? t('kit.favorites.event') : t('kit.favorites.artist')}
                      </span>
                    </div>
                  </Link>

                  <button
                    onClick={() => setPendingRemove(item)}
                    disabled={removingKey === item.key}
                    aria-label={t('kit.favorites.removeTitle')}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#d3da0c] hover:bg-[#d3da0c] hover:text-black transition-colors disabled:opacity-50 z-10"
                  >
                    {removingKey === item.key ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Heart className="w-4 h-4 fill-current" />
                    )}
                  </button>

                  <div className="p-3">
                    <Link to={itemLink(item)}>
                      <h3 className="text-sm font-semibold text-white mb-1.5 line-clamp-1 group-hover:text-[#d3da0c] transition-colors">
                        {item.name}
                      </h3>
                    </Link>
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1">
                      {item.date && (
                        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                          <Calendar className="w-3 h-3 text-[#d3da0c]/70" />
                          <span>{formatDate(item.date)}</span>
                        </div>
                      )}
                      {item.location && (
                        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                          <MapPin className="w-3 h-3 text-[#d3da0c]/70" />
                          <span className="capitalize">{item.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* List view */}
          {!isLoading && !loadError && visibleItems.length > 0 && viewMode === 'list' && (
            <div className="space-y-3">
              {visibleItems.map((item, index) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.3) }}
                  className="flex items-center gap-3 bg-[#111111] rounded-2xl border border-white/5 p-3"
                >
                  <Link to={itemLink(item)} className="shrink-0">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                  </Link>
                  <Link to={itemLink(item)} className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{item.name}</h3>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    {item.location && (
                      <div className="flex items-center gap-1 mt-1 text-gray-500 text-xs min-w-0">
                        <MapPin className="w-3 h-3 text-[#d3da0c]/70 shrink-0" />
                        <span className="capitalize truncate">{item.location}{item.date ? ` · ${formatDate(item.date)}` : ''}</span>
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={() => setPendingRemove(item)}
                    disabled={removingKey === item.key}
                    aria-label={t('kit.favorites.removeTitle')}
                    className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-[#d3da0c] hover:bg-[#d3da0c]/10 transition-colors disabled:opacity-50"
                  >
                    {removingKey === item.key ? <Loader2 className="w-5 h-5 animate-spin" /> : <Heart className="w-5 h-5 fill-current" />}
                  </button>
                  <Link to={itemLink(item)} className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Remove confirmation bottom sheet */}
      <Sheet open={!!pendingRemove} onOpenChange={open => { if (!open) setPendingRemove(null); }}>
        <SheetContent side="bottom" className="bg-[#111111] border-t border-white/10 rounded-t-3xl px-5 pt-4 pb-8 z-[60]">
          <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-4" />
          <SheetHeader className="mb-4">
            <SheetTitle className="text-lg font-semibold text-white text-left">
              {t('kit.favorites.removeTitle')}
            </SheetTitle>
            <p className="text-sm text-gray-400 text-left">{t('kit.favorites.removeDesc')}</p>
          </SheetHeader>

          {pendingRemove && (
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 mb-5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                {pendingRemove.image ? (
                  <img src={pendingRemove.image} alt={pendingRemove.name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{pendingRemove.name}</p>
                <p className="text-xs text-gray-500 capitalize">{pendingRemove.type === 'event' ? t('kit.favorites.event') : t('kit.favorites.artist')}{pendingRemove.location ? ` · ${pendingRemove.location}` : ''}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setPendingRemove(null)}
              className="flex-1 min-h-[48px] rounded-xl bg-white/5 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              {t('kit.common.cancel')}
            </button>
            <button
              onClick={confirmRemove}
              disabled={removingKey !== null}
              className="flex-1 min-h-[48px] rounded-xl bg-[#d3da0c] text-black font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {removingKey !== null && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('kit.favorites.yesRemove')}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Favorites;
