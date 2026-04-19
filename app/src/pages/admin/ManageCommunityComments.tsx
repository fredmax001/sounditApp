import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare, Search, Check, X, Loader2
} from 'lucide-react';

interface CommunityComment {
  id: number;
  content: string;
  user_id: number | null;
  user: { id: number; first_name: string; last_name: string; avatar_url?: string } | null;
  guest_name: string | null;
  post_id: number;
  post_title: string | null;
  is_approved: boolean;
  like_count: number;
  created_at: string;
}

const ManageCommunityComments = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuthStore();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  useEffect(() => {
    loadComments();
  }, [statusFilter]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/admin/community/comments`);
      url.searchParams.set('status', statusFilter);
      if (searchQuery.trim()) url.searchParams.set('search', searchQuery.trim());
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      } else {
        toast.error(t('admin.manageCommunityComments.failedToLoadComments'));
      }
    } catch {
      toast.error(t('admin.manageCommunityComments.failedToLoadComments'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadComments();
  };

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/comments/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageCommunityComments.commentApproved'));
        loadComments();
      } else {
        toast.error(t('admin.manageCommunityComments.failedToApproveComment'));
      }
    } catch {
      toast.error(t('admin.manageCommunityComments.failedToApproveComment'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(`reject-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/comments/${id}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageCommunityComments.commentRejected'));
        loadComments();
      } else {
        toast.error(t('admin.manageCommunityComments.failedToRejectComment'));
      }
    } catch {
      toast.error(t('admin.manageCommunityComments.failedToRejectComment'));
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { id: 'all' | 'approved' | 'pending'; label: string }[] = [
    { id: 'all', label: t('admin.manageCommunityComments.all') },
    { id: 'approved', label: t('admin.manageCommunityComments.approved') },
    { id: 'pending', label: t('admin.manageCommunityComments.pending') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageCommunityComments.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageCommunityComments.subtitle')}</p>
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
              placeholder={t('admin.manageCommunityComments.searchPlaceholder')}
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

      {/* Comments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <AnimatePresence>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#111111] border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-sm">{comment.content}</p>
                    <div className="flex flex-wrap items-center gap-4 text-gray-500 text-xs mt-3">
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityComments.author')}:</span>{' '}
                        {comment.user_id === null ? (
                          <>
                            {comment.guest_name || t('community.guestBadge')}
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                              {t('community.guestBadge')}
                            </span>
                          </>
                        ) : comment.user ? (
                          `${comment.user.first_name} ${comment.user.last_name}`
                        ) : (
                          t('community.guestBadge')
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityComments.post')}:</span> {comment.post_title || `#${comment.post_id}`}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${comment.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {comment.is_approved ? t('admin.manageCommunityComments.approved') : t('admin.manageCommunityComments.pending')}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">{t('admin.manageCommunityComments.likes')}:</span> {comment.like_count}
                      </span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!comment.is_approved && (
                      <>
                        <button
                          onClick={() => handleApprove(comment.id)}
                          disabled={actionLoading === `approve-${comment.id}`}
                          className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20"
                          title={t('admin.manageCommunityComments.approve')}
                        >
                          {actionLoading === `approve-${comment.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleReject(comment.id)}
                          disabled={actionLoading === `reject-${comment.id}`}
                          className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                          title={t('admin.manageCommunityComments.reject')}
                        >
                          {actionLoading === `reject-${comment.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {comments.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                <p>{t('admin.manageCommunityComments.noCommentsFound')}</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ManageCommunityComments;
