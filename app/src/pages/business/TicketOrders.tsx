import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import {
  Ticket, Loader2, CheckCircle2, XCircle, Clock, Search, Eye,
  QrCode, Calendar, Download, Filter, Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import DashboardPageContainer, {
  DashboardPageHeader,
} from '@/components/dashboard/DashboardPageContainer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TicketOrder {
  id: number;
  event: { id: number; title: string };
  user: { id: number; name: string; email: string; phone?: string };
  quantity?: number;
  payment_amount: number;
  payer_name: string;
  email?: string;
  phone_number?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used';
  ticket_code?: string;
  ticket_qr?: string;
  auto_approved?: boolean;
  tickets_generated?: number;
  used_at?: string;
  used_by?: number;
  ticket_tier?: { id: number; name: string } | null;
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
  const [search, setSearch] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/tickets/business/tickets${filter !== 'all' ? `?status=${filter}` : ''}`;
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
  }, [session, filter]);

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

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    return (
      (o.payer_name || '').toLowerCase().includes(term) ||
      (o.email || '').toLowerCase().includes(term) ||
      (o.phone_number || '').toLowerCase().includes(term) ||
      (o.user?.email || '').toLowerCase().includes(term) ||
      (o.user?.phone || '').toLowerCase().includes(term) ||
      (o.event?.title || '').toLowerCase().includes(term) ||
      (o.ticket_tier?.name || '').toLowerCase().includes(term) ||
      (o.ticket_code || '').toLowerCase().includes(term)
    );
  });

  return (
    <DashboardPageContainer>
      <DashboardPageHeader
        title={t('business.dashboard.ticketOrders') || 'Ticket Orders'}
        subtitle={t('business.dashboard.manageTicketOrders') || 'Manage and approve ticket orders for your events.'}
        action={
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search') || 'Search orders...'}
                className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-64"
              />
            </div>
            <div className="relative">
              <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="bg-[#111111] border border-white/10 text-white pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-[#d3da0c] w-full sm:w-40 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                }}
              >
                <option value="all">{t('business.dashboard.all') || 'All'}</option>
                <option value="pending">{t('business.dashboard.pending') || 'Pending'}</option>
                <option value="approved">{t('business.dashboard.approved') || 'Approved'}</option>
                <option value="rejected">{t('business.dashboard.rejected') || 'Rejected'}</option>
                <option value="used">{t('business.dashboard.used') || 'Used'}</option>
              </select>
            </div>
          </div>
        }
      />

      {/* Orders Table */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#d3da0c] mx-auto" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-12 text-center text-gray-400">
          <Ticket className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p className="text-lg font-medium text-white mb-1">{t('business.dashboard.noTicketOrders') || 'No ticket orders found'}</p>
          <p className="text-sm">{t('business.dashboard.noTicketOrdersHint') || 'Orders will appear here once customers purchase tickets.'}</p>
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/5 rounded-xl overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 text-gray-400 text-sm font-medium border-b border-white/5">
            <div className="col-span-2">{t('business.dashboard.name') || 'Name'}</div>
            <div className="col-span-2">{t('business.dashboard.email') || 'Email'}</div>
            <div className="col-span-2">{t('business.dashboard.mobile') || 'Mobile'}</div>
            <div className="col-span-2">{t('business.dashboard.eventName') || 'Event Name'}</div>
            <div className="col-span-1">{t('business.dashboard.ticketType') || 'Ticket Type'}</div>
            <div className="col-span-1 text-center">{t('business.dashboard.checkIn') || 'Check In'}</div>
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
                  className="px-6 py-4"
                >
                  {/* Desktop Row */}
                  <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-2">
                      <p className="text-white font-medium truncate">{order.payer_name || order.user?.name || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-300 text-sm truncate">{order.user?.email || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                        <span className="truncate">{order.user?.phone || '-'}</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <span className="truncate">{order.event?.title || '-'}</span>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <span className="text-gray-300 text-sm truncate">{order.ticket_tier?.name || '-'}</span>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {isCheckIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('business.dashboard.checkedIn') || 'In'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/10 text-gray-400 text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          {t('business.dashboard.notCheckedIn') || 'Out'}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2 flex-wrap">
                      {order.ticket_qr && (
                        <button
                          onClick={() => setSelectedQr(order.ticket_qr)}
                          className="px-2 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors flex items-center gap-1"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          {t('business.tableReservations.ticketQr') || 'QR'}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(order.id)}
                            disabled={processingId === order.id}
                            className="px-2 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          >
                            {processingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (t('business.dashboard.approve') || 'Approve')}
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={processingId === order.id}
                            className="px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {t('business.dashboard.reject') || 'Reject'}
                          </button>
                        </>
                      )}
                      {order.status !== 'pending' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status.color}`}>
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
                        <p className="text-white font-semibold">{order.payer_name || order.user?.name || '-'}</p>
                        <p className="text-gray-400 text-sm">{order.email || order.user?.email || '-'}</p>
                        {(order.phone_number || order.user?.phone) && (
                          <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                            <Smartphone className="w-3 h-3" /> {order.phone_number || order.user?.phone}
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
                      {order.ticket_qr && (
                        <button
                          onClick={() => setSelectedQr(order.ticket_qr)}
                          className="px-3 py-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                          <QrCode className="w-4 h-4" />
                          {t('business.tableReservations.ticketQr') || 'QR'}
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

      {/* QR Modal */}
      {selectedQr && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedQr(null)}
        >
          <div className="bg-[#111111] rounded-2xl p-6 max-w-sm w-full border border-white/5 text-center">
            <img src={selectedQr} alt="Ticket QR" className="w-48 h-48 mx-auto rounded-xl" />
            <p className="text-gray-400 text-sm mt-4">{t('business.dashboard.ticketQrCode') || 'Ticket QR Code'}</p>
            <div className="flex justify-center gap-3 mt-4">
              <a
                href={selectedQr}
                download
                className="px-4 py-2 rounded-lg bg-[#d3da0c] text-black text-sm font-bold hover:bg-[#bbc10b] flex items-center gap-2"
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
    </DashboardPageContainer>
  );
};

export default TicketOrdersPage;
