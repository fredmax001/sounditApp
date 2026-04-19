import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Send, Image as ImageIcon,
  Trash2, Calendar, X, Plus, Eye, Loader2, FolderOpen, Video
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
          url: `${window.location.origin}/community?post=${postId}`
        });
      } catch {
        // User cancelled
      }
    }
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/community?post=${postId}`);
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
        <div className="bg-[#141414] rounded-2xl rounded-tl-none px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium flex items-center gap-2">
              {comment.user.first_name} {comment.user.last_name}
              {comment.user.is_guest && (
                <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/70 rounded-full">
                  {t('community.guest') || 'Guest'}
                </span>
              )}
            </p>
            <span className="text-white/40 text-xs">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-white/70 text-sm">{comment.content}</p>
        </div>
        <div className="flex items-center gap-4 mt-1 ml-2">
          <button
            onClick={() => handleCommentLike(comment, postId)}
            className={`flex items-center gap-1 text-xs ${comment.has_liked ? 'text-red-500' : 'text-white/50 hover:text-white'}`}
          >
            <Heart className={`w-3.5 h-3.5 ${comment.has_liked ? 'fill-current' : ''}`} />
            {comment.like_count || 0}
          </button>
          {!isReply && (
            <button
              onClick={() => setReplyingTo((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
              className="text-xs text-white/50 hover:text-white"
            >
              {t('community.reply') || 'Reply'}
            </button>
          )}
          {String(user?.id) === String(comment.user.id) && (
            <button
              onClick={() => deleteComment(postId, comment.id)}
              className="text-xs text-white/50 hover:text-red-400"
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
                className="bg-[#0A0A0A] border border-white/10 rounded-full px-4 py-1.5 text-white text-sm focus:outline-none focus:border-[#d3da0c] h-9"
              />
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={replyInputs[comment.id] || ''}
                onChange={(e) => setReplyInputs((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleAddReply(postId, comment.id)}
                placeholder={t('community.writeComment')}
                className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-full px-4 py-1.5 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                autoFocus
              />
              <Button
                size="sm"
                onClick={() => handleAddReply(postId, comment.id)}
                disabled={!replyInputs[comment.id]?.trim()}
                className="bg-[#d3da0c] text-black hover:bg-[#bbc10b] rounded-full h-8 px-3"
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
    <div className="min-h-screen bg-[#0A0A0A] pt-20 lg:pt-24">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">{t('community.community')}</h1>
          <p className="text-white/50 text-lg">
            {t('community.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Section Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => handleSectionSelect(null)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition-colors ${
                !selectedSection
                  ? 'bg-[#d3da0c] text-black border-[#d3da0c]'
                  : 'bg-transparent text-white border-white/20 hover:border-white/40'
              }`}
            >
              {t('community.allPosts') || 'All Posts'}
            </button>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionSelect(section)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border transition-colors ${
                  selectedSection?.id === section.id
                    ? 'bg-[#d3da0c] text-black border-[#d3da0c]'
                    : 'bg-transparent text-white border-white/20 hover:border-white/40'
                }`}
              >
                {section.name}
                {typeof section.post_count === 'number' && (
                  <span className="ml-1.5 text-xs opacity-80">({section.post_count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Create Post Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#141414] rounded-2xl border border-white/10 p-4 mb-6 w-full"
        >
          {!isWritingPost ? (
            <div
              onClick={() => setIsWritingPost(true)}
              className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-3 rounded-xl transition-colors"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-[#d3da0c] text-black">
                  {getInitials(profile?.first_name, profile?.last_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-white/50">{t('community.shareExperience')}</span>
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
                    className="bg-[#0A0A0A] border-white/10 text-white"
                  />
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={t('community.yourEmail') || 'Email (optional)'}
                    className="bg-[#0A0A0A] border-white/10 text-white"
                  />
                </div>
              )}

              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-[#d3da0c] text-black">
                    {getInitials(profile?.first_name, profile?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3 min-w-0">
                  <Input
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder={t('community.postTitle') || 'Post title (optional)'}
                    className="bg-[#0A0A0A] border-white/10 text-white"
                  />
                  <Textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={t('community.shareExperiencePlaceholder')}
                    className="bg-[#0A0A0A] border-white/10 text-white resize-none min-h-[100px]"
                    autoFocus
                  />
                  <Select value={newPostSectionId} onValueChange={setNewPostSectionId}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white w-full">
                      <SelectValue placeholder={t('community.selectSection') || 'Select section (optional)'} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141414] border-white/10 text-white">
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={String(section.id)}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newPostEventId} onValueChange={setNewPostEventId}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/10 text-white w-full">
                      <SelectValue placeholder={t('community.tagEvent') || 'Tag event (optional)'} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141414] border-white/10 text-white max-h-60">
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
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10">
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
                    className="text-gray-400 hover:text-white"
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
                    className="text-gray-400 hover:text-white"
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
                    className="flex-1 sm:flex-none"
                  >
                    {t('community.cancel')}
                  </Button>
                  <Button
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim() || isCreating || isUploadingImages || isUploadingVideos || (!isAuthenticated && !guestName.trim())}
                    className="bg-[#d3da0c] text-black hover:bg-[#bbc10b] flex-1 sm:flex-none"
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
                  className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={post.user.avatar_url || ''} />
                        <AvatarFallback className="bg-[#d3da0c] text-black">
                          {getInitials(post.user.first_name, post.user.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-white font-medium flex items-center gap-2">
                          {post.user.first_name} {post.user.last_name}
                          {post.user.is_guest && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-white/10 text-white/70 rounded-full">
                              {t('community.guest') || 'Guest'}
                            </span>
                          )}
                        </h3>
                        <p className="text-white/50 text-sm">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {String(user?.id) === String(post.user.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePost(post.id)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Title */}
                  {post.title && (
                    <div className="px-4 pb-2">
                      <h4 className="text-white font-semibold text-lg">{post.title}</h4>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {post.section && (
                      <div className="inline-flex items-center gap-1.5 bg-white/10 text-white px-3 py-1 rounded-full text-xs">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {post.section.name}
                      </div>
                    )}
                    {post.event_title && (
                      <div className="inline-flex items-center gap-2 bg-[#d3da0c]/10 text-[#d3da0c] px-3 py-1 rounded-full text-sm">
                        <Calendar className="w-4 h-4" />
                        {post.event_title}
                      </div>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-3">
                    <p className="text-white whitespace-pre-wrap">
                      {expandedPosts[post.id]
                        ? post.content
                        : post.content.slice(0, 300)
                      }
                      {post.content.length > 300 && !expandedPosts[post.id] && (
                        <button
                          onClick={() => setExpandedPosts((prev) => ({ ...prev, [post.id]: true }))}
                          className="text-[#d3da0c] ml-1 hover:underline"
                        >
                          {t('community.seeMore')}
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Post Media */}
                  {mediaItems.length > 0 && (
                    <div className="px-4 pb-3">
                      <div className={`grid gap-2 rounded-xl overflow-hidden ${mediaItems.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
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
                  <div className="px-4 py-2 flex items-center justify-between text-white/50 text-sm">
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

                  <Separator className="bg-white/10" />

                  {/* Action Buttons */}
                  <div className="p-2 flex items-center justify-around">
                    <Button
                      variant="ghost"
                      onClick={() => handleLike(post)}
                      className={`flex-1 min-h-[44px] ${post.has_liked ? 'text-red-500' : 'text-gray-400 hover:text-white'}`}
                    >
                      <Heart className={`w-5 h-5 mr-2 ${post.has_liked ? 'fill-current' : ''}`} />{t('community.like')}</Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                      className="flex-1 min-h-[44px] text-gray-400 hover:text-white"
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />{t('community.comment')}</Button>
                    <Button
                      variant="ghost"
                      onClick={() => openShareModal(post.id)}
                      className="flex-1 min-h-[44px] text-gray-400 hover:text-white"
                    >
                      <Share2 className="w-5 h-5 mr-2" />{t('community.share')}</Button>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                    {showComments[post.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/10 bg-[#0A0A0A]/50"
                      >
                        {/* Existing Comments */}
                        <div className="p-4 space-y-4">
                          {post.comments.map((comment) => renderComment(comment, post.id))}
                        </div>

                        {/* Add Comment */}
                        <div className="p-4 pt-0 flex gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={profile?.avatar_url || ''} />
                            <AvatarFallback className="bg-[#d3da0c] text-black text-xs">
                              {getInitials(profile?.first_name, profile?.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            {!isAuthenticated && !getGuestName() && (
                              <Input
                                type="text"
                                value={commentGuestNames[post.id] || ''}
                                onChange={(e) => setCommentGuestNames((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value
                                }))}
                                placeholder={t('community.yourName') || 'Your Name'}
                                className="bg-[#0A0A0A] border-white/10 text-white rounded-full px-4 h-9"
                              />
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value
                                }))}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                placeholder={t('community.writeComment')}
                                className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddComment(post.id)}
                                disabled={!commentInputs[post.id]?.trim()}
                                className="bg-[#d3da0c] text-black hover:bg-[#bbc10b] rounded-full"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
            <MessageCircle className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{t('community.noPostsYet')}</h3>
            <p className="text-white/50">{t('community.beFirst')}</p>
          </div>
        )}
      </div>

      {/* Guest FAB */}
      {!isAuthenticated && !isWritingPost && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={() => setIsWritingPost(true)}
            className="bg-[#d3da0c] text-black hover:bg-[#bbc10b] rounded-full shadow-lg px-6 py-3 h-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('community.joinToPost') || 'Join to Post'}
          </Button>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsShareModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">{t('community.sharePost')}</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10"
                onClick={() => handleShare(sharePostId!, 'native')}
              >
                <Share2 className="w-5 h-5 mr-3" />
                {t('community.shareVia')}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10"
                onClick={() => handleShare(sharePostId!, 'copy')}
              >
                <MessageCircle className="w-5 h-5 mr-3" />
                {t('community.copyLink')}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4 text-gray-400"
              onClick={() => setIsShareModalOpen(false)}
            >{t('community.cancel')}</Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Community;
