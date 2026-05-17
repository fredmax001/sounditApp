import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import {
  Ticket, Loader2, User, CheckCircle2, XCircle, Clock, Search, Eye,
  QrCode, Calendar, Download, Filter, Smartphone, Plus, X, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface OrderTicket {
  id: number;
  ticket_number: string;
  qr_code: string;
  qr_token: string;
  is_used: boolean;
  used_at?: string;
  status: string;
}

interface TicketOrder {
  id: number;
  event: { id: number; title: string };
  user: { id: number; name: string; email: string; phone?: string };
  quantity?: number;
  payment_amount: number;
  payer_name: string;
  payment_screenshot: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  auto_approved?: boolean;
  tickets_generated?: number;
  used_at?: string;
  used_by?: number;
  is_guest_order?: boolean;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  ticket_tier?: { id: number; name: string } | null;
  tickets?: OrderTicket[];
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-400', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-500/10 text-green-400', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-400', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-400', icon: XCircle },
  used: { label: 'Used', color: 'bg-blue-500/10 text-blue-400', icon: CheckCircle2 },
};

const TicketOrdersPage = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();

  const [orders, setOrders] = useState<TicketOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'used'>('all');
  const [eventFilter, setEventFilter] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [selectedOrderTickets, setSelectedOrderTickets] = useState<TicketOrder | null>(null);

  // Guest order modal state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [events, setEvents] = useState<Array<{ id: number; title: string }>>([]);
  const [ticketTiers, setTicketTiers] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [guestForm, setGuestForm] = useState({
    event_id: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    quantity: '1',
    ticket_tier_id: '',
  });
  const [isSubmittingGuest, setIsSubmittingGuest] = useState(false);

  const fetchEvents = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/events/my-events`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEvents(data.map((e: any) => ({ id: e.id, title: e.title })));
      }
    } catch {
      // silently fail
    }
  };

  const fetchTicketTiers = async (eventId: number) => {
    if (!session?.access_token || !eventId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/events/${eventId}/ticket-tiers`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTicketTiers(data.map((t: any) => ({ id: t.id, name: t.name, price: t.price })));
      }
    } catch {
      setTicketTiers([]);
    }
  };

  const handleCreateGuestOrder = async () => {
    if (!session?.access_token) return;
    if (!guestForm.event_id || !guestForm.guest_name || !guestForm.guest_email) {
      toast.error(t('business.ticketOrders.fillRequired') || 'Please fill in all required fields');
      return;
    }
    setIsSubmittingGuest(true);
    try {
      const res = await fetch(`${API_BASE_URL}/ticketing/organizer/guest-order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: Number(guestForm.event_id),
          guest_name: guestForm.guest_name,
          guest_email: guestForm.guest_email,
          guest_phone: guestForm.guest_phone || undefined,
          quantity: Number(guestForm.quantity) || 1,
          ticket_tier_id: guestForm.ticket_tier_id ? Number(guestForm.ticket_tier_id) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.ticketOrders.guestOrderCreated') || 'Guest ticket created');
        setShowGuestModal(false);
        setGuestForm({ event_id: '', guest_name: '', guest_email: '', guest_phone: '', quantity: '1', ticket_tier_id: '' });
        fetchOrders();
      } else {
        toast.error(data.detail || t('business.ticketOrders.guestOrderFailed') || 'Failed to create guest ticket');
      }
    } catch {
      toast.error(t('business.ticketOrders.guestOrderFailed') || 'Failed to create guest ticket');
    } finally {
      setIsSubmittingGuest(false);
    }
  };

  const fetchOrders = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (eventFilter !== 'all') params.append('event_id', String(eventFilter));
      const url = `${API_BASE_URL}/tickets/business/tickets${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
      } else {
        toast.error(data.detail || t('business.dashboard.failedToLoadTicketOrders') || 'Failed to load ticket orders');
      }
    } catch {
      toast.error(t('business.dashboard.failedToLoadTicketOrders') || 'Failed to load ticket orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [session, filter, eventFilter]);

  const handleApprove = async (id: number) => {
    if (!session?.access_token) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.dashboard.approve') || 'Approved');
        fetchOrders();
      } else {
        toast.error(data.detail || t('business.dashboard.failedToApprove') || 'Failed to approve');
      }
    } catch {
      toast.error(t('business.dashboard.failedToApprove') || 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt(t('business.dashboard.enterRejectionReason') || 'Enter rejection reason:');
    if (!reason || !session?.access_token) return;
    setProcessingId(id);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      const res = await fetch(`${API_BASE_URL}/tickets/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.dashboard.reject') || 'Rejected');
        fetchOrders();
      } else {
        toast.error(data.detail || t('business.dashboard.failedToReject') || 'Failed to reject');
      }
    } catch {
      toast.error(t('business.dashboard.failedToReject') || 'Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  // Unique events for the filter dropdown
  const uniqueEvents = Array.from(
    new Map(orders.map((o) => [o.event.id, o.event])).values()
  ).sort((a, b) => a.title.localeCompare(b.title));

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      (o.payer_name || '').toLowerCase().includes(term) ||
      (o.user?.email || '').toLowerCase().includes(term) ||
      (o.user?.phone || '').toLowerCase().includes(term) ||
      (o.event?.title || '').toLowerCase().includes(term) ||
      (o.ticket_tier?.name || '').toLowerCase().includes(term) ||
      (o.ticket_code || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display text-white mb-1 flex items-center gap-3">
            <Ticket className="w-8 h-8 text-[#d3da0c]" />
            {t('business.dashboard.ticketOrders') || 'Ticket Orders'}
          </h1>
          <p className="text-gray-400">{t('business.dashboard.manageTicketOrders') || 'Manage and approve ticket orders for your events.'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => { setShowGuestModal(true); fetchEvents(); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {t('business.ticketOrders.addGuestTicket') || 'Add Guest Ticket'}
          </button>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search') || 'Search orders...'}
              className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-64 text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-40 appearance-none text-sm"
            >
              <option value="all">{t('business.dashboard.all') || 'All'}</option>
              <option value="pending">{t('business.dashboard.pending') || 'Pending'}</option>
              <option value="approved">{t('business.dashboard.approved') || 'Approved'}</option>
              <option value="rejected">{t('business.dashboard.rejected') || 'Rejected'}</option>
              <option value="used">{t('business.dashboard.used') || 'Used'}</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-52 appearance-none text-sm"
            >
              <option value="all">{t('business.dashboard.allEvents') || 'All Events'}</option>
              {uniqueEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Guest Order Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                {t('business.ticketOrders.addGuestTicket') || 'Add Guest Ticket'}
              </h2>
              <button onClick={() => setShowGuestModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.event') || 'Event'} *</label>
                <select
                  value={guestForm.event_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuestForm({ ...guestForm, event_id: val, ticket_tier_id: '' });
                    if (val) fetchTicketTiers(Number(val));
                  }}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                >
                  <option value="">{t('business.ticketOrders.selectEvent') || 'Select event...'}</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.guestName') || 'Guest Name'} *</label>
                <input
                  type="text"
                  value={guestForm.guest_name}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.guestEmail') || 'Guest Email'} *</label>
                <input
                  type="email"
                  value={guestForm.guest_email}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.guestPhone') || 'Guest Phone'}</label>
                <input
                  type="tel"
                  value={guestForm.guest_phone}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_phone: e.target.value })}
                  placeholder="+86138xxxx"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.quantity') || 'Quantity'} *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={guestForm.quantity}
                    onChange={(e) => setGuestForm({ ...guestForm, quantity: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">{t('business.ticketOrders.ticketTier') || 'Ticket Tier'}</label>
                  <select
                    value={guestForm.ticket_tier_id}
                    onChange={(e) => setGuestForm({ ...guestForm, ticket_tier_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#d3da0c]"
                  >
                    <option value="">{t('business.ticketOrders.default') || 'Default'}</option>
                    {ticketTiers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (¥{t.price})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowGuestModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-white text-sm font-bold rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreateGuestOrder}
                disabled={isSubmittingGuest}
                className="flex-1 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('business.ticketOrders.create') || 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#d3da0c] mx-auto" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-gray-400">
          <Ticket className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-medium text-white mb-1">{t('business.dashboard.noTicketOrders') || 'No ticket orders found'}</p>
          <p className="text-sm">{t('business.dashboard.noTicketOrdersHint') || 'Orders will appear here once customers purchase tickets.'}</p>
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 text-gray-400 text-xs font-medium border-b border-white/5">
            <div className="col-span-2">{t('business.dashboard.name') || 'Name'}</div>
            <div className="col-span-2">{t('business.dashboard.email') || 'Email'}</div>
            <div className="col-span-1">{t('business.dashboard.mobile') || 'Mobile'}</div>
            <div className="col-span-2">{t('business.dashboard.eventName') || 'Event'}</div>
            <div className="col-span-1">{t('business.dashboard.ticketType') || 'Type'}</div>
            <div className="col-span-1 text-center">{t('business.dashboard.checkIn') || 'Check'}</div>
            <div className="col-span-1 text-center">{t('business.dashboard.amount') || 'Amt'}</div>
            <div className="col-span-2 text-right">{t('common.actions') || 'Actions'}</div>
          </div>

          <div className="divide-y divide-white/5">
            {filteredOrders.map((order, idx) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const isCheckIn = order.status === 'used' || !!order.used_at;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="px-4 py-3"
                >
                  {/* Desktop Row — single straight line, compact */}
                  <div className="hidden lg:grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <p className="text-white text-xs font-medium truncate flex items-center gap-1">
                        {order.payer_name || order.user?.name || '-'}
                        {order.is_guest_order && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase">Guest</span>
                        )}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-300 text-xs truncate">{order.user?.email || '-'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-gray-300 text-xs truncate">{order.user?.phone || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-300 text-xs truncate">{order.event?.title || '-'}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-gray-300 text-xs truncate">{order.ticket_tier?.name || '-'}</p>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {isCheckIn ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('business.dashboard.in') || 'In'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          {t('business.dashboard.out') || 'Out'}
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 text-center">
                      <p className="text-gray-300 text-xs">¥{order.payment_amount?.toLocaleString?.() || order.payment_amount}</p>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {order.payment_screenshot && (
                        <button
                          onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                          className="px-1.5 py-1 rounded bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
                          title={t('business.tableReservations.viewPaymentProof') || 'Proof'}
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      {order.tickets && order.tickets.length > 0 && (
                        <button
                          onClick={() => setSelectedOrderTickets(order)}
                          className="px-1.5 py-1 rounded bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
                          title={`${order.tickets.length} ticket(s)`}
                        >
                          <QrCode className="w-3 h-3" />
                          <span className="text-[10px]">{order.tickets.length}</span>
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={processingId === order.id}
                            className="px-1.5 py-1 rounded bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (t('business.dashboard.approve') || 'Ok')}
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={processingId === order.id}
                            className="px-1.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {t('business.dashboard.reject') || 'No'}
                          </button>
                        </>
                      )}
                      {order.status !== 'pending' && (
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${status.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="lg:hidden">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-white font-semibold flex items-center gap-1">
                          {order.payer_name || order.user?.name || '-'}
                          {order.is_guest_order && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">Guest</span>
                          )}
                        </p>
                        <p className="text-gray-400 text-sm">{order.user?.email || '-'}</p>
                        {order.user?.phone && (
                          <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                            <Smartphone className="w-3 h-3" /> {order.user.phone}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.eventName') || 'Event'}</p>
                        <p className="text-gray-300 truncate">{order.event?.title || '-'}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.ticketType') || 'Ticket Type'}</p>
                        <p className="text-gray-300 truncate">{order.ticket_tier?.name || '-'}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.checkIn') || 'Check In'}</p>
                        <p className={`text-xs font-medium ${isCheckIn ? 'text-green-400' : 'text-gray-400'}`}>
                          {isCheckIn ? (t('business.dashboard.checkedIn') || 'Checked In') : (t('business.dashboard.notCheckedIn') || 'Not Checked In')}
                          {order.used_at && (
                            <span className="block text-gray-500 font-normal">
                              {new Date(order.used_at).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 text-xs mb-0.5">{t('business.dashboard.amount') || 'Amount'}</p>
                        <p className="text-gray-300 truncate">¥{order.payment_amount?.toLocaleString?.() || order.payment_amount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {order.payment_screenshot && (
                        <button
                          onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                          className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          {t('business.tableReservations.viewPaymentProof') || 'Proof'}
                        </button>
                      )}
                      {order.tickets && order.tickets.length > 0 && (
                        <button
                          onClick={() => setSelectedOrderTickets(order)}
                          className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          <QrCode className="w-4 h-4" />
                          {order.tickets.length} {order.tickets.length === 1 ? 'Ticket' : 'Tickets'}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={processingId === order.id}
                            className="px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('business.dashboard.approve') || 'Approve')}
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={processingId === order.id}
                            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {t('business.dashboard.reject') || 'Reject'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="bg-[#141414] rounded-2xl p-4 max-w-2xl w-full border border-white/10">
            <img
              src={selectedScreenshot}
              alt="Payment proof"
              className="w-full rounded-xl"
              onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedQr && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedQr(null)}
        >
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center">
            <img src={selectedQr} alt="Ticket QR" className="w-48 h-48 mx-auto rounded-xl" />
            <p className="text-gray-400 text-sm mt-4">{t('business.dashboard.ticketQrCode') || 'Ticket QR Code'}</p>
            <div className="flex justify-center gap-3 mt-4">
              <a
                href={selectedQr}
                download
                className="px-4 py-2 rounded-lg bg-[#d3da0c] text-black text-sm font-medium hover:bg-[#bbc10b] flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('common.download') || 'Download'}
              </a>
              <button
                onClick={() => setSelectedQr(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Tickets Modal — for organizer check-in scanning */}
      {selectedOrderTickets && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedOrderTickets(null)}
        >
          <div
            className="bg-[#141414] rounded-2xl p-6 max-w-2xl w-full border border-white/10 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {selectedOrderTickets.payer_name || selectedOrderTickets.user?.name || 'Guest'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {selectedOrderTickets.event?.title} · {selectedOrderTickets.quantity} ticket(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderTickets(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedOrderTickets.tickets?.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className={`bg-white rounded-xl p-4 text-center ${ticket.is_used ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-black font-bold text-sm">#{idx + 1}</span>
                    {ticket.is_used ? (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">
                        USED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#d3da0c] text-black text-[10px] font-bold rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {ticket.qr_code ? (
                    <img
                      src={ticket.qr_code}
                      alt={`Ticket QR #${idx + 1}`}
                      className="w-full h-auto rounded-lg"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-black text-xs">
                      No QR
                    </div>
                  )}
                  <p className="text-black text-[10px] font-mono mt-2 truncate">
                    {ticket.ticket_number}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={() => setSelectedOrderTickets(null)}
                className="px-6 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketOrdersPage;
