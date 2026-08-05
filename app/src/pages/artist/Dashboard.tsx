import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore, BookingStatus } from '@/store/bookingStore';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  Music, Calendar, Users, Star, TrendingUp, Edit, Camera, Check,
  X as CloseIcon, Clock, Loader2, Instagram, Twitter,
  DollarSign, Headphones,
  Disc3, ExternalLink, Phone, MessageCircle, Upload, QrCode, Shield,
  CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  SpotifyIcon,
  AppleMusicIcon,
  SoundCloudIcon,
  AudiomackIcon,
  HearThisIcon,
  YouTubeIcon,
} from '@/components/ui/MusicPlatformIcons';

// API Base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ArtistDashboard = () => {
  const { t } = useTranslation();
  const { profile, artistProfile, session, updateProfile } = useAuthStore();
  const { incomingBookings, fetchIncomingBookings, updateBookingStatus, isLoading: isBookingsLoading, availability, fetchAvailability, setAvailability, deleteAvailability } = useBookingStore();
  const { stats: dashboardStats, fetchStats } = useDashboardStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isApplyingVerification, setIsApplyingVerification] = useState(false);

  // Profile form state - synced with backend data
  const [profileForm, setProfileForm] = useState({
    stage_name: '',
    artist_type: 'Artist',
    genres: '',
    bio: '',
    instagram: '',
    twitter: '',
    wechat: '',
    phone: '',
    spotify_url: '',
    apple_music_url: '',
    soundcloud_url: '',
    hearthis_url: '',
    youtube_url: '',
    audiomack_url: '',
    music_links: [] as { platform: string; title: string; url: string }[]
  });

  // Booking filter state
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'completed'>('all');

  // Availability calendar state
  const [availMonth, setAvailMonth] = useState(new Date());
  const [selectedAvailDate, setSelectedAvailDate] = useState<string | null>(null);
  const [selectedAvailStatus, setSelectedAvailStatus] = useState<'available' | 'booked' | 'unavailable'>('available');
  const [isSavingAvail, setIsSavingAvail] = useState(false);


  // Fetch fresh profile data on mount - syncs with backend
  const hasRefreshedOnMount = useRef(false);
  useEffect(() => {
    if (session?.access_token && !hasRefreshedOnMount.current) {
      hasRefreshedOnMount.current = true;
      useAuthStore.getState().refreshSession().catch(err => console.error('Failed to refresh session:', err));
    }
  }, [session]);

  // Update form when profile data changes from backend
  useEffect(() => {
    if (artistProfile || profile) {
      setProfileForm({
        stage_name: artistProfile?.stage_name || profile?.first_name || '',
        artist_type: (artistProfile?.artist_type as string) || 'Artist',
        genres: artistProfile?.genres?.join(', ') || '',
        bio: artistProfile?.bio || profile?.bio || '',
        instagram: profile?.instagram || '',
        twitter: profile?.twitter || '',
        wechat: profile?.wechat_id || '',
        phone: profile?.phone || '',
        spotify_url: artistProfile?.spotify_url || '',
        apple_music_url: artistProfile?.apple_music_url || '',
        soundcloud_url: artistProfile?.soundcloud_url || '',
        hearthis_url: artistProfile?.hearthis_url || '',
        youtube_url: artistProfile?.youtube_url || '',
        audiomack_url: artistProfile?.audiomack_url || '',
        music_links: artistProfile?.music_links || []
      });
    }
  }, [artistProfile, profile]);

  // Fetch dashboard data from real API endpoints
  useEffect(() => {
    if (session?.access_token) {
      fetchStats(session.access_token);
      // Only fetch bookings if user has an artist profile
      if (artistProfile?.id) {
        fetchIncomingBookings(session.access_token);
      }
    }
  }, [session, fetchStats, fetchIncomingBookings, artistProfile]);

  // Fetch availability calendar data
  useEffect(() => {
    if (session?.access_token && artistProfile?.id && activeTab === 'availability') {
      fetchAvailability(session.access_token, Number(artistProfile.id), availMonth.getMonth() + 1, availMonth.getFullYear());
    }
  }, [session, artistProfile, activeTab, availMonth, fetchAvailability]);

  const handleStatusUpdate = async (id: number, status: BookingStatus) => {
    if (session?.access_token) {
      const success = await updateBookingStatus(session.access_token, id, status);
      if (success) {
        toast.success(t('artist.dashboard.bookingUpdated', { status }));
      }
    }
  };

  // Availability calendar helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const formatDateStr = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getAvailabilityForDate = (dateStr: string) =>
    availability.find(a => a.date === dateStr);

  const handleDateClick = (day: number) => {
    const dateStr = formatDateStr(availMonth.getFullYear(), availMonth.getMonth(), day);
    const existing = getAvailabilityForDate(dateStr);
    setSelectedAvailDate(dateStr);
    setSelectedAvailStatus(existing?.status || 'available');
  };

  const handleSaveAvailability = async () => {
    if (!session?.access_token || !selectedAvailDate) return;
    setIsSavingAvail(true);
    const success = await setAvailability(session.access_token, selectedAvailDate, selectedAvailStatus);
    if (success) {
      toast.success(t('artist.dashboard.availabilitySaved') || 'Availability updated');
      if (artistProfile?.id) {
        await fetchAvailability(session.access_token, Number(artistProfile.id), availMonth.getMonth() + 1, availMonth.getFullYear());
      }
      setSelectedAvailDate(null);
    } else {
      toast.error(t('artist.dashboard.availabilitySaveFailed') || 'Failed to update availability');
    }
    setIsSavingAvail(false);
  };

  const handleClearAvailability = async () => {
    if (!session?.access_token || !selectedAvailDate) return;
    const existing = getAvailabilityForDate(selectedAvailDate);
    if (existing?.id) {
      setIsSavingAvail(true);
      const success = await deleteAvailability(session.access_token, existing.id);
      if (success) {
        toast.success(t('artist.dashboard.availabilityCleared') || 'Availability cleared');
        if (artistProfile?.id) {
          await fetchAvailability(session.access_token, Number(artistProfile.id), availMonth.getMonth() + 1, availMonth.getFullYear());
        }
        setSelectedAvailDate(null);
      } else {
        toast.error(t('artist.dashboard.availabilityClearFailed') || 'Failed to clear availability');
      }
      setIsSavingAvail(false);
    } else {
      setSelectedAvailDate(null);
    }
  };

  const handleProfileChange = (field: string, value: string) => {
    // Enforce 500 character limit for bio field
    if (field === 'bio' && value.length > 500) {
      return; // Don't update if over limit
    }
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  // Calculate bio character count
  const getBioCharCount = () => {
    return profileForm.bio.length;
  };

  // Save profile to backend API
  const handleSaveProfile = async () => {
    if (!session?.access_token) {
      toast.error(t('artist.dashboard.notAuthenticated'));
      return;
    }

    setIsSaving(true);

    try {
      // Update user profile (bio, social links, contact info)
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bio: profileForm.bio,
          instagram: profileForm.instagram,
          twitter: profileForm.twitter,
          wechat_id: profileForm.wechat,
          phone: profileForm.phone
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `User profile update failed (${userResponse.status})`);
      }

      // Update artist profile via dedicated artist/profile endpoint
      if (artistProfile?.id) {
        // For existing artist profile - update via PUT endpoint
        const artistResponse = await fetch(`${API_BASE_URL}/artist/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stage_name: profileForm.stage_name,
            artist_type: profileForm.artist_type,
            genres: profileForm.genres.split(',').map(g => g.trim()).filter(Boolean),
            bio: profileForm.bio,
            spotify_url: profileForm.spotify_url,
            apple_music_url: profileForm.apple_music_url,
            soundcloud_url: profileForm.soundcloud_url,
            hearthis_url: profileForm.hearthis_url,
            youtube_url: profileForm.youtube_url,
            audiomack_url: profileForm.audiomack_url,
            music_links: profileForm.music_links
          })
        });

        if (!artistResponse.ok) {
          const errorData = await artistResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || `Artist profile update failed (${artistResponse.status})`);
        }
      } else {
        // Create new artist profile
        const artistResponse = await fetch(`${API_BASE_URL}/artist/profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stage_name: profileForm.stage_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('artist.dashboard.newArtist'),
            artist_type: profileForm.artist_type,
            genres: profileForm.genres.split(',').map(g => g.trim()).filter(Boolean),
            bio: profileForm.bio,
            spotify_url: profileForm.spotify_url,
            apple_music_url: profileForm.apple_music_url,
            soundcloud_url: profileForm.soundcloud_url,
            hearthis_url: profileForm.hearthis_url,
            youtube_url: profileForm.youtube_url,
            audiomack_url: profileForm.audiomack_url,
            music_links: profileForm.music_links
          })
        });

        if (!artistResponse.ok) {
          const errorData = await artistResponse.json().catch(() => ({}));
          throw new Error(errorData.detail || `Artist profile creation failed (${artistResponse.status})`);
        }

        // Refresh session so auth store picks up the new artist profile
        await useAuthStore.getState().refreshSession();
      }
      
      // Also update wechat_id and phone in user profile if the API supports it
      try {
        await fetch(`${API_BASE_URL}/auth/me`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            wechat_id: profileForm.wechat || undefined,
            phone: profileForm.phone || undefined
          })
        });
      } catch {
        // Non-critical error, don't fail the whole update
        console.warn('Could not update wechat_id/phone in user profile');
      }

      // Refresh profile data from backend properly via store
      await useAuthStore.getState().refreshSession();
      await useAuthStore.getState().fetchArtistProfile();

      toast.success(t('artist.dashboard.profileUpdated'));
    } catch (error: any) {
      console.error('Profile update error:', error);
      const message = error?.message || t('artist.dashboard.saveProfileFailed');
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Upload DJ Mix
  const [isUploadingMix, setIsUploadingMix] = useState(false);
  const handleDjMixUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('artist.dashboard.mixTooLarge'));
      return;
    }
    setIsUploadingMix(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      const res = await fetch(`${API_BASE_URL}/artist/upload-dj-mix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      await useAuthStore.getState().fetchArtistProfile();
      toast.success(t('artist.dashboard.mixUploaded'));
    } catch (err: any) {
      toast.error(err.message || t('artist.dashboard.mixUploadFailed'));
    } finally {
      setIsUploadingMix(false);
    }
  };

  // Upload Dance Video
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const handleDanceVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;
    if (file.size > 30 * 1024 * 1024) {
      toast.error(t('artist.dashboard.videoTooLarge'));
      return;
    }
    setIsUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      const res = await fetch(`${API_BASE_URL}/artist/upload-dance-video`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      await useAuthStore.getState().fetchArtistProfile();
      toast.success(t('artist.dashboard.videoUploaded'));
    } catch (err: any) {
      toast.error(err.message || t('artist.dashboard.videoUploadFailed'));
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Handle avatar upload using media upload endpoint
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('artist.dashboard.invalidImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error(t('artist.dashboard.imageTooLarge'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use media upload endpoint
      const uploadResponse = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadData = await uploadResponse.json();
      const avatarUrl = uploadData.url;

      // Update user profile with new avatar URL via auth store (properly maps backend response)
      await updateProfile({ avatar_url: avatarUrl });

      toast.success(t('artist.dashboard.avatarUpdated'));
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(t('artist.dashboard.avatarUploadFailed'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Get platform icon/color for music links
  const getPlatformInfo = (url: string) => {
    if (!url) return null;
    if (url.includes('soundcloud.com')) return { 
      name: 'SoundCloud', 
      color: 'text-orange-500', 
      bg: 'bg-orange-500/20',
      iconSvg: <SoundCloudIcon className="w-6 h-6 text-[#FF5500]" />
    };
    if (url.includes('audiomack.com')) return { 
      name: 'Audiomack', 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/20',
      iconSvg: <AudiomackIcon className="w-6 h-6 text-[#FFA200]" />
    };
    if (url.includes('spotify.com')) return { 
      name: 'Spotify', 
      color: 'text-green-500', 
      bg: 'bg-green-500/20',
      iconSvg: <SpotifyIcon className="w-6 h-6 text-[#1DB954]" />
    };
    if (url.includes('youtube.com') || url.includes('youtu.be')) return { 
      name: 'YouTube', 
      color: 'text-red-500', 
      bg: 'bg-red-500/20',
      iconSvg: <YouTubeIcon className="w-6 h-6 text-[#FF0000]" />
    };
    if (url.includes('apple.com') || url.includes('music.apple')) return { 
      name: 'Apple Music', 
      color: 'text-pink-500', 
      bg: 'bg-pink-500/20',
      iconSvg: <AppleMusicIcon className="w-6 h-6 text-[#FA2D48]" />
    };
    if (url.includes('hearthis.at')) return { 
      name: 'HearThis', 
      color: 'text-orange-600', 
      bg: 'bg-orange-600/20',
      iconSvg: <HearThisIcon className="w-6 h-6 text-[#E94E1B]" />
    };
    return { name: t('artist.dashboard.music'), color: 'text-[#d3da0c]', bg: 'bg-[#d3da0c]/20', iconSvg: <Music className="w-6 h-6" /> };
  };

  interface Booking {
    id: number;
    status: string;
    event_name: string;
    proposed_date?: string;
    event_date?: string;
    duration?: number;
    budget?: number;
    contact_name?: string;
    message?: string;
    agreed_price?: number;
  }

  // Calculate stats from backend data
  const artistStats = dashboardStats?.artist_stats;
  const stats = {
    followers: artistStats?.followers || artistProfile?.follower_count || 0,
    totalBookings: artistStats?.total_gigs || incomingBookings.length || 0,
    pendingBookings: incomingBookings.filter((b: Booking) => b.status === 'pending').length,
    totalRevenue: artistStats?.earnings || 0,
    rating: artistProfile?.rating || 0
  };

  // Filtered bookings
  const filteredBookings = incomingBookings.filter((b: Booking) => {
    if (bookingFilter === 'all') return true;
    return b.status === bookingFilter;
  });

  // Music platform links from artist profile
  const musicLinks = [
    { url: artistProfile?.spotify_url || profileForm.spotify_url, key: 'spotify' },
    { url: artistProfile?.apple_music_url || profileForm.apple_music_url, key: 'apple_music' },
    { url: artistProfile?.soundcloud_url || profileForm.soundcloud_url, key: 'soundcloud' },
    { url: artistProfile?.hearthis_url || profileForm.hearthis_url, key: 'hearthis' },
    { url: artistProfile?.youtube_url || profileForm.youtube_url, key: 'youtube' },
    { url: artistProfile?.audiomack_url || profileForm.audiomack_url, key: 'audiomack' },
  ].filter(link => link.url);

  // Get display name - prioritize stage_name, then first_name + last_name
  const getDisplayName = () => {
    if (artistProfile?.stage_name) {
      return artistProfile.stage_name;
    }
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return t('artist.dashboard.defaultArtistName');
  };

  // Get avatar URL with fallback
  const getAvatarUrl = () => {
    if (profile?.avatar_url) {
      // Ensure the URL is absolute
      if (profile.avatar_url.startsWith('http')) {
        return profile.avatar_url;
      }
      // If relative URL, prepend the API base URL
      return `${API_BASE_URL.replace('/api/v1', '')}${profile.avatar_url}`;
    }
    return '/default-artist.png';
  };

  const tabs = [
    { id: 'overview', label: t('artist.dashboard.tab.overview'), icon: TrendingUp },
    { id: 'profile', label: t('artist.dashboard.tab.profile'), icon: Edit },
    { id: 'bookings', label: t('artist.dashboard.tab.bookings'), icon: Calendar },
    { id: 'availability', label: t('artist.dashboard.tab.availability') || 'Availability', icon: CalendarDays },
    { id: 'music', label: t('artist.dashboard.tab.music'), icon: Headphones },
  ];

  if (!session?.access_token) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="text-center">
          <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('artist.dashboard.pleaseLogIn')}</h2>
          <p className="text-gray-400">{t('artist.dashboard.logInDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24 lg:pb-10">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        {/* Lime glow orb */}
        <div className="absolute top-0 left-1/4 w-64 h-32 bg-[#d3da0c]/[0.06] rounded-full blur-3xl pointer-events-none" />
        {/* safe-area-pt covers phone notch/status bar; lg:pt-8 for desktop */}
        <div className="px-4 pt-20 pb-5 safe-area-pt lg:px-10 lg:pt-8 border-b border-white/[0.06]">
          <div className="flex items-start gap-4 lg:gap-6">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl overflow-hidden ring-2 ring-[#d3da0c]/20 group-hover:ring-[#d3da0c]/40 transition-all shadow-2xl">
                <img src={getAvatarUrl()} alt={getDisplayName()}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/default-artist.png'; }} />
              </div>
              <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 lg:w-8 lg:h-8 bg-[#d3da0c] rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#bbc10b] transition-all shadow-lg">
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={isUploadingAvatar} />
                {isUploadingAvatar ? <Loader2 className="w-3 h-3 lg:w-3.5 lg:h-3.5 animate-spin text-black" /> : <Camera className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-black" />}
              </label>
            </div>

            {/* Name & Info */}
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-white lg:text-3xl tracking-tight truncate">{getDisplayName()}</h1>
                {(profile?.is_verified || artistProfile?.is_verified) ? (
                  <div className="w-5 h-5 lg:w-6 lg:h-6 bg-[#d3da0c] rounded-full flex items-center justify-center flex-shrink-0" title={t('artist.dashboard.verified')}>
                    <Check className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-black font-black" />
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setIsApplyingVerification(true);
                      try {
                        const token = session?.access_token;
                        const res = await fetch(`${API_BASE_URL}/verification/apply`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ request_type: 'artist' })
                        });
                        if (res.ok) {
                          toast.success(t('artist.dashboard.verificationApplied'));
                        } else {
                          const err = await res.json();
                          toast.error(err.detail || t('artist.dashboard.verificationApplyFailed'));
                        }
                      } catch {
                        toast.error(t('artist.dashboard.verificationApplyFailed'));
                      } finally {
                        setIsApplyingVerification(false);
                      }
                    }}
                    disabled={isApplyingVerification}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white/10 hover:bg-[#d3da0c]/20 border border-white/10 hover:border-[#d3da0c]/40 rounded-full text-[10px] lg:text-xs text-gray-300 hover:text-[#d3da0c] transition-colors disabled:opacity-50"
                  >
                    {isApplyingVerification ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Shield className="w-3 h-3" />
                    )}
                    {t('artist.dashboard.applyForVerification')}
                  </button>
                )}
              </div>
              {(() => {
                const type = artistProfile?.artist_type || profileForm.artist_type;
                const showType = type && type !== 'Artist';
                const showGenres = artistProfile?.genres?.length > 0;
                if (!showType && !showGenres) return null;
                return (
                  <p className="text-[#d3da0c] text-xs font-semibold tracking-wide truncate lg:text-sm">
                    {showType ? type : ''}{showType && showGenres ? ' · ' : ''}{showGenres ? artistProfile.genres.join(' · ') : ''}
                  </p>
                );
              })()}
              <div className="flex items-center gap-2 mt-2">
                {(profile?.instagram || profileForm.instagram) && (
                  <a href={(profile?.instagram || profileForm.instagram).startsWith('http') ? (profile?.instagram || profileForm.instagram) : `https://instagram.com/${profile?.instagram || profileForm.instagram}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-7 h-7 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg flex items-center justify-center text-gray-400 hover:text-[#d3da0c] transition-all">
                    <Instagram className="w-3.5 h-3.5" />
                  </a>
                )}
                {(profile?.twitter || profileForm.twitter) && (
                  <a href={(profile?.twitter || profileForm.twitter).startsWith('http') ? (profile?.twitter || profileForm.twitter) : `https://twitter.com/${profile?.twitter || profileForm.twitter}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-7 h-7 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg flex items-center justify-center text-gray-400 hover:text-[#d3da0c] transition-all">
                    <Twitter className="w-3.5 h-3.5" />
                  </a>
                )}
                {(profile?.phone || profileForm.phone) && (
                  <a href={`tel:${profile?.phone || profileForm.phone}`}
                    className="w-7 h-7 bg-white/[0.06] hover:bg-white/[0.12] rounded-lg flex items-center justify-center text-gray-400 hover:text-[#d3da0c] transition-all">
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div className="flex-shrink-0 pt-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/[0.08] border border-green-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{t('artist.dashboard.activePartner')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="px-4 pt-4 lg:px-10 lg:pt-5">
        {/* Horizontally scrollable on mobile — full labels always shown */}
        <div className="flex gap-1.5 overflow-x-auto bg-[#111111] p-1.5 rounded-xl border border-white/[0.06] hide-scrollbar">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 lg:px-5 lg:text-sm ${
                activeTab === tab.id
                  ? 'bg-[#d3da0c] text-black shadow-[0_0_20px_rgba(211,218,12,0.15)]'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.05]'
              }`}>
              <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>


      {/* Main Content Area */}
      <div className="px-4 pt-4 pb-4 lg:px-10 lg:pt-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="bg-[#111111] border border-white/[0.07] rounded-2xl p-4 min-h-[400px] lg:rounded-2xl lg:p-6 lg:min-h-[500px]"
        >
          {activeTab === 'overview' && (
            <div className="grid gap-5">
              {/* ── Bento Stats ── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Featured — Earnings: full width on mobile, 2-col on lg */}
                <div className="col-span-2">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-[#d3da0c]/[0.07] border border-[#d3da0c]/20 rounded-2xl p-4 flex items-center gap-4 hover:border-[#d3da0c]/35 transition-all lg:p-5">
                    <div className="p-3 bg-[#d3da0c]/15 rounded-xl flex-shrink-0">
                      <DollarSign className="w-5 h-5 text-[#d3da0c]" />
                    </div>
                    <div>
                      <p className="text-[#d3da0c]/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">{t('artist.dashboard.stat.earnings')}</p>
                      <p className="text-2xl font-bold text-white lg:text-3xl">¥{stats.totalRevenue.toLocaleString()}</p>
                    </div>
                  </motion.div>
                </div>
                {[
                  { label: t('artist.dashboard.stat.followers'), value: stats.followers.toLocaleString(), icon: Users },
                  { label: t('artist.dashboard.stat.avgRating'), value: stats.rating > 0 ? stats.rating.toFixed(1) : '–', icon: Star },
                  { label: t('artist.dashboard.stat.totalGigs'), value: stats.totalBookings.toString(), icon: Calendar },
                  { label: 'Pending', value: stats.pendingBookings.toString(), icon: Clock },
                ].map((stat, idx) => (
                  <div key={idx} className="col-span-1">
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (idx + 1) }}
                      className="h-full bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3.5 flex flex-col gap-3 hover:border-[#d3da0c]/25 transition-all group lg:p-4">
                      <div className="p-2 bg-white/[0.05] rounded-xl w-fit group-hover:bg-[#d3da0c]/10 transition-colors">
                        <stat.icon className="w-4 h-4 text-gray-400 group-hover:text-[#d3da0c] transition-colors" />
                      </div>
                      <div>
                        <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-0.5">{stat.label}</p>
                        <p className="text-xl font-bold text-white lg:text-2xl">{stat.value}</p>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </div>


              {/* Content Split */}
              <div className="grid gap-4">
                {/* Upcoming Performances */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black text-white lg:text-xl">{t('artist.dashboard.upcomingPerformances')}</h2>
                    <button onClick={() => setActiveTab('bookings')} className="text-[#d3da0c] text-xs font-bold hover:underline">{t('artist.dashboard.manageAll')}</button>
                  </div>
                  <div className="space-y-2.5">
                    {incomingBookings.filter((b: Booking) => b.status === 'accepted').slice(0, 3).map((booking) => (
                      <div key={booking.id} className="bg-white/[0.04] border border-white/[0.06] p-3.5 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 bg-[#d3da0c]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Music className="w-4 h-4 text-[#d3da0c]" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-white font-bold text-sm truncate">{booking.event_name}</h4>
                            <p className="text-gray-400 text-[11px] truncate">
                              {new Date(booking.proposed_date || booking.event_date).toLocaleDateString()}
                              {booking.duration && ` · ${booking.duration}h`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white font-bold text-sm">¥{(booking.budget || 0).toLocaleString()}</p>
                          <span className="text-green-500 text-[10px] font-bold uppercase">{t('artist.dashboard.status.confirmed')}</span>
                        </div>
                      </div>
                    ))}
                    {incomingBookings.filter((b: Booking) => b.status === 'accepted').length === 0 && (
                      <div className="py-10 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                        <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 font-bold text-sm">{t('artist.dashboard.noConfirmedGigs')}</p>
                        <button onClick={() => setActiveTab('bookings')} className="text-[#d3da0c] text-xs mt-2 hover:underline">
                          {t('artist.dashboard.checkBookings')}
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Quick Actions */}
                <section>
                  <h2 className="text-lg font-black text-white mb-3 lg:text-xl">{t('artist.dashboard.quickActions')}</h2>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setActiveTab('profile')}
                      className="w-full bg-white/[0.04] p-4 rounded-2xl border border-white/[0.06] hover:border-[#d3da0c]/30 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#d3da0c]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Edit className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-white font-bold text-sm">{t('artist.dashboard.updateProfile')}</h4>
                          <p className="text-gray-500 text-[11px] line-clamp-1">{t('artist.dashboard.updateProfileDesc')}</p>
                        </div>
                      </div>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setActiveTab('music')}
                      className="w-full bg-white/[0.04] p-4 rounded-2xl border border-white/[0.06] hover:border-purple-500/30 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Disc3 className="w-5 h-5 text-purple-500" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-white font-bold text-sm">{t('artist.dashboard.manageMusicLinks')}</h4>
                          <p className="text-gray-500 text-[11px] line-clamp-1">{t('artist.dashboard.manageMusicLinksDesc')}</p>
                        </div>
                      </div>
                    </motion.button>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-4xl">
              <h2 className="text-lg font-bold text-white mb-3 lg:text-2xl">{t('artist.dashboard.editProfileTitle')}</h2>
              <p className="text-gray-400 mb-10">{t('artist.dashboard.editProfileSubtitle')}</p>

              <div className="grid gap-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.stageName')}</label>
                    <input
                      type="text"
                      value={profileForm.stage_name}
                      onChange={(e) => handleProfileChange('stage_name', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.stageName')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.artistType')}</label>
                    <select
                      value={profileForm.artist_type}
                      onChange={(e) => handleProfileChange('artist_type', e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all cursor-pointer"
                    >
                      <option value="Artist">{t('artist.dashboard.artistType.artist')}</option>
                      <option value="DJ">{t('artist.dashboard.artistType.dj')}</option>
                      <option value="MC">{t('artist.dashboard.artistType.mc')}</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.genres')}</label>
                    <input
                      type="text"
                      value={profileForm.genres}
                      onChange={(e) => handleProfileChange('genres', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.genres')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs">{t('artist.dashboard.label.biography')}</label>
                    <span className={`text-xs font-bold ${getBioCharCount() >= 450 ? 'text-yellow-500' : 'text-gray-500'}`}>
                      {t('artist.dashboard.charCount', { count: getBioCharCount() })}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={profileForm.bio}
                    onChange={(e) => handleProfileChange('bio', e.target.value)}
                    placeholder={t('artist.dashboard.placeholder.bio')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold resize-none"
                    maxLength={500}
                  />
                  {getBioCharCount() >= 500 && (
                    <p className="text-yellow-500 text-xs font-bold">{t('artist.dashboard.maxCharReached')}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.instagram')}</label>
                    <input
                      type="text"
                      value={profileForm.instagram}
                      onChange={(e) => handleProfileChange('instagram', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.instagram')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.twitter')}</label>
                    <input
                      type="text"
                      value={profileForm.twitter}
                      onChange={(e) => handleProfileChange('twitter', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.twitter')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.wechat')}</label>
                    <input
                      type="text"
                      value={profileForm.wechat}
                      onChange={(e) => handleProfileChange('wechat', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.wechat')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('artist.dashboard.label.phone')}</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.phone')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#d3da0c] outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl lg:w-fit lg:px-10 lg:py-3.5 lg:rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(211, 218, 12,0.3)] mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('artist.dashboard.saving')}
                    </>
                  ) : (
                    t('artist.dashboard.saveChanges')
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'music' && (
            <div className="max-w-4xl">
              <h2 className="text-lg font-bold text-white mb-3 lg:text-2xl">{t('artist.dashboard.musicTitle')}</h2>
              <p className="text-gray-400 mb-10">{t('artist.dashboard.musicSubtitle')}</p>

              <div className="grid gap-8">
                {/* Music Platform Links */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-white">{t('artist.dashboard.yourMusicLinks')}</h3>

                  <div className="space-y-4">
                    {/* Spotify */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs flex items-center gap-2">
                        {getPlatformInfo('https://spotify.com')?.iconSvg || <span className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center text-green-500 text-xs">SP</span>}
                        {t('artist.dashboard.label.spotifyUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.spotify_url}
                        onChange={(e) => handleProfileChange('spotify_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.spotify')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* Apple Music */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs flex items-center gap-2">
                        {getPlatformInfo('https://music.apple.com')?.iconSvg || <span className="w-6 h-6 bg-pink-500/20 rounded flex items-center justify-center text-pink-500 text-xs">AM</span>}
                        {t('artist.dashboard.label.appleMusicUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.apple_music_url}
                        onChange={(e) => handleProfileChange('apple_music_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.appleMusic')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* SoundCloud */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs flex items-center gap-2">
                        {getPlatformInfo('https://soundcloud.com')?.iconSvg || <span className="w-6 h-6 bg-orange-500/20 rounded flex items-center justify-center text-orange-500 text-xs">SC</span>}
                        {t('artist.dashboard.label.soundcloudUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.soundcloud_url}
                        onChange={(e) => handleProfileChange('soundcloud_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.soundcloud')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* HearThis */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs flex items-center gap-2">
                        {getPlatformInfo('https://hearthis.at')?.iconSvg || <span className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center text-blue-500 text-xs">HT</span>}
                        {t('artist.dashboard.label.hearthisUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.hearthis_url}
                        onChange={(e) => handleProfileChange('hearthis_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.hearthis')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* YouTube */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs flex items-center gap-2">
                        {getPlatformInfo('https://youtube.com')?.iconSvg || <span className="w-6 h-6 bg-red-500/20 rounded flex items-center justify-center text-red-500 text-xs">YT</span>}
                        {t('artist.dashboard.label.youtubeUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.youtube_url}
                        onChange={(e) => handleProfileChange('youtube_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.youtube')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* Audiomack */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider lg:text-xs flex items-center gap-2">
                        <span className="w-6 h-6 bg-orange-600/20 rounded flex items-center justify-center text-orange-600 text-xs font-bold">AM</span>
                        {t('artist.dashboard.label.audiomackUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.audiomack_url}
                        onChange={(e) => handleProfileChange('audiomack_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.audiomack')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 lg:rounded-2xl lg:px-6 lg:py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Current Links Preview */}
                {musicLinks.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 lg:p-5 lg:rounded-3xl">
                    <h4 className="text-[#d3da0c] font-black uppercase tracking-widest text-sm mb-4">{t('artist.dashboard.connectedPlatforms')}</h4>
                    <div className="flex flex-wrap gap-3">
                      {musicLinks.map((link, idx) => {
                        const platform = getPlatformInfo(link.url);
                        if (!platform) return null;
                        return (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-4 py-2 ${platform.bg} rounded-xl transition-all hover:scale-105`}
                          >
                            <span className={`${platform.color}`}>{platform.iconSvg}</span>
                            <span className="text-white text-sm font-medium">{platform.name}</span>
                            <ExternalLink className={`w-3 h-3 ${platform.color}`} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full py-3 bg-[#d3da0c] text-black font-bold rounded-xl lg:w-fit lg:px-10 lg:py-3.5 lg:rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(211, 218, 12,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('artist.dashboard.saving')}
                    </>
                  ) : (
                    t('artist.dashboard.saveMusicLinks')
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1 lg:text-2xl">{t('artist.dashboard.bookingRequests')}</h2>
                <p className="text-gray-500 text-sm font-medium">{t('artist.dashboard.manageBookingRequests')}</p>
              </div>
              {/* Filter — horizontally scrollable on mobile */}
              <div className="overflow-x-auto hide-scrollbar -mx-1 px-1">
                <div className="flex gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/[0.07] w-fit min-w-full">
                  {(['all', 'pending', 'accepted', 'rejected', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBookingFilter(filter)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        bookingFilter === filter
                          ? 'bg-[#d3da0c] text-black'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {isBookingsLoading ? (
                <div className="flex justify-center py-12 sm:py-20">
                  <Loader2 className="w-10 h-10 sm:w-16 sm:h-16 text-[#d3da0c] animate-spin" />
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white/5 p-10 sm:p-20 rounded-3xl sm:rounded-[3rem] text-center border border-white/5">
                  <Calendar className="w-12 h-12 sm:w-20 sm:h-20 text-gray-700 mx-auto mb-4 sm:mb-8" />
                  <h3 className="text-lg sm:text-2xl font-black text-white mb-2 sm:mb-4">
                    {bookingFilter === 'all' ? t('artist.dashboard.noBookings') : t('artist.dashboard.noBookingsFilter', { filter: bookingFilter })}
                  </h3>
                  <p className="text-gray-400 max-w-sm mx-auto text-sm sm:text-base">
                    {bookingFilter === 'all'
                      ? t('artist.dashboard.noBookingsDescription')
                      : t('artist.dashboard.noBookingsFilterDescription', { filter: bookingFilter })}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredBookings.map((booking) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.05] hover:border-[#d3da0c]/25 transition-all lg:p-5"
                    >
                      {/* Top row: icon + info + status badge */}
                      <div className="flex items-start gap-3">
                        <div className="bg-[#d3da0c]/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0">
                          <Music className="w-5 h-5 text-[#d3da0c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-white font-bold text-sm truncate">{booking.event_name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex-shrink-0 ${
                              booking.status === 'accepted' ? 'bg-green-500/10 text-green-400' :
                              booking.status === 'rejected' || booking.status === 'declined' ? 'bg-red-500/10 text-red-400' :
                              booking.status === 'completed' ? 'bg-blue-500/10 text-blue-400' :
                              'bg-white/10 text-gray-400'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500 text-xs">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#d3da0c]/70" />
                              {new Date(booking.proposed_date || booking.event_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {booking.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#d3da0c]/70" />
                                {booking.duration}h
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#d3da0c]/70" />
                              <span className="truncate max-w-[120px]">{booking.contact_name || t('artist.dashboard.eventOrganizer')}</span>
                            </span>
                          </div>
                          {booking.message && (
                            <div className="mt-2 p-2.5 bg-black/40 rounded-xl border-l-2 border-[#d3da0c]/40">
                              <p className="text-gray-400 text-xs italic line-clamp-2">"{booking.message}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom row: fee + action buttons */}
                      <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-white/[0.06]">
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{t('artist.dashboard.proposedFee')}</p>
                          <p className="text-[#d3da0c] text-lg font-bold">¥{(booking.budget || 0).toLocaleString()}</p>
                        </div>

                        <div className="flex gap-2">
                          {booking.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, BookingStatus.REJECTED)}
                                className="w-9 h-9 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center flex-shrink-0"
                                title={t('artist.dashboard.rejectInvitation')}
                              >
                                <CloseIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, BookingStatus.ACCEPTED)}
                                className="px-4 py-2 bg-[#d3da0c] text-black font-bold rounded-xl text-xs hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                {t('artist.dashboard.acceptGig')}
                              </button>
                            </>
                          ) : (
                            <button className="px-3 py-2 bg-white/[0.05] border border-white/10 text-gray-400 font-bold rounded-xl text-[10px] uppercase tracking-widest opacity-60 cursor-default" disabled>
                              {booking.status === 'accepted' ? t('artist.dashboard.status.confirmed') :
                                booking.status === 'completed' ? t('artist.dashboard.status.completed') :
                                  booking.status === 'rejected' || booking.status === 'declined' ? t('artist.dashboard.status.declined') : t('artist.dashboard.status.actionLocked')}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'availability' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1 lg:text-2xl">{t('artist.dashboard.availabilityTitle') || 'My Availability'}</h2>
                <p className="text-gray-500 text-sm font-medium">{t('artist.dashboard.availabilitySubtitle') || 'Click a date to set your availability status.'}</p>
              </div>
              {/* Legend — compact row */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-gray-400">{t('artistDetail.available') || 'Available'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-gray-400">{t('artistDetail.booked') || 'Booked'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-gray-400">{t('artist.dashboard.unavailable') || 'Unavailable'}</span>
                </div>
              </div>

              <div className="bg-[#111111] rounded-2xl p-6 border border-white/5">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => setAvailMonth(new Date(availMonth.getFullYear(), availMonth.getMonth() - 1))}
                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-white font-medium text-lg">
                    {availMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setAvailMonth(new Date(availMonth.getFullYear(), availMonth.getMonth() + 1))}
                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                  >
                    →
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-gray-500 text-xs py-2 font-medium">{day}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: getFirstDayOfMonth(availMonth.getFullYear(), availMonth.getMonth()) }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: getDaysInMonth(availMonth.getFullYear(), availMonth.getMonth()) }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = formatDateStr(availMonth.getFullYear(), availMonth.getMonth(), day);
                    const avail = getAvailabilityForDate(dateStr);
                    const status = avail?.status;
                    const isSelected = selectedAvailDate === dateStr;

                    return (
                      <button
                        key={day}
                        onClick={() => handleDateClick(day)}
                        className={`aspect-square flex items-center justify-center rounded-lg text-xs sm:text-sm relative transition-all touch-manipulation ${
                          isSelected
                            ? 'ring-2 ring-[#d3da0c] bg-white/10'
                            : status === 'available'
                            ? 'bg-green-500/20 hover:bg-green-500/30'
                            : status === 'booked'
                            ? 'bg-red-500/20 hover:bg-red-500/30'
                            : status === 'unavailable'
                            ? 'bg-gray-500/20 hover:bg-gray-500/30'
                            : 'bg-white/[0.04] hover:bg-white/10'
                        }`}
                      >
                        <span className={`${isSelected ? 'text-[#d3da0c] font-bold' : 'text-white'}`}>{day}</span>
                        {status && (
                          <div className={`absolute bottom-1 w-1 h-1 rounded-full ${
                            status === 'available' ? 'bg-green-500' : status === 'booked' ? 'bg-red-500' : 'bg-gray-500'
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Date Editor */}
                {selectedAvailDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10"
                  >
                    <p className="text-white font-medium mb-4">
                      {t('artist.dashboard.selectedDate') || 'Selected Date'}: <span className="text-[#d3da0c]">{selectedAvailDate}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(['available', 'booked', 'unavailable'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => setSelectedAvailStatus(status)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                            selectedAvailStatus === status
                              ? status === 'available'
                                ? 'bg-green-500 text-white'
                                : status === 'booked'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveAvailability}
                        disabled={isSavingAvail}
                        className="px-6 py-2.5 bg-[#d3da0c] text-black text-sm font-bold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSavingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('common.save') || 'Save'}
                      </button>
                      <button
                        onClick={handleClearAvailability}
                        disabled={isSavingAvail}
                        className="px-6 py-2.5 bg-white/5 text-white text-sm font-bold rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        {t('common.clear') || 'Clear'}
                      </button>
                      <button
                        onClick={() => setSelectedAvailDate(null)}
                        className="px-6 py-2.5 bg-white/5 text-gray-400 text-sm font-bold rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {t('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
};

export default ArtistDashboard;
