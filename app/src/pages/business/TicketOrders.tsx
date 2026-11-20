import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import {
  Ticket, Loader2, CheckCircle2, XCircle, Clock, Search, Eye,
  QrCode, Calendar, Download, Plus, X, UserPlus, ChevronLeft,
  SlidersHorizontal, ChevronRight, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

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
  buyer_confirmed?: boolean;
  buyer_confirmed_at?: string | null;
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

const getInitials = (name: string) => {
  const parts = (name || 'Guest').trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (name || 'GU').slice(0, 2).toUpperCase();
};

const TicketOrdersPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuthStore();

  const [orders, setOrders] = useState<TicketOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'used'>('all');
  const [eventFilter, setEventFilter] = useState<number | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'week' | 'today'>('all');
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [selectedOrderTickets, setSelectedOrderTickets] = useState<TicketOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<TicketOrder | null>(null);

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
      const res = await fetch(`${API_BASE_URL}/events/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEvents(data.map((e: any) => ({ id: e.id, title: e.title })));
      }
    } catch {
      // ignore
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
        setTicketTiers(data.map((tier: any) => ({ id: tier.id, name: tier.name, price: tier.price })));
      }
    } catch {
      setTicketTiers([]);
    }
  };

  const handleCreateGuestOrder = async () => {
    if (!session?.access_token) {
      toast.error('Please sign in to issue guest tickets');
      return;
    }
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
        toast.success(data.message || 'Guest ticket created.');
        if (data.payment_url) {
          window.open(data.payment_url, '_blank', 'noopener,noreferrer');
        }
        setShowGuestModal(false);
        setGuestForm({ event_id: '', guest_name: '', guest_email: '', guest_phone: '', quantity: '1', ticket_tier_id: '' });
        fetchOrders();
      } else {
        toast.error(data.detail || 'Failed to create guest ticket');
      }
    } catch {
      toast.error('Failed to create guest ticket');
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
      }
    } catch {
      // Fallback orders used if offline/unauthenticated
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [session, filter, eventFilter]);

  const handleApprove = async (id: number) => {
    if (id >= 9000 && !session?.access_token) {
      toast.success('Order approved');
      setDetailOrder(null);
      return;
    }
    if (!session?.access_token) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Approved');
        setDetailOrder(null);
        fetchOrders();
      } else {
        toast.error(data.detail || 'Failed to approve');
      }
    } catch {
      toast.error('Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    if (id >= 9000 && !session?.access_token) {
      toast.success('Order rejected');
      setDetailOrder(null);
      return;
    }
    if (!session?.access_token) return;
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
        toast.success(data.message || 'Rejected');
        setDetailOrder(null);
        fetchOrders();
      } else {
        toast.error(data.detail || 'Failed to reject');
      }
    } catch {
      toast.error('Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      ['Order ID', 'Buyer Name', 'Email', 'Event', 'Tier', 'Qty', 'Amount (CNY)', 'Status'],
      ...filteredOrders.map((o) => [
        String(o.id),
        o.payer_name || o.user?.name || 'Guest',
        o.user?.email || o.guest_email || '',
        o.event?.title || '',
        o.ticket_tier?.name || 'General Admission',
        String(o.quantity || 1),
        String(o.payment_amount || 0),
        o.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `soundit-ticket-orders.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ticket orders exported');
  };

  const activeSourceOrders = orders;

  const uniqueEvents = Array.from(
    new Map(activeSourceOrders.map((o) => [o.event.id, o.event])).values()
  ).sort((a, b) => a.title.localeCompare(b.title));

  const filteredOrders = activeSourceOrders.filter((o) => {
    const usedCount = o.tickets?.filter((t) => t.is_used).length || 0;
    const isCheckedIn = o.status === 'used' || usedCount > 0;

    if (filter === 'pending' && o.status !== 'pending') return false;
    if (filter === 'approved' && o.status !== 'approved') return false;
    if (filter === 'used' && !isCheckedIn) return false;

    if (eventFilter !== 'all' && o.event?.id !== eventFilter) return false;

    if (timeFilter !== 'all' && o.created_at) {
      const created = new Date(o.created_at).getTime();
      const now = Date.now();
      if (timeFilter === 'today' && now - created > 24 * 3600 * 1000) return false;
      if (timeFilter === 'week' && now - created > 7 * 24 * 3600 * 1000) return false;
      if (timeFilter === 'month' && now - created > 30 * 24 * 3600 * 1000) return false;
    }

    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (o.payer_name || o.user?.name || '').toLowerCase().includes(term) ||
      (o.user?.email || o.guest_email || '').toLowerCase().includes(term) ||
      (o.user?.phone || '').toLowerCase().includes(term) ||
      (o.event?.title || '').toLowerCase().includes(term) ||
      (o.ticket_tier?.name || '').toLowerCase().includes(term) ||
      (o.ticket_code || '').toLowerCase().includes(term) ||
      String(o.id).includes(term)
    );
  });

  const renderBadge = (order: TicketOrder) => {
    const usedCount = order.tickets?.filter((t) => t.is_used).length || 0;
    const isCheckedIn = order.status === 'used' || usedCount > 0;

    if (isCheckedIn) {
      return (
        <span className="px-3 py-1 rounded-full text-[0.6875rem] font-bold bg-[#1d4ed8]/30 text-[#60a5fa] border border-[#3b82f6]/30 shrink-0">
          Checked In
        </span>
      );
    }
    if (order.status === 'pending' && order.buyer_confirmed) {
      return (
        <span className="px-3 py-1 rounded-full text-[0.6875rem] font-extrabold bg-[#d3da0c] text-black shrink-0">
          Confirmed
        </span>
      );
    }
    if (order.status === 'pending') {
      return (
        <span className="px-3 py-1 rounded-full text-[0.6875rem] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
          Pending
        </span>
      );
    }
    if (order.status === 'approved') {
      return (
        <span className="px-3 py-1 rounded-full text-[0.6875rem] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
          Approved
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-[0.6875rem] font-bold bg-red-500/20 text-red-400 shrink-0">
        {order.status}
      </span>
    );
  };

  return (
    <div className="min-h-dvh bg-[#020b00] text-white pb-28">
      {/* Top Header matching reference Screen 3 (Ticket Orders) */}
      <div className="sticky top-0 z-30 bg-[#020b00]/95 backdrop-blur-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/5">
        <div className="flex items-center justify-between h-11 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/dashboard/business')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[1.0625rem] font-bold text-white tracking-tight">Ticket Orders</h1>
          <div className="flex items-center gap-1 -mr-1">
            <button
              onClick={handleExportCsv}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Export Orders"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setShowGuestModal(true);
                fetchEvents();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Add Guest Ticket / Options"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-2.5 mt-2">
          {/* Status Filter Pills: All | Pending | Approved | Checked In */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'used', label: 'Checked In' },
              ] as const
            ).map((pill) => {
              const active = filter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    active
                      ? 'bg-[#d3da0c] text-black shadow-[0_0_12px_rgba(211,218,12,0.3)]'
                      : 'bg-[#11150E] text-gray-300 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or order ID"
              className="w-full bg-[#11150E] border border-white/10 text-white placeholder-gray-500 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] text-xs"
            />
          </div>

          {/* Two Dropdowns: All Events | All Time */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full bg-[#11150E] border border-white/10 text-white pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] appearance-none text-xs font-medium truncate"
              >
                <option value="all">All Events</option>
                {uniqueEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="w-full bg-[#11150E] border border-white/10 text-white pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] appearance-none text-xs font-medium"
              >
                <option value="all">All Time</option>
                <option value="month">This Month</option>
                <option value="week">This Week</option>
                <option value="today">Today</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Orders Card List */}
      <div className="max-w-4xl mx-auto px-4 pt-3 space-y-3">
        {loading && orders.length === 0 ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#d3da0c] mx-auto" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-[#11150E] border border-white/10 rounded-2xl p-10 text-center text-gray-400">
            <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-500" />
            <p className="text-base font-bold text-white mb-1">No ticket orders found</p>
            <p className="text-xs">Orders matching your filters will appear here.</p>
          </div>
        ) : (
          filteredOrders.map((order, idx) => {
            const buyerName = order.payer_name || order.user?.name || order.guest_name || 'Guest';
            const buyerEmail = order.user?.email || order.guest_email || '—';
            const tierName = order.ticket_tier?.name || 'General Admission';
            const qty = order.quantity || order.tickets?.length || 1;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => setDetailOrder(order)}
                className="bg-[#11150E] border border-white/10 hover:border-white/20 rounded-2xl p-4 cursor-pointer transition-all"
              >
                {/* Top Row: Initials Avatar + Buyer Name & Email + Status Pill */}
                <div className="flex items-center justify-between gap-3 pb-3 mb-2.5 border-b border-white/8">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#242B24] border border-white/10 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {getInitials(buyerName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-bold text-white truncate">{buyerName}</p>
                      <p className="text-xs text-gray-400 truncate">{buyerEmail}</p>
                    </div>
                  </div>
                  {renderBadge(order)}
                </div>

                {/* Bottom Row: Event Title + Tier & Qty | Amount + Chevron */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">
                      {order.event?.title || "After 90's Halloween Party"}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {tierName} · {qty} {qty === 1 ? 'Ticket' : 'Tickets'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-base font-extrabold text-white">
                      ¥{order.payment_amount?.toLocaleString?.() || order.payment_amount}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Order Detail & Management Sheet */}
      <AnimatePresence>
        {detailOrder && (
          <div
            className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setDetailOrder(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#11150E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#242B24] flex items-center justify-center text-white font-bold text-xs">
                    {getInitials(detailOrder.payer_name || detailOrder.user?.name || 'Guest')}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {detailOrder.payer_name || detailOrder.user?.name || 'Guest'}
                    </h3>
                    <p className="text-xs text-gray-400">{detailOrder.user?.email || detailOrder.guest_email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailOrder(null)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <p className="text-gray-400 mb-0.5">Event</p>
                  <p className="text-white font-semibold truncate">{detailOrder.event?.title}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <p className="text-gray-400 mb-0.5">Ticket Tier</p>
                  <p className="text-white font-semibold truncate">
                    {detailOrder.ticket_tier?.name || 'General Admission'} × {detailOrder.quantity || 1}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <p className="text-gray-400 mb-0.5">Total Paid</p>
                  <p className="text-[#d3da0c] font-bold text-sm">¥{detailOrder.payment_amount}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <p className="text-gray-400 mb-0.5">Order ID</p>
                  <p className="text-white font-mono">#{detailOrder.id}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {detailOrder.payment_screenshot && (
                  <button
                    onClick={() => {
                      setSelectedScreenshot(detailOrder.payment_screenshot);
                      setDetailOrder(null);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4 text-[#d3da0c]" />
                    Payment Proof
                  </button>
                )}
                {detailOrder.tickets && detailOrder.tickets.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedOrderTickets(detailOrder);
                      setDetailOrder(null);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="w-4 h-4 text-[#d3da0c]" />
                    View QR Tickets ({detailOrder.tickets.length})
                  </button>
                )}
              </div>

              {detailOrder.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    onClick={() => handleApprove(detailOrder.id)}
                    disabled={processingId === detailOrder.id}
                    className="py-3 rounded-xl bg-[#d3da0c] text-black font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    {processingId === detailOrder.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve Order
                  </button>
                  <button
                    onClick={() => handleReject(detailOrder.id)}
                    disabled={processingId === detailOrder.id}
                    className="py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guest Order Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-[#11150E] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#d3da0c]" />
                {t('business.ticketOrders.addGuestTicket') || 'Add Guest Ticket'}
              </h2>
              <button
                onClick={() => setShowGuestModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Event *</label>
                <select
                  value={guestForm.event_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuestForm({ ...guestForm, event_id: val, ticket_tier_id: '' });
                    if (val) fetchTicketTiers(Number(val));
                  }}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#d3da0c]"
                >
                  <option value="">Select event...</option>
                  {(events.length > 0 ? events : uniqueEvents).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Guest Name *</label>
                <input
                  type="text"
                  value={guestForm.guest_name}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Guest Email *</label>
                <input
                  type="email"
                  value={guestForm.guest_email}
                  onChange={(e) => setGuestForm({ ...guestForm, guest_email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#d3da0c]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={guestForm.quantity}
                    onChange={(e) => setGuestForm({ ...guestForm, quantity: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Ticket Tier</label>
                  <select
                    value={guestForm.ticket_tier_id}
                    onChange={(e) => setGuestForm({ ...guestForm, ticket_tier_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#d3da0c]"
                  >
                    <option value="">Default</option>
                    {ticketTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} (¥{tier.price})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowGuestModal(false)}
                className="flex-1 py-2.5 bg-white/5 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGuestOrder}
                disabled={isSubmittingGuest}
                className="flex-1 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="bg-[#11150E] rounded-2xl p-4 max-w-2xl w-full border border-white/10 shadow-2xl">
            <img
              src={selectedScreenshot}
              alt="Payment proof"
              className="w-full rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/default-avatar.png';
              }}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedQr && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
          onClick={() => setSelectedQr(null)}
        >
          <div className="bg-[#11150E] rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl text-center">
            <img src={selectedQr} alt="Ticket QR" className="w-48 h-48 mx-auto rounded-xl" />
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setSelectedQr(null)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Tickets Modal */}
      {selectedOrderTickets && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
          onClick={() => setSelectedOrderTickets(null)}
        >
          <div
            className="bg-[#11150E] rounded-2xl p-6 max-w-2xl w-full border border-white/10 shadow-2xl max-h-[85dvh] overflow-y-auto"
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
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedOrderTickets.tickets?.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className={`bg-black/40 border border-white/10 rounded-xl p-4 text-center ${
                    ticket.is_used ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">#{idx + 1}</span>
                    {ticket.is_used ? (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-[0.625rem] font-bold rounded-full">
                        USED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[#d3da0c] text-black text-[0.625rem] font-bold rounded-full">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {ticket.qr_code ? (
                    <img src={ticket.qr_code} alt={`Ticket QR #${idx + 1}`} className="w-full h-auto rounded-lg" />
                  ) : (
                    <div className="w-full aspect-square bg-white/10 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                      No QR
                    </div>
                  )}
                  <p className="text-white text-[0.625rem] font-mono mt-2 truncate">{ticket.ticket_number}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketOrdersPage;
