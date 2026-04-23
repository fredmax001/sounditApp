import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Camera, MapPin, Mail, Phone, Calendar, Edit2, Check, X, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { chinaCities } from '@/data/constants';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

const Profile = () => {
  const { t } = useTranslation();
  const { profile, updateProfile, uploadAvatar, uploadBanner, session, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [eventsAttended, setEventsAttended] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    username: profile?.username || '',
    bio: profile?.bio || '',
    city: profile?.city?.name || '',
    phone: profile?.phone || '',
  });

  useEffect(() => {
    const fetchEventsAttended = async () => {
      if (!session?.access_token) {
        setIsLoadingStats(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/payments/tickets/user`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const tickets = await response.json() as { is_used?: boolean }[];
          const usedCount = tickets.filter((t) => t.is_used).length;
          setEventsAttended(usedCount);
        }
      } catch (error) {
        console.error('Failed to fetch events attended:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchEventsAttended();
  }, [session]);

  useEffect(() => {
    const cityName = profile?.city?.name
      || (profile?.city_id ? chinaCities.find(c => c.id.toLowerCase() === profile.city_id?.toLowerCase())?.name : '')
      || '';
    setFormData({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      city: cityName,
      phone: profile?.phone || '',
    });
  }, [profile]);

  const displayName = (profile?.first_name || profile?.last_name
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : profile?.email?.split('@')[0] || t('user.profile.user'));

  const handleSave = async () => {
    try {
      const selectedCity = chinaCities.find(c => c.name === formData.city);

      await updateProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username || null,
        bio: formData.bio,
        city_id: selectedCity?.id || null,
        phone: formData.phone,
      });

      setIsEditing(false);
      toast.success(t('user.profile.profileUpdated'));
    } catch {
      toast.error(t('user.profile.profileUpdateFailed'));
    }
  };

  const handleCancel = () => {
    const cityName = profile?.city?.name
      || (profile?.city_id ? chinaCities.find(c => c.id.toLowerCase() === profile.city_id?.toLowerCase())?.name : '')
      || '';
    setFormData({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
      city: cityName,
      phone: profile?.phone || '',
    });
    setIsEditing(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadAvatar(file);
      toast.success(t('user.profile.avatarUpdated'));
    } catch {
      toast.error(t('user.profile.avatarUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsBannerUploading(true);
    try {
      await uploadBanner(file);
      toast.success(t('user.profile.bannerUpdated'));
    } catch {
      toast.error(t('user.profile.bannerUploadFailed'));
    } finally {
      setIsBannerUploading(false);
    }
  };

  const stats = [
    {
      label: t('user.profile.eventsAttended'),
      value: isLoadingStats ? '...' : eventsAttended
    },
    { label: t('user.profile.following'), value: profile?.following_count || 0 },
    { label: t('user.profile.followers'), value: profile?.followers_count || 0 },
    {
      label: t('user.profile.memberSince'), value: profile?.created_at
        ? new Date(profile.created_at).getFullYear()
        : new Date().getFullYear()
    },
  ];

  return (
    <div className="min-h-screen pb-6">
      {/* Banner */}
      <div className="relative h-40 sm:h-52">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: profile?.banner_url
              ? `url('${profile.banner_url}')`
              : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]/90" />
        <label className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-full cursor-pointer transition-colors backdrop-blur-sm">
          <Upload className="w-3.5 h-3.5" />
          <span>{isBannerUploading ? t('user.profile.uploading') : t('user.profile.changeBanner')}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerUpload}
            disabled={isBannerUploading}
          />
        </label>
        {isBannerUploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="max-w-3xl mx-auto px-3 sm:px-4 -mt-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5 mb-4"
        >
          <div className="flex flex-col gap-4">
            {/* Avatar + Name Row */}
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-3 border-[#0A0A0A] shadow-lg">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl font-bold text-black">{displayName?.[0]}</span>
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[#d3da0c] flex items-center justify-center text-black hover:bg-[#bbc10b] transition-colors cursor-pointer shadow">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                  />
                </label>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                    <div className="w-5 h-5 border-2 border-[#d3da0c] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={formData.first_name}
                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                            placeholder={t('user.profile.firstNamePlaceholder')}
                            className="w-full sm:flex-1 text-lg sm:text-xl font-semibold text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:border-[#d3da0c] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={formData.last_name}
                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                            placeholder={t('user.profile.lastNamePlaceholder')}
                            className="w-full sm:flex-1 text-lg sm:text-xl font-semibold text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:border-[#d3da0c] focus:outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="Username"
                          className="w-full text-sm text-white bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:border-[#d3da0c] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{displayName}</h1>
                        <p className="text-gray-400 text-sm truncate">{profile?.username || profile?.email}</p>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile?.role_type === 'business' && (
                          <span className="px-2.5 py-0.5 bg-[#d3da0c]/15 text-[#d3da0c] text-xs rounded-full border border-[#d3da0c]/20">
                            {t('user.profile.businessEntity')}
                          </span>
                        )}
                        {profile?.role === 'admin' && (
                          <span className="px-2.5 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full border border-red-500/20">
                            {t('user.profile.administrator')}
                          </span>
                        )}
                        {profile?.role_type === 'artist' && (
                          <span className="px-2.5 py-0.5 bg-[#FF2D8F]/15 text-[#FF2D8F] text-xs rounded-full border border-[#FF2D8F]/20">
                            {t('user.profile.artistDj')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleSave}
                        className="w-9 h-9 rounded-full bg-[#d3da0c] flex items-center justify-center text-black hover:bg-[#bbc10b] transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors text-sm"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      {t('user.profile.edit')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            {isEditing ? (
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder={t('user.profile.bioPlaceholder')}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:border-[#d3da0c] focus:outline-none resize-none text-sm"
              />
            ) : (
              <p className="text-gray-400 text-sm">{profile?.bio || t('user.profile.noBioYet')}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/5">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center bg-white/5 rounded-xl py-2.5">
                  <div className="text-lg sm:text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Contact Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-[#111111] border border-white/5 rounded-2xl p-4 sm:p-5"
        >
          <h2 className="text-base sm:text-lg font-semibold text-white mb-4">{t('user.profile.contactInformation')}</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{t('user.profile.email')}</p>
                <p className="text-white text-sm truncate">{profile?.email}</p>
                {profile?.is_email_verified ? (
                  <span className="text-[10px] text-green-400">{t('user.profile.verified')}</span>
                ) : (
                  <span className="text-[10px] text-yellow-400">{t('user.profile.pendingVerification')}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">{t('user.profile.phone')}</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t('user.profile.phonePlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                  />
                ) : (
                  <p className="text-white text-sm">{profile?.phone || t('user.profile.notAdded')}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">{t('user.profile.city')}</p>
                {isEditing ? (
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-[#d3da0c] focus:outline-none"
                  >
                    <option value="">{t('user.profile.selectCity')}</option>
                    {chinaCities.map(city => (
                      <option key={city.name} value={city.name}>{city.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white text-sm capitalize">{profile?.city?.name || t('user.profile.notSet')}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{t('user.profile.joined')}</p>
                <p className="text-white text-sm">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                    : t('user.profile.unknown')
                  }
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-4"
        >
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
