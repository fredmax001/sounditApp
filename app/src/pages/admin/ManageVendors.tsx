import { useState, useEffect } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Store, Search, Check, Trash2, Loader2, DollarSign, Package, XCircle, Lock, Unlock, Eye
} from 'lucide-react';
import EntityDetailModal from '@/components/admin/EntityDetailModal';

interface Vendor {
  id: number;
  business_name?: string;
  category?: string;
  is_verified?: boolean;
  is_approved?: boolean;
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
  const [selectedVendorId, setSelectedVendorId] = useState<string | number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewVendorCard = (vendorId: string | number) => {
    setSelectedVendorId(vendorId);
    setIsDetailModalOpen(true);
  };

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
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(err.detail || 'Failed to verify vendor');
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
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(err.detail || 'Failed to unverify vendor');
      }
    } catch {
      toast.error('Failed to unverify vendor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id: number) => {
    setActionLoading(`approve-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Vendor approved successfully');
        loadVendors();
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(err.detail || 'Failed to approve vendor');
      }
    } catch {
      toast.error('Failed to approve vendor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnapprove = async (id: number) => {
    setActionLoading(`unapprove-${id}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/unapprove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Vendor unapproved');
        loadVendors();
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(err.detail || 'Failed to unapprove vendor');
      }
    } catch {
      toast.error('Failed to unapprove vendor');
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
      <AdminPageHeader chip="Management" title={t('admin.manageVendors.title')} subtitle={t('admin.manageVendors.subtitle')} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c] rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageVendors.totalVendors')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">{vendors.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageVendors.verified')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {vendors.filter(v => v.is_verified).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageVendors.totalProducts')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {vendors.reduce((acc, v) => acc + (v.products_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageVendors.totalSales')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                ¥{vendors.reduce((acc, v) => acc + (v.total_sales || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Approved</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {vendors.filter(v => v.is_approved).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 shadow-xs dark:shadow-none">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{t('admin.manageVendors.featured')}</p>
              <p className="text-[#020b00] dark:text-white font-bold text-xl">
                {vendors.filter(v => v.is_featured).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
        <div className="flex-1 relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('admin.manageVendors.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] focus:outline-none"
        >
          <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('admin.manageVendors.allCategories')}</option>
          {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{c}</option>)}
        </select>
      </div>

      {/* Vendors Table / Mobile Cards */}
      <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : (
          <>
          {/* Mobile Native Cards */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => handleViewVendorCard(vendor.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-11 h-11 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30 rounded-full flex items-center justify-center font-bold shrink-0">
                      {vendor.business_name?.[0] || 'V'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#020b00] dark:text-white font-semibold text-sm truncate">{vendor.business_name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                        {vendor.user_name}{vendor.category ? ` · ${vendor.category}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-semibold ${
                      vendor.is_verified ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {vendor.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-semibold ${
                      vendor.is_approved ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' : 'bg-orange-500/15 text-orange-700 dark:text-orange-400'
                    }`}>
                      {vendor.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-neutral-50 dark:bg-white/[0.03] rounded-xl px-3 py-2">
                  <span>{vendor.products_count || 0} products</span>
                  <span className="font-bold text-[#020b00] dark:text-[#d3da0c]">¥{(vendor.total_sales || 0).toLocaleString()} sales</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    onClick={() => handleViewVendorCard(vendor.id)}
                    className="flex-1 min-w-[5rem] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 dark:bg-white/[0.06] text-xs font-semibold text-[#020b00] dark:text-white active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#d3da0c]" />
                    View
                  </button>
                  {!vendor.is_approved ? (
                    <button
                      onClick={() => handleApprove(vendor.id)}
                      disabled={actionLoading === `approve-${vendor.id}`}
                      className="px-3 py-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-semibold"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnapprove(vendor.id)}
                      disabled={actionLoading === `unapprove-${vendor.id}`}
                      className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/[0.06] text-gray-500 text-xs font-semibold"
                    >
                      Unapprove
                    </button>
                  )}
                  {!vendor.is_verified ? (
                    <button
                      onClick={() => handleVerify(vendor.id)}
                      disabled={actionLoading === `verify-${vendor.id}`}
                      className="px-3 py-2 rounded-xl bg-green-500/15 text-green-700 dark:text-green-400 text-xs font-semibold"
                    >
                      Verify
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnverify(vendor.id)}
                      disabled={actionLoading === `unverify-${vendor.id}`}
                      className="px-3 py-2 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs font-semibold"
                    >
                      Unverify
                    </button>
                  )}
                  <button
                    onClick={() => handleFeature(vendor.id)}
                    disabled={actionLoading === `feature-${vendor.id}`}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold ${vendor.is_featured ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' : 'bg-neutral-100 dark:bg-white/[0.06] text-gray-500'}`}
                  >
                    {vendor.is_featured ? 'Featured' : 'Feature'}
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
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageVendors.vendorHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageVendors.categoryHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageVendors.productsHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageVendors.salesHeader')}</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Verification</th>
                <th className="text-left text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Approval</th>
                <th className="text-right text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">{t('admin.manageVendors.actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div 
                      onClick={() => handleViewVendorCard(vendor.id)}
                      className="flex items-center gap-3 cursor-pointer group"
                      title="Click to view vendor card"
                    >
                      <div className="w-10 h-10 bg-[#d3da0c]/15 text-[#020b00] dark:text-[#d3da0c] border border-[#d3da0c]/30 rounded-full flex items-center justify-center font-bold group-hover:ring-2 group-hover:ring-[#d3da0c] transition-all">
                        {vendor.business_name?.[0] || 'V'}
                      </div>
                      <div>
                        <p className="text-[#020b00] dark:text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                          {vendor.business_name}
                          <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{vendor.user_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{vendor.category || '-'}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">{vendor.products_count || 0}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-400 text-sm">¥{(vendor.total_sales || 0).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold w-fit inline-block ${
                      vendor.is_verified ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {vendor.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold w-fit inline-block ${
                      vendor.is_approved ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' : 'bg-orange-500/15 text-orange-700 dark:text-orange-400'
                    }`}>
                      {vendor.is_approved ? 'Approved' : 'Not Approved'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleViewVendorCard(vendor.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-700 dark:text-gray-300 hover:text-[#d3da0c] text-xs font-medium transition-colors"
                        title="View Vendor Card & Performance"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      {!vendor.is_verified ? (
                        <button
                          onClick={() => handleVerify(vendor.id)}
                          disabled={actionLoading === `verify-${vendor.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-green-600 dark:text-green-400 text-xs font-medium transition-colors"
                          title="Verify vendor (premium badge)"
                        >
                          {actionLoading === `verify-${vendor.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Verify
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverify(vendor.id)}
                          disabled={actionLoading === `unverify-${vendor.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-orange-600 dark:text-orange-400 text-xs font-medium transition-colors"
                          title="Unverify vendor"
                        >
                          {actionLoading === `unverify-${vendor.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Unverify
                        </button>
                      )}
                      {!vendor.is_approved ? (
                        <button
                          onClick={() => handleApprove(vendor.id)}
                          disabled={actionLoading === `approve-${vendor.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-medium transition-colors"
                          title="Approve vendor account"
                        >
                          {actionLoading === `approve-${vendor.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnapprove(vendor.id)}
                          disabled={actionLoading === `unapprove-${vendor.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 text-xs font-medium transition-colors"
                          title="Unapprove vendor account"
                        >
                          {actionLoading === `unapprove-${vendor.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                          Unapprove
                        </button>
                      )}
                      <button
                        onClick={() => handleFeature(vendor.id)}
                        disabled={actionLoading === `feature-${vendor.id}`}
                        className={`px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors ${vendor.is_featured ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}
                        title={vendor.is_featured ? t('admin.manageVendors.unfeatureTitle') : t('admin.manageVendors.featureTitle')}
                      >
                        {actionLoading === `feature-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : (vendor.is_featured ? 'Featured' : 'Feature')}
                      </button>
                      {vendor.status === 'suspended' ? (
                        <button
                          onClick={() => vendor.user_id && handleActivate(vendor.user_id)}
                          disabled={actionLoading === `activate-${vendor.user_id}` || !vendor.user_id}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-green-600 dark:text-green-400 transition-colors"
                          title="Activate account"
                        >
                          {actionLoading === `activate-${vendor.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => vendor.user_id && handleSuspend(vendor.user_id)}
                          disabled={actionLoading === `suspend-${vendor.user_id}` || !vendor.user_id}
                          className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-red-600 dark:text-red-400 transition-colors"
                          title="Suspend account"
                        >
                          {actionLoading === `suspend-${vendor.user_id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(vendor.id)}
                        disabled={actionLoading === `delete-${vendor.id}`}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg text-red-600 dark:text-red-400 transition-colors"
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
          </div>
          </>
        )}
      </div>
      {/* Vendor Detail Modal */}
      <EntityDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedVendorId(null);
        }}
        type="vendor"
        entityId={selectedVendorId}
        onUpdated={loadVendors}
      />
    </div>
  );
};

export default ManageVendors;
