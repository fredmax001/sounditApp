import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, Search, AlertCircle, Crown, Clock, Infinity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import axios from 'axios';

interface SubscriptionRecord {
  id: number | string;
  user?: {
    id: number;
    email?: string;
    name?: string;
    role?: string;
    avatar_url?: string;
  };
  plan_type?: string;
  role?: string;
  price?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
  payment_reference?: string;
  is_trial?: boolean;
}

const filters = ['all', 'basic', 'pro', 'premium', 'lifetime', 'pending', 'expired'] as const;
type FilterType = typeof filters[number];

export default function AdminSubscriptions() {
  const { t } = useTranslation();
  const { profile, session, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<number | string | null>(null);
  const [checkingExpired, setCheckingExpired] = useState(false);

  const token = session?.access_token;

  const fetchSubscriptions = useCallback(async (abortSignal?: AbortSignal) => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/subscriptions/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { filter: filter === 'all' ? undefined : filter, search: searchQuery || undefined },
        signal: abortSignal
      });
      setSubscriptions(res.data || []);
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        toast.error(t('admin.adminSubscriptions.failedToLoadSubscriptions'));
      }
    } finally {
      setLoading(false);
    }
  }, [token, filter, searchQuery, t]);

  useEffect(() => {
    if (!isAuthenticated || !token || (profile?.role_type !== 'super_admin' && profile?.role_type !== 'admin')) {
      if (!isAuthenticated || !token) {
        navigate('/');
      }
      return;
    }
    const controller = new AbortController();
    fetchSubscriptions(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, token, profile, filter, searchQuery, fetchSubscriptions, navigate]);

  const handleApprove = async (id: number | string) => {
    if (typeof id !== 'number') return;
    const notes = prompt(t('admin.adminSubscriptions.optionalAdminNotes'));
    try {
      setProcessing(id);
      await axios.post(
        `${API_BASE_URL}/subscriptions/admin/${id}/approve?notes=${encodeURIComponent(notes || '')}`,
        {},
        { headers: { Authorization: `Bearer ${token}`} }
      );
      toast.success(t('admin.adminSubscriptions.subscriptionApproved'));
      fetchSubscriptions();
    } catch {
      toast.error(t('admin.adminSubscriptions.failedToApprove'));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number | string) => {
    if (typeof id !== 'number') return;
    const reason = prompt(t('admin.adminSubscriptions.enterRejectionReason'));
    if (!reason) return;

    try {
      setProcessing(id);
      await axios.post(
        `${API_BASE_URL}/subscriptions/admin/${id}/reject?reason=${encodeURIComponent(reason)}`,
        {},
        { headers: { Authorization: `Bearer ${token}`} }
      );
      toast.success(t('admin.adminSubscriptions.subscriptionRejected'));
      fetchSubscriptions();
    } catch {
      toast.error(t('admin.adminSubscriptions.failedToReject'));
    } finally {
      setProcessing(null);
    }
  };

  const handleCheckExpired = async () => {
    try {
      setCheckingExpired(true);
      const res = await axios.post(
        `${API_BASE_URL}/subscriptions/admin/check-expired`,
        {},
        { headers: { Authorization: `Bearer ${token}`} }
      );
      toast.success(res.data?.message || t('admin.adminSubscriptions.expiredSubscriptionsChecked'));
      fetchSubscriptions();
    } catch {
      toast.error(t('admin.adminSubscriptions.failedToCheckExpiredSubscriptions'));
    } finally {
      setCheckingExpired(false);
    }
  };

  const getStatusBadge = (status?: string, isTrial?: boolean) => {
    const base = 'px-3 py-1 rounded-full text-xs font-bold capitalize';
    switch (status) {
      case 'active':
        return <span className={`${base} bg-green-500/20 text-green-500`}>{isTrial ? 'Trial' : 'Active'}</span>;
      case 'pending':
        return <span className={`${base} bg-yellow-500/20 text-yellow-500`}>Pending</span>;
      case 'expired':
      case 'cancelled':
        return <span className={`${base} bg-red-500/20 text-red-500`}>{status}</span>;
      case 'lifetime':
        return <span className={`${base} bg-purple-500/20 text-purple-400 flex items-center gap-1`}><Infinity className="w-3 h-3" /> Lifetime</span>;
      case 'trial':
        return <span className={`${base} bg-blue-500/20 text-blue-400 flex items-center gap-1`}><Clock className="w-3 h-3" /> Trial</span>;
      default:
        return <span className={`${base} bg-gray-500/20 text-gray-400`}>{status || 'Unknown'}</span>;
    }
  };

  const getPlanBadge = (plan?: string) => {
    const base = 'px-2 py-0.5 rounded text-xs font-bold uppercase';
    switch (plan) {
      case 'basic':
        return <span className={`${base} bg-gray-500/20 text-gray-400`}>Basic</span>;
      case 'pro':
        return <span className={`${base} bg-blue-500/20 text-blue-400`}>Pro</span>;
      case 'premium':
        return <span className={`${base} bg-purple-500/20 text-purple-400 flex items-center gap-1`}><Crown className="w-3 h-3" /> Premium</span>;
      default:
        return <span className={`${base} bg-gray-500/20 text-gray-400 capitalize`}>{plan || '-'}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-white">{t('admin.adminSubscriptions.title')}</h1>
        <button
          onClick={handleCheckExpired}
          disabled={checkingExpired}
          className="px-4 py-2 bg-[#d3da0c] text-black font-medium rounded-lg hover:bg-[#bbc10b] disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {checkingExpired ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t('admin.adminSubscriptions.checkExpired')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === f
                ? 'bg-[#d3da0c] text-black'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {t(`admin.adminSubscriptions.filter.${f}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder={t('admin.adminSubscriptions.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearchQuery(searchInput);
            }
          }}
          className="w-full bg-[#141414] border border-white/10 text-white pl-10 pr-4 py-2.5 rounded-lg"
        />
      </div>

      {/* Table */}
      <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.user')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.role')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.plan')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.price')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.status')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.validUntil')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="hover:bg-white/5">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {sub.user?.avatar_url ? (
                      <img src={sub.user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold">
                        {(sub.user?.name || sub.user?.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{sub.user?.name || t('admin.adminSubscriptions.na')}</p>
                      <p className="text-white/60 text-sm">{sub.user?.email}</p>
                      {sub.payment_reference && (
                        <p className="text-white/40 text-xs mt-1">{t('admin.adminSubscriptions.ref')}: {sub.payment_reference}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-white capitalize">{sub.role}</span>
                </td>
                <td className="px-6 py-4">
                  {getPlanBadge(sub.plan_type)}
                </td>
                <td className="px-6 py-4 text-white">
                  {sub.price && sub.price > 0 ? `¥${sub.price}` : <span className="text-gray-500">—</span>}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(sub.status, sub.is_trial)}
                </td>
                <td className="px-6 py-4 text-white/60 text-sm">
                  {sub.end_date
                    ? new Date(sub.end_date).toLocaleDateString()
                    : sub.status === 'lifetime'
                      ? <span className="text-purple-400">{t('admin.adminSubscriptions.lifetime')}</span>
                      : '—'
                  }
                </td>
                <td className="px-6 py-4">
                  {sub.status === 'pending' && typeof sub.id === 'number' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={processing === sub.id}
                        className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
                        title={t('admin.adminSubscriptions.approve')}
                      >
                        {processing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleReject(sub.id)}
                        disabled={processing === sub.id}
                        className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                        title={t('admin.adminSubscriptions.reject')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {t('admin.adminSubscriptions.noSubscriptionsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
