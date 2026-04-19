import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Building2, Search, Check, Trash2,
  Loader2, Calendar, DollarSign, Sparkles, XCircle, Lock, Unlock
} from 'lucide-react';

interface Business {
  id: number;
  business_name: string;
  business_type?: string;
  is_verified: boolean;
  verification_badge?: boolean;
  events_count?: number;
  total_revenue?: number;
  is_featured: boolean;
  user_name?: string;
  user_id?: number;
  status?: string;
  city?: { name?: string };
}

const ManageBusinesses = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data || []);
      }
    } catch {
      toast.error(t('admin.manageBusinesses.failedToLoadBusinesses'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number) => {
    setActionLoading(`verify-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${id}/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageBusinesses.businessVerified'));
        loadBusinesses();
      }
    } catch {
      toast.error(t('admin.manageBusinesses.failedToVerifyBusiness'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnverify = async (id: number) => {
    setActionLoading(`unverify-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${id}/unverify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Business unverified');
        loadBusinesses();
      }
    } catch {
      toast.error('Failed to unverify business');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFeature = async (id: number) => {
    setActionLoading(`feature-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${id}/feature`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.is_featured ? t('admin.manageBusinesses.businessFeatured') : t('admin.manageBusinesses.businessUnfeatured'));;
        loadBusinesses();
      }
    } catch {
      toast.error(t('admin.manageBusinesses.failedToUpdateFeaturedStatus'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.manageBusinesses.confirmDelete'))) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageBusinesses.businessDeleted'));
        loadBusinesses();
      }
    } catch {
      toast.error(t('admin.manageBusinesses.failedToDeleteBusiness'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: number) => {
    setActionLoading(`activate-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Account activated');
        loadBusinesses();
      }
    } catch {
      toast.error('Failed to activate account');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (userId: number) => {
    setActionLoading(`suspend-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Account suspended');
        loadBusinesses();
      }
    } catch {
      toast.error('Failed to suspend account');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredBusinesses = businesses.filter(business => {
    const matchesSearch = !searchQuery || 
      business.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.business_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || business.business_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const businessTypes = [...new Set(businesses.map(b => b.business_type).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageBusinesses.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageBusinesses.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Building2 className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBusinesses.totalBusinesses')}</p>
              <p className="text-white font-bold text-xl">{businesses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBusinesses.verified')}</p>
              <p className="text-white font-bold text-xl">
                {businesses.filter(b => b.is_verified).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBusinesses.totalEvents')}</p>
              <p className="text-white font-bold text-xl">
                {businesses.reduce((acc, b) => acc + (b.events_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBusinesses.totalRevenue')}</p>
              <p className="text-white font-bold text-xl">
                ¥{businesses.reduce((acc, b) => acc + (b.total_revenue || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageBusinesses.featured')}</p>
              <p className="text-white font-bold text-xl">
                {businesses.filter(b => b.is_featured).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageBusinesses.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.manageBusinesses.allTypes')}</option>
          {businessTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Businesses Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageBusinesses.business')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageBusinesses.type')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageBusinesses.location')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageBusinesses.events')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageBusinesses.status')}</th>
                <th className="text-right text-gray-400 text-sm font-medium p-4">{t('admin.manageBusinesses.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBusinesses.map((business) => (
                <tr key={business.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                        {business.business_name?.[0] || 'B'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{business.business_name}</p>
                        <p className="text-gray-500 text-sm">{business.user_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400 capitalize">{business.business_type || t('admin.manageBusinesses.na')}</td>
                  <td className="p-4 text-gray-400">{business.city?.name || t('admin.manageBusinesses.na')}</td>
                  <td className="p-4 text-gray-400">{business.events_count || 0}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                        business.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {business.is_verified ? t('admin.manageBusinesses.verifiedStatus') : t('admin.manageBusinesses.pendingStatus')}
                      </span>
                      {business.is_featured && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium w-fit bg-yellow-500/20 text-yellow-400">
                          {t('admin.manageBusinesses.featuredBadge')}
                        </span>
                      )}
                      {business.status === 'suspended' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium w-fit bg-red-500/20 text-red-400">
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {!business.is_verified ? (
                        <button
                          onClick={() => handleVerify(business.id)}
                          disabled={actionLoading === `verify-${business.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-400"
                          title={t('admin.manageBusinesses.verify')}
                        >
                          {actionLoading === `verify-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(business.id)}
                          disabled={actionLoading === `unverify-${business.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg text-orange-400"
                          title="Unverify"
                        >
                          {actionLoading === `unverify-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleFeature(business.id)}
                        disabled={actionLoading === `feature-${business.id}`}
                        className={`p-2 hover:bg-white/10 rounded-lg ${business.is_featured ? 'text-yellow-400' : 'text-gray-400'}`}
                        title={business.is_featured ? t('admin.manageBusinesses.unfeature') : t('admin.manageBusinesses.feature')}
                      >
                        {actionLoading === `feature-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                      {business.status === 'suspended' ? (
                        <button
                          onClick={() => business.user_id && handleActivate(business.user_id)}
                          disabled={actionLoading === `activate-${business.user_id}` || !business.user_id}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-400"
                          title="Activate account"
                        >
                          {actionLoading === `activate-${business.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => business.user_id && handleSuspend(business.user_id)}
                          disabled={actionLoading === `suspend-${business.user_id}` || !business.user_id}
                          className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                          title="Suspend account"
                        >
                          {actionLoading === `suspend-${business.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(business.id)}
                        disabled={actionLoading === `delete-${business.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                        title={t('admin.manageBusinesses.delete')}
                      >
                        {actionLoading === `delete-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ManageBusinesses;
