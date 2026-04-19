import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare, FileText, MessageCircle, LayoutGrid, AlertCircle,
  TrendingUp, Clock, ChevronRight, Eye, Loader2
} from 'lucide-react';

interface MetricsData {
  total_posts: number;
  total_pending_posts: number;
  total_comments: number;
  total_pending_comments: number;
  total_sections: number;
  posts_today: number;
  posts_this_week: number;
  top_sections: Array<{ id: number; name: string; post_count: number }>;
  recent_flagged: Array<{ id: number; title: string; content: string; author_name: string; created_at: string }>;
}

const CommunityMetrics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuthStore();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/community/metrics`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      } else {
        toast.error(t('admin.communityMetrics.failedToLoadMetrics'));
      }
    } catch {
      toast.error(t('admin.communityMetrics.failedToLoadMetrics'));
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { key: 'totalPosts', value: metrics?.total_posts || 0, icon: FileText, color: 'text-[#d3da0c]' },
    { key: 'pendingPosts', value: metrics?.total_pending_posts || 0, icon: AlertCircle, color: 'text-yellow-400' },
    { key: 'totalComments', value: metrics?.total_comments || 0, icon: MessageCircle, color: 'text-blue-400' },
    { key: 'pendingComments', value: metrics?.total_pending_comments || 0, icon: AlertCircle, color: 'text-orange-400' },
    { key: 'totalSections', value: metrics?.total_sections || 0, icon: LayoutGrid, color: 'text-purple-400' },
    { key: 'postsToday', value: metrics?.posts_today || 0, icon: Clock, color: 'text-green-400' },
    { key: 'postsThisWeek', value: metrics?.posts_this_week || 0, icon: TrendingUp, color: 'text-pink-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.communityMetrics.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.communityMetrics.subtitle')}</p>
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#111111] border border-white/10 rounded-xl p-4"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`p-2 bg-white/5 rounded-lg ${card.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-xl">{card.value}</p>
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">{t(`admin.communityMetrics.${card.key}`)}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Sections */}
            <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-5 h-5 text-[#d3da0c]" />
                <h2 className="text-white font-semibold">{t('admin.communityMetrics.topSections')}</h2>
              </div>
              {metrics && metrics.top_sections.length > 0 ? (
                <div className="space-y-3">
                  {metrics.top_sections.map((section, idx) => (
                    <div key={section.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-gray-400 text-xs font-bold">{idx + 1}</span>
                        <span className="text-white text-sm font-medium">{section.name}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{section.post_count} {t('admin.communityMetrics.posts')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">{t('admin.communityMetrics.noTopSections')}</p>
              )}
            </div>

            {/* Recent Flagged Posts */}
            <div className="bg-[#111111] border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <h2 className="text-white font-semibold">{t('admin.communityMetrics.recentFlagged')}</h2>
                </div>
                <button
                  onClick={() => navigate('/admin/community/posts')}
                  className="text-xs text-[#d3da0c] hover:underline flex items-center gap-1"
                >
                  {t('admin.communityMetrics.viewAll')} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {metrics && metrics.recent_flagged.length > 0 ? (
                <div className="space-y-3">
                  {metrics.recent_flagged.map((post) => (
                    <div key={post.id} className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{post.title}</p>
                          <p className="text-gray-500 text-xs mt-1 truncate">{post.content}</p>
                          <p className="text-gray-500 text-xs mt-1">{t('admin.communityMetrics.by')} {post.author_name} • {new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => navigate('/admin/community/posts')}
                          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg shrink-0"
                          title={t('admin.communityMetrics.view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">{t('admin.communityMetrics.noFlaggedPosts')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CommunityMetrics;
