import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Music, Users, Heart, Loader2 } from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';

interface Artist {
  id: number;
  display_name: string;
  avatar_url: string;
  bio: string;
  city_id: string;
  verification_badge?: boolean;
  artist_profiles: Array<{
    stage_name: string;
    genres: string[];
    follower_count: number;
  }>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Artists() {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [followLoadingId, setFollowLoadingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchArtists = useCallback(async () => {
    const { selectedCity } = useAuthStore.getState();
    try {
      const params: Record<string, string> = {};
      if (selectedCity) params.city = selectedCity;

      const { data } = await axios.get(`${API_URL}/artists`, { params });
      const mapped = (data || []).map((artist: {
        id: number;
        stage_name: string;
        avatar_url: string;
        bio: string;
        city: string;
        genres?: string[];
        followers_count?: number;
        verification_badge?: boolean;
      }) => ({
        id: artist.id,
        display_name: artist.stage_name,
        avatar_url: artist.avatar_url,
        bio: artist.bio,
        city_id: artist.city,
        verification_badge: artist.verification_badge,
        artist_profiles: [{
          stage_name: artist.stage_name,
          genres: artist.genres || [],
          follower_count: artist.followers_count || 0,
        }],
      }));
      setArtists(mapped);
    } catch {
      console.error('Error fetching artists');
    }
  }, []);

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
    setFollowLoadingId(artistId);
    try {
      if (followingIds.has(artistId)) {
        const res = await fetch(`${API_URL}/social/artists/${artistId}/follow`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          setFollowingIds((prev) => {
            const next = new Set(prev);
            next.delete(artistId);
            return next;
          });
          toast.success(t('artists.unfollowed') || 'Unfollowed');
        }
      } else {
        const res = await fetch(`${API_URL}/social/artists/${artistId}/follow`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          setFollowingIds((prev) => {
            const next = new Set(prev);
            next.add(artistId);
            return next;
          });
          toast.success(t('artists.followed') || 'Followed');
        } else {
          const err = await res.json();
          toast.error(err.detail || t('artists.followFailed') || 'Failed');
        }
      }
    } catch {
      toast.error(t('artists.followFailed') || 'Failed');
    } finally {
      setFollowLoadingId(null);
    }
  };

  const filteredArtists = useMemo(() => {
    return (artists || []).filter(
      (artist) => {
        const artistProfile = artist.artist_profiles?.[0];
        const name = artistProfile?.stage_name || artist.display_name || '';
        const genres = artistProfile?.genres || [];

        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          genres.some((g: string) => g.toLowerCase().includes(searchQuery.toLowerCase()));
      }
    );
  }, [artists, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20 lg:pt-24">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('artists.title')}
          </h1>
          <p className="text-white/50 text-lg max-w-2xl">
            {t('artists.subtitle')}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder={t('artists.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141414] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#d3da0c]/50"
            />
          </div>
        </div>
      </div>

      {/* Artists Grid */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {filteredArtists.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-white/50 text-lg">{t('artists.noArtistsFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {filteredArtists.map((artist) => {
                const artistProfile = artist.artist_profiles?.[0];
                const name = artistProfile?.stage_name || artist.display_name || 'Artist';
                const isFollowing = followingIds.has(artist.id);

                return (
                  <Link
                    key={artist.id}
                    to={`/artists/${artist.id}`}
                    className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-[#141414]"
                  >
                    <img
                      src={artist.avatar_url || '/default-avatar.jpg'}
                      alt={name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Genre Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-[#d3da0c] text-black text-xs font-semibold rounded-full">
                        {artistProfile?.genres?.[0] || 'DJ'}
                      </span>
                    </div>

                    {/* Follow Button */}
                    <button
                      onClick={(e) => handleFollowToggle(e, artist.id)}
                      disabled={followLoadingId === artist.id}
                      className={`absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                        isFollowing
                          ? 'bg-pink-500 text-white'
                          : 'bg-black/40 text-white hover:bg-pink-500/80'
                      } disabled:opacity-50`}
                    >
                      {followLoadingId === artist.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                      )}
                    </button>

                    {/* Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
                      <h3 className="text-lg lg:text-xl font-semibold text-white mb-1 flex items-center gap-2">
                        {name}
                        {artist.verification_badge && <VerificationBadge size="sm" />}
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
