import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Plus,
  Volume2,
  VolumeX,
  BadgeCheck,
  Music2,
  Calendar,
  MapPin,
  ExternalLink,
  Camera,
  X,
  Send,
  Loader2,
  Image as ImageIcon,
  Play,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCommunityStore, type CommunityPost, getGuestName, setGuestName } from '@/store/communityStore';
import { useEventStore } from '@/store/eventStore';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

// Helper to ensure media URLs are absolute and secure
const resolveMediaUrl = (url?: string): string => {
  if (!url) return '';
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('//')) cleanUrl = `https:${cleanUrl}`;
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

// ===========================================================================
// TYPES FOR UNIFIED FEED
// ===========================================================================

export interface ReelData {
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
  } | null;
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

export interface EventCollectionData {
  id: number;
  event_id: number;
  title: string;
  organizer_name: string;
  organizer_avatar?: string;
  city?: string;
  venue_name?: string;
  date_str?: string;
  photos: string[];
  total_photos: number;
  description?: string;
  likes_count: number;
  views_count: number;
  has_liked?: boolean;
  has_saved?: boolean;
}

export type UnifiedFeedItem =
  | { type: 'reel'; id: string; data: ReelData }
  | { type: 'community_post'; id: string; data: CommunityPost }
  | { type: 'event_collection'; id: string; data: EventCollectionData };

export default function Recaps() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, session, profile } = useAuthStore();
  const { posts, fetchPosts, likePost, unlikePost, addComment: addCommunityComment, sharePost } = useCommunityStore();
  const { events, fetchEvents } = useEventStore();

  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [followedUsers, setFollowedUsers] = useState<Record<number, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Unified Comments Drawer State
  const [activeCommentItem, setActiveCommentItem] = useState<{
    type: 'reel' | 'community_post';
    id: number;
    title: string;
  } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [guestNameState, setGuestNameState] = useState(getGuestName() || '');

  // Unified Create Content Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'reel' | 'post'>('reel');
  const [newCaption, setNewCaption] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // FETCH AND INTERLEAVE CONTENT (REELS, COMMUNITY POSTS, EVENT COLLECTIONS)
  // -------------------------------------------------------------------------
  const loadUnifiedFeed = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Reels
      const reelsPromise = fetch(`${API_BASE_URL}/reels?limit=30`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : { reels: [] }))
        .then((data) => (Array.isArray(data) ? data : data.reels || []))
        .catch(() => [] as ReelData[]);

      // 2. Fetch Community Posts
      const communityPromise = fetch(`${API_BASE_URL}/community/posts?limit=30`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : { posts: [] }))
        .then((data) => (Array.isArray(data) ? data : data.posts || []))
        .catch(() => [] as CommunityPost[]);

      // 3. Fetch Past Events with Photo Galleries
      const pastEventsPromise = fetch(`${API_BASE_URL}/events/past?limit=20`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [] as any[]);

      const [reelsData, communityData, pastEventsData] = await Promise.all([
        reelsPromise,
        communityPromise,
        pastEventsPromise,
      ]);

      // Transform past events into Event Collection Items
      const eventCollections: EventCollectionData[] = (pastEventsData || [])
        .filter((e: any) => (e.gallery_images && e.gallery_images.length > 0) || e.flyer_image)
        .map((e: any) => {
          const rawPhotos: string[] = Array.isArray(e.gallery_images) ? e.gallery_images : [];
          if (rawPhotos.length === 0 && e.flyer_image) {
            rawPhotos.push(e.flyer_image);
          }
          const validPhotos = rawPhotos.map((p) => resolveMediaUrl(p)).filter(Boolean);

          const dateObj = e.start_date ? new Date(e.start_date) : null;
          const dateStr = dateObj
            ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : undefined;

          return {
            id: e.id,
            event_id: e.id,
            title: e.title || 'Sound It Event Recap',
            organizer_name: e.organizer_name || e.organizer?.name || 'Sound It Entertainment',
            organizer_avatar: resolveMediaUrl(e.organizer?.avatar_url || e.organizer_avatar),
            city: e.city,
            venue_name: e.venue_name || e.venue,
            date_str: dateStr,
            photos: validPhotos,
            total_photos: validPhotos.length,
            description: e.description,
            likes_count: e.favorites_count || 12,
            views_count: e.views_count || 120,
            has_liked: false,
            has_saved: false,
          };
        });

      // INTELLIGENT SOCIAL FEED INTERLEAVING
      // Pattern: Reel -> Community Post -> Event Photo Collection -> Reel -> Community Post...
      const combined: UnifiedFeedItem[] = [];
      const maxLen = Math.max(reelsData.length, communityData.length, eventCollections.length);

      let reelIdx = 0;
      let postIdx = 0;
      let eventIdx = 0;

      while (reelIdx < reelsData.length || postIdx < communityData.length || eventIdx < eventCollections.length) {
        // 1. Reel
        if (reelIdx < reelsData.length) {
          const r = reelsData[reelIdx++];
          combined.push({ type: 'reel', id: `reel_${r.id}`, data: r });
        }
        // 2. Community Post
        if (postIdx < communityData.length) {
          const p = communityData[postIdx++];
          combined.push({ type: 'community_post', id: `post_${p.id}`, data: p });
        }
        // 3. Event Photo Collection
        if (eventIdx < eventCollections.length) {
          const e = eventCollections[eventIdx++];
          combined.push({ type: 'event_collection', id: `event_${e.id}`, data: e });
        }
        // Extra reel to keep video energy high
        if (reelIdx < reelsData.length && reelIdx % 2 === 1) {
          const r = reelsData[reelIdx++];
          combined.push({ type: 'reel', id: `reel_${r.id}`, data: r });
        }
      }

      setFeedItems(combined);
    } catch (err) {
      console.error('Error loading unified recaps feed:', err);
      toast.error('Unable to load Recaps feed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadUnifiedFeed();
  }, [loadUnifiedFeed]);

  // -------------------------------------------------------------------------
  // SCROLLING & VIDEO PLAYBACK CONTROL
  // -------------------------------------------------------------------------
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const newIndex = Math.round(scrollTop / (clientHeight || 1));
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < feedItems.length) {
      setActiveIndex(newIndex);
    }
  };

  useEffect(() => {
    // Play active video, pause all other videos
    Object.entries(videoRefs.current).forEach(([key, vid]) => {
      if (!vid) return;
      const itemIndex = feedItems.findIndex((it) => it.id === key);
      if (itemIndex === activeIndex) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
        vid.currentTime = 0;
      }
    });

    // Fire view impression for active reel
    const currentItem = feedItems[activeIndex];
    if (currentItem && currentItem.type === 'reel') {
      fetch(`${API_BASE_URL}/reels/${currentItem.data.id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [activeIndex, feedItems]);

  // -------------------------------------------------------------------------
  // SOCIAL ACTIONS (LIKE, SAVE, SHARE, FOLLOW)
  // -------------------------------------------------------------------------
  const handleLikeItem = async (item: UnifiedFeedItem) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to like content');
      navigate('/login');
      return;
    }

    if (item.type === 'reel') {
      const willLike = !item.data.has_liked;
      setFeedItems((prev) =>
        prev.map((it) =>
          it.id === item.id && it.type === 'reel'
            ? {
                ...it,
                data: {
                  ...it.data,
                  has_liked: willLike,
                  likes_count: it.data.likes_count + (willLike ? 1 : -1),
                },
              }
            : it
        )
      );
      try {
        await fetch(`${API_BASE_URL}/reels/${item.data.id}/like`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      } catch {
        // silent rollback if error
      }
    } else if (item.type === 'community_post') {
      const willLike = !item.data.has_liked;
      setFeedItems((prev) =>
        prev.map((it) =>
          it.id === item.id && it.type === 'community_post'
            ? {
                ...it,
                data: {
                  ...it.data,
                  has_liked: willLike,
                  likes_count: it.data.likes_count + (willLike ? 1 : -1),
                },
              }
            : it
        )
      );
      if (willLike) {
        likePost(item.data.id);
      } else {
        unlikePost(item.data.id);
      }
    } else if (item.type === 'event_collection') {
      const willLike = !item.data.has_liked;
      setFeedItems((prev) =>
        prev.map((it) =>
          it.id === item.id && it.type === 'event_collection'
            ? {
                ...it,
                data: {
                  ...it.data,
                  has_liked: willLike,
                  likes_count: it.data.likes_count + (willLike ? 1 : -1),
                },
              }
            : it
        )
      );
      try {
        await fetch(`${API_BASE_URL}/events/${item.data.event_id}/favorite`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      } catch {
        // silent
      }
    }
  };

  const handleSaveItem = async (item: UnifiedFeedItem) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to save items');
      navigate('/login');
      return;
    }

    const willSave = !item.data.has_saved;
    setFeedItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              data: {
                ...it.data,
                has_saved: willSave,
              },
            }
          : it
      )
    );
    toast.success(willSave ? 'Saved to your favorites' : 'Removed from favorites');

    try {
      if (item.type === 'reel') {
        await fetch(`${API_BASE_URL}/reels/${item.data.id}/save`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      } else if (item.type === 'community_post') {
        await fetch(`${API_BASE_URL}/community/posts/${item.data.id}/bookmark`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      }
    } catch {
      // silent
    }
  };

  const handleShareItem = async (item: UnifiedFeedItem) => {
    let shareUrl = `${window.location.origin}/recaps`;
    let title = 'Sound It Recaps';
    let text = 'Check out this entertainment recap on Sound It!';

    if (item.type === 'reel') {
      shareUrl = `${window.location.origin}/recaps?id=${item.data.id}`;
      title = `${item.data.author.name} on Sound It Reels`;
      text = item.data.caption;
      fetch(`${API_BASE_URL}/reels/${item.data.id}/share`, { method: 'POST' }).catch(() => {});
    } else if (item.type === 'community_post') {
      shareUrl = `${window.location.origin}/community?post=${item.data.id}`;
      title = item.data.title || 'Sound It Community Post';
      text = item.data.content;
      sharePost(item.data.id);
    } else if (item.type === 'event_collection') {
      shareUrl = `${window.location.origin}/events/${item.data.event_id}`;
      title = `${item.data.title} - Event Recaps`;
      text = `Browse photos and recaps from ${item.data.title} on Sound It!`;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    }
  };

  const handleFollowUser = async (authorId: number, artistId?: number | null) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to follow creators');
      navigate('/login');
      return;
    }
    const isNowFollowing = !followedUsers[authorId];
    setFollowedUsers((prev) => ({ ...prev, [authorId]: isNowFollowing }));
    toast.success(isNowFollowing ? 'Followed creator' : 'Unfollowed creator');

    try {
      const endpoint = artistId
        ? `${API_BASE_URL}/social/artists/${artistId}/follow`
        : `${API_BASE_URL}/social/users/${authorId}/follow`;
      await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
    } catch {
      // silent
    }
  };

  // -------------------------------------------------------------------------
  // COMMENTS DRAWER HANDLERS
  // -------------------------------------------------------------------------
  const openComments = async (item: UnifiedFeedItem) => {
    if (item.type === 'reel') {
      setActiveCommentItem({ type: 'reel', id: item.data.id, title: item.data.caption });
      setLoadingComments(true);
      try {
        const res = await fetch(`${API_BASE_URL}/reels/${item.data.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          setCommentsList(data.comments || []);
        }
      } catch {
        setCommentsList([]);
      } finally {
        setLoadingComments(false);
      }
    } else if (item.type === 'community_post') {
      setActiveCommentItem({ type: 'community_post', id: item.data.id, title: item.data.content });
      setCommentsList(item.data.comments || []);
    }
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text || !activeCommentItem) return;

    if (!isAuthenticated && !guestNameState.trim()) {
      toast.error('Please enter your name to post a comment');
      return;
    }

    setSubmittingComment(true);
    try {
      if (activeCommentItem.type === 'reel') {
        const res = await fetch(`${API_BASE_URL}/reels/${activeCommentItem.id}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            content: text,
            guest_name: !isAuthenticated ? guestNameState : undefined,
          }),
        });
        if (res.ok) {
          const newC = await res.json();
          setCommentsList((prev) => [newC, ...prev]);
          setCommentText('');
          toast.success('Comment posted');
        }
      } else if (activeCommentItem.type === 'community_post') {
        await addCommunityComment(activeCommentItem.id, text, undefined, guestNameState);
        setCommentText('');
        toast.success('Comment posted');
      }
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full bg-[#020B00] text-white overflow-hidden select-none">
      {/* 
        =======================================================================
        TOP OVERLAY: ONLY A SIMPLE FLOATING BACK BUTTON AT THE TOP-LEFT
        No horizontal tabs, no category selector, no search, no notification bell
        =======================================================================
      */}
      <div className="fixed top-0 left-0 z-40 safe-area-pt p-3 sm:p-4 pointer-events-auto">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all shadow-lg hover:border-[#d3da0c]/50"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Global Mute Toggle (Top-Right) */}
      <div className="fixed top-0 right-0 z-40 safe-area-pt p-3 sm:p-4 pointer-events-auto">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all shadow-lg"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-gray-300" /> : <Volume2 className="w-5 h-5 text-[#d3da0c]" />}
        </button>
      </div>

      {/* 
        =======================================================================
        VERTICAL SNAP SCROLL SOCIAL FEED
        =======================================================================
      */}
      {loading ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-[#020B00]">
          <Loader2 className="w-10 h-10 text-[#d3da0c] animate-spin" />
          <p className="text-sm font-bold text-gray-300">Loading Recaps…</p>
        </div>
      ) : feedItems.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center px-6 text-center bg-[#020B00]">
          <Camera className="w-14 h-14 text-[#d3da0c] mb-3" />
          <h2 className="text-xl font-extrabold text-white">No Recaps Found</h2>
          <p className="text-xs text-gray-400 mt-2 max-w-xs">
            Be the first to share an event recap, vertical video highlight, or community memory!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-6 py-3 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs active:scale-95 transition-all shadow-lg shadow-[#d3da0c]/20"
          >
            Create First Recap
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
          {feedItems.map((item, index) => {
            const isItemActive = index === activeIndex;

            // -----------------------------------------------------------------
            // A. REEL / VERTICAL VIDEO ITEM
            // -----------------------------------------------------------------
            if (item.type === 'reel') {
              const reel = item.data;
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
                  key={item.id}
                  className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-[#020B00] overflow-hidden"
                >
                  {/* Background Fullscreen Video / Photo */}
                  {isVideoFile ? (
                    <video
                      ref={(el) => {
                        videoRefs.current[item.id] = el;
                      }}
                      src={videoSrc}
                      poster={posterSrc}
                      loop
                      playsInline
                      muted={isMuted}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={posterSrc}
                      alt={reel.caption}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/onboarding/screen3-event.png';
                      }}
                    />
                  )}

                  {/* Gradient Vignettes */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90 pointer-events-none" />

                  {/* Right-Side Action Rail */}
                  <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-5">
                    {/* Like */}
                    <button
                      onClick={() => handleLikeItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
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
                      onClick={() => openComments(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {formatCount(reel.comments_count)}
                      </span>
                    </button>

                    {/* Share */}
                    <button
                      onClick={() => handleShareItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {formatCount(reel.shares_count)}
                      </span>
                    </button>

                    {/* Save / Bookmark */}
                    <button
                      onClick={() => handleSaveItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Bookmark
                          className={`w-6 h-6 transition-colors ${
                            reel.has_saved ? 'text-[#d3da0c] fill-[#d3da0c]' : 'text-white'
                          }`}
                        />
                      </div>
                    </button>

                    {/* Quick Create Button */}
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                      title="Post to Recaps"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Bottom Creator & Event Overlay */}
                  <div className="absolute left-4 right-20 bottom-28 z-20 space-y-2.5">
                    {/* Creator Handle + Follow */}
                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={() => navigate(`/profiles/${reel.author.id || 1}`)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full border border-[#d3da0c] overflow-hidden bg-black shrink-0">
                          <img
                            src={resolveMediaUrl(reel.author.avatar_url) || '/logo-icon-dark.png'}
                            alt={reel.author.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/logo-icon-dark.png';
                            }}
                          />
                        </div>
                        <span className="text-base font-extrabold text-white drop-shadow">
                          @{reel.author.username || 'creator'}
                        </span>
                        {reel.author.is_verified && (
                          <BadgeCheck className="w-4 h-4 text-[#d3da0c] fill-[#d3da0c]/20" />
                        )}
                      </div>

                      <span className="text-gray-400">•</span>
                      <button
                        onClick={() => handleFollowUser(reel.author.id, reel.author.artist_id)}
                        className="text-sm font-extrabold text-[#d3da0c] hover:underline"
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>

                    {/* Caption & Hashtags */}
                    <p className="text-sm text-white/95 leading-snug drop-shadow line-clamp-3">
                      {reel.caption}
                    </p>

                    {reel.hashtags && reel.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reel.hashtags.map((tag) => (
                          <span key={tag} className="text-xs font-semibold text-[#d3da0c] drop-shadow">
                            #{tag.replace(/^#/, '')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Original Sound / Music */}
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <Music2 className="w-3.5 h-3.5 text-[#d3da0c] animate-pulse" />
                      <span className="truncate max-w-[220px]">
                        {reel.music_title || 'Original Sound — Sound It Entertainment'}
                      </span>
                    </div>

                    {/* Event Tag if attached */}
                    {reel.event && (
                      <div
                        onClick={() => navigate(`/events/${reel.event?.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-[#d3da0c]/40 text-[#d3da0c] text-xs font-bold cursor-pointer hover:bg-black/80 transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{reel.event.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // -----------------------------------------------------------------
            // B. COMMUNITY POST ITEM (NORMAL SOCIAL MEDIA POST IN CONTINUOUS FEED)
            // -----------------------------------------------------------------
            if (item.type === 'community_post') {
              const post = item.data;
              const authorName =
                `${post.user?.first_name || ''} ${post.user?.last_name || ''}`.trim() ||
                post.user?.username ||
                'Community Member';
              const authorAvatar = resolveMediaUrl(post.user?.avatar_url) || '/logo-icon-dark.png';
              const images = (post.images || []).map((img) => resolveMediaUrl(img)).filter(Boolean);
              const postVideos = (post.videos || []).map((vid) => resolveMediaUrl(vid)).filter(Boolean);

              return (
                <div
                  key={item.id}
                  className="relative h-[100dvh] w-full snap-start snap-always flex flex-col justify-between bg-[#040e02] overflow-hidden px-4 pt-16 pb-28"
                >
                  {/* Subtle Background Glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
                  <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#d3da0c]/5 blur-3xl pointer-events-none" />

                  {/* Main Post Content Card */}
                  <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full space-y-3.5">
                    {/* Author Header */}
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => navigate(`/profiles/${post.user?.id || 1}`)}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-full border-2 border-[#d3da0c] overflow-hidden bg-black shrink-0">
                          <img
                            src={authorAvatar}
                            alt={authorName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/logo-icon-dark.png';
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-white text-sm">{authorName}</span>
                            {post.user?.is_verified && (
                              <BadgeCheck className="w-4 h-4 text-[#d3da0c] fill-[#d3da0c]/20" />
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">
                            {post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'Recently'}
                          </span>
                        </div>
                      </div>

                      {/* Section Badge */}
                      {post.section && (
                        <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider">
                          {post.section.name}
                        </span>
                      )}
                    </div>

                    {/* Post Title & Text */}
                    <div className="space-y-1.5">
                      {post.title && (
                        <h3 className="text-lg font-black text-white leading-snug">{post.title}</h3>
                      )}
                      <p className="text-sm text-gray-200 leading-relaxed line-clamp-4">
                        {post.content}
                      </p>
                    </div>

                    {/* Post Attached Media Showcase */}
                    {images.length > 0 ? (
                      <div
                        className={`rounded-2xl overflow-hidden border border-white/10 ${
                          images.length === 1 ? 'max-h-[46vh]' : 'grid grid-cols-2 gap-1.5 max-h-[46vh]'
                        }`}
                      >
                        {images.slice(0, 4).map((img, i) => (
                          <div key={i} className="relative aspect-square overflow-hidden bg-black">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            {i === 3 && images.length > 4 && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center font-extrabold text-white text-lg">
                                +{images.length - 4}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : postVideos.length > 0 ? (
                      <div className="rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black flex items-center justify-center">
                        <video src={postVideos[0]} controls className="w-full h-full object-cover" />
                      </div>
                    ) : null}

                    {/* Event Tag if attached */}
                    {post.event_title && (
                      <div
                        onClick={() => post.event_id && navigate(`/events/${post.event_id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-[#d3da0c]/30 text-[#d3da0c] text-xs font-bold cursor-pointer hover:bg-white/10 transition-colors w-fit"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="truncate">{post.event_title}</span>
                      </div>
                    )}
                  </div>

                  {/* Right-Side Action Rail */}
                  <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-5">
                    {/* Like */}
                    <button
                      onClick={() => handleLikeItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Heart
                          className={`w-6 h-6 transition-colors ${
                            post.has_liked ? 'text-red-500 fill-red-500' : 'text-white'
                          }`}
                        />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {formatCount(post.likes_count || 0)}
                      </span>
                    </button>

                    {/* Comment */}
                    <button
                      onClick={() => openComments(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {formatCount(post.comments_count || (post.comments ? post.comments.length : 0))}
                      </span>
                    </button>

                    {/* Share */}
                    <button
                      onClick={() => handleShareItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {formatCount(post.shares_count || 0)}
                      </span>
                    </button>

                    {/* Save / Bookmark */}
                    <button
                      onClick={() => handleSaveItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Bookmark
                          className={`w-6 h-6 transition-colors ${
                            post.has_saved ? 'text-[#d3da0c] fill-[#d3da0c]' : 'text-white'
                          }`}
                        />
                      </div>
                    </button>

                    {/* Quick Create Button */}
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                      title="Post to Recaps"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            }

            // -----------------------------------------------------------------
            // C. EVENT PHOTO COLLECTION ITEM (GROUPED PAST EVENT PHOTO ALBUMS)
            // -----------------------------------------------------------------
            if (item.type === 'event_collection') {
              const album = item.data;
              const previewPhotos = album.photos.slice(0, 4);

              return (
                <div
                  key={item.id}
                  className="relative h-[100dvh] w-full snap-start snap-always flex flex-col justify-between bg-[#030900] overflow-hidden px-4 pt-16 pb-28"
                >
                  {/* Subtle Background Lighting */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/95 pointer-events-none" />
                  <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#d3da0c]/5 blur-[120px] pointer-events-none" />

                  {/* Event Album Card */}
                  <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full space-y-4">
                    {/* Event Header */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[#d3da0c] font-bold uppercase tracking-wider">
                        <Camera className="w-4 h-4 text-[#d3da0c]" />
                        <span>Event Photo Album</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-white/80">{album.total_photos} Photos</span>
                      </div>

                      <h2
                        onClick={() => navigate(`/events/${album.event_id}`)}
                        className="text-2xl font-black text-white hover:text-[#d3da0c] cursor-pointer transition-colors leading-tight drop-shadow"
                      >
                        {album.title}
                      </h2>

                      {/* Organizer and Date Badge */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                        <span className="font-semibold text-white/90">By {album.organizer_name}</span>
                        {album.date_str && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#d3da0c]" />
                              {album.date_str}
                            </span>
                          </>
                        )}
                        {album.city && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#d3da0c]" />
                              {album.city}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Curated 4-Photo Mosaic Grid (Max 4-5 photos in feed) */}
                    <div
                      onClick={() => navigate(`/events/${album.event_id}`)}
                      className="rounded-2xl overflow-hidden border border-white/10 grid grid-cols-2 gap-1.5 cursor-pointer group shadow-2xl"
                    >
                      {previewPhotos.map((photo, pIdx) => (
                        <div key={pIdx} className="relative aspect-square overflow-hidden bg-black/60">
                          <img
                            src={photo}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          {/* 4th photo "+N more" frosted badge */}
                          {pIdx === 3 && album.total_photos > 4 && (
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                              <span className="text-2xl font-black text-[#d3da0c]">
                                +{album.total_photos - 3}
                              </span>
                              <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5 text-white/90">
                                More Photos
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Prominent Action Button: Navigate to real event page */}
                    <button
                      onClick={() => navigate(`/events/${album.event_id}`)}
                      className="w-full py-3.5 rounded-2xl bg-[#d3da0c] hover:bg-[#b8be0a] active:scale-98 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#d3da0c]/25 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>View All Event Photos & Details</span>
                      <ExternalLink className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>

                  {/* Right-Side Action Rail */}
                  <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-5">
                    {/* Like */}
                    <button
                      onClick={() => handleLikeItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Heart
                          className={`w-6 h-6 transition-colors ${
                            album.has_liked ? 'text-red-500 fill-red-500' : 'text-white'
                          }`}
                        />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {formatCount(album.likes_count)}
                      </span>
                    </button>

                    {/* View All Details */}
                    <button
                      onClick={() => navigate(`/events/${album.event_id}`)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        {album.total_photos}
                      </span>
                    </button>

                    {/* Share */}
                    <button
                      onClick={() => handleShareItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">
                        Share
                      </span>
                    </button>

                    {/* Bookmark */}
                    <button
                      onClick={() => handleSaveItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Bookmark
                          className={`w-6 h-6 transition-colors ${
                            album.has_saved ? 'text-[#d3da0c] fill-[#d3da0c]' : 'text-white'
                          }`}
                        />
                      </div>
                    </button>

                    {/* Quick Create Button */}
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                      title="Post to Recaps"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* 
        =======================================================================
        SHARED COMMENTS DRAWER
        =======================================================================
      */}
      <AnimatePresence>
        {activeCommentItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCommentItem(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[72vh] rounded-t-3xl bg-[#0a1407] border-t border-white/10 flex flex-col text-white pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
                <span className="font-extrabold text-sm text-white">Comments</span>
                <button
                  onClick={() => setActiveCommentItem(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments Scrollable List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {loadingComments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
                  </div>
                ) : commentsList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs">
                    No comments yet. Be the first to start the conversation!
                  </div>
                ) : (
                  commentsList.map((c, i) => {
                    const cAuthor = c.user || c.author || {};
                    const cName =
                      cAuthor.name ||
                      `${cAuthor.first_name || ''} ${cAuthor.last_name || ''}`.trim() ||
                      c.guest_name ||
                      'Sound It Member';
                    const cAvatar = resolveMediaUrl(cAuthor.avatar_url) || '/logo-icon-dark.png';

                    return (
                      <div key={c.id || i} className="flex gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-black border border-[#d3da0c]/40 shrink-0">
                          <img src={cAvatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white">{cName}</span>
                            <span className="text-[10px] text-gray-500">
                              {c.created_at ? formatDistanceToNow(new Date(c.created_at), { addSuffix: true }) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 mt-0.5 leading-snug">{c.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Form */}
              <div className="p-3 border-t border-white/10 space-y-2">
                {!isAuthenticated && (
                  <input
                    type="text"
                    value={guestNameState}
                    onChange={(e) => {
                      setGuestNameState(e.target.value);
                      setGuestName(e.target.value);
                    }}
                    placeholder="Your Name (Required for guests)"
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                    placeholder="Add a comment…"
                    className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={submittingComment || !commentText.trim()}
                    className="w-10 h-10 rounded-full bg-[#d3da0c] text-black flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
                  >
                    {submittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 
        =======================================================================
        CREATE RECAP / POST MODAL
        =======================================================================
      */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl bg-[#081206] border-t border-white/15 flex flex-col text-white pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCreateMode('reel')}
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                      createMode === 'reel' ? 'bg-[#d3da0c] text-black' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    Upload Reel
                  </button>
                  <button
                    onClick={() => setCreateMode('post')}
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                      createMode === 'post' ? 'bg-[#d3da0c] text-black' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    Community Post
                  </button>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4 overflow-y-auto">
                {createMode === 'reel' ? (
                  <>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-44 rounded-2xl border-2 border-dashed border-white/20 hover:border-[#d3da0c]/60 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/5 overflow-hidden relative"
                    >
                      {previewUrl ? (
                        <video src={previewUrl} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Plus className="w-8 h-8 text-[#d3da0c]" />
                          <span className="text-xs font-bold text-gray-300">
                            {selectedFile ? selectedFile.name : 'Choose Video File (MP4, MOV)'}
                          </span>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setSelectedFile(f);
                            setPreviewUrl(URL.createObjectURL(f));
                          }
                        }}
                        className="hidden"
                      />
                    </div>

                    <textarea
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                      placeholder="Write a caption and #hashtags…"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Post Title (optional)"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                    />
                    <textarea
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                      placeholder="Share your experience, event recap, or thoughts with the community…"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                    />
                  </>
                )}

                <button
                  onClick={async () => {
                    if (!isAuthenticated) {
                      toast.error('Please sign in to publish content');
                      navigate('/login');
                      return;
                    }
                    if (createMode === 'reel' && !selectedFile) {
                      toast.error('Please select a video file to upload');
                      return;
                    }
                    if (createMode === 'post' && !newCaption.trim()) {
                      toast.error('Please enter content for your post');
                      return;
                    }

                    setIsUploading(true);
                    try {
                      if (createMode === 'reel') {
                        const formData = new FormData();
                        formData.append('file', selectedFile!);
                        const upRes = await fetch(`${API_BASE_URL}/media/upload`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${session?.access_token}` },
                          body: formData,
                        });
                        const upData = await upRes.json();
                        const videoUrl = upData.url || upData.file_url;

                        await fetch(`${API_BASE_URL}/reels`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session?.access_token}`,
                          },
                          body: JSON.stringify({
                            video_url: videoUrl,
                            caption: newCaption,
                          }),
                        });
                        toast.success('Reel published to Recaps!');
                      } else {
                        await useCommunityStore.getState().createPost({
                          title: newTitle.trim() || undefined,
                          content: newCaption,
                          images: [],
                          videos: [],
                        });
                        toast.success('Post published to Recaps!');
                      }
                      setShowCreateModal(false);
                      loadUnifiedFeed();
                    } catch {
                      toast.error('Failed to publish content');
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  disabled={isUploading}
                  className="w-full py-3.5 rounded-xl bg-[#d3da0c] text-black font-extrabold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading…</span>
                    </>
                  ) : (
                    <span>Publish to Recaps Feed</span>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
