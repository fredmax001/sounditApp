/**
 * Reels Page (/reels) — Full-screen vertical short-form video feed
 * Supports vertical snap swipe, Like, Comment drawer, Share/Repost, Save/Bookmark,
 * Event link CTA ("Get Tickets" / "View Event"), and Upload Reel modal.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import NotificationBell from '@/components/NotificationBell';
import { toast } from 'sonner';
import VerificationBadge from '@/components/VerificationBadge';
import {
  ArrowLeft,
  Search,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Plus,
  Music2,
  MapPin,
  Ticket,
  BadgeCheck,
  Volume2,
  VolumeX,
  Send,
  X,
  Upload,
  Loader2,
  Play,
  User,
  Users,
  Calendar,
  ChevronRight,
  ChevronDown,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import RecapsSegmentNav, { type RecapsTab } from '@/components/recaps/RecapsSegmentNav';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  let cleanUrl = String(url).trim();
  if (!cleanUrl) return '';
  if (cleanUrl.startsWith('/var/www/soundit-uploads/')) {
    cleanUrl = cleanUrl.replace('/var/www/soundit-uploads/', '/static/uploads/');
  }
  if (cleanUrl.startsWith('http://sounditent.com') || cleanUrl.startsWith('http://sounditent.cn')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }
  if (cleanUrl.startsWith('/')) {
    const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    return `${base}${cleanUrl}`;
  }
  return cleanUrl;
};

const formatCount = (n: number): string => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

interface ReelItem {
  id: number;
  user_id: number;
  author: {
    id: number;
    name: string;
    username: string;
    avatar_url?: string;
    is_verified?: boolean;
    role?: string;
    artist_id?: number | null;
    organizer_id?: number | null;
  };
  video_url: string;
  thumbnail_url?: string;
  caption: string;
  hashtags: string[];
  event_id?: number | null;
  event?: {
    id: number;
    title: string;
    city?: string;
    venue_name?: string;
    start_date?: string;
    flyer_url?: string;
    ticket_price?: number;
  } | null;
  venue_name?: string;
  city?: string;
  music_title?: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  has_liked: boolean;
  has_saved: boolean;
  created_at: string;
}

const Reels = ({
  activeTab,
  onTabChange,
}: {
  activeTab?: RecapsTab;
  onTabChange?: (tab: RecapsTab) => void;
} = {}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter') || 'for_you';
  const targetReelId = searchParams.get('id');

  const { isAuthenticated, session, profile } = useAuthStore();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [followedUsers, setFollowedUsers] = useState<Record<number, boolean>>({});

  // Comments Drawer State
  const [commentReel, setCommentReel] = useState<ReelItem | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Create Reel Modal State
  const { events, fetchEvents } = useEventStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newThumbUrl, setNewThumbUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newMusic, setNewMusic] = useState('Original Sound');
  const [newTaggedPeople, setNewTaggedPeople] = useState('');
  const [newTaggedEventId, setNewTaggedEventId] = useState('');
  const [newAudience, setNewAudience] = useState<'For You' | 'Following' | 'Public'>('For You');
  const [shareToCommunity, setShareToCommunity] = useState(true);
  const [videoDuration, setVideoDuration] = useState('0:45');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [showAudiencePicker, setShowAudiencePicker] = useState(false);
  const [creatingReel, setCreatingReel] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const fetchReels = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_BASE_URL}/reels?filter=${encodeURIComponent(filterParam)}&limit=30`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        const list: ReelItem[] = data.reels || [];
        if (targetReelId) {
          const idx = list.findIndex((r) => String(r.id) === String(targetReelId));
          if (idx > 0) {
            const [picked] = list.splice(idx, 1);
            list.unshift(picked);
          }
        }
        setReels(list);
      }
    } catch {
      // fallback if offline
    } finally {
      setLoading(false);
    }
  }, [filterParam, targetReelId, session?.access_token]);

  useEffect(() => {
    fetchReels();
  }, [fetchReels]);

  // Play active video, pause others
  useEffect(() => {
    reels.forEach((reel, idx) => {
      const vid = videoRefs.current[reel.id];
      if (!vid) return;
      if (idx === activeIndex) {
        vid.muted = isMuted;
        vid.play().catch(() => {});
        fetch(`${API_BASE_URL}/reels/${reel.id}/view`, { method: 'POST' }).catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, [activeIndex, reels, isMuted]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    if (clientHeight > 0) {
      const idx = Math.round(scrollTop / clientHeight);
      if (idx !== activeIndex && idx >= 0 && idx < reels.length) {
        setActiveIndex(idx);
      }
    }
  };

  const handleLike = async (reel: ReelItem) => {
    if (!isAuthenticated || !session?.access_token) {
      toast.info('Please sign in to like reels');
      navigate('/login');
      return;
    }
    const optimisticLiked = !reel.has_liked;
    setReels((prev) =>
      prev.map((r) =>
        r.id === reel.id
          ? {
              ...r,
              has_liked: optimisticLiked,
              likes_count: Math.max(0, r.likes_count + (optimisticLiked ? 1 : -1)),
            }
          : r
      )
    );

    try {
      const res = await fetch(`${API_BASE_URL}/reels/${reel.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReels((prev) =>
          prev.map((r) =>
            r.id === reel.id ? { ...r, has_liked: data.liked, likes_count: data.likes_count } : r
          )
        );
      }
    } catch {
      // keep optimistic
    }
  };

  const handleSave = async (reel: ReelItem) => {
    if (!isAuthenticated || !session?.access_token) {
      toast.info('Please sign in to save reels');
      navigate('/login');
      return;
    }
    const optimisticSaved = !reel.has_saved;
    setReels((prev) =>
      prev.map((r) =>
        r.id === reel.id
          ? {
              ...r,
              has_saved: optimisticSaved,
              saves_count: Math.max(0, r.saves_count + (optimisticSaved ? 1 : -1)),
            }
          : r
      )
    );
    toast.success(optimisticSaved ? 'Saved to your Reels' : 'Removed from saved');

    try {
      await fetch(`${API_BASE_URL}/reels/${reel.id}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // silent
    }
  };

  const handleShare = async (reel: ReelItem) => {
    try {
      await fetch(`${API_BASE_URL}/reels/${reel.id}/share`, { method: 'POST' });
      setReels((prev) =>
        prev.map((r) => (r.id === reel.id ? { ...r, shares_count: r.shares_count + 1 } : r))
      );
      if (session?.access_token) {
        fetch(`${API_BASE_URL}/points/earn`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action_key: 'share_event', reference_type: 'reel', reference_id: reel.id }),
        }).catch(() => {});
      }
      const shareUrl = `${window.location.origin}/reels?id=${reel.id}`;
      if (navigator.share) {
        await navigator.share({
          title: `${reel.author.name} on Sound It Reels`,
          text: reel.caption,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Reel link copied to clipboard');
      }
    } catch {
      // user cancelled share sheet
    }
  };

  const openComments = async (reel: ReelItem) => {
    setCommentReel(reel);
    setLoadingComments(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reels/${reel.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentReel || !commentText.trim()) return;
    if (!isAuthenticated || !session?.access_token) {
      toast.info('Please sign in to comment');
      navigate('/login');
      return;
    }
    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reels/${commentReel.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [newComment, ...prev]);
        setCommentText('');
        setReels((prev) =>
          prev.map((r) =>
            r.id === commentReel.id
              ? { ...r, comments_count: newComment.comments_count || r.comments_count + 1 }
              : r
          )
        );
      }
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const isVideo = file.type.startsWith('video/');
      const endpoint = `${API_BASE_URL}/media/upload`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (isVideo) {
        setNewVideoUrl(data.url || data.file_url);
      } else {
        setNewThumbUrl(data.url || data.file_url);
      }
      toast.success('Media uploaded');
    } catch {
      toast.error('Failed to upload media');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleCreateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) {
      navigate('/login');
      return;
    }
    if (!newVideoUrl && !newThumbUrl) {
      toast.error('Please upload a video or cover image for your Reel');
      return;
    }
    setCreatingReel(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          video_url: newVideoUrl || newThumbUrl,
          thumbnail_url: newThumbUrl || '/onboarding/screen3-event.png',
          caption: newCaption.trim() || 'Afro Night Recap #SoundIt #AfroInChina',
          venue_name: newVenue.trim() || undefined,
          music_title: newMusic.trim() || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setReels((prev) => [created, ...prev]);
        setActiveIndex(0);
        setShowCreateModal(false);
        setNewVideoUrl('');
        setNewThumbUrl('');
        setNewCaption('');
        setNewVenue('');
        setNewMusic('');
        toast.success('Reel published!');
      } else {
        toast.error('Failed to publish Reel');
      }
    } catch {
      toast.error('Failed to publish Reel');
    } finally {
      setCreatingReel(false);
    }
  };

  const handleFollowCreator = async (author: ReelItem['author']) => {
    if (!isAuthenticated || !session?.access_token) {
      navigate('/login');
      return;
    }
    setFollowedUsers((prev) => ({ ...prev, [author.id]: !prev[author.id] }));
    toast.success(followedUsers[author.id] ? `Unfollowed @${author.username}` : `Following @${author.username}`);
    if (author.artist_id) {
      fetch(`${API_BASE_URL}/social/artists/${author.artist_id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
  };

  return (
    <div className="relative h-[100dvh] w-full bg-black text-white overflow-hidden select-none">
      {/* Top-Left Floating Back Button (No tabs, no search, no notification bell, no profile) */}
      <div className="fixed top-0 left-0 z-40 safe-area-pt p-3 sm:p-4 pointer-events-auto">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all shadow-lg hover:border-[#d3da0c]/50"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Vertical Snap Scroll Feed */}
      {loading ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-[#020B00]">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          <p className="text-xs text-gray-400">Loading Reels...</p>
        </div>
      ) : reels.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center px-6 text-center bg-[#020B00]">
          <Play className="w-12 h-12 text-[#d3da0c] mb-3" />
          <h2 className="text-lg font-extrabold">No Reels Found</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Be the first to share an event recap, DJ set, or nightlife highlight!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-5 px-6 py-3 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs"
          >
            Create First Reel
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
          {reels.map((reel) => {
            const videoSrc = resolveMediaUrl(reel.video_url);
            const posterSrc = resolveMediaUrl(reel.thumbnail_url) || '/onboarding/screen3-event.png';
            const isVideoFile =
              videoSrc &&
              (videoSrc.endsWith('.mp4') ||
                videoSrc.endsWith('.mov') ||
                videoSrc.endsWith('.webm') ||
                videoSrc.includes('/video'));
            const isFollowing = Boolean(followedUsers[reel.author.id]);

            return (
              <div
                key={reel.id}
                className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-[#020B00] overflow-hidden"
              >
                {/* Background Video or High-Res Visual */}
                {isVideoFile ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[reel.id] = el;
                    }}
                    src={videoSrc}
                    poster={posterSrc}
                    loop
                    playsInline
                    muted={isMuted}
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <motion.img
                    src={posterSrc}
                    alt={reel.caption}
                    initial={{ scale: 1.0 }}
                    animate={{ scale: 1.06 }}
                    transition={{ duration: 12, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/onboarding/screen3-event.png';
                    }}
                  />
                )}

                {/* Subtle Dark Gradient Vignettes for Readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 pointer-events-none" />

                {/* Mute / Unmute Indicator Pill */}
                {isVideoFile && (
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="absolute top-20 right-4 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#d3da0c]" />}
                  </button>
                )}

                {/* Right-Side Action Rail matching reference screenshot */}
                <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-5">
                  {/* Like */}
                  <button
                    onClick={() => handleLike(reel)}
                    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 flex items-center justify-center">
                      <Heart
                        className={`w-6 h-6 transition-colors ${
                          reel.has_liked ? 'text-red-500 fill-red-500' : 'text-white'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow">
                      {formatCount(reel.likes_count)}
                    </span>
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => openComments(reel)}
                    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow">
                      {formatCount(reel.comments_count)}
                    </span>
                  </button>

                  {/* Share / Repost */}
                  <button
                    onClick={() => handleShare(reel)}
                    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 flex items-center justify-center">
                      <Share2 className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow">
                      {formatCount(reel.shares_count)}
                    </span>
                  </button>

                  {/* Save / Bookmark */}
                  <button
                    onClick={() => handleSave(reel)}
                    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 flex items-center justify-center">
                      <Bookmark
                        className={`w-6 h-6 transition-colors ${
                          reel.has_saved ? 'text-[#d3da0c] fill-[#d3da0c]' : 'text-white'
                        }`}
                      />
                    </div>
                  </button>

                  {/* Create / Upload Reel Button */}
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate('/login');
                        return;
                      }
                      setShowCreateModal(true);
                    }}
                    className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                    title="Upload Reel"
                  >
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>

                {/* Bottom-Left Creator & Event Info Overlay */}
                <div className="absolute left-4 right-20 bottom-28 z-20 space-y-2.5">
                  {/* Creator Handle + Follow */}
                  <div className="flex items-center gap-2.5">
                    <div
                      onClick={() => navigate(`/profiles/${reel.author.id || 1}`)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full border border-[#d3da0c] overflow-hidden bg-black">
                        <img
                          src={resolveMediaUrl(reel.author.avatar_url) || '/default-avatar.png'}
                          alt={reel.author.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/default-avatar.png';
                          }}
                        />
                      </div>
                      <span className="text-base font-extrabold text-white drop-shadow">
                        @{reel.author.username}
                      </span>
                      {reel.author.is_verified && (
                        <VerificationBadge size="sm" className="shrink-0" />
                      )}
                    </div>

                    <span className="text-gray-400">•</span>
                    <button
                      onClick={() => handleFollowCreator(reel.author)}
                      className="text-sm font-extrabold text-[#d3da0c] hover:underline"
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>

                  {/* Caption & Hashtags */}
                  <p className="text-sm text-gray-100 leading-snug line-clamp-2 drop-shadow">
                    {reel.caption}
                  </p>
                  {reel.hashtags && reel.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {reel.hashtags.map((tag) => (
                        <span key={tag} className="text-xs font-bold text-[#d3da0c]">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Venue & Music Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 pt-0.5">
                    {reel.venue_name && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#d3da0c]" />
                        <span>{reel.venue_name}</span>
                      </div>
                    )}
                    {reel.music_title && (
                      <div className="flex items-center gap-1 max-w-[12.5rem] truncate">
                        <Music2 className="w-3.5 h-3.5 text-[#d3da0c] shrink-0" />
                        <span className="truncate">{reel.music_title}</span>
                      </div>
                    )}
                  </div>

                  {/* Linked Event Ticket CTA */}
                  {reel.event && (
                    <div className="pt-1">
                      <button
                        onClick={() => navigate(`/events/${reel.event!.id}`)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d3da0c] text-black text-xs font-extrabold shadow-lg shadow-[#d3da0c]/25 active:scale-95 transition-transform"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Get Tickets • {reel.event.title}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comments Bottom Drawer */}
      <AnimatePresence>
        {commentReel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommentReel(null)}
              className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              data-modal-open="true"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                bottom: 'var(--keyboard-offset, 0px)',
                maxHeight: 'min(75dvh, calc(var(--vvh, 100dvh) - 1.5rem))',
              }}
              className="fixed left-0 right-0 z-[80] bg-[#0a1408] border-t border-white/15 rounded-t-3xl flex flex-col text-white safe-area-pb transition-[bottom] duration-150"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-extrabold">
                  Comments ({commentReel.comments_count})
                </h3>
                <button
                  onClick={() => setCommentReel(null)}
                  className="p-1.5 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments ? (
                  <div className="py-10 flex justify-center">
                    <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-10">
                    No comments yet. Start the conversation!
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-3">
                      <img
                        src={resolveMediaUrl(c.author?.avatar_url) || '/default-avatar.png'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-white/15 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">
                            @{c.author?.username || 'user'}
                          </span>
                          {c.author?.is_verified && (
                            <VerificationBadge size="xs" className="shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-200 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handlePostComment}
                className="p-3 border-t border-white/10 flex items-center gap-2 bg-[#060d04]"
              >
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-[#d3da0c]"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="w-10 h-10 rounded-full bg-[#d3da0c] text-black flex items-center justify-center disabled:opacity-50"
                >
                  {submittingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dedicated Full-Screen Upload Reel Experience matching Reference Visual */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[120] bg-[#020B00] text-white overflow-y-auto overscroll-contain"
          >
            <div className="min-h-full flex flex-col max-w-xl mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
              {/* Top Bar: Close (X) | Upload Reel | Publish Button */}
              <div className="flex items-center justify-between h-12 pb-2 border-b border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
                  aria-label="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>

                <h2 className="text-[1.0625rem] font-bold text-white tracking-tight">Upload Reel</h2>

                <button
                  type="button"
                  onClick={handleCreateReel}
                  disabled={creatingReel || uploadingVideo || (!newVideoUrl && !newThumbUrl)}
                  className="px-5 py-1.5 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-[0_0_12px_rgba(211,218,12,0.35)] hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                >
                  {creatingReel ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing...</span>
                    </span>
                  ) : (
                    'Publish'
                  )}
                </button>
              </div>

              {/* Video Preview Card & Edit Cover Button */}
              <div className="flex items-center gap-3">
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="relative w-48 h-28 sm:w-56 sm:h-32 rounded-2xl overflow-hidden bg-[#11150E] border border-white/15 cursor-pointer group shrink-0"
                >
                  {newThumbUrl || newVideoUrl ? (
                    <img
                      src={newThumbUrl || '/onboarding/screen3-event.png'}
                      alt="Reel Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 bg-gradient-to-tr from-[#11150E] to-[#1c2417]">
                      <Upload className="w-6 h-6 text-[#d3da0c]" />
                      <span className="text-[0.6875rem] font-bold text-gray-300 text-center">Select Video</span>
                    </div>
                  )}

                  {/* Central Play Triangle Icon */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Duration Badge in Bottom Right */}
                  <span className="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded-md bg-black/75 text-[0.625rem] font-mono text-gray-200">
                    {videoDuration}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#11150E] border border-white/15 text-xs font-semibold text-gray-200 hover:border-[#d3da0c] transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                    <span>Edit Cover</span>
                  </button>
                  <p className="text-[0.6875rem] text-gray-400 leading-snug">
                    Select a high-resolution frame or upload a custom visual cover.
                  </p>
                </div>
              </div>

              {/* Upload Progress Bar if active */}
              {uploadingVideo && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#d3da0c] font-semibold flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading Reel Video...
                    </span>
                    <span className="text-gray-400 font-mono">Processing</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#d3da0c] animate-pulse w-3/4 rounded-full" />
                  </div>
                </div>
              )}

              {/* Caption Textarea with 0 / 2,200 Counter */}
              <div className="bg-[#11150E] border border-white/10 rounded-2xl p-3.5 space-y-2">
                <textarea
                  rows={3}
                  maxLength={2200}
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none"
                />
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[0.6875rem] text-gray-500">
                  <span>Use hashtags to reach more entertainment fans</span>
                  <span className="font-mono">{newCaption.length} / 2,200</span>
                </div>
              </div>

              {/* Quick Hashtags Row matching Reference Visual */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {['#AfroNight', '#SoundIt', '#Shanghai'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!newCaption.includes(tag)) {
                        setNewCaption((prev) => (prev ? `${prev} ${tag}` : tag));
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#11150E] border border-white/10 text-xs font-semibold text-gray-300 hover:border-[#d3da0c] hover:text-[#d3da0c] transition-colors shrink-0"
                  >
                    {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const customTag = prompt('Enter hashtag (e.g. #Amipiano, #Beijing):');
                    if (customTag) {
                      const formatted = customTag.startsWith('#') ? customTag : `#${customTag}`;
                      setNewCaption((prev) => (prev ? `${prev} ${formatted}` : formatted));
                    }
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-400 hover:text-white transition-colors shrink-0"
                >
                  + Add
                </button>
              </div>

              {/* 5 Metadata Rows with Yellow Lucide Icons matching Reference Visual */}
              <div className="space-y-1.5 pt-1">
                {/* 1. Add Location */}
                <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-[#d3da0c]" />
                      <span className="font-semibold">
                        {newVenue ? `Location: ${newVenue}` : 'Add Location'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  {showLocationPicker && (
                    <div className="p-3 pt-0 flex gap-2">
                      <input
                        type="text"
                        value={newVenue}
                        onChange={(e) => setNewVenue(e.target.value)}
                        placeholder="The Loft Shanghai, Bounce Club, Sanlitun..."
                        className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#d3da0c]"
                      />
                      {newVenue && (
                        <button
                          type="button"
                          onClick={() => setNewVenue('')}
                          className="px-2.5 text-xs text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Tag Event */}
                <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      fetchEvents();
                      setShowEventPicker((prev) => !prev);
                    }}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-[#d3da0c]" />
                      <span className="font-semibold">
                        {newTaggedEventId
                          ? `Event: ${events.find((e) => String(e.id) === newTaggedEventId)?.title || 'Selected'}`
                          : 'Tag Event'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  {showEventPicker && (
                    <div className="p-3 pt-0">
                      <select
                        value={newTaggedEventId}
                        onChange={(e) => setNewTaggedEventId(e.target.value)}
                        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#d3da0c]"
                      >
                        <option value="">No event selected</option>
                        {events.map((evt) => (
                          <option key={evt.id} value={String(evt.id)}>
                            {evt.title} ({evt.city})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 3. Add Audio / Track */}
                <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAudioPicker((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Music2 className="w-4 h-4 text-[#d3da0c]" />
                      <span className="font-semibold">
                        {newMusic ? `Audio: ${newMusic}` : 'Add Audio / Track'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  {showAudioPicker && (
                    <div className="p-3 pt-0 flex gap-2">
                      <input
                        type="text"
                        value={newMusic}
                        onChange={(e) => setNewMusic(e.target.value)}
                        placeholder="Song Title · Artist Name or Original Sound"
                        className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Tag People */}
                <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPeoplePicker((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-[#d3da0c]" />
                      <span className="font-semibold">
                        {newTaggedPeople ? `Tagged: ${newTaggedPeople}` : 'Tag People'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  {showPeoplePicker && (
                    <div className="p-3 pt-0 flex gap-2">
                      <input
                        type="text"
                        value={newTaggedPeople}
                        onChange={(e) => setNewTaggedPeople(e.target.value)}
                        placeholder="@username, @djkeno, @afrochina..."
                        className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#d3da0c]"
                      />
                    </div>
                  )}
                </div>

                {/* 5. Audience */}
                <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAudiencePicker((prev) => !prev)}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-[#d3da0c]" />
                      <span className="font-semibold">Audience</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 font-semibold">
                      <span>{newAudience}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                  {showAudiencePicker && (
                    <div className="p-3 pt-0 grid grid-cols-3 gap-2">
                      {(['For You', 'Following', 'Public'] as const).map((aud) => (
                        <button
                          key={aud}
                          type="button"
                          onClick={() => {
                            setNewAudience(aud);
                            setShowAudiencePicker(false);
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all ${
                            newAudience === aud
                              ? 'bg-[#d3da0c] text-black'
                              : 'bg-white/5 text-gray-300'
                          }`}
                        >
                          {aud}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Also Share to Community Feed Switch matching Reference Visual */}
              <div className="bg-[#11150E] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Also Share to Community Feed</p>
                  <p className="text-[0.6875rem] text-gray-400 mt-0.5">
                    Broaden reach by broadcasting this Reel into the social feed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareToCommunity((prev) => !prev)}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    shareToCommunity ? 'bg-[#d3da0c]' : 'bg-white/20'
                  }`}
                  aria-label="Toggle share to community feed"
                >
                  <div
                    className={`w-6 h-6 rounded-full transition-transform ${
                      shareToCommunity ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white'
                    }`}
                  />
                </button>
              </div>

              {/* Bottom Actions: Save Draft & Publish Reel */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    toast.success('Reel draft saved');
                    setShowCreateModal(false);
                  }}
                  className="py-3 rounded-full bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-colors"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={handleCreateReel}
                  disabled={creatingReel || uploadingVideo || (!newVideoUrl && !newThumbUrl)}
                  className="py-3 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-lg shadow-[#d3da0c]/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                >
                  {creatingReel ? 'Publishing...' : 'Publish Reel'}
                </button>
              </div>

              {/* Hidden File Inputs */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*,image/*"
                className="hidden"
                onChange={handleVideoFileUpload}
              />
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleVideoFileUpload}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Reels;
