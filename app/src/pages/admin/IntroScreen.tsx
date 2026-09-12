import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL } from '@/config/api';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, Image as ImageIcon, Trash2, Eye, Save, Upload,
} from 'lucide-react';

interface IntroSettings {
  enabled: boolean;
  logo_url: string;
  title: string;
  tagline: string;
}

const DEFAULTS: IntroSettings = {
  enabled: true,
  logo_url: '',
  title: '',
  tagline: '5 years of Excellence in Entertainment',
};

const IntroScreen = () => {
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const [settings, setSettings] = useState<IntroSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('admin.introScreen.onlyImages') || 'Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.introScreen.imageTooLarge') || 'Image must be less than 5MB');
      return;
    }
    setUploading(true);
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
      setSettings(prev => ({ ...prev, logo_url: url }));
      toast.success(t('admin.introScreen.logoUploaded') || 'Logo uploaded');
    } catch {
      toast.error(t('admin.introScreen.uploadFailed') || 'Logo upload failed');
    } finally {
      setUploading(false);
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
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Save failed');
      }
      toast.success(t('admin.introScreen.saved') || 'Intro screen updated');
    } catch (e: any) {
      toast.error(e.message || t('admin.introScreen.saveFailed') || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const previewLogo = settings.logo_url || '/logo.png';

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-[#d3da0c] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#d3da0c]" />
            {t('admin.introScreen.title') || 'Intro Screen'}
          </h1>
          <p className="text-gray-400 mt-1">
            {t('admin.introScreen.subtitle') || 'Customize the splash screen shown when the app loads'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save') || 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">
                {t('admin.introScreen.enabled') || 'Show intro screen'}
              </p>
              <p className="text-gray-500 text-xs">
                {t('admin.introScreen.enabledHint') || 'Disable to skip the splash screen on app load'}
              </p>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${settings.enabled ? 'bg-[#d3da0c]' : 'bg-white/20'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('admin.introScreen.logo') || 'Logo'}
            </label>
            {settings.logo_url ? (
              <div className="flex items-center gap-4 border border-white/10 rounded-lg p-3 bg-white/5">
                <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                  <img src={previewLogo} alt="" className="max-w-full max-h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{settings.logo_url.split('/').pop()}</p>
                  <p className="text-gray-500 text-xs truncate">{settings.logo_url}</p>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, logo_url: '' }))}
                  className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg transition-colors"
                  title={t('common.remove') || 'Remove'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-white/10 hover:border-[#d3da0c]/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white/[0.02]">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                    e.target.value = '';
                  }}
                />
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-[#d3da0c] mb-1" />
                    <span className="text-sm text-gray-300 font-medium">
                      {t('admin.introScreen.uploadLogo') || 'Click to upload logo'}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">PNG (transparent), up to 5MB</span>
                  </>
                )}
              </label>
            )}
            <input
              type="url"
              value={settings.logo_url}
              onChange={(e) => setSettings(prev => ({ ...prev, logo_url: e.target.value }))}
              placeholder={t('admin.introScreen.logoUrlPlaceholder') || 'Or paste an image URL (https://...)'}
              className="mt-2 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('admin.introScreen.titleLabel') || 'Title (optional)'}
            </label>
            <input
              type="text"
              value={settings.title}
              maxLength={80}
              onChange={(e) => setSettings(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('admin.introScreen.titlePlaceholder') || 'e.g. Welcome to Sound It'}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              {t('admin.introScreen.taglineLabel') || 'Tagline'}
            </label>
            <textarea
              value={settings.tagline}
              maxLength={120}
              rows={2}
              onChange={(e) => setSettings(prev => ({ ...prev, tagline: e.target.value }))}
              placeholder={t('admin.introScreen.taglinePlaceholder') || 'e.g. 5 years of Excellence in Entertainment'}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-[#d3da0c]" />
            <h2 className="text-white font-semibold text-sm">
              {t('admin.introScreen.preview') || 'Live Preview'}
            </h2>
          </div>
          <div className="relative rounded-xl overflow-hidden bg-[#0A0A0A] aspect-[4/5] max-h-[420px] flex items-center justify-center border border-white/5">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(rgba(211,218,12,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(211,218,12,0.3) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
            <div className="relative z-10 flex flex-col items-center px-6 text-center">
              <div className="relative mb-6">
                <img src={previewLogo} alt="" className="w-36 h-auto" style={{ filter: 'drop-shadow(0 0 18px rgba(211,218,12,0.5))' }} />
              </div>
              {settings.title ? (
                <p className="text-white text-lg font-extrabold tracking-wide mb-2">{settings.title}</p>
              ) : null}
              <p className="text-[#d3da0c] text-[11px] tracking-[0.3em] uppercase font-medium">
                {settings.tagline || DEFAULTS.tagline}
              </p>
              <div className="w-36 h-1 bg-gray-800 rounded-full mt-8 overflow-hidden">
                <div className="h-full w-2/3 bg-[#d3da0c] rounded-full" />
              </div>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-3 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            {t('admin.introScreen.previewHint') || 'This is how the intro screen appears when the app loads.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;
