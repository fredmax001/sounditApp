import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Wine, Calendar, Users, Loader2, X, MapPin, Clock } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface TableBooking {
  id: number;
  package: {
    id: number;
    name: string;
    price: number;
    included_items: string[];
  };
  event: {
    id: number;
    title: string;
    start_date: string;
  };
  business: {
    id: number;
    name: string;
  };
  contact_name: string;
  guest_count: number;
  payment_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  special_requests: string;
  created_at: string;
  reviewed_at: string;
  rejection_reason: string;
  ticket_code?: string;
  ticket_qr?: string;
}

export default function TableBookings() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem('auth-token') || localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tables/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBookings(data || []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return { class: 'bg-green-500/10 text-green-400', text: t('user.tickets.approved') };
      case 'rejected':
        return { class: 'bg-red-500/10 text-red-400', text: t('user.tickets.rejected') };
      default:
        return { class: 'bg-yellow-500/10 text-yellow-400', text: t('user.tickets.pending') };
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-24 bg-[#0A0A0A] px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-[#d3da0c] rounded-xl flex items-center justify-center">
            <Wine className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{t('tableBooking.myBookings')}</h1>
            <p className="text-white/60">{t('tableBooking.myBookingsSubtitle')}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
            <Wine className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('tableBooking.noBookings')}</h3>
            <p className="text-white/60">{t('tableBooking.noBookingsDescription')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking, index) => {
              const status = getStatusDisplay(booking.status);
              const eventDate = booking.event?.start_date ? new Date(booking.event.start_date) : null;

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#111111] border border-white/5 rounded-2xl p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{booking.package?.name}</h3>
                      <p className="text-white/60">{booking.event?.title}</p>
                      <span className={`inline-block px-3 py-1 text-xs rounded-full mt-2 ${status.class}`}>
                        {status.text}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#d3da0c]">¥{booking.payment_amount}</p>
                      {booking.ticket_code && (
                        <p className="text-[#d3da0c]/80 text-sm font-mono mt-1">{booking.ticket_code}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-white/60">
                      <Calendar className="w-4 h-4 text-[#d3da0c]" />
                      <span className="text-sm">
                        {eventDate ? eventDate.toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Clock className="w-4 h-4 text-[#d3da0c]" />
                      <span className="text-sm">
                        {eventDate ? eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Users className="w-4 h-4 text-[#d3da0c]" />
                      <span className="text-sm">
                        {booking.guest_count || 1} {t('tableBooking.guests')}
                      </span>
                    </div>
                  </div>

                  {booking.package?.included_items && booking.package.included_items.length > 0 && (
                    <div className="mb-4">
                      <p className="text-white/40 text-xs uppercase font-bold mb-2">{t('tableBooking.includes')}</p>
                      <div className="flex flex-wrap gap-2">
                        {booking.package.included_items.map((item, idx) => (
                          <span key={idx} className="px-2 py-1 bg-white/5 rounded text-white/70 text-xs">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {booking.status === 'approved' && booking.ticket_qr && (
                    <button
                      onClick={() => setSelectedQr(booking.ticket_qr!)}
                      className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
                    >
                      {t('tableBooking.showQr')}
                    </button>
                  )}

                  {booking.status === 'rejected' && booking.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-sm">{booking.rejection_reason}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {selectedQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{t('tableBooking.yourQrCode')}</h3>
              <button onClick={() => setSelectedQr(null)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="bg-white rounded-lg p-4">
              <img src={selectedQr} alt="QR Code" className="w-full h-auto" />
            </div>
            <p className="text-white/60 text-center text-sm mt-4">{t('tableBooking.showAtEntrance')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
