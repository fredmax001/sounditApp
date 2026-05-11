import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
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

  interface Profile {
    role?: string;
    role_type?: string;
  }

  const getRedirectPath = (profile: Profile | null): string => {
    if (!profile) {
      return '/';
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
      let userProfile = null;

      if (authMethod === 'email') {
        userProfile = await loginWithEmail(email, password);

        if (!userProfile) {
          userProfile = useAuthStore.getState().profile;
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || t('auth.login.loginFailed'));
        }

        const data = await response.json();

        localStorage.setItem('auth-token', data.access_token);

        const backendUser = data.user;
        const backendRole = (backendUser.role || '').toLowerCase();

        let role_type = 'user';
        let role = 'user';

        if (backendRole === 'business' || backendRole === 'organizer') {
          role_type = 'business';
          role = 'organizer';
        } else if (backendRole === 'artist' || backendRole === 'dj') {
          role_type = 'artist';
          role = 'dj';
        } else if (backendRole === 'super_admin') {
          role_type = 'super_admin';
          role = 'admin';
        } else if (backendRole === 'admin') {
          role_type = 'admin';
          role = 'admin';
        } else if (backendRole === 'vendor') {
          role_type = 'vendor';
          role = 'vendor';
        }

        userProfile = {
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
        };

        const profileCity = backendUser.preferred_city || backendUser.city_id || '';
        if (profileCity) {
          setSelectedCity(profileCity);
        }
      }

      if (authMethod === 'email') {
        const storeProfile = useAuthStore.getState().profile;
        const profileCity = (storeProfile as any)?.preferred_city || (storeProfile as any)?.city_id || '';
        if (profileCity) {
          setSelectedCity(profileCity);
        }
      }

      toast.success(t('auth.login.welcomeBack'));

      const redirectPath = getRedirectPath(userProfile);

      navigate(redirectPath);
    } catch (error) {
      toast.error((error as Error).message || t('auth.login.loginFailed'));
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('auth-token', data.access_token);
        // Update Zustand store immediately so auth state is consistent
        useAuthStore.setState({
          session: {
            access_token: data.access_token,
            token_type: 'bearer',
            expires_in: 3600 * 24,
            refresh_token: '',
            user: data.user,
          },
          user: data.user,
          profile: data.user,
          isAuthenticated: true,
        });
        const googleCity = data.user?.preferred_city || data.user?.city_id || '';
        if (googleCity) {
          setSelectedCity(googleCity);
        }
        toast.success(t('auth.login.loginSuccessful'));
        navigate(data.redirect_url || '/');
      } else {
        toast.error(data.detail || t('auth.login.googleLoginFailed'));
      }
    } catch (error) {
      toast.error(t('auth.login.googleLoginError'));
      console.error(error);
    }
  };

  const handleGoogleError = () => {
    toast.error(t('auth.login.googleLoginFailed'));
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">{t('auth.login.title')}</h1>
        <p className="text-gray-400 text-sm">{t('auth.login.subtitle')}</p>
      </div>

      {/* Auth Method Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-lg mb-4">
        <button
          type="button"
          onClick={() => setAuthMethod('email')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${authMethod === 'email'
            ? 'bg-[#d3da0c] text-black'
            : 'text-gray-400 hover:text-white'
            }`}
        >
          <Mail className="w-4 h-4" />
          {t('auth.login.emailTab')}
        </button>
        <button
          type="button"
          onClick={() => setAuthMethod('phone')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${authMethod === 'phone'
            ? 'bg-[#d3da0c] text-black'
            : 'text-gray-400 hover:text-white'
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
            <label className="block text-gray-400 text-sm mb-2">{t('auth.login.emailLabel')}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-gray-400 text-sm mb-2">{t('auth.login.phoneLabel')}</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.login.phonePlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Password Input */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">{t('auth.login.passwordLabel')}</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.login.passwordPlaceholder')}
              className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-[#d3da0c] focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex justify-end mt-1">
            <Link to="/forgot-password" className="text-[#d3da0c] text-sm hover:underline">
              {t('auth.login.forgotPasswordLink')}
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-[#d3da0c] text-black font-semibold rounded-lg hover:bg-[#bbc10b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#111111] text-gray-500">{t('auth.login.orContinueWith')}</span>
        </div>
      </div>

      {/* Google Login */}
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap
          theme="filled_black"
          shape="pill"
          text="signin_with"
        />
      </div>

      {/* Sign Up Link */}
      <p className="text-center text-gray-400 text-sm mt-6">
        {t('auth.login.noAccountText')}{' '}
        <Link to="/register" className="text-[#d3da0c] hover:underline">
          {t('auth.login.signUpLink')}
        </Link>
      </p>
    </div>
  );
};

export default Login;
