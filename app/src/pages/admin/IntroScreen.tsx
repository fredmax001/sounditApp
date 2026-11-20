import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Loader2, Image as ImageIcon, Trash2, Eye, Save, Upload,
  Megaphone, ExternalLink, Clock
} from 'lucide-react';

interface IntroSettings {
  enabled: boolean;
  logo_url: string;
  title: string;
  tagline: string;
  show_ad?: boolean;
  ad_image_url?: string;
  ad_title?: string;
  ad_link_url?: string;
  ad_badge?: string;
  duration_seconds?: number;
}

const DEFAULTS: IntroSettings = {
  enabled: true,
  logo_url: '',
  title: '',
  tagline: 'YOUR GATEWAY TO ENTERTAINMENT IN CHINA.',
  show_ad: false,
  ad_image_url: '',
  ad_title: '',
  ad_link_url: '',
  ad_badge: 'Featured Sponsor',
  duration_seconds: 3.5,
};

const IntroScreen = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [settings, setSettings] = useState<IntroSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAd, setUploadingAd] = useState(false);

  const auth = () => ({ Authorization: `Bearer ${session?.access_token}` });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/intro-screen`, { headers: auth() });
        if (res.ok) {
          const data = await res.json();
          setSettings({ ...DEFAULTS, ...data });
        }
      } catch {
        toast.error(t('admin.introScreen.failedToLoad') || 'Failed to load intro screen settings');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleImageUpload = async (file: File, target: 'logo' | 'ad') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    if (target === 'logo') setUploadingLogo(true);
    else setUploadingAd(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: auth(),
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const url = data.url || data.file_url;
      if (!url) throw new Error('No URL returned');
      
      if (target === 'logo') {
        setSettings(prev => ({ ...prev, logo_url: url }));
        toast.success('Logo uploaded successfully');
      } else {
        setSettings(prev => ({ ...prev, ad_image_url: url, show_ad: true }));
        toast.success('Ad banner uploaded successfully');
      }
    } catch {
      toast.error('Upload failed. Please check connection and try again.');
    } finally {
      if (target === 'logo') setUploadingLogo(false);
      else setUploadingAd(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/intro-screen`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          logo_url: settings.logo_url,
          title: settings.title,
          tagline: settings.tagline,
          show_ad: settings.show_ad,
          ad_image_url: settings.ad_image_url,
          ad_title: settings.ad_title,
          ad_link_url: settings.ad_link_url,
          ad_badge: settings.ad_badge,
          duration_seconds: settings.duration_seconds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Save failed');
      }
      toast.success(t('admin.introScreen.saved') || 'Intro screen & ads configuration updated');
    } catch (e: any) {
      toast.error(e.message || t('admin.introScreen.saveFailed') || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const previewLogo = settings.logo_url || '/intro_drum.png';

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#020b00] dark:text-white flex items-center gap-2">
            {t('admin.introScreen.title') || 'Intro Screen & Splash Ads'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin.introScreen.subtitle') || 'Configure brand animations, promotional ads, and sponsor splash screens.'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || uploadingLogo || uploadingAd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#d3da0c] text-black font-bold rounded-xl hover:bg-[#c2c80b] transition-all disabled:opacity-50 shadow-md"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save') || 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="space-y-6">
          {/* Main Branding Card */}
          <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/8 dark:border-white/10 pb-4">
              <div>
                <h2 className="text-[#020b00] dark:text-white font-bold text-base">
                  {t('admin.introScreen.enableSection') || 'Splash Screen Status'}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                  Enable animated loading screen during app boot
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d3da0c]" />
              </label>
            </div>

            {/* Custom Logo */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                Brand Logo (Optional)
              </label>
              {settings.logo_url ? (
                <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl">
                  <img src={settings.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded-lg bg-black/40 p-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#020b00] dark:text-white font-medium truncate">{settings.logo_url}</p>
                    <p className="text-[0.6875rem] text-gray-500">Custom logo active</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings(prev => ({ ...prev, logo_url: '' }))}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-black/15 dark:border-white/10 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors bg-neutral-50/50 dark:bg-white/5">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'logo');
                    }}
                  />
                  {uploadingLogo ? (
                    <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-[#d3da0c] mb-1" />
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Click to upload brand logo</span>
                      <span className="text-[0.625rem] text-gray-500 mt-0.5">PNG transparent recommended, up to 5MB</span>
                    </>
                  )}
                </label>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                Custom Headline (Optional)
              </label>
              <input
                type="text"
                value={settings.title}
                maxLength={80}
                onChange={(e) => setSettings(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. SOUND IT ENTERTAINMENT"
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
              />
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                Tagline / Slogan
              </label>
              <input
                type="text"
                value={settings.tagline}
                maxLength={120}
                onChange={(e) => setSettings(prev => ({ ...prev, tagline: e.target.value }))}
                placeholder="e.g. Your gateway to entertainment in China"
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
              />
            </div>
          </div>

          {/* Intro Screen Ads / Sponsor Spotlight */}
          <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/8 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#d3da0c]/15 text-yellow-700 dark:text-[#d3da0c]">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-[#020b00] dark:text-white font-bold text-base">
                    Intro Screen Ad / Sponsor Spotlight
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                    Show promotional ad banner or sponsor card on splash screen
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.show_ad || false}
                  onChange={(e) => setSettings(prev => ({ ...prev, show_ad: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d3da0c]" />
              </label>
            </div>

            {settings.show_ad && (
              <div className="space-y-4 pt-2">
                {/* Ad Badge */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    Ad Badge / Callout
                  </label>
                  <input
                    type="text"
                    value={settings.ad_badge || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, ad_badge: e.target.value }))}
                    placeholder="e.g. Featured Sponsor, Special Event, Exclusive Partner"
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
                  />
                </div>

                {/* Ad Title */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    Ad Headline
                  </label>
                  <input
                    type="text"
                    value={settings.ad_title || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, ad_title: e.target.value }))}
                    placeholder="e.g. Shanghai Halloween Party 2026 — Early Bird VIP Tickets"
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
                  />
                </div>

                {/* Ad Banner Image */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    Ad Banner Image
                  </label>
                  {settings.ad_image_url ? (
                    <div className="relative rounded-xl overflow-hidden bg-black/40 border border-black/10 dark:border-white/10 group mb-2">
                      <img src={settings.ad_image_url} alt="Ad Banner" className="w-full h-36 object-cover" />
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, ad_image_url: '' }))}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-black/15 dark:border-white/10 rounded-xl cursor-pointer hover:border-[#d3da0c]/50 transition-colors bg-neutral-50/50 dark:bg-white/5">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'ad');
                        }}
                      />
                      {uploadingAd ? (
                        <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-[#d3da0c] mb-1" />
                          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Click to upload ad banner</span>
                          <span className="text-[0.625rem] text-gray-500 mt-0.5">High quality landscape image (16:9 or 4:3)</span>
                        </>
                      )}
                    </label>
                  )}
                  <input
                    type="url"
                    value={settings.ad_image_url || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, ad_image_url: e.target.value }))}
                    placeholder="Or paste banner image URL (https://...)"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white text-xs placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
                  />
                </div>

                {/* Click-through Link */}
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    Click-Through Link URL
                  </label>
                  <input
                    type="text"
                    value={settings.ad_link_url || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, ad_link_url: e.target.value }))}
                    placeholder="e.g. /events/13 or https://partner.com"
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none text-sm"
                  />
                </div>

                {/* Display Duration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-700 dark:text-gray-300 text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#d3da0c]" />
                      Ad Display Duration
                    </label>
                    <span className="text-xs font-bold text-[#d3da0c]">
                      {settings.duration_seconds || 3.5}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2.5"
                    max="6.0"
                    step="0.5"
                    value={settings.duration_seconds || 3.5}
                    onChange={(e) => setSettings(prev => ({ ...prev, duration_seconds: parseFloat(e.target.value) }))}
                    className="w-full accent-[#d3da0c] cursor-pointer"
                  />
                  <div className="flex justify-between text-[0.6875rem] text-gray-500 mt-1">
                    <span>2.5s (Fast)</span>
                    <span>3.5s (Recommended)</span>
                    <span>6.0s (Long)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Interactive Preview */}
        <div className="bg-white dark:bg-[#111111] border border-black/8 dark:border-white/10 shadow-xs dark:shadow-none rounded-2xl p-6 sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#d3da0c]" />
              <h2 className="text-[#020b00] dark:text-white font-bold text-sm">
                Live Intro Screen Preview
              </h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-semibold">
              Real Device View
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-[#020b00] aspect-[9/16] max-h-[580px] mx-auto flex flex-col items-center justify-center p-6 border-2 border-black/15 dark:border-white/10 shadow-2xl">
            {/* Ambient Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 rounded-full bg-[#d3da0c] opacity-15 blur-[60px]" />
            </div>

            {/* Skip Button Simulation */}
            <div className="absolute top-4 right-4 z-20">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[0.625rem] text-white/80">
                <span>Skip</span>
                <span className="text-[0.5625rem]">✕</span>
              </div>
            </div>

            {/* Drum / Logo */}
            <div className="relative z-10 flex flex-col items-center text-center w-full">
              <div className="relative mb-3">
                <img
                  src={previewLogo}
                  alt="Sound It"
                  className="h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(211,218,12,0.45)]"
                />
              </div>

              {/* Title or Sound Logo */}
              {settings.title ? (
                <p className="text-white text-lg font-black tracking-wide mb-1 drop-shadow-md">{settings.title}</p>
              ) : (
                <img src="/intro_sound.png" alt="Sound It" className="h-10 w-auto object-contain mb-1" />
              )}
              <p className="text-[#d3da0c] text-[0.625rem] font-semibold tracking-wider uppercase">
                {settings.tagline || DEFAULTS.tagline}
              </p>

              {/* Simulated Ad Card */}
              {settings.show_ad && settings.ad_image_url && (
                <div className="mt-5 w-full bg-[#111111]/90 border border-[#d3da0c]/40 rounded-xl p-2.5 text-left shadow-xl">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#d3da0c]/15 text-[#d3da0c] text-[0.5rem] font-bold uppercase">
                      {settings.ad_badge || 'Featured Sponsor'}
                    </span>
                    <span className="text-gray-400 flex items-center gap-0.5 text-[0.5625rem]">
                      Visit <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <div className="w-full h-24 rounded-lg overflow-hidden bg-black/40 mb-1.5">
                    <img src={settings.ad_image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  {settings.ad_title && (
                    <p className="text-white text-xs font-bold line-clamp-1">
                      {settings.ad_title}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Loading Spinner Simulation */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
              <div className="w-6 h-6 rounded-full border-2 border-neutral-700 border-t-[#d3da0c] animate-spin" />
              <p className="text-gray-500 text-[0.625rem]">Loading Sound It...</p>
            </div>
          </div>

          <p className="text-gray-500 text-xs text-center mt-3">
            Mobile apps, PWA, and desktop web immediately adapt to these settings upon launch.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;
