import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Users, Building2, Music, Calendar, DollarSign,
  Loader2, AlertCircle,
  ChevronRight
} from 'lucide-react';

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  onClick?: () => void;
  loading: boolean;
}

const StatCard = ({ title, value, icon: Icon, onClick, loading }: StatCardProps) => (
  <motion.div
    whileHover={{ y: -2 }}
    onClick={onClick}
    className={`bg-[#111111] border border-white/10 rounded-xl p-6 ${onClick ? 'cursor-pointer hover:border-[#d3da0c]/50' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-gray-400 text-sm">{title}</p>
        <h3 className="text-2xl lg:text-3xl font-bold text-white mt-2">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : value}
        </h3>
      </div>
      <div className="p-3 bg-[#d3da0c]/10 rounded-xl">
        <Icon className="w-6 h-6 text-[#d3da0c]" />
      </div>
    </div>
  </motion.div>
);

const DashboardOverview = () => {
  const { t } = useTranslation();
  // Removed console.log for production
  const navigate = useNavigate();
  const { session } = useAuthStore();

  // Removed console.log for production

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats data
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalArtists: 0,
    totalBusinesses: 0,
    totalEvents: 0,
    totalRevenue: 0,
    pendingVerifications: 0,
  });

  // Recent data
  interface PendingAction {
    id: string | number;
    title?: string;
    description?: string;
    action_url?: string;
  }
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  const loadDashboardData = useCallback(async () => {
    // Removed console.log for production
    setRefreshing(true);
    try {
      const token = session?.access_token;
      // Removed console.log for production
      if (!token) {
        toast.error(t('admin.dashboardOverview.notAuthenticated'));
        setLoading(false);
        return;
      }

      // Fetch dashboard stats
      // Removed console.log for production
      const statsRes = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats({
          totalUsers: data.total_users || 0,
          totalArtists: data.total_artists || 0,
          totalBusinesses: data.total_businesses || 0,
          totalEvents: data.total_events || 0,
          totalRevenue: data.total_revenue || 0,
          pendingVerifications: data.pending_verifications || 0,
        });
      } else {
        console.error('Stats fetch failed:', await statsRes.text());
      }

      // Fetch pending actions
      const pendingRes = await fetch(`${API_BASE_URL}/admin/pending-actions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingActions(data.actions || []);
      }

    } catch {
      toast.error(t('admin.dashboardOverview.failedToLoadSomeDashboardData'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.dashboardOverview.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.dashboardOverview.subtitle')}</p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 disabled:opacity-50 transition-all"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.dashboardOverview.refresh')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title={t('admin.dashboardOverview.totalUsers')}
          value={formatNumber(stats.totalUsers)}
          icon={Users}
          onClick={() => navigate('/admin/users')}
          loading={loading}
        />
        <StatCard
          title={t('admin.dashboardOverview.totalRevenue')}
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          onClick={() => navigate('/admin/financial')}
          loading={loading}
        />
        <StatCard
          title={t('admin.dashboardOverview.activeEvents')}
          value={formatNumber(stats.totalEvents)}
          icon={Calendar}
          onClick={() => navigate('/admin/events')}
          loading={loading}
        />
        <StatCard
          title={t('admin.dashboardOverview.artists')}
          value={formatNumber(stats.totalArtists)}
          icon={Music}
          onClick={() => navigate('/admin/artists')}
          loading={loading}
        />
        <StatCard
          title={t('admin.dashboardOverview.businesses')}
          value={formatNumber(stats.totalBusinesses)}
          icon={Building2}
          onClick={() => navigate('/admin/businesses')}
          loading={loading}
        />
        <StatCard
          title={t('admin.dashboardOverview.pendingActions')}
          value={stats.pendingVerifications}
          icon={AlertCircle}
          onClick={() => navigate('/admin/users')}
          loading={loading}
        />
      </div>

      {/* Pending Actions */}
      <div className="bg-[#111111] border border-white/10 rounded-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-white">{t('admin.dashboardOverview.pendingActionsTitle')}</h3>
          {pendingActions.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full">
              {pendingActions.length}
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
            </div>
          ) : pendingActions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('admin.dashboardOverview.noPendingActions')}</p>
            </div>
          ) : (
            pendingActions.slice(0, 5).map((action) => (
              <div key={action.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{action.title}</p>
                    <p className="text-gray-500 text-xs">{action.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(action.action_url)}
                  className="text-[#d3da0c] text-sm hover:underline flex items-center gap-1"
                >
                  {t('admin.dashboardOverview.review')} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Manage Users', path: '/admin/users', color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Manage Events', path: '/admin/events', color: 'bg-green-500/10 text-green-400' },
          { label: 'Financial', path: '/admin/financial', color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'Settings', path: '/admin/settings', color: 'bg-purple-500/10 text-purple-400' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`p-4 rounded-xl ${link.color} hover:opacity-80 transition-all text-left`}
          >
            <p className="font-medium">{t(`admin.dashboardOverview.${link.path.replace(/\//g, "_").replace(/-/g, "_")}`)}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardOverview;
