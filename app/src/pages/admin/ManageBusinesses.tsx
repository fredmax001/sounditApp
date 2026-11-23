import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Building2, Search, Check, Trash2,
  Loader2, Calendar, DollarSign, XCircle, Lock, Unlock, Eye
} from 'lucide-react';
import EntityDetailModal from '@/components/admin/EntityDetailModal';

interface Business {
  id: number;
  organization_name: string;
  description?: string;
  is_verified: boolean;
  is_approved?: boolean;
  verification_badge?: boolean;
  events_count?: number;
  total_revenue?: number;
  is_featured: boolean;
  user_name?: string;
  user_id?: number;
  status?: string;
}

const ManageBusinesses = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // kept for compatibility but unused
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewBusinessCard = (bizId: string | number) => {
    setSelectedBusinessId(bizId);
    setIsDetailModalOpen(true);
  };

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

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Business approved');
        loadBusinesses();
      }
    } catch {
      toast.error('Failed to approve business');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnapprove = async (id: number) => {
    setActionLoading(`unapprove-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${id}/unapprove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Business unapproved');
        loadBusinesses();
      }
    } catch {
      toast.error('Failed to unapprove business');
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
      business.organization_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader chip="Management" title={t('admin.manageBusinesses.title')} subtitle={t('admin.manageBusinesses.subtitle')} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-[#8a8f04] dark:text-[#d3da0c] rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">{t('admin.manageBusinesses.totalBusinesses')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">{businesses.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">{t('admin.manageBusinesses.verified')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {businesses.filter(b => b.is_verified).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">{t('admin.manageBusinesses.totalEvents')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {businesses.reduce((acc, b) => acc + (b.events_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">{t('admin.manageBusinesses.totalRevenue')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                ¥{businesses.reduce((acc, b) => acc + (b.total_revenue || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">Approved</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {businesses.filter(b => b.is_approved).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-gray-500 dark:text-[#9CA3AF] text-xs font-medium">{t('admin.manageBusinesses.featured')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {businesses.filter(b => b.is_featured).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageBusinesses.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0F140D] border border-black/10 dark:border-[#1F261E] rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
      </div>

      {/* Businesses Table / Mobile Cards */}
      <div className="bg-white dark:bg-[#0F140D] border border-black/8 dark:border-[#1F261E] rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <>
          {/* Mobile Native Cards */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {filteredBusinesses.map((business) => (
              <div key={business.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => handleViewBusinessCard(business.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30 rounded-full flex items-center justify-center font-bold shrink-0">
                      {business.organization_name?.[0] || 'B'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#020b00] dark:text-white font-semibold text-sm truncate">{business.organization_name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate">{business.user_name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-semibold ${
                      business.is_verified || business.verification_badge ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                    }`}>
                      {business.is_verified || business.verification_badge ? 'Verified' : 'Unverified'}
                    </span>
                    {business.is_approved && (
                      <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400">
                        Approved
                      </span>
                    )}
                  </div>
                </div>

                {business.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{business.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#9CA3AF] bg-neutral-50 dark:bg-white/[0.03] rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#020b00] dark:text-white">{business.events_count || 0} events</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-[#22C55E] font-bold">¥{(business.total_revenue || 0).toLocaleString()} revenue</span>
                  </div>
                  {business.is_featured && (
                    <span className="text-yellow-600 dark:text-[#d3da0c] font-bold">Featured</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    onClick={() => handleViewBusinessCard(business.id)}
                    className="flex-1 min-w-[5rem] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-white/[0.06] text-xs font-semibold text-[#020b00] dark:text-white active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#d3da0c]" />
                    Details
                  </button>
                  {!business.is_verified ? (
                    <button
                      onClick={() => handleVerify(business.id)}
                      disabled={actionLoading === `verify-${business.id}`}
                      className="px-3 py-2 rounded-xl bg-green-500/15 text-green-700 dark:text-green-400 text-xs font-semibold"
                    >
                      Verify
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnverify(business.id)}
                      disabled={actionLoading === `unverify-${business.id}`}
                      className="px-3 py-2 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs font-semibold"
                    >
                      Unverify
                    </button>
                  )}
                  <button
                    onClick={() => handleFeature(business.id)}
                    disabled={actionLoading === `feature-${business.id}`}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold ${business.is_featured ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' : 'bg-neutral-100 dark:bg-white/[0.06] text-gray-500'}`}
                  >
                    {business.is_featured ? 'Featured' : 'Feature'}
                  </button>
                  <button
                    onClick={() => handleDelete(business.id)}
                    disabled={actionLoading === `delete-${business.id}`}
                    className="p-2 rounded-xl bg-red-500/10 text-red-500"
                    aria-label="Delete business"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-white/5 border-b border-black/8 dark:border-white/10">
              <tr>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageBusinesses.business')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageBusinesses.description') || 'Description'}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageBusinesses.events')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageBusinesses.status')}</th>
                <th className="text-right text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageBusinesses.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredBusinesses.map((business) => (
                <tr key={business.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div 
                      onClick={() => handleViewBusinessCard(business.id)}
                      className="flex items-center gap-3 cursor-pointer group"
                      title="Click to view business card"
                    >
                      <div className="w-10 h-10 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30 rounded-full flex items-center justify-center font-bold group-hover:ring-2 group-hover:ring-[#d3da0c] transition-all">
                        {business.organization_name?.[0] || 'B'}
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                          {business.organization_name}
                          <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{business.user_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{business.description || t('admin.manageBusinesses.na')}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{business.events_count || 0}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${
                        business.is_verified || business.verification_badge ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                      }`}>
                        {business.is_verified || business.verification_badge ? (t('admin.manageBusinesses.verifiedStatus') || 'Verified') : (t('admin.manageBusinesses.unverifiedStatus') || 'Unverified')}
                      </span>
                      {business.is_approved && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-blue-500/15 text-blue-700 dark:text-blue-400">
                          Approved
                        </span>
                      )}
                      {business.is_featured && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
                          {t('admin.manageBusinesses.featuredBadge')}
                        </span>
                      )}
                      {business.status === 'suspended' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-fit bg-red-500/15 text-red-600 dark:text-red-400">
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewBusinessCard(business.id)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-700 dark:text-gray-300 hover:text-[#d3da0c] transition-colors"
                        title="View Business Card & Performance"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!business.is_verified ? (
                        <button
                          onClick={() => handleVerify(business.id)}
                          disabled={actionLoading === `verify-${business.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                          title={t('admin.manageBusinesses.verify')}
                        >
                          {actionLoading === `verify-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(business.id)}
                          disabled={actionLoading === `unverify-${business.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-orange-600 dark:text-orange-400 transition-colors"
                          title="Unverify"
                        >
                          {actionLoading === `unverify-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      )}
                      {!business.is_approved ? (
                        <button
                          onClick={() => handleApprove(business.id)}
                          disabled={actionLoading === `approve-${business.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                          title="Approve account"
                        >
                          {actionLoading === `approve-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnapprove(business.id)}
                          disabled={actionLoading === `unapprove-${business.id}`}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
                          title="Unapprove account"
                        >
                          {actionLoading === `unapprove-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleFeature(business.id)}
                        disabled={actionLoading === `feature-${business.id}`}
                        className={`px-2 py-1 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors ${business.is_featured ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}
                        title={business.is_featured ? t('admin.manageBusinesses.unfeature') : t('admin.manageBusinesses.feature')}
                      >
                        {actionLoading === `feature-${business.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : (business.is_featured ? 'Featured' : 'Feature')}
                      </button>
                      {business.status === 'suspended' ? (
                        <button
                          onClick={() => business.user_id && handleActivate(business.user_id)}
                          disabled={actionLoading === `activate-${business.user_id}` || !business.user_id}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                          title="Activate account"
                        >
                          {actionLoading === `activate-${business.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => business.user_id && handleSuspend(business.user_id)}
                          disabled={actionLoading === `suspend-${business.user_id}` || !business.user_id}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                          title="Suspend account"
                        >
                          {actionLoading === `suspend-${business.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(business.id)}
                        disabled={actionLoading === `delete-${business.id}`}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-red-600 dark:text-red-400 transition-colors"
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
          </div>
          </>
        )}
      </div>
      {/* Business Detail Modal */}
      <EntityDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBusinessId(null);
        }}
        type="business"
        entityId={selectedBusinessId}
        onUpdated={loadBusinesses}
      />
    </div>
  );
};

export default ManageBusinesses;
