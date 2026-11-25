import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Music, Users, Heart, MapPin } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';
import { chinaCities } from '@/data/constants';
import { queryCache, isAbortError } from '@/lib/queryCache';
import { useDebouncedValue } from '@/hooks/useDebounce';

interface Artist {
  id: number;
  slug?: string;
  display_name: string;
  artist_type?: string;
  avatar_url: string;
  bio: string;
  city_id: string;
  verification_badge?: boolean;
  artist_profiles: Array<{
    stage_name: string;
    artist_type?: string;
    genres: string[];
    follower_count: number;
  }>;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

export default function Artists() {
  const { t } = useTranslation();
  const { session, selectedCity, setSelectedCity } = useAuthStore();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const inFlightFollowsRef = useRef<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchArtists = useCallback(async () => {
    const cityKey = queryCache.normalizeCity(selectedCity);
    const cacheKey = `artists:list:${cityKey}`;
    const cached = queryCache.get<Artist[]>(cacheKey);
    if (cached !== null) {
      setArtists(cached);
      return;
    }

    try {
      const params: Record<string, string> = {};
      if (cityKey !== 'all') params.city = cityKey;

      const data = await queryCache.fetchJson<Array<{
        id: number;
        slug?: string;
        stage_name: string;
        artist_type?: string;
        avatar_url: string;
        bio: string;
        city: string;
        genres?: string[];
        followers_count?: number;
        verification_badge?: boolean;
      }>>(
        `artists:raw:${cityKey}`,
        `${API_URL}/artists`,
        { params, ttlMs: 45_000, scope: 'city:artists-list' }
      );
      const mapped: Artist[] = (data || []).map((artist) => ({
        id: artist.id,
        slug: artist.slug || slugify(artist.stage_name),
        display_name: artist.stage_name,
        artist_type: artist.artist_type,
        avatar_url: artist.avatar_url,
        bio: artist.bio,
        city_id: artist.city,
        verification_badge: artist.verification_badge,
        artist_profiles: [{
          stage_name: artist.stage_name,
          artist_type: artist.artist_type,
          genres: artist.genres || [],
          follower_count: artist.followers_count || 0,
        }],
      }));
      queryCache.set(cacheKey, mapped, 45_000);
      setArtists(mapped);
    } catch (e) {
      if (isAbortError(e)) return;
      console.error('Error fetching artists');
    }
  }, [selectedCity]);

  const fetchFollowing = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_URL}/social/following`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const ids = new Set<number>((data.artists || []).map((a: { id: number }) => a.id));
        setFollowingIds(ids);
      }
    } catch {
      // ignore
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchArtists();
    fetchFollowing();
  }, [fetchArtists, fetchFollowing]);

  const handleFollowToggle = async (e: React.MouseEvent, artistId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session?.access_token) {
      toast.info(t('artists.loginToFollow') || 'Please log in to follow');
      return;
    }
    if (inFlightFollowsRef.current.has(artistId)) return;
    inFlightFollowsRef.current.add(artistId);

    const wasFollowing = followingIds.has(artistId);
    const delta = wasFollowing ? -1 : 1;

    // 1. Optimistic UI update (heart + follower counter update immediately in 0ms)
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
    setArtists((prev) =>
      prev.map((a) =>
        a.id === artistId && a.artist_profiles?.[0]
          ? {
              ...a,
              artist_profiles: [
                {
                  ...a.artist_profiles[0],
                  follower_count: Math.max(0, (a.artist_profiles[0].follower_count || 0) + delta),
                },
              ],
            }
          : a
      )
    );

    try {
      const res = await fetch(`${API_URL}/social/artists/${artistId}/follow`, {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || t('artists.followFailed') || 'Failed');
      }
      queryCache.invalidatePrefix('artists:');
    } catch (err: unknown) {
      // Roll back optimistic state on error
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(artistId);
        else next.delete(artistId);
        return next;
      });
      setArtists((prev) =>
        prev.map((a) =>
          a.id === artistId && a.artist_profiles?.[0]
            ? {
                ...a,
                artist_profiles: [
                  {
                    ...a.artist_profiles[0],
                    follower_count: Math.max(0, (a.artist_profiles[0].follower_count || 0) - delta),
                  },
                ],
              }
            : a
        )
      );
      toast.error(err instanceof Error ? err.message : (t('artists.followFailed') || 'Failed'));
    } finally {
      inFlightFollowsRef.current.delete(artistId);
    }
  };

  const filteredArtists = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return (artists || []).filter(
      (artist) => {
        const artistProfile = artist.artist_profiles?.[0];
        const name = artistProfile?.stage_name || artist.display_name || '';
        const genres = artistProfile?.genres || [];
        const artistType = (artist.artist_type || artistProfile?.artist_type || '').toLowerCase();

        const matchesSearch = !q ||
          name.toLowerCase().includes(q) ||
          genres.some((g: string) => g.toLowerCase().includes(q)) ||
          artistType.includes(q);

        const matchesType = selectedType === 'all' || artistType === selectedType.toLowerCase();

        return matchesSearch && matchesType;
      }
    );
  }, [artists, debouncedSearch, selectedType]);

  const DISCIPLINE_TABS = [
    { id: 'all', label: 'All Creatives' },
    { id: 'dj', label: 'DJs' },
    { id: 'singer', label: 'Singers' },
    { id: 'dancer', label: 'Dancers' },
    { id: 'photographer', label: 'Photographers' },
    { id: 'mc', label: 'MCs & Hosts' },
  ];

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200">
      {/* Header */}
      <section
        className="sticky z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5 transition-[top] duration-200"
        style={{ top: 'var(--mobile-header-offset, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display text-[#020b00] dark:text-white">
                {t('artists.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm hidden md:block mt-1 max-w-2xl">
                {t('artists.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-white/40" />
                <input
                  type="text"
                  placeholder={t('artists.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-[#020b00] dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-white/40 focus:outline-none focus:border-[#020b00] dark:focus:border-[#d3da0c]/50"
                />
              </div>
              <div className="relative shrink-0">
                <select
                  value={selectedCity || 'all'}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  aria-label="Filter artists by city"
                  className="bg-neutral-100 dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5 text-[#020b00] dark:text-white text-sm font-medium focus:outline-none focus:border-[#020b00] dark:focus:border-[#d3da0c]/50 cursor-pointer"
                >
                  {chinaCities.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-[#141414] text-[#020b00] dark:text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Discipline Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {DISCIPLINE_TABS.map((tab) => {
              const isActive = selectedType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedType(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                      : 'bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Artists Grid */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {filteredArtists.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 dark:text-white/50 text-lg">{t('artists.noArtistsFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {filteredArtists.map((artist) => {
                const artistProfile = artist.artist_profiles?.[0];
                const name = artistProfile?.stage_name || artist.display_name || 'Artist';
                const isFollowing = followingIds.has(artist.id);

                const artistSlug = artist.slug || slugify(name) || String(artist.id);

                return (
                  <Link
                    key={artist.id}
                    to={`/artists/${artistSlug}`}
                    className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#141414]"
                  >
                    <img
                      src={artist.avatar_url || '/default-avatar.jpg'}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Role / Genre Badge */}
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-[#d3da0c] text-black text-[0.6875rem] font-black uppercase tracking-wider rounded-full shadow-xs">
                        {artist.artist_type || artistProfile?.artist_type || 'DJ'}
                      </span>
                      {artistProfile?.genres?.[0] && (
                        <span className="hidden sm:inline-block px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[0.625rem] font-medium rounded-full border border-white/10">
                          {artistProfile.genres[0]}
                        </span>
                      )}
                    </div>

                    {/* Follow Button (Optimistic UI) */}
                    <button
                      onClick={(e) => handleFollowToggle(e, artist.id)}
                      className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${
                        isFollowing
                          ? 'bg-pink-500 text-white'
                          : 'bg-black/40 text-white hover:bg-pink-500/80'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                    </button>

                    {/* Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
                      <h3 className="text-lg lg:text-xl font-semibold text-white mb-1 flex items-center gap-2">
                        {name}
                        {((artist as any).is_verified || artist.verification_badge) && <VerificationBadge size="sm" />}
                      </h3>
                      <div className="flex items-center gap-4 text-white/50 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {artistProfile?.follower_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Music className="w-4 h-4" />
                          Discover
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
