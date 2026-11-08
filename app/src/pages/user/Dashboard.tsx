import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import MobileQrPayment from '@/components/MobileQrPayment';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import {
  Ticket, Heart, Bell, MapPin, Calendar,
  Camera, Edit, ChevronRight, Compass, QrCode,
  Compass as CompassIcon, Disc, Loader2, ArrowRight,
  X, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

interface SavedEvent {
  event_id: string;
  events: Record<string, unknown> & {
    id: string;
  };
}

interface BookingRequest {
  id: number;
  artist_id: number;
  artist?: {
    id: number;
    stage_name: string;
    artist_type?: string;
    genre?: string;
    avatar_url?: string;
    wechat_qr_url?: string;
    alipay_qr_url?: string;
    wechat_pay_url?: string;
    alipay_pay_url?: string;
    payment_instructions?: string;
    deposit_eligible?: boolean;
  };
  event_name?: string;
  status: string;
  payment_status?: string;
  payment_amount?: number;
  deposit_amount?: number;
  agreed_price?: number;
  budget?: number;
  event_date?: string;
  event_city?: string;
  message?: string;
  created_at: string;
}

const UserDashboard = () => {
  const { t } = useTranslation();
  const { profile, session } = useAuthStore();
  const { tickets, fetchUserTickets, isLoading: isTicketsLoading } = useTicketStore();
  const [activeTab, setActiveTab] = useState('explore');
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [ticketOrders, setTicketOrders] = useState<Array<{ status: string }>>([]);
  const [followedArtists, setFollowedArtists] = useState(0);

  const [uploadModalBooking, setUploadModalBooking] = useState<BookingRequest | null>(null);
  const [uploadScreenshot, setUploadScreenshot] = useState<File | null>(null);
  const [uploadPayerName, setUploadPayerName] = useState('');
  const [uploadPayerNotes, setUploadPayerNotes] = useState('');
  const [uploadPaymentReference, setUploadPaymentReference] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);

  const fetchSavedEvents = useCallback(async () => {
    if (!session?.access_token) {
      setLoadingSaved(false);
      return;
    }

    setLoadingSaved(true);
    try {
      const response = await fetch(`${API_BASE_URL}/events/saved`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json() as { id: string;[key: string]: unknown }[];
        const formattedEvents = data.map((event) => ({
          event_id: event.id,
          events: event
        }));
        setSavedEvents(formattedEvents || []);
      }
    } catch {
      console.error('Failed to fetch saved events');
    } finally {
      setLoadingSaved(false);
    }
  }, [session]);

  const fetchBookings = useCallback(async () => {
    if (!session?.access_token) {
      setBookingsLoading(false);
      return;
    }

    setBookingsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/requests/my`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json() as BookingRequest[];
        setBookings(data || []);
      }
    } catch {
      console.error('Failed to fetch bookings');
    } finally {
      setBookingsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchUserTickets();
      fetchSavedEvents();
      fetchBookings();

      const token = session.access_token;
      fetch(`${API_BASE_URL}/tickets/my-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : { orders: [] })
        .then(data => setTicketOrders(data.orders || []))
        .catch(() => setTicketOrders([]));

      fetch(`${API_BASE_URL}/social/following`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : { artists: [] })
        .then(data => setFollowedArtists((data.artists || []).length))
        .catch(() => setFollowedArtists(0));
    }
  }, [session, fetchUserTickets, fetchSavedEvents, fetchBookings]);

  const validTicketOrders = ticketOrders.filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
  const ticketCount = tickets.length + validTicketOrders.length;
  const savedCount = savedEvents.length + followedArtists;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.dashboard.invalidImageFile'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('user.dashboard.imageSizeLimit'));
      return;
    }

    setIsAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      const avatarUrl = data.url;

      const updateResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update profile');
      }

      toast.success(t('user.dashboard.avatarUpdated'));
      window.location.reload();
    } catch {
      toast.error(t('user.dashboard.avatarUploadFailed'));
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const closeUploadModal = () => {
    setUploadModalBooking(null);
    setUploadScreenshot(null);
    setUploadPayerName('');
    setUploadPayerNotes('');
    setUploadPaymentReference('');
  };

  const handleUploadPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalBooking || !uploadScreenshot || !uploadPayerName.trim() || !session?.access_token) return;

    setUploadSubmitting(true);
    const formData = new FormData();
    formData.append('payment_screenshot', uploadScreenshot);
    formData.append('payer_name', uploadPayerName);
    if (uploadPaymentReference.trim()) {
      formData.append('payment_reference', uploadPaymentReference.trim());
    }
    if (uploadPayerNotes) formData.append('payer_notes', uploadPayerNotes);

    try {
      const res = await fetch(`${API_BASE_URL}/bookings/requests/${uploadModalBooking.id}/upload-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('user.dashboard.paymentProofUploaded'));
        closeUploadModal();
        fetchBookings();
      } else {
        toast.error(data.detail || t('user.dashboard.failedToUploadPaymentProof'));
      }
    } catch {
      toast.error(t('user.dashboard.failedToUploadPaymentProof'));
    } finally {
      setUploadSubmitting(false);
    }
  };

  const upcomingTickets = tickets.slice(0, 3).map(ticket => ({
    id: ticket.id,
    event: ticket.event?.title || t('user.dashboard.unknownEvent'),
    date: ticket.event?.start_date ? new Date(ticket.event.start_date).toLocaleDateString() : t('user.dashboard.tbd'),
    venue: ticket.event?.city || t('user.dashboard.tbd'),
    qr: ticket.ticket_number,
    flyer_image: ticket.event?.flyer_image
  }));

  const nextTicket = tickets[0];

  const firstName = profile?.first_name || t('user.dashboard.explorer');

  const getRoleLabel = (roleType?: string) => {
    switch (roleType) {
      case 'business': return t('user.dashboard.businessAccount');
      case 'artist': return t('user.dashboard.artistAccount');
      case 'admin': return t('user.dashboard.adminAccount');
      default: return t('user.dashboard.member');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#020b00] text-[#020b00] dark:text-white pt-24 px-4 py-6 lg:p-10 lg:pt-28 transition-colors">
      <div className="flex flex-col items-start justify-between gap-4 mb-8 lg:flex-row lg:items-end lg:gap-8 lg:mb-12">
        <div className="flex items-center gap-4 lg:gap-8">
          <div className="relative group">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('user.dashboard.userAlt')}
                className="relative w-14 h-14 lg:w-24 lg:h-24 rounded-2xl object-cover border-2 border-black/10 dark:border-white/10"
                onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
              />
            ) : (
              <div className="relative w-14 h-14 lg:w-24 lg:h-24 rounded-2xl bg-[#d3da0c] flex items-center justify-center border-2 border-black/10 dark:border-white/10">
                <span className="text-lg lg:text-3xl font-bold text-black">
                  {(profile?.first_name || t('user.dashboard.userAlt'))[0].toUpperCase()}
                </span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 p-1.5 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-lg lg:-bottom-2 lg:-right-2 lg:p-3 lg:rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all cursor-pointer">
              {isAvatarUploading ? (
                <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
              ) : (
                <Camera className="w-4 h-4 lg:w-5 lg:h-5" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={isAvatarUploading}
              />
            </label>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-3xl font-bold text-[#020b00] dark:text-white tracking-tight mb-1 lg:mb-2">
              {t('user.dashboard.welcomeBackPrefix')}
              <span className="text-[#020b00] dark:text-[#d3da0c] underline decoration-[#d3da0c] decoration-2 underline-offset-4">{firstName}</span>
              {t('user.dashboard.welcomeBackSuffix')}
            </h1>
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-medium text-xs lg:text-sm">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#020b00] dark:text-[#d3da0c]" />
                {profile?.city?.name || t('user.dashboard.notSet')}
              </span>
              {profile?.role_type && (
                <>
                  <span className="w-1 h-1 bg-black/20 dark:bg-white/20 rounded-full"></span>
                  <span className="tracking-widest uppercase text-[10px] text-gray-500 font-semibold">
                    {getRoleLabel(profile.role_type)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 lg:gap-3">
          <Link to="/user/settings">
            <button className="p-2.5 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl lg:p-4 lg:rounded-2xl text-gray-700 dark:text-white hover:bg-neutral-200 dark:hover:bg-white/10 transition-all relative touch-target">
              <Bell className="w-5 h-5 lg:w-6 lg:h-6" />
            </button>
          </Link>
          <Link to="/user/profile">
            <button className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-white font-semibold text-xs lg:px-8 lg:py-4 lg:rounded-2xl lg:text-sm hover:bg-neutral-200 dark:hover:bg-white/10 transition-all">
              <Edit className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden lg:inline">{t('user.dashboard.editProfile')}</span>
              <span className="lg:hidden">Edit</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="flex w-full gap-1 lg:gap-2 mb-6 bg-neutral-100 dark:bg-[#111111] p-1.5 rounded-2xl border border-black/8 dark:border-white/5 shadow-xs dark:shadow-2xl">
        {[
          { id: 'explore', label: t('user.dashboard.exploreHub'), icon: Compass },
          { id: 'tickets', label: t('user.dashboard.myTickets'), icon: Ticket },
          { id: 'bookings', label: 'My Bookings', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-0 justify-center px-1 sm:px-3 lg:px-6 py-2.5 lg:py-3 rounded-lg lg:rounded-xl text-[11px] sm:text-xs lg:text-sm font-bold transition-all capitalize flex items-center gap-1 lg:gap-3 whitespace-nowrap ${activeTab === tab.id
              ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            <tab.icon className="hidden sm:block w-4 h-4 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="min-h-[600px]"
        >
          {activeTab === 'explore' && (
            <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">
              <div className="lg:col-span-2 space-y-10">
                <section className="relative overflow-hidden group rounded-2xl p-4 lg:p-8 bg-neutral-50 dark:bg-[#111111] border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
                  {nextTicket ? (
                    <>
                      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-l from-black to-transparent z-10"></div>
                        <img
                          src={nextTicket.event?.flyer_image || '/event_placeholder.jpg'}
                          className="w-full h-full object-cover"
                          alt={nextTicket.event?.title || t('user.dashboard.event')}
                        />
                      </div>
                      <div className="relative z-20 max-w-md">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#020b00]/10 dark:bg-[#d3da0c]/10 text-[#020b00] dark:text-[#d3da0c] rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">{t('user.dashboard.nextEvent')}</div>
                        <h2 className="text-xl lg:text-3xl font-bold text-[#020b00] dark:text-white mb-3 tracking-tight">{nextTicket.event?.title || t('user.dashboard.yourNextEvent')}</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-6">
                          {nextTicket.event?.start_date ? new Date(nextTicket.event.start_date).toLocaleDateString() : t('user.dashboard.tbd')} @ {nextTicket.event?.city || t('user.dashboard.tbd')}
                        </p>
                        <button onClick={() => setActiveTab('tickets')} className="px-5 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl text-sm lg:px-8 lg:py-4 lg:rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-3">
                          <QrCode className="w-6 h-6" />
                          {t('user.dashboard.showQrCode')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-l from-black to-transparent z-10"></div>
                        <div className="w-full h-full bg-[#d3da0c]/15" />
                      </div>
                      <div className="relative z-20 max-w-md">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#020b00]/10 dark:bg-[#d3da0c]/10 text-[#020b00] dark:text-[#d3da0c] rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">{t('user.dashboard.discoverEvents')}</div>
                        <h2 className="text-xl lg:text-3xl font-bold text-[#020b00] dark:text-white mb-3 tracking-tight">{t('user.dashboard.findYourNext')} <span className="text-[#020b00] dark:text-[#d3da0c]">{t('user.dashboard.experience')}</span></h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-6">{t('user.dashboard.exploreEventsSubtitle')}</p>
                        <Link to="/events">
                          <button className="px-5 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl text-sm lg:px-8 lg:py-4 lg:rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-3">
                            <CompassIcon className="w-6 h-6" />
                            {t('user.dashboard.browseEvents')}
                          </button>
                        </Link>
                      </div>
                    </>
                  )}
                </section>

                <section>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-base font-bold text-[#020b00] dark:text-white lg:text-xl">{t('user.dashboard.quickActions')}</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                    <Link to="/events">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-4 lg:p-6 group hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/30 shadow-xs dark:shadow-none transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 lg:w-20 lg:h-20 rounded-xl lg:rounded-2xl bg-black/5 dark:bg-[#d3da0c]/15 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5 lg:w-10 lg:h-10 text-[#020b00] dark:text-[#d3da0c]" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[#020b00] dark:text-white font-bold text-sm lg:text-lg whitespace-nowrap">{t('user.dashboard.browseEvents')}</h4>
                            <p className="text-gray-600 dark:text-gray-400 text-[11px] lg:text-sm font-semibold uppercase tracking-wider mt-0.5 whitespace-nowrap">{t('user.dashboard.findUpcomingParties')}</p>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                    <Link to="/artists">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/5 rounded-2xl p-4 lg:p-6 group hover:border-[#020b00]/30 dark:hover:border-[#d3da0c]/30 shadow-xs dark:shadow-none transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 lg:w-20 lg:h-20 rounded-xl lg:rounded-2xl bg-black/5 dark:bg-[#d3da0c]/15 flex items-center justify-center shrink-0">
                            <Disc className="w-5 h-5 lg:w-10 lg:h-10 text-[#020b00] dark:text-[#d3da0c]" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[#020b00] dark:text-white font-bold text-sm lg:text-lg whitespace-nowrap">{t('user.dashboard.discoverArtists')}</h4>
                            <p className="text-gray-600 dark:text-gray-400 text-[11px] lg:text-sm font-semibold uppercase tracking-wider mt-0.5 whitespace-nowrap">{t('user.dashboard.findYourFavoriteDjs')}</p>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </div>
                </section>
              </div>

              <div className="space-y-10">
                <section className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 p-4 lg:p-6 shadow-xs dark:shadow-none">
                  <h3 className="text-base font-bold text-[#020b00] dark:text-white lg:text-lg mb-8 border-b border-black/8 dark:border-white/5 pb-4">{t('user.dashboard.saved')} <span className="text-[#020b00] dark:text-[#d3da0c]">{t('user.dashboard.events')}</span></h3>
                  <div className="space-y-6">
                    {loadingSaved ? (
                      <div className="text-gray-500 text-center py-4">{t('user.dashboard.loading')}</div>
                    ) : savedEvents.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        <Heart className="w-10 h-10 mx-auto mb-3 opacity-30 text-[#020b00] dark:text-[#d3da0c]" />
                        <p className="text-sm mb-2 text-gray-600 dark:text-gray-400 font-medium">{t('user.dashboard.noSavedEvents')}</p>
                        <Link to="/events" className="text-[#020b00] dark:text-[#d3da0c] text-xs font-semibold hover:underline">
                          {t('user.dashboard.browseEventsToSave')}
                        </Link>
                      </div>
                    ) : (
                      savedEvents.slice(0, 3).map((item: SavedEvent, idx: number) => (
                        <Link to={`/events/${item.events.id}`} key={idx}>
                          <div className="flex items-center gap-4 group cursor-pointer mb-4">
                            <div className="w-14 h-14 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-[#d3da0c]/10 transition-all">
                              <Calendar className="w-6 h-6 text-gray-500 group-hover:text-[#020b00] dark:group-hover:text-[#d3da0c]" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-[#020b00] dark:text-white font-bold group-hover:text-[#020b00]/80 dark:group-hover:text-[#d3da0c] transition-all truncate">{(item.events?.title as string) || t('user.dashboard.event')}</h4>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                {item.events?.start_date ? new Date(item.events.start_date as string).toLocaleDateString() : t('user.dashboard.tba')}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#020b00] dark:group-hover:text-white transition-all" />
                          </div>
                        </Link>
                      ))
                    )}
                    <Link to="/favorites">
                      <button className="w-full py-4 bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-gray-800 dark:text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-white/10 mt-4 transition-all">
                        {t('user.dashboard.viewAllSaved')}
                      </button>
                    </Link>
                  </div>
                </section>

                <section className="bg-neutral-50 dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 p-6 lg:p-8 text-center relative overflow-hidden shadow-xs dark:shadow-none">
                  <h3 className="relative z-10 text-base font-bold text-[#020b00] dark:text-white lg:text-xl mb-4">{t('user.dashboard.yourStats')}</h3>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-xs">
                      <p className="text-xl font-bold text-[#020b00] dark:text-[#d3da0c] lg:text-3xl">{ticketCount}</p>
                      <p className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-widest mt-1">{t('user.dashboard.ticketsLabel')}</p>
                    </div>
                    <div className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl p-4 shadow-xs">
                      <p className="text-xl font-bold text-[#020b00] dark:text-white lg:text-3xl">{savedCount}</p>
                      <p className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-widest mt-1">{t('user.dashboard.savedLabel')}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-4 lg:space-y-8">
              <div className="text-center">
                <h2 className="text-xl lg:text-3xl font-bold text-[#020b00] dark:text-white mb-3 tracking-tight">{t('user.dashboard.yourEntry')} <span className="text-[#020b00] dark:text-[#d3da0c]">{t('user.dashboard.passes')}</span></h2>
                <p className="text-gray-600 dark:text-gray-400 font-medium font-display">{t('user.dashboard.showAtEntrance')}</p>
              </div>

              {isTicketsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="w-12 h-12 text-[#020b00] dark:text-[#d3da0c] mx-auto animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400 mt-4">{t('user.dashboard.loadingTickets')}</p>
                </div>
              ) : upcomingTickets.length === 0 ? (
                <div className="text-center py-16 lg:py-20 bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/10 shadow-xs">
                  <Ticket className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-[#020b00] dark:text-white lg:text-lg mb-2">{t('user.dashboard.noTicketsYet')}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">{t('user.dashboard.browseEventsAndGetTickets')}</p>
                  <Link to="/events">
                    <button className="px-8 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md">
                      {t('user.dashboard.browseEvents')}
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-10">
                  {upcomingTickets.map(ticket => (
                    <div key={ticket.id} className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-xs dark:shadow-2xl">
                      <div className="relative w-full aspect-video">
                        <img
                          src={ticket.flyer_image || '/event_placeholder.jpg'}
                          className="w-full h-full object-cover"
                          alt={ticket.event}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                        <div className="absolute bottom-6 left-6">
                          <p className="text-white font-bold text-2xl tracking-tight leading-none">{ticket.event}</p>
                          <p className="text-[#d3da0c] font-bold text-xs uppercase mt-2">{ticket.venue}</p>
                        </div>
                      </div>
                      <div className="flex-1 p-6 lg:p-10 flex flex-col items-center gap-6 lg:gap-10">
                        <div className="flex-1 space-y-4 lg:space-y-6 text-center">
                          <div className="grid grid-cols-2 gap-3 lg:gap-6">
                            <div>
                              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">{t('user.dashboard.date')}</p>
                              <p className="text-[#020b00] dark:text-white font-bold text-sm lg:text-lg mb-1">{ticket.date}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">{t('user.dashboard.ticketNumber')}</p>
                              <p className="text-[#020b00] dark:text-white font-mono font-bold text-sm lg:text-lg mb-1">{ticket.qr}</p>
                            </div>
                          </div>
                          <div className="pt-6 border-t border-black/8 dark:border-white/5 flex flex-wrap gap-3 justify-center md:justify-start">
                            <Link to={`/user/tickets`}>
                              <button className="px-6 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-xl text-xs font-bold uppercase hover:opacity-90 transition-all shadow-sm">
                                {t('user.dashboard.viewTicket')}
                              </button>
                            </Link>
                          </div>
                        </div>
                        <div className="w-28 h-28 lg:w-40 lg:h-40 bg-white p-3 lg:p-4 rounded-2xl flex items-center justify-center border border-black/10 shadow-md">
                          <QrCode className="w-full h-full text-black stroke-[1.5]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6 lg:space-y-10">
              <div className="text-center">
                <h2 className="text-xl lg:text-3xl font-bold text-[#020b00] dark:text-white mb-3 tracking-tight">{t('user.dashboard.myBookings')}</h2>
                <p className="text-gray-600 dark:text-gray-400 font-medium font-display">{t('user.dashboard.trackBookings')}</p>
              </div>

              {bookingsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="w-12 h-12 text-[#020b00] dark:text-[#d3da0c] mx-auto animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400 mt-4">{t('user.dashboard.loadingBookings')}</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-16 lg:py-20 bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/10 shadow-xs">
                  <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-[#020b00] dark:text-white lg:text-lg mb-2">{t('user.dashboard.noBookingsYet')}</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">{t('user.dashboard.browseArtists')}</p>
                  <Link to="/artists">
                    <button className="px-8 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md">
                      {t('user.dashboard.discoverArtists')}
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-6">
                  {bookings.map(booking => {
                    const canUpload = ['pending', 'accepted'].includes(booking.status) && ['pending', 'rejected'].includes(booking.payment_status || 'pending') && booking.artist?.deposit_eligible !== false;
                    return (
                      <div key={booking.id} className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-3 lg:p-6 lg:gap-4 items-start shadow-xs dark:shadow-none">
                        <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-8 h-8 text-[#020b00] dark:text-[#d3da0c]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-[#020b00] dark:text-white lg:text-lg mb-1">{booking.event_name || t('user.dashboard.untitledEvent')}</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{t('user.dashboard.artist')}: {booking.artist?.stage_name || t('user.dashboard.unknownArtist')}</p>
                          <div className="flex flex-wrap gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-500' : booking.status === 'accepted' || booking.status === 'confirmed' ? 'bg-green-500/20 text-green-600 dark:text-green-500' : booking.status === 'rejected' || booking.status === 'cancelled' ? 'bg-red-500/20 text-red-600 dark:text-red-500' : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'}`}>
                              {t('user.dashboard.booking')}: {booking.status}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.payment_status === 'paid' || booking.payment_status === 'verified' ? 'bg-green-500/20 text-green-600 dark:text-green-500' : booking.payment_status === 'pending' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-500' : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'}`}>
                              {t('user.dashboard.payment')}: {booking.payment_status || 'pending'}
                            </span>
                          </div>
                        </div>
                        {booking.artist?.deposit_eligible === false && booking.payment_status === 'pending' && (
                          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">This artist cannot currently receive deposits through Sound It. Your booking request remains active.</p>
                        )}
                        {canUpload && (
                          <button
                            onClick={() => setUploadModalBooking(booking)}
                            className="px-6 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-xl text-sm font-bold uppercase hover:opacity-90 active:scale-95 transition-all shadow-sm shrink-0"
                          >
                            {t('user.dashboard.uploadPayment')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Booking Payment Upload Modal */}
      {uploadModalBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#141414] rounded-2xl p-5 max-w-md w-full mx-4 border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto text-[#020b00] dark:text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#020b00] dark:text-white">{t('user.dashboard.uploadPayment')}</h3>
              <button onClick={closeUploadModal} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-gray-700 dark:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="mb-6">
              <MobileQrPayment
                amount={uploadModalBooking.deposit_amount || Math.round((uploadModalBooking.agreed_price || uploadModalBooking.budget || 0) * 0.5)}
                reference={`BOOK-${uploadModalBooking.id}`}
                wechatQrUrl={uploadModalBooking.artist?.wechat_qr_url}
                alipayQrUrl={uploadModalBooking.artist?.alipay_qr_url}
                wechatPayUrl={uploadModalBooking.artist?.wechat_pay_url}
                alipayPayUrl={uploadModalBooking.artist?.alipay_pay_url}
                paymentInstructions={uploadModalBooking.artist?.payment_instructions}
              />
            </div>

            <form onSubmit={handleUploadPayment} className="space-y-4">
              <div>
                <label className="text-gray-700 dark:text-white/60 text-sm font-medium block mb-2">{t('user.dashboard.yourNameRequired')}</label>
                <input
                  type="text"
                  value={uploadPayerName}
                  onChange={(e) => setUploadPayerName(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[#020b00] dark:text-white focus:border-[#020b00] dark:focus:border-[#d3da0c] outline-none"
                  placeholder={t('user.dashboard.yourName')}
                  required
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-white/60 text-sm font-medium block mb-2">{t('user.dashboard.paymentScreenshotRequired')}</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-black/20 dark:border-white/20 rounded-xl cursor-pointer hover:border-[#020b00] dark:hover:border-[#d3da0c]/50 transition-colors bg-neutral-50 dark:bg-white/5">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-gray-400 dark:text-white/50 mb-2" />
                    <p className="text-sm text-gray-600 dark:text-white/60 font-medium">{uploadScreenshot ? uploadScreenshot.name : t('user.dashboard.clickToUploadScreenshot')}</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadScreenshot(e.target.files?.[0] || null)}
                    className="hidden"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="text-gray-700 dark:text-white/60 text-sm font-medium block mb-2">
                  {t('eventDetail.paymentReference')} 
                  <span className="ml-1 text-[#020b00] dark:text-[#d3da0c] font-semibold">(Optional - We will try to auto-detect)</span>
                </label>
                <input
                  type="text"
                  value={uploadPaymentReference}
                  onChange={(e) => setUploadPaymentReference(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[#020b00] dark:text-white focus:border-[#020b00] dark:focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterPaymentReference')}
                />
              </div>
              <div>
                <label className="text-gray-700 dark:text-white/60 text-sm font-medium block mb-2">{t('user.dashboard.notesOptional')}</label>
                <textarea
                  value={uploadPayerNotes}
                  onChange={(e) => setUploadPayerNotes(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-[#020b00] dark:text-white focus:border-[#020b00] dark:focus:border-[#d3da0c] outline-none"
                  placeholder={t('user.dashboard.notesPlaceholder')}
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={uploadSubmitting}
                className="w-full bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black py-3 rounded-xl font-bold text-sm lg:py-4 hover:opacity-90 active:scale-[0.99] transition-all shadow-md disabled:opacity-50"
              >
                {uploadSubmitting ? t('user.dashboard.uploading') : t('user.dashboard.submitPaymentProof')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
