import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Search, Check, X, Eye, Loader2, MessageSquare
} from 'lucide-react';

interface CommunityPost {
  id: number;
  title: string;
  content: string;
  user: { id: number; first_name: string; last_name: string; avatar_url?: string; is_guest?: boolean } | null;
  guest_name: string | null;
  author_type: string;
  section: string | null;
  is_approved: boolean;
  is_visible: boolean;
  likes_count: number;
  comments_count: number;
  view_count: number;
  created_at: string;
}

const ManageCommunityPosts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuthStore();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [viewingPost, setViewingPost] = useState<CommunityPost | null>(null);

  useEffect(() => {
    loadPosts();
  }, [statusFilter]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/admin/community/posts`);
      url.searchParams.set('status', statusFilter);
      if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      } else {
        toast.error(t('admin.manageCommunityPosts.failedToLoadPosts'));
      }
    } catch {
      toast.error(t('admin.manageCommunityPosts.failedToLoadPosts'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPosts();
  };

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/posts/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageCommunityPosts.postApproved'));
        loadPosts();
      } else {
        toast.error(t('admin.manageCommunityPosts.failedToApprovePost'));
      }
    } catch {
      toast.error(t('admin.manageCommunityPosts.failedToApprovePost'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/posts/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageCommunityPosts.postRejected'));
        loadPosts();
      } else {
        toast.error(t('admin.manageCommunityPosts.failedToRejectPost'));
      }
    } catch {
      toast.error(t('admin.manageCommunityPosts.failedToRejectPost'));
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { id: 'all' | 'approved' | 'pending'; label: string }[] = [
    { id: 'all', label: t('admin.manageCommunityPosts.all') },
    { id: 'approved', label: t('admin.manageCommunityPosts.approved') },
    { id: 'pending', label: t('admin.manageCommunityPosts.pending') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageCommunityPosts.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageCommunityPosts.subtitle')}</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl w-fit">
          {[
            { id: 'metrics', label: t('admin.communityMetrics.tabMetrics'), path: '/admin/community' },
            { id: 'sections', label: t('admin.communityMetrics.tabSections'), path: '/admin/community/sections' },
            { id: 'posts', label: t('admin.communityMetrics.tabPosts'), path: '/admin/community/posts' },
            { id: 'comments', label: t('admin.communityMetrics.tabComments'), path: '/admin/community/comments' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === tab.path ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex bg-white/5 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === tab.id ? 'bg-[#d3da0c] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 max-w-md w-full">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder={t('admin.manageCommunityPosts.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            {t('common.search')}
          </button>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <AnimatePresence>
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#111111] border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">{post.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${post.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {post.is_approved ? t('admin.manageCommunityPosts.approved') : t('admin.manageCommunityPosts.pending')}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{post.content}</p>
                    <div className="flex flex-wrap items-center gap-4 text-gray-500 text-xs mt-3">
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityPosts.author')}:</span>{' '}
                        {!post.user || post.user.is_guest ? (
                          <>
                            {post.guest_name || t('community.guestBadge')}
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                              {t('community.guestBadge')}
                            </span>
                          </>
                        ) : (
                          `${post.user.first_name} ${post.user.last_name}`
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityPosts.authorType')}:</span> {post.author_type}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityPosts.section')}:</span> {post.section || '-'}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityPosts.likes')}:</span> {post.likes_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {post.comments_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {post.view_count}
                      </span>
                      <span>{new Date(post.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!post.is_approved && (
                      <>
                        <button
                          onClick={() => handleApprove(post.id)}
                          disabled={actionLoading === `approve-${post.id}`}
                          className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20"
                          title={t('admin.manageCommunityPosts.approve')}
                        >
                          {actionLoading === `approve-${post.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleReject(post.id)}
                          disabled={actionLoading === `reject-${post.id}`}
                          className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                          title={t('admin.manageCommunityPosts.reject')}
                        >
                          {actionLoading === `reject-${post.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setViewingPost(post)}
                      className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white"
                      title={t('admin.manageCommunityPosts.view')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {posts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                <p>{t('admin.manageCommunityPosts.noPostsFound')}</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* View Modal */}
      {viewingPost && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <h3 className="text-lg font-semibold text-white truncate pr-4">{viewingPost.title}</h3>
              <button
                onClick={() => setViewingPost(null)}
                className="p-2 hover:bg-white/10 rounded-lg shrink-0"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-400">{t('admin.manageCommunityPosts.author')}:</span>
                <span className="text-white">
                  {!viewingPost.user || viewingPost.user.is_guest
                    ? (viewingPost.guest_name || t('community.guestBadge'))
                    : `${viewingPost.user.first_name} ${viewingPost.user.last_name}`}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-300">{viewingPost.author_type}</span>
                <span className="text-gray-400">{t('admin.manageCommunityPosts.section')}:</span>
                <span className="text-white">{viewingPost.section || '-'}</span>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-gray-200 text-sm whitespace-pre-wrap">
                {viewingPost.content}
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-400">
                <span>{t('admin.manageCommunityPosts.likes')}: <span className="text-white">{viewingPost.likes_count}</span></span>
                <span>{t('admin.manageCommunityPosts.comments')}: <span className="text-white">{viewingPost.comments_count}</span></span>
                <span>{t('admin.manageCommunityPosts.views')}: <span className="text-white">{viewingPost.view_count}</span></span>
                <span>{new Date(viewingPost.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 shrink-0">
              {!viewingPost.is_approved && (
                <>
                  <button
                    onClick={() => { handleReject(viewingPost.id); setViewingPost(null); }}
                    disabled={actionLoading === `reject-${viewingPost.id}`}
                    className="px-4 py-2 bg-red-500/10 text-red-400 font-medium rounded-lg hover:bg-red-500/20"
                  >
                    {t('admin.manageCommunityPosts.reject')}
                  </button>
                  <button
                    onClick={() => { handleApprove(viewingPost.id); setViewingPost(null); }}
                    disabled={actionLoading === `approve-${viewingPost.id}`}
                    className="px-4 py-2 bg-green-500/10 text-green-400 font-medium rounded-lg hover:bg-green-500/20"
                  >
                    {t('admin.manageCommunityPosts.approve')}
                  </button>
                </>
              )}
              <button
                onClick={() => setViewingPost(null)}
                className="px-4 py-2 bg-white/5 text-white font-medium rounded-lg hover:bg-white/10"
              >
                {t('common.close')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ManageCommunityPosts;
