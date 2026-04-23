import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import MobileQrPayment from '@/components/MobileQrPayment';
import {
  ArrowLeft, Check, Upload, X, Loader2, QrCode, Calendar, MapPin
} from 'lucide-react';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

const Checkout = () => {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { events, currentEvent, fetchEventById, isLoading: isEventLoading } = useEventStore();
  const { profile, isAuthenticated } = useAuthStore();

  const [step, setStep] = useState<'qr' | 'form' | 'success'>('qr');
  const [payerName, setPayerName] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ order_id: number; status: string; message?: string } | null>(null);

  useEffect(() => {
    if (eventId && !events.find(e => String(e.id) === eventId) && String(currentEvent?.id) !== eventId) {
      fetchEventById(eventId);
    }
  }, [eventId, events, currentEvent, fetchEventById]);

  useEffect(() => {
    if (profile) {
      setPayerName(profile.display_name || '');
      setEmail(profile.email || '');
      setPhoneNumber(profile.phone || '');
    }
  }, [profile]);

  const event = events.find(e => String(e.id) === eventId) || (String(currentEvent?.id) === eventId ? currentEvent : undefined);
  const ticketCount = (location.state as { ticketCount?: number })?.ticketCount || 1;

  if (!eventId) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <p className="text-red-400">{t('payment.checkout.missingEventId')}</p>
      </div>
    );
  }

  if (isEventLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{t('payment.eventNotFound')}</p>
          <button
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium"
          >{t('payment.browseEvents')}</button>
        </div>
      </div>
    );
  }

  const hasQrPayment = event.wechat_qr_url || event.alipay_qr_url || event.ticket_price !== undefined && event.ticket_price !== null;
  const ticketTier = event.ticket_tiers?.find(t => String(t.id) === String((location.state as { tierId?: string | number })?.tierId)) || event.ticket_tiers?.[0];
  const ticketPrice = hasQrPayment ? (event.ticket_price || 0) : (ticketTier?.price || 0);
  const totalAmount = ticketPrice * ticketCount;

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName.trim() || !email.trim() || !phoneNumber.trim()) {
      toast.error(t('eventDetail.pleaseFillAllFields'));
      return;
    }
    if (!isAuthenticated || !profile) {
      toast.error(t('payment.checkout.pleaseSignIn'));
      navigate('/login', { state: { from: `/checkout/${eventId}` } });
      return;
    }

    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: `/checkout/${eventId}` } });
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('event_id', String(event.id));
    formData.append('payer_name', payerName);
    formData.append('email', email);
    formData.append('phone_number', phoneNumber);
    formData.append('quantity', String(ticketCount));
    formData.append('payment_amount', String(totalAmount));
    if ((location.state as { tierId?: string | number })?.tierId) {
      formData.append('ticket_tier_id', String((location.state as { tierId?: string | number }).tierId));
    }
    if (payerNotes) formData.append('payer_notes', payerNotes);

    try {
      const res = await fetch(`${API_BASE_URL}/tickets/order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.auto_approved ? t('eventDetail.orderAutoApproved') : 'Order submitted. Awaiting approval.');
        setOrderResult(data);
        setStep('success');
      } else {
        toast.error(data.detail || 'Failed to submit order');
      }
    } catch {
      toast.error('Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-24 bg-[#0A0A0A]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-6">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('payment.backLabel')}
          </button>
        </div>

        {/* Event Summary */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex gap-4">
            <img
              src={event.flyer_image || '/event_placeholder.jpg'}
              alt={event.title}
              className="w-24 h-24 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-xl font-bold text-white">{event.title}</h1>
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <Calendar className="w-4 h-4 text-[#d3da0c]" />
                {new Date(event.start_date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                <MapPin className="w-4 h-4 text-[#d3da0c]" />
                {event.city}
              </div>
            </div>
          </div>
        </div>

        {step === 'qr' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display text-white mb-2">
                {t('payment.completeLabel')} <span className="text-[#d3da0c]">{t('payment.paymentLabel')}</span>
              </h2>
              <p className="text-gray-400">Scan the QR code and complete your payment</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#d3da0c]/20 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-[#d3da0c]" />
                </div>
                <div>
                  <h3 className="text-white font-bold">Manual Payment</h3>
                  <p className="text-gray-400 text-sm">WeChat Pay or Alipay</p>
                </div>
              </div>
              <ul className="text-gray-400 text-sm space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#d3da0c]" /> Scan QR code with your phone</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#d3da0c]" /> Complete the transfer</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#d3da0c]" /> Confirm your payment</li>
              </ul>
            </div>

            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-400">Amount to Pay</span>
              <span className="text-2xl font-bold text-[#d3da0c]">¥{totalAmount}</span>
            </div>
            {ticketTier && !hasQrPayment && (
              <div className="flex justify-between items-center mb-6">
                <span className="text-gray-400">Tickets</span>
                <span className="text-white">{ticketCount}x {ticketTier.name}</span>
              </div>
            )}

            {/* QR Codes */}
            <div className="mb-6">
              <MobileQrPayment amount={totalAmount} />
            </div>

            <button
              onClick={() => setStep('form')}
              className="w-full py-4 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
            >
              I Have Paid
            </button>
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Confirm Payment</h3>
              <button onClick={() => setStep('qr')} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">Your Name *</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('eventDetail.email')} *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('eventDetail.phoneNumber')} *</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder="+1234567890"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-white/60 text-sm block mb-2">Notes (optional)</label>
                <textarea
                  value={payerNotes}
                  onChange={(e) => setPayerNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder="Any notes for the organizer"
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Order'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'success' && orderResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-display text-white mb-2">
              {orderResult?.status === 'approved'
                ? t('eventDetail.orderAutoApproved')
                : orderResult?.status === 'rejected'
                  ? t('eventDetail.ticketRejected')
                  : t('eventDetail.orderPendingTitle')}
            </h2>
            <p className="text-gray-400 mb-6">
              {orderResult?.status === 'approved'
                ? t('eventDetail.ticketApproved')
                : orderResult?.status === 'rejected'
                  ? (orderResult?.message || t('eventDetail.ticketRejected'))
                  : t('eventDetail.orderPendingDesc')}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/tickets')}
                className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
              >
                {t('eventDetail.viewMyTickets')}
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
              >
                {t('eventDetail.returnHome')}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
