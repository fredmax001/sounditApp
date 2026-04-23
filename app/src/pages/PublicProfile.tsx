import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import {
  ChevronLeft,
  MapPin,
  Calendar,
  CheckCircle,
  Building2,
  PartyPopper,
  Loader2,
  Star,
  Users,
  Heart,
} from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';

interface PublicProfileData {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  background_url?: string;
  bio?: string;
  role: string;
  city?: string;
  is_verified: boolean;
  artist_profile?: {
    id: number;
    stage_name: string;
    genre: string;
    followers_count: number;
    events_count: number;
    is_verified: boolean;
  };
  organizer_profile?: {
    id: number;
    organization_name: string;
    description?: string;
    events_count: number;
    followers_count: number;
    is_verified: boolean;
  };
  business_profile?: {
    id: number;
    business_name: string;
    business_type?: string[];
    description?: string;
    followers_count: number;
    is_verified: boolean;
  };
  vendor_profile?: {
    id: number;
    business_name: string;
    description?: string;
    vendor_type?: string;
    rating?: number;
    reviews_count?: number;
    followers_count: number;
  };
}

interface PublicEvent {
  id: number;
  title: string;
  start_date: string;
  flyer_image?: string;
  address?: string;
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/profiles/${id}`);
        if (!res.ok) throw new Error('Profile not found');
        const data = await res.json();
        setProfile(data);

        // Fetch events if organizer
        if (data.organizer_profile) {
          const eventsRes = await fetch(`${API_BASE_URL}/profiles/${id}/events`);
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            setEvents(eventsData || []);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  // Update meta tags for social sharing
  useEffect(() => {
    if (!profile) return;
    const name = profile.business_profile?.business_name
      || profile.organizer_profile?.organization_name
      || `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      || 'Profile on Sound It';
    const title = `${name} - Sound It`;
    const description = (profile.business_profile?.description
      || profile.organizer_profile?.description
      || profile.bio
      || 'Discover amazing profiles on Sound It.').slice(0, 300);
    const image = profile.avatar_url || `${window.location.origin}/logo.png`;
    const url = `${window.location.origin}/profiles/${id}`;

    document.title = title;
    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const prop = selector.match(/property=["']([^"']+)["']/)?.[1];
        const name = selector.match(/name=["']([^"']+)["']/)?.[1];
        if (prop) el.setAttribute('property', prop);
        if (name) el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[property="og:type"]', 'profile');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);
  }, [profile, id]);

  // Check follow status for organizer/business
  useEffect(() => {
    const targetId = profile?.organizer_profile?.id || profile?.business_profile?.id;
    if (!targetId) return;
    const token = session?.access_token;
    if (!token) return;
    fetch(`${API_BASE_URL}/social/following`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data.organizers)) {
          setIsFollowing(data.organizers.some((o: { id: number }) => String(o.id) === String(targetId)));
        }
      })
      .catch(() => {});
  }, [profile]);

  const handleFollowToggle = async () => {
    const targetId = profile?.organizer_profile?.id || profile?.business_profile?.id;
    if (!targetId) return;
    const token = session?.access_token;
    if (!token || !isAuthenticated) {
      navigate('/login', { state: { from: `/profiles/${id}` } });
      return;
    }
    setFollowLoading(true);
    try {
      const url = `${API_BASE_URL}/social/organizers/${targetId}/follow`;
      const res = await fetch(url, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        // Optimistically update follower count in profile state
        setProfile(prev => {
          if (!prev) return prev;
          const updated = { ...prev };
          if (updated.organizer_profile) {
            updated.organizer_profile = {
              ...updated.organizer_profile,
              followers_count: Math.max(0, (updated.organizer_profile.followers_count || 0) + (isFollowing ? -1 : 1))
            };
          }
          if (updated.business_profile) {
            updated.business_profile = {
              ...updated.business_profile,
              followers_count: Math.max(0, (updated.business_profile.followers_count || 0) + (isFollowing ? -1 : 1))
            };
          }
          return updated;
        });
        toast.success(isFollowing ? 'Unfollowed' : 'Now following');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Follow action failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error || 'Profile not found'}</p>
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
            className="px-4 py-2 bg-[#d3da0c] text-black font-semibold rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName =
    profile.organizer_profile?.organization_name ||
    profile.business_profile?.business_name ||
    profile.vendor_profile?.business_name ||
    profile.artist_profile?.stage_name ||
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
    'Profile';

  const role = profile.organizer_profile
    ? 'organizer'
    : profile.business_profile
    ? 'business'
    : profile.vendor_profile
    ? 'vendor'
    : profile.artist_profile
    ? 'artist'
    : 'user';

  const isVerified =
    profile.business_profile?.is_verified ||
    profile.organizer_profile?.is_verified ||
    profile.artist_profile?.is_verified ||
    false;

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24">
      {/* Header / Cover */}
      <div
        className="relative h-48 md:h-64 bg-cover bg-center"
        style={{
          backgroundImage: profile.background_url
            ? `url(${profile.background_url})`
            : 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#0A0A0A]" />
        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar & Info */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-[#0A0A0A] bg-[#1a1a1a]">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black text-2xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="pb-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-white">{displayName}</h1>
              {isVerified && <VerificationBadge size="sm" />}
              {(profile.organizer_profile || profile.business_profile) && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`ml-auto md:ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    isFollowing
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                  } disabled:opacity-50`}
                >
                  <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 capitalize">
                {role}
              </span>
              {profile.city && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" />
                  {profile.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {(profile.bio || profile.organizer_profile?.description || profile.business_profile?.description || profile.vendor_profile?.description) && (
          <div className="bg-[#111111] border border-white/5 rounded-xl p-4 mb-6">
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
              {profile.bio ||
                profile.organizer_profile?.description ||
                profile.business_profile?.description ||
                profile.vendor_profile?.description}
            </p>
          </div>
        )}

        {/* Business Types */}
        {profile.business_profile?.business_type && Array.isArray(profile.business_profile.business_type) && profile.business_profile.business_type.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {profile.business_profile.business_type.map((t) => (
              <span key={t} className="text-xs px-3 py-1 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] border border-[#d3da0c]/20">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Vendor Metrics */}
        {profile.vendor_profile && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 text-sm text-gray-300 bg-[#111111] border border-white/5 px-3 py-2 rounded-lg">
              <Star className="w-4 h-4 text-[#d3da0c]" />
              <span className="font-semibold">{(profile.vendor_profile.rating || 0).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-300 bg-[#111111] border border-white/5 px-3 py-2 rounded-lg">
              <Users className="w-4 h-4 text-gray-400" />
              <span>{profile.vendor_profile.reviews_count || 0} reviews</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-300 bg-[#111111] border border-white/5 px-3 py-2 rounded-lg">
              <Users className="w-4 h-4 text-pink-400" />
              <span>{profile.vendor_profile.followers_count || 0} followers</span>
            </div>
          </div>
        )}

        {/* Organizer / Artist Metrics */}
        {(profile.organizer_profile || profile.artist_profile) && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 text-sm text-gray-300 bg-[#111111] border border-white/5 px-3 py-2 rounded-lg">
              <Calendar className="w-4 h-4 text-[#d3da0c]" />
              <span>{(role === 'organizer' ? events.length : profile.organizer_profile?.events_count) || profile.artist_profile?.events_count || 0} events</span>
            </div>
            {profile.artist_profile && (
              <div className="flex items-center gap-1.5 text-sm text-gray-300 bg-[#111111] border border-white/5 px-3 py-2 rounded-lg">
                <Users className="w-4 h-4 text-gray-400" />
                <span>{profile.artist_profile.followers_count || 0} followers</span>
              </div>
            )}
            {profile.organizer_profile && (
              <div className="flex items-center gap-1.5 text-sm text-gray-300 bg-[#111111] border border-white/5 px-3 py-2 rounded-lg">
                <Users className="w-4 h-4 text-pink-400" />
                <span>{profile.organizer_profile.followers_count || 0} followers</span>
              </div>
            )}
          </div>
        )}

        {/* Events (for organizers) */}
        {role === 'organizer' && events.length > 0 && (
          <div className="mt-6">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#d3da0c]" />
              Events
            </h2>
            <div className="space-y-3">
              {events.map((evt) => (
                <motion.div
                  key={evt.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/events/${evt.id}`)}
                  className="flex gap-3 p-3 bg-[#111111] border border-white/5 rounded-xl cursor-pointer hover:border-white/10 transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0">
                    <img
                      src={evt.flyer_image || '/placeholder-club.jpg'}
                      alt={evt.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{evt.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(evt.start_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {evt.address && (
                      <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {evt.address}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
