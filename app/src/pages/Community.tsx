import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  Image as ImageIcon,
  Trash2,
  Calendar,
  X,
  Plus,
  Loader2,
  FolderOpen,
  Video,
  Bookmark,
  BadgeCheck,
  MoreHorizontal,
  FileText,
  PlayCircle,
  MapPin,
  Users,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useCommunityStore, type CommunityPost, type CommunityComment, getGuestName, setGuestName } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import { useEventStore } from '@/store/eventStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import VerificationBadge from '@/components/VerificationBadge';
import { WEB_ORIGIN } from '@/lib/appUrl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import RecapsSegmentNav, { type RecapsTab } from '@/components/recaps/RecapsSegmentNav';

interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

type FeedFilter = 'for_you' | 'trending' | 'following' | 'my_posts' | 'saved';

const Community = ({
  activeTab,
  onTabChange,
}: {
  activeTab?: RecapsTab;
  onTabChange?: (tab: RecapsTab) => void;
} = {}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAuthenticated } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const {
    posts, sections, selectedSection, isLoading, isCreating, hasMore,
    fetchPosts, fetchSections, fetchPostsBySection, createPost, deletePost, likePost, unlikePost,
    toggleBookmark, addComment, deleteComment, likeComment, unlikeComment, sharePost, loadMore, uploadMedia
  } = useCommunityStore();

  const initialFilter = (searchParams.get('filter') as FeedFilter) || 'for_you';
  const [feedFilter, setFeedFilter] = useState<FeedFilter>(
    ['for_you', 'trending', 'following', 'my_posts', 'saved'].includes(initialFilter)
      ? initialFilter
      : 'for_you'
  );
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostSectionId, setNewPostSectionId] = useState('');
  const [newPostEventId, setNewPostEventId] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [newPostVideos, setNewPostVideos] = useState<string[]>([]);
  const [isWritingPost, setIsWritingPost] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const [postType, setPostType] = useState<'post' | 'photo' | 'video' | 'event'>('post');
  const [postAudience, setPostAudience] = useState<'for_you' | 'following' | 'community'>('for_you');
  const [postLocation, setPostLocation] = useState('');
  const [postTaggedPeople, setPostTaggedPeople] = useState('');
  const [showLocationRow, setShowLocationRow] = useState(false);
  const [showEventRow, setShowEventRow] = useState(false);
  const [showPeopleRow, setShowPeopleRow] = useState(false);
  const [showSectionRow, setShowSectionRow] = useState(false);
  const [showAudienceDropdown, setShowAudienceDropdown] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<Record<number, boolean>>({});
  const [expandedPosts, setExpandedPosts] = useState<Record<number, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePostId, setSharePostId] = useState<number | null>(null);
  const [guestName, setGuestNameState] = useState(getGuestName() || '');
  const [storyArtists, setStoryArtists] = useState<Array<{ id: number; stage_name?: string; name?: string; profile_image_url?: string }>>([]);

  useEffect(() => {
    const fetchStoryArtists = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1'}/artists/featured`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setStoryArtists(data.slice(0, 8));
          }
        }
      } catch {
        // Silently handle
      }
    };
    fetchStoryArtists();
  }, []);
  const [guestEmail, setGuestEmail] = useState('');
  const [commentGuestNames, setCommentGuestNames] = useState<Record<number, string>>({});
  const [replyGuestNames, setReplyGuestNames] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paramFilter = searchParams.get('filter') as FeedFilter | null;
    if (paramFilter && ['for_you', 'trending', 'following', 'my_posts', 'saved'].includes(paramFilter)) {
      setFeedFilter(paramFilter);
      fetchPosts({ page: 1, feed_type: paramFilter });
    } else {
      fetchPosts({ page: 1, feed_type: feedFilter });
    }
    fetchSections();
    fetchEvents();
  }, [searchParams]);

  const handleFeedFilterChange = (nextFilter: FeedFilter) => {
    setFeedFilter(nextFilter);
    useCommunityStore.setState({ selectedSection: null });
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === 'for_you') {
      nextParams.delete('filter');
    } else {
      nextParams.set('filter', nextFilter);
    }
    setSearchParams(nextParams, { replace: true });
    fetchPosts({ page: 1, feed_type: nextFilter });
  };

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  const handleSectionSelect = (section: typeof selectedSection) => {
    useCommunityStore.setState({ selectedSection: section });
    if (section) {
      fetchPostsBySection(section.slug, 1);
    } else {
      fetchPosts({ page: 1, feed_type: feedFilter });
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImages(true);
    try {
      const urls = await uploadMedia(Array.from(files));
      setNewPostImages((prev) => [...prev, ...urls]);
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error(t('community.uploadFailed') || 'Image upload failed');
    } finally {
      setIsUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingVideos(true);
    try {
      const urls = await uploadMedia(Array.from(files));
      setNewPostVideos((prev) => [...prev, ...urls]);
    } catch (error) {
      console.error('Video upload failed:', error);
      toast.error(t('community.uploadFailed') || 'Video upload failed');
    } finally {
      setIsUploadingVideos(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setNewPostImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeVideo = (idx: number) => {
    setNewPostVideos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGuestNameChange = (name: string) => {
    setGuestNameState(name);
    if (name.trim()) {
      setGuestName(name.trim());
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    if (!isAuthenticated && !guestName.trim()) {
      toast.error(t('community.nameRequired') || 'Please enter your name');
      return;
    }

    const success = await createPost({
      title: newPostTitle.trim() || undefined,
      content: newPostContent,
      images: newPostImages,
      videos: newPostVideos,
      section_id: newPostSectionId ? Number(newPostSectionId) : undefined,
      event_id: newPostEventId ? Number(newPostEventId) : undefined,
      guestName: !isAuthenticated ? guestName.trim() : undefined,
      guestEmail: !isAuthenticated ? guestEmail.trim() || undefined : undefined,
    });

    if (success) {
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostSectionId('');
      setNewPostEventId('');
      setNewPostImages([]);
      setNewPostVideos([]);
      setIsWritingPost(false);
    }
  };

  const handleLike = async (post: CommunityPost) => {
    if (post.has_liked) {
      await unlikePost(post.id);
    } else {
      await likePost(post.id);
    }
  };

  const handleCommentLike = async (comment: CommunityComment, postId: number) => {
    if (comment.has_liked) {
      await unlikeComment(comment.id, postId);
    } else {
      await likeComment(comment.id, postId);
    }
  };

  const handleAddComment = async (postId: number) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    if (!isAuthenticated && !commentGuestNames[postId]?.trim() && !getGuestName()) {
      toast.error(t('community.nameRequired') || 'Please enter your name');
      return;
    }

    const name = (!isAuthenticated && commentGuestNames[postId]?.trim()) || getGuestName() || undefined;
    await addComment(postId, content, undefined, name || undefined, guestEmail || undefined);
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleAddReply = async (postId: number, parentCommentId: number) => {
    const content = replyInputs[parentCommentId]?.trim();
    if (!content) return;

    if (!isAuthenticated && !replyGuestNames[parentCommentId]?.trim() && !getGuestName()) {
      toast.error(t('community.nameRequired') || 'Please enter your name');
      return;
    }

    const name = (!isAuthenticated && replyGuestNames[parentCommentId]?.trim()) || getGuestName() || undefined;
    await addComment(postId, content, parentCommentId, name || undefined, guestEmail || undefined);
    setReplyInputs((prev) => ({ ...prev, [parentCommentId]: '' }));
    setReplyingTo((prev) => ({ ...prev, [parentCommentId]: false }));
  };

  const handleShare = async (postId: number, platform?: string) => {
    await sharePost(postId, platform);
    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: t('community.shareTitle'),
          text: t('community.shareText'),
          url: `${WEB_ORIGIN}/community?post=${postId}`
        });
      } catch {
        // User cancelled
      }
    }
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(`${WEB_ORIGIN}/community?post=${postId}`);
        toast.success(t('community.linkCopied') || 'Link copied');
      } catch {
        // ignore
      }
    }
    setIsShareModalOpen(false);
    setSharePostId(null);
  };

  const openShareModal = (postId: number) => {
    setSharePostId(postId);
    setIsShareModalOpen(true);
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  const getMediaItems = (post: CommunityPost): MediaItem[] => [
    ...(post.images || []).map((url) => ({ type: 'image' as const, url })),
    ...(post.videos || []).map((url) => ({ type: 'video' as const, url })),
  ];

  const renderComment = (comment: CommunityComment, postId: number, isReply = false) => (
    <div key={comment.id} className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : ''}`}>
      <Avatar className="w-8 h-8">
        <AvatarImage src={comment.user.avatar_url || ''} />
        <AvatarFallback className="bg-[#d3da0c]/50 text-black text-xs">
          {getInitials(comment.user.first_name, comment.user.last_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="bg-white dark:bg-[#141414] border border-black/5 dark:border-transparent rounded-2xl rounded-tl-none px-4 py-2 shadow-xs dark:shadow-none">
          <div className="flex items-center justify-between">
            <p className="text-[#020b00] dark:text-white text-sm font-medium flex items-center gap-2">
              {comment.user.first_name} {comment.user.last_name}
              {comment.user.is_guest && (
                <span className="text-[0.625rem] px-1.5 py-0.5 bg-black/5 dark:bg-white/10 text-gray-600 dark:text-white/70 rounded-full">
                  {t('community.guest') || 'Guest'}
                </span>
              )}
            </p>
            <span className="text-gray-400 dark:text-white/40 text-xs">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-gray-700 dark:text-white/70 text-sm mt-0.5">{comment.content}</p>
        </div>
        <div className="flex items-center gap-4 mt-1 ml-2">
          <button
            onClick={() => handleCommentLike(comment, postId)}
            className={`flex items-center gap-1 text-xs ${comment.has_liked ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-white/50 hover:text-[#020b00] dark:hover:text-white'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${comment.has_liked ? 'fill-current' : ''}`} />
            {comment.like_count || 0}
          </button>
          {!isReply && (
            <button
              onClick={() => setReplyingTo((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
              className="text-xs text-gray-500 dark:text-white/50 hover:text-[#020b00] dark:hover:text-white"
            >
              {t('community.reply') || 'Reply'}
            </button>
          )}
          {String(user?.id) === String(comment.user.id) && (
            <button
              onClick={() => deleteComment(postId, comment.id)}
              className="text-xs text-gray-400 dark:text-white/50 hover:text-red-500"
            >
              {t('community.delete') || 'Delete'}
            </button>
          )}
        </div>

        {/* Reply input */}
        {!isReply && replyingTo[comment.id] && (
          <div className="mt-2 space-y-2 ml-2">
            {!isAuthenticated && !getGuestName() && (
              <Input
                type="text"
                value={replyGuestNames[comment.id] || ''}
                onChange={(e) => setReplyGuestNames((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                placeholder={t('community.yourName') || 'Your Name'}
                className="bg-white dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-full px-4 py-1.5 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#020b00] dark:focus:border-[#d3da0c] h-9"
              />
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={replyInputs[comment.id] || ''}
                onChange={(e) => setReplyInputs((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleAddReply(postId, comment.id)}
                placeholder={t('community.writeComment')}
                className="flex-1 bg-white dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-full px-4 py-1.5 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#020b00] dark:focus:border-[#d3da0c]"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => handleAddReply(postId, comment.id)}
                disabled={!replyInputs[comment.id]?.trim()}
                className="bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black hover:opacity-90 rounded-full h-8 px-3 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Replies */}
        {!isReply && comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, postId, true))}
          </div>
        )}
      </div>
    </div>
  );

  const allNewMedia: MediaItem[] = [
    ...newPostImages.map((url) => ({ type: 'image' as const, url })),
    ...newPostVideos.map((url) => ({ type: 'video' as const, url })),
  ];

  const communityStories = [
    {
      id: 'your-story',
      label: 'Your Story',
      avatar: profile?.avatar_url || '/web-hero/C48A0758.jpg',
      isSelf: true,
      onClick: () => setIsWritingPost(true),
    },
    ...storyArtists.map((artist) => ({
      id: `artist-${artist.id}`,
      label: artist.stage_name || artist.name || 'Artist',
      avatar: artist.profile_image_url || '/web-hero/C48A0775.jpg',
      isSelf: false,
      onClick: () => navigate(`/discovery?tab=artists`),
    })),
  ];

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-28 transition-colors duration-200">
      {/* Top Recaps Sub-Navigation */}
      <div className="py-2.5 flex justify-center px-4 bg-white/95 dark:bg-[#020b00]/95 border-b border-black/5 dark:border-white/5 sticky top-0 z-35">
        <RecapsSegmentNav
          activeTab={activeTab || 'community'}
          onTabChange={onTabChange || ((t) => navigate(`/recaps?tab=${t}`))}
        />
      </div>

      {/* Top Feed Filter Pills — Pinned below App Header */}
      <section className="sticky top-[45px] z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/5 dark:border-white/5 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { key: 'for_you' as FeedFilter, label: 'For You' },
              { key: 'trending' as FeedFilter, label: 'Trending' },
              { key: 'following' as FeedFilter, label: 'Following' },
              ...(isAuthenticated
                ? [
                    { key: 'my_posts' as FeedFilter, label: 'My Posts' },
                    { key: 'saved' as FeedFilter, label: 'Saved' },
                  ]
                : []),
            ].map((pill) => {
              const active = !selectedSection && feedFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => handleFeedFilterChange(pill.key)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-[#d3da0c] text-black shadow-sm'
                      : 'bg-neutral-100 dark:bg-[#0d140a] text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}

            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionSelect(section)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                  selectedSection?.id === section.id
                    ? 'bg-[#d3da0c] text-black border-[#d3da0c] shadow-sm'
                    : 'bg-neutral-100 dark:bg-[#0d140a] text-gray-700 dark:text-gray-300 border-black/10 dark:border-white/10 hover:text-black dark:hover:text-white'
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 pt-3 pb-5">
        {/* Stories Row matching Reference Visual */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar pb-1">
            {communityStories.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={story.onClick}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div className="relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#d3da0c] via-[#a3e635] to-[#d3da0c]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#0a1207] border-2 border-white dark:border-[#020b00]">
                    <img
                      src={story.avatar}
                      alt={story.label}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/web-hero/C48A0758.jpg';
                      }}
                    />
                  </div>
                  {story.isSelf && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#d3da0c] text-black flex items-center justify-center border border-white dark:border-[#020b00]">
                      <Plus className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <span className="text-[0.6875rem] font-medium text-gray-700 dark:text-gray-300 truncate max-w-[4rem]">
                  {story.label}
                </span>
              </button>
            ))}

            {/* More Circle */}
            <button
              type="button"
              onClick={() => navigate('/reels')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div className="w-14 h-14 rounded-full p-[1.5px] bg-black/15 dark:bg-white/20">
                <div className="w-full h-full rounded-full bg-neutral-100 dark:bg-[#0d140a] border-2 border-white dark:border-[#020b00] flex items-center justify-center text-[#020b00] dark:text-white">
                  <MoreHorizontal className="w-5 h-5" />
                </div>
              </div>
              <span className="text-[0.6875rem] font-medium text-gray-700 dark:text-gray-300">More</span>
            </button>
          </div>
        </div>

        {/* Dedicated Full-Screen Create Community Post Page matching Reference Visual */}
        {isWritingPost &&
          createPortal(
            <div className="fixed inset-0 z-[120] bg-[#020B00] text-white overflow-y-auto overscroll-contain">
              <div className="min-h-full flex flex-col max-w-xl mx-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {/* Top Bar: Cancel (X) | Create Post | Post Button */}
                <div className="flex items-center justify-between h-12 pb-2 border-b border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWritingPost(false);
                      setNewPostTitle('');
                      setNewPostContent('');
                      setNewPostSectionId('');
                      setNewPostEventId('');
                      setNewPostImages([]);
                      setNewPostVideos([]);
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
                    aria-label="Cancel"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <h2 className="text-[1.0625rem] font-bold text-white tracking-tight">Create Post</h2>

                  <button
                    type="button"
                    onClick={handleCreatePost}
                    disabled={
                      !newPostContent.trim() ||
                      isCreating ||
                      isUploadingImages ||
                      isUploadingVideos ||
                      (!isAuthenticated && !guestName.trim())
                    }
                    className="px-5 py-1.5 rounded-full bg-[#d3da0c] text-black font-extrabold text-xs shadow-[0_0_12px_rgba(211,218,12,0.35)] hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                  >
                    {isCreating ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Posting...</span>
                      </span>
                    ) : (
                      'Post'
                    )}
                  </button>
                </div>

                {/* 4 Post Type Selection Cards: Post | Photo | Video | Event */}
                <div className="grid grid-cols-4 gap-2.5 py-4">
                  {[
                    { id: 'post' as const, label: 'Post', icon: FileText },
                    { id: 'photo' as const, label: 'Photo', icon: ImageIcon },
                    { id: 'video' as const, label: 'Video', icon: PlayCircle },
                    { id: 'event' as const, label: 'Event', icon: Calendar },
                  ].map((card) => {
                    const active = postType === card.id;
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          setPostType(card.id);
                          if (card.id === 'photo') fileInputRef.current?.click();
                          if (card.id === 'video') videoInputRef.current?.click();
                          if (card.id === 'event') setShowEventRow(true);
                        }}
                        className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all ${
                          active
                            ? 'bg-[#d3da0c] text-black font-extrabold shadow-[0_0_16px_rgba(211,218,12,0.3)]'
                            : 'bg-[#11150E] border border-white/10 text-gray-300 hover:border-white/20'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[0.6875rem] leading-tight font-bold">{card.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Unauthenticated Guest Inputs */}
                {!isAuthenticated && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 bg-[#11150E] p-3 rounded-2xl border border-white/10">
                    <Input
                      value={guestName}
                      onChange={(e) => handleGuestNameChange(e.target.value)}
                      placeholder={t('community.yourName') || 'Your Name *'}
                      className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 text-xs rounded-xl"
                    />
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder={t('community.yourEmail') || 'Email (optional)'}
                      className="bg-black/40 border-white/10 text-white placeholder:text-gray-500 text-xs rounded-xl"
                    />
                  </div>
                )}

                {/* User Info & Audience Selector Row */}
                <div className="flex items-center gap-3 py-2">
                  <div className="relative">
                    <Avatar className="w-11 h-11 border border-white/15">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-[#242B24] text-white font-bold text-xs">
                        {getInitials(profile?.first_name, profile?.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#d3da0c] text-black flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Share with</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAudienceDropdown((prev) => !prev)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#11150E] border border-white/15 text-xs font-semibold text-gray-200 hover:border-[#d3da0c] transition-colors"
                      >
                        <span>
                          {postAudience === 'for_you'
                            ? 'For You'
                            : postAudience === 'following'
                            ? 'Following'
                            : 'Community'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </button>

                      {showAudienceDropdown && (
                        <div className="absolute left-0 mt-1.5 w-36 bg-[#11150E] border border-white/15 rounded-xl shadow-2xl py-1 z-30">
                          {(
                            [
                              { id: 'for_you', label: 'For You' },
                              { id: 'following', label: 'Following' },
                              { id: 'community', label: 'Community' },
                            ] as const
                          ).map((aud) => (
                            <button
                              key={aud.id}
                              type="button"
                              onClick={() => {
                                setPostAudience(aud.id);
                                setShowAudienceDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-medium hover:bg-white/10 ${
                                postAudience === aud.id ? 'text-[#d3da0c] font-bold' : 'text-gray-300'
                              }`}
                            >
                              {aud.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Large Text Editor with Clear Placeholder */}
                <div className="py-2 flex-1">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full bg-transparent text-white placeholder-gray-500 text-base leading-relaxed resize-none outline-none min-h-[140px]"
                    autoFocus
                  />
                </div>

                {/* Media Attachments Grid (3 Columns) with Removal & Reordering */}
                <div className="py-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    {allNewMedia.map((media, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/10 group"
                      >
                        {media.type === 'image' ? (
                          <img src={media.url} alt="Attachment" className="w-full h-full object-cover" />
                        ) : (
                          <video src={media.url} className="w-full h-full object-cover" />
                        )}

                        {/* Top-Right Removal X Button */}
                        <button
                          type="button"
                          onClick={() =>
                            media.type === 'image'
                              ? removeImage(idx)
                              : removeVideo(idx - newPostImages.length)
                          }
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-black transition-colors"
                          aria-label="Remove media"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        {/* Reordering Controls */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (media.type === 'image') {
                                  setNewPostImages((prev) => {
                                    const next = [...prev];
                                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                    return next;
                                  });
                                }
                              }}
                              className="w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[0.625rem]"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {idx < allNewMedia.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (media.type === 'image') {
                                  setNewPostImages((prev) => {
                                    const next = [...prev];
                                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                    return next;
                                  });
                                }
                              }}
                              className="w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-[0.625rem] ml-auto"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* + Add More (Up to 10) Tile */}
                    {allNewMedia.length < 10 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-2xl border-2 border-dashed border-white/20 hover:border-[#d3da0c]/60 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-white transition-all bg-white/[0.02]"
                      >
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#d3da0c]">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="text-[0.6875rem] font-bold text-gray-300">Add More</span>
                        <span className="text-[0.625rem] text-gray-500">(Up to 10)</span>
                      </button>
                    )}
                  </div>

                  {(isUploadingImages || isUploadingVideos) && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-[#d3da0c]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading media attachments...</span>
                    </div>
                  )}
                </div>

                {/* 4 Metadata Action Rows: Add Location | Tag Event | Tag People | Select Section */}
                <div className="space-y-1.5 pt-2 border-t border-white/10 shrink-0">
                  {/* Add Location */}
                  <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowLocationRow((prev) => !prev)}
                      className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-[#d3da0c]" />
                        <span className="font-semibold">
                          {postLocation ? `Location: ${postLocation}` : 'Add Location'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    {showLocationRow && (
                      <div className="p-3 pt-0 flex gap-2">
                        <input
                          type="text"
                          value={postLocation}
                          onChange={(e) => setPostLocation(e.target.value)}
                          placeholder="e.g. Shanghai, The Loft Club, Sanlitun..."
                          className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#d3da0c]"
                        />
                        {postLocation && (
                          <button
                            type="button"
                            onClick={() => setPostLocation('')}
                            className="px-2.5 text-xs text-gray-400 hover:text-white"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tag Event */}
                  <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowEventRow((prev) => !prev)}
                      className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-[#d3da0c]" />
                        <span className="font-semibold">
                          {newPostEventId
                            ? `Event: ${events.find((e) => String(e.id) === newPostEventId)?.title || 'Selected'}`
                            : 'Tag Event'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    {showEventRow && (
                      <div className="p-3 pt-0">
                        <select
                          value={newPostEventId}
                          onChange={(e) => setNewPostEventId(e.target.value)}
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

                  {/* Tag People */}
                  <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowPeopleRow((prev) => !prev)}
                      className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 text-[#d3da0c]" />
                        <span className="font-semibold">
                          {postTaggedPeople ? `Tagged: ${postTaggedPeople}` : 'Tag People'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    {showPeopleRow && (
                      <div className="p-3 pt-0 flex gap-2">
                        <input
                          type="text"
                          value={postTaggedPeople}
                          onChange={(e) => setPostTaggedPeople(e.target.value)}
                          placeholder="@username, @artist, @friend..."
                          className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#d3da0c]"
                        />
                        {postTaggedPeople && (
                          <button
                            type="button"
                            onClick={() => setPostTaggedPeople('')}
                            className="px-2.5 text-xs text-gray-400 hover:text-white"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Select Section (Optional) */}
                  <div className="bg-[#11150E] border border-white/10 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowSectionRow((prev) => !prev)}
                      className="w-full flex items-center justify-between p-3.5 text-xs text-white hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#d3da0c]" />
                        <span className="font-semibold">
                          {newPostSectionId
                            ? `Section: ${sections.find((s) => String(s.id) === newPostSectionId)?.name || 'Selected'}`
                            : 'Select Section (Optional)'}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    {showSectionRow && (
                      <div className="p-3 pt-0">
                        <select
                          value={newPostSectionId}
                          onChange={(e) => setNewPostSectionId(e.target.value)}
                          className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#d3da0c]"
                        >
                          <option value="">General / All Community</option>
                          {sections.map((sec) => (
                            <option key={sec.id} value={String(sec.id)}>
                              {sec.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hidden File Inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={handleVideoSelect}
                />
              </div>
            </div>,
            document.body
          )}

        {/* Posts Feed matching Reference Visual */}
        <div className="space-y-3.5">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => {
              const mediaItems = getMediaItems(post);
              const authorName =
                `${post.user.first_name || ''} ${post.user.last_name || ''}`.trim() ||
                post.user.username ||
                'Sound It Member';
              return (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-neutral-50 dark:bg-[#0d140a] rounded-2xl border border-black/10 dark:border-white/10 p-3.5 overflow-hidden shadow-md"
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-9 h-9 border border-black/10 dark:border-white/10">
                        <AvatarImage src={post.user.avatar_url || ''} />
                        <AvatarFallback className="bg-[#d3da0c] text-black text-xs font-extrabold">
                          {getInitials(post.user.first_name, post.user.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-[#020b00] dark:text-white text-sm font-bold flex items-center gap-1.5">
                          <span>{authorName}</span>
                          {post.user.is_verified && (
                            <VerificationBadge size="xs" className="shrink-0" />
                          )}
                          {post.user.is_guest && (
                            <span className="text-[0.625rem] px-1.5 py-0.5 bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-full font-normal">
                              {t('community.guest') || 'Guest'}
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-[0.6875rem]">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {String(user?.id) === String(post.user.id) ? (
                      <button
                        type="button"
                        onClick={() => deletePost(post.id)}
                        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        aria-label="Delete post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openShareModal(post.id)}
                        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        aria-label="More options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  {post.title && (
                    <h4 className="text-[#020b00] dark:text-white font-bold text-sm leading-snug mb-1.5">
                      {post.title}
                    </h4>
                  )}

                  {/* Badges */}
                  {(post.section || post.event_title) && (
                    <div className="pb-2 flex flex-wrap gap-1.5">
                      {post.section && (
                        <div className="inline-flex items-center gap-1 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-medium">
                          <FolderOpen className="w-3 h-3 text-[#9fa505] dark:text-[#d3da0c]" />
                          {post.section.name}
                        </div>
                      )}
                      {post.event_title && (
                        <div className="inline-flex items-center gap-1 bg-[#d3da0c]/20 text-black dark:text-[#d3da0c] border border-[#d3da0c]/40 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-semibold">
                          <Calendar className="w-3 h-3" />
                          {post.event_title}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="pb-2.5">
                    <p className="text-gray-800 dark:text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
                      {expandedPosts[post.id]
                        ? post.content
                        : post.content.slice(0, 300)}
                      {post.content.length > 300 && !expandedPosts[post.id] && (
                        <button
                          onClick={() => setExpandedPosts((prev) => ({ ...prev, [post.id]: true }))}
                          className="text-[#9fa505] dark:text-[#d3da0c] font-semibold ml-1 hover:underline"
                        >
                          {t('community.seeMore')}
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Post Media */}
                  {mediaItems.length > 0 && (
                    <div className="pb-3">
                      <div
                        className={`grid gap-1.5 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 ${
                          mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                        }`}
                      >
                        {mediaItems.map((media, idx) =>
                          media.type === 'image' ? (
                            <img
                              key={idx}
                              src={media.url}
                              alt={t('community.postImage')}
                              className={`w-full object-cover ${
                                mediaItems.length === 1 ? 'h-52 sm:h-64' : 'h-40'
                              }`}
                            />
                          ) : (
                            <video
                              key={idx}
                              src={media.url}
                              controls
                              className={`w-full object-cover ${
                                mediaItems.length === 1 ? 'h-52 sm:h-64' : 'h-40'
                              }`}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Bar matching Reference Visual: Heart + count | Comment + count | Share + count | Bookmark on right */}
                  <div className="pt-1 flex items-center justify-between text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        onClick={() => handleLike(post)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                          post.has_liked ? 'text-rose-500' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            post.has_liked ? 'fill-rose-500 text-rose-500' : ''
                          }`}
                        />
                        <span>{post.likes_count || 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: true }))}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.comments_count || 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openShareModal(post.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{post.shares_count || 0}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleBookmark(post.id)}
                      aria-label="Bookmark post"
                      className={`p-1 rounded-full transition-colors ${
                        post.has_saved ? 'text-[#9fa505] dark:text-[#d3da0c]' : 'text-gray-600 dark:text-gray-300 hover:text-[#9fa505] dark:hover:text-[#d3da0c]'
                      }`}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          post.has_saved ? 'fill-[#9fa505] dark:fill-[#d3da0c] text-[#9fa505] dark:text-[#d3da0c]' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Comments Drawer (Zero Emojis) */}
                  {showComments[post.id] &&
                    createPortal(
                      <div
                        className="fixed inset-0 z-[100] flex items-end"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('community.comments', 'Comments')}
                      >
                        <button
                          type="button"
                          aria-label={t('common.close', 'Close comments')}
                          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                          onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: false }))}
                        />
                        <motion.section
                          initial={{ y: '100%' }}
                          animate={{ y: 0 }}
                          exit={{ y: '100%' }}
                          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                          className="relative z-10 w-full h-[75dvh] max-h-[820px] rounded-t-[28px] border-t border-white/10 bg-[#0a1207] text-white flex flex-col shadow-2xl"
                        >
                          <div className="shrink-0 px-5 pt-3 pb-4 border-b border-white/10">
                            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />
                            <div className="flex items-center justify-between">
                              <span className="w-9" />
                              <h2 className="text-base font-bold">
                                {t('community.comments', 'Comments')} ({post.comments_count || 0})
                              </h2>
                              <button
                                type="button"
                                onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: false }))}
                                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
                                aria-label={t('common.close', 'Close comments')}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
                            {post.comments.length ? (
                              post.comments.map((comment) => renderComment(comment, post.id))
                            ) : (
                              <p className="py-12 text-center text-gray-400 text-sm">
                                {t('community.noComments', 'Be the first to comment.')}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 border-t border-white/10 bg-[#0a1207] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                            {!isAuthenticated && !getGuestName() && (
                              <Input
                                type="text"
                                value={commentGuestNames[post.id] || ''}
                                onChange={(e) =>
                                  setCommentGuestNames((prev) => ({ ...prev, [post.id]: e.target.value }))
                                }
                                placeholder={t('community.yourName') || 'Your Name'}
                                className="mb-2 bg-[#0d140a] border border-white/10 text-white rounded-full px-4 h-10"
                              />
                            )}
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9 shrink-0">
                                <AvatarImage src={profile?.avatar_url || ''} />
                                <AvatarFallback className="bg-[#d3da0c] text-black text-xs font-semibold">
                                  {getInitials(profile?.first_name, profile?.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/10 bg-[#0d140a] px-4">
                                <input
                                  type="text"
                                  value={commentInputs[post.id] || ''}
                                  onChange={(e) =>
                                    setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                  placeholder={t('community.writeComment', 'Add a comment...')}
                                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white placeholder:text-gray-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddComment(post.id)}
                                  disabled={!commentInputs[post.id]?.trim()}
                                  className="ml-2 text-[#d3da0c] disabled:text-gray-600"
                                  aria-label={t('community.send', 'Send comment')}
                                >
                                  <Send className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.section>
                      </div>,
                      document.body
                    )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#d3da0c]" />
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        <div ref={observerTarget} className="h-10" />

        {/* Empty State */}
        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16">
            <MessageCircle className="w-14 h-14 text-gray-300 dark:text-white/20 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-[#020b00] dark:text-white mb-1">{t('community.noPostsYet')}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{t('community.beFirst')}</p>
          </div>
        )}
      </div>

      {/* Floating Yellow + Action Button matching Reference Visual */}
      {!isWritingPost && (
        <button
          type="button"
          onClick={() => {
            setIsWritingPost(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="Create community post"
          style={{
            bottom: 'calc(var(--bottom-nav-height, 5.25rem) + env(safe-area-inset-bottom, 0px) + 1rem)',
          }}
          className="fixed right-5 z-[35] w-14 h-14 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-xl shadow-[#d3da0c]/30 hover:bg-[#bbc10b] active:scale-90 transition-all hide-on-keyboard"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4"
          onClick={() => setIsShareModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0d140a] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">{t('community.sharePost')}</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10"
                onClick={() => handleShare(sharePostId!, 'native')}
              >
                <Share2 className="w-5 h-5 mr-3 text-[#d3da0c]" />
                {t('community.shareVia')}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10"
                onClick={() => handleShare(sharePostId!, 'copy')}
              >
                <MessageCircle className="w-5 h-5 mr-3 text-[#d3da0c]" />
                {t('community.copyLink')}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4 text-gray-400 hover:text-white"
              onClick={() => setIsShareModalOpen(false)}
            >
              {t('community.cancel')}
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Community;
