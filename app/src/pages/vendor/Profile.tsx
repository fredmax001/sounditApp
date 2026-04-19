import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Store, Check, Loader2, Globe, Mail, Phone, MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { chinaCities } from '@/data/constants';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const VendorProfile = () => {
  const { session } = useAuthStore();
  const { profile: vendorProfile, fetchProfile, updateProfile } = useVendorStore();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

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
      setProfileLogoPreview(vendorProfile.logo_url || null);
    }
  }, [vendorProfile]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
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
        logo_url: logoUrl
      });

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
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/vendor"
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white">{t('vendor.profile.title')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('vendor.profile.subtitle')}</p>
          </div>
        </div>
        {vendorProfile?.is_verified && (
          <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-bold flex items-center gap-2">
            <Check className="w-4 h-4" />
            {t('vendor.profile.verifiedVendor')}
          </span>
        )}
      </div>

      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-[#111111] border border-white/10 rounded-2xl p-6 lg:p-8"
      >
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Logo & Basic Info */}
          <div className="space-y-6">
            {/* Logo Upload */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <label className="block text-sm text-gray-400 mb-4">{t('vendor.profile.businessLogo')}</label>
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                  {profileLogoPreview ? (
                    <img
                      src={profileLogoPreview}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-12 h-12 text-gray-500" />
                  )}
                </div>
                <div className="w-full">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#d3da0c] file:text-black file:font-bold hover:file:bg-[#bbc10b]"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {t('vendor.profile.logoHint')}
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Status */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h4 className="text-white font-bold mb-4">{t('vendor.profile.accountStatus')}</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('vendor.profile.statusLabel')}</span>
                  <span className="text-green-400 font-bold">
                    {vendorProfile?.is_verified ? t('vendor.profile.statusVerified') : t('vendor.profile.statusPending')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{t('vendor.profile.memberSince')}</span>
                  <span className="text-white">
                    {(vendorProfile as unknown as Record<string, unknown>)?.created_at
                      ? new Date((vendorProfile as unknown as Record<string, unknown>).created_at as string).toLocaleDateString()
                      : t('vendor.profile.na')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Information */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <h4 className="text-white font-bold text-lg">{t('vendor.profile.businessInformation')}</h4>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t('vendor.profile.businessNameLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t('vendor.profile.businessNamePlaceholder')}
                  value={profileForm.business_name}
                  onChange={(e) => handleProfileChange('business_name', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('vendor.profile.businessCategory')}</label>
                <select
                  value={profileForm.vendor_type}
                  onChange={(e) => handleProfileChange('vendor_type', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                >
                  <option value="" className="bg-[#111111]">{t('vendor.profile.selectCategory')}</option>
                  <option value="food" className="bg-[#111111]">{t('vendor.profile.categoryFood')}</option>
                  <option value="beverage" className="bg-[#111111]">{t('vendor.profile.categoryBeverage')}</option>
                  <option value="merch" className="bg-[#111111]">{t('vendor.profile.categoryMerchandise')}</option>
                  <option value="service" className="bg-[#111111]">{t('vendor.profile.categoryService')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('vendor.profile.city') || 'City'}</label>
                <select
                  value={profileForm.city_id}
                  onChange={(e) => handleProfileChange('city_id', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#d3da0c] outline-none"
                >
                  <option value="" className="bg-[#111111]">Select city</option>
                  {chinaCities.map((city) => (
                    <option key={city.id} value={city.id} className="bg-[#111111]">
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('vendor.profile.businessDescription')}</label>
                <textarea
                  placeholder={t('vendor.profile.businessDescriptionPlaceholder')}
                  rows={4}
                  value={profileForm.description}
                  onChange={(e) => handleProfileChange('description', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none resize-none"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
              <h4 className="text-white font-bold text-lg">{t('vendor.profile.contactInformation')}</h4>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {t('vendor.profile.emailLabel')}
                  </label>
                  <input
                    type="email"
                    placeholder={t('vendor.profile.emailPlaceholder')}
                    value={profileForm.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {t('vendor.profile.phoneLabel')}
                  </label>
                  <input
                    type="tel"
                    placeholder={t('vendor.profile.phonePlaceholder')}
                    value={profileForm.phone}
                    onChange={(e) => handleProfileChange('phone', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {t('vendor.profile.addressLabel')}
                </label>
                <input
                  type="text"
                  placeholder={t('vendor.profile.addressPlaceholder')}
                  value={profileForm.address}
                  onChange={(e) => handleProfileChange('address', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t('vendor.profile.websiteLabel')}
                </label>
                <input
                  type="url"
                  placeholder={t('vendor.profile.websitePlaceholder')}
                  value={profileForm.website}
                  onChange={(e) => handleProfileChange('website', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] outline-none"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || isUploadingLogo}
                className="flex items-center gap-2 px-8 py-3 bg-[#d3da0c] text-black rounded-lg font-bold hover:bg-[#bbc10b] transition-all disabled:opacity-50"
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
    </div>
  );
};

export default VendorProfile;
