import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useEventStore } from '@/store/eventStore';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  Calendar, DollarSign, Ticket, Loader2, Edit, PlusIcon, BarChart3, Wallet, X, Trash2, Check, User, Image as ImageIcon
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
  const fetchTicketOrders = async () => {
    if (!session?.access_token) return;
    setTicketOrdersLoading(true);
    try {
      const url = `${API_BASE_URL}/tickets/business/tickets${ticketFilter !== 'all' ? `?status=${ticketFilter}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTicketOrders(data.orders || []);
      }
    } catch {
      toast.error(t('business.dashboard.failedToLoadTicketOrders'));
    } finally {
      setTicketOrdersLoading(false);
    }
  };

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
  }, [session, fetchStats, fetchMyEvents]);

  useEffect(() => {
    fetchTicketOrders();
  }, [ticketFilter]);

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
    <div className="min-h-screen bg-[#0A0A0A] p-4 lg:p-10">
      {/* Welcome Header */}
      <div className="mb-10">
        <h1 className="text-2xl lg:text-4xl font-display text-white mb-2">
          {t('business.dashboard.welcomeBack')}
        </h1>
        <p className="text-gray-400">
          {businessProfile?.business_name
            ? t('business.dashboard.welcomeMessageNamed', { name: businessProfile.business_name })
            : t('business.dashboard.welcomeMessage')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-10">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-[#111111] border border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6 hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 bg-white/5 rounded-xl ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-gray-400 text-sm font-medium">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Ticket Orders */}
      <section className="mb-10">
        <div className="flex flex-col gap-3 mb-6">
          <h2 className="text-2xl font-bold text-white">{t('business.dashboard.ticketOrders') || 'Ticket Orders'}</h2>
          <select
            value={ticketFilter}
            onChange={(e) => setTicketFilter(e.target.value as any)}
            className="bg-[#111111] border border-white/10 text-white px-4 py-2 rounded-lg"
          >
            <option value="all">{t('business.dashboard.all')}</option>
            <option value="pending">{t('business.dashboard.pending')}</option>
            <option value="approved">{t('business.dashboard.approved')}</option>
            <option value="rejected">{t('business.dashboard.rejected')}</option>
          </select>
        </div>

        {ticketOrdersLoading ? (
          <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#d3da0c] mx-auto" /></div>
        ) : ticketOrders.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl p-6 lg:p-8 text-center text-gray-400">
            {t('business.dashboard.noTicketOrders') || 'No ticket orders found.'}
          </div>
        ) : (
          <div className="grid gap-4">
            {ticketOrders.map((order) => (
              <div key={order.id} className="bg-[#111111] border border-white/5 rounded-xl lg:rounded-2xl p-4 lg:p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{order.payer_name || order.user?.name || 'Unknown'}</p>
                      <p className="text-gray-400 text-sm">{order.user?.email}</p>
                      <p className="text-gray-500 text-xs mt-1">{order.event?.title} • Qty: {order.quantity || 1} • {new Date(order.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      order.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                      order.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                      order.status === 'cancelled' ? 'bg-gray-500/10 text-gray-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {order.status}
                    </span>
                    {order.auto_approved && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400">
                        Auto
                      </span>
                    )}
                    <p className="text-white font-semibold">¥{order.payment_amount}</p>
                    {order.status === 'pending' && !order.auto_approved && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveOrder(order.id)}
                          disabled={processingOrderId === order.id}
                          className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 disabled:opacity-50"
                        >
                          {processingOrderId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleRejectOrder(order.id)}
                          disabled={processingOrderId === order.id}
                          className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm text-white hover:bg-white/10"
                  >
                    <ImageIcon className="w-4 h-4" /> View Screenshot
                  </button>
                  {order.ticket_qr && (
                    <button
                      onClick={() => setSelectedQr(order.ticket_qr!)}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm text-white hover:bg-white/10"
                    >
                      <Ticket className="w-4 h-4" /> View QR
                    </button>
                  )}
                  {order.ticket_code && (
                    <span className="px-3 py-2 bg-[#d3da0c]/10 text-[#d3da0c] rounded-lg text-sm font-mono">
                      {order.ticket_code}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Events */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">{t('business.dashboard.liveEvents')}</h2>
          <Link
            to="/dashboard/business/events"
            className="text-[#d3da0c] text-sm font-bold hover:underline"
          >
            {t('business.dashboard.manageAll')}
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl p-8 lg:p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">{t('business.dashboard.noEventsYet')}</h3>
            <p className="text-gray-400 mb-4">{t('business.dashboard.createFirstEventPrompt')}</p>
            <Link
              to="/dashboard/business/create-event"
              className="inline-block px-6 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-all"
            >
              {t('business.dashboard.createEvent')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="bg-white/5 border border-white/5 p-4 lg:p-6 rounded-xl lg:rounded-2xl flex flex-col gap-4 group hover:border-[#d3da0c]/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
                    {event.flyer_image ? (
                      <img src={event.flyer_image} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <Calendar className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{event.title}</h3>
                    <p className="text-gray-400 text-sm">
                      {event.start_date ? new Date(event.start_date).toLocaleDateString() : t('business.dashboard.tbd')} • {event.venue?.name || event.city || t('business.dashboard.tbd')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs uppercase font-black mb-1">{t('business.dashboard.sales')}</p>
                    <p className="text-white font-bold">{event.tickets_sold || 0} / {event.capacity || '∞'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs uppercase font-black mb-1">{t('business.dashboard.status')}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${event.status === 'live' ? 'bg-green-500/10 text-green-400' :
                        event.status === 'draft' ? 'bg-gray-500/10 text-gray-400' :
                          'bg-blue-500/10 text-blue-400'
                      }`}>
                      {event.status || t('business.dashboard.active')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                      title={t('business.dashboard.editEvent')}
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id, event.title)}
                      disabled={isDeletingEvent}
                      className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-all disabled:opacity-50"
                      title={t('business.dashboard.deleteEvent')}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">{t('business.dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate('/dashboard/business/create-event')}
            className="bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl p-5 lg:p-6 text-left hover:border-[#d3da0c]/30 transition-all"
          >
            <PlusIcon className="w-8 h-8 text-[#d3da0c] mb-3" />
            <h3 className="text-white font-bold mb-1">{t('business.dashboard.createEvent')}</h3>
            <p className="text-gray-400 text-sm">{t('business.dashboard.launchNewEvent')}</p>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate('/dashboard/business/events')}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:border-[#d3da0c]/30 transition-all"
          >
            <Calendar className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="text-white font-bold mb-1">{t('business.dashboard.myEvents')}</h3>
            <p className="text-gray-400 text-sm">{t('business.dashboard.manageYourEvents')}</p>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate('/dashboard/business/analytics')}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:border-[#d3da0c]/30 transition-all"
          >
            <BarChart3 className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-white font-bold mb-1">{t('business.dashboard.analytics')}</h3>
            <p className="text-gray-400 text-sm">{t('business.dashboard.viewInsights')}</p>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate('/dashboard/business/payouts')}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left hover:border-[#d3da0c]/30 transition-all"
          >
            <Wallet className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="text-white font-bold mb-1">{t('business.dashboard.payouts')}</h3>
            <p className="text-gray-400 text-sm">{t('business.dashboard.viewEarnings')}</p>
          </motion.button>
        </div>
      </section>

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-end md:justify-center z-50 p-0 md:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111111] border border-white/10 rounded-t-2xl md:rounded-2xl p-5 lg:p-6 w-full max-w-lg max-h-[85vh] md:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">{t('business.dashboard.editEventTitle')}</h3>
              <button
                onClick={() => setEditingEvent(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">{t('business.dashboard.eventTitleLabel')}</label>
                <input
                  type="text"
                  value={editEventForm.title}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('business.dashboard.eventTitlePlaceholder')}
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">{t('business.dashboard.descriptionLabel')}</label>
                <textarea
                  value={editEventForm.description}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('business.dashboard.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">{t('business.dashboard.startDate')}</label>
                  <input
                    type="datetime-local"
                    value={editEventForm.start_date}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">{t('business.dashboard.endDate')}</label>
                  <input
                    type="datetime-local"
                    value={editEventForm.end_date}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">{t('business.dashboard.city')}</label>
                  <input
                    type="text"
                    value={editEventForm.city}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('business.dashboard.cityPlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">{t('business.dashboard.venueName')}</label>
                  <input
                    type="text"
                    value={editEventForm.venue_name}
                    onChange={(e) => setEditEventForm(prev => ({ ...prev, venue_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                    placeholder={t('business.dashboard.venueNamePlaceholder')}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  {t('business.dashboard.cancel')}
                </button>
                <button
                  onClick={handleUpdateEvent}
                  disabled={isUpdatingEvent}
                  className="flex-1 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdatingEvent ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t('business.dashboard.saving')}</>
                  ) : (
                    t('business.dashboard.saveChanges')
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedScreenshot(null)}>
          <div className="relative max-w-3xl w-full">
            <button onClick={() => setSelectedScreenshot(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300"><X className="w-8 h-8" /></button>
            <img src={selectedScreenshot} alt="Screenshot" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedQr && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelectedQr(null)}>
          <div className="bg-white p-6 rounded-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <img src={selectedQr} alt="Ticket QR" className="w-64 h-64 mx-auto" />
            <p className="text-black mt-4 font-semibold">Ticket QR Code</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDashboard;
