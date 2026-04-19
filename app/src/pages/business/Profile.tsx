import { motion } from 'framer-motion';
import { Store, Camera, Link2, Instagram, Twitter, Globe, Edit, Save, Loader2, X, Plus, MapPin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { t } = useTranslation();
  const { profile, businessProfile, uploadAvatar, uploadBanner, uploadGalleryImage, updateProfile, updateBusinessProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    businessName: businessProfile?.business_name || '',
    description: businessProfile?.description || '',
    website: '',
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
        description: businessProfile?.description || prev.description,
        website: businessProfile?.website || prev.website,
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

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingGalleryIndex(0);
    try {
      await uploadGalleryImage(file);
      toast.success(t('business.profile.photoAddedToGallery'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToUploadPhoto'));
    } finally {
      setUploadingGalleryIndex(null);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/business/profile`, {
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
  const maxGallerySlots = 8;

  const selectedCityName = chinaCities.find(c => c.id === profileData.cityId)?.name || t('business.profile.notSet');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t('business.profile.communityProfile')}</h2>
          <p className="text-gray-400">{t('business.profile.editYourProfileInfo')}</p>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isUploading || isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-[#d3da0c] text-black rounded-lg font-medium hover:bg-[#d3da0c]/90 transition-colors disabled:opacity-50"
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
      <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
        {/* Cover Image */}
        <div
          className="h-48 bg-gradient-to-r from-[#d3da0c]/20 via-[#FF2D8F]/20 to-[#d3da0c]/20 relative bg-cover bg-center"
          style={profile?.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : {}}
        >
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
            className="absolute bottom-4 right-4 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-8 pb-8 relative">
          {/* Avatar */}
          <div className="absolute -top-16 left-8">
            <div
              className="w-32 h-32 rounded-2xl bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center text-4xl font-bold text-black border-4 border-[#111111] bg-cover bg-center overflow-hidden"
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
              <div className="space-y-4">
                <input
                  type="text"
                  value={profileData.businessName}
                  onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-white text-2xl font-bold focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.businessNamePlaceholder')}
                />
                <textarea
                  value={profileData.description}
                  onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2 text-gray-400 focus:outline-none focus:border-[#d3da0c]"
                  rows={2}
                  placeholder={t('business.profile.descriptionPlaceholder')}
                />
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-white">
                  {businessProfile?.business_name || t('business.profile.yourBusinessName')}
                </h3>
                <p className="text-gray-400 mt-1">
                  {businessProfile?.description || t('business.profile.addDescription')}
                </p>
              </>
            )}

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{businessProfile?.total_events || 0}</p>
                <p className="text-gray-500 text-sm">{t('business.profile.events')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{profile?.followers_count || 0}</p>
                <p className="text-gray-500 text-sm">{t('business.profile.followers')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{galleryImages.length}</p>
                <p className="text-gray-500 text-sm">{t('business.profile.photos')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Links & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-[#d3da0c]" />
            {t('business.profile.businessDetails')}
          </h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-500" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.website}
                  onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.websitePlaceholder')}
                />
              ) : (
                <a
                  href={profileData.website ? (profileData.website.startsWith('http') ? profileData.website : `https://${profileData.website}`) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={profileData.website ? 'text-gray-300 hover:text-[#d3da0c]' : 'text-gray-500'}
                >
                  {profileData.website || t('business.profile.websiteNotConfigured')}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-500" />
              {isEditing ? (
                <select
                  value={profileData.cityId}
                  onChange={(e) => setProfileData({ ...profileData, cityId: e.target.value })}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                >
                  <option value="">{t('business.profile.selectCity')}</option>
                  {chinaCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-gray-400">
                  {t('business.profile.locationLabel', { city: selectedCityName })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-gray-500" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.location}
                  onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.addressPlaceholder')}
                />
              ) : (
                <span className="text-gray-400">
                  {t('business.profile.addressLabel', { address: businessProfile?.address || t('business.profile.notSet') })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
          <h4 className="text-lg font-semibold text-white mb-4">{t('business.profile.socialMedia')}</h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-pink-500" />
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.instagram}
                  onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value })}
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.socialPlaceholder')}
                />
              ) : (
                <a
                  href={profile?.instagram ? `https://instagram.com/${profile.instagram.replace('@', '')}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={profile?.instagram ? 'text-gray-300 hover:text-[#d3da0c]' : 'text-gray-500'}
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
                  className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-[#d3da0c]"
                  placeholder={t('business.profile.socialPlaceholder')}
                />
              ) : (
                <a
                  href={profile?.twitter ? `https://twitter.com/${profile.twitter.replace('@', '')}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={profile?.twitter ? 'text-gray-300 hover:text-[#d3da0c]' : 'text-gray-500'}
                >
                  {profile?.twitter || t('business.profile.addTwitterHandle')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="bg-[#111111] rounded-xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">{t('business.profile.eventPhotos')}</h4>
          <span className="text-gray-500 text-sm">{galleryImages.length} / {maxGallerySlots}</span>
        </div>

        <input
          type="file"
          ref={galleryInputRef}
          onChange={handleGalleryUpload}
          accept="image/*"
          className="hidden"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Display existing gallery images */}
          {galleryImages.map((imageUrl, index) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden border border-white/10 relative group">
              <img
                src={imageUrl}
                alt={t('business.profile.galleryImageAlt', { number: index + 1 })}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleRemoveGalleryImage(index)}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Add new image slot (if not at max) */}
          {galleryImages.length < maxGallerySlots && (
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGalleryIndex !== null}
              className="aspect-square bg-[#0A0A0A] rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center hover:border-[#d3da0c]/50 transition-colors disabled:opacity-50"
            >
              {uploadingGalleryIndex !== null ? (
                <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
              ) : (
                <Plus className="w-8 h-8 text-gray-600" />
              )}
            </button>
          )}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, maxGallerySlots - galleryImages.length - 1) }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="aspect-square bg-[#0A0A0A] rounded-lg border-2 border-dashed border-white/5 flex items-center justify-center"
            >
              <Camera className="w-8 h-8 text-gray-700" />
            </div>
          ))}
        </div>

        <p className="text-gray-500 text-sm mt-3">
          {t('business.profile.uploadPhotosHint')}
        </p>
      </div>
    </motion.div>
  );
};

export default Profile;
