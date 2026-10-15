import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Download, Check, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';

interface OrderTicket {
  id: number;
  ticket_number: string;
  qr_code?: string | null;
  status?: string;
  is_used?: boolean;
}

interface ReceiptOrder {
  id: number;
  event?: { id?: number; title?: string; start_date?: string; flyer_image?: string } | null;
  payment_amount?: number;
  quantity?: number;
  status?: string;
  ticket_code?: string | null;
  ticket_qr?: string | null;
  payer_name?: string | null;
  ticket_tier_name?: string | null;
  created_at?: string;
}

const TicketReceipt = () => {
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [tickets, setTickets] = useState<OrderTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    fetch(`${API_BASE_URL}/tickets/my-orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then(async (data) => {
        const found = (data.orders || []).find((o: ReceiptOrder) => String(o.id) === String(orderId));
        if (!found) {
          setNotFound(true);
          return;
        }
        setOrder(found);
        // Fetch individual tickets so the receipt always shows a staff-scannable QR
        try {
          const tRes = await fetch(`${API_BASE_URL}/tickets/my-orders/${found.id}/tickets`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            setTickets(tData.tickets || []);
          }
        } catch { /* keep empty */ }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [orderId]);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();

  const statusConfig = (() => {
    switch (order?.status) {
      case 'approved':
      case 'used':
        return { label: t('receipt.valid', '✓ Valid'), class: 'text-green-500' };
      case 'pending':
        return { label: t('receipt.pendingApproval', 'Pending Approval'), class: 'text-amber-400' };
      case 'rejected':
        return { label: t('receipt.rejected', 'Rejected'), class: 'text-red-400' };
      case 'cancelled':
        return { label: t('receipt.cancelled', 'Cancelled'), class: 'text-gray-400' };
      default:
        return { label: order?.status || '—', class: 'text-gray-400' };
    }
  })();

  const rows: Array<[string, React.ReactNode]> = order
    ? [
        [t('receipt.name', 'Name'), order.payer_name || fullName || profile?.email || '—'],
        [t('receipt.phone', 'Phone Number'), profile?.phone || '—'],
        [t('receipt.email', 'Mail Address'), profile?.email || user?.email || '—'],
        [t('receipt.event', 'Event'), order.event?.title || '—'],
        [t('receipt.paymentMethod', 'Payment Method'), t('receipt.qrPayment', 'QR Code Payment')],
        [t('receipt.ticketId', 'Ticket ID'), order.ticket_code || '—'],
        [t('receipt.ticketType', 'Ticket Type'), order.ticket_tier_name || t('receipt.standardTicket', 'Standard')],
        [t('receipt.quantity', 'Quantity'), String(order.quantity || 1)],
        [t('receipt.total', 'Total'), `¥${order.payment_amount ?? 0}`],
        [
          t('receipt.orderDate', 'Order Date'),
          order.created_at
            ? new Date(order.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            : '—',
        ],
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5 no-print">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-300 hover:text-white active:scale-90 transition-transform"
            aria-label={t('eventDetail.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">{t('receipt.title', 'E-Receipt')}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : notFound || !order ? (
          <div className="text-center py-20">
            <QrCode className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">{t('receipt.notFound', 'Receipt not found')}</p>
            <Link to="/tickets" className="text-[#d3da0c] text-sm hover:underline">
              {t('receipt.backToTickets', 'Back to My Tickets')}
            </Link>
          </div>
        ) : (
          <>
            {/* Receipt card */}
            <div id="receipt-print-area" className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden mb-6">
              <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[#d3da0c] text-[10px] font-bold uppercase tracking-widest mb-1">Sound It</p>
                  <h2 className="text-white font-bold text-lg leading-snug">{order.event?.title}</h2>
                  {order.event?.start_date && (
                    <p className="text-gray-400 text-xs mt-1">
                      {new Date(order.event.start_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {' · '}
                      {new Date(order.event.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-semibold shrink-0 ${statusConfig.class}`}>{statusConfig.label}</span>
              </div>

              <div className="px-5 py-2">
                {rows.map(([label, value]) => (
                  <div key={label as string} className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
                    <span className="text-gray-400 text-sm shrink-0">{label}</span>
                    <span className="text-white text-sm font-medium text-right break-all">{value}</span>
                  </div>
                ))}
              </div>

              {(['approved', 'used'].includes(order.status || '')) && (
                <div className="px-5 py-6 border-t border-white/5 text-center">
                  {order.ticket_qr ? (
                    <div className="inline-block bg-white rounded-2xl p-3">
                      <img src={order.ticket_qr} alt="Ticket QR" className="w-40 h-40 object-contain" />
                    </div>
                  ) : tickets.length > 0 && tickets[0].qr_code ? (
                    <div className="inline-block bg-white rounded-2xl p-3">
                      <img src={tickets[0].qr_code} alt="Ticket QR" className="w-40 h-40 object-contain" />
                    </div>
                  ) : tickets.length > 0 ? (
                    <div className="inline-block bg-white rounded-2xl p-3">
                      <QRCodeSVG value={tickets[0].ticket_number} size={160} level="H" />
                    </div>
                  ) : (
                    <div className="inline-block bg-white rounded-2xl p-3">
                      <QRCodeSVG value={order.ticket_code || `ORDER-${order.id}`} size={160} level="H" />
                    </div>
                  )}
                  {(order.ticket_code || tickets[0]?.ticket_number) && (
                    <p className="text-gray-500 text-xs font-mono mt-3">{order.ticket_code || tickets[0]?.ticket_number}</p>
                  )}
                  <p className="text-gray-600 text-[11px] mt-2">{t('receipt.scanHint', 'Show this QR at the entrance — staff scan to validate.')}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => window.print()}
              className="no-print w-full h-12 bg-[#d3da0c] text-black font-bold rounded-xl flex items-center justify-center gap-2 active:bg-[#bbc10b] transition-colors"
            >
              <Download className="w-5 h-5" />
              {t('receipt.downloadPdf', 'Download PDF')}
            </button>
            <p className="no-print text-center text-gray-600 text-xs mt-3 flex items-center justify-center gap-1">
              <Check className="w-3 h-3" />
              {t('receipt.printHint', 'Choose "Save as PDF" in the print dialog to download.')}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketReceipt;
