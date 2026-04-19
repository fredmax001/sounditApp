import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MobileQrPayment from '@/components/MobileQrPayment';
import {
  Star, MapPin, Music, Calendar, Clock, DollarSign,
  CheckCircle, MessageSquare, Play, Pause, ChevronLeft,
  Award, Globe, Briefcase, Volume2, X,
  Send, Check, AlertCircle, Instagram, Youtube, ExternalLink,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import VerificationBadge from '@/components/VerificationBadge';

// Types
interface ArtistProfile {
  id: number;
  stage_name: string;
  artist_type: string;
  genre: string;
  genre_tags: string[];
  bio: string;
  years_experience: number;
  languages: string[];
  city: string;
  starting_price: number;
  performance_duration: string;
  event_types: string[];
  equipment_provided: string[];
  travel_availability: string;
  travel_fee: number;
  rating: number;
  reviews_count: number;
  followers_count: number;
  events_count: number;
  is_verified: boolean;
  verification_badge: boolean;
  avatar_url: string;
  spotify_url?: string;
  apple_music_url?: string;
  soundcloud_url?: string;
  hearthis_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  wechat_qr_url?: string;
  alipay_qr_url?: string;
  payment_instructions?: string;
}

interface Track {
  id: number;
  title: string;
  genre: string;
  duration: string;
  audio_url?: string;
  hearthis_id?: string;
  cover_image?: string;
  plays_count: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  event_type: string;
  is_verified: boolean;
  created_at: string;
  reviewer: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface Availability {
  date: string;
  status: 'available' | 'booked' | 'unavailable';
  note?: string;
}

// Booking Modal Component
const BookingModal = ({
  artist,
  isOpen,
  onClose
}: {
  artist: ArtistProfile;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { profile, session } = useAuthStore();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payer_name: '',
    notes: '',
    screenshot: null as File | null
  });
  const [formData, setFormData] = useState({
    event_name: '',
    event_type: '',
    event_date: '',
    event_city: '',
    event_location: '',
    budget: '',
    duration_hours: '',
    message: '',
    contact_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || '',
    contact_phone: profile?.phone || '',
    contact_email: profile?.email || '',
    equipment_needed: [] as string[],
    travel_required: false,
    special_requests: ''
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setShowPaymentStep(false);
      setBookingId(null);
      setPaymentForm({ payer_name: '', notes: '', screenshot: null });
      setFormData({
        event_name: '',
        event_type: '',
        event_date: '',
        event_city: '',
        event_location: '',
        budget: '',
        duration_hours: '',
        message: '',
        contact_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || '',
        contact_phone: profile?.phone || '',
        contact_email: profile?.email || '',
        equipment_needed: [] as string[],
        travel_required: false,
        special_requests: ''
      });
    }
  }, [isOpen, profile]);

  const handleSubmit = async () => {
    if (!session?.access_token) {
      toast.error(t('artistDetail.loginToBook'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artist_id: artist.id,
          ...formData,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          duration_hours: formData.duration_hours ? parseInt(formData.duration_hours) : null,
          event_date: formData.event_date ? new Date(formData.event_date).toISOString() : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBookingId(data.id);
        setShowPaymentStep(true);
      } else {
        const error = await response.json();
        toast.error(error.detail || t('artistDetail.failedToSendBooking'));
      }
    } catch {
      toast.error(t('artistDetail.networkError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!session?.access_token || !bookingId || !paymentForm.screenshot) {
      toast.error(t('artistDetail.pleaseUploadScreenshot'));
      return;
    }

    setIsSubmitting(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('screenshot', paymentForm.screenshot);
      formDataUpload.append('payer_name', paymentForm.payer_name || formData.contact_name || '');
      if (paymentForm.notes) formDataUpload.append('notes', paymentForm.notes);

      const res = await fetch(`${API_BASE_URL}/bookings/requests/${bookingId}/upload-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formDataUpload
      });

      if (res.ok) {
        toast.success(t('artistDetail.paymentUploaded'));
        onClose();
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.detail || t('artistDetail.paymentUploadFailed'));
      }
    } catch {
      toast.error(t('artistDetail.paymentUploadFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#111111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#111111] border-b border-white/10 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('artistDetail.book')} {artist.stage_name}</h2>
              <p className="text-gray-400 text-sm">{t('artistDetail.bookingSubtitle')}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex-1 h-2 rounded-full ${s <= step && !showPaymentStep ? 'bg-[#d3da0c]' : 'bg-white/10'
                }`} />
            ))}
          </div>

          <div className="p-6 space-y-6">
            {showPaymentStep && (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{t('artistDetail.bookingSubmitted')}</h3>
                  <p className="text-gray-400 text-sm mt-1">{t('artistDetail.completePayment')}</p>
                </div>

                <MobileQrPayment />

                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.payerName')}</label>
                    <input
                      type="text"
                      value={paymentForm.payer_name}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payer_name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('artistDetail.payerNamePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.paymentNotes')}</label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none resize-none"
                      placeholder={t('artistDetail.paymentNotesPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.uploadScreenshot')}</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPaymentForm({ ...paymentForm, screenshot: e.target.files?.[0] || null })}
                      className="w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#d3da0c] file:text-black file:font-semibold hover:file:bg-[#bbc10b]"
                    />
                    {paymentForm.screenshot && (
                      <p className="text-sm text-gray-500 mt-2">{paymentForm.screenshot.name}</p>
                    )}
                  </div>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h3 className="text-lg font-semibold text-white mb-4">{t('artistDetail.eventDetails')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.eventName')}</label>
                    <input
                      type="text"
                      value={formData.event_name}
                      onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      placeholder={t('artistDetail.eventNamePlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.eventType')}</label>
                      <select
                        value={formData.event_type}
                        onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      >
                        <option value="">{t('artistDetail.selectType')}</option>
                        <option value="club">{t('artistDetail.clubNight')}</option>
                        <option value="private_party">{t('artistDetail.privateParty')}</option>
                        <option value="wedding">{t('artistDetail.wedding')}</option>
                        <option value="corporate">{t('artistDetail.corporateEvent')}</option>
                        <option value="festival">{t('artistDetail.festival')}</option>
                        <option value="other">{t('artistDetail.other')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.eventDate')}</label>
                      <input
                        type="date"
                        value={formData.event_date}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.city')}</label>
                      <select
                        value={formData.event_city}
                        onChange={(e) => setFormData({ ...formData, event_city: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      >
                        <option value="">{t('artistDetail.selectCity')}</option>
                        {['Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Yiwu'].map(city => (
                          <option key={city} value={city.toLowerCase()}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.venueLocation')}</label>
                      <input
                        type="text"
                        value={formData.event_location}
                        onChange={(e) => setFormData({ ...formData, event_location: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                        placeholder={t('artistDetail.venuePlaceholder')}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="text-lg font-semibold text-white mb-4">{t('artistDetail.bookingDetails')}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.budget')}</label>
                      <input
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                        placeholder={t('artistDetail.budgetPlaceholder')}
                      />
                      {artist.starting_price && (
                        <p className="text-xs text-gray-500 mt-1">{t('artistDetail.startsFrom')} ¥{artist.starting_price}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.duration')}</label>
                      <select
                        value={formData.duration_hours}
                        onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      >
                        <option value="">{t('artistDetail.selectDuration')}</option>
                        <option value="1">{t('artistDetail.oneHour')}</option>
                        <option value="2">{t('artistDetail.twoHours')}</option>
                        <option value="3">{t('artistDetail.threeHours')}</option>
                        <option value="4">{t('artistDetail.fourHours')}</option>
                        <option value="5">{t('artistDetail.fivePlusHours')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.messageToArtist')}</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none resize-none"
                      placeholder={t('artistDetail.messagePlaceholder')}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="travel"
                      checked={formData.travel_required}
                      onChange={(e) => setFormData({ ...formData, travel_required: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 bg-white/5 text-[#d3da0c]"
                    />
                    <label htmlFor="travel" className="text-gray-300">{t('artistDetail.travelRequired')}</label>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h3 className="text-lg font-semibold text-white mb-4">{t('artistDetail.contactInformation')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.contactName')}</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.phone')}</label>
                      <input
                        type="tel"
                        value={formData.contact_phone}
                        onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.email')}</label>
                      <input
                        type="email"
                        value={formData.contact_email}
                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">{t('artistDetail.specialRequests')}</label>
                    <textarea
                      value={formData.special_requests}
                      onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none resize-none"
                      placeholder={t('artistDetail.specialRequestsPlaceholder')}
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-white/5 rounded-lg p-4 mt-6">
                    <h4 className="text-white font-medium mb-3">{t('artistDetail.bookingSummary')}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('artistDetail.summaryArtist')}</span>
                        <span className="text-white">{artist.stage_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('artistDetail.summaryEvent')}</span>
                        <span className="text-white">{formData.event_name || t('artistDetail.notSpecified')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('artistDetail.summaryDate')}</span>
                        <span className="text-white">{formData.event_date || t('artistDetail.notSpecified')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('artistDetail.summaryBudget')}</span>
                        <span className="text-white">{formData.budget ? `¥${formData.budget}` : t('artistDetail.notSpecified')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#111111] border-t border-white/10 p-6 flex justify-between">
            {showPaymentStep ? (
              <>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t('artistDetail.skipForNow')}
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={isSubmitting || !paymentForm.screenshot}
                  className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      {t('artistDetail.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {t('artistDetail.submitPayment')}
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {step > 1 ? (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-6 py-3 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    {t('artistDetail.back')}
                  </button>
                ) : (
                  <div />
                )}
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors"
                  >
                    {t('artistDetail.continue')}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        {t('artistDetail.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {t('artistDetail.sendBookingRequest')}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Music Player Component
const MusicPlayer = ({ tracks }: { tracks: Track[] }) => {
  const { t } = useTranslation();
  const [currentTrack, setCurrentTrack] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = (index: number) => {
    if (currentTrack === index) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentTrack(index);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  if (!tracks || tracks.length === 0) {
    return (
      <div className="bg-[#111111] rounded-2xl p-8 text-center">
        <Music className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">{t('artistDetail.noTracks')} {t('artistDetail.available')}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] rounded-2xl p-6">
      <h3 className="text-xl font-bold text-white mb-6">{t('artistDetail.musicPreview')}</h3>
      <div className="space-y-3">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${currentTrack === index ? 'bg-[#d3da0c]/10 border border-[#d3da0c]/30' : 'bg-white/5 hover:bg-white/10'
              }`}
          >
            <button
              onClick={() => handlePlay(index)}
              className="w-12 h-12 rounded-full bg-[#d3da0c] flex items-center justify-center flex-shrink-0"
            >
              {currentTrack === index && isPlaying ? (
                <Pause className="w-5 h-5 text-black" />
              ) : (
                <Play className="w-5 h-5 text-black ml-1" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{track.title}</p>
              <p className="text-gray-400 text-sm">{track.genre} • {track.duration}</p>
            </div>
            <div className="text-gray-500 text-sm">
              {track.plays_count.toLocaleString()} {t('artistDetail.plays')}
            </div>
          </div>
        ))}
      </div>
      {currentTrack !== null && tracks[currentTrack]?.audio_url && (
        <audio
          ref={audioRef}
          src={tracks[currentTrack].audio_url}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
};

// Availability Calendar Component
const AvailabilityCalendar = ({ availability }: { availability: Availability[] }) => {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const getStatusForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const avail = availability.find(a => a.date === dateStr);
    return avail?.status || 'available';
  };

  const statusColors = {
    available: 'bg-green-500',
    booked: 'bg-red-500',
    unavailable: 'bg-gray-500'
  };

  return (
    <div className="bg-[#111111] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">{t('artistDetail.availability')}</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-400">{t('artistDetail.available')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-400">{t('artistDetail.booked')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
          className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
        >
          ←
        </button>
        <span className="text-white font-medium">
          {currentDate.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : i18n.language || 'en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
          className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {[t('artistDetail.sun'), t('artistDetail.mon'), t('artistDetail.tue'), t('artistDetail.wed'), t('artistDetail.thu'), t('artistDetail.fri'), t('artistDetail.sat')].map((day, i) => (
          <div key={i} className="text-center text-gray-500 text-xs py-2">{day}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const status = getStatusForDate(day);
          return (
            <div
              key={day}
              className={`aspect-square flex items-center justify-center rounded-lg text-sm text-white relative ${status === 'available' ? 'bg-green-500/20' :
                status === 'booked' ? 'bg-red-500/20' : 'bg-white/5'
                }`}
            >
              {day}
              <div className={`absolute bottom-1 w-1 h-1 rounded-full ${statusColors[status as keyof typeof statusColors]}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main Artist Detail Page
const ArtistDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { session } = useAuthStore();
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [tracks] = useState<Track[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews' | 'gallery'>('about');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchArtistData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      // Fetch artist profile (required)
      const profileRes = await fetch(`${API_BASE_URL}/bookings/artists/${id}/profile`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setArtist(profileData);
      } else {
        // Artist not found
        setArtist(null);
        setIsLoading(false);
        return;
      }

      // Fetch reviews (optional)
      try {
        const reviewsRes = await fetch(`${API_BASE_URL}/bookings/artists/${id}/reviews`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setReviews(reviewsData);
        }
      } catch {
        console.log('Reviews not available');
      }

      // Fetch availability (optional)
      try {
        const now = new Date();
        const availRes = await fetch(
          `${API_BASE_URL}/bookings/artists/${id}/availability?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
        );
        if (availRes.ok) {
          const availData = await availRes.json();
          setAvailability(availData);
        }
      } catch {
        console.log('Availability not available');
      }
    } catch (error) {
      console.error('Error fetching artist data:', error);
      toast.error(t('artistDetail.failedToLoadProfile'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchArtistData();
  }, [fetchArtistData]);

  // Check if current user is following this artist
  useEffect(() => {
    if (!artist?.id || !session?.access_token) return;
    const checkFollow = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/social/following`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const followedArtists = data.artists || [];
          setIsFollowing(followedArtists.some((a: { id: number }) => String(a.id) === String(artist.id)));
        }
      } catch {
        // ignore
      }
    };
    checkFollow();
  }, [artist?.id, session?.access_token]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#d3da0c] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('artistDetail.artistNotFound')}</h2>
          <p className="text-gray-400 mb-4">{t('artistDetail.artistNotFoundDescription')}</p>
          <Link to="/artists" className="text-[#d3da0c] hover:underline">
            {t('artistDetail.browseAllArtists')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-24">
      {/* Hero Section */}
      <div className="relative h-[400px] md:h-[500px]">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${artist.avatar_url || '/default-artist.png'})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
        </div>

        {/* Back Button */}
        <div className="absolute top-6 left-4 md:left-8">
          <Link
            to="/artists"
            className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />{t('artistDetail.back')}</Link>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Name with Verification Badge */}
              <div className="flex items-center gap-3 mb-4">
                <h1 className="text-4xl md:text-6xl font-display text-white">
                  {artist.stage_name}
                </h1>
                {artist.verification_badge && (
                  <VerificationBadge size="lg" className="flex-shrink-0" />
                )}
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                {artist.genre_tags?.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 bg-white/10 rounded-full text-white text-sm"
                  >
                    {genre}
                  </span>
                ))}
                {artist.city && (
                  <div className="flex items-center gap-1 text-gray-300">
                    <MapPin className="w-4 h-4" />
                    {artist.city}
                  </div>
                )}
                {artist.reviews_count > 0 && (
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="w-4 h-4 fill-current" />
                    <span>{artist.rating?.toFixed(1) || '0.0'}</span>
                    <span className="text-gray-400">({artist.reviews_count} {t('artistDetail.reviews')})</span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="px-8 py-4 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors flex items-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  {t('artistDetail.bookNow')}
                </button>
                <button
                  onClick={() => toast.info(t('artistDetail.messagingComingSoon'), { description: t('artistDetail.messagingDescription') })}
                  className="px-8 py-4 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />{t('artistDetail.message')}</button>
                <button
                  onClick={async () => {
                    if (!session?.access_token) {
                      toast.info(t('artistDetail.loginToFollow') || 'Please log in to follow artists');
                      return;
                    }
                    if (!artist?.id) return;
                    setFollowLoading(true);
                    try {
                      const res = await fetch(`${API_BASE_URL}/social/artists/${artist.id}/follow`, {
                      method: isFollowing ? 'DELETE' : 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}` }
                    });
                    if (res.ok) {
                      if (isFollowing) {
                        setIsFollowing(false);
                        setArtist(prev => prev ? { ...prev, followers_count: Math.max(0, (prev.followers_count || 0) - 1) } : prev);
                        toast.success(t('artistDetail.unfollowed'));
                      } else {
                        setIsFollowing(true);
                        setArtist(prev => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : prev);
                        toast.success(t('artistDetail.followed'));
                      }
                    } else {
                      const err = await res.json().catch(() => ({}));
                      toast.error(err.detail || t('artistDetail.followFailed'));
                    }
                    } catch {
                      toast.error(t('artistDetail.followFailed'));
                    } finally {
                      setFollowLoading(false);
                    }
                  }}
                  disabled={followLoading}
                  className={`px-8 py-4 font-bold rounded-xl transition-colors flex items-center gap-2 ${
                    isFollowing
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
                  } disabled:opacity-50`}
                >
                  <Heart className={`w-5 h-5 ${isFollowing ? 'fill-current' : ''}`} />
                  {isFollowing ? t('artistDetail.following') : t('artistDetail.follow')}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-4">
              {[
                { id: 'about', label: t('artistDetail.tabAbout') },
                { id: 'reviews', label: t('artistDetail.tabReviews') },
                { id: 'gallery', label: t('artistDetail.tabGallery') }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'about' | 'reviews' | 'gallery')}
                  className={`px-6 py-2 rounded-lg font-medium capitalize transition-colors ${activeTab === tab.id
                    ? 'bg-[#d3da0c] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* About Tab */}
            {activeTab === 'about' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                {/* Bio Section */}
                <div className="bg-[#111111] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">{t('artistDetail.about')}</h3>
                  <p className="text-gray-300 leading-relaxed mb-6">
                    {artist.bio || t('artistDetail.noBio')}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {artist.years_experience > 0 && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <Briefcase className="w-6 h-6 text-[#d3da0c] mb-2" />
                        <p className="text-2xl font-bold text-white">{artist.years_experience}+</p>
                        <p className="text-gray-400 text-sm">{t('artistDetail.yearsExperience')}</p>
                      </div>
                    )}
                    {artist.languages && (
                      <div className="bg-white/5 rounded-xl p-4">
                        <Globe className="w-6 h-6 text-[#d3da0c] mb-2" />
                        <p className="text-2xl font-bold text-white">{artist.languages.length}</p>
                        <p className="text-gray-400 text-sm">{t('artistDetail.languages')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Booking Details */}
                <div className="bg-[#111111] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">{t('artistDetail.bookingDetails')}</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {artist.starting_price && (
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                        <DollarSign className="w-6 h-6 text-[#d3da0c]" />
                        <div>
                          <p className="text-gray-400 text-sm">{t('artistDetail.startingPrice')}</p>
                          <p className="text-white font-bold">¥{artist.starting_price.toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                    {artist.performance_duration && (
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                        <Clock className="w-6 h-6 text-[#d3da0c]" />
                        <div>
                          <p className="text-gray-400 text-sm">{t('artistDetail.performanceDuration')}</p>
                          <p className="text-white font-bold">{artist.performance_duration}</p>
                        </div>
                      </div>
                    )}
                    {artist.event_types && (
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                        <Award className="w-6 h-6 text-[#d3da0c]" />
                        <div>
                          <p className="text-gray-400 text-sm">{t('artistDetail.eventTypes')}</p>
                          <p className="text-white font-bold">{artist.event_types.join(', ')}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                      <MapPin className="w-6 h-6 text-[#d3da0c]" />
                      <div>
                        <p className="text-gray-400 text-sm">{t('artistDetail.travel')}</p>
                        <p className="text-white font-bold">
                          {artist.travel_availability || t('artistDetail.localOnly')}
                          {artist.travel_fee > 0 && ` (+¥${artist.travel_fee})`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Media & Music Links */}
                {(artist.spotify_url || artist.apple_music_url || artist.soundcloud_url || artist.instagram_url || artist.youtube_url) && (
                  <div className="bg-[#111111] rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">{t('artistDetail.musicAndSocial')}</h3>
                    <div className="flex flex-wrap gap-3">
                      {artist.spotify_url && (
                        <a
                          href={artist.spotify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-[#1DB954] text-white rounded-xl hover:opacity-90 transition-opacity"
                        >
                          <Music className="w-5 h-5" />
                          <span className="font-medium">{t('artistDetail.spotify')}</span>
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      )}
                      {artist.apple_music_url && (
                        <a
                          href={artist.apple_music_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-[#FA2D48] text-white rounded-xl hover:opacity-90 transition-opacity"
                        >
                          <Music className="w-5 h-5" />
                          <span className="font-medium">{t('artistDetail.appleMusic')}</span>
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      )}
                      {artist.soundcloud_url && (
                        <a
                          href={artist.soundcloud_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-[#FF5500] text-white rounded-xl hover:opacity-90 transition-opacity"
                        >
                          <Volume2 className="w-5 h-5" />
                          <span className="font-medium">{t('artistDetail.soundcloud')}</span>
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      )}
                      {artist.instagram_url && (
                        <a
                          href={artist.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl hover:opacity-90 transition-opacity"
                        >
                          <Instagram className="w-5 h-5" />
                          <span className="font-medium">{t('artistDetail.instagram')}</span>
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      )}
                      {artist.youtube_url && (
                        <a
                          href={artist.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-3 bg-[#FF0000] text-white rounded-xl hover:opacity-90 transition-opacity"
                        >
                          <Youtube className="w-5 h-5" />
                          <span className="font-medium">{t('artistDetail.youtube')}</span>
                          <ExternalLink className="w-4 h-4 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Music Preview */}
                <MusicPlayer tracks={tracks} />
              </motion.div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Rating Summary */}
                <div className="bg-[#111111] rounded-2xl p-6">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-5xl font-bold text-white">{artist.rating?.toFixed(1) || '0.0'}</p>
                      <div className="flex items-center justify-center gap-1 text-yellow-400 my-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${star <= Math.round(artist.rating || 0) ? 'fill-current' : ''}`}
                          />
                        ))}
                      </div>
                      <p className="text-gray-400">{artist.reviews_count} {t('artistDetail.reviews')}</p>
                    </div>
                    <div className="flex-1 space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = reviews.filter(r => r.rating === rating).length;
                        const percentage = artist.reviews_count > 0
                          ? (count / artist.reviews_count) * 100
                          : 0;
                        return (
                          <div key={rating} className="flex items-center gap-3">
                            <span className="text-gray-400 w-8">{rating} {t('artistDetail.stars')}</span>
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#d3da0c] rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-gray-500 w-8 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Reviews List */}
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="bg-[#111111] rounded-2xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-black font-bold">
                            {review.reviewer.first_name?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {review.reviewer.first_name} {review.reviewer.last_name}
                            </p>
                            <p className="text-gray-400 text-sm">{review.event_type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < review.rating ? 'fill-current' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-300 mb-3">{review.comment}</p>
                      <div className="flex items-center gap-4">
                        {review.is_verified && (
                          <span className="inline-flex items-center gap-1 text-[#d3da0c] text-sm">
                            <Check className="w-4 h-4" />
                            {t('artistDetail.verifiedBooking')}
                          </span>
                        )}
                        <span className="text-gray-500 text-sm">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Gallery Tab */}
            {activeTab === 'gallery' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#111111] rounded-2xl p-6"
              >
                <h3 className="text-xl font-bold text-white mb-4">{t('artistDetail.photoVideoGallery')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {tracks.filter(t => t.cover_image).map((track) => (
                    <div key={track.id} className="aspect-square rounded-xl overflow-hidden bg-white/5">
                      <img
                        src={track.cover_image}
                        alt={track.title}
                        className="w-full h-full object-cover hover:scale-110 transition-transform"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Availability Calendar */}
            <AvailabilityCalendar availability={availability} />

            {/* {t('artistDetail.quickInfo')} Card */}
            <div className="bg-[#111111] rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">{t('artistDetail.quickInfo')}</h3>
              <div className="space-y-4">
                {artist.languages && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-[#d3da0c]" />
                    <div>
                      <p className="text-gray-400 text-sm">{t('artistDetail.languages')}</p>
                      <p className="text-white">{artist.languages.join(', ')}</p>
                    </div>
                  </div>
                )}
                {artist.equipment_provided && (
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-[#d3da0c]" />
                    <div>
                      <p className="text-gray-400 text-sm">{t('artistDetail.equipment')}</p>
                      <p className="text-white">{artist.equipment_provided.join(', ')}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#d3da0c]" />
                  <div>
                    <p className="text-gray-400 text-sm">{t('artistDetail.responseTime')}</p>
                    <p className="text-white">{t('artistDetail.responseTimeValue')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Book Now Card */}
            <div className="bg-gradient-to-br from-[#d3da0c]/20 to-[#d3da0c]/5 rounded-2xl p-6 border border-[#d3da0c]/30">
              <p className="text-gray-300 mb-4">{t('artistDetail.readyToBook')}</p>
              <button
                onClick={() => setShowBookingModal(true)}
                className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#bbc10b] transition-colors"
              >{t('artistDetail.bookNow')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          artist={artist}
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
        />
      )}
    </div>
  );
};

export default ArtistDetail;
