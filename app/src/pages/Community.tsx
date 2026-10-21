import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Send, Image as ImageIcon,
  Trash2, Calendar, X, Plus, Eye, Loader2, FolderOpen, Video, ChevronLeft
} from 'lucide-react';
import { useCommunityStore, type CommunityPost, type CommunityComment, getGuestName, setGuestName } from '@/store/communityStore';
import { useAuthStore } from '@/store/authStore';
import { useEventStore } from '@/store/eventStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { WEB_ORIGIN } from '@/lib/appUrl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

const Community = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated } = useAuthStore();
  const { events, fetchEvents } = useEventStore();
  const {
    posts, sections, selectedSection, isLoading, isCreating, hasMore,
    fetchPosts, fetchSections, fetchPostsBySection, createPost, deletePost, likePost, unlikePost,
    addComment, deleteComment, likeComment, unlikeComment, sharePost, loadMore, uploadMedia
  } = useCommunityStore();

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostSectionId, setNewPostSectionId] = useState('');
  const [newPostEventId, setNewPostEventId] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [newPostVideos, setNewPostVideos] = useState<string[]>([]);
  const [isWritingPost, setIsWritingPost] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [showComments, setShowComments] = useState<Record<number, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<Record<number, boolean>>({});
  const [expandedPosts, setExpandedPosts] = useState<Record<number, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePostId, setSharePostId] = useState<number | null>(null);
  const [guestName, setGuestNameState] = useState(getGuestName() || '');
  const [guestEmail, setGuestEmail] = useState('');
  const [commentGuestNames, setCommentGuestNames] = useState<Record<number, string>>({});
  const [replyGuestNames, setReplyGuestNames] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSections();
    fetchPosts();
    fetchEvents();
  }, [fetchSections, fetchPosts, fetchEvents]);

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
      fetchPosts({ page: 1 });
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
                <span className="text-[10px] px-1.5 py-0.5 bg-black/5 dark:bg-white/10 text-gray-600 dark:text-white/70 rounded-full">
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

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white transition-colors duration-200">
      {/* Header — title + section tabs pinned together below the app header */}
      <section className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-md border-b border-black/8 dark:border-white/5 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
              aria-label={t('common.back', 'Back')}
              className="-ml-2 w-10 h-10 rounded-full flex items-center justify-center text-[#020b00] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-display text-[#020b00] dark:text-white">{t('community.community')}</h1>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => handleSectionSelect(null)}
              className={`min-h-[36px] px-4 rounded-full text-sm font-semibold whitespace-nowrap border transition-all ${
                !selectedSection
                  ? 'bg-[#020b00] text-[#d3da0c] border-[#020b00] dark:bg-[#d3da0c] dark:text-black dark:border-[#d3da0c] shadow-xs'
                  : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-400 border-transparent hover:text-[#020b00] dark:hover:text-white'
              }`}
            >
              {t('community.allPosts') || 'All Posts'}
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionSelect(section)}
                className={`min-h-[36px] px-4 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${
                  selectedSection?.id === section.id
                    ? 'bg-[#020b00] text-[#d3da0c] border-[#020b00] dark:bg-[#d3da0c] dark:text-black dark:border-[#d3da0c] shadow-xs font-semibold'
                    : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-400 border-transparent hover:text-[#020b00] dark:hover:text-white'
                }`}
              >
                {section.name}
                {typeof section.post_count === 'number' && section.post_count > 0 && (
                  <span className="ml-1.5 text-xs opacity-80">{section.post_count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-5">

        {/* Create Post Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 p-4 mb-5 w-full shadow-xs dark:shadow-none"
        >
          {!isWritingPost ? (
            <div
              onClick={() => setIsWritingPost(true)}
              className="flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-3 rounded-xl transition-colors"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-semibold">
                  {getInitials(profile?.first_name, profile?.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{t('community.shareExperience')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Guest inputs */}
              {!isAuthenticated && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    value={guestName}
                    onChange={(e) => handleGuestNameChange(e.target.value)}
                    placeholder={t('community.yourName') || 'Your Name *'}
                    className="bg-neutral-50 dark:bg-[#020b00] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm"
                  />
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={t('community.yourEmail') || 'Email (optional)'}
                    className="bg-neutral-50 dark:bg-[#020b00] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm"
                  />
                </div>
              )}

              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-semibold">
                    {getInitials(profile?.first_name, profile?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3 min-w-0">
                  <Input
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder={t('community.postTitle') || 'Post title (optional)'}
                    className="bg-neutral-50 dark:bg-[#020b00] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm"
                  />
                  <Textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={t('community.shareExperiencePlaceholder')}
                    className="bg-neutral-50 dark:bg-[#020b00] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 text-sm resize-none min-h-[100px]"
                    autoFocus
                  />
                  <Select value={newPostSectionId} onValueChange={setNewPostSectionId}>
                    <SelectTrigger className="bg-neutral-50 dark:bg-[#020b00] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white w-full">
                      <SelectValue placeholder={t('community.selectSection') || 'Select section (optional)'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#141414] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white shadow-lg">
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={String(section.id)}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newPostEventId} onValueChange={setNewPostEventId}>
                    <SelectTrigger className="bg-neutral-50 dark:bg-[#020b00] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white w-full">
                      <SelectValue placeholder={t('community.tagEvent') || 'Tag event (optional)'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#141414] border-black/10 dark:border-white/10 text-[#020b00] dark:text-white max-h-60 shadow-lg">
                      {events.map((event) => (
                        <SelectItem key={event.id} value={String(event.id)}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Media previews */}
              {allNewMedia.length > 0 && (
                <div className="flex gap-2 flex-wrap ml-0 sm:ml-13 sm:pl-13">
                  {allNewMedia.map((media, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
                      {media.type === 'image' ? (
                        <img src={media.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={media.url} className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => media.type === 'image' ? removeImage(idx) : removeVideo(idx - newPostImages.length)}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5 hover:bg-black"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImages}
                  >
                    {isUploadingImages ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <ImageIcon className="w-5 h-5 mr-2" />
                    )}
                    {t('community.addPhoto')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploadingVideos}
                  >
                    {isUploadingVideos ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Video className="w-5 h-5 mr-2" />
                    )}
                    {t('community.addVideo') || 'Video'}
                  </Button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsWritingPost(false);
                      setNewPostTitle('');
                      setNewPostContent('');
                      setNewPostSectionId('');
                      setNewPostEventId('');
                      setNewPostImages([]);
                      setNewPostVideos([]);
                    }}
                    className="flex-1 sm:flex-none text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white"
                  >
                    {t('community.cancel')}
                  </Button>
                  <Button
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim() || isCreating || isUploadingImages || isUploadingVideos || (!isAuthenticated && !guestName.trim())}
                    className="bg-[#020b00] text-[#d3da0c] hover:opacity-90 dark:bg-[#d3da0c] dark:text-black dark:hover:bg-[#bbc10b] flex-1 sm:flex-none font-bold shadow-sm"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('community.post')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Posts Feed */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => {
              const mediaItems = getMediaItems(post);
              return (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 overflow-hidden shadow-xs dark:shadow-none"
                >
                  {/* Post Header */}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={post.user.avatar_url || ''} />
                        <AvatarFallback className="bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-semibold">
                          {getInitials(post.user.first_name, post.user.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-[#020b00] dark:text-white text-sm font-semibold flex items-center gap-2">
                          {post.user.first_name} {post.user.last_name}
                          {post.user.is_guest && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400 rounded-full font-normal">
                              {t('community.guest') || 'Guest'}
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {String(user?.id) === String(post.user.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePost(post.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Title */}
                  {post.title && (
                    <div className="px-3 pb-1">
                      <h4 className="text-[#020b00] dark:text-white font-semibold text-[15px] leading-snug">{post.title}</h4>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="px-3 pb-2 flex flex-wrap gap-2">
                    {post.section && (
                      <div className="inline-flex items-center gap-1.5 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {post.section.name}
                      </div>
                    )}
                    {post.event_title && (
                      <div className="inline-flex items-center gap-1.5 bg-[#d3da0c]/10 text-emerald-800 dark:text-[#d3da0c] border border-[#d3da0c]/30 px-3 py-1 rounded-full text-xs font-medium">
                        <Calendar className="w-4 h-4" />
                        {post.event_title}
                      </div>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="px-3 pb-2">
                    <p className="text-gray-800 dark:text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap">
                      {expandedPosts[post.id]
                        ? post.content
                        : post.content.slice(0, 300)
                      }
                      {post.content.length > 300 && !expandedPosts[post.id] && (
                        <button
                          onClick={() => setExpandedPosts((prev) => ({ ...prev, [post.id]: true }))}
                          className="text-[#020b00] dark:text-[#d3da0c] font-semibold ml-1 hover:underline"
                        >
                          {t('community.seeMore')}
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Post Media */}
                  {mediaItems.length > 0 && (
                    <div className="px-3 pb-2">
                      <div className={`grid gap-1.5 rounded-lg overflow-hidden ${mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {mediaItems.map((media, idx) => (
                          media.type === 'image' ? (
                            <img
                              key={idx}
                              src={media.url}
                              alt={t('community.postImage')}
                              className={`w-full object-cover hover:opacity-90 transition-opacity cursor-pointer ${mediaItems.length === 1 ? 'h-64' : 'h-48'}`}
                            />
                          ) : (
                            <video
                              key={idx}
                              src={media.url}
                              controls
                              className={`w-full object-cover rounded-lg ${mediaItems.length === 1 ? 'h-64' : 'h-48'}`}
                            />
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post Stats */}
                  <div className="px-3 py-2 flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
                    <div className="flex gap-4">
                      <span>{post.likes_count || 0} {t('community.likes')}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {post.view_count || 0} {t('community.views') || 'views'}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span>{post.comments_count || 0} {t('community.comments')}</span>
                      <span>{post.shares_count || 0} {t('community.shares')}</span>
                    </div>
                  </div>

                  <Separator className="bg-black/5 dark:bg-white/5" />

                  {/* Action Buttons */}
                  <div className="p-1 flex items-center justify-around">
                    <Button
                      variant="ghost"
                      onClick={() => handleLike(post)}
                      className={`flex-1 min-h-[36px] h-9 text-xs font-medium ${post.has_liked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'}`}
                    >
                      <Heart className={`w-4 h-4 mr-1.5 ${post.has_liked ? 'fill-current' : ''}`} />{t('community.like')}</Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: true }))}
                      className="flex-1 min-h-[36px] h-9 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white"
                    >
                      <MessageCircle className="w-4 h-4 mr-1.5" />{t('community.comment')}</Button>
                    <Button
                      variant="ghost"
                      onClick={() => openShareModal(post.id)}
                      className="flex-1 min-h-[36px] h-9 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white"
                    >
                      <Share2 className="w-4 h-4 mr-1.5" />{t('community.share')}</Button>
                  </div>

                  {/* Social-style comments drawer */}
                  {showComments[post.id] && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-end" role="dialog" aria-modal="true" aria-label={t('community.comments', 'Comments')}>
                      <button
                        type="button"
                        aria-label={t('common.close', 'Close comments')}
                        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                        onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: false }))}
                      />
                      <motion.section
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="relative z-10 w-full h-[78dvh] max-h-[850px] rounded-t-[28px] border-t border-white/10 bg-[#17191d] text-white flex flex-col shadow-2xl"
                      >
                        <div className="shrink-0 px-5 pt-3 pb-4 border-b border-white/10">
                          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-gray-500" />
                          <div className="flex items-center justify-between">
                            <span className="w-10" />
                            <h2 className="text-lg font-bold">{t('community.comments', 'Comments')}</h2>
                            <button
                              type="button"
                              onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: false }))}
                              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                              aria-label={t('common.close', 'Close comments')}
                            ><X className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-5">
                          {post.comments.length ? post.comments.map((comment) => renderComment(comment, post.id)) : (
                            <p className="py-12 text-center text-gray-400">{t('community.noComments', 'Be the first to comment.')}</p>
                          )}
                        </div>
                        <div className="shrink-0 border-t border-white/10 bg-[#17191d] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                          <div className="flex items-center justify-between pb-3 text-[26px]">
                            {['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'].map((emoji) => (
                              <button key={emoji} type="button" className="active:scale-125 transition-transform" aria-label={`Add ${emoji}`} onClick={() => setCommentInputs((prev) => ({ ...prev, [post.id]: `${prev[post.id] || ''}${emoji}` }))}>{emoji}</button>
                            ))}
                          </div>
                          {!isAuthenticated && !getGuestName() && (
                            <Input
                              type="text"
                              value={commentGuestNames[post.id] || ''}
                              onChange={(e) => setCommentGuestNames((prev) => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder={t('community.yourName') || 'Your Name'}
                              className="mb-2 bg-transparent border border-white/10 text-white rounded-full px-4 h-10"
                            />
                          )}
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 shrink-0">
                              <AvatarImage src={profile?.avatar_url || ''} />
                              <AvatarFallback className="bg-[#d3da0c] text-black text-xs font-semibold">{getInitials(profile?.first_name, profile?.last_name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/10 bg-[#17191d] px-4">
                              <input
                                type="text"
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                placeholder={t('community.writeComment', 'Add a comment...')}
                                className="min-w-0 flex-1 bg-transparent py-3 text-base text-white placeholder:text-gray-400 outline-none"
                              />
                              <button type="button" onClick={() => handleAddComment(post.id)} disabled={!commentInputs[post.id]?.trim()} className="ml-2 text-[#d3da0c] disabled:text-gray-600" aria-label={t('community.send', 'Send comment')}>
                                <Send className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.section>
                    </div>, document.body
                  )}

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#020b00] dark:text-[#d3da0c]" />
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        <div ref={observerTarget} className="h-10" />

        {/* Empty State */}
        {!isLoading && posts.length === 0 && (
          <div className="text-center py-16">
            <MessageCircle className="w-16 h-16 text-gray-300 dark:text-white/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-2">{t('community.noPostsYet')}</h3>
            <p className="text-gray-500 dark:text-white/50">{t('community.beFirst')}</p>
          </div>
        )}
      </div>

      {/* Guest FAB */}
      {!isAuthenticated && !isWritingPost && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setIsWritingPost(true)}
            className="bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black hover:opacity-90 rounded-full shadow-lg px-6 py-3 h-auto font-bold"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('community.joinToPost') || 'Join to Post'}
          </Button>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsShareModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full text-[#020b00] dark:text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-4">{t('community.sharePost')}</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-[#020b00] dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => handleShare(sharePostId!, 'native')}
              >
                <Share2 className="w-5 h-5 mr-3 text-[#020b00] dark:text-[#d3da0c]" />
                {t('community.shareVia')}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#020b00] dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => handleShare(sharePostId!, 'copy')}
              >
                <MessageCircle className="w-5 h-5 mr-3 text-[#020b00] dark:text-[#d3da0c]" />
                {t('community.copyLink')}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4 text-gray-500 hover:text-[#020b00] dark:hover:text-white"
              onClick={() => setIsShareModalOpen(false)}
            >{t('community.cancel')}</Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Community;
