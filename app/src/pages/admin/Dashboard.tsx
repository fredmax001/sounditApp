import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import {
  Users, Building2, Music, Calendar, Ticket,
  CheckCircle, Search,
  Ban, Check, Trash2, Lock, Unlock,
  RefreshCw,
  Activity, CreditCard, BarChart3, Shield,
  UserPlus, X, Loader2, ShoppingBag, MapPin, Eye,
  Briefcase
} from 'lucide-react';
import EntityDetailModal from '@/components/admin/EntityDetailModal';
import { toast } from 'sonner';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading: boolean;
  onClick?: () => void;
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

interface UserItem {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
  is_verified?: boolean;
  created_at?: string;
}

interface BusinessItem {
  id: number;
  organization_name?: string;
  business_name?: string;
  email?: string;
  user_name?: string;
  user_id?: number;
  is_verified?: boolean;
  is_approved?: boolean;
  status?: string;
}

interface ArtistItem {
  id: number;
  stage_name?: string;
  email?: string;
  user_id?: number;
  user_name?: string;
  is_verified?: boolean;
  is_approved?: boolean;
  status?: string;
}

interface EventItem {
  id: number;
  title: string;
  start_date?: string;
  status?: string;
}

interface BookingItem {
  id: number;
  artist_id?: number;
  artist_name?: string;
  requester_id?: number;
  requester_name?: string;
  event_name?: string;
  event_type?: string;
  event_date?: string;
  event_city?: string;
  budget?: number;
  duration_hours?: number;
  status: string;
  agreed_price?: number;
  created_at?: string;
}

interface PayoutItem {
  id: string;
  business?: string;
  amount?: number;
}

interface ActivityItem {
  description?: string;
  created_at?: string;
}

interface PendingActionItem {
  id: string | number;
  type: string;
  title?: string;
  description?: string;
  action_url?: string;
}

// Stats Card Component
const StatCard = ({ title, value, icon: Icon, loading, onClick }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    onClick={onClick}
    className={`bg-[#111111] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group ${
      onClick ? 'cursor-pointer hover:border-[#d3da0c]/40 hover:bg-[#151515] active:scale-[0.99]' : 'hover:border-white/[0.14]'
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="p-2.5 bg-[#d3da0c]/10 rounded-xl group-hover:bg-[#d3da0c]/15 transition-colors">
        <Icon className="w-5 h-5 text-[#d3da0c]" />
      </div>
      {onClick && (
        <span className="text-gray-500 group-hover:text-[#d3da0c] text-xs font-medium transition-colors flex items-center gap-0.5">
          View →
        </span>
      )}
    </div>
    <div>
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-white lg:text-3xl">
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-[#d3da0c]" /> : value}
      </h3>
    </div>
  </motion.div>
);

// Large featured stat card
const FeaturedStatCard = ({ title, value, icon: Icon, loading, subtitle, onClick }: StatCardProps & { subtitle?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    onClick={onClick}
    className={`bg-[#d3da0c]/[0.08] border border-[#d3da0c]/20 rounded-2xl p-6 flex flex-col justify-between gap-6 hover:border-[#d3da0c]/30 transition-all ${
      onClick ? 'cursor-pointer hover:bg-[#d3da0c]/[0.12] active:scale-[0.99]' : ''
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="p-3 bg-[#d3da0c]/15 rounded-xl">
        <Icon className="w-6 h-6 text-[#d3da0c]" />
      </div>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-[#d3da0c]/60 text-xs font-medium">{subtitle}</span>}
        {onClick && <span className="text-[#d3da0c] text-xs font-semibold">Financial Control →</span>}
      </div>
    </div>
    <div>
      <p className="text-[#d3da0c]/70 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-4xl font-bold text-white lg:text-5xl">
        {loading ? <Loader2 className="w-8 h-8 animate-spin text-[#d3da0c]" /> : value}
      </h3>
    </div>
  </motion.div>
);

// Tab Button Component
const TabButton = ({ active, onClick, icon: Icon, label }: TabButtonProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
      active
        ? 'bg-[#d3da0c] text-black shadow-lg shadow-[#d3da0c]/20'
        : 'text-gray-500 hover:text-white hover:bg-white/[0.06]'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const AdminDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, isAdmin, session } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'user' | 'artist' | 'vendor' | 'business';
    id: string | number | null;
  }>({
    isOpen: false,
    type: 'user',
    id: null,
  });

  const openEntityModal = (type: 'user' | 'artist' | 'vendor' | 'business', id: string | number) => {
    setModalConfig({ isOpen: true, type, id });
  };
  
  // Stats state - all start at 0
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBusinesses: 0,
    totalArtists: 0,
    totalVendors: 0,
    totalEvents: 0,
    totalTickets: 0,
    totalRevenue: 0,
    pendingPayouts: 0,
    pendingVerifications: 0,
    pendingVendorApprovals: 0,
    totalCities: 0,
    totalBookings: 0,
  });

  // Data states - all empty arrays
  const [users, setUsers] = useState<UserItem[]>([]);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [admins, setAdmins] = useState<UserItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);

  // Search and filter states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [businessSearch, setBusinessSearch] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');

  // New admin form
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const getAuthHeaders = () => {
    const token = session?.access_token;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error(t('admin.dashboard.notAuthenticated'));
        return;
      }

      // Fetch real stats from API
      const statsRes = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          totalUsers: statsData.total_users || 0,
          totalBusinesses: statsData.total_businesses || 0,
          totalArtists: statsData.total_artists || 0,
          totalVendors: statsData.total_vendors || 0,
          totalEvents: statsData.total_events || 0,
          totalTickets: statsData.total_tickets_sold || 0,
          totalRevenue: statsData.total_revenue || 0,
          pendingPayouts: statsData.pending_payouts || 0,
          pendingVerifications: statsData.pending_verifications || 0,
          pendingVendorApprovals: statsData.pending_vendor_approvals || 0,
          totalCities: statsData.total_cities || 0,
          totalBookings: statsData.total_bookings || 0,
        });
      }

      // Fetch real users
      const usersRes = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const usersList: UserItem[] = Array.isArray(usersData) ? usersData : (usersData.users || []);
        setUsers(usersList);
        // Extract admins
        setAdmins(usersList.filter((u) => u.role === 'admin' || u.role === 'super_admin'));
      }

      // Fetch real events
      const eventsRes = await fetch(`${API_BASE_URL}/events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(Array.isArray(eventsData) ? eventsData : (eventsData.events || []));
      }

      // Fetch real businesses (organizer profiles)
      const bizRes = await fetch(`${API_BASE_URL}/admin/businesses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (bizRes.ok) {
        const bizData = await bizRes.json();
        setBusinesses(bizData || []);
      }

      // Fetch real artists (artist profiles)
      const artistsRes = await fetch(`${API_BASE_URL}/admin/artists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (artistsRes.ok) {
        const artistsData = await artistsRes.json();
        setArtists(artistsData || []);
      }

      // Fetch real vendors
      const vendorsRes = await fetch(`${API_BASE_URL}/admin/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vendorsRes.ok) {
        const vendorsData = await vendorsRes.json();
        setVendors(vendorsData || []);
      }

      // Fetch real bookings
      const bookingsRes = await fetch(`${API_BASE_URL}/admin/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      }

      // Fetch payouts
      const payoutsRes = await fetch(`${API_BASE_URL}/admin/payouts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        setPayouts(payoutsData.payouts || []);
      }

      // Fetch recent activities
      const activitiesRes = await fetch(`${API_BASE_URL}/admin/activities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData.activities || []);
      }

      // Fetch pending actions
      const pendingRes = await fetch(`${API_BASE_URL}/admin/pending-actions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingActions(pendingData.actions || []);
      }

    } catch {
      toast.error(t('admin.dashboard.failedToLoadDashboardData'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    loadDashboardData();
  }, [isAdmin, loadDashboardData, navigate]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.email || !newAdmin.password) {
      toast.error(t('admin.dashboard.emailAndPasswordRequired'));
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/admins`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newAdmin,
          role: 'admin',
          is_verified: true
        })
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.adminCreatedSuccessfully'));
        setShowAddAdminModal(false);
        setNewAdmin({ email: '', first_name: '', last_name: '', password: '' });
        loadDashboardData();
      } else {
        const err = await res.json();
        toast.error(err.detail || t('admin.dashboard.failedToCreateAdmin'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm(t('admin.dashboard.confirmDeleteUser'))) return;
    
    setActionLoading(`delete-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.userDeleted'));
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToDeleteUser'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyUser = async (userId: number, type: string) => {
    setActionLoading(`verify-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type })
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.userVerifiedSuccessfully'));
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToVerifyUser'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnverifyUser = async (userId: number) => {
    setActionLoading(`unverify-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/unverify`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.userUnverifiedSuccessfully') || 'User unverified successfully');
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToUnverifyUser') || 'Failed to unverify user');
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendUser = async (userId: number) => {
    if (!confirm(t('admin.dashboard.confirmSuspendUser'))) return;
    
    setActionLoading(`suspend-${userId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.userSuspended'));
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToSuspendUser'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveEvent = async (eventId: number) => {
    setActionLoading(`approve-event-${eventId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.eventApproved'));
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToApproveEvent'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectEvent = async (eventId: number) => {
    if (!confirm(t('admin.dashboard.confirmRejectEvent'))) return;
    
    setActionLoading(`reject-event-${eventId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.eventRejected'));
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToRejectEvent'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcessPayout = async (payoutId: string) => {
    setActionLoading(`payout-${payoutId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res.ok) {
        toast.success(t('admin.dashboard.payoutProcessed'));
        loadDashboardData();
      } else {
        toast.error(t('admin.dashboard.failedToProcessPayout'));
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: number, status: string, reason?: string) => {
    setActionLoading(`booking-${status.toLowerCase()}-${bookingId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, reason })
      });
      if (res.ok) {
        toast.success(`Booking status updated to ${status.toLowerCase()}`);
        loadDashboardData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update booking status');
      }
    } catch {
      toast.error(t('admin.dashboard.networkError'));
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users based on search and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = !userSearch || 
      user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = !userRoleFilter || user.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Filter businesses
  const filteredBusinesses = businesses.filter(b => {
    if (!businessSearch) return true;
    const q = businessSearch.toLowerCase();
    return (
      b.organization_name?.toLowerCase().includes(q) ||
      b.business_name?.toLowerCase().includes(q) ||
      b.user_name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q)
    );
  });

  // Filter artists
  const filteredArtists = artists.filter(a => {
    if (!artistSearch) return true;
    const q = artistSearch.toLowerCase();
    return (
      a.stage_name?.toLowerCase().includes(q) ||
      a.user_name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    if (!vendorSearch) return true;
    const q = vendorSearch.toLowerCase();
    return (
      v.business_name?.toLowerCase().includes(q) ||
      v.category?.toLowerCase().includes(q) ||
      v.vendor_type?.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q)
    );
  });

  // Filter events
  const filteredEvents = events.filter(e => {
    if (!eventSearch) return true;
    const q = eventSearch.toLowerCase();
    return (
      e.title?.toLowerCase().includes(q) ||
      e.status?.toLowerCase().includes(q)
    );
  });

  // Filter bookings
  const filteredBookings = bookings.filter(b => {
    const matchesSearch = !bookingSearch ||
      b.event_name?.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.artist_name?.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.requester_name?.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.event_city?.toLowerCase().includes(bookingSearch.toLowerCase());
    const matchesStatus = !bookingStatusFilter || b.status?.toLowerCase() === bookingStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Overview Tab
  const OverviewTab = () => (
    <div className="space-y-4">
      {/* Bento Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-4">
        {/* Featured - Revenue */}
        <div className="col-span-2 lg:col-span-4 lg:row-span-2">
          <FeaturedStatCard
            title={t('admin.dashboard.totalRevenue')}
            value={`¥${stats.totalRevenue.toLocaleString()}`}
            icon={BarChart3}
            loading={isLoading}
            subtitle="Total Revenue"
            onClick={() => navigate('/admin/financial')}
          />
        </div>
        {/* Users */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.totalUsers')}
            value={stats.totalUsers}
            icon={Users}
            loading={isLoading}
            onClick={() => setActiveTab('users')}
          />
        </div>
        {/* Businesses */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.businesses')}
            value={stats.totalBusinesses}
            icon={Building2}
            loading={isLoading}
            onClick={() => setActiveTab('businesses')}
          />
        </div>
        {/* Artists */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.artists')}
            value={stats.totalArtists}
            icon={Music}
            loading={isLoading}
            onClick={() => setActiveTab('artists')}
          />
        </div>
        {/* Vendors */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.vendors')}
            value={stats.totalVendors}
            icon={ShoppingBag}
            loading={isLoading}
            onClick={() => setActiveTab('vendors')}
          />
        </div>
        {/* Events */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.events')}
            value={stats.totalEvents}
            icon={Calendar}
            loading={isLoading}
            onClick={() => setActiveTab('events')}
          />
        </div>
        {/* Bookings */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.bookings') || 'Bookings'}
            value={stats.totalBookings || bookings.length}
            icon={Briefcase}
            loading={isLoading}
            onClick={() => setActiveTab('bookings')}
          />
        </div>
        {/* Tickets */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.totalTickets')}
            value={stats.totalTickets}
            icon={Ticket}
            loading={isLoading}
            onClick={() => setActiveTab('events')}
          />
        </div>
        {/* Pending Payouts */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.pendingPayouts')}
            value={stats.pendingPayouts}
            icon={CreditCard}
            loading={isLoading}
            onClick={() => setActiveTab('payments')}
          />
        </div>
        {/* Pending Verifications */}
        <div className="lg:col-span-2">
          <StatCard
            title={t('admin.dashboard.pendingVerifications')}
            value={stats.pendingVerifications}
            icon={Shield}
            loading={isLoading}
            onClick={() => navigate('/admin/verification-center')}
          />
        </div>
      </div>

      {/* Activity & Pending - 2-col */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-[#111111] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">{t('admin.dashboard.recentActivity')}</h3>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          {activities.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('admin.dashboard.noRecentActivity')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                  <div className="w-7 h-7 bg-[#d3da0c]/15 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5 text-[#d3da0c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-snug">{activity.description}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{new Date(activity.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Actions */}
        <div className="bg-[#111111] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">{t('admin.dashboard.pendingActions')}</h3>
            {pendingActions.length > 0 && (
              <span className="bg-red-500/15 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-500/20">
                {pendingActions.length}
              </span>
            )}
          </div>
          {pendingActions.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('admin.dashboard.noPendingActions')}</p>
              <p className="text-xs mt-1 text-gray-700">{t('admin.dashboard.allCaughtUp')}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingActions.slice(0, 5).map((action) => (
                <div key={`${action.type}-${action.id}`} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {action.type === 'event_approval' ? (
                      <Calendar className="w-4 h-4 text-yellow-400 shrink-0" />
                    ) : action.type === 'user_verification' ? (
                      <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-orange-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{action.title}</p>
                      <p className="text-gray-600 text-xs">{action.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (action.action_url) navigate(action.action_url);
                      else if (action.type === 'event_approval') navigate('/admin/events');
                      else if (action.type === 'vendor_approval') navigate('/admin/vendors');
                      else if (action.type === 'business_approval') navigate('/admin/businesses');
                      else if (action.type === 'artist_approval') navigate('/admin/artists');
                      else if (action.type === 'verification_request') navigate('/admin/verification-center');
                      else navigate('/admin/users');
                    }}
                    className="text-[#d3da0c] text-xs font-semibold hover:underline whitespace-nowrap ml-3 shrink-0"
                  >
                    {t('admin.dashboard.review')}
                  </button>
                </div>
              ))}
              {pendingActions.length > 5 && (
                <p className="text-center text-gray-600 text-xs py-2">+{pendingActions.length - 5} {t('admin.dashboard.moreActions')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Users Tab - Real data only
  const UsersTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.userManagement')}</h3>
            <span className="text-xs text-gray-500 font-mono">({filteredUsers.length} users)</span>
          </div>
          <button 
            onClick={() => setShowAddAdminModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#d3da0c] text-black rounded-lg font-medium text-sm hover:bg-[#bbc10b] lg:px-4"
          >
            <UserPlus className="w-4 h-4" />
            {t('admin.dashboard.addAdmin')}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder={t('admin.dashboard.searchUsersPlaceholder')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
            />
          </div>
          <select 
            value={userRoleFilter}
            onChange={(e) => setUserRoleFilter(e.target.value)}
            className="px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="">{t('admin.dashboard.allRoles')}</option>
            <option value="user">{t('admin.dashboard.roleUser')}</option>
            <option value="business">{t('admin.dashboard.roleBusiness')}</option>
            <option value="artist">{t('admin.dashboard.roleArtist')}</option>
            <option value="vendor">Vendor</option>
            <option value="admin">{t('admin.dashboard.roleAdmin')}</option>
          </select>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.user')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.role')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.status')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.joined')}</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4">
                    <div
                      onClick={() => openEntityModal('user', user.id)}
                      className="cursor-pointer group"
                      title="Click to view user card"
                    >
                      <p className="text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                        {user.first_name} {user.last_name}
                        <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                      </p>
                      <p className="text-gray-400 text-sm">{user.email}</p>
                    </div>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                      user.role === 'business' ? 'bg-blue-500/20 text-blue-400' :
                      user.role === 'artist' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'active' || !user.status ? 'bg-green-500/20 text-green-400' :
                      user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                    }`}>
                      {user.status || t('admin.dashboard.statusActive')}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4 text-gray-400 text-sm">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEntityModal('user', user.id)}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-gray-400 hover:text-[#d3da0c] transition-colors"
                        title="View User Card"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!user.is_verified ? (
                        <button
                          onClick={() => handleVerifyUser(user.id, user.role)}
                          disabled={actionLoading === `verify-${user.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-green-400 disabled:opacity-50"
                          title={t('admin.dashboard.verify')}
                        >
                          {actionLoading === `verify-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverifyUser(user.id)}
                          disabled={actionLoading === `unverify-${user.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-red-400 disabled:opacity-50"
                          title={t('admin.dashboard.unverify') || 'Unverify'}
                        >
                          {actionLoading === `unverify-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleSuspendUser(user.id)}
                        disabled={actionLoading === `suspend-${user.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-yellow-400 disabled:opacity-50"
                        title={t('admin.dashboard.suspend')}
                      >
                        {actionLoading === `suspend-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={actionLoading === `delete-${user.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-red-400 disabled:opacity-50"
                        title={t('admin.dashboard.delete')}
                      >
                        {actionLoading === `delete-${user.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Admin Management Tab
  const AdminsTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.adminManagement')}</h3>
            <span className="text-xs text-gray-500 font-mono">({admins.length} admins)</span>
          </div>
          <button 
            onClick={() => setShowAddAdminModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#d3da0c] text-black rounded-lg font-medium text-sm hover:bg-[#bbc10b] lg:px-4"
          >
            <Shield className="w-4 h-4" />
            {t('admin.dashboard.createAdmin')}
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('admin.dashboard.noAdditionalAdmins')}</p>
          <p className="text-sm mt-1">{t('admin.dashboard.youAreTheOnlyAdmin')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.admin')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.email')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.created')}</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                        <Shield className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-white font-medium">
                        {admin.first_name} {admin.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 lg:p-4 text-gray-400">{admin.email}</td>
                  <td className="p-3 lg:p-4 text-gray-400 text-sm">
                    {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDeleteUser(admin.id)}
                        disabled={actionLoading === `delete-${admin.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-red-400 disabled:opacity-50"
                        title={t('admin.dashboard.removeAdmin')}
                      >
                        {actionLoading === `delete-${admin.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const BusinessesTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.businessManagement')}</h3>
            <span className="text-xs text-gray-500 font-mono">({filteredBusinesses.length} businesses)</span>
          </div>
          <button
            onClick={() => navigate('/admin/businesses')}
            className="text-sm text-[#d3da0c] hover:underline"
          >
            {t('admin.dashboard.fullManagement') || 'Full Management →'}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search businesses by name, email, or user..."
            value={businessSearch}
            onChange={(e) => setBusinessSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('admin.dashboard.noBusinessesRegistered')}</p>
          <p className="text-sm mt-1">{t('admin.dashboard.businessesWillAppear')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.business')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.approval') || 'Approval'}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.verification') || 'Verification'}</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBusinesses.map((biz) => (
                <tr key={biz.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4">
                    <div
                      onClick={() => openEntityModal('business', biz.id)}
                      className="cursor-pointer group"
                      title="Click to view business card"
                    >
                      <p className="text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                        {biz.organization_name || biz.business_name || 'Unnamed'}
                        <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                      </p>
                      <p className="text-gray-500 text-sm">{biz.user_name}</p>
                    </div>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      biz.is_approved ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {biz.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      biz.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {biz.is_verified ? t('admin.dashboard.verified') : 'Unverified'}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEntityModal('business', biz.id)}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-gray-400 hover:text-[#d3da0c] transition-colors"
                        title="View Business Card"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!biz.is_approved ? (
                        <button
                          onClick={() => handleApproveBusiness(biz.id)}
                          disabled={actionLoading === `approve-business-${biz.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-blue-400 disabled:opacity-50"
                          title="Approve"
                        >
                          {actionLoading === `approve-business-${biz.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnapproveBusiness(biz.id)}
                          disabled={actionLoading === `unapprove-business-${biz.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-orange-400 disabled:opacity-50"
                          title="Unapprove"
                        >
                          {actionLoading === `unapprove-business-${biz.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      {!biz.is_verified ? (
                        <button
                          onClick={() => handleVerifyUser(biz.user_id || biz.id, 'business')}
                          disabled={actionLoading === `verify-${biz.user_id || biz.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-green-400 disabled:opacity-50"
                          title={t('admin.dashboard.verify')}
                        >
                          {actionLoading === `verify-${biz.user_id || biz.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverifyUser(biz.user_id || biz.id)}
                          disabled={actionLoading === `unverify-${biz.user_id || biz.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-red-400 disabled:opacity-50"
                          title={t('admin.dashboard.unverify') || 'Unverify'}
                        >
                          {actionLoading === `unverify-${biz.user_id || biz.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const ArtistsTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.artistManagement')}</h3>
            <span className="text-xs text-gray-500 font-mono">({filteredArtists.length} artists)</span>
          </div>
          <button
            onClick={() => navigate('/admin/artists')}
            className="text-sm text-[#d3da0c] hover:underline"
          >
            {t('admin.dashboard.fullManagement') || 'Full Management →'}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search artists by stage name, email, or user..."
            value={artistSearch}
            onChange={(e) => setArtistSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : filteredArtists.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('admin.dashboard.noArtistsRegistered')}</p>
          <p className="text-sm mt-1">{t('admin.dashboard.artistsWillAppear')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Artist</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.approval') || 'Approval'}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.verification') || 'Verification'}</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredArtists.map((artist) => (
                <tr key={artist.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4">
                    <div
                      onClick={() => openEntityModal('artist', artist.id)}
                      className="cursor-pointer group"
                      title="Click to view artist card"
                    >
                      <p className="text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                        {artist.stage_name || 'Unnamed'}
                        <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                      </p>
                      <p className="text-gray-500 text-sm">{artist.user_name}</p>
                    </div>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      artist.is_approved ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {artist.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      artist.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {artist.is_verified ? t('admin.dashboard.verified') : 'Unverified'}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEntityModal('artist', artist.id)}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-gray-400 hover:text-[#d3da0c] transition-colors"
                        title="View Artist Card"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!artist.is_approved ? (
                        <button
                          onClick={() => handleApproveArtist(artist.id)}
                          disabled={actionLoading === `approve-artist-${artist.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-blue-400 disabled:opacity-50"
                          title="Approve"
                        >
                          {actionLoading === `approve-artist-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnapproveArtist(artist.id)}
                          disabled={actionLoading === `unapprove-artist-${artist.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-orange-400 disabled:opacity-50"
                          title="Unapprove"
                        >
                          {actionLoading === `unapprove-artist-${artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}
                      {!artist.is_verified ? (
                        <button
                          onClick={() => handleVerifyUser(artist.user_id || artist.id, 'artist')}
                          disabled={actionLoading === `verify-${artist.user_id || artist.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-green-400 disabled:opacity-50"
                          title={t('admin.dashboard.verify')}
                        >
                          {actionLoading === `verify-${artist.user_id || artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnverifyUser(artist.user_id || artist.id)}
                          disabled={actionLoading === `unverify-${artist.user_id || artist.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-red-400 disabled:opacity-50"
                          title={t('admin.dashboard.unverify') || 'Unverify'}
                        >
                          {actionLoading === `unverify-${artist.user_id || artist.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const handleApproveVendor = async (vendorId: number) => {
    setActionLoading(`approve-vendor-${vendorId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${vendorId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Vendor approved');
        setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, is_approved: true } : v));
      } else {
        toast.error('Failed to approve vendor');
      }
    } catch {
      toast.error('Failed to approve vendor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnapproveVendor = async (vendorId: number) => {
    setActionLoading(`unapprove-vendor-${vendorId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/vendors/${vendorId}/unapprove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Vendor unapproved');
        setVendors(prev => prev.map(v => v.id === vendorId ? { ...v, is_approved: false } : v));
      } else {
        toast.error('Failed to unapprove vendor');
      }
    } catch {
      toast.error('Failed to unapprove vendor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveBusiness = async (businessId: number) => {
    setActionLoading(`approve-business-${businessId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${businessId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Business approved');
        setBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, is_approved: true } : b));
      } else {
        toast.error('Failed to approve business');
      }
    } catch {
      toast.error('Failed to approve business');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnapproveBusiness = async (businessId: number) => {
    setActionLoading(`unapprove-business-${businessId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/businesses/${businessId}/unapprove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Business unapproved');
        setBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, is_approved: false } : b));
      } else {
        toast.error('Failed to unapprove business');
      }
    } catch {
      toast.error('Failed to unapprove business');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveArtist = async (artistId: number) => {
    setActionLoading(`approve-artist-${artistId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${artistId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Artist approved');
        setArtists(prev => prev.map(a => a.id === artistId ? { ...a, is_approved: true } : a));
      } else {
        toast.error('Failed to approve artist');
      }
    } catch {
      toast.error('Failed to approve artist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnapproveArtist = async (artistId: number) => {
    setActionLoading(`unapprove-artist-${artistId}`);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/artists/${artistId}/unapprove`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        toast.success('Artist unapproved');
        setArtists(prev => prev.map(a => a.id === artistId ? { ...a, is_approved: false } : a));
      } else {
        toast.error('Failed to unapprove artist');
      }
    } catch {
      toast.error('Failed to unapprove artist');
    } finally {
      setActionLoading(null);
    }
  };

  const VendorsTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.vendorManagement') || 'Vendor Management'}</h3>
            <span className="text-xs text-gray-500 font-mono">({filteredVendors.length} vendors)</span>
          </div>
          <button
            onClick={() => navigate('/admin/vendors')}
            className="text-sm text-[#d3da0c] hover:underline"
          >
            {t('admin.dashboard.fullManagement') || 'Full Management →'}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search vendors by business name, category, or email..."
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('admin.dashboard.noVendorsRegistered') || 'No vendors registered'}</p>
          <p className="text-sm mt-1">{t('admin.dashboard.vendorsWillAppear') || 'Vendors will appear here once registered'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.vendor') || 'Vendor'}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.category') || 'Category'}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.status')}</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.approval') || 'Approval'}</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4">
                    <div
                      onClick={() => openEntityModal('vendor', vendor.id)}
                      className="cursor-pointer group"
                      title="Click to view vendor card"
                    >
                      <p className="text-white font-medium group-hover:text-[#d3da0c] transition-colors flex items-center gap-1.5">
                        {vendor.business_name || '-'}
                        <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                      </p>
                    </div>
                  </td>
                  <td className="p-3 lg:p-4 text-gray-400">{vendor.category || vendor.vendor_type || '-'}</td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vendor.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {vendor.is_verified ? t('admin.dashboard.verified') : t('admin.dashboard.pending')}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vendor.is_approved ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {vendor.is_approved ? (t('admin.dashboard.approved') || 'Approved') : (t('admin.dashboard.notApproved') || 'Not Approved')}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEntityModal('vendor', vendor.id)}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-gray-400 hover:text-[#d3da0c] transition-colors"
                        title="View Vendor Card"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!vendor.is_approved ? (
                        <button
                          onClick={() => handleApproveVendor(vendor.id)}
                          disabled={actionLoading === `approve-vendor-${vendor.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-green-400 disabled:opacity-50"
                          title="Approve vendor"
                        >
                          {actionLoading === `approve-vendor-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnapproveVendor(vendor.id)}
                          disabled={actionLoading === `unapprove-vendor-${vendor.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-orange-400 disabled:opacity-50"
                          title="Unapprove vendor"
                        >
                          {actionLoading === `unapprove-vendor-${vendor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const EventsTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.eventManagement')}</h3>
            <span className="text-xs text-gray-500 font-mono">({filteredEvents.length} events)</span>
          </div>
          <button
            onClick={() => navigate('/admin/events')}
            className="text-sm text-[#d3da0c] hover:underline"
          >
            {t('admin.dashboard.fullManagement') || 'Full Management →'}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search events by title or status..."
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('admin.dashboard.noEventsCreated')}</p>
          <p className="text-sm mt-1">{t('admin.dashboard.eventsWillAppear')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Event</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Date</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.status')}</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">{t('admin.dashboard.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4 text-white font-medium">{event.title}</td>
                  <td className="p-3 lg:p-4 text-gray-400">
                    {event.start_date ? new Date(event.start_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      event.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                    }`}>
                      {event.status || t('admin.dashboard.statusDraft')}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-2">
                      {event.status !== 'approved' && (
                        <button
                          onClick={() => handleApproveEvent(event.id)}
                          disabled={actionLoading === `approve-event-${event.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-green-400 disabled:opacity-50"
                        >
                          {actionLoading === `approve-event-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleRejectEvent(event.id)}
                        disabled={actionLoading === `reject-event-${event.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px] text-red-400 disabled:opacity-50"
                      >
                        {actionLoading === `reject-event-${event.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Bookings Tab
  const BookingsTab = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.bookingManagement') || 'Booking Management'}</h3>
            <span className="text-xs text-gray-500 font-mono">({filteredBookings.length} bookings)</span>
          </div>
          <button
            onClick={() => navigate('/admin/bookings')}
            className="text-sm text-[#d3da0c] hover:underline"
          >
            {t('admin.dashboard.fullManagement') || 'Full Management →'}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search bookings by event, artist, requester, or city..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
            />
          </div>
          <select
            value={bookingStatusFilter}
            onChange={(e) => setBookingStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No bookings found</p>
          <p className="text-sm mt-1">Bookings between clients and artists will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="bg-[#181818] sticky top-0 z-10 border-b border-white/10 shadow-xs">
              <tr>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Event / Purpose</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Artist</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Client / Requester</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Date & City</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Budget / Price</th>
                <th className="text-left text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Status</th>
                <th className="text-right text-gray-400 text-xs font-medium p-3 whitespace-nowrap lg:text-sm lg:p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 lg:p-4">
                    <p className="text-white font-medium">{b.event_name || 'Booking Request'}</p>
                    <p className="text-gray-500 text-xs">{b.event_type || 'Gig'} {b.duration_hours ? `• ${b.duration_hours}h` : ''}</p>
                  </td>
                  <td className="p-3 lg:p-4">
                    {b.artist_id ? (
                      <button
                        onClick={() => openEntityModal('artist', b.artist_id!)}
                        className="text-[#d3da0c] hover:underline font-medium text-sm text-left flex items-center gap-1 group"
                      >
                        {b.artist_name || 'View Artist'}
                        <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">{b.artist_name || '-'}</span>
                    )}
                  </td>
                  <td className="p-3 lg:p-4">
                    {b.requester_id ? (
                      <button
                        onClick={() => openEntityModal('user', b.requester_id!)}
                        className="text-white hover:text-[#d3da0c] text-sm text-left flex items-center gap-1 group transition-colors"
                      >
                        {b.requester_name || 'View Requester'}
                        <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#d3da0c] transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">{b.requester_name || '-'}</span>
                    )}
                  </td>
                  <td className="p-3 lg:p-4 text-sm text-gray-400">
                    <p>{b.event_date ? new Date(b.event_date).toLocaleDateString() : '-'}</p>
                    {b.event_city && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin className="w-3 h-3" /> {b.event_city}
                      </span>
                    )}
                  </td>
                  <td className="p-3 lg:p-4 text-sm font-semibold text-white">
                    ¥{(b.agreed_price || b.budget || 0).toLocaleString()}
                  </td>
                  <td className="p-3 lg:p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      b.status?.toLowerCase() === 'accepted' || b.status?.toLowerCase() === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                      b.status?.toLowerCase() === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                      b.status?.toLowerCase() === 'rejected' || b.status?.toLowerCase() === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3 lg:p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {b.status?.toLowerCase() === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'ACCEPTED')}
                            disabled={actionLoading === `booking-accepted-${b.id}`}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-green-400 hover:text-green-300 disabled:opacity-50"
                            title="Accept Booking"
                          >
                            {actionLoading === `booking-accepted-${b.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Enter rejection reason:');
                              if (reason) handleUpdateBookingStatus(b.id, 'REJECTED', reason);
                            }}
                            disabled={actionLoading === `booking-rejected-${b.id}`}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50"
                            title="Reject Booking"
                          >
                            {actionLoading === `booking-rejected-${b.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      {b.status?.toLowerCase() !== 'cancelled' && b.status?.toLowerCase() !== 'completed' && b.status?.toLowerCase() !== 'rejected' && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to cancel this booking?')) {
                              handleUpdateBookingStatus(b.id, 'CANCELLED');
                            }
                          }}
                          disabled={actionLoading === `booking-cancelled-${b.id}`}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                          title="Cancel Booking"
                        >
                          {actionLoading === `booking-cancelled-${b.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const PaymentsTabContent = () => (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 lg:p-6 border-b border-white/10 bg-[#141414] shrink-0">
        <h3 className="text-lg font-semibold text-white">{t('admin.dashboard.paymentManagement')}</h3>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
        </div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('admin.dashboard.noPayoutsPending')}</p>
          <p className="text-sm mt-1">{t('admin.dashboard.payoutRequestsWillAppear')}</p>
        </div>
      ) : (
        <div className="p-4 lg:p-6 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          {payouts.map((payout) => (
            <div key={payout.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="text-white font-medium">{payout.business}</p>
                <p className="text-gray-400 text-sm">¥{payout.amount?.toLocaleString()}</p>
              </div>
              <button
                onClick={() => handleProcessPayout(payout.id)}
                disabled={actionLoading === `payout-${payout.id}`}
                className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === `payout-${payout.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('admin.dashboard.process')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'users':
        return <UsersTab />;
      case 'admins':
        return <AdminsTab />;
      case 'businesses':
        return <BusinessesTab />;
      case 'artists':
        return <ArtistsTab />;
      case 'vendors':
        return <VendorsTab />;
      case 'events':
        return <EventsTab />;
      case 'bookings':
        return <BookingsTab />;
      case 'payments':
        return <PaymentsTabContent />;
      default:
        return <OverviewTab />;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'overview': return t('admin.dashboard.title');
      case 'users': return t('admin.dashboard.usersTabTitle') || 'User Management';
      case 'admins': return t('admin.dashboard.adminsTabTitle') || 'Admin Management';
      case 'businesses': return t('admin.dashboard.businessesTabTitle') || 'Business Management';
      case 'artists': return t('admin.dashboard.artistsTabTitle') || 'Artist Management';
      case 'vendors': return t('admin.dashboard.vendorsTabTitle') || 'Vendor Management';
      case 'events': return t('admin.dashboard.eventsTabTitle') || 'Event Management';
      case 'bookings': return t('admin.dashboard.bookingsTabTitle') || 'Booking Management';
      case 'payments': return t('admin.dashboard.paymentsTabTitle') || 'Payment Management';
      default: return t('admin.dashboard.title');
    }
  };

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'overview': return t('admin.dashboard.subtitle');
      case 'users': return t('admin.dashboard.usersTabSubtitle') || 'Manage platform users and their access';
      case 'admins': return t('admin.dashboard.adminsTabSubtitle') || 'Manage administrator accounts';
      case 'businesses': return t('admin.dashboard.businessesTabSubtitle') || 'Oversee business and organizer accounts';
      case 'artists': return t('admin.dashboard.artistsTabSubtitle') || 'Manage artist profiles and verifications';
      case 'vendors': return t('admin.dashboard.vendorsTabSubtitle') || 'Review and manage vendor stores and goods';
      case 'events': return t('admin.dashboard.eventsTabSubtitle') || 'Review and manage platform events';
      case 'bookings': return t('admin.dashboard.bookingsTabSubtitle') || 'Monitor and manage artist booking requests';
      case 'payments': return t('admin.dashboard.paymentsTabSubtitle') || 'Process payouts and review transactions';
      default: return t('admin.dashboard.subtitle');
    }
  };

  return (
    <div className="min-h-screen bg-[#020b00]">
      {/* Page Header */}
      <div className="px-4 pt-6 pb-2 lg:px-8 lg:pt-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white lg:text-4xl tracking-tight">{getTabTitle()}</h1>
            <p className="text-gray-500 mt-1 text-sm">{getTabSubtitle()}</p>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-50 text-sm shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('admin.dashboard.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Sticky Tab Navigation Bar */}
      <div className="sticky top-0 z-30 bg-[#020b00]/95 backdrop-blur-md px-4 py-3 lg:px-8 border-y border-white/[0.08] shadow-md">
        <div className="flex overflow-x-auto gap-1.5 hide-scrollbar py-0.5">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={BarChart3} label={t('admin.dashboard.overview')} />
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={Users} label={t('admin.dashboard.users')} />
          <TabButton active={activeTab === 'admins'} onClick={() => setActiveTab('admins')} icon={Shield} label={t('admin.dashboard.admins')} />
          <TabButton active={activeTab === 'businesses'} onClick={() => setActiveTab('businesses')} icon={Building2} label={t('admin.dashboard.businesses')} />
          <TabButton active={activeTab === 'artists'} onClick={() => setActiveTab('artists')} icon={Music} label={t('admin.dashboard.artists')} />
          <TabButton active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} icon={ShoppingBag} label={t('admin.dashboard.vendors') || 'Vendors'} />
          <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={Calendar} label={t('admin.dashboard.events')} />
          <TabButton active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} icon={Briefcase} label={t('admin.dashboard.bookings') || 'Bookings'} />
          <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} icon={CreditCard} label={t('admin.dashboard.payments')} />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 lg:px-8 lg:py-6">
        {renderTab()}
      </div>

      {/* {t('admin.dashboard.addAdmin')} Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-4 w-full max-w-md mx-4 lg:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">{t('admin.dashboard.createNewAdmin')}</h3>
              <button 
                onClick={() => setShowAddAdminModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg min-w-[36px] min-h-[36px]"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.dashboard.emailLabel')}</label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.dashboard.firstName')}</label>
                  <input
                    type="text"
                    value={newAdmin.first_name}
                    onChange={(e) => setNewAdmin({...newAdmin, first_name: e.target.value})}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">{t('admin.dashboard.lastName')}</label>
                  <input
                    type="text"
                    value={newAdmin.last_name}
                    onChange={(e) => setNewAdmin({...newAdmin, last_name: e.target.value})}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">{t('admin.dashboard.passwordLabel')}</label>
                <input
                  type="password"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={creatingAdmin}
                className="w-full py-2.5 bg-[#d3da0c] text-black font-bold rounded-lg text-sm hover:bg-[#bbc10b] disabled:opacity-50 flex items-center justify-center gap-2 lg:py-3"
              >
                {creatingAdmin ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {t('admin.dashboard.createAdmin')}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Entity Detail & Performance Card Modal */}
      <EntityDetailModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false, id: null })}
        type={modalConfig.type}
        entityId={modalConfig.id}
        onUpdated={loadDashboardData}
      />
    </div>
  );
};

export default AdminDashboard;
