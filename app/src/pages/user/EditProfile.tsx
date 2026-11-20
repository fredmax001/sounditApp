/**
 * Edit Profile (/profile/edit)
 * Header: Back, "Edit Profile", yellow Save pill.
 * Cover banner + avatar with camera badges.
 * 5 horizontally scrollable tabs: Account, Profile, Work/Edu, Social, Privacy.
 * Extended fields persist through PUT /auth/me (profile_data JSON).
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Camera, Check, ShieldCheck, Lock, ChevronRight, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { chinaCities } from '@/data/constants';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';
import GoogleAuthButton from '@/components/GoogleAuthButton';

type TabId = 'account' | 'profile' | 'work' | 'social' | 'privacy';

const TABS: { id: TabId; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'work', label: 'Work/Edu' },
  { id: 'social', label: 'Social' },
  { id: 'privacy', label: 'Privacy' },
];

const inputCls =
  'w-full h-11 px-3.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white text-sm placeholder:text-gray-500 focus:border-[#d3da0c] focus:outline-none';
const selectCls =
  'w-full h-11 px-3 rounded-xl bg-neutral-100 dark:bg-[#0a1408] border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white text-sm focus:border-[#d3da0c] focus:outline-none';

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div>
    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-semibold">{label}</label>
    {children}
    {hint && <p className="text-[0.6875rem] text-gray-500 mt-1">{hint}</p>}
  </div>
);

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-neutral-50 dark:bg-[#0a1408] border border-black/10 dark:border-white/10 rounded-2xl p-4 space-y-4"
  >
    <div>
      <h2 className="text-sm font-extrabold text-[#020b00] dark:text-white">{title}</h2>
      {subtitle && <p className="text-[0.6875rem] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </motion.div>
);

const Toggle = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="w-full flex items-center justify-between gap-3 py-1 text-left"
  >
    <div className="min-w-0">
      <p className="text-sm text-[#020b00] dark:text-white font-medium">{label}</p>
      {desc && <p className="text-[0.6875rem] text-gray-500">{desc}</p>}
    </div>
    <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#d3da0c]' : 'bg-black/15 dark:bg-white/15'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  </button>
);

const DEFAULT_PDATA: Record<string, any> = {
  country: '',
  hometown: '',
  occupation: '',
  company: '',
  industry: '',
  education: '',
  skills: '',
  facebook: '',
  youtube: '',
  other_links: '',
  profile_visibility: 'public',
  followers_visibility: 'public',
  messaging_permission: 'everyone',
  post_visibility: 'public',
  activity_visibility: true,
  show_online_status: true,
  blocked_users: '',
};

const EditProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, profile, businessProfile, artistProfile, updateProfile, uploadAvatar, uploadBanner, cities } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    business_name: '',
    stage_name: '',
    bio: '',
    preferred_city: '',
    website: '',
    phone: '',
    gender: '',
    date_of_birth: '',
    instagram: '',
    twitter: '',
    tiktok: '',
    wechat_id: '',
  });
  const [pdata, setPdata] = useState<Record<string, any>>(DEFAULT_PDATA);
  const [originalEmail, setOriginalEmail] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const token = () => session?.access_token || localStorage.getItem('auth-token') || localStorage.getItem('token');

  const roleKey = (profile?.role_type || profile?.role || 'user').toString().toLowerCase();
  const isBusinessOrVendor = roleKey === 'business' || roleKey === 'organizer' || roleKey === 'vendor';
  const isArtist = roleKey === 'artist' || roleKey === 'artist_dj' || roleKey === 'dj';

  const cityOptions = cities.length > 0
    ? cities.map(c => ({ id: c.id, name: c.name }))
    : chinaCities.filter(c => c.id !== 'all').map(c => ({ id: c.id, name: c.name }));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/linked-accounts`, { headers: { Authorization: `Bearer ${token()}` } });
        if (res.ok) setLinkedAccounts(await res.json());
      } catch { /* defaults */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchMe = async () => {
      const tk = token();
      if (!tk) { setIsLoading(false); return; }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${tk}` } });
        if (res.ok) {
          const me: any = await res.json();
          setForm({
            first_name: me.first_name || '',
            last_name: me.last_name || '',
            username: me.username || '',
            email: me.email || '',
            business_name:
              me.business_profile?.business_name || me.organizer_profile?.organization_name ||
              me.vendor_profile?.business_name || businessProfile?.business_name || '',
            stage_name: me.artist_profile?.stage_name || artistProfile?.stage_name || '',
            bio: me.bio || '',
            preferred_city: me.preferred_city || '',
            website: me.website || '',
            phone: me.phone || '',
            gender: me.gender || '',
            date_of_birth: me.date_of_birth ? String(me.date_of_birth).slice(0, 10) : '',
            instagram: me.instagram || '',
            twitter: me.twitter || '',
            tiktok: me.tiktok || '',
            wechat_id: me.wechat_id || '',
          });
          setPdata({ ...DEFAULT_PDATA, ...(me.profile_data || {}) });
          setOriginalEmail(me.email || '');
          setAvatar(me.avatar_url || profile?.avatar_url || null);
          setBackgroundUrl(me.background_url || profile?.background_url || profile?.banner_url || null);
        }
      } catch {
        if (profile) {
          setForm(prev => ({
            ...prev,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            username: profile.username || '',
            email: profile.email || '',
            bio: profile.bio || '',
            website: profile.website || '',
            phone: profile.phone || '',
          }));
          setAvatar(profile.avatar_url || null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const setP = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setPdata(prev => ({ ...prev, [key]: e.target.value }));

  const handleGoogleLink = async (googleToken: string) => {
    setIsLinkingGoogle(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/linked-accounts/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ token: googleToken }),
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatar(url);
      toast.success(t('user.profile.avatarUpdated', 'Profile photo updated!'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('user.profile.avatarUploadFailed', 'Failed to upload photo'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const url = await uploadBanner(file);
      setBackgroundUrl(url);
      toast.success('Cover photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload cover photo');
    } finally {
      setIsUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username ? form.username.trim().replace(/^@/, '') : null,
        email: form.email && form.email.trim().toLowerCase() !== originalEmail.toLowerCase() ? form.email.trim() : undefined,
        business_name: isBusinessOrVendor && form.business_name.trim() ? form.business_name.trim() : undefined,
        stage_name: isArtist && form.stage_name.trim() ? form.stage_name.trim() : undefined,
        bio: form.bio,
        website: form.website,
        phone: form.phone,
        preferred_city: form.preferred_city || null,
        gender: form.gender || undefined,
        date_of_birth: form.date_of_birth || undefined,
        instagram: form.instagram,
        twitter: form.twitter,
        tiktok: form.tiktok,
        wechat_id: form.wechat_id,
        profile_data: pdata,
      } as any);
      toast.success(t('kit.editProfile.saved', 'Profile saved'));
      navigate('/profile');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('kit.editProfile.saveFailed', 'Failed to save profile'));
    } finally {
      setIsSaving(false);
    }
  };

  const displayName =
    (isBusinessOrVendor && form.business_name.trim()) ||
    (isArtist && form.stage_name.trim()) ||
    [form.first_name, form.last_name].filter(Boolean).join(' ') ||
    form.username ||
    form.email.split('@')[0];

  return (
    <div className="min-h-dvh bg-white dark:bg-[#020B00] text-[#020b00] dark:text-white pb-16 transition-colors duration-200">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020B00]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 safe-area-pt">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-extrabold tracking-tight">Edit Profile</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-5 h-9 rounded-full bg-[#d3da0c] text-black text-sm font-extrabold flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Cover + Avatar */}
        <div className="relative">
          <div className="relative h-36 sm:h-44 w-full overflow-hidden bg-[#0a1408]">
            {backgroundUrl ? (
              <img src={backgroundUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <img src="/onboarding/screen3-event.png" alt="" className="w-full h-full object-cover opacity-70" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 dark:to-[#020B00]/80" />
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-[#d3da0c] text-black flex items-center justify-center shadow-lg disabled:opacity-60"
              aria-label="Change cover photo"
            >
              {isUploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>

          <div className="absolute left-4 -bottom-10">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full border-[3px] border-[#d3da0c] bg-white dark:bg-[#020B00] p-[2px] shadow-2xl"
              aria-label="Change profile photo"
            >
              <img
                src={avatar || '/default-avatar.png'}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
              />
              {isUploading && (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#d3da0c] animate-spin" />
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-[#d3da0c] flex items-center justify-center text-black border-[3px] border-white dark:border-[#020B00]">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-14 px-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#d3da0c] text-black'
                  : 'bg-neutral-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-4 pt-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-11 bg-white/5 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'account' && (
                <>
                  <Section title="Account" subtitle="Login details and contact information">
                    <Field label="Username">
                      <input value={form.username} onChange={set('username')} placeholder="@username" className={inputCls} />
                    </Field>
                    <Field label="Email">
                      <input value={form.email} onChange={set('email')} type="email" inputMode="email" className={inputCls} />
                    </Field>
                    <Field label="Phone">
                      <input value={form.phone} onChange={set('phone')} placeholder="+86 " inputMode="tel" className={inputCls} />
                    </Field>
                  </Section>

                  <Section title="Security" subtitle="Password and two-factor authentication">
                    {[
                      { label: 'Change Password', icon: Lock, path: '/settings/security' },
                      { label: 'Two-Factor Authentication', icon: ShieldCheck, path: '/settings/security' },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className="w-full flex items-center justify-between py-1"
                      >
                        <span className="flex items-center gap-3 text-sm text-[#020b00] dark:text-white">
                          <item.icon className="w-4 h-4 text-[#8a8f04] dark:text-[#d3da0c]" />
                          {item.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))}
                  </Section>

                  <Section title="Linked Accounts">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <Link2 className="w-4 h-4 text-[#d3da0c]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Google</p>
                        <p className="text-[0.6875rem] text-gray-500">Sign in faster with your Google account</p>
                      </div>
                      {linkedAccounts.google ? (
                        <span className="flex items-center gap-1 px-3 h-8 rounded-full bg-[#d3da0c]/10 text-[#d3da0c] text-xs font-bold border border-[#d3da0c]/30">
                          <Check className="w-3.5 h-3.5" /> Connected
                        </span>
                      ) : isLinkingGoogle ? (
                        <Loader2 className="w-5 h-5 text-[#d3da0c] animate-spin" />
                      ) : (
                        <div className="[&>div>div]:!m-0">
                          <GoogleAuthButton
                            text="signin_with"
                            buttonLabel="Connect"
                            onToken={handleGoogleLink}
                            onError={() => toast.error('Google connection failed')}
                          />
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              {activeTab === 'profile' && (
                <Section title="Identity" subtitle="Name, bio and profile basics">
                  {isBusinessOrVendor && (
                    <Field label={roleKey === 'vendor' ? 'Vendor / Shop Name' : 'Business / Organization Name'}>
                      <input value={form.business_name} onChange={set('business_name')} className={inputCls} />
                    </Field>
                  )}
                  {isArtist && (
                    <Field label="Stage / Artist Name">
                      <input value={form.stage_name} onChange={set('stage_name')} className={inputCls} />
                    </Field>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name">
                      <input value={form.first_name} onChange={set('first_name')} className={inputCls} />
                    </Field>
                    <Field label="Last Name">
                      <input value={form.last_name} onChange={set('last_name')} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Biography">
                    <textarea
                      value={form.bio}
                      onChange={set('bio')}
                      rows={3}
                      placeholder="Event Curator | DJ | African Entertainment in China"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white text-sm placeholder:text-gray-500 focus:border-[#d3da0c] focus:outline-none resize-none"
                    />
                  </Field>
                  <Field label="Website">
                    <input value={form.website} onChange={set('website')} placeholder="https://" inputMode="url" className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Gender">
                      <select value={form.gender} onChange={set('gender')} className={selectCls}>
                        <option value="">Prefer not to say</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field label="Birthday">
                      <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Country">
                    <input value={pdata.country} onChange={setP('country')} placeholder="e.g. Nigeria" className={inputCls} />
                  </Field>
                  <Field label="Current City">
                    <select value={form.preferred_city} onChange={set('preferred_city')} className={`${selectCls} capitalize`}>
                      <option value="">Select city</option>
                      {cityOptions.map(city => (
                        <option key={city.id} value={city.id}>{city.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Hometown">
                    <input value={pdata.hometown} onChange={setP('hometown')} placeholder="e.g. Lagos" className={inputCls} />
                  </Field>
                </Section>
              )}

              {activeTab === 'work' && (
                <Section title="Work & Education" subtitle="Share your professional background">
                  <Field label="Occupation">
                    <input value={pdata.occupation} onChange={setP('occupation')} placeholder="Event Curator" className={inputCls} />
                  </Field>
                  <Field label="Company">
                    <input value={pdata.company} onChange={setP('company')} className={inputCls} />
                  </Field>
                  <Field label="Industry">
                    <select value={pdata.industry} onChange={setP('industry')} className={selectCls}>
                      <option value="">Select industry</option>
                      {['Entertainment', 'Music', 'Hospitality', 'Food & Beverage', 'Fashion', 'Media', 'Technology', 'Education', 'Trade', 'Other'].map(i => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Education">
                    <input value={pdata.education} onChange={setP('education')} placeholder="University / School" className={inputCls} />
                  </Field>
                  <Field label="Skills" hint="Separate skills with commas">
                    <input value={pdata.skills} onChange={setP('skills')} placeholder="DJing, Event Planning, Photography" className={inputCls} />
                  </Field>
                </Section>
              )}

              {activeTab === 'social' && (
                <Section title="Social Links" subtitle="Help people find you on other platforms">
                  <Field label="Instagram">
                    <input value={form.instagram} onChange={set('instagram')} placeholder="@handle" className={inputCls} />
                  </Field>
                  <Field label="Facebook">
                    <input value={pdata.facebook} onChange={setP('facebook')} placeholder="facebook.com/..." className={inputCls} />
                  </Field>
                  <Field label="TikTok">
                    <input value={form.tiktok} onChange={set('tiktok')} placeholder="@handle" className={inputCls} />
                  </Field>
                  <Field label="YouTube">
                    <input value={pdata.youtube} onChange={setP('youtube')} placeholder="youtube.com/@..." className={inputCls} />
                  </Field>
                  <Field label="X (Twitter)">
                    <input value={form.twitter} onChange={set('twitter')} placeholder="@handle" className={inputCls} />
                  </Field>
                  <Field label="WeChat ID">
                    <input value={form.wechat_id} onChange={set('wechat_id')} className={inputCls} />
                  </Field>
                  <Field label="Other Links" hint="One link per line">
                    <textarea
                      value={pdata.other_links}
                      onChange={setP('other_links')}
                      rows={2}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[#020b00] dark:text-white text-sm placeholder:text-gray-500 focus:border-[#d3da0c] focus:outline-none resize-none"
                    />
                  </Field>
                </Section>
              )}

              {activeTab === 'privacy' && (
                <Section title="Privacy" subtitle="Control who sees your profile and activity">
                  <Field label="Profile Visibility">
                    <select value={pdata.profile_visibility} onChange={setP('profile_visibility')} className={selectCls}>
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Only me</option>
                    </select>
                  </Field>
                  <Field label="Who can see my followers">
                    <select value={pdata.followers_visibility} onChange={setP('followers_visibility')} className={selectCls}>
                      <option value="public">Everyone</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Only me</option>
                    </select>
                  </Field>
                  <Field label="Who can message me">
                    <select value={pdata.messaging_permission} onChange={setP('messaging_permission')} className={selectCls}>
                      <option value="everyone">Everyone</option>
                      <option value="followers">People I follow</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </Field>
                  <Field label="Default post visibility">
                    <select value={pdata.post_visibility} onChange={setP('post_visibility')} className={selectCls}>
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                    </select>
                  </Field>
                  <Toggle
                    label="Show my activity"
                    desc="Let others see events you attend and reels you like"
                    checked={Boolean(pdata.activity_visibility)}
                    onChange={v => setPdata(prev => ({ ...prev, activity_visibility: v }))}
                  />
                  <Toggle
                    label="Show online status"
                    checked={Boolean(pdata.show_online_status)}
                    onChange={v => setPdata(prev => ({ ...prev, show_online_status: v }))}
                  />
                  <Field label="Blocked users" hint="Usernames separated by commas">
                    <input value={pdata.blocked_users} onChange={setP('blocked_users')} placeholder="@user1, @user2" className={inputCls} />
                  </Field>
                </Section>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 rounded-full bg-[#d3da0c] text-black font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
