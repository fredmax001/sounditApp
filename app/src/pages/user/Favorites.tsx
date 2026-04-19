import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Heart, Calendar, MapPin, ArrowRight, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

interface FavoriteEvent {
  id: string;
  title: string;
  start_date: string;
  city: string;
  flyer_image: string;
  venue?: string;
}

interface FavoriteArtist {
  id: string;
  stage_name: string;
  avatar_url?: string;
  genres?: string[];
  follower_count?: number;
}

const Favorites = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'events' | 'artists'>('events');
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteEvents, setFavoriteEvents] = useState<FavoriteEvent[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<FavoriteArtist[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const eventsResponse = await fetch(`${API_BASE_URL}/events/saved`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setFavoriteEvents(eventsData || []);
        }

        const artistsResponse = await fetch(`${API_BASE_URL}/social/following`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (artistsResponse.ok) {
          const artistsData = await artistsResponse.json();
          setFavoriteArtists(artistsData.artists || []);
        }
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
        toast.error(t('user.favorites.failedToLoadFavorites'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [session, t]);

  const handleRemoveEvent = async (eventId: string) => {
    if (!session?.access_token) {
      toast.error(t('user.favorites.youMustBeLoggedIn'));
      return;
    }

    setRemovingId(eventId);
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/save`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setFavoriteEvents(prev => prev.filter(e => e.id !== eventId));
        toast.success(t('user.favorites.eventRemoved'));
      } else {
        throw new Error('Failed to remove from favorites');
      }
    } catch {
      toast.error(t('user.favorites.failedToRemove'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemoveArtist = async (artistId: string) => {
    if (!session?.access_token) {
      toast.error(t('user.favorites.youMustBeLoggedIn'));
      return;
    }

    setRemovingId(artistId);
    try {
      const response = await fetch(`${API_BASE_URL}/social/artists/${artistId}/follow`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        setFavoriteArtists(prev => prev.filter(a => a.id !== artistId));
        toast.success(t('user.favorites.artistRemoved'));
      } else {
        throw new Error('Failed to remove from favorites');
      }
    } catch {
      toast.error(t('user.favorites.failedToRemove'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-24">
      <section className="relative py-16 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
              {t('user.favorites.saved')}
            </span>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-6">
              {t('user.favorites.my')}{' '}
              <span className="text-[#d3da0c]">{t('user.favorites.favorites')}</span>
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'events'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
            >
              {t('user.favorites.events', { count: favoriteEvents.length })}
            </button>
            <button
              onClick={() => setActiveTab('artists')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'artists'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
            >
              {t('user.favorites.artists', { count: favoriteArtists.length })}
            </button>
          </div>

          {isLoading && (
            <div className="text-center py-24">
              <div className="w-12 h-12 mx-auto mb-4 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400">{t('user.favorites.loadingFavorites')}</p>
            </div>
          )}

          {!isLoading && activeTab === 'events' && (
            <>
              {favoriteEvents.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group relative bg-[#111111] rounded-2xl overflow-hidden border border-white/5 hover:border-[#d3da0c]/30 transition-all"
                    >
                      <div className="h-48 overflow-hidden relative">
                        <img
                          src={event.flyer_image || '/event_placeholder.jpg'}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] to-transparent" />
                      </div>

                      <button
                        onClick={() => handleRemoveEvent(event.id)}
                        disabled={removingId === event.id}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#FF2D8F] flex items-center justify-center text-white hover:bg-[#e6005c] transition-colors disabled:opacity-50 z-10"
                      >
                        {removingId === event.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Heart className="w-5 h-5 fill-current" />
                        )}
                      </button>

                      <div className="p-5">
                        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-[#d3da0c] transition-colors">
                          {event.title}
                        </h3>
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Calendar className="w-4 h-4 text-[#d3da0c]" />
                            <span>{new Date(event.start_date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <MapPin className="w-4 h-4 text-[#d3da0c]" />
                            <span>{event.city}</span>
                          </div>
                        </div>
                        <Link
                          to={`/events/${event.id}`}
                          className="inline-flex items-center gap-2 text-[#d3da0c] text-sm font-medium hover:gap-3 transition-all"
                        >
                          {t('user.favorites.viewEvent')}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#111111] flex items-center justify-center">
                    <Heart className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{t('user.favorites.noFavoriteEventsYet')}</h3>
                  <p className="text-gray-400 mb-6">{t('user.favorites.startExploringEvents')}</p>
                  <Link
                    to="/events"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                  >
                    {t('user.favorites.browseEvents')}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              )}
            </>
          )}

          {!isLoading && activeTab === 'artists' && (
            <>
              {favoriteArtists.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteArtists.map((artist, index) => (
                    <motion.div
                      key={artist.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group relative glass rounded-2xl overflow-hidden hover:border-[#d3da0c]/30 transition-all"
                    >
                      <button
                        onClick={() => handleRemoveArtist(artist.id)}
                        disabled={removingId === artist.id}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#FF2D8F] flex items-center justify-center text-white hover:bg-[#e6005c] transition-colors disabled:opacity-50 z-10"
                      >
                        {removingId === artist.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Heart className="w-5 h-5 fill-current" />
                        )}
                      </button>

                      <div className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center overflow-hidden">
                            {artist.avatar_url ? (
                              <img
                                src={artist.avatar_url}
                                alt={artist.stage_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-8 h-8 text-black" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-white group-hover:text-[#d3da0c] transition-colors">
                              {artist.stage_name}
                            </h3>
                            {artist.follower_count !== undefined && (
                              <p className="text-gray-500 text-sm">{t('user.favorites.followerCount', { count: artist.follower_count })}</p>
                            )}
                          </div>
                        </div>

                        {artist.genres && artist.genres.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {artist.genres.slice(0, 3).map((genre, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-white/5 text-gray-400 text-xs rounded-full"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        )}

                        <Link
                          to={`/artists/${artist.id}`}
                          className="inline-flex items-center gap-2 text-[#d3da0c] text-sm font-medium hover:gap-3 transition-all"
                        >
                          {t('user.favorites.viewProfile')}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#111111] flex items-center justify-center">
                    <Users className="w-10 h-10 text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{t('user.favorites.noFavoriteArtistsYet')}</h3>
                  <p className="text-gray-400 mb-6">{t('user.favorites.discoverAndFollow')}</p>
                  <Link
                    to="/artists"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                  >
                    {t('user.favorites.discoverArtists')}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Favorites;
