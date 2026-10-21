import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Loader2, Inbox, Check, X, QrCode,
  Filter, Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

interface ProductOrderItem {
  id: number;
  product: {
    id: number | null;
    name: string | null;
  };
  user: {
    id: number | null;
    name: string | null;
    email: string | null;
  };
  payment_amount: number;
  payer_name: string;
  payment_screenshot: string;
  status: 'pending' | 'approved' | 'rejected' | 'used';
  order_code: string | null;
  order_qr_code: string | null;
  rejection_reason: string | null;
  created_at: string | null;
}

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
  customer_name: string;
  customer_phone?: string;
  delivery_location?: string;
  customer_notes?: string;
  payment_method: string;
  payment_screenshot: string;
  total_amount: number;
  status: string;
  order_code?: string;
  order_qr_code?: string;
  rejection_reason?: string;
  created_at: string;
  items: VendorOrderItem[];
}

const VendorOrders = () => {
  const { session } = useAuthStore();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<ProductOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);
  const [viewScreenshotOrder, setViewScreenshotOrder] = useState<ProductOrderItem | null>(null);
  const [viewQrOrder, setViewQrOrder] = useState<ProductOrderItem | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<ProductOrderItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // New Vendor Orders
  const [vendorOrders, setVendorOrders] = useState<VendorOrder[]>([]);
  const [vendorOrdersLoading, setVendorOrdersLoading] = useState(false);
  const [vendorOrderFilter, setVendorOrderFilter] = useState<string>('all');
  const [processingVendorOrderId, setProcessingVendorOrderId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'legacy' | 'new'>('new');

  const fetchOrders = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (orderFilter !== 'all') params.append('status', orderFilter);
      const response = await fetch(`${API_BASE_URL}/product-orders/vendor/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [orderFilter]);

  const fetchVendorOrders = useCallback(async (token: string) => {
    setVendorOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (vendorOrderFilter !== 'all') params.append('status', vendorOrderFilter);
      const response = await fetch(`${API_BASE_URL}/vendor-orders/vendor/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVendorOrders(data.orders || []);
      } else {
        setVendorOrders([]);
      }
    } catch {
      setVendorOrders([]);
    } finally {
      setVendorOrdersLoading(false);
    }
  }, [vendorOrderFilter]);

  useEffect(() => {
    if (session?.access_token) {
      fetchOrders(session.access_token);
      fetchVendorOrders(session.access_token);
    }
  }, [session, fetchOrders, fetchVendorOrders]);

  const approveOrder = async (orderId: number) => {
    if (!session?.access_token) return;
    setProcessingOrderId(orderId);
    try {
      const response = await fetch(`${API_BASE_URL}/product-orders/${orderId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(t('vendor.dashboard.orderApprovedSuccess') || 'Order approved');
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'approved', order_code: data.order_code, order_qr_code: data.order_qr } : o));
      } else {
        const error = await response.json();
        toast.error(error.detail || t('vendor.dashboard.approveOrderError') || 'Failed to approve order');
      }
    } catch {
      toast.error(t('vendor.dashboard.networkError') || 'Network error');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const rejectOrder = async (orderId: number, reason: string) => {
    if (!session?.access_token) return;
    setProcessingOrderId(orderId);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      const response = await fetch(`${API_BASE_URL}/product-orders/${orderId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData
      });
      if (response.ok) {
        toast.success(t('vendor.dashboard.orderRejectedSuccess') || 'Order rejected');
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'rejected', rejection_reason: reason } : o));
        setRejectingOrder(null);
        setRejectReason('');
      } else {
        const error = await response.json();
        toast.error(error.detail || t('vendor.dashboard.rejectOrderError') || 'Failed to reject order');
      }
    } catch {
      toast.error(t('vendor.dashboard.networkError') || 'Network error');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const acceptVendorOrder = async (orderId: number) => {
    if (!session?.access_token) return;
    setProcessingVendorOrderId(orderId);
    try {
      const res = await fetch(`${API_BASE_URL}/vendor-orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        toast.success('Order accepted');
        fetchVendorOrders(session.access_token);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to accept');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessingVendorOrderId(null);
    }
  };

  const rejectVendorOrder = async (orderId: number, reason: string) => {
    if (!session?.access_token) return;
    setProcessingVendorOrderId(orderId);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      const res = await fetch(`${API_BASE_URL}/vendor-orders/${orderId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData
      });
      if (res.ok) {
        toast.success('Order rejected');
        fetchVendorOrders(session.access_token);
        setRejectingOrder(null);
        setRejectReason('');
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to reject');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessingVendorOrderId(null);
    }
  };

  const updateVendorOrderStatus = async (orderId: number, status: string) => {
    if (!session?.access_token) return;
    setProcessingVendorOrderId(orderId);
    try {
      const res = await fetch(`${API_BASE_URL}/vendor-orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success('Status updated');
        fetchVendorOrders(session.access_token);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessingVendorOrderId(null);
    }
  };

  const getVendorStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getVendorStatusClasses = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      case 'ready': return 'bg-blue-500/20 text-blue-400';
      case 'preparing': return 'bg-purple-500/20 text-purple-400';
      case 'accepted': return 'bg-green-500/20 text-green-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'approved': return t('vendor.dashboard.statusApproved') || 'Approved';
      case 'rejected': return t('vendor.dashboard.statusRejected') || 'Rejected';
      case 'used': return t('vendor.dashboard.statusUsed') || 'Used';
      case 'pending': return t('vendor.dashboard.statusPending') || 'Pending';
      default: return t('vendor.dashboard.statusPending') || 'Pending';
    }
  };

  const getStatusClasses = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      case 'used': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-yellow-500/20 text-yellow-400';
    }
  };

  return (
    <div className="min-h-screen pt-20 lg:pt-10 pb-4 px-4 lg:px-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white transition-all shadow-xs dark:shadow-none"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#020b00] dark:text-white">{t('vendor.orders.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{t('vendor.orders.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-100 dark:bg-white/5 rounded-lg p-1 mr-2 border border-black/5 dark:border-white/5">
            <button
              onClick={() => setActiveSection('new')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${activeSection === 'new' ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'}`}
            >
              New Orders
            </button>
            <button
              onClick={() => setActiveSection('legacy')}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors cursor-pointer ${activeSection === 'legacy' ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs' : 'text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'}`}
            >
              Legacy
            </button>
          </div>
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={activeSection === 'new' ? vendorOrderFilter : orderFilter}
            onChange={(e) => activeSection === 'new' ? setVendorOrderFilter(e.target.value) : setOrderFilter(e.target.value as typeof orderFilter)}
            className="px-3 py-2 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white text-sm focus:border-[#020b00] dark:focus:border-[#d3da0c] outline-none shadow-xs dark:shadow-none"
          >
            <option value="all" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">All</option>
            <option value="pending" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Pending</option>
            <option value="pending_verification" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Pending Verification</option>
            <option value="accepted" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Accepted</option>
            <option value="preparing" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Preparing</option>
            <option value="ready" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Ready</option>
            <option value="completed" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Completed</option>
            <option value="approved" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Approved</option>
            <option value="rejected" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Rejected</option>
          </select>
        </div>
      </div>

      {/* New Vendor Orders Table */}
      {activeSection === 'new' && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 mb-6 shadow-xs dark:shadow-none"
      >
        {vendorOrdersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#020b00] dark:text-[#d3da0c] animate-spin" />
          </div>
        ) : vendorOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-black/8 dark:border-white/10">
                <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">
                  <th className="text-left py-3 px-4">Customer</th>
                  <th className="text-left py-3 px-4">Items</th>
                  <th className="text-left py-3 px-4">Total</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Payment</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendorOrders.map((order) => (
                  <tr key={order.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-[#020b00] dark:text-white font-medium">{order.customer_name}</p>
                      <p className="text-gray-500 text-xs">{order.customer_phone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-600 dark:text-gray-400 text-xs space-y-0.5">
                        {order.items.map((item) => (
                          <div key={item.id}>{item.quantity}x {item.product_name}</div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#020b00] dark:text-[#d3da0c] font-bold">¥{order.total_amount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getVendorStatusClasses(order.status)}`}>
                        {getVendorStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {order.payment_screenshot ? (
                        <button
                          onClick={() => window.open(order.payment_screenshot, '_blank')}
                          className="text-gray-500 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white text-xs font-medium cursor-pointer"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {order.status === 'pending_verification' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => acceptVendorOrder(order.id)}
                            disabled={processingVendorOrderId === order.id}
                            className="px-3 py-1.5 bg-emerald-500/10 dark:bg-green-500/20 text-emerald-600 dark:text-green-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20 dark:hover:bg-green-500/30 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {processingVendorOrderId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 inline mr-1" />Accept</>}
                          </button>
                          <button
                            onClick={() => { setRejectingOrder(order as any); setRejectReason(''); }}
                            disabled={processingVendorOrderId === order.id}
                            className="px-3 py-1.5 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <X className="w-3 h-3 inline mr-1" />
                            Reject
                          </button>
                        </div>
                      ) : order.status === 'accepted' ? (
                        <button
                          onClick={() => updateVendorOrderStatus(order.id, 'preparing')}
                          disabled={processingVendorOrderId === order.id}
                          className="px-3 py-1.5 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold rounded-lg hover:bg-purple-500/20 dark:hover:bg-purple-500/30 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Mark Preparing
                        </button>
                      ) : order.status === 'preparing' ? (
                        <button
                          onClick={() => updateVendorOrderStatus(order.id, 'ready')}
                          disabled={processingVendorOrderId === order.id}
                          className="px-3 py-1.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Mark Ready
                        </button>
                      ) : order.status === 'ready' && order.order_qr_code ? (
                        <button
                          onClick={() => setViewQrOrder(order as any)}
                          className="px-3 py-1.5 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c]/20 dark:text-[#d3da0c] text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer"
                        >
                          <QrCode className="w-3 h-3" />
                          QR Code
                        </button>
                      ) : order.status === 'cancelled' && order.rejection_reason ? (
                        <span className="text-red-600 dark:text-red-400 text-xs font-medium">{order.rejection_reason}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-2">No Orders Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">You have not received any marketplace orders yet.</p>
          </div>
        )}
      </motion.div>
      )}

      {/* Legacy Orders Table */}
      {activeSection === 'legacy' && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-6 shadow-xs dark:shadow-none"
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#020b00] dark:text-[#d3da0c] animate-spin" />
          </div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-black/8 dark:border-white/10">
                <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">
                  <th className="text-left py-3 px-4">{t('vendor.dashboard.customerHeader') || 'Customer'}</th>
                  <th className="text-left py-3 px-4">{t('vendor.dashboard.productHeader') || 'Product'}</th>
                  <th className="text-left py-3 px-4">{t('vendor.dashboard.totalHeader') || 'Total'}</th>
                  <th className="text-left py-3 px-4">{t('vendor.dashboard.statusHeader') || 'Status'}</th>
                  <th className="text-left py-3 px-4">{t('vendor.dashboard.paymentHeader') || 'Payment'}</th>
                  <th className="text-left py-3 px-4">{t('vendor.dashboard.actionsHeader') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-[#020b00] dark:text-white font-medium">{order.user?.name || order.payer_name || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{order.user?.email}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{order.product?.name || 'Unknown Product'}</td>
                    <td className="py-3 px-4 text-[#020b00] dark:text-[#d3da0c] font-bold">¥{order.payment_amount}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusClasses(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {order.payment_screenshot ? (
                        <button
                          onClick={() => setViewScreenshotOrder(order)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 hover:border-[#020b00] dark:hover:border-[#d3da0c]/50 transition-all flex items-center justify-center bg-neutral-100 dark:bg-white/5 cursor-pointer"
                        >
                          <Eye className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {order.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveOrder(order.id)}
                            disabled={processingOrderId === order.id}
                            className="px-3 py-1.5 bg-emerald-500/10 dark:bg-green-500/20 text-emerald-600 dark:text-green-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20 dark:hover:bg-green-500/30 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {processingOrderId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 inline mr-1" />{t('vendor.dashboard.approve') || 'Approve'}</>}
                          </button>
                          <button
                            onClick={() => { setRejectingOrder(order); setRejectReason(''); }}
                            disabled={processingOrderId === order.id}
                            className="px-3 py-1.5 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <X className="w-3 h-3 inline mr-1" />
                            {t('vendor.dashboard.reject') || 'Reject'}
                          </button>
                        </div>
                      ) : order.status === 'approved' && order.order_qr_code ? (
                        <button
                          onClick={() => setViewQrOrder(order)}
                          className="px-3 py-1.5 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c]/20 dark:text-[#d3da0c] text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 cursor-pointer"
                        >
                          <QrCode className="w-3 h-3" />
                          {t('vendor.dashboard.viewQr') || 'QR Code'}
                        </button>
                      ) : order.status === 'rejected' && order.rejection_reason ? (
                        <span className="text-red-600 dark:text-red-400 text-xs font-medium">{order.rejection_reason}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-[#020b00] dark:text-white mb-2">{t('vendor.orders.noOrdersTitle') || 'No Orders Yet'}</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
              {t('vendor.orders.noOrdersDescription') || 'You have not received any product orders yet.'}
            </p>
          </div>
        )}
      </motion.div>
      )}

      {/* View Screenshot Modal */}
      {viewScreenshotOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[#020b00] dark:text-white font-bold">{t('vendor.dashboard.paymentScreenshot') || 'Payment Screenshot'}</h4>
              <button onClick={() => setViewScreenshotOrder(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
            </div>
            <img
              src={viewScreenshotOrder.payment_screenshot.startsWith('http') ? viewScreenshotOrder.payment_screenshot : `${API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')}${viewScreenshotOrder.payment_screenshot}`}
              alt="Payment Screenshot"
              className="w-full rounded-lg border border-black/10 dark:border-white/10"
            />
          </div>
        </div>
      )}

      {/* View QR Modal */}
      {viewQrOrder && viewQrOrder.order_qr_code && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[#020b00] dark:text-white font-bold">{t('vendor.dashboard.orderQrCode') || 'Order QR Code'}</h4>
              <button onClick={() => setViewQrOrder(null)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
            </div>
            <img src={viewQrOrder.order_qr_code} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg border border-black/10 dark:border-white/10" />
            <p className="text-[#020b00] dark:text-[#d3da0c] font-black mt-4">{viewQrOrder.order_code}</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{viewQrOrder.product?.name}</p>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#111111] border border-black/10 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[#020b00] dark:text-white font-bold">{t('vendor.dashboard.rejectOrder') || 'Reject Order'}</h4>
              <button onClick={() => { setRejectingOrder(null); setRejectReason(''); }} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"><X className="w-5 h-5 text-gray-500 dark:text-gray-400" /></button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{t('vendor.dashboard.rejectReasonPrompt') || 'Please provide a reason for rejection.'}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('vendor.dashboard.rejectReasonPlaceholder') || 'Reason...'}
              rows={3}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectingOrder(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-bold rounded-lg transition-all cursor-pointer"
              >
                {t('vendor.dashboard.cancel') || 'Cancel'}
              </button>
              <button
                onClick={() => rejectOrder(rejectingOrder.id, rejectReason)}
                disabled={!rejectReason.trim() || processingOrderId === rejectingOrder.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-bold rounded-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                {processingOrderId === rejectingOrder.id ? <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> : null}
                {t('vendor.dashboard.confirmReject') || 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorOrders;
