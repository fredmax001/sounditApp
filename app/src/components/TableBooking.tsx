import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  Wine, Users, Ticket, Check, X, Loader2, 
  ChevronRight, PartyPopper,
  ImageIcon, MessageSquare, Sparkles,
  Smartphone, Clock, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import MobileQrPayment from '@/components/MobileQrPayment';
import { getMediaUrl } from '@/lib/appUrl';
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
  drink_menu_image_url: string | null;
  tables_remaining?: number;
}

interface TableBookingProps {
  eventId: number;
  eventTitle: string;
  wechatQrUrl?: string | null;
  alipayQrUrl?: string | null;
  wechatPayUrl?: string | null;
  alipayPayUrl?: string | null;
  paymentInstructions?: string | null;
}


const DRINK_CATEGORY_ORDER = [
  'cocktail_signature', 'cocktail_classic', 'mocktail',
  'shot', 'beer_bottle', 'beer_draft', 'beer_craft',
  'champagne', 'wine', 'whiskey', 'bourbon', 'japanese_whiskey',
  'brandy', 'tequila', 'vodka', 'gin', 'rum', 'liqueur',
  'coffee', 'tea', 'juice', 'soft', 'mixer', 'non_alcoholic', 'food', 'other',
];

const CATEGORY_LABELS: Record<string, string> = {
  cocktail_signature: 'Signature Cocktails 特色鸡尾酒',
  cocktail_classic: 'Cocktails 鸡尾酒',
  mocktail: 'Mocktails 无酒精鸡尾酒',
  shot: 'Shots 一口酒',
  beer_bottle: 'Beers 啤酒',
  beer_draft: 'Draft Beers 生啤',
  beer_craft: 'Craft Beers 精酿啤酒',
  champagne: 'Champagne 香槟',
  wine: 'Wine 葡萄酒',
  whiskey: 'Whisky 威士忌',
  bourbon: 'Bourbon 波本',
  japanese_whiskey: 'Japanese Whisky 日威',
  brandy: 'Cognac & Brandy 白兰地',
  tequila: 'Tequila 龙舌兰',
  vodka: 'Vodka 伏特加',
  gin: 'Gin 金酒',
  rum: 'Rum 朗姆',
  liqueur: 'Liqueurs 力娇酒',
  coffee: 'Coffee & Tea 咖啡',
  tea: 'Tea 茶',
  juice: 'Juice 果汁',
  soft: 'Soft Drinks & Water 饮料',
  mixer: 'Mixers',
  non_alcoholic: 'Non-Alcoholic',
  food: 'Food',
  other: 'Other',
};

export default function TableBooking({
  eventId,
  eventTitle,
  wechatQrUrl,
  alipayQrUrl,
  wechatPayUrl,
  alipayPayUrl,
  paymentInstructions
}: TableBookingProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, profile, isAuthenticated } = useAuthStore();
  const token = session?.access_token;

  const [packages, setPackages] = useState<TablePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<TablePackage | null>(null);

  // Modals & prompts state (aligned with regular tickets)
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [payReturnPrompt, setPayReturnPrompt] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const leftForPaymentAt = useRef<number | null>(null);
  const PENDING_TABLE_PAY_KEY = `soundit_pending_table_pay_${eventId}`;

  // Form state
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    special_requests: '',
  });

  // ---- Drink selection + financial breakdown (Table_Packages_Drinks_Spec) ----
  const [eventDrinks, setEventDrinks] = useState<Array<{
    id: number; name: string; category: string; effective_price: number;
    supports_mixers: boolean; allowed_mixers: string[]; mixer_included_qty: number; mixer_extra_price: number;
  }>>([]);
  const [eventTicketPrice, setEventTicketPrice] = useState<number | null>(null);
  const [allocationPercent, setAllocationPercent] = useState<number | null>(null);
  const [selectedDrinks, setSelectedDrinks] = useState<Record<number, { qty: number; asUpgrade: boolean; mixers: Record<string, number> }>>({});
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [upgradePreference, setUpgradePreference] = useState<'contact_me' | 'settle_at_venue'>('contact_me');

  const isMobilePaymentEnv = () =>
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || (window as any).Capacitor?.isNativePlatform?.() === true);

  const clearPendingTablePayment = () => {
    try {
      localStorage.removeItem(PENDING_TABLE_PAY_KEY);
    } catch { /* ignore */ }
  };

  const restorePendingTablePayment = () => {
    try {
      const raw = localStorage.getItem(PENDING_TABLE_PAY_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const pkg = packages.find(p => p.id === s.packageId) || s.packageData;
      if (pkg) setSelectedPackage(pkg);
      if (s.formData) setFormData(s.formData);
      if (s.selectedDrinks) setSelectedDrinks(s.selectedDrinks);
      if (s.upgradeNotes) setUpgradeNotes(s.upgradeNotes);
      if (s.upgradePreference) setUpgradePreference(s.upgradePreference);
    } catch { /* ignore */ }
  };

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/tables/events/${eventId}/packages`);
      setPackages(res.data);
    } catch (err) {
      console.error('Failed to load table packages', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Load event drinks + financial config once
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      axios.get(`${API_BASE_URL}/tables/events/${eventId}/drinks`).catch(() => ({ data: { items: [] } })),
      axios.get(`${API_BASE_URL}/events/${eventId}`).catch(() => ({ data: {} })),
    ]).then(([drinksRes, eventRes]) => {
      setEventDrinks(drinksRes.data?.items || []);
      setEventTicketPrice(eventRes.data?.ticket_price ?? null);
      setAllocationPercent(eventRes.data?.table_allocation_percent ?? null);
    });
  }, [eventId]);

  // On load, offer to resume an unfinished table payment (e.g. browser was discarded while paying in WeChat/Alipay)
  useEffect(() => {
    if (!eventId || !isMobilePaymentEnv()) return;
    try {
      const raw = localStorage.getItem(PENDING_TABLE_PAY_KEY);
      if (!raw) return;
      const sessionData = JSON.parse(raw);
      if (String(sessionData.eventId) !== String(eventId)) return;
      if (Date.now() - (sessionData.startedAt || 0) > 24 * 3600 * 1000) {
        clearPendingTablePayment();
        return;
      }
      setResumePrompt(true);
    } catch {
      clearPendingTablePayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Detect the buyer returning from the Alipay/WeChat app after a deep-link payment
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !leftForPaymentAt.current) return;
      const awayMs = Date.now() - leftForPaymentAt.current;
      leftForPaymentAt.current = null;
      if (awayMs > 2500 && !buyerConfirmed && !showSuccessModal && isMobilePaymentEnv()) {
        setPayReturnPrompt(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [buyerConfirmed, showSuccessModal]);

  const handleBookTable = (pkg: TablePackage) => {
    if (!isAuthenticated) {
      toast.error(t('tableBooking.pleaseLogin', 'Please log in to book a table'));
      return;
    }

    const resolvedName = (profile as any)?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || session?.user?.email?.split('@')[0] || '';
    const resolvedPhone = (profile as any)?.phone_number || (profile as any)?.phone || '';
    const resolvedEmail = profile?.email || session?.user?.email || '';

    setFormData(prev => ({
      contact_name: prev.contact_name || resolvedName,
      contact_phone: prev.contact_phone || resolvedPhone,
      contact_email: prev.contact_email || resolvedEmail,
      special_requests: prev.special_requests || '',
    }));

    setSelectedPackage(pkg);
    setSelectedDrinks({});
    setBuyerConfirmed(false);
    setScreenshot(null);
    setShowBookingModal(true);
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    if (!formData.contact_name.trim() || !formData.contact_phone.trim()) {
      toast.error(t('tableBooking.fillContact', 'Please enter your name and phone number'));
      return;
    }

    try {
      localStorage.setItem(PENDING_TABLE_PAY_KEY, JSON.stringify({
        eventId,
        packageId: selectedPackage.id,
        packageData: selectedPackage,
        formData,
        selectedDrinks,
        upgradeNotes,
        upgradePreference,
        startedAt: Date.now(),
      }));
    } catch { /* storage full / blocked */ }

    setShowBookingModal(false);
    setShowQrModal(true);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPackage) return;
    if (!formData.contact_name.trim() || !formData.contact_phone.trim()) {
      toast.error(t('tableBooking.fillContact', 'Please enter your name and phone number'));
      return;
    }
    if (!buyerConfirmed && !screenshot) {
      toast.error(t('eventDetail.uploadScreenshotError', 'Please upload a payment screenshot'));
      return;
    }

    try {
      setSubmitting(true);
      
      const form = new FormData();
      form.append('contact_name', formData.contact_name.trim());
      form.append('contact_phone', formData.contact_phone.trim());
      if (formData.contact_email?.trim()) form.append('contact_email', formData.contact_email.trim());
      if (formData.special_requests?.trim()) form.append('special_requests', formData.special_requests.trim());

      if (screenshot) {
        form.append('payment_screenshot', screenshot);
      }
      form.append('buyer_confirmed', buyerConfirmed ? 'true' : 'false');

      const confirmedSelections = drinkLines.filter(l => !l.asUpgrade).map(l => ({
        item_id: l.item.id,
        qty: l.qty,
        mixers: Object.entries(l.mixers).filter(([, q]) => q > 0).map(([name, qty]) => ({ name, qty })),
      }));
      if (confirmedSelections.length) form.append('drink_selections', JSON.stringify(confirmedSelections));
      if (upgradeLine) {
        form.append('drink_selections', JSON.stringify([...confirmedSelections, {
          item_id: upgradeLine.item.id,
          qty: upgradeLine.qty,
          mixers: Object.entries(upgradeLine.mixers).filter(([, q]) => q > 0).map(([name, qty]) => ({ name, qty })),
        }]));
      }

      const authToken = token || localStorage.getItem('auth-token') || localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/tables/packages/${selectedPackage.id}/book`,
        form,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      toast.success(buyerConfirmed
        ? (t('eventDetail.paymentReported') || 'Payment reported, organizer notified')
        : t('tableBooking.submitted', 'Table booking submitted!'));

      clearPendingTablePayment();
      setShowOrderModal(false);
      setShowSuccessModal(true);
      resetForm();
    } catch (error) {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || t('tableBooking.failed', 'Failed to submit booking'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      special_requests: '',
    });
    setSelectedPackage(null);
    setSelectedDrinks({});
    setUpgradeNotes('');
    setBuyerConfirmed(false);
    setScreenshot(null);
  };

  // Financial mirror (display only — the server recalculates authoritatively).
  const guestsCount = Math.max(1, selectedPackage?.ticket_quantity || selectedPackage?.max_people || 1);
  const ticketTotalCents = Math.round((eventTicketPrice || 0) * 100) * guestsCount;
  const allocationCents = Math.round((eventTicketPrice || 0) * 100 * (allocationPercent || 0) / 100);
  const packageCents = Math.round((selectedPackage?.price || 0) * 100);
  const allowanceCents = packageCents - ticketTotalCents - allocationCents;

  const drinkLines = Object.entries(selectedDrinks)
    .map(([idStr, sel]) => {
      const item = eventDrinks.find(d => d.id === Number(idStr));
      if (!item || sel.qty <= 0) return null;
      return { item, ...sel, lineCents: Math.round(item.effective_price * 100) * sel.qty };
    })
    .filter(Boolean) as Array<{ item: (typeof eventDrinks)[0]; qty: number; asUpgrade: boolean; mixers: Record<string, number>; lineCents: number }>;

  const confirmedCents = drinkLines.filter(l => !l.asUpgrade).reduce((s, l) => s + l.lineCents, 0);
  const remainingCents = allowanceCents - confirmedCents;
  const upgradeLine = drinkLines.find(l => l.asUpgrade) || null;
  const yuan = (c: number) => `¥${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

  const setDrinkQty = (itemId: number, qty: number) => {
    setSelectedDrinks(prev => {
      const cur = prev[itemId] || { qty: 0, asUpgrade: false, mixers: {} };
      const next = { ...prev };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = { ...cur, qty: Math.min(qty, 50) };
      return next;
    });
  };

  const toggleUpgrade = (itemId: number, asUpgrade: boolean) => {
    setSelectedDrinks(prev => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, asUpgrade } };
    });
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
          <h2 className="text-xl font-bold text-[#020b00] dark:text-white">{t('tableBooking.title', 'Table Packages')}</h2>
          <p className="text-gray-600 dark:text-white/60 text-sm">{t('tableBooking.subtitle', 'Reserve VIP tables and packages for this event')}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#141414] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/50 transition-all flex flex-col shadow-sm dark:shadow-none"
          >
            {pkg.image_url && (
              <div 
                className="h-48 bg-cover bg-center"
                style={{ backgroundImage: `url("${getMediaUrl(pkg.image_url)}")` }}
              />
            )}
            
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-xl font-bold text-[#020b00] dark:text-white">{pkg.name}</h3>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900 dark:text-[#d3da0c]">¥{pkg.price}</span>
                  </div>
                </div>

                {pkg.description && (
                  <p className="text-gray-600 dark:text-white/60 text-sm mb-4">{pkg.description}</p>
                )}

                {/* Drink Menu Thumbnail */}
                {pkg.drink_menu_image_url && (
                  <div className="mb-4">
                    <div 
                      className="h-24 rounded-xl bg-cover bg-center cursor-pointer border border-black/10 dark:border-white/10 hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/50 transition-colors relative overflow-hidden group"
                      style={{ backgroundImage: `url("${getMediaUrl(pkg.drink_menu_image_url)}")` }}
                      onClick={() => window.open(pkg.drink_menu_image_url!, '_blank')}
                    >
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="flex items-center gap-1.5 text-xs text-white bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                          <ImageIcon className="w-3.5 h-3.5 text-[#d3da0c]" />
                          <span>{t('tableBooking.viewMenu', 'View Drink Menu')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Included Items */}
                <div className="space-y-2 mb-4">
                  {pkg.included_items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-gray-700 dark:text-white/80 text-sm">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-[#d3da0c] flex-shrink-0" />
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                  {pkg.included_items?.length > 3 && (
                    <p className="text-gray-500 dark:text-white/40 text-xs pl-6">
                      +{pkg.included_items.length - 3} {t('tableBooking.moreItems', 'more items')}
                    </p>
                  )}
                </div>

                {/* Capacity */}
                <div className="flex items-center gap-4 mb-4 text-gray-600 dark:text-white/60 text-sm">
                  {pkg.ticket_quantity > 0 && (
                    <div className="flex items-center gap-1">
                      <Ticket className="w-4 h-4" />
                      {pkg.ticket_quantity} {t('tableBooking.ticketsIncluded', 'tickets included')}
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
                  <p className="text-orange-600 dark:text-orange-400 text-xs mb-2 font-medium">
                    {t('tableBooking.onlyRemaining', { count: pkg.tables_remaining })}
                  </p>
                )}
                {pkg.tables_remaining === 0 && (
                  <p className="text-red-600 dark:text-red-400 text-xs mb-2 font-semibold">{t('tableBooking.soldOut', 'Sold out')}</p>
                )}
              </div>

              <button
                onClick={() => handleBookTable(pkg)}
                disabled={pkg.tables_remaining === 0}
                className="w-full py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-sm"
              >
                {pkg.tables_remaining === 0 ? t('tableBooking.soldOut', 'Sold out') : t('tableBooking.bookTable', 'Book Table')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Step 1: Package Customization & Contact Details Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showBookingModal && selectedPackage && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{t('tableBooking.book', 'Book')} {selectedPackage.name}</h2>
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
                    <span className="text-white/60">{t('tableBooking.total', 'total')}</span>
                  </div>
                </div>

                <form onSubmit={handleProceedToPayment} className="p-6 space-y-6">
                  {/* Package Summary */}
                  <div className="bg-white/5 rounded-xl p-4">
                    <h3 className="text-white font-semibold mb-3">{t('tableBooking.packageIncludes', 'Package includes')}</h3>
                    <div className="space-y-2">
                      {selectedPackage.included_items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-white/80 text-sm">
                          <PartyPopper className="w-4 h-4 text-[#d3da0c]" />
                          {item}
                        </div>
                      ))}
                      {selectedPackage.drinks?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-white/60 text-sm mb-2">{t('tableBooking.drinks', 'Drinks')}</p>
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

                  {/* Drink Menu */}
                  {selectedPackage.drink_menu_image_url && (
                    <div className="bg-white/5 rounded-xl p-4">
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#d3da0c]" />
                        {t('tableBooking.drinkMenu', 'Drink Menu')}
                      </h3>
                      <div 
                        className="h-48 rounded-xl bg-cover bg-center cursor-pointer border border-white/10 hover:border-[#d3da0c]/50 transition-colors"
                        style={{ backgroundImage: `url("${getMediaUrl(selectedPackage.drink_menu_image_url)}")` }}
                        onClick={() => window.open(selectedPackage.drink_menu_image_url!, '_blank')}
                      />
                      <p className="text-white/40 text-xs mt-2">
                        {t('tableBooking.drinkMenuHint', 'Tap to view full menu. Tell us what you want in the message to organizer below.')}
                      </p>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/60 text-sm mb-2">{t('tableBooking.contactName', 'Contact Name')} *</label>
                      <input
                        type="text"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                        className="w-full bg-[#020b00] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-sm mb-2">{t('tableBooking.phoneNumber', 'Phone Number')} *</label>
                      <input
                        type="tel"
                        value={formData.contact_phone}
                        onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                        className="w-full bg-[#020b00] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2">{t('tableBooking.email', 'Email Address')}</label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                      className="w-full bg-[#020b00] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>

                  <div>
                    <label className="block text-white/60 text-sm mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      {t('tableBooking.specialRequests', 'Message to Organizer')}
                    </label>
                    <textarea
                      value={formData.special_requests}
                      onChange={(e) => setFormData({...formData, special_requests: e.target.value})}
                      rows={3}
                      placeholder={t('tableBooking.specialRequestsPlaceholder', 'Tell us what drinks or arrangements you want...')}
                      className="w-full bg-[#020b00] border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#d3da0c]"
                    />
                  </div>

                  {/* Financial breakdown */}
                  {eventTicketPrice != null && allocationPercent != null && (
                    <div className="bg-white/5 rounded-xl p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-white/60">{t('tables.packagePrice', 'Package price')}</span><span className="text-white font-medium">{yuan(packageCents)}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">{t('tables.ticketsDeduction', 'Included tickets')}</span><span className="text-white/80">−{yuan(ticketTotalCents)} ({guestsCount} × {yuan(Math.round((eventTicketPrice || 0) * 100))})</span></div>
                      <div className="flex justify-between"><span className="text-white/60">{t('tables.tableAllocation', 'Table allocation')}</span><span className="text-white/80">−{yuan(allocationCents)} ({allocationPercent}% {t('tables.oncePerTable', 'once per table')})</span></div>
                      <div className="border-t border-white/10 my-1" />
                      <div className="flex justify-between"><span className="text-[#d3da0c] font-semibold">{t('tables.drinkAllowance', 'Drink allowance')}</span><span className="text-[#d3da0c] font-bold">{yuan(allowanceCents)}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">{t('tables.allowanceUsed', 'Selected drinks')}</span><span className="text-white/80">−{yuan(confirmedCents)}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">{t('tables.allowanceRemaining', 'Remaining')}</span><span className={remainingCents < 0 ? 'text-red-400 font-bold' : 'text-white font-bold'}>{yuan(Math.max(0, remainingCents))}</span></div>
                      {allowanceCents < 0 && (
                        <p className="text-red-400 text-xs pt-1">{t('tables.configError', 'Package configuration error — please contact the organizer.')}</p>
                      )}
                    </div>
                  )}

                  {/* Drink selection */}
                  {eventDrinks.length > 0 && allowanceCents >= 0 && (() => {
                    // Group drinks by category
                    const grouped = eventDrinks.reduce<Record<string, typeof eventDrinks>>((acc, d) => {
                      const cat = d.category || 'other';
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(d);
                      return acc;
                    }, {});
                    const cats = DRINK_CATEGORY_ORDER.filter(c => grouped[c]);
                    Object.keys(grouped).forEach(c => { if (!cats.includes(c)) cats.push(c); });

                    const renderDrink = (drink: typeof eventDrinks[0]) => {
                      const sel = selectedDrinks[drink.id];
                      const qty = sel?.qty || 0;
                      const lineCents = Math.round(drink.effective_price * 100) * qty;
                      return (
                        <div key={drink.id} className={`rounded-xl border p-3 transition-colors ${sel?.asUpgrade ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-[#020b00]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">{drink.name}</p>
                              <p className="text-white/40 text-xs">{yuan(Math.round(drink.effective_price * 100))}
                                {drink.supports_mixers && (
                                  <span className="text-[#d3da0c]/80"> · {t('tables.mixersIncluded', '{{count}} mixers included', { count: drink.mixer_included_qty || 4 })}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button type="button" onClick={() => setDrinkQty(drink.id, qty - 1)} className="w-8 h-8 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-30" disabled={qty === 0}>−</button>
                              <span className="text-white text-sm w-5 text-center">{qty}</span>
                              <button type="button" onClick={() => setDrinkQty(drink.id, qty + 1)} className="w-8 h-8 rounded-lg bg-[#d3da0c] text-black font-bold hover:bg-[#bbc10b]">+</button>
                            </div>
                          </div>
                          {qty > 0 && drink.supports_mixers && (drink.allowed_mixers?.length || 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {drink.allowed_mixers.map(m => (
                                <button key={m} type="button"
                                  onClick={() => setSelectedDrinks(prev => {
                                    const cur = prev[drink.id] || { qty: 1, asUpgrade: false, mixers: {} };
                                    const curQ = cur.mixers[m] || 0;
                                    const maxIncluded = (drink.mixer_included_qty || 4) * cur.qty;
                                    const totalSelected = Object.values(cur.mixers).reduce((a, b) => a + b, 0);
                                    const nextQ = totalSelected < maxIncluded ? curQ + 1 : 0;
                                    return { ...prev, [drink.id]: { ...cur, mixers: { ...cur.mixers, [m]: nextQ } } };
                                  })}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${(sel?.mixers?.[m] || 0) > 0 ? 'bg-[#d3da0c]/15 text-[#d3da0c] border-[#d3da0c]/40' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                  {m}{(sel?.mixers?.[m] || 0) > 0 ? ` ×${sel!.mixers[m]}` : ''}
                                </button>
                              ))}
                            </div>
                          )}
                          {qty > 0 && lineCents > remainingCents && (
                            <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={!!sel?.asUpgrade} onChange={(e) => toggleUpgrade(drink.id, e.target.checked)} className="accent-[#d3da0c]" />
                              <span className="text-amber-400">{t('tables.requestAsUpgrade', 'Over allowance — request as upgrade (pending organizer confirmation)')}</span>
                            </label>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div className="bg-white/5 rounded-xl p-4">
                        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                          <Wine className="w-4 h-4 text-[#d3da0c]" />
                          {t('tables.chooseDrinks', 'Choose your drinks')}
                        </h3>
                        <p className="text-white/40 text-xs mb-3">{t('tables.chooseDrinksHint', 'Selections within your allowance are included. Bigger requests go through an upgrade request.')}</p>
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                          {cats.map(cat => (
                            <div key={cat}>
                              <p className="text-[#d3da0c]/70 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                                {CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}
                              </p>
                              <div className="space-y-2">
                                {grouped[cat].map(renderDrink)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}


                  {/* Upgrade request notes */}
                  {upgradeLine && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                      <p className="text-amber-400 text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        {t('tables.upgradeRequest', 'Upgrade request')}: {upgradeLine.item.name} ×{upgradeLine.qty}
                      </p>
                      <textarea
                        value={upgradeNotes}
                        onChange={(e) => setUpgradeNotes(e.target.value)}
                        rows={2}
                        placeholder={t('tables.upgradeNotes', 'Notes for the organizer (preferred bottle, mixers, special request)...')}
                        className="w-full bg-[#020b00] border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex gap-2">
                        {(['contact_me', 'settle_at_venue'] as const).map(p => (
                          <button key={p} type="button" onClick={() => setUpgradePreference(p)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${upgradePreference === p ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                            {p === 'contact_me' ? t('tables.prefContact', 'Contact me to confirm extra payment') : t('tables.prefVenue', 'I’ll settle the difference at the venue')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions: Proceed to Payment */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowBookingModal(false)}
                      className="px-6 py-3 text-white/60 hover:text-white transition-colors text-center order-2 sm:order-1"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={!formData.contact_name.trim() || !formData.contact_phone.trim()}
                      className="px-8 py-3.5 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 order-1 sm:order-2 shadow-lg shadow-[#d3da0c]/20"
                    >
                      <span>{t('eventDetail.proceedToPayment', 'Proceed to Payment')}</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Step 2: QR & Mobile Deep-Link Payment Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showQrModal && selectedPackage && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 max-h-[88vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">{t('eventDetail.scanToPay', 'Scan to Pay')}</h3>
                  <button onClick={() => setShowQrModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mb-3 text-center">
                  <p className="text-white/60 text-xs font-medium">
                    {selectedPackage.name} · <span className="text-[#d3da0c] font-bold">¥{selectedPackage.price}</span>
                  </p>
                </div>

                <MobileQrPayment
                  amount={selectedPackage.price}
                  wechatQrUrl={wechatQrUrl}
                  alipayQrUrl={alipayQrUrl}
                  wechatPayUrl={wechatPayUrl}
                  alipayPayUrl={alipayPayUrl}
                  paymentInstructions={paymentInstructions}
                  hideYoopay={!!wechatQrUrl || !!alipayQrUrl}
                  onDeepLinkTap={() => { leftForPaymentAt.current = Date.now(); }}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Pay-return prompt: buyer returned from WeChat / Alipay deep-link app */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {payReturnPrompt && selectedPackage && (
            <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center"
              >
                <div className="w-16 h-16 bg-[#d3da0c]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-[#d3da0c]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {t('eventDetail.payReturnTitle', 'Did you complete the payment?')}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {t('eventDetail.payReturnBody', 'If you finished paying in the app, confirm below and the organizer is notified instantly.')}
                </p>
                <div className="p-3 bg-white/5 rounded-xl mb-4">
                  <span className="text-white/60 text-sm">{t('eventDetail.amountToPay', 'Amount')}</span>
                  <p className="text-xl font-bold text-[#d3da0c]">
                    ¥{selectedPackage.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setBuyerConfirmed(true);
                      setPayReturnPrompt(false);
                      setShowQrModal(false);
                      setShowOrderModal(true);
                    }}
                    className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
                  >
                    {t('eventDetail.payReturnYes', 'Yes, I Completed the Payment')}
                  </button>
                  <button
                    onClick={() => setPayReturnPrompt(false)}
                    className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-colors"
                  >
                    {t('eventDetail.payReturnNo', 'Not Yet')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Resume unfinished payment — browser tab was discarded while paying in WeChat/Alipay */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {resumePrompt && (
            <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] rounded-2xl p-6 max-w-sm w-full border border-white/10 text-center"
              >
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {t('eventDetail.resumeTitle', 'Unfinished Payment')}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {t('tableBooking.resumeBody', 'You were booking a table for this event. If you already completed the payment in WeChat or Alipay, confirm below — you can also attach your payment screenshot.')}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      restorePendingTablePayment();
                      setBuyerConfirmed(true);
                      setResumePrompt(false);
                      clearPendingTablePayment();
                      setShowOrderModal(true);
                    }}
                    className="w-full bg-[#d3da0c] text-black py-3 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors"
                  >
                    {t('eventDetail.resumeYes', 'Yes, I Completed the Payment')}
                  </button>
                  <button
                    onClick={() => {
                      restorePendingTablePayment();
                      setResumePrompt(false);
                      setShowQrModal(true);
                    }}
                    className="w-full bg-white/10 text-white py-3 rounded-xl font-medium hover:bg-white/15 transition-colors"
                  >
                    {t('eventDetail.resumeShowQr', 'Show Payment QR Again')}
                  </button>
                  <button
                    onClick={() => { setResumePrompt(false); clearPendingTablePayment(); }}
                    className="w-full text-gray-500 py-2 text-sm hover:text-gray-300 transition-colors"
                  >
                    {t('eventDetail.resumeCancel', 'Cancel')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Step 3: Order Confirmation Modal (Screenshot optional if buyerConfirmed) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showOrderModal && selectedPackage && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">{t('eventDetail.confirmPayment', 'Confirm Payment')}</h3>
                  <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-white/10 rounded-lg text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleOrderSubmit} className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{selectedPackage.name}</p>
                      <p className="text-white/60 text-xs">{guestsCount} {t('tables.guestTicketsIncluded', 'guest tickets included')}</p>
                    </div>
                    <span className="text-[#d3da0c] font-bold text-lg">
                      ¥{selectedPackage.price.toLocaleString()}
                    </span>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-3 bg-white/5 rounded-xl p-3.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">{t('tableBooking.contactName', 'Name')}:</span>
                      <span className="text-white font-medium">{formData.contact_name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">{t('tableBooking.phoneNumber', 'Phone')}:</span>
                      <span className="text-white font-medium">{formData.contact_phone}</span>
                    </div>
                    {formData.contact_email && (
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">{t('tableBooking.email', 'Email')}:</span>
                        <span className="text-white">{formData.contact_email}</span>
                      </div>
                    )}
                    {formData.special_requests && (
                      <div className="text-xs pt-1 border-t border-white/10">
                        <span className="text-white/60 block mb-0.5">{t('tableBooking.specialRequests', 'Note')}:</span>
                        <span className="text-white/80 italic">{formData.special_requests}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Screenshot (Optional when buyerConfirmed) */}
                  <div>
                    <label className="text-white/60 text-sm block mb-1.5">
                      {t('eventDetail.paymentScreenshot', 'Payment Screenshot')}{buyerConfirmed ? '' : ' *'}
                    </label>
                    {buyerConfirmed && (
                      <p className="text-[#d3da0c]/80 text-xs mb-2">
                        {t('eventDetail.screenshotOptionalHint', 'Optional, your payment confirmation was already sent to the organizer.')}
                      </p>
                    )}
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 text-white/50 mb-2" />
                        <p className="text-sm text-white/60 px-2 text-center truncate max-w-xs">
                          {screenshot ? screenshot.name : t('eventDetail.clickToUpload', 'Click to upload screenshot (optional)')}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                        className="hidden"
                        required={!buyerConfirmed}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-bold hover:bg-[#bbc10b] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#d3da0c]/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('common.submitting', 'Submitting...')}</span>
                      </>
                    ) : (
                      t('eventDetail.submitOrder', 'Submit Booking')
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Step 4: Success Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSuccessModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#d3da0c]/20 border border-[#d3da0c]/40 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-[#d3da0c]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {t('tableBooking.successTitle', 'Table Booking Submitted!')}
                </h3>
                <p className="text-white/60 text-sm mb-6 leading-relaxed">
                  {t('tableBooking.successDesc', 'Your table reservation has been sent to the organizer for approval. Once confirmed, your scannable guest tickets will appear in My Bookings.')}
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      navigate('/table-bookings');
                    }}
                    className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
                  >
                    {t('tableBooking.viewBookings', 'View My Bookings')}
                  </button>
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full py-2.5 text-white/60 hover:text-white transition-colors text-sm"
                  >
                    {t('common.done', 'Done')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
