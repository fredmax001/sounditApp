import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/store/authStore';
import { useCommunityStore, type CommunityPost } from '@/store/communityStore';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Eye,
  Heart,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import DashboardPageContainer, {
  DashboardPageHeader,
  DashboardStatCard,
  DashboardCard,
} from './DashboardPageContainer';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface CommunityDashboardProps {
  authorType: 'business' | 'artist' | 'vendor';
  title: string;
  subtitle: string;
}

export default function CommunityDashboard({
  authorType,
  title,
  subtitle,
}: CommunityDashboardProps) {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const {
    posts,
    sections,
    isLoading,
    isCreating,
    fetchPosts,
    fetchSections,
    createPost,
    updatePost,
    deletePost,
    uploadMedia,
  } = useCommunityStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    section_id: '',
    images: [] as string[],
    videos: [] as string[],
  });
  const [uploading, setUploading] = useState(false);

  const currentUserId = profile?.id;

  useEffect(() => {
    if (currentUserId) {
      fetchPosts({ user_id: Number(currentUserId) });
    }
    fetchSections();
  }, [currentUserId, fetchPosts, fetchSections]);

  const metrics = useMemo(() => {
    const totalPosts = posts.length;
    const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
    const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);
    return { totalPosts, totalViews, totalLikes, totalComments };
  }, [posts]);

  const handleOpenCreate = () => {
    setEditingPost(null);
    setForm({ title: '', content: '', section_id: '', images: [], videos: [] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (post: CommunityPost) => {
    setEditingPost(post);
    setForm({
      title: post.title || '',
      content: post.content,
      section_id: post.section_id ? String(post.section_id) : '',
      images: post.images || [],
      videos: post.videos || [],
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPost(null);
    setForm({ title: '', content: '', section_id: '', images: [], videos: [] });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await uploadMedia(Array.from(files));
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      toast.success('Images uploaded');
    } catch {
      toast.error(t('community.uploadFailed') || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (url: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }));
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await uploadMedia(Array.from(files));
      setForm((prev) => ({ ...prev, videos: [...prev.videos, ...urls] }));
      toast.success('Videos uploaded');
    } catch {
      toast.error(t('community.uploadFailed') || 'Video upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveVideo = (url: string) => {
    setForm((prev) => ({ ...prev, videos: prev.videos.filter((u) => u !== url) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) {
      toast.error('Please enter content');
      return;
    }
    const payload = {
      title: form.title,
      content: form.content,
      section_id: form.section_id ? parseInt(form.section_id) : undefined,
      images: form.images,
      videos: form.videos,
      author_type: authorType,
    };
    let success;
    if (editingPost) {
      success = await updatePost(editingPost.id, payload);
    } else {
      success = await createPost(payload);
    }
    if (success) {
      handleCloseModal();
      if (currentUserId) {
        fetchPosts({ user_id: Number(currentUserId) });
      }
    }
  };

  const handleDelete = async (post: CommunityPost) => {
    if (!window.confirm(t('dashboard.community.deleteConfirm') || 'Are you sure you want to delete this post?')) {
      return;
    }
    const success = await deletePost(post.id);
    if (success && currentUserId) {
      fetchPosts({ user_id: Number(currentUserId) });
    }
  };

  const modalContent = isModalOpen ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={handleCloseModal}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />
      {/* Modal Content */}
      <div
        className="relative bg-[#111111] border border-[#d3da0c]/30 text-white w-full max-w-lg rounded-xl shadow-2xl shadow-[#d3da0c]/10 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {editingPost
              ? t('dashboard.community.editPost')
              : t('dashboard.community.createPost')}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('dashboard.community.postTitle')}
            </label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              placeholder={t('community.postTitle') || ''}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('dashboard.community.section')}
            </label>
            <select
              value={form.section_id}
              onChange={(e) =>
                setForm({ ...form, section_id: e.target.value })
              }
              className="w-full h-9 bg-white/5 border border-white/10 text-white rounded-md px-3 py-1 text-sm outline-none focus:border-[#d3da0c] appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
              }}
            >
              <option value="">{t('common.none') || 'None'}</option>
              {sections.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('dashboard.community.content')}
            </label>
            <Textarea
              value={form.content}
              onChange={(e) =>
                setForm({ ...form, content: e.target.value })
              }
              placeholder={t('community.shareExperiencePlaceholder') || ''}
              rows={4}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('dashboard.community.imageUpload')}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.images.map((url) => (
                <div
                  key={url}
                  className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url)}
                    className="absolute top-0 right-0 p-1 bg-black/60 text-white rounded-bl"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label
                className={`w-16 h-16 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer ${
                  uploading ? 'opacity-50' : 'hover:border-[#d3da0c]/50 hover:bg-white/5'
                }`}
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t('dashboard.community.videoUpload')}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.videos.map((url) => (
                <div
                  key={url}
                  className="relative w-24 h-16 rounded-lg overflow-hidden border border-white/10"
                >
                  <video src={url} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveVideo(url)}
                    className="absolute top-0 right-0 p-1 bg-black/60 text-white rounded-bl"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label
                className={`w-16 h-16 rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer ${
                  uploading ? 'opacity-50' : 'hover:border-[#d3da0c]/50 hover:bg-white/5'
                }`}
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                ) : (
                  <Video className="w-5 h-5 text-gray-400" />
                )}
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isCreating || uploading}>
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingPost ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <DashboardPageContainer>
      <DashboardPageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('dashboard.community.createPost')}
          </Button>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardStatCard
          icon={MessageSquare}
          label={t('dashboard.community.totalPosts')}
          value={metrics.totalPosts}
        />
        <DashboardStatCard
          icon={Eye}
          label={t('dashboard.community.totalViews')}
          value={metrics.totalViews}
        />
        <DashboardStatCard
          icon={Heart}
          label={t('dashboard.community.totalLikes')}
          value={metrics.totalLikes}
        />
        <DashboardStatCard
          icon={MessageCircle}
          label={t('dashboard.community.totalComments')}
          value={metrics.totalComments}
        />
      </div>

      {/* Posts Table */}
      <DashboardCard title={t('dashboard.community.posts')}>
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{t('common.loading')}</p>
          </div>
        ) : posts.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-gray-400">
                    {t('dashboard.community.postTitle')}
                  </TableHead>
                  <TableHead className="text-gray-400">
                    {t('dashboard.community.section')}
                  </TableHead>
                  <TableHead className="text-gray-400">
                    {t('community.likes')}
                  </TableHead>
                  <TableHead className="text-gray-400">
                    {t('community.comments')}
                  </TableHead>
                  <TableHead className="text-gray-400">
                    {t('community.views')}
                  </TableHead>
                  <TableHead className="text-gray-400">
                    {t('dashboard.community.created')}
                  </TableHead>
                  <TableHead className="text-gray-400 text-right">
                    {t('dashboard.community.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="text-white font-medium max-w-xs truncate">
                      {post.title || t('dashboard.community.untitled')}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {post.section?.name || '-'}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {post.likes_count || 0}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {post.comments_count || 0}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {post.view_count || 0}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {new Date(post.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(post)}
                        >
                          <Pencil className="w-4 h-4" />
                          <span className="sr-only">{t('common.edit')}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleDelete(post)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">{t('common.delete')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">
              {t('community.noPostsYet')}
            </p>
            <p className="text-gray-500 text-sm">
              {t('dashboard.community.noPostsHint')}
            </p>
          </div>
        )}
      </DashboardCard>

      {/* Modal rendered via portal for reliability */}
      {modalContent && createPortal(modalContent, document.body)}
    </DashboardPageContainer>
  );
}
