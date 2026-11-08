import { motion } from 'framer-motion';
import { Store, Camera, Link2, Instagram, Twitter, Globe, Edit, Save, Loader2, X, Plus, MapPin, LogOut, Cloud, ExternalLink } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { t } = useTranslation();
  const { profile, session, businessProfile, uploadAvatar, uploadBanner, uploadGalleryImage, updateProfile, updateBusinessProfile, logout } = useAuthStore();
  const { stats, fetchStats } = useDashboardStore();
  const navigate = useNavigate();

  // Real event count comes from dashboard stats (businessProfile has no total_events field)
  useEffect(() => {
    if (session?.access_token) fetchStats(session.access_token);
  }, [session?.access_token, fetchStats]);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [profileData, setProfileData] = useState({
    businessName: businessProfile?.business_name || '',
    username: profile?.username || '',
    description: businessProfile?.description || '',
    website: businessProfile?.website || '',
    photoAlbumUrl: businessProfile?.photo_album_url || '',
    instagram: profile?.instagram || '',
    twitter: profile?.twitter || '',
    location: businessProfile?.address || '',
    cityId: businessProfile?.city_id || profile?.city_id || '',
  });

  // Update form data when businessProfile changes
  useEffect(() => {
    if (businessProfile || profile) {
      setProfileData(prev => ({
        ...prev,
        businessName: businessProfile?.business_name || prev.businessName,
        username: profile?.username || prev.username,
        description: businessProfile?.description || prev.description,
        website: businessProfile?.website || prev.website,
        photoAlbumUrl: businessProfile?.photo_album_url || prev.photoAlbumUrl,
        location: businessProfile?.address || prev.location,
        cityId: businessProfile?.city_id || profile?.city_id || prev.cityId,
        instagram: profile?.instagram || prev.instagram,
        twitter: profile?.twitter || prev.twitter,
      }));
    }
  }, [businessProfile, profile]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const errors = [];

      // Update business profile with city
      try {
        const businessData: Record<string, unknown> = {
          business_name: profileData.businessName,
          description: profileData.description,
          address: profileData.location,
          website: profileData.website,
          photo_album_url: profileData.photoAlbumUrl?.trim() || null,
        };

        // Only add city if selected - backend expects 'city_id' field
        if (profileData.cityId) {
          businessData.city_id = profileData.cityId;
        }

        // Removed console.log for production
        await updateBusinessProfile(businessData);
        toast.success(t('business.profile.businessProfileUpdated'));
      } catch (err) {
        console.error('Business profile save error:', err);
        errors.push(`Business: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Update social media on regular profile
      try {
        await updateProfile({
          username: profileData.username ? profileData.username.trim().replace(/^@/, '') : null,
          instagram: profileData.instagram,
          twitter: profileData.twitter,
          city_id: profileData.cityId || null,
        });
        toast.success(t('business.profile.socialMediaUpdated'));
      } catch (err) {
        console.error('Social media save error:', err);
        errors.push(`Social: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (errors.length > 0) {
        toast.error(t('business.profile.someUpdatesFailed', { errors: errors.join(', ') }));
      } else {
        toast.success(t('business.profile.allChangesSaved'));
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToUpdateProfile'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('business.profile.pleaseUploadValidImage'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('business.profile.imageSize5Mb'));
      return;
    }

    setIsUploading(true);
    try {
      await uploadAvatar(file);
      toast.success(t('business.profile.avatarUpdated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToUploadAvatar'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('business.profile.pleaseUploadValidImage'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('business.profile.imageSize10Mb'));
      return;
    }

    setIsUploading(true);
    try {
      await uploadBanner(file);
      toast.success(t('business.profile.coverImageUpdated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToUploadCoverImage'));
    } finally {
      setIsUploading(false);
    }
  };

  const maxGallerySlots = 24;

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const validFiles = rawFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: ${t('business.profile.pleaseUploadValidImage')}`);
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name}: Image exceeds 15MB limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const currentCount = businessProfile?.gallery_images?.length || 0;
    const remainingSlots = Math.max(0, maxGallerySlots - currentCount);
    if (remainingSlots === 0) {
      toast.error(`Gallery reached maximum limit of ${maxGallerySlots} photos.`);
      return;
    }

    const filesToUpload = validFiles.slice(0, remainingSlots);
    if (filesToUpload.length < validFiles.length) {
      toast.info(`Uploading first ${remainingSlots} photo(s) to stay within the ${maxGallerySlots} limit.`);
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });

    try {
      const { session } = useAuthStore.getState();
      const uploadedUrls: string[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        setUploadProgress({ current: i + 1, total: filesToUpload.length });
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1'}/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        const data = await uploadRes.json();
        if (data.url) uploadedUrls.push(data.url);
      }

      if (uploadedUrls.length > 0) {
        const currentGallery = businessProfile?.gallery_images || [];
        const newGallery = [...currentGallery, ...uploadedUrls];

        const updateRes = await fetch(`${import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1'}/business/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            business_name: businessProfile?.business_name,
            gallery_images: newGallery,
            photo_album_url: profileData.photoAlbumUrl?.trim() || undefined,
          }),
        });

        if (updateRes.ok) {
          const updated = await updateRes.json();
          useAuthStore.setState({ businessProfile: updated });
          toast.success(`Added ${uploadedUrls.length} photo${uploadedUrls.length > 1 ? 's' : ''} to gallery!`);
        } else {
          throw new Error('Failed to save gallery changes');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToUploadPhoto'));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
      }
    }
  };

  const handleRemoveGalleryImage = async (indexToRemove: number) => {
    if (!businessProfile?.gallery_images) return;

    const updatedGallery = businessProfile.gallery_images.filter((_, index) => index !== indexToRemove);

    try {
      const { session } = useAuthStore.getState();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1'}/business/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_name: businessProfile.business_name,
          gallery_images: updatedGallery,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove image');
      }

      const updated = await response.json();
      useAuthStore.setState({ businessProfile: updated });
      toast.success(t('business.profile.photoRemoved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToRemovePhoto'));
    }
  };

  const galleryImages = businessProfile?.gallery_images || [];

  const selectedCityName = chinaCities.find(c => c.id === profileData.cityId)?.name || t('business.profile.notSet');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 p-6 lg:p-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#020b00] dark:text-white mb-2">{t('business.profile.communityProfile')}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t('business.profile.editYourProfileInfo')}</p>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isUploading || isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving || isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isEditing ? (
            <Save className="w-5 h-5" />
          ) : (
            <Edit className="w-5 h-5" />
          )}
          {isSaving ? t('business.profile.saving') : isUploading ? t('business.profile.uploading') : isEditing ? t('business.profile.saveChanges') : t('business.profile.editProfile')}
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none overflow-hidden">
        {/* Cover Image */}
        <div className="h-48 relative overflow-hidden bg-gradient-to-r from-[#d3da0c]/20 via-transparent to-[#d3da0c]/10">
          {(profile?.background_url || profile?.banner_url) ? (
            <img
              src={profile?.background_url || profile?.banner_url || ''}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          <input
            type="file"
            ref={bannerInputRef}
            onChange={handleBannerUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 bg-black/55 backdrop-blur-md border border-white/15 rounded-lg text-white text-xs font-medium hover:bg-black/75 transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-[#d3da0c]" /> : <Camera className="w-4 h-4 text-[#d3da0c]" />}
            <span>{(profile?.background_url || profile?.banner_url) ? 'Change Background' : 'Add Background'}</span>
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-8 pb-8 relative">
          {/* Avatar */}
          <div className="absolute -top-16 left-8">
            <div
              className="w-32 h-32 rounded-2xl bg-[#d3da0c] flex items-center justify-center text-4xl font-bold text-black border-4 border-white dark:border-[#111111] bg-cover bg-center overflow-hidden shadow-md"
              style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : {}}
            >
              {!profile?.avatar_url && (profileData.businessName ? profileData.businessName.charAt(0).toUpperCase() : '?')}
            </div>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 p-2 bg-[#d3da0c] rounded-lg text-black hover:bg-[#d3da0c]/90 transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>

          {/* Info */}
          <div className="pt-20">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={profileData.businessName}
                  onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2 text-[#020b00] dark:text-white text-2xl font-bold focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.businessNamePlaceholder')}
                />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">@</span>
                  <input
                    type="text"
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value.replace(/\s+/g, '') })}
                    className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                    placeholder={t('kit.editProfile.username', 'username')}
                  />
                </div>
                <textarea
                  value={profileData.description}
                  onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#d3da0c]"
                  rows={2}
                  placeholder={t('business.profile.descriptionPlaceholder')}
                />
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-[#020b00] dark:text-white">
                  {businessProfile?.business_name || t('business.profile.yourBusinessName')}
                </h3>
                {profile?.username && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{profile.username}</p>
                )}
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {businessProfile?.description || t('business.profile.addDescription')}
                </p>
              </>
            )}

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#020b00] dark:text-white">{stats?.business_stats?.total_events ?? 0}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('business.profile.events')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#020b00] dark:text-white">{profile?.followers_count || 0}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('business.profile.followers')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#020b00] dark:text-white">{galleryImages.length}</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('business.profile.photos')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Links & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
          <h4 className="text-lg font-semibold text-[#020b00] dark:text-white mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-[#d3da0c]" />
            {t('business.profile.businessDetails')}
          </h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.website}
                  onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                  className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.websitePlaceholder')}
                />
              ) : (
                <a
                  href={profileData.website ? (profileData.website.startsWith('http') ? profileData.website : `https://${profileData.website}`) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={profileData.website ? 'text-gray-700 dark:text-gray-300 hover:text-[#d3da0c]' : 'text-gray-400 dark:text-gray-500'}
                >
                  {profileData.website || t('business.profile.websiteNotConfigured')}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              {isEditing ? (
                <select
                  value={profileData.cityId}
                  onChange={(e) => setProfileData({ ...profileData, cityId: e.target.value })}
                  className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                >
                  <option value="">{t('business.profile.selectCity')}</option>
                  {chinaCities.filter(c => c.id !== 'all').map((city) => (
                    <option key={city.id} value={city.id} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">
                      {city.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-gray-700 dark:text-gray-400">
                  {t('business.profile.locationLabel', { city: selectedCityName })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.location}
                  onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                  className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.addressPlaceholder')}
                />
              ) : (
                <span className="text-gray-700 dark:text-gray-400">
                  {t('business.profile.addressLabel', { address: businessProfile?.address || t('business.profile.notSet') })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
          <h4 className="text-lg font-semibold text-[#020b00] dark:text-white mb-4">{t('business.profile.socialMedia')}</h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-pink-500" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.instagram}
                  onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value })}
                  className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.socialPlaceholder')}
                />
              ) : (
                <a
                  href={profile?.instagram ? `https://instagram.com/${profile.instagram.replace('@', '')}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={profile?.instagram ? 'text-gray-700 dark:text-gray-300 hover:text-[#d3da0c]' : 'text-gray-400 dark:text-gray-500'}
                >
                  {profile?.instagram || t('business.profile.addInstagramHandle')}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Twitter className="w-5 h-5 text-blue-400" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.twitter}
                  onChange={(e) => setProfileData({ ...profileData, twitter: e.target.value })}
                  className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.socialPlaceholder')}
                />
              ) : (
                <a
                  href={profile?.twitter ? `https://twitter.com/${profile.twitter.replace('@', '')}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={profile?.twitter ? 'text-gray-700 dark:text-gray-300 hover:text-[#d3da0c]' : 'text-gray-400 dark:text-gray-500'}
                >
                  {profile?.twitter || t('business.profile.addTwitterHandle')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Photo Album & External Link */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold text-[#020b00] dark:text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[#d3da0c]" />
            <span>Cloud Photo Album & External Link</span>
          </h4>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-xs mb-3">
          Connect your Google Cloud bucket, Google Drive folder, Baidu Netdisk, iCloud, or Dropbox album. Visitors and attendees can open this link from your public profile and event pages to view & download high-resolution event media.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={profileData.photoAlbumUrl || ''}
            onChange={(e) => setProfileData(prev => ({ ...prev, photoAlbumUrl: e.target.value }))}
            placeholder="https://drive.google.com/... or https://storage.googleapis.com/..."
            className="flex-1 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-[#020b00] dark:text-white text-sm focus:outline-none focus:border-[#d3da0c]"
          />
          <div className="flex items-center gap-2">
            {profileData.photoAlbumUrl && (
              <a
                href={profileData.photoAlbumUrl.startsWith('http') ? profileData.photoAlbumUrl : `https://${profileData.photoAlbumUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1 hover:text-[#d3da0c] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Test Link</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-xs font-bold shadow-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Link'}
            </button>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-lg font-semibold text-[#020b00] dark:text-white">{t('business.profile.eventPhotos')}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload multiple photos from your device (JPG, PNG, WebP up to 15MB each).</p>
          </div>
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">{galleryImages.length} / {maxGallerySlots}</span>
        </div>

        {uploadProgress && (
          <div className="mb-4 p-3 rounded-xl bg-[#d3da0c]/10 border border-[#d3da0c]/30 flex items-center gap-2 text-xs text-[#020b00] dark:text-white">
            <Loader2 className="w-4 h-4 animate-spin text-[#d3da0c]" />
            <span>Uploading photo {uploadProgress.current} of {uploadProgress.total}...</span>
          </div>
        )}

        <input
          type="file"
          ref={galleryInputRef}
          onChange={handleGalleryUpload}
          accept="image/*"
          multiple
          className="hidden"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Display existing gallery images */}
          {galleryImages.map((imageUrl, index) => (
            <div key={index} className="aspect-square rounded-xl overflow-hidden border border-black/10 dark:border-white/10 relative group">
              <img
                src={imageUrl}
                alt={t('business.profile.galleryImageAlt', { number: index + 1 })}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleRemoveGalleryImage(index)}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add new image slot (if not at max) */}
          {galleryImages.length < maxGallerySlots && (
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={isUploading}
              className="aspect-square bg-neutral-50 dark:bg-white/5 rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center hover:border-[#d3da0c]/50 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-7 h-7 text-gray-400 dark:text-gray-600 animate-spin" />
              ) : (
                <>
                  <Plus className="w-7 h-7 text-gray-400 dark:text-gray-600" />
                  <span className="text-[11px] text-gray-500 mt-1 font-medium">Upload Photos</span>
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-gray-500 dark:text-gray-400 text-xs mt-3">
          Select one or multiple photos to upload simultaneously. These photos appear on your public organizer profile.
        </p>
      </div>

      {/* Logout Section */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
        <h4 className="text-[#020b00] dark:text-white font-bold text-lg mb-4">{t('nav.account') || 'Account'}</h4>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20 font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>{t('nav.logout') || 'Logout'}</span>
        </button>
      </div>
    </motion.div>
  );
};

export default Profile;
