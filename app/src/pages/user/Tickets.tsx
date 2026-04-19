import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Clock, X, Download, Share2, Check, Loader2, Ticket, Package } from 'lucide-react';
import { useTicketStore } from '@/store/ticketStore';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

interface TicketOrder {
  id: number;
  event: {
    id: number;
    title: string;
    start_date: string;
    flyer_image?: string;
  };
  payment_amount: number;
  quantity?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  tickets_generated?: number;
  auto_approved?: boolean;
  rejection_reason?: string;
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

const Tickets = () => {
  const { t } = useTranslation();
  const { tickets, fetchUserTickets, isLoading } = useTicketStore();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TicketOrder | null>(null);

  const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);
  const [productOrdersLoading, setProductOrdersLoading] = useState(false);
  const [selectedProductOrder, setSelectedProductOrder] = useState<ProductOrder | null>(null);

  useEffect(() => {
    fetchUserTickets();
    fetchTicketOrders();
    fetchProductOrders();
  }, [fetchUserTickets]);

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
    return o.status === 'rejected' || o.status === 'cancelled' || (o.status === 'approved' && eventDate && eventDate <= now);
  });

  const activeProductOrders = productOrders.filter(o => o.status === 'pending' || o.status === 'approved');
  const pastProductOrders = productOrders.filter(o => o.status === 'rejected' || o.status === 'used');

  const combinedActive = [...activeTickets, ...activeTicketOrders, ...pendingTicketOrders, ...activeProductOrders];
  const combinedPast = [...pastTickets, ...pastTicketOrders, ...pastProductOrders];

  const currentItems = activeTab === 'active' ? combinedActive : combinedPast;

  const handleShare = async (item: typeof tickets[0] | TicketOrder | ProductOrder) => {
    const isProduct = isProductOrder(item);
    const isOrder = isTicketOrder(item);
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
      url: window.location.origin + (isProduct ? '/events' : `/events/${(item as TicketOrder | typeof tickets[0]).event?.id || ''}`)
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
    const eventDate = ticket.event ? new Date(ticket.event.start_date) : null;
    if (eventDate && eventDate <= now) return 'expired';
    return 'active';
  };

  const getTicketOrderStatus = (order: TicketOrder) => {
    if (order.status === 'rejected') return 'rejected';
    if (order.status === 'pending') return 'pending';
    const eventDate = order.event ? new Date(order.event.start_date) : null;
    if (eventDate && eventDate <= now) return 'expired';
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
        return { text: 'Used', class: 'bg-gray-500/20 text-gray-500' };
      case 'expired':
        return { text: t('user.tickets.statusExpired'), class: 'bg-red-500/20 text-red-500' };
      case 'pending':
        return { text: 'Pending', class: 'bg-yellow-500/20 text-yellow-500' };
      case 'rejected':
        return { text: 'Rejected', class: 'bg-red-500/20 text-red-500' };
      case 'cancelled':
        return { text: 'Cancelled', class: 'bg-gray-500/20 text-gray-500' };
      default:
        return { text: status, class: 'bg-gray-500/20 text-gray-500' };
    }
  };

  const isTicketOrder = (item: any): item is TicketOrder => 'ticket_code' in item;
  const isProductOrder = (item: any): item is ProductOrder => 'order_code' in item;

  return (
    <div className="min-h-screen pt-20 pb-24">
      <section className="relative py-16 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <span className="inline-block text-[#d3da0c] text-sm font-medium tracking-wider uppercase mb-4">
              {t('user.tickets.myCollection')}
            </span>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-6">
              {t('user.tickets.my')}{' '}
              <span className="text-[#d3da0c]">{t('user.tickets.tickets')}</span>
            </h1>
          </motion.div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'active'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
            >
              {t('user.tickets.active', { count: combinedActive.length })}
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'past'
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
            >
              {t('user.tickets.past', { count: combinedPast.length })}
            </button>
          </div>

          {(isLoading || ordersLoading || productOrdersLoading) && (
            <div className="text-center py-24">
              <div className="w-12 h-12 mx-auto mb-4 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400">{t('user.tickets.loadingTickets')}</p>
            </div>
          )}

          {!isLoading && !ordersLoading && !productOrdersLoading && currentItems.length > 0 ? (
            <div className="space-y-6">
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

                return (
                  <motion.div
                    key={productOrder ? `product-${productOrder.id}` : ticketOrder ? `order-${ticketOrder.id}` : `ticket-${regularTicket!.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass rounded-2xl overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="md:w-48 h-48 md:h-auto relative">
                        <img
                          src={productOrder
                            ? productOrder.product?.image_url || '/event_placeholder.jpg'
                            : ticketOrder
                              ? ticketOrder.event?.flyer_image || '/event_placeholder.jpg'
                              : regularTicket!.event?.flyer_image || '/event_placeholder.jpg'}
                          alt={productOrder
                            ? productOrder.product?.name || t('user.tickets.event')
                            : ticketOrder
                              ? ticketOrder.event?.title || t('user.tickets.event')
                              : regularTicket!.event?.title || t('user.tickets.event')}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0A0A0A]/80 md:bg-gradient-to-l" />
                      </div>

                      <div className="flex-1 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-white mb-1">
                              {productOrder
                                ? productOrder.product?.name || t('user.tickets.event')
                                : ticketOrder
                                  ? ticketOrder.event?.title || t('user.tickets.event')
                                  : regularTicket!.event?.title || t('user.tickets.event')}
                            </h3>
                            <span className={`inline-block px-3 py-1 text-xs rounded-full ${statusDisplay.class}`}>
                              {statusDisplay.text}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[#d3da0c] font-bold">
                              {productOrder
                                ? (productOrder.order_qr_code ? 'QR Order' : 'Product Order')
                                : ticketOrder
                                  ? (ticketOrder.ticket_code ? `QR Ticket${ticketOrder.quantity && ticketOrder.quantity > 1 ? ` x${ticketOrder.quantity}` : ''}` : 'Manual Order')
                                  : (regularTicket!.ticket_tier?.name || t('user.tickets.standard'))}
                            </p>
                            <p className="text-gray-500 text-sm">
                              {productOrder ? productOrder.order_code : ticketOrder ? ticketOrder.ticket_code : regularTicket!.ticket_number}
                            </p>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2 text-gray-400">
                            {productOrder ? (
                              <>
                                <Package className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {productOrder.product?.vendor?.business_name || t('user.tickets.tba')}
                                </span>
                              </>
                            ) : (
                              <>
                                <Calendar className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {eventDate ? eventDate.toLocaleDateString() : t('user.tickets.tba')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            {productOrder ? (
                              <>
                                <Clock className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {productOrder.created_at ? new Date(productOrder.created_at).toLocaleDateString() : t('user.tickets.tba')}
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-4 h-4 text-[#d3da0c]" />
                                <span className="text-sm">
                                  {eventDate ? eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('user.tickets.tba')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <MapPin className="w-4 h-4 text-[#d3da0c]" />
                            <span className="text-sm">
                              {regularTicket ? regularTicket.event?.city : t('user.tickets.tba')}
                            </span>
                          </div>
                        </div>

                        {(ticketOrder?.status === 'rejected' || productOrder?.status === 'rejected') && (ticketOrder?.rejection_reason || productOrder?.rejection_reason) && (
                          <p className="text-red-400 text-sm mb-4">Reason: {ticketOrder?.rejection_reason || productOrder?.rejection_reason}</p>
                        )}

                        {(status === 'active' || status === 'pending') && (
                          <div className="flex gap-3">
                            {productOrder && productOrder.order_qr_code ? (
                              <button
                                onClick={() => setSelectedProductOrder(productOrder)}
                                className="flex-1 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                              >
                                Show QR Code
                              </button>
                            ) : ticketOrder && status === 'active' ? (
                              <button
                                onClick={() => setSelectedOrder(ticketOrder)}
                                className="flex-1 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                              >
                                Show QR Code
                              </button>
                            ) : regularTicket ? (
                              <button
                                onClick={() => setSelectedTicket(String(regularTicket.id))}
                                className="flex-1 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                              >
                                {t('user.tickets.showQrCode')}
                              </button>
                            ) : null}
                            {(regularTicket || productOrder || ticketOrder) && (
                              <button
                                onClick={() => handleShare(item)}
                                className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                              >
                                <Share2 className="w-5 h-5" />
                              </button>
                            )}
                            {regularTicket && (
                              <button
                                onClick={() => handleDownload(String(regularTicket.id))}
                                disabled={downloadingId === String(regularTicket.id)}
                                className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                              >
                                {downloadingId === String(regularTicket.id) ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Download className="w-5 h-5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : !isLoading && !ordersLoading && !productOrdersLoading && (
            <div className="text-center py-24">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#111111] flex items-center justify-center">
                <Calendar className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {activeTab === 'active' ? t('user.tickets.noActiveTickets') : t('user.tickets.noPastTickets')}
              </h3>
              <p className="text-gray-400">
                {activeTab === 'active'
                  ? t('user.tickets.browseAndBook')
                  : t('user.tickets.pastEventsAppearHere')}
              </p>
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
            onClick={() => { setSelectedTicket(null); setSelectedOrder(null); setSelectedProductOrder(null); }}
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
                  onClick={() => { setSelectedTicket(null); setSelectedOrder(null); setSelectedProductOrder(null); }}
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
                  <div className="bg-white rounded-xl p-6 mb-6">
                    {selectedOrder.ticket_qr ? (
                      <img src={selectedOrder.ticket_qr} alt="Ticket QR" className="w-full h-auto" />
                    ) : (
                      <div className="text-center text-black">{t('user.tickets.noQrAvailable')}</div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold mb-1">
                      {selectedOrder.event?.title || t('user.tickets.event')}
                    </p>
                    <p className="text-[#d3da0c] text-sm mt-2 font-mono">{selectedOrder.ticket_code}</p>
                  </div>
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
    </div>
  );
};

export default Tickets;
