import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Users, ArrowLeft, Share2, Heart, X, ShoppingCart, Check, Ticket, MessageCircle, Copy } from 'lucide-react';
import MobileQrPayment from '@/components/MobileQrPayment';
import { toast } from 'sonner';
import { useEventStore } from '@/store/eventStore';
import { useAuthStore } from '@/store/authStore';
import { QRCodeSVG } from 'qrcode.react';
import VerificationBadge from '@/components/VerificationBadge';
import TableBooking from '@/components/TableBooking';
import { API_BASE_URL } from '@/config/api';

export default function EventDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { currentEvent, fetchEventById, isLoading, events } = useEventStore();
  const [isLiked, setIsLiked] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Ticket order flow
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [payerName, setPayerName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [recentOrder, setRecentOrder] = useState<{ status: string; ticket_qr?: string; ticket_code?: string } | null>(null);

  useEffect(() => {
    if (id) {
      fetchEventById(id);
      setSelectedTierId(null);
    }
  }, [id, fetchEventById]);

  // Update meta tags for sharing (WeChat, social)
  useEffect(() => {
    if (!currentEvent) return;
    const title = currentEvent.title || 'Sound It';
    const description = currentEvent.description
      ? currentEvent.description.replace(/<[^>]+>/g, '').slice(0, 160)
      : '5 years of Excellence in Entertainment';
    const image = currentEvent.flyer_image
      ? (currentEvent.flyer_image.startsWith('http') ? currentEvent.flyer_image : `${window.location.origin}${currentEvent.flyer_image}`)
      : `${window.location.origin}/logo.png`;
    const url = `${window.location.origin}/events/${id}`;

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

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName.trim() || !email.trim() || !phoneNumber.trim()) {
      toast.error(t('eventDetail.pleaseFillAllFields'));
      return;
    }
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: `/events/${id}` } });
      return;
    }

    setSubmitting(true);
    const tier = currentEvent.ticket_tiers?.find((t) => String(t.id) === selectedTierId);
    const rawTierPrice = tier?.price;
    const tierPrice = typeof rawTierPrice === 'number' && !isNaN(rawTierPrice) ? rawTierPrice : undefined;
    const unitPrice = tierPrice ?? currentEvent.ticket_price ?? 0;

    const payload = {
      event_id: currentEvent.id,
      payer_name: payerName.trim(),
      email: email.trim(),
      phone_number: phoneNumber.trim(),
      quantity,
      payment_amount: unitPrice * quantity,
      ticket_tier_id: selectedTierId ? Number(selectedTierId) : undefined,
      payer_notes: payerNotes.trim() || undefined,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/tickets/order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('eventDetail.orderSubmitted'));
        setRecentOrder({ status: data.status || 'pending', ticket_qr: undefined, ticket_code: undefined });
        setShowOrderModal(false);
        setShowSuccessModal(true);
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

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-16 lg:pt-20">
      {/* Back Button */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
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
        <img
          src={currentEvent.flyer_image || '/placeholder_event.jpg'}
          alt={currentEvent.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent" />

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
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
                  if (res.ok) setIsLiked(false);
                } else {
                  const res = await fetch(`${API_BASE_URL}/events/${id}/save`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.ok) setIsLiked(true);
                }
              } catch {
                toast.error(t('eventDetail.saveError'));
              }
            }}
            className={`p-3 rounded-full backdrop-blur-md transition-colors ${isLiked
              ? 'bg-red-500 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
              }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
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

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                {currentEvent.title}
              </h1>

              {/* Info Grid */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
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
                      {currentEvent.capacity ? `${(currentEvent.capacity - (currentEvent.tickets_sold || 0))} / ${currentEvent.capacity} ${t('eventDetail.ticketsLabel')}` : t('eventDetail.limitedAvailability')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t('eventDetail.aboutThisEvent')}
                </h2>
                <div className="text-white/60 leading-relaxed whitespace-pre-wrap">
                  {currentEvent.description}
                </div>
              </div>

              {/* Table Packages */}
              <div className="mb-8">
                <TableBooking 
                  eventId={Number(currentEvent.id)} 
                  eventTitle={currentEvent.title}
                />
              </div>

              {/* Artist Section */}
              {currentEvent.djs && currentEvent.djs.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.featuredDJsAndArtists')}
                  </h2>
                  <div className="grid gap-4">
                    {currentEvent.djs.map((dj) => (
                      <Link
                        key={dj.id}
                        to={`/artists/${dj.id}`}
                        className="flex items-center gap-4 p-4 bg-[#141414] rounded-xl hover:border-[#d3da0c]/30 border border-transparent transition-colors"
                      >
                        <img
                          src={dj.avatar_url || '/default-avatar.png'}
                          alt={dj.stage_name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                        <div>
                          <p className="text-white font-semibold flex items-center gap-2">
                            {dj.stage_name}
                            {dj.verification_badge && <VerificationBadge size="sm" />}
                          </p>
                          <p className="text-white/50 text-sm">
                            {dj.genres?.join(', ') || t('eventDetail.artist')}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Business */}
              {currentEvent.business && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    {t('eventDetail.business')}
                  </h2>
                  <Link
                    to={`/profiles/${currentEvent.business.user_id}`}
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
                            {related.ticket_tiers?.[0]?.currency || 'CNY'} {related.ticket_tiers?.[0]?.price || 0}
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
              <div className="sticky top-24 bg-[#141414] rounded-2xl p-6 border border-white/5">
                {currentEvent.ticket_tiers && currentEvent.ticket_tiers.length > 0 ? (
                  <>
                    <div className="mb-4">
                      <label className="text-white/50 text-sm mb-3 block">
                        {t('eventDetail.selectTicketType')}
                      </label>
                      <div className="space-y-3">
                        {currentEvent.ticket_tiers.map((tier) => (
                          <button
                            key={tier.id}
                            disabled={tier.status === 'sold_out'}
                            onClick={() => setSelectedTierId(String(tier.id))}
                            className={`w-full p-4 rounded-xl border text-left transition-all disabled:opacity-50 ${
                              selectedTierId === String(tier.id)
                                ? 'border-[#d3da0c] bg-[#d3da0c]/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-white">{tier.name}</span>
                              <span className="text-[#d3da0c] font-bold">
                                {tier.currency} {tier.price}
                              </span>
                            </div>
                            <p className="text-white/50 text-xs">
                              {tier.quantity - (tier.quantity_sold || 0)} {t('eventDetail.ticketsRemaining')}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!selectedTierId) {
                          toast.error(t('eventDetail.pleaseSelectTicketType'));
                          return;
                        }
                        if (!profile) {
                          navigate('/login', { state: { from: `/events/${id}` } });
                          return;
                        }
                        setShowQrModal(true);
                      }}
                      className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors cursor-pointer"
                    >
                      {t('eventDetail.buyTicket')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-6">
                      <p className="text-white/50 text-sm mb-2">{t('eventDetail.ticketPrice')}</p>
                      <p className="text-3xl font-bold text-white">
                        ¥{currentEvent.ticket_price || 0}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (!profile) {
                          navigate('/login', { state: { from: `/events/${id}` } });
                          return;
                        }
                        setShowQrModal(true);
                      }}
                      className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors cursor-pointer mb-4"
                    >
                      {t('eventDetail.buyTicket')}
                    </button>

                    {/* Ticket QR and approval details are intentionally NOT shown here.
                        They are backend-only and only accessible via the ticket scanner/check-in flow
                        to prevent fraud and ticket duplication. */}
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

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.scanToPay')}</h3>
              <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <MobileQrPayment
              amount={(currentEvent.ticket_tiers?.find((t) => String(t.id) === selectedTierId)?.price ?? currentEvent.ticket_price ?? 0) * quantity}
              wechatQrUrl={currentEvent.wechat_qr_url}
              alipayQrUrl={currentEvent.alipay_qr_url}
              paymentInstructions={currentEvent.payment_instructions}
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

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('eventDetail.confirmPayment')}</h3>
              <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.yourName')} *</label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterYourName')}
                  required
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.email')} *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterYourEmail')}
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
                  placeholder={t('eventDetail.enterYourPhone')}
                  required
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('eventDetail.quantity')} *</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-lg bg-white/5 text-white hover:bg-white/10"
                  >-</button>
                  <span className="text-white font-medium w-8 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-10 h-10 rounded-lg bg-white/5 text-white hover:bg-white/10"
                  >+</button>
                </div>
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

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl max-w-sm w-full border border-white/10 overflow-hidden">
            {/* Event Preview Card */}
            <div className="relative h-40 bg-gradient-to-br from-[#d3da0c]/20 to-[#FF2D8F]/20">
              {currentEvent?.flyer_image ? (
                <img
                  src={currentEvent.flyer_image}
                  alt={currentEvent.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img src="/logo.png" alt="Sound It" className="h-16 w-auto opacity-80" />
                </div>
              )}
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-5">
              <h3 className="text-lg font-semibold text-white mb-1 line-clamp-1">{currentEvent?.title}</h3>
              <p className="text-gray-400 text-sm mb-4">
                {currentEvent?.start_date
                  ? new Date(currentEvent.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : ''}
                {' • '}
                {currentEvent?.venue?.name || currentEvent?.address || t('eventDetail.toBeAnnounced')}
              </p>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center p-3 shadow-lg">
                  <QRCodeSVG
                    value={`${window.location.origin}/events/${id}`}
                    size={180}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: '/logo.png',
                      x: undefined,
                      y: undefined,
                      height: 30,
                      width: 30,
                      excavate: true,
                    }}
                  />
                </div>
                <p className="text-gray-400 text-center text-xs">
                  {t('eventDetail.scanQRToShare')}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/events/${id}`);
                      toast.success(t('eventDetail.linkCopied'));
                    }}
                    className="flex-1 px-4 py-2.5 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {t('eventDetail.copyLink')}
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: currentEvent?.title || 'Sound It Event',
                          text: currentEvent?.description ? currentEvent.description.replace(/<[^>]+>/g, '').slice(0, 100) : '',
                          url: `${window.location.origin}/events/${id}`,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(`${window.location.origin}/events/${id}`);
                        toast.success(t('eventDetail.linkCopied'));
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-[#d3da0c] text-black text-sm font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    {t('eventDetail.shareNative')}
                  </button>
                </div>

                {/* WeChat Tip */}
                <div className="w-full bg-white/5 rounded-lg p-3 flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-gray-400 text-xs leading-relaxed">
                    {t('eventDetail.wechatShareTip')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
              {t('eventDetail.orderSubmittedDesc')}
            </p>
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
    </div>
  );
}
