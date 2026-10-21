import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Loader2, Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { API_BASE_URL } from '@/config/api';

type AuthMethod = 'email' | 'phone';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSelectedCity, isLoading, loginWithEmail } = useAuthStore();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState<{ token: string; mode: AuthMethod } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pinMode, setPinMode] = useState(false);
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinCode, setPinCode] = useState('');

  interface Profile {
    role?: string;
    role_type?: string;
    staff_role?: string | null;
    staff_permissions?: Record<string, boolean> | null;
  }

  const getRedirectPath = (profile: Profile | null): string => {
    if (!profile) {
      return '/';
    }

    const staffRole = (profile.staff_role || '').toLowerCase();
    if (staffRole === 'finance' || profile.staff_permissions?.financials) {
      return '/dashboard/business/finance';
    }

    const roleType = profile.role_type || profile.role;
    const legacyRole = profile.role;

    if (roleType === 'admin' ||
      roleType === 'super_admin' ||
      legacyRole === 'admin' ||
      legacyRole === 'super_admin' ||
      profile.role === 'ADMIN' ||
      profile.role === 'SUPER_ADMIN') {
      return '/admin/dashboard';
    }

    if (roleType === 'business' ||
      legacyRole === 'organizer' ||
      legacyRole === 'business' ||
      profile.role === 'BUSINESS' ||
      profile.role === 'ORGANIZER') {
      return '/dashboard/business';
    }

    if (roleType === 'artist' ||
      legacyRole === 'dj' ||
      legacyRole === 'artist' ||
      profile.role === 'ARTIST') {
      return '/dashboard/artist';
    }

    if (roleType === 'vendor' ||
      legacyRole === 'vendor' ||
      profile.role === 'VENDOR') {
      return '/dashboard/vendor';
    }

    return '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentIdentifier = authMethod === 'email' ? email : phone;

    if (!currentIdentifier) {
      toast.error(t('auth.login.enterIdentifierError', { method: authMethod === 'email' ? t('auth.login.email') : t('auth.login.phoneNumber') }));
      return;
    }

    if (!password) {
      toast.error(t('auth.login.enterPasswordError'));
      return;
    }

    try {
      if (authMethod === 'email') {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data?.requires_2fa) {
          setTwoFactor({ token: data.two_factor_token, mode: 'email' });
          setOtpCode('');
          setPassword('');
          return;
        }
        if (!res.ok) throw new Error(data?.error?.message || data?.detail || t('auth.login.loginFailed'));

        const userProfile = await loginWithEmail(email, password, data);
        import('@/lib/analytics').then(({ Analytics }) => {
          Analytics.trackEvent('login', 'engagement', { method: 'email' });
        });
        finalizeLogin(userProfile || useAuthStore.getState().profile);
      } else {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });

        const data = await response.json();
        if (data?.requires_2fa) {
          setTwoFactor({ token: data.two_factor_token, mode: 'phone' });
          setOtpCode('');
          setPassword('');
          return;
        }
        if (!response.ok) {
          throw new Error(data?.error?.message || data?.detail || t('auth.login.loginFailed'));
        }

        const userProfile = await loginWithEmail(data.user?.email || '', password, data);
        finalizeLogin(userProfile || profileFromBackendUser(data));
      }
    } catch (error) {
      toast.error((error as Error).message || t('auth.login.loginFailed'));
    }
  };

  const profileFromBackendUser = (data: any) => {
    const backendUser = data.user;
    localStorage.setItem('auth-token', data.access_token);

    const backendRole = (backendUser.role || '').toLowerCase();
    let role_type = 'user';
    let role = 'user';
    if (backendRole === 'business' || backendRole === 'organizer') { role_type = 'business'; role = 'organizer'; }
    else if (backendRole === 'artist' || backendRole === 'dj') { role_type = 'artist'; role = 'dj'; }
    else if (backendRole === 'super_admin') { role_type = 'super_admin'; role = 'admin'; }
    else if (backendRole === 'admin') { role_type = 'admin'; role = 'admin'; }
    else if (backendRole === 'vendor') { role_type = 'vendor'; role = 'vendor'; }

    const userProfile = {
      id: String(backendUser.id),
      email: backendUser.email || '',
      phone: backendUser.phone,
      role: role,
      role_type: role_type,
      status: backendUser.status || 'active',
      first_name: backendUser.first_name,
      last_name: backendUser.last_name,
      display_name: `${backendUser.first_name || ''} ${backendUser.last_name || ''}`.trim(),
      avatar_url: backendUser.avatar_url,
      is_verified: backendUser.is_verified,
      staff_id: backendUser.staff_id ?? null,
      staff_role: backendUser.staff_role ?? null,
      staff_permissions: backendUser.staff_permissions ?? null,
      business_name: backendUser.business_name ?? null,
    };

    const profileCity = backendUser.preferred_city || backendUser.city_id || '';
    if (profileCity) setSelectedCity(profileCity);
    return userProfile;
  };

  const finalizeLogin = (userProfile: any) => {
    if (authMethod === 'email') {
      const storeProfile = useAuthStore.getState().profile;
      const profileCity = (storeProfile as any)?.preferred_city || (storeProfile as any)?.city_id || '';
      if (profileCity) setSelectedCity(profileCity);
    }
    toast.success(t('auth.login.welcomeBack'));
    navigate(getRedirectPath(userProfile));
  };

  const handleVerify2fa = async () => {
    if (!twoFactor || otpCode.length !== 6) return;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/2fa/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ two_factor_token: twoFactor.token, code: otpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.detail || t('kit.security.wrongCode'));
      if (twoFactor.mode === 'phone') {
        finalizeLogin(profileFromBackendUser(data));
      } else {
        const userProfile = await loginWithEmail(email, password, data);
        finalizeLogin(userProfile || useAuthStore.getState().profile);
      }
    } catch (error) {
      toast.error((error as Error).message || t('kit.security.wrongCode'));
    }
  };

  const handlePinLogin = async () => {
    if (!pinIdentifier || !pinCode) return;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/pin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pinIdentifier.trim().toLowerCase(), pin: pinCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.detail || t('auth.login.loginFailed'));
      const userProfile = await loginWithEmail(pinIdentifier, '', data);
      finalizeLogin(userProfile || useAuthStore.getState().profile);
    } catch (error) {
      toast.error((error as Error).message || t('auth.login.loginFailed'));
    }
  };

  const handleGoogleSuccess = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        const userProfile = await loginWithEmail(data.user?.email || '', '', data);
        const googleCity = data.user?.preferred_city || data.user?.city_id || '';
        if (googleCity) {
          setSelectedCity(googleCity);
        }
        toast.success(t('auth.login.loginSuccessful'));
        navigate(data.redirect_url || getRedirectPath(userProfile || useAuthStore.getState().profile));
      } else {
        toast.error(data?.error?.message || data?.detail || t('auth.login.googleLoginFailed'));
      }
    } catch (error) {
      toast.error((error as Error)?.message || t('auth.login.googleLoginError'));
      console.error(error);
    }
  };

  const handleGoogleError = (error?: unknown) => {
    console.error('Google login failed:', error);
    const errorMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : (error as any)?.message || '';
    if (errorMsg.toLowerCase().includes('cancel') || (error as any)?.code === 'USER_CANCELLED') {
      return;
    }
    if (errorMsg) {
      toast.error(`${t('auth.login.googleLoginFailed')}: ${errorMsg}`);
    } else {
      toast.error(t('auth.login.googleLoginFailed'));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-[#020b00] dark:text-white mb-1">{t('auth.login.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('auth.login.subtitle')}</p>
      </div>

      {/* Two-factor verification step */}
      {twoFactor ? (
        <div>
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-[#020b00] dark:text-white mb-1">{t('kit.security.loginTwoFactorTitle')}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{t('kit.security.loginTwoFactorDesc')}</p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleVerify2fa(); }}
              placeholder="••••••"
              className="w-full px-4 py-4 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white text-center text-2xl tracking-[0.6em] placeholder-gray-400 dark:placeholder-gray-600 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
            />
            <button
              onClick={handleVerify2fa}
              disabled={isLoading || otpCode.length !== 6}
              className="w-full py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('kit.security.verify')}
            </button>
            <button
              onClick={() => { setTwoFactor(null); setOtpCode(''); }}
              className="w-full py-2 text-gray-600 dark:text-gray-400 text-sm hover:text-[#020b00] dark:hover:text-white transition-colors"
            >
              {t('kit.common.back')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Auth Method Tabs */}
          <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-white/5 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => setAuthMethod('email')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${authMethod === 'email'
            ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'
            }`}
        >
          <Mail className="w-4 h-4" />
          {t('auth.login.emailTab')}
        </button>
        <button
          type="button"
          onClick={() => setAuthMethod('phone')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${authMethod === 'phone'
            ? 'bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-[#020b00] dark:hover:text-white'
            }`}
        >
          <Phone className="w-4 h-4" />
          {t('auth.login.phoneTab')}
        </button>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email/Phone Input */}
        {authMethod === 'email' ? (
          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">{t('auth.login.emailLabel')}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">{t('auth.login.phoneLabel')}</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.login.phonePlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Password Input */}
        <div>
          <label className="block text-[#020b00] dark:text-white text-sm font-medium mb-2">{t('auth.login.passwordLabel')}</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.login.passwordPlaceholder')}
              className="w-full pl-12 pr-12 py-3 bg-neutral-50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#020b00] dark:hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex justify-end mt-1">
            <Link to="/forgot-password" className="text-gray-700 dark:text-[#d3da0c] text-sm hover:underline font-medium">
              {t('auth.login.forgotPasswordLink')}
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('auth.login.signingIn')}
            </>
          ) : (
            t('auth.login.signIn')
          )}
        </button>
      </form>

      </>
      )}

      {/* Quick PIN login */}
      {!twoFactor && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPinMode(m => !m)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-700 dark:text-[#d3da0c] text-sm font-medium hover:underline"
          >
            <KeyRound className="w-4 h-4" />
            {t('kit.security.loginWithPin')}
          </button>
          {pinMode && (
            <div className="space-y-3 mt-2 bg-neutral-100 dark:bg-white/5 rounded-xl p-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={pinIdentifier}
                  onChange={e => setPinIdentifier(e.target.value)}
                  placeholder={t('kit.security.pinEmail')}
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinCode}
                  onChange={e => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => { if (e.key === 'Enter') handlePinLogin(); }}
                  placeholder={t('kit.security.pinCode')}
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#020b00] border border-black/10 dark:border-white/10 rounded-lg text-[#020b00] dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#020b00] dark:focus:border-[#d3da0c] focus:outline-none"
                />
              </div>
              <button
                onClick={handlePinLogin}
                disabled={isLoading || !pinIdentifier || !pinCode}
                className="w-full py-3 bg-[#020b00] text-[#d3da0c] dark:bg-[#d3da0c] dark:text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('kit.security.pinLogin')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-black/10 dark:border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-400">{t('auth.login.orContinueWith')}</span>
        </div>
      </div>

      {/* Google Login */}
      <div className="flex justify-center">
        <GoogleAuthButton
          text="signin_with"
          buttonLabel={t('auth.login.googleSignIn')}
          onToken={handleGoogleSuccess}
          onError={handleGoogleError}
        />
      </div>

      {/* Sign Up Link */}
      <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-6">
        {t('auth.login.noAccountText')}{' '}
        <Link to="/register" className="text-[#020b00] dark:text-[#d3da0c] font-semibold hover:underline">
          {t('auth.login.signUpLink')}
        </Link>
      </p>
    </div>
  );
};

export default Login;
