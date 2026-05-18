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
  Heart, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import VerificationBadge from '@/components/VerificationBadge';
import MessageModal from '@/components/MessageModal';

// Types
interface ArtistProfile {
  id: number;
  user_id?: number;
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
  youtube_url?: string;
  audiomack_url?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  wechat_id?: string;
  website?: string;
  wechat_qr_url?: string;
  alipay_qr_url?: string;
  payment_instructions?: string;
  // Role-specific media
  dj_mix_url?: string;
  dj_mix_title?: string;
  dj_mix_duration?: number;
  dance_video_url?: string;
  dance_video_title?: string;
  dance_video_duration?: number;
  music_links?: { platform: string; title: string; url: string }[];
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
    event_time: '',
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
        event_time: '',
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
  const { session, profile } = useAuthStore();
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [tracks] = useState<Track[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews' | 'gallery'>('about');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [userBookings, setUserBookings] = useState<Array<{ id: number; status: string; artist_id: number; event_type?: string }>>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

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

  // Fetch current user's bookings to check for completed bookings with this artist
  const fetchUserBookings = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/requests/my`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserBookings(data || []);
      }
    } catch {
      console.log('Could not fetch user bookings');
    }
  }, [session]);

  useEffect(() => {
    fetchUserBookings();
  }, [fetchUserBookings]);

  useEffect(() => {
    fetchArtistData();
    if (id) {
      import('@/lib/analytics').then(({ Analytics }) => {
        Analytics.trackEvent('profile_view', 'engagement', { profile_type: 'artist', profile_id: id });
      });
    }
  }, [fetchArtistData, id]);

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

  // Check if user has a completed booking with this artist (for review eligibility)
  const completedBookingWithArtist = userBookings.find(
    (b) => b.status === 'completed' && String(b.artist_id) === String(artist?.id || id)
  );
  const hasAlreadyReviewed = completedBookingWithArtist
    ? reviews.some((r) => r.reviewer?.first_name && r.reviewer?.last_name && r.reviewer.first_name === profile?.first_name && r.reviewer.last_name === profile?.last_name)
    : false;

  const handleSubmitReview = async () => {
    if (!session?.access_token || !completedBookingWithArtist) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/requests/${completedBookingWithArtist.id}/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          event_type: completedBookingWithArtist.event_type || 'Event'
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t('artistDetail.reviewSubmitted') || 'Review submitted successfully');
        setShowReviewForm(false);
        setReviewForm({ rating: 5, comment: '' });
        fetchArtistData();
      } else {
        toast.error(data.detail || t('artistDetail.reviewSubmitFailed') || 'Failed to submit review');
      }
    } catch {
      toast.error(t('artistDetail.reviewSubmitFailed') || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

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
                  onClick={() => setShowMessageModal(true)}
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
                        import('@/lib/analytics').then(({ Analytics }) => {
                          Analytics.trackEvent('profile_follow', 'social', { profile_type: 'artist', profile_id: artist.id, action: 'unfollow' });
                        });
                      } else {
                        setIsFollowing(true);
                        setArtist(prev => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : prev);
                        toast.success(t('artistDetail.followed'));
                        import('@/lib/analytics').then(({ Analytics }) => {
                          Analytics.trackEvent('profile_follow', 'social', { profile_type: 'artist', profile_id: artist.id, action: 'follow' });
                        });
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

                {/* Social Media Icons */}
                {(artist.instagram || artist.twitter || artist.tiktok || artist.wechat_id || artist.website) && (
                  <div className="bg-[#111111] rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">{t('artistDetail.socialMedia') || 'Social Media'}</h3>
                    <div className="flex flex-wrap gap-3">
                      {artist.instagram && (
                        <a
                          href={artist.instagram.startsWith('http') ? artist.instagram : `https://instagram.com/${artist.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white hover:opacity-90 transition-opacity"
                          title="Instagram"
                        >
                          <Instagram className="w-5 h-5" />
                        </a>
                      )}
                      {artist.twitter && (
                        <a
                          href={artist.twitter.startsWith('http') ? artist.twitter : `https://twitter.com/${artist.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-black border border-white/20 text-white hover:bg-white/10 transition-colors"
                          title="X / Twitter"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </a>
                      )}
                      {artist.tiktok && (
                        <a
                          href={artist.tiktok.startsWith('http') ? artist.tiktok : `https://tiktok.com/@${artist.tiktok}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-black border border-[#ff0050] text-[#ff0050] hover:bg-[#ff0050]/10 transition-colors"
                          title="TikTok"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                          </svg>
                        </a>
                      )}
                      {artist.wechat_id && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#07C160]/10 border border-[#07C160]/30 text-[#07C160]">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.51 13.88a.94.94 0 01.939-.944c.519 0 .94.423.94.944a.94.94 0 01-.94.943.94.94 0 01-.94-.943zm4.963 0a.94.94 0 01.94-.944c.519 0 .939.423.939.944a.94.94 0 01-.94.943.94.94 0 01-.939-.943z" />
                          </svg>
                          <span className="text-sm font-medium">{artist.wechat_id}</span>
                        </div>
                      )}
                      {artist.website && (
                        <a
                          href={artist.website.startsWith('http') ? artist.website : `https://${artist.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                          title="Website"
                        >
                          <Globe className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Streaming & Music Links */}
                {(artist.spotify_url || artist.apple_music_url || artist.soundcloud_url || artist.youtube_url || artist.audiomack_url || artist.hearthis_url || (artist.music_links && artist.music_links.length > 0)) && (
                  <div className="bg-[#111111] rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">{t('artistDetail.musicLinks') || 'Music & Streaming'}</h3>
                    <div className="flex flex-wrap gap-3">
                      {artist.spotify_url && (
                        <a
                          href={artist.spotify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#1DB954] text-white hover:opacity-90 transition-opacity"
                          title="Spotify"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                        </a>
                      )}
                      {artist.apple_music_url && (
                        <a
                          href={artist.apple_music_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#FA2D48] text-white hover:opacity-90 transition-opacity"
                          title="Apple Music"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.206.333-1.57.457-2.74 1.39-3.272 2.997-.2.608-.302 1.242-.333 1.88-.017.343-.024.687-.024 1.031v8.16c.01.147.017.295.027.442.043.744.123 1.484.333 2.2.457 1.57 1.39 2.74 2.997 3.272.608.2 1.242.302 1.88.333.343.017.687.024 1.031.024h12.08c.147-.01.295-.017.442-.027.744-.043 1.484-.123 2.2-.333 1.57-.457 2.74-1.39 3.272-2.997.2-.608.302-1.242.333-1.88.017-.343.024-.687.024-1.031V7.24c0-.383-.007-.76-.02-1.117zM13.54 18.64c-.167.614-.653 1.057-1.245 1.18-.66.143-1.29-.143-1.69-.656-.403-.513-.52-1.19-.32-1.79.167-.53.57-.94 1.08-1.13.72-.27 1.56-.04 2.06.55.38.45.48 1.04.31 1.64l-.19.21zm.82-3.17c-.23.123-.5.15-.74.07-.49-.16-.79-.61-.74-1.12.05-.51.42-.91.92-1.01.3-.06.61.01.85.19.35.25.52.69.43 1.11-.09.41-.4.73-.81.76zM12 5.7l1.48 1.48c.1.1.1.26 0 .36l-1.48 1.48c-.1.1-.26.1-.36 0l-1.48-1.48c-.1-.1-.1-.26 0-.36l1.48-1.48c.1-.1.26-.1.36 0z"/></svg>
                        </a>
                      )}
                      {artist.soundcloud_url && (
                        <a
                          href={artist.soundcloud_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#FF5500] text-white hover:opacity-90 transition-opacity"
                          title="SoundCloud"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.21-1.319-.225-1.339c-.01-.057-.044-.094-.073-.094zm1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.105.104.061 0 .12-.044.12-.104l.24-2.474-.255-2.547c0-.06-.06-.104-.105-.104zm.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.225-2.544-.24-2.64c-.015-.075-.06-.135-.151-.135zm.93-.045c-.09 0-.149.075-.165.165l-.18 2.7.195 2.52c.016.09.075.165.165.165.09 0 .165-.075.165-.165l.21-2.52-.21-2.7c0-.09-.075-.165-.18-.165zm.915-.06c-.105 0-.18.09-.195.18l-.165 2.76.18 2.49c.016.105.09.18.195.18.105 0 .18-.09.18-.18l.195-2.49-.195-2.76c-.016-.105-.09-.18-.195-.18zm.93-.015c-.12 0-.195.105-.21.21l-.15 2.79.165 2.475c.016.105.09.195.21.195.105 0 .195-.09.21-.195l.18-2.475-.18-2.79c-.015-.12-.09-.21-.225-.21zm.945-.015c-.135 0-.225.12-.24.24l-.135 2.82.15 2.46c.015.12.105.225.24.225.12 0 .225-.105.24-.225l.165-2.46-.165-2.82c-.015-.135-.105-.24-.255-.24zm.96 0c-.15 0-.24.135-.255.27l-.12 2.805.135 2.445c.015.135.105.255.255.255.135 0 .24-.12.255-.255l.15-2.445-.15-2.805c-.015-.15-.12-.27-.27-.27zm.93.03c-.15 0-.27.15-.285.285l-.105 2.79.12 2.43c.015.15.135.285.285.285.15 0 .27-.135.285-.285l.135-2.43-.135-2.79c-.015-.165-.12-.3-.3-.3zm.96.045c-.165 0-.3.165-.315.33l-.09 2.76.105 2.415c.015.165.15.315.315.315.165 0 .3-.165.315-.315l.12-2.415-.12-2.76c-.015-.18-.15-.33-.33-.33zm.945.075c-.18 0-.33.18-.345.36l-.075 2.715.09 2.385c.015.18.165.345.345.345.18 0 .33-.165.345-.345l.105-2.385-.105-2.715c-.015-.195-.165-.36-.36-.36zm.96.09c-.195 0-.36.195-.375.39l-.06 2.685.075 2.37c.015.195.18.375.375.375.195 0 .36-.18.375-.375l.09-2.37-.09-2.685c-.015-.21-.18-.39-.39-.39zm1.02.12c-.21 0-.39.21-.405.42l-.045 2.64.06 2.34c.015.21.195.405.405.405.21 0 .39-.195.405-.405l.075-2.34-.075-2.64c-.015-.225-.195-.42-.42-.42zm1.005.15c-.225 0-.42.225-.435.45l-.03 2.595.045 2.31c.015.225.21.435.435.435.225 0 .42-.21.435-.435l.06-2.31-.06-2.595c-.015-.24-.21-.45-.45-.45zm1.02.165c-.24 0-.45.24-.465.48l-.015 2.55.03 2.28c.015.24.225.465.465.465.24 0 .45-.225.465-.465l.045-2.28-.045-2.55c-.015-.255-.225-.48-.48-.48zm1.005.195c-.255 0-.48.255-.495.51l.015 2.505.015 2.25c.015.255.24.495.495.495s.48-.24.495-.495l.03-2.25-.03-2.505c-.015-.27-.24-.51-.525-.51zm1.005.21c-.27 0-.51.27-.525.54l.045 2.46.045 2.22c.015.27.255.51.525.51.27 0 .51-.24.525-.51l.06-2.22-.06-2.46c-.015-.285-.255-.54-.615-.54zm1.02.225c-.285 0-.54.285-.555.57l.075 2.415.075 2.19c.015.285.27.54.555.54.285 0 .54-.255.555-.54l.09-2.19-.09-2.415c-.015-.3-.27-.57-.705-.57zm1.005.255c-.3 0-.57.3-.585.6l.105 2.37.105 2.16c.015.3.285.57.585.57.3 0 .57-.27.585-.57l.12-2.16-.12-2.37c-.015-.315-.285-.6-.795-.6zm1.02.27c-.315 0-.6.315-.615.63l.135 2.325.135 2.13c.015.315.3.6.615.6.315 0 .6-.285.615-.6l.15-2.13-.15-2.325c-.015-.33-.3-.63-.885-.63z"/></svg>
                        </a>
                      )}
                      {artist.youtube_url && (
                        <a
                          href={artist.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#FF0000] text-white hover:opacity-90 transition-opacity"
                          title="YouTube"
                        >
                          <Youtube className="w-5 h-5" />
                        </a>
                      )}
                      {artist.audiomack_url && (
                        <a
                          href={artist.audiomack_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#FF8200] text-white hover:opacity-90 transition-opacity"
                          title="Audiomack"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97-.001c-.156 0-.313.127-.344.283l-.63 3.572-1.55-3.855c-.062-.156-.22-.283-.375-.283h-.031c-.157 0-.314.127-.376.283l-.783 3.855-.471-3.572c-.031-.156-.188-.283-.344-.283h-2.258c-.156 0-.282.127-.282.283 0 .031 0 .063.016.094l1.224 8.382c.031.156.188.283.344.283h1.85c.156 0 .313-.127.375-.283l.97-4.178 1.177 4.178c.062.156.219.283.375.283h1.881c.156 0 .313-.127.344-.283l1.224-8.382c.016-.031.016-.063.016-.094.016-.156-.11-.283-.266-.283z"/></svg>
                        </a>
                      )}
                      {artist.hearthis_url && (
                        <a
                          href={artist.hearthis_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#E94E1B] text-white hover:opacity-90 transition-opacity"
                          title="HearThis.at"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2V7h2v10zm4 0h-2V7h2v10z"/></svg>
                        </a>
                      )}
                      {artist.music_links?.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#d3da0c] text-black hover:opacity-90 transition-opacity"
                          title={link.title || link.platform}
                        >
                          <Music className="w-5 h-5" />
                        </a>
                      ))}
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

                {/* Write a Review */}
                {completedBookingWithArtist && !hasAlreadyReviewed && !showReviewForm && (
                  <div className="bg-[#111111] rounded-2xl p-6 border border-[#d3da0c]/20">
                    <p className="text-white font-medium mb-2">{t('artistDetail.leaveReview') || 'You booked this artist'}</p>
                    <p className="text-gray-400 text-sm mb-4">{t('artistDetail.shareExperience') || 'Share your experience by leaving a review.'}</p>
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="px-6 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors"
                    >
                      {t('artistDetail.writeReview') || 'Write a Review'}
                    </button>
                  </div>
                )}

                {showReviewForm && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#111111] rounded-2xl p-6 border border-white/10"
                  >
                    <h3 className="text-lg font-bold text-white mb-4">{t('artistDetail.writeReview') || 'Write a Review'}</h3>
                    <div className="flex items-center gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-8 h-8 ${
                              star <= reviewForm.rating
                                ? 'text-[#d3da0c] fill-[#d3da0c]'
                                : 'text-gray-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                      placeholder={t('artistDetail.reviewPlaceholder') || 'Tell others about your experience...'}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-[#d3da0c] min-h-[100px] resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview}
                        className="px-6 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {t('common.submit') || 'Submit'}
                      </button>
                      <button
                        onClick={() => { setShowReviewForm(false); setReviewForm({ rating: 5, comment: '' }); }}
                        className="px-6 py-2.5 bg-white/5 text-white text-sm font-bold rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {t('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </motion.div>
                )}

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

      {/* Message Modal */}
      {showMessageModal && (
        <MessageModal
          recipientId={artist.user_id || artist.id}
          recipientName={artist.stage_name}
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
        />
      )}
    </div>
  );
};

export default ArtistDetail;
