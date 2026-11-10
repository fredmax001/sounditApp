import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Loader2, Search, Bell, Menu, Eye, X,
  CheckCircle2, Clock, Calendar, Check, ChevronDown, ChevronLeft,
  ChevronRight, Phone, MapPin, AlertCircle, ShoppingBag, QrCode
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface VendorOrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

interface VendorOrder {
  id: number;
  order_code?: string;
  customer_name: string;
  customer_phone?: string;
  delivery_location?: string;
  customer_notes?: string;
  payment_method: string;
  payment_screenshot?: string;
  total_amount: number;
  status: string;
  is_preorder?: boolean;
  fulfilment_date?: string;
  order_qr_code?: string;
  rejection_reason?: string;
  created_at: string;
  items: VendorOrderItem[];
  initials?: string;
}

const getInitials = (name: string) => {
  const parts = (name || 'Customer').trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name || 'CU').slice(0, 2).toUpperCase();
};

const VendorOrders = () => {
  const { session, profile } = useAuthStore();
  const { profile: vendorProfile } = useVendorStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'new' | 'processing' | 'completed' | 'cancelled' | 'preorders'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

  // Detail Modal & Status Workflow State
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Defense-in-depth: Redirect non-vendors away from vendor orders
  useEffect(() => {
    const role = profile?.role_type || profile?.role;
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (profile && role !== 'vendor' && !isAdmin) {
      if (role === 'business' || role === 'organizer') {
        navigate('/dashboard/business', { replace: true });
      } else if (role === 'artist' || role === 'dj') {
        navigate('/dashboard/artist', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [profile, navigate]);

  // Read URL filter if present (e.g., from Dashboard quick summary tiles)
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'preorder') setFilterTab('preorders');
    const statusParam = searchParams.get('status');
    if (statusParam === 'pending') setFilterTab('new');
    if (statusParam === 'completed') setFilterTab('completed');
  }, [searchParams]);

  const fetchOrders = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/vendor-orders/vendor/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch {
      // Fallback used for simulator preview
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      fetchOrders(session.access_token);
    }
  }, [session, fetchOrders]);

  const handleUpdateStatus = async (orderId: number, nextStatus: string) => {
    setIsUpdatingStatus(true);
    if (session?.access_token) {
      try {
        const res = await fetch(`${API_BASE_URL}/vendor-orders/${orderId}/status`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (res.ok) {
          toast.success(`Order status updated to ${nextStatus.replace(/_/g, ' ')}`);
          await fetchOrders(session.access_token);
          if (selectedOrder) {
            setSelectedOrder({ ...selectedOrder, status: nextStatus });
          }
        } else {
          const err = await res.json();
          toast.error(err.detail || 'Failed to update order status');
        }
      } catch {
        toast.error('Network error');
      } finally {
        setIsUpdatingStatus(false);
      }
    } else {
      // Offline / simulator demo
      toast.success(`Order status updated to ${nextStatus.replace(/_/g, ' ')} (preview)`);
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
      setIsUpdatingStatus(false);
    }
  };

  const activeSourceOrders = orders;

  // Extract unique products for dropdown
  const uniqueProducts = Array.from(
    new Set(
      activeSourceOrders.flatMap((o) => (o.items || []).map((i) => i.product_name)).filter(Boolean)
    )
  );

  const filteredOrders = activeSourceOrders.filter((order) => {
    const rawStatus = (order.status || '').toLowerCase();
    const isNew = ['pending', 'pending_verification'].includes(rawStatus);
    const isProcessing = ['processing', 'accepted', 'preparing', 'ready'].includes(rawStatus);
    const isCompleted = rawStatus === 'completed';
    const isCancelled = ['cancelled', 'rejected'].includes(rawStatus);

    if (filterTab === 'new' && !isNew) return false;
    if (filterTab === 'processing' && !isProcessing) return false;
    if (filterTab === 'completed' && !isCompleted) return false;
    if (filterTab === 'cancelled' && !isCancelled) return false;
    if (filterTab === 'preorders' && !order.is_preorder) return false;

    if (selectedProductFilter !== 'all') {
      const hasProduct = (order.items || []).some((i) => i.product_name === selectedProductFilter);
      if (!hasProduct) return false;
    }

    if (selectedDateFilter !== 'all' && order.created_at) {
      const created = new Date(order.created_at).getTime();
      const now = Date.now();
      if (selectedDateFilter === 'today' && now - created > 24 * 3600 * 1000) return false;
      if (selectedDateFilter === 'week' && now - created > 7 * 24 * 3600 * 1000) return false;
      if (selectedDateFilter === 'month' && now - created > 30 * 24 * 3600 * 1000) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (order.customer_name || '').toLowerCase().includes(q);
      const matchCode = (order.order_code || `OD-${order.id}`).toLowerCase().includes(q);
      const matchProduct = (order.items || []).some((i) => i.product_name.toLowerCase().includes(q));
      if (!matchName && !matchCode && !matchProduct) return false;
    }

    return true;
  });

  const vendorDisplayName =
    vendorProfile?.business_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    'Vendor Store';

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          Completed
        </span>
      );
    }
    if (['processing', 'preparing'].includes(s)) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          Processing
        </span>
      );
    }
    if (['accepted', 'confirmed'].includes(s)) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#d3da0c]/20 text-[#d3da0c] border border-[#d3da0c]/30">
          Confirmed
        </span>
      );
    }
    if (['ready', 'ready_for_collection'].includes(s)) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          Ready for Pickup
        </span>
      );
    }
    if (['pending', 'pending_verification'].includes(s)) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          New Order
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
        Cancelled
      </span>
    );
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return 'Nov 18, 2026 · 20:14';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#020b00] text-white pb-28">
      {/* Top Header matching reference Screen 3 (Orders) */}
      <div className="sticky top-0 z-30 bg-[#020b00]/95 backdrop-blur-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-white/5">
        <div className="flex items-center justify-between h-11 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/dashboard/vendor')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors -ml-1"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <h1 className="text-[17px] font-bold text-white tracking-tight">Orders</h1>

          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="w-9 h-9 rounded-full bg-[#11150E] border border-white/15 flex items-center justify-center text-gray-200 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <button
              onClick={() => navigate('/dashboard/vendor')}
              className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-[#11150E] border border-white/15"
              aria-label="Vendor profile"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-[#1a2312] border border-[#d3da0c]/40 flex items-center justify-center">
                <img
                  src="/default-avatar.png"
                  alt={vendorDisplayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <Menu className="w-4 h-4 text-[#d3da0c]" />
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-2.5 mt-2">
          {/* Status Filter Tabs: All | New | Processing | Completed | Cancelled | Preorders */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'new', label: 'New' },
                { id: 'processing', label: 'Processing' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled' },
                { id: 'preorders', label: 'Preorders' },
              ] as const
            ).map((tab) => {
              const active = filterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                    active
                      ? 'bg-[#d3da0c] text-black shadow-[0_0_12px_rgba(211,218,12,0.3)]'
                      : 'bg-[#11150E] text-gray-300 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Bar matching reference Screen 3 */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, order ID or product"
              className="w-full bg-[#11150E] border border-white/10 text-white placeholder-gray-500 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] text-xs"
            />
          </div>

          {/* Two Dropdowns: All Dates | All Products */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value as any)}
                className="w-full bg-[#11150E] border border-white/10 text-white pl-8 pr-7 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] appearance-none text-xs font-medium"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <ShoppingBag className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="w-full bg-[#11150E] border border-white/10 text-white pl-8 pr-7 py-2.5 rounded-xl focus:outline-none focus:border-[#d3da0c] appearance-none text-xs font-medium truncate"
              >
                <option value="all">All Products</option>
                {uniqueProducts.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Orders List matching reference Screen 3 */}
      <div className="max-w-4xl mx-auto px-4 pt-3 space-y-3">
        {isLoading && orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin mb-3" />
            <p className="text-gray-400 text-xs">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-[#11150E] border border-white/10 rounded-2xl p-10 text-center text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-500" />
            <p className="text-base font-bold text-white mb-1">No orders found</p>
            <p className="text-xs">Incoming customer orders and preorders will appear here.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const firstItem = order.items?.[0];
            const orderCode = order.order_code || `OD-${order.id}`;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#11150E] border border-white/10 rounded-2xl p-4 space-y-3"
              >
                {/* Top Row: Initials Avatar + Customer Name + Order ID + Status Badge */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/8">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#242B24] border border-white/10 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {getInitials(order.customer_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[15px] font-bold text-white truncate">
                          {order.customer_name}
                        </p>
                        {order.is_preorder && (
                          <span className="px-1.5 py-0.5 rounded bg-[#d3da0c]/20 text-[#d3da0c] text-[9px] font-extrabold uppercase">
                            Preorder
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">Order #{orderCode}</p>
                    </div>
                  </div>

                  {renderStatusBadge(order.status)}
                </div>

                {/* Middle Row: Product Image + Product Name & Qty | Price */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/10 overflow-hidden shrink-0">
                      <img
                        src={order.payment_screenshot || '/event_placeholder.jpg'}
                        alt="Product"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/event_placeholder.jpg';
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-200 truncate">
                        {firstItem?.product_name || 'Assorted Items'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Qty: {firstItem?.quantity || 1}
                        {order.items && order.items.length > 1 && (
                          <span className="text-gray-500"> (+{order.items.length - 1} more)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="text-lg font-extrabold text-white shrink-0">
                    ¥{order.total_amount}
                  </span>
                </div>

                {/* Bottom Row: Timestamp + View Details with Eye Icon matching reference Screen 3 */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/8 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#d3da0c]" />
                    <span>{formatTimestamp(order.created_at)}</span>
                  </div>

                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-200 hover:text-white transition-colors"
                  >
                    <Eye className="w-4 h-4 text-[#d3da0c]" />
                    <span>View Details</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Order Details & Workflow Management Sheet Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedOrder(null)}
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
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Order #{selectedOrder.order_code || `OD-${selectedOrder.id}`}</span>
                    {selectedOrder.is_preorder && (
                      <span className="px-2 py-0.5 rounded bg-[#d3da0c]/20 text-[#d3da0c] text-[10px] font-extrabold">
                        PREORDER
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400">{formatTimestamp(selectedOrder.created_at)}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Info Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Customer:</span>
                  <span className="text-white font-bold">{selectedOrder.customer_name}</span>
                </div>
                {selectedOrder.customer_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-gray-200">{selectedOrder.customer_phone}</span>
                  </div>
                )}
                {selectedOrder.delivery_location && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Delivery / Table:</span>
                    <span className="text-gray-200">{selectedOrder.delivery_location}</span>
                  </div>
                )}
                {selectedOrder.fulfilment_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#d3da0c] font-semibold">Expected Fulfilment:</span>
                    <span className="text-[#d3da0c] font-bold">{selectedOrder.fulfilment_date}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Order Items
                </p>
                <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/8 p-3 text-xs">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold">{item.product_name}</p>
                        <p className="text-gray-400 text-[11px]">
                          ¥{item.product_price} × {item.quantity}
                        </p>
                      </div>
                      <span className="text-white font-bold">¥{item.subtotal || item.product_price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="pt-2.5 mt-2 flex items-center justify-between border-t border-white/10 font-bold">
                    <span className="text-white text-sm">Total Amount</span>
                    <span className="text-base text-[#d3da0c]">¥{selectedOrder.total_amount}</span>
                  </div>
                </div>
              </div>

              {/* Payment Proof Button */}
              {selectedOrder.payment_screenshot && (
                <button
                  type="button"
                  onClick={() => setViewScreenshotUrl(selectedOrder.payment_screenshot || null)}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 hover:bg-white/10"
                >
                  <Eye className="w-4 h-4 text-[#d3da0c]" />
                  <span>View Customer Payment Proof</span>
                </button>
              )}

              {/* Status Progression Workflow */}
              <div>
                <p className="text-xs font-bold text-[#d3da0c] uppercase tracking-wider mb-2">
                  Update Order Status (Sends notification to customer)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'accepted')}
                    disabled={isUpdatingStatus}
                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white hover:border-[#d3da0c] flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-[#d3da0c]" />
                    <span>Confirm Order</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}
                    disabled={isUpdatingStatus}
                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white hover:border-blue-400 flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mark Preparing</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'ready')}
                    disabled={isUpdatingStatus}
                    className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white hover:border-cyan-400 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ready for Collection</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'completed')}
                    disabled={isUpdatingStatus}
                    className="py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mark Completed</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    const reason = prompt('Enter cancellation reason:') || 'Order cancelled by vendor';
                    handleUpdateStatus(selectedOrder.id, 'cancelled');
                  }}
                  disabled={isUpdatingStatus}
                  className="w-full mt-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                >
                  Cancel Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Screenshot Zoom Lightbox */}
      <AnimatePresence>
        {viewScreenshotUrl && (
          <div
            className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setViewScreenshotUrl(null)}
          >
            <div className="relative max-w-lg w-full bg-[#11150E] border border-white/10 rounded-2xl p-3 shadow-2xl">
              <button
                onClick={() => setViewScreenshotUrl(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={viewScreenshotUrl}
                alt="Payment Proof"
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorOrders;
