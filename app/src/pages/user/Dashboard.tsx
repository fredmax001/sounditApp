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
  };
  event_name?: string;
  status: string;
  payment_status?: string;
  payment_amount?: number;
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
    }
  }, [session, fetchUserTickets, fetchSavedEvents, fetchBookings]);

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
    <div className="min-h-screen bg-[#0A0A0A] pt-24 p-4 lg:p-10 lg:pt-28">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 mb-12">
        <div className="flex items-center gap-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#d3da0c] to-purple-600 rounded-3xl lg:rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('user.dashboard.userAlt')}
                className="relative w-20 h-20 lg:w-32 lg:h-32 rounded-3xl lg:rounded-[2.5rem] object-cover border-2 border-white/10"
                onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
              />
            ) : (
              <div className="relative w-20 h-20 lg:w-32 lg:h-32 rounded-3xl lg:rounded-[2.5rem] bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center border-2 border-white/10">
                <span className="text-2xl lg:text-4xl font-bold text-black">
                  {(profile?.first_name || t('user.dashboard.userAlt'))[0].toUpperCase()}
                </span>
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 p-3 bg-[#d3da0c] rounded-2xl text-black shadow-xl hover:scale-110 active:scale-90 transition-all cursor-pointer">
              {isAvatarUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
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
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight mb-2">
              {t('user.dashboard.welcomeBackPrefix')}
              <span className="text-[#d3da0c]">{firstName}</span>
              {t('user.dashboard.welcomeBackSuffix')}
            </h1>
            <div className="flex items-center gap-4 text-gray-400 font-medium text-sm">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#d3da0c]" />
                {profile?.city?.name || t('user.dashboard.notSet')}
              </span>
              {profile?.role_type && (
                <>
                  <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                  <span className="tracking-widest uppercase text-[10px] text-gray-500">
                    {getRoleLabel(profile.role_type)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/user/settings">
            <button className="p-4 bg-white/5 rounded-2xl text-white hover:bg-white/10 transition-all relative">
              <Bell className="w-6 h-6" />
            </button>
          </Link>
          <Link to="/user/profile">
            <button className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all">
              <Edit className="w-5 h-5" />
              {t('user.dashboard.editProfile')}
            </button>
          </Link>
        </div>
      </div>

      <div className="flex overflow-x-auto w-full md:w-fit gap-2 mb-10 bg-[#111111] p-1.5 rounded-[1.5rem] border border-white/5 shadow-2xl hide-scrollbar">
        {[
          { id: 'explore', label: t('user.dashboard.exploreHub'), icon: Compass },
          { id: 'tickets', label: t('user.dashboard.myTickets'), icon: Ticket },
          { id: 'bookings', label: 'My Bookings', icon: Calendar },
          { id: 'saved', label: t('user.dashboard.savedEvents'), icon: Heart },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 md:px-8 py-3 rounded-xl text-sm font-bold transition-all capitalize flex items-center gap-3 whitespace-nowrap ${activeTab === tab.id
              ? 'bg-[#d3da0c] text-black shadow-[0_0_25px_rgba(211, 218, 12,0.2)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
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
                <section className="relative overflow-hidden group rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-10 bg-gradient-to-br from-[#111111] to-black border border-white/5">
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
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d3da0c]/10 text-[#d3da0c] rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">{t('user.dashboard.nextEvent')}</div>
                        <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4 tracking-tight">{nextTicket.event?.title || t('user.dashboard.yourNextEvent')}</h2>
                        <p className="text-gray-400 font-medium mb-8">
                          {nextTicket.event?.start_date ? new Date(nextTicket.event.start_date).toLocaleDateString() : t('user.dashboard.tbd')} @ {nextTicket.event?.city || t('user.dashboard.tbd')}
                        </p>
                        <button onClick={() => setActiveTab('tickets')} className="px-6 lg:px-10 py-4 lg:py-5 bg-[#d3da0c] text-black font-bold rounded-2xl hover:scale-105 transition-all shadow-xl flex items-center gap-3">
                          <QrCode className="w-6 h-6" />
                          {t('user.dashboard.showQrCode')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-l from-black to-transparent z-10"></div>
                        <div className="w-full h-full bg-gradient-to-br from-[#d3da0c]/20 to-[#FF2D8F]/20" />
                      </div>
                      <div className="relative z-20 max-w-md">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d3da0c]/10 text-[#d3da0c] rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">{t('user.dashboard.discoverEvents')}</div>
                        <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4 tracking-tight">{t('user.dashboard.findYourNext')} <span className="text-[#d3da0c]">{t('user.dashboard.experience')}</span></h2>
                        <p className="text-gray-400 font-medium mb-8">{t('user.dashboard.exploreEventsSubtitle')}</p>
                        <Link to="/events">
                          <button className="px-10 py-5 bg-[#d3da0c] text-black font-bold rounded-2xl hover:scale-105 transition-all shadow-xl flex items-center gap-3">
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
                    <h3 className="text-2xl font-bold text-white">{t('user.dashboard.quickActions')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <Link to="/events">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white/5 border border-white/5 rounded-2xl lg:rounded-3xl p-6 lg:p-8 group hover:border-[#d3da0c]/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 lg:w-20 lg:h-20 rounded-2xl bg-[#d3da0c]/20 flex items-center justify-center">
                            <Calendar className="w-10 h-10 text-[#d3da0c]" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold text-lg">{t('user.dashboard.browseEvents')}</h4>
                            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mt-1">{t('user.dashboard.findUpcomingParties')}</p>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                    <Link to="/artists">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="bg-white/5 border border-white/5 rounded-3xl p-8 group hover:border-purple-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 lg:w-20 lg:h-20 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                            <Disc className="w-10 h-10 text-purple-500" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold text-lg">{t('user.dashboard.discoverArtists')}</h4>
                            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mt-1">{t('user.dashboard.findYourFavoriteDjs')}</p>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </div>
                </section>
              </div>

              <div className="space-y-10">
                <section className="bg-[#111111] rounded-2xl lg:rounded-[2.5rem] border border-white/5 p-6 lg:p-8">
                  <h3 className="text-xl font-bold text-white mb-8 border-b border-white/5 pb-4">{t('user.dashboard.saved')} <span className="text-[#d3da0c]">{t('user.dashboard.events')}</span></h3>
                  <div className="space-y-6">
                    {loadingSaved ? (
                      <div className="text-gray-500 text-center py-4">{t('user.dashboard.loading')}</div>
                    ) : savedEvents.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        <Heart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm mb-2">{t('user.dashboard.noSavedEvents')}</p>
                        <button onClick={() => setActiveTab('saved')} className="text-[#d3da0c] text-xs hover:underline">
                          {t('user.dashboard.browseEventsToSave')}
                        </button>
                      </div>
                    ) : (
                      savedEvents.slice(0, 3).map((item: SavedEvent, idx: number) => (
                        <Link to={`/events/${item.events.id}`} key={idx}>
                          <div className="flex items-center gap-4 group cursor-pointer mb-4">
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-[#d3da0c]/10 transition-all">
                              <Calendar className="w-6 h-6 text-gray-600 group-hover:text-[#d3da0c]" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-bold group-hover:text-[#d3da0c] transition-all truncate">{(item.events?.title as string) || t('user.dashboard.event')}</h4>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                {item.events?.start_date ? new Date(item.events.start_date as string).toLocaleDateString() : t('user.dashboard.tba')}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-all" />
                          </div>
                        </Link>
                      ))
                    )}
                    <button onClick={() => setActiveTab('saved')} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 mt-4 transition-all">
                      {t('user.dashboard.viewAllSaved')}
                    </button>
                  </div>
                </section>

                <section className="bg-gradient-to-br from-purple-600/20 to-[#d3da0c]/20 rounded-2xl lg:rounded-[2.5rem] border border-white/5 p-6 lg:p-8 text-center relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500 blur-[80px] opacity-20"></div>
                  <h3 className="relative z-10 text-2xl font-bold text-white mb-4">{t('user.dashboard.yourStats')}</h3>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-white/5 rounded-2xl p-4">
                      <p className="text-3xl font-bold text-[#d3da0c]">{tickets.length}</p>
                      <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">{t('user.dashboard.ticketsLabel')}</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4">
                      <p className="text-3xl font-bold text-[#FF2D8F]">{savedEvents.length}</p>
                      <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">{t('user.dashboard.savedLabel')}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="max-w-4xl mx-auto space-y-8 lg:space-y-12">
              <div className="text-center">
                <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4 tracking-tight">{t('user.dashboard.yourEntry')} <span className="text-[#d3da0c]">{t('user.dashboard.passes')}</span></h2>
                <p className="text-gray-400 font-medium font-display">{t('user.dashboard.showAtEntrance')}</p>
              </div>

              {isTicketsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="w-12 h-12 text-[#d3da0c] mx-auto animate-spin" />
                  <p className="text-gray-400 mt-4">{t('user.dashboard.loadingTickets')}</p>
                </div>
              ) : upcomingTickets.length === 0 ? (
                <div className="text-center py-16 lg:py-20 bg-white/5 rounded-2xl lg:rounded-[3rem] border border-white/10">
                  <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">{t('user.dashboard.noTicketsYet')}</h3>
                  <p className="text-gray-400 mb-6">{t('user.dashboard.browseEventsAndGetTickets')}</p>
                  <Link to="/events">
                    <button className="px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all">
                      {t('user.dashboard.browseEvents')}
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-10">
                  {upcomingTickets.map(ticket => (
                    <div key={ticket.id} className="bg-white/5 border border-white/10 rounded-2xl lg:rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
                      <div className="relative w-full aspect-video">
                        <img
                          src={ticket.flyer_image || '/event_placeholder.jpg'}
                          className="w-full h-full object-cover"
                          alt={ticket.event}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                        <div className="absolute bottom-6 left-6">
                          <p className="text-white font-bold text-2xl tracking-tight leading-none">{ticket.event}</p>
                          <p className="text-[#d3da0c] font-bold text-xs uppercase mt-2">{ticket.venue}</p>
                        </div>
                      </div>
                      <div className="flex-1 p-6 lg:p-10 flex flex-col items-center gap-6 lg:gap-10">
                        <div className="flex-1 space-y-4 lg:space-y-6 text-center">
                          <div className="grid grid-cols-2 gap-4 lg:gap-10">
                            <div>
                              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">{t('user.dashboard.date')}</p>
                              <p className="text-white font-bold text-lg">{ticket.date}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">{t('user.dashboard.ticketNumber')}</p>
                              <p className="text-white font-bold text-lg">{ticket.qr}</p>
                            </div>
                          </div>
                          <div className="pt-6 border-t border-white/5 flex flex-wrap gap-3 justify-center md:justify-start">
                            <Link to={`/user/tickets`}>
                              <button className="px-6 py-3 bg-[#d3da0c] text-black rounded-xl text-xs font-bold uppercase hover:bg-[#bbc10b]">
                                {t('user.dashboard.viewTicket')}
                              </button>
                            </Link>
                          </div>
                        </div>
                        <div className="w-40 h-40 lg:w-48 lg:h-48 bg-white p-3 lg:p-4 rounded-2xl lg:rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)]">
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
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="text-center">
                <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4 tracking-tight">{t('user.dashboard.myBookings')}</h2>
                <p className="text-gray-400 font-medium font-display">{t('user.dashboard.trackBookings')}</p>
              </div>

              {bookingsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="w-12 h-12 text-[#d3da0c] mx-auto animate-spin" />
                  <p className="text-gray-400 mt-4">{t('user.dashboard.loadingBookings')}</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-16 lg:py-20 bg-white/5 rounded-2xl lg:rounded-[3rem] border border-white/10">
                  <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">{t('user.dashboard.noBookingsYet')}</h3>
                  <p className="text-gray-400 mb-6">{t('user.dashboard.browseArtists')}</p>
                  <Link to="/artists">
                    <button className="px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all">
                      {t('user.dashboard.discoverArtists')}
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-6">
                  {bookings.map(booking => {
                    const canUpload = booking.status === 'pending' && booking.payment_status === 'pending';
                    return (
                      <div key={booking.id} className="bg-white/5 border border-white/10 rounded-2xl lg:rounded-[2rem] p-6 lg:p-8 flex flex-col gap-4 lg:gap-6 items-start">
                        <div className="w-16 h-16 rounded-2xl bg-[#d3da0c]/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-8 h-8 text-[#d3da0c]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1">{booking.event_name || t('user.dashboard.untitledEvent')}</h3>
                          <p className="text-gray-400 text-sm mb-3">{t('user.dashboard.artist')}: {booking.artist?.stage_name || t('user.dashboard.unknownArtist')}</p>
                          <div className="flex flex-wrap gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : booking.status === 'accepted' || booking.status === 'confirmed' ? 'bg-green-500/20 text-green-500' : booking.status === 'rejected' || booking.status === 'cancelled' ? 'bg-red-500/20 text-red-500' : 'bg-gray-500/20 text-gray-500'}`}>
                              {t('user.dashboard.booking')}: {booking.status}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.payment_status === 'paid' || booking.payment_status === 'verified' ? 'bg-green-500/20 text-green-500' : booking.payment_status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-500/20 text-gray-500'}`}>
                              {t('user.dashboard.payment')}: {booking.payment_status || 'pending'}
                            </span>
                          </div>
                        </div>
                        {canUpload && (
                          <button
                            onClick={() => setUploadModalBooking(booking)}
                            className="px-6 py-3 bg-[#d3da0c] text-black rounded-xl text-sm font-bold uppercase hover:bg-[#bbc10b] shrink-0"
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

          {activeTab === 'saved' && (
            <div className="space-y-10">
              <div className="text-center mb-10">
                <h2 className="text-2xl lg:text-4xl font-bold text-white mb-4 tracking-tight">{t('user.dashboard.yourSaved')} <span className="text-[#d3da0c]">{t('user.dashboard.events')}</span></h2>
                <p className="text-gray-400 font-medium">{t('user.dashboard.eventsInterestedIn')}</p>
              </div>

              {loadingSaved ? (
                <div className="text-center py-20 text-gray-500">{t('user.dashboard.loadingSavedEvents')}</div>
              ) : savedEvents.length === 0 ? (
                <div className="text-center py-20">
                  <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">{t('user.dashboard.noSavedEvents')}</h3>
                  <p className="text-gray-400 mb-6">{t('user.dashboard.browseAndSaveEvents')}</p>
                  <Link to="/events">
                    <button className="px-8 py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-all">
                      {t('user.dashboard.browseEvents')}
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {savedEvents.map((item: SavedEvent, idx: number) => (
                    <motion.div
                      key={item.event_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl lg:rounded-3xl overflow-hidden group hover:border-[#d3da0c]/30 transition-all"
                    >
                      <div className="relative h-40 lg:h-48 overflow-hidden">
                        {item.events?.flyer_image ? (
                          <img
                            src={item.events.flyer_image as string}
                            alt={(item.events.title as string) || t('user.dashboard.event')}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#111111] to-[#1a1a1a] flex items-center justify-center">
                            <Calendar className="w-24 h-24 text-gray-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                      </div>
                      <div className="p-6 space-y-4">
                        <div>
                          <h3 className="text-white font-bold text-xl mb-2">{(item.events?.title as string) || t('user.dashboard.event')}</h3>
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Calendar className="w-4 h-4" />
                            <span>{item.events?.start_date ? new Date(item.events.start_date as string).toLocaleDateString() : t('user.dashboard.tba')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                            <MapPin className="w-4 h-4" />
                            <span>{(item.events?.city as string) || t('user.dashboard.tba')}</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[#d3da0c] font-bold text-lg">
                            {item.events?.ticket_tiers?.[0]?.price ? `¥${item.events.ticket_tiers[0].price}` : t('user.dashboard.free')}
                          </span>
                          <Link to={`/events/${item.events?.id}`}>
                            <button className="px-6 py-2 bg-[#d3da0c] text-black font-bold rounded-lg hover:bg-[#bbc10b] transition-all text-sm flex items-center gap-2">
                              {t('user.dashboard.details')}
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Booking Payment Upload Modal */}
      {uploadModalBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">{t('user.dashboard.uploadPayment')}</h3>
              <button onClick={closeUploadModal} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>

            <div className="mb-6">
              <MobileQrPayment amount={uploadModalBooking.budget} />
            </div>

            <form onSubmit={handleUploadPayment} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('user.dashboard.yourNameRequired')}</label>
                <input
                  type="text"
                  value={uploadPayerName}
                  onChange={(e) => setUploadPayerName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('user.dashboard.yourName')}
                  required
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('user.dashboard.paymentScreenshotRequired')}</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-white/50 mb-2" />
                    <p className="text-sm text-white/60">{uploadScreenshot ? uploadScreenshot.name : t('user.dashboard.clickToUploadScreenshot')}</p>
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
                <label className="text-white/60 text-sm block mb-2">
                  {t('eventDetail.paymentReference')} 
                  <span className="ml-1 text-[#d3da0c] font-medium">(Optional - We will try to auto-detect)</span>
                </label>
                <input
                  type="text"
                  value={uploadPaymentReference}
                  onChange={(e) => setUploadPaymentReference(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('eventDetail.enterPaymentReference')}
                />
              </div>
              <div>
                <label className="text-white/60 text-sm block mb-2">{t('user.dashboard.notesOptional')}</label>
                <textarea
                  value={uploadPayerNotes}
                  onChange={(e) => setUploadPayerNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none"
                  placeholder={t('user.dashboard.notesPlaceholder')}
                  rows={3}
                />
              </div>
              <button
                type="submit"
                disabled={uploadSubmitting}
                className="w-full bg-[#d3da0c] text-black py-4 rounded-xl font-semibold hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
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
