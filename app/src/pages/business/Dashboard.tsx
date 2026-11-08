import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useEventStore } from '@/store/eventStore';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  Calendar,
  Ticket,
  Loader2,
  Edit,
  Plus,
  BarChart3,
  Wallet,
  X,
  Trash2,
  Check,
  User,
  Image,
  Share2,
  UserPlus,
  Megaphone,
  Images,
  Search,
  Camera,
  ScanLine,
  Users,
  Coins,
  ChevronDown,
  ChevronRight,
  BadgeCheck,
  Lock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import BroadcastAnnouncementModal from '@/components/BroadcastAnnouncementModal';
import NotificationBell from '@/components/NotificationBell';
import { getBusinessVariant } from '@/lib/roleVariants';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

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

interface OrderTicket {
  id: number;
  ticket_number: string;
  qr_code?: string;
  qr_token?: string;
  is_used: boolean;
  used_at?: string | null;
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
  tickets?: OrderTicket[];
  used_at?: string | null;
  created_at: string;
}

const getInitials = (name?: string) => {
  if (!name) return 'SI';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile, session, businessProfile } = useAuthStore();

  const businessVariant = getBusinessVariant(
    businessProfile?.business_type,
    profile?.role === 'organizer' || businessProfile?.business_type === 'organizer'
  );
  const { events, fetchMyEvents } = useEventStore();
  const { stats: dashboardStats, fetchStats, isLoading: statsLoading } = useDashboardStore();

  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'this_week' | 'all_time'>('this_month');
  const [roleSwitchValue, setRoleSwitchValue] = useState<'organizer' | 'vendor'>('organizer');

  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    city: '',
    venue_name: '',
  });
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const [ticketOrders, setTicketOrders] = useState<TicketOrder[]>([]);
  const [ticketOrdersLoading, setTicketOrdersLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'used'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [revenueUnlocked, setRevenueUnlocked] = useState(
    () => sessionStorage.getItem('biz_revenue_unlocked') !== '0'
  );
  const [showRevenueUnlock, setShowRevenueUnlock] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditEventForm({
      title: event.title || '',
      description: event.description || '',
      start_date: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : '',
      end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : '',
      city: event.city || '',
      venue_name: event.venue?.name || '',
    });
  };

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
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editEventForm.title,
          description: editEventForm.description,
          start_date: editEventForm.start_date || undefined,
          end_date: editEventForm.end_date || undefined,
          city: editEventForm.city,
          venue_name: editEventForm.venue_name,
        }),
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
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTicketOrders(data.orders || []);
      } else {
        setTicketOrders([]);
      }
    } catch {
      setTicketOrders([]);
    } finally {
      setTicketOrdersLoading(false);
    }
  }, [session, ticketFilter, eventFilter]);

  const handleUnlockRevenue = async () => {
    if (!unlockPassword.trim()) return;
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (profile as any)?.email || '',
          password: unlockPassword,
        }),
      });
      if (res.ok) {
        sessionStorage.setItem('biz_revenue_unlocked', '1');
        setRevenueUnlocked(true);
        setShowRevenueUnlock(false);
        setUnlockPassword('');
        toast.success('Revenue unlocked');
      } else {
        toast.error('Incorrect password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleApproveOrder = async (orderId: number) => {
    if (!session?.access_token) return;
    setProcessingOrderId(orderId);
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${orderId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
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
  }, [ticketFilter, eventFilter, fetchTicketOrders]);

  const bizStats = dashboardStats?.business_stats;
  const now = new Date();
  const upcomingEvents = events.filter((e) => {
    if (e.end_date) return new Date(e.end_date) >= now;
    return e.start_date ? new Date(e.start_date) >= now : true;
  });

  const displayName =
    businessProfile?.business_name ||
    (profile as any)?.business_name ||
    (profile?.first_name ? `${profile.first_name} Events` : 'Sound Events');

  const bannerImage =
    (businessProfile as any)?.banner_url ||
    (profile as any)?.background_url ||
    upcomingEvents[0]?.flyer_image ||
    '/onboarding/screen3-event.png';

  const totalEventsCount = bizStats?.total_events ?? events.length;
  const ticketsSoldCount = bizStats?.tickets_sold ?? 0;
  const totalRevenueAmount = bizStats?.total_revenue ?? 0;
  const totalAttendeesCount = (bizStats as any)?.total_attendees ?? (ticketsSoldCount > 0 ? ticketsSoldCount : 0);

  const displayedOrders = ticketOrders;

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pb-28 lg:pb-12 transition-colors duration-200">
      {/* Custom Mobile Top Bar matching Organizer Dashboard reference */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020b00]/95 backdrop-blur-xl border-b border-black/8 dark:border-white/[0.06] safe-area-pt">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-icon-dark.png"
              alt="Sound It"
              className="h-8 w-auto object-contain"
            />
            <span className="font-display text-xl tracking-wider text-[#020b00] dark:text-white font-extrabold">
              SOUND IT
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard/business/events')}
              aria-label="Search events"
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center text-[#020b00] dark:text-gray-200"
            >
              <Search className="w-4 h-4" />
            </button>
            <NotificationBell mobile />
            <button
              onClick={() => navigate('/dashboard/business/profile')}
              className="w-9 h-9 rounded-full border-2 border-[#d3da0c] p-[1.5px] bg-[#020b00] overflow-hidden"
            >
              {profile?.avatar_url || (businessProfile as any)?.logo_url ? (
                <img
                  src={(businessProfile as any)?.logo_url || profile?.avatar_url}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#d3da0c] flex items-center justify-center text-black font-extrabold text-xs">
                  {getInitials(displayName)}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-5">
        {/* Kicker + Role Switcher Pill */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a8f04] dark:text-[#d3da0c]">
              ORGANIZER DASHBOARD
            </span>
            <div className="relative">
              <select
                value={roleSwitchValue}
                onChange={(e) => {
                  const val = e.target.value as 'organizer' | 'vendor';
                  setRoleSwitchValue(val);
                  if (val === 'vendor') {
                    navigate('/dashboard/vendor');
                  }
                }}
                aria-label="Switch dashboard role"
                className="appearance-none bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/15 rounded-full pl-3.5 pr-8 py-1.5 text-xs font-semibold text-[#020b00] dark:text-white focus:outline-none focus:border-[#d3da0c] cursor-pointer"
              >
                <option value="organizer">{businessVariant.label || 'Event Organizer'}</option>
                <option value="vendor">Vendor Dashboard</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#020b00] dark:text-white tracking-tight">
              {displayName}
            </h1>
            <BadgeCheck className="w-5 h-5 text-emerald-400 fill-emerald-500/20 shrink-0" />
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Create events, sell tickets and manage your team.
          </p>
        </div>

        {/* Cover Banner Card with Edit Button */}
        <div className="relative h-32 sm:h-44 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#0a1207] shadow-lg">
          <img
            src={bannerImage}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/onboarding/screen3-event.png';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          <button
            onClick={() => navigate('/dashboard/business/profile')}
            className="absolute bottom-3 right-3 px-3.5 py-1.5 rounded-xl bg-black/75 hover:bg-black border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-[#d3da0c]" />
            <span>Edit</span>
          </button>
        </div>

        {/* 4 Primary Action Tiles Row matching Reference Visual */}
        <div className="grid grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('/dashboard/business/create-event')}
            className="col-span-1 rounded-2xl bg-[#d3da0c] hover:bg-[#e1e813] text-black p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-[#d3da0c]/20 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[11px] sm:text-xs font-extrabold leading-tight text-center">
              Create Event
            </span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="col-span-1 rounded-2xl bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 hover:border-[#d3da0c]/40 p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <ScanLine className="w-5 h-5 text-[#020b00] dark:text-white" />
            <span className="text-[11px] sm:text-xs font-semibold text-[#020b00] dark:text-gray-200 leading-tight text-center">
              Scan
            </span>
          </button>

          <button
            onClick={() => navigate('/dashboard/business/payouts')}
            className="col-span-1 rounded-2xl bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 hover:border-[#d3da0c]/40 p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Wallet className="w-5 h-5 text-[#020b00] dark:text-white" />
            <span className="text-[11px] sm:text-xs font-semibold text-[#020b00] dark:text-gray-200 leading-tight text-center">
              Payouts
            </span>
          </button>

          <button
            onClick={() => navigate('/dashboard/business/staff')}
            className="col-span-1 rounded-2xl bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 hover:border-[#d3da0c]/40 p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Users className="w-5 h-5 text-[#020b00] dark:text-white" />
            <span className="text-[11px] sm:text-xs font-semibold text-[#020b00] dark:text-gray-200 leading-tight text-center">
              Team
            </span>
          </button>
        </div>

        {/* Overview 2x2 Metrics Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[#020b00] dark:text-white">Overview</h2>
            <div className="relative">
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                aria-label="Select overview period"
                className="appearance-none bg-neutral-100 dark:bg-[#0d140a] border border-black/10 dark:border-white/15 rounded-full pl-3.5 pr-8 py-1.5 text-xs font-semibold text-[#020b00] dark:text-gray-200 focus:outline-none focus:border-[#d3da0c] cursor-pointer"
              >
                <option value="this_month">This Month</option>
                <option value="this_week">This Week</option>
                <option value="all_time">All Time</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Total Events */}
            <div
              onClick={() => navigate('/dashboard/business/events')}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-4 flex flex-col justify-between gap-2.5 cursor-pointer hover:border-[#d3da0c]/40 transition-colors"
            >
              <Calendar className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
              <div>
                <p className="text-2xl font-extrabold text-[#020b00] dark:text-white leading-tight">
                  {statsLoading ? <Loader2 className="w-5 h-5 animate-spin text-[#d3da0c]" /> : totalEventsCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Events</p>
              </div>
            </div>

            {/* Tickets Sold */}
            <div
              onClick={() => navigate('/dashboard/business/ticket-orders')}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-4 flex flex-col justify-between gap-2.5 cursor-pointer hover:border-[#d3da0c]/40 transition-colors"
            >
              <Ticket className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
              <div>
                <p className="text-2xl font-extrabold text-[#020b00] dark:text-white leading-tight">
                  {statsLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#d3da0c]" />
                  ) : (
                    ticketsSoldCount.toLocaleString()
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tickets Sold</p>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-4 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <Coins className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
                <button
                  onClick={() => {
                    if (revenueUnlocked) {
                      sessionStorage.setItem('biz_revenue_unlocked', '0');
                      setRevenueUnlocked(false);
                    } else {
                      setShowRevenueUnlock(true);
                    }
                  }}
                  className="text-[10px] text-gray-400 hover:text-[#d3da0c] flex items-center gap-1"
                  title={revenueUnlocked ? 'Hide revenue' : 'Unlock revenue'}
                >
                  <Lock className="w-3 h-3" />
                </button>
              </div>
              <div>
                {revenueUnlocked ? (
                  <p className="text-2xl font-extrabold text-[#020b00] dark:text-white leading-tight">
                    ¥{totalRevenueAmount.toLocaleString()}
                  </p>
                ) : (
                  <button onClick={() => setShowRevenueUnlock(true)} className="text-left">
                    <p className="text-2xl font-extrabold text-gray-400 tracking-widest leading-tight">
                      ••••••
                    </p>
                  </button>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Revenue</p>
              </div>
            </div>

            {/* Attendees */}
            <div
              onClick={() => navigate('/dashboard/business/analytics')}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-4 flex flex-col justify-between gap-2.5 cursor-pointer hover:border-[#d3da0c]/40 transition-colors"
            >
              <Users className="w-5 h-5 text-[#8a8f04] dark:text-[#d3da0c]" />
              <div>
                <p className="text-2xl font-extrabold text-[#020b00] dark:text-white leading-tight">
                  {totalAttendeesCount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Attendees</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Ticket Orders Section matching Reference Visual */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[#020b00] dark:text-white">
              Recent Ticket Orders
            </h2>
            <Link
              to="/dashboard/business/ticket-orders"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#8a8f04] dark:text-[#d3da0c]"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 divide-y divide-black/8 dark:divide-white/10 overflow-hidden">
            {ticketOrdersLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c]" />
              </div>
            ) : displayedOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No ticket orders yet.
              </div>
            ) : (
              displayedOrders.slice(0, 5).map((order) => {
                const customerName = order.payer_name || order.user?.name || 'Guest Attendee';
                const usedCount = order.tickets?.filter((t) => t.is_used).length || 0;
                const totalCount = order.tickets?.length || order.quantity || 1;
                const isCheckedIn =
                  order.status === 'used' || (usedCount > 0 && usedCount === totalCount);

                return (
                  <div
                    key={order.id}
                    onClick={() => navigate('/dashboard/business/ticket-orders')}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center text-xs font-extrabold text-[#020b00] dark:text-gray-200 shrink-0">
                        {getInitials(customerName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#020b00] dark:text-white truncate">
                          {customerName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {order.event?.title || 'Sound It Event'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-extrabold text-[#020b00] dark:text-white">
                        ¥{order.payment_amount}
                      </span>
                      {isCheckedIn ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Checked In
                        </span>
                      ) : order.status === 'approved' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Approved
                        </span>
                      ) : order.status === 'rejected' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          Rejected
                        </span>
                      ) : (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Pending
                          </span>
                          {session?.access_token && (
                            <>
                              <button
                                onClick={() => handleApproveOrder(order.id)}
                                disabled={processingOrderId === order.id}
                                className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center"
                                title="Approve"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRejectOrder(order.id)}
                                disabled={processingOrderId === order.id}
                                className="w-6 h-6 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center"
                                title="Reject"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Additional Organizer Workspace Tools */}
        <section className="pt-2 space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Workspace & Media Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => navigate('/dashboard/business/gallery')}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-3.5 text-left hover:border-[#d3da0c]/40 transition-colors"
            >
              <Images className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c] mb-2" />
              <p className="text-xs font-bold text-[#020b00] dark:text-white">Gallery & Media</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Photos & cloud links</p>
            </button>

            <button
              onClick={() => navigate('/dashboard/business/promoters')}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-3.5 text-left hover:border-[#d3da0c]/40 transition-colors"
            >
              <Share2 className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c] mb-2" />
              <p className="text-xs font-bold text-[#020b00] dark:text-white">Promoters</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Referral tracking</p>
            </button>

            <button
              onClick={() => navigate('/dashboard/business/analytics')}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-3.5 text-left hover:border-[#d3da0c]/40 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c] mb-2" />
              <p className="text-xs font-bold text-[#020b00] dark:text-white">Analytics</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Sales & insights</p>
            </button>

            <button
              onClick={() => setIsBroadcastOpen(true)}
              className="rounded-2xl bg-neutral-50 dark:bg-[#0d140a] border border-black/10 dark:border-white/10 p-3.5 text-left hover:border-[#d3da0c]/40 transition-colors"
            >
              <Megaphone className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c] mb-2" />
              <p className="text-xs font-bold text-[#020b00] dark:text-white">Broadcast</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Notify attendees</p>
            </button>
          </div>
        </section>
      </div>

      {/* Revenue Unlock Modal */}
      {showRevenueUnlock && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowRevenueUnlock(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#020b00] dark:text-white">Unlock Revenue</h3>
              <button
                onClick={() => setShowRevenueUnlock(false)}
                className="w-8 h-8 bg-black/5 dark:bg-white/10 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Enter your account password to view total revenue.
            </p>
            <input
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] outline-none mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockRevenue()}
            />
            <button
              onClick={handleUnlockRevenue}
              disabled={unlockLoading || !unlockPassword.trim()}
              className="w-full py-3 bg-[#d3da0c] text-black text-sm font-extrabold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {unlockLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                'Unlock'
              )}
            </button>
          </motion.div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-col justify-end md:justify-center z-50 p-0 md:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-t-2xl md:rounded-2xl p-5 w-full max-w-lg md:mx-auto max-h-[88vh] overflow-y-auto shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#020b00] dark:text-white">
                {t('business.dashboard.editEventTitle')}
              </h3>
              <button
                onClick={() => setEditingEvent(null)}
                className="w-8 h-8 bg-black/5 dark:bg-white/10 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-gray-600 dark:text-gray-400 text-xs mb-1.5 block font-medium">
                  {t('business.dashboard.eventTitleLabel')}
                </label>
                <input
                  type="text"
                  value={editEventForm.title}
                  onChange={(e) => setEditEventForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] outline-none"
                />
              </div>
              <div>
                <label className="text-gray-600 dark:text-gray-400 text-xs mb-1.5 block font-medium">
                  {t('business.dashboard.descriptionLabel')}
                </label>
                <textarea
                  value={editEventForm.description}
                  onChange={(e) =>
                    setEditEventForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] outline-none resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-white/10 text-[#020b00] dark:text-white text-sm font-semibold rounded-xl"
                >
                  {t('business.dashboard.cancel')}
                </button>
                <button
                  onClick={handleUpdateEvent}
                  disabled={isUpdatingEvent}
                  className="flex-1 py-3 bg-[#d3da0c] text-black text-sm font-extrabold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdatingEvent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {t('business.dashboard.saving')}
                    </>
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
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative max-w-3xl w-full">
            <button
              onClick={() => setSelectedScreenshot(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selectedScreenshot} alt="Screenshot" className="w-full h-auto rounded-2xl" />
          </div>
        </div>
      )}

      {/* QR Modal */}
      {selectedQr && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedQr(null)}
        >
          <div
            className="bg-white p-6 rounded-2xl text-center max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selectedQr} alt="Ticket QR" className="w-full aspect-square mx-auto" />
            <p className="text-black mt-3 font-semibold text-sm">Ticket QR Code</p>
          </div>
        </div>
      )}

      <BroadcastAnnouncementModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
      />
    </div>
  );
};

export default BusinessDashboard;
