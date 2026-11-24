import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  CheckCircle,
  Building2,
  PartyPopper,
  Loader2,
  Star,
  Users,
  Heart,
  Share2,
  Images,
  Camera,
  Plus,
  X,
  Download,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import VerificationBadge from '@/components/VerificationBadge';
import ReviewsSection from '@/components/ReviewsSection';
import UniversalShareModal from '@/components/ui/UniversalShareModal';
import FollowButton from '@/components/social/FollowButton';
import FollowersModal from '@/components/social/FollowersModal';
import SafetyActionsMenu from '@/components/social/SafetyActionsMenu';
import { useAuthStore } from '@/store/authStore';
import { slugify } from '@/lib/slug';
import { saveImageToDevice } from '@/lib/downloadImage';

interface PublicProfileData {
  id: number;
  slug?: string;
  username?: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  background_url?: string;
  bio?: string;
  role: string;
  city?: string;
  is_verified: boolean;
  gallery_images?: string[];
  photo_album_url?: string;
  artist_profile?: {
    id: number;
    slug?: string;
    stage_name: string;
    genre: string;
    artist_type?: string;
    followers_count: number;
    events_count: number;
    is_verified: boolean;
    dj_mix_url?: string;
    dance_video_url?: string;
    music_links?: { platform: string; title: string; url: string }[];
  };
  organizer_profile?: {
    id: number;
    slug?: string;
    organization_name: string;
    description?: string;
    events_count: number;
    followers_count?: number;
    is_verified: boolean;
    gallery_images?: string[];
    photo_album_url?: string;
  };
  business_profile?: {
    id: number;
    slug?: string;
    business_name: string;
    business_type?: string[];
    description?: string;
    followers_count?: number;
    is_verified: boolean;
    gallery_images?: string[];
    photo_album_url?: string;
  };
  vendor_profile?: {
    id: number;
    slug?: string;
    business_name: string;
    description?: string;
    vendor_type?: string;
    rating?: number;
    reviews_count?: number;
    followers_count?: number;
    is_approved?: boolean;
  };
}

interface PublicEvent {
  id: number;
  slug?: string;
  title: string;
  start_date: string;
  end_date?: string;
  status?: string;
  flyer_image?: string;
  address?: string;
  city?: string;
  gallery_images?: string[];
  photo_album_url?: string;
}

interface GalleryItem {
  url: string;
  eventId?: number;
  eventTitle?: string;
  eventSlug?: string;
  eventDate?: string;
  city?: string;
  photoAlbumUrl?: string;
  sourceType: 'event' | 'profile';
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [eventTab, setEventTab] = useState<'current' | 'upcoming' | 'past'>('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'general' | number>('all');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [showFollowersModal, setShowFollowersModal] = useState<boolean>(false);
  const [followersModalTab, setFollowersModalTab] = useState<'followers' | 'following'>('followers');
  const { user } = useAuthStore();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'business';

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/profiles/${id}`);
        if (!res.ok) throw new Error('Profile not found');
        const data = await res.json();
        setProfile(data);

        // Normalize URL if accessed via numeric user ID
        const canonicalSlug = data.slug || data.organizer_profile?.slug || data.business_profile?.slug || data.artist_profile?.slug || data.vendor_profile?.slug;
        if (canonicalSlug && id !== canonicalSlug) {
          window.history.replaceState(null, '', `/profiles/${canonicalSlug}`);
        }

        // Fetch events if organizer
        if (data.organizer_profile) {
          const eventsRes = await fetch(`${API_BASE_URL}/profiles/${id}/events`);
          if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            setEvents(eventsData || []);
          }
        }

        // Fetch universal follow counts
        if (data.id) {
          fetch(`${API_BASE_URL}/social/users/${data.id}/follow-counts`)
            .then((r) => (r.ok ? r.json() : null))
            .then((counts) => {
              if (counts) {
                setFollowersCount(counts.followers_count || 0);
                setFollowingCount(counts.following_count || 0);
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  // Check follow status for organizer/business
  useEffect(() => {
    const targetId = profile?.organizer_profile?.id || profile?.business_profile?.id;
    if (!targetId) return;
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
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
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
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

  // Split organizer events into Current / Upcoming / Past
  const now = new Date();
  const upcomingEvents = events.filter((e) => {
    if (e.status === 'completed' || e.status === 'cancelled') return false;
    const start = new Date(e.start_date);
    return start > now;
  });
  const pastEvents = events.filter((e) => {
    if (e.status === 'completed') return true;
    const end = e.end_date ? new Date(e.end_date) : null;
    if (end) return end < now;
    const start = new Date(e.start_date);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    return start < sixHoursAgo;
  });
  const currentEvents = events.filter((e) => {
    if (e.status === 'completed' || e.status === 'cancelled') return false;
    const start = new Date(e.start_date);
    const end = e.end_date ? new Date(e.end_date) : new Date(start.getTime() + 6 * 60 * 60 * 1000);
    return start <= now && end >= now;
  });

  const displayedEvents =
    eventTab === 'current' ? currentEvents :
    eventTab === 'upcoming' ? upcomingEvents :
    pastEvents;

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#020b00] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-dvh bg-[#020b00] flex items-center justify-center px-4">
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

  const isOwnProfile = Boolean(
    user && profile && (String(user.id) === String(profile.id) || (profile.organizer_profile && String(user.id) === String(profile.organizer_profile.id)))
  );

  const rawGallery =
    profile.gallery_images ||
    profile.business_profile?.gallery_images ||
    profile.organizer_profile?.gallery_images ||
    [];
  const galleryImages: string[] = Array.isArray(rawGallery)
    ? rawGallery.filter((img): img is string => typeof img === 'string' && Boolean(img.trim()))
    : [];

  const profileCloudAlbum =
    profile.photo_album_url ||
    profile.business_profile?.photo_album_url ||
    profile.organizer_profile?.photo_album_url ||
    undefined;

  // Aggregate photos from events and general profile
  const eventGalleryItems: GalleryItem[] = events.flatMap(evt =>
    (evt.gallery_images || [])
      .filter((img): img is string => typeof img === 'string' && Boolean(img.trim()))
      .map(url => ({
        url,
        eventId: evt.id,
        eventTitle: evt.title,
        eventSlug: evt.slug,
        eventDate: evt.start_date,
        city: evt.city,
        photoAlbumUrl: evt.photo_album_url,
        sourceType: 'event' as const,
      }))
  );

  const profileGalleryItems: GalleryItem[] = galleryImages.map(url => ({
    url,
    eventTitle: profile.organizer_profile?.organization_name || profile.business_profile?.business_name || displayName,
    photoAlbumUrl: profileCloudAlbum,
    sourceType: 'profile' as const,
  }));

  const eventsWithMedia = events.filter(evt =>
    (evt.gallery_images && evt.gallery_images.length > 0) || Boolean(evt.photo_album_url)
  );

  const activeGalleryItems: GalleryItem[] =
    galleryFilter === 'all'
      ? [...eventGalleryItems, ...profileGalleryItems]
      : galleryFilter === 'general'
      ? profileGalleryItems
      : eventGalleryItems.filter(item => item.eventId === galleryFilter);

  const totalPhotosCount = eventGalleryItems.length + profileGalleryItems.length;

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-24 transition-colors">
      {/* Header / Cover */}
      <div className="relative h-48 md:h-64 overflow-hidden bg-neutral-100 dark:bg-[#141414]">
        {profile.background_url ? (
          <img
            src={profile.background_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#d3da0c]/15 via-transparent to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-white dark:to-[#020b00]" />
        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur-sm text-gray-800 dark:text-white hover:bg-white dark:hover:bg-black/60 shadow-sm transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Avatar & Info */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-4 mb-4">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-[#020b00] bg-neutral-100 dark:bg-[#1a1a1a] shadow-md">
            <img
              src={profile.avatar_url || '/default-avatar.png'}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/default-avatar.png';
              }}
            />
          </div>
          <div className="pb-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-[#020b00] dark:text-white">{displayName}</h1>
              {isVerified && <VerificationBadge size="sm" />}
              <div className="ml-auto flex items-center gap-2">
                <FollowButton
                  targetUserId={profile.id}
                  targetUsername={profile.username}
                  size="sm"
                  variant="pill"
                  onFollowChange={(_, delta) => {
                    setFollowersCount((prev) => Math.max(0, prev + delta));
                  }}
                />
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-neutral-100 dark:bg-white/10 text-gray-800 dark:text-white hover:bg-neutral-200 dark:hover:bg-white/20 border border-black/10 dark:border-white/10 transition-colors"
                >
                  <Share2 className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
                  <span>Share</span>
                </button>
                <SafetyActionsMenu
                  entityType="user"
                  entityId={profile.id}
                  targetUserId={profile.id}
                  targetName={displayName}
                  onBlocked={() => navigate(-1)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium capitalize">
                {role}
              </span>
              {profile.city && (
                <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 font-medium">
                  <MapPin className="w-3 h-3 text-[#020b00] dark:text-[#d3da0c]" />
                  {profile.city}
                </span>
              )}
            </div>

            {/* Followers / Following clickable counters */}
            <div className="flex items-center gap-4 mt-2.5">
              <button
                onClick={() => {
                  setFollowersModalTab('followers');
                  setShowFollowersModal(true);
                }}
                className="text-xs text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-[#d3da0c] transition-colors flex items-center gap-1 group"
              >
                <span className="font-black text-black dark:text-white group-hover:text-[#d3da0c] transition-colors">
                  {followersCount}
                </span>
                <span>Followers</span>
              </button>
              <span className="text-gray-300 dark:text-white/20">•</span>
              <button
                onClick={() => {
                  setFollowersModalTab('following');
                  setShowFollowersModal(true);
                }}
                className="text-xs text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-[#d3da0c] transition-colors flex items-center gap-1 group"
              >
                <span className="font-black text-black dark:text-white group-hover:text-[#d3da0c] transition-colors">
                  {followingCount}
                </span>
                <span>Following</span>
              </button>
            </div>
          </div>
        </div>

        {/* Description */}
        {(profile.bio || profile.organizer_profile?.description || profile.business_profile?.description || profile.vendor_profile?.description) && (
          <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-4 mb-6 shadow-xs dark:shadow-none">
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line font-medium">
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
              <span key={t} className="text-xs px-3 py-1 rounded-full bg-[#020b00]/10 dark:bg-[#d3da0c]/10 text-[#020b00] dark:text-[#d3da0c] border border-black/10 dark:border-[#d3da0c]/20 font-semibold">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Vendor Metrics */}
        {profile.vendor_profile && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 text-sm text-[#020b00] dark:text-gray-300 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 px-3 py-2 rounded-xl shadow-xs">
              <Star className="w-4 h-4 text-amber-500 dark:text-[#d3da0c] fill-current" />
              <span className="font-bold">{(profile.vendor_profile.rating || 0).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[#020b00] dark:text-gray-300 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 px-3 py-2 rounded-xl shadow-xs">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{profile.vendor_profile.reviews_count || 0} reviews</span>
            </div>
          </div>
        )}

        {/* Organizer / Artist Metrics */}
        {(profile.organizer_profile || profile.artist_profile) && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 text-sm text-[#020b00] dark:text-gray-300 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 px-3 py-2 rounded-xl shadow-xs">
              <Calendar className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
              <span className="font-bold">{(role === 'organizer' ? events.length : profile.organizer_profile?.events_count) || profile.artist_profile?.events_count || 0} events</span>
            </div>
            {profile.artist_profile && (
              <div className="flex items-center gap-1.5 text-sm text-[#020b00] dark:text-gray-300 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 px-3 py-2 rounded-xl shadow-xs">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-bold">{profile.artist_profile.followers_count || 0} followers</span>
              </div>
            )}
          </div>
        )}

        {/* Events (for organizers) */}
        {role === 'organizer' && events.length > 0 && (
          <div className="mt-6">
            <h2 className="text-[#020b00] dark:text-white font-bold text-lg mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
              Events
            </h2>
            {/* Event tabs */}
            <div className="flex gap-2 mb-3">
              {[
                { key: 'current' as const, label: 'Current' },
                { key: 'upcoming' as const, label: 'Upcoming' },
                { key: 'past' as const, label: 'Past' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setEventTab(tab.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    eventTab === tab.key
                      ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {displayedEvents.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No {eventTab} events
                </p>
              ) : (
                displayedEvents.map((evt) => (
                  <motion.div
                    key={evt.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/events/${evt.slug || slugify(evt.title) || evt.id}`)}
                    className="flex gap-3 p-3 bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl cursor-pointer hover:border-black/20 dark:hover:border-white/10 shadow-xs dark:shadow-none transition-all"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 dark:bg-[#1a1a1a] flex-shrink-0">
                      <img
                        src={evt.flyer_image || '/placeholder-club.jpg'}
                        alt={evt.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[#020b00] dark:text-white truncate">{evt.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {new Date(evt.start_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {evt.address && (
                        <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#020b00] dark:text-[#d3da0c]" />
                          {evt.address}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Gallery for Organizer and Business - Organized by Events */}
        {(totalPhotosCount > 0 || eventsWithMedia.length > 0 || (isOwnProfile && isOrganizer)) && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[#020b00] dark:text-white font-bold text-lg flex items-center gap-2">
                <Images className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
                <span>Gallery & Event Photos</span>
              </h2>
              <div className="flex items-center gap-2">
                {totalPhotosCount > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {totalPhotosCount} photo{totalPhotosCount !== 1 ? 's' : ''}
                  </span>
                )}
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/dashboard/business/profile')}
                    className="text-xs font-semibold text-[#020b00] dark:text-[#d3da0c] hover:underline"
                  >
                    Manage
                  </button>
                )}
              </div>
            </div>

            {/* Gallery by Events Filter Tabs */}
            {(eventsWithMedia.length > 0 || profileGalleryItems.length > 0) && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setGalleryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    galleryFilter === 'all'
                      ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <span>All Photos</span>
                  <span className="text-[0.625rem] opacity-75">({totalPhotosCount})</span>
                </button>

                {eventsWithMedia.map(evt => {
                  const count = evt.gallery_images?.length || 0;
                  const isSelected = galleryFilter === evt.id;
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => setGalleryFilter(evt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                          : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span className="max-w-[8.75rem] truncate">{evt.title}</span>
                      {count > 0 && <span className="text-[0.625rem] opacity-75">({count})</span>}
                    </button>
                  );
                })}

                {profileGalleryItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGalleryFilter('general')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      galleryFilter === 'general'
                        ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
                        : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <span>General Gallery</span>
                    <span className="text-[0.625rem] opacity-75">({profileGalleryItems.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* Selected Event Context Card with Cloud Link */}
            {typeof galleryFilter === 'number' && (() => {
              const selectedEvt = events.find(e => e.id === galleryFilter);
              if (!selectedEvt) return null;
              return (
                <div className="p-3.5 mb-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#020b00] dark:text-white truncate">
                      {selectedEvt.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                      <span>{new Date(selectedEvt.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {selectedEvt.city && <span>• {selectedEvt.city}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedEvt.photo_album_url && (
                      <a
                        href={selectedEvt.photo_album_url.startsWith('http') ? selectedEvt.photo_album_url : `https://${selectedEvt.photo_album_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d3da0c] text-black text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-transform"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>Open Cloud Album</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${selectedEvt.slug || slugify(selectedEvt.title) || selectedEvt.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-medium text-[#020b00] dark:text-white hover:bg-black/10 transition-colors"
                    >
                      <span>View Event</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Selected General Gallery Cloud Album Card */}
            {galleryFilter === 'general' && profileCloudAlbum && (
              <div className="p-3.5 mb-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#020b00] dark:text-white">Organizer Cloud Photo Album</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">External drive with high-resolution photos and media</p>
                </div>
                <a
                  href={profileCloudAlbum.startsWith('http') ? profileCloudAlbum : `https://${profileCloudAlbum}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d3da0c] text-black text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-transform shrink-0"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Open Cloud Album</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Photo Grid */}
            {activeGalleryItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {activeGalleryItems.map((item, idx) => (
                  <motion.div
                    key={`${item.url}-${idx}`}
                    whileTap={{ scale: 0.98 }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-neutral-100 dark:bg-[#141414] border border-black/8 dark:border-white/5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#d3da0c]"
                    onClick={() => setPreviewIndex(idx)}
                  >
                    <img
                      src={item.url}
                      alt={item.eventTitle || `Gallery photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />

                    {/* Event title tag on thumbnail */}
                    {galleryFilter === 'all' && item.eventTitle && (
                      <span className="absolute bottom-1.5 left-1.5 max-w-[85%] truncate text-[0.625rem] font-medium px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white border border-white/10 pointer-events-none">
                        {item.eventTitle}
                      </span>
                    )}

                    {/* Quick download button */}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        toast.info('Saving photo to device...');
                        const ok = await saveImageToDevice(item.url, `${slugify(item.eventTitle || 'soundit-photo')}-${idx + 1}.jpg`);
                        if (ok) toast.success('Photo saved to device');
                      }}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-xs flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:text-[#d3da0c] hover:bg-black/80 transition-all shadow-xs"
                      title="Save image to device"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl border border-dashed border-black/15 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
                <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#020b00] dark:text-white">
                  {typeof galleryFilter === 'number'
                    ? 'No photos uploaded for this event yet'
                    : 'No photos in your gallery yet'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
                  {typeof galleryFilter === 'number'
                    ? 'The organizer can connect a cloud photo album or upload photos from their dashboard.'
                    : 'Upload photos of your events, team, and venue to showcase on your profile.'}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/dashboard/business/profile')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold shadow-sm active:scale-95 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Gallery Photos</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reviews (single deduplicated section for business or organizer) */}
        {(profile.business_profile || profile.organizer_profile) && (
          <div className="mt-8">
            {profile.business_profile ? (
              <ReviewsSection
                entityId={profile.business_profile.id}
                entityType="business"
                entityName={profile.business_profile.business_name}
              />
            ) : profile.organizer_profile ? (
              <ReviewsSection
                entityId={profile.organizer_profile.id}
                entityType="organizer"
                entityName={profile.organizer_profile.organization_name}
              />
            ) : null}
          </div>
        )}

        {/* Universal Share Modal */}
        {isShareModalOpen && profile && (
          <UniversalShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            item={{
              type: role === 'business' ? 'business' : role === 'artist' ? 'artist' : role === 'vendor' ? 'vendor' : 'user',
              id: profile.id,
              slug: profile.slug || profile.organizer_profile?.slug || profile.business_profile?.slug || profile.artist_profile?.slug || profile.vendor_profile?.slug || slugify(displayName),
              title: displayName,
              subtitle: role.toUpperCase(),
              image: profile.avatar_url || (profile as any).business_profile?.avatar_url || (profile as any).vendor_profile?.logo_url || (profile as any).artist_profile?.avatar_url,
              location: profile.city,
              description: profile.bio || profile.organizer_profile?.description || profile.business_profile?.description || profile.vendor_profile?.description
            }}
          />
        )}

        {/* Universal Followers / Following Modal */}
        {showFollowersModal && profile && (
          <FollowersModal
            isOpen={showFollowersModal}
            onClose={() => setShowFollowersModal(false)}
            userId={profile.id}
            userName={displayName}
            initialTab={followersModalTab}
          />
        )}
      </div>

      {/* Gallery Fullscreen Lightbox Modal */}
      {previewIndex !== null && activeGalleryItems[previewIndex] && (() => {
        const item = activeGalleryItems[previewIndex];
        const hasPrev = previewIndex > 0;
        const hasNext = previewIndex < activeGalleryItems.length - 1;
        return (
          <div
            onClick={() => setPreviewIndex(null)}
            className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col justify-between z-[80] p-4 select-none"
          >
            {/* Top Bar */}
            <div
              className="flex items-center justify-between gap-3 text-white max-w-5xl w-full mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold truncate text-white">
                  {item.eventTitle || 'Event Gallery'}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Photo {previewIndex + 1} of {activeGalleryItems.length}</span>
                  {item.eventDate && (
                    <span>• {new Date(item.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.photoAlbumUrl && (
                  <a
                    href={item.photoAlbumUrl.startsWith('http') ? item.photoAlbumUrl : `https://${item.photoAlbumUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-colors"
                    title="Open external cloud photo album"
                  >
                    <Cloud className="w-3.5 h-3.5 text-[#d3da0c]" />
                    <span className="hidden sm:inline">Cloud Album</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    toast.info('Saving photo to device...');
                    const ok = await saveImageToDevice(item.url, `${slugify(item.eventTitle || 'soundit-photo')}-${previewIndex + 1}.jpg`);
                    if (ok) toast.success('Photo saved to device');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d3da0c] text-black text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-transform"
                  title="Download / save image to your device"
                >
                  <Download className="w-4 h-4" />
                  <span>Save to Device</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewIndex(null)}
                  className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors ml-1"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Image with Prev / Next Navigation */}
            <div
              className="relative flex-1 flex items-center justify-center my-2 max-w-5xl w-full mx-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {hasPrev && (
                <button
                  type="button"
                  onClick={() => setPreviewIndex(previewIndex - 1)}
                  className="absolute left-2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                  title="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={item.url}
                alt={item.eventTitle || 'Event photo preview'}
                className="max-w-full max-h-[78dvh] rounded-2xl object-contain shadow-2xl"
              />

              {hasNext && (
                <button
                  type="button"
                  onClick={() => setPreviewIndex(previewIndex + 1)}
                  className="absolute right-2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                  title="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Footer with Event Deep Link */}
            <div
              className="flex items-center justify-center text-xs text-gray-400 max-w-5xl w-full mx-auto pb-1"
              onClick={(e) => e.stopPropagation()}
            >
              {item.eventId ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewIndex(null);
                    navigate(`/events/${item.eventSlug || item.eventId}`);
                  }}
                  className="text-gray-300 hover:text-[#d3da0c] transition-colors underline flex items-center gap-1"
                >
                  <span>View event details for "{item.eventTitle}"</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <span>Sound It Organizer Gallery</span>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
