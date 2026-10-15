import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, MapPin, Calendar, QrCode, X, Check, Clock,
  Ticket as TicketIcon, Martini, CircleDollarSign, Sparkles,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '@/config/api';

interface TableTicket {
  id: number;
  ticket_number: string;
  qr_code?: string | null;
  is_used?: boolean;
}

interface BookingOrder {
  id: number;
  package: { id: number | null; name: string | null; price: number | null; included_items?: string[] };
  event: { id: number | null; title: string | null; start_date: string | null };
  guest_count: number;
  guest_names?: string[];
  payment_amount: number;
  status: string;
  special_requests?: string | null;
  created_at: string | null;
  rejection_reason?: string | null;
  ticket_code?: string | null;
  ticket_qr?: string | null;
  ticket_price_snapshot?: number | null;
  allocation_amount?: number | null;
  drink_allowance?: number | null;
  allowance_used?: number | null;
  drink_selections?: Array<{ item_id: number; name: string; qty: number; unit_price: number; mixers?: { name: string; qty: number }[]; line_total: number }>;
  buyer_confirmed_at?: string | null;
  upgrade_request?: { name: string; qty: number; price_snapshot: number; estimated_extra: number; notes?: string; payment_preference?: string } | null;
  upgrade_status?: string;
  upgrade_final_price?: number | null;
  upgrade_payment_status?: string | null;
  tickets?: TableTicket[];
}

const token = () => localStorage.getItem('auth-token') || localStorage.getItem('token');

const fmt = (n?: number | null) => (n == null ? '—' : `¥${Number(n).toLocaleString()}`);

const TableBookings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrTicket, setQrTicket] = useState<TableTicket | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/tables/my-bookings`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setOrders(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const confirmPayment = async (orderId: number) => {
    setConfirmingId(orderId);
    try {
      const res = await fetch(`${API_BASE_URL}/tables/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) fetchBookings();
    } finally {
      setConfirmingId(null);
    }
  };

  const statusChip = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/15 text-green-400 border-green-500/30';
      case 'pending': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'rejected': return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'used': return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
      default: return 'bg-white/5 text-gray-400 border-white/10';
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <section className="sticky top-20 lg:top-24 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <button onClick={() => navigate(-1)} aria-label={t('kit.common.back')} className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display text-white">{t('tableBooking.title', 'Table Bookings')}</h1>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-40 bg-[#111111] rounded-2xl border border-white/5 animate-pulse" />)}</div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="text-center py-20">
            <Martini className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">{t('tableBooking.noBookings', 'No table bookings yet')}</p>
            <p className="text-gray-500 text-sm">{t('tableBooking.noBookingsDesc', 'Book a table package at an event and it will appear here.')}</p>
          </div>
        )}

        {orders.map((o, i) => (
          <motion.div key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.3) }}
            className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="p-4 pb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[#d3da0c] text-[10px] font-bold uppercase tracking-widest mb-0.5">{o.package.name}</p>
                <h3 className="text-white font-semibold truncate">{o.event.title}</h3>
                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{o.event.start_date ? new Date(o.event.start_date).toLocaleString() : ''}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border capitalize shrink-0 ${statusChip(o.status)}`}>{o.status}</span>
            </div>

            {/* Financial breakdown */}
            {o.drink_allowance != null && (
              <div className="mx-4 mb-3 bg-white/5 rounded-xl p-3 space-y-1.5 text-xs">
                <Row label={t('tables.packagePrice', 'Package price')} value={fmt(o.payment_amount)} />
                <Row label={t('tables.ticketsDeduction', `Tickets (${o.guest_count} × ${fmt(o.ticket_price_snapshot)})`)} value={`−${fmt((o.ticket_price_snapshot || 0) * o.guest_count)}`} />
                <Row label={t('tables.tableAllocation', 'Table allocation (once per table)')} value={`−${fmt(o.allocation_amount)}`} />
                <div className="border-t border-white/10 my-1" />
                <Row label={t('tables.drinkAllowance', 'Drink allowance')} value={fmt(o.drink_allowance)} accent />
                <Row label={t('tables.allowanceUsed', 'Selected drinks')} value={`−${fmt(o.allowance_used)}`} />
                <Row label={t('tables.allowanceRemaining', 'Remaining')} value={fmt((o.drink_allowance || 0) - (o.allowance_used || 0))} />
              </div>
            )}

            {/* Drink selections */}
            {(o.drink_selections?.length || 0) > 0 && (
              <div className="px-4 pb-3">
                <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-1.5">{t('tables.selectedDrinks', 'Selected drinks')}</p>
                <div className="space-y-1">
                  {o.drink_selections!.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{d.name} ×{d.qty}
                        {(d.mixers?.length || 0) > 0 && <span className="text-gray-500"> · {d.mixers!.map(m => `${m.name}×${m.qty}`).join(', ')}</span>}
                      </span>
                      <span className="text-white font-medium">{fmt(d.line_total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upgrade request status */}
            {o.upgrade_request && o.upgrade_status !== 'none' && (
              <div className={`mx-4 mb-3 rounded-xl p-3 border text-xs ${
                o.upgrade_status === 'approved' ? 'bg-[#d3da0c]/10 border-[#d3da0c]/30'
                : o.upgrade_status === 'declined' ? 'bg-red-500/10 border-red-500/30'
                : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className={`w-3.5 h-3.5 ${o.upgrade_status === 'approved' ? 'text-[#d3da0c]' : o.upgrade_status === 'declined' ? 'text-red-400' : 'text-amber-400'}`} />
                  <span className={`font-semibold ${o.upgrade_status === 'approved' ? 'text-[#d3da0c]' : o.upgrade_status === 'declined' ? 'text-red-400' : 'text-amber-400'}`}>
                    {o.upgrade_status === 'approved' ? t('tables.upgradeApproved', 'Upgrade approved')
                      : o.upgrade_status === 'declined' ? t('tables.upgradeDeclined', 'Upgrade declined')
                      : t('tables.upgradePending', 'Upgrade requested — pending confirmation')}
                  </span>
                </div>
                <p className="text-gray-400">{o.upgrade_request.name} ×{o.upgrade_request.qty}
                  {o.upgrade_status === 'approved'
                    ? ` · ${t('tables.extraPayment', 'Extra payment')}: ${fmt(o.upgrade_final_price)} (${o.upgrade_payment_status || 'pending'})`
                    : ` · ${t('tables.estExtra', 'est. extra')} ${fmt(o.upgrade_request.estimated_extra)}`}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
              {o.status === 'pending' && !o.buyer_confirmed_at && (
                <button onClick={() => confirmPayment(o.id)} disabled={confirmingId === o.id}
                  className="h-9 px-4 rounded-lg bg-[#d3da0c] text-black text-xs font-bold hover:bg-[#bbc10b] transition-colors flex items-center gap-1.5 disabled:opacity-50">
                  {confirmingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {t('tables.iPaid', "I've completed the payment")}
                </button>
              )}
              {o.buyer_confirmed_at && o.status === 'pending' && (
                <span className="h-9 px-3 rounded-lg bg-white/5 text-gray-400 text-xs font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#d3da0c]" />{t('tables.paymentConfirmedWaiting', 'Payment confirmed — awaiting approval')}
                </span>
              )}
            </div>

            {/* Per-guest tickets */}
            {(o.tickets?.length || 0) > 0 && (
              <div className="border-t border-white/5 px-4 py-3">
                <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <TicketIcon className="w-3.5 h-3.5" />{t('tables.guestTickets', 'Guest tickets')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {o.tickets!.map((tk, idx) => (
                    <button key={tk.id} onClick={() => setQrTicket(tk)}
                      className="bg-white/5 rounded-xl p-2.5 text-left hover:bg-white/10 transition-colors">
                      <p className="text-[10px] text-gray-500 mb-0.5">{o.guest_names?.[idx] || `${t('tables.guest', 'Guest')} ${idx + 1}`}</p>
                      <p className="text-[11px] text-white font-mono truncate">{tk.ticket_number}</p>
                      <p className={`text-[10px] mt-0.5 ${tk.is_used ? 'text-gray-500' : 'text-[#d3da0c]'}`}>{tk.is_used ? t('tables.used', 'Used') : t('tables.tapForQr', 'Tap for QR')}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy single QR */}
            {(!o.tickets || o.tickets.length === 0) && o.ticket_qr && o.status === 'approved' && (
              <div className="border-t border-white/5 px-4 py-3 text-center">
                <button onClick={() => setQrTicket({ id: o.id, ticket_number: o.ticket_code || '', qr_code: o.ticket_qr })}
                  className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-colors">
                  <QrCode className="w-4 h-4 text-[#d3da0c]" />{t('tableBooking.showQr', 'Show QR')}
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Ticket QR modal */}
      {createPortal(
        <AnimatePresence>
          {qrTicket && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6" onClick={() => setQrTicket(null)}>
              <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                className="bg-[#111111] border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold">{t('tables.guestTicket', 'Guest ticket')}</h3>
                  <button onClick={() => setQrTicket(null)} className="p-1.5 bg-white/5 rounded-full text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                {qrTicket.qr_code ? (
                  <div className="bg-white rounded-xl p-3 inline-block">
                    <img src={qrTicket.qr_code} alt="Ticket QR" className="w-44 h-44 object-contain" />
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-6 inline-block"><QrCode className="w-36 h-36 text-black" /></div>
                )}
                <p className="text-gray-500 text-xs font-mono mt-3 break-all">{qrTicket.ticket_number}</p>
                <p className="text-gray-600 text-[11px] mt-1.5 flex items-center justify-center gap-1">
                  <CircleDollarSign className="w-3 h-3" />{t('receipt.scanHint', 'Show this QR at the entrance — staff scan to validate.')}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </div>
  );
};

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500">{label}</span>
    <span className={accent ? 'text-[#d3da0c] font-bold' : 'text-gray-300 font-medium'}>{value}</span>
  </div>
);

export default TableBookings;
