import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Clock, X, Download, Share2, Check, Loader2, Ticket, Package, ChevronRight, ExternalLink, Star, CheckCircle2 } from 'lucide-react';
import { useTicketStore } from '@/store/ticketStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import { WEB_ORIGIN } from '@/lib/appUrl';

interface TicketOrder {
  id: number;
  event: {
    id: number;
    title: string;
    start_date: string;
    flyer_image?: string;
    refund_policy?: string | null;
    refunds_allowed?: boolean;
  };
  payment_amount: number;
  quantity?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  tickets_generated?: number;
  auto_approved?: boolean;
  rejection_reason?: string;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  payer_name?: string | null;
  ticket_tier_name?: string | null;
  created_at: string;
}

interface ProductOrder {
  id: number;
  product: {
    id: number;
    name: string;
    image_url?: string;
    vendor?: {
      id: number;
      business_name?: string;
    } | null;
  };
  payment_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'used';
  order_code?: string;
  order_qr_code?: string;
  rejection_reason?: string;
  created_at: string;
}

type TicketsTab = 'upcoming' | 'completed' | 'cancellation';

const Tickets = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = !!(localStorage.getItem('auth-token') || localStorage.getItem('token'));
  const { tickets, fetchUserTickets, isLoading } = useTicketStore();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TicketsTab>('upcoming');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TicketOrder | null>(null);

  const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);
  const [productOrdersLoading, setProductOrdersLoading] = useState(false);
  const [selectedProductOrder, setSelectedProductOrder] = useState<ProductOrder | null>(null);

  // Individual tickets for a selected order (when quantity > 1)
  const [orderIndividualTickets, setOrderIndividualTickets] = useState<Array<{id: number; ticket_number: string; qr_token: string; qr_code: string}>>([]);
  const [loadingOrderTickets, setLoadingOrderTickets] = useState(false);

  // Cancel booking flow: confirm -> reason -> success
  const [cancelFlow, setCancelFlow] = useState<{ order: TicketOrder; step: 'confirm' | 'reason' | 'success' } | null>(null);
  const [cancelReasonIdx, setCancelReasonIdx] = useState<number | null>(null);
  const [cancelOtherText, setCancelOtherText] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Leave a review flow (completed event tickets)
  const [reviewTarget, setReviewTarget] = useState<{ eventId: number; title: string; image?: string; date?: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    fetchUserTickets();
    fetchTicketOrders();
    fetchProductOrders();
  }, [fetchUserTickets]);

  // Refresh when the buyer returns to this tab (e.g. organizer approved while away)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchUserTickets();
        fetchTicketOrders();
        fetchProductOrders();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTicketOrders = async () => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) return;
    setOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTicketOrders(data.orders || []);
    } catch {
      // silent fail
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchProductOrders = async () => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) return;
    setProductOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/product-orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProductOrders(data.orders || []);
    } catch {
      // silent fail
    } finally {
      setProductOrdersLoading(false);
    }
  };

  const now = new Date();
  const activeTickets = tickets.filter(t => {
    const eventDate = t.event ? new Date(t.event.start_date) : null;
    return !t.is_used && eventDate && eventDate > now;
  });
  const pastTickets = tickets.filter(t => {
    const eventDate = t.event ? new Date(t.event.start_date) : null;
    return t.is_used || (eventDate && eventDate <= now);
  });

  const activeTicketOrders = ticketOrders.filter(o => {
    const eventDate = o.event ? new Date(o.event.start_date) : null;
    return o.status === 'approved' && eventDate && eventDate > now;
  });
  const pendingTicketOrders = ticketOrders.filter(o => o.status === 'pending');
  const pastTicketOrders = ticketOrders.filter(o => {
    const eventDate = o.event ? new Date(o.event.start_date) : null;
    return o.status === 'approved' && eventDate && eventDate <= now;
  });
  const cancelledTicketOrders = ticketOrders.filter(o => o.status === 'cancelled' || o.status === 'rejected');

  const activeProductOrders = productOrders.filter(o => o.status === 'pending' || o.status === 'approved');
  const usedProductOrders = productOrders.filter(o => o.status === 'used');
  const rejectedProductOrders = productOrders.filter(o => o.status === 'rejected');

  const upcomingItems = [...activeTickets, ...activeTicketOrders, ...pendingTicketOrders, ...activeProductOrders];
  const completedItems = [...pastTickets, ...pastTicketOrders, ...usedProductOrders];
  const cancellationItems = [...cancelledTicketOrders, ...rejectedProductOrders];

  const currentItems = activeTab === 'upcoming' ? upcomingItems : activeTab === 'completed' ? completedItems : cancellationItems;

  const handleShare = async (item: typeof tickets[0] | TicketOrder | ProductOrder) => {
    const isProduct = isProductOrder(item);
    const isOrder = isTicketOrder(item);
    const eventId = isProduct ? null : (item as TicketOrder | typeof tickets[0]).event?.id;
    const shareUrl = eventId ? `${WEB_ORIGIN}/events/${eventId}` : `${WEB_ORIGIN}/events`;
    const shareData = {
      title: isProduct
        ? item.product?.name || t('user.tickets.thisEvent')
        : item.event?.title || t('user.tickets.thisEvent'),
      text: t('user.tickets.shareText', {
        title: isProduct
          ? item.product?.name || t('user.tickets.thisEvent')
          : item.event?.title || t('user.tickets.thisEvent'),
        date: !isProduct && item.event?.start_date
          ? new Date(item.event.start_date).toLocaleDateString()
          : t('user.tickets.tba'),
        location: isOrder ? t('user.tickets.tba') : isProduct
          ? (item.product?.vendor?.business_name || t('user.tickets.tba'))
          : (item as typeof tickets[0]).event?.city || t('user.tickets.tba')
      }),
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success(t('user.tickets.ticketInfoCopied'));
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error(t('user.tickets.failedToShareTicket'));
      }
    }
  };

  const handleDownload = async (ticketId: string) => {
    setDownloadingId(ticketId);

    try {
      const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/tickets/${ticketId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
          const ticketData = t('user.tickets.downloadText', {
            ticketNumber: ticket.ticket_number,
            title: ticket.event?.title || t('user.tickets.na'),
            date: ticket.event?.start_date ? new Date(ticket.event.start_date).toLocaleString() : t('user.tickets.na'),
            location: ticket.event?.city || t('user.tickets.na'),
            tier: ticket.ticket_tier?.name || t('user.tickets.standard')
          }).trim();

          const blob = new Blob([ticketData], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ticket-${ticket.ticket_number}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          toast.success(t('user.tickets.ticketInfoDownloaded'));
        } else {
          throw new Error('Ticket not found');
        }
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-${ticketId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t('user.tickets.ticketPdfDownloaded'));
    } catch {
      toast.error(t('user.tickets.failedToDownloadTicket'));
    } finally {
      setDownloadingId(null);
    }
  };

  const getTicketStatus = (ticket: typeof tickets[0]) => {
    if (ticket.is_used) return 'used';
    const event = ticket.event as any;
    if (!event) return 'active';
    // Use end_date if available; fallback to 24h after start_date if no end_date is provided
    const eventEnd = event.end_date
      ? new Date(event.end_date)
      : (event.start_date ? new Date(new Date(event.start_date).getTime() + 24 * 3600 * 1000) : null);
    if (eventEnd && eventEnd <= now) return 'expired';
    return 'active';
  };

  const getTicketOrderStatus = (order: TicketOrder) => {
    if (order.status === 'rejected') return 'rejected';
    if (order.status === 'pending') return 'pending';
    if (order.status === 'cancelled') return 'cancelled';
    if (order.status === 'used') return 'used';
    const event = order.event as any;
    if (!event) return 'active';
    const eventEnd = event.end_date
      ? new Date(event.end_date)
      : (event.start_date ? new Date(new Date(event.start_date).getTime() + 24 * 3600 * 1000) : null);
    if (eventEnd && eventEnd <= now) return 'expired';
    return 'active';
  };

  const getProductOrderStatus = (order: ProductOrder) => {
    if (order.status === 'rejected') return 'rejected';
    if (order.status === 'pending') return 'pending';
    if (order.status === 'used') return 'used';
    return 'active';
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return { text: t('user.tickets.statusActive'), class: 'bg-green-500/20 text-green-500' };
      case 'used':
        return { text: t('user.tickets.statusUsed', 'Used'), class: 'bg-gray-500/20 text-gray-500' };
      case 'expired':
        return { text: t('user.tickets.statusExpired'), class: 'bg-red-500/20 text-red-500' };
      case 'pending':
        return { text: t('user.tickets.statusPendingApproval') || 'Pending Approval', class: 'bg-amber-500/20 text-amber-400' };
      case 'rejected':
        return { text: t('user.tickets.statusRejected', 'Rejected'), class: 'bg-red-500/20 text-red-500' };
      case 'cancelled':
        return { text: t('user.tickets.statusCancelled', 'Cancelled'), class: 'bg-gray-500/20 text-gray-500' };
      default:
        return { text: status, class: 'bg-gray-500/20 text-gray-500' };
    }
  };

  const openOrderQr = async (ticketOrder: TicketOrder) => {
    setSelectedOrder(ticketOrder);
    // Always fetch individual tickets: the backend self-heals legacy approved
    // orders by generating Ticket rows + QR codes on first view.
    setLoadingOrderTickets(true);
    setOrderIndividualTickets([]);
    try {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(
        `${API_BASE_URL}/tickets/my-orders/${ticketOrder.id}/tickets`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setOrderIndividualTickets(data.tickets || []);
      }
    } catch {}
    setLoadingOrderTickets(false);
  };

  const isTicketOrder = (item: any): item is TicketOrder => 'ticket_code' in item;
  const isProductOrder = (item: any): item is ProductOrder => 'order_code' in item;

  const openItem = (item: typeof tickets[0] | TicketOrder | ProductOrder) => {
    if (isProductOrder(item)) {
      if (item.order_qr_code) setSelectedProductOrder(item);
    } else if (isTicketOrder(item)) {
      openOrderQr(item);
    } else {
      setSelectedTicket(String(item.id));
    }
  };

  const token = () => localStorage.getItem('auth-token') || localStorage.getItem('token');

  const canCancelOrder = (order: TicketOrder) => {
    if (order.status !== 'pending' && order.status !== 'approved') return false;
    if (!order.event?.start_date) return true;
    return new Date(order.event.start_date) > new Date();
  };

  const openCancelFlow = (order: TicketOrder) => {
    setCancelReasonIdx(null);
    setCancelOtherText('');
    setCancelFlow({ order, step: 'confirm' });
  };

  const submitCancellation = async () => {
    if (!cancelFlow || cancelReasonIdx === null) return;
    const reasons = t('kit.cancel.reasons', { returnObjects: true }) as string[];
    const reason = cancelReasonIdx === reasons.length - 1
      ? cancelOtherText.trim()
      : reasons[cancelReasonIdx];
    if (!reason) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/my-orders/${cancelFlow.order.id}/cancel?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) throw new Error('cancel failed');
      setCancelFlow(prev => prev ? { ...prev, step: 'success' } : null);
      fetchTicketOrders();
    } catch {
      toast.error(t('kit.cancel.failed'));
    } finally {
      setIsCancelling(false);
    }
  };

  const openReview = (eventId?: number | null, title?: string | null, image?: string | null, date?: string | null) => {
    if (!eventId) return;
    setReviewTarget({ eventId, title: title || '', image: image || undefined, date: date || undefined });
    setReviewRating(0);
    setReviewText('');
  };

  const submitReview = async () => {
    if (!reviewTarget || reviewRating === 0) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`${API_BASE_URL}/events/${reviewTarget.eventId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify({ rating: reviewRating, comment: reviewText.trim() || null })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || err?.detail || 'review failed');
      }
      toast.success(t('kit.review.submitted'));
      setReviewTarget(null);
    } catch (e) {
      toast.error((e as Error).message || t('kit.review.failed'));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isLoadingAll = isLoading || ordersLoading || productOrdersLoading;

  const tabs: { id: TicketsTab; label: string; count: number }[] = [
    { id: 'upcoming', label: t('kit.tickets.upcoming'), count: upcomingItems.length },
    { id: 'completed', label: t('kit.tickets.completed'), count: completedItems.length },
    { id: 'cancellation', label: t('kit.tickets.cancellation'), count: cancellationItems.length },
  ];

  const emptyContent: Record<TicketsTab, { title: string; desc: string }> = {
    upcoming: { title: t('kit.tickets.emptyUpcoming'), desc: t('kit.tickets.emptyUpcomingDesc') },
    completed: { title: t('kit.tickets.emptyCompleted'), desc: t('kit.tickets.emptyCompletedDesc') },
    cancellation: { title: t('kit.tickets.emptyCancellation'), desc: t('kit.tickets.emptyCancellationDesc') },
  };

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0">
          <h1 className="text-xl font-display text-white mb-3">{t('kit.tickets.title')}</h1>

          {/* Tab bar with accent underline */}
          <div className="flex" role="tablist" aria-label={t('kit.tickets.title')}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 min-h-[44px] pb-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-[#d3da0c]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${activeTab === tab.id ? 'bg-[#d3da0c] text-black' : 'bg-white/10 text-gray-400'}`}>
                      {tab.count}
                    </span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <motion.span layoutId="tickets-tab-underline" className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#d3da0c]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-8 text-center border border-[#d3da0c]/30 mb-8"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#d3da0c]/10 flex items-center justify-center">
                <Ticket className="w-7 h-7 text-[#d3da0c]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Access Your Event Tickets</h3>
              <p className="text-gray-300 max-w-md mx-auto mb-6 text-sm">
                Sign in to view your tickets, QR passes, and event entry details.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/login?redirect=/tickets"
                  className="w-full sm:w-auto px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all shadow-lg shadow-[#d3da0c]/20"
                >
                  Sign In to View Tickets
                </Link>
                <button
                  onClick={() => {
                    window.location.href = window.location.href.replace('http://', 'https://') + (window.location.href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 text-[#d3da0c]" />
                  Open in Default Browser
                </button>
              </div>
            </motion.div>
          )}

          {/* Loading skeletons */}
          {isLoadingAll && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 bg-[#111111] rounded-2xl border border-white/5 p-3 animate-pulse">
                  <div className="w-20 h-20 rounded-xl bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-white/5 rounded w-2/3" />
                    <div className="h-3 bg-white/5 rounded w-1/3" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoadingAll && currentItems.length > 0 && (
            <div className="space-y-3">
              {currentItems.map((item, index) => {
                const productOrder = isProductOrder(item) ? item : null;
                const ticketOrder = isTicketOrder(item) ? item : null;
                const regularTicket = !productOrder && !ticketOrder ? item as typeof tickets[0] : null;

                const status = productOrder
                  ? getProductOrderStatus(productOrder)
                  : ticketOrder
                    ? getTicketOrderStatus(ticketOrder)
                    : getTicketStatus(regularTicket!);
                const statusDisplay = getStatusDisplay(status);
                const eventDate = ticketOrder?.event
                  ? new Date(ticketOrder.event.start_date)
                  : regularTicket?.event
                    ? new Date(regularTicket.event.start_date)
                    : null;

                const title = productOrder
                  ? productOrder.product?.name || t('user.tickets.event')
                  : ticketOrder
                    ? ticketOrder.event?.title || t('user.tickets.event')
                    : regularTicket!.event?.title || t('user.tickets.event');
                const image = productOrder
                  ? productOrder.product?.image_url
                  : ticketOrder
                    ? ticketOrder.event?.flyer_image
                    : regularTicket!.event?.flyer_image;
                const price = productOrder
                  ? productOrder.payment_amount
                  : ticketOrder
                    ? ticketOrder.payment_amount
                    : null;

                const tagPills: string[] = [];
                if (ticketOrder) {
                  tagPills.push(ticketOrder.ticket_tier_name || t('user.tickets.standard'));
                  if (ticketOrder.quantity && ticketOrder.quantity > 1) tagPills.push(`×${ticketOrder.quantity}`);
                } else if (regularTicket) {
                  tagPills.push(regularTicket.ticket_tier?.name || t('user.tickets.standard'));
                } else if (productOrder) {
                  tagPills.push(productOrder.product?.vendor?.business_name || t('user.tickets.tba'));
                }

                const canViewTicket = !!productOrder
                  ? !!productOrder.order_qr_code
                  : true; // ticket orders and regular tickets always have a viewable ticket modal

                return (
                  <motion.div
                    key={productOrder ? `product-${productOrder.id}` : ticketOrder ? `order-${ticketOrder.id}` : `ticket-${regularTicket!.id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                    className="flex gap-3 bg-[#111111] rounded-2xl border border-white/5 p-3 hover:border-[#d3da0c]/20 transition-colors"
                  >
                    {/* Poster thumbnail */}
                    <Link
                      to={!productOrder && (ticketOrder?.event?.id || regularTicket?.event?.id) ? `/events/${ticketOrder?.event?.id || regularTicket?.event?.id}` : '#'}
                      className="shrink-0"
                      onClick={e => { if (productOrder) e.preventDefault(); }}
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center relative">
                        {image ? (
                          <img src={image} alt={title} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <Ticket className="w-6 h-6 text-gray-600" />
                        )}
                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${statusDisplay.class}`}>
                          {statusDisplay.text}
                        </span>
                      </div>
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link
                        to={!productOrder && (ticketOrder?.event?.id || regularTicket?.event?.id) ? `/events/${ticketOrder?.event?.id || regularTicket?.event?.id}` : '#'}
                        onClick={e => { if (productOrder) e.preventDefault(); }}
                        className="block"
                      >
                        <h3 className="text-sm font-semibold text-white truncate mb-1">{title}</h3>
                      </Link>

                      {tagPills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {tagPills.slice(0, 2).map((pill, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-white/5 text-gray-400 text-[10px] rounded-full">
                              {pill}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-gray-500 text-xs">
                        {eventDate && (
                          <>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#d3da0c]/70" />
                              {eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#d3da0c]/70" />
                              {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                        {productOrder && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-[#d3da0c]/70" />
                            {new Date(productOrder.created_at).toLocaleDateString()}
                          </span>
                        )}
                        {price != null && price > 0 && (
                          <span className="text-[#d3da0c] font-semibold">¥{price}</span>
                        )}
                      </div>

                      {(ticketOrder?.status === 'rejected' || productOrder?.status === 'rejected') && (ticketOrder?.rejection_reason || productOrder?.rejection_reason) && (
                        <p className="text-red-400/90 text-[11px] mt-1 truncate">Reason: {ticketOrder?.rejection_reason || productOrder?.rejection_reason}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                        {canViewTicket && (
                          <button
                            onClick={() => openItem(item)}
                            className="h-8 px-3 rounded-lg bg-[#d3da0c] text-black text-[11px] font-bold hover:bg-[#bbc10b] transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            {t('kit.tickets.viewTicket')}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleShare(item)}
                          aria-label={t('user.tickets.shareText', 'Share')}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors shrink-0"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        {regularTicket && (
                          <button
                            onClick={() => handleDownload(String(regularTicket.id))}
                            disabled={downloadingId === String(regularTicket.id)}
                            aria-label="Download"
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors disabled:opacity-50 shrink-0"
                          >
                            {downloadingId === String(regularTicket.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <div className="flex-1" />
                        {ticketOrder && (
                          <button
                            onClick={() => navigate(`/tickets/receipt/${ticketOrder.id}`)}
                            className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] font-semibold hover:bg-white/10 transition-colors whitespace-nowrap"
                          >
                            {t('receipt.title', 'E-Receipt')}
                          </button>
                        )}
                        {activeTab === 'upcoming' && ticketOrder && canCancelOrder(ticketOrder) && ticketOrder.event?.refunds_allowed && (
                          <button
                            onClick={() => openCancelFlow(ticketOrder)}
                            className="h-8 px-2.5 rounded-lg border border-red-500/40 text-red-400 text-[11px] font-semibold hover:bg-red-500/10 transition-colors whitespace-nowrap"
                          >
                            {t('kit.cancel.title')}
                          </button>
                        )}
                        {activeTab === 'completed' && !productOrder && (
                          <button
                            onClick={() => openReview(
                              ticketOrder ? ticketOrder.event?.id : (regularTicket?.event?.id != null ? Number(regularTicket.event.id) : null),
                              ticketOrder ? ticketOrder.event?.title : regularTicket?.event?.title,
                              ticketOrder ? ticketOrder.event?.flyer_image : regularTicket?.event?.flyer_image,
                              ticketOrder ? ticketOrder.event?.start_date : regularTicket?.event?.start_date,
                            )}
                            className="h-8 px-2.5 rounded-lg border border-[#d3da0c]/50 text-[#d3da0c] text-[11px] font-semibold hover:bg-[#d3da0c]/10 transition-colors whitespace-nowrap"
                          >
                            {t('kit.review.title')}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {!isLoadingAll && currentItems.length === 0 && (
            <div className="text-center py-20 px-6">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#111111] border border-white/10 flex items-center justify-center">
                <Ticket className="w-10 h-10 text-[#d3da0c]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{emptyContent[activeTab].title}</h3>
              <p className="text-gray-400 mb-6 text-sm">{emptyContent[activeTab].desc}</p>
              {activeTab === 'upcoming' && (
                <Link
                  to="/events"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-xl hover:bg-[#bbc10b] transition-colors min-h-[44px]"
                >
                  {t('kit.tickets.findEvents')}
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {(selectedTicket || selectedOrder || selectedProductOrder) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => { setSelectedTicket(null); setSelectedOrder(null); setSelectedProductOrder(null); setOrderIndividualTickets([]); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">{t('user.tickets.yourTicket')}</h3>
                <button
                  onClick={() => { setSelectedTicket(null); setSelectedOrder(null); setSelectedProductOrder(null); setOrderIndividualTickets([]); }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedProductOrder ? (
                <>
                  <div className="bg-white rounded-xl p-6 mb-6">
                    {selectedProductOrder.order_qr_code ? (
                      <img src={selectedProductOrder.order_qr_code} alt="Order QR" className="w-full h-auto" />
                    ) : (
                      <div className="text-center text-black">{t('user.tickets.noQrAvailable')}</div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">
                      {selectedProductOrder.product?.name || t('user.tickets.event')}
                    </p>
                    <p className="text-[#d3da0c] text-sm mt-2 font-mono">{selectedProductOrder.order_code}</p>
                  </div>
                </>
              ) : selectedOrder ? (
                <>
                  {selectedOrder.quantity > 1 ? (
                    <>
                      <div className="mb-4">
                        <p className="text-white font-semibold text-center mb-1">
                          {selectedOrder.event?.title || t('user.tickets.event')}
                        </p>
                        <p className="text-gray-400 text-sm text-center">
                          {selectedOrder.quantity} {selectedOrder.quantity > 1 ? t('user.tickets.tickets') : t('user.tickets.ticket')}
                        </p>
                      </div>
                      {loadingOrderTickets ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                          {orderIndividualTickets.map((ticket, idx) => (
                            <div key={ticket.id} className="bg-white rounded-xl p-3">
                              <p className="text-center text-black text-xs font-semibold mb-2">
                                #{idx + 1}
                              </p>
                              {ticket.qr_code ? (
                                <img src={ticket.qr_code} alt={`Ticket QR #${idx + 1}`} className="w-full h-auto" />
                              ) : (
                                <QRCodeSVG
                                  value={ticket.ticket_number}
                                  size={120}
                                  className="w-full"
                                  level="H"
                                />
                              )}
                              <p className="text-center text-black text-[10px] font-mono mt-2 truncate">
                                {ticket.ticket_number}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-white rounded-xl p-6 mb-6">
                        {selectedOrder.ticket_qr ? (
                          <img src={selectedOrder.ticket_qr} alt="Ticket QR" className="w-full h-auto" />
                        ) : loadingOrderTickets ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
                          </div>
                        ) : orderIndividualTickets.length > 0 ? (
                          orderIndividualTickets[0].qr_code ? (
                            <img src={orderIndividualTickets[0].qr_code} alt="Ticket QR" className="w-full h-auto" />
                          ) : (
                            <QRCodeSVG value={orderIndividualTickets[0].ticket_number} size={200} className="w-full" level="H" />
                          )
                        ) : selectedOrder.status === 'pending' ? (
                          <div className="text-center text-black">{t('user.tickets.qrAfterApproval')}</div>
                        ) : (
                          <QRCodeSVG value={selectedOrder.ticket_code || `ORDER-${selectedOrder.id}`} size={200} className="w-full" level="H" />
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-white font-semibold mb-1">
                          {selectedOrder.event?.title || t('user.tickets.event')}
                        </p>
                        <p className="text-[#d3da0c] text-sm mt-2 font-mono">{selectedOrder.ticket_code || orderIndividualTickets[0]?.ticket_number || ''}</p>
                        <p className="text-gray-500 text-xs mt-2">{t('receipt.scanHint', 'Show this QR at the entrance — staff scan to validate.')}</p>
                      </div>
                    </>
                  )}
                </>
              ) : (() => {
                const ticket = tickets.find(t => t.id === selectedTicket);
                if (!ticket) return null;
                return (
                  <>
                    <div className="bg-white rounded-xl p-6 mb-6">
                      <QRCodeSVG
                        value={ticket.ticket_number}
                        size={200}
                        className="w-full"
                        level="H"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold mb-1">
                        {ticket.event?.title || t('user.tickets.event')}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {ticket.ticket_tier?.name || t('user.tickets.standard')}
                      </p>
                      <p className="text-[#d3da0c] text-sm mt-2">{ticket.ticket_number}</p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-gray-400 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{t('user.tickets.showQrAtEntrance')}</span>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel booking flow: confirm -> reason -> success */}
      {createPortal(
      <AnimatePresence>
        {cancelFlow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setCancelFlow(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#111111] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md border-t sm:border border-white/10 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {cancelFlow.step === 'confirm' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    {cancelFlow.order.event?.flyer_image && (
                      <img src={cancelFlow.order.event.flyer_image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white">{t('kit.cancel.confirmTitle')}</h3>
                      <p className="text-gray-400 text-sm truncate">{cancelFlow.order.event?.title}</p>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{t('kit.cancel.confirmDesc')}</p>
                  <p className="text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2 mb-5">
                    {cancelFlow.order.event?.refund_policy
                      ? t('kit.cancel.refundNote', { policy: cancelFlow.order.event.refund_policy })
                      : t('kit.cancel.refundUnknown')}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCancelFlow(null)}
                      className="flex-1 min-h-[44px] bg-white/5 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors"
                    >
                      {t('kit.cancel.dontCancel')}
                    </button>
                    <button
                      onClick={() => setCancelFlow(prev => prev ? { ...prev, step: 'reason' } : null)}
                      className="flex-1 min-h-[44px] bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
                    >
                      {t('kit.cancel.yesCancel')}
                    </button>
                  </div>
                </>
              )}

              {cancelFlow.step === 'reason' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">{t('kit.cancel.title')}</h3>
                    <button onClick={() => setCancelFlow(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">{t('kit.cancel.reasonTitle')}</p>
                  <div className="space-y-1 mb-4">
                    {(t('kit.cancel.reasons', { returnObjects: true }) as string[]).map((reason, idx) => {
                      const isLast = idx === (t('kit.cancel.reasons', { returnObjects: true }) as string[]).length - 1;
                      const selected = cancelReasonIdx === idx;
                      return (
                        <div key={idx}>
                          <button
                            onClick={() => setCancelReasonIdx(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors min-h-[44px] ${selected ? 'bg-[#d3da0c]/10 border border-[#d3da0c]/40' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                          >
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-[#d3da0c]' : 'border-gray-600'}`}>
                              {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#d3da0c]" />}
                            </span>
                            <span className={`text-sm ${selected ? 'text-[#d3da0c]' : 'text-white'}`}>{reason}</span>
                          </button>
                          {isLast && selected && (
                            <textarea
                              autoFocus
                              value={cancelOtherText}
                              onChange={e => setCancelOtherText(e.target.value)}
                              placeholder={t('kit.cancel.otherPlaceholder')}
                              rows={2}
                              className="w-full mt-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:border-[#d3da0c]/60 focus:outline-none resize-none"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={submitCancellation}
                    disabled={isCancelling || cancelReasonIdx === null || (cancelReasonIdx === (t('kit.cancel.reasons', { returnObjects: true }) as string[]).length - 1 && !cancelOtherText.trim())}
                    className="w-full min-h-[48px] bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {isCancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('kit.cancel.submit')}
                  </button>
                </>
              )}

              {cancelFlow.step === 'success' && (
                <>
                  <div className="flex flex-col items-center text-center py-2">
                    <div className="w-16 h-16 rounded-full bg-[#d3da0c]/15 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-9 h-9 text-[#d3da0c]" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">{t('kit.cancel.successTitle')}</h3>
                    <p className="text-gray-400 text-sm mb-2">{t('kit.cancel.successDesc')}</p>
                    <p className="text-gray-500 text-xs mb-6">{t('kit.cancel.refundTimeline')}</p>
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => { setCancelFlow(null); setActiveTab('cancellation'); }}
                        className="flex-1 min-h-[44px] bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
                      >
                        {t('kit.cancel.viewBooking')}
                      </button>
                      <button
                        onClick={() => setCancelFlow(null)}
                        className="flex-1 min-h-[44px] bg-white/5 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors"
                      >
                        {t('kit.cancel.ok')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}

      {/* Leave a review modal */}
      {createPortal(
      <AnimatePresence>
        {reviewTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setReviewTarget(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#111111] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md border-t sm:border border-white/10 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{t('kit.review.title')}</h3>
                <button onClick={() => setReviewTarget(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Event summary card */}
              <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 mb-5">
                {reviewTarget.image && (
                  <img src={reviewTarget.image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{reviewTarget.title}</p>
                  {reviewTarget.date && (
                    <p className="text-xs text-gray-500">{new Date(reviewTarget.date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-1">{t('kit.review.heading', { event: reviewTarget.title })}</p>
              <p className="text-xs text-gray-500 mb-4">{t('kit.review.subtitle')}</p>

              {/* Star selector */}
              <div className="flex justify-center gap-2 mb-5" role="radiogroup" aria-label={t('kit.review.starLabel')}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    aria-label={`${star}/5`}
                    className="p-1 transition-transform active:scale-90"
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${star <= reviewRating ? 'text-[#d3da0c] fill-[#d3da0c]' : 'text-gray-600'}`}
                    />
                  </button>
                ))}
              </div>

              <label className="block text-xs text-gray-500 mb-1.5">{t('kit.review.write')}</label>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder={t('kit.review.placeholder')}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:border-[#d3da0c]/60 focus:outline-none resize-none mb-5"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setReviewTarget(null)}
                  className="flex-1 min-h-[44px] bg-white/5 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors"
                >
                  {t('kit.review.later')}
                </button>
                <button
                  onClick={submitReview}
                  disabled={isSubmittingReview || reviewRating === 0}
                  className="flex-1 min-h-[44px] bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {isSubmittingReview && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('kit.review.submit')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body)}
    </div>
  );
};

export default Tickets;
