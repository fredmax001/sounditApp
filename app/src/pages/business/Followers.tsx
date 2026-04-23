import { Heart, Users, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import DashboardPageContainer, { DashboardPageHeader, DashboardStatCard } from '@/components/dashboard/DashboardPageContainer';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Follower {
  id: string;
  name: string;
  email: string;
  joinedDate: string;
  eventsAttended: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const Followers = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  const token = session?.access_token;

  useEffect(() => {
    if (token) {
      fetchFollowers();
    }
  }, [token]);

  const fetchFollowers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/business/followers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFollowers(data || []);
      } else {
        const data = await res.json();
        toast.error(data.detail || t('business.followers.failedToLoadFollowers'));
        setFollowers([]);
      }
    } catch (err) {
      console.error('Failed to fetch followers', err);
      setFollowers([]);
    } finally {
      setLoading(false);
    }
  };

  const thisMonth = followers.filter(f => {
    if (!f.joinedDate) return false;
    const date = new Date(f.joinedDate);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const avgEvents = followers.length > 0
    ? Math.round(followers.reduce((sum, f) => sum + (f.eventsAttended || 0), 0) / followers.length)
    : 0;

  return (
    <DashboardPageContainer>
      <DashboardPageHeader
        title={t('business.followers.title')}
        subtitle={t('business.followers.subtitle')}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashboardStatCard
          icon={Heart}
          label={t('business.followers.totalFollowers')}
          value={followers.length}
          iconClassName="text-[#FF2D8F]"
        />
        <DashboardStatCard
          icon={TrendingUp}
          label={t('business.followers.newThisMonth')}
          value={thisMonth}
          iconClassName="text-green-400"
        />
        <DashboardStatCard
          icon={Users}
          label={t('business.followers.active')}
          value={followers.length}
        />
        <DashboardStatCard
          icon={Calendar}
          label={t('business.followers.avgEvents')}
          value={avgEvents}
          iconClassName="text-blue-400"
        />
      </div>

      {/* Followers List */}
      <div className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('business.followers.recentFollowers')}</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{t('business.followers.loadingFollowers')}</p>
          </div>
        ) : followers.length > 0 ? (
          <div className="divide-y divide-white/5">
            {followers.map((follower) => (
              <div key={follower.id} className="flex items-center justify-between p-6 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black font-bold text-lg">
                    {follower.name ? follower.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <p className="text-white font-medium">{follower.name || t('business.followers.anonymous')}</p>
                    <p className="text-gray-500 text-sm">{follower.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">{t('business.followers.joined')}</p>
                    <p className="text-white text-sm">{follower.joinedDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs">{t('business.followers.events')}</p>
                    <p className="text-white text-sm font-medium">{follower.eventsAttended}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">{t('business.followers.noFollowers')}</p>
            <p className="text-gray-500 text-sm">{t('business.followers.noFollowersHint')}</p>
          </div>
        )}
      </div>
    </DashboardPageContainer>
  );
};

export default Followers;
