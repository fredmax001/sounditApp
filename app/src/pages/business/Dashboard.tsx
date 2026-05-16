import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useEventStore } from '@/store/eventStore';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  Calendar, DollarSign, Ticket, Loader2, Edit, PlusIcon, BarChart3, Wallet, X, Trash2, Check, User, Image, Share2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ============================================
// TYPES
// ============================================
interface Event {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  city?: string;
  venue?: { name?: string };
  flyer_image?: string;
  tickets_sold?: number;
  capacity?: number;
  status?: string;
}

interface TicketOrder {
  id: number;
  event: { id: number; title: string };
  user: { id: number; name: string; email: string };
  quantity?: number;
  payment_amount: number;
  payer_name: string;
  payment_screenshot: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  auto_approved?: boolean;
  tickets_generated?: number;
  created_at: string;
}

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, session, businessProfile } = useAuthStore();
  const { events, fetchMyEvents } = useEventStore();
  const { stats: dashboardStats, fetchStats, isLoading: statsLoading } = useDashboardStore();

  // Edit Event modal state
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    city: '',
    venue_name: ''
  });
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Ticket orders
  const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([]);
  const [ticketOrdersLoading, setTicketOrdersLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  // Open edit modal
  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditEventForm({
      title: event.title || '',
      description: event.description || '',
      start_date: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : '',
      end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
      city: event.city || '',
      venue_name: event.venue?.name || ''
    });
  };

  // Update event
  const handleUpdateEvent = async () => {
    if (!session?.access_token || !editingEvent) {
      toast.error(t('business.dashboard.notAuthenticated'));
      return;
    }

    if (!editEventForm.title.trim()) {
      toast.error(t('business.dashboard.pleaseEnterEventTitle'));
      return;
    }

    setIsUpdatingEvent(true);

    try {
      const response = await fetch(`${API_BASE_URL}/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editEventForm.title,
          description: editEventForm.description,
          start_date: editEventForm.start_date || undefined,
          end_date: editEventForm.end_date || undefined,
          city: editEventForm.city,
          venue_name: editEventForm.venue_name
        })
      });

      if (response.ok) {
        toast.success(t('business.dashboard.eventUpdated'));
        setEditingEvent(null);
        fetchMyEvents();
      } else {
        const error = await response.json();
        toast.error(error.detail || t('business.dashboard.failedToUpdateEvent'));
      }
    } catch (error) {
      console.error('Update event error:', error);
      toast.error(t('business.dashboard.networkError'));
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!session?.access_token) {
      toast.error(t('business.dashboard.notAuthenticated'));
      return;
    }

    const confirmed = window.confirm(t('business.dashboard.deleteConfirm', { title: eventTitle }));
    if (!confirmed) return;

    setIsDeletingEvent(true);

    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success(t('business.dashboard.eventDeleted'));
        fetchMyEvents();
      } else {
        const error = await response.json();
        toast.error(error.detail || t('business.dashboard.failedToDeleteEvent'));
      }
    } catch (error) {
      console.error('Delete event error:', error);
      toast.error(t('business.dashboard.networkError'));
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // Fetch ticket orders
  const fetchTicketOrders = useCallback(async () => {
    if (!session?.access_token) return;
    setTicketOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (ticketFilter !== 'all') params.append('status', ticketFilter);
      if (eventFilter !== 'all') params.append('event_id', eventFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const url = `${API_BASE_URL}/tickets/business/tickets${query}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTicketOrders(data.orders || []);
      } else {
        toast.error(data.detail || t('business.dashboard.failedToLoadTicketOrders'));
        setTicketOrders([]);
      }
    } catch {
      toast.error(t('business.dashboard.failedToLoadTicketOrders'));
      setTicketOrders([]);
    } finally {
      setTicketOrdersLoading(false);
    }
  }, [session, ticketFilter, eventFilter, t]);

  const handleApproveOrder = async (orderId: number) => {
    if (!session?.access_token) return;
    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${orderId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.dashboard.approve'));
        fetchTicketOrders();
      } else {
        toast.error(data.detail || t('business.dashboard.failedToApprove'));
      }
    } catch {
      toast.error(t('business.dashboard.failedToApprove'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRejectOrder = async (orderId: number) => {
    const reason = prompt(t('business.dashboard.enterRejectionReason') || 'Enter rejection reason:');
    if (!reason) return;
    if (!session?.access_token) return;
    setProcessingOrderId(orderId);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      const res = await fetch(`${API_BASE_URL}/tickets/${orderId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || t('business.dashboard.reject'));
        fetchTicketOrders();
      } else {
        toast.error(data.detail || t('business.dashboard.failedToReject'));
      }
    } catch {
      toast.error(t('business.dashboard.failedToReject'));
    } finally {
      setProcessingOrderId(null);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchStats(session.access_token);
      fetchMyEvents();
      fetchTicketOrders();
    }
  }, [session, fetchStats, fetchMyEvents, fetchTicketOrders]);

  useEffect(() => {
    fetchTicketOrders();
  }, [ticketFilter, eventFilter]);

  const bizStats = dashboardStats?.business_stats;

  const stats = [
    { label: t('business.dashboard.totalEvents'), value: bizStats?.total_events || 0, icon: Calendar, color: 'text-blue-400' },
    { label: t('business.dashboard.ticketsSold'), value: bizStats?.tickets_sold || 0, icon: Ticket, color: 'text-green-400' },
    { label: t('business.dashboard.totalRevenue'), value: `¥${bizStats?.total_revenue?.toLocaleString() || '0'}`, icon: DollarSign, color: 'text-[#d3da0c]' },
    { label: t('business.dashboard.pendingArtistPayments'), value: `¥${bizStats?.pending_artist_payments?.toLocaleString() || '0'}`, icon: Wallet, color: 'text-red-400' },
  ];

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-white mb-4">{t('business.dashboard.loadingProfile')}</h1>
          <p className="text-gray-400">{t('business.dashboard.pleaseWait')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24 lg:pb-10">
      {/* ── Page Header ── */}
      <div className="px-4 pt-6 pb-4 lg:px-10 lg:pt-8 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#d3da0c] text-xs font-bold uppercase tracking-widest mb-1">Business Dashboard</p>
            <h1 className="text-2xl font-bold text-white lg:text-3xl tracking-tight">
              {businessProfile?.business_name || t('business.dashboard.welcomeBack')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-gray-500 text-xs hidden sm:inline">{t('business.dashboard.welcomeBack')}</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 lg:px-10 lg:py-8 space-y-6">

        {/* ── Bento Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Featured — Revenue */}
          <div className="col-span-2 lg:col-span-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="h-full bg-[#d3da0c]/[0.07] border border-[#d3da0c]/20 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#d3da0c]/35 transition-all"
            >
              <div className="p-2.5 bg-[#d3da0c]/15 rounded-xl w-fit">
                <DollarSign className="w-5 h-5 text-[#d3da0c]" />
              </div>
              <div>
                <p className="text-[#d3da0c]/60 text-[10px] font-bold uppercase tracking-widest mb-1">{t('business.dashboard.totalRevenue')}</p>
                <p className="text-3xl font-bold text-white lg:text-4xl">
                  {statsLoading ? <Loader2 className="w-7 h-7 animate-spin text-[#d3da0c]" /> : `¥${bizStats?.total_revenue?.toLocaleString() || '0'}`}
                </p>
              </div>
            </motion.div>
          </div>
          {/* Other stats */}
          {[
            { label: t('business.dashboard.totalEvents'), value: bizStats?.total_events || 0, icon: Calendar },
            { label: t('business.dashboard.ticketsSold'), value: bizStats?.tickets_sold || 0, icon: Ticket },
            { label: t('business.dashboard.pendingArtistPayments'), value: `¥${bizStats?.pending_artist_payments?.toLocaleString() || '0'}`, icon: Wallet },
          ].map((stat, idx) => (
            <div key={idx} className="lg:col-span-2 col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (idx + 1) }}
                className="h-full bg-[#111111] border border-white/[0.07] rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-white/[0.14] transition-all group"
              >
                <div className="p-2 bg-[#d3da0c]/10 rounded-xl w-fit group-hover:bg-[#d3da0c]/15 transition-colors">
                  <stat.icon className="w-4 h-4 text-[#d3da0c]" />
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-0.5">{stat.label}</p>
                  <p className="text-xl font-bold text-white lg:text-2xl">
                    {statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#d3da0c]" /> : stat.value}
                  </p>
                </div>
              </motion.div>
            </div>
          ))}
          {/* Extra 2 cols for 12-col balance on desktop */}
          <div className="hidden lg:block lg:col-span-2" />
        </div>

        {/* ── Ticket Orders ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">{t('business.dashboard.ticketOrders') || 'Ticket Orders'}</h2>
            <div className="flex items-center gap-2">
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value as any)}
                className="bg-[#111111] border border-white/[0.08] text-gray-300 text-xs px-2.5 py-1.5 rounded-lg focus:border-[#d3da0c] outline-none"
              >
                <option value="all">{t('business.dashboard.all')}</option>
                <option value="pending">{t('business.dashboard.pending')}</option>
                <option value="approved">{t('business.dashboard.approved')}</option>
                <option value="rejected">{t('business.dashboard.rejected')}</option>
              </select>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="bg-[#111111] border border-white/[0.08] text-gray-300 text-xs px-2.5 py-1.5 rounded-lg focus:border-[#d3da0c] outline-none max-w-[120px] truncate"
              >
                <option value="all">All Events</option>
                {events.map((event) => (
                  <option key={event.id} value={String(event.id)}>{event.title}</option>
                ))}
              </select>
            </div>
          </div>

          {eventFilter !== 'all' && ticketOrders.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Orders', value: ticketOrders.length },
                { label: 'Revenue', value: `¥${ticketOrders.reduce((s, o) => s + (o.payment_amount || 0), 0).toLocaleString()}` },
                { label: 'Checked In', value: ticketOrders.filter(o => o.status === 'used').length },
              ].map((s, i) => (
                <div key={i} className="bg-[#111111] border border-white/[0.06] rounded-xl p-3 text-center">
                  <p className="text-gray-600 text-[9px] uppercase font-bold mb-0.5">{s.label}</p>
                  <p className="text-white font-bold text-sm">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {ticketOrdersLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-[#d3da0c]" /></div>
          ) : ticketOrders.length === 0 ? (
            <div className="bg-[#111111] border border-dashed border-white/[0.08] rounded-2xl p-8 text-center text-gray-600">
              <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('business.dashboard.noTicketOrders') || 'No ticket orders found.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ticketOrders.map((order) => (
                <div key={order.id} className="bg-[#111111] border border-white/[0.06] rounded-xl p-3 lg:p-4 hover:border-white/[0.12] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">{order.payer_name || order.user?.name || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs truncate">{order.event?.title} · Qty {order.quantity || 1} · {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                        order.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                        order.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>{order.status}</span>
                      <p className="text-white font-semibold text-xs">¥{order.payment_amount}</p>
                      {order.status === 'pending' && !order.auto_approved && (
                        <div className="flex gap-1">
                          <button onClick={() => handleApproveOrder(order.id)} disabled={processingOrderId === order.id}
                            className="w-8 h-8 bg-green-500/15 text-green-400 rounded-lg hover:bg-green-500/25 disabled:opacity-50 flex items-center justify-center transition-all">
                            {processingOrderId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleRejectOrder(order.id)} disabled={processingOrderId === order.id}
                            className="w-8 h-8 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 disabled:opacity-50 flex items-center justify-center transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                      className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] rounded-lg text-[10px] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all">
                      <Image className="w-3 h-3" /> Screenshot
                    </button>
                    {order.ticket_code && (
                      <span className="px-2 py-1 bg-[#d3da0c]/10 text-[#d3da0c] rounded-lg text-[10px] font-mono">{order.ticket_code}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Events ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">{t('business.dashboard.liveEvents')}</h2>
            <Link to="/dashboard/business/events" className="text-[#d3da0c] text-xs font-semibold hover:underline">
              {t('business.dashboard.manageAll')} →
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="bg-[#111111] border border-dashed border-white/[0.08] rounded-2xl p-10 text-center">
              <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-1">{t('business.dashboard.noEventsYet')}</h3>
              <p className="text-gray-600 text-sm mb-4">{t('business.dashboard.createFirstEventPrompt')}</p>
              <Link to="/dashboard/business/create-event"
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-all">
                <PlusIcon className="w-4 h-4" /> {t('business.dashboard.createEvent')}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="bg-[#111111] border border-white/[0.06] rounded-xl p-3 lg:p-4 flex items-center gap-3 hover:border-[#d3da0c]/20 transition-all group">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/[0.05] flex items-center justify-center shrink-0">
                    {event.flyer_image
                      ? <img src={event.flyer_image} alt={event.title} className="w-full h-full object-cover" />
                      : <Calendar className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-medium text-sm truncate">{event.title}</h3>
                    <p className="text-gray-500 text-xs">
                      {event.start_date ? new Date(event.start_date).toLocaleDateString() : t('business.dashboard.tbd')} · {event.venue?.name || event.city || t('business.dashboard.tbd')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block text-right">
                      <p className="text-gray-600 text-[9px] uppercase font-bold">Sales</p>
                      <p className="text-white font-bold text-xs">{event.tickets_sold || 0}/{event.capacity || '∞'}</p>
                    </div>
                    <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      event.status === 'live' ? 'bg-green-500/10 text-green-400' :
                      event.status === 'draft' ? 'bg-gray-500/10 text-gray-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>{event.status || t('business.dashboard.active')}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditEvent(event)}
                        className="w-8 h-8 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg flex items-center justify-center transition-all">
                        <Edit className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button onClick={() => handleDeleteEvent(event.id, event.title)} disabled={isDeletingEvent}
                        className="w-8 h-8 bg-white/[0.05] hover:bg-red-500/20 rounded-lg flex items-center justify-center transition-all disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <h2 className="text-base font-semibold text-white mb-4">{t('business.dashboard.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
            {[
              { icon: PlusIcon, color: 'text-[#d3da0c]', bg: 'bg-[#d3da0c]/10', label: t('business.dashboard.createEvent'), sub: t('business.dashboard.launchNewEvent'), path: '/dashboard/business/create-event', border: 'hover:border-[#d3da0c]/30' },
              { icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-400/10', label: t('business.dashboard.myEvents'), sub: t('business.dashboard.manageYourEvents'), path: '/dashboard/business/events', border: 'hover:border-blue-400/30' },
              { icon: Share2, color: 'text-purple-400', bg: 'bg-purple-400/10', label: t('business.dashboard.promoters') || 'Promoters', sub: t('business.dashboard.promotersDesc') || 'Referral codes', path: '/dashboard/business/promoters', border: 'hover:border-purple-400/30' },
              { icon: BarChart3, color: 'text-orange-400', bg: 'bg-orange-400/10', label: t('business.dashboard.analytics'), sub: t('business.dashboard.viewInsights'), path: '/dashboard/business/analytics', border: 'hover:border-orange-400/30' },
              { icon: Wallet, color: 'text-green-400', bg: 'bg-green-400/10', label: t('business.dashboard.payouts'), sub: t('business.dashboard.viewEarnings'), path: '/dashboard/business/payouts', border: 'hover:border-green-400/30' },
            ].map((a, i) => (
              <motion.button key={i} whileHover={{ scale: 1.02 }} onClick={() => navigate(a.path)}
                className={`bg-[#111111] border border-white/[0.07] rounded-xl p-4 text-left ${a.border} transition-all`}>
                <div className={`w-9 h-9 ${a.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <a.icon className={`w-4 h-4 ${a.color}`} />
                </div>
                <p className="text-white font-semibold text-xs lg:text-sm">{a.label}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{a.sub}</p>
              </motion.button>
            ))}
          </div>
        </section>
      </div>

      {/* ── Edit Event Modal ── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-end md:justify-center z-50 p-0 md:p-4">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#111111] border border-white/[0.08] rounded-t-2xl md:rounded-2xl p-5 w-full max-w-lg md:mx-auto max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">{t('business.dashboard.editEventTitle')}</h3>
              <button onClick={() => setEditingEvent(null)} className="w-8 h-8 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg flex items-center justify-center transition-all">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: t('business.dashboard.eventTitleLabel'), key: 'title', type: 'text', placeholder: t('business.dashboard.eventTitlePlaceholder') },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-gray-500 text-xs mb-1.5 block font-medium">{f.label}</label>
                  <input type={f.type} value={editEventForm[f.key as keyof typeof editEventForm]}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:border-[#d3da0c] outline-none transition-all" />
                </div>
              ))}
              <div>
                <label className="text-gray-500 text-xs mb-1.5 block font-medium">{t('business.dashboard.descriptionLabel')}</label>
                <textarea value={editEventForm.description}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('business.dashboard.descriptionPlaceholder')} rows={3}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:border-[#d3da0c] outline-none transition-all resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block font-medium">{t('business.dashboard.startDate')}</label>
                  <input type="datetime-local" value={editEventForm.start_date}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm focus:border-[#d3da0c] outline-none transition-all" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block font-medium">{t('business.dashboard.endDate')}</label>
                  <input type="datetime-local" value={editEventForm.end_date}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm focus:border-[#d3da0c] outline-none transition-all" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block font-medium">{t('business.dashboard.city')}</label>
                  <input type="text" value={editEventForm.city}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder={t('business.dashboard.cityPlaceholder')}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm focus:border-[#d3da0c] outline-none transition-all" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block font-medium">{t('business.dashboard.venueName')}</label>
                  <input type="text" value={editEventForm.venue_name}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, venue_name: e.target.value }))}
                    placeholder={t('business.dashboard.venueNamePlaceholder')}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 text-white text-sm focus:border-[#d3da0c] outline-none transition-all" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingEvent(null)}
                  className="flex-1 py-3 bg-white/[0.06] text-white text-sm font-semibold rounded-xl hover:bg-white/[0.1] transition-all">
                  {t('business.dashboard.cancel')}
                </button>
                <button onClick={handleUpdateEvent} disabled={isUpdatingEvent}
                  className="flex-1 py-3 bg-[#d3da0c] text-black text-sm font-bold rounded-xl hover:bg-[#bbc10b] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUpdatingEvent ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('business.dashboard.saving')}</> : t('business.dashboard.saveChanges')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Screenshot Modal ── */}
      {selectedScreenshot && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedScreenshot(null)}>
          <div className="relative max-w-3xl w-full">
            <button onClick={() => setSelectedScreenshot(null)} className="absolute top-3 right-3 z-10 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all">
              <X className="w-5 h-5" />
            </button>
            <img src={selectedScreenshot} alt="Screenshot" className="w-full h-auto rounded-2xl" />
          </div>
        </div>
      )}

      {/* ── QR Modal ── */}
      {selectedQr && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedQr(null)}>
          <div className="bg-white p-6 rounded-2xl text-center max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
            <img src={selectedQr} alt="Ticket QR" className="w-full aspect-square mx-auto" />
            <p className="text-black mt-3 font-semibold text-sm">Ticket QR Code</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDashboard;
