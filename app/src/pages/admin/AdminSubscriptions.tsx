import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, Search, AlertCircle, Eye, Calendar } from 'lucide-react';
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
    start_date?: string;
    end_date?: string;
    created_at?: string;
    approved_by?: string;
    admin_notes?: string;
  }
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [checkingExpired, setCheckingExpired] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // ── Plan pricing management ──
  interface PlanConfig {
    role: string;
    plan_type: string;
    billing_period: string;
    price: number;
    duration_days: number;
    is_active: boolean;
    configured_in_db: boolean;
    name: string;
  }
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);

  // ── Lifetime grant ──
  const [lifetimeUserId, setLifetimeUserId] = useState('');
  const [grantingLifetime, setGrantingLifetime] = useState(false);

  const fetchPlanConfigs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/subscriptions/admin/plan-configs`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      setPlanConfigs(res.data.plans || []);
    } catch {
      // non-blocking
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (session?.access_token) fetchPlanConfigs();
  }, [session?.access_token, fetchPlanConfigs]);

  const handleSavePrice = async (plan: PlanConfig) => {
    const key = `${plan.role}:${plan.plan_type}:${plan.billing_period}`;
    const raw = priceDrafts[key];
    const price = parseFloat(raw);
    if (isNaN(price) || price < 0) {
      toast.error(t('admin.adminSubscriptions.invalidPrice') || 'Enter a valid price');
      return;
    }
    try {
      setSavingPlan(key);
      await axios.put(
        `${API_BASE_URL}/subscriptions/admin/plan-configs`,
        { role: plan.role, plan_type: plan.plan_type, billing_period: plan.billing_period, price, duration_days: plan.duration_days },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      toast.success(t('admin.adminSubscriptions.priceUpdated') || 'Price updated');
      setPriceDrafts((prev) => { const next = { ...prev }; delete next[key]; return next; });
      fetchPlanConfigs();
    } catch {
      toast.error(t('admin.adminSubscriptions.priceUpdateFailed') || 'Failed to update price');
    } finally {
      setSavingPlan(null);
    }
  };

  const handleGrantLifetime = async () => {
    const userId = parseInt(lifetimeUserId.trim());
    if (isNaN(userId) || userId <= 0) {
      toast.error(t('admin.adminSubscriptions.invalidUserId') || 'Enter a valid user ID');
      return;
    }
    if (!window.confirm(t('admin.adminSubscriptions.grantLifetimeConfirm') || `Grant a lifetime subscription to user ${userId}? This cannot be undone.`)) return;
    try {
      setGrantingLifetime(true);
      await axios.post(
        `${API_BASE_URL}/subscriptions/admin/grant-lifetime`,
        { user_id: userId, plan_type: 'premium' },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      toast.success(t('admin.adminSubscriptions.lifetimeGranted') || 'Lifetime subscription granted');
      setLifetimeUserId('');
      fetchSubscriptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('admin.adminSubscriptions.lifetimeFailed') || 'Failed to grant lifetime subscription');
    } finally {
      setGrantingLifetime(false);
    }
  };

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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-[#020b00] dark:text-white">{t('admin.adminSubscriptions.title')}</h1>
        <button
          onClick={handleCheckExpired}
          disabled={checkingExpired}
          className="px-4 py-2 bg-[#020b00] dark:bg-[#d3da0c] text-[#d3da0c] dark:text-black font-semibold rounded-lg hover:bg-neutral-900 dark:hover:bg-[#bbc10b] disabled:opacity-50 transition-colors"
        >
          {checkingExpired ? (
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          ) : null}
          {t('admin.adminSubscriptions.checkExpired')}
        </button>
      </div>

      {/* ── Plan Pricing ── */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none p-6">
        <h2 className="text-xl font-bold text-[#020b00] dark:text-white mb-1">{t('admin.adminSubscriptions.planPricing') || 'Subscription Plan Pricing'}</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">{t('admin.adminSubscriptions.planPricingHint') || 'Set the price for each plan. New subscriptions will use these prices. Payment is handled via Yoopay.'}</p>
        {planConfigs.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading') || 'Loading...'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {planConfigs.map((plan) => {
              const key = `${plan.role}:${plan.plan_type}:${plan.billing_period}`;
              const draft = priceDrafts[key];
              const dirty = draft !== undefined && parseFloat(draft) !== plan.price;
              return (
                <div key={key} className="bg-neutral-50 dark:bg-white/[0.03] border border-black/8 dark:border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#020b00] dark:text-white font-bold">{plan.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] uppercase tracking-wide ${plan.billing_period === 'yearly' ? 'bg-[#d3da0c]/20 text-[#020b00] dark:text-[#d3da0c]' : 'bg-neutral-200/70 dark:bg-white/10 text-gray-700 dark:text-gray-300'}`}>
                        {plan.billing_period === 'yearly' ? (t('admin.adminSubscriptions.yearly') || 'Yearly') : (t('admin.adminSubscriptions.monthly') || 'Monthly')}
                      </span>
                      <span className="px-2 py-0.5 bg-neutral-200/70 dark:bg-white/10 rounded text-[11px] uppercase tracking-wide text-gray-700 dark:text-gray-300">{plan.role}</span>
                    </div>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">{plan.duration_days} days</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[#020b00] dark:text-[#d3da0c] font-bold">¥</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft ?? String(plan.price)}
                      onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-[#020b00] dark:text-white focus:border-[#d3da0c] outline-none"
                    />
                    <button
                      onClick={() => handleSavePrice(plan)}
                      disabled={!dirty || savingPlan === key}
                      className="px-4 py-2 bg-[#020b00] dark:bg-[#d3da0c] text-[#d3da0c] dark:text-black text-sm font-bold rounded-lg hover:bg-neutral-900 dark:hover:bg-[#bbc10b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {savingPlan === key ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('common.save') || 'Save')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Grant Lifetime (admin only) ── */}
      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#d3da0c]/40 shadow-xs dark:shadow-none p-6">
        <h2 className="text-xl font-bold text-[#020b00] dark:text-white mb-1">{t('admin.adminSubscriptions.grantLifetime') || 'Grant Lifetime Subscription'}</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{t('admin.adminSubscriptions.grantLifetimeHint') || 'Give any account a permanent subscription. Only admins can do this — regular users can only buy monthly or yearly plans.'}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            min="1"
            value={lifetimeUserId}
            onChange={(e) => setLifetimeUserId(e.target.value)}
            placeholder={t('admin.adminSubscriptions.userIdPlaceholder') || 'User ID (e.g. 90)'}
            className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-none"
          />
          <button
            onClick={handleGrantLifetime}
            disabled={grantingLifetime || !lifetimeUserId.trim()}
            className="px-6 py-2.5 bg-[#020b00] dark:bg-[#d3da0c] text-[#d3da0c] dark:text-black font-bold rounded-lg hover:bg-neutral-900 dark:hover:bg-[#bbc10b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex items-center justify-center gap-2"
          >
            {grantingLifetime ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('admin.adminSubscriptions.grant') || 'Grant Lifetime')}
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white px-4 py-2 rounded-lg focus:border-[#d3da0c] focus:outline-none"
        >
          <option value="pending">{t('admin.adminSubscriptions.pending')}</option>
          <option value="all">{t('admin.adminSubscriptions.all')}</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-white/40" />
          <input
            type="text"
            placeholder={t('admin.adminSubscriptions.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 pl-10 pr-4 py-2 rounded-lg focus:border-[#d3da0c] focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#141414] rounded-2xl border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-white/5 border-b border-black/8 dark:border-white/10">
            <tr>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.user')}</th>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.role')}</th>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.plan')}</th>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.price')}</th>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.status')}</th>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">Start</th>
              <th className="text-left text-gray-600 dark:text-white/60 font-medium px-6 py-4">End</th>
              <th className="text-right text-gray-600 dark:text-white/60 font-medium px-6 py-4">{t('admin.adminSubscriptions.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {subscriptions
              .filter((sub) =>
                !search ||
                sub.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
                sub.user?.name?.toLowerCase().includes(search.toLowerCase())
              )
              .map((sub) => (
              <tr key={sub.id} className="hover:bg-neutral-50/70 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-[#020b00] dark:text-white font-medium">{sub.user?.name || t('admin.adminSubscriptions.na')}</p>
                    <p className="text-gray-500 dark:text-white/60 text-sm">{sub.user?.email}</p>
                    {sub.payment_reference && (
                      <p className="text-gray-400 dark:text-white/40 text-xs mt-1">{t('admin.adminSubscriptions.ref')}: {sub.payment_reference}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[#020b00] dark:text-white capitalize">{sub.role}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[#020b00] dark:text-[#d3da0c] font-semibold capitalize">{sub.plan_type}</span>
                  {(sub as any).billing_period && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${(sub as any).billing_period === 'lifetime' ? 'bg-[#d3da0c]/20 text-[#020b00] dark:text-[#d3da0c]' : 'bg-neutral-200/70 dark:bg-white/10 text-gray-700 dark:text-gray-400'}`}>
                      {(sub as any).billing_period}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-[#020b00] dark:text-white font-medium">¥{sub.price}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    sub.status === 'pending' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-500' :
                    sub.status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-500' :
                    sub.status === 'expired' ? 'bg-orange-500/15 text-orange-700 dark:text-orange-500' :
                    'bg-red-500/15 text-red-700 dark:text-red-500'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-white/70 text-sm">
                  {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-white/70 text-sm">
                  {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="p-2 bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {sub.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(sub.id)}
                          disabled={processing === sub.id}
                          className="p-2 bg-green-500/15 text-green-700 dark:text-green-500 rounded-lg hover:bg-green-500/25 disabled:opacity-50 transition-colors"
                        >
                          {processing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleReject(sub.id)}
                          disabled={processing === sub.id}
                          className="p-2 bg-red-500/15 text-red-700 dark:text-red-500 rounded-lg hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400 dark:text-white/40">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {t('admin.adminSubscriptions.noSubscriptionsFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setSelectedSub(null)}>
          <div className="bg-white dark:bg-[#141414] border border-black/10 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-black/10 dark:border-white/10 pb-3">
              <h2 className="text-xl font-bold text-[#020b00] dark:text-white">Subscription Details</h2>
              <button onClick={() => setSelectedSub(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-gray-500 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">User</span>
                <span className="text-[#020b00] dark:text-white">{selectedSub.user?.name || '-'} ({selectedSub.user?.email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">Plan</span>
                <span className="text-[#020b00] dark:text-[#d3da0c] font-semibold capitalize">{selectedSub.plan_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">Role</span>
                <span className="text-[#020b00] dark:text-white capitalize">{selectedSub.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">Price</span>
                <span className="text-[#020b00] dark:text-white font-medium">¥{selectedSub.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">Status</span>
                <span className="text-[#020b00] dark:text-white capitalize">{selectedSub.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">Start Date</span>
                <span className="text-[#020b00] dark:text-white">{selectedSub.start_date ? new Date(selectedSub.start_date).toLocaleDateString() : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/50">End Date</span>
                <span className="text-[#020b00] dark:text-white">{selectedSub.end_date ? new Date(selectedSub.end_date).toLocaleDateString() : '-'}</span>
              </div>
              {selectedSub.payment_reference && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/50">Reference</span>
                  <span className="text-[#020b00] dark:text-white">{selectedSub.payment_reference}</span>
                </div>
              )}
              {selectedSub.approved_by && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/50">Approved By</span>
                  <span className="text-[#020b00] dark:text-white">{selectedSub.approved_by}</span>
                </div>
              )}
              {selectedSub.admin_notes && (
                <div className="pt-2 border-t border-black/10 dark:border-white/10">
                  <span className="text-gray-500 dark:text-white/50 block mb-1">Admin Notes</span>
                  <span className="text-[#020b00] dark:text-white">{selectedSub.admin_notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
