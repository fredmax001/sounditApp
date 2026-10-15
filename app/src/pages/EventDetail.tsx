import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, ArrowLeft, Share2, Heart, X, ShoppingCart, Check, Upload, Ticket, MessageCircle, Copy, Eye, EyeOff, Mail, Lock, UserPlus, LogIn, Store, AlertCircle, Smartphone } from 'lucide-react';
import MobileQrPayment from '@/components/MobileQrPayment';
import { toast } from 'sonner';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import VerificationBadge from '@/components/VerificationBadge';
import TableBooking from '@/components/TableBooking';
import UniversalShareModal from '@/components/ui/UniversalShareModal';
import { API_BASE_URL } from '@/config/api';
import { WEB_ORIGIN } from '@/lib/appUrl';
import { Analytics } from '@/lib/analytics';

export default function EventDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuthStore();
  const { currentEvent, fetchEventById, isLoading, events } = useEventStore();
  const [isLiked, setIsLiked] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Ticket order flow
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [payerName, setPayerName] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralDiscount, setReferralDiscount] = useState<number | null>(null);
  const [recentOrder, setRecentOrder] = useState<{ status: string; ticket_qr?: string; ticket_code?: string } | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  // One-tap payment confirmation flow (buyer returns from Alipay/WeChat app)
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [payReturnPrompt, setPayReturnPrompt] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const leftForPaymentAt = useRef<number | null>(null);

  // Persist a lightweight payment session so a buyer whose browser tab was
  // killed while paying in WeChat/Alipay can resume instead of starting over.
  // Mobile-only (including the native app and PWA) — desktop keeps the
  // plain scan-and-upload flow.
  const isMobilePaymentEnv = () =>
    window.innerWidth < 768 || (window as any).Capacitor?.isNativePlatform?.() === true;
  const PENDING_PAY_KEY = 'soundit_pending_payment';
  const clearPendingPayment = () => { try { localStorage.removeItem(PENDING_PAY_KEY); } catch { /* ignore */ } };
  const restorePendingPayment = () => {
    try {
      const s = JSON.parse(localStorage.getItem(PENDING_PAY_KEY) || 'null');
      if (s) {
        if (s.tier_id) setSelectedTierId(String(s.tier_id));
        if (s.quantity) setQuantity(s.quantity);
      }
    } catch { /* ignore */ }
  };

  // Prefill payer name from the logged-in profile so the order form only
  // needs a screenshot and an optional note.
  useEffect(() => {
    if (!showOrderModal) return;
    if (payerName) return;
    const p = profile as any;
    const fullName = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
    setPayerName(fullName || p?.email || p?.username || '');
  }, [showOrderModal]);
  const [eventVendors, setEventVendors] = useState<Array<{
    id: number;
    vendor_id: number;
    business_name: string;
    description?: string;
    vendor_type?: string;
    logo_url?: string;
    booth_location?: string;
    rating?: number;
    reviews_count?: number;
    is_verified?: boolean;
    products?: Array<{
      id: number;
      name: string;
      price: number;
      image_url?: string;
      category?: string;
    }>;
  }>>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'ticket' | 'save' | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Fetch event vendors
  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE_URL}/events/${id}/vendors`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.vendors) setEventVendors(data.vendors);
      })
      .catch(() => {});
  }, [id]);

  // Read referral code from URL ?ref= and track click
  useEffect(() => {
    const refFromUrl = searchParams.get('ref');
    if (refFromUrl && id) {
      const code = refFromUrl.toUpperCase();
      setReferralCode(code);
      // Track referral click
      fetch(`${API_BASE_URL}/promoters/track-click/${code}?event_id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
      // Validate referral code for discount
      fetch(`${API_BASE_URL}/promoters/validate/${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.discount_percent) {
            setReferralDiscount(data.discount_percent);
          }
        })
        .catch(() => {});
    }
  }, [searchParams, id]);

  useEffect(() => {
    if (id) {
      fetchEventById(id);
      setSelectedTierId(null);
      Analytics.trackEvent("event_view", "engagement", { event_id: id });
    }
  }, [id, fetchEventById]);

  // Save the payment session whenever the QR screen is shown (mobile only)
  useEffect(() => {
    if (!showQrModal || !currentEvent || !isMobilePaymentEnv()) return;
    try {
      localStorage.setItem(PENDING_PAY_KEY, JSON.stringify({
        event_id: currentEvent.id,
        tier_id: selectedTierId,
        quantity,
        started_at: Date.now(),
      }));
    } catch { /* storage full/blocked — non-fatal */ }
  }, [showQrModal, currentEvent, selectedTierId, quantity]);

  // On load, offer to resume an unfinished payment (e.g. the browser tab was
  // discarded while the buyer was in the WeChat/Alipay app). Mobile only.
  useEffect(() => {
    if (!currentEvent?.id || !isMobilePaymentEnv()) return;
    try {
      const raw = localStorage.getItem(PENDING_PAY_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (String(session.event_id) !== String(currentEvent.id)) return;
      if (Date.now() - (session.started_at || 0) > 24 * 3600 * 1000) {
        clearPendingPayment();
        return;
      }
      setResumePrompt(true);
    } catch { clearPendingPayment(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id]);

  // Detect the buyer returning from the Alipay/WeChat app after a deep-link
  // payment, and prompt a one-tap confirmation.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !leftForPaymentAt.current) return;
      const awayMs = Date.now() - leftForPaymentAt.current;
      leftForPaymentAt.current = null;
      if (awayMs > 2500 && !buyerConfirmed && !showSuccessModal && isMobilePaymentEnv()) {
        setPayReturnPrompt(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [buyerConfirmed, showSuccessModal]);

  // Update meta tags for sharing (WeChat, social)
  useEffect(() => {
    if (!currentEvent) return;
    const title = currentEvent.title || 'Sound It';
    const description = currentEvent.description
      ? currentEvent.description.replace(/<[^>]+>/g, '').slice(0, 160)
      : '5 years of Excellence in Entertainment';
    const image = currentEvent.flyer_image
      ? (currentEvent.flyer_image.startsWith('http') ? currentEvent.flyer_image : `${WEB_ORIGIN}${currentEvent.flyer_image}`)
      : `${WEB_ORIGIN}/logo.png`;
    const url = `${WEB_ORIGIN}/events/${id}`;

    document.title = `${title} - Sound It`;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const attr = selector.startsWith('[property=') ? 'property' : 'name';
        const val = selector.match(/"([^"]+)"/)?.[1] || '';
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[property="og:type"]', 'event');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);
  }, [currentEvent, id]);

  // Fetch most recent order for this event (informational only)
  useEffect(() => {
    if (!profile || !id) return;
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    fetch(`${API_BASE_URL}/tickets/my-orders`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const found = data.orders?.find((o: { event?: { id: number }; status: string }) => String(o.event?.id) === id);
        if (found) {
          setRecentOrder({ status: found.status, ticket_qr: found.ticket_qr, ticket_code: found.ticket_code });
        }
      })
      .catch(() => {});
  }, [profile, id]);

  // Check if event is saved
  useEffect(() => {
    if (!profile || !id) return;
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    fetch(`${API_BASE_URL}/events/saved`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((data: { id?: number; events?: { id: number }[] }) => {
        const saved = (data.events || data || []) as { id: number }[];
        setIsLiked(saved.some((e) => String(e.id) === id));
      })
      .catch(() => {});
  }, [profile, id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] pt-32 px-4 text-center">
        <h1 className="text-2xl text-white mb-4">{t('eventDetail.eventNotFound')}</h1>
        <button
          onClick={() => id && fetchEventById(id)}
          className="text-[#d3da0c] hover:underline mb-4 block"
        >
          {t('eventDetail.retry')}
        </button>
        <Link to="/events" className="text-gray-400 hover:underline">
          {t('eventDetail.backToEvents')}
        </Link>
      </div>
    );
  }

  const hasQrPayment = currentEvent.wechat_qr_url || currentEvent.alipay_qr_url || currentEvent.ticket_price != null || currentEvent.ticket_tiers != null;
  const eventEndDate = currentEvent.end_date ? new Date(currentEvent.end_date) : (currentEvent.start_date ? new Date(currentEvent.start_date) : null);
  const isEventPast = eventEndDate ? new Date() > eventEndDate : false;
  const isSalesClosed = Boolean(currentEvent.ticket_sales_closed || isEventPast || currentEvent.status === 'completed' || currentEvent.status === 'cancelled');

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName.trim()) {
      toast.error(t('eventDetail.pleaseUploadScreenshotAndName'));
      return;
    }
    if (!screenshot && !buyerConfirmed) {
      toast.error(t('eventDetail.pleaseUploadScreenshotAndName'));
      return;
    }
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      setPendingAction('ticket');
      setShowAuthModal(true);
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('event_id', String(currentEvent.id));
    formData.append('payment_screenshot', screenshot);
    formData.append('payer_name', payerName);
    formData.append('quantity', String(quantity));
    if (selectedTierId) formData.append('ticket_tier_id', selectedTierId);
    const tier = currentEvent.ticket_tiers?.find((t) => String(t.id) === selectedTierId);
    const rawTierPrice = tier?.price;
    const tierPrice = typeof rawTierPrice === 'number' && !isNaN(rawTierPrice) ? rawTierPrice : undefined;
    const unitPrice = tierPrice ?? currentEvent.ticket_price ?? 0;
    formData.append('payment_amount', String(unitPrice * quantity));
    formData.append('payment_reference', paymentReference.trim());
    if (payerNotes) formData.append('payer_notes', payerNotes);
    if (referralCode.trim()) formData.append('referral_code', referralCode.trim().toUpperCase());
    formData.append('buyer_confirmed', buyerConfirmed ? 'true' : 'false');

    try {
      const res = await fetch(`${API_BASE_URL}/tickets/order`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'rejected') {
          toast.error(data.message || t('eventDetail.orderFailed'));
        } else {
          toast.success(buyerConfirmed
            ? (t('eventDetail.paymentReported') || 'Payment reported, organizer notified')
            : (data.auto_approved ? t('eventDetail.orderAutoApproved') : t('eventDetail.orderSubmitted')));
        }
        setRecentOrder({ status: data.status || 'pending', ticket_qr: undefined, ticket_code: undefined });
        setShowOrderModal(false);
        setShowSuccessModal(true);
        setBuyerConfirmed(false);
        clearPendingPayment();
        Analytics.trackEvent("ticket_purchased", "conversion", { event_id: id, amount: unitPrice * quantity });
      } else {
        toast.error(data.detail || t('eventDetail.orderFailed'));
      }
    } catch {
      toast.error(t('eventDetail.orderFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const relatedEvents = (events || [])
    .filter((e) => e.city === currentEvent?.city && e.id !== currentEvent?.id)
    .slice(0, 3);

  // Mobile UI helpers (presentation only)
  const fmtPrice = (currency?: string, price?: number) => {
    const symbol = currency === 'USD' ? '$' : '¥';
    return `${symbol}${price ?? 0}`;
  };
  const tierPrices = (currentEvent.ticket_tiers || [])
    .map((t) => (typeof t.price === 'number' ? t.price : Number(t.price) || 0));
  const minTierPrice = tierPrices.length > 0 ? Math.min(...tierPrices) : (currentEvent.ticket_price ?? 0);
  const minTierCurrency = (currentEvent.ticket_tiers || []).find(
    (t) => (typeof t.price === 'number' ? t.price : Number(t.price) || 0) === minTierPrice
  )?.currency || 'CNY';

  // Description cleanup: hashtags -> chips, drop external purchase CTA lines and bullet emojis
  const rawDescription = currentEvent.description || '';
  const hashtags = [...rawDescription.matchAll(/#[^\s#]+/g)].map((m) => m[0]);
  const descriptionBody = rawDescription
    .replace(/#[^\s#]+/g, '')
    .split('\n')
    .map((l) => l.replace(/^[\s]*[📅🕘📍🎟🚪]+[\s]*/, ''))
    .filter((l) => l.trim() && !/sounditent\.com/i.test(l))
    .join('\n')
    .trim();

  const handleBuyTicket = () => {
    if (isSalesClosed) return;
    if (!selectedTierId) {
      // Bring the tier selector into view, then let the user pick
      document.getElementById('ticket-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error(t('eventDetail.pleaseSelectTicketType'));
      return;
    }
    if (!profile) {
      setPendingAction('ticket');
      setShowAuthModal(true);
      return;
    }
    setShowQuantityModal(true);
  };

  const eventDateObj = new Date(currentEvent.start_date);
  const chipDate = eventDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const chipTime = eventDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const venuePrimary = currentEvent.venue?.name || currentEvent.address || null;
  const rawVenueSecondary = currentEvent.venue?.name
    ? (currentEvent.venue?.address || currentEvent.city || '')
    : (currentEvent.city || '');
  const venueSecondary = rawVenueSecondary.replace(/^\w/, (c) => c.toUpperCase());
  const mapQuery = encodeURIComponent([venuePrimary, venueSecondary].filter(Boolean).join(', '));

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-16 lg:pt-20 md:pb-0 pb-32">
      {/* Back Button (desktop) */}
      <div className="hidden md:block px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />{t('eventDetail.back')}</button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-[40vh] lg:h-[50vh]">
        {/* Mobile floating back button */}
        <button
          onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
          aria-label={t('eventDetail.back')}
          className="md:hidden absolute top-3 left-3 z-20 w-10 h-10 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img
          src={currentEvent.flyer_image || '/placeholder_event.jpg'}
          alt={currentEvent.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent" />

        {/* Action Buttons */}
        <div className="absolute top-3 right-3 md:top-4 md:right-4 flex gap-2 z-20">
          <button
            onClick={async () => {
              const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
              if (!token) {
                toast.info(t('eventDetail.loginToSave'));
                return;
              }
              try {
                if (isLiked) {
                  const res = await fetch(`${API_BASE_URL}/events/${id}/save`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) { setIsLiked(false); Analytics.trackEvent("event_saved", "engagement", { event_id: id, action: "unsave" }); }
                } else {
                  const res = await fetch(`${API_BASE_URL}/events/${id}/save`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) { setIsLiked(true); Analytics.trackEvent("event_saved", "engagement", { event_id: id, action: "save" }); }
                }
              } catch {
                toast.error(t('eventDetail.saveError'));
              }
            }}
            aria-label="Save"
            className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 ${isLiked
              ? 'bg-[#d3da0c] border-[#d3da0c] text-black'
              : 'bg-black/45 border-white/15 text-white'
              }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => { setIsShareModalOpen(true); Analytics.trackEvent("event_shared", "social", { event_id: id }); }}
            aria-label="Share"
            className="w-10 h-10 rounded-full bg-black/45 border border-white/15 text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-90"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Category */}
              <span className="inline-block px-4 py-1.5 bg-[#d3da0c] text-black text-sm font-semibold rounded-full mb-4">
                {currentEvent.event_type || t('eventDetail.event')}
              </span>

              {currentEvent.tags && currentEvent.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {currentEvent.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-white/5 rounded-lg text-xs text-white/60">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                {currentEvent.title}
              </h1>

              {/* Info chips (mobile) */}
              <div className="md:hidden grid grid-cols-3 gap-2 mb-3">
                <div className="flex flex-col gap-1 p-3 bg-[#141414] rounded-xl min-w-0">
                  <Calendar className="w-4 h-4 text-[#d3da0c] shrink-0" />
                  <p className="text-white/40 text-[9px] uppercase tracking-wide">{t('eventDetail.date')}</p>
                  <p className="text-white text-[11px] font-semibold leading-tight">{chipDate}</p>
                  <p className="text-white/60 text-[10px] leading-tight">{chipTime}</p>
                </div>
                <a
                  href={`https://maps.apple.com/?q=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 p-3 bg-[#141414] rounded-xl min-w-0"
                >
                  <MapPin className="w-4 h-4 text-[#d3da0c] shrink-0" />
                  <p className="text-white/40 text-[9px] uppercase tracking-wide">{t('eventDetail.venue')}</p>
                  <p className="text-white text-[11px] font-semibold leading-tight line-clamp-2">{venuePrimary || t('eventDetail.venueTba', 'Venue to be announced')}</p>
                  {venueSecondary && <p className="text-white/60 text-[10px] leading-tight line-clamp-1">{venueSecondary}</p>}
                </a>
                <div className="flex flex-col gap-1 p-3 bg-[#141414] rounded-xl min-w-0">
                  <Users className="w-4 h-4 text-[#d3da0c] shrink-0" />
                  <p className="text-white/40 text-[9px] uppercase tracking-wide">{t('eventDetail.going', 'Going')}</p>
                  <p className="text-white text-[11px] font-semibold leading-tight">{currentEvent.tickets_sold || 0}</p>
                  <p className="text-white/60 text-[10px] leading-tight">{t('eventDetail.attending', 'attending')}</p>
                </div>
              </div>

              {/* Map card (mobile) */}
              {mapQuery && (
                <a
                  href={`https://maps.apple.com/?q=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md:hidden flex items-center gap-3 p-3 mb-6 bg-[#141414] rounded-xl border border-white/5 active:border-[#d3da0c]/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-[#d3da0c]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{venuePrimary || venueSecondary}</p>
                    {venueSecondary && venueSecondary !== venuePrimary && (
                      <p className="text-white/50 text-xs truncate">{venueSecondary}</p>
                    )}
                  </div>
                  <span className="text-[#d3da0c] text-xs font-semibold shrink-0">{t('eventDetail.openMap', 'Map')}</span>
                </a>
              )}

              {/* Info Grid (desktop) */}
              <div className="hidden md:grid md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.date')}</p>
                    <p className="text-white font-medium">
                      {new Date(currentEvent.start_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.time')}</p>
                    <p className="text-white font-medium">
                      {new Date(currentEvent.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.venue')}</p>
                    <p className="text-white font-medium">{currentEvent.venue?.name || currentEvent.address || t('eventDetail.toBeAnnounced')}</p>
                    <p className="text-white/50 text-sm">{currentEvent.venue?.address || currentEvent.city}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-[#d3da0c]/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">{t('eventDetail.availability')}</p>
                    <p className="text-white font-medium">
                      {currentEvent.show_remaining_tickets === false
                        ? ((currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0
                            ? currentEvent.ticket_tiers.every(t => t.status === 'sold_out' || (t.quantity_sold || 0) >= (t.quantity || 0))
                            : false) || (currentEvent.capacity && currentEvent.tickets_sold >= currentEvent.capacity) ? t('eventDetail.soldOut') : t('eventDetail.ticketsAvailable'))
                        : currentEvent.capacity ? `${(currentEvent.capacity - (currentEvent.tickets_sold || 0))} / ${currentEvent.capacity} ${t('eventDetail.ticketsLabel')}` : t('eventDetail.limitedAvailability')
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t('eventDetail.aboutThisEvent')}
                </h2>
                {descriptionBody ? (
                  <>
                    <div className={`text-white/60 leading-relaxed whitespace-pre-wrap text-sm ${descExpanded ? '' : 'line-clamp-5'}`}>
                      {descriptionBody}
                    </div>
                    {descriptionBody.split('\n').length > 5 && (
                      <button
                        onClick={() => setDescExpanded((v) => !v)}
                        className="text-[#d3da0c] text-sm font-medium mt-2 active:opacity-70 transition-opacity"
                      >
                        {descExpanded ? t('eventDetail.showLess', 'Show less') : t('eventDetail.showMore', 'Show more')}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-white/40 text-sm">{t('eventDetail.noDescription', 'No description available.')}</p>
                )}
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {hashtags.slice(0, 12).map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-white/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Packages */}
              <div className="mb-8">
                <TableBooking 
                  eventId={Number(currentEvent.id)} 
                  eventTitle={currentEvent.title}
                  wechatQrUrl={currentEvent.wechat_qr_url}
                  alipayQrUrl={currentEvent.alipay_qr_url}
                  paymentInstructions={currentEvent.payment_instructions}
                />
              </div>

              {/* Lineup */}
              {currentEvent.djs && currentEvent.djs.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.lineup', 'Lineup')}
                  </h2>
                  <div className="grid gap-3">
                    {currentEvent.djs.map((dj) => {
                      const djAny = dj as any;
                      const genreLine = djAny.genres?.join(', ') || djAny.genre || djAny.genre_tags?.join(', ');
                      return (
                        <Link
                          key={dj.id}
                          to={`/artists/${dj.id}`}
                          className="flex items-center gap-3 p-3 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                        >
                          <img
                            src={dj.avatar_url || '/default-avatar.png'}
                            alt={dj.stage_name}
                            className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/10"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                          />
                          <div className="min-w-0">
                            <p className="text-white font-semibold flex items-center gap-2 truncate">
                              {dj.stage_name}
                              {dj.verification_badge && <VerificationBadge size="sm" />}
                            </p>
                            <p className="text-white/50 text-sm capitalize truncate">
                              {genreLine || djAny.artist_type || t('eventDetail.artist')}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Organizer */}
              {currentEvent.business && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.organizer', 'Organizer')}
                  </h2>
                  <Link
                    to={`/profiles/${currentEvent.business.id}`}
                    className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                  >
                    <img
                      src={currentEvent.business.logo_url || '/placeholder.jpg'}
                      alt={currentEvent.business.business_name}
                      className="w-16 h-16 rounded-xl object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                    />
                    <div>
                      <p className="text-white font-semibold flex items-center gap-2">
                        {currentEvent.business.business_name}
                        {currentEvent.business.verification_badge && <VerificationBadge size="sm" />}
                      </p>
                      <p className="text-white/50 text-sm">
                        {currentEvent.business.verification_badge ? t('eventDetail.verifiedBusiness') : t('eventDetail.business')}
                      </p>
                    </div>
                  </Link>
                </div>
              )}

              {/* Vendors at this Event */}
              {eventVendors.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Vendors at this Event
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {eventVendors.map((vendor) => (
                      <Link
                        key={vendor.id}
                        to={`/store/${vendor.vendor_id}`}
                        className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                      >
                        <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                          {vendor.logo_url ? (
                            <img
                              src={vendor.logo_url}
                              alt={vendor.business_name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Store className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold flex items-center gap-2 truncate">
                            {vendor.business_name}
                            {vendor.is_verified && <VerificationBadge size="sm" />}
                          </p>
                          <p className="text-white/50 text-sm capitalize">
                            {vendor.vendor_type || 'Vendor'}
                            {vendor.booth_location && ` · Booth ${vendor.booth_location}`}
                          </p>
                          {vendor.products && vendor.products.length > 0 && (
                            <p className="text-[#d3da0c] text-xs mt-1">
                              {vendor.products.length} item{vendor.products.length > 1 ? 's' : ''} available
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Events */}
              {relatedEvents.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.similarEvents')}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {relatedEvents.map((related) => (
                      <Link
                        key={related.id}
                        to={`/events/${related.id}`}
                        className="flex gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                      >
                        <img
                          src={related.flyer_image || '/placeholder_event.jpg'}
                          alt={related.title}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div>
                          <p className="text-white font-medium line-clamp-1">
                            {related.title}
                          </p>
                          <p className="text-white/50 text-sm">
                            {new Date(related.start_date).toLocaleDateString()}
                          </p>
                          <p className="text-[#d3da0c] font-semibold mt-1">
                            {fmtPrice(related.ticket_tiers?.[0]?.currency, related.ticket_tiers?.[0]?.price || 0)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar / Ticket Card */}
            <div className="lg:col-span-1">
              <div id="ticket-selector" className="sticky top-24 bg-[#141414] rounded-2xl p-6 border border-white/5 scroll-mt-24">
                {isSalesClosed && (
                  <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {isEventPast 
                        ? t('eventDetail.eventEnded', 'Event Ended') 
                        : t('eventDetail.salesClosed', 'Ticket Sales Closed')}
                    </p>
                    <p className="text-xs text-red-400/80 mt-1">
                      {isEventPast 
                        ? t('eventDetail.eventEndedDesc', 'This event has already ended. Ticket sales are closed.') 
                        : t('eventDetail.salesClosedDesc', 'Ticket sales for this event have been closed by the organizer.')}
                    </p>
                  </div>
                )}
                {currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0 ? (
                  <>
                    <div className="mb-4">
                      <label className="text-white/50 text-sm mb-3 block">
                        {t('eventDetail.selectTicketType')}
                      </label>
                      <div className="space-y-3">
                        {currentEvent.ticket_tiers.map((tier) => {
                          const isTierClosed = tier.status === 'sold_out' || tier.status === 'closed' || tier.status === 'ended' || (tier.sale_end ? new Date() > new Date(tier.sale_end) : false);
                          return (
                            <button
                              key={tier.id}
                              disabled={isSalesClosed || isTierClosed}
                              onClick={() => setSelectedTierId(String(tier.id))}
                              className={`w-full p-4 rounded-xl border text-left transition-all disabled:opacity-50 ${
                                selectedTierId === String(tier.id)
                                  ? 'border-[#d3da0c] bg-[#d3da0c]/10'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-white">{tier.name}</span>
                                <span className="text-[#d3da0c] font-bold shrink-0 whitespace-nowrap">
                          {fmtPrice(tier.currency, typeof tier.price === 'number' ? tier.price : Number(tier.price) || 0)}
                        </span>
                              </div>
                              <p className="text-white/50 text-xs">
                                {isTierClosed
                                  ? (tier.status === 'closed' || tier.status === 'ended' ? t('eventDetail.salesClosed', 'Sales Closed') : t('eventDetail.soldOut'))
                                  : currentEvent.show_remaining_tickets === false
                                    ? t('eventDetail.ticketsAvailable')
                                    : `${(tier.quantity || 0) - (tier.quantity_sold || 0)} ${t('eventDetail.ticketsRemaining')}`
                                }
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      disabled={isSalesClosed}
                      onClick={handleBuyTicket}
                      className={`w-full py-4 rounded-xl font-semibold transition-colors ${
                        isSalesClosed
                          ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-white/5'
                          : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b] cursor-pointer'
                      }`}
                    >
                      {isEventPast 
                        ? t('eventDetail.eventEnded', 'Event Ended') 
                        : isSalesClosed 
                          ? t('eventDetail.salesClosed', 'Sales Closed') 
                          : t('eventDetail.buyTicket')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <p className="text-white/50 text-sm mb-2">{t('eventDetail.ticketPrice')}</p>
                      <p className="text-3xl font-bold text-white">
                        {fmtPrice('CNY', currentEvent.ticket_price || 0)}
                      </p>
                    </div>

                    <button
                      disabled={isSalesClosed}
                      onClick={handleBuyTicket}
                      className={`w-full py-4 rounded-xl font-semibold transition-colors mb-4 ${
                        isSalesClosed
                          ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-white/5'
                          : 'bg-[#d3da0c] text-black hover:bg-[#bbc10b] cursor-pointer'
                      }`}
                    >
                      {isEventPast 
                        ? t('eventDetail.eventEnded', 'Event Ended') 
                        : isSalesClosed 
                          ? t('eventDetail.salesClosed', 'Sales Closed') 
                          : t('eventDetail.buyTicket')}
                    </button>
                  </>
                )}

                {!(currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0) && !hasQrPayment && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-8 h-8 text-[#d3da0c]" />
                    </div>
                    <h3 className="text-white font-semibold mb-2">{t('eventDetail.ticketsComingSoon')}</h3>
                    <p className="text-white/50 text-sm mb-6">{t('eventDetail.ticketInfoSoon')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky purchase bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111111]/95 backdrop-blur-md border-t border-white/10 px-4 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-white/50 text-[10px] uppercase tracking-wide leading-none mb-1">
              {t('eventDetail.startingFrom', 'Starting from')}
            </p>
            <p className="text-white font-bold text-lg leading-none">
              {fmtPrice(minTierCurrency, minTierPrice)}
            </p>
          </div>
          <button
            disabled={isSalesClosed}
            onClick={handleBuyTicket}
            className={`flex-1 h-12 rounded-xl font-bold text-sm transition-colors ${
              isSalesClosed
                ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-[#d3da0c] text-black active:bg-[#bbc10b]'
            }`}
          >
            {isEventPast
              ? t('eventDetail.eventEnded', 'Event Ended')
              : isSalesClosed
                ? t('eventDetail.salesClosed', 'Sales Closed')
                : t('eventDetail.buyTicket')}
          </button>
        </div>
      </div>

      {/* Quantity Selector Modal */}
      {showQuantityModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.selectQuantity')}</h3>
              <button onClick={() => { setShowQuantityModal(false); setQuantity(1); }} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            {/* Tier info */}
            {selectedTierId && currentEvent?.ticket_tiers?.length > 0 && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <p className="text-white font-medium">
                  {currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.name}
                </p>
                <p className="text-[#d3da0c] font-bold">
                  {currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.currency || '¥'}
                  {currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.price || 0}
                  <span className="text-white/50 text-sm font-normal"> / {t('eventDetail.ticket')}</span>
                </p>
              </div>
            )}
            {!selectedTierId && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <p className="text-white font-medium">{t('eventDetail.standardTicket')}</p>
                <p className="text-[#d3da0c] font-bold">
                  ¥{currentEvent?.ticket_price || 0}
                  <span className="text-white/50 text-sm font-normal"> / {t('eventDetail.ticket')}</span>
                </p>
              </div>
            )}
            {/* Quantity */}
            <div className="mb-4">
              <label className="text-white/60 text-sm block mb-2">{t('eventDetail.quantity')}</label>
              <div className="flex items-center gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-xl bg-white/5 text-white hover:bg-white/10 text-xl font-bold"
                >-</button>
                <span className="text-white font-bold text-2xl w-12 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-12 h-12 rounded-xl bg-white/5 text-white hover:bg-white/10 text-xl font-bold"
                >+</button>
              </div>
            </div>
            {/* Total */}
            <div className="mb-6 p-3 bg-[#d3da0c]/10 rounded-xl text-center">
              <p className="text-white/60 text-sm">{t('eventDetail.total')}</p>
              <p className="text-[#d3da0c] text-2xl font-bold">
                ¥{((currentEvent?.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent?.ticket_price ?? 0) * quantity).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => { setShowQuantityModal(false); setShowQrModal(true); }}
              className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
            >
              {t('eventDetail.proceedToPayment')}
            </button>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.scanToPay')}</h3>
              <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="mb-3 text-center">
              <p className="text-white/60 text-xs">
                {quantity > 1 ? `${quantity} × ` : ''}
                {selectedTierId && currentEvent?.ticket_tiers
                  ? currentEvent.ticket_tiers.find((t) => String(t.id) === selectedTierId)?.name
                  : t('eventDetail.standardTicket')}
              </p>
            </div>
            <MobileQrPayment
              amount={(currentEvent.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent.ticket_price ?? 0) * quantity}
              wechatQrUrl={currentEvent.wechat_qr_url}
              alipayQrUrl={currentEvent.alipay_qr_url}
              wechatPayUrl={(currentEvent as any).wechat_pay_url}
              alipayPayUrl={(currentEvent as any).alipay_pay_url}
              paymentInstructions={currentEvent.payment_instructions}
              hideYoopay={!!currentEvent.wechat_qr_url || !!currentEvent.alipay_qr_url}
              onDeepLinkTap={() => { leftForPaymentAt.current = Date.now(); }}
            />
            <button
              onClick={() => { setShowQrModal(false); setShowOrderModal(true); }}
              className="w-full mt-4 bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
            >
              {t('eventDetail.iHavePaid')}
            </button>
          </div>
        </div>
      )}

      {/* Pay-return prompt - buyer came back from Alipay/WeChat */}
      {payReturnPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center">
            <div className="w-16 h-16 bg-[#d3da0c]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-[#d3da0c]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t('eventDetail.payReturnTitle') || 'Did you complete the payment?'}</h3>
            <p className="text-gray-400 text-sm mb-4">
              {t('eventDetail.payReturnBody') || 'If you finished paying in the app, confirm below and the organizer is notified instantly.'}
            </p>
            <div className="p-3 bg-white/5 rounded-xl mb-4">
              <span className="text-white/60 text-sm">{t('eventDetail.amountToPay') || 'Amount'}</span>
              <p className="text-xl font-bold text-[#d3da0c]">
                ¥{((currentEvent?.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent?.ticket_price ?? 0) * quantity).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setBuyerConfirmed(true);
                  setPayReturnPrompt(false);
                  setShowQrModal(false);
                  setShowOrderModal(true);
                }}
                className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
              >
                {t('eventDetail.payReturnYes') || 'Yes, I Completed the Payment'}
              </button>
              <button
                onClick={() => setPayReturnPrompt(false)}
                className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-colors"
              >
                {t('eventDetail.payReturnNo') || 'Not Yet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume unfinished payment — browser tab was discarded while paying */}
      {resumePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t('eventDetail.resumeTitle') || 'Unfinished Payment'}</h3>
            <p className="text-gray-400 text-sm mb-4">
              {t('eventDetail.resumeBody') || 'You were paying for this event. If you already completed the payment in WeChat or Alipay, confirm below — you can also attach your payment screenshot.'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  restorePendingPayment();
                  setBuyerConfirmed(true);
                  setResumePrompt(false);
                  clearPendingPayment();
                  setShowOrderModal(true);
                }}
                className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
              >
                {t('eventDetail.resumeYes') || 'Yes, I Completed the Payment'}
              </button>
              <button
                onClick={() => {
                  restorePendingPayment();
                  setResumePrompt(false);
                  setShowQrModal(true);
                }}
                className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-colors"
              >
                {t('eventDetail.resumeShowQr') || 'Show Payment QR Again'}
              </button>
              <button
                onClick={() => { setResumePrompt(false); clearPendingPayment(); }}
                className="w-full text-gray-500 py-2 text-sm hover:text-gray-300 transition-colors"
              >
                {t('eventDetail.resumeCancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.confirmPayment')}</h3>
              <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              {/* Compact summary line: quantity + total */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-white/60 text-sm">
                  {quantity} {quantity === 1 ? t('eventDetail.ticket') : t('eventDetail.tickets')}
                </span>
                <span className="text-[#d3da0c] font-bold">
                  ¥{((currentEvent?.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent?.ticket_price ?? 0) * quantity).toLocaleString()}
                </span>
              </div>

              {/* Name only needed when we could not resolve it from the profile */}
              {!profile && (
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('eventDetail.yourName')} *</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('eventDetail.enterYourName') || 'Your name'}
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-white/60 text-sm block mb-2">
                  {t('eventDetail.paymentScreenshot')}{buyerConfirmed ? '' : ' *'}
                </label>
                {buyerConfirmed && (
                  <p className="text-[#d3da0c]/80 text-xs mb-2">
                    {t('eventDetail.screenshotOptionalHint') || 'Optional, your payment confirmation was already sent to the organizer.'}
                  </p>
                )}
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-white/50 mb-2" />
                    <p className="text-sm text-white/60">{screenshot ? screenshot.name : t('eventDetail.clickToUpload')}</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    className="hidden"
                    required={!buyerConfirmed}
                  />
                </label>
              </div>

              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.notesOptional')}</label>
                <textarea
                  value={payerNotes}
                  onChange={(e) => setPayerNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.anyNotes')}
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
              >
                {submitting ? t('eventDetail.submitting') : t('eventDetail.submitOrder')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Universal Share Modal */}
      {isShareModalOpen && currentEvent && (
        <UniversalShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          item={{
            type: 'event',
            id: currentEvent.id,
            title: currentEvent.title,
            subtitle: (currentEvent as any).organizer_name || (currentEvent as any).organizer?.organization_name || 'Sound It Event',
            image: currentEvent.flyer_image,
            date: currentEvent.start_date ? new Date(currentEvent.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '',
            time: currentEvent.start_date ? new Date(currentEvent.start_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '',
            location: (currentEvent as any).venue_name || currentEvent.venue?.name || currentEvent.address || currentEvent.city || '',
            city: currentEvent.city,
            description: currentEvent.description,
            price: currentEvent.ticket_tiers?.[0]?.price ? `¥${currentEvent.ticket_tiers[0].price}` : 'Free',
            url: `${WEB_ORIGIN}/events/${currentEvent.id}`
          }}
        />
      )}

      {/* Order Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t('eventDetail.orderSuccessTitle')}</h3>
            <p className="text-gray-400 text-sm mb-6">
              {recentOrder?.status === 'approved' || recentOrder?.status === 'used'
                ? t('eventDetail.orderAutoApproved')
                : recentOrder?.status === 'pending'
                  ? (t('eventDetail.orderPendingApproval') || 'Your payment was reported to the organizer. The ticket will be approved when they see it, follow the status anytime in My Tickets.')
                  : t('eventDetail.orderSubmitted')}
            </p>
            {recentOrder?.ticket_qr && (
              <div className="mb-6">
                <div className="bg-white rounded-xl p-3 inline-block">
                  <img src={recentOrder.ticket_qr} alt="Ticket QR" className="w-48 h-48 object-contain" />
                </div>
                {recentOrder.ticket_code && (
                  <p className="text-white/70 text-xs mt-2 font-mono">{recentOrder.ticket_code}</p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowSuccessModal(false); navigate('/tickets'); }}
                className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
              >
                {t('eventDetail.viewMyTickets')}
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-colors"
              >
                {t('eventDetail.continueBrowsing')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal - Login / Register inline */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`text-lg font-semibold pb-1 border-b-2 transition-colors ${authTab === 'login' ? 'text-[#d3da0c] border-[#d3da0c]' : 'text-white/40 border-transparent'}`}
                >
                  {t('nav.login')}
                </button>
                <button
                  onClick={() => setAuthTab('register')}
                  className={`text-lg font-semibold pb-1 border-b-2 transition-colors ${authTab === 'register' ? 'text-[#d3da0c] border-[#d3da0c]' : 'text-white/40 border-transparent'}`}
                >
                  {t('nav.register')}
                </button>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!authEmail.trim() || !authPassword) {
                  toast.error(t('auth.login.enterIdentifierError', { method: t('auth.login.email') }));
                  return;
                }
                setAuthLoading(true);
                try {
                  const { loginWithEmail } = useAuthStore.getState();
                  await loginWithEmail(authEmail.trim(), authPassword);
                  toast.success(t('auth.login.welcomeBack'));
                  setShowAuthModal(false);
                  setAuthEmail('');
                  setAuthPassword('');
                  if (pendingAction === 'ticket') {
                    setShowQrModal(true);
                  }
                  setPendingAction(null);
                } catch (err) {
                  toast.error((err as Error).message || t('auth.login.loginFailed'));
                } finally {
                  setAuthLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.emailLabel')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.emailPlaceholder')}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.passwordLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.passwordPlaceholder')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showAuthPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authLoading ? <LogIn className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  {t('nav.login')}
                </button>
              </form>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!authEmail.trim() || !authPassword || !authFirstName.trim()) {
                  toast.error(t('auth.register.fillAllFieldsError'));
                  return;
                }
                if (authPassword.length < 8) {
                  toast.error(t('auth.register.passwordMinLength'));
                  return;
                }
                setAuthLoading(true);
                try {
                  const { registerWithEmail } = useAuthStore.getState();
                  await registerWithEmail({
                    email: authEmail.trim(),
                    password: authPassword,
                    first_name: authFirstName.trim(),
                    last_name: authLastName.trim(),
                    role_type: 'user',
                  });
                  toast.success(t('auth.register.accountCreated'));
                  // Auto-login after register
                  const { loginWithEmail } = useAuthStore.getState();
                  await loginWithEmail(authEmail.trim(), authPassword);
                  setShowAuthModal(false);
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthFirstName('');
                  setAuthLastName('');
                  if (pendingAction === 'ticket') {
                    setShowQrModal(true);
                  }
                  setPendingAction(null);
                } catch (err) {
                  toast.error((err as Error).message || t('auth.register.registrationFailed'));
                } finally {
                  setAuthLoading(false);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm block mb-2">{t('common.firstName') || 'First Name'} *</label>
                    <input
                      type="text"
                      value={authFirstName}
                      onChange={(e) => setAuthFirstName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm block mb-2">{t('common.lastName') || 'Last Name'}</label>
                    <input
                      type="text"
                      value={authLastName}
                      onChange={(e) => setAuthLastName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.emailLabel')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.emailPlaceholder')}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">{t('auth.login.passwordLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type={showAuthPassword ? 'text' : 'password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('auth.login.passwordPlaceholder')}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showAuthPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authLoading ? <UserPlus className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                  {t('nav.register')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
