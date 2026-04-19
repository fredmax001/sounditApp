import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import axios from 'axios';

export default function AdminSubscriptions() {
  const { t } = useTranslation();
  const { profile, session, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  interface Subscription {
    id: number;
    user?: { email?: string; name?: string };
    payment_reference?: string;
    role?: string;
    plan_type?: string;
    price?: number;
    status?: string;
  }
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [checkingExpired, setCheckingExpired] = useState(false);

  const token = session?.access_token;

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'pending'
        ? '/subscriptions/admin/pending'
        : '/subscriptions/admin/all';

      const res = await axios.get(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSubscriptions(filter === 'pending' ? res.data : res.data.subscriptions);
    } catch {
      toast.error(t('admin.adminSubscriptions.failedToLoadSubscriptions'));
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    if (!isAuthenticated || (profile?.role_type !== 'super_admin' && profile?.role_type !== 'admin')) {
      navigate('/');
      return;
    }
    fetchSubscriptions();
  }, [isAuthenticated, profile, filter, fetchSubscriptions, navigate]);

  const handleApprove = async (id: number) => {
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

  const handleReject = async (id: number) => {
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-white">{t('admin.adminSubscriptions.title')}</h1>
        <button
          onClick={handleCheckExpired}
          disabled={checkingExpired}
          className="px-4 py-2 bg-[#d3da0c] text-black font-medium rounded-lg hover:bg-[#bbc10b] disabled:opacity-50 transition-colors"
        >
          {checkingExpired ? (
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          ) : null}
          {t('admin.adminSubscriptions.checkExpired')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-[#141414] border border-white/10 text-white px-4 py-2 rounded-lg"
        >
          <option value="pending">{t('admin.adminSubscriptions.pending')}</option>
          <option value="all">{t('admin.adminSubscriptions.all')}</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            placeholder={t('admin.adminSubscriptions.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-white/10 text-white pl-10 pr-4 py-2 rounded-lg"
          />
        </div>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.user')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.role')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.plan')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.price')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.status')}</th>
              <th className="text-left text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {subscriptions
              .filter((sub) =>
                !search ||
                sub.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
                sub.user?.name?.toLowerCase().includes(search.toLowerCase())
              )
              .map((sub) => (
              <tr key={sub.id} className="hover:bg-white/5">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-white font-medium">{sub.user?.name || t('admin.adminSubscriptions.na')}</p>
                    <p className="text-white/60 text-sm">{sub.user?.email}</p>
                    {sub.payment_reference && (
                      <p className="text-white/40 text-xs mt-1">{t('admin.adminSubscriptions.ref')}: {sub.payment_reference}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-white capitalize">{sub.role}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[#d3da0c] capitalize">{sub.plan_type}</span>
                </td>
                <td className="px-6 py-4 text-white">¥{sub.price}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    sub.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                    sub.status === 'active' ? 'bg-green-500/20 text-green-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {sub.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={processing === sub.id}
                        className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
                      >
                        {processing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleReject(sub.id)}
                        disabled={processing === sub.id}
                        className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
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
                <td colSpan={6} className="px-6 py-12 text-center text-white/40">
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
