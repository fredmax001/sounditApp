import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, Zap, Crown, Loader2, X, Smartphone, QrCode, Upload, RefreshCw, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { getMediaUrl } from '@/lib/appUrl';
import axios from 'axios';

interface Plan {
  type: string;
  name: string;
  price: number;
  monthly_price?: number;
  yearly_price?: number;
  duration_days?: number;
  features?: string[];
}

interface SubscriptionStatus {
  has_subscription?: boolean;
  has_pending?: boolean;
  is_verified_premium?: boolean;
  is_trial?: boolean;
  subscription?: {
    id?: number;
    plan_type: string;
    billing_period?: string;
    days_remaining: number;
    price?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    is_cancelled?: boolean;
    cancelled_at?: string;
    cancel_reason?: string;
    is_trial?: boolean;
  };
  pending_subscription?: {
    id: number;
    plan_type: string;
    billing_period?: string;
    price: number;
    status: string;
    created_at?: string;
  };
}

interface PaymentDetails {
  subscription_id: number;
  amount: number;
  currency: string;
  payment_reference: string;
  mobile_payment_link: string;
  web_qr_code_url: string;
  instructions: string[];
}

export default function Subscriptions() {
  const { t } = useTranslation();
  const { user, profile, session, isLoading: isAuthLoading } = useAuthStore();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; planType: string | null; details: PaymentDetails | null }>({
    open: false,
    planType: null,
    details: null,
  });
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState('');

  // Cancel & Restore modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<'active' | 'pending' | 'trial'>('active');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const token = session?.access_token;
  const role = profile?.role_type || profile?.role;

  useEffect(() => {
    // Wait for auth store to finish hydrating before deciding to redirect
    if (isAuthLoading) return;
    if (!user || !token || !role) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [user, token, role, isAuthLoading]);

  const fetchData = async () => {
    try {
      setLoadError(false);
      const [plansRes, statusRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/subscriptions/plans?role=${role}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/subscriptions/my-subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPlans(plansRes.data.plans);
      setStatus(statusRes.data);
    } catch {
      setLoadError(true);
      toast.error(t('subscriptions.failedToLoadData'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planType: string) => {
    if (!token || !role) return;
    setSubscribing(planType);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/subscriptions/subscribe`,
        { plan_type: planType, billing_period: billingPeriod },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const subscriptionId = res.data?.subscription_id;
      if (!subscriptionId) {
        toast.error(t('subscriptions.failedToSubscribe'));
        return;
      }

      // Fetch payment details
      const paymentRes = await axios.get(
        `${API_BASE_URL}/subscriptions/payment/${subscriptionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPaymentModal({
        open: true,
        planType,
        details: paymentRes.data as PaymentDetails,
      });
      fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error((err.response?.data as { detail?: string })?.detail || t('subscriptions.failedToSubscribe'));
      } else {
        toast.error(t('subscriptions.failedToSubscribe'));
      }
    } finally {
      setSubscribing(null);
    }
  };

  const handleManualConfirmPayment = async () => {
    if (!paymentModal.details || !screenshot) {
      if (!screenshot) toast.error(t('eventDetail.uploadPaymentScreenshot'));
      return;
    }
    
    setConfirmingPayment(true);
    try {
      const formData = new FormData();
      formData.append('payment_screenshot', screenshot);
      if (paymentReference.trim()) {
        formData.append('payment_reference', paymentReference.trim());
      }

      await axios.post(
        `${API_BASE_URL}/subscriptions/payment/${paymentModal.details.subscription_id}/confirm`,
        formData,
        { headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        } }
      );
      toast.success(t('subscriptions.paymentConfirmed'));
      setPaymentModal({ open: false, planType: null, details: null });
      setScreenshot(null);
      setPaymentReference('');
      fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error((err.response?.data as { detail?: string })?.detail || t('subscriptions.failedToConfirmPayment'));
      } else {
        toast.error(t('subscriptions.failedToConfirmPayment'));
      }
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleOpenCancelModal = (target: 'active' | 'pending' | 'trial') => {
    setCancelTarget(target);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!token) return;
    setCancelling(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/subscriptions/cancel`,
        { reason: cancelReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const action = res.data?.action;
      if (action === 'withdrawn') {
        toast.success(t('subscriptions.withdrawSuccess'));
      } else {
        toast.success(t('subscriptions.cancelSuccess'));
      }
      setCancelModalOpen(false);
      setCancelReason('');
      await fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error((err.response?.data as { detail?: string })?.detail || 'Failed to cancel subscription');
      } else {
        toast.error('Failed to cancel subscription');
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!token) return;
    setResuming(true);
    try {
      await axios.post(
        `${API_BASE_URL}/subscriptions/resume`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('subscriptions.resumeSuccess'));
      await fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error((err.response?.data as { detail?: string })?.detail || 'Failed to resume subscription');
      } else {
        toast.error('Failed to resume subscription');
      }
    } finally {
      setResuming(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!token) return;
    setRestoring(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/subscriptions/restore-purchases`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data?.message || t('subscriptions.restorePurchases'));
      await fetchData();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error((err.response?.data as { detail?: string })?.detail || 'Failed to restore purchases');
      } else {
        toast.error('Failed to restore purchases');
      }
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020b00] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  const activeSub = status?.has_subscription ? status.subscription : null;
  const pendingSub = status?.pending_subscription;
  const isLifetime = activeSub?.billing_period === 'lifetime' || status?.is_verified_premium;
  const isCancelled = activeSub?.is_cancelled;
  const formattedEndDate = activeSub?.end_date ? new Date(activeSub.end_date).toLocaleDateString() : '';

  return (
    <div className="min-h-screen bg-[#020b00] px-4 pt-24 pb-12 lg:py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {t('subscriptions.title')} <span className="text-[#d3da0c]">{t('subscriptions.titleHighlight')}</span>
            </h1>
            <p className="text-white/60">{t('subscriptions.subtitle')}</p>
          </div>

          {/* Restore Purchase Button */}
          <button
            onClick={handleRestorePurchases}
            disabled={restoring}
            className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50"
            title={t('subscriptions.restorePurchases')}
          >
            {restoring ? (
              <Loader2 className="w-4 h-4 text-[#d3da0c] animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-[#d3da0c]" />
            )}
            <span>{restoring ? t('subscriptions.restoringPurchases') : t('subscriptions.restorePurchases')}</span>
          </button>
        </div>

        {loadError ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-white font-semibold mb-6">{t('subscriptions.failedToLoadData')}</p>
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <Crown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('subscriptions.noSubscriptions')}</h3>
            <p className="text-white/60 mb-6">{t('subscriptions.noSubscriptionsDescription')}</p>
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all"
            >
              {t('subscriptions.viewPlans')}
            </button>
          </div>
        ) : (
          <>
            {/* Active Subscription Banner */}
            {activeSub && (
              <div className={`mb-8 p-5 rounded-2xl border backdrop-blur-sm ${
                isCancelled
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-green-500/10 border-green-500/30'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${isCancelled ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-[#d3da0c]'}`}>
                      {isCancelled ? <Clock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg flex items-center gap-2">
                        <span>{t('subscriptions.activePlan')}:</span>
                        <span className="text-[#d3da0c] capitalize font-bold">{activeSub.plan_type}</span>
                        {activeSub.billing_period && activeSub.billing_period !== 'monthly' && (
                          <span className="text-white/60 text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 uppercase">
                            {activeSub.billing_period}
                          </span>
                        )}
                        {activeSub.is_trial && (
                          <span className="text-amber-400 text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 font-medium">
                            Free Trial
                          </span>
                        )}
                      </p>
                      <p className="text-white/60 text-sm mt-1">
                        {isLifetime
                          ? (t('subscriptions.lifetimeAccess') || 'Lifetime access')
                          : isCancelled
                          ? t('subscriptions.cancelledNotice', { date: formattedEndDate })
                          : `${activeSub.days_remaining} ${t('subscriptions.daysRemaining')} (valid until ${formattedEndDate})`}
                      </p>
                    </div>
                  </div>

                  {/* Action button: Cancel / Resume */}
                  {!isLifetime && (
                    <div className="flex items-center gap-2 self-end md:self-center">
                      {isCancelled ? (
                        <button
                          onClick={handleResumeSubscription}
                          disabled={resuming}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d3da0c] text-black font-bold text-sm hover:bg-[#bbc10b] transition-all disabled:opacity-50"
                        >
                          {resuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          <span>{resuming ? t('subscriptions.resuming') : t('subscriptions.resumeSubscription')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenCancelModal(activeSub.is_trial ? 'trial' : 'active')}
                          className="px-4 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all text-sm font-semibold"
                        >
                          {t('subscriptions.cancelSubscription')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Subscription Banner */}
            {!activeSub && pendingSub && (
              <div className="mb-8 p-5 rounded-2xl bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#d3da0c]/20 text-[#d3da0c] shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white font-semibold flex items-center gap-2">
                      <span>{t('subscriptions.pendingPayment')}:</span>
                      <span className="text-[#d3da0c] capitalize font-bold">{pendingSub.plan_type}</span>
                      <span className="text-white/60 text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 uppercase">
                        ¥{pendingSub.price} / {pendingSub.billing_period}
                      </span>
                    </p>
                    <p className="text-white/60 text-sm mt-1">{t('subscriptions.pendingApprovalNotice')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleSubscribe(pendingSub.plan_type)}
                    className="px-4 py-2 rounded-xl bg-[#d3da0c] text-black font-bold text-sm hover:bg-[#bbc10b] transition-all"
                  >
                    {t('subscriptions.completePayment')}
                  </button>
                  <button
                    onClick={() => handleOpenCancelModal('pending')}
                    className="px-4 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/5 transition-all text-sm font-semibold"
                  >
                    {t('subscriptions.cancelPendingRequest')}
                  </button>
                </div>
              </div>
            )}

            {/* Monthly / Yearly billing toggle */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-white/5 rounded-xl p-1 border border-white/10">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${billingPeriod === 'monthly' ? 'bg-[#d3da0c] text-black' : 'text-white/60 hover:text-white'}`}
                >
                  {t('subscriptions.monthly') || 'Monthly'}
                </button>
                <button
                  onClick={() => setBillingPeriod('yearly')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${billingPeriod === 'yearly' ? 'bg-[#d3da0c] text-black' : 'text-white/60 hover:text-white'}`}
                >
                  {t('subscriptions.yearly') || 'Yearly'}
                  <span className={`ml-2 text-xs font-bold ${billingPeriod === 'yearly' ? 'text-black/60' : 'text-[#d3da0c]'}`}>
                    {t('subscriptions.saveBadge') || 'Save 2 months'}
                  </span>
                </button>
              </div>
            </div>

            <div className={`grid gap-6 ${plans.length === 1 ? 'md:grid-cols-1 max-w-md mx-auto' : 'md:grid-cols-3'}`}>
              {plans.map((plan) => {
                const isCurrent = activeSub?.plan_type === plan.type && !isCancelled;
                return (
                  <motion.div
                    key={plan.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-[#141414] border rounded-2xl p-6 relative flex flex-col justify-between ${
                      isCurrent ? 'border-[#d3da0c] shadow-lg shadow-[#d3da0c]/10' : 'border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        {plan.type === 'basic' && <Star className="w-6 h-6 text-[#d3da0c]" />}
                        {plan.type === 'pro' && <Zap className="w-6 h-6 text-[#d3da0c]" />}
                        {plan.type === 'premium' && <Crown className="w-6 h-6 text-[#d3da0c]" />}
                        <h3 className="text-xl font-bold text-white capitalize">{plan.name}</h3>
                      </div>
                      
                      <div className="mb-6">
                        <span className="text-3xl font-bold text-white">
                          ¥{billingPeriod === 'yearly' ? (plan.yearly_price ?? plan.price) : (plan.monthly_price ?? plan.price)}
                        </span>
                        <span className="text-white/60">
                          /{billingPeriod === 'yearly' ? (t('subscriptions.year') || 'year') : (t('subscriptions.month') || 'month')}
                        </span>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {(Array.isArray(plan.features) ? plan.features : []).slice(0, 5).map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                            <Check className="w-4 h-4 text-[#d3da0c] flex-shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleSubscribe(plan.type)}
                      disabled={isCurrent || subscribing === plan.type}
                      className={`w-full py-3 font-bold rounded-xl transition-all disabled:opacity-50 ${
                        isCurrent
                          ? 'bg-white/10 text-white cursor-default'
                          : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b]'
                      }`}
                    >
                      {subscribing === plan.type ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : isCurrent ? (
                        t('subscriptions.currentPlan')
                      ) : (
                        t('subscriptions.subscribe')
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {cancelModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setCancelModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#141414] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4 text-amber-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-xl font-bold text-white">{t('subscriptions.cancelConfirmTitle')}</h3>
              </div>

              <p className="text-white/70 text-sm mb-4 leading-relaxed">
                {cancelTarget === 'pending'
                  ? t('subscriptions.cancelPendingConfirmText')
                  : cancelTarget === 'trial'
                  ? t('subscriptions.cancelTrialConfirmText')
                  : t('subscriptions.cancelConfirmText')}
              </p>

              {cancelTarget === 'active' && (
                <div className="mb-4">
                  <label className="text-xs text-white/50 block mb-1.5">Optional reason</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Tell us why you are cancelling..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelling}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-all"
                >
                  {t('subscriptions.keepSubscription')}
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {cancelling
                      ? t('subscriptions.cancelling')
                      : cancelTarget === 'pending'
                      ? t('subscriptions.confirmWithdraw')
                      : t('subscriptions.confirmCancel')}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModal.open && paymentModal.details && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPaymentModal({ open: false, planType: null, details: null })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#141414] border border-white/10 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">{t('subscriptions.completePayment')}</h3>
                <button
                  onClick={() => setPaymentModal({ open: false, planType: null, details: null })}
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white/60 text-sm">{t('subscriptions.amount')}</p>
                  <p className="text-2xl font-bold text-white">¥{paymentModal.details.amount}</p>
                </div>

                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white/60 text-sm">{t('subscriptions.paymentReference')}</p>
                  <p className="text-white font-mono text-sm">{paymentModal.details.payment_reference}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={paymentModal.details.mobile_payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <Smartphone className="w-6 h-6 text-[#d3da0c]" />
                    <span className="text-white text-sm font-medium">{t('subscriptions.mobilePay')}</span>
                  </a>
                  <div className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 rounded-xl">
                    <QrCode className="w-6 h-6 text-[#d3da0c]" />
                    <span className="text-white text-sm font-medium">{t('subscriptions.scanQr')}</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <img
                    src={getMediaUrl(paymentModal.details.web_qr_code_url)}
                    alt="YOOPAY QR"
                    className="w-40 h-40 object-contain rounded-lg bg-white p-2"
                  />
                </div>

                {paymentModal.details.instructions.map((instruction, idx) => (
                  <p key={idx} className="text-white/60 text-xs">{instruction}</p>
                ))}

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div>
                    <label className="text-white/60 text-xs block mb-2">
                      {t('eventDetail.paymentReference')} 
                      <span className="ml-1 text-[#d3da0c]">(Optional - We will try to auto-detect)</span>
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#d3da0c] outline-none"
                      placeholder={t('eventDetail.enterPaymentReference')}
                    />
                  </div>

                  <div>
                    <label className="text-white/60 text-xs block mb-2">{t('eventDetail.paymentScreenshot')} *</label>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors bg-white/5">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 text-white/30 mb-2" />
                        <p className="text-xs text-white/50">{screenshot ? screenshot.name : t('eventDetail.uploadPaymentScreenshot')}</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleManualConfirmPayment}
                  disabled={confirmingPayment}
                  className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl disabled:opacity-50"
                >
                  {confirmingPayment ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    t('subscriptions.iHavePaid')
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
