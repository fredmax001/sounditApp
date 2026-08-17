import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Users, Building2, Music, Calendar, DollarSign,
  Loader2, AlertCircle, ChevronRight, Shield,
  Layers, CreditCard, Megaphone, Bell, MessageSquare,
  Flag, BookOpen, BarChart3, CheckCircle, Sparkles
} from 'lucide-react';

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  onClick?: () => void;
  loading: boolean;
  color?: string;
}

const StatCard = ({ title, value, icon: Icon, onClick, loading, color }: StatCardProps) => (
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
      <div className={`p-3 rounded-xl ${color || 'bg-[#d3da0c]/10'}`}>
        <Icon className={`w-6 h-6 ${color ? 'text-white' : 'text-[#d3da0c]'}`} />
      </div>
    </div>
  </motion.div>
);

const DashboardOverview = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, profile, isSuperAdmin } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roleInfo, setRoleInfo] = useState<{ role_name?: string; is_system?: boolean; permissions?: string[] }>({});

  // Stats data
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalArtists: 0,
    totalBusinesses: 0,
    totalEvents: 0,
    totalRevenue: 0,
    pendingVerifications: 0,
    totalTicketsSold: 0,
    pendingPayouts: 0,
    pendingVendorApprovals: 0,
  });

  interface PendingAction {
    id: string | number;
    title?: string;
    description?: string;
    action_url?: string;
  }
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  const loadDashboardData = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error(t('admin.dashboardOverview.notAuthenticated'));
        setLoading(false);
        return;
      }

      // Fetch user role & permissions
      try {
        const roleRes = await fetch(`${API_BASE_URL}/admin/admins/me/permissions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (roleRes.ok) {
          const rdata = await roleRes.json();
          setRoleInfo(rdata);
          useAuthStore.setState({ permissions: rdata.permissions || [] });
        }
      } catch (err) {
        console.error('Failed to load role permissions', err);
      }

      // Fetch dashboard stats
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
          totalTicketsSold: data.total_tickets_sold || 0,
          pendingPayouts: data.pending_payouts || 0,
          pendingVendorApprovals: data.pending_vendor_approvals || 0,
        });
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

  const roleNameLower = (roleInfo.role_name || '').toLowerCase();
  const isFinance = roleNameLower.includes('finance');
  const isMarketing = roleNameLower.includes('market');
  const isModerator = roleNameLower.includes('moderator') || roleNameLower.includes('content');
  const isCommunity = roleNameLower.includes('community');
  const isSupport = roleNameLower.includes('support');
  const isCustomRole = !roleInfo.is_system && roleInfo.role_name;

  return (
    <div className="space-y-6">
      {/* Role Workspace Banner for non-system roles */}
      {isCustomRole && (
        <div className="bg-gradient-to-r from-[#d3da0c]/15 via-black to-[#111111] border border-[#d3da0c]/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#d3da0c] text-black rounded-xl font-bold shadow-lg shadow-[#d3da0c]/20">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{roleInfo.role_name} Workspace</h2>
                <span className="px-2 py-0.5 bg-[#d3da0c]/20 text-[#d3da0c] text-xs font-bold rounded-full border border-[#d3da0c]/30">
                  Active Role
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-0.5">
                Logged in as {profile?.first_name || profile?.email}. Your dashboard is customized for {roleInfo.role_name} management.
              </p>
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white text-sm transition-all"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-[#d3da0c]" />}
            Sync Data
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isFinance ? 'Finance & Revenue Workspace' :
             isMarketing ? 'Marketing & Campaigns Hub' :
             isModerator ? 'Content Moderation Workspace' :
             isCommunity ? 'Community Management Hub' :
             isSupport ? 'Support & Verification Desk' :
             t('admin.dashboardOverview.title')}
          </h1>
          <p className="text-gray-400 mt-1">
            {isFinance ? 'Track platform revenue, ticket volume, subscriptions, and withdrawals' :
             isMarketing ? 'Manage promotional campaigns, ads, push notifications, and audience reach' :
             isModerator ? 'Review user reports, moderate community posts, recaps, and content' :
             isCommunity ? 'Engage community members, sections, discussions, and support queries' :
             isSupport ? 'Handle user verification requests, reviews, reports, and member assistance' :
             t('admin.dashboardOverview.subtitle')}
          </p>
        </div>
        {!isCustomRole && (
          <button
            onClick={loadDashboardData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 disabled:opacity-50 transition-all"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.dashboardOverview.refresh')}
          </button>
        )}
      </div>

      {/* Stats Grid — Tailored to Role */}
      {isFinance ? (
        /* Finance Workspace Stats */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Total Platform Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            onClick={() => navigate('/admin/financial')}
            loading={loading}
          />
          <StatCard
            title="Tickets Sold"
            value={formatNumber(stats.totalTicketsSold)}
            icon={Calendar}
            onClick={() => navigate('/admin/financial')}
            loading={loading}
          />
          <StatCard
            title="Active Subscriptions"
            value={formatNumber(stats.totalBusinesses)}
            icon={Layers}
            onClick={() => navigate('/admin/subscriptions')}
            loading={loading}
          />
          <StatCard
            title="Pending Payouts"
            value={stats.pendingPayouts}
            icon={CreditCard}
            onClick={() => navigate('/admin/withdrawals')}
            loading={loading}
          />
          <StatCard
            title="Registered Businesses"
            value={formatNumber(stats.totalBusinesses)}
            icon={Building2}
            onClick={() => navigate('/admin/businesses')}
            loading={loading}
          />
          <StatCard
            title="Active Events"
            value={formatNumber(stats.totalEvents)}
            icon={Calendar}
            onClick={() => navigate('/admin/events')}
            loading={loading}
          />
        </div>
      ) : isMarketing ? (
        /* Marketing Workspace Stats */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Total Platform Users"
            value={formatNumber(stats.totalUsers)}
            icon={Users}
            onClick={() => navigate('/admin/users')}
            loading={loading}
          />
          <StatCard
            title="Active Events"
            value={formatNumber(stats.totalEvents)}
            icon={Calendar}
            onClick={() => navigate('/admin/events')}
            loading={loading}
          />
          <StatCard
            title="Platform Artists"
            value={formatNumber(stats.totalArtists)}
            icon={Music}
            onClick={() => navigate('/admin/artists')}
            loading={loading}
          />
          <StatCard
            title="Ads & Promotions"
            value="Active"
            icon={Megaphone}
            onClick={() => navigate('/admin/ads')}
            loading={loading}
          />
          <StatCard
            title="Push & Notifications"
            value="Center"
            icon={Bell}
            onClick={() => navigate('/admin/notifications')}
            loading={loading}
          />
          <StatCard
            title="Platform Analytics"
            value="View"
            icon={BarChart3}
            onClick={() => navigate('/admin/analytics')}
            loading={loading}
          />
        </div>
      ) : isModerator || isCommunity ? (
        /* Community / Moderator Workspace Stats */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Community Hub"
            value="Active"
            icon={MessageSquare}
            onClick={() => navigate('/admin/community')}
            loading={loading}
          />
          <StatCard
            title="Moderation & Reports"
            value="Queue"
            icon={Flag}
            onClick={() => navigate('/admin/reports')}
            loading={loading}
          />
          <StatCard
            title="Event Recaps"
            value="Manage"
            icon={Calendar}
            onClick={() => navigate('/admin/recaps')}
            loading={loading}
          />
          <StatCard
            title="CMS Content"
            value="Pages"
            icon={BookOpen}
            onClick={() => navigate('/admin/cms')}
            loading={loading}
          />
          <StatCard
            title="Total Users"
            value={formatNumber(stats.totalUsers)}
            icon={Users}
            onClick={() => navigate('/admin/users')}
            loading={loading}
          />
          <StatCard
            title="Pending Actions"
            value={stats.pendingVerifications}
            icon={AlertCircle}
            onClick={() => navigate('/admin/reports')}
            loading={loading}
          />
        </div>
      ) : isSupport ? (
        /* Support Workspace Stats */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Verification Requests"
            value={stats.pendingVerifications}
            icon={CheckCircle}
            onClick={() => navigate('/admin/verification-center')}
            loading={loading}
          />
          <StatCard
            title="User Moderation"
            value="Reports"
            icon={Flag}
            onClick={() => navigate('/admin/reports')}
            loading={loading}
          />
          <StatCard
            title="Community Inquiries"
            value="Active"
            icon={MessageSquare}
            onClick={() => navigate('/admin/community')}
            loading={loading}
          />
          <StatCard
            title="Total Users"
            value={formatNumber(stats.totalUsers)}
            icon={Users}
            onClick={() => navigate('/admin/users')}
            loading={loading}
          />
          <StatCard
            title="Artists Registered"
            value={formatNumber(stats.totalArtists)}
            icon={Music}
            onClick={() => navigate('/admin/artists')}
            loading={loading}
          />
          <StatCard
            title="Businesses Registered"
            value={formatNumber(stats.totalBusinesses)}
            icon={Building2}
            onClick={() => navigate('/admin/businesses')}
            loading={loading}
          />
        </div>
      ) : (
        /* Full Admin / Super Admin Default Stats */
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
            onClick={() => navigate('/admin/verification-center')}
            loading={loading}
          />
        </div>
      )}

      {/* Pending Actions */}
      <div className="bg-[#111111] border border-white/10 rounded-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-white">{t('admin.dashboardOverview.pendingActionsTitle')}</h3>
          {pendingActions.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full font-bold">
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
            pendingActions.slice(0, 6).map((action) => (
              <div key={action.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{action.title}</p>
                    <p className="text-gray-500 text-xs truncate">{action.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(action.action_url)}
                  className="text-[#d3da0c] text-sm hover:underline flex items-center gap-1 font-semibold shrink-0 ml-3"
                >
                  {t('admin.dashboardOverview.review')} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Action Links — Tailored to Role */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isFinance ? [
          { label: 'Financial Control', path: '/admin/financial', color: 'bg-green-500/10 text-green-400' },
          { label: 'Subscriptions', path: '/admin/subscriptions', color: 'bg-purple-500/10 text-purple-400' },
          { label: 'Withdrawal Requests', path: '/admin/withdrawals', color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'Platform Analytics', path: '/admin/analytics', color: 'bg-blue-500/10 text-blue-400' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`p-4 rounded-xl ${link.color} hover:opacity-80 transition-all text-left border border-white/5`}
          >
            <p className="font-semibold text-sm">{link.label}</p>
          </button>
        )) : isMarketing ? [
          { label: 'Ads Manager', path: '/admin/ads', color: 'bg-pink-500/10 text-pink-400' },
          { label: 'Notification Center', path: '/admin/notifications', color: 'bg-purple-500/10 text-purple-400' },
          { label: 'Platform Analytics', path: '/admin/analytics', color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Featured Events', path: '/admin/events', color: 'bg-green-500/10 text-green-400' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`p-4 rounded-xl ${link.color} hover:opacity-80 transition-all text-left border border-white/5`}
          >
            <p className="font-semibold text-sm">{link.label}</p>
          </button>
        )) : isModerator || isCommunity ? [
          { label: 'Community Hub', path: '/admin/community', color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Reports & Moderation', path: '/admin/reports', color: 'bg-red-500/10 text-red-400' },
          { label: 'Event Recaps', path: '/admin/recaps', color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'CMS Pages', path: '/admin/cms', color: 'bg-green-500/10 text-green-400' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`p-4 rounded-xl ${link.color} hover:opacity-80 transition-all text-left border border-white/5`}
          >
            <p className="font-semibold text-sm">{link.label}</p>
          </button>
        )) : isSupport ? [
          { label: 'Verification Center', path: '/admin/verification-center', color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'User Directory', path: '/admin/users', color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Reports & Moderation', path: '/admin/reports', color: 'bg-red-500/10 text-red-400' },
          { label: 'Community Inquiries', path: '/admin/community', color: 'bg-green-500/10 text-green-400' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`p-4 rounded-xl ${link.color} hover:opacity-80 transition-all text-left border border-white/5`}
          >
            <p className="font-semibold text-sm">{link.label}</p>
          </button>
        )) : [
          { label: 'Manage Users', path: '/admin/users', color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Manage Events', path: '/admin/events', color: 'bg-green-500/10 text-green-400' },
          { label: 'Financial Control', path: '/admin/financial', color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'Roles & Invites', path: '/admin/roles', color: 'bg-purple-500/10 text-purple-400' },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`p-4 rounded-xl ${link.color} hover:opacity-80 transition-all text-left border border-white/5`}
          >
            <p className="font-semibold text-sm">{link.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardOverview;
