import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Store, Search, Check, Trash2, Loader2, DollarSign, Package, Sparkles, XCircle, Lock, Unlock
} from 'lucide-react';

interface Vendor {
  id: number;
  business_name?: string;
  category?: string;
  is_verified?: boolean;
  verification_badge?: boolean;
  is_featured?: boolean;
  products_count?: number;
  total_sales?: number;
  user_name?: string;
  user_id?: number;
  status?: string;
}

const ManageVendors = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVendors(data || []);
      }
    } catch {
      toast.error(t('admin.manageVendors.failedToLoadVendors'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id: number) => {
    setActionLoading(`verify-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageVendors.vendorVerified'));
        loadVendors();
      }
    } catch {
      toast.error('Failed to verify vendor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnverify = async (id: number) => {
    setActionLoading(`unverify-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/unverify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Vendor unverified');
        loadVendors();
      }
    } catch {
      toast.error('Failed to unverify vendor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFeature = async (id: number) => {
    setActionLoading(`feature-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/feature`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.is_featured ? t('admin.manageVendors.vendorFeatured') : t('admin.manageVendors.vendorUnfeatured'));
        loadVendors();
      }
    } catch {
      toast.error(t('admin.manageVendors.failedToUpdateFeaturedStatus'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('admin.manageVendors.confirmDelete'))) return;
    setActionLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success(t('admin.manageVendors.vendorDeleted'));
        loadVendors();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Delete failed');
      }
    } catch {
      toast.error(t('admin.manageVendors.failedToDeleteVendor'));
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
        loadVendors();
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
        loadVendors();
      }
    } catch {
      toast.error('Failed to suspend account');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = !searchQuery || 
      vendor.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || vendor.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(vendors.map(v => v.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.manageVendors.title')}</h1>
          <p className="text-gray-400 mt-1">{t('admin.manageVendors.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d3da0c]/10 rounded-lg">
              <Store className="w-5 h-5 text-[#d3da0c]" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageVendors.totalVendors')}</p>
              <p className="text-white font-bold text-xl">{vendors.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageVendors.verified')}</p>
              <p className="text-white font-bold text-xl">
                {vendors.filter(v => v.is_verified).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-xs">{t('admin.manageVendors.totalProducts')}</p>
              <p className="text-white font-bold text-xl">
                {vendors.reduce((acc, v) => acc + (v.products_count || 0), 0)}
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
              <p className="text-gray-400 text-xs">{t('admin.manageVendors.totalSales')}</p>
              <p className="text-white font-bold text-xl">
                ¥{vendors.reduce((acc, v) => acc + (v.total_sales || 0), 0).toLocaleString()}
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
              <p className="text-gray-400 text-xs">{t('admin.manageVendors.featured')}</p>
              <p className="text-white font-bold text-xl">
                {vendors.filter(v => v.is_featured).length}
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
            placeholder={t('admin.manageVendors.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-[#111111] border border-white/10 rounded-lg text-white"
        >
          <option value="">{t('admin.manageVendors.allCategories')}</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Vendors Table */}
      <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageVendors.vendorHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageVendors.categoryHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageVendors.productsHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageVendors.salesHeader')}</th>
                <th className="text-left text-gray-400 text-sm font-medium p-4">{t('admin.manageVendors.statusHeader')}</th>
                <th className="text-right text-gray-400 text-sm font-medium p-4">{t('admin.manageVendors.actionsHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                        {vendor.business_name?.[0] || 'V'}
                      </div>
                      <div>
                        <p className="text-white font-medium">{vendor.business_name}</p>
                        <p className="text-gray-500 text-sm">{vendor.user_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400">{vendor.category || '-'}</td>
                  <td className="p-4 text-gray-400">{vendor.products_count || 0}</td>
                  <td className="p-4 text-gray-400">¥{(vendor.total_sales || 0).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                        vendor.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {vendor.is_verified ? t('admin.manageVendors.statusVerified') : t('admin.manageVendors.statusPending')}
                      </span>
                      {vendor.is_featured && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium w-fit bg-yellow-500/20 text-yellow-400">
                          {t('admin.manageVendors.badgeFeatured')}
                        </span>
                      )}
                      {vendor.status === 'suspended' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium w-fit bg-red-500/20 text-red-400">
                          Suspended
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {!vendor.is_verified ? (
                        <button
                          onClick={() => handleVerify(vendor.id)}
                          disabled={actionLoading === `verify-${vendor.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-400"
                          title={t('admin.manageVendors.verifyTitle')}
                        >
                          {actionLoading === `verify-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(vendor.id)}
                          disabled={actionLoading === `unverify-${vendor.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg text-orange-400"
                          title="Unverify"
                        >
                          {actionLoading === `unverify-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleFeature(vendor.id)}
                        disabled={actionLoading === `feature-${vendor.id}`}
                        className={`p-2 hover:bg-white/10 rounded-lg ${vendor.is_featured ? 'text-yellow-400' : 'text-gray-400'}`}
                        title={vendor.is_featured ? t('admin.manageVendors.unfeatureTitle') : t('admin.manageVendors.featureTitle')}
                      >
                        {actionLoading === `feature-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      </button>
                      {vendor.status === 'suspended' ? (
                        <button
                          onClick={() => vendor.user_id && handleActivate(vendor.user_id)}
                          disabled={actionLoading === `activate-${vendor.user_id}` || !vendor.user_id}
                          className="p-2 hover:bg-white/10 rounded-lg text-green-400"
                          title="Activate account"
                        >
                          {actionLoading === `activate-${vendor.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => vendor.user_id && handleSuspend(vendor.user_id)}
                          disabled={actionLoading === `suspend-${vendor.user_id}` || !vendor.user_id}
                          className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                          title="Suspend account"
                        >
                          {actionLoading === `suspend-${vendor.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(vendor.id)}
                        disabled={actionLoading === `delete-${vendor.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                        title={t('admin.manageVendors.deleteTitle')}
                      >
                        {actionLoading === `delete-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

export default ManageVendors;
