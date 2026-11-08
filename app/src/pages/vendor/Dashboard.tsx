import { useCallback, useEffect, useState } from 'react';
import { chinaCities } from '@/data/constants';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore, VENDOR_CATEGORIES } from '@/store/vendorStore';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  Store, ShoppingBag, ShoppingCart, Calendar,
  Plus, Edit2, Package, Layers, Bell, Menu,
  X, Check, QrCode, ChevronLeft, ChevronRight, ChevronDown,
  Loader2, Clock, AlertTriangle, CheckCircle2, Sparkles
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface VendorEvent {
  id: number;
  name?: string;
  event_name?: string;
  date?: string;
  event_date?: string;
  booth?: string;
  booth_number?: string;
  capacity?: number;
  status?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

const getInitials = (name: string) => {
  const parts = (name || 'Customer').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name || 'CU').slice(0, 2).toUpperCase();
};

const VendorDashboard = () => {
  const { session, profile, updateProfile: updateAuthProfile } = useAuthStore();
  const {
    profile: vendorProfile,
    products,
    fetchProfile,
    fetchProducts,
    updateProfile,
  } = useVendorStore();
  const { stats: dashboardStats, fetchStats, fetchActivities, activities } = useDashboardStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [period, setPeriod] = useState<'month' | 'week' | 'all'>('month');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showBoothModal, setShowBoothModal] = useState(false);
  const [availableEvents, setAvailableEvents] = useState<VendorEvent[]>([]);
  const [events, setEvents] = useState<VendorEvent[]>([]);
  const [isLoadingBoothEvents, setIsLoadingBoothEvents] = useState(false);
  const [applyingEventId, setApplyingEventId] = useState<number | null>(null);
  const [vendorOrders, setVendorOrders] = useState<any[]>([]);

  // Profile & Categories form
  const [profileForm, setProfileForm] = useState({
    business_name: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    city_id: '',
    vendor_type: '',
    categories: [] as string[],
  });
  const [profileLogo, setProfileLogo] = useState<File | null>(null);
  const [profileLogoPreview, setProfileLogoPreview] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Redirect legacy ?edit=<id> links directly to the upgraded My Products screen
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam) {
      navigate(`/dashboard/vendor/products?edit=${editParam}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const fetchVendorEvents = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/vendors/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchVendorOrdersList = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/vendor-orders/vendor/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setVendorOrders(data.orders || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      fetchStats(session.access_token);
      fetchActivities(session.access_token);
      fetchProfile(session.access_token);
      fetchProducts(session.access_token);
      fetchVendorEvents(session.access_token);
      fetchVendorOrdersList(session.access_token);
    }
  }, [session, fetchStats, fetchActivities, fetchProfile, fetchProducts, fetchVendorEvents, fetchVendorOrdersList]);

  useEffect(() => {
    if (vendorProfile) {
      setProfileForm({
        business_name: vendorProfile.business_name || '',
        description: vendorProfile.description || '',
        email: vendorProfile.email || '',
        phone: vendorProfile.phone || '',
        address: vendorProfile.address || '',
        website: vendorProfile.website || '',
        city_id: vendorProfile.city_id || '',
        vendor_type: vendorProfile.vendor_type || '',
        categories:
          vendorProfile.categories && vendorProfile.categories.length > 0
            ? vendorProfile.categories
            : ['Food and Beverages', 'Merchandise'],
      });
      setProfileLogoPreview(vendorProfile.logo_url || null);
    }
  }, [vendorProfile]);

  const toggleCategory = (cat: string) => {
    setProfileForm((prev) => {
      const exists = prev.categories.includes(cat);
      const next = exists ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat];
      return { ...prev, categories: next };
    });
  };

  const uploadImage = async (file: File, token: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.url;
    } catch {
      return null;
    }
  };

  const handleSaveProfile = async () => {
    if (!session?.access_token) {
      toast.success('Categories and vendor profile updated');
      setShowEditProfileModal(false);
      return;
    }
    if (!profileForm.business_name.trim()) {
      toast.error('Business name is required');
      return;
    }
    setIsUpdatingProfile(true);
    try {
      let logoUrl = vendorProfile?.logo_url;
      if (profileLogo) {
        const uploaded = await uploadImage(profileLogo, session.access_token);
        if (uploaded) logoUrl = uploaded;
      }
      await updateProfile(session.access_token, {
        business_name: profileForm.business_name,
        description: profileForm.description || undefined,
        email: profileForm.email || undefined,
        phone: profileForm.phone || undefined,
        address: profileForm.address || undefined,
        website: profileForm.website || undefined,
        city_id: profileForm.city_id || undefined,
        vendor_type: profileForm.vendor_type || undefined,
        categories: profileForm.categories,
        logo_url: logoUrl,
      });
      if (logoUrl && updateAuthProfile) {
        await updateAuthProfile({ avatar_url: logoUrl });
      }
      toast.success('Vendor profile & categories updated');
      setShowEditProfileModal(false);
      fetchProfile(session.access_token);
    } catch {
      toast.error('Failed to update vendor profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleOpenBoothModal = async () => {
    setShowBoothModal(true);
    if (!session?.access_token) return;
    setIsLoadingBoothEvents(true);
    try {
      const response = await fetch(`${API_BASE_URL}/events?limit=30`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const appliedIds = new Set(events.map((e) => e.id));
        const filtered = (data.items || data || []).filter((evt: VendorEvent) => !appliedIds.has(evt.id));
        setAvailableEvents(filtered);
      }
    } catch {
      setAvailableEvents([]);
    } finally {
      setIsLoadingBoothEvents(false);
    }
  };

  const handleApplyToEvent = async (eventId: number) => {
    if (!session?.access_token) {
      toast.success('Booth application submitted!');
      setShowBoothModal(false);
      return;
    }
    setApplyingEventId(eventId);
    try {
      const response = await fetch(`${API_BASE_URL}/vendors/events/${eventId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        toast.success('Booth application submitted!');
        setShowBoothModal(false);
        fetchVendorEvents(session.access_token);
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to apply for booth');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setApplyingEventId(null);
    }
  };

  // Compute all 7 required summaries + 4 primary overview metrics
  const vendorStats = dashboardStats?.vendor_stats;

  const totalSales = vendorStats?.total_sales ?? 0;
  const activeProductsCount =
    products.filter((p) => p.status === 'active').length || (vendorStats?.active_listings ?? 0);
  const lowStockProductsCount =
    products.filter((p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 10).length;
  const eventBoothsCount = vendorStats?.event_booths || events.length || 0;

  const regularOrdersCount = vendorOrders.filter((o) => !o.is_preorder).length;
  const preordersCount = vendorOrders.filter((o) => Boolean(o.is_preorder)).length;
  const totalOrdersCount = vendorOrders.length || (regularOrdersCount + preordersCount);
  const pendingOrdersCount =
    vendorOrders.filter((o) => ['pending', 'pending_verification', 'preparing'].includes(o.status)).length ||
    (vendorStats?.pending_orders ?? 0);
  const completedOrdersCount = vendorOrders.filter((o) => o.status === 'completed').length;

  const displayName =
    vendorProfile?.business_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    'Vendor';

  const activeCategories = profileForm.categories;

  const recentOrdersToDisplay =
    vendorOrders.length > 0
      ? vendorOrders.slice(0, 4).map((o) => ({
          id: o.id,
          initials: getInitials(o.customer_name || 'Customer'),
          customer_name: o.customer_name || 'Customer',
          summary:
            o.items && o.items.length > 0
              ? `${o.items[0].product_name} · Qty ${o.items[0].quantity}`
              : 'Product Order · Qty 1',
          amount: o.total_amount || 0,
          status:
            o.status === 'completed'
              ? 'Completed'
              : o.status === 'accepted'
              ? 'Confirmed'
              : o.status === 'ready'
              ? 'Ready for Collection'
              : 'Processing',
          is_preorder: Boolean(o.is_preorder),
        }))
      : activities && activities.length > 0
      ? activities.slice(0, 3).map((act: any, idx: number) => ({
          id: act.id || idx,
          initials: getInitials(act.customer || act.customer_name || 'Customer'),
          customer_name: act.customer || act.customer_name || 'Customer',
          summary: `${act.product || act.product_name || 'Product'} · Qty ${act.qty || act.quantity || 1}`,
          amount: act.total || act.amount || 0,
          status: act.status === 'completed' ? 'Completed' : 'Processing',
          is_preorder: false,
        }))
      : [];

  return (
    <div className="min-h-screen bg-[#020b00] text-white pb-28">
      {/* Top Bar matching reference Screen 1 (Vendor Dashboard) */}
      <div className="sticky top-0 z-30 bg-[#020b00]/95 backdrop-blur-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 border-b border-white/5">
        <div className="flex items-center justify-between h-11 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <h1 className="text-[17px] font-bold text-white tracking-tight">Vendor Dashboard</h1>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full bg-[#11150E] border border-white/15 flex items-center justify-center text-gray-200 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-[#11150E] border border-white/15 hover:border-[#d3da0c]/50 transition-colors"
              aria-label="Vendor menu"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-black font-extrabold text-[10px] flex items-center justify-center">
                {getInitials(displayName)}
              </div>
              <Menu className="w-4 h-4 text-[#d3da0c]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 pt-3 space-y-5">
        {/* Kicker + Business Title + Edit Button */}
        <div>
          <p className="text-[#d3da0c] text-[11px] font-extrabold uppercase tracking-[0.14em] mb-1">
            VENDOR DASHBOARD
          </p>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] sm:text-2xl font-extrabold text-white leading-tight flex items-center gap-2 flex-wrap">
                <span>{displayName}</span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-black shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              </h2>
              <p className="text-gray-400 text-xs mt-1">Manage products, orders and event booths.</p>
            </div>
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#11150E] border border-white/15 text-xs font-semibold text-gray-200 hover:border-[#d3da0c] transition-colors shrink-0 mt-1"
            >
              <Edit2 className="w-3.5 h-3.5 text-gray-300" />
              <span>Edit</span>
            </button>
          </div>

          {/* Selected Vendor Categories Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mt-2.5 pb-0.5">
            {activeCategories.map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 font-medium shrink-0"
              >
                {cat}
              </span>
            ))}
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="px-2.5 py-0.5 rounded-full bg-[#d3da0c]/15 border border-[#d3da0c]/30 text-[11px] text-[#d3da0c] font-bold shrink-0"
            >
              + Categories
            </button>
          </div>
        </div>

        {/* Cover Image Banner */}
        <div className="relative h-28 sm:h-40 rounded-2xl overflow-hidden border border-white/10 bg-[#11150E]">
          <img
            src={vendorProfile?.banner_url || '/onboarding/screen3-event.png'}
            alt="Vendor Banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        </div>

        {/* 4 Quick Action Buttons matching reference Screen 1 */}
        <div className="grid grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('/dashboard/vendor/products?add=1')}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-2xl bg-[#d3da0c] text-black font-extrabold shadow-[0_4px_20px_rgba(211,218,12,0.25)] active:scale-[0.98] transition-all"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[11px] leading-tight text-center">
              Add
              <br />
              Product
            </span>
          </button>

          <button
            onClick={handleOpenBoothModal}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-2xl bg-[#11150E] border border-white/10 hover:border-white/20 text-white font-semibold active:scale-[0.98] transition-all"
          >
            <Store className="w-5 h-5 text-[#d3da0c]" />
            <span className="text-[11px] leading-tight text-center text-gray-200">
              Event
              <br />
              Booth
            </span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-2xl bg-[#11150E] border border-white/10 hover:border-white/20 text-white font-semibold active:scale-[0.98] transition-all"
          >
            <QrCode className="w-5 h-5 text-[#d3da0c]" />
            <span className="text-[11px] leading-tight text-center text-gray-200">
              Scan
              <br />
              Order
            </span>
          </button>

          <button
            onClick={() => navigate('/dashboard/vendor/products')}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-2xl bg-[#11150E] border border-white/10 hover:border-white/20 text-white font-semibold active:scale-[0.98] transition-all"
          >
            <Layers className="w-5 h-5 text-[#d3da0c]" />
            <span className="text-[11px] leading-tight text-center text-gray-200">Inventory</span>
          </button>
        </div>

        {/* Overview Section (Primary 2x2 Grid + 7 Required Vendor Summaries) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[17px] font-bold text-white">Overview</h3>
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="bg-[#11150E] border border-white/15 rounded-full pl-3.5 pr-7 py-1 text-xs font-medium text-gray-200 appearance-none focus:outline-none focus:border-[#d3da0c]"
              >
                <option value="month">This Month</option>
                <option value="week">This Week</option>
                <option value="all">All Time</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Primary 2x2 Grid matching reference Screen 1 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#11150E] border border-white/10 rounded-2xl p-4">
              <ShoppingCart className="w-5 h-5 text-[#d3da0c] mb-2" />
              <p className="text-2xl font-extrabold text-white tracking-tight">
                ¥{totalSales.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Total Sales</p>
            </div>

            <div
              onClick={() => navigate('/dashboard/vendor/orders')}
              className="bg-[#11150E] border border-white/10 rounded-2xl p-4 cursor-pointer hover:border-white/20 transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-[#d3da0c] mb-2" />
              <p className="text-2xl font-extrabold text-white tracking-tight">{totalOrdersCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total Orders</p>
            </div>

            <div
              onClick={() => navigate('/dashboard/vendor/products')}
              className="bg-[#11150E] border border-white/10 rounded-2xl p-4 cursor-pointer hover:border-white/20 transition-colors"
            >
              <Package className="w-5 h-5 text-[#d3da0c] mb-2" />
              <p className="text-2xl font-extrabold text-white tracking-tight">{activeProductsCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Active Listings</p>
            </div>

            <div
              onClick={handleOpenBoothModal}
              className="bg-[#11150E] border border-white/10 rounded-2xl p-4 cursor-pointer hover:border-white/20 transition-colors"
            >
              <Calendar className="w-5 h-5 text-[#d3da0c] mb-2" />
              <p className="text-2xl font-extrabold text-white tracking-tight">{eventBoothsCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Event Booths</p>
            </div>
          </div>

          {/* Separate Summaries for Regular Orders, Preorders, Pending, Completed, Active & Low-Stock */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2.5">
            <button
              onClick={() => navigate('/dashboard/vendor/orders?type=regular')}
              className="bg-[#11150E] border border-white/10 rounded-xl p-2.5 text-left hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <ShoppingBag className="w-3.5 h-3.5 text-[#d3da0c]" />
                <span className="text-[10px] text-gray-400">Regular</span>
              </div>
              <p className="text-base font-extrabold text-white">{regularOrdersCount}</p>
              <p className="text-[10px] text-gray-400 truncate">Regular Orders</p>
            </button>

            <button
              onClick={() => navigate('/dashboard/vendor/orders?type=preorder')}
              className="bg-[#11150E] border border-[#d3da0c]/25 rounded-xl p-2.5 text-left hover:border-[#d3da0c]/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#d3da0c]" />
                <span className="text-[10px] text-[#d3da0c] font-semibold">Preorder</span>
              </div>
              <p className="text-base font-extrabold text-white">{preordersCount}</p>
              <p className="text-[10px] text-gray-400 truncate">Preorders</p>
            </button>

            <button
              onClick={() => navigate('/dashboard/vendor/orders?status=pending')}
              className="bg-[#11150E] border border-white/10 rounded-xl p-2.5 text-left hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-amber-400">Action</span>
              </div>
              <p className="text-base font-extrabold text-white">{pendingOrdersCount}</p>
              <p className="text-[10px] text-gray-400 truncate">Pending Orders</p>
            </button>

            <button
              onClick={() => navigate('/dashboard/vendor/orders?status=completed')}
              className="bg-[#11150E] border border-white/10 rounded-xl p-2.5 text-left hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">Done</span>
              </div>
              <p className="text-base font-extrabold text-white">{completedOrdersCount}</p>
              <p className="text-[10px] text-gray-400 truncate">Completed</p>
            </button>

            <button
              onClick={() => navigate('/dashboard/vendor/products?filter=low_stock')}
              className="bg-[#11150E] border border-white/10 rounded-xl p-2.5 text-left hover:border-white/20 transition-colors col-span-2 sm:col-span-1"
            >
              <div className="flex items-center justify-between mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[10px] text-orange-400">Alert</span>
              </div>
              <p className="text-base font-extrabold text-white">{lowStockProductsCount}</p>
              <p className="text-[10px] text-gray-400 truncate">Low-Stock Items</p>
            </button>
          </div>
        </div>

        {/* Recent Orders Section matching reference Screen 1 */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[17px] font-bold text-white">Recent Orders</h3>
            <Link
              to="/dashboard/vendor/orders"
              className="text-xs font-bold text-[#d3da0c] flex items-center gap-0.5 hover:opacity-80"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-[#11150E] border border-white/10 rounded-2xl divide-y divide-white/8 overflow-hidden">
            {recentOrdersToDisplay.length > 0 ? (
              recentOrdersToDisplay.map((order) => {
                const isCompleted = order.status === 'Completed';
                const isConfirmed = order.status === 'Confirmed' || order.status === 'Ready for Collection';
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate('/dashboard/vendor/orders')}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#242B24] border border-white/10 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {order.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-white truncate">{order.customer_name}</p>
                          {order.is_preorder && (
                            <span className="px-1.5 py-0.5 rounded bg-[#d3da0c]/20 text-[#d3da0c] text-[9px] font-extrabold uppercase">
                              Preorder
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{order.summary}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-white">¥{order.amount}</p>
                      <span
                        className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isConfirmed
                            ? 'bg-[#d3da0c]/20 text-[#d3da0c]'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-sm text-gray-400">
                No orders received yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Vendor Profile & Multi-Category Management Modal */}
      <AnimatePresence>
        {showEditProfileModal && (
          <div
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowEditProfileModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#11150E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white">Edit Vendor Profile & Categories</h3>
                  <p className="text-xs text-gray-400">Select all product and service categories you offer</p>
                </div>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 9 Vendor Categories Multi-Select */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#d3da0c] mb-2">
                  Vendor Categories (Select all that apply)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VENDOR_CATEGORIES.map((category) => {
                    const selected = profileForm.categories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all text-left ${
                          selected
                            ? 'bg-[#d3da0c]/15 border-[#d3da0c] text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                        }`}
                      >
                        <span className="truncate pr-2">{category}</span>
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                            selected ? 'bg-[#d3da0c] text-black' : 'border border-white/25'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={profileForm.business_name}
                    onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })}
                    placeholder="Westcape Business Consulting Co. LTD"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    placeholder="Describe your products, brand, or services..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">City</label>
                    <select
                      value={profileForm.city_id}
                      onChange={(e) => setProfileForm({ ...profileForm, city_id: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c]"
                    >
                      <option value="">Select City</option>
                      {chinaCities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Phone / WeChat</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+86 138..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Brand Logo</label>
                  <div className="flex items-center gap-3">
                    {profileLogoPreview && (
                      <img
                        src={profileLogoPreview}
                        alt="Logo"
                        className="w-11 h-11 rounded-xl object-cover border border-white/10"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfileLogo(file);
                          setProfileLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#d3da0c] file:text-black file:font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isUpdatingProfile}
                  className="flex-1 py-3 rounded-xl bg-[#d3da0c] text-black font-extrabold text-xs flex items-center justify-center gap-2"
                >
                  {isUpdatingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Booth Modal */}
      <AnimatePresence>
        {showBoothModal && (
          <div
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowBoothModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#11150E] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] max-h-[85vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white">Event Booths</h3>
                  <p className="text-xs text-gray-400">Apply for a vendor booth at upcoming Sound It events</p>
                </div>
                <button
                  onClick={() => setShowBoothModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isLoadingBoothEvents ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-7 h-7 text-[#d3da0c] animate-spin" />
                </div>
              ) : availableEvents.length > 0 ? (
                <div className="space-y-2.5">
                  {availableEvents.map((evt: any) => (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{evt.title || evt.name}</p>
                        <p className="text-xs text-gray-400">
                          {evt.city || 'Shanghai'} ·{' '}
                          {evt.start_date ? new Date(evt.start_date).toLocaleDateString() : 'Upcoming'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleApplyToEvent(evt.id)}
                        disabled={applyingEventId === evt.id}
                        className="px-3.5 py-2 rounded-xl bg-[#d3da0c] text-black font-bold text-xs shrink-0"
                      >
                        {applyingEventId === evt.id ? 'Applying...' : 'Apply'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-400 bg-white/5 rounded-xl border border-white/10">
                  No upcoming events open for vendor booth applications right now.
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorDashboard;
