import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Star, Ticket, Users } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import { useCityGuideStore } from '@/store/cityGuideStore';

interface FeedEvent {
  id: number;
  title: string;
  start_date?: string;
  city?: string;
  flyer_image?: string | null;
  views_count?: number;
  is_featured?: boolean;
  tags?: string[];
  ticket_price?: number | null;
  ticket_tiers?: { price?: number }[];
}

interface FeedArtist {
  id: number | string;
  user_id?: number | string;
  stage_name?: string;
  genre?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  followers_count?: number;
}

interface FeedVendor {
  id: number;
  business_name?: string;
  logo_url?: string | null;
  city?: string | null;
  rating?: number;
  reviews_count?: number;
  vendor_type?: string;
}

const SectionHeader = ({ title, seeAllPath }: { title: string; seeAllPath?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between mb-3 px-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {seeAllPath && (
        <button
          onClick={() => navigate(seeAllPath)}
          className="flex items-center gap-0.5 text-xs text-[#d3da0c] font-medium min-h-[32px]"
        >
          {t('discovery.seeAll', 'See all')}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const SkeletonCard = ({ className }: { className: string }) => (
  <div className={`bg-[#111111] border border-white/5 rounded-2xl animate-pulse ${className}`} />
);

const DiscoveryFeed = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedCity } = useAuthStore();
  const { guideItems } = useCityGuideStore();

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [artists, setArtists] = useState<FeedArtist[]>([]);
  const [vendors, setVendors] = useState<FeedVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const city = selectedCity && selectedCity !== 'all' ? selectedCity : undefined;

  useEffect(() => {
    const fetchFeed = async () => {
      setIsLoading(true);
      const params = city ? `&city=${encodeURIComponent(city)}` : '';
      try {
        const [evRes, artRes, venRes] = await Promise.all([
          fetch(`${API_BASE_URL}/events?limit=30${params}`),
          fetch(`${API_BASE_URL}/artists?limit=20${params}`),
          fetch(`${API_BASE_URL}/vendors?limit=20${params}`),
        ]);
        if (evRes.ok) setEvents(await evRes.json() as FeedEvent[]);
        if (artRes.ok) setArtists(await artRes.json() as FeedArtist[]);
        if (venRes.ok) setVendors(await venRes.json() as FeedVendor[]);
      } catch {
        // sections render empty
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeed();
  }, [city]);

  const topEvents = useMemo(
    () => [...events].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 10),
    [events]
  );

  // Deterministic daily rotation so "Pick For You" refreshes every day
  const picks = useMemo(() => {
    const pool = [...events].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    const daySeed = Math.floor(Date.now() / 86400000);
    const rotated = pool.map((_, i) => pool[(i + daySeed) % pool.length]).filter(Boolean);
    return rotated.slice(0, 5);
  }, [events]);

  const spots = useMemo(
    () => guideItems.filter(i => i.type === 'venue' || i.type === 'food').slice(0, 10),
    [guideItems]
  );

  const eventPrice = (ev: FeedEvent) => {
    const tierPrice = ev.ticket_tiers?.length ? Math.min(...ev.ticket_tiers.map(t => t.price ?? Infinity)) : null;
    const price = tierPrice !== null && isFinite(tierPrice) ? tierPrice : ev.ticket_price;
    return price != null && price > 0 ? `¥${price}` : null;
  };

  const formatDate = (d?: string) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-7 pb-4">
      {/* Pick For You */}
      {(isLoading || picks.length > 0) && (
        <section>
          <SectionHeader title={t('discovery.pickForYou', 'Pick For You')} seeAllPath="/events" />
          {isLoading ? (
            <div className="flex gap-3 px-4 overflow-hidden">
              {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} className="w-64 h-44 shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {picks.map((ev, i) => (
                <motion.button
                  key={ev.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.06, 0.3) }}
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="relative w-64 shrink-0 rounded-2xl overflow-hidden border border-white/5 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="h-40 bg-white/5">
                    {ev.flyer_image && (
                      <img src={ev.flyer_image} alt={ev.title} loading="lazy" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {ev.start_date && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#d3da0c] text-black text-[11px] font-bold">
                      {formatDate(ev.start_date)}
                    </span>
                  )}
                  {eventPrice(ev) && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[#d3da0c] text-[11px] font-bold">
                      {eventPrice(ev)}
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-semibold text-sm truncate">{ev.title}</h3>
                    {ev.city && (
                      <p className="text-gray-400 text-xs mt-0.5 capitalize flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#d3da0c]" />{ev.city}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Top Events */}
      {(isLoading || topEvents.length > 0) && (
        <section>
          <SectionHeader title={t('discovery.topEvents', 'Top Events')} seeAllPath="/events" />
          {isLoading ? (
            <div className="flex gap-3 px-4 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="w-36 h-48 shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topEvents.map((ev, i) => (
                <motion.button
                  key={ev.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  onClick={() => navigate(`/events/${ev.id}`)}
                  className="w-36 shrink-0 bg-[#111111] rounded-2xl overflow-hidden border border-white/5 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="h-36 bg-white/5">
                    {ev.flyer_image && (
                      <img src={ev.flyer_image} alt={ev.title} loading="lazy" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-white text-xs font-semibold truncate">{ev.title}</h3>
                    <p className="text-gray-500 text-[11px] mt-1 flex items-center justify-between">
                      <span>{formatDate(ev.start_date)}</span>
                      {eventPrice(ev) && <span className="text-[#d3da0c] font-semibold">{eventPrice(ev)}</span>}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Top Artists */}
      {(isLoading || artists.length > 0) && (
        <section>
          <SectionHeader title={t('discovery.topArtists', 'Top Artists')} seeAllPath="/artists" />
          {isLoading ? (
            <div className="flex gap-3 px-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="w-28 h-40 shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {artists.slice(0, 10).map((artist, i) => (
                <motion.button
                  key={artist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  onClick={() => navigate(`/artists/${artist.user_id || artist.id}`)}
                  className="w-28 shrink-0 bg-[#111111] rounded-2xl border border-white/5 p-3 text-center active:scale-[0.97] transition-transform"
                >
                  <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center mb-2">
                    {artist.avatar_url ? (
                      <img src={artist.avatar_url} alt={artist.stage_name || ''} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-black">{(artist.stage_name || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <h3 className="text-white text-xs font-semibold truncate">{artist.stage_name}</h3>
                  {artist.genre && <p className="text-gray-500 text-[10px] mt-0.5 truncate">{artist.genre}</p>}
                  {(artist.followers_count ?? 0) > 0 && (
                    <p className="text-[#d3da0c] text-[10px] mt-1 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" />{artist.followers_count}
                    </p>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Top Spots */}
      {spots.length > 0 && (
        <section>
          <SectionHeader title={t('discovery.topSpots', 'Top Spots')} />
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {spots.map((spot, i) => (
              <motion.button
                key={`${spot.type}-${spot.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                onClick={() => navigate('/discovery')}
                className="relative w-40 shrink-0 h-36 rounded-2xl overflow-hidden border border-white/5 text-left active:scale-[0.97] transition-transform"
              >
                <div className="absolute inset-0 bg-white/5">
                  {spot.image && <img src={spot.image} alt={spot.name} loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[#d3da0c] text-[9px] font-bold uppercase tracking-wide border border-[#d3da0c]/30">
                  {spot.type === 'food' ? t('nav.food', 'Food') : t('cityGuide.venue', 'Venue')}
                </span>
                <div className="absolute bottom-2.5 left-3 right-3">
                  <h3 className="text-white text-xs font-semibold truncate">{spot.name}</h3>
                  {spot.address && <p className="text-gray-400 text-[10px] truncate">{spot.address}</p>}
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Top Vendors */}
      {(isLoading || vendors.length > 0) && (
        <section>
          <SectionHeader title={t('discovery.topVendors', 'Top Vendors')} seeAllPath="/vendors" />
          {isLoading ? (
            <div className="flex gap-3 px-4 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="w-44 h-24 shrink-0" />)}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {vendors.slice(0, 10).map((vendor, i) => (
                <motion.button
                  key={vendor.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  onClick={() => navigate(`/vendors/${vendor.id}`)}
                  className="w-44 shrink-0 bg-[#111111] rounded-2xl border border-white/5 p-3 flex items-center gap-3 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center shrink-0">
                    {vendor.logo_url ? (
                      <img src={vendor.logo_url} alt={vendor.business_name || ''} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Ticket className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white text-xs font-semibold truncate">{vendor.business_name}</h3>
                    {(vendor.rating ?? 0) > 0 && (
                      <p className="text-[#d3da0c] text-[11px] mt-0.5 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />{vendor.rating?.toFixed(1)}
                        <span className="text-gray-500">({vendor.reviews_count ?? 0})</span>
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default DiscoveryFeed;
