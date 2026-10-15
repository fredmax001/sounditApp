import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2, MapPin, Link2, Mail, Phone, User, Camera, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { chinaCities } from '@/data/constants';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import GoogleAuthButton from '@/components/GoogleAuthButton';

interface MeResponse {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  bio?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_city?: string | null;
  avatar_url?: string | null;
}

const EditProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, profile, updateProfile, uploadAvatar, cities } = useAuthStore();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    bio: '',
    preferred_city: '',
    website: '',
    phone: '',
  });
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = () => session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  useEffect(() => {
    const fetchLinked = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/linked-accounts`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) setLinkedAccounts(await res.json());
      } catch { /* leave defaults */ }
    };
    fetchLinked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleLink = async (googleToken: string) => {
    setIsLinkingGoogle(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/linked-accounts/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ token: googleToken })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.detail || 'Failed to link Google');
      setLinkedAccounts(prev => ({ ...prev, google: true }));
      toast.success(data?.email ? `Google connected (${data.email})` : 'Google connected');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const cityOptions = cities.length > 0
    ? cities.map(c => ({ id: c.id, name: c.name }))
    : chinaCities.map(c => ({ id: c.id, name: c.name }));

  useEffect(() => {
    const fetchMe = async () => {
      const token = session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const me: MeResponse = await res.json();
          setForm({
            first_name: me.first_name || '',
            last_name: me.last_name || '',
            username: me.username || '',
            bio: me.bio || '',
            preferred_city: me.preferred_city || '',
            website: me.website || '',
            phone: me.phone || '',
          });
          setEmail(me.email || '');
          setAvatar(me.avatar_url || null);
        }
      } catch {
        // fall back to store profile
        if (profile) {
          setForm({
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            username: profile.username || '',
            bio: profile.bio || '',
            preferred_city: profile.city_id || '',
            website: profile.website || '',
            phone: profile.phone || '',
          });
          setEmail(profile.email || '');
          setAvatar(profile.avatar_url || null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatar(url);
      toast.success(t('user.profile.avatarUpdated'));
    } catch {
      toast.error(t('user.profile.avatarUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username || null,
        bio: form.bio,
        website: form.website,
        phone: form.phone,
        preferred_city: form.preferred_city || null,
      } as Partial<typeof profile> & { preferred_city?: string | null });
      toast.success(t('kit.editProfile.saved'));
      navigate('/profile');
    } catch {
      toast.error(t('kit.editProfile.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ') || form.username || email.split('@')[0];

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <section className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('kit.common.back')}
            className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-display text-white flex-1">{t('kit.editProfile.title')}</h1>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 min-h-[44px] rounded-xl bg-[#d3da0c] text-black text-sm font-bold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('kit.common.save')}
          </button>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Avatar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-[#d3da0c]/50 ring-offset-4 ring-offset-[#0A0A0A]"
            aria-label={t('user.profile.changeAvatar', 'Change avatar')}
          >
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#d3da0c] to-[#FF2D8F] flex items-center justify-center">
                <span className="text-3xl font-bold text-black">{(displayName || '?')[0].toUpperCase()}</span>
              </div>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#d3da0c] flex items-center justify-center text-black border-4 border-[#0A0A0A]">
              <Camera className="w-3.5 h-3.5" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#111111] border border-white/5 rounded-2xl divide-y divide-white/5"
        >
          {isLoading ? (
            <div className="p-6 space-y-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {/* Name */}
              <div className="p-4">
                <label className="block text-xs text-gray-500 mb-1.5">{t('kit.editProfile.firstName')}</label>
                <input
                  value={form.first_name}
                  onChange={set('first_name')}
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#d3da0c]/60 focus:outline-none"
                />
              </div>
              <div className="p-4">
                <label className="block text-xs text-gray-500 mb-1.5">{t('kit.editProfile.lastName')}</label>
                <input
                  value={form.last_name}
                  onChange={set('last_name')}
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#d3da0c]/60 focus:outline-none"
                />
              </div>
              {/* Nickname */}
              <div className="p-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <User className="w-3.5 h-3.5" /> {t('kit.editProfile.username')}
                </label>
                <input
                  value={form.username}
                  onChange={set('username')}
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#d3da0c]/60 focus:outline-none"
                />
              </div>
              {/* Bio */}
              <div className="p-4">
                <label className="block text-xs text-gray-500 mb-1.5">{t('kit.editProfile.bio')}</label>
                <textarea
                  value={form.bio}
                  onChange={set('bio')}
                  placeholder={t('kit.editProfile.bioPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:border-[#d3da0c]/60 focus:outline-none resize-none"
                />
              </div>
              {/* Location */}
              <div className="p-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {t('kit.editProfile.location')}
                </label>
                <select
                  value={form.preferred_city}
                  onChange={set('preferred_city')}
                  className="w-full h-11 px-3 rounded-xl bg-[#0A0A0A] border border-white/10 text-white text-sm capitalize focus:border-[#d3da0c]/60 focus:outline-none"
                >
                  <option value="">—</option>
                  {cityOptions.map(city => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </div>
              {/* Website */}
              <div className="p-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Link2 className="w-3.5 h-3.5" /> {t('kit.editProfile.website')}
                </label>
                <input
                  value={form.website}
                  onChange={set('website')}
                  placeholder="https://"
                  inputMode="url"
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:border-[#d3da0c]/60 focus:outline-none"
                />
              </div>
              {/* Email (read-only) */}
              <div className="p-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> {t('kit.editProfile.email')}
                </label>
                <div className="flex items-center justify-between gap-3">
                  <input
                    value={email}
                    readOnly
                    className="flex-1 h-11 px-3 rounded-xl bg-white/5 border border-white/5 text-gray-500 text-sm cursor-not-allowed"
                  />
                  <span className="text-[10px] text-gray-600 shrink-0">{t('kit.editProfile.emailReadOnly')}</span>
                </div>
              </div>
              {/* Phone */}
              <div className="p-4">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                  <Phone className="w-3.5 h-3.5" /> {t('kit.editProfile.phone')}
                </label>
                <input
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+86 "
                  inputMode="tel"
                  className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-600 focus:border-[#d3da0c]/60 focus:outline-none"
                />
              </div>
            </>
          )}
        </motion.div>

        {/* Linked Accounts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-[#111111] border border-white/5 rounded-2xl p-4"
        >
          <h2 className="text-sm font-semibold text-white mb-3">{t('kit.security.linkedAccounts')}</h2>
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-white">G</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{t('kit.security.linkedGoogle')}</p>
              <p className="text-xs text-gray-500">{t('kit.security.linkedGoogleDesc')}</p>
            </div>
            {linkedAccounts.google ? (
              <span className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-[#d3da0c]/10 text-[#d3da0c] text-xs font-bold border border-[#d3da0c]/30">
                <Check className="w-3.5 h-3.5" />
                {t('kit.security.linkedGoogleConnected')}
              </span>
            ) : isLinkingGoogle ? (
              <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin" />
            ) : (
              <div className="[&>div>div]:!m-0">
                <GoogleAuthButton
                  text="signin_with"
                  buttonLabel={t('kit.security.linkedGoogleConnect')}
                  onToken={handleGoogleLink}
                  onError={() => toast.error(t('kit.invite.shareFailed'))}
                />
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-600 mt-3">{t('kit.security.linkedUnsupported')}</p>
        </motion.div>

        {/* Save button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="w-full min-h-[48px] rounded-xl bg-[#d3da0c] text-black font-bold hover:bg-[#bbc10b] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('kit.editProfile.save')}
        </motion.button>
      </div>
    </div>
  );
};

export default EditProfile;
