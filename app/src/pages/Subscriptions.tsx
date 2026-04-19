import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, Zap, Crown, Loader2, X, Smartphone, QrCode, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import axios from 'axios';

interface Plan {
  type: string;
  name: string;
  price: number;
  features?: string[];
}

interface SubscriptionStatus {
  has_subscription?: boolean;
  subscription?: {
    plan_type: string;
    days_remaining: number;
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
  const { user, profile, session } = useAuthStore();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; planType: string | null; details: PaymentDetails | null }>({
    open: false,
    planType: null,
    details: null,
  });
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState('');

  const token = session?.access_token;
  const role = profile?.role_type;

  useEffect(() => {
    // Give auth store time to hydrate from localStorage before redirecting
    const checkAuth = setTimeout(() => {
      if (!user || !token || !role) {
        navigate('/login');
        return;
      }
      fetchData();
    }, 500);
    return () => clearTimeout(checkAuth);
  }, [user, token, role]);

  const fetchData = async () => {
    try {
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
        { plan_type: planType, role },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            {t('subscriptions.title')} <span className="text-[#d3da0c]">{t('subscriptions.titleHighlight')}</span>
          </h1>
          <p className="text-white/60">{t('subscriptions.subtitle')}</p>
        </div>

        {status?.has_subscription && (
          <div className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <p className="text-white">
              {t('subscriptions.activePlan')} <span className="text-[#d3da0c] capitalize">{status.subscription.plan_type}</span>
            </p>
            <p className="text-white/60 text-sm">
              {status.subscription.days_remaining} {t('subscriptions.daysRemaining')}
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <motion.div
              key={plan.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                {plan.type === 'basic' && <Star className="w-6 h-6 text-[#d3da0c]" />}
                {plan.type === 'pro' && <Zap className="w-6 h-6 text-[#d3da0c]" />}
                {plan.type === 'premium' && <Crown className="w-6 h-6 text-[#d3da0c]" />}
                <h3 className="text-xl font-bold text-white capitalize">{plan.name}</h3>
              </div>
              
              <div className="mb-6">
                <span className="text-3xl font-bold text-white">¥{plan.price}</span>
                <span className="text-white/60">{t('subscriptions.perMonth')}</span>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features?.slice(0, 5).map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                    <Check className="w-4 h-4 text-[#d3da0c] flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.type)}
                disabled={status?.subscription?.plan_type === plan.type || subscribing === plan.type}
                className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl disabled:opacity-50"
              >
                {subscribing === plan.type ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : status?.subscription?.plan_type === plan.type ? (
                  t('subscriptions.currentPlan')
                ) : (
                  t('subscriptions.subscribe')
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>

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
                    src={paymentModal.details.web_qr_code_url}
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
