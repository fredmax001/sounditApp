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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

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

  useEffect(() => {
    if (session?.access_token) {
      fetchOrders(session.access_token);
    }
  }, [session, fetchOrders]);

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
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">{t('vendor.orders.title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('vendor.orders.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value as typeof orderFilter)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-[#d3da0c] outline-none"
          >
            <option value="all" className="bg-[#111111]">{t('vendor.dashboard.filterAll') || 'All'}</option>
            <option value="pending" className="bg-[#111111]">{t('vendor.dashboard.filterPending') || 'Pending'}</option>
            <option value="approved" className="bg-[#111111]">{t('vendor.dashboard.filterApproved') || 'Approved'}</option>
            <option value="rejected" className="bg-[#111111]">{t('vendor.dashboard.filterRejected') || 'Rejected'}</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#111111] border border-white/10 rounded-2xl p-6"
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr className="text-gray-400 text-xs uppercase font-bold">
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
                  <tr key={order.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{order.user?.name || order.payer_name || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{order.user?.email}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{order.product?.name || 'Unknown Product'}</td>
                    <td className="py-3 px-4 text-[#d3da0c] font-bold">¥{order.payment_amount}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusClasses(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {order.payment_screenshot ? (
                        <button
                          onClick={() => setViewScreenshotOrder(order)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-[#d3da0c]/50 transition-all flex items-center justify-center"
                        >
                          <Eye className="w-5 h-5 text-gray-400" />
                        </button>
                      ) : (
                        <span className="text-gray-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {order.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveOrder(order.id)}
                            disabled={processingOrderId === order.id}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50"
                          >
                            {processingOrderId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 inline mr-1" />{t('vendor.dashboard.approve') || 'Approve'}</>}
                          </button>
                          <button
                            onClick={() => { setRejectingOrder(order); setRejectReason(''); }}
                            disabled={processingOrderId === order.id}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
                          >
                            <X className="w-3 h-3 inline mr-1" />
                            {t('vendor.dashboard.reject') || 'Reject'}
                          </button>
                        </div>
                      ) : order.status === 'approved' && order.order_qr_code ? (
                        <button
                          onClick={() => setViewQrOrder(order)}
                          className="px-3 py-1.5 bg-[#d3da0c]/20 text-[#d3da0c] text-xs font-bold rounded-lg hover:bg-[#d3da0c]/30 transition-all flex items-center gap-1"
                        >
                          <QrCode className="w-3 h-3" />
                          {t('vendor.dashboard.viewQr') || 'QR Code'}
                        </button>
                      ) : order.status === 'rejected' && order.rejection_reason ? (
                        <span className="text-red-400 text-xs">{order.rejection_reason}</span>
                      ) : (
                        <span className="text-gray-500 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t('vendor.orders.noOrdersTitle') || 'No Orders Yet'}</h3>
            <p className="text-gray-400 max-w-md">
              {t('vendor.orders.noOrdersDescription') || 'You have not received any product orders yet.'}
            </p>
          </div>
        )}
      </motion.div>

      {/* View Screenshot Modal */}
      {viewScreenshotOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-4 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-bold">{t('vendor.dashboard.paymentScreenshot') || 'Payment Screenshot'}</h4>
              <button onClick={() => setViewScreenshotOrder(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <img
              src={viewScreenshotOrder.payment_screenshot.startsWith('http') ? viewScreenshotOrder.payment_screenshot : `${API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')}${viewScreenshotOrder.payment_screenshot}`}
              alt="Payment Screenshot"
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}

      {/* View QR Modal */}
      {viewQrOrder && viewQrOrder.order_qr_code && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-bold">{t('vendor.dashboard.orderQrCode') || 'Order QR Code'}</h4>
              <button onClick={() => setViewQrOrder(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <img src={viewQrOrder.order_qr_code} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg" />
            <p className="text-[#d3da0c] font-bold mt-4">{viewQrOrder.order_code}</p>
            <p className="text-gray-400 text-sm mt-1">{viewQrOrder.product?.name}</p>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-bold">{t('vendor.dashboard.rejectOrder') || 'Reject Order'}</h4>
              <button onClick={() => { setRejectingOrder(null); setRejectReason(''); }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">{t('vendor.dashboard.rejectReasonPrompt') || 'Please provide a reason for rejection.'}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('vendor.dashboard.rejectReasonPlaceholder') || 'Reason...'}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectingOrder(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 bg-white/5 text-gray-400 font-bold rounded-lg hover:bg-white/10 transition-all"
              >
                {t('vendor.dashboard.cancel') || 'Cancel'}
              </button>
              <button
                onClick={() => rejectOrder(rejectingOrder.id, rejectReason)}
                disabled={!rejectReason.trim() || processingOrderId === rejectingOrder.id}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 font-bold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
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
