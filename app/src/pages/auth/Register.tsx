import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User as UserIcon, Loader2, Check, MapPin, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { chinaCities } from '@/data/constants';
import { toast } from 'sonner';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { API_BASE_URL } from '@/config/api';

type Role = 'user' | 'business' | 'artist_dj' | 'vendor';

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { registerWithEmail, isLoading } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [selectedArtistType, setSelectedArtistType] = useState<string>('DJ');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) {
      toast.error(t('auth.register.selectRoleError'));
      return;
    }

    const effectiveName = (name || businessName).trim();
    if (!effectiveName || !password) {
      toast.error(t('auth.register.fillAllFieldsError'));
      return;
    }

    if (!email) {
      toast.error(t('auth.register.enterEmailError'));
      return;
    }

    if (!selectedCityId) {
      toast.error(t('auth.register.selectCityError'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.register.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 8) {
      toast.error(t('auth.register.passwordMinLength'));
      return;
    }

    if (!agreeTerms) {
      toast.error(t('auth.register.agreeTermsError'));
      return;
    }

    try {
      const nameParts = effectiveName.split(/\s+/);
      const firstName = nameParts[0] || effectiveName;
      const lastName = nameParts.slice(1).join(' ') || '';
      const resolvedEntityName = (businessName.trim() || effectiveName).trim();
      const cleanUsername = username.trim().replace(/^@/, '');

      await registerWithEmail({
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName,
        last_name: lastName,
        username: cleanUsername || undefined,
        city_id: selectedCityId,
        role_type: selectedRole,
        business_name: selectedRole !== 'user' ? resolvedEntityName : undefined,
        artist_type: selectedRole === 'artist_dj' ? selectedArtistType : undefined,
      });

      toast.success(t('auth.register.accountCreated'));
      navigate('/');
    } catch (error: unknown) {
      toast.error((error as Error).message || t('auth.register.registrationFailed'));
    }
  };

  const handleGoogleSuccess = async (token: string) => {
    try {
      const normalizedRole = selectedRole === 'artist_dj' ? 'artist' : (selectedRole || 'user');
      const response = await fetch(`${API_BASE_URL}/auth/google/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, role: normalizedRole }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data?.error?.message || data?.detail || t('auth.register.googleSignUpFailed'));
        return;
      }

      await useAuthStore.getState().loginWithEmail(data.user?.email || '', '', data);
      toast.success(t('auth.register.accountCreated'));
      navigate(data.redirect_url || '/');
    } catch (error) {
      toast.error((error as Error)?.message || t('auth.register.googleSignUpFailed'));
      console.error(error);
    }
  };

  const passwordStrength = () => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const strengthLabels = [t('auth.register.weak'), t('auth.register.fair'), t('auth.register.good'), t('auth.register.strong')];
  const strengthColors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#020b00] dark:text-white mb-2">{t('auth.register.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('auth.register.subtitle')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Selection */}
        <div>
          <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">
            <UserIcon className="w-4 h-4 inline mr-1" />
            {t('auth.register.roleLabel')}
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            className="w-full px-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
            required
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
          >
            <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('auth.register.rolePlaceholder')}</option>
            <option value="user" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('auth.register.roleUser')}</option>
            <option value="business" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('auth.register.roleBusiness')}</option>
            <option value="vendor" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('auth.register.roleVendor')}</option>
            <option value="artist_dj" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('auth.register.roleArtist')}</option>
          </select>
          <p className="text-gray-500 text-xs mt-2">
            {t('auth.register.roleHint')}
          </p>
        </div>

        {selectedRole === 'artist_dj' && (
          <div className="bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-4 space-y-3">
            <label className="block text-[#020b00] dark:text-white text-sm font-semibold">
              {t('artist.dashboard.label.artistType') || 'Creative Discipline'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'DJ', label: t('artist.dashboard.artistType.dj') || 'DJ', icon: '🎧' },
                { id: 'Singer', label: t('artist.dashboard.artistType.singer') || 'Singer', icon: '🎤' },
                { id: 'Dancer', label: t('artist.dashboard.artistType.dancer') || 'Dancer', icon: '💃' },
                { id: 'Photographer', label: t('artist.dashboard.artistType.photographer') || 'Photographer', icon: '📸' },
                { id: 'MC', label: t('artist.dashboard.artistType.mc') || 'MC', icon: '🎙️' },
                { id: 'Artist', label: t('artist.dashboard.artistType.artist') || 'Other Artist', icon: '🎨' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedArtistType(item.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all border ${
                    selectedArtistType === item.id
                      ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black border-transparent shadow-sm'
                      : 'bg-white dark:bg-[#111111] text-[#020b00] dark:text-white border-black/10 dark:border-white/10 hover:border-[#020b00] dark:hover:border-[#d3da0c]'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {selectedRole && selectedRole !== 'user' && (
            <div>
              <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">
                {selectedRole === 'business'
                  ? t('auth.register.businessNameLabel', 'Business / Organization Name *')
                  : selectedRole === 'artist_dj'
                  ? t('auth.register.stageNameLabel', 'Stage / Artist Name *')
                  : t('auth.register.vendorNameLabel', 'Vendor / Shop Name *')}
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={
                    selectedRole === 'business'
                      ? 'e.g. Sound It Entertainment'
                      : selectedRole === 'artist_dj'
                      ? 'e.g. DJ Kofi'
                      : 'e.g. Afro Kitchen'
                  }
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">
              {selectedRole && selectedRole !== 'user'
                ? t('auth.register.contactNameLabel', 'Your Full Name *')
                : t('auth.register.fullNameLabel')}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.register.fullNamePlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">
              {t('kit.editProfile.username', 'Username')}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                placeholder="username"
                autoCapitalize="none"
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* City Selection */}
          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Select Your City in China *
            </label>
            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors appearance-none cursor-pointer"
              required
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
            >
              <option value="" className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">{t('auth.register.cityPlaceholder')}</option>
              {chinaCities.filter(c => c.id !== 'all').map(city => (
                <option key={city.id} value={city.id} className="bg-white dark:bg-[#111111] text-[#020b00] dark:text-white">
                  {city.name} {city.nameCN}
                </option>
              ))}
            </select>
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">{t('auth.register.emailLabel')}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.register.emailPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">{t('auth.register.passwordLabel')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.register.passwordPlaceholder')}
                className="w-full pl-12 pr-12 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#020b00] dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {password && (
              <div className="mt-2 text-left">
                <div className="flex gap-1 mb-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength() ? strengthColors[passwordStrength() - 1] : 'bg-black/10 dark:bg-white/10'
                        }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${passwordStrength() === 0 ? 'text-red-500' :
                  passwordStrength() === 1 ? 'text-yellow-500' :
                    passwordStrength() === 2 ? 'text-blue-500' :
                      'text-green-500'
                  }`}>
                  {strengthLabels[passwordStrength() - 1] || t('auth.register.tooShort')}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">{t('auth.register.confirmPasswordLabel')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.register.passwordPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
                required
              />
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setAgreeTerms(!agreeTerms)}
            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${agreeTerms
              ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black border-[#020b00] dark:border-[#d3da0c]'
              : 'border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40'
              }`}
          >
            {agreeTerms && <Check className="w-3 h-3" />}
          </button>
          <p className="text-gray-600 dark:text-gray-400 text-sm text-left">
            {t('auth.register.agreeText')}{' '}
            <Link to="/about" className="text-[#020b00] dark:text-[#d3da0c] hover:underline font-semibold">
              {t('auth.register.termsOfService')}
            </Link>{' '}
            {t('auth.register.and')}{' '}
            <Link to="/about" className="text-[#020b00] dark:text-[#d3da0c] hover:underline font-semibold">
              {t('auth.register.privacyPolicy')}
            </Link>
          </p>
        </div>

        {/* Create Account Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-bold rounded-xl hover:opacity-90 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              {t('auth.register.creatingAccount')}
            </>
          ) : (
            t('auth.register.createAccountButton')
          )}
        </button>
      </form>

      {/* Google Sign Up */}
      <>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/10 dark:border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400">{t('auth.register.orSignUpWith')}</span>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <GoogleAuthButton
            text="signup_with"
            buttonLabel={t('auth.register.googleSignUp')}
            onToken={handleGoogleSuccess}
            onError={(error?: unknown) => {
              console.error('Google sign-up error:', error);
              const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : (error as any)?.message || '';
              if (msg.toLowerCase().includes('cancel') || (error as any)?.code === 'USER_CANCELLED') {
                return;
              }
              toast.error(msg ? `${t('auth.register.googleSignUpFailed')}: ${msg}` : t('auth.register.googleSignUpFailed'));
            }}
          />
        </div>
      </>

      {/* Sign In Link */}
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-8 pb-8">
        {t('auth.register.alreadyHaveAccount')}{' '}
        <Link to="/login" className="text-[#020b00] dark:text-[#d3da0c] hover:underline font-semibold">
          {t('auth.register.signInLink')}
        </Link>
      </p>
    </div>
  );
};

export default Register;
