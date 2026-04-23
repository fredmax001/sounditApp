import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useBookingStore, BookingStatus } from '@/store/bookingStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import {
  Music, Calendar, Users, Star, TrendingUp, Edit, Camera, Check,
  X as CloseIcon, Clock, Loader2, Instagram, Twitter,
  DollarSign, Headphones,
  Disc3, ExternalLink, Phone, MessageCircle, Upload, QrCode,
  Crown, Youtube
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// API Base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ArtistDashboard = () => {
  const { t } = useTranslation();
  const { profile, artistProfile, session, updateProfile } = useAuthStore();
  const { incomingBookings, fetchIncomingBookings, updateBookingStatus, isLoading: isBookingsLoading } = useBookingStore();
  const { stats: dashboardStats, fetchStats } = useDashboardStore();
  const { checkSubscription, hasSubscription, planType, daysRemaining } = useSubscriptionStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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
    audiomack_url: ''
  });

  // Booking filter state
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'completed'>('all');


  // Fetch fresh profile data on mount - syncs with backend
  useEffect(() => {
    if (session?.access_token) {
      useAuthStore.getState().refreshSession().catch(err => console.error('Failed to refresh session:', err));
      useAuthStore.getState().fetchArtistProfile().catch(err => console.error('Failed to fetch artist profile:', err));
      checkSubscription(session.access_token);
    }
  }, [session, checkSubscription]);

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
        audiomack_url: artistProfile?.audiomack_url || ''
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

  const handleStatusUpdate = async (id: number, status: BookingStatus) => {
    if (session?.access_token) {
      const success = await updateBookingStatus(session.access_token, id, status);
      if (success) {
        toast.success(t('artist.dashboard.bookingUpdated', { status }));
      }
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
        throw new Error('Failed to update user profile');
      }

      // Update artist profile - PUT handles both create and update
      const artistResponse = await fetch(`${API_BASE_URL}/artist/profile`, {
        method: 'PUT',
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
          audiomack_url: profileForm.audiomack_url
        })
      });

      if (!artistResponse.ok) {
        const errorData = await artistResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update artist profile');
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
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(t('artist.dashboard.saveProfileFailed'));
    } finally {
      setIsSaving(false);
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
      iconSvg: <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.255-2.154c-.009-.06-.05-.1-.099-.1zm-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.268c.014.06.045.094.104.094.06 0 .09-.034.099-.094l.195-1.268-.195-1.332c-.009-.057-.039-.094-.099-.094zm1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.104.105.104.06 0 .104-.045.104-.104l.24-2.458-.24-2.563c0-.06-.046-.104-.104-.104zm.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.076.138.151.138.075 0 .135-.061.15-.138l.21-2.544-.21-2.64c-.015-.075-.075-.135-.168-.135zm1.83-.488c-.09 0-.149.075-.165.165l-.18 2.79.18 2.505c.016.09.075.165.165.165.09 0 .165-.075.165-.165l.195-2.505-.195-2.79c0-.09-.075-.165-.165-.165zm.915-.387c-.105 0-.18.09-.195.18l-.165 2.88.165 2.43c.015.105.09.18.195.18.09 0 .18-.075.195-.18l.18-2.43-.18-2.88c-.015-.09-.09-.18-.195-.18zm1.83-.405c-.12 0-.21.105-.225.21l-.135 2.925.135 2.37c.015.12.105.225.225.225.12 0 .21-.105.225-.225l.15-2.37-.15-2.925c-.015-.105-.105-.21-.225-.21zm.945-.465c-.135 0-.24.12-.255.24l-.12 2.985.12 2.295c.015.135.12.255.255.255.135 0 .255-.12.255-.255l.135-2.295-.135-2.985c-.015-.135-.135-.24-.255-.24zm.96-.285c-.15 0-.27.135-.285.27l-.105 3 .105 2.22c.015.15.135.27.285.27.15 0 .27-.12.285-.27l.12-2.22-.12-3c-.015-.135-.135-.27-.285-.27zm1.035-.12c-.165 0-.285.135-.3.285l-.09 2.985.09 2.1c.015.165.135.285.3.285.165 0 .3-.135.3-.285l.105-2.1-.105-2.985c-.015-.15-.135-.285-.3-.285zm2.79-.18c-.165 0-.3.15-.3.315l-.075 2.91.075 2.055c0 .18.135.315.3.315.18 0 .315-.15.315-.315l.09-2.055-.09-2.91c0-.18-.135-.315-.315-.315zm1.365-.015c-.18 0-.315.15-.315.33l-.06 2.76.06 2.175c0 .18.135.33.315.33.195 0 .345-.15.345-.33l.075-2.175-.075-2.76c0-.18-.15-.33-.345-.33zm1.44.015c-.195 0-.345.165-.345.345l-.045 2.55.045 2.325c0 .195.15.36.345.36.21 0 .375-.165.375-.36l.06-2.325-.06-2.55c0-.195-.165-.345-.375-.345zm1.515.09c-.21 0-.375.18-.375.375l-.03 2.295.03 2.415c0 .21.165.39.375.39.225 0 .405-.18.405-.39l.045-2.415-.045-2.295c0-.21-.18-.375-.405-.375z"/></svg>
    };
    if (url.includes('spotify.com')) return { 
      name: 'Spotify', 
      color: 'text-green-500', 
      bg: 'bg-green-500/20',
      iconSvg: <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
    };
    if (url.includes('youtube.com') || url.includes('youtu.be')) return { 
      name: 'YouTube', 
      color: 'text-red-500', 
      bg: 'bg-red-500/20',
      iconSvg: <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    };
    if (url.includes('apple.com') || url.includes('music.apple')) return { 
      name: 'Apple Music', 
      color: 'text-pink-500', 
      bg: 'bg-pink-500/20',
      iconSvg: <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.589.033-1.18.07-1.754.178-1.1.214-2.05.672-2.814 1.478C.51 2.49 0 3.72 0 5.137v13.633c0 .353.027.707.064 1.058.123 1.145.481 2.135 1.16 2.934.792.936 1.8 1.47 3.008 1.669.414.066.828.099 1.25.106.193.003.386.01.58.01h12.67c.223-.006.447-.013.67-.024.438-.02.875-.04 1.306-.08a6.39 6.39 0 002.24-.66c.973-.52 1.693-1.276 2.19-2.28.32-.656.492-1.352.567-2.075.015-.14.026-.28.038-.42V6.125c-.003-.024 0-.049-.002-.074-.005-.059-.008-.115-.008-.116.003.003-.011-.001-.038.007.006.006.006.006.008 0l-.004-.018zM18.14 8.54c-.595.737-1.55 1.157-2.64 1.157-.105 0-.207-.007-.31-.02.168 1.096.453 2.063.843 2.833.44.865.998 1.515 1.65 1.92a6.514 6.514 0 00-1.76 1.58c-.693.94-1.05 1.995-1.05 3.117 0 1.073.34 2.087.968 2.957.595.825 1.415 1.444 2.378 1.778.595.198 1.208.298 1.833.298 1.073 0 2.134-.298 3.022-.845l-.08-3.66c-.44.38-.988.572-1.617.572-1.15 0-2.08-.94-2.08-2.09 0-.978.662-1.805 1.56-2.035l-.087-4.06z"/></svg>
    };
    if (url.includes('hearthis.at')) return { 
      name: 'HearThis', 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/20',
      iconSvg: <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-8c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm-2 0c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4-1.79-4-4z"/></svg>
    };
    if (url.includes('audiomack.com')) return { 
      name: 'Audiomack', 
      color: 'text-orange-400', 
      bg: 'bg-orange-400/20',
      iconSvg: <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
    };
    if (url.includes('music.youtube.com') || url.includes('youtube.com') || url.includes('youtu.be')) return { 
      name: 'YouTube Music', 
      color: 'text-red-500', 
      bg: 'bg-red-500/20',
      iconSvg: <Youtube className="w-6 h-6" />
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
    <div className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10 bg-white/5 p-8 rounded-[2rem] border border-white/5">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative group">
            <img
              src={getAvatarUrl()}
              alt={getDisplayName()}
              className="w-32 h-32 rounded-[2rem] object-cover ring-4 ring-[#d3da0c]/20 group-hover:ring-[#d3da0c]/50 transition-all duration-300 shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/default-artist.png';
              }}
            />
            <label className="absolute -bottom-2 -right-2 p-3 bg-[#d3da0c] rounded-2xl text-black shadow-xl hover:scale-110 active:scale-90 transition-all cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploadingAvatar}
              />
              {isUploadingAvatar ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </label>
          </div>
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
              <h1 className="text-4xl font-black text-white tracking-tighter">
                {getDisplayName()}
              </h1>
              {(profile?.is_verified || artistProfile?.is_verified) && (
                <div className="bg-[#d3da0c] text-black p-1 rounded-full shadow-[0_0_15px_rgba(211, 218, 12,0.5)]">
                  <Check className="w-3.5 h-3.5 font-black" />
                </div>
              )}
            </div>
            {(() => {
              const type = artistProfile?.artist_type || profileForm.artist_type;
              const showType = type && type !== 'Artist';
              const showGenres = artistProfile?.genres?.length > 0;
              if (!showType && !showGenres) return null;
              return (
                <p className="text-[#d3da0c] font-bold text-lg mb-3 tracking-wide">
                  {showType ? type : ''}
                  {showType && showGenres ? ' • ' : ''}
                  {showGenres ? artistProfile.genres.join(' • ') : ''}
                </p>
              );
            })()}
            <div className="flex items-center justify-center md:justify-start gap-3">
              {(profile?.instagram || profileForm.instagram) && (
                <a
                  href={(profile?.instagram || profileForm.instagram).startsWith('http')
                    ? (profile?.instagram || profileForm.instagram)
                    : `https://instagram.com/${profile?.instagram || profileForm.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white transition-all hover:text-[#d3da0c]"
                  title={t('artist.dashboard.social.instagram')}
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {(profile?.twitter || profileForm.twitter) && (
                <a
                  href={(profile?.twitter || profileForm.twitter).startsWith('http')
                    ? (profile?.twitter || profileForm.twitter)
                    : `https://twitter.com/${profile?.twitter || profileForm.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white transition-all hover:text-[#d3da0c]"
                  title={t('artist.dashboard.social.twitter')}
                >
                  <Twitter className="w-4 h-4" />
                </a>
              )}
              {(profile?.wechat_id || profileForm.wechat) && (
                <span
                  className="p-2 bg-white/5 rounded-xl text-white/60 cursor-default"
                  title={t('artist.dashboard.social.wechatTitle', { handle: profile?.wechat_id || profileForm.wechat })}
                >
                  <MessageCircle className="w-4 h-4" />
                </span>
              )}
              {(profile?.phone || profileForm.phone) && (
                <a
                  href={`tel:${profile?.phone || profileForm.phone}`}
                  className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white transition-all hover:text-[#d3da0c]"
                  title={t('artist.dashboard.social.phone')}
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <span className="text-gray-500 text-xs font-black uppercase tracking-[0.2em]">{t('artist.dashboard.accountStatus')}</span>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-500 text-xs font-black uppercase tracking-widest">{t('artist.dashboard.activePartner')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-10 bg-[#111111] p-1.5 rounded-2xl w-fit border border-white/5 shadow-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-xl text-sm font-black transition-all capitalize flex items-center gap-2 ${activeTab === tab.id
              ? 'bg-[#d3da0c] text-black shadow-[0_0_25px_rgba(211, 218, 12,0.2)]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="bg-[#111111] border border-white/5 rounded-[2.5rem] p-10 min-h-[600px] shadow-2xl"
        >
          {activeTab === 'overview' && (
            <div className="grid gap-12">
              {/* Subscription Status */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#d3da0c]/10 rounded-2xl flex items-center justify-center">
                    <Crown className="w-6 h-6 text-[#d3da0c]" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">
                      {hasSubscription ? (
                        planType ? `${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan` : 'Active Subscription'
                      ) : (
                        'No Active Subscription'
                      )}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {hasSubscription && daysRemaining !== null
                        ? `${daysRemaining} days remaining`
                        : 'Subscribe to unlock premium features'
                      }
                    </p>
                  </div>
                </div>
                {!hasSubscription && (
                  <a
                    href="/subscriptions"
                    className="px-6 py-3 bg-[#d3da0c] text-black font-black rounded-2xl text-sm hover:scale-105 active:scale-95 transition-all"
                  >
                    Upgrade
                  </a>
                )}
              </div>

              {/* Stats from backend */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: t('artist.dashboard.stat.followers'), value: stats.followers.toLocaleString(), icon: Users, color: 'text-blue-400' },
                  { label: t('artist.dashboard.stat.avgRating'), value: stats.rating > 0 ? stats.rating.toFixed(1) : '-', icon: Star, color: 'text-yellow-400' },
                  { label: t('artist.dashboard.stat.totalGigs'), value: stats.totalBookings.toString(), icon: Calendar, color: 'text-purple-400' },
                  { label: t('artist.dashboard.stat.earnings'), value: `¥${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-[#d3da0c]' },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-[#d3da0c]/30 transition-all group">
                    <div className={`p-4 rounded-2xl w-fit mb-6 ${stat.color} bg-white/5`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <p className="text-4xl font-black text-white mb-2">{stat.value}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-500 text-xs font-black uppercase tracking-widest">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Content Split */}
              <div className="grid lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                  <section>
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-2xl font-black text-white">{t('artist.dashboard.upcomingPerformances')}</h2>
                      <button onClick={() => setActiveTab('bookings')} className="text-[#d3da0c] text-sm font-bold hover:underline">{t('artist.dashboard.manageAll')}</button>
                    </div>
                    <div className="space-y-4">
                      {incomingBookings.filter((b: Booking) => b.status === 'accepted').slice(0, 3).map((booking) => (
                        <div key={booking.id} className="bg-white/5 border border-white/5 p-6 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-[#d3da0c]/10 rounded-xl flex items-center justify-center">
                              <Music className="w-7 h-7 text-[#d3da0c]" />
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-lg">{booking.event_name}</h4>
                              <p className="text-gray-400 text-sm tracking-wide">
                                {new Date(booking.proposed_date || booking.event_date).toLocaleDateString()}
                                {booking.duration && ` • ${t('artist.dashboard.hoursSet', { hours: booking.duration })}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-black text-xl">¥{(booking.budget || 0).toLocaleString()}</p>
                            <span className="text-green-500 text-[10px] font-black uppercase tracking-widest">{t('artist.dashboard.status.confirmed')}</span>
                          </div>
                        </div>
                      ))}
                      {incomingBookings.filter((b: Booking) => b.status === 'accepted').length === 0 && (
                        <div className="py-20 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
                          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-500 font-bold">{t('artist.dashboard.noConfirmedGigs')}</p>
                          <button onClick={() => setActiveTab('bookings')} className="text-[#d3da0c] text-sm mt-2 hover:underline">
                            {t('artist.dashboard.checkBookings')}
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-10">
                  <section>
                    <h2 className="text-2xl font-black text-white mb-8">{t('artist.dashboard.quickActions')}</h2>
                    <div className="space-y-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setActiveTab('profile')}
                        className="w-full bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-[#d3da0c]/30 transition-all text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#d3da0c]/20 rounded-xl flex items-center justify-center">
                            <Edit className="w-6 h-6 text-[#d3da0c]" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold">{t('artist.dashboard.updateProfile')}</h4>
                            <p className="text-gray-500 text-sm">{t('artist.dashboard.updateProfileDesc')}</p>
                          </div>
                        </div>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setActiveTab('music')}
                        className="w-full bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <Disc3 className="w-6 h-6 text-purple-500" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold">{t('artist.dashboard.manageMusicLinks')}</h4>
                            <p className="text-gray-500 text-sm">{t('artist.dashboard.manageMusicLinksDesc')}</p>
                          </div>
                        </div>
                      </motion.button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-4xl">
              <h2 className="text-3xl font-black text-white mb-4">{t('artist.dashboard.editProfileTitle')}</h2>
              <p className="text-gray-400 mb-10">{t('artist.dashboard.editProfileSubtitle')}</p>

              <div className="grid gap-8">
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.stageName')}</label>
                    <input
                      type="text"
                      value={profileForm.stage_name}
                      onChange={(e) => handleProfileChange('stage_name', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.stageName')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.artistType')}</label>
                    <select
                      value={profileForm.artist_type}
                      onChange={(e) => handleProfileChange('artist_type', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
                    >
                      <option value="Artist" className="bg-[#111111]">{t('artist.dashboard.artistType.artist')}</option>
                      <option value="DJ" className="bg-[#111111]">{t('artist.dashboard.artistType.dj')}</option>
                      <option value="MC" className="bg-[#111111]">{t('artist.dashboard.artistType.mc')}</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.genres')}</label>
                    <input
                      type="text"
                      value={profileForm.genres}
                      onChange={(e) => handleProfileChange('genres', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.genres')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.biography')}</label>
                    <span className={`text-xs font-bold ${getBioCharCount() >= 450 ? 'text-yellow-500' : 'text-gray-500'}`}>
                      {t('artist.dashboard.charCount', { count: getBioCharCount() })}
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={profileForm.bio}
                    onChange={(e) => handleProfileChange('bio', e.target.value)}
                    placeholder={t('artist.dashboard.placeholder.bio')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold resize-none"
                    maxLength={500}
                  />
                  {getBioCharCount() >= 500 && (
                    <p className="text-yellow-500 text-xs font-bold">{t('artist.dashboard.maxCharReached')}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.instagram')}</label>
                    <input
                      type="text"
                      value={profileForm.instagram}
                      onChange={(e) => handleProfileChange('instagram', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.instagram')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.twitter')}</label>
                    <input
                      type="text"
                      value={profileForm.twitter}
                      onChange={(e) => handleProfileChange('twitter', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.twitter')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.wechat')}</label>
                    <input
                      type="text"
                      value={profileForm.wechat}
                      onChange={(e) => handleProfileChange('wechat', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.wechat')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('artist.dashboard.label.phone')}</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => handleProfileChange('phone', e.target.value)}
                      placeholder={t('artist.dashboard.placeholder.phone')}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-fit px-12 py-4 bg-[#d3da0c] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(211, 218, 12,0.3)] mt-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              <h2 className="text-3xl font-black text-white mb-4">{t('artist.dashboard.musicTitle')}</h2>
              <p className="text-gray-400 mb-10">{t('artist.dashboard.musicSubtitle')}</p>

              <div className="grid gap-8">
                {/* Music Platform Links */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-white">{t('artist.dashboard.yourMusicLinks')}</h3>

                  <div className="space-y-4">
                    {/* Spotify */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        {getPlatformInfo('https://spotify.com')?.iconSvg || <span className="w-6 h-6 bg-green-500/20 rounded flex items-center justify-center text-green-500 text-xs">SP</span>}
                        {t('artist.dashboard.label.spotifyUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.spotify_url}
                        onChange={(e) => handleProfileChange('spotify_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.spotify')}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* Apple Music */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        {getPlatformInfo('https://music.apple.com')?.iconSvg || <span className="w-6 h-6 bg-pink-500/20 rounded flex items-center justify-center text-pink-500 text-xs">AM</span>}
                        {t('artist.dashboard.label.appleMusicUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.apple_music_url}
                        onChange={(e) => handleProfileChange('apple_music_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.appleMusic')}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* SoundCloud */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        {getPlatformInfo('https://soundcloud.com')?.iconSvg || <span className="w-6 h-6 bg-orange-500/20 rounded flex items-center justify-center text-orange-500 text-xs">SC</span>}
                        {t('artist.dashboard.label.soundcloudUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.soundcloud_url}
                        onChange={(e) => handleProfileChange('soundcloud_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.soundcloud')}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* HearThis */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        {getPlatformInfo('https://hearthis.at')?.iconSvg || <span className="w-6 h-6 bg-blue-500/20 rounded flex items-center justify-center text-blue-500 text-xs">HT</span>}
                        {t('artist.dashboard.label.hearthisUrl')}
                      </label>
                      <input
                        type="url"
                        value={profileForm.hearthis_url}
                        onChange={(e) => handleProfileChange('hearthis_url', e.target.value)}
                        placeholder={t('artist.dashboard.placeholder.hearthis')}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* YouTube Music */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        {getPlatformInfo('https://music.youtube.com')?.iconSvg || <span className="w-6 h-6 bg-red-500/20 rounded flex items-center justify-center text-red-500 text-xs">YT</span>}
                        YouTube Music
                      </label>
                      <input
                        type="url"
                        value={profileForm.youtube_url}
                        onChange={(e) => handleProfileChange('youtube_url', e.target.value)}
                        placeholder="https://music.youtube.com/..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>

                    {/* Audiomack */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        {getPlatformInfo('https://audiomack.com')?.iconSvg || <span className="w-6 h-6 bg-orange-400/20 rounded flex items-center justify-center text-orange-400 text-xs">AM</span>}
                        Audiomack
                      </label>
                      <input
                        type="url"
                        value={profileForm.audiomack_url}
                        onChange={(e) => handleProfileChange('audiomack_url', e.target.value)}
                        placeholder="https://audiomack.com/..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-[#d3da0c] outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Current Links Preview */}
                {musicLinks.length > 0 && (
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
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
                  className="w-fit px-12 py-4 bg-[#d3da0c] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(211, 218, 12,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black text-white">{t('artist.dashboard.bookingRequests')}</h2>
                  <p className="text-gray-500 font-medium">{t('artist.dashboard.manageBookingRequests')}</p>
                </div>
                <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
                  {(['all', 'pending', 'accepted', 'rejected', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBookingFilter(filter)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${bookingFilter === filter
                        ? 'bg-[#d3da0c] text-black'
                        : 'text-gray-400 hover:text-white'
                        }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {isBookingsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-16 h-16 text-[#d3da0c] animate-spin" />
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="bg-white/5 p-20 rounded-[3rem] text-center border border-white/5">
                  <Calendar className="w-20 h-20 text-gray-700 mx-auto mb-8" />
                  <h3 className="text-2xl font-black text-white mb-4">
                    {bookingFilter === 'all' ? t('artist.dashboard.noBookings') : t('artist.dashboard.noBookingsFilter', { filter: bookingFilter })}
                  </h3>
                  <p className="text-gray-400 max-w-sm mx-auto">
                    {bookingFilter === 'all'
                      ? t('artist.dashboard.noBookingsDescription')
                      : t('artist.dashboard.noBookingsFilterDescription', { filter: bookingFilter })}
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {filteredBookings.map((booking) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex flex-col lg:flex-row items-start lg:items-center justify-between p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:bg-white/[0.04] hover:border-[#d3da0c]/30 transition-all shadow-xl"
                    >
                      <div className="flex items-center gap-8 flex-1">
                        <div className="bg-[#d3da0c]/10 p-5 rounded-2xl group-hover:scale-110 transition-transform">
                          <Music className="w-8 h-8 text-[#d3da0c]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-4 mb-2">
                            <h4 className="text-white font-black text-2xl tracking-tighter">{booking.event_name}</h4>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${booking.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                              booking.status === 'rejected' || booking.status === 'declined' ? 'bg-red-500/10 text-red-500' :
                                booking.status === 'completed' ? 'bg-blue-500/10 text-blue-500' :
                                  'bg-white/10 text-gray-400'
                              }`}>
                              {booking.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-6 text-gray-500 text-sm font-bold">
                            <span className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#d3da0c]" />
                              {new Date(booking.proposed_date || booking.event_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            {booking.duration && (
                              <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#d3da0c]" />
                                {booking.duration} Hours
                              </span>
                            )}
                            <span className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-[#d3da0c]" />
                              {t('artist.dashboard.organizer')}: {booking.contact_name || t('artist.dashboard.eventOrganizer')}
                            </span>
                          </div>
                          {booking.message && (
                            <div className="mt-4 p-4 bg-black/40 rounded-xl border-l-4 border-[#d3da0c] max-w-2xl">
                              <p className="text-gray-400 text-sm italic font-medium">"{booking.message}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-10 mt-8 lg:mt-0 w-full lg:w-auto border-t lg:border-t-0 border-white/5 pt-8 lg:pt-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 font-black uppercase tracking-widest mb-1">{t('artist.dashboard.proposedFee')}</p>
                          <p className="text-[#d3da0c] text-4xl font-black tracking-tighter">¥{(booking.budget || 0).toLocaleString()}</p>
                        </div>

                        <div className="flex gap-3 ml-auto lg:ml-0">
                          {booking.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, BookingStatus.REJECTED)}
                                className="p-5 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
                                title={t('artist.dashboard.rejectInvitation')}
                              >
                                <CloseIcon className="w-6 h-6" />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(booking.id, BookingStatus.ACCEPTED)}
                                className="px-8 py-5 bg-[#d3da0c] text-black font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(211, 218, 12,0.3)] flex items-center gap-2"
                              >
                                <Check className="w-6 h-6" />
                                {t('artist.dashboard.acceptGig')}
                              </button>
                            </>
                          ) : (
                            <button className="px-8 py-4 bg-white/5 border border-white/10 text-gray-400 font-black rounded-2xl text-xs uppercase tracking-widest disabled:opacity-50" disabled>
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ArtistDashboard;
