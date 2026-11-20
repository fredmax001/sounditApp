import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  UserPlus,
  Users,
  Search,
  Check,
  Sparkles,
  AlertCircle,
  Copy,
  MessageSquare,
  Smile,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCommunityStore, type CommunityPost, getGuestName, setGuestName } from '@/store/communityStore';
import { useEventStore } from '@/store/eventStore';
import { trackActivity } from '@/lib/activityTracker';
import { extractVideoThumbnail, type VideoThumbnailResult } from '@/lib/videoThumbnail';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Share as CapShare } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import UniversalShareModal, { type ShareableItem } from '@/components/ui/UniversalShareModal';
import VerificationBadge from '@/components/VerificationBadge';

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
// TYPES FOR UNIFIED FEED & EVENT-DRIVEN SOCIAL
// ===========================================================================

export interface TaggedFriend {
  id: number;
  username: string;
  name: string;
  avatar_url?: string;
  is_verified?: boolean;
}

export interface EligibleEvent {
  id: number;
  title: string;
  flyer_url?: string;
  start_date?: string;
  end_date?: string;
  venue_name?: string;
  city?: string;
  timing_status: 'upcoming' | 'ongoing' | 'past';
  ticket_price?: number;
}

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
    flyer_url?: string;
  } | null;
  tagged_users?: TaggedFriend[];
  tagged_user_ids?: number[];
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
  const { likePost, unlikePost, addComment: addCommunityComment, sharePost } = useCommunityStore();

  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [followedUsers, setFollowedUsers] = useState<Record<number, boolean>>({});

  // Discovery Filter Tabs
  const [feedFilter, setFeedFilter] = useState<'for_you' | 'trending' | 'following' | 'upcoming' | 'ongoing' | 'past'>('for_you');

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
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Comment Replying & Reactions State
  const [replyingTo, setReplyingTo] = useState<{ id: number; authorName: string } | null>(null);
  const [activeReactionPickerCommentId, setActiveReactionPickerCommentId] = useState<number | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Universal Share Modal State (Shared with Events, Reels, Posts)
  const [shareModalItem, setShareModalItem] = useState<ShareableItem | null>(null);

  // Listen for mobile keyboard appearance via WebKit visualViewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const onViewportChange = () => {
      const vv = window.visualViewport!;
      const diff = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardOffset(Math.max(0, Math.round(diff)));
    };
    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, []);

  // 1. Sleek Choice Sheet State ("Post" vs "Reels")
  const [showChoiceSheet, setShowChoiceSheet] = useState(false);

  // Hidden File Pickers (Direct to Gallery)
  const reelFileInputRef = useRef<HTMLInputElement>(null);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  // 2. Creation Form Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<'reel' | 'post'>('reel');
  const [newCaption, setNewCaption] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPostFiles, setSelectedPostFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [autoThumbnail, setAutoThumbnail] = useState<VideoThumbnailResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 3. Mandatory Event Selection State
  const [eligibleEvents, setEligibleEvents] = useState<EligibleEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EligibleEvent | null>(null);
  const [eventTimingFilter, setEventTimingFilter] = useState<'upcoming' | 'ongoing' | 'past' | 'all'>('upcoming');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  // 4. Friend Tagging State
  const [taggedFriends, setTaggedFriends] = useState<TaggedFriend[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<TaggedFriend[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);

  // 5. Event Invitations Drawer State
  const [inviteDrawerItem, setInviteDrawerItem] = useState<{
    eventId: number;
    title: string;
    venueName?: string;
    flyerUrl?: string;
  } | null>(null);
  const [inviteUserQuery, setInviteUserQuery] = useState('');
  const [inviteUserResults, setInviteUserResults] = useState<TaggedFriend[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<TaggedFriend[]>([]);
  const [isSendingInvites, setIsSendingInvites] = useState(false);

  // -------------------------------------------------------------------------
  // FETCH AND INTERLEAVE CONTENT (REELS, COMMUNITY POSTS, EVENT COLLECTIONS)
  // -------------------------------------------------------------------------
  const loadUnifiedFeed = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Reels
      const reelsPromise = fetch(`${API_BASE_URL}/reels?filter=${feedFilter}&limit=30`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
        .then(async (r) => {
          if (!r.ok) return [] as ReelData[];
          const data = await r.json();
          if (Array.isArray(data)) return data;
          if (Array.isArray(data?.reels)) return data.reels;
          return [] as ReelData[];
        })
        .catch(() => [] as ReelData[]);

      // 2. Fetch Community Posts
      const communityPromise = fetch(`${API_BASE_URL}/community/posts?feed_type=${feedFilter}&limit=30`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
        .then(async (r) => {
          if (!r.ok) return [] as CommunityPost[];
          const data = await r.json();
          if (Array.isArray(data)) return data;
          if (Array.isArray(data?.posts)) return data.posts;
          return [] as CommunityPost[];
        })
        .catch(() => [] as CommunityPost[]);

      // 3. Fetch Past Events with Photo Galleries (only if not strictly "upcoming")
      const pastEventsPromise =
        feedFilter === 'upcoming'
          ? Promise.resolve([])
          : fetch(`${API_BASE_URL}/events/past?limit=20`)
              .then(async (r) => {
                if (!r.ok) return [];
                const data = await r.json();
                if (Array.isArray(data)) return data;
                if (Array.isArray(data?.events)) return data.events;
                return [];
              })
              .catch(() => [] as any[]);

      const [rawReels, rawPosts, rawPastEvents] = await Promise.all([
        reelsPromise,
        communityPromise,
        pastEventsPromise,
      ]);

      const reelsData: ReelData[] = Array.isArray(rawReels) ? rawReels : [];
      const communityData: CommunityPost[] = Array.isArray(rawPosts) ? rawPosts : [];
      const pastEventsData: any[] = Array.isArray(rawPastEvents) ? rawPastEvents : [];

      // Transform past events into Event Collection Items
      const eventCollections: EventCollectionData[] = pastEventsData
        .filter((e: any) => e && ((e.gallery_images && e.gallery_images.length > 0) || e.flyer_image))
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
      const combined: UnifiedFeedItem[] = [];
      let reelIdx = 0;
      let postIdx = 0;
      let eventIdx = 0;

      while (reelIdx < reelsData.length || postIdx < communityData.length || eventIdx < eventCollections.length) {
        if (reelIdx < reelsData.length) {
          const r = reelsData[reelIdx++];
          if (r && r.id) combined.push({ type: 'reel', id: `reel_${r.id}`, data: r });
        }
        if (postIdx < communityData.length) {
          const p = communityData[postIdx++];
          if (p && p.id) combined.push({ type: 'community_post', id: `post_${p.id}`, data: p });
        }
        if (eventIdx < eventCollections.length) {
          const e = eventCollections[eventIdx++];
          if (e && e.id) combined.push({ type: 'event_collection', id: `event_${e.id}`, data: e });
        }
        if (reelIdx < reelsData.length && reelIdx % 2 === 1) {
          const r = reelsData[reelIdx++];
          if (r && r.id) combined.push({ type: 'reel', id: `reel_${r.id}`, data: r });
        }
      }

      setFeedItems(combined);
    } catch (err) {
      console.error('Error loading unified recaps feed:', err);
      toast.error('Failed to load feed items');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, feedFilter]);

  useEffect(() => {
    loadUnifiedFeed();
  }, [loadUnifiedFeed]);

  // Load eligible events for the mandatory event selection picker
  const loadEligibleEvents = useCallback(async (timing = 'upcoming', search = '') => {
    setLoadingEvents(true);
    try {
      const url = `${API_BASE_URL}/events/eligible-for-posting?timing=${timing}&q=${encodeURIComponent(search)}&limit=30`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEligibleEvents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch eligible events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // Live search users for friend tagging
  const searchFriends = useCallback(async (query: string) => {
    if (!query.trim()) {
      setFriendSearchResults([]);
      return;
    }
    setIsSearchingFriends(true);
    try {
      const res = await fetch(`${API_BASE_URL}/social/users/search?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setFriendSearchResults(Array.isArray(data) ? data : []);
      }
    } catch {
      setFriendSearchResults([]);
    } finally {
      setIsSearchingFriends(false);
    }
  }, []);

  // Search users for event invitation drawer
  const searchInvitees = useCallback(async (query: string) => {
    if (!query.trim()) {
      setInviteUserResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/social/users/search?q=${encodeURIComponent(query)}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        setInviteUserResults(Array.isArray(data) ? data : []);
      }
    } catch {
      setInviteUserResults([]);
    }
  }, []);

  // File Change Handler: Reels
  const handleReelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCreateMode('reel');
    setShowCreateModal(true);
    loadEligibleEvents('upcoming', '');

    try {
      const thumb = await extractVideoThumbnail(file, 0.5);
      setAutoThumbnail(thumb);
    } catch (err) {
      console.warn('Could not extract video thumbnail:', err);
    }
  };

  // File Change Handler: Post
  const handlePostFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setSelectedPostFiles(files);
    setSelectedFile(files[0]);
    setPreviewUrl(URL.createObjectURL(files[0]));
    setCreateMode('post');
    setShowCreateModal(true);
    loadEligibleEvents('upcoming', '');
  };

  // Video Autoplay Intersection Management
  useEffect(() => {
    const currentItem = feedItems[activeIndex];
    Object.entries(videoRefs.current).forEach(([key, videoEl]) => {
      if (!videoEl) return;
      if (currentItem && key === currentItem.id && currentItem.type === 'reel') {
        videoEl.play().catch(() => {});
        videoEl.muted = isMuted;
      } else {
        videoEl.pause();
      }
    });

    if (currentItem && currentItem.type === 'reel') {
      trackActivity({
        action_type: 'watch',
        entity_type: 'reel',
        entity_id: currentItem.data.id,
        category: 'entertainment',
      });
    }
  }, [activeIndex, feedItems, isMuted]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const itemHeight = target.clientHeight;
    if (itemHeight <= 0) return;
    const newIndex = Math.round(target.scrollTop / itemHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < feedItems.length) {
      setActiveIndex(newIndex);
    }
  };

  const handleFollowUser = async (userId: number, artistId?: number | null) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to follow creators');
      navigate('/login');
      return;
    }
    const currentlyFollowing = Boolean(followedUsers[userId]);
    setFollowedUsers((prev) => ({ ...prev, [userId]: !currentlyFollowing }));

    try {
      const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/social/users/${userId}/follow`, {
        method: currentlyFollowing ? 'DELETE' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        toast.success(currentlyFollowing ? 'Unfollowed creator' : 'Now following creator!');
      } else {
        if (artistId) {
          await fetch(`${API_BASE_URL}/artists/${artistId}/follow`, {
            method: currentlyFollowing ? 'DELETE' : 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    } catch {
      setFollowedUsers((prev) => ({ ...prev, [userId]: currentlyFollowing }));
    }
  };

  const handleLikeItem = async (item: UnifiedFeedItem) => {
    if (!isAuthenticated) {
      toast.error('Please sign in to like content');
      navigate('/login');
      return;
    }

    const willLike = !item.data.has_liked;
    setFeedItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        return {
          ...it,
          data: {
            ...it.data,
            has_liked: willLike,
            likes_count: Math.max(0, (it.data.likes_count || 0) + (willLike ? 1 : -1)),
          },
        } as UnifiedFeedItem;
      })
    );

    try {
      if (item.type === 'reel') {
        await fetch(`${API_BASE_URL}/reels/${item.data.id}/like`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        trackActivity({
          action_type: 'like',
          entity_type: 'reel',
          entity_id: item.data.id,
          category: 'entertainment',
        });
      } else if (item.type === 'community_post') {
        if (willLike) await likePost(item.data.id);
        else await unlikePost(item.data.id);
      }
    } catch {
      // rollback silently if network fails
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
          ? ({
              ...it,
              data: {
                ...it.data,
                has_saved: willSave,
              },
            } as UnifiedFeedItem)
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

  const handleShareItem = (item: UnifiedFeedItem) => {
    const origin = 'https://sounditent.com';

    if (item.type === 'reel') {
      const reel = item.data;
      setShareModalItem({
        type: 'reel',
        id: reel.id,
        title: reel.caption ? reel.caption.slice(0, 70) : `${reel.author?.name || 'Creator'}'s Reel`,
        subtitle: reel.event ? `Event: ${reel.event.title}` : (reel.author?.name ? `By @${reel.author.username || reel.author.name}` : undefined),
        image: reel.thumbnail_url || reel.video_url,
        description: reel.caption || '',
        url: `${origin}/recaps?id=${reel.id}`,
        location: reel.event ? (reel.event.venue_name || reel.event.city) : undefined,
        date: reel.event?.start_date,
      });
      fetch(`${API_BASE_URL}/reels/${reel.id}/share`, { method: 'POST' }).catch(() => {});
    } else if (item.type === 'community_post') {
      const post = item.data;
      const firstMedia = (post as any).media_urls?.[0] || post.images?.[0];
      const postEvent = (post as any).event;
      const authorName = (post as any).author?.name || post.user?.username || (post as any).guest_name || 'Member';
      setShareModalItem({
        type: 'post',
        id: post.id,
        title: post.title || (post.content ? post.content.slice(0, 70) : 'Community Post'),
        subtitle: postEvent ? `Event: ${postEvent.title}` : (authorName ? `By @${authorName}` : undefined),
        image: firstMedia,
        description: post.content || '',
        url: `${origin}/recaps?post=${post.id}`,
        location: postEvent ? (postEvent.venue_name || postEvent.city) : undefined,
        date: postEvent?.start_date,
      });
      sharePost(post.id);
    } else if (item.type === 'event_collection') {
      const coll = item.data;
      setShareModalItem({
        type: 'event',
        id: coll.event_id,
        title: coll.title,
        subtitle: coll.venue_name ? `${coll.venue_name}, ${coll.city || ''}` : coll.city,
        image: coll.photos?.[0],
        description: `Browse past event recaps and photo highlights from ${coll.title} on Sound It!`,
        url: `${origin}/events/${coll.event_id}`,
        location: coll.venue_name ? `${coll.venue_name}, ${coll.city || ''}` : coll.city,
        date: coll.date_str,
      });
    }
  };

  const COMMENT_REACTION_EMOJIS = ['❤️', '🔥', '😂', '👏', '😮', '💯'];

  // Group comments into top-level comments and nested replies
  const organizedComments = useMemo(() => {
    const topLevel: any[] = [];
    const repliesMap = new Map<number, any[]>();

    for (const c of commentsList) {
      if (c.parent_comment_id) {
        const existing = repliesMap.get(c.parent_comment_id) || [];
        existing.push(c);
        repliesMap.set(c.parent_comment_id, existing);
      } else {
        topLevel.push(c);
      }
    }

    return topLevel.map((c) => ({
      ...c,
      replies: (c.replies && c.replies.length > 0) ? c.replies : (repliesMap.get(c.id) || []),
    }));
  }, [commentsList]);

  // Render a comment or nested reply with Like, Reply, and React controls
  const renderCommentItem = (comm: any, isReply = false) => {
    const author = comm.user || comm.author;
    const authorName =
      `${author?.first_name || ''} ${author?.last_name || ''}`.trim() ||
      author?.username ||
      comm.guest_name ||
      'Guest';
    const authorAvatar =
      resolveMediaUrl(author?.avatar_url) || '/default-avatar.png';
    const likesCount = Number(comm.likes_count ?? comm.like_count ?? 0);
    const hasLiked = Boolean(comm.has_liked);
    const reactions = Array.isArray(comm.reactions_summary) ? comm.reactions_summary : [];
    const isPickerOpen = activeReactionPickerCommentId === comm.id;

    return (
      <div key={comm.id} className="relative group">
        <div className="flex gap-2.5 text-xs">
          <div className={`${isReply ? 'w-6 h-6' : 'w-8 h-8'} rounded-full overflow-hidden bg-black shrink-0 border border-white/10 mt-0.5`}>
            <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-[0.8125rem]">{authorName}</span>
              <span className="text-[0.625rem] text-gray-500">
                {comm.created_at ? formatDistanceToNow(new Date(comm.created_at), { addSuffix: true }) : ''}
              </span>
            </div>
            <p className="text-gray-200 mt-1 leading-relaxed break-words text-xs">{comm.content}</p>

            {/* Action Row: Like, Reply, React */}
            <div className="flex items-center gap-4 mt-2 text-[0.6875rem] text-gray-400">
              {/* Like button */}
              <button
                onClick={() => handleLikeComment(comm)}
                className={`flex items-center gap-1 active:scale-90 transition-transform font-bold ${
                  hasLiked ? 'text-[#d3da0c]' : 'hover:text-white'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-[#d3da0c] text-[#d3da0c]' : ''}`} />
                <span>{likesCount > 0 ? likesCount : 'Like'}</span>
              </button>

              {/* Reply button */}
              {!isReply && (
                <button
                  onClick={() => handleStartReply(comm, authorName)}
                  className="flex items-center gap-1 hover:text-white active:scale-90 transition-transform font-semibold"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              )}

              {/* React button */}
              <div className="relative">
                <button
                  onClick={() => setActiveReactionPickerCommentId(isPickerOpen ? null : comm.id)}
                  className={`flex items-center gap-1 active:scale-90 transition-transform font-semibold ${
                    isPickerOpen ? 'text-[#d3da0c]' : 'hover:text-white'
                  }`}
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>React</span>
                </button>

                {/* Floating Emoji Picker */}
                <AnimatePresence>
                  {isPickerOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute left-0 bottom-full mb-1.5 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/95 backdrop-blur-md border border-[#d3da0c]/40 shadow-2xl"
                    >
                      {COMMENT_REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReactComment(comm, emoji)}
                          className="text-base hover:scale-130 active:scale-95 transition-transform p-0.5"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Reaction Summary Badges */}
            {reactions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {reactions.map((r: any) => (
                  <button
                    key={r.emoji}
                    onClick={() => handleReactComment(comm, r.emoji)}
                    className={`px-2 py-0.5 rounded-full text-[0.6875rem] flex items-center gap-1 border transition-all ${
                      r.has_reacted
                        ? 'bg-[#d3da0c]/20 border-[#d3da0c] text-[#d3da0c]'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="font-bold text-[0.625rem]">{r.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Nested Replies */}
            {comm.replies && comm.replies.length > 0 && (
              <div className="ml-2 pl-3 border-l-2 border-white/10 space-y-3 mt-3">
                {comm.replies.map((reply: any) => renderCommentItem(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Open Unified Comments Drawer
  const openComments = async (item: UnifiedFeedItem) => {
    if (item.type === 'event_collection') {
      navigate(`/events/${item.data.event_id}`);
      return;
    }

    setActiveCommentItem({
      type: item.type,
      id: item.data.id,
      title: item.type === 'reel' ? item.data.caption || 'Reel Comments' : item.data.title || 'Post Comments',
    });
    setLoadingComments(true);
    setCommentsList([]);
    setReplyingTo(null);
    setActiveReactionPickerCommentId(null);

    try {
      const headers: Record<string, string> = {
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(!session?.access_token && guestNameState ? { 'X-Guest-ID': guestNameState } : {}),
      };
      if (item.type === 'reel') {
        const res = await fetch(`${API_BASE_URL}/reels/${item.data.id}/comments`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCommentsList(Array.isArray(data) ? data : data.comments || []);
        }
      } else if (item.type === 'community_post') {
        const res = await fetch(`${API_BASE_URL}/community/posts/${item.data.id}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCommentsList(Array.isArray(data.comments) ? data.comments : []);
        }
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
      toast.error('Could not load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  // Like or Unlike a Comment
  const handleLikeComment = async (comm: any) => {
    if (!activeCommentItem) return;
    const commentId = comm.id;
    const isCurrentlyLiked = Boolean(comm.has_liked);
    const currentCount = Number(comm.likes_count ?? comm.like_count ?? 0);
    const newCount = isCurrentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1;

    // Optimistic update
    const updateList = (list: any[]): any[] => {
      return list.map((item) => {
        if (item.id === commentId) {
          return {
            ...item,
            has_liked: !isCurrentlyLiked,
            likes_count: newCount,
            like_count: newCount,
          };
        }
        if (item.replies && item.replies.length > 0) {
          return {
            ...item,
            replies: updateList(item.replies),
          };
        }
        return item;
      });
    };
    setCommentsList((prev) => updateList(prev));

    try {
      if (activeCommentItem.type === 'reel') {
        const res = await fetch(`${API_BASE_URL}/reels/comments/${commentId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...(!session?.access_token && guestNameState ? { 'X-Guest-ID': guestNameState } : {}),
          },
        });
        if (!res.ok) throw new Error('Failed to like reel comment');
      } else if (activeCommentItem.type === 'community_post') {
        const endpoint = isCurrentlyLiked ? 'unlike' : 'like';
        const res = await fetch(`${API_BASE_URL}/community/comments/${commentId}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...(!session?.access_token && guestNameState ? { 'X-Guest-ID': guestNameState } : {}),
          },
        });
        if (!res.ok) throw new Error('Failed to like community comment');
      }
    } catch {
      // Revert on error
      setCommentsList((prev) => updateList(prev));
      toast.error('Unable to update comment like');
    }
  };

  // Add or Toggle Emoji Reaction on a Comment
  const handleReactComment = async (comm: any, emoji: string) => {
    if (!activeCommentItem) return;
    const commentId = comm.id;
    setActiveReactionPickerCommentId(null);

    try {
      let res: Response;
      if (activeCommentItem.type === 'reel') {
        res = await fetch(`${API_BASE_URL}/reels/comments/${commentId}/react`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...(!session?.access_token && guestNameState ? { 'X-Guest-ID': guestNameState } : {}),
          },
          body: JSON.stringify({ emoji }),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/community/comments/${commentId}/react`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...(!session?.access_token && guestNameState ? { 'X-Guest-ID': guestNameState } : {}),
          },
          body: JSON.stringify({ emoji }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const updatedSummary = data.reactions_summary || [];

        const updateReactionsInList = (list: any[]): any[] => {
          return list.map((item) => {
            if (item.id === commentId) {
              return {
                ...item,
                reactions_summary: updatedSummary,
              };
            }
            if (item.replies && item.replies.length > 0) {
              return {
                ...item,
                replies: updateReactionsInList(item.replies),
              };
            }
            return item;
          });
        };
        setCommentsList((prev) => updateReactionsInList(prev));
      }
    } catch {
      toast.error('Could not react to comment');
    }
  };

  // Start Replying to a Comment
  const handleStartReply = (comm: any, authorName: string) => {
    setReplyingTo({ id: comm.id, authorName });
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 50);
  };

  // Post a Comment or Reply
  const handlePostComment = async () => {
    if (!activeCommentItem || !commentText.trim()) return;

    if (!isAuthenticated && !guestNameState.trim()) {
      toast.error('Please enter your name to post a comment');
      return;
    }
    if (!isAuthenticated && guestNameState.trim()) {
      setGuestName(guestNameState.trim());
    }

    setSubmittingComment(true);
    const text = commentText.trim();
    const parentId = replyingTo?.id;

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
            parent_comment_id: parentId || null,
          }),
        });
        if (res.ok) {
          const newComm = await res.json();
          if (parentId) {
            setCommentsList((prev) =>
              prev.map((item) => {
                if (item.id === parentId) {
                  return {
                    ...item,
                    replies: [...(item.replies || []), newComm],
                  };
                }
                return item;
              })
            );
          } else {
            setCommentsList((prev) => [...prev, newComm]);
          }
          setCommentText('');
          setReplyingTo(null);
          toast.success(parentId ? 'Reply posted' : 'Comment posted');
        }
      } else if (activeCommentItem.type === 'community_post') {
        await addCommunityComment(activeCommentItem.id, text, parentId, guestNameState);
        setCommentText('');
        setReplyingTo(null);
        toast.success(parentId ? 'Reply posted' : 'Comment posted');
        const res = await fetch(`${API_BASE_URL}/community/posts/${activeCommentItem.id}`, {
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...(!session?.access_token && guestNameState ? { 'X-Guest-ID': guestNameState } : {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setCommentsList(Array.isArray(data.comments) ? data.comments : []);
        }
      }
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Send In-App Event Invitations
  const handleSendInvitations = async () => {
    if (!inviteDrawerItem) return;
    if (!isAuthenticated) {
      toast.error('Please sign in to invite friends');
      navigate('/login');
      return;
    }
    if (selectedInvitees.length === 0) {
      toast.error('Select at least one friend to invite');
      return;
    }

    setIsSendingInvites(true);
    try {
      const res = await fetch(`${API_BASE_URL}/events/${inviteDrawerItem.eventId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          user_ids: selectedInvitees.map((u) => u.id),
        }),
      });

      if (res.ok) {
        toast.success(`Event invitations sent to ${selectedInvitees.length} friend${selectedInvitees.length > 1 ? 's' : ''}!`);
        setSelectedInvitees([]);
        setInviteDrawerItem(null);
      } else {
        toast.error('Failed to send event invitations');
      }
    } catch {
      toast.error('Network error sending invitations');
    } finally {
      setIsSendingInvites(false);
    }
  };

  // Generate & Share Tracked Link
  const handleShareInviteLink = async (channel: 'whatsapp' | 'wechat' | 'sms' | 'link') => {
    if (!inviteDrawerItem) return;
    try {
      const res = await fetch(`${API_BASE_URL}/events/${inviteDrawerItem.eventId}/invite-link?channel=${channel}`, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to generate invite link');
      const data = await res.json();

      if (channel === 'link') {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(data.invite_url);
          toast.success('Tracked invite link copied to clipboard!');
        } else {
          toast.info(data.invite_url);
        }
        return;
      }

      if (Capacitor.isNativePlatform()) {
        await CapShare.share({
          title: `Join me at ${data.event_title}!`,
          text: data.share_text,
          url: data.invite_url,
          dialogTitle: `Invite Friends via ${channel.toUpperCase()}`,
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `Join me at ${data.event_title}!`,
          text: data.share_text,
          url: data.invite_url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${data.share_text}`);
        toast.success('Invite message & link copied to clipboard!');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      toast.error('Failed to share invitation link');
    }
  };

  // Publish Reel or Post (Mandatory Event Associated)
  const handlePublish = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to publish content');
      navigate('/login');
      return;
    }
    if (!selectedEvent) {
      toast.error('Sound It is strictly event-driven. Please select an event before publishing.');
      return;
    }
    if (createMode === 'reel' && !selectedFile) {
      toast.error('Please select a video file to upload');
      return;
    }
    if (createMode === 'post' && !newCaption.trim()) {
      toast.error('Please enter content or thoughts for your post');
      return;
    }

    setIsUploading(true);
    try {
      if (createMode === 'reel') {
        // 1. Upload Video
        const videoForm = new FormData();
        videoForm.append('file', selectedFile!);
        const upRes = await fetch(`${API_BASE_URL}/media/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: videoForm,
        });
        if (!upRes.ok) throw new Error('Video upload failed');
        const upData = await upRes.json();
        const videoUrl = upData.url || upData.file_url;

        // 2. Upload Extracted Video Thumbnail (Guaranteed video frame instead of stock photo)
        let thumbnailUrl = selectedEvent.flyer_url || '';
        if (autoThumbnail?.file) {
          try {
            const thumbForm = new FormData();
            thumbForm.append('file', autoThumbnail.file);
            const tRes = await fetch(`${API_BASE_URL}/media/upload`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${session?.access_token}` },
              body: thumbForm,
            });
            if (tRes.ok) {
              const tData = await tRes.json();
              thumbnailUrl = tData.url || tData.file_url || thumbnailUrl;
            }
          } catch {
            // fallback to event flyer
          }
        }

        // 3. Create Reel
        const reelRes = await fetch(`${API_BASE_URL}/reels`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            caption: newCaption,
            event_id: selectedEvent.id,
            tagged_user_ids: taggedFriends.map((f) => f.id),
          }),
        });

        if (!reelRes.ok) {
          const errData = await reelRes.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to publish reel');
        }

        toast.success(`Reel published for ${selectedEvent.title}!`);
      } else {
        // Community Post
        let uploadedImages: string[] = [];
        if (selectedPostFiles.length > 0) {
          for (const f of selectedPostFiles) {
            const fForm = new FormData();
            fForm.append('file', f);
            const r = await fetch(`${API_BASE_URL}/media/upload`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${session?.access_token}` },
              body: fForm,
            });
            if (r.ok) {
              const d = await r.json();
              uploadedImages.push(d.url || d.file_url);
            }
          }
        }

        const postRes = await fetch(`${API_BASE_URL}/community/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            title: newTitle.trim() || undefined,
            content: newCaption,
            images: uploadedImages,
            videos: [],
            event_id: selectedEvent.id,
            tagged_user_ids: taggedFriends.map((f) => f.id),
          }),
        });

        if (!postRes.ok) {
          const errData = await postRes.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to publish post');
        }

        toast.success(`Post published for ${selectedEvent.title}!`);
      }

      setShowCreateModal(false);
      setSelectedFile(null);
      setSelectedPostFiles([]);
      setPreviewUrl(null);
      setAutoThumbnail(null);
      setSelectedEvent(null);
      setTaggedFriends([]);
      setNewCaption('');
      setNewTitle('');
      loadUnifiedFeed();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish recap');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-full bg-[#020B00] text-white overflow-hidden select-none">
      {/*
        =======================================================================
        TOP OVERLAY: FLOATING BACK BUTTON, DISCOVERY FILTER CAPSULE & MUTE TOGGLE
        =======================================================================
      */}
      {/* Left Back Button */}
      <div className="fixed top-0 left-0 z-40 safe-area-pt p-3 sm:p-4 pointer-events-auto">
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all shadow-lg hover:border-[#d3da0c]/50"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Right Mute Toggle */}
      <div className="fixed top-0 right-0 z-40 safe-area-pt p-3 sm:p-4 pointer-events-auto">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all shadow-lg"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-gray-300" /> : <Volume2 className="w-5 h-5 text-[#d3da0c]" />}
        </button>
      </div>

      {/* Hidden File Inputs (Triggered directly by Choice Sheet buttons) */}
      <input
        ref={reelFileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        onChange={handleReelFileChange}
        className="hidden"
      />
      <input
        ref={postFileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handlePostFilesChange}
        className="hidden"
      />

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
          <h2 className="text-xl font-extrabold text-white">No Recaps in this Category</h2>
          <p className="text-xs text-gray-400 mt-2 max-w-xs">
            Be the first to share an event recap, vertical video highlight, or community memory!
          </p>
          <button
            onClick={() => setShowChoiceSheet(true)}
            className="mt-6 px-6 py-3 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs active:scale-95 transition-all shadow-lg shadow-[#d3da0c]/20"
          >
            Create Recap
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
              const posterSrc =
                resolveMediaUrl(reel.thumbnail_url) ||
                (reel.event?.flyer_url ? resolveMediaUrl(reel.event.flyer_url) : '');
              const isVideoFile =
                videoSrc &&
                (videoSrc.endsWith('.mp4') ||
                  videoSrc.endsWith('.mov') ||
                  videoSrc.endsWith('.webm') ||
                  videoSrc.includes('/video'));
              const isFollowing = Boolean(reel.author?.id ? followedUsers[reel.author.id] : false);

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
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
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

                    {/* Invite Friends to Event */}
                    {reel.event && (
                      <button
                        onClick={() =>
                          setInviteDrawerItem({
                            eventId: reel.event!.id,
                            title: reel.event!.title,
                            venueName: reel.event!.venue_name,
                            flyerUrl: reel.event!.flyer_url,
                          })
                        }
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                        title="Invite Friends"
                      >
                        <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <span className="text-[0.625rem] font-extrabold text-[#d3da0c] drop-shadow">Invite</span>
                      </button>
                    )}

                    {/* Quick Create Button (+) */}
                    <button
                      onClick={() => setShowChoiceSheet(true)}
                      className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                      title="Post or Reel"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Bottom Creator & Event Overlay */}
                  <div className="absolute left-4 right-20 bottom-28 z-20 space-y-2">
                    {/* Creator Handle + Follow */}
                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={() => navigate(`/profiles/${reel.author?.id || 1}`)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full border border-[#d3da0c] overflow-hidden bg-black shrink-0">
                          <img
                            src={resolveMediaUrl(reel.author?.avatar_url) || '/default-avatar.png'}
                            alt={reel.author?.name || 'Creator'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/default-avatar.png';
                            }}
                          />
                        </div>
                        <span className="text-base font-extrabold text-white drop-shadow">
                          @{reel.author?.username || 'creator'}
                        </span>
                        {reel.author?.is_verified && (
                          <VerificationBadge size="sm" className="shrink-0" />
                        )}
                      </div>

                      <span className="text-gray-400">•</span>
                      <button
                        onClick={() => reel.author?.id && handleFollowUser(reel.author.id, reel.author?.artist_id)}
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

                    {/* Mandatory Connected Event Badge */}
                    {reel.event && (
                      <div
                        onClick={() => navigate(`/events/${reel.event?.id}`)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-[#d3da0c]/60 text-white text-xs font-extrabold cursor-pointer hover:border-[#d3da0c] active:scale-95 transition-all shadow-md w-fit"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#d3da0c]" />
                        <span className="text-[#d3da0c] truncate max-w-[11.25rem]">{reel.event.title}</span>
                        <span className="text-gray-400 text-[0.6875rem]">• View Event →</span>
                      </div>
                    )}

                    {/* Tagged Friends Display */}
                    {reel.tagged_users && reel.tagged_users.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-white/90">
                        <Users className="w-3.5 h-3.5 text-[#d3da0c]" />
                        <span className="text-gray-300 font-semibold">With</span>
                        <div className="flex flex-wrap gap-1">
                          {reel.tagged_users.map((f) => (
                            <span
                              key={f.id}
                              onClick={() => navigate(`/profiles/${f.id}`)}
                              className="text-[#d3da0c] font-bold hover:underline cursor-pointer"
                            >
                              @{f.username}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Original Sound / Music */}
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      <Music2 className="w-3.5 h-3.5 text-[#d3da0c] animate-pulse" />
                      <span className="truncate max-w-[13.75rem]">
                        {reel.music_title || 'Original Sound — Sound It Entertainment'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // -----------------------------------------------------------------
            // B. COMMUNITY POST ITEM (CONTINUOUS FEED SOCIAL POST)
            // -----------------------------------------------------------------
            if (item.type === 'community_post') {
              const post = item.data;
              const authorName =
                `${post.user?.first_name || ''} ${post.user?.last_name || ''}`.trim() ||
                post.user?.username ||
                'Community Member';
              const authorAvatar = resolveMediaUrl(post.user?.avatar_url) || '/default-avatar.png';
              const images = (post.images || []).map((img) => resolveMediaUrl(img)).filter(Boolean);
              const postVideos = (post.videos || []).map((vid) => resolveMediaUrl(vid)).filter(Boolean);

              return (
                <div
                  key={item.id}
                  className="relative h-[100dvh] w-full snap-start snap-always flex flex-col justify-between bg-[#040e02] overflow-hidden px-4 pt-16 pb-28"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
                  <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#d3da0c]/5 blur-3xl pointer-events-none" />

                  {/* Main Post Card Content */}
                  <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full space-y-3">
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
                              (e.currentTarget as HTMLImageElement).src = '/default-avatar.png';
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-white text-sm">{authorName}</span>
                            {post.user?.is_verified && (
                              <VerificationBadge size="sm" className="shrink-0" />
                            )}
                          </div>
                          <span className="text-[0.6875rem] text-gray-400">
                            {post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : 'Recently'}
                          </span>
                        </div>
                      </div>

                      {post.section && (
                        <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[0.625rem] font-bold uppercase tracking-wider">
                          {post.section.name}
                        </span>
                      )}
                    </div>

                    {/* Post Title & Text */}
                    <div className="space-y-1">
                      {post.title && (
                        <h3 className="text-lg font-black text-white leading-snug">{post.title}</h3>
                      )}
                      <p className="text-sm text-gray-200 leading-relaxed line-clamp-4">
                        {post.content}
                      </p>
                    </div>

                    {/* Attached Media */}
                    {images.length > 0 ? (
                      <div
                        className={`rounded-2xl overflow-hidden border border-white/10 ${
                          images.length === 1 ? 'max-h-[44dvh]' : 'grid grid-cols-2 gap-1.5 max-h-[44dvh]'
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

                    {/* Mandatory Connected Event Card */}
                    {(post.event_title || (post as any).event) && (
                      <div
                        onClick={() => post.event_id && navigate(`/events/${post.event_id}`)}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#081305] border border-[#d3da0c]/40 hover:border-[#d3da0c] transition-colors cursor-pointer group shadow-lg"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-[#d3da0c]/20 border border-[#d3da0c]/40 flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4 text-[#d3da0c]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">
                              {post.event_title || (post as any).event?.title}
                            </p>
                            <p className="text-[0.625rem] text-gray-400">View Event Details & Tickets</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#d3da0c] group-hover:translate-x-1 transition-transform">
                          View Event →
                        </span>
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
                        {formatCount(post.comments_count || 0)}
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

                    {/* Save */}
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

                    {/* Invite Friends to Event */}
                    {post.event_id && (
                      <button
                        onClick={() =>
                          setInviteDrawerItem({
                            eventId: post.event_id!,
                            title: post.event_title || 'Sound It Event',
                          })
                        }
                        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                        title="Invite Friends"
                      >
                        <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <span className="text-[0.625rem] font-extrabold text-[#d3da0c] drop-shadow">Invite</span>
                      </button>
                    )}

                    {/* Quick Create Button (+) */}
                    <button
                      onClick={() => setShowChoiceSheet(true)}
                      className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                      title="Post or Reel"
                    >
                      <Plus className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            }

            // -----------------------------------------------------------------
            // C. EVENT PHOTO COLLECTION ITEM (PAST EVENT HIGHLIGHTS)
            // -----------------------------------------------------------------
            if (item.type === 'event_collection') {
              const collection = item.data;
              const displayPhotos = collection.photos.slice(0, 5);
              const remainingCount = collection.total_photos - displayPhotos.length;

              return (
                <div
                  key={item.id}
                  className="relative h-[100dvh] w-full snap-start snap-always flex flex-col justify-between bg-[#030a01] overflow-hidden px-4 pt-16 pb-28"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90 pointer-events-none" />

                  <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full border-2 border-[#d3da0c] overflow-hidden bg-black shrink-0">
                        <img
                          src={collection.organizer_avatar || '/default-avatar.png'}
                          alt={collection.organizer_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/default-avatar.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-black text-white truncate">{collection.title}</h2>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {collection.date_str && <span>{collection.date_str}</span>}
                          {collection.venue_name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{collection.venue_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 4-5 Photos Gallery Grid */}
                    <div className="rounded-2xl overflow-hidden border border-white/10 grid grid-cols-6 gap-1.5 max-h-[46dvh] bg-black">
                      {displayPhotos.map((photo, i) => {
                        const colSpan =
                          displayPhotos.length === 1
                            ? 'col-span-6 aspect-video'
                            : displayPhotos.length === 2
                            ? 'col-span-3 aspect-square'
                            : displayPhotos.length === 3
                            ? i === 0
                              ? 'col-span-6 aspect-video'
                              : 'col-span-3 aspect-square'
                            : displayPhotos.length === 4
                            ? 'col-span-3 aspect-square'
                            : i < 2
                            ? 'col-span-3 aspect-square'
                            : 'col-span-2 aspect-square';

                        const isLastWithMore = i === displayPhotos.length - 1 && remainingCount > 0;

                        return (
                          <div
                            key={i}
                            onClick={() => navigate(`/events/${collection.event_id}`)}
                            className={`relative overflow-hidden cursor-pointer group ${colSpan}`}
                          >
                            <img
                              src={photo}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {isLastWithMore && (
                              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center font-black text-white text-lg">
                                +{remainingCount} more
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* CTA Button navigating to Event Page */}
                    <button
                      onClick={() => navigate(`/events/${collection.event_id}`)}
                      className="w-full py-3.5 px-4 rounded-xl bg-[#d3da0c] text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#d3da0c]/20 hover:bg-[#b8be0a] active:scale-98 transition-all"
                    >
                      <span>View All Photos & Event Details</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right-Side Action Rail */}
                  <div className="absolute right-3.5 bottom-28 z-20 flex flex-col items-center gap-5">
                    {/* Share */}
                    <button
                      onClick={() => handleShareItem(item)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-bold text-white drop-shadow">Share</span>
                    </button>

                    {/* Invite */}
                    <button
                      onClick={() =>
                        setInviteDrawerItem({
                          eventId: collection.event_id,
                          title: collection.title,
                          venueName: collection.venue_name,
                          flyerUrl: collection.photos[0],
                        })
                      }
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
                      title="Invite Friends"
                    >
                      <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                      </div>
                      <span className="text-[0.625rem] font-extrabold text-[#d3da0c] drop-shadow">Invite</span>
                    </button>

                    {/* Quick Create (+) */}
                    <button
                      onClick={() => setShowChoiceSheet(true)}
                      className="w-11 h-11 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg shadow-[#d3da0c]/30 active:scale-90 transition-transform"
                      title="Post or Reel"
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
        PORTAL A: INITIAL ACTION SHEET (USER TAPS + ON RECAPS)
        Displays two clear choices: "Post" and "Reels"
        Directly opens device photo/video gallery upon selection!
        =======================================================================
      */}
      {typeof document !== 'undefined' && document.body &&
        createPortal(
          <AnimatePresence>
            {showChoiceSheet && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowChoiceSheet(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                />
                <motion.div
                  data-modal-open="true"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="fixed inset-x-0 bottom-0 z-[100] rounded-t-3xl bg-[#081206] border-t border-white/15 p-5 text-white pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
                >
                  <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-black text-white">Create Event Content</h3>
                      <p className="text-xs text-gray-400">
                        Sound It is strictly event-driven. Connect your updates to real events.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowChoiceSheet(false)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 mt-5">
                    {/* 1. Post Button (Takes directly to photo/media gallery) */}
                    <button
                      onClick={() => {
                        setShowChoiceSheet(false);
                        postFileInputRef.current?.click();
                      }}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#d3da0c] active:scale-95 transition-all flex flex-col items-center text-center gap-2.5 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center text-[#d3da0c] group-hover:bg-[#d3da0c] group-hover:text-black transition-colors">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="block text-base font-black text-white group-hover:text-[#d3da0c] transition-colors">
                          Post
                        </span>
                        <span className="block text-[0.6875rem] text-gray-400 mt-0.5">
                          Share photos, reviews & event memories
                        </span>
                      </div>
                    </button>

                    {/* 2. Reels Button (Takes directly to video gallery) */}
                    <button
                      onClick={() => {
                        setShowChoiceSheet(false);
                        reelFileInputRef.current?.click();
                      }}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#d3da0c] active:scale-95 transition-all flex flex-col items-center text-center gap-2.5 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#d3da0c]/15 border border-[#d3da0c]/30 flex items-center justify-center text-[#d3da0c] group-hover:bg-[#d3da0c] group-hover:text-black transition-colors">
                        <Play className="w-7 h-7 fill-current ml-0.5" />
                      </div>
                      <div>
                        <span className="block text-base font-black text-white group-hover:text-[#d3da0c] transition-colors">
                          Reels
                        </span>
                        <span className="block text-[0.6875rem] text-gray-400 mt-0.5">
                          Upload vertical videos & highlight aftermovies
                        </span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/*
        =======================================================================
        PORTAL B: CREATION FORM MODAL (STEP 2: EVENT PICKER, TAGGING, CAPTION)
        Rendered via React Portal with z-[100] and pb-32 so Publish is never blocked!
        =======================================================================
      */}
      {typeof document !== 'undefined' && document.body &&
        createPortal(
          <AnimatePresence>
            {showCreateModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCreateModal(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                />
                <motion.div
                  data-modal-open="true"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  style={{
                    bottom: 'var(--keyboard-offset, 0px)',
                    maxHeight: 'min(88dvh, calc(var(--vvh, 100dvh) - 1.5rem))',
                  }}
                  className="fixed inset-x-0 z-[100] h-[86dvh] rounded-t-3xl bg-[#081206] border-t border-white/15 flex flex-col text-white pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] transition-[bottom] duration-150"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-[#d3da0c] text-black">
                        {createMode === 'reel' ? 'Event Reel' : 'Event Post'}
                      </span>
                      <span className="text-xs text-gray-400">Step 2: Connect to Event</span>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable Form Content */}
                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Media Preview Bar */}
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                      {previewUrl ? (
                        createMode === 'reel' ? (
                          <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-black shrink-0 border border-white/20">
                            <video src={previewUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white fill-current" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 border border-white/20">
                            <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          {selectedFile ? selectedFile.name : `${selectedPostFiles.length} media files selected`}
                        </p>
                        {createMode === 'reel' && autoThumbnail && (
                          <p className="text-[0.6875rem] text-[#d3da0c] flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3" />
                            <span>Video cover extracted from video frame</span>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (createMode === 'reel') reelFileInputRef.current?.click();
                            else postFileInputRef.current?.click();
                          }}
                          className="text-[0.6875rem] text-gray-400 hover:text-white underline mt-1"
                        >
                          Change media
                        </button>
                      </div>
                    </div>

                    {/* =======================================================
                        MANDATORY EVENT SELECTION PICKER (CRITICAL REQUIREMENT)
                       ======================================================= */}
                    <div className="space-y-2 p-3.5 rounded-2xl bg-[#040c02] border border-[#d3da0c]/30">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-[#d3da0c] flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>Select Event (Mandatory) *</span>
                        </label>
                        {selectedEvent && (
                          <span className="text-[0.625rem] font-extrabold text-green-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>

                      <p className="text-[0.6875rem] text-gray-400">
                        Sound It is strictly event-driven. Your content must belong to an upcoming, ongoing, or past event.
                      </p>

                      {/* Event Timing Filter Tabs */}
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                        {(['upcoming', 'ongoing', 'past', 'all'] as const).map((timing) => (
                          <button
                            key={timing}
                            type="button"
                            onClick={() => {
                              setEventTimingFilter(timing);
                              loadEligibleEvents(timing, eventSearchQuery);
                            }}
                            className={`px-3 py-1 rounded-full text-[0.6875rem] font-black capitalize transition-all ${
                              eventTimingFilter === timing
                                ? 'bg-[#d3da0c] text-black shadow-sm'
                                : 'bg-white/5 text-gray-400 hover:text-white'
                            }`}
                          >
                            {timing}
                          </button>
                        ))}
                      </div>

                      {/* Event Search Input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={eventSearchQuery}
                          onChange={(e) => {
                            setEventSearchQuery(e.target.value);
                            loadEligibleEvents(eventTimingFilter, e.target.value);
                          }}
                          placeholder="Search event by name or venue…"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                        />
                      </div>

                      {/* Selectable Events List */}
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                        {loadingEvents ? (
                          <div className="py-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin text-[#d3da0c]" />
                            <span>Loading eligible events…</span>
                          </div>
                        ) : eligibleEvents.length === 0 ? (
                          <div className="py-3 text-center text-xs text-gray-500">
                            No events found for this filter.
                          </div>
                        ) : (
                          eligibleEvents.map((ev) => {
                            const isSelected = selectedEvent?.id === ev.id;
                            const evDate = ev.start_date
                              ? new Date(ev.start_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '';

                            return (
                              <div
                                key={ev.id}
                                onClick={() => setSelectedEvent(isSelected ? null : ev)}
                                className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-[#d3da0c]/15 border-[#d3da0c]'
                                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                                    <img
                                      src={resolveMediaUrl(ev.flyer_url) || '/logo-icon-dark.png'}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = '/default-avatar.png';
                                      }}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs font-black truncate ${
                                        isSelected ? 'text-[#d3da0c]' : 'text-white'
                                      }`}
                                    >
                                      {ev.title}
                                    </p>
                                    <p className="text-[0.625rem] text-gray-400 truncate">
                                      {evDate} • {ev.venue_name || ev.city}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-black uppercase ${
                                      ev.timing_status === 'upcoming'
                                        ? 'bg-green-500/20 text-green-400'
                                        : ev.timing_status === 'ongoing'
                                        ? 'bg-[#d3da0c]/20 text-[#d3da0c]'
                                        : 'bg-white/10 text-gray-400'
                                    }`}
                                  >
                                    {ev.timing_status}
                                  </span>
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-[#d3da0c] text-black flex items-center justify-center">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* =======================================================
                        FRIEND TAGGING SECTION
                       ======================================================= */}
                    <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#d3da0c]" />
                          <span>Tag Friends (@username)</span>
                        </label>
                        {taggedFriends.length > 0 && (
                          <span className="text-[0.625rem] text-gray-400">{taggedFriends.length} tagged</span>
                        )}
                      </div>

                      {/* Tagged Chips */}
                      {taggedFriends.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pb-1">
                          {taggedFriends.map((friend) => (
                            <span
                              key={friend.id}
                              className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-[#d3da0c]/20 border border-[#d3da0c]/50 text-white text-xs font-bold"
                            >
                              <img
                                src={resolveMediaUrl(friend.avatar_url) || '/default-avatar.png'}
                                alt=""
                                className="w-4 h-4 rounded-full object-cover"
                              />
                              <span>@{friend.username}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setTaggedFriends((prev) => prev.filter((f) => f.id !== friend.id))
                                }
                                className="text-gray-400 hover:text-white ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Friend Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          value={friendSearchQuery}
                          onChange={(e) => {
                            setFriendSearchQuery(e.target.value);
                            searchFriends(e.target.value);
                          }}
                          placeholder="Search friends by username or name to tag…"
                          className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                        />

                        {/* Suggestions Dropdown */}
                        {friendSearchResults.length > 0 && friendSearchQuery && (
                          <div className="absolute inset-x-0 top-full mt-1 z-30 rounded-xl bg-[#081305] border border-white/15 p-1 shadow-2xl max-h-36 overflow-y-auto space-y-1">
                            {friendSearchResults.map((user) => {
                              const isAlreadyTagged = taggedFriends.some((f) => f.id === user.id);
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => {
                                    if (!isAlreadyTagged) {
                                      setTaggedFriends((prev) => [...prev, user]);
                                    }
                                    setFriendSearchQuery('');
                                    setFriendSearchResults([]);
                                  }}
                                  disabled={isAlreadyTagged}
                                  className={`w-full p-2 rounded-lg flex items-center justify-between text-left text-xs ${
                                    isAlreadyTagged
                                      ? 'opacity-40 cursor-not-allowed'
                                      : 'hover:bg-white/10 transition-colors'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <img
                                      src={resolveMediaUrl(user.avatar_url) || '/default-avatar.png'}
                                      alt=""
                                      className="w-6 h-6 rounded-full object-cover shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-bold text-white truncate">@{user.username}</p>
                                      <p className="text-[0.625rem] text-gray-400 truncate">{user.name}</p>
                                    </div>
                                  </div>
                                  <span className="text-[0.625rem] font-extrabold text-[#d3da0c]">
                                    {isAlreadyTagged ? 'Tagged' : '+ Tag'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Post Title & Caption */}
                    {createMode === 'post' && (
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Post Title (optional)"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    )}

                    <textarea
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                      placeholder={
                        createMode === 'reel'
                          ? 'Write a caption, mention @friends and add #hashtags…'
                          : 'Share your event experience, recap notes, or memories with the Sound It community…'
                      }
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>

                  {/* Submit Button Bar (Padded safely above bottom navigation) */}
                  <div className="px-5 pt-3 border-t border-white/10 shrink-0">
                    {!selectedEvent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3.5 rounded-xl bg-white/10 text-gray-400 font-extrabold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        <span>Select an Event to Publish (Mandatory)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={isUploading}
                        className="w-full py-3.5 rounded-xl bg-[#d3da0c] text-black font-black text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg shadow-[#d3da0c]/20"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Publishing to Recaps…</span>
                          </>
                        ) : (
                          <span>Publish to Recaps Feed</span>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/*
        =======================================================================
        PORTAL C: EVENT INVITATION DRAWER (SOUND IT FRIENDS + TRACKED EXTERNAL LINK)
        Allows inviting registered friends or sharing tracked links via WhatsApp, WeChat, SMS
        =======================================================================
      */}
      {typeof document !== 'undefined' && document.body &&
        createPortal(
          <AnimatePresence>
            {inviteDrawerItem && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setInviteDrawerItem(null)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                />
                <motion.div
                  data-modal-open="true"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  style={{
                    bottom: 'var(--keyboard-offset, 0px)',
                    maxHeight: 'min(85dvh, calc(var(--vvh, 100dvh) - 1.5rem))',
                  }}
                  className="fixed inset-x-0 z-[100] rounded-t-3xl bg-[#081206] border-t border-white/15 p-5 text-white pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] flex flex-col space-y-4 overflow-y-auto transition-[bottom] duration-150"
                >
                  <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black text-white">Invite Friends to Event</h3>
                      <p className="text-xs text-[#d3da0c] font-bold truncate max-w-xs">
                        {inviteDrawerItem.title}
                      </p>
                    </div>
                    <button
                      onClick={() => setInviteDrawerItem(null)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Section 1: In-App Sound It Invitations */}
                  <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                    <label className="text-xs font-black text-white flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#d3da0c]" />
                      <span>Sound It Friends (Instant Notification)</span>
                    </label>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={inviteUserQuery}
                        onChange={(e) => {
                          setInviteUserQuery(e.target.value);
                          searchInvitees(e.target.value);
                        }}
                        placeholder="Search friend by name or username…"
                        className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    </div>

                    {/* Selected Invitees Chips */}
                    {selectedInvitees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedInvitees.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-[#d3da0c]/20 border border-[#d3da0c]/40 text-xs text-white font-bold"
                          >
                            <span>@{u.username}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedInvitees((prev) => prev.filter((i) => i.id !== u.id))}
                              className="text-gray-400 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Search Results list */}
                    {inviteUserResults.length > 0 && inviteUserQuery && (
                      <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                        {inviteUserResults.map((u) => {
                          const isSelected = selectedInvitees.some((i) => i.id === u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedInvitees((prev) => prev.filter((i) => i.id !== u.id));
                                } else {
                                  setSelectedInvitees((prev) => [...prev, u]);
                                }
                              }}
                              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer text-xs ${
                                isSelected ? 'bg-[#d3da0c]/20 border border-[#d3da0c]' : 'bg-white/5 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={resolveMediaUrl(u.avatar_url) || '/default-avatar.png'}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="font-bold text-white truncate">@{u.username}</p>
                                  <p className="text-[0.625rem] text-gray-400 truncate">{u.name}</p>
                                </div>
                              </div>
                              <span className="text-[0.625rem] font-black text-[#d3da0c]">
                                {isSelected ? 'Selected' : '+ Add'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedInvitees.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSendInvitations}
                        disabled={isSendingInvites}
                        className="w-full mt-2 py-2.5 rounded-xl bg-[#d3da0c] text-black font-black text-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
                      >
                        {isSendingInvites ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Send Sound It Invitations ({selectedInvitees.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Section 2: Share Tracked Link via WhatsApp, WeChat, SMS */}
                  <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/10">
                    <label className="text-xs font-black text-white flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-[#d3da0c]" />
                      <span>Share Tracked Invitation Link (External)</span>
                    </label>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {/* WhatsApp */}
                      <button
                        onClick={() => handleShareInviteLink('whatsapp')}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#d3da0c] flex flex-col items-center gap-1 text-[0.6875rem] font-bold text-gray-200 active:scale-95 transition-all"
                      >
                        <MessageSquare className="w-4 h-4 text-green-400" />
                        <span>WhatsApp</span>
                      </button>

                      {/* WeChat */}
                      <button
                        onClick={() => handleShareInviteLink('wechat')}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#d3da0c] flex flex-col items-center gap-1 text-[0.6875rem] font-bold text-gray-200 active:scale-95 transition-all"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>WeChat</span>
                      </button>

                      {/* SMS */}
                      <button
                        onClick={() => handleShareInviteLink('sms')}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#d3da0c] flex flex-col items-center gap-1 text-[0.6875rem] font-bold text-gray-200 active:scale-95 transition-all"
                      >
                        <Send className="w-4 h-4 text-blue-400" />
                        <span>SMS</span>
                      </button>

                      {/* Copy Link */}
                      <button
                        onClick={() => handleShareInviteLink('link')}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#d3da0c] flex flex-col items-center gap-1 text-[0.6875rem] font-bold text-gray-200 active:scale-95 transition-all"
                      >
                        <Copy className="w-4 h-4 text-[#d3da0c]" />
                        <span>Copy Link</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/*
        =======================================================================
        PORTAL D: UNIFIED COMMENTS DRAWER (REELS & COMMUNITY POSTS)
        =======================================================================
      */}
      {typeof document !== 'undefined' && document.body &&
        createPortal(
          <AnimatePresence>
            {activeCommentItem && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setActiveCommentItem(null)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                />
                <motion.div
                  data-modal-open="true"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  style={{
                    bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 'var(--keyboard-offset, 0px)',
                    maxHeight: 'min(82dvh, calc(var(--vvh, 100dvh) - 1.5rem))',
                  }}
                  className="fixed inset-x-0 z-[100] h-[75dvh] rounded-t-3xl bg-[#081206] border-t border-white/15 flex flex-col text-white shadow-2xl transition-[bottom] duration-150 ease-out"
                >
                  <div className="w-12 h-1 bg-white/20 rounded-full mx-auto my-3 shrink-0" />

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pb-3 border-b border-white/10 shrink-0">
                    <div>
                      <h3 className="text-base font-extrabold text-white">Comments</h3>
                      <p className="text-xs text-gray-400 truncate max-w-xs">
                        {activeCommentItem.title}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveCommentItem(null)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Comments List - Scrolls independently without hiding input */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0 overscroll-contain">
                    {loadingComments ? (
                      <div className="h-32 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c]" />
                      </div>
                    ) : organizedComments.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-gray-400">
                          No comments yet. Be the first to start the conversation!
                        </p>
                      </div>
                    ) : (
                      organizedComments.map((comm) => renderCommentItem(comm))
                    )}
                  </div>

                  {/* Input Footer - Fixed at bottom of panel, rides smoothly above keyboard */}
                  <div
                    style={{
                      paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))',
                    }}
                    className="px-5 pt-3 border-t border-white/10 shrink-0 space-y-2 bg-[#081206]"
                  >
                    {/* Replying Banner */}
                    {replyingTo && (
                      <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#d3da0c]/15 border border-[#d3da0c]/30 text-xs">
                        <div className="flex items-center gap-1.5 text-gray-300 truncate">
                          <span className="text-[#d3da0c] font-black">Replying to</span>
                          <span className="font-bold text-white truncate">@{replyingTo.authorName}</span>
                        </div>
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white shrink-0 ml-2"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {!isAuthenticated && (
                      <input
                        type="text"
                        value={guestNameState}
                        onChange={(e) => setGuestNameState(e.target.value)}
                        placeholder="Your Name (Required to post as Guest)"
                        className="w-full px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#d3da0c]"
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        ref={commentInputRef}
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                        placeholder={replyingTo ? `Reply to @${replyingTo.authorName}…` : 'Add a comment…'}
                        className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-[#d3da0c]"
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={submittingComment || !commentText.trim()}
                        className="w-10 h-10 rounded-full bg-[#d3da0c] text-black flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0 font-bold"
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
          </AnimatePresence>,
          document.body
        )}

      {/*
        =======================================================================
        PORTAL E: UNIVERSAL SHARE MODAL (REELS, POSTS & RECAPS)
        Unified official Sound It sharing system with WeChat Poster Card,
        QR Code generator, WhatsApp, SMS, and hardened Native Share!
        =======================================================================
      */}
      {shareModalItem && (
        <UniversalShareModal
          isOpen={Boolean(shareModalItem)}
          onClose={() => setShareModalItem(null)}
          item={shareModalItem}
        />
      )}
    </div>
  );
}
