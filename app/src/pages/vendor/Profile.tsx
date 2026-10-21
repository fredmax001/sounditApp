import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Store, Check, Loader2, Globe, Mail, Phone, MapPin, LogOut, Shield, Camera
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://sounditent.com/api/v1';

const VendorProfile = () => {
  const { session, profile: authProfile, updateProfile: updateAuthProfile, uploadBanner, logout } = useAuthStore();
  const { profile: vendorProfile, fetchProfile, updateProfile } = useVendorStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isApplyingVerification, setIsApplyingVerification] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    business_name: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    city_id: '',
    vendor_type: '' as 'food' | 'merch' | 'service' | 'beverage' | ''
  });
  const [profileLogo, setProfileLogo] = useState<File | null>(null);
  const [profileLogoPreview, setProfileLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    if (session?.access_token) {
      fetchProfile(session.access_token).finally(() => setIsLoading(false));
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    if (vendorProfile) {
      setProfileForm({
        business_name: vendorProfile.business_name || '',
        description: vendorProfile.description || '',
        email: vendorProfile.email || '',
        phone: vendorProfile.phone || '',
        address: vendorProfile.address || '',
        website: vendorProfile.website || '',
        city_id: vendorProfile.city_id || '',
        vendor_type: vendorProfile.vendor_type || ''
      });
      setProfileLogoPreview(vendorProfile.logo_url || authProfile?.avatar_url || null);
      setBannerPreview(vendorProfile.banner_url || authProfile?.background_url || authProfile?.banner_url || null);
    }
  }, [vendorProfile, authProfile]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const url = await uploadBanner(file);
      setBannerPreview(url);
      if (session?.access_token && profileForm.business_name) {
        await updateProfile(session.access_token, {
          business_name: profileForm.business_name,
          banner_url: url,
        } as any).catch(() => {});
      }
      toast.success(t('business.profile.coverImageUpdated', 'Background image updated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('business.profile.failedToUploadCoverImage', 'Failed to upload background image'));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('vendor.profile.logoSizeError'));
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(t('vendor.profile.invalidImageError'));
        return;
      }
      setProfileLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File, token: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || t('vendor.profile.uploadImageError'));
      }

      const data = await response.json();
      return data.url;
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      toast.error(error instanceof Error ? error.message : t('vendor.profile.uploadImageError'));
      return null;
    }
  };

  const uploadLogo = async (token: string): Promise<string | null> => {
    if (!profileLogo) return null;
    setIsUploadingLogo(true);
    try {
      return await uploadImage(profileLogo, token);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!session?.access_token) {
      toast.error(t('vendor.profile.notAuthenticated'));
      return;
    }

    if (!profileForm.business_name) {
      toast.error(t('vendor.profile.businessNameRequired'));
      return;
    }

    setIsSaving(true);

    try {
      // Upload logo if selected
      let logoUrl = vendorProfile?.logo_url;
      if (profileLogo) {
        const uploadedUrl = await uploadLogo(session.access_token);
        if (uploadedUrl) logoUrl = uploadedUrl;
      }

      await updateProfile(session.access_token, {
        business_name: profileForm.business_name,
        description: profileForm.description || undefined,
        email: profileForm.email || undefined,
        phone: profileForm.phone || undefined,
        address: profileForm.address || undefined,
        website: profileForm.website || undefined,
        city_id: profileForm.city_id || undefined,
        vendor_type: profileForm.vendor_type || undefined,
        logo_url: logoUrl,
        ...(bannerPreview ? { banner_url: bannerPreview } : {}),
      } as any);

      // Sync vendor logo to auth profile avatar so sidebar updates
      if (logoUrl && updateAuthProfile) {
        await updateAuthProfile({ avatar_url: logoUrl });
      }

      toast.success(t('vendor.profile.updateSuccess'));
      setProfileLogo(null);
      fetchProfile(session.access_token);
    } catch (error: unknown) {
      console.error('Update profile error:', error);
      toast.error(error instanceof Error ? error.message : t('vendor.profile.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 lg:pt-10 pb-4 px-4 lg:px-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#020b00] dark:text-white">{t('vendor.profile.title')}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{t('vendor.profile.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {vendorProfile?.is_approved ? (
            <span className="px-4 py-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-bold flex items-center gap-2 border border-blue-500/20">
              <Check className="w-4 h-4" />
              {t('vendor.profile.approved') || 'Approved'}
            </span>
          ) : (
            <span className="px-4 py-2 bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full text-sm font-bold flex items-center gap-2 border border-yellow-500/20">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('vendor.profile.pendingApproval') || 'Pending Approval'}
            </span>
          )}
          {vendorProfile?.is_verified && (
            <span className="px-4 py-2 bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full text-sm font-bold flex items-center gap-2 border border-green-500/20">
              <Check className="w-4 h-4" />
              {t('vendor.profile.verifiedVendor')}
            </span>
          )}
        </div>
      </div>

      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs dark:shadow-none"
      >
        {/* Vendor Cover / Background Image Banner */}
        <div className="relative h-44 sm:h-52 overflow-hidden bg-gradient-to-r from-[#d3da0c]/20 via-[#FF2D8F]/15 to-[#020b00] border-b border-black/10 dark:border-white/10">
          {bannerPreview ? (
            <img src={bannerPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : profileLogoPreview ? (
            <img src={profileLogoPreview} alt="" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/70" />
          <label className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-xs font-medium text-white cursor-pointer transition-colors">
            <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" disabled={isUploadingBanner} />
            {isUploadingBanner ? <Loader2 className="w-4 h-4 text-[#d3da0c] animate-spin" /> : <Camera className="w-4 h-4 text-[#d3da0c]" />}
            <span>{bannerPreview ? 'Change Background' : 'Add Background'}</span>
          </label>
        </div>

        <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Logo & Basic Info */}
          <div className="space-y-6 order-2 lg:order-1">
            {/* Logo Upload */}
            <div className="bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-6">
              <label className="block text-sm text-gray-700 dark:text-gray-400 mb-4 font-medium">{t('vendor.profile.businessLogo')}</label>
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                  {profileLogoPreview ? (
                    <img
                      src={profileLogoPreview}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div className="w-full">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#020b00] file:text-[#d3da0c] dark:file:bg-[#d3da0c] dark:file:text-black file:font-bold hover:file:opacity-90"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                    {t('vendor.profile.logoHint')}
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Status */}
            <div className="bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-6">
              <h4 className="text-[#020b00] dark:text-white font-bold mb-4">{t('vendor.profile.accountStatus')}</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('vendor.profile.approvalStatus') || 'Approval Status'}</span>
                  <span className={`font-bold ${vendorProfile?.is_approved ? 'text-blue-500 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'}`}>
                    {vendorProfile?.is_approved ? (t('vendor.profile.approved') || 'Approved') : (t('vendor.profile.pendingApproval') || 'Pending Approval')}
                  </span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-600 dark:text-gray-400">{t('vendor.profile.verificationStatus') || 'Verification Status'}</span>
                  {vendorProfile?.is_verified ? (
                    <span className="font-bold text-green-500 dark:text-green-400">
                      {t('vendor.profile.verified') || 'Verified'}
                    </span>
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
                            body: JSON.stringify({ request_type: 'vendor' })
                          });
                          if (res.ok) {
                            toast.success(t('vendor.profile.verificationApplied') || 'Verification request submitted');
                          } else {
                            const err = await res.json();
                            toast.error(err.detail || (t('vendor.profile.verificationApplyFailed') || 'Failed to apply'));
                          }
                        } catch {
                          toast.error(t('vendor.profile.verificationApplyFailed') || 'Failed to apply');
                        } finally {
                          setIsApplyingVerification(false);
                        }
                      }}
                      disabled={isApplyingVerification}
                      className="flex items-center gap-1 px-2.5 py-1 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-[#d3da0c]/20 border border-black/10 dark:border-white/10 rounded-full text-xs text-gray-700 dark:text-gray-300 hover:text-[#020b00] dark:hover:text-[#d3da0c] transition-colors disabled:opacity-50"
                    >
                      {isApplyingVerification ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                      {t('vendor.profile.applyForVerification') || 'Apply'}
                    </button>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{t('vendor.profile.memberSince')}</span>
                  <span className="text-[#020b00] dark:text-white font-medium">
                    {(vendorProfile as unknown as Record<string, unknown>)?.created_at
                      ? new Date((vendorProfile as unknown as Record<string, unknown>).created_at as string).toLocaleDateString()
                      : t('vendor.profile.na')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form Fields */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">
            {/* Business Information */}
            <div className="bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-6 space-y-4">
              <h4 className="text-[#020b00] dark:text-white font-bold text-lg">{t('vendor.profile.businessInformation')}</h4>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium">
                  {t('vendor.profile.businessNameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t('vendor.profile.businessNamePlaceholder')}
                  value={profileForm.business_name}
                  onChange={(e) => handleProfileChange('business_name', e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium">{t('vendor.profile.businessCategory')}</label>
                <select
                  value={profileForm.vendor_type}
                  onChange={(e) => handleProfileChange('vendor_type', e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white focus:border-[#d3da0c] outline-hidden"
                >
                  <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('vendor.profile.selectCategory')}</option>
                  <option value="food" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('vendor.profile.categoryFood')}</option>
                  <option value="beverage" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('vendor.profile.categoryBeverage')}</option>
                  <option value="merch" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('vendor.profile.categoryMerchandise')}</option>
                  <option value="service" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('vendor.profile.categoryService')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium">{t('vendor.profile.city') || 'City'}</label>
                <select
                  value={profileForm.city_id}
                  onChange={(e) => handleProfileChange('city_id', e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white focus:border-[#d3da0c] outline-hidden"
                >
                  <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">Select city</option>
                  {chinaCities.map((city) => (
                    <option key={city.id} value={city.id} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium">{t('vendor.profile.businessDescription')}</label>
                <textarea
                  placeholder={t('vendor.profile.businessDescriptionPlaceholder')}
                  rows={4}
                  value={profileForm.description}
                  onChange={(e) => handleProfileChange('description', e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-hidden resize-none"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-neutral-50 dark:bg-white/5 border border-black/8 dark:border-white/10 rounded-xl p-6 space-y-4">
              <h4 className="text-[#020b00] dark:text-white font-bold text-lg">{t('vendor.profile.contactInformation')}</h4>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('vendor.profile.emailLabel')}
                  </label>
                  <input
                    type="email"
                    placeholder={t('vendor.profile.emailPlaceholder')}
                    value={profileForm.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t('vendor.profile.phoneLabel')}
                  </label>
                  <input
                    type="tel"
                    placeholder={t('vendor.profile.phonePlaceholder')}
                    value={profileForm.phone}
                    onChange={(e) => handleProfileChange('phone', e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('vendor.profile.addressLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('vendor.profile.addressPlaceholder')}
                  value={profileForm.address}
                  onChange={(e) => handleProfileChange('address', e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-400 mb-2 font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t('vendor.profile.websiteLabel')}
                </label>
                <input
                  type="url"
                  placeholder={t('vendor.profile.websitePlaceholder')}
                  value={profileForm.website}
                  onChange={(e) => handleProfileChange('website', e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] outline-hidden"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || isUploadingLogo}
                className="flex items-center gap-2 px-8 py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {isSaving || isUploadingLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('vendor.profile.saving')}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {t('vendor.profile.saveChanges')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Logout Section */}
      <div className="mt-6">
        <div className="bg-white dark:bg-[#111111] rounded-xl p-6 border border-black/8 dark:border-white/5 shadow-xs dark:shadow-none">
          <h4 className="text-[#020b00] dark:text-white font-bold text-lg mb-4">{t('nav.account') || 'Account'}</h4>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors border border-red-500/20"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('nav.logout') || 'Logout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorProfile;
