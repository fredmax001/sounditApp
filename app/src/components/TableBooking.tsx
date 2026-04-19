import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Wine, Users, Ticket, Check, X, Loader2, 
  ChevronRight, CreditCard, Upload, PartyPopper
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import MobileQrPayment from '@/components/MobileQrPayment';
import axios from 'axios';

interface TablePackage {
  id: number;
  name: string;
  price: number;
  description: string;
  included_items: string[];
  drinks: string[];
  extras: string[];
  ticket_quantity: number;
  max_people: number | null;
  image_url: string | null;
  tables_remaining?: number;
}

interface TableBookingProps {
  eventId: number;
  eventTitle: string;
}

export default function TableBooking({ eventId, eventTitle }: TableBookingProps) {
  const { t } = useTranslation();
  const { session, isAuthenticated } = useAuthStore();
  const token = session?.access_token;
  const [packages, setPackages] = useState<TablePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<TablePackage | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    guest_count: '',
    special_requests: '',
    payment_notes: '',
    payment_reference: '',
  });
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/tables/events/${eventId}/packages`);
      setPackages(res.data);
    } catch {
      console.error('Failed to load table packages');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleBookTable = async (pkg: TablePackage) => {
    if (!isAuthenticated) {
      toast.error(t('tableBooking.pleaseLogin'));
      return;
    }

    setSelectedPackage(pkg);
    setShowBookingModal(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPackage || !paymentScreenshot) {
      toast.error(t('tableBooking.uploadScreenshot'));
      return;
    }

    try {
      setSubmitting(true);
      
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) form.append(key, value);
      });
      form.append('payment_screenshot', paymentScreenshot);

      await axios.post(
        `${API_BASE_URL}/tables/packages/${selectedPackage.id}/book`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(t('tableBooking.submitted'));
      setShowBookingModal(false);
      resetForm();
    } catch (error) {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || t('tableBooking.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      guest_count: '',
      special_requests: '',
      payment_notes: '',
      payment_reference: '',
    });
    setPaymentScreenshot(null);
    setSelectedPackage(null);
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin mx-auto" />
      </div>
    );
  }

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#d3da0c] rounded-xl flex items-center justify-center">
          <Wine className="w-5 h-5 text-black" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{t('tableBooking.title')}</h2>
          <p className="text-white/60">{t('tableBooking.subtitle')}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#141414] to-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden hover:border-[#d3da0c]/30 transition-colors"
          >
            {pkg.image_url ? (
              <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${pkg.image_url})` }} />
            ) : (
              <div className="h-40 bg-gradient-to-br from-[#d3da0c]/10 to-[#d3da0c]/5 flex items-center justify-center">
                <Wine className="w-12 h-12 text-[#d3da0c]/30" />
              </div>
            )}

            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                <div className="text-right">
                  <p className="text-xl font-bold text-[#d3da0c]">¥{pkg.price}</p>
                  <p className="text-white/40 text-xs">{t('tableBooking.perTable')}</p>
                </div>
              </div>

              {pkg.description && (
                <p className="text-white/60 text-sm mb-4 line-clamp-2">{pkg.description}</p>
              )}

              {/* Included Items */}
              <div className="space-y-2 mb-4">
                {pkg.included_items?.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-white/80 text-sm">
                    <Check className="w-4 h-4 text-[#d3da0c] flex-shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
                {pkg.included_items?.length > 3 && (
                  <p className="text-white/40 text-xs pl-6">
                    +{pkg.included_items.length - 3} {t('tableBooking.moreItems')}
                  </p>
                )}
              </div>

              {/* Capacity */}
              <div className="flex items-center gap-4 mb-4 text-white/60 text-sm">
                {pkg.ticket_quantity > 0 && (
                  <div className="flex items-center gap-1">
                    <Ticket className="w-4 h-4" />
                    {pkg.ticket_quantity} {t('tableBooking.ticketsIncluded')}
                  </div>
                )}
                {pkg.max_people && (
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {t('tableBooking.upToGuests', { count: pkg.max_people })}
                  </div>
                )}
              </div>

              {pkg.tables_remaining !== undefined && pkg.tables_remaining <= 2 && pkg.tables_remaining > 0 && (
                <p className="text-orange-400 text-xs mb-2">
                  {t('tableBooking.onlyRemaining', { count: pkg.tables_remaining })}
                </p>
              )}
              {pkg.tables_remaining === 0 && (
                <p className="text-red-400 text-xs mb-2">{t('tableBooking.soldOut')}</p>
              )}

              <button
                onClick={() => handleBookTable(pkg)}
                disabled={pkg.tables_remaining === 0}
                className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pkg.tables_remaining === 0 ? t('tableBooking.soldOut') : t('tableBooking.bookTable')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && selectedPackage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141414] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{t('tableBooking.book')} {selectedPackage.name}</h2>
                    <p className="text-white/60">{eventTitle}</p>
                  </div>
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#d3da0c]/10 rounded-xl">
                  <span className="text-[#d3da0c] font-bold text-xl">¥{selectedPackage.price}</span>
                  <span className="text-white/60">{t('tableBooking.total')}</span>
                </div>
              </div>

              <form onSubmit={handleSubmitBooking} className="p-6 space-y-6">
                {/* Package Summary */}
                <div className="bg-white/5 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-3">{t('tableBooking.packageIncludes')}</h3>
                  <div className="space-y-2">
                    {selectedPackage.included_items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-white/80 text-sm">
                        <PartyPopper className="w-4 h-4 text-[#d3da0c]" />
                        {item}
                      </div>
                    ))}
                    {selectedPackage.drinks?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-white/60 text-sm mb-2">{t('tableBooking.drinks')}</p>
                        {selectedPackage.drinks.map((drink, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-white/80 text-sm pl-6">
                            <Wine className="w-3 h-3 text-[#d3da0c]" />
                            {drink}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-2">{t('tableBooking.contactName')} *</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-2">{t('tableBooking.phoneNumber')} *</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-2">{t('tableBooking.email')}</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-2">{t('tableBooking.numberOfGuests')}</label>
                    <input
                      type="number"
                      value={formData.guest_count}
                      onChange={(e) => setFormData({...formData, guest_count: e.target.value})}
                      max={selectedPackage.max_people || undefined}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white/60 text-sm mb-2">{t('tableBooking.specialRequests')}</label>
                  <textarea
                    value={formData.special_requests}
                    onChange={(e) => setFormData({...formData, special_requests: e.target.value})}
                    rows={3}
                    placeholder={t('tableBooking.specialRequestsPlaceholder')}
                    className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                  />
                </div>

                {/* Payment Section */}
                <div className="bg-white/5 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-[#d3da0c]" />
                    <h3 className="text-white font-semibold">{t('tableBooking.payment')}</h3>
                  </div>
                  
                  <p className="text-white/60 text-sm">
                    {t('tableBooking.pleaseTransfer')} <span className="text-[#d3da0c] font-bold">¥{selectedPackage.price}</span> {t('tableBooking.toComplete')}
                  </p>

                  {/* Payment QR Codes */}
                  <MobileQrPayment amount={selectedPackage.price} />

                  {/* Payment Screenshot Upload */}
                  <div>
                    <label className="block text-white/60 text-sm mb-2">
                      {t('tableBooking.uploadScreenshot')} *
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                        className="hidden"
                        id="payment-screenshot"
                        required
                      />
                      <label
                        htmlFor="payment-screenshot"
                        className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors"
                      >
                        {paymentScreenshot ? (
                          <>
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-white">{paymentScreenshot.name}</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-white/60" />
                            <span className="text-white/60">{t('tableBooking.clickToUpload')}</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2">
                      {t('eventDetail.paymentReference')} 
                      <span className="ml-1 text-[#d3da0c] font-medium">(Optional - We will try to auto-detect)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.payment_reference}
                      onChange={(e) => setFormData({...formData, payment_reference: e.target.value})}
                      placeholder={t('eventDetail.enterPaymentReference')}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-2">{t('tableBooking.paymentNotes')}</label>
                    <input
                      type="text"
                      value={formData.payment_notes}
                      onChange={(e) => setFormData({...formData, payment_notes: e.target.value})}
                      placeholder={t('tableBooking.paymentNotesPlaceholder')}
                      className="w-full bg-[#0A0A0A] border border-white/10 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="px-6 py-3 text-white/60 hover:text-white transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !paymentScreenshot}
                    className="px-6 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('tableBooking.completeBooking')
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
